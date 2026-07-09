# ECR-2026-002 — Rollback mechanism & drill

```
ECR-ID:            ECR-2026-002
Title:             Define and drill the production rollback mechanism
Raised by:         Engineering Director (P0 execution)
Date:              2026-07-09
Status:            Under Review
```

## 1. Technical change

- **Area:** Deployment / operations (Render + Neon).
- **Type:** infra.
- **Current approach:** Release JSON files carry free-text `internal.rollbackNotes`, but there is **no drilled, measured rollback procedure**. MTTR is unknown.
- **Proposed approach:** adopt a two-layer rollback, documented and drilled in `releases/P0/rollback-runbook.md`:
  1. **Code rollback (primary):** Render "Rollback to previous deploy" (or redeploy the last-good commit). Fast, no data implications for a code-only change.
  2. **Data rollback (only if a migration shipped):** Neon point-in-time restore / branch. Slower; used only when a bad deploy included a schema/data migration.
  - **Trigger + decision rule:** who declares a rollback, on what signal (health degraded, error-rate spike, failed smoke check), and which layer to use.
  - **MTTR measured** in a drill and recorded in `releases/P0/acceptance.md`.

## 2. Why (all required)

- **Problem:** An untested rollback is false confidence; MTTR is unmeasured (risk **R4**). P0 requires a *drilled* rollback (E4).
- **Phase supported:** P0 — Launch Foundation.
- **KPI / foundation:** MTTR (part of the Primary KPI). E4.
- **Scope check:** Confirms **NO** change to product scope/priorities/Kill Criteria. Y.

## 3. Impact & risk

- **Reversibility:** easy (this defines a procedure; it changes no code paths).
- **Blast radius:** operational only; the drill itself must run in a safe window.
- **Data migration:** none by default; the runbook covers the migration case explicitly.
- **Rollback plan:** n/a (this *is* the rollback plan).
- **Risk if approved:** the drill must be executed against a real (or staging) deploy to measure MTTR; doing it against prod needs a safe window + go-ahead.
- **Risk if NOT done:** no proven way to recover from a bad deploy; E4 unmet; MTTR unknown.

## 4. Decision

- **Reviewed by (Eng Director):** _pending_
- **Decision:** _pending_ — runbook prepared; **executing the drill against production requires a safe window + go-ahead.**
- **Rationale:** _tbd_
- **Recorded in release entry:** `releases/P0/` (E4); risk R4; runbook `releases/P0/rollback-runbook.md`.
