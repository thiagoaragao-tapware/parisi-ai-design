/* =========================================================
   ParisiFinder — script.js
   Pure vanilla JS. No dependencies, no backend.
   ========================================================= */

(() => {
  "use strict";

  /* ---------- state ---------- */
  let PRODUCTS = [];          // full product catalogue from data.json
  let INDEX_BY_CODE = new Map();
  let recentSearches = [];    // array of product codes, most recent first
  let stockList = [];         // array of {code, description, location}
  let currentDetailCode = null;

  const MAX_RECENT = 8;
  const MAX_SUGGESTIONS = 8;

  const LS_RECENT = "parisifinder.recent";
  const LS_STOCKLIST = "parisifinder.stocklist";

  /* ---------- DOM refs ---------- */
  const els = {
    app: document.getElementById("app"),
    views: {
      search: document.getElementById("view-search"),
      detail: document.getElementById("view-detail"),
      stock: document.getElementById("view-stock"),
    },
    searchInput: document.getElementById("searchInput"),
    searchGo: document.getElementById("searchGo"),
    suggestions: document.getElementById("suggestions"),
    recentList: document.getElementById("recentList"),
    backToStockBtn: document.getElementById("backToStockBtn"),
    cubeBtn: document.getElementById("cubeBtn"),
    cubeBtn2: document.getElementById("cubeBtn2"),

    detailBackBtn: document.getElementById("detailBackBtn"),
    detailCode: document.getElementById("detailCode"),
    detailCode2: document.getElementById("detailCode2"),
    detailStatusPill: document.getElementById("detailStatusPill"),
    detailStatusText: document.getElementById("detailStatusText"),
    detailDescription: document.getElementById("detailDescription"),
    detailQuantity: document.getElementById("detailQuantity"),
    detailLocation: document.getElementById("detailLocation"),
    detailShelf: document.getElementById("detailShelf"),
    detailUpdated: document.getElementById("detailUpdated"),
    addFromDetailBtn: document.getElementById("addFromDetailBtn"),

    stockBackBtn: document.getElementById("stockBackBtn"),
    stockSearchInput: document.getElementById("stockSearchInput"),
    stockSuggestions: document.getElementById("stockSuggestions"),
    stockAddBtn: document.getElementById("stockAddBtn"),
    stockAddRowBtn: document.getElementById("stockAddRowBtn"),
    stockList: document.getElementById("stockList"),
    stockEmptyNote: document.getElementById("stockEmptyNote"),
    sendToStockBtn: document.getElementById("sendToStockBtn"),
    sendToStockLabel: document.getElementById("sendToStockLabel"),

    toast: document.getElementById("toast"),
  };

  /* ---------- utils ---------- */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => els.toast.classList.remove("show"), 2200);
  }

  function formatUpdated(dateStr) {
    if (!dateStr) return "Not available";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
    } catch (e) {
      return dateStr;
    }
  }

  function switchView(name) {
    Object.entries(els.views).forEach(([key, el]) => {
      if (key === name) {
        // Force the entrance animation to restart every time this view is
        // shown (not just the first time), by removing the class, forcing
        // a reflow, then re-adding it.
        el.classList.remove("animate-in");
        void el.offsetWidth; // eslint-disable-line no-unused-expressions
        el.classList.add("active", "animate-in");
      } else {
        el.classList.remove("active", "animate-in");
      }
    });
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  /* ---------- persistence ---------- */
  function loadLocal() {
    try {
      recentSearches = JSON.parse(localStorage.getItem(LS_RECENT) || "[]");
    } catch (e) { recentSearches = []; }
    try {
      stockList = JSON.parse(localStorage.getItem(LS_STOCKLIST) || "[]");
    } catch (e) { stockList = []; }
  }

  function saveRecent() {
    localStorage.setItem(LS_RECENT, JSON.stringify(recentSearches.slice(0, MAX_RECENT)));
  }

  function saveStockList() {
    localStorage.setItem(LS_STOCKLIST, JSON.stringify(stockList));
  }

  /* ---------- data loading ---------- */
  async function loadData() {
    const res = await fetch("data.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("Failed to load data.json");
    const json = await res.json();
    PRODUCTS = json.products || [];
    INDEX_BY_CODE = new Map();
    for (const p of PRODUCTS) {
      INDEX_BY_CODE.set(p.code.toUpperCase(), p);
    }
  }

  /* ---------- search ---------- */
  function searchProducts(query, limit) {
    const q = query.trim().toUpperCase();
    if (!q) return [];

    const starts = [];
    const contains = [];

    for (const p of PRODUCTS) {
      const code = p.code.toUpperCase();
      if (code.startsWith(q)) {
        starts.push(p);
      } else if (code.includes(q)) {
        contains.push(p);
      }
      if (starts.length >= limit * 3) break; // perf guard on huge catalogues
    }

    // Prioritize items that have a location, without excluding those that don't.
    const sortFn = (a, b) => {
      const aLoc = a.location ? 0 : 1;
      const bLoc = b.location ? 0 : 1;
      if (aLoc !== bLoc) return aLoc - bLoc;
      return a.code.localeCompare(b.code);
    };

    starts.sort(sortFn);
    contains.sort(sortFn);

    return [...starts, ...contains].slice(0, limit);
  }

  function renderSuggestions(listEl, query, onSelect) {
    const results = searchProducts(query, MAX_SUGGESTIONS);
    listEl.innerHTML = "";

    if (!results.length) {
      listEl.classList.remove("open");
      return;
    }

    for (const p of results) {
      const li = document.createElement("li");
      const hasLoc = !!p.location;
      li.innerHTML = `
        <div class="suggestion-main">
          <div class="suggestion-code">${escapeHtml(p.code)}</div>
          <div class="suggestion-desc">${escapeHtml(p.description || "")}</div>
        </div>
        <span class="status-pill ${hasLoc ? "has-location" : ""}">
          <span class="dot"></span>${hasLoc ? escapeHtml(p.location) : "No location"}
        </span>
      `;
      li.addEventListener("click", () => onSelect(p));
      listEl.appendChild(li);
    }
    listEl.classList.add("open");
  }

  /* ---------- recent searches ---------- */
  function pushRecent(code) {
    recentSearches = recentSearches.filter((c) => c !== code);
    recentSearches.unshift(code);
    recentSearches = recentSearches.slice(0, MAX_RECENT);
    saveRecent();
    renderRecent();
  }

  function renderRecent() {
    els.recentList.innerHTML = "";
    if (!recentSearches.length) {
      const li = document.createElement("li");
      li.className = "empty-note";
      li.textContent = "No recent searches yet.";
      els.recentList.appendChild(li);
      return;
    }

    for (const code of recentSearches) {
      const p = INDEX_BY_CODE.get(code.toUpperCase());
      if (!p) continue;
      const hasLoc = !!p.location;
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="recent-code">${escapeHtml(p.code)}</span>
        <span class="recent-desc">${escapeHtml(p.description || "")}</span>
        <span class="status-pill ${hasLoc ? "has-location" : ""}">
          <span class="dot"></span>${hasLoc ? escapeHtml(p.location) : "No location"}
        </span>
      `;
      li.addEventListener("click", () => openDetail(p.code));
      els.recentList.appendChild(li);
    }
  }

  /* ---------- product detail ---------- */
  function openDetail(code) {
    const p = INDEX_BY_CODE.get(code.toUpperCase());
    if (!p) {
      showToast(`No product found for "${code}"`);
      return;
    }
    currentDetailCode = p.code;
    pushRecent(p.code);

    els.detailCode.textContent = p.code;
    els.detailCode2.textContent = p.code;
    els.detailDescription.textContent = p.description || "Not available";
    els.detailQuantity.textContent =
      p.quantity === null || p.quantity === undefined || p.quantity === ""
        ? "Not available"
        : p.quantity;

    const hasLoc = !!p.location;
    els.detailLocation.textContent = hasLoc ? p.location : "No location";
    els.detailLocation.classList.toggle("accent", hasLoc);
    els.detailLocation.classList.toggle("dim", !hasLoc);

    const hasShelf = !!p.shelf;
    els.detailShelf.textContent = hasShelf ? p.shelf : "Not available";
    els.detailShelf.classList.toggle("accent", hasShelf);
    els.detailShelf.classList.toggle("dim", !hasShelf);

    els.detailStatusPill.classList.toggle("has-location", hasLoc);
    els.detailStatusText.textContent = hasLoc ? "In Stock" : (p.status || "Unknown");

    els.detailUpdated.textContent = `Last updated: ${formatUpdated(p.updated)}`;

    els.searchInput.value = "";
    els.suggestions.classList.remove("open");

    switchView("detail");
  }

  /* ---------- back to stock list ---------- */
  function renderStockList() {
    els.stockList.innerHTML = "";
    if (!stockList.length) {
      const li = document.createElement("li");
      li.className = "empty-note";
      li.id = "stockEmptyNote";
      li.textContent = "No items added yet.";
      els.stockList.appendChild(li);
    } else {
      stockList.forEach((item, idx) => {
        const li = document.createElement("li");
        const hasLoc = !!item.location;
        li.innerHTML = `
          <span class="item-code">${escapeHtml(item.code)}</span>
          <span class="item-location ${hasLoc ? "" : "none"}">${hasLoc ? escapeHtml(item.location) : "No location"}</span>
          <button class="remove-btn" aria-label="Remove">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          </button>
        `;
        li.querySelector(".remove-btn").addEventListener("click", () => {
          li.classList.add("removing");
          setTimeout(() => {
            stockList.splice(idx, 1);
            saveStockList();
            renderStockList();
          }, 200);
        });
        els.stockList.appendChild(li);
      });
    }
    els.sendToStockLabel.textContent = `Send to Stock (${stockList.length})`;
  }

  function addToStockList(p) {
    if (stockList.some((i) => i.code === p.code)) {
      showToast(`${p.code} is already in the list`);
      return;
    }
    stockList.push({ code: p.code, description: p.description, location: p.location || "" });
    saveStockList();
    renderStockList();
    showToast(`${p.code} added to Back to Stock list`);
  }

  /* ---------- event wiring ---------- */
  function wireSearchView() {
    let debounceT = null;

    els.searchInput.addEventListener("input", () => {
      clearTimeout(debounceT);
      const val = els.searchInput.value;
      debounceT = setTimeout(() => {
        renderSuggestions(els.suggestions, val, (p) => openDetail(p.code));
      }, 80);
    });

    els.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submitSearch();
      } else if (e.key === "Escape") {
        els.suggestions.classList.remove("open");
      }
    });

    els.searchGo.addEventListener("click", submitSearch);

    function submitSearch() {
      const val = els.searchInput.value.trim();
      if (!val) return;
      const exact = INDEX_BY_CODE.get(val.toUpperCase());
      if (exact) {
        openDetail(exact.code);
        return;
      }
      const results = searchProducts(val, 1);
      if (results.length) {
        openDetail(results[0].code);
      } else {
        showToast(`No product found for "${val}"`);
      }
    }

    document.addEventListener("click", (e) => {
      if (!els.suggestions.contains(e.target) && e.target !== els.searchInput) {
        els.suggestions.classList.remove("open");
      }
    });

    els.backToStockBtn.addEventListener("click", () => switchView("stock"));
    els.cubeBtn.addEventListener("click", () => switchView("stock"));
    els.cubeBtn2.addEventListener("click", () => switchView("stock"));
  }

  function wireDetailView() {
    els.detailBackBtn.addEventListener("click", () => switchView("search"));
    els.addFromDetailBtn.addEventListener("click", () => {
      if (!currentDetailCode) return;
      const p = INDEX_BY_CODE.get(currentDetailCode.toUpperCase());
      if (p) addToStockList(p);
    });
  }

  function wireStockView() {
    let debounceT = null;

    els.stockBackBtn.addEventListener("click", () => switchView("search"));

    els.stockSearchInput.addEventListener("input", () => {
      clearTimeout(debounceT);
      const val = els.stockSearchInput.value;
      debounceT = setTimeout(() => {
        renderSuggestions(els.stockSuggestions, val, (p) => {
          addToStockList(p);
          els.stockSearchInput.value = "";
          els.stockSuggestions.classList.remove("open");
        });
      }, 80);
    });

    els.stockSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        attemptAddFromStockInput();
      }
    });

    function attemptAddFromStockInput() {
      const val = els.stockSearchInput.value.trim();
      if (!val) return;
      const exact = INDEX_BY_CODE.get(val.toUpperCase());
      const p = exact || searchProducts(val, 1)[0];
      if (p) {
        addToStockList(p);
        els.stockSearchInput.value = "";
        els.stockSuggestions.classList.remove("open");
      } else {
        showToast(`No product found for "${val}"`);
      }
    }

    els.stockAddBtn.addEventListener("click", attemptAddFromStockInput);
    els.stockAddRowBtn.addEventListener("click", () => els.stockSearchInput.focus());

    document.addEventListener("click", (e) => {
      if (!els.stockSuggestions.contains(e.target) && e.target !== els.stockSearchInput) {
        els.stockSuggestions.classList.remove("open");
      }
    });

    els.sendToStockBtn.addEventListener("click", () => {
      if (!stockList.length) {
        showToast("Add at least one item first");
        return;
      }
      showToast(`Sent ${stockList.length} item${stockList.length > 1 ? "s" : ""} to stock`);
      stockList = [];
      saveStockList();
      renderStockList();
    });
  }

  /* ---------- init ---------- */
  async function init() {
    loadLocal();
    wireSearchView();
    wireDetailView();
    wireStockView();
    renderStockList();

    // Play the opening cinematic entrance immediately, independent of the
    // (possibly async) data load below, so there's no blank-page delay.
    requestAnimationFrame(() => switchView("search"));

    try {
      await loadData();
      renderRecent();
    } catch (err) {
      console.error(err);
      showToast("Could not load product data");
    }

    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("service-worker.js").catch((e) => {
          console.warn("Service worker registration failed:", e);
        });
      });
    }
  }

  init();
})();
