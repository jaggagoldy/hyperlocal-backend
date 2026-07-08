# P0 · Launch Foundation — Release Dossier

> **Phase:** P0 (enabler — precedes all founder stages)
> **Status:** 🟡 Open — entered 2026-07-08 (Product Office Baseline v1.0 freeze)
> **Owner:** Engineering Director
> **Governs:** APP-001 §4.2 (P0 row), §4.3 (P0 Kill Criteria), §6 Technical Foundations, §7 NFR
> **Companion files:** [`scope.md`](scope.md) · [`risks.md`](risks.md) · [`acceptance.md`](acceptance.md) · [`retro.md`](retro.md)

---

## Founder stage

**Enabler.** P0 answers no founder question directly — it makes every later question *safe to answer*. Production auto-deploys from `main` onto production Neon; velocity without gates is a trust liability. P0 buys the right to iterate quickly without breaking production.

## Goal

A **stable, observable, safe-to-iterate platform**: gated CI, tested rollback, and enough observability that we can deploy on merchant-facing days without fear.

## Primary KPI

**Green pipeline · MTTR · p95 held.**
- CI pipeline is required and green on `main` (no direct-to-prod without passing gates).
- A rollback has been *executed in a drill*, not just documented — MTTR measured.
- p95 latency on core read paths holds under the current load envelope (baseline captured).

## Capabilities activated

- **CAP-01 Launch Foundation** — CI/CD gates, observability, environments, release process.
- **CAP-07 Platform Services** — logging/metrics, error handling, config, health.
- **CAP-02 Marketplace Core (harden)** — no new marketplace surface; harden what already runs LIVE.

## Kill Criteria (APP-001 §4.3)

| ✅ Success — advance to P1 | 🛑 Failure — stop & investigate |
|---|---|
| Gated CI green on `main`; tested (drilled) rollback; observability live | **Can't deploy safely after 2 weeks** → fix the foundation before *any* feature work |

If the 🛑 line is crossed, P1 does not start. This is not "push harder" — it is stop, fix the base, resume.

## Alignment check (APP-001 §9 — the binding rule)

| Requirement | This phase |
|---|---|
| Mapped to a business milestone | Enabler for Stage 1 (P1 Merchant Acquisition) — nothing ships to merchants on an ungated pipeline |
| Measurable KPI | Green pipeline · MTTR · p95 (above) |
| Launch objective | Safe-to-iterate platform before the beachhead (physiotherapists) onboards |

P0 is the one phase whose "feature" is *the ability to ship features safely.* Every later phase rides on it.

## Exit criteria → see [`acceptance.md`](acceptance.md)

## Change control

- Architecture/tooling decisions in P0 (CI provider, observability stack, rollback mechanism) that are hard to reverse → raise an **ECR** (`docs/ENGINEERING_CHANGE_REQUEST.md`); log the reference in [`risks.md`](risks.md).
- Nothing in P0 changes product scope; if it does, **stop and raise a POCR** (`docs/PRODUCT_OFFICE_CHANGE_REQUEST.md`).
