/* NearByBazar — Customer Discovery Engine (Sprint 2 · Batch 1).
 *
 * Self-contained page script — does NOT share globals with app.js or
 * storefront.js (same architecture rule as those two pages: each page loads
 * independently, so nothing here assumes anything else has run).
 *
 * One discovery engine, several entry points. This file boots from whichever
 * URL served it — /discover, /c/:categorySlug, /l/:locality, or the generic
 * /:district/:category directory page — derives a single filter-state object
 * from that URL, and from then on every entry point behaves identically:
 * same search call, same cards, same filters, same ranking. Interacting with
 * filters normalizes the address bar to the canonical /discover?... form
 * (bookmarkable/shareable; CPO decision, 2026-07-05), but the very first
 * paint leaves the original SEO-friendly URL alone so crawlers/shares see a
 * clean /c/restaurants or /ludhiana/salons link.
 */
(function () {
  'use strict';

  const API_BASE = '/api/v1';
  const RESULTS_PER_PAGE = 12;

  const state = {
    filters: { q: '', category: '', locality: '', district: '', verified: false, openNow: false, sortBy: 'relevance', page: 1 },
    scope: 'transactional', // 'directory' only for the /:district/:category entry point (Phase F2 full-supply browsing)
    categories: [],
    localities: [],
    results: [],
    meta: null,
  };

  let hasInteracted = false; // becomes true on the first user-driven filter change

  // ── DOM refs ───────────────────────────────────────────────────────────
  const el = (id) => document.getElementById(id);
  const searchInput = el('disc-search-input');
  const autocompleteBox = el('disc-autocomplete');
  const districtPillsEl = el('disc-district-pills');
  const categorySection = el('disc-category-section');
  const categoryGridEl = el('disc-category-grid');
  const filterSidebar = el('disc-filter-sidebar');
  const filterBackdrop = el('disc-filter-backdrop');
  const filterOpenNow = el('filter-open-now');
  const filterVerified = el('filter-verified');
  const filterCategory = el('filter-category');
  const filterLocality = el('filter-locality');
  const sortSelect = el('disc-sort');
  const resultsGrid = el('disc-results-grid');
  const resultsCount = el('disc-results-count');
  const loadMoreBtn = el('disc-load-more');

  // ── Utilities ──────────────────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function showNotification(message, type = 'error') {
    const container = el('notification-area');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'error' ? 'fa-circle-xmark' : type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-check';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'toastSlideIn 0.3s reverse forwards';
      toast.addEventListener('animationend', () => toast.remove());
    }, 4000);
  }

  // Same overnight-aware open/closed calculation as storefront.js (IST). Kept
  // as a local copy rather than a shared import — see architecture note above.
  function computeOpenStatus(operatingHours) {
    if (!operatingHours || typeof operatingHours !== 'object') return null;
    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const ist = new Date(utc + 3600000 * 5.5);
    const today = operatingHours[dayKeys[ist.getDay()]];
    if (!today || today.closed || !today.open || !today.close) return { isOpen: false };
    const [oH, oM] = today.open.split(':').map(Number);
    const [cH, cM] = today.close.split(':').map(Number);
    const openVal = oH * 60 + oM;
    const closeVal = cH * 60 + cM;
    const cur = ist.getHours() * 60 + ist.getMinutes();
    const isOpen = closeVal <= openVal ? (cur >= openVal || cur < closeVal) : (cur >= openVal && cur < closeVal);
    return { isOpen };
  }

  // Tier drives the CTA label/icon — the card communicates capability, not a
  // generic "view" button (CPO decision, 2026-07-05).
  function tierCta(business) {
    const tier = business.listingTier || 'DIRECTORY';
    if (tier === 'BOOKABLE') return { label: 'Book Appointment', icon: 'fa-calendar-check' };
    if (tier === 'COMMERCE') return { label: 'Order Online', icon: 'fa-bag-shopping' };
    return { label: 'View Profile & Call', icon: 'fa-phone' };
  }

  // ── URL <-> filter state ─────────────────────────────────────────────────
  function parseInitialFilters() {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const filters = {
      q: params.get('q') || '',
      category: params.get('category') || '',
      locality: params.get('locality') || '',
      district: params.get('district') || '',
      verified: params.get('verified') === 'true',
      openNow: params.get('openNow') === 'true',
      sortBy: params.get('sortBy') || 'relevance',
      page: 1,
    };
    let scope = 'transactional';

    if (path.startsWith('/c/')) {
      filters.category = decodeURIComponent(path.split('/')[2] || '');
    } else if (path.startsWith('/l/')) {
      filters.locality = decodeURIComponent(path.split('/')[2] || '');
    } else if (path !== '/discover') {
      const segs = path.split('/').filter(Boolean);
      if (segs.length === 2) {
        // Generic /:district/:category directory page (Phase F2) — full-supply
        // browsing, including unclaimed stubs in not-yet-live verticals.
        filters.district = decodeURIComponent(segs[0]);
        filters.category = decodeURIComponent(segs[1]);
        scope = 'directory';
      }
    }
    return { filters, scope };
  }

  function updateURL() {
    if (!hasInteracted) return;
    const p = new URLSearchParams();
    const f = state.filters;
    if (f.q) p.set('q', f.q);
    if (f.category) p.set('category', f.category);
    if (f.locality) p.set('locality', f.locality);
    if (f.district) p.set('district', f.district);
    if (f.verified) p.set('verified', 'true');
    if (f.openNow) p.set('openNow', 'true');
    if (f.sortBy && f.sortBy !== 'relevance') p.set('sortBy', f.sortBy);
    if (f.page > 1) p.set('page', String(f.page));
    const qs = p.toString();
    history.pushState(f, '', '/discover' + (qs ? `?${qs}` : ''));
  }

  // ── Data loading ───────────────────────────────────────────────────────
  async function loadCategories() {
    try {
      // /search/categories (not the flat /categories) — same endpoint app.js
      // already uses for its onboarding dropdowns, and the one enriched with
      // vertical descriptions + rolled-up business counts (Sprint 2 · Batch 1).
      const res = await fetch(`${API_BASE}/search/categories`);
      const body = await res.json();
      state.categories = body.data || [];
      renderCategoryGrid();
      renderCategoryFilterOptions();
    } catch (err) {
      console.error('[discovery] categories load failed', err);
      categoryGridEl.innerHTML = '<p class="results-count">Couldn\'t load categories right now.</p>';
    }
  }

  async function loadLocalities() {
    try {
      const res = await fetch(`${API_BASE}/search/cities`);
      const body = await res.json();
      state.localities = body.data || [];
      renderDistrictPills();
      renderLocalityFilterOptions();
    } catch (err) {
      console.error('[discovery] localities load failed', err);
    }
  }

  async function executeSearch(resetPage) {
    if (resetPage) {
      state.filters.page = 1;
      renderSkeletons();
    }
    try {
      const citySlug = encodeURIComponent(state.filters.locality || state.filters.district || 'any');
      const categorySlug = encodeURIComponent(state.filters.category || 'any');
      const params = new URLSearchParams();
      if (state.filters.q) params.set('query', state.filters.q);
      if (state.filters.verified) params.set('verifiedOnly', 'true');
      if (state.filters.openNow) params.set('openNow', 'true');
      if (state.filters.sortBy) params.set('sortBy', state.filters.sortBy);
      if (state.scope === 'directory') params.set('scope', 'directory');
      params.set('page', String(state.filters.page));
      params.set('limit', String(RESULTS_PER_PAGE));

      const res = await fetch(`${API_BASE}/search/explore/${citySlug}/${categorySlug}?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      state.results = resetPage ? (body.data || []) : state.results.concat(body.data || []);
      state.meta = body.meta || null;
      renderResults();
    } catch (err) {
      console.error('[discovery] search failed', err);
      renderResultsError();
    }
  }

  // ── Rendering ──────────────────────────────────────────────────────────
  function renderDistrictPills() {
    const active = state.filters.locality || state.filters.district;
    districtPillsEl.innerHTML = state.localities.map((d) => `
      <button type="button" class="district-pill ${active === d.slug ? 'active' : ''}" data-slug="${d.slug}">
        ${escapeHtml(d.name)}
      </button>`).join('');
  }

  function renderCategoryGrid() {
    const topLevel = state.categories.filter((c) => !c.parentId);
    if (topLevel.length === 0) {
      categoryGridEl.innerHTML = '<p class="results-count">No categories available yet.</p>';
      return;
    }
    categoryGridEl.innerHTML = topLevel.map((c) => `
      <button type="button" class="category-tile" data-slug="${c.slug}">
        <div class="category-tile-icon"><i class="fa-solid fa-${escapeHtml(c.icon || 'store')}"></i></div>
        <h3>${escapeHtml(c.name)}</h3>
        ${c.description ? `<p class="category-tile-desc">${escapeHtml(c.description)}</p>` : ''}
        <span class="category-tile-count">${(c.businessCount || 0).toLocaleString('en-IN')} Businesses</span>
      </button>`).join('');
  }

  function renderCategoryFilterOptions() {
    const topLevel = state.categories.filter((c) => !c.parentId);
    filterCategory.innerHTML = '<option value="">All Categories</option>' + topLevel.map((c) =>
      `<option value="${c.slug}">${escapeHtml(c.name)}</option>`
    ).join('');
    filterCategory.value = state.filters.category || '';
  }

  function renderLocalityFilterOptions() {
    filterLocality.innerHTML = '<option value="">All Localities</option>' + state.localities.map((d) =>
      `<option value="${d.slug}">${escapeHtml(d.name)}</option>`
    ).join('');
    filterLocality.value = state.filters.locality || '';
  }

  function renderSkeletons() {
    resultsCount.textContent = 'Loading results…';
    resultsGrid.innerHTML = Array.from({ length: 4 })
      .map(() => '<div class="discovery-card skeleton-tile" style="height:280px;"></div>')
      .join('');
  }

  function renderResultsError() {
    resultsCount.textContent = 'Something went wrong.';
    resultsGrid.innerHTML = `
      <div class="discovery-empty-state">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <p>We couldn't load results right now. Please try again in a moment.</p>
      </div>`;
    loadMoreBtn.classList.add('hide');
  }

  function renderCard(biz) {
    const cover = (biz.media || []).find((m) => m.type === 'cover')?.secureUrl
      || (biz.media || []).find((m) => m.type === 'gallery')?.secureUrl;
    const logo = (biz.media || []).find((m) => m.type === 'profile_image')?.secureUrl;
    const openStatus = computeOpenStatus(biz.operatingHours);
    const cta = tierCta(biz);
    const highlights = (biz.metaData?.highlights || []).slice(0, 2);
    const categoryLabel = biz.categories?.[0]?.category?.name || '';
    const servingSince = biz.createdAt ? new Date(biz.createdAt).getFullYear() : null;
    const responseTime = biz.metaData?.responseTime;

    return `
      <article class="discovery-card">
        <div class="dc-cover" style="${cover ? `background-image:url('${cover}')` : ''}">
          ${!cover ? `<i class="fa-solid fa-store dc-cover-fallback"></i>` : ''}
          ${logo ? `<img class="dc-logo" src="${logo}" alt="">` : ''}
          <div class="dc-badges">
            ${biz.idVerified ? '<span class="dc-badge dc-badge-verified"><i class="fa-solid fa-circle-check"></i> Verified</span>' : ''}
            ${openStatus?.isOpen ? '<span class="dc-badge dc-badge-open"><i class="fa-solid fa-circle"></i> Open Now</span>' : ''}
          </div>
        </div>
        <div class="dc-body">
          <h3 class="dc-name">${escapeHtml(biz.businessName)}</h3>
          <p class="dc-meta">${escapeHtml(categoryLabel)}${categoryLabel && biz.localityName ? ' · ' : ''}${escapeHtml(biz.localityName || '')}</p>
          ${biz.chowkLandmark ? `<p class="dc-landmark"><i class="fa-solid fa-location-dot"></i> Near ${escapeHtml(biz.chowkLandmark)}</p>` : ''}
          <div class="dc-trust-row">
            ${servingSince ? `<span><i class="fa-solid fa-calendar"></i> Since ${servingSince}</span>` : ''}
            ${responseTime ? `<span><i class="fa-solid fa-bolt"></i> ${escapeHtml(responseTime)}</span>` : ''}
          </div>
          ${highlights.length ? `<div class="dc-highlights">${highlights.map((h) => `<span class="dc-chip">${escapeHtml(h)}</span>`).join('')}</div>` : ''}
        </div>
        <div class="dc-actions">
          <a class="btn btn-primary btn-block" href="/business/${biz.slug}">
            <i class="fa-solid ${cta.icon}"></i> ${cta.label}
          </a>
        </div>
      </article>`;
  }

  function renderResults() {
    if (state.results.length === 0) {
      resultsCount.textContent = '0 businesses found';
      resultsGrid.innerHTML = `
        <div class="discovery-empty-state">
          <i class="fa-solid fa-magnifying-glass"></i>
          <p>No businesses match your filters yet. Try widening your search or clearing a filter.</p>
        </div>`;
      loadMoreBtn.classList.add('hide');
      return;
    }
    resultsCount.textContent = `${(state.meta?.total ?? state.results.length).toLocaleString('en-IN')} businesses found`;
    resultsGrid.innerHTML = state.results.map(renderCard).join('');

    const hasMore = state.meta && state.filters.page < state.meta.totalPages;
    loadMoreBtn.classList.toggle('hide', !hasMore);

    // Category grid is only useful as a landing surface; once a category
    // filter is active, results are the focus.
    categorySection.style.display = state.filters.category ? 'none' : '';
  }

  // ── Autocomplete ───────────────────────────────────────────────────────
  function renderAutocomplete(data) {
    const groups = [
      { key: 'businesses', label: 'Businesses', icon: 'fa-store' },
      { key: 'categories', label: 'Categories', icon: 'fa-shapes' },
      { key: 'localities', label: 'Localities', icon: 'fa-location-dot' },
    ];
    const html = groups
      .filter((g) => (data[g.key] || []).length > 0)
      .map((g) => `
        <div class="ac-group">
          <div class="ac-group-label">${g.label}</div>
          ${data[g.key].map((item) => `
            <button type="button" class="ac-item" data-type="${item.type}"
              data-slug="${escapeHtml(item.slug || '')}" data-label="${escapeHtml(item.label)}">
              <i class="fa-solid ${g.icon}"></i> ${escapeHtml(item.label)}
            </button>`).join('')}
        </div>`).join('');

    if (!html) {
      autocompleteBox.innerHTML = '<div class="ac-empty">No matches yet.</div>';
    } else {
      autocompleteBox.innerHTML = html;
    }
    autocompleteBox.classList.remove('hide');
  }

  function selectAutocompleteItem(type, slug, label) {
    hasInteracted = true;
    autocompleteBox.classList.add('hide');
    searchInput.value = label;
    if (type === 'business' && slug) {
      window.location.href = `/business/${slug}`;
      return;
    }
    if (type === 'category' && slug) {
      state.filters.category = slug;
      state.filters.q = '';
      searchInput.value = '';
      renderCategoryFilterOptions();
    } else if (type === 'locality' && slug) {
      state.filters.locality = slug;
      state.filters.district = '';
      state.filters.q = '';
      searchInput.value = '';
      renderLocalityFilterOptions();
      renderDistrictPills();
    }
    updateURL();
    executeSearch(true);
  }

  const runAutocomplete = debounce(async (q) => {
    if (q.trim().length < 2) { autocompleteBox.classList.add('hide'); return; }
    try {
      const res = await fetch(`${API_BASE}/search/autocomplete?q=${encodeURIComponent(q)}`);
      const body = await res.json();
      renderAutocomplete(body.data || { businesses: [], categories: [], localities: [] });
    } catch (err) {
      console.error('[discovery] autocomplete failed', err);
    }
  }, 250);

  // ── Event wiring ───────────────────────────────────────────────────────
  function setupSearchBox() {
    searchInput.addEventListener('input', (e) => runAutocomplete(e.target.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        hasInteracted = true;
        state.filters.q = searchInput.value.trim();
        autocompleteBox.classList.add('hide');
        updateURL();
        executeSearch(true);
      }
    });
    autocompleteBox.addEventListener('click', (e) => {
      const item = e.target.closest('.ac-item');
      if (!item) return;
      selectAutocompleteItem(item.dataset.type, item.dataset.slug, item.dataset.label);
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.discovery-search-row')) autocompleteBox.classList.add('hide');
    });
  }

  function setupDistrictPills() {
    districtPillsEl.addEventListener('click', (e) => {
      const pill = e.target.closest('.district-pill');
      if (!pill) return;
      hasInteracted = true;
      const slug = pill.dataset.slug;
      const isActive = (state.filters.locality || state.filters.district) === slug;
      state.filters.locality = isActive ? '' : slug;
      state.filters.district = '';
      renderDistrictPills();
      renderLocalityFilterOptions();
      updateURL();
      executeSearch(true);
    });
  }

  function setupCategoryGrid() {
    categoryGridEl.addEventListener('click', (e) => {
      const tile = e.target.closest('.category-tile');
      if (!tile) return;
      hasInteracted = true;
      state.filters.category = tile.dataset.slug;
      renderCategoryFilterOptions();
      updateURL();
      executeSearch(true);
      window.scrollTo({ top: resultsGrid.offsetTop - 100, behavior: 'smooth' });
    });
  }

  function setupFilters() {
    filterOpenNow.checked = state.filters.openNow;
    filterVerified.checked = state.filters.verified;

    filterOpenNow.addEventListener('change', () => {
      hasInteracted = true;
      state.filters.openNow = filterOpenNow.checked;
      updateURL();
      executeSearch(true);
    });
    filterVerified.addEventListener('change', () => {
      hasInteracted = true;
      state.filters.verified = filterVerified.checked;
      updateURL();
      executeSearch(true);
    });
    filterCategory.addEventListener('change', () => {
      hasInteracted = true;
      state.filters.category = filterCategory.value;
      updateURL();
      executeSearch(true);
    });
    filterLocality.addEventListener('change', () => {
      hasInteracted = true;
      state.filters.locality = filterLocality.value;
      state.filters.district = '';
      renderDistrictPills();
      updateURL();
      executeSearch(true);
    });

    el('disc-clear-filters').addEventListener('click', () => {
      hasInteracted = true;
      state.filters = { ...state.filters, category: '', locality: '', district: '', verified: false, openNow: false };
      filterOpenNow.checked = false;
      filterVerified.checked = false;
      renderCategoryFilterOptions();
      renderLocalityFilterOptions();
      renderDistrictPills();
      updateURL();
      executeSearch(true);
    });

    // Mobile filter drawer
    el('disc-filter-toggle').addEventListener('click', () => {
      filterSidebar.classList.add('open');
      filterBackdrop.classList.remove('hide');
    });
    const closeDrawer = () => {
      filterSidebar.classList.remove('open');
      filterBackdrop.classList.add('hide');
    };
    el('disc-filter-close').addEventListener('click', closeDrawer);
    filterBackdrop.addEventListener('click', closeDrawer);
  }

  function setupSort() {
    sortSelect.value = state.filters.sortBy;
    sortSelect.addEventListener('change', () => {
      hasInteracted = true;
      state.filters.sortBy = sortSelect.value;
      updateURL();
      executeSearch(true);
    });
  }

  function setupPagination() {
    loadMoreBtn.addEventListener('click', () => {
      state.filters.page += 1;
      updateURL();
      executeSearch(false);
    });
  }

  function setupPopState() {
    window.addEventListener('popstate', () => {
      const { filters, scope } = parseInitialFilters();
      state.filters = filters;
      state.scope = scope;
      searchInput.value = filters.q || '';
      sortSelect.value = filters.sortBy;
      filterOpenNow.checked = filters.openNow;
      filterVerified.checked = filters.verified;
      renderCategoryFilterOptions();
      renderLocalityFilterOptions();
      renderDistrictPills();
      executeSearch(true);
    });
  }

  function initTheme() {
    const themeToggle = el('theme-toggle');
    if (!themeToggle) return;
    const activeTheme = localStorage.getItem('theme') || 'light';
    document.body.classList.toggle('dark-theme', activeTheme === 'dark');
    document.body.classList.toggle('light-theme', activeTheme !== 'dark');
    themeToggle.innerHTML = activeTheme === 'dark' ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    themeToggle.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-theme');
      document.body.classList.toggle('light-theme', !isDark);
      themeToggle.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
  }

  async function init() {
    initTheme();
    const { filters, scope } = parseInitialFilters();
    state.filters = filters;
    state.scope = scope;
    searchInput.value = filters.q || '';

    setupSearchBox();
    setupDistrictPills();
    setupCategoryGrid();
    setupFilters();
    setupSort();
    setupPagination();
    setupPopState();

    await Promise.all([loadCategories(), loadLocalities()]);
    categorySection.style.display = state.filters.category ? 'none' : '';
    await executeSearch(true);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
