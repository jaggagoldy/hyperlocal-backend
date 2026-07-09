# ECR-2026-001 — CI enforcement & production branch protection

```
ECR-ID:            ECR-2026-001
Title:             Make CI a required gate on the production-deploying branch
Raised by:         Engineering Director (P0 execution)
Date:              2026-07-09
Status:            Under Review
```

## 1. Technical change

- **Area:** CI/CD, repository configuration, branch strategy.
- **Type:** infra.
- **Current approach:** `.github/workflows/test.yml` runs `npm test` on push to `main` and on all PRs, but the check is **advisory** — nothing prevents a red or missing pipeline from merging/deploying. `main` auto-deploys to production Neon on push. The current baseline code lives on `engineering-baseline-p0`, *not* `main` (`main` @ `c38e811` predates it).
- **Proposed approach:**
  1. Reconcile the P0 baseline into `main` deliberately (see §3 — this is the prod-affecting step, gated on CPO/founder go-ahead).
  2. Enable **branch protection** on `main`: require the `Test` status check to pass before merge; require PRs (no direct pushes); require branches up to date.
  3. `main` remains the single production-deploying branch (Render auto-deploy). The branch CI protects and the branch that deploys become **the same branch** (satisfies E8).

## 2. Why (all required)

- **Problem:** Production auto-deploys from an ungated branch. A red or absent pipeline can ship a broken build to production instantly. This is risk **R1/R3** in `releases/P0/risks.md`.
- **Phase supported:** P0 — Launch Foundation.
- **KPI / foundation:** Green pipeline (E1/E2) and "CI protects the deploying branch" (E8). Directly protects the Primary KPI *green pipeline · MTTR · p95*.
- **Scope check:** Confirms **NO** change to product scope/priorities/Kill Criteria. Y.

## 3. Impact & risk

- **Reversibility:** hard (branch protection is easy to toggle, but the `main` reconciliation is a real production deploy — one-way in effect).
- **Blast radius:** the entire production deployment; every future merge to `main`.
- **Data migration:** none (governance/config only; no schema change).
- **Rollback plan:** branch protection can be disabled instantly; the code reconciliation is covered by ECR-2026-002 (deploy rollback).
- **Risk if approved:** merging `engineering-baseline-p0` → `main` triggers a production deploy of the Sprint 1/2 baseline. Must be done in a controlled window with the rollback runbook ready.
- **Risk if NOT done:** E1/E2/E8 cannot be satisfied; production stays deployable from an ungated branch — the exact liability P0 exists to remove.

## 4. Decision

- **Reviewed by (Eng Director):** _pending_
- **Decision:** _pending_ — **the `main` reconciliation requires explicit founder/CPO go-ahead because it is a production deploy.**
- **Rationale:** _tbd_
- **Recorded in release entry:** `releases/P0/` (E1, E2, E8); risks R1/R2/R3.

> **Note:** enabling GitHub branch protection is a repository-admin action. It is prepared here but **not executed** by engineering without authorization, because it changes repository access controls and depends on the prod-affecting `main` reconciliation.
