# RG-001 · Engineering Readiness Checklist

> **Series:** Release Governance (RG) — the gate between an approved engineering
> baseline and Code Freeze. Companion to [`GOVERNANCE.md`](GOVERNANCE.md) and the
> [P0 dossier](P0/). This is the artifact that must be signed off **before**
> entering Code Freeze; after Code Freeze, every change is a release exception,
> not normal development.
> **Owner:** Engineering Director + CPO/Founder (joint) · **Status:** Open (P0 close)

## Governance status (as of 2026-07-09)

- **Engineering Baseline Audit — STATUS: APPROVED.** Engineering implementation is
  complete; the architectural deficiencies (migrations, OTP persistence, credential
  hygiene) identified in the audit are closed in code and covered by tests.
  Engineering baseline score (governance review): **9.1 / 10**.
- **Remaining work is operational, not engineering** — two founder-authorized gates
  (below), required before Code Freeze. There are **no** remaining engineering fixes.

## The checklist (verified in order)

Legend: ✅ satisfied · 🟡 in progress / partial · ⚪ not started / proposed · 🔒 founder-authorized gate

| # | Item | Status | Owner | Evidence / what's needed to satisfy |
|---|---|---|---|---|
| 1 | **Engineering baseline approved** | ✅ | CPO / Eng Governance | Engineering Baseline Audit + P0.1 closure (commit `924ad50`); verdict APPROVED, 9.1/10. Migrations, OTP persistence, credential hygiene all closed. 21 suites / 119 tests green. |
| 2 | **Operational gates identified & owned** | 🟡 | Founder (authorize) · Engineering (execute) | Two gates identified (G1, G2 below). **Needs:** explicit owner assignment + scheduled window. |
| 3 | **Code Freeze entry criteria satisfied** | ⚪ | Eng Director | Criteria defined below. **Needs:** items 1–2 + 6–7 satisfied and P0 exit criteria E1/E2/E4/E8 closed. |
| 4 | **Release Candidate policy finalized** | ⚪ proposed | CPO / Eng Director | Draft policy below. **Needs:** sign-off. |
| 5 | **Go / No-Go authority defined** | ⚪ proposed | Founder / CPO | Draft authority model below. **Needs:** sign-off. |
| 6 | **Rollback rehearsal completed** | 🟡 🔒 | Engineering | Runbook ready ([`P0/rollback-runbook.md`](P0/rollback-runbook.md)), [ECR-2026-002]. Drill **not executed** — P0 exit criterion E4; needs a safe window + go-ahead. MTTR unrecorded. |
| 7 | **Monitoring & alerting validated** | 🟡 partial | Engineering | Observability **live** (E5: pino + `reqId`, `/health` DB probe, `errorHandler`). **Gap:** no *alerting* validated — logs stream to Render but no tested alert rule (health-down / error-rate → notification). **Needs:** define + fire-test ≥1 alert. |
| 8 | **Beta launch criteria approved** | ⚪ | CPO / Product | Product-owned (APP-003 playbook; P1 KPI = 50 active merchants, physiotherapists/Hisar). **Needs:** Product Office sign-off (POCR territory), not engineering. |

## The two operational gates (item 2)

Both are **founder-authorized production operations**, sequenced into the P0 `main`
reconciliation window. Neither is engineering work; neither is executed by
engineering without explicit go-ahead.

- **G1 — Baseline production for migrations.**
  `prisma migrate resolve --applied 20260709000000_init` against prod (writes only the
  `_prisma_migrations` bookkeeping table; runs no schema SQL). Then enable
  `prisma migrate deploy` in `render.yaml` — in that order. See
  [`MIGRATION_STRATEGY.md`](../docs/engineering/MIGRATION_STRATEGY.md).
- **G2 — Remove production demo accounts (risk R8).**
  `DATABASE_URL="<prod>" node scripts/remove-prod-demo.cjs --yes` — pre-public-launch
  hygiene. Retires the weak shared demo password from prod.

## Code Freeze entry criteria (item 3)

Code Freeze may begin once **all** of the following hold:
1. Item 1 (baseline approved) ✅ — done.
2. P0 exit criteria E1, E2, E4, E8 closed (the `main` reconciliation + branch
   protection + rollback drill — the existing P0 close).
3. Gate G1 executed (prod baselined; `migrate deploy` wired).
4. Item 6 (rollback rehearsal) complete with a recorded MTTR.
5. Item 7 (≥1 validated alert) complete.
6. Items 4 & 5 (RC policy + Go/No-Go authority) signed off.

Gate G2 (demo-account removal) is a **pre-public-launch** requirement, not a
Code-Freeze-entry requirement — it may run any time before GA.

## Proposed: Release Candidate policy (item 4 — awaiting sign-off)

- An **RC** is a tagged commit on the reconciled `main` that passes required CI and
  has G1 applied. Tag format `v1.0.0-rc.N`.
- After an RC is cut, only **release-exception** changes may land (blocker bug fixes,
  approved by the Go/No-Go authority). No new features, no schema changes except a
  reviewed hotfix migration.
- Each RC records: CI run link, migration(s) since last RC, known issues, rollback point.

## Proposed: Go / No-Go authority (item 5 — awaiting sign-off)

- **Technical Go/No-Go:** Engineering Director — CI green, migrations applied,
  rollback rehearsed, alerting validated.
- **Business Go/No-Go:** Founder / CPO — beta criteria (item 8) met.
- **Launch requires both.** Either party may call No-Go; a No-Go returns the build to
  development with a named blocker.

## Deferred operational improvements (post-GA — recorded, not blockers)

Raised during governance review; explicitly **not** P0/Code-Freeze blockers:
1. **Migration PR requirements** — every migration PR should attach: generated SQL,
   expected runtime, rollback strategy, production impact. Documented as the standard
   in [`MIGRATION_STRATEGY.md`](../docs/engineering/MIGRATION_STRATEGY.md); enforce at GA.
2. **`remove-prod-demo.cjs` atomicity** — wrap the three sequential `deleteMany`
   calls (orders → businesses → users) in `prisma.$transaction` so a mid-way failure
   can't leave partial cleanup. One-time, recoverable, demo-only → post-GA.

## Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| Engineering Director | _pending_ | | |
| CPO / Founder | _pending_ | | |

> RG-001 is signed off only when items 1–8 are ✅ or explicitly waived with a named
> owner. Only then does the project enter Code Freeze.
