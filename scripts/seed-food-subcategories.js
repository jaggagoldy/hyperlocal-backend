/**
 * Seeds the Food & Beverage sub-categories used by the new onboarding
 * (Restaurant, Cloud Kitchen, Street Food, Bakery, Mithai) under the
 * "food-beverage" parent. Idempotent (upsert by slug).
 *
 * Usage: node scripts/seed-food-subcategories.js
 */
import prisma from '../src/config/prisma.js';

const SUBCATS = [
  { slug: 'restaurant', name: 'Restaurant', icon: 'utensils' },
  { slug: 'cloud-kitchen', name: 'Cloud Kitchen', icon: 'chef-hat' },
  { slug: 'street-food', name: 'Street Food', icon: 'sandwich' },
  { slug: 'bakery', name: 'Bakery', icon: 'cake' },
  { slug: 'mithai', name: 'Mithai & Sweets', icon: 'candy' },
];

async function main() {
  // Ensure the Food parent exists.
  const parent = await prisma.category.upsert({
    where: { slug: 'food-beverage' },
    update: { archetype: 'FOOD' },
    create: { name: 'Food & Beverage', slug: 'food-beverage', archetype: 'FOOD', icon: 'utensils' },
  });

  for (const c of SUBCATS) {
    await prisma.category.upsert({
      where: { slug: c.slug },
      update: { parentId: parent.id, archetype: 'FOOD', icon: c.icon },
      create: { name: c.name, slug: c.slug, parentId: parent.id, archetype: 'FOOD', icon: c.icon },
    });
    console.log(`✓ ${c.name} (${c.slug})`);
  }
  console.log('Food sub-categories seeded.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
