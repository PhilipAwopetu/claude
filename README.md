# BetLens — Football & Basketball Bet Analyzer

A single-file browser app that analyzes the list of games you're planning to bet on and tells you, per game, whether to **keep the bet**, **avoid the game**, or **take a better position** (with the specific alternative named). Powered by the Claude API, called directly from your browser.

## Features

- **Paste or upload** your games (.txt / .csv) — one game per line with your intended bet and odds.
- **Live research** (optional, on by default): Claude searches the web for injuries, recent form, and line movement before analyzing, so the analysis isn't limited to stale training knowledge.
- **Per-game verdict cards**: keep / avoid / better position, confidence (0–100), risk level, 3–5 key factors, written analysis, and caveats.
- **Slate overview**: correlation between your bets, total exposure, bankroll-level notes.
- **No server, no build step** — one HTML file. Your API key is stored only in your browser's localStorage and is sent only to `api.anthropic.com`.

## Running it

1. Get an Anthropic API key from [console.anthropic.com](https://console.anthropic.com) → API Keys.
2. **Skip typing the key every time (recommended):** copy `config.example.js` to `config.js` in the same folder and paste your key into it. The app loads it automatically and hides the key prompt. `config.js` is gitignored — **never commit your real key**.
3. Open `index.html` in a browser. Either double-click it, or serve the folder locally:

   ```sh
   python3 -m http.server 8000
   # then open http://localhost:8000
   ```

4. Enter your games, click **Analyze my bets**. (Without `config.js`, paste the key once — it's remembered in your browser's localStorage.)

### Input format

One game per line — matchup, your position, odds if you have them:

```
Lakers vs Celtics — Lakers ML @ +150
Chiefs vs Bills — Chiefs -3.5 @ -110
Arsenal vs Chelsea — Over 2.5 goals @ 1.85
Warriors vs Nuggets — parlay leg: Warriors +6.5
```

The format is forgiving; Claude parses it.

## How it works

1. **Research call** (if enabled): a Claude request with the server-side `web_search` tool gathers current injuries, form, and lines for each game (handles `pause_turn` continuation automatically).
2. **Analysis call**: a second request with a strict JSON schema (`output_config.format`) evaluates each position against the research notes and returns structured verdicts, which the page renders as cards.

Model: `claude-opus-4-8` with adaptive thinking. See `PROMPT.md` for the full analysis prompt and the improved product prompt.

## Costs

Each analysis run makes 1–2 API calls billed to your Anthropic account. The research call (web search over several games) is the bulk of the cost; uncheck "Research current info" for a cheaper, knowledge-only analysis.

## Disclaimer

This tool is informational only and is not financial advice. Sports outcomes are inherently uncertain — no prediction is guaranteed. Never bet more than you can afford to lose. If gambling stops being fun, seek help (e.g. 1-800-GAMBLER in the US).
