import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import { sendSuccess } from '../../utils/responseHandler.js';
import prisma from '../../config/prisma.js';
import { ENABLED_VERTICALS } from '../../config/env.js';
import { VERTICALS } from '../../config/verticals.js';

/**
 * Discovery autocomplete (Sprint 2 · Batch 1). Returns up to 8 suggestions
 * across three buckets — businesses, categories, localities — from a single
 * debounced endpoint. Architecture note: this is a plain substring match today,
 * but every bucket is produced independently and merged only at the response
 * boundary, so a future AI/embedding-based relevance layer can replace any one
 * bucket's implementation without touching the others or the response shape.
 */

const MAX_BUSINESSES = 3;
const MAX_CATEGORIES = 3;
const MAX_LOCALITIES = 2;

// Category suggestions are sourced from verticals.js (vertical + sub-category
// labels), not a DB query — same source of truth the category grid uses.
// Flattened once at module load; every request is then a cheap in-memory filter.
const CATEGORY_INDEX = Object.values(VERTICALS).flatMap((vertical) => [
  { type: 'category', label: vertical.label, slug: vertical.categorySlugs?.[0] || null, verticalKey: vertical.key },
  ...(vertical.subcategories || []).map((sub) => ({
    type: 'category', label: sub.label, slug: sub.slug, verticalKey: vertical.key,
  })),
]);

export const autocompleteController = catchAsync(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) {
    return sendSuccess(res, StatusCodes.OK, 'Autocomplete suggestions fetched successfully', {
      businesses: [], categories: [], localities: [],
    });
  }
  const needle = q.toLowerCase();

  const [businesses, localities] = await Promise.all([
    prisma.businessProfile.findMany({
      where: {
        deletedAt: null,
        businessType: { in: ENABLED_VERTICALS },
        businessName: { contains: q, mode: 'insensitive' },
      },
      select: { id: true, businessName: true, slug: true, businessType: true },
      take: MAX_BUSINESSES,
      orderBy: [{ isFeatured: 'desc' }, { rating: 'desc' }],
    }),
    // Locality suggestions read the DB, not the static district config (CPO
    // decision, 2026-07-05): the district list only has ~45 names, but
    // customers search finer-grained localities ("Sector 62", "Indirapuram")
    // that today only exist as free-text City.name. DB is the source of truth.
    prisma.city.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      select: { name: true, slug: true, state: true, district: true },
      take: MAX_LOCALITIES,
      distinct: ['slug'],
    }),
  ]);

  const categories = CATEGORY_INDEX
    .filter((c) => c.label.toLowerCase().includes(needle))
    .slice(0, MAX_CATEGORIES);

  sendSuccess(res, StatusCodes.OK, 'Autocomplete suggestions fetched successfully', {
    businesses: businesses.map((b) => ({
      type: 'business', id: b.id, label: b.businessName, slug: b.slug, businessType: b.businessType,
    })),
    categories,
    localities: localities.map((l) => ({
      type: 'locality', label: l.name, slug: l.slug, state: l.state, district: l.district,
    })),
  });
});
