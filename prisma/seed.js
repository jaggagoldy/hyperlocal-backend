/**
 * prisma/seed.js
 * Overhauled Seed Script for Phase 2 UI Testing
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
  console.log('\n🌱  HyperLocal Go — Seeding Database for Phase 2\n');
  console.log('─'.repeat(45));

  // 1. CLEAN SLATE
  console.log('🧹  Cleaning up existing data...');
  // Dependent tables first
  await prisma.review.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.orderEnquiry.deleteMany({});
  await prisma.catalogItem.deleteMany({});
  await prisma.vendorCategory.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.vendorSubscription.deleteMany({});
  await prisma.vendor.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.city.deleteMany({});
  console.log('✓  Cleanup complete.');

  // 2. CITIES (Strictly Hisar, Fatehabad, Sirsa)
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
  const catNames = ['Restaurant', 'Cloud Kitchen', 'Street Food', 'Salon', 'Home Maintenance', 'Chef'];
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

  // 5. LOCALIZED VENDORS (100+)
  console.log('🏪  Creating 100 Localized Vendors...');
  const businessTypes = ['RESTAURANT', 'CLOUD_KITCHEN', 'CHEF', 'STREET_VENDOR', 'SALON', 'HOME_MAINTENANCE'];
  
  const indianNames = ['Agarwal', 'Sharma', 'Punjabi', 'Delhi', 'Haryana', 'Sardarji', 'Rajput', 'Bikaner'];
  const foodSuffixes = ['Dhaba', 'Sweets', 'Restaurant', 'Kitchen', 'Corner', 'Point', 'Bhojnalaya'];
  
  const vendors = [];

  for (let i = 1; i <= 100; i++) {
    const citySlug = randomEl(['hisar', 'fatehabad', 'sirsa']);
    const city = cities[citySlug];
    const type = randomEl(businessTypes);
    
    let bName = `${randomEl(indianNames)} ${randomEl(foodSuffixes)}`;
    if (type === 'SALON') bName = `${randomEl(['Glamour', 'Style', 'Look', 'Crown'])} Salon & Spa`;
    if (type === 'HOME_MAINTENANCE') bName = `${randomEl(['Quick', 'Reliable', 'Urban', 'Pro'])} Home Services`;
    
    bName = `${bName} ${city.name} ${i}`; // Ensure unique
    const slug = slugifyText(bName);
    
    const isStreetVendor = type === 'STREET_VENDOR';
    
    let catSlug = 'restaurant';
    if (type === 'CLOUD_KITCHEN') catSlug = 'cloud-kitchen';
    if (type === 'STREET_VENDOR') catSlug = 'street-food';
    if (type === 'CHEF') catSlug = 'chef';
    if (type === 'SALON') catSlug = 'salon';
    if (type === 'HOME_MAINTENANCE') catSlug = 'home-maintenance';

    const categoryId = categories[catSlug]?.id;
    
    // Realistic Vendor Data
    const vendorData = {
      businessName: bName,
      slug,
      businessType: type,
      cityId: city.id,
      localityName: `Sector ${randomInt(1, 20)}, ${city.name}`,
      status: 'APPROVED',
      isOnline: randomBool(), // Randomized online status
      operatingHours: {
        "monday": { "open": "10:00", "close": "22:00" },
        "tuesday": { "open": "10:00", "close": "22:00" },
        "wednesday": { "open": "10:00", "close": "22:00" },
        "thursday": { "open": "10:00", "close": "22:00" },
        "friday": { "open": "10:00", "close": "22:00" },
        "saturday": { "open": "09:00", "close": "23:00" },
        "sunday": { "open": "09:00", "close": "23:00" }
      },
      isStreetVendor,
      landmark: isStreetVendor ? `Near ${randomEl(['Bus Stand', 'Railway Station', 'Main Chowk', 'Civil Hospital'])}` : undefined,
      chowkLandmark: !isStreetVendor ? `Main Market Chowk` : undefined,
      themeFlavor: 'zomato-red',
      rating: randomInt(35, 50) / 10,
      registrationNumber: `REG-${citySlug.toUpperCase()}-${i.toString().padStart(4, '0')}`,
      pincode: randomEl(['125001', '125005', '125050', '125055'])
    };

    const isFood = ['RESTAURANT', 'CLOUD_KITCHEN', 'CHEF', 'STREET_VENDOR'].includes(type);
    const catalogItemsData = [];
    
    if (isFood) {
      const menus = [
        { title: 'Paneer Butter Masala', desc: 'Rich and creamy curry made with paneer, spices, onions, tomatoes, cashews and butter.', type: 'veg' },
        { title: 'Gut-Friendly Quinoa Bowls', desc: 'Healthy bowl of quinoa with fresh vegetables and vinaigrette.', type: 'veg' },
        { title: 'High-Protein Anda Bhurji', desc: 'Scrambled eggs loaded with veggies and Indian spices.', type: 'egg' },
        { title: 'Boiled Egg Whites', desc: 'Simple protein packed boiled egg whites.', type: 'egg' },
        { title: 'Chicken Tikka', desc: 'Tender chicken marinated in yogurt and spices, baked in tandoor.', type: 'non-veg' },
        { title: 'Mutton Rogan Josh', desc: 'Aromatic lamb dish of Persian origin.', type: 'non-veg' },
        { title: 'Veg Veggie Burger', desc: 'Crispy veg patty in a soft bun with lettuce and mayo.', type: 'veg' },
      ];

      const numItems = randomInt(3, 5);
      for (let j = 0; j < numItems; j++) {
        const menuItem = randomEl(menus);
        const hasVariants = randomBool() || j % 2 === 0;

        let variants = null;
        if (hasVariants) {
          variants = [
            { id: `v1_${j}`, name: 'Half Portion', priceAdd: 0 },
            { id: `v2_${j}`, name: 'Full Portion', priceAdd: randomInt(40, 100) }
          ];
        }

        catalogItemsData.push({
          categoryId: categoryId,
          title: menuItem.title,
          description: menuItem.desc,
          price: randomInt(100, 400),
          mediaUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
          variants: variants || undefined
        });
      }
    }

    // Nested write for User -> Vendor -> Categories + CatalogItems
    const user = await prisma.user.create({
      data: {
        phoneNumber: `77777777${String(i).padStart(2, '0')}`,
        email: `vendor${i}@example.com`,
        passwordHash: hashPassword('password123'),
        role: 'vendor',
        hasVendorProfile: true,
        isPhoneVerified: true,
        vendor: {
          create: {
            ...vendorData,
            ...(categoryId ? { categories: { create: [{ categoryId }] } } : {}),
            ...(catalogItemsData.length > 0 ? { catalogItems: { create: catalogItemsData } } : {})
          }
        }
      },
      include: {
        vendor: true
      }
    });

    if (user.vendor) {
      vendors.push(user.vendor);
    }
  }

  // 7. MOCK ORDERS & REVIEWS
  console.log('📝  Creating Mock Orders & Reviews...');
  const statuses = ['PENDING', 'CONFIRMED', 'REJECTED', 'COMPLETED', 'CANCELLED'];

  for (let i = 0; i < 100; i++) {
    const user = randomEl(users);
    const vendor = randomEl(vendors);
    
    const isService = ['SALON', 'HOME_MAINTENANCE'].includes(vendor.businessType);
    const orderType = isService ? 'BOOKING' : 'TRANSACTIONAL';
    const status = randomEl(statuses);
    
    // Create the OrderEnquiry
    const order = await prisma.orderEnquiry.create({
      data: {
        vendorId: vendor.id,
        customerId: user.id,
        orderType,
        status,
        customerName: user.name,
        customerPhone: user.phoneNumber,
        serviceLocation: 'Home Address 123',
        totalValue: randomInt(200, 2000),
        scheduledAt: isService ? new Date(Date.now() + randomInt(1, 10) * 86400000).toISOString() : null
      }
    });

    // Add 1 to 3 items to the order
    const items = await prisma.catalogItem.findMany({ where: { vendorId: vendor.id } });
    if (items.length > 0) {
      const numItems = randomInt(1, Math.min(3, items.length));
      for (let j = 0; j < numItems; j++) {
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            catalogItemId: items[j].id,
            quantity: randomInt(1, 3),
            priceAtTimeOfOrder: items[j].price || 100
          }
        });
      }
    }

    // Only create Reviews for COMPLETED orders
    if (status === 'COMPLETED') {
      const rating = randomInt(3, 5); // mostly positive
      const comments = [
        'Amazing experience, highly recommended!',
        'Decent but could be slightly better.',
        'Absolutely loved the service/food.',
      'Delivery was prompt, packaging was neat.',
      'Will definitely order again from here.'
    ];

    await prisma.review.create({
      data: {
        vendorId: vendor.id,
        customerId: user.id,
        orderId: order.id,
        rating,
        comment: randomEl(comments)
      }
    });
    }
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
