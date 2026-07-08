import { computeCompleteness } from './business.service.js';

/**
 * Ranking pipeline (Sprint 2 · Batch 1) — an ordered list of scoring providers,
 * not a hardcoded formula. Each provider receives (business, context) and
 * returns a numeric contribution to the business's rank score; the pipeline
 * sums every contribution. Extend by pushing a new provider — no existing
 * provider or call site (search.service.js) needs to change. This is what lets
 * a future AI-relevance score or a personalization signal slot in later
 * without a redesign.
 *
 * Pipeline order (documentation of intent — every provider is additive, so
 * order doesn't change the math, but this mirrors how the ranking is reasoned
 * about): base ranking -> trust signals -> completeness -> featured ->
 * (future) AI relevance -> (future) personalization.
 */

const featuredProvider = (business) => (business.isFeatured ? 100 : 0);

const trustProvider = (business) => (business.idVerified ? 25 : 0);

const completenessProvider = (business) => {
  const { percent } = computeCompleteness(business);
  return (percent / 100) * 20; // 0-20 pts
};

const openNowProvider = (business) => (business.isOnline ? 15 : 0);

const membershipProvider = (business) => {
  if (business.membershipTier === 'Pro') return 10;
  if (business.membershipTier === 'Starter') return 5;
  return 0;
};

// Reviews are out of scope for Sprint 2 (no card surfaces a rating), but the
// `rating` column already exists and defaults to 0, so this provider costs
// nothing today and activates automatically once reviews ship — no pipeline
// change needed then either.
const ratingProvider = (business) => (business.rating || 0) * 2; // 0-5 -> 0-10 pts

const RECENCY_WINDOW_DAYS = 90;
const RECENCY_MAX_POINTS = 8;
const recencyProvider = (business, { now = Date.now() } = {}) => {
  if (!business.createdAt) return 0;
  const ageDays = (now - new Date(business.createdAt).getTime()) / 86400000;
  return Math.max(0, RECENCY_MAX_POINTS - (ageDays / RECENCY_WINDOW_DAYS) * RECENCY_MAX_POINTS);
};

export const RANKING_PIPELINE = [
  { key: 'featured', run: featuredProvider },
  { key: 'trust', run: trustProvider },
  { key: 'completeness', run: completenessProvider },
  { key: 'openNow', run: openNowProvider },
  { key: 'membership', run: membershipProvider },
  { key: 'rating', run: ratingProvider },
  { key: 'recency', run: recencyProvider },
  // Future: { key: 'aiRelevance', run: aiRelevanceProvider }
  // Future: { key: 'personalization', run: personalizationProvider }
];

/** Run every provider in the pipeline for one business and sum contributions. */
export const scoreBusiness = (business, context = {}) => {
  const breakdown = {};
  let total = 0;
  for (const provider of RANKING_PIPELINE) {
    const contribution = provider.run(business, context) || 0;
    breakdown[provider.key] = contribution;
    total += contribution;
  }
  return { score: total, breakdown };
};

/**
 * Re-rank a page of businesses. Attaches `_rankScore` to each result so callers
 * can inspect why an order was produced. Applied in-memory, after the DB's
 * broad filter + primary sort — the DB still owns pagination correctness; this
 * only re-orders the businesses within the page it's given.
 */
export const rankResults = (businesses, context = {}) => {
  const now = Date.now();
  return businesses
    .map((b) => ({ ...b, _rankScore: scoreBusiness(b, { ...context, now }).score }))
    .sort((a, b) => b._rankScore - a._rankScore);
};
