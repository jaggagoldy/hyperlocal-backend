# P0 · Launch Foundation — Exit Criteria (the gate)

> P0 does not advance to P1 until **every** criterion below is objectively true and the Kill Criteria (APP-001 §4.3) return ✅. Phases are gates, not a schedule.

## Exit criteria

| # | Criterion | Measure | Met? |
|---|---|---|---|
| E1 | CI is **required** on the production-deploying branch | A PR with a failing pipeline cannot merge (demonstrated) | ☐ |
| E2 | CI is **green** on that branch | Latest pipeline passing; no skipped critical suites | ☐ |
| E3 | Critical-path tests present & passing | auth, business-ownership, media, search, superadmin, release registry suites green | ☐ |
| E4 | Rollback **drilled**, not just documented | One rollback executed in a safe window; **MTTR recorded** below | ☐ |
| E5 | Observability live | Structured logs queryable; health endpoint returns; errors surface to a place a human sees | ☐ |
| E6 | p95 **baseline captured** on core read paths | Numbers recorded below; regression alarm threshold set | ☐ |
| E7 | Prod/local separation & secret hygiene confirmed | No secrets in repo; required env vars documented (no values) | ☐ |
| E8 | The branch that CI protects **is** the branch that deploys | `main` reconciliation resolved (R2); gate protects the deploying branch | ☐ |

## Kill Criteria verdict (record at phase close)

- ✅ **Advance to P1** if: gated CI green + rollback drilled + observability live (E1–E8 met).
- 🛑 **Stop & investigate** if: *can't deploy safely after 2 weeks* → fix the foundation before any P1 feature work.

**Verdict:** _pending_

## Measurements (fill during the phase)

- **MTTR (rollback drill):** _tbd_
- **p95 baseline (core read paths):** _tbd_
- **CI pipeline duration:** _tbd_

---

*When every box is ticked and the verdict is ✅, close the phase by writing [`retro.md`](retro.md) and open `releases/P1/`.*
