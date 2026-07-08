# Sprint 2 — Batch 0 (Release Management Foundation) — Completion

## 1. Implementation Summary

Built a complete, **file-based** release management capability. Releases are git-tracked
JSON files (`releases/*.json`) that serve as the single source of truth for every
deployment. The backend serves two projections of that registry — a public,
non-technical "What's New" feed and a superadmin-only internal feed carrying the full
deployment record (approvals, technical changelog, git refs, migration/rollback notes,
feature flags). A scaffolder CLI and documented workflow drive releases from draft to
published.

**No production database migration** — per the agreed approach, the whole system is
files + git, so cutting a release never touches the Neon prod DB.

### What it delivers against the brief

| Brief item | Delivered as |
| ---------- | ------------ |
| Public "What's New" section | `/whats-new` page + `GET /api/v1/releases` |
| Internal release model (all listed fields) | `releases/schema.md` + JSON registry |
| Deployment status / Draft-Ready-Released | `status` lifecycle, enforced in projection |
| Product / QA / Deployment approval | `approvals.{product,qa,deployment}` |
| Release notes, technical changelog, feature/bug/improvement lists | `public.*` + `internal.*` |
| Migration notes, rollback notes | `internal.migrationNotes` / `rollbackNotes` |
| Git commit refs, git tag | `internal.git.{commits,tag}` |
| Feature flags (future-ready) | `internal.featureFlags` |
| Searchable release history / version history / feature timeline | `?q=` search + `/releases/timeline` |
| Release workflow | `docs/RELEASE_MANAGEMENT.md` + `npm run release:new` |
| Future AI automation (design only) | documented extensibility, not implemented |

## 2. Files Changed

**New — release registry**
- `releases/README.md` — what the registry is and how to cut a release
- `releases/schema.md` — full field reference + rules
- `releases/template.json` — scaffolding template
- `releases/1.0.0-digital-identity.json` — first real release (Sprint 1 / Batch 3.5)

**New — backend module** (`src/modules/releases/`)
- `release.service.js` — load/cache (dir-mtime invalidated), normalize with defensive
  defaults, semver sort, public vs internal projection, `?q=` search, timeline
- `release.controller.js` — public + internal controllers
- `release.routes.js` — public routes + superadmin-guarded `/internal`

**New — public page**
- `src/public/whats-new.html` — dark-theme page matching the storefront design system
- `src/public/js/whats-new.js` — fetch + render + debounced search + empty/error states

**New — tooling & docs**
- `scripts/new-release.js` — release scaffolder (`npm run release:new`)
- `docs/RELEASE_MANAGEMENT.md` — workflow + field reference + AI-automation design
- `docs/BATCH_0_COMPLETION.md` — this document

**Edited**
- `src/routes/v1/index.js` — mount `/releases`
- `src/app.js` — serve `/whats-new`
- `package.json` — `release:new` script

## 3. Architecture Decisions

- **File-based registry, not a DB table.** Chosen to avoid a production Neon migration
  and to make release history == git history. The service reads defensively, so the
  schema can grow without breaking consumers.
- **Two projections from one file.** `toPublic()` physically strips the `internal` block
  and `approvals` before serialization — internal/technical content cannot leak to the
  public API even by mistake. Verified (see QA).
- **Status gates visibility.** Only `status: "released"` appears publicly; `draft`/`ready`
  live only on the internal endpoint. Approvals are recorded for audit; they don't
  mechanically block (founder judgment stays in the loop).
- **Extensible filtering.** Internal endpoint already accepts `?status=` and `?sprint=`;
  new filters are one-line additions. Search spans all public fields today.
- **AI-ready by construction.** Every output (release notes, changelog, deployment/
  stakeholder summaries, in-app What's New) is a projection of one JSON file, so a future
  generator only has to emit a schema-valid file. Designed, not implemented, per brief.

## 4. QA Results

All checks headless/live against the running backend on `:5001`.

- [x] Service loads registry; public list = 1 (released), internal list = 1 (all statuses)
- [x] **Public projection strips `internal` + `approvals`** — public payload keys are
      exactly `version, slug, name, title, date, sprint, batch, status, summary, public`
- [x] `GET /api/v1/releases` → 200 with data
- [x] `GET /api/v1/releases/1.0.0` → 200; no internal leak confirmed
- [x] `GET /api/v1/releases/timeline` → 200
- [x] `GET /api/v1/releases/internal` **without auth → 401** (superadmin-guarded)
- [x] `GET /whats-new` page → 200; `js/whats-new.js` → 200
- [x] Search: `?q=QR` → 1 match (public content); `?q=zzz` → 0; internal-only terms
      (e.g. "overnight") correctly don't match the public feed
- [x] CLI `release:new` scaffolds a valid draft; draft excluded from public, present in
      internal `?status=draft`
- [x] CLI guards: rejects duplicate version and non-semver input
- [x] Page renders empty/error/no-results states; output is HTML-escaped

## 5. Known Limitations

- **No internal dashboard UI.** The internal *API* (`/releases/internal`) and the
  file+CLI workflow are delivered; a superadmin *screen* that renders them is not built.
  It would be a thin consumer of the existing endpoint. Flagged for product to confirm
  whether it belongs in this batch or the existing superadmin console — see review
  checklist. **This is the one intentional scope boundary.**
- **Search is substring, in-memory.** Fine for the current volume; not tokenized/ranked.
  The architecture supports swapping in a richer index later without API changes.
- **Approvals are advisory**, not enforced gates (by design).
- Visual browser proof of `/whats-new` was validated via HTTP + payload checks; the
  in-repo preview runtime remains sandboxed out of `~/Desktop`, so screenshots weren't
  captured here. The page is live on the running `:5001` server at `/whats-new`.

## 6. Product Review Checklist

- [ ] "What's New" copy tone reads right for customers/vendors (non-technical).
- [ ] Confirm v1.0.0 (Digital Identity) content accurately represents Sprint 1.
- [ ] Decide: build a superadmin **internal release dashboard UI** now, or defer?
      (API is ready either way.)
- [ ] Confirm the draft→ready→released lifecycle + approval fields match how the team
      actually signs off.
- [ ] Confirm `/whats-new` is the desired public URL / entry point (linked from where?).

## 7. Deployment Readiness

**Ready to deploy.** Additive only — new module, new page, new files; no migration, no
changes to existing endpoints or data. Mounting is isolated (`/api/v1/releases`,
`/whats-new`). Rollback = revert the additions; nothing to undo in the database.

Suggested release tag when shipped: **v1.1.0** — and this batch should itself be recorded
as the first release cut *through the new system* (`npm run release:new -- --version 1.1.0
--name "Release Management" --sprint "Sprint 2" --batch "Batch 0"`).
