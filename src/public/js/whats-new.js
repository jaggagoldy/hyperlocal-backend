/* NearByBazar — Public "What's New" page.
 * Reads the public release registry (GET /api/v1/releases) and renders a simple,
 * professional, non-technical history. Search hits the same endpoint with ?q=.
 * The `internal` block is never sent by the API, so nothing technical can leak here. */
(function () {
  'use strict';

  const API_BASE = window.location.origin + '/api/v1';
  const listEl = document.getElementById('wn-list');
  const searchEl = document.getElementById('wn-search');

  // Order + presentation metadata for each public change group.
  const GROUPS = [
    { key: 'features', label: 'New Features', cls: 'g-features', icon: 'fa-star' },
    { key: 'improvements', label: 'Improvements', cls: 'g-improvements', icon: 'fa-arrow-up' },
    { key: 'bugFixes', label: 'Bug Fixes', cls: 'g-bugfixes', icon: 'fa-bug' },
    { key: 'performance', label: 'Performance', cls: 'g-performance', icon: 'fa-gauge-high' },
    { key: 'security', label: 'Security Updates', cls: 'g-security', icon: 'fa-shield-halved' },
  ];

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return escapeHtml(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function renderGroup(group, items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    const lis = items.map((t) => `<li>${escapeHtml(t)}</li>`).join('');
    return `
      <div class="group ${group.cls}">
        <div class="group-title ${group.cls}">
          <span class="dot"></span>${escapeHtml(group.label)}
        </div>
        <ul>${lis}</ul>
      </div>`;
  }

  // "Who benefits" impact rows — order + presentation metadata.
  const IMPACT_ROWS = [
    { key: 'customers', label: 'Customers', icon: 'fa-user' },
    { key: 'businesses', label: 'Businesses', icon: 'fa-store' },
    { key: 'platform', label: 'Platform', icon: 'fa-server' },
  ];

  function renderImpact(impact) {
    if (!impact) return '';
    const rows = IMPACT_ROWS
      .filter((r) => impact[r.key])
      .map((r) => `
        <div class="impact-row">
          <div class="impact-label"><i class="fas ${r.icon}"></i>${escapeHtml(r.label)}</div>
          <p class="impact-text">${escapeHtml(impact[r.key])}</p>
        </div>`)
      .join('');
    if (!rows) return '';
    return `
      <div class="group g-impact">
        <div class="group-title g-impact"><span class="dot"></span>Who Benefits</div>
        <div class="impact-grid">${rows}</div>
      </div>`;
  }

  function renderRelease(rel) {
    const pub = rel.public || {};
    const groups = GROUPS.map((g) => renderGroup(g, pub[g.key])).join('');
    const impact = renderImpact(rel.impact);
    const sprintLine = [rel.sprint, rel.batch].filter(Boolean).join(' · ');
    return `
      <article class="release">
        <div class="release-head">
          <span class="badge-version">v${escapeHtml(rel.version)}</span>
          <span class="release-date">${formatDate(rel.date)}</span>
          ${sprintLine ? `<span class="release-sprint">${escapeHtml(sprintLine)}</span>` : ''}
        </div>
        <h2>${escapeHtml(rel.title || rel.name)}</h2>
        ${rel.summary ? `<p class="release-summary">${escapeHtml(rel.summary)}</p>` : ''}
        ${groups}
        ${impact}
      </article>`;
  }

  function renderEmpty(isSearch) {
    listEl.innerHTML = `
      <div class="state">
        <i class="fas ${isSearch ? 'fa-magnifying-glass' : 'fa-inbox'}"></i>
        ${isSearch
          ? 'No updates match your search. Try a different keyword.'
          : 'No platform updates have been published yet. Check back soon!'}
      </div>`;
  }

  function renderError() {
    listEl.innerHTML = `
      <div class="state">
        <i class="fas fa-triangle-exclamation"></i>
        We couldn't load platform updates right now. Please try again in a moment.
      </div>`;
  }

  async function load(query) {
    const q = (query || '').trim();
    try {
      const url = API_BASE + '/releases' + (q ? `?q=${encodeURIComponent(q)}` : '');
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const body = await res.json();
      const releases = Array.isArray(body.data) ? body.data : [];
      if (releases.length === 0) return renderEmpty(Boolean(q));
      listEl.innerHTML = releases.map(renderRelease).join('');
    } catch (err) {
      console.error('[whats-new] load failed:', err);
      renderError();
    }
  }

  // Debounced search — future-ready for popular/recent suggestions.
  let debounce;
  if (searchEl) {
    searchEl.addEventListener('input', (e) => {
      clearTimeout(debounce);
      const val = e.target.value;
      debounce = setTimeout(() => load(val), 250);
    });
  }

  load('');
})();
