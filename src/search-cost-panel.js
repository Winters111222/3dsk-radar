(() => {
  const SESSION_KEY = "3dsk-radar-last-search-cost-v1";
  const originalFetch = window.fetch.bind(window);

  function formatUsd(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "N/A";
    const amount = Number(value);
    return amount >= 1 ? `$${amount.toFixed(2)}` : `$${amount.toFixed(4)}`;
  }

  function costSnapshot(run) {
    if (!run) return null;
    return {
      estimated_cost_usd: run.estimated_cost_usd == null ? null : Number(run.estimated_cost_usd),
      model: run.model || "unknown model",
      web_search_call_count: Number(run.web_search_call_count || run.cost_breakdown?.web_search_call_count || 0),
      total_tokens: run.cost_breakdown?.total_tokens ?? run.usage?.total_tokens ?? null,
      token_usd: run.cost_breakdown?.token_usd ?? null,
      web_search_usd: run.cost_breakdown?.web_search_usd ?? null,
      pricing_basis: run.cost_breakdown?.pricing_basis || "Recorded run estimate"
    };
  }

  function ensurePanel() {
    let panel = document.querySelector("#search-cost-panel");
    if (panel) return panel;
    const summary = document.querySelector("#summary-grid");
    if (!summary) return null;
    panel = document.createElement("section");
    panel.id = "search-cost-panel";
    panel.className = "panel search-cost-panel";
    panel.setAttribute("aria-live", "polite");
    const diagnostics = document.querySelector("#diagnostics-tools");
    if (diagnostics) diagnostics.append(panel);
    else summary.insertAdjacentElement("afterend", panel);
    return panel;
  }

  const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[c]));
  function render(snapshot) {
    const panel = ensurePanel();
    if (!panel) return;
    if (!snapshot) {
      panel.innerHTML = `<div><span class="search-cost-label">LAST SEARCH COST</span><strong class="search-cost-value">—</strong></div><div class="search-cost-detail"><strong>No run cost loaded</strong><span>Connect to load saved search costs. Demo actions do not call paid AI.</span></div><span class="search-cost-estimate">EST. COST</span>`;
      return;
    }
    const tokens=snapshot.total_tokens===null?"Token count not recorded":`${Number(snapshot.total_tokens).toLocaleString("en-US")} tokens`;
    const breakdown=snapshot.web_search_usd===null||snapshot.token_usd===null?"Cost breakdown not recorded":`Search ${formatUsd(snapshot.web_search_usd)} + tokens ${formatUsd(snapshot.token_usd)}`;
    panel.innerHTML = `<div><span class="search-cost-label">LAST SEARCH COST</span><strong class="search-cost-value">${formatUsd(snapshot.estimated_cost_usd)}</strong></div><div class="search-cost-detail"><strong>${snapshot.web_search_call_count} web search call${snapshot.web_search_call_count === 1 ? "" : "s"} · ${tokens} · ${escape(snapshot.model)}</strong><span>${breakdown} · ${escape(snapshot.pricing_basis)}. Final invoice may vary.</span></div><span class="search-cost-estimate">EST. COST</span>`;
  }

  render(null);
  window.addEventListener("radar:search-history", event => {
    try { render(costSnapshot(event.detail)); } catch { render(null); }
  });

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    try {
      const requestUrl = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
      const pathname = new URL(requestUrl, window.location.href).pathname;
      if (pathname === "/api/search" && response.ok) {
        const payload = await response.clone().json();
        if (payload?.ok && payload?.run) {
          const snapshot = costSnapshot(payload.run);
          if (snapshot) sessionStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
          render(snapshot);
        }
      }
    } catch {
      // Cost display must never interfere with the primary Radar flow.
    }
    return response;
  };
})();
