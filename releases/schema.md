# Release file schema

Every file in `releases/*.json` (except `template.json`) conforms to this shape.
Fields are grouped into three tiers so consumers can project exactly what they need.

```jsonc
{
  // ── Identity ────────────────────────────────────────────────
  "version": "1.0.0",           // semver; also the sort key (newest first)
  "slug": "digital-identity",   // url-safe id; file is <version>-<slug>.json
  "name": "Digital Identity",   // internal codename for the release
  "title": "Professional Business Storefronts", // customer-facing headline
  "date": "2026-07-04",         // ISO date the release shipped (or is planned)
  "sprint": "Sprint 1",
  "batch": "Batch 3.5",

  // ── Lifecycle ───────────────────────────────────────────────
  "status": "released",         // "draft" | "ready" | "released"
  "approvals": {
    "product": true,            // Product Review sign-off
    "qa": true,                 // QA Approval
    "deployment": true          // Founder / Deployment Approval
  },

  // ── Public (customer & vendor facing, non-technical) ────────
  "summary": "One or two friendly sentences describing the release.",
  "public": {
    "features":     [ "Plain-language new capability", ... ],
    "improvements": [ "Plain-language improvement", ... ],
    "bugFixes":     [ "Plain-language fix", ... ],
    "performance":  [ "Plain-language speed/reliability win", ... ],
    "security":     [ "Plain-language security note", ... ]   // optional
  },

  // ── Impact (public, Sprint 2 · Batch 0.1) ───────────────────
  // Structured "who benefits" summary rendered on /whats-new next to the
  // change lists. Non-technical, one or two sentences per audience.
  "impact": {
    "customers":  "What customers experience differently after this release.",
    "businesses": "What vendors or business owners gain.",
    "platform":   "Internal infrastructure or architectural changes."
  },

  // ── Internal (deployment source of truth) ───────────────────
  "internal": {
    "technicalChangelog": [ "Terse engineering-level change", ... ],
    "featureList":     [ "Feature (engineering framing)", ... ],
    "bugFixList":      [ "Bug fix (engineering framing)", ... ],
    "improvementList": [ "Improvement (engineering framing)", ... ],
    "migrationNotes": "How to migrate; 'None' if no migration.",
    "rollbackNotes":  "How to roll back safely.",
    "git": {
      "commits": [ "c38e811", ... ],   // reference commit shas
      "tag": "v1.0.0"                  // git tag cut for this release
    },
    "featureFlags": [                  // future-ready; usually empty
      { "key": "flag_name", "description": "...", "default": false }
    ],

    // ── Metrics (internal-only, Sprint 2 · Batch 0.1) ─────────
    // Quantitative release scorecard for engineering/product accountability.
    // Never exposed on the public API — internal block is stripped entirely
    // before the public projection is built.
    "metrics": {
      "featuresAdded": 0,
      "improvements": 0,
      "bugFixes": 0,
      "performanceImprovements": 0,
      "securityUpdates": 0,
      "breakingChanges": 0
    }
  }
}
```

## Rules

- `version` is unique and drives ordering (newest first).
- All array fields are optional and default to `[]`; empty arrays are simply not
  rendered. `public.security` is omitted unless the release has security content.
- Only `status: "released"` files appear on the public "What's New" page.
- The public API never exposes the `internal` block. Internal fields are served
  only through the superadmin-guarded endpoint.
- Adding a field here is backward-compatible: consumers read defensively and ignore
  unknown keys, so the schema can grow (e.g. AI-generated summaries) without a rewrite.
- `impact` is public — it ships in the public projection alongside `public.*` —
  because it answers "who does this affect" in plain language, same audience as
  the change lists. All three strings default to `""` and are simply not rendered
  when empty.
- `internal.metrics` is internal-only by construction: it lives inside `internal`,
  and `toPublic()` deletes the whole `internal` key before serializing, so no
  metrics field can leak regardless of what's added to the block later. All six
  counters default to `0`.
