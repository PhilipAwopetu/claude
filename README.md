# BetLens — Football & Basketball Bet Analysis Web App

A full client-side web app that analyzes the games you're planning to bet on and tells you, per game, whether to **keep the bet**, **avoid the game**, or **take a better position** (naming the exact alternative). Powered by the Claude API, called directly from your browser — no server, no build step, no install.

## The app

| Page | What it does |
|---|---|
| **📊 Dashboard** | Bankroll, win/loss/push record, units profit & loss, verdict breakdown, recent analyses |
| **🎯 Analyze** | Quick-add bet builder, paste or upload (.txt/.csv) your slate, optional live web research, AI verdict cards per game + slate-level overview |
| **🗂 History** | Every analysis saved automatically; mark each bet Won / Lost / Push to feed the Dashboard stats; export your data as JSON |
| **⚙ Settings** | API key, bankroll & unit size, model choice (Opus = best, Sonnet = cheaper), default options, import/export/clear data |

All data (settings, history, results) lives in your browser's localStorage. The only network traffic is your API calls to `api.anthropic.com`.

## Running it

1. Get an Anthropic API key from [console.anthropic.com](https://console.anthropic.com) → API Keys.
2. **Skip typing the key (recommended):** copy `config.example.js` to `config.js` in the same folder and paste your key into it. The app loads it automatically and hides the key prompt entirely. `config.js` is gitignored — **never commit your real key**.
3. Open `index.html` in a browser. Either double-click it, or serve the folder locally:

   ```sh
   python3 -m http.server 8000
   # then open http://localhost:8000
   ```

4. Go to **Analyze**, enter your games, click **Analyze my bets**.

### Input format

One game per line — matchup, your position, odds if you have them (or use the quick-add builder):

```
Lakers vs Celtics — Lakers ML @ +150
Chiefs vs Bills — Chiefs -3.5 @ -110
Arsenal vs Chelsea — Over 2.5 goals @ 1.85
Warriors vs Nuggets — parlay leg: Warriors +6.5
```

The format is forgiving; Claude parses it.

## How the analysis works

1. **Research call** (optional, on by default): a Claude request with the server-side `web_search` tool gathers current injuries, form, and betting lines for each game (continues automatically on `pause_turn`).
2. **Analysis call**: a second request with a strict JSON schema (`output_config.format`) evaluates each position against the research notes — verdict, confidence (0–100), risk level, suggested stake in units, key factors, caveats — plus slate-level correlation/exposure notes.

Default model: `claude-opus-4-8` with adaptive thinking. See `PROMPT.md` for the full analysis prompt and the improved product prompt.

## Project structure

```
index.html          app shell (sidebar + view container)
css/styles.css      theme & layout
js/store.js         localStorage persistence, bankroll/record math
js/api.js           Claude API calls (research + structured analysis)
js/app.js           router + Dashboard/Analyze/History/Settings views
config.example.js   API key template → copy to config.js (gitignored)
PROMPT.md           improved product prompt + analysis system prompt
```

## Costs

Each analysis run makes 1–2 API calls billed to your Anthropic account. The research call (web search over several games) is the bulk of the cost; uncheck "Research current info" or switch to Sonnet in Settings for cheaper runs. Consider setting a spend limit in the Anthropic console.

## Disclaimer

This tool is informational only and is not financial advice. Sports outcomes are inherently uncertain — no prediction is guaranteed. Never bet more than you can afford to lose. If gambling stops being fun, seek help (e.g. 1-800-GAMBLER in the US).
