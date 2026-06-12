# Improved Prompt

## Your original prompt

> "I want a football and basketball prediction product. I want to upload the list of games I'm betting on and I need the service to give me the analysis into it and if I should bet on it or take a better different position. And I want to be able to run it in a browser."

## Improved product prompt

Use this version when asking an AI (or a developer) to build or extend this product — it pins down the input format, the exact decision the tool must make, the output structure, and the constraints that were implicit in the original:

> Build a browser-based sports betting analysis tool for **football** (American football and soccer) and **basketball** (NBA, NCAA, EuroLeague, etc.) with these requirements:
>
> 1. **Input** — I paste or upload (.txt / .csv) a list of games, one per line, each including: the matchup, my intended position (moneyline, spread, total, prop, or parlay leg), and the odds if I have them.
> 2. **Per-game output** — for each game return:
>    - A single verdict: **KEEP THE BET**, **AVOID THE GAME**, or **TAKE A BETTER POSITION** (naming the exact alternative bet — other side, different market, or adjusted line).
>    - A calibrated confidence score (0–100) and a risk level (low / medium / high).
>    - 3–5 key factors (form, injuries, rest/schedule, matchup dynamics, line value).
>    - A concise written analysis (~60–120 words) and explicit caveats where information is missing or stale.
> 3. **Freshness** — optionally research current information (injuries, lineups, recent form, line movement) via web search before analyzing, since training knowledge goes stale.
> 4. **Slate-level output** — an overall note covering correlation between my bets (same game, stacked parlays), total exposure, and anything I should know across the whole slate.
> 5. **Honesty** — never present a prediction as guaranteed; confidence above 75 should be rare; include responsible-gambling guidance.
> 6. **Delivery** — a single HTML file that runs entirely in the browser with no server or build step; I supply my own Anthropic API key, which is stored only in my browser's localStorage.

## The analysis system prompt (what the app sends to Claude)

This is the prompt that does the actual analytical work inside the app (`index.html`). Edit it there if you want to change the analyst's behavior:

```
You are a professional sports betting analyst covering football (American football
and soccer) and basketball (NBA, NCAA, EuroLeague and other leagues). The user gives
you a list of games with the position they intend to bet. Your job is to evaluate
each position honestly and rigorously.

For each game:
- Identify the sport and parse the user's intended position (moneyline, spread,
  total, prop, parlay leg, etc.).
- Weigh the relevant factors: recent form, head-to-head history, injuries and
  availability, rest/schedule spots, home/away splits, pace and matchup dynamics,
  motivation/situational angles, and — when odds are given — whether the line offers
  value relative to a fair price.
- If current research notes are provided in the message, ground your analysis in
  them and prefer them over your own prior knowledge, which may be outdated.
- Reach exactly one verdict:
  - "bet" — the user's position is sound; keep it.
  - "avoid" — neither the user's position nor any alternative in this game offers
    value; skip the game.
  - "better_position" — there is a clearly stronger bet in the same game (other
    side, different market, adjusted line); name it precisely.
- Calibrate confidence honestly on a 0–100 scale. Sports betting edges are small:
  confidence above 75 should be rare and reserved for clear mispricings. Never imply
  a guaranteed outcome.
- Note correlation between the user's bets (same game, same team, stacked parlays)
  in the overall notes, along with any bankroll-level concerns like total exposure
  or chasing.

Be direct and specific. If you lack enough information about a game (unknown teams,
no date, ambiguous position), say so in the caveats and lower your confidence rather
than guessing.
```

## Why these changes improve the original

| Original | Improvement | Why it matters |
|---|---|---|
| "prediction product" | Verdict-oriented *decision* tool with three explicit outcomes | "Predictions" invite vague hedging; forcing one of three verdicts per game produces actionable output |
| "give me the analysis" | Structured fields: confidence, risk, key factors, caveats, alternative position | Structure makes results comparable across games and renderable as UI cards |
| (implicit) | Calibration rule: confidence >75 must be rare | LLMs over-claim by default; this keeps scores honest |
| (missing) | Live web research step | Injuries and line movement change daily; training knowledge alone is stale |
| (missing) | Slate-level correlation & exposure notes | The biggest bankroll mistakes are cross-bet (correlated parlays, overexposure), not per-game |
| (missing) | Responsible-gambling framing | The tool should never read as a guaranteed-win machine |
