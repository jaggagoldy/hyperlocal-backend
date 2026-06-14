/**
 * prisma/seed.js
 * Multi-Business Architecture Seed Script (Phase 3A)
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

const slugifyText = (text) => text.toLowerCase().trim().replace(/[\s\W-]+/g, '-');

const randomEl = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomBool = () => Math.random() > 0.5;

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱  HyperLocal Go — Seeding Multi-Business Architecture\n');
  console.log('─'.repeat(45));

  const isProduction = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';
  if (isProduction) {
    console.log('🌱 Production Environment Detected. Seeding clean baseline categories and cities only...');
    
    // Seed standard baseline cities if not exist
    const citiesData = [
      { name: 'Hisar', slug: 'hisar' },
      { name: 'Fatehabad', slug: 'fatehabad' },
      { name: 'Sirsa', slug: 'sirsa' }
    ];
    for (const c of citiesData) {
      await prisma.city.upsert({
        where: { slug: c.slug },
        update: {},
        create: c
      });
    }

    // Seed clean categories only (no fake data, no subcategory deletions)
    const baselineCategories = [
      { name: 'Food & Beverage', slug: 'food-beverage' },
      { name: 'Salon & Spa', slug: 'salon-spa' }
    ];
    const categories = {};
    for (const cat of baselineCategories) {
      categories[cat.slug] = await prisma.category.upsert({
        where: { slug: cat.slug },
        update: { name: cat.name },
        create: cat
      });
    }

    // Seed subcategories
    const subCats = [
      { parent: 'food-beverage', name: 'Restaurant', slug: 'restaurant' },
      { parent: 'food-beverage', name: 'Cloud Kitchen', slug: 'cloud-kitchen' },
      { parent: 'food-beverage', name: 'Street Food', slug: 'street-food' },
      { parent: 'salon-spa', name: 'Salon Booking', slug: 'salon-booking-sub' }
    ];
    for (const sub of subCats) {
      await prisma.category.upsert({
        where: { slug: sub.slug },
        update: { name: sub.name, parentId: categories[sub.parent].id },
        create: { name: sub.name, slug: sub.slug, parentId: categories[sub.parent].id }
      });
    }

    console.log('✅ Clean baseline categories upserted. No fake data seeded.');
    return;
  }

  // 1. CLEAN SLATE
  console.log('🧹  Cleaning up existing data...');
  await prisma.review.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.orderEnquiry.deleteMany({});
  await prisma.catalogItem.deleteMany({});
  await prisma.businessCategory.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.businessSubscription.deleteMany({});
  await prisma.businessMedia.deleteMany({});
  await prisma.businessProfile.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.city.deleteMany({});
  console.log('✓  Cleanup complete.');

  // 2. CITIES
  console.log('\n📍  Creating Cities...');
  const citiesData = [
    { name: 'Hisar', slug: 'hisar' },
    { name: 'Fatehabad', slug: 'fatehabad' },
    { name: 'Sirsa', slug: 'sirsa' }
  ];
  const cities = {};
  for (const c of citiesData) {
    cities[c.slug] = await prisma.city.create({ data: c });
  }

  // 3. CATEGORIES
  console.log('🏷️   Creating Categories...');
  const catNames = ['Food & Beverage', 'Salon & Spa'];
  const categories = {};
  for (const name of catNames) {
    const slug = slugifyText(name);
    categories[slug] = await prisma.category.create({ data: { name, slug } });
  }

  // Create Sub-Categories
  const subCats = [
    { parent: 'food-beverage', name: 'Restaurant', slug: 'restaurant' },
    { parent: 'food-beverage', name: 'Cloud Kitchen', slug: 'cloud-kitchen' },
    { parent: 'food-beverage', name: 'Street Food', slug: 'street-food' },
    { parent: 'salon-spa', name: 'Salon Booking', slug: 'salon-booking-sub' },
  ];

  for (const sub of subCats) {
    categories[sub.slug] = await prisma.category.create({
      data: {
        name: sub.name,
        slug: sub.slug,
        parentId: categories[sub.parent].id
      }
    });
  }

  console.log('🎉  Seed Completed Successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
