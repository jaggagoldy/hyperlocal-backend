# Sprint 1 — Batch 3.5 (Completion Pass) — Technical Summary

**Scope:** Storefront Digital Identity polish for the **vanilla-JS storefront**
(`src/public/`) served by the Express backend at `/s/:slug`. This is separate
from the Next.js `hyperlocal-frontend` app.

> Data model note: **no schema migration was performed.** The prod DB is Neon and
> was deliberately left untouched. Cover images use a dedicated `BusinessMedia`
> `type = 'cover'`; gallery categories are persisted in
> `BusinessProfile.metaData.galleryCategories` (a `{ mediaId: category }` map).

---

## What shipped, by priority

### Priority 1 — Production bug fixes
- **QR action rebound** to the overflow menu button (`sf-btn-show-qr-overflow`).
  Previously bound to the removed `sf-btn-show-qr` → dead button. (`storefront.js` `setupQRCode`)
- **"More" overflow menu implemented** (`setupOverflowMenu`): toggle open/close,
  dismiss on outside-click and `Escape` (keyboard + mobile safe).
- **Report action wired** (`sf-btn-report-overflow`): posts to `/api/v1/feedback`
  with `type: 'Report'`; falls back to `mailto:` if the endpoint is unavailable.
- Fixed lightbox nav buttons: `items-align` typo → `align-items`, and moved the
  prev/next arrows inside the viewport (`left/right: 8px`) so they aren't clipped on mobile.

### Priority 2 — Customer experience
- **Hero Statistics renderer** (`renderHeroStats`): Serving Since, Open Now/Closed,
  Response Time, Photos Count, Customer Count (review count), Verified. Each metric
  self-hides when its data is missing; the whole row hides if none apply.
- **Cover banner render** (`renderCover`): reads `type:'cover'` media (or
  `metaData.coverImage`), with an `onerror` fallback that hides the banner if the
  image 404s. No cover → banner stays hidden (clean hero).
- Gallery now **excludes** cover + verification docs and shows a per-photo category chip.

### Priority 3 — Merchant management (dashboard, `app.js` + `index.html`)
- **Cover image management**: upload / replace / preview / remove.
  - Instant local preview on file select, then server upload.
  - Server smart-crops covers to a 3:1 banner (Cloudinary `c_fill, g_auto`) — this is
    the automatic "crop". Single-cover is enforced server-side (old cover retired on replace).
- **Structured highlights** are now the primary experience: dashboard checkboxes
  (`name="dash-highlight"`) persist to `metaData.highlights` and hydrate on load.
  Free-form description is retained as optional "Our Story".
- **Gallery categorization**: category `<select>` (Interior/Exterior/Products/
  Services/Team/Menu) persisted per image; shown on storefront + dashboard.
- The old dashboard gallery upload/delete were **client-only mocks** — they now hit
  the real `/media/upload` and `/media/delete` endpoints.

### Priority 4 — Trust architecture
- **Data-driven trust badges** (`TRUST_TIERS` registry + `getTrustBadges`): Featured,
  Verified, Top Rated, Trusted — each with a `test(biz)` predicate. Add future tiers by
  appending to the registry; no redesign. Verified via live test: `biryani-house`
  (isFeatured) → *Featured Partner*; `glamour-salon-177` → *Trusted Seller*.

---

## Backend changes
- `src/services/media.service.js`: added `'cover'` type; cover-specific 3:1 smart-crop
  transformation; single-cover enforcement (retire previous cover on new upload).
- `src/services/business.service.js`: `getBusinessBySlug` now includes
  `_count.reviews` (powers the Customer Count hero stat).

## Bug fixes beyond the brief
- `computeOpenStatus` now handles **overnight hours** (e.g. 18:00–02:00). Verified:
  open at 23:00 IST for an 18:00–02:00 shift (old code reported Closed).
- Added a local `showNotification` toast to `storefront.js` — the storefront page does
  not load `app.js`, so Share/Report callbacks previously referenced an undefined function.

---

## QA checklist

### Regressions
- [x] QR button opens the QR modal (now via the More menu).
- [x] More menu opens/closes; outside-click and Escape dismiss it.
- [x] Existing actions intact: Call, WhatsApp, Directions (hidden when no lat/lng), Share.
- [x] Full render pipeline runs without throwing on live data (2 businesses smoke-tested).

### Empty states
- [x] No cover → banner hidden (hero renders normally).
- [x] No gallery photos → gallery section hidden.
- [x] No operating hours → Open/Closed stat + timing row omitted.
- [x] No trust tier qualifies → "Community Listing" fallback.
- [x] Hero stat row hidden entirely when no metric qualifies.
- [x] Broken cover image URL → `onerror` hides the banner.

### Mobile / responsive
- [x] Lightbox prev/next arrows sit inside the viewport (were clipped at −40px).
- [x] More menu dismiss works with touch (outside-click handler).
- [x] Hero stats wrap (`flex-wrap`); action buttons wrap with min-widths.
- [ ] **Manual pass recommended** on a real device/browser for the dashboard upload
      flows (Cloudinary round-trip) — could not run the browser preview in this
      sandbox (preview runtime had a cwd/EPERM limitation). Backend + render logic
      were verified headlessly against the live API.

### Merchant flows (recommend a manual click-through)
- [ ] Upload cover → appears on storefront banner.
- [ ] Replace cover → old one retired, new shows.
- [ ] Remove cover → banner hidden again.
- [ ] Toggle highlights → appear under "Business Highlights" on storefront.
- [ ] Upload gallery photo with a category → chip shows on storefront + dashboard.
- [ ] Delete gallery photo → removed and category mapping cleaned up.
