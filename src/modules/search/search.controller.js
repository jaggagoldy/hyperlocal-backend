import { StatusCodes } from 'http-status-codes';
import catchAsync from '../../utils/catchAsync.js';
import { exploreVendors } from '../../services/search.service.js';
import { sendPaginated, sendSuccess } from '../../utils/responseHandler.js';
import prisma from '../../config/prisma.js';
import logger from '../../config/logger.js';
import { ENABLED_VERTICALS } from '../../config/env.js';
import { allDistricts } from '../../config/regions.js';

// Lightweight in-process TTL cache for rarely-changing metadata (cities/categories),
// which the frontend loads on every page view.
const metaCache = new Map();
const META_TTL_MS = 5 * 60 * 1000;
const getCached = async (key, loader) => {
  const hit = metaCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await loader();
  metaCache.set(key, { value, expires: Date.now() + META_TTL_MS });
  return value;
};

export const exploreVendorsController = catchAsync(async (req, res) => {
  const { citySlug, categorySlug } = req.params;
  const result = await exploreVendors(citySlug, categorySlug, req.query);
  
  // Background search deficit logging
  if (result.meta.total === 0) {
    Promise.resolve()
      .then(async () => {
        await prisma.searchAnalytic.create({
          data: {
            citySlug,
            categorySlug,
            query: req.query.query || '',
            resultsCount: 0,
          },
        });
      })
      .catch((err) => {
        logger.error(err, 'Failed to log search deficit');
      });
  }

  sendPaginated(res, StatusCodes.OK, 'Vendors fetched successfully', result.data, result.meta);
});

export const getCitiesController = catchAsync(async (req, res) => {
  // Consumer location list = the full canonical PB+HR district set (always shown,
  // even districts with zero vendors), each annotated with whether it currently
  // has live listings. Any pre-existing free-text City rows that have vendors but
  // aren't a canonical district are appended so nothing reachable disappears.
  const cities = await getCached('cities', async () => {
    const withVendors = await prisma.city.findMany({
      where: { businessProfiles: { some: { deletedAt: null, businessType: { in: ENABLED_VERTICALS } } } },
      select: { name: true, slug: true, state: true, district: true },
    });

    const vendorDistrictNames = new Set(withVendors.map((c) => c.district).filter(Boolean));
    const vendorCitySlugs = new Set(withVendors.map((c) => c.slug));
    const canonicalSlugs = new Set(allDistricts().map((d) => d.slug));

    // Canonical districts first (filtering by these slugs is district-wide).
    const canonical = allDistricts().map((d) => ({
      name: d.name,
      slug: d.slug,
      state: d.state,
      district: d.name,
      hasVendors: vendorDistrictNames.has(d.name) || vendorCitySlugs.has(d.slug),
    }));

    // Then any vendor-bearing city that isn't itself a canonical district slug.
    const extras = withVendors
      .filter((c) => !canonicalSlugs.has(c.slug))
      .map((c) => ({ name: c.name, slug: c.slug, state: c.state, district: c.district, hasVendors: true }));

    return [...canonical, ...extras];
  });
  sendSuccess(res, StatusCodes.OK, 'Cities fetched successfully', cities);
});

import { VERTICALS } from '../../config/verticals.js';

// Map a top-level Category.slug back to the vertical config that owns it, so
// the category grid can show a description without duplicating copy into the
// DB. Built once at module load; verticals.js is the single source of truth.
const CATEGORY_SLUG_TO_VERTICAL = new Map();
for (const vertical of Object.values(VERTICALS)) {
  for (const slug of vertical.categorySlugs || []) {
    CATEGORY_SLUG_TO_VERTICAL.set(slug, vertical);
  }
}

// Fallback top-level category slugs to support legacy seed configurations
const SEED_FALLBACK_SLUGS = {
  GROCERY: ['grocery', 'retail-grocery'],
  RETAIL: ['shops-retail', 'retail-shop', 'fashion', 'electronics'],
  HOME_ESSENTIALS: ['home-repair', 'home-services', 'repairs-services'],
  EDUCATION: ['education', 'education-coaching'],
  FITNESS: ['fitness', 'fitness-wellness'],
  HOTELS: ['hotels', 'hotels-hospitality'],
  EVENTS: ['events', 'events-wedding'],
  TRAVEL: ['travel', 'travel-transport']
};

export const getCategoriesController = catchAsync(async (req, res) => {
  const { city, onlyAvailable } = req.query;

  const topSlugs = [];
  const subSlugs = [];

  for (const vertical of ENABLED_VERTICALS) {
    const vConfig = VERTICALS[vertical];
    if (vConfig) {
      if (vConfig.categorySlugs) {
        topSlugs.push(...vConfig.categorySlugs);
      }
      
      if (SEED_FALLBACK_SLUGS[vertical]) {
        topSlugs.push(...SEED_FALLBACK_SLUGS[vertical]);
      } else {
        topSlugs.push(vertical.toLowerCase().replace(/_/g, '-'));
      }
      
      if (vConfig.subcategories) {
        subSlugs.push(...vConfig.subcategories.map(s => s.slug));
      }
    }
  }

  let activeCategorySlugs = null;
  if (onlyAvailable === 'true' && city) {
    const activeRelations = await prisma.businessCategory.findMany({
      where: {
        businessProfile: {
          city: { slug: city },
          status: 'APPROVED'
        }
      },
      select: {
        category: {
          select: {
            slug: true,
            parent: {
              select: {
                slug: true
              }
            }
          }
        }
      }
    });

    const slugsSet = new Set();
    for (const rel of activeRelations) {
      if (rel.category) {
        slugsSet.add(rel.category.slug);
        if (rel.category.parent) {
          slugsSet.add(rel.category.parent.slug);
        }
      }
    }
    activeCategorySlugs = Array.from(slugsSet);
  }

  const categoryWhere = {
    parentId: null,
    slug: { in: topSlugs }
  };
  
  if (activeCategorySlugs) {
    categoryWhere.slug = {
      in: topSlugs.filter(s => activeCategorySlugs.includes(s))
    };
  }

  const subcategoryWhere = {
    slug: {
      in: activeCategorySlugs 
        ? subSlugs.filter(s => activeCategorySlugs.includes(s))
        : subSlugs
    }
  };

  const fetchCategoriesFromDb = () => 
    prisma.category.findMany({
      where: categoryWhere,
      include: {
        subcategories: {
          where: subcategoryWhere,
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });

  const categories = activeCategorySlugs
    ? await fetchCategoriesFromDb()
    : await getCached('categories', fetchCategoriesFromDb);

  // Business counts per category (CPO-approved, Batch 1): a single grouped
  // query, cached alongside the metadata TTL cache above — cheap enough that
  // a per-request re-derivation isn't needed, and the cache already
  // auto-refreshes every META_TTL_MS.
  const countsByCategoryId = await getCached('categoryCounts', async () => {
    const rows = await prisma.businessCategory.groupBy({
      by: ['categoryId'],
      where: { businessProfile: { deletedAt: null, businessType: { in: ENABLED_VERTICALS } } },
      _count: { categoryId: true },
    });
    return new Map(rows.map((r) => [r.categoryId, r._count.categoryId]));
  });

  // Enrich each top-level category with its vertical description/SEO stub
  // (verticals.js is the single source of truth — no copy duplicated into the
  // DB) and a rolled-up business count (its own tagged businesses + every
  // sub-category's).
  const enriched = categories.map((cat) => {
    const vertical = CATEGORY_SLUG_TO_VERTICAL.get(cat.slug);
    const ownCount = countsByCategoryId.get(cat.id) || 0;
    const subCount = (cat.subcategories || []).reduce(
      (sum, sub) => sum + (countsByCategoryId.get(sub.id) || 0),
      0
    );
    return {
      ...cat,
      description: vertical?.description || null,
      seo: vertical?.seo || null,
      businessCount: ownCount + subCount,
      subcategories: (cat.subcategories || []).map((sub) => ({
        ...sub,
        businessCount: countsByCategoryId.get(sub.id) || 0,
      })),
    };
  });

  sendSuccess(res, StatusCodes.OK, 'Categories fetched successfully', enriched);
});
