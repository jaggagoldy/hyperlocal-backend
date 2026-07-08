# Product Office Change Request (POCR) — Template & Governance

> **Status:** ✅ Active governance instrument — Product Office Baseline v1.0
> **Binding rule:** **No Product Office document may be modified without an approved POCR.**

---

## What the Product Office is (v1.0, Frozen)

The following are the frozen Product Office baseline. They change **only** through an approved POCR:

**Governance artifacts (WHAT & WHY):**
- Product Constitution
- North Star Framework
- Product Experience Principles
- Marketplace Health Framework
- Product Governance Handbook
- Launch Strategy
- Product-Market Fit Strategy

**Engineering execution artifacts (HOW):**
- APP-001 — Master Product Portfolio & Engineering Execution Plan
- APP-002 — Founder Operating System
- APP-003 — Launch Execution Playbook

> **Not frozen (no POCR needed):** operational decisions explicitly marked as such inside the docs — e.g. the *current planned launch area* in APP-003 (the launch-area **selection criteria** are frozen; the specific city is operational). Release registry entries, sprint choices, and code are execution, not governance.

---

## When a POCR is required

Raise a POCR **only for a genuine governance gap or contradiction**, such as:
- A frozen principle is wrong, missing, or contradicted by validated market learning.
- A phase's Kill Criteria or KPI needs to change based on evidence.
- The beachhead **vertical** or the launch-area **selection criteria** must change (the operational city does not).
- A new capability or phase must be added/removed from APP-001.

Do **not** raise a POCR for: normal execution, feature prioritization within an approved phase, or operational choices already delegated by the docs.

---

## The rule of precedence

1. The frozen **WHAT/WHY** governance artifacts win over the **HOW** (APP-001/002/003).
2. On any conflict, the higher artifact governs and the lower is revised via POCR.
3. The **Alignment Rule** (APP-001 §9) still applies to all execution: no feature without a mapped milestone + measurable KPI + launch objective.

---

## POCR Template — copy the block below for each request

```
POCR-ID:           POCR-YYYY-NNN
Title:             <one line>
Raised by:         <name / role>
Date:              <YYYY-MM-DD>
Status:            Draft | Under Review | Approved | Rejected | Withdrawn

── 1. Target ────────────────────────────────────────────────
Document(s) affected:   <e.g. APP-001 §4.3, APP-003 §0>
Section / rule:         <exact section or rule being changed>

── 2. The change ────────────────────────────────────────────
Current text / rule:    <quote what exists today>
Proposed text / rule:   <what it should become>

── 3. Justification (all required) ──────────────────────────
Governance gap:         <what principle is wrong/missing/contradicted?>
Evidence:               <market learning / metric / Kill-Criteria trigger>
Phase supported:        <APP-001 phase P0–P10>
KPI improved:           <which North Star / guardrail>
Milestone unlocked:     <Founder Roadmap stage>

── 4. Impact ────────────────────────────────────────────────
Downstream docs to update:   <ripple effects>
Risk if approved:            <...>
Risk if NOT approved:        <...>

── 5. Decision ──────────────────────────────────────────────
Reviewed by (CPO/Product Office):   <name>
Decision:                           Approve | Reject
Rationale:                          <...>
New baseline version:               <e.g. v1.1>
Logged in Decision Journal:         Y / N   (APP-002 §5)
```

---

## Process

1. **Draft** a POCR from the template (new file under `docs/pocr/POCR-YYYY-NNN.md`, or an entry in a shared log).
2. **Review** at a Product Office session (or the monthly Phase Review, APP-002 §6).
3. On **Approval**: bump the affected doc's baseline version, apply the edit, and record the decision in the APP-002 Decision Journal.
4. On **Rejection**: the frozen baseline stands unchanged; the rationale is logged so the question isn't re-litigated without new evidence.

---

## Baseline history

| Version | Date | Change | POCR |
|---|---|---|---|
| **v1.0** | 2026-07-08 | Product Office frozen: 7 governance artifacts + APP-001 (v1.1), APP-002, APP-003 approved as baseline. | — (initial freeze) |

---

*This instrument exists so the Product Office stays stable while the market teaches us — change is allowed, but only deliberately, with evidence, and on the record.*
