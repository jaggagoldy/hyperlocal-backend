# NearByBazar — Project Scope & Status

_Last updated: 2026-06-18. Living doc for planning the next phase._

## 1. What this is

A **hyperlocal marketplace platform** ("NearByBazar"), Haryana-first, where local
businesses ("vendors") create a storefront and consumers discover/order/book from them.
The platform is **multi-vertical** but currently launched **Food & Beverage only**;
other verticals (salon, home services, grocery, e-commerce, doctors, real estate) are
built as config and shown "Coming Soon" until flipped live.

## 2. Repos, stack, deploy

| | Backend | Frontend |
|---|---|---|
| Path | `~/Desktop/hyperlocal-platform` | `~/Desktop/hyperlocal-frontend` |
| Stack | Express + Prisma | Next.js 16 / React 19 |
| DB | PostgreSQL (Neon) — the `.env` `DATABASE_URL` points at **PRODUCTION** | — |
| Deploy | Render (Docker, auto-deploy on push to `main`) | Vercel (proxies `/api/v1` → Render) |
| Live API | `https://hyperlocal-backend-n690.onrender.com/api/v1` | — |

The backend also serves the built SPA from `src/public`. Image upload (Cloudinary) is
optional — boot does not fail without keys.

⚠️ Running the backend or any `scripts/*.js` locally reads/writes **prod data** (the
`.env` is prod). Use `ENABLED_VERTICALS=FOOD_BEVERAGE,SALON_BEAUTY` as a local override
to preview a coming-soon vertical without changing prod.

## 3. Architecture: backend is the source of truth

- **`src/config/verticals.js`** is the single registry of all verticals: `key, label,
  icon, archetype (FOOD|SERVICE|PRODUCT), templateFamily (food|vcard|retail),
  moduleConfig {commerce,scheduling,leadGen,estimation}, bookingModes, subcategories[],
  taxonomyFields[], onboardingSteps[]`.
- **Which verticals are LIVE** = the `ENABLED_VERTICALS` env var (comma-separated).
  Everything else is returned with `comingSoon: true`. **Flipping a vertical live is an
  env change in Render — no redeploy of code.** (`render.yaml` currently = `FOOD_BEVERAGE`.)
- **`GET /api/v1/verticals`** (public, cached) serves this registry; the frontend renders
  the onboarding wizard dynamically from it.
- `GET /categories` is gated by `ENABLED_VERTICALS` so non-live verticals never leak.
- Per business, the resolved blueprint is stored server-side in
  `BusinessProfile.moduleConfig` (never trusted from the client).

## 4. Auth model (important for testing)

- **Single-role, password-only.** A user is `customer`, `vendor`, or `admin`.
- `POST /api/v1/auth/login` takes `{ identifier, password }` where `identifier` is an
  **email OR a 10-digit phone number**. There is **no OTP login** — the "OTP: 111111"
  printed in some old seed scripts is stale and unused.
- Password hashing: new accounts use bcrypt; legacy seed accounts use PBKDF2
  (`salt:hash`). Both are verified transparently.

## 5. Test credentials (verified working against prod, 2026-06-18)

All use password **`Test1234`**. _Demo accounts — rotate before a real public launch._

| Role | Login identifier | Notes |
|---|---|---|
| Vendor | `9999944444` | "Demo Vendor". Owns **Prime Hair Salon** (SALON_BEAUTY) + **Chicago Pizza Store** (FOOD_BEVERAGE). Also email `demovendor@example.com`. |
| Vendor | `saffron-tandoori@demo.nearbybazar.in` | One of 5 seeded Haryana restaurants (also: green-leaf-pure-veg, karnal-biryani-house, hisar-chaat-bhandar, rohtak-rasoi @demo.nearbybazar.in). |
| Customer | `customer@demo.nearbybazar.in` | "Demo Customer". |

Prod currently has **7 vendor** + **3 customer** users.

## 6. Done so far (onboarding redesign — Phases A–D)

Full plan: `~/.claude/plans/groovy-fluttering-seahorse.md`.

- **Phase A (BE):** `verticals.js` registry + `GET /verticals` + gated `/categories`.
- **Phase B (BE):** `POST /business/register` accepts `subcategorySlug`, `bookingMode`,
  `themeFlavor`, `metaData`; derives & stores `moduleConfig`; resolves sub-category →
  category; validates `businessType ∈ ENABLED_VERTICALS`. Added `BusinessProfile.bookingMode`
  column; seeded food sub-categories.
- **Phase C (FE):** Rebuilt `vendor/register/page.tsx` into a category-first flow
  (vertical → sub-category → details → builder) driven by `GET /verticals`. Removed dead
  `/auth/onboard`; fixed payload field names.
- **Phase D (FE) — just completed, NOT yet committed/pushed:**
  - **Fulfilment/booking-mode step:** register step 3 renders a radio per the vertical's
    `bookingModes` (Instant Booking = `DIRECT_BOOK` / Request to Book = `REQUEST_TO_BOOK`);
    derives the legacy `connectionMode`. Per-service pricing already existed.
  - **Template-family filter:** new `getTemplatesForFamily()` in `templateRegistry.tsx`
    (food→FOOD_BEVERAGE, retail→RETAIL, vcard→SERVICE). **Fixed a bug** where service
    verticals saw *zero* storefront templates; salon now sees 7 vCard themes.
  - Service verticals now route through the template-picker step instead of skipping it.
  - Verified: local backend with salon enabled serves it LIVE; `tsc` clean; route compiles.
    (A pixel-level browser walkthrough was blocked by tooling — preview launcher sandbox
    error + no Chrome extension connected.)

## 7. Known state / gaps to prep for next phase

- [ ] **Commit & push the Phase D frontend changes** (currently uncommitted in the FE repo).
- [ ] **Decide whether to launch Salon & Beauty** — flip `ENABLED_VERTICALS` in Render to
      `FOOD_BEVERAGE,SALON_BEAUTY`. Salon's onboarding, templates, and booking modes are ready.
- [ ] **Browser e2e** of the salon onboarding (do once Chrome extension / preview tooling
      is available, or manually).
- [ ] Confirm Vercel `NEXT_PUBLIC_API_URL` = the `-n690` Render host (`.env.production` had
      it empty at one point).
- [ ] Service verticals (home/repair, doctor, real estate) and PRODUCT verticals
      (grocery, e-commerce) are **config stubs only** in `verticals.js` — they need their
      own onboarding-step + dashboard validation passes before going live.
- [ ] The seed `scripts/seed-chicago-salon.js` is **non-idempotent** and its demo rows
      already exist in prod — do not re-run (it will crash on the unique slug).

## 8. Useful commands

```bash
# Backend locally with a coming-soon vertical previewable (reads/writes PROD db):
ENABLED_VERTICALS="FOOD_BEVERAGE,SALON_BEAUTY" PORT=5001 node src/server.js

# Frontend dev (auto-targets http://localhost:5001/api/v1 when NEXT_PUBLIC_API_URL unset):
cd ~/Desktop/hyperlocal-frontend && npm run dev   # http://localhost:3000

# Verticals contract:
curl -s http://localhost:5001/api/v1/verticals
```

---

## 9. NEXT PHASE (E) — Location (Punjab + Haryana districts) & search-by-name

Goal: pin every vendor to a **real Punjab/Haryana district** at onboarding so consumers
can reliably filter by location, and let consumers search by **business _or_ owner name**.
Decisions below are locked (2026-06-19). _Consumer UI is NOT revamped — only data sources
and one search field change._

### Current state (already built — don't rebuild)
- **Search** (`src/services/search.service.js`) already matches `businessName`, `localityName`,
  `chowkLandmark`, `pincode`, and catalog item `title`/`description` (case-insensitive
  `contains`), and already supports `citySlug` / `state` / `district` filters.
  **Gap:** it does NOT match the owner's `user.name`.
- **Consumer city filter already exists** on `explore/page.tsx` and `food/page.tsx`; both call
  `GET /search/cities` (returns every `City` row, cached) and render a searchable dropdown.
  Default city = `fatehabad` (`src/store/searchStore.ts`).
- **Data model:** `City { name, slug, state(default "Haryana"), district? }`, indexed on
  `[state]` and `[state, district]`. **There is no `District` table.** Onboarding
  (`createBusinessProfile`) slugifies the free-text city and creates a `City` with
  `district = null` today.

### Locked decisions
1. **District source:** hardcode the canonical **Haryana (22)** + **Punjab (23)** district
   lists in a new backend config (`src/config/regions.js`) — no schema change, mirrors the
   `verticals.js` pattern. Served via a public cached endpoint.
2. **Onboarding location UX:** **State dropdown (Haryana / Punjab) → District dropdown**
   (district options filtered to the chosen state). Free-text "Detailed Address" stays as the
   locality. Applies to **both** the inline service-register flow **and** the WorkspaceBuilder
   food/retail flow — _Food is the live vertical, so it must get the dropdown too._
3. **Consumer filter:** show **all PB+HR districts always** (even districts with zero vendors;
   an empty one just shows "no listings yet").
4. **Search:** add owner `user.name` to the existing search `OR`.

### Tasks + token estimates
- **E1 — BE regions config + endpoint (~25–35k):** `src/config/regions.js`
  (`HARYANA_DISTRICTS[]`, `PUNJAB_DISTRICTS[]`, `districtsForState()`, `isValidDistrict()`);
  `GET /api/v1/regions` (public, cached, reuse the TTL cache). Validate `state`+`district`
  in `createBusinessProfile`; store `district` (and set `cityName` = district when no finer
  city is given) so `City.district` is populated.
- **E2 — BE search/cities (~10–15k):** add `{ user: { name: { contains, mode:'insensitive' } } }`
  to the search `OR`; make `GET /search/cities` return the full canonical district list
  (merged with existing `City` rows, optionally annotated `hasVendors`).
- **E3 — FE onboarding dropdowns (~40–55k):** replace the free-text City input in
  `vendor/register/page.tsx` **and** the city/state inputs in `WorkspaceBuilder.tsx`
  (~lines 527–536) with State+District selects fed by `GET /regions`; send `state`, `district`,
  `cityName=district`.
- **E4 — FE consumer city list (~15–25k):** source the `explore`/`food` city dropdowns from the
  canonical district list (all PB+HR) instead of only existing `City` rows. **No layout/visual
  revamp** — only swap the data source; revisit the `fatehabad` default.
- **E5 — Verify e2e (~10–15k):** onboard a salon (Haryana → Gurugram) → listing has
  `district="Gurugram"`; district filter + business-name + owner-name search all return it;
  consumer dropdown lists all PB+HR districts.
- **Total ≈ 100–145k.**

### Risks / pre-work to flag
- **Backfill:** existing listings have `district = null` and won't match a district filter — a
  one-time script to map each `City.name` → its district is likely needed.
- **City slug collisions:** slugs derive from `cityName`; using district names is fine (PB+HR
  district names are unique), but reconcile with existing free-text cities already in prod.
- Making the district dropdown **required** could block any half-finished onboarding flows —
  decide on validation messaging.

---

## 10. NEXT PHASE (F) — Directory-to-commerce model: tiers, taxonomy & supply

Positioning (locked 2026-06-20): NearByBazar = **a local directory that upgrades into
commerce.** Competitors (IDBF, JustDial, Sulekha) stop at "find a number." We seed the same
broad directory but let a listing **graduate** into a bookable storefront or a full ordering
**app (PWA)**. Single consumer app, tiered supply, PB/HR-first.

### Locked decisions
1. **Listing tiers (3):** every category has a **`defaultTier`**, auto-assigned at onboarding;
   a vendor can **upgrade** later (the "Activate your storefront / your own app" upsell — our
   core differentiator and the sales-agent pitch). NOT every business gets a storefront.
   - **T1 DIRECTORY** (`leadGen`, `vcard`): profile + Call/WhatsApp/Directions. **No storefront.**
     Onboarded via a **single 60-sec form** (sales agent / importer / self). Default for most shops.
   - **T2 BOOKABLE** (`scheduling`, `vcard`): storefront + appointment booking. Salon, doctor, gym.
   - **T3 COMMERCE** (`commerce`, `food`/`retail`): storefront + catalog + ordering/cart (PWA "your
     own app"). Food, grocery, retail-that-sells. Full builder.
   - Tier ⇄ `moduleConfig`: tier is the public label; `moduleConfig` stays the capability source.
     Add an explicit `listingTier` so consumer cards & dashboards render CTAs off it.
2. **Taxonomy = 3 levels everywhere:** **Vertical → Category → Attributes(tags)** (generalize
   Food's existing `subcategories`). Launch **JustDial-scale (~16 verticals)**, gated live via
   `ENABLED_VERTICALS` so we flip them on incrementally.
3. **Supply bootstrap = legitimate, NOT competitor scraping.** Do **not** scrape idbf.in (ToS +
   Indian DB/copyright rights; it 403s bots). Seed **claimable unclaimed T1 stubs** from
   **OSM Overpass** (free) + optionally **Google Places** (richer, needs key) → "Is this your
   business? Claim it" (OTP to listed phone) → existing onboarding. Sales agents later upsell T2/T3.
4. **Premium, mobile-first UI is a first-class requirement.** Real screens are built in Next.js +
   Tailwind with the emerald brand theme, real imagery, generous spacing, and smooth booking/order
   micro-interactions — benchmarked against Zomato / Urban Company polish, not a flat directory. The
   in-chat mockups (§10) are wireframes for IA/flow ONLY; they intentionally can't show final styling.

### The 16 launch verticals (default tier)
| Vertical | Default | Notable categories | Upgrade |
|---|---|---|---|
| Food & Beverage | **T3** | Restaurant, Cafe, Bakery/Cake, Sweet shop, Street food, Cloud kitchen, Tiffin | — |
| Grocery & Daily Needs | **T3** | Kirana, Supermarket, Dairy | — |
| Shops & Retail | **T1** | Optical, Gift, Mobile/Electronics, Apparel, Footwear, Jewellery, Hardware, Stationery | →T3 |
| Salon & Beauty | **T2** | Salon, Spa, Bridal makeup, Nails | — |
| Health & Medical | **T1** | Pharmacy, Clinic, Dental, Diagnostic lab, Hospital, Vet | Doctor→T2 |
| Home & Repair Services | **T1** | AC, RO, Electrician, Plumber, Carpenter, Cleaning, Pest control | →T2 |
| Professional Services | **T1** | CA/Accountant, Lawyer, Insurance, Consultant, Architect, IT | — |
| Education & Coaching | **T1** | School, Coaching, Tuition, Music/Dance, Computer | →T2 |
| Fitness & Wellness | **T2** | Gym, Yoga, Physio, Dietician | — |
| Automotive | **T1** | Car/Bike service, Spare parts, Tyres, Driving school, Car wash | — |
| Real Estate | **T1** | Agent, PG/Hostel, Builder, Rentals | — |
| Hotels & Hospitality | **T1** | Hotel, Banquet, Guest house, Resort | →T2 |
| Events & Wedding | **T1** | Caterer, Photographer, Decorator, DJ, Tent | →T2 |
| Personal Services | **T1** | Tailor, Laundry/Dry-clean, Cobbler, Pet grooming | →T2 |
| Travel & Transport | **T1** | Travel agent, Cab/Taxi, Movers, Courier | — |
| Financial Services | **T1** | Loan agent, Insurance, Mutual fund, ATM | — |

### Experience per tier
- **Onboarding:** T1 = one form (name, category, phone, district, address, hours, optional photo);
  T2 = form + services + short template; T3 = full builder (today's flow).
- **Consumer card CTAs:** T1 → Call / WhatsApp / Directions; T2 → Book + Call; T3 → Order / Menu + Cart.
- **Vendor dashboard:** T1 → profile + leads (call/WhatsApp/requests) + **"Activate storefront" upsell**;
  T2 → + bookings; T3 → + catalog + orders.

### Consumer front door (homepage) — the hub
A transactional front door, not a phonebook. Top→bottom: **(1)** persistent **district bar** (the
PB/HR selector we built) + "near me" geo; **(2)** prominent **search** (business/owner/category/
locality — already supported); **(3)** **16-category grid** of tiles (tap → `/[district]/[category]`);
**(4)** **intent shortcuts** — "Order Food" (T3) / "Book a Salon" (T2) / "Find a Doctor" (T2) /
"Home Repair" (T1); **(5)** **nearby/featured listings** in the chosen district as **tier-aware cards**
(Order / Book / Call), sorted featured→rating→recency (existing logic); **(6)** dual value strip —
"List your business free" + "Get your own ordering app" (T3 teaser); **(7)** **PWA install** prompt;
**(8)** footer with district×category SEO links (the spokes → F3 pages). Logged-in vendors route to
dashboard (existing `AuthenticatedHomeView`). Homepage = hub; programmatic pages = spokes; they share
the listing-card + category-grid + district-selector components.

### Build sequence (dependency-ordered — do top to bottom)
0. **Merge Phase E to `main`** first (it's done + verified; housekeeping, unblocks clean F work).
1. **F0 — Taxonomy & tier foundation:** expand `verticals.js` to 16 verticals + per-category
   `defaultTier`/`upgradeableTo`; add `listingTier` (+ `isClaimed`,`source`,`externalId`; make
   `userId` nullable) to `BusinessProfile`; tier-aware `moduleConfig`. _Foundational — all else renders off it._
2. **F1 — Supply:** OSM Overpass importer (Places deferred) → unclaimed T1 stubs per PB/HR district (so the app isn't empty).
3. **F2 — Consumer front door + discovery:** the homepage above **and** SSR `/[district]/[category]`
   pages, `sitemap.xml`, `schema.org` LocalBusiness JSON-LD (path-based, not subdomains). Built together —
   shared components; needs F0 (tiers) + F1 (listings to show). Attacks IDBF's only moat.
4. **F3 — Tiered onboarding + claim/upgrade:** T1 quick-form vs builder; "Claim it" + "Activate your app".
5. **F4 — Conversion:** PWA install, reviews/ratings (+review JSON-LD feeding F2), tier-aware CTAs.
6. **F5 — Retention:** vendor growth dashboard (views/leads/completeness, claim & upgrade funnels).

_Rationale for the order:_ tiers/taxonomy (F0) define the data everything renders off; supply (F1)
must exist before a homepage or SEO page looks alive; the consumer front door + SEO (F2) come next as
the demand engine; self-serve onboarding/claim (F3) follows since import+agents seed supply initially;
conversion (F4) and retention (F5) optimize the traffic and keep both sides.

### Risks / open
- `userId` is currently required on `BusinessProfile`; unclaimed stubs need it nullable (migration).
- Claiming = the **first OTP use** on the platform (§4 says none today) — reuse WhatsApp/SMS env creds.
- Import source DECIDED (2026-06-20): **OSM Overpass only** to start (free, no key, legal). F0
  schema stays source-agnostic (`source` + `externalId`); Google Places deferred until coverage gaps show.
- Curating ~16 verticals × many categories needs a QA pass before each goes live (`ENABLED_VERTICALS`).
