# APP-003 — NearByBazar Launch Execution Playbook

> **Document class:** Go-to-market execution (the concrete 90-day plan)
> **Status:** ✅ **Approved — Product Office Baseline v1.0** (frozen). Changes require an approved POCR — see `docs/PRODUCT_OFFICE_CHANGE_REQUEST.md`.
> **Owner:** Founder / CEO, with the whole team
> **Companion to:** APP-001 (engineering phases + Kill Criteria) and APP-002 (founder operating cadence)
> **Scope:** The detailed path from **0 merchants → first repeat customers** — i.e. Founder Roadmap Stages 1–6 (APP-001 §4.1), executed as engineering phases **P0 → early P5**.

This is the "do things that don't scale" document. The first 90 days are won by hand, in one neighbourhood, in one vertical — not by building broad features.

---

## 0. The beachhead (the single most important decision)

A marketplace reaches liquidity fastest when it is embarrassingly narrow at the start.

| Dimension | Launch choice | Why |
|---|---|---|
| **Vertical** | **Physiotherapists** (single vertical) | High-intent, high-value local demand; clear "need → find → contact" journey; underserved by generic search; per the CPO's stated P1 KPI ("50 active physiotherapists"). |
| **Geography** | **One neighbourhood / one city** — selected against the criteria below | Density beats breadth — 50 merchants in one area create real liquidity; 50 scattered across a state create none. |
| **Demand side** | Local residents needing physio (back/knee/sports/post-op recovery) | Concrete, urgent, repeat-capable need. |

**Launch Area Selection Criteria** *(this is the durable Product Office principle — geography is chosen against these, not frozen by name)*

The initial launch geography must:
- Be **accessible to the founder** for frequent in-person engagement.
- Have **sufficient concentration** of the chosen merchant category (physiotherapists).
- Be **small enough to achieve meaningful local density** with ~50 merchants.
- Have **low operational cost** to serve.
- Allow **rapid iteration** through direct merchant and customer feedback.

> **Current planned launch area:** **Hisar** — this is an *operational decision* (it fits the criteria above and matches the current data focus) and **may change without modifying the Product Office**. Only the vertical (physiotherapists) and the selection criteria are part of the frozen baseline. Confirm the operational area before Day 0.

**Rule for the whole 90 days:** if a task doesn't add a physio in the launch area or bring a customer to one, it waits.

---

## 1. The 90-day shape

| Days | Phase | Goal | Exit gate (Kill Criteria) |
|---|---|---|---|
| **0–14** | P0 + P1 start | Platform safe to iterate; first 10 merchants onboarded **by hand** | 10 real physios live, profiles complete |
| **15–45** | P1 → P2 | Reach **50 active physios**; deliver first **quality leads** | ≥50 active, ≥80% onboarding completion, ≥1 successful connection/active merchant |
| **46–75** | P3 → P4 | Customers **discover** and **trust**; search→contact works | Search→contact conversion clears target; genuine reviews appearing |
| **76–90** | early P5 | First **repeat** merchants and customers | Both sides return without paid nudges |

Each block below is week-by-week with an owner, the KPI, the concierge tactic, and the Stop-check.

---

## 2. Days 0–14 — Foundation + first 10 by hand

**Goal:** prove the onboarding-to-storefront-to-lead loop works for *one* real merchant, then repeat it 10 times manually.

### Week 1 — Make it safe, then go outside
- **Engineering (P0):** lock CI gates, tested rollback, error tracking, health/observability. *No new features.* (APP-001 P0.)
- **Founder:** build the physio target list for the launch area — walk/call clinics, note names, phones, whether they're already findable online. Aim for a list of 60–80 to yield 50.
- **Concierge tactic:** onboard the **first 3 physios sitting next to them** — you fill the profile, upload photos, set hours, publish the storefront live on the call. Watch every point of friction.
- **KPI:** 3 merchants live. **Stop-check:** if you can't onboard a willing merchant in <15 min with them present, fix onboarding before scaling outreach.

### Week 2 — Repeat the motion to 10
- **Founder + first growth helper:** onboard 7 more by hand, same concierge motion. Refine the pitch and the onboarding script each time.
- **Engineering:** fix the top 3 onboarding-friction items observed in Week 1 (nothing else).
- **Instrumentation:** confirm `LeadAnalytic` (profile view / call / WhatsApp) fires; confirm onboarding-funnel events exist (CAP-08 analytics baseline).
- **KPI:** 10 active physios, 100% profile completion. **Stop-check:** if profiles sit incomplete, the product is asking for too much — cut fields.

---

## 3. Days 15–45 — To 50 merchants + first quality leads

**Goal:** hit the P1 North Star (50 active) *and* prove P2 (merchants get real leads). Supply and its first payoff, together.

### Weeks 3–5 — Scale supply to 50
- **Founder/growth:** run the now-repeatable onboarding motion daily. Sources: direct clinic visits, physio WhatsApp/associations, referrals from onboarded physios ("know two others?").
- **Concierge tactic:** for every merchant, personally verify the listing and send them their live storefront link to share with their own patients — instant proof of value.
- **KPI:** climbing toward 50 active; onboarding completion ≥80%.
- **Stop-check (P1 Kill Criteria):** *<20 merchants after 60 days, or <40% onboarding completion → STOP.* Investigate whether the vertical/area or the pitch is wrong.

### Weeks 5–6 — Manufacture the first leads (P2)
Demand isn't organic yet, so **generate the first leads by hand** to prove the loop:
- **Concierge demand:** the founder personally drives the first customers to merchants — local community groups, WhatsApp, a simple "find a physio near you" post pointing at storefronts; where needed, hand-match a patient inquiry to a physio and watch the connection happen.
- **Notifications (CAP-07):** ensure a merchant is instantly notified of a lead (call/WhatsApp/enquiry) and can respond — this is the P2 value moment.
- **KPI (P2 North Star):** ≥1 successful connection per active merchant; % merchants with ≥1 lead.
- **Stop-check (P2 Kill Criteria):** *<30% of merchants get any lead in 30 days → STOP.* The value prop is unproven; do not build discovery breadth on top of it.

---

## 4. Days 46–75 — Customer discovery + trust

**Goal:** turn hand-fed demand into *self-serve* discovery, and make it convert by adding trust.

### Weeks 7–9 — Discovery that converts (P3)
- **Engineering (P3):** the discovery engine already exists (`/discover`, ranking, autocomplete). Focus on the *physio* journey: category landing (`/c/physiotherapists`), locality pages, capability-aware CTAs (Book / Call / Enquire).
- **Demand tactics:** local SEO for "physiotherapist near me / in [area]", community seeding, referral link from each storefront.
- **KPI (P3 North Star):** Search → Contact conversion; coverage (searches-with-results).
- **Stop-check (P3 Kill Criteria):** customers search but don't contact → discovery UX or supply density is wrong; fix before widening.

### Weeks 9–11 — Trust layer (P4)
- **Engineering (P4):** surface **verification** on physio profiles; turn on **reviews** now that there's real interaction volume — request a review after each successful connection (only genuine, interaction-anchored reviews).
- **Ops (CAP-05):** stand up a light moderation path for reviews/reports before opening the floodgates.
- **KPI (P4 North Star):** Contact → Connection conversion lift from verified profiles + reviews.
- **Stop-check (P4 Kill Criteria):** reviews add no conversion lift, or abuse outpaces moderation → pause and harden trust.

---

## 5. Days 76–90 — First repeats (early P5)

**Goal:** the PMF signal — both sides come back **without** being pushed.

### Weeks 12–13 — Retention loops
- **Merchant retention:** weekly "your storefront this week" digest (views, leads, connections) so the merchant sees ongoing value and logs in; nudge profile/media updates.
- **Customer retention:** enable **save/favourite a physio** and a simple return path ("your saved physios"); post-connection follow-up.
- **Lifecycle (CAP-06):** minimal, event-driven messaging only — no campaign machinery yet.
- **KPI (P5 North Star):** weekly repeat rate on **both** sides (merchants returning; customers returning/booking again).
- **Stop-check (P5 Kill Criteria):** *neither side returns organically → NO PMF.* Do not expand, do not monetize. Return to P2–P4 and fix the value loop.

---

## 6. Instrumentation checklist (what must be measured, by phase)

Liquidity is invisible without events. Stand these up *before* the phase that needs them (CAP-08 analytics — measurement only, no ranking work yet).

| Phase | Must be tracked | Source |
|---|---|---|
| P1 | Onboarding funnel steps, activation, profile completion | onboarding events, `BusinessProfile` |
| P2 | Leads by type, per merchant; response; successful connection | `LeadAnalytic`, order/enquiry lifecycle |
| P3 | Searches, searches-with-results, search→contact | `SearchAnalytic`, discovery events |
| P4 | Verified %, reviews created, contact→connection | `VerificationStatus`, `Review` |
| P5 | Merchant WAU/MAU, customer return rate, repeat connections | session + event pipeline |

**Do not build funnel dashboards before the events are clean** (APP-001 tech-debt note: standardize the event taxonomy first).

---

## 7. Team & channels for the 90 days

- **Merchant acquisition channel:** direct/field (clinics), physio networks, referrals — *high-touch, founder-led.* This is the growth engine in P1–P2; paid acquisition is explicitly out of scope until retention (P5) proves the funnel isn't leaky.
- **Demand channel:** local community + SEO on the physio category, storefront sharing loops.
- **Team:** founder-led throughout; the first **sales/growth helper** enters only when the onboarding motion is proven and repeatable (APP-002 §3 hiring trigger), typically mid-P1.

---

## 8. Exit criteria — when the 90 days "succeed"

The launch is a success (and P5 → P6 becomes considerable) when, in the single launch area:
1. **≥50 active physios**, ≥80% onboarding completion. *(P1)*
2. **≥1 successful connection per active merchant**, ≥30% get leads. *(P2)*
3. **Search→contact conversion** clears its target with healthy coverage. *(P3)*
4. **Verified profiles + genuine reviews** measurably lift conversion. *(P4)*
5. **Both sides return organically** — the first repeat merchants and repeat customers. *(early P5)*

Only after (5) does APP-002's **expansion trigger** (§4) unlock a second neighbourhood, and only after retention holds does the **monetization trigger** (P7) come into view.

> If the 90 days end without (5), that is not failure — it is the signal to **stop, investigate, and fix the value loop** in the same area rather than expand. That discipline is the whole point of the Product Office.

---

*End of APP-003. Together, APP-001 (what/when to build), APP-002 (how to run the company), and APP-003 (how to launch) complete the Product Office.*
