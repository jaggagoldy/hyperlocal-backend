# P0 · Launch Foundation — Exit Criteria (the gate)

> P0 does not advance to P1 until **every** criterion below is objectively true and the Kill Criteria (APP-001 §4.3) return ✅. Phases are gates, not a schedule.

## Exit criteria

Legend: ✅ met · 🟡 engineering-complete, ops/authorization-gated · ⚪ blocked on a prod-affecting action (founder go-ahead)

| # | Criterion | Status | Evidence |
|---|---|---|---|
| E1 | CI is **required** on the production-deploying branch | ⚪ | Workflow exists (`.github/workflows/test.yml`); branch protection **not** enabled. Prepared in [ECR-2026-001](../../docs/ecr/ECR-2026-001-ci-enforcement-branch-protection.md). Requires repo-admin action + the `main` reconciliation (R2). |
| E2 | CI is **green** on that branch | 🟡 | Suite green **locally**: `21 suites / 119 tests` pass under CI env vars (+OTP persistence suite, P0.1). First CI run triggers on push to the protected branch (blocked by E1/E8). |
| E3 | Critical-path tests present & passing | ✅ | 21 suites / 119 tests green: auth (routes+service), business ownership middleware, business verification/duplicates/sitemap, media, superadmin audit-log, orders/leads/catalog routes, search, reviews, audit-log service, whatsapp, **OTP store (P0.1)**. |
| E4 | Rollback **drilled**, not just documented | 🟡 | Runbook written ([`rollback-runbook.md`](rollback-runbook.md)) + [ECR-2026-002](../../docs/ecr/ECR-2026-002-rollback-mechanism.md). **Strengthened (P0.1):** schema rollback is now real — versioned Prisma migrations adopted ([ECR-2026-003](../../docs/ecr/ECR-2026-003-prisma-migrations.md), [`MIGRATION_STRATEGY.md`](../../docs/engineering/MIGRATION_STRATEGY.md)). Drill **still not executed** — needs a safe window + go-ahead. MTTR unrecorded. |
| E5 | Observability live | ✅ | pino structured logging + `pino-http` with per-request `reqId`; `/health` DB probe (`SELECT 1`, up/degraded); `/api/v1/meta` (env/dbMode, no creds); global `errorHandler` logs `{err, reqId}`. In prod, logs stream to Render (the human-visible surface). |
| E6 | p95 **baseline captured** on core read paths | ✅ (local) | [`perf-baseline.md`](perf-baseline.md) — 9 public read paths, local p95 ≤ ~3.2ms (categories highest; autocomplete 1.5ms). Reproducible via `scripts/perf-baseline.js`. **Prod** baseline pending the deploy gate (E1/E8). |
| E7 | Prod/local separation & secret hygiene confirmed | ✅ | `env.js` validates required (DATABASE_URL, JWT_SECRET) vs optional feature keys; `.env` git-ignored & not tracked; no hardcoded secrets found; `dbMode.js` surfaces host only, never credentials; `.env.example` added (names only). |
| E8 | The branch that CI protects **is** the branch that deploys | ⚪ | Baseline lives on `engineering-baseline-p0`; `main` @ `c38e811` predates it (R2). Reconciliation is a **production deploy** → founder go-ahead required. Covered by [ECR-2026-001](../../docs/ecr/ECR-2026-001-ci-enforcement-branch-protection.md). |

**Tally:** ✅ 4 (E3, E5, E6, E7) · 🟡 2 engineering-complete/gated (E2, E4) · ⚪ 2 blocked on a prod-affecting decision (E1, E8).

## P0.1 closure sprint (2026-07-09) — Engineering Baseline Audit fixes

The Engineering Baseline Audit returned **APPROVE WITH REQUIRED FIXES**. The three approved items are complete (engineering scope); no other technical debt was touched, per the CPO directive.

> **Governance update (2026-07-09):** after review of the P0.1 evidence, the Engineering Baseline Audit status is now **APPROVED** (engineering baseline score 9.1/10). No remaining engineering fixes; the only remaining work is two founder-authorized operational gates (prod migration baseline; prod demo-account removal), tracked in [`../RG-001-engineering-readiness-checklist.md`](../RG-001-engineering-readiness-checklist.md). Next artifact before Code Freeze: RG-001 sign-off.

| # | Item | Status | Evidence |
|---|---|---|---|
| A1 | **Prisma Migrations** replace `db push` | ✅ engineering-complete | Baseline `prisma/migrations/20260709000000_init` (17 tables, 2 enums) generated offline; verified via `migrate deploy` against a throwaway scratch DB (created + dropped; prod & dev untouched). `npm run migrate:deploy` added. Strategy: [`MIGRATION_STRATEGY.md`](../../docs/engineering/MIGRATION_STRATEGY.md). [ECR-2026-003](../../docs/ecr/ECR-2026-003-prisma-migrations.md). **Gated:** prod `migrate resolve --applied` (baseline) runs in the reconciliation window with founder go-ahead — same gate as E1/E8. |
| A2 | **OTP persistence** (in-memory → `OtpSession`) | ✅ complete | [`src/utils/otpStore.js`](../../src/utils/otpStore.js) now Postgres-backed via the existing `OtpSession` model; code stored **hashed** (sha256), not plaintext; same verify semantics (TTL, single-use, attempt cap); horizontal-scale safe. Claim flow preserved ([`claim.service.js`](../../src/services/claim.service.js)). 9 new tests ([`otpStore.test.js`](../../src/utils/__tests__/otpStore.test.js)). |
| A3 | **Credential-file audit** | ✅ complete | Verified contents: no infra secrets (no keys/tokens/DB URLs). `DEV_TEST_CREDENTIALS.md` = local-only demo data; `PROD_DEMO_CREDENTIALS.md` = working weak prod demo logins. Both root files **removed**; sanitized [`docs/examples/DEMO_ACCOUNTS.md`](../../docs/examples/DEMO_ACCOUNTS.md) documents the convention (no passwords). Pre-public-launch prod cleanup tracked as **R8** (gated). |

## Kill Criteria verdict (record at phase close)

- ✅ **Advance to P1** if: gated CI green + rollback drilled + observability live (E1–E8 met).
- 🛑 **Stop & investigate** if: *can't deploy safely after 2 weeks* → fix the foundation before any P1 feature work.

**Verdict:** _P0 open (day 1). No 🛑 trigger — the foundation is built; remaining items are ops/authorization actions, not engineering gaps. Not yet ✅ (E1/E4/E8 open)._

## Measurements

- **MTTR (rollback drill):** _pending drill (E4) — needs safe window + go-ahead._
- **p95 baseline (core read paths, LOCAL):** root 1.08 · health 0.66 · meta 1.16 · releases 0.92 · verticals 1.81 · categories 3.20 · regions 0.74 · autocomplete 1.50 (ms). Full table in [`perf-baseline.md`](perf-baseline.md).
- **CI pipeline duration:** local suite ~5.3s (21 suites / 119 tests); CI wall-clock recorded on first run.
- **Schema strategy (P0.1):** versioned Prisma migrations adopted; baseline verified against a scratch DB. Prod baselining is gated on the reconciliation window.
- **Known follow-up (not an exit criterion):** `npm run lint` is broken (eslint 10 needs a flat `eslint.config.js`); CI runs `npm test` only, so the pipeline is unaffected. Tracked as risk R7.

---

*When every box is ticked and the verdict is ✅, close the phase by writing [`retro.md`](retro.md) and open `releases/P1/`.*
