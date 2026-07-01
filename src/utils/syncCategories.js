import prisma from '../config/prisma.js';
import { VERTICALS } from '../config/verticals.js';

// Map dev-seed top-level category slugs to their corresponding vertical configuration key.
// This ensures that legacy seed listings pointing to these categories can still resolve subcategories.
const SEED_SLUG_PARENTS = {
  'grocery': 'GROCERY',
  'shops-retail': 'RETAIL',
  'home-repair': 'HOME_ESSENTIALS',
  'education': 'EDUCATION',
  'fitness': 'FITNESS',
  'hotels': 'HOTELS',
  'events': 'EVENTS',
  'travel': 'TRAVEL'
};

export async function syncCategories() {
  // 1. Sync standard categories from verticals.js configuration
  for (const [key, v] of Object.entries(VERTICALS)) {
    const topSlug = v.categorySlugs && v.categorySlugs[0] 
      ? v.categorySlugs[0] 
      : key.toLowerCase().replace(/_/g, '-');
      
    // Upsert main top-level category
    const topCategory = await prisma.category.upsert({
      where: { slug: topSlug },
      update: {
        name: v.label,
        archetype: v.archetype,
        icon: v.icon || null
      },
      create: {
        name: v.label,
        slug: topSlug,
        archetype: v.archetype,
        icon: v.icon || null
      }
    });

    // Upsert subcategories
    if (v.subcategories) {
      for (const sub of v.subcategories) {
        await prisma.category.upsert({
          where: { slug: sub.slug },
          update: {
            name: sub.label,
            parentId: topCategory.id,
            archetype: v.archetype,
            icon: sub.icon || null
          },
          create: {
            name: sub.label,
            slug: sub.slug,
            parentId: topCategory.id,
            archetype: v.archetype,
            icon: sub.icon || null
          }
        });
      }
    }
  }

  // 2. Sync legacy/seed category aliases to keep older business profiles functional
  for (const [seedSlug, verticalKey] of Object.entries(SEED_SLUG_PARENTS)) {
    const v = VERTICALS[verticalKey];
    if (!v) continue;

    // Check if the seed category already exists, if not create it
    const seedCategory = await prisma.category.upsert({
      where: { slug: seedSlug },
      update: {
        name: v.label,
        archetype: v.archetype,
        icon: v.icon || null
      },
      create: {
        name: v.label,
        slug: seedSlug,
        archetype: v.archetype,
        icon: v.icon || null
      }
    });

    // Link subcategories to the seed category as well (if not already matched)
    if (v.subcategories) {
      for (const sub of v.subcategories) {
        // Subcategory slugs are unique, but we want to make sure they exist and have a valid parent
        // If they already exist, we keep their main parent, but we can ensure they exist.
        await prisma.category.upsert({
          where: { slug: sub.slug },
          update: {
            name: sub.label,
            archetype: v.archetype,
            icon: sub.icon || null
          },
          create: {
            name: sub.label,
            slug: sub.slug,
            parentId: seedCategory.id,
            archetype: v.archetype,
            icon: sub.icon || null
          }
        });
      }
    }
  }
}
