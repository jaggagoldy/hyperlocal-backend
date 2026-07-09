ECR-ID:            ECR-2026-003
Title:             Adopt Prisma Migrate as the production schema strategy (replace db push)
Raised by:         Engineering (P0.1 closure)
Date:              2026-07-09
Status:            Under Review

── 1. Technical change ──────────────────────────────────────
Area:              Database / schema lifecycle / deploy
Type:              infra + migration
Current approach:  Production schema applied ad-hoc via `prisma db push`. No
                   migration history, no reviewable diff, no versioned rollback.
Proposed approach: Versioned Prisma Migrate. A baseline migration
                   (20260709000000_init) captures the current schema; production
                   is baselined once via `migrate resolve --applied`; thereafter
                   schema changes ship as reviewable migrations applied with
                   `prisma migrate deploy`.

── 2. Why (all required) ────────────────────────────────────
Problem:           `db push` gives no reproducibility, no deploy confidence, and
                   no schema rollback. Identified as the #1 Engineering Baseline
                   Audit finding; foundational to fix before merchant data lands.
Phase supported:   P0 (Launch Foundation) — closes an audit-blocking gap; also
                   strengthens exit criterion E4 (rollback).
KPI / foundation:  Deployment reproducibility & safe rollback (E4). Protects data
                   integrity once P1 merchant data accumulates.
Scope check:       Confirms NO change to product scope/priorities/Kill Criteria? Y
                   (Pure engineering; no product surface changes.)

── 3. Impact & risk ─────────────────────────────────────────
Reversibility:     one-way-door (adopting a migration history is a directional
                   commitment; the workflow is standard and low-risk to keep).
Blast radius:      Deploy pipeline + the production database's `_prisma_migrations`
                   bookkeeping table. No application code paths change.
Data migration:    none — the baseline is schema-only and production data is
                   preserved; prod is *baselined* (marked applied), not rebuilt.
Rollback plan:     Delete `prisma/migrations/` and revert `package.json` to return
                   to the prior workflow; no data is affected. Per-migration
                   rollback via down-migrations / Neon PITR (see rollback runbook).
Risk if approved:  The prod baseline (`migrate resolve`) and enabling auto-apply
                   must be sequenced correctly (baseline BEFORE enabling deploy),
                   or the next deploy fails on "table already exists".
                   Mitigated by documenting the strict order in MIGRATION_STRATEGY.md.
Risk if NOT done:  Schema drift and unrecoverable/irreproducible schema changes
                   once real merchant data exists — expensive to retrofit later.

── 4. Decision ──────────────────────────────────────────────
Reviewed by (Eng Director):  <pending>
Decision:                    <pending>
Rationale:                   <pending>
Recorded in release entry:   releases/P0 dossier (acceptance.md E4, risks.md)

---

## Verification performed (authoring)

- Baseline SQL generated **offline** (`migrate diff --from-empty`); no DB touched.
- Applied cleanly from empty via `prisma migrate deploy` against a throwaway
  scratch database (created + dropped). Neither production nor the local dev
  database was used. `migrate status` reported "up to date"; 17 model tables +
  `_prisma_migrations` present.

## Gated production step (NOT executed by engineering)

Baselining production (`migrate resolve --applied 20260709000000_init`) writes to
the production database's bookkeeping table. It runs no schema SQL and is safe,
but per the production-safety rule it requires **explicit founder authorization**
and is performed during the P0 `main` reconciliation window (same gate as E1/E8).
See `docs/engineering/MIGRATION_STRATEGY.md`.
