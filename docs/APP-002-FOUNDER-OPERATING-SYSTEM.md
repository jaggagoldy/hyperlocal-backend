# APP-002 — NearByBazar Founder Operating System

> **Document class:** Operating discipline (non-engineering)
> **Status:** ✅ **Approved — Product Office Baseline v1.0** (frozen). Changes require an approved POCR — see `docs/PRODUCT_OFFICE_CHANGE_REQUEST.md`.
> **Owner:** Founder / CEO
> **Companion to:** APP-001 (engineering execution) and APP-003 (90-day launch playbook)
> **Purpose:** In an early-stage marketplace, **founder execution determines success more than engineering quality.** This document is the operating system for the *company* — the rhythms, metrics, and trigger-based decisions that keep the business growing with the same discipline as the product.

This is not a plan of what to build. It answers: *What do I do every Monday? Which numbers matter this week? When do I hire? When do I expand? When do I charge? When do I stop building and start selling?*

---

## 0. First principles

1. **One question at a time.** The company is always answering exactly one Founder Roadmap question (APP-001 §4.1). Everything not serving it is a distraction.
2. **Talk to humans daily.** Pre-PMF, the founder's highest-leverage activity is direct contact with merchants and customers — not dashboards, not code review.
3. **Triggers, not calendars.** Hiring, expansion, and monetization happen when a *condition* is met, never because "it's time."
4. **Build less, sell more.** Every week not spent talking to the market is a week of assumptions compounding. When in doubt, sell.
5. **Kill Criteria are sacred.** If a phase crosses its failure line (APP-001 §4.3), the founder's job is to stop the roadmap and investigate — publicly, in writing.

---

## 1. The operating cadence

### Every Monday — the Founder Monday (90 minutes, non-negotiable)

The week starts by looking at reality, not the roadmap.

| Block | Time | What happens |
|---|---|---|
| **1. Read the scorecard** | 15 min | Pull last week's numbers into the Weekly Scorecard (§2). No narration — just the numbers. |
| **2. Kill-Criteria check** | 10 min | For the *current phase only*: are we tracking toward Success or toward the Stop line? One word: `advancing` / `flat` / `stopping`. |
| **3. Merchant & customer voice** | 20 min | Read every piece of qualitative feedback from last week (calls, WhatsApp, support). Extract the top 3 recurring pains. |
| **4. Decide the ONE thing** | 15 min | Name the single most important outcome for the week. Everything else is secondary. |
| **5. Set the sell/build split** | 10 min | Decide this week's ratio of *selling* (talking to market, onboarding, closing) vs *building*. Pre-PMF default is 70/30 toward selling. |
| **6. Write the Monday Note** | 20 min | One short written note: last week's number, this week's one thing, sell/build split, any Kill-Criteria concern. Shared with the whole team. |

### Every day (pre-PMF)

- **Talk to at least one merchant and one customer.** Log it. This is the founder's real job in P1–P5.
- **Clear the merchant/customer inbox** — no lead, message, or complaint older than 24 hours.
- **Note one thing that surprised you.** Surprises are where PMF hides.

### Every Friday — the Weekly Close (30 min)

- Update the scorecard with the week's actuals.
- Answer in writing: *Did we move the ONE thing? Why or why not?*
- Log every decision made this week in the Decision Journal (§5).

### Monthly — the Phase Review (90 min)

- Score the current phase against its Kill Criteria formally.
- Decide: **Advance / Hold / Stop-and-investigate.**
- If advancing, formally "open" the next phase in APP-001 and the release registry.
- Revisit hiring/expansion/monetization triggers (§3, §4, §6) — are any now tripped?

---

## 2. The metrics that matter (one North Star per phase)

Pre-PMF, watching many metrics is a form of hiding. Each phase has **one North Star** and **two guardrails**. Everything else is diagnostic, not decisional.

| Phase | North Star (the one number) | Guardrail 1 | Guardrail 2 |
|---|---|---|---|
| **P0 Foundation** | Deploy safely (change-failure rate) | p95 latency | MTTR |
| **P1 Merchant Acquisition** | # active merchants | Onboarding completion % | Profile completion % |
| **P2 Merchant Success** | # quality leads delivered / week | % merchants with ≥1 lead | Merchant response rate |
| **P3 Customer Discovery** | Search → Contact conversion | Searches-with-results (coverage) | Weekly active searchers |
| **P4 Trust Layer** | Contact → Connection conversion | Verified-profile % | Genuine reviews / week |
| **P5 Retention** | Weekly repeat rate (both sides) | Merchant WAU/MAU | Customer return rate |
| **P6 Expansion** | Time-to-liquidity in new area | New-area merchant count | New-area conversion |
| **P7 Merchant SaaS** | Paid-tier conversion % | MRR | Paying-merchant churn |

**Rule:** if the founder can't recite this week's North Star number from memory, the company has lost focus.

### The Weekly Scorecard (template)

```
Week of: __________            Phase: P__   Status: advancing / flat / stopping

NORTH STAR .............. ____  (target ____)   Δ vs last week: ____
Guardrail 1 ............. ____
Guardrail 2 ............. ____

Merchants talked to: __    Customers talked to: __
Top 3 pains this week:
  1. ______________________
  2. ______________________
  3. ______________________

The ONE thing last week: ______________  → done? Y / N, why: ______
The ONE thing this week: ______________
Sell / Build split this week: __ / __

Kill-Criteria concern? ______________________________________
```

---

## 3. Hiring triggers (trigger-based, never calendar-based)

Hire only when a specific bottleneck is provably costing the North Star. First principle: **the founder does every job manually before hiring for it.** You cannot hire for a job you haven't done.

| Role | Trigger to hire (all must be true) | Do NOT hire if |
|---|---|---|
| **First salesperson** | (a) Founder has personally onboarded ≥30 merchants and knows the pitch cold; (b) onboarding is the proven bottleneck to the P1 North Star; (c) a repeatable script + funnel exists. | You can't yet articulate why merchants say yes. Hiring sales to *discover* the pitch fails. |
| **First support/ops** | (a) Inbox/lead-response SLA is slipping past 24h because of volume, not process; (b) >~50 active merchants generating recurring ops load; (c) the work is documented enough to hand off. | The load is a product gap you could fix in code instead. |
| **First operations lead** | (a) You are running P6 expansion and need the first area to run without you; (b) the first-area playbook is written and repeatable. | You haven't proven the model in area one (that's a P5/P6 gate). |
| **First engineer beyond core** | A capability on the critical path (APP-001 §3) is starved and it's blocking a phase North Star. | The backlog is "nice to have" features unmapped to a phase (violates the Alignment Rule). |

**Sequence, in practice:** founder does everything → first *sales/growth* hire (supply is the first bottleneck) → first *support/ops* hire (load follows supply) → first *ops lead* (only at expansion) → additional engineers as critical-path phases demand.

---

## 4. Expansion trigger (when to open a second neighbourhood)

Do **not** expand geography to escape a struggling first area — that just multiplies a broken model.

**Open a second neighbourhood only when ALL are true:**
1. The first area has **passed P5 Kill Criteria** — both merchants and customers return organically (PMF signal).
2. There is a **written, repeatable launch playbook** (APP-003) that another person could run.
3. Unit economics in the first area are understood (CAC, activation, retention).
4. There is an **operations owner** who can run the first area without the founder.

If any is false, the answer is *stay and deepen area one.* Expansion is replication of a proven model, not a search for one.

---

## 5. The Decision Journal (governance ritual)

A one-line-per-decision log, reviewed monthly. Prevents silent drift and makes Kill-Criteria calls honest.

```
Date | Decision | Phase | Bet / hypothesis | How we'll know we were right | Revisit-by
```

Every **Advance / Hold / Stop** call from the Phase Review goes here. Reviewing it monthly turns hindsight into a system.

---

## 6. Build-vs-Sell balance & the "stop building" triggers

The most common early-stage failure is **building through weak signal** — shipping features to feel productive while the market stays silent.

**Stop building and go sell when any is true:**
- The current phase's North Star is **flat for 2+ weeks** while engineering keeps shipping. (The problem isn't the product — it's distribution or fit. Code won't fix it.)
- You are adding a feature that **isn't mapped** to the current phase's milestone + KPI (violates the Alignment Rule — APP-001 §9).
- You cannot name **three merchants or customers** who explicitly asked for what you're about to build.
- Onboarding/activation is the bottleneck but you're building something downstream of it.

**When to start charging (monetization trigger):**
- Only at **P7**, and only after **P5 retention** is confirmed. Charging is permitted when merchants are *already* getting value they would miss if it disappeared — evidenced by organic return (P5), not by survey intent.
- Never monetize to validate demand. Monetize to capture value that already exists.

**When to stop building and start selling (the meta-rule):**
> If retention (P5) is confirmed and the roadmap wants to *add* rather than *distribute*, shift the sell/build split hard toward selling. Growth at PMF is a distribution problem, not a product problem.

---

## 7. Founder anti-patterns (watch for these)

- **Dashboard hiding** — watching metrics instead of talking to people.
- **Roadmap momentum** — advancing phases because the plan says so, ignoring a flat North Star.
- **Premature scaling** — hiring, expanding, or monetizing before P5 retention.
- **Feature comfort** — building because building is knowable and selling is scary.
- **Ignoring the Stop line** — treating Kill Criteria as suggestions. They are the point.
- **Vanity supply** — counting listings instead of *active* merchants receiving leads.

---

## 8. How this connects to the rest of the Product Office

- **APP-001** tells engineering *what* to build and *in what order* (phases, capabilities, Kill Criteria).
- **APP-002** (this doc) tells the founder *how to run the company* around that roadmap.
- **APP-003** tells everyone *how to execute the first 90 days* concretely.
- The **release registry** (`releases/*.json`) is the shared audit trail: every release names its phase, KPI, and Kill Criteria, closing the loop from founder decision → engineering work → measured outcome.

> The product and the company must grow with the same discipline. APP-001 gives the product its discipline; APP-002 gives the company its discipline.

---

*End of APP-002.*
