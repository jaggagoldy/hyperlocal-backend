import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import logger from '../../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// releases/ lives at the project root (src/modules/releases -> ../../../releases)
const RELEASES_DIR = path.resolve(__dirname, '../../../releases');

// Files that are not releases.
const IGNORED_FILES = new Set(['template.json']);

const VALID_STATUSES = new Set(['draft', 'ready', 'released']);

// ── caching ──────────────────────────────────────────────────────────────
// Cache the parsed registry and invalidate when the directory's mtime changes,
// so newly-added release files are picked up without a restart.
let cache = { mtimeMs: 0, releases: [] };

/** Compare two semver strings; returns >0 if a is newer than b. */
function compareVersion(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Fill in defensive defaults so consumers never crash on a sparse file. */
function normalize(raw, file) {
  const pub = raw.public || {};
  const internal = raw.internal || {};
  const impact = raw.impact || {};
  const metrics = internal.metrics || {};
  const arr = (v) => (Array.isArray(v) ? v : []);
  const num = (v) => (Number.isFinite(v) ? v : 0);
  return {
    version: raw.version || '0.0.0',
    slug: raw.slug || path.basename(file, '.json'),
    name: raw.name || '',
    title: raw.title || raw.name || '',
    date: raw.date || null,
    sprint: raw.sprint || null,
    batch: raw.batch || null,
    status: VALID_STATUSES.has(raw.status) ? raw.status : 'draft',
    approvals: {
      product: Boolean(raw.approvals?.product),
      qa: Boolean(raw.approvals?.qa),
      deployment: Boolean(raw.approvals?.deployment),
    },
    summary: raw.summary || '',
    public: {
      features: arr(pub.features),
      improvements: arr(pub.improvements),
      bugFixes: arr(pub.bugFixes),
      performance: arr(pub.performance),
      security: arr(pub.security),
    },
    // Public "who benefits" summary — ships in the public projection (see
    // toPublic() below), unlike internal.metrics which never leaves this file.
    impact: {
      customers: impact.customers || '',
      businesses: impact.businesses || '',
      platform: impact.platform || '',
    },
    internal: {
      technicalChangelog: arr(internal.technicalChangelog),
      featureList: arr(internal.featureList),
      bugFixList: arr(internal.bugFixList),
      improvementList: arr(internal.improvementList),
      migrationNotes: internal.migrationNotes || 'None',
      rollbackNotes: internal.rollbackNotes || '',
      git: {
        commits: arr(internal.git?.commits),
        tag: internal.git?.tag || '',
      },
      featureFlags: arr(internal.featureFlags),
      // Release scorecard — internal-only. Lives inside `internal` so toPublic()
      // (which deletes the whole `internal` key) strips it automatically.
      metrics: {
        featuresAdded: num(metrics.featuresAdded),
        improvements: num(metrics.improvements),
        bugFixes: num(metrics.bugFixes),
        performanceImprovements: num(metrics.performanceImprovements),
        securityUpdates: num(metrics.securityUpdates),
        breakingChanges: num(metrics.breakingChanges),
      },
    },
  };
}

/** Load + parse every release file, sorted newest-first. Cached by dir mtime. */
function loadRegistry() {
  let dirStat;
  try {
    dirStat = fs.statSync(RELEASES_DIR);
  } catch {
    logger.warn({ dir: RELEASES_DIR }, 'Releases directory not found');
    return [];
  }

  if (cache.releases.length && cache.mtimeMs === dirStat.mtimeMs) {
    return cache.releases;
  }

  const releases = [];
  for (const file of fs.readdirSync(RELEASES_DIR)) {
    if (!file.endsWith('.json') || IGNORED_FILES.has(file)) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(RELEASES_DIR, file), 'utf8'));
      releases.push(normalize(raw, file));
    } catch (error) {
      logger.error({ error, file }, 'Failed to parse release file');
    }
  }

  releases.sort((a, b) => compareVersion(b.version, a.version));
  cache = { mtimeMs: dirStat.mtimeMs, releases };
  return releases;
}

/** Strip the internal block — public consumers must never see it. */
function toPublic(release) {
  const { internal, approvals, ...rest } = release;
  return rest;
}

/** Case-insensitive substring match across the human-readable fields. */
function matchesQuery(release, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  const haystack = [
    release.version, release.name, release.title, release.summary,
    release.sprint, release.batch,
    ...release.public.features, ...release.public.improvements,
    ...release.public.bugFixes, ...release.public.performance, ...release.public.security,
  ].join(' ').toLowerCase();
  return haystack.includes(needle);
}

/**
 * Public list — only released versions, internal block stripped.
 * @param {{ q?: string }} [opts]
 */
export function listPublicReleases(opts = {}) {
  return loadRegistry()
    .filter((r) => r.status === 'released')
    .filter((r) => matchesQuery(r, opts.q))
    .map(toPublic);
}

/** Public single release by version (released only). Returns null if not found. */
export function getPublicRelease(version) {
  const release = loadRegistry().find((r) => r.version === version && r.status === 'released');
  return release ? toPublic(release) : null;
}

/**
 * Internal list — every field, every status. Superadmin only.
 * @param {{ q?: string, status?: string, sprint?: string }} [opts]
 */
export function listInternalReleases(opts = {}) {
  return loadRegistry()
    .filter((r) => (opts.status ? r.status === opts.status : true))
    .filter((r) => (opts.sprint ? r.sprint === opts.sprint : true))
    .filter((r) => matchesQuery(r, opts.q));
}

/** Internal single release by version (any status). Returns null if not found. */
export function getInternalRelease(version) {
  return loadRegistry().find((r) => r.version === version) || null;
}

/** Lightweight version index for a future "feature timeline" / history browser. */
export function getVersionTimeline() {
  return loadRegistry().map((r) => ({
    version: r.version,
    name: r.name,
    title: r.title,
    date: r.date,
    sprint: r.sprint,
    batch: r.batch,
    status: r.status,
  }));
}
