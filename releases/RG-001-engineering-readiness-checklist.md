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
| 2 | **Operational gates identified & owned** | 🟡 owners approved | Founder (authorize) · Engineering (execute) | Two gates identified (G1, G2 below); ownership **approved** (CPO, 2026-07-09). **Needs:** scheduled window. |
| 3 | **Code Freeze entry criteria satisfied** | ⚪ | Eng Director | Criteria defined below. **Needs:** items 1–2 + 6–7 satisfied and P0 exit criteria E1/E2/E4/E8 closed. |
| 4 | **Release Candidate policy finalized** | 🟡 specified · awaiting sign-off | CPO / Eng Director | Evidence-driven RC1/RC2/RC3 with objective exit criteria (below, per CPO 2026-07-09). **Needs:** formal sign-off. |
| 5 | **Go / No-Go authority defined** | 🟡 specified · awaiting sign-off | Founder / CPO | 5-role evidence-based veto model (below, per CPO 2026-07-09). **Needs:** formal sign-off. |
| 6 | **Rollback rehearsal completed** | 🟡 🔒 | Engineering | Runbook ready ([`P0/rollback-runbook.md`](P0/rollback-runbook.md)), [ECR-2026-002]. Drill **not executed** — P0 exit criterion E4; needs a safe window + go-ahead. MTTR unrecorded. |
| 7 | **Monitoring & alerting validated** | 🟡 **built · awaiting real-channel fire-test** | Engineering (build ✅) · Founder (channel + monitor) | App-owned alerts **implemented + unit-tested**: unhandled-exception + sustained-5xx → webhook **and** email ([`alert.service.js`](../src/services/alert.service.js), [`alertOn5xx.js`](../src/middlewares/alertOn5xx.js), [`server.js`](../src/server.js)). **Remaining to satisfy:** (a) founder sets `ALERT_WEBHOOK_URL`/`ALERT_EMAIL` + provisions the external `/health` monitor; (b) **fire-test** each path (evidence). See [`MONITORING.md`](../docs/engineering/MONITORING.md). |
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
5. **Item 7 (validated alerting) complete** — the one criterion the CPO insists on
   before authorizing Code Freeze (see the mandatory block below).
6. Items 4 & 5 (RC policy + Go/No-Go authority) signed off.

Gate G2 (demo-account removal) is a **pre-public-launch** requirement, not a
Code-Freeze-entry requirement — it may run any time before GA.

## Item 7 — Validated alerting (MANDATORY before Code Freeze)

> **The single item that must be completed before Code Freeze is authorized.**
> The problem is not observability (logs exist) — it is **operational detection**:
> "logs exist" and "someone is automatically notified when production is failing"
> are not equivalent. If production dies at 2 AM and nobody knows until a merchant
> complains, monitoring has failed. Business impact: protects marketplace trust.
> Engineering effort: small.

**Minimum acceptance — at least these three alerts, at least one *verified to fire*:**
1. **Health-endpoint failure** — `/health` unreachable or reporting `degraded`.
2. **Application crash** — the process is down / not responding.
3. **5xx error-rate** — server-error rate crosses a threshold.

All three may route to a **single channel** initially (a founder email, or a Slack
/ Discord channel). Sophistication is not required; **detection + notification is.**

**Validation = evidence:** the criterion is met only when an alert has been made to
fire on purpose and the notification was received (record the screenshot / message
link here). A configured-but-never-fired alert does **not** satisfy item 7.

**Implementation status (2026-07-10):** the app-owned half is **built and
unit-tested** — unhandled-exception alerts (`server.js`) and sustained-5xx alerts
(`alertOn5xx.js`) fan out to **both** a webhook and email (`alert.service.js`),
following the optional-integration pattern (disabled until configured). 128 tests
green (23 suites). **Two owner actions remain to satisfy the criterion:**
1. Founder sets `ALERT_WEBHOOK_URL` + `ALERT_EMAIL` (Render) and provisions the
   external `/health` uptime monitor (covers full-outage detection).
2. **Fire-test** the delivery path (`node scripts/alert-test.js`), the outage path,
   and the 5xx path; record the evidence here.

Full setup + fire-test procedure: [`docs/engineering/MONITORING.md`](../docs/engineering/MONITORING.md).

## Release Candidate policy (item 4 — specified, awaiting sign-off)

Evidence-driven: each RC stage has **objective exit criteria**, so RC progression is
readiness-based, not date-based. An RC is a tagged commit (`v1.0.0-rc.N`) on the
reconciled `main`; after RC1 is cut, only **release-exception** changes may land
(blocker fixes approved by the Go/No-Go authority) — no new features.

### RC1 — Engineering validation
Exit criteria (all required):
- All automated tests pass.
- Zero Sev-1 defects.
- Zero Sev-2 regressions.
- No data-integrity issues.

### RC2 — Operational validation
Exit criteria (all required):
- Production deployment rehearsed.
- Rollback rehearsed (MTTR recorded).
- Monitoring **validated** (item 7 — alerts verified firing).
- Migration verified (applied and confirmed on production / production-like DB).
- Backup verified (restore path confirmed).

### RC3 — Business validation
Exit criteria (all required):
- Founder approval.
- Beta checklist complete (item 8).
- Go/No-Go passed.
- Release notes complete.
- Support ready.

Each RC records: CI run link, migrations since the last RC, known issues by
severity, and the rollback point.

## Go / No-Go authority (item 5 — specified, awaiting sign-off)

| Role | Responsibility | Veto scope |
|---|---|---|
| **Founder** | Final launch decision | ✅ (final authority) |
| **Engineering** | Technical readiness | ✅ technical blockers only |
| **Product** | Scope & acceptance | ✅ scope gaps only |
| **QA** | Quality assessment | ✅ critical defects only |
| **Operations** | Deployment readiness | ✅ operational blockers only |

**The binding rule: a veto must be evidence-based.** "I don't feel ready" is not a
veto; "there is an unresolved Sev-1 authentication failure" is. Each veto names the
specific blocker and its evidence; clearing the blocker clears the veto. A No-Go
returns the build to development with the named blocker owned by someone.

## Deferred operational improvements (post-GA — recorded, not blockers)

Raised during governance review; explicitly **not** P0/Code-Freeze blockers:
1. **Migration PR requirements** — every migration PR should attach: generated SQL,
   expected runtime, rollback strategy, production impact. Documented as the standard
   in [`MIGRATION_STRATEGY.md`](../docs/engineering/MIGRATION_STRATEGY.md); enforce at GA.
2. **`remove-prod-demo.cjs` atomicity** — wrap the three sequential `deleteMany`
   calls (orders → businesses → users) in `prisma.$transaction` so a mid-way failure
   can't leave partial cleanup. One-time, recoverable, demo-only → post-GA.
3. **Staging-verified migrations (permanent rule, GA+).** No production migration may
   be merged unless it has first been successfully applied to a **production-like
   staging database** — distinct from local testing. It catches permission
   differences, lock behavior, real migration runtime, and managed-DB quirks that
   local Postgres won't. There is no separate staging environment today, so this is
   recorded as a **GA+ governance objective**, not a P0 blocker. Also in
   [`MIGRATION_STRATEGY.md`](../docs/engineering/MIGRATION_STRATEGY.md).

## Sign-off

| Role | Name | Decision | Date |
|---|---|---|---|
| Engineering Director | _pending_ | | |
| CPO / Founder | _pending_ | | |

> RG-001 is signed off only when items 1–8 are ✅ or explicitly waived with a named
> owner. Only then does the project enter Code Freeze.
