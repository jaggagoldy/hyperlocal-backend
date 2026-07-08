# P0 · Launch Foundation — Scope

> Companion to [`release.md`](release.md). Scope is fixed at phase entry; scope changes route through an ECR (how) or POCR (what).

## In scope

Each item names the **KPI it serves** (Alignment Rule, APP-001 §9). "Status" reflects the engineering baseline captured on `engineering-baseline-p0`.

| # | Item | Serves KPI | Status at entry |
|---|---|---|---|
| 1 | **Required, green CI gate on `main`** — no merge to the prod-deploying branch without a passing pipeline | Green pipeline | Partial — `.github/workflows/test.yml` exists (test suites landed); needs to be *required* + branch-protected |
| 2 | **Test coverage on critical paths** — auth, business ownership, media, search, superadmin, release registry | Green pipeline | Partial — `__tests__/` suites exist across modules; measure & close gaps |
| 3 | **Tested rollback** — a documented *and drilled* rollback of a bad deploy; measure MTTR | MTTR | Not started — procedure in `docs/RELEASE_MANAGEMENT.md`; drill it |
| 4 | **Observability** — structured logging (pino present), error surfacing, health endpoint, minimal metrics/latency capture | p95 held | Partial — pino logging LIVE; add health/latency baseline |
| 5 | **Environment hygiene** — confirm prod (Neon) vs. local separation; no prod secrets in repo; `.env` git-ignored | (safety) | Partial — `.env` ignored; audit for leaked secrets & config drift |
| 6 | **Harden CAP-02 marketplace core** — no new surface; fix any correctness/perf issue in the already-LIVE paths surfaced by tests | p95 held | Ongoing |
| 7 | **p95 baseline** — capture current latency on core read paths so regressions are visible | p95 held | Not started |

## Out of scope (explicit non-goals for P0)

- ❌ **No new merchant-facing or customer-facing features** — that is P1+. P0 hardens; it does not add surface.
- ❌ **No new capabilities beyond CAP-01/07 and hardening CAP-02.**
- ❌ **No schema redesign or data migration** unless a P0 correctness fix demands it — and then only via an **ECR**.
- ❌ **No storefront polish** (the paused Sprint-1 template task is retired, not resumed).
- ❌ **No monetization, discovery breadth, reviews, or expansion work** — those are gated phases P1–P7.

## Dependencies

- Runs on the code captured in `engineering-baseline-p0` (Sprint 1/2 baseline + governance instruments).
- Prod auto-deploys from `main`; any change to `main` is a production event (see [`risks.md`](risks.md)).
