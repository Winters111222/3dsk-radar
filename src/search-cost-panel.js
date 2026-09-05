(() => {
  const SESSION_KEY = "3dsk-radar-last-search-cost-v1";
  const originalFetch = window.fetch.bind(window);

  function formatUsd(value) {
    if (!Number.isFinite(Number(value))) return "N/A";
    const amount = Number(value);
    return amount >= 1 ? `$${amount.toFixed(2)}` : `$${amount.toFixed(4)}`;
  }

  function costSnapshot(run) {
    if (!run || !Number.isFinite(Number(run.estimated_cost_usd))) return null;
    return {
      estimated_cost_usd: Number(run.estimated_cost_usd),
      model: run.model || "unknown model",
      web_search_call_count: Number(run.web_search_call_count || run.cost_breakdown?.web_search_call_count || 0),
      total_tokens: Number(run.cost_breakdown?.total_tokens || run.usage?.total_tokens || 0),
      token_usd: Number(run.cost_breakdown?.token_usd || 0),
      web_search_usd: Number(run.cost_breakdown?.web_search_usd || 0),
      pricing_basis: run.cost_breakdown?.pricing_basis || "OpenAI public pricing"
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
    summary.insertAdjacentElement("afterend", panel);
    return panel;
  }

  function render(snapshot) {
    const panel = ensurePanel();
    if (!panel) return;
    if (!snapshot) {
      panel.innerHTML = `<div><span class="search-cost-label">LAST SEARCH COST</span><strong class="search-cost-value">$0.0000</strong></div><div class="search-cost-detail"><strong>Fixture / no paid search yet</strong><span>Live Search cost will appear here after a successful paid run.</span></div><span class="search-cost-estimate">EST. COST</span>`;
      return;
    }
    panel.innerHTML = `<div><span class="search-cost-label">LAST SEARCH COST</span><strong class="search-cost-value">${formatUsd(snapshot.estimated_cost_usd)}</strong></div><div class="search-cost-detail"><strong>${snapshot.web_search_call_count} web search call${snapshot.web_search_call_count === 1 ? "" : "s"} · ${snapshot.total_tokens.toLocaleString("en-US")} tokens · ${snapshot.model}</strong><span>Search ${formatUsd(snapshot.web_search_usd)} + tokens ${formatUsd(snapshot.token_usd)} · ${snapshot.pricing_basis}. Final invoice may vary.</span></div><span class="search-cost-estimate">EST. COST</span>`;
  }

  try {
    const stored = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    render(stored);
  } catch {
    render(null);
  }

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
