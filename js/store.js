/* BetLens — persistence layer (localStorage). Classic script: exposes window.BL_STORE. */
window.BL_STORE = (function () {
  const SETTINGS_KEY = "betlens_settings";
  const SESSIONS_KEY = "betlens_sessions";

  const DEFAULT_SETTINGS = {
    apiKey: "",
    bankroll: 1000,
    unitSize: 10,
    defaultResearch: true,
    model: "claude-opus-4-8"
  };

  function getSettings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) {}
    return Object.assign({}, DEFAULT_SETTINGS, s);
  }

  function saveSettings(patch) {
    const next = Object.assign(getSettings(), patch);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    return next;
  }

  // The key from config.js (gitignored file) wins over the one typed in Settings.
  function effectiveApiKey() {
    const cfg = (window.BETLENS_CONFIG && window.BETLENS_CONFIG.apiKey) || "";
    return cfg || getSettings().apiKey || "";
  }
  function hasConfigKey() {
    return Boolean(window.BETLENS_CONFIG && window.BETLENS_CONFIG.apiKey);
  }

  /* Sessions: [{ id, date, gamesText, research, result, outcomes: { [gameIndex]: "won"|"lost"|"push" } }] */
  function getSessions() {
    try { return JSON.parse(localStorage.getItem(SESSIONS_KEY)) || []; } catch (e) { return []; }
  }
  function saveSessions(sessions) {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  }
  function addSession(session) {
    const sessions = getSessions();
    sessions.unshift(session);
    saveSessions(sessions);
  }
  function updateSession(id, patch) {
    const sessions = getSessions();
    const i = sessions.findIndex((s) => s.id === id);
    if (i >= 0) { sessions[i] = Object.assign(sessions[i], patch); saveSessions(sessions); }
  }
  function deleteSession(id) {
    saveSessions(getSessions().filter((s) => s.id !== id));
  }
  function clearAll() {
    localStorage.removeItem(SESSIONS_KEY);
    localStorage.removeItem(SETTINGS_KEY);
  }

  function exportData() {
    return JSON.stringify({
      exported_at: new Date().toISOString(),
      settings: getSettings(),
      sessions: getSessions()
    }, null, 2);
  }
  function importData(json) {
    const data = JSON.parse(json);
    if (data.settings) saveSettings(data.settings);
    if (Array.isArray(data.sessions)) saveSessions(data.sessions);
  }

  /* ---- Performance math ---- */

  // Extract a win-profit multiplier (profit per 1 unit staked) from a position
  // string containing odds: "+150", "-110", or decimal "@ 1.85".
  function profitMultiplier(positionStr) {
    if (!positionStr) return 1;
    const american = positionStr.match(/\(?\s*([+-]\d{3,4})\s*\)?/);
    if (american) {
      const odds = parseInt(american[1], 10);
      return odds > 0 ? odds / 100 : 100 / Math.abs(odds);
    }
    const decimal = positionStr.match(/@\s*(\d+(?:\.\d+)?)/);
    if (decimal) {
      const d = parseFloat(decimal[1]);
      if (d > 1 && d < 100) return d - 1;
    }
    return 1; // even money fallback
  }

  // Aggregate stats across all sessions.
  function computeStats() {
    const sessions = getSessions();
    let analyzed = 0, won = 0, lost = 0, push = 0, unitsPL = 0;
    const verdicts = { bet: 0, avoid: 0, better_position: 0 };
    for (const s of sessions) {
      const games = (s.result && s.result.games) || [];
      analyzed += games.length;
      games.forEach((g, i) => {
        if (verdicts[g.verdict] !== undefined) verdicts[g.verdict]++;
        const outcome = s.outcomes && s.outcomes[i];
        if (!outcome) return;
        const stake = Number(g.suggested_stake_units) > 0 ? Number(g.suggested_stake_units) : 1;
        if (outcome === "won") { won++; unitsPL += stake * profitMultiplier(g.user_position); }
        else if (outcome === "lost") { lost++; unitsPL -= stake; }
        else if (outcome === "push") { push++; }
      });
    }
    return { sessions: sessions.length, analyzed, won, lost, push, unitsPL, verdicts };
  }

  return {
    getSettings, saveSettings, effectiveApiKey, hasConfigKey,
    getSessions, addSession, updateSession, deleteSession, clearAll,
    exportData, importData, computeStats, profitMultiplier
  };
})();
