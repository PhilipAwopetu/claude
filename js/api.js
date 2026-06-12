/* BetLens — Claude API layer. Classic script: exposes window.BL_API.
   Calls api.anthropic.com directly from the browser (CORS opt-in header). */
window.BL_API = (function () {
  const API_URL = "https://api.anthropic.com/v1/messages";

  const SYSTEM_PROMPT = `You are a professional sports betting analyst covering football (American football and soccer) and basketball (NBA, NCAA, EuroLeague and other leagues). The user gives you a list of games with the position they intend to bet. Your job is to evaluate each position honestly and rigorously.

For each game:
- Identify the sport and parse the user's intended position (moneyline, spread, total, prop, parlay leg, etc.).
- Weigh the relevant factors: recent form, head-to-head history, injuries and availability, rest/schedule spots, home/away splits, pace and matchup dynamics, motivation/situational angles, and — when odds are given — whether the line offers value relative to a fair price.
- If current research notes are provided in the message, ground your analysis in them and prefer them over your own prior knowledge, which may be outdated.
- Reach exactly one verdict:
  - "bet" — the user's position is sound; keep it.
  - "avoid" — neither the user's position nor any alternative in this game offers value; skip the game.
  - "better_position" — there is a clearly stronger bet in the same game (other side, different market, adjusted line); name it precisely.
- Suggest a stake in units (0.5–2 for normal plays, up to 3 only for exceptional value, 0 when the verdict is "avoid").
- Calibrate confidence honestly on a 0–100 scale. Sports betting edges are small: confidence above 75 should be rare and reserved for clear mispricings. Never imply a guaranteed outcome.
- Note correlation between the user's bets (same game, same team, stacked parlays) in the overall notes, along with any bankroll-level concerns like total exposure or chasing.

Be direct and specific. If you lack enough information about a game (unknown teams, no date, ambiguous position), say so in the caveats and lower your confidence rather than guessing.`;

  const OUTPUT_SCHEMA = {
    type: "object",
    properties: {
      games: {
        type: "array",
        items: {
          type: "object",
          properties: {
            matchup: { type: "string", description: "The two teams, e.g. 'Lakers vs Celtics'" },
            sport: { type: "string", enum: ["football", "basketball", "other"] },
            user_position: { type: "string", description: "The bet the user intends to place, as parsed from their input, including odds if given" },
            verdict: { type: "string", enum: ["bet", "avoid", "better_position"] },
            confidence: { type: "integer", description: "0-100. Honest calibration; >75 only for clear mispricings." },
            risk_level: { type: "string", enum: ["low", "medium", "high"] },
            suggested_stake_units: { type: "number", description: "Suggested stake in units. 0.5-2 typical, max 3, 0 when verdict is 'avoid'." },
            analysis: { type: "string", description: "Concise analysis, roughly 60-120 words" },
            key_factors: { type: "array", items: { type: "string" }, description: "3-5 short bullet factors" },
            better_position: { type: "string", description: "The specific recommended alternative bet. Empty string when verdict is 'bet' or 'avoid'." },
            caveats: { type: "string", description: "Uncertainty, missing info, or data-staleness warnings. Empty string if none." }
          },
          required: ["matchup", "sport", "user_position", "verdict", "confidence", "risk_level", "suggested_stake_units", "analysis", "key_factors", "better_position", "caveats"],
          additionalProperties: false
        }
      },
      overall_notes: { type: "string", description: "Bankroll-level view: correlation between bets, total exposure, anything the user should know across the whole slate" }
    },
    required: ["games", "overall_notes"],
    additionalProperties: false
  };

  async function request(apiKey, body) {
    let res;
    try {
      res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify(body)
      });
    } catch (e) {
      throw new Error("Network error — check your internet connection.");
    }
    if (!res.ok) {
      let detail = "";
      try { const j = await res.json(); detail = (j.error && j.error.message) || ""; } catch (e) {}
      if (res.status === 401) throw new Error("Invalid API key — fix it in Settings (or config.js).");
      if (res.status === 429) throw new Error("Rate limited by the API — wait a minute and try again.");
      if (res.status === 529) throw new Error("The API is temporarily overloaded — try again shortly.");
      throw new Error(`API error ${res.status}${detail ? ": " + detail : ""}`);
    }
    return res.json();
  }

  const textOf = (msg) =>
    msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");

  /* Research pass: server-side web search for injuries, form, lines.
     The server tool loop may pause (stop_reason "pause_turn") — continue it. */
  async function runResearch(apiKey, model, gamesText, onStatus) {
    let messages = [{
      role: "user",
      content: "Research current, betting-relevant information for each of these games: injuries and player availability, recent team form, rest/schedule situation, and current betting lines or notable line movement. Find the upcoming edition of each matchup. Summarize your findings per game in plain text. Games:\n\n" + gamesText
    }];
    const base = {
      model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      tools: [{ type: "web_search_20260209", name: "web_search" }]
    };
    let resp = await request(apiKey, Object.assign({ messages }, base));
    let guard = 0;
    while (resp.stop_reason === "pause_turn" && guard++ < 6) {
      if (onStatus) onStatus("Researching games… (continuing, round " + (guard + 1) + ")");
      messages = messages.concat([{ role: "assistant", content: resp.content }]);
      resp = await request(apiKey, Object.assign({ messages }, base));
    }
    if (resp.stop_reason === "refusal") {
      throw new Error("The research request was declined. Try again with research turned off.");
    }
    return textOf(resp);
  }

  /* Analysis pass: strict JSON schema output. */
  async function runAnalysis(apiKey, model, gamesText, researchNotes) {
    let userContent = "Here is my list of games and the positions I intend to bet:\n\n" + gamesText;
    if (researchNotes) {
      userContent += "\n\nCurrent research notes (gathered just now via web search — treat as the freshest information available):\n\n" + researchNotes;
    } else {
      userContent += "\n\nNo live research is available; rely on your general knowledge and flag staleness in the caveats.";
    }
    const resp = await request(apiKey, {
      model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      messages: [{ role: "user", content: userContent }]
    });
    if (resp.stop_reason === "refusal") {
      throw new Error("The analysis request was declined by the model.");
    }
    return JSON.parse(textOf(resp));
  }

  return { runResearch, runAnalysis, SYSTEM_PROMPT };
})();
