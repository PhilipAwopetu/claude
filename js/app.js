/* BetLens — UI: hash routing + views (Dashboard / Analyze / History / Settings). */
(function () {
  const S = window.BL_STORE;
  const API = window.BL_API;
  const main = document.getElementById("main");

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const VERDICT_LABEL = { bet: "Keep the bet", avoid: "Avoid", better_position: "Better position" };
  const fmtUnits = (n) => (n >= 0 ? "+" : "") + n.toFixed(2) + "u";
  const fmtMoney = (n) => (n < 0 ? "-$" : "$") + Math.abs(n).toFixed(2);

  /* ================= Shared: game result card ================= */
  function gameCard(g, opts) {
    const conf = Math.max(0, Math.min(100, Number(g.confidence) || 0));
    const stake = Number(g.suggested_stake_units) || 0;
    let outcomeRow = "";
    if (opts && opts.session) {
      const cur = (opts.session.outcomes || {})[opts.index] || "";
      const btn = (val, label) =>
        `<button class="outcome-btn ${cur === val ? "sel-" + val : ""}" data-outcome="${val}" data-session="${opts.session.id}" data-index="${opts.index}">${label}</button>`;
      outcomeRow = `<div class="outcomes"><span class="label">Result:</span>${btn("won", "Won")}${btn("lost", "Lost")}${btn("push", "Push")}</div>`;
    }
    return `
    <div class="card ${esc(g.verdict)}">
      <div class="card-head">
        <div>
          <div class="sport-tag">${esc(g.sport)}</div>
          <div class="matchup">${esc(g.matchup)}</div>
        </div>
        <span class="badge ${esc(g.verdict)}">${VERDICT_LABEL[g.verdict] || esc(g.verdict)}</span>
      </div>
      <div class="position">Your position: ${esc(g.user_position)}</div>
      ${g.verdict === "better_position" && g.better_position ? `<div class="alt"><strong>Take instead:</strong> ${esc(g.better_position)}</div>` : ""}
      <div class="meters">
        <span><span class="meter-label">Confidence</span><span class="confbar"><i style="width:${conf}%"></i></span>${conf}/100</span>
        <span><span class="meter-label">Risk</span><span class="risk-${esc(g.risk_level)}">${esc(g.risk_level).toUpperCase()}</span></span>
        ${stake > 0 ? `<span><span class="meter-label">Suggested stake</span>${stake}u</span>` : ""}
      </div>
      <div>${esc(g.analysis)}</div>
      ${g.key_factors && g.key_factors.length ? `<ul class="factors">${g.key_factors.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
      ${g.caveats ? `<div class="caveats">⚠ ${esc(g.caveats)}</div>` : ""}
      ${outcomeRow}
    </div>`;
  }

  function resultBlock(result, researchNotes, opts) {
    let html = result.games.map((g, i) => gameCard(g, opts ? { session: opts.session, index: i } : null)).join("");
    if (result.overall_notes) {
      html += `<div class="card overall"><div class="matchup">Slate overview</div><div style="margin-top:8px">${esc(result.overall_notes)}</div></div>`;
    }
    if (researchNotes) {
      html += `<details class="research"><summary>Show raw research notes</summary><pre>${esc(researchNotes)}</pre></details>`;
    }
    return html;
  }

  const disclaimer = `<footer class="disclaimer">Analysis is informational only and not financial advice. Sports outcomes are inherently uncertain — no prediction is guaranteed. Never bet more than you can afford to lose. If gambling stops being fun, seek help (e.g. 1-800-GAMBLER in the US).</footer>`;

  /* ================= Dashboard ================= */
  function renderDashboard() {
    const st = S.computeStats();
    const settings = S.getSettings();
    const settled = st.won + st.lost + st.push;
    const moneyPL = st.unitsPL * (Number(settings.unitSize) || 0);
    const bankrollNow = (Number(settings.bankroll) || 0) + moneyPL;
    const sessions = S.getSessions().slice(0, 6);

    main.innerHTML = `
      <h1 class="page">Dashboard</h1>
      <p class="sub">Your betting performance at a glance. Settle results in History to keep these numbers honest.</p>
      <div class="stats">
        <div class="stat"><div class="k">Bankroll</div><div class="v ${moneyPL > 0 ? "pos" : moneyPL < 0 ? "neg" : ""}">${fmtMoney(bankrollNow)}</div></div>
        <div class="stat"><div class="k">Record (W-L-P)</div><div class="v">${st.won}-${st.lost}-${st.push}</div></div>
        <div class="stat"><div class="k">Units P/L</div><div class="v ${st.unitsPL > 0 ? "pos" : st.unitsPL < 0 ? "neg" : ""}">${fmtUnits(st.unitsPL)}</div></div>
        <div class="stat"><div class="k">Bets analyzed</div><div class="v">${st.analyzed}</div></div>
      </div>
      <div class="panel">
        <h2>Verdict breakdown</h2>
        <div class="recent-item"><span>✅ Keep the bet</span><span>${st.verdicts.bet}</span></div>
        <div class="recent-item"><span>🔁 Better position suggested</span><span>${st.verdicts.better_position}</span></div>
        <div class="recent-item"><span>⛔ Avoid</span><span>${st.verdicts.avoid}</span></div>
      </div>
      <div class="panel">
        <h2>Recent analyses</h2>
        ${sessions.length === 0
          ? `<div class="empty">Nothing yet — head to <a href="#/analyze" style="color:var(--accent)">Analyze</a> and run your first slate.</div>`
          : sessions.map((s) => {
              const n = (s.result && s.result.games || []).length;
              const settledN = Object.values(s.outcomes || {}).filter(Boolean).length;
              return `<div class="recent-item"><span>${esc(new Date(s.date).toLocaleString())}</span><span>${n} bet${n === 1 ? "" : "s"} · ${settledN}/${n} settled</span></div>`;
            }).join("")}
        ${sessions.length ? `<p class="hint"><a href="#/history" style="color:var(--accent)">Open History →</a></p>` : ""}
      </div>
      ${disclaimer}`;
  }

  /* ================= Analyze ================= */
  let lastRun = null; // keeps current results visible when navigating back

  function renderAnalyze() {
    const settings = S.getSettings();
    main.innerHTML = `
      <h1 class="page">Analyze</h1>
      <p class="sub">Add the games you're betting on — get a keep / avoid / better-position verdict on each.</p>

      <div class="panel">
        <h2>Quick add a bet</h2>
        <div class="row">
          <div class="small"><label>Sport</label>
            <select id="qaSport"><option>Basketball</option><option>Football</option><option>Soccer</option></select></div>
          <div class="grow"><label>Matchup</label><input type="text" id="qaMatchup" placeholder="Lakers vs Celtics" /></div>
          <div class="grow"><label>Your position</label><input type="text" id="qaPosition" placeholder="Lakers ML / Over 220.5 / Chiefs -3.5" /></div>
          <div class="small"><label>Odds</label><input type="text" id="qaOdds" placeholder="+150 or 1.85" /></div>
          <button class="ghost" id="qaAdd" type="button">Add ↓</button>
        </div>
      </div>

      <div class="panel">
        <h2>Your slate</h2>
        <label for="games">One game per line — matchup, your position, odds if you have them.</label>
        <textarea id="games" placeholder="Lakers vs Celtics — Lakers ML @ +150
Chiefs vs Bills — Chiefs -3.5 @ -110
Arsenal vs Chelsea — Over 2.5 goals @ 1.85"></textarea>
        <div class="row" style="margin-top:10px"><input type="file" id="fileInput" accept=".txt,.csv" /></div>
        <p class="hint">Or upload a .txt / .csv — its contents load into the box.</p>
        <label class="check"><input type="checkbox" id="useResearch" ${settings.defaultResearch ? "checked" : ""} />
          Research current info first (injuries, form, line movement) via web search — slower but much better analysis</label>
      </div>

      <div class="panel">
        <div class="row">
          <button class="primary" id="analyzeBtn" type="button">Analyze my bets</button>
          <span class="status" id="status"></span>
        </div>
        <div class="error" id="error"></div>
      </div>

      <div id="results">${lastRun ? resultBlock(lastRun.result, lastRun.research) : ""}</div>
      ${disclaimer}`;

    if (lastRun) document.getElementById("games").value = lastRun.gamesText;

    document.getElementById("qaAdd").addEventListener("click", () => {
      const sport = document.getElementById("qaSport").value;
      const matchup = document.getElementById("qaMatchup").value.trim();
      const pos = document.getElementById("qaPosition").value.trim();
      const odds = document.getElementById("qaOdds").value.trim();
      if (!matchup || !pos) return;
      const line = `[${sport}] ${matchup} — ${pos}${odds ? " @ " + odds : ""}`;
      const ta = document.getElementById("games");
      ta.value = (ta.value.trim() ? ta.value.trim() + "\n" : "") + line;
      document.getElementById("qaMatchup").value = "";
      document.getElementById("qaPosition").value = "";
      document.getElementById("qaOdds").value = "";
    });

    document.getElementById("fileInput").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => { document.getElementById("games").value = String(reader.result).trim(); };
      reader.readAsText(file);
    });

    document.getElementById("analyzeBtn").addEventListener("click", runAnalyzeFlow);
  }

  async function runAnalyzeFlow() {
    const btn = document.getElementById("analyzeBtn");
    const statusEl = document.getElementById("status");
    const errorEl = document.getElementById("error");
    const resultsEl = document.getElementById("results");
    const setStatus = (m) => { statusEl.textContent = m; };
    errorEl.textContent = "";
    resultsEl.innerHTML = "";

    const apiKey = S.effectiveApiKey();
    const gamesText = document.getElementById("games").value.trim();
    if (!apiKey) { errorEl.textContent = "No API key set — add it in Settings (or via config.js)."; return; }
    if (!gamesText) { errorEl.textContent = "Add at least one game to analyze."; return; }

    const model = S.getSettings().model;
    btn.disabled = true;
    try {
      let research = "";
      if (document.getElementById("useResearch").checked) {
        setStatus("Researching games (injuries, form, lines)… this can take a minute.");
        research = await API.runResearch(apiKey, model, gamesText, setStatus);
      }
      setStatus("Analyzing your positions…");
      const result = await API.runAnalysis(apiKey, model, gamesText, research);
      setStatus(`Done — ${result.games.length} bet${result.games.length === 1 ? "" : "s"} analyzed and saved to History.`);

      lastRun = { gamesText, research, result };
      S.addSession({
        id: "s" + Date.now(),
        date: new Date().toISOString(),
        gamesText,
        research,
        result,
        outcomes: {}
      });
      resultsEl.innerHTML = resultBlock(result, research);
    } catch (err) {
      setStatus("");
      errorEl.textContent = err.message || String(err);
    } finally {
      btn.disabled = false;
    }
  }

  /* ================= History ================= */
  function renderHistory() {
    const sessions = S.getSessions();
    main.innerHTML = `
      <h1 class="page">History</h1>
      <p class="sub">Every analysis you've run. Mark each bet Won / Lost / Push — the Dashboard tracks your record and units.</p>
      <div class="row" style="margin-bottom:16px">
        <button class="ghost" id="exportBtn" type="button">Export data (JSON)</button>
      </div>
      ${sessions.length === 0 ? `<div class="empty">No analyses yet. Run one from the Analyze page.</div>` : ""}
      ${sessions.map((s) => {
        const games = (s.result && s.result.games) || [];
        const settledN = Object.values(s.outcomes || {}).filter(Boolean).length;
        return `
        <details class="session" data-session="${s.id}">
          <summary>
            <span><strong>${esc(new Date(s.date).toLocaleString())}</strong></span>
            <span class="meta">${games.length} bet${games.length === 1 ? "" : "s"} · ${settledN}/${games.length} settled</span>
          </summary>
          <div class="body">
            ${resultBlock(s.result, s.research, { session: s })}
            <div class="row" style="margin-top:8px">
              <button class="ghost danger" data-delete="${s.id}" type="button">Delete this analysis</button>
            </div>
          </div>
        </details>`;
      }).join("")}
      ${disclaimer}`;

    document.getElementById("exportBtn") && document.getElementById("exportBtn").addEventListener("click", () => {
      const blob = new Blob([S.exportData()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "betlens-data.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });

    main.addEventListener("click", historyClickHandler);
  }

  function historyClickHandler(e) {
    const del = e.target.closest("[data-delete]");
    if (del) {
      if (confirm("Delete this analysis and its results?")) {
        S.deleteSession(del.getAttribute("data-delete"));
        renderHistory();
      }
      return;
    }
    const ob = e.target.closest(".outcome-btn");
    if (ob) {
      const id = ob.getAttribute("data-session");
      const index = ob.getAttribute("data-index");
      const val = ob.getAttribute("data-outcome");
      const session = S.getSessions().find((s) => s.id === id);
      if (!session) return;
      const outcomes = session.outcomes || {};
      outcomes[index] = outcomes[index] === val ? null : val; // click again to clear
      S.updateSession(id, { outcomes });
      const openIds = Array.from(main.querySelectorAll("details.session[open]")).map((d) => d.getAttribute("data-session"));
      renderHistory();
      openIds.forEach((oid) => {
        const d = main.querySelector(`details.session[data-session="${oid}"]`);
        if (d) d.open = true;
      });
    }
  }

  /* ================= Settings ================= */
  function renderSettings() {
    const settings = S.getSettings();
    const hasCfg = S.hasConfigKey();
    main.innerHTML = `
      <h1 class="page">Settings</h1>
      <p class="sub">Everything is stored locally in this browser. Nothing is uploaded anywhere except your API calls to api.anthropic.com.</p>

      <div class="panel">
        <h2>API key</h2>
        ${hasCfg
          ? `<p class="hint">✓ Loaded automatically from <code>config.js</code> — nothing to do here. To change it, edit that file.</p>`
          : `<label for="setKey">Anthropic API key</label>
             <input type="password" id="setKey" value="${esc(settings.apiKey)}" placeholder="sk-ant-..." autocomplete="off" />
             <p class="hint">Tip: put the key in a <code>config.js</code> file next to index.html (copy config.example.js) and you'll never see this field again.</p>`}
      </div>

      <div class="panel">
        <h2>Bankroll</h2>
        <div class="row">
          <div class="small"><label>Starting bankroll ($)</label><input type="number" id="setBankroll" value="${esc(settings.bankroll)}" min="0" step="10" /></div>
          <div class="small"><label>Unit size ($)</label><input type="number" id="setUnit" value="${esc(settings.unitSize)}" min="1" step="1" /></div>
        </div>
        <p class="hint">A "unit" is your standard stake. Common practice: 1 unit = 1–2% of bankroll.</p>
      </div>

      <div class="panel">
        <h2>Analysis</h2>
        <div class="row">
          <div class="grow"><label>Model</label>
            <select id="setModel">
              <option value="claude-opus-4-8" ${settings.model === "claude-opus-4-8" ? "selected" : ""}>Claude Opus 4.8 — best analysis (default)</option>
              <option value="claude-sonnet-4-6" ${settings.model === "claude-sonnet-4-6" ? "selected" : ""}>Claude Sonnet 4.6 — faster &amp; cheaper</option>
            </select></div>
        </div>
        <label class="check"><input type="checkbox" id="setResearch" ${settings.defaultResearch ? "checked" : ""} /> Research current info by default on the Analyze page</label>
      </div>

      <div class="panel">
        <div class="row">
          <button class="primary" id="saveSettings" type="button">Save settings</button>
          <span class="status" id="saveStatus"></span>
        </div>
      </div>

      <div class="panel">
        <h2>Data</h2>
        <div class="row">
          <button class="ghost" id="exportBtn2" type="button">Export data (JSON)</button>
          <label class="ghost" style="display:inline-block;cursor:pointer">Import data <input type="file" id="importFile" accept=".json" style="display:none" /></label>
          <button class="ghost danger" id="clearBtn" type="button">Clear all data</button>
        </div>
      </div>
      ${disclaimer}`;

    document.getElementById("saveSettings").addEventListener("click", () => {
      const patch = {
        bankroll: Number(document.getElementById("setBankroll").value) || 0,
        unitSize: Number(document.getElementById("setUnit").value) || 1,
        model: document.getElementById("setModel").value,
        defaultResearch: document.getElementById("setResearch").checked
      };
      const keyInput = document.getElementById("setKey");
      if (keyInput) patch.apiKey = keyInput.value.trim();
      S.saveSettings(patch);
      document.getElementById("saveStatus").textContent = "Saved ✓";
      setTimeout(() => { const el = document.getElementById("saveStatus"); if (el) el.textContent = ""; }, 2000);
    });

    document.getElementById("exportBtn2").addEventListener("click", () => {
      const blob = new Blob([S.exportData()], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "betlens-data.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });

    document.getElementById("importFile").addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { S.importData(String(reader.result)); alert("Data imported."); renderSettings(); }
        catch (err) { alert("Import failed: " + err.message); }
      };
      reader.readAsText(file);
    });

    document.getElementById("clearBtn").addEventListener("click", () => {
      if (confirm("Delete ALL local data (settings + every saved analysis)? This cannot be undone.")) {
        S.clearAll();
        lastRun = null;
        renderSettings();
      }
    });
  }

  /* ================= Router ================= */
  const ROUTES = {
    "#/dashboard": renderDashboard,
    "#/analyze": renderAnalyze,
    "#/history": renderHistory,
    "#/settings": renderSettings
  };

  function navigate() {
    const hash = ROUTES[location.hash] ? location.hash : "#/dashboard";
    document.querySelectorAll(".sidebar nav a").forEach((a) => {
      a.classList.toggle("active", a.getAttribute("href") === hash);
    });
    ROUTES[hash]();
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", navigate);
  navigate();
})();
