# P0 · Launch Foundation — Open Risks & Change References

> Living document. Add risks as they surface; log every ECR/POCR raised during P0 here.

## Open risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **`main` auto-deploys to production Neon.** Any merge/push to `main` is a live prod event — a bad merge ships instantly. | Med | High | This is *the* reason P0 exists. Gate `main` behind required CI; branch-protect; drill rollback before relying on it. Until gated, treat every `main` change as a deploy needing explicit human go. |
| R2 | **Baseline lives on a branch, `main` is behind.** `main` @ `c38e811` predates the Sprint 1/2 code and the governance docs; the P0 work assumes `engineering-baseline-p0`. | High | Med | Reconcile branches into `main` deliberately (CPO decision, pending) *before* P0 exit — the gate must protect the branch that actually deploys. |
| R3 | **CI exists but may not be required / branch-protected.** A green pipeline that isn't enforced gates nothing. | Med | High | Make the check required on the prod branch; verify a failing pipeline actually blocks merge. |
| R4 | **Rollback is documented but never drilled.** Untested rollback = false confidence; MTTR unknown. | Med | High | Execute a rollback drill in a safe window; record MTTR in [`acceptance.md`](acceptance.md). |
| R5 | **p95 has no baseline.** Without a captured baseline, we can't tell if a later phase regresses latency. | High | Low→Med | Capture p95 on core read paths early in P0. |
| R6 | **Secret / config drift.** Prod secrets or config could leak into the repo or diverge across environments. | Low | High | Audit for leaked secrets; confirm `.env` ignored (done); document required env vars without values. |

## ECR references (how — architecture)

Raised under `docs/ENGINEERING_CHANGE_REQUEST.md`. Any hard-to-reverse P0 tooling choice (CI provider, observability stack, rollback mechanism, branch strategy for prod) belongs here.

| ECR | Title | Status |
|---|---|---|
| — | (none yet) | — |

## POCR references (what — product/governance)

Raised under `docs/PRODUCT_OFFICE_CHANGE_REQUEST.md`. P0 should raise **none** — if a P0 change touches product scope, that's the signal to stop and escalate.

| POCR | Title | Status |
|---|---|---|
| — | (none — P0 must not alter product scope) | — |
