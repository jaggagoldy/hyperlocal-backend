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
| R6 | **Secret / config drift.** Prod secrets or config could leak into the repo or diverge across environments. | Low | High | ✅ Addressed: audited (no hardcoded secrets), `.env` ignored & untracked, `.env.example` documents required vars without values, `dbMode` surfaces host only. |
| R7 | **Lint is broken.** `npm run lint` fails — eslint 10 needs a flat `eslint.config.js` and none exists. | High | Low | CI runs `npm test` only, so the pipeline is unaffected. Not a P0 exit criterion. Follow-up: add a flat eslint config and (optionally) a non-blocking lint job before wiring it into the required gate. |
| R8 | **Prod demo accounts with a weak shared password.** The production DB contains demo logins (`@nbb-demo.test`, shared `12345678`, tagged `metaData.isDemo=true`) — real working prod credentials. Surfaced by the Engineering Baseline Audit. | Med | Med | ✅ Repo exposure removed (P0.1): root credential files deleted; sanitized [`docs/examples/DEMO_ACCOUNTS.md`](../../docs/examples/DEMO_ACCOUNTS.md) documents the convention with no passwords. **Open (pre-public-launch, gated):** remove the demo accounts + retire the password on prod via `scripts/remove-prod-demo.cjs` — a prod-data action needing founder go-ahead. **Not** a P0 development blocker. |

## ECR references (how — architecture)

Raised under `docs/ENGINEERING_CHANGE_REQUEST.md`. Any hard-to-reverse P0 tooling choice (CI provider, observability stack, rollback mechanism, branch strategy for prod) belongs here.

| ECR | Title | Status | Covers |
|---|---|---|---|
| [ECR-2026-001](../../docs/ecr/ECR-2026-001-ci-enforcement-branch-protection.md) | CI enforcement & production branch protection | Under Review | E1, E2, E8; R1, R2, R3 |
| [ECR-2026-002](../../docs/ecr/ECR-2026-002-rollback-mechanism.md) | Rollback mechanism & drill | Under Review | E4; R4 |
| [ECR-2026-003](../../docs/ecr/ECR-2026-003-prisma-migrations.md) | Adopt Prisma Migrate (replace db push) | Under Review | E4 (schema reproducibility & rollback) |

## POCR references (what — product/governance)

Raised under `docs/PRODUCT_OFFICE_CHANGE_REQUEST.md`. P0 should raise **none** — if a P0 change touches product scope, that's the signal to stop and escalate.

| POCR | Title | Status |
|---|---|---|
| — | (none — P0 raised no product-scope changes) | — |
