# Database Migration Strategy (P0.1)

> Adopted during P0.1 closure. Replaces the `prisma db push` prototyping workflow
> with versioned **Prisma Migrate** as the production schema strategy.
> Companion: [ECR-2026-003](../ecr/ECR-2026-003-prisma-migrations.md).

## Why

`prisma db push` mutates a database to match `schema.prisma` with **no migration
history, no reviewable diff, and no forward/rollback record**. Acceptable while
prototyping; unacceptable once merchant data accumulates — it undermines
reproducibility, deploy confidence, and rollback (P0 exit criterion E4). This
was the #1 finding of the Engineering Baseline Audit.

## What changed

- Added `prisma/migrations/` with a baseline migration `20260709000000_init`
  containing the full current schema (17 tables, 2 enums), generated offline via
  `prisma migrate diff --from-empty` (no database was touched to author it).
- Verified: the baseline applies cleanly from an empty database via
  `prisma migrate deploy` against a throwaway scratch DB (created and dropped;
  neither production nor the local dev DB was used).
- Added `npm run migrate:deploy` (`prisma migrate deploy`) for CI/prod.
- `prisma migrate dev` (`npm run prisma:migrate`) remains the authoring command
  for local development.

## The workflows

| Context | Command | Notes |
|---|---|---|
| Author a new migration (local) | `npm run prisma:migrate` | Edits `schema.prisma`, generates a migration, applies to local dev DB. |
| Apply pending migrations (CI / prod) | `npm run migrate:deploy` | Applies only; never generates or resets. Idempotent. |
| Never in any shared env | `prisma db push`, `prisma migrate reset` | `push` = drift; `reset` = data loss. |

## Baselining production (one-time, GATED)

The production Neon database **already has this schema** (applied historically via
`db push`). Running the baseline migration against it would fail ("table already
exists"). Production must therefore be **baselined** — told the initial migration
is already applied — exactly once, before any auto-apply is enabled:

```bash
# 1. Mark the baseline as already-applied on prod (records it, runs no SQL):
DATABASE_URL="<prod-neon-url>" npx prisma migrate resolve --applied 20260709000000_init

# 2. Confirm prod is now in sync:
DATABASE_URL="<prod-neon-url>" npx prisma migrate status
```

> ⚠️ **This touches the production database.** It is safe (it writes only to the
> `_prisma_migrations` bookkeeping table and executes no schema SQL), but per the
> repository's production-safety rule it must be run **only with explicit founder
> authorization**, as part of the P0 `main` reconciliation window — the same gate
> as exit criteria E1/E8. It is **not** executed by engineering unprompted.

## Enabling auto-apply on deploy (after baselining)

Only **after** production is baselined, wire migrations into the Render build so
future migrations apply automatically on deploy. Update `render.yaml`:

```yaml
buildCommand: npm install && npx prisma generate && npx prisma migrate deploy
```

Enabling this before baselining would break the next deploy — hence the strict
order: **baseline first (gated), then enable auto-apply.**

## Rollback

- **Data-preserving schema rollback** is now a real, reviewable operation: revert
  the offending migration with a new "down" migration, or restore via Neon PITR
  for a destructive change. See [`releases/P0/rollback-runbook.md`](../../releases/P0/rollback-runbook.md).
- Because every schema change is now a discrete, versioned artifact, a bad
  migration is identifiable and revertible — which is what E4 requires.

## Housekeeping note

Legacy one-off scripts (`migrate-dual-profiles.js`, `prisma/create-kundi-sotta.js`)
predate this strategy and are **not** part of the migration history. They should
be removed or moved under `scripts/` once confirmed obsolete (deferred — not a
P0.1 blocker).

## Migration governance (change categories)

Every migration is classified so release approval knows its risk at a glance:

| Class | Examples | Approval |
|---|---|---|
| 🟢 **Safe** | add nullable column · add table · add index | Normal review. |
| 🟡 **Review required** | rename column · alter enum · add unique/NOT-NULL constraint · change type | Eng Director review; requires a data-compatibility note. |
| 🔴 **High risk** | drop column · destructive change · data rewrite/backfill | ECR + explicit rollback plan + safe window; treat as a one-way door. |

## Migration PR requirements

Every migration PR must attach, in the description:
1. the **generated SQL** (the migration file),
2. the **expected runtime** (fast / locks a table / long backfill),
3. the **rollback strategy** (down-migration or PITR),
4. the **production impact** (downtime? lock? read/write availability?).

> Documented now as the standard; **enforced at GA** (post-P0). Recorded in
> [`releases/RG-001-engineering-readiness-checklist.md`](../../releases/RG-001-engineering-readiness-checklist.md)
> as a deferred operational improvement.
