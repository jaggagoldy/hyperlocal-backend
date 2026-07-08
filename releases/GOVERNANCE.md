# Release Governance — Phase Dossiers

> **Status:** ✅ Active governance instrument — Engineering Execution
> **Owner:** Engineering Director
> **Established:** 2026-07-08 (Product Office Baseline v1.0 freeze → P0 entry)

This directory now holds **two distinct artifacts**. Do not confuse them.

| Artifact | Path | Axis | Consumed by | Purpose |
|---|---|---|---|---|
| **Release Registry** | `releases/*.json` | Semver deploys (`1.0.0`, `1.1.0`, …) | **Code** — `src/modules/releases/` at runtime (`/whats-new`, internal tooling) | Machine-readable record of *what shipped to production* |
| **Phase Dossiers** | `releases/P0/`, `releases/P1/`, … | Roadmap phases (`P0`–`P10`, APP-001 §4.2) | **Humans** — the engineering audit trail | Governance record of *why we built a phase and whether it passed its gate* |

The registry loader (`release.service.js`) reads **only top-level `*.json`** and never recurses, so the `P*/` folders are invisible to it. They coexist safely.

A single semver release (e.g. `1.2.0-customer-discovery.json`) is one *deployment* inside a phase. A phase dossier (e.g. `P3/`) is the *governance envelope* around all the deployments that answer that phase's founder question.

---

## The dossier standard

Every phase folder (`releases/P<n>/`) is opened **when the phase is entered** and closed **when its Kill Criteria are evaluated**. Each contains:

| File | When written | Contents |
|---|---|---|
| `release.md` | Phase entry | Master dossier: founder stage, goal, **Primary KPI**, **Kill Criteria** (✅ success / 🛑 failure), capabilities activated, alignment check, links to the files below |
| `scope.md` | Phase entry | In-scope / out-of-scope, features mapped to APP-001, explicit non-goals |
| `risks.md` | Living | Open risks, mitigations, and **ECR / POCR references** raised during the phase |
| `acceptance.md` | Phase entry | Objective, testable **Exit Criteria** — the gate that must pass to advance |
| `retro.md` | Phase close | What happened vs. the KPI, Kill-Criteria verdict, decision to advance / hold / stop, lessons |

Release notes for anything that actually ships live in the **semver registry** (`releases/*.json`), not the dossier — the dossier `retro.md` links to the registry versions that shipped under it.

---

## The rules (binding)

1. **No phase starts without a dossier.** `release.md` + `scope.md` + `acceptance.md` exist before the first line of phase code is written.
2. **The Alignment Rule applies** (APP-001 §9): every scope item names its phase, a measurable KPI, and a launch objective. If it maps to none, it does not get built yet.
3. **Phases are gates, not a schedule.** A phase does not advance until `acceptance.md` passes and Kill Criteria return ✅. If the 🛑 line is crossed, work **stops** — investigate, fix the foundation, then resume (APP-001 §4.3).
4. **Governance changes route correctly.** A change to *what* a phase is (KPI, Kill Criteria, scope of the roadmap) needs a **POCR**. A change to *how* we build it (architecture, schema, migration) needs an **ECR**. Both are referenced in `risks.md`.
5. **Dossiers are append-only history.** Close a phase by writing `retro.md`; never rewrite a closed phase's record.

---

*The semver registry keeps the **deployments** honest. The phase dossiers keep the **roadmap** honest. Together they are the engineering audit trail: six months from now, anyone can trace any line of shipped code back to the founder question it was meant to answer, and the evidence that it did.*
