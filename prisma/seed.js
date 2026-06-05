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
  const catNames = ['Food & Beverage', 'Salon & Spa', 'Home Maintenance', 'Cab Service'];
  const categories = {};
  for (const name of catNames) {
    const slug = slugifyText(name);
    categories[slug] = await prisma.category.create({ data: { name, slug } });
  }

  // 4. USERS (Dummy Customers)
  console.log('👥  Creating Dummy Users...');
  const users = [];
  for (let i = 1; i <= 10; i++) {
    const user = await prisma.user.create({
      data: {
        name: `Test Customer ${i}`,
        customerName: `Test Customer ${i}`,
        phoneNumber: `999999990${i}`,
        email: `customer${i}@example.com`,
        passwordHash: hashPassword('password123'),
        role: 'customer',
        hasCustomerProfile: true,
        isPhoneVerified: true
      }
    });
    users.push(user);
  }

  // 5. MAJOR VENDORS WITH MULTIPLE BUSINESSES
  console.log('🌟  Creating Users with Multiple Businesses...');
  
  // Create a power user who owns multiple businesses
  const powerUser = await prisma.user.create({
    data: {
      phoneNumber: '8888888800',
      email: 'admin@grandkitchen.com',
      passwordHash: hashPassword('password123'),
      role: 'vendor',
      hasVendorProfile: true,
      isPhoneVerified: true,
      name: 'Rahul Aggarwal'
    }
  });

  const city = cities['hisar'];

  // Business 1: The Grand Kitchen (Food)
  const businessFood = await prisma.businessProfile.create({
    data: {
      userId: powerUser.id,
      businessName: 'The Grand Kitchen',
      slug: 'the-grand-kitchen',
      businessType: 'FOOD_BEVERAGE',
      cityId: city.id,
      localityName: 'Sector 14, Hisar',
      status: 'APPROVED',
      isOnline: true,
      rating: 4.8,
      registrationNumber: `REG-MAJOR-F1`,
      pincode: '125001',
      membershipTier: 'Pro',
      metaData: { cuisine: 'North Indian', seating: true, pureVeg: false },
      categories: { create: [{ categoryId: categories['food-beverage'].id }] },
      catalogItems: {
        create: [
          { categoryId: categories['food-beverage'].id, title: 'Chicken Biryani', price: 300, metaData: { dietary: 'non-veg', spicyLevel: 'high' } },
          { categoryId: categories['food-beverage'].id, title: 'Paneer Butter Masala', price: 250, metaData: { dietary: 'veg', spicyLevel: 'medium' } }
        ]
      }
    }
  });

  // Business 2: Rahul's Swift Cabs (Transport)
  const businessCab = await prisma.businessProfile.create({
    data: {
      userId: powerUser.id, // SAME USER!
      businessName: "Rahul's Swift Cabs",
      slug: 'rahuls-swift-cabs',
      businessType: 'CAB_TRANSPORT',
      cityId: city.id,
      localityName: 'Railway Station Road',
      status: 'APPROVED',
      isOnline: true,
      rating: 4.5,
      registrationNumber: `REG-MAJOR-C1`,
      pincode: '125001',
      metaData: { vehicleType: 'Sedan', ac: true, seats: 4, model: 'Swift Dzire' },
      categories: { create: [{ categoryId: categories['cab-service'].id }] },
      catalogItems: {
        create: [
          { categoryId: categories['cab-service'].id, title: 'City to Airport Drop', price: 1500, metaData: { estimatedHours: 4 } },
          { categoryId: categories['cab-service'].id, title: 'Local 8hr/80km Rental', price: 2000, metaData: { extraKmRate: 12 } }
        ]
      }
    }
  });

  // Business 3: A Salon User
  const salonUser = await prisma.user.create({
    data: {
      phoneNumber: '8888888802',
      email: 'hello@elitegrooming.com',
      passwordHash: hashPassword('password123'),
      role: 'vendor',
      hasVendorProfile: true,
      isPhoneVerified: true,
      name: 'Priya Sharma'
    }
  });

  await prisma.businessProfile.create({
    data: {
      userId: salonUser.id,
      businessName: 'Elite Grooming Spa',
      slug: 'elite-grooming-spa',
      businessType: 'SALON_BEAUTY',
      cityId: city.id,
      localityName: 'Model Town',
      status: 'APPROVED',
      isOnline: true,
      rating: 4.9,
      registrationNumber: `REG-MAJOR-S1`,
      pincode: '125005',
      metaData: { genderServed: 'Unisex', parkingAvailable: true },
      categories: { create: [{ categoryId: categories['salon-spa'].id }] },
      catalogItems: {
        create: [
          { categoryId: categories['salon-spa'].id, title: 'Premium Haircut', price: 500, metaData: { durationMinutes: 45, targetGender: 'male' } },
          { categoryId: categories['salon-spa'].id, title: 'Bridal Makeup', price: 5000, metaData: { durationMinutes: 180, targetGender: 'female' } }
        ]
      }
    }
  });

  // Business 4: A Home Services User
  const homeUser = await prisma.user.create({
    data: {
      phoneNumber: '8888888803',
      email: 'contact@profixhome.com',
      passwordHash: hashPassword('password123'),
      role: 'vendor',
      hasVendorProfile: true,
      isPhoneVerified: true,
      name: 'Amit Verma'
    }
  });

  await prisma.businessProfile.create({
    data: {
      userId: homeUser.id,
      businessName: 'ProFix Home Services',
      slug: 'profix-home-services',
      businessType: 'HOME_ESSENTIALS',
      cityId: city.id,
      localityName: 'Urban Estate',
      status: 'APPROVED',
      isOnline: true,
      rating: 4.6,
      registrationNumber: `REG-MAJOR-H1`,
      pincode: '125005',
      metaData: { emergencyService: true, insured: true },
      categories: { create: [{ categoryId: categories['home-maintenance'].id }] },
      catalogItems: {
        create: [
          { categoryId: categories['home-maintenance'].id, title: 'AC Deep Cleaning', price: 600, metaData: { includesGas: false } },
          { categoryId: categories['home-maintenance'].id, title: 'Plumbing Repair', price: 300, metaData: { baseVisitCharge: 200 } }
        ]
      }
    }
  });

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
