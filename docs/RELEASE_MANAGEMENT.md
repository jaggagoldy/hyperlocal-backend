# NearByBazar — Release Management

**Sprint 2 · Batch 0 — Release Management Foundation.**
**Sprint 2 · Batch 0.1 — Impact Summary + Metrics refinement (additive, no schema/DB changes).**

This is the platform capability that lets us track every deployment internally
while communicating updates clearly to customers and vendors. It is deliberately
**file-based** — the release registry lives in git (`releases/*.json`), so cutting a
release never touches the production database and the release history *is* the
version-control history.

---

## The pieces

| Piece | Location | Audience |
| ----- | -------- | -------- |
| Release registry (source of truth) | `releases/*.json` | engineering (git) |
| Schema + field reference | `releases/schema.md` | engineering |
| Scaffolder CLI | `scripts/new-release.js` (`npm run release:new`) | engineering |
| Public "What's New" page | `/whats-new` (`src/public/whats-new.html` + `js/whats-new.js`) | customers & vendors |
| Public API | `GET /api/v1/releases`, `/releases/:version`, `/releases/timeline` | anyone |
| Internal API | `GET /api/v1/releases/internal[/:version]` (superadmin) | founders / ops |
| Backend module | `src/modules/releases/` | engineering |

### Public vs internal projection

The backend loads each release file once (cached, auto-invalidated when the
`releases/` directory changes) and serves **two projections**:

- **Public** — only releases with `status: "released"`, with the entire `internal`
  block and `approvals` **stripped**. This is what `/whats-new` shows.
- **Internal** — every field, every status, superadmin-guarded. This is the
  deployment source of truth (changelog, approvals, git refs, migration/rollback
  notes, feature flags).

The public API physically cannot leak internal notes: `toPublic()` removes the
`internal` key before serialization.

---

## The deployment workflow

Every NearByBazar deployment follows this path. The release file is the artifact
that carries it from development to a published update.

```
Feature Development
      ↓
Product Review              → approvals.product = true
      ↓
QA Approval                 → approvals.qa = true
      ↓
Prepare Release Notes       → npm run release:new  (creates a draft file)
      ↓
Generate Technical Changelog→ fill internal.technicalChangelog / *List
      ↓
Generate "What's New" Entry → fill summary + public.*
      ↓
Founder Approval            → approvals.deployment = true, status = "ready"
      ↓
Deployment                  → merge to main (Render auto-deploys)
      ↓
Tag Git Release             → git tag vX.Y.Z  (record in internal.git.tag)
      ↓
Publish Platform Update     → status = "released"  → appears on /whats-new
```

### 1. Scaffold the draft

```bash
npm run release:new -- \
  --version 1.1.0 \
  --name "Customer Discovery" \
  --title "Find local businesses faster" \
  --sprint "Sprint 2" --batch "Batch 1"
```

Creates `releases/1.1.0-customer-discovery.json` with `status: "draft"`. The CLI
refuses to overwrite an existing file or reuse a version number.

### 2. Fill it in

Edit the new file (see `releases/schema.md` for every field):

- `summary` + `public.{features,improvements,bugFixes,performance,security}` —
  plain-language, customer-facing. Keep it non-technical.
- `impact.{customers,businesses,platform}` — one plain-language sentence per
  audience on who benefits and how. Public (rendered on `/whats-new` as a
  "Who Benefits" section); empty strings are simply not rendered.
- `internal.{technicalChangelog,featureList,bugFixList,improvementList}` —
  engineering framing.
- `internal.migrationNotes` / `internal.rollbackNotes` — how to migrate / undo.
- `internal.git.commits` / `internal.git.tag` — traceability.
- `internal.featureFlags` — future-ready; usually `[]`.
- `internal.metrics.{featuresAdded,improvements,bugFixes,performanceImprovements,
  securityUpdates,breakingChanges}` — quantitative release scorecard. Internal-only:
  it lives inside `internal`, which the public API strips wholesale, so it can
  never leak regardless of what's added to it later.

### 3. Walk the status

`draft` → `ready` → `released`. Only `released` files show on `/whats-new`. Flip
each `approvals.*` flag as the sign-off is granted; they gate nothing mechanically
today but are the audit trail founders review before deployment.

### 4. Tag and publish

After merging to `main` (Render auto-deploys), tag the commit and set the file to
`released`:

```bash
git tag v1.1.0 && git push --tags
```

---

## Knowledge base / history

- `GET /api/v1/releases` — released history, newest first. Supports `?q=` full-text
  search across version, title, summary and every public change line.
- `GET /api/v1/releases/timeline` — lightweight version index (a "feature timeline"
  the UI can render as a history browser).
- The `/whats-new` page has a live search box wired to `?q=` — the searchable
  release history required by the brief.

Filtering is designed to grow: the internal endpoint already accepts `?status=` and
`?sprint=`; adding new filters (e.g. `?vertical=`) is a one-line change in the
service, no schema work.

---

## Future AI automation (designed for, not built)

The system is structured so a future automation step can generate the release
content from merged commits and completed product work, then drop a finished file
into `releases/`. Everything downstream already consumes that file:

- **Release Notes / Technical Changelog / Deployment Summary / Stakeholder Summary /
  In-App "What's New"** are all just *projections of one release JSON*. An AI job
  needs only to produce a schema-valid file — the API and page render it unchanged.
- The schema is additive and read defensively (unknown keys ignored, missing keys
  defaulted), so an automation step can add fields (e.g. `aiSummary`,
  `stakeholderSummary`) without breaking existing consumers.
- Suggested future entry point: `scripts/generate-release.js <from-tag> <to-tag>`
  that reads `git log`, drafts the file, and hands it to a human for approval —
  slotting in at the "Prepare Release Notes" step above. **Not implemented now.**
