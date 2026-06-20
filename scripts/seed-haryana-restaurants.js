/**
 * Seeds a handful of demo restaurants across Haryana so the home/search pages
 * aren't empty for early visitors. Idempotent: skips any slug that already exists.
 *
 * Usage: node scripts/seed-haryana-restaurants.js
 * Vendor login for all seeded accounts: password "Test1234".
 */
import bcrypt from 'bcryptjs';
import slugify from 'slugify';
import prisma from '../src/config/prisma.js';

const RESTAURANTS = [
  { name: 'Saffron Tandoori', city: 'Gurugram', district: 'Gurugram', pincode: '122001', locality: 'Sector 29', lat: 28.4595, lng: 77.0726, rating: 4.6, veg: false, menu: [['Butter Chicken', 320], ['Dal Makhani', 220], ['Garlic Naan', 60]] },
  { name: 'Green Leaf Pure Veg', city: 'Faridabad', district: 'Faridabad', pincode: '121001', locality: 'NIT', lat: 28.4089, lng: 77.3178, rating: 4.4, veg: true, menu: [['Paneer Tikka', 240], ['Veg Thali', 180], ['Masala Dosa', 120]] },
  { name: 'Karnal Biryani House', city: 'Karnal', district: 'Karnal', pincode: '132001', locality: 'Mall Road', lat: 29.6857, lng: 76.9905, rating: 4.5, veg: false, menu: [['Chicken Biryani', 260], ['Mutton Biryani', 340], ['Raita', 50]] },
  { name: 'Hisar Chaat Bhandar', city: 'Hisar', district: 'Hisar', pincode: '125001', locality: 'Red Square Market', lat: 29.1492, lng: 75.7217, rating: 4.2, veg: true, menu: [['Aloo Tikki', 70], ['Golgappe', 50], ['Samosa Chaat', 90]] },
  { name: 'Rohtak Rasoi', city: 'Rohtak', district: 'Rohtak', pincode: '124001', locality: 'Delhi Road', lat: 28.8955, lng: 76.6066, rating: 4.3, veg: false, menu: [['Chole Bhature', 110], ['Rajma Chawal', 130], ['Lassi', 60]] },
];

async function main() {
  // Pick a live food category to attach listings + menu items to.
  const category = await prisma.category.findFirst({
    where: { slug: { in: ['restaurant', 'food-beverage', 'food-dining', 'restaurant-cafe'] } },
  });
  if (!category) {
    throw new Error('No food category found — seed categories first.');
  }

  const passwordHash = await bcrypt.hash('Test1234', 12);
  let created = 0;

  for (const r of RESTAURANTS) {
    const slug = slugify(`${r.name}-${r.locality}-${r.city}`, { lower: true, strict: true });
    if (await prisma.businessProfile.findUnique({ where: { slug } })) {
      console.log(`• skip (exists): ${r.name}`);
      continue;
    }

    // City (upsert by slug) with Haryana state/district.
    const citySlug = slugify(r.city, { lower: true, strict: true });
    const city = await prisma.city.upsert({
      where: { slug: citySlug },
      update: { state: 'Haryana', district: r.district },
      create: { name: r.city, slug: citySlug, state: 'Haryana', district: r.district },
    });

    // Vendor account.
    const email = `${slugify(r.name, { lower: true, strict: true })}@demo.nearbybazar.in`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name: r.name, role: 'vendor', passwordHash, hasVendorProfile: true },
    });

    // Listing.
    const business = await prisma.businessProfile.create({
      data: {
        userId: user.id,
        businessName: r.name,
        slug,
        registrationNumber: `BP-${slug.toUpperCase().slice(0, 18)}-${Math.floor(1000 + Math.random() * 9000)}`,
        businessType: 'FOOD_BEVERAGE',
        isOnline: true,
        status: 'available',
        rating: r.rating,
        idVerified: true,
        localityName: r.locality,
        pincode: r.pincode,
        cityId: city.id,
        latitude: r.lat,
        longitude: r.lng,
        workingDays: 'All Days',
        timeAvailability: '10 AM - 11 PM',
        metaData: { restaurantDetails: { isVeg: r.veg } },
        categories: { create: [{ categoryId: category.id }] },
        catalogItems: {
          create: r.menu.map(([title, price]) => ({
            categoryId: category.id,
            title,
            price,
            isActive: true,
            isAvailable: true,
            metaData: { isVeg: r.veg },
          })),
        },
      },
    });
    created++;
    console.log(`✓ ${r.name} (${r.city}) → /s/${business.slug}`);
  }

  console.log(`\nDone. Created ${created} restaurant(s).`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
