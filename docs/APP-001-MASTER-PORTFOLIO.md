# APP-001 — NearByBazar Master Product Portfolio & Engineering Execution Plan

> **Document class:** Engineering Portfolio / Program Increment Plan
> **Version:** v1.1 — incorporates CPO review (Founder Roadmap layer, one-problem-at-a-time sequencing, Kill Criteria, the Alignment Rule)
> **Horizon:** 12–18 months
> **Status:** ✅ **Approved — Product Office Baseline v1.0** (frozen). Changes require an approved POCR — see `docs/PRODUCT_OFFICE_CHANGE_REQUEST.md`.
> **Companion documents:** APP-002 Founder Operating System (`docs/APP-002-FOUNDER-OPERATING-SYSTEM.md`), APP-003 Launch Execution Playbook (`docs/APP-003-LAUNCH-EXECUTION-PLAYBOOK.md`)
> **Authority:** This is the single engineering source of truth. It defines **HOW**. The frozen Product Office artifacts (Product Constitution, North Star Framework, Product Experience Principles, Marketplace Health Framework, Product Governance Handbook, Launch Strategy, Product-Market Fit Strategy) define **WHAT** and **WHY** and are immutable inputs to this plan.

---

## 0. How to read this document

This is **not** a sprint plan. It is a portfolio: the whole product decomposed into **capabilities**, each capability decomposed into **features**, wired together by a **dependency graph**, sequenced into **releases**, and executed across parallel **engineering streams**. Sprint planning becomes a downstream act of pulling the next-highest-priority feature off an unblocked capability.

Every capability answers six questions the Product Office insists on: *Why build this? Why now? Why not earlier? Why not later? What business outcome? How does it move PMF / Marketplace Health / Merchant Success / Customer Success / Revenue / Trust?*

**Grounding in reality.** NearByBazar already has a running platform. To keep this plan honest, every capability and feature carries a **Status**:

| Status | Meaning |
|---|---|
| `LIVE` | Shipped and in production use today |
| `PARTIAL` | Foundations exist in code/schema; not fully productized |
| `PLANNED` | Not yet started; scheduled in a release below |

### Current platform baseline (as-built, July 2026)

- **Auth & identity** — phone-OTP, email/password, Google OAuth, JWT, dual customer/vendor profiles on one `User`.
- **Merchant onboarding** — category-driven across **16 verticals**; each business carries a `moduleConfig` capability blueprint (`commerce` / `scheduling` / `leadGen` / `estimation`), a `bookingMode` (ORDER / DIRECT_BOOK / REQUEST_TO_BOOK / CART) and a `listingTier` (DIRECTORY / BOOKABLE / COMMERCE).
- **Storefronts** — 35 self-contained templates (backend-served vanilla + Next.js `[slug]`).
- **Catalog & orders** — `CatalogItem`, enquiry-based `OrderEnquiry` / `OrderItem` with an `OrderStatus` lifecycle.
- **Leads** — `LeadAnalytic` capturing profile views, call clicks, WhatsApp clicks.
- **Discovery** — search module with an extensible `ranking.service`, autocomplete, and a unified `/discover` engine (Sprint 2).
- **Reviews** — schema + module present; ratings intentionally **not surfaced** yet (no real review volume).
- **Media** — Cloudinary-backed `BusinessMedia` (profile / gallery / verification docs).
- **Trust** — verification workflow (`VerificationStatus`), `AuditLog` + `auditLog.service`.
- **Ops** — admin + superadmin modules; regions (`City`, Haryana/Hisar focus).
- **Monetization** — `BusinessSubscription` + `membershipTier` (Free / Starter / Pro) in schema; billing not wired.
- **Release governance** — file-based release registry + public "What's New" (Sprint 2 · Batch 0).

---

## 1. NearByBazar Capability Map

The capability map is the engineering blueprint. Every sprint, epic, dependency and technical decision traces back to exactly one capability here.

```
                              ┌─────────────────────┐
                              │   PRODUCT OFFICE     │   (frozen — WHAT & WHY)
                              └──────────┬──────────┘
                                         │ governs
        ┌────────────────────────────────┼────────────────────────────────┐
        │                                │                                 │
┌───────▼────────┐              ┌────────▼────────┐               ┌────────▼────────┐
│ MARKETPLACE     │              │ MERCHANT         │               │ CUSTOMER        │
│ CORE            │◄────────────►│ PLATFORM         │               │ PLATFORM        │
│ (identity,      │   supply     │ (onboarding,     │   demand      │ (discovery,     │
│  listing,       │◄────────────►│  storefront,     │◄─────────────►│  storefront     │
│  catalog,       │              │  dashboard,      │   two-sided   │  consumption,   │
│  trust)         │              │  leads/orders)   │   liquidity   │  profiles)      │
└───────┬────────┘              └────────┬────────┘               └────────┬────────┘
        │                                │                                 │
        │        ┌───────────────────────┼─────────────────────────┐      │
        │        │                       │                         │      │
┌───────▼────────▼──┐         ┌──────────▼─────────┐      ┌────────▼──────▼─────┐
│ PLATFORM SERVICES  │         │ OPERATIONS         │      │ MARKETPLACE         │
│ (authz, media,     │         │ PLATFORM           │      │ INTELLIGENCE        │
│  notifications,    │◄───────►│ (admin, moderation,│◄────►│ (search ranking,    │
│  jobs, audit,      │  shared │  verification,     │ signals│ analytics, health, │
│  config, flags)    │  infra  │  release ops)      │      │  recommendations)   │
└───────┬───────────┘         └──────────┬─────────┘      └────────┬────────────┘
        │                                │                         │
        │                     ┌──────────▼─────────┐               │
        └────────────────────►│ COMMERCE LAYER      │◄──────────────┘
                              │ (payments, orders,  │
                              │  subscriptions,     │
                              │  fulfilment)        │
                              └──────────┬─────────┘
                                         │
                              ┌──────────▼─────────┐         ┌──────────────────┐
                              │ GROWTH PLATFORM     │         │ DEVELOPER         │
                              │ (SEO, referrals,    │         │ PLATFORM          │
                              │  campaigns,         │         │ (public API,      │
                              │  lifecycle)         │         │  webhooks, SDKs)  │
                              └────────────────────┘         └──────────────────┘

                              ┌─────────────────────────────────────────────┐
                              │ LAUNCH FOUNDATION (cross-cutting, R1)         │
                              │ CI/CD · observability · security · perf ·    │
                              │ testing · release governance                 │
                              └─────────────────────────────────────────────┘
```

**Reading the map.** Marketplace Core is the shared substrate both sides depend on. Merchant Platform grows *supply*, Customer Platform grows *demand*; their overlap is *marketplace liquidity* — the North Star. Platform Services and Launch Foundation are horizontal enablers everything sits on. Operations, Intelligence and Commerce are activated as the marketplace matures. Growth and Developer platforms are the last-mile scale layers.

---

## 2. Capability Portfolio

Ten capabilities. Each is a durable organizational unit that will outlive any single release.

---

### CAP-01 · Launch Foundation

- **Description:** The engineering bedrock — CI/CD, observability, security hardening, performance budgets, automated testing, PWA delivery, and release governance — that lets everything else ship safely and repeatedly.
- **Purpose:** Make change cheap, safe and reversible so the marketplace can iterate toward PMF without regressions eroding trust.
- **Business Objective:** Protect brand trust and uptime during the fragile pre-PMF phase; keep cost-of-change low.
- **Product Objective:** Every user-visible change is observable, reversible and shipped behind guardrails.
- **Engineering Objective:** Green pipeline, meaningful test coverage on critical paths, structured logging/metrics, feature-flag + release-registry discipline.
- **Business Value:** High — foundational leverage on every future release.
- **User Value:** Indirect but real: reliability, speed, fewer outages.
- **Marketplace Impact:** Enables trustworthy velocity; a broken deploy on a two-sided market damages both sides at once.
- **Revenue Impact:** Indirect (protects revenue by protecting trust and uptime).
- **Engineering Complexity:** Medium.
- **Risk:** Under-investment here compounds silently as tech debt; over-investment delays PMF learning. Balance via "just enough foundation per release."
- **Dependencies:** None (it is the base). Everything depends on it.
- **Future Expansion:** Multi-region deploys, blue/green, chaos testing, DR automation.
- **Success Metrics:** Deploy frequency, change-failure rate, MTTR, p95 latency budgets held, critical-path test coverage.
- **Status:** `PARTIAL` (release registry + What's New `LIVE`; CI, structured tests, observability `PARTIAL`).
- **Recommended Release:** R1 (and a permanent NFR track across all releases).
- **Priority:** P0.

**Features**

1. **CI/CD pipeline & environment promotion** — *Problem:* changes ship manually with no gate. *Why it exists:* prevent regressions reaching prod (which auto-deploys from `main`). *User journey:* engineer opens PR → tests/lint/build run → merge → auto-deploy → release recorded. *Acceptance (high level):* PRs blocked on red; staging→prod promotion documented; rollback runbook exists. *Dependencies:* none. *Eng notes:* `.github/` workflows exist; formalize gates. *Complexity:* M. *Risk:* prod is Neon + Render auto-deploy — a bad merge is live instantly, so gates are non-negotiable. *Future:* preview environments per PR.
2. **Observability baseline** — *Problem:* limited insight into prod behavior. *Why:* MTTR depends on seeing failures. *Journey:* incident → engineer queries structured logs/metrics → roots cause. *Acceptance:* request-scoped structured logs (Pino in place), error tracking, uptime/latency dashboards, health probe. *Complexity:* M. *Future:* tracing, RUM.
3. **Automated test harness** — *Problem:* growing surface, thin coverage. *Journey:* CI runs unit+integration on services/routes (test dirs already scaffolded). *Acceptance:* critical paths (auth, onboarding, orders, search) covered; deterministic. *Complexity:* M. *Future:* e2e + contract tests.
4. **Release governance & "What's New"** — `LIVE`. File-based release registry (`releases/*.json`), public/internal projection, lifecycle draft→ready→released, impact + metrics scorecard, public changelog. *Future:* automated release notes from merged PRs, per-audience filtering.
5. **PWA & offline delivery** — *Problem:* mobile-first users on flaky networks. *Journey:* install to home screen, degrade gracefully offline. *Acceptance:* service worker + offline shell (present in FE). *Complexity:* M. *Status:* `PARTIAL`. *Future:* push notifications, background sync.

---

### CAP-02 · Marketplace Core

- **Description:** The shared substrate of the two-sided market: identity, the business listing/profile model, categories & verticals, catalog, and the trust/verification spine both merchants and customers depend on.
- **Purpose:** Provide the canonical, source-agnostic representation of *who* is on the platform and *what* they offer.
- **Business Objective:** A clean, extensible core lets NearByBazar add verticals and geographies without re-plumbing.
- **Product Objective:** One coherent identity and listing model that powers every surface.
- **Engineering Objective:** Normalized, capability-driven data model (`moduleConfig`, `listingTier`, `bookingMode`) that generalizes across 16 verticals.
- **Business Value:** Very High — the asset the whole marketplace is built on.
- **User Value:** Consistent, trustworthy business information everywhere.
- **Marketplace Impact:** Directly determines supply quality and breadth.
- **Revenue Impact:** Indirect but foundational (listing tiers → monetization surface).
- **Engineering Complexity:** High (multi-vertical generalization).
- **Risk:** Over-fitting the model to today's verticals; mitigated by the archetype (FOOD/SERVICE/PRODUCT) + `moduleConfig` abstraction already in place.
- **Dependencies:** Platform Services (authz, media), Launch Foundation.
- **Future Expansion:** New verticals, multi-location businesses, franchise/chain modeling, structured attributes per archetype.
- **Success Metrics:** Verified/complete listings, verticals supported, listing data-quality score, time-to-onboard a new vertical.
- **Status:** `LIVE` (core), `PARTIAL` (reviews, multi-location).
- **Recommended Release:** R1 hardening; extended across R2–R6.
- **Priority:** P0.

**Features**

1. **Identity & dual profiles** — `LIVE`. One `User` can hold both a customer and a vendor profile (`hasCustomerProfile` / `hasVendorProfile`). *Problem:* the same person shops *and* sells. *Acceptance:* single sign-in, context switch, no duplicate accounts. *Future:* team/staff accounts under a business.
2. **Business profile & listing model** — `LIVE`. Slug, registration number, locality/pincode/geo, `status`, `membershipTier`, `themeFlavor`, provenance (`source`: self/osm/places), claim state. *Why:* one flexible record spanning directory-only to full-commerce. *Complexity:* H. *Future:* multi-location, structured hours, service areas.
3. **Verticals & category system** — `LIVE`. 16 verticals, archetypes, per-vertical attribute schemas, category tree with `archetype`/`icon`. *Why:* browse and onboarding are both category-driven. *Future:* per-category structured attributes, taxonomy governance.
4. **Capability blueprints (`moduleConfig`)** — `LIVE`. Commerce / scheduling / leadGen / estimation toggles + `bookingMode` + `listingTier` derive each storefront's behavior and CTAs. *Why:* one engine, many business shapes, no per-vertical forks. *Complexity:* H. *Future:* self-serve capability configuration by merchants.
5. **Catalog** — `LIVE` (`CatalogItem`). Menu/products/services with category linkage. *Future:* variants, modifiers, inventory, availability windows.
6. **Trust & verification spine** — `PARTIAL`. `VerificationStatus` lifecycle, ID capture, verification media. *Why:* trust is the marketplace's currency. *Future:* automated document checks, trust score, badges.
7. **Reviews & ratings** — `PARTIAL`. Schema + module exist; ratings intentionally hidden until real volume. *Why:* a fake number is worse than none. *Journey:* post-interaction → verified review → surfaced on card/storefront. *Acceptance:* only genuine, ideally interaction-anchored reviews count. *Priority:* P1 (R3). *Future:* review moderation, merchant responses, photo reviews.

---

### CAP-03 · Merchant Platform

- **Description:** Everything a business owner touches — category-driven onboarding, storefront (35 templates), the vendor dashboard, and the lead/order inbox that turns visibility into livelihood.
- **Purpose:** Get merchants onboarded fast and give them a self-serve surface that visibly grows their business.
- **Business Objective:** Grow and retain *supply*; make merchant success measurable and self-evident.
- **Product Objective:** A merchant can go from signup to a live, shareable storefront receiving leads with zero hand-holding.
- **Engineering Objective:** Config-driven onboarding + storefront rendering that scales across verticals without bespoke code per merchant.
- **Business Value:** Very High — no supply, no marketplace.
- **User Value (merchant):** A professional presence + a channel to reach customers they couldn't reach before.
- **Marketplace Impact:** Directly drives supply-side liquidity and quality.
- **Revenue Impact:** High — the dashboard is where tier upgrades are earned and sold.
- **Engineering Complexity:** High (35 templates, onboarding branching).
- **Risk:** Template sprawl (35 parallel components, no shared hero/header) raises maintenance cost; mitigate by extracting shared primitives over time.
- **Dependencies:** Marketplace Core, Platform Services (media, notifications), Marketplace Intelligence (lead analytics).
- **Future Expansion:** Merchant SaaS tooling (bookings calendar, CRM-lite, promotions), staff roles, multi-location dashboards.
- **Success Metrics:** Onboarding completion rate, time-to-first-storefront, profile completeness, leads per active merchant, 30-day merchant retention.
- **Status:** `LIVE` (onboarding, storefront, leads); `PARTIAL` (dashboard depth).
- **Recommended Release:** R2 (Merchant Success) primary; extended in R5 (Merchant SaaS).
- **Priority:** P0.

**Features**

1. **Category-driven onboarding** — `LIVE`. Vertical → capability blueprint → tailored fields → live storefront. *Problem:* generic forms don't fit a salon and a kirana store. *Acceptance:* correct capabilities/CTAs auto-selected per category; resumable. *Complexity:* H. *Future:* AI-assisted profile fill, bulk import for claimed stubs.
2. **Storefront rendering (template registry)** — `LIVE`. 35 templates chosen by archetype/theme; capability-driven CTAs (Book / Order / Enquire / Call). *Risk:* per-template polish is costly. *Future:* shared hero/trust/gallery primitives; theme editor.
3. **Vendor dashboard** — `PARTIAL`. Profile management, media, status, cover/gallery. *Journey:* merchant edits profile, sees performance, upgrades tier. *Acceptance:* self-serve edit of all listing fields + media. *Complexity:* M. *Future:* analytics home, insights, nudges to complete profile.
4. **Lead & order inbox** — `LIVE` (enquiry-based). `LeadAnalytic` (views/calls/WhatsApp) + `OrderEnquiry` lifecycle. *Why:* proof the platform delivers customers. *Acceptance:* merchant sees and acts on every inbound lead/order. *Future:* status automation, response SLAs, WhatsApp integration depth.
5. **Claim & verification flow** — `PARTIAL`. Unclaimed imported stubs (`source`, `isClaimed`) → claim → verify → own. *Why:* seed supply density before self-onboarding scales. *Future:* automated claim matching, bulk provenance import.

---

### CAP-04 · Customer Platform

- **Description:** Everything a consumer touches — discovery, category/locality browse, storefront consumption, and the customer profile — the demand side of the market.
- **Purpose:** Help a nearby customer find a trustworthy local business and take the next action fast.
- **Business Objective:** Grow and retain *demand*; convert intent into merchant contact.
- **Product Objective:** From "I need X near me" to a chosen business in the fewest possible steps.
- **Engineering Objective:** One discovery engine, many SEO-friendly entry points, capability-aware result actions.
- **Business Value:** Very High — demand is the other half of liquidity.
- **User Value (customer):** Faster, more trustworthy local discovery than generic search or word-of-mouth.
- **Marketplace Impact:** Drives demand-side liquidity; determines whether supply gets rewarded.
- **Revenue Impact:** Indirect (demand makes merchant tiers worth buying) trending to Direct (transactions).
- **Engineering Complexity:** Medium-High.
- **Risk:** Cold-start — discovery is worthless without supply density; sequence per-geography.
- **Dependencies:** Marketplace Core, Marketplace Intelligence (ranking), Growth (SEO).
- **Future Expansion:** Personalization, saved businesses/favorites, follow/notify, in-app transactions.
- **Success Metrics:** Search→profile CTR, discovery→contact conversion, returning customers, searches with results (coverage).
- **Status:** `LIVE` (discovery, storefront consumption); `PARTIAL` (customer profile depth, favorites).
- **Recommended Release:** R3 (Customer Experience) primary.
- **Priority:** P0.

**Features**

1. **Unified discovery engine** — `LIVE` (Sprint 2). `/discover` + SEO aliases (`/c/:cat`, `/l/:locality`, `/:district/:category`), shareable URL-driven filter/sort state, one filter model. *Acceptance:* every entry point renders the same engine; links are bookmarkable. *Future:* map view, distance sort, personalization.
2. **Search-as-you-type autocomplete** — `LIVE`. Businesses + categories + localities. *Future:* typo tolerance, synonyms, intent understanding.
3. **Capability-aware result actions** — `LIVE`. Cards show Book / Order / View & Call by `moduleConfig`, not a generic button. *Why:* right next action per business shape.
4. **Category & locality landing pages** — `PARTIAL`. Description + business counts + SEO stubs on categories. *Why:* crawlable demand capture. *Priority:* P1 (R3/R4 with Growth). *Future:* editorial category hubs.
5. **Customer profile & favorites** — `PARTIAL`. Consumer profile exists; saved/favorite businesses `PLANNED`. *Journey:* save a shop → get notified of updates. *Future:* follow, notify, order history.

---

### CAP-05 · Operations Platform

- **Description:** The internal control plane — admin & superadmin consoles, moderation, verification review, region/config management, and release operations.
- **Purpose:** Let the team run a trustworthy marketplace at scale: approve, moderate, configure, intervene.
- **Business Objective:** Keep the marketplace healthy, safe and compliant as it grows.
- **Product Objective:** Every trust/quality intervention has a fast, auditable internal tool.
- **Engineering Objective:** Role-scoped, audited admin surfaces over the same core services (no shadow data paths).
- **Business Value:** High — the safety valve for marketplace health.
- **User Value:** Indirect (customers/merchants get a safer, better-curated marketplace).
- **Marketplace Impact:** Directly protects Marketplace Health Framework metrics.
- **Revenue Impact:** Indirect (trust protects the whole revenue base).
- **Engineering Complexity:** Medium.
- **Risk:** Manual ops don't scale; automate the highest-volume moderation over time.
- **Dependencies:** Platform Services (authz, audit), Marketplace Core, Marketplace Intelligence (signals to prioritize review).
- **Future Expansion:** Automated moderation, fraud detection, bulk tooling, ops analytics.
- **Success Metrics:** Verification turnaround time, moderation backlog, fraudulent-listing rate, time-to-intervene.
- **Status:** `LIVE` (admin/superadmin present); `PARTIAL` (moderation depth, ops analytics).
- **Recommended Release:** R2/R3 hardening; R6 automation.
- **Priority:** P1.

**Features**

1. **Admin & superadmin consoles** — `LIVE`. Scoped internal management of users, businesses, categories, settings. *Acceptance:* role-gated, audited actions. *Future:* consolidated ops dashboard.
2. **Verification review queue** — `PARTIAL`. Review ID/docs → approve/reject with reason (`VerificationStatus`). *Why:* trust gate. *Future:* SLA tracking, automated pre-checks.
3. **Content & review moderation** — `PLANNED`. Report → triage → action, over `Feedback` (ContactUs/Report). *Priority:* P1 alongside reviews going live (R3).
4. **Region & config management** — `PARTIAL`. Cities/districts, system settings, vertical config sync on boot. *Future:* geo rollout controls, per-region toggles.
5. **Release operations** — `LIVE`. Draft→ready→released workflow, CLI (`release:new`), audience/visibility rules. *Future:* approval workflow enforcement, automated changelog.

---

### CAP-06 · Growth Platform

- **Description:** The acquisition and retention engine — SEO, referrals, lifecycle messaging, campaigns, and sharing loops that compound both sides of the market.
- **Purpose:** Turn each user and listing into a channel that brings more users and listings.
- **Business Objective:** Lower CAC, raise organic acquisition and retention, drive the flywheel.
- **Product Objective:** Every listing is discoverable via search engines; every good experience is shareable.
- **Engineering Objective:** Crawlable, fast, structured surfaces + event-driven lifecycle messaging.
- **Business Value:** High (compounding).
- **User Value:** Relevant, timely nudges; easy sharing.
- **Marketplace Impact:** Feeds both supply and demand acquisition.
- **Revenue Impact:** High (growth in liquidity → growth in monetizable base).
- **Engineering Complexity:** Medium.
- **Risk:** Premature growth spend on a leaky (pre-PMF) funnel wastes money — sequence after retention basics.
- **Dependencies:** Customer Platform, Merchant Platform, Platform Services (notifications), Marketplace Intelligence (analytics/attribution).
- **Future Expansion:** Paid acquisition tooling, merchant-run promotions, loyalty, ambassador programs.
- **Success Metrics:** Organic traffic, indexed pages, referral coefficient (k-factor), lifecycle-driven reactivation, CAC.
- **Status:** `PARTIAL` (SEO scaffolding, sitemap/robots in FE); mostly `PLANNED`.
- **Recommended Release:** R4 (Marketplace Growth) primary.
- **Priority:** P1.

**Features**

1. **SEO & structured surfaces** — `PARTIAL`. Sitemap/robots, SEO-friendly discovery URLs, per-category metadata stubs. *Why:* organic demand is the cheapest demand. *Acceptance:* crawlable storefronts + category/locality pages with structured data. *Future:* schema.org markup, editorial hubs.
2. **Referral & sharing loops** — `PLANNED`. Merchant "share my storefront", customer "share this business". *Journey:* share link → new visitor → attributed. *Future:* incentivized referrals.
3. **Lifecycle & transactional messaging** — `PARTIAL` (Resend email, WhatsApp service present). *Why:* re-engage merchants (complete profile) and customers (saved businesses). *Future:* journeys, segments, campaign tooling.
4. **Merchant promotions** — `PLANNED`. Merchant-run offers surfaced in discovery. *Priority:* P2 (R5). *Future:* coupon engine, featured-slot marketplace.

---

### CAP-07 · Platform Services

- **Description:** The horizontal engineering services every capability reuses — authentication, authorization, media, notifications, background jobs, audit, configuration, feature flags, API standards.
- **Purpose:** Solve cross-cutting concerns once, correctly, and share them.
- **Business Objective:** Maximize engineering leverage and consistency; avoid re-solving the same problem per feature.
- **Product Objective:** Consistent security, media, and messaging behavior across every surface.
- **Engineering Objective:** Well-factored shared services with clear contracts.
- **Business Value:** High (leverage multiplier).
- **User Value:** Indirect (consistency, security, speed).
- **Marketplace Impact:** Enables every other capability.
- **Revenue Impact:** Indirect.
- **Engineering Complexity:** Medium.
- **Risk:** Shared services become bottlenecks/coupling points if under-designed; version and contract-test them.
- **Dependencies:** Launch Foundation.
- **Future Expansion:** Central notification service (push/SMS/WhatsApp/email), media pipeline, config service, entitlements service.
- **Success Metrics:** Auth success/latency, media upload success, notification delivery rate, flag adoption, API error rate.
- **Status:** `LIVE` (auth, media, audit, email); `PARTIAL` (notifications, jobs, flags).
- **Recommended Release:** R1 baseline; continuous.
- **Priority:** P0.

**Features**

1. **Authentication** — `LIVE`. Phone-OTP, email/password + reset, Google OAuth, JWT, Firebase. *Future:* session management, device trust, step-up auth.
2. **Authorization** — `PARTIAL`. Role (`admin`), business ownership middleware (`verifyBusinessOwnership`). *Why:* every mutation must be access-checked. *Future:* fine-grained RBAC, staff roles, resource policies.
3. **Media service** — `LIVE`. Cloudinary upload/transform, typed `BusinessMedia`. *Future:* image optimization pipeline, CDN tuning, video.
4. **Notifications** — `PARTIAL`. Email (Resend), WhatsApp service, PWA push scaffolding. *Why:* the marketplace's nervous system. *Priority:* P1 (unify in R2/R3). *Future:* channel-agnostic notification service with preferences.
5. **Background jobs** — `PARTIAL` (`backgroundJobs.js`). *Why:* async work (imports, digests, cleanup). *Future:* durable queue, scheduling, retries.
6. **Audit & config** — `LIVE`. `AuditLog` + `auditLog.service`, `SystemSetting`, vertical config. *Future:* config service, change history UI.
7. **Feature flags & API standards** — `PARTIAL`. Release registry supports flags; API is versioned (`/api/v1`) with a terminal 404 guard, Swagger docs, Zod validation. *Future:* runtime flag service, API deprecation policy.

---

### CAP-08 · Marketplace Intelligence

- **Description:** The signal layer — search ranking, analytics, marketplace-health instrumentation, and (later) recommendations — that makes the marketplace smart about matching supply and demand.
- **Purpose:** Surface the *right* business to the *right* customer, and measure whether the marketplace is healthy.
- **Business Objective:** Improve match quality and give the Product Office the metrics its frameworks require.
- **Product Objective:** Relevance that rewards quality supply and satisfies demand intent.
- **Engineering Objective:** Extensible ranking + a clean analytics event pipeline feeding health metrics.
- **Business Value:** High (compounds match quality → liquidity).
- **User Value:** Better results for customers; fair reward for good merchants.
- **Marketplace Impact:** Directly shapes liquidity and the Marketplace Health Framework.
- **Revenue Impact:** Indirect→Direct (ranking quality and featured slots are monetizable).
- **Engineering Complexity:** Medium-High.
- **Risk:** Ranking that can be gamed erodes trust; keep signals transparent and quality-anchored.
- **Dependencies:** Marketplace Core (data), Customer/Merchant Platforms (events).
- **Future Expansion:** Personalized ranking, recommendations, demand forecasting, AI search.
- **Success Metrics:** Result relevance (CTR@k), coverage (searches with results), ranking fairness, health-metric completeness.
- **Status:** `LIVE` (ranking pipeline, basic analytics); `PARTIAL` (health instrumentation); `PLANNED` (recommendations).
- **Recommended Release:** R3 hardening; R6 (Intelligence) primary.
- **Priority:** P1.

**Features**

1. **Ranking pipeline** — `LIVE`. Extensible providers (featured, trust/verified, completeness, open-now, tier, rating, recency); `rankResults()` re-ranks the relevance strategy. *Why:* a formula that evolves without rewrites. *Future:* learned ranking, per-query weighting.
2. **Analytics event pipeline** — `PARTIAL`. `LeadAnalytic`, `SearchAnalytic`, analytics module. *Why:* every product decision needs event data. *Priority:* P1 — audit + standardize the event taxonomy. *Future:* funnel analytics, cohort/retention, attribution.
3. **Marketplace-health instrumentation** — `PLANNED`. Encode Marketplace Health Framework metrics (liquidity, match rate, trust, concentration). *Why:* the Product Office governs by these numbers. *Priority:* P1.
4. **Recommendations & personalization** — `PLANNED`. "Businesses near you", "you might also like". *Priority:* P2 (R6+). *Future:* AI assistance.

---

### CAP-09 · Commerce Layer

- **Description:** The money and transaction layer — payments, order fulfilment, subscriptions/billing, and merchant monetization — turning engagement into revenue.
- **Purpose:** Let value flow: customers transact, merchants pay for growth, the platform earns.
- **Business Objective:** Establish durable, multi-sided revenue (subscriptions first, transactions later).
- **Product Objective:** Frictionless payment and clear, fair merchant billing.
- **Engineering Objective:** A payments/billing spine decoupled from listing logic, with strong correctness and auditability.
- **Business Value:** Very High (this is revenue).
- **User Value:** Convenience (transact in-platform) and clear value-for-money (merchant tiers).
- **Marketplace Impact:** Deepens the market from directory → transactional.
- **Revenue Impact:** Direct — the primary monetization engine.
- **Engineering Complexity:** High (money correctness, reconciliation, compliance).
- **Risk:** Highest-stakes correctness/compliance domain; do not build before liquidity justifies it. Money bugs are trust-destroying.
- **Dependencies:** Marketplace Core (listings/tiers), Merchant Platform (orders), Platform Services (authz/audit), Operations (dispute handling).
- **Future Expansion:** Wallets, payouts, escrow, invoicing, taxes, multi-party settlement.
- **Success Metrics:** Paid-tier conversion, MRR/ARR, transaction GMV (later), payment success rate, churn.
- **Status:** `PARTIAL` (subscription/tier schema present); billing/payments `PLANNED`.
- **Recommended Release:** R5 (Merchant SaaS / subscriptions) then R8 (Commerce Layer / transactions).
- **Priority:** P1 (subscriptions), P2 (transactions).

**Features**

1. **Subscriptions & membership tiers** — `PARTIAL`. `BusinessSubscription` + `membershipTier` (Free/Starter/Pro) modeled; billing not wired. *Journey:* merchant upgrades → unlocks capabilities/visibility → is billed. *Acceptance:* entitlements enforced by tier; renewal/expiry handled. *Priority:* P1 (R5). *Future:* proration, trials, dunning.
2. **Entitlements engine** — `PLANNED`. Map tier → features/limits (drives dashboard + ranking boosts). *Why:* monetization must gate real value. *Priority:* P1 (R5).
3. **Payments integration** — `PLANNED`. Gateway for subscriptions first, then order checkout. *Note:* per platform safety rules, financial execution is handled through vetted providers, never ad hoc. *Priority:* P2 (R8).
4. **Order fulfilment & transactions** — `PLANNED`. Evolve enquiry-orders → paid orders with lifecycle, receipts, disputes. *Priority:* P2 (R8). *Future:* payouts/settlement.

---

### CAP-10 · Developer Platform

- **Description:** The external extensibility layer — public API, webhooks, and SDKs — that lets partners and integrators build on NearByBazar.
- **Purpose:** Extend reach and stickiness by opening the platform to third parties.
- **Business Objective:** Ecosystem leverage and new distribution/integration channels.
- **Product Objective:** Reliable, documented, versioned external contracts.
- **Engineering Objective:** Harden and expose the existing internal API surface with auth, rate limits, and stability guarantees.
- **Business Value:** Medium (long-term strategic).
- **User Value:** Indirect (integrations, partner distribution).
- **Marketplace Impact:** Broadens supply channels and merchant tooling.
- **Revenue Impact:** Indirect→Direct (API tiers, partner deals).
- **Engineering Complexity:** Medium (mostly hardening + governance).
- **Risk:** Public contracts are hard to change — only expose once internal APIs are stable. Premature exposure locks in mistakes.
- **Dependencies:** Everything (it exposes the platform); especially Platform Services (authz, flags) and Launch Foundation (versioning).
- **Future Expansion:** App marketplace, partner portal, sandbox, usage billing.
- **Success Metrics:** API partners, external call volume, webhook reliability, docs satisfaction.
- **Status:** `PLANNED` (internal versioned API + Swagger exist as the seed).
- **Recommended Release:** R9 (Developer Platform).
- **Priority:** P3.

**Features**

1. **Public API** — `PLANNED`. Curated, versioned, key-authenticated subset of `/api/v1`. *Acceptance:* stability + deprecation policy. *Future:* GraphQL/partner-specific shapes.
2. **Webhooks** — `PLANNED`. Event subscriptions (new lead, order status). *Future:* retries, signing, delivery dashboard.
3. **SDKs & partner docs** — `PLANNED`. *Future:* sandbox, partner portal, app marketplace.

---

## 3. Master Dependency Graph

Which capabilities block which. Arrows read "must exist before / enables."

```
CAP-01 Launch Foundation ──┬─► CAP-07 Platform Services ──┬─► CAP-02 Marketplace Core
                           │                              │
                           │                              ├─► CAP-03 Merchant Platform
                           │                              │        │
                           │                              │        ▼
                           │                              ├─► CAP-04 Customer Platform
                           │                              │        │
                           │                              │        ▼
                           │                              ├─► CAP-05 Operations Platform
                           │                              │
                           │                              └─► CAP-08 Marketplace Intelligence
                           │
                           └──────────────────────────────────────────────┐
                                                                           ▼
CAP-02 Core ─┐                                                    (NFR track, all releases)
CAP-03 Merchant ─┤
CAP-04 Customer ─┼─► CAP-06 Growth Platform ─► compounding acquisition
CAP-08 Intel ────┘

CAP-02 Core + CAP-03 Merchant + CAP-07 Services ─► CAP-09 Commerce Layer
                                                        (subscriptions → transactions)

ALL stable internal contracts ─► CAP-10 Developer Platform
```

**Critical path to liquidity (the North Star):**
`CAP-01 → CAP-07 → CAP-02 → CAP-03 (supply) + CAP-04 (demand) → CAP-08 (matching)` — everything else compounds on top of that spine.

**Hard blockers**
- Nothing ships safely before **CAP-01** foundations (prod auto-deploys — gates first).
- **CAP-02** blocks both platforms (shared identity/listing model).
- **CAP-09 Commerce** must not precede demonstrated liquidity (CAP-03 + CAP-04) and trust (CAP-02, CAP-05).
- **CAP-10 Developer** must not precede stable internal contracts (CAP-07 + versioning in CAP-01).

---

## 4. Founder Roadmap & Release Sequencing

> **Revision (CPO review, v1.1):** capabilities are engineering-first by design, but *sequencing* must be founder-first. This section now leads with **business milestones**, sequences one problem at a time, and gives every phase **Kill Criteria** (success *and* failure). A capability is only "activated" by the phase whose milestone it serves.

### 4.1 Founder Roadmap (the milestone layer above capabilities)

Founders don't think in capabilities; they think in the next unanswered question about the business. Each stage below is a single yes/no question the whole company is trying to answer. **You do not advance until the current question is answered "yes."**

```
Stage 1  Can we onboard merchants?            → supply exists
Stage 2  Can customers discover them?         → demand meets supply
Stage 3  Can merchants receive quality leads? → the market clears
Stage 4  Can customers trust merchants?       → conversion compounds
Stage 5  Can merchants stay active?           → supply retains
Stage 6  Can customers return?                → demand retains  → PMF signal
Stage 7  Can we expand another neighbourhood? → the model replicates
Stage 8  Can we monetize?                      → the model pays
```

Every capability and feature must map to exactly one of these stages. If it maps to none, it does not get built yet (see §9 governance rule).

### 4.2 Release sequencing — one problem at a time

The prior draft ran Merchant + Customer + Growth + Ops + Platform + Commerce in parallel. That is elegant but un-startuplike. **Narrowed sequencing:** each phase solves one problem exceptionally well, proves it against a KPI, and only then unlocks the next. Phases are gates, not a schedule.

| Phase | Founder stage | Goal | Primary KPI | Capabilities activated | Why now |
|---|---|---|---|---|---|
| **P0 · Launch Foundation** | (enabler) | Stable, safe-to-iterate platform | Green pipeline, MTTR, p95 held | CAP-01, CAP-07, CAP-02 (harden) | Prod auto-deploys — gates first |
| **P1 · Merchant Acquisition** | Stage 1 | Onboard the beachhead | **50 active merchants** in one vertical, one area | CAP-03, CAP-02 | No supply, no marketplace |
| **P2 · Merchant Success** | Stage 3 | First successful local connections | First **quality leads** delivered to merchants | CAP-03 (lead inbox), CAP-07 (notifications) | Prove the platform delivers value |
| **P3 · Customer Discovery** | Stage 2 | Customers find merchants | **Search → Contact** conversion | CAP-04, CAP-08 (analytics only) | Demand, once supply is real |
| **P4 · Trust Layer** | Stage 4 | Customers trust merchants | Verified profiles + first real **reviews** | CAP-02 (reviews), CAP-05 (moderation) | Trust lifts conversion |
| **P5 · Retention** | Stages 5–6 | Both sides come back | Repeat merchants **and** repeat customers | CAP-03, CAP-04, CAP-06 (lifecycle) | Retention = the PMF signal |
| **P6 · Neighbourhood Expansion** | Stage 7 | Replicate in a second area | Second area hits P1–P5 bar faster | CAP-02/03/04 (geo), CAP-05 | Replicate a proven model |
| **P7 · Merchant SaaS** | Stage 8 | Monetize proven value | Paid-tier conversion, MRR | CAP-09 (subscriptions/entitlements), CAP-03 | Charge *after* value is proven |
| **P8 · Commerce** | Stage 8+ | Transactions in-platform | GMV, payment success | CAP-09 (payments/orders) | Depth after monetization works |
| **P9 · Intelligence & AI** | (optimize) | Better matching | Match quality, health metrics | CAP-08 (ranking/recs) | Needs accrued event volume |
| **P10 · Developer Platform** | (scale) | Ecosystem | API partners | CAP-10 | Only after contracts are stable |

**Everything after P5 waits.** P6–P10 are real, but they are explicitly *not* in flight until P1–P5 each pass their Kill Criteria. This is the single most important change from v1.0.

### 4.3 Kill Criteria (per phase)

Every phase carries a **Stop line**. If the failure condition is met, the rule is not "push harder" — it is **stop building, investigate, fix the foundation, then resume.** Kill Criteria protect the company from pouring months of engineering onto a weak base.

| Phase | ✅ Success (advance) | 🛑 Failure (stop & investigate) |
|---|---|---|
| **P0** | Gated CI, tested rollback, observability live | Can't deploy safely after 2 weeks → fix before any feature work |
| **P1** | ≥50 active merchants, ≥90% profile completion, ≥80% onboarding completion | <20 merchants after 60 days, or <40% onboarding completion, or <10% activation |
| **P2** | Merchants receive & act on first quality leads; ≥1 successful connection per active merchant | <30% of merchants get any lead in 30 days → the value prop is unproven; do not build discovery breadth |
| **P3** | Search→Contact conversion clears target; searches-with-results (coverage) healthy | Customers search but don't contact (<X% conversion) → discovery or supply density is wrong |
| **P4** | Verified profiles + genuine reviews measurably lift contact→connection conversion | Reviews add no conversion lift, or fraud/abuse appears faster than moderation → pause, harden trust |
| **P5** | Repeat merchants (return weekly) **and** repeat customers appear without paid nudges | Neither side returns organically → **no PMF yet.** Do not expand, do not monetize. Return to P2–P4. |
| **P6** | Second area reaches the P1–P5 bar in *less* time than the first | Second area stalls where the first succeeded → the model isn't replicable; fix before scaling geos |
| **P7** | Merchants pay for a tier that delivers proven value; churn acceptable | Upgrade conversion near zero, or paying merchants churn → value isn't monetizable yet |
| **P8–P10** | Each defined at entry, gated on the prior phase | (Not scheduled until P7 passes) |

*Targets shown as "X%" are set per-launch in APP-003 (Launch Execution Playbook), not frozen here — but the shape of the gate is fixed.*

### 4.4 Sequencing rationale (Why now / not earlier / not later)

- **P0 first** — prod auto-deploys from `main` onto production Neon; velocity without gates is a trust liability. Not earlier: the platform already runs (hardening, not greenfield). Not later: every phase rides on it.
- **P1 before P3** — a two-sided market needs *supply* before *demand* is worth generating; a discovery page over an empty directory teaches nothing.
- **P2 before P3** — prove the platform *delivers value to merchants* before spending to bring customers; otherwise you scale a promise you can't keep.
- **P4 before P5** — trust is the conversion multiplier that makes retention measurable.
- **P5 gates everything after it** — retention is the PMF signal. Expanding (P6) or monetizing (P7) before retention is confirmed is the classic marketplace failure mode.
- **P7 (monetization) after value is proven** — charge once liquidity + retention prove the value exists; paywalling before then kills growth.
- **P8–P10 last** — payments correctness/compliance, intelligence (needs data), and public API (ossifies contracts) all demand a mature, proven base.

> **Companion documents:** the *how-to-operate* and *how-to-launch* sides of this roadmap live in **APP-002 (Founder Operating System)** and **APP-003 (Launch Execution Playbook)** — see `docs/APP-002-FOUNDER-OPERATING-SYSTEM.md` and `docs/APP-003-LAUNCH-EXECUTION-PLAYBOOK.md`.

---

## 5. Engineering Streams (parallelization)

Streams are long-lived teams/tracks that pull from multiple capabilities simultaneously, maximizing parallel development. A capability's features are distributed across streams.

| Stream | Owns (capabilities/features) | Parallelizes with |
|---|---|---|
| **Marketplace Core** | CAP-02: identity, listing, verticals, catalog, trust | Everyone (upstream contract owner) |
| **Merchant Experience** | CAP-03: onboarding, storefront, dashboard, leads | Customer Experience |
| **Customer Experience** | CAP-04: discovery, browse, storefront consumption, profiles | Merchant Experience |
| **Platform** | CAP-07: authz, media, config, flags, API standards | All feature streams |
| **Operations** | CAP-05: admin, moderation, verification, release ops | Feature streams |
| **Infrastructure** | CAP-01: CI/CD, environments, DR, PWA delivery | All |
| **Notifications** | CAP-07 notifications + CAP-06 lifecycle messaging | Growth, Merchant/Customer |
| **Analytics** | CAP-08: event pipeline, health metrics, funnels | All (consumes events from every stream) |
| **Search** | CAP-08 ranking + CAP-04 discovery relevance | Customer Experience |
| **Security** | Cross-cutting: authz hardening, abuse/fraud, compliance | All |
| **Performance** | Cross-cutting: latency budgets, caching, media/CDN | All |

**Coordination rule:** streams integrate against **published contracts** from Marketplace Core and Platform Services. Contract changes are versioned and announced through the release registry — never breaking silently.

---

## 6. Technical Debt Strategy

| Class | Debt item | Why it exists | Plan |
|---|---|---|---|
| **Immediate** | Storefront template sprawl (35 parallel components, no shared hero/header/trust primitives) | Speed of shipping distinct looks | Extract shared primitives incrementally during R2 storefront work; do not rewrite wholesale |
| **Immediate** | Dual storefront implementations (backend vanilla `src/public` + Next.js FE) | Two eras of the product coexist | Converge on the Next.js FE as canonical; treat vanilla as legacy/back-office fallback; document the boundary |
| **Immediate** | Thin automated test coverage on critical paths despite prod auto-deploy | Velocity-first pre-PMF | R1: cover auth, onboarding, orders, search before adding surface |
| **Medium-term** | Notifications fragmented across email/WhatsApp/PWA | Added per-need | R2/R3: unify behind a channel-agnostic notification service |
| **Medium-term** | Analytics event taxonomy not standardized (`LeadAnalytic`/`SearchAnalytic` ad hoc) | Events added per feature | R3: define canonical event schema before building funnels |
| **Medium-term** | Authorization is coarse (role string + ownership middleware) | Sufficient for today | Introduce RBAC/entitlements alongside CAP-09 tiers (R5) |
| **Intentional** | Reviews/ratings hidden despite schema present | Deliberate — no fake numbers | Surface only when real volume exists (R3); this is a *feature*, not a bug |
| **Intentional** | Billing not wired despite subscription schema | Monetize after liquidity | Activate in R5, not before |
| **Architecture investment** | `moduleConfig`/`listingTier`/archetype abstraction | Generalize 16 verticals without forks | Keep as the extensibility seam; resist per-vertical special-casing |
| **Architecture investment** | File-based release registry | Governance without DB coupling | Keep; extend with automated changelog (R1+) |

---

## 7. Technical Foundations

Baseline decisions the whole portfolio relies on (present state → direction).

| Foundation | Today | Direction |
|---|---|---|
| **Authentication** | Phone-OTP, email/password + reset, Google OAuth, JWT, Firebase | Session mgmt, step-up auth, device trust |
| **Authorization** | Role string + `verifyBusinessOwnership` | RBAC + entitlements engine (tiers, staff roles) |
| **Search** | `search.service` + extensible `ranking.service` + autocomplete | Learned ranking, synonyms, personalization |
| **Caching** | Request-time computation; category counts cached | Read-model/response caching, CDN, cache invalidation policy |
| **Observability** | Pino structured logs, health probe, request IDs | Error tracking, metrics dashboards, tracing, RUM |
| **Notifications** | Resend email, WhatsApp service, PWA push scaffold | Unified channel-agnostic service + preferences |
| **Audit** | `AuditLog` + `auditLog.service` | Coverage of all sensitive mutations + admin UI |
| **Media** | Cloudinary, typed `BusinessMedia` | Optimization pipeline, CDN tuning, video |
| **Background Jobs** | `backgroundJobs.js` | Durable queue, scheduling, retries, DLQ |
| **API Standards** | `/api/v1`, Zod validation, Swagger, terminal 404 guard, rate limiting, Helmet/CORS/HPP | Deprecation policy, contract tests, error-shape standard |
| **Versioning** | URL-versioned API; SemVer release registry | Formal API deprecation + release-note automation |
| **Feature Flags** | Registry supports flags | Runtime flag service with targeting |
| **Configuration** | `SystemSetting`, verticals config, boot-time sync | Config service with change history |
| **Monitoring** | Health endpoint, `dbMode`/`dbHost` meta | SLO dashboards, alerting, synthetic checks |
| **Analytics** | `LeadAnalytic`, `SearchAnalytic`, analytics module | Canonical event schema, funnels, cohorts, attribution |

---

## 8. Non-Functional Roadmap

| NFR | Target direction | Release emphasis |
|---|---|---|
| **Performance** | p95 discovery/search + storefront render within budget on mobile networks | R1 baseline budgets; R3 discovery scale |
| **Scalability** | Handle per-geography rollout; read-heavy discovery scales independently | R4 (growth traffic), R6 (intelligence load) |
| **Security** | Authz on every mutation, abuse/fraud controls, secrets hygiene, dependency scanning | R1 hardening; continuous Security stream |
| **Accessibility** | WCAG-aligned storefront + discovery (mobile-first, low-literacy friendly) | R3 (customer surfaces) |
| **SEO** | Crawlable, structured, fast public pages; sitemap/robots present | R4 (Growth) primary |
| **Availability** | Uptime SLO; graceful degradation (health probe already degrades cleanly) | R1 baseline; R6+ multi-region |
| **Disaster Recovery** | Backups + restore runbook for prod Neon; tested recovery | R1 runbook; automate later |
| **Testing** | Critical-path unit/integration → e2e/contract | R1 baseline; grows every release |
| **CI/CD** | Gated PRs, staged promotion, safe rollback (prod auto-deploys — gates mandatory) | R1 primary |
| **Developer Experience** | Fast local FE+BE, seed data, clear module boundaries, docs | R1; continuous |

---

## 9. Governance & change control

- This document is the **HOW**; it must never contradict the frozen Product Office **WHAT/WHY** artifacts. On conflict, the Product Office wins and this plan is revised.
- Capabilities are **durable**; releases and priorities **evolve** with user feedback and Product Office decisions.
- Every shipped change is recorded in the release registry (`releases/*.json`) with public impact + internal metrics — the audit trail from portfolio → release → production.
- No capability is "done"; each has a `Status` and a `Future Expansion` path so the portfolio stays a living plan for the full 12–18 month horizon.

**The Alignment Rule (CPO mandate, binding):**

> **No feature may be implemented unless it is mapped to (1) a Founder Roadmap business milestone, (2) a measurable KPI, and (3) a launch objective.** Features that cannot be mapped do not get built — they wait. This prevents feature accumulation without evidence of value and keeps every engineering hour pointed at product-market fit.

Enforcement is lightweight and lives in the release registry: each release entry must name its **phase** (§4.2), its **KPI**, and the **Kill Criteria** it is measured against. A release that can't state those three is not "ready."

**Phase-gate discipline:** phases P1–P5 are gates, not a schedule. Work does not begin on a later phase while an earlier phase sits below its Kill-Criteria success bar. If a failure line is crossed, the company **stops building, investigates, and fixes the foundation** before resuming (§4.3).

**Change control (POCR):** as of **Product Office Baseline v1.0 (frozen, 2026-07-08)**, no Product Office document — the seven WHAT/WHY governance artifacts or the HOW artifacts APP-001/APP-002/APP-003 — may be modified without an **approved Product Office Change Request (POCR)**. See `docs/PRODUCT_OFFICE_CHANGE_REQUEST.md`. Operational decisions explicitly delegated in the docs (e.g. APP-003's *current planned launch area*) are exempt; principles and criteria are not.

---

*End of APP-001. This portfolio is detailed enough that sprint planning is now a matter of pulling the next-highest-priority feature from an unblocked capability, and flexible enough to evolve as the market teaches us.*
