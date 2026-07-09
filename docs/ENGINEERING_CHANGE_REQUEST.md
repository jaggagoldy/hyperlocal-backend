# Engineering Change Request (ECR) — Template & Governance

> **Status:** ✅ Active governance instrument — Engineering Execution
> **Companion to:** POCR (`docs/PRODUCT_OFFICE_CHANGE_REQUEST.md`)
> **Owner:** Engineering Director

---

## POCR vs ECR — the distinction

| | **POCR** | **ECR** |
|---|---|---|
| Governs | The **Product Office** (frozen WHAT/WHY + APP-001/002/003) | **How** we build — architecture & technical approach |
| Changes | **What** we build & why | **How** we build it |
| Approver | CPO / Product Office | Engineering Director |
| Examples | New capability, changed KPI, new phase, beachhead vertical | Architecture refactor, DB redesign, framework migration, performance redesign, breaking API change |

An ECR **must not** change product scope, priorities, or Kill Criteria — that requires a POCR. If a technical change forces a product tradeoff, it escalates to a POCR.

## When an ECR is required

Raise an ECR for a technical decision that is **hard to reverse** or **crosses module boundaries**, such as:
- Architecture refactor or a new architectural pattern.
- Database schema redesign or a data migration with backfill.
- Framework / major-dependency migration or runtime change.
- Performance redesign (caching strategy, query redesign, read models).
- **Breaking API changes** or API versioning/deprecation.
- Introducing a new cross-cutting service (queue, notification service, auth model).

Do **not** raise an ECR for: ordinary feature work inside an approved phase, bug fixes, additive non-breaking changes, or refactors contained within a single module. Those are normal engineering.

## The Alignment Rule still applies

Every ECR must name the **phase** (APP-001 §4.2), the **KPI/foundation** it protects or improves, and confirm it does **not** alter product scope. An ECR that can't map to the roadmap doesn't proceed — it waits.

---

## ECR Template — copy the block below for each request

```
ECR-ID:            ECR-YYYY-NNN
Title:             <one line>
Raised by:         <name / role>
Date:              <YYYY-MM-DD>
Status:            Draft | Under Review | Approved | Rejected | Withdrawn

── 1. Technical change ──────────────────────────────────────
Area:              <module / layer / service>
Type:              refactor | schema | migration | framework | perf | breaking-api | infra
Current approach:  <what exists today>
Proposed approach: <what it becomes>

── 2. Why (all required) ────────────────────────────────────
Problem:           <what's wrong / limiting / risky today>
Phase supported:   <APP-001 phase P0–P10>
KPI / foundation:  <which North Star, NFR, or Technical Foundation this protects>
Scope check:       Confirms NO change to product scope/priorities/Kill Criteria? Y/N
                   (If N → escalate to a POCR.)

── 3. Impact & risk ─────────────────────────────────────────
Reversibility:     easy | hard | one-way-door
Blast radius:      <modules/contracts affected>
Data migration:    none | additive | backfill-required
Rollback plan:     <how we undo>
Risk if approved:  <...>
Risk if NOT done:  <...>

── 4. Decision ──────────────────────────────────────────────
Reviewed by (Eng Director):  <name>
Decision:                    Approve | Reject
Rationale:                   <...>
Recorded in release entry:   <release version / registry ref>
```

---

## Process

1. **Draft** an ECR (file under `docs/ecr/ECR-YYYY-NNN.md`, or a shared log) for any change matching the criteria above.
2. **Review** with the Engineering Director; for one-way-door decisions, capture the rollback plan explicitly.
3. On **Approval**: implement behind the normal gates; record the ECR reference in the release registry entry (`releases/*.json`) so the change is auditable.
4. If the change turns out to affect product scope mid-flight → **stop and raise a POCR.**

---

## Log

| ECR | Date | Title | Status |
|---|---|---|---|
| [ECR-2026-001](ecr/ECR-2026-001-ci-enforcement-branch-protection.md) | 2026-07-09 | CI enforcement & production branch protection (P0 · E1/E2/E8) | Under Review |
| [ECR-2026-002](ecr/ECR-2026-002-rollback-mechanism.md) | 2026-07-09 | Rollback mechanism & drill (P0 · E4) | Under Review |

---

*POCR keeps the **product** honest; ECR keeps the **architecture** honest. Together they let both evolve deliberately, with evidence, and on the record.*
