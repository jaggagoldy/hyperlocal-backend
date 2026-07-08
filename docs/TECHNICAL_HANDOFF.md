# NearByBazar — Technical Handoff Document

> **Purpose:** This is the single source of truth for any model (Claude, Gemini, GPT, or any future model) to pick up and continue development from exactly where the previous model left off. This document MUST be updated every time a model finishes a batch of work.
>
> **Last Updated:** 2026-07-05 by Claude (Sonnet 5, Anthropic)
> **Last Completed Work:** Sprint 2 Batch 0.1 (Release Impact & Metrics) + Sprint 2 Batch 1 (Customer Discovery) — **Sprint 2 is now complete.** Per product direction, no Sprint 3 work should begin — the next step is a Product Strategy Workshop (vision/positioning/roadmap), not further implementation. See Section 8 for what shipped and Section 11 for what still needs a manual browser pass.

---

## 1. Product Vision

**NearByBazar** is a hyperlocal business discovery platform built for India — starting with Punjab and Haryana — that connects local customers with nearby businesses (salons, restaurants, service providers, etc.).

### Core Product Goals
- Every local business gets a **professional digital identity** — a storefront that feels like their own website, not just a marketplace listing.
- Customers discover businesses by **city + category + proximity**, with trust signals that help them decide fast.
- Vendors manage their entire digital presence from a single **activation-first dashboard**.
- The platform is designed to scale **India-wide** — multi-state, multi-language, multi-vertical.

### Platform Philosophy
| Principle | What it means in code |
|-----------|----------------------|
| India Ready | `state` + `district` driven location (not just city). Punjab & Haryana active now. |
| No unnecessary migrations | New attributes go into `BusinessProfile.metaData` (JSON) first. Schema only when truly needed. |
| File-based over DB for ops | Release registry is git-tracked JSON, not a DB table. |
| Listing Tiers drive UX | `DIRECTORY` → `BOOKABLE` → `COMMERCE` tier drives CTAs, features, and pricing. |
| Activation over analytics | Vendor dashboard answers "What do I do next?" before showing metrics. |

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js + Express (ES modules, `import/export`) |
| **ORM** | Prisma v5 |
| **Database** | PostgreSQL — **Neon serverless** in production, `localhost:5432` in local dev |
| **Image CDN** | Cloudinary (auto-format, smart-crop) |
| **Auth** | JWT, **password-only** (`{ identifier, password }` where identifier is email OR 10-digit phone). Corrected 2026-07-05 — this row previously said "OTP via phone", which `src/modules/auth/auth.routes.js` does not implement (no `/verify-otp` or `/auth/google` route exists; see Section 6). |
| **Frontend (Dashboard + Home)** | Vanilla JS (`src/public/js/app.js`) served by Express |
| **Frontend (Storefront)** | Vanilla JS (`src/public/js/storefront.js`) served at `/s/:slug` |
| **CSS** | Vanilla CSS (`src/public/css/style.css`) |
| **Logging** | Pino (`logger`) |
| **Port** | `5001` |
| **Env** | `.env` (Neon URL, Cloudinary keys, JWT secret, etc.) |

### Starting the Server
```bash
npm install
node src/server.js
# Verify: curl http://localhost:5001/api/v1/ping  → "pong"
```

---

## 3. Repository Structure

```
hyperlocal-platform/
├── prisma/
│   └── schema.prisma              # SINGLE SOURCE OF TRUTH for DB schema
├── releases/                      # File-based release registry (git-tracked)
│   ├── README.md
│   ├── schema.md                  # now documents impact + internal.metrics blocks (Batch 0.1)
│   ├── template.json
│   ├── 1.0.0-digital-identity.json
│   ├── 1.1.0-release-impact-metrics.json    # Sprint 2 · Batch 0.1
│   └── 1.2.0-customer-discovery.json        # Sprint 2 · Batch 1
├── scripts/
│   └── new-release.js             # CLI: npm run release:new
├── docs/
│   ├── TECHNICAL_HANDOFF.md       # THIS FILE — keep it updated after every batch
│   ├── RELEASE_MANAGEMENT.md
│   ├── BATCH_0_COMPLETION.md
│   └── BATCH_3.5_COMPLETION.md
└── src/
    ├── app.js                     # Express app setup
    ├── server.js                  # Entry point (port 5001)
    ├── config/
    │   ├── prisma.js              # Prisma client singleton
    │   ├── env.js                 # Env var loader + ENABLED_VERTICALS
    │   ├── verticals.js           # Vertical config (booking modes, listing tiers, tier;
    │   │                          # now also carries `description` + `seo` stub per vertical — Batch 1)
    │   └── regions.js             # India region registry (states → districts)
    ├── modules/                   # Feature modules (controller + routes per module)
    │   ├── auth/                  # Password-only login (email or phone) + JWT — see Section 2 note
    │   ├── business/              # BusinessProfile CRUD, dashboard, completeness
    │   ├── search/                # Search/explore, cities, categories (enriched),
    │   │                          # + search.autocomplete.js (Batch 1: businesses/categories/localities)
    │   ├── admin/                 # Admin operations (moderation, metrics)
    │   ├── superadmin/            # Superadmin operations
    │   ├── media/                 # Cloudinary upload/delete
    │   ├── analytics/             # Lead analytics
    │   ├── feedback/              # Contact us / Report
    │   ├── reviews/               # Customer reviews
    │   ├── verticals/             # GET /verticals
    │   ├── regions/               # GET /regions
    │   ├── releases/              # Release registry (What's New)
    │   └── users/                 # User profile management
    ├── services/                  # Business logic layer
    │   ├── business.service.js    # Most complex service — read carefully.
    │   │                          # computeCompleteness is now exported (Batch 1, reused by ranking.service.js)
    │   ├── media.service.js       # Cloudinary upload + DB tracking
    │   ├── auth.service.js
    │   ├── search.service.js      # Now applies ranking.service.js for the 'relevance' sort strategy;
    │   │                          # supports sortBy=relevance|rating|newest|open_now (Batch 1)
    │   ├── ranking.service.js     # NEW (Batch 1) — extensible ranking PIPELINE (not a hardcoded formula)
    │   ├── admin.service.js
    │   └── ...
    ├── routes/v1/index.js         # All route mounts under /api/v1. Now ends with a terminal 404
    │                              # handler (Batch 1) — see Section 10 rule #11.
    └── public/                    # Static frontend (served by Express)
        ├── index.html             # Main SPA (home + dashboard). "Explore" nav + homepage search now
        │                          # navigate to /discover instead of the in-SPA search view (Batch 1).
        ├── storefront.html        # Business mini-site template
        ├── whats-new.html         # Public release notes page (now renders the `impact` block, Batch 0.1)
        ├── discovery.html         # NEW (Batch 1) — Customer Discovery page shell (/discover)
        ├── css/style.css          # ALL styles (one file) — now includes .discovery-*/.dc-*/.category-tile/etc.
        └── js/
            ├── app.js             # ~2300+ lines. Monolith. Do not split yet.
            ├── storefront.js      # 1011 lines. Storefront render engine.
            ├── whats-new.js       # Release notes page logic (now renders `impact`)
            └── discovery.js       # NEW (Batch 1) — Customer Discovery engine. Self-contained,
                                   # no shared globals with app.js/storefront.js (same rule as #4 below).
```

---

## 4. Database Schema — Critical Fields

> **Rule:** Do NOT add new DB columns without strong justification. Put new fields in `BusinessProfile.metaData` (JSON) first.

### `BusinessProfile` — core entity
```
id, userId, businessName, slug (unique), registrationNumber (unique)
businessType          // 'FOOD_BEVERAGE' | 'SALON_BEAUTY' | 'HOME_MAINTENANCE' | etc.
listingTier           // 'DIRECTORY' | 'BOOKABLE' | 'COMMERCE'
membershipTier        // 'Free' | 'Starter' | 'Pro'
isFeatured, isClaimed, idVerified, isOnline, isStreetVendor
status                // 'available' | 'busy' | 'closed' | 'emergency' | 'suspended' | 'banned'
operatingHours        // JSON: { mon: { open: '09:00', close: '18:00', closed: false }, ... }
metaData              // JSON: flexible storage — see Section 5
moduleConfig          // JSON: capability blueprints (commerce, scheduling, etc.)
latitude, longitude, localityName, pincode, cityId
rating, createdAt, updatedAt, deletedAt
```

### `BusinessMedia` — images stored in Cloudinary
```
id, businessProfileId, type, secureUrl, publicId
type values: 'profile_image' | 'gallery' | 'verification_doc' | 'cover'
```
> ⚠️ CRITICAL: The field is `businessProfileId` — NOT `vendorId`. Any code touching media MUST use `businessProfileId`.

### Other key models
- `BusinessCategory` — join table (businessProfileId + categoryId)
- `City` — city lookup (name, slug, state, district)
- `User` — platform user (role: 'customer' | 'vendor' | 'admin')
- `CatalogItem` — product/service listings
- `OrderEnquiry` + `OrderItem` — order management
- `Review` — customer reviews
- `LeadAnalytic` — profile_view, call_click, whatsapp_click events
- `Feedback` — ContactUs / Report
- `BusinessSubscription` — tier subscription tracking

---

## 5. `metaData` JSON — What's Stored There

`BusinessProfile.metaData` is the flexible extension point. Known keys:

```json
{
  "highlights": ["Home Delivery", "Wheelchair Accessible", "Same Day Service"],
  "galleryCategories": { "<mediaId>": "Interior" },
  "coverImage": "<cloudinary-url-fallback>",
  "vehicleDetails": { "model": "...", "type": "...", "ac": true, "seats": 4 },
  "restaurantDetails": { "isVeg": true, "fssai": "..." },
  "responseTime": "Responds in ~30 min",
  "description": "Vendor-written 'About' text (also read via .about / .bio aliases)"
}
```

> Note (2026-07-05): `responseTime` and `description`/`about`/`bio` already existed in code
> (`storefront.js` hero stats, `business.service.js` completeness check) but weren't listed
> here before. `responseTime` is now also surfaced on Customer Discovery cards (Batch 1).

> **How to update:** `business.service.js → updateBusinessProfile` merges with spread operator:
> `metaData: { ...existing.metaData, ...incoming.metaData }` — patches individual keys without wiping others.

---

## 6. API Surface — Complete Route Map

All routes are under `/api/v1/`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/ping` | — | Health check |
| POST | `/auth/check-existence` | — | Check if identifier (email/phone) already has an account |
| POST | `/auth/register` | — | Register (password-only) |
| POST | `/auth/login` | — | Login: `{ identifier, password }` — **not OTP**, corrected 2026-07-05 |
| POST | `/auth/forgot-password` / `/auth/reset-password` | — | Password reset flow |
| GET | `/auth/me` | user | Current user profile |
| GET | `/business/me/list` | vendor | List my businesses |
| GET | `/business/me/dashboard` | vendor | Dashboard metrics + completeness score |
| POST | `/business/register` | vendor | Create business profile |
| PATCH | `/business/update` | vendor | Update profile (metaData merges) |
| GET | `/business/:slug` | — | Public storefront data |
| GET | `/search/explore/:citySlug/:categorySlug` | — | Search/explore vendors. Corrected 2026-07-05 (was listed as bare `/search`). Query params: `query, lat, lng, radius, verifiedOnly, businessType, minRating, openNow, state, district, scope, sortBy, page, limit`. `sortBy` (Batch 1): `relevance` (default, ranking.service.js) \| `rating` \| `newest` \| `open_now`. `scope=directory` = full-supply browsing incl. unclaimed stubs (Phase F2). |
| GET | `/search/autocomplete` | — | **NEW (Batch 1).** `?q=` → `{ businesses, categories, localities }`, max 3/3/2. Localities are DB-backed (`City` table), not the static region config. |
| GET | `/search/cities` | — | Canonical PB+HR district list + `hasVendors` flag |
| GET | `/search/categories` | — | Category tree (top-level + subcategories). **Enriched (Batch 1):** each top-level category now also carries `description`, `seo` (keywords/metaTitle/metaDescription stub), and rolled-up `businessCount`. This is the endpoint the frontend actually uses (app.js `loadMetadata()`, discovery.js) — distinct from the flat, unenriched `/categories` below. |
| POST | `/media/upload` | vendor/admin | Upload image to Cloudinary (`multipart`, field `file`) |
| POST | `/media/delete` | vendor/admin | Delete image (mediaId in body — corrected 2026-07-05, was listed as `DELETE /media/delete/:mediaId`) |
| GET | `/verticals` | — | Vertical config for frontend. Each vertical now also has `description` + `seo` stub (Batch 1). |
| GET | `/regions` | — | India region tree |
| GET | `/categories` | — | Flat category list (enabled verticals only) — no descriptions/counts. Prefer `/search/categories` for anything customer-facing (see above). |
| GET | `/analytics/lead` | vendor | Lead analytics |
| POST | `/feedback` | — | Submit feedback / report |
| GET | `/releases` | — | Public release list. Now includes `impact.{customers,businesses,platform}` per release (Batch 0.1). |
| GET | `/releases/:version` | — | Single release |
| GET | `/releases/timeline` | — | Version timeline |
| GET | `/releases/internal` | superadmin | Internal release detail (auth-guarded). Now includes `internal.metrics` scorecard (Batch 0.1) — never exposed publicly. |
| GET | `/admin/businesses` | admin | Paginated business list for moderation |
| POST | `/superadmin/...` | superadmin | Superadmin operations |

### Page routes (not under `/api/v1` — served directly by `app.js`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/s/:slug` | Business storefront |
| GET | `/whats-new` | Public release notes |
| GET | `/discover` | **NEW (Batch 1).** Customer Discovery page — canonical URL, filters read from querystring. |
| GET | `/c/:categorySlug` | **NEW (Batch 1).** SEO alias for `/discover?category=...` — serves the same `discovery.html`. |
| GET | `/l/:locality` | **NEW (Batch 1).** SEO alias for `/discover?locality=...`. |
| GET | `/:district/:category` | **NEW (Batch 1).** Directory-scope discovery page (Phase F2 full-supply browsing). ⚠️ Declared *after* the `/api/v1` mount and *after* `/business/:slug` — see Section 10 rules #11/#12 for why the ordering matters. |
| GET | `/business/:slug` | **NEW (Batch 1).** 301 redirect → `/s/:slug` (canonical/shareable business URL). |

---

## 7. Frontend Architecture

### Two Separate Frontends (same Express server)

| Frontend | Entry | Scope |
|----------|-------|-------|
| Dashboard / Home SPA | `index.html` + `js/app.js` | Customer home, search, auth, vendor dashboard, admin panel |
| Business Storefront | `storefront.html` + `js/storefront.js` | Public-facing business mini-site at `/s/:slug` |
| What's New | `whats-new.html` + `js/whats-new.js` | Public release notes at `/whats-new` |
| Customer Discovery | `discovery.html` + `js/discovery.js` | **NEW (Batch 1).** `/discover`, `/c/:category`, `/l/:locality`, `/:district/:category` all serve this one page/script. |

### `app.js` Key Functions (2300 lines)
```
state {}                        Global app state (user, token, activeBusiness, etc.)
renderApp()                     Main router
showView(viewName)              Switch: home | searchResults | vendorDashboard | adminDashboard
fetchUserProfile()              JWT → /users/me → state.user
loadMetadata()                  Load cities + categories
renderVendorDashboard()         Full dashboard render pipeline
renderJourneySteps()            Activation checklist progress
renderOperatingHoursForm()      Time picker per day of week
switchDashTab()                 Tab switcher (Details / Hours / Gallery / Cover / Highlights)
loadDashboardCoverImage()       Load existing cover from dashboard API
handleCoverImageUpload()        File → /media/upload (type: 'cover')
handleHighlightsUpdate()        Checkboxes → /business/update (metaData.highlights)
renderGallerySection()          Gallery grid + category select per image
handleGalleryUpload()           File → /media/upload (type: 'gallery')
showNotification()              Toast notification
```

### `storefront.js` Key Functions (1011 lines)
```
fetchBusiness(slug)             GET /api/v1/business/:slug
renderHero(biz)                 Business name, type badge, rating, status chips
renderActions(biz)              Call, WhatsApp, Directions, Share, More overflow
renderCover(biz)                Cover banner with onerror fallback
renderHeroStats(biz)            Serving Since | Open Now | Photos | Reviews | Verified
renderTrustSection(biz)         Verified badge, member since, operating hours, payment
renderIdentitySection(biz)      Business story, structured highlights, specialities
renderGallery(biz)              Photo grid with category chips + lightbox
setupLightboxGallery()          Keyboard/click nav for photo lightbox
setupOverflowMenu()             "More" menu (QR, Report) with Escape/outside-click dismiss
setupQRCode()                   QR canvas via qrcode.min.js
computeOpenStatus(hours)        IST-based open/closed with overnight range support
TRUST_TIERS                     Data-driven trust badge registry (extend by appending)
getTrustBadges(biz)             Filter TRUST_TIERS by test() predicates
showNotification()              Storefront-local toast (does NOT use app.js)
```

### `discovery.js` Key Functions (NEW — Sprint 2 · Batch 1, ~500 lines)
```
parseInitialFilters()           Derives filter state from whichever URL booted the page
                                 (/discover querystring, /c/:slug, /l/:slug, or /:district/:category)
updateURL()                     history.pushState → normalizes address bar to /discover?...
                                 (only after the first user interaction — SEO entry URLs stay clean on load)
loadCategories()                GET /search/categories → category grid + filter dropdown
loadLocalities()                GET /search/cities → district pills + locality filter dropdown
executeSearch(resetPage)        GET /search/explore/:citySlug/:categorySlug with all active filters
renderCard(biz)                 Discovery card: cover, logo, badges, trust row, highlights, tier-aware CTA
tierCta(business)                listingTier → { label, icon }: DIRECTORY/BOOKABLE/COMMERCE
computeOpenStatus(hours)        Same IST overnight-aware logic as storefront.js (local copy, not shared)
runAutocomplete / renderAutocomplete   Debounced GET /search/autocomplete → 3-bucket dropdown
setupFilters() / setupSort() / setupPagination() / setupPopState()   Event wiring
```

---

## 8. What Has Been Built — Batch by Batch History

### Sprint 1

#### ✅ Batch 1 — Critical Production Fixes
- Fixed Prisma model name bugs in `admin.service.js`
- Fixed `metaData` replacement bug in `business.service.js` (now merges, not overwrites)
- Fixed frontend regions to call `GET /api/v1/regions` (not static JSON)
- Fixed all vendor dashboard API calls to correct endpoints
- Added `GET /api/v1/admin/businesses` paginated endpoint

#### ✅ Batch 2 — Vendor Activation Dashboard
- Welcome card for new vendors
- Business Health Score (visual progress ring: Red/Orange/Green)
- Guided activation steps (Photos → About → Hours → Category → Verification)
- Operating hours time-picker widget
- QR code panel (View / Download / Share / Copy URL)
- Tab panels (Details / Hours / Gallery)
- `operatingHours` JSON persistence via `PATCH /business/update`

#### ✅ Batch 3 — Storefront Digital Identity
- Business Identity card (Story, Specialisations, Why Choose Us)
- Trust & Verification panel (verified badge, member since, hours, payment modes)
- Action bar (Call, WhatsApp, Directions, QR, Share)
- Gallery with lightbox popup (keyboard nav, backdrop)
- Web Share API integration

#### ✅ Batch 3.5 — Digital Identity Polish (Awaiting product approval)
**Backend changes:**
- `media.service.js`: Fixed `businessProfileId` field. Added `'cover'` type with 3:1 Cloudinary smart-crop. Single-cover enforcement.
- `business.service.js`: `getBusinessBySlug` includes `_count.reviews` for hero stats.

**Storefront additions:**
- `renderCover()` — cover banner with onerror fallback
- `renderHeroStats()` — Serving Since, Open Now, Photos, Reviews, Verified (self-hides missing)
- `TRUST_TIERS` registry + `getTrustBadges()` — data-driven trust badges
- `setupOverflowMenu()` — "More" dropdown with Escape + outside-click dismiss
- `computeOpenStatus()` — overnight hours bug fixed
- Lightbox nav arrows fixed (were clipped on mobile)
- Gallery excludes cover + verification types; shows category chip per photo

**Dashboard additions:**
- Cover image tab: upload/replace/remove with instant local preview
- Structured highlights tab: checkboxes → `metaData.highlights`
- Gallery categorisation: per-image category select → `metaData.galleryCategories`
- Gallery upload/delete now hit real API (were mocks)

---

### Sprint 2

#### ✅ Sprint 2 · Batch 0 — Release Management Foundation
- File-based release registry (`releases/*.json`, no DB migration)
- Release schema, template, scaffolder CLI (`npm run release:new`)
- First real release: `releases/1.0.0-digital-identity.json` (status: released)
- Public API: `GET /api/v1/releases` (strips internal block)
- Internal API: `GET /api/v1/releases/internal` (superadmin-guarded)
- Public `/whats-new` page with debounced search
- `docs/RELEASE_MANAGEMENT.md` workflow documentation

#### ✅ Sprint 2 · Batch 0.1 — Release Impact & Metrics (2026-07-05, by Claude)
**Status: `ready`** — QA-passed, awaiting Product + Deployment approval (`releases/1.1.0-release-impact-metrics.json`).
- Release schema extended with public `impact.{customers,businesses,platform}` (rendered on `/whats-new` as a "Who Benefits" section) and internal-only `internal.metrics.{featuresAdded,improvements,bugFixes,performanceImprovements,securityUpdates,breakingChanges}` scorecard.
- Purely additive: `normalize()` defaults both blocks defensively; `toPublic()` needed no change (already spreads unknown top-level keys, already strips the whole `internal` key). Verified the scaffolder (`scripts/new-release.js`) already propagates both blocks with zero code change.
- Backfilled `releases/1.0.0-digital-identity.json` with real `impact`/`metrics` values so it stays schema-valid.
- `docs/RELEASE_MANAGEMENT.md` updated with the new field reference.

#### ✅ Sprint 2 · Batch 1 — Customer Discovery Foundation (2026-07-05, by Claude)
**Status: `ready`** — QA-passed, awaiting Product + Deployment approval (`releases/1.2.0-customer-discovery.json`). **Not yet browser-tested visually** — see Section 11.
- **New `/discover` page** (+ SEO aliases `/c/:categorySlug`, `/l/:locality`, `/:district/:category`) — one discovery engine, all entry points converge on the same `discovery.html`/`discovery.js`; filters derive from whichever URL booted the page, then behave identically. Interacting normalizes the address bar to `/discover?...` (shareable/bookmarkable); first paint keeps the clean SEO URL.
- **NEW `src/services/ranking.service.js`** — ranking as an extensible *pipeline* of scoring providers (featured, trust/verified, profile completeness, open-now, membership tier, rating, recency), not a hardcoded formula. `search.service.js` applies it for the default `relevance` sort; `rating`/`newest`/`open_now` bypass it for a direct DB sort.
- **NEW `GET /search/autocomplete`** — businesses (DB name match), categories (in-memory, from `verticals.js`), localities (DB `City.name` — deliberately not the static district config, so finer-grained locality names resolve).
- **`GET /search/categories` enriched** — top-level categories now carry `description`, `seo` stub, and a rolled-up `businessCount` (cached grouped query). `verticals.js` gained a `description` + future-ready `seo: {color, keywords, metaTitle, metaDescription}` stub on all 16 verticals.
- **Discovery cards**: cover/logo, verified + open-now badges, structured highlights, "serving since"/"responds in" trust row, **no rating/star UI** (reviews are out of scope this sprint — deliberately not even a "coming soon" placeholder), and **capability-driven CTAs** ("Book Appointment" / "Order Online" / "View Profile & Call" per `listingTier`) linking to the new canonical `/business/:slug` → 301 → `/s/:slug`.
- **Two real bugs found + fixed during testing** (both about route-registration order, not new features): a bare `GET /api/v1` was being swallowed by the new `/:district/:category` wildcard (fixed with a terminal 404 inside the v1 router — see Section 10 rule #11); `/business/:slug` was shadowed by that same wildcard since both are 2-segment paths (fixed by declaring the specific route first — rule #12).
- **Bonus fix**: two dead footer links on `index.html` calling a never-defined `app.navigate(...)` — repointed at `/discover`.
- Verified locally (read-only against the dev DB): ranking order, sortBy variants, autocomplete, category enrichment, all new page routes' status codes. Full detail in `releases/1.2.0-customer-discovery.json` → `internal.technicalChangelog`.

---

## 9. Work Remaining — Roadmap

> **Sprint 2 is now complete** (Batch 0.1 + Batch 1 above). Per product direction this was
> the last planned development sprint — **do not start Sprint 3 or new feature work**. The
> items below (Sprint 1 Batches 4-6) were already queued before that decision; confirm with
> Product whether they're still wanted before touching them, since the explicit instruction
> was to stop and hold a Product Strategy Workshop first.

### Sprint 1

#### 🔲 Batch 4 — Hyperlocal Discovery
> **GATE: Do NOT start until Batch 3.5 is approved by Product.**

| Task | Files |
|------|-------|
| Dynamic category grid from `GET /verticals` | `app.js` |
| Tier-aware CTA on search cards (DIRECTORY→Call, BOOKABLE→Book, COMMERCE→Shop) | `app.js` |
| "Open Now" filter at API level (not client-side) | `search.service.js`, `app.js` |
| "Recently Added" sort option | `search.service.js`, `app.js` |
| District quick-switch pills row | `app.js`, `index.html` |
| Search autocomplete typeahead | `app.js` |
| Current location → reverse-geocode → auto-select district | `app.js` |

#### 🔲 Batch 5 — Admin Operations
| Task | Files |
|------|-------|
| Moderation status change flow | `admin.service.js`, `app.js` |
| Admin dashboard metrics cards | `app.js`, `index.html` |
| Business pagination + claim-state filtering | `admin.service.js`, `app.js` |

#### 🔲 Batch 6 — Product Quality & Polish
| Task | Files |
|------|-------|
| Skeleton shimmers (search + dashboard) | `style.css`, `app.js` |
| Helpful empty states | `app.js`, `storefront.js` |
| Mobile filter sidebar layout | `style.css`, `index.html` |
| Focus trap inside modals | `app.js` |
| `aria-labels` + `loading="lazy"` on images | `index.html`, `storefront.html` |

### Sprint 2

✅ Complete — see Section 8 (Batch 0.1 + Batch 1). No further Sprint 2 batches planned.
Next step is the Product Strategy Workshop, not a Sprint 2 · Batch 2.

---

## 10. Critical Rules — Never Break These

1. **`businessProfileId` not `vendorId`** in any query against `BusinessMedia`.
2. **Always merge `metaData`** — never replace wholesale. Use spread: `{ ...existing.metaData, ...incoming }`.
3. **`app.js` is a 2300-line monolith** — do not split without product approval. Keep appending.
4. **`storefront.js` does NOT share globals with `app.js`** — they load independently. Do not assume shared functions.
5. **No Prisma migrations to Neon (production) without explicit approval.**
6. **`ENABLED_VERTICALS`** in `src/config/env.js` gates business registration. Do not bypass.
7. **Release status lifecycle:** `draft → ready → released`. Only `released` appears on `/whats-new`.
8. **IST timezone** for open/closed. Use `computeOpenStatus()` — don't rewrite it.
9. **India-first location hierarchy:** state + district is canonical. City is secondary.
10. **Backward compatibility is required.** No breaking API changes without version bump.
11. **The `v1Router` (`routes/v1/index.js`) must keep its terminal 404 handler** (added Batch 1). Without it, any unmatched `/api/v1/*` request falls through past the router to the app-level page routes declared after it and gets served the wrong thing (this actually happened with a bare `GET /api/v1` before the fix).
12. **Page routes with the same segment-count must be ordered specific-before-generic.** `/business/:slug` and `/:district/:category` are both 2-segment paths — the specific one MUST be registered first or the generic wildcard swallows it. Keep this in mind before adding any new top-level page route in `app.js`.

---

## 11. Known Issues / Pending Verification

| Issue | Status | Notes |
|-------|--------|-------|
| Cover upload Cloudinary round-trip | ⏳ Needs browser test | Code correct; untested headlessly |
| Cover replace/remove flow | ⏳ Needs browser test | Retirement logic in `media.service.js` |
| Gallery category persistence | ⏳ Needs browser test | Saves to `metaData.galleryCategories` |
| No internal release dashboard UI | 🔲 Deferred | API exists; UI screen not built |
| Admin moderation status change | 🔲 Deferred to Batch 5 | Table renders; actions not wired |
| Customer Discovery (`/discover`) visual/interaction QA | ⏳ Needs browser test | Backend + JS logic verified via curl/node; no browser tooling available in the environment that built it (same gap noted for Phase D). Do a manual pass: search, autocomplete, filters, mobile filter drawer, category tiles, discovery cards. |
| Category icon rendering | 🔲 Cosmetic, low priority | Discovery/category-grid icons render `fa-solid fa-{Category.icon}` directly from the DB's Lucide-style icon names (e.g. `car`, `scissors`). Most match a same-named FontAwesome icon; a few may render blank. Not a functional bug. |
| `/:district/:category` directory-scope differentiation | 🔲 Untested with real data | Logic reuses the existing Phase F2 `scope=directory` path correctly, but the local dev DB has no unclaimed/non-enabled-vertical stub businesses to actually observe a difference vs. transactional scope. |

---

## 12. Environment Variables

```bash
DATABASE_URL=postgresql://...         # Neon (prod) or localhost:5432 (dev)
JWT_SECRET=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
DEFAULT_STATE=Punjab
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
```

Expected startup output:
```
✓ Connected to PostgreSQL database via Prisma
✓ Categories and subcategories synchronized with verticals config
✓ Server listening to port 5001
```

---

## 13. How to Update This Document After Each Batch

1. Move the completed batch from "Work Remaining" → "What Has Been Built"
2. Update the `Last Updated` and `Last Completed Work` header lines
3. Add any new `metaData` keys to Section 5
4. Add any new API endpoints to Section 6
5. Add any new key functions to Section 7
6. Update known issues in Section 11
7. Record the release:
```bash
npm run release:new -- --version X.Y.Z --name "Batch Name" --sprint "Sprint N" --batch "Batch N"
```

---

*This document is the engineering contract. When in doubt: follow the product vision in Section 1 and the rules in Section 10.*
