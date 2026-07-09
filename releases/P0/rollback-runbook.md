# P0 · Production Rollback Runbook

> Governed by [ECR-2026-002](../../docs/ecr/ECR-2026-002-rollback-mechanism.md). Satisfies exit criterion **E4** once drilled and MTTR is recorded in [`acceptance.md`](acceptance.md).
>
> **Platform:** backend on **Render** (auto-deploys from `main`), database on **Neon** (Postgres). Frontend on Vercel is out of P0 scope.

---

## When to roll back (decision rule)

Declare a rollback when, after a deploy, any of these hold and can't be fixed forward within minutes:

- `/health` reports `degraded` (DB down) or the service is 5xx-ing.
- Error rate spikes in the Render log stream (`level:50` entries surge).
- A core read path (see [`perf-baseline.md`](perf-baseline.md)) is broken or grossly slower than baseline.
- A smoke check of `/`, `/health`, `/api/v1/meta` fails.

**Decision owner:** whoever shipped the deploy (or on-call). Bias to rollback — recovering fast beats debugging in prod.

---

## Layer 1 — Code rollback (primary, default)

Use for any **code-only** bad deploy (no migration shipped).

1. Open Render → the backend service → **Deploys**.
2. Find the last known-good deploy (the one before the bad one).
3. **Rollback to this deploy** (or trigger a redeploy of the last-good commit).
4. Wait for status **Live**.
5. **Verify:** `GET /health` → `status: success`, `database: up`; `GET /api/v1/meta` → expected env; smoke `GET /`.
6. Record the wall-clock from *decision* → *verified healthy* as **MTTR**.

Git equivalent (if driving from the repo): revert the bad merge on `main` and let auto-deploy ship the revert.

```
git revert -m 1 <bad-merge-sha>   # creates a revert commit
git push origin main               # triggers Render auto-deploy of the revert
```

## Layer 2 — Data rollback (only if a migration shipped)

Use **only** when the bad deploy included a Prisma schema/data migration. Code rollback alone is unsafe if the schema moved.

1. Do the Layer-1 code rollback first (get the app back to last-good code).
2. In Neon, use **point-in-time restore** (or a restore branch) to just before the migration ran.
3. Repoint `DATABASE_URL` if a restore branch is used; confirm `dbMode`/`dbHost` via `/api/v1/meta`.
4. Verify `/health` → `database: up` and spot-check critical reads.
5. Record MTTR (decision → verified healthy).

> **P0 default is zero migrations.** Any P0 change that would require a migration must first raise an ECR (`docs/ENGINEERING_CHANGE_REQUEST.md`).

---

## The drill (required for E4)

E4 is met by **executing** a rollback, not just documenting it.

1. Pick a safe window (low traffic) — ideally against a staging service; if none, a controlled prod window with go-ahead.
2. Deploy a trivially-reversible change (e.g. a no-op version bump).
3. Execute Layer 1 rollback.
4. Verify healthy.
5. Record **MTTR** and notes below and in [`acceptance.md`](acceptance.md).

### Drill log

| Date | Layer | Trigger (simulated) | Decision → Healthy (MTTR) | Notes |
|---|---|---|---|---|
| _tbd_ | _1_ | _no-op version bump_ | _tbd_ | _pending drill — needs safe window + go-ahead_ |

---

## Smoke check (paste-ready)

```
BASE=<service-url>
curl -fsS "$BASE/"            && echo " ✓ root"
curl -fsS "$BASE/health"      && echo " ✓ health"
curl -fsS "$BASE/api/v1/meta" && echo " ✓ meta"
```
All three must return 200 and `/health` must show `database: up` before a rollback is called complete.
