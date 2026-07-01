/**
 * LOCAL DEV SEED — throwaway test data for the local Postgres dev DB ONLY.
 * Creates: cities (mirrored from prod), one category per vertical,
 * 50 customer users (user1..user50) and 60 vendor users (vendor1..vendor60),
 * each vendor owning one BusinessProfile spread across all 16 verticals & cities.
 * Login: <name>@test.com / 12345678  (e.g. vendor7@test.com, user23@test.com)
 *
 * Run with the LOCAL db url:
 *   DATABASE_URL="postgresql://goldy@localhost:5432/hyperlocal_dev" node scripts/seed-dev-testdata.cjs
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const LOCAL_URL = process.env.DATABASE_URL || 'postgresql://goldy@localhost:5432/hyperlocal_dev';
if (!LOCAL_URL.includes('localhost')) {
  console.error('REFUSING TO RUN: DATABASE_URL is not localhost. Got:', LOCAL_URL);
  process.exit(1);
}
const prisma = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } });

// ── helpers ───────────────────────────────────────────────────────────────
const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const sample = (arr, k) => [...arr].sort(() => Math.random() - 0.5).slice(0, k);
const between = (a, b) => a + rnd(b - a + 1);
const round1 = (n) => Math.round(n * 10) / 10;
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── prod cities (mirrored) ──────────────────────────────────────────────────
const cityFile = path.join(
  '/private/tmp/claude-501/-Users-goldy-Desktop-hyperlocal-platform/465abf6c-00f5-4fb4-acb8-fba8446250cf/scratchpad',
  'prod-cities.json'
);
const PROD_CITIES = JSON.parse(fs.readFileSync(cityFile, 'utf8'));

// ── vertical blueprints ──────────────────────────────────────────────────────
const FOOD_IMG = [
  'photo-1517248135467-4c7edcad34c4', 'photo-1555396273-367ea4eb4db5',
  'photo-1414235077428-338989a2e8c0', 'photo-1552566626-52f8b828add9',
  'photo-1466978913421-dad2ebd01d17',
];
const SHOP_IMG = [
  'photo-1441986300917-64674bd600d8', 'photo-1604719312566-8912e9227c6a',
  'photo-1556742049-0cfed4f6a45d', 'photo-1578916171728-46686eac8d58',
];
const SERVICE_IMG = [
  'photo-1521590832167-7bcbfaa6381f', 'photo-1600948836101-f9ffda59d250',
  'photo-1581578731548-c64695cc6952', 'photo-1554224155-6726b3ff858f',
];
const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=70`;

const CUISINES = ['North Indian', 'South Indian', 'Chinese', 'Italian', 'Continental', 'Fast Food', 'Mughlai', 'Punjabi', 'Street Food'];
const OFFERS = [
  { code: 'FLAT20', title: '20% OFF up to ₹100', discount: '20%' },
  { code: 'WELCOME50', title: '₹50 OFF on first order', discount: '50' },
  { code: 'FREEDEL', title: 'Free Delivery above ₹199', discount: '0' },
  { code: 'SAVE15', title: '15% OFF entire menu', discount: '15%' },
];

// businessType -> blueprint
const VERTICALS = [
  { type: 'FOOD_BEVERAGE', arch: 'FOOD', cat: { slug: 'food-beverage', name: 'Food & Beverage' }, tier: 'COMMERCE', booking: 'ORDER', theme: 'food', imgs: FOOD_IMG,
    names: ['Spice Junction', 'The Curry Leaf', 'Tandoori Nights', 'Punjabi Dhaba', 'Cafe Mocha', 'Biryani House', 'Pizza Corner', 'Chaat Bazaar', 'Royal Treat', 'Green Chilli'] },
  { type: 'GROCERY', arch: 'PRODUCT', cat: { slug: 'grocery', name: 'Grocery & Daily Needs' }, tier: 'COMMERCE', booking: 'CART', theme: 'retail', imgs: SHOP_IMG,
    names: ['Daily Fresh Mart', 'Apna Kirana Store', 'SuperSave Bazaar', 'FreshPick Grocery', 'Annapurna Stores', 'QuickBuy Mart'] },
  { type: 'RETAIL', arch: 'PRODUCT', cat: { slug: 'shops-retail', name: 'Shops & Retail' }, tier: 'DIRECTORY', booking: 'REQUEST_TO_BOOK', theme: 'retail', imgs: SHOP_IMG,
    names: ['Trendz Apparel', 'Mobile World', 'Gupta Electronics', 'Style Studio', 'The Gift Gallery', 'Sole Mate Footwear'] },
  { type: 'SALON_BEAUTY', arch: 'SERVICE', cat: { slug: 'salon-beauty', name: 'Salon & Beauty' }, tier: 'BOOKABLE', booking: 'DIRECT_BOOK', theme: 'trust-utility', imgs: SERVICE_IMG,
    names: ['Glamour Salon', 'The Style Lounge', 'Blush Beauty Bar', 'Scissors & Co', 'Bliss Spa', 'Mirror Mirror Salon'] },
  { type: 'HEALTH_MEDICAL', arch: 'SERVICE', cat: { slug: 'health-medical', name: 'Health & Medical' }, tier: 'DIRECTORY', booking: 'REQUEST_TO_BOOK', theme: 'trust-utility', imgs: SERVICE_IMG,
    names: ['City Care Clinic', 'Wellness Pharmacy', 'LifeLine Diagnostics', 'Smile Dental Care', 'Apollo Med Store'] },
  { type: 'HOME_ESSENTIALS', arch: 'SERVICE', cat: { slug: 'home-repair', name: 'Home & Repair Services' }, tier: 'DIRECTORY', booking: 'REQUEST_TO_BOOK', theme: 'trust-utility', imgs: SERVICE_IMG,
    names: ['QuickFix Electricals', 'Cool Breeze AC Repair', 'AquaPure RO Services', 'Sharma Plumbing', 'Sparkle Home Cleaning'] },
  { type: 'PROFESSIONAL_SERVICES', arch: 'SERVICE', cat: { slug: 'professional-services', name: 'Professional Services' }, tier: 'DIRECTORY', booking: 'REQUEST_TO_BOOK', theme: 'trust-utility', imgs: SERVICE_IMG,
    names: ['Verma & Associates CA', 'LegalEdge Advocates', 'SecureLife Insurance', 'BuildRight Architects'] },
  { type: 'EDUCATION', arch: 'SERVICE', cat: { slug: 'education', name: 'Education & Coaching' }, tier: 'DIRECTORY', booking: 'REQUEST_TO_BOOK', theme: 'trust-utility', imgs: SERVICE_IMG,
    names: ['BrightMinds Coaching', 'Genius Tuition Center', 'Rhythm Music Academy', 'TechSkills Computer Classes'] },
  { type: 'FITNESS', arch: 'SERVICE', cat: { slug: 'fitness', name: 'Fitness & Wellness' }, tier: 'BOOKABLE', booking: 'DIRECT_BOOK', theme: 'trust-utility', imgs: SERVICE_IMG,
    names: ['Iron Paradise Gym', 'Zen Yoga Studio', 'FlexFit Physiotherapy', 'NutriLife Dietician'] },
  { type: 'AUTOMOTIVE', arch: 'SERVICE', cat: { slug: 'automotive', name: 'Automotive' }, tier: 'DIRECTORY', booking: 'REQUEST_TO_BOOK', theme: 'trust-utility', imgs: SERVICE_IMG,
    names: ['Speed Motors Service', 'AutoCare Garage', 'TyrePoint', 'Shine Car Wash'] },
  { type: 'REAL_ESTATE', arch: 'SERVICE', cat: { slug: 'real-estate', name: 'Real Estate' }, tier: 'DIRECTORY', booking: 'REQUEST_TO_BOOK', theme: 'trust-utility', imgs: SERVICE_IMG,
    names: ['Dream Homes Realty', 'Prime Property Advisors', 'Comfort PG & Hostel'] },
  { type: 'HOTELS', arch: 'SERVICE', cat: { slug: 'hotels', name: 'Hotels & Hospitality' }, tier: 'DIRECTORY', booking: 'REQUEST_TO_BOOK', theme: 'trust-utility', imgs: SERVICE_IMG,
    names: ['Hotel Grand Palace', 'Royal Banquet Hall', 'Comfort Inn Guest House'] },
  { type: 'EVENTS', arch: 'SERVICE', cat: { slug: 'events', name: 'Events & Wedding' }, tier: 'DIRECTORY', booking: 'REQUEST_TO_BOOK', theme: 'trust-utility', imgs: SERVICE_IMG,
    names: ['Royal Caterers', 'Click Moments Photography', 'Dream Decor Events', 'BeatBox DJ'] },
  { type: 'PERSONAL_SERVICES', arch: 'SERVICE', cat: { slug: 'personal-services', name: 'Personal Services' }, tier: 'DIRECTORY', booking: 'REQUEST_TO_BOOK', theme: 'trust-utility', imgs: SERVICE_IMG,
    names: ['Perfect Stitch Tailors', 'FreshPress Laundry', 'Pawsome Pet Grooming'] },
  { type: 'TRAVEL', arch: 'SERVICE', cat: { slug: 'travel', name: 'Travel & Transport' }, tier: 'DIRECTORY', booking: 'REQUEST_TO_BOOK', theme: 'trust-utility', imgs: SERVICE_IMG,
    names: ['Wanderlust Travels', 'CityRide Cabs', 'SafeMove Packers'] },
  { type: 'FINANCIAL_SERVICES', arch: 'SERVICE', cat: { slug: 'financial-services', name: 'Financial Services' }, tier: 'DIRECTORY', booking: 'REQUEST_TO_BOOK', theme: 'trust-utility', imgs: SERVICE_IMG,
    names: ['EasyLoan Advisors', 'SecureFuture Insurance', 'WealthGrow Mutual Funds'] },
];

const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Priya', 'Ananya', 'Diya', 'Saanvi', 'Aadhya', 'Kavya', 'Riya', 'Neha', 'Pooja', 'Simran', 'Rahul', 'Rohit', 'Amit', 'Sandeep', 'Manish'];
const LAST = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Yadav', 'Kumar', 'Jain', 'Mehta', 'Bansal', 'Goyal', 'Aggarwal', 'Chauhan', 'Malik', 'Bhardwaj'];
const LOCALITIES = ['Model Town', 'Civil Lines', 'Sector 14', 'Old City', 'Railway Road', 'Main Bazaar', 'Sector 7', 'Industrial Area', 'Green Park', 'Adarsh Nagar'];

function metaFor(v) {
  if (v.arch === 'FOOD') {
    const veg = Math.random() < 0.35;
    return {
      cuisines: sample(CUISINES, between(2, 4)),
      isVegOnly: veg,
      dietary: veg ? ['Pure Veg'] : ['Non Veg', 'Pure Veg'],
      avgPrice: pick([150, 200, 250, 300, 400, 500]),
      deliveryTime: pick(['25–30 min', '30–40 min', '35–45 min', '20–30 min']),
      facilities: sample(['Dine-In', 'Takeaway', 'AC Seating', 'Outdoor Seating'], between(1, 3)),
      offers: Math.random() < 0.6 ? [pick(OFFERS)] : [],
    };
  }
  if (v.arch === 'PRODUCT') {
    return {
      product_types: sample(['Fresh Produce', 'Dairy & Bakery', 'Snacks & Beverages', 'Personal Care', 'Home Essentials', 'Apparel', 'Electronics'], between(2, 4)),
      delivery: sample(['Click & Collect', 'Home Delivery'], between(1, 2)),
      avgPrice: pick([100, 200, 500, 1000]),
      offers: Math.random() < 0.5 ? [pick(OFFERS)] : [],
    };
  }
  return {
    services: sample(['Consultation', 'Home Visit', 'Premium Package', 'Quick Service', 'Annual Plan'], between(2, 4)),
    gender: pick(['Unisex', 'Female Only', 'Male Only']),
    experience: `${between(2, 18)} yrs`,
    offers: Math.random() < 0.4 ? [pick(OFFERS)] : [],
  };
}

function catalogFor(v) {
  if (v.arch === 'FOOD') {
    const dishes = ['Paneer Butter Masala', 'Veg Biryani', 'Butter Naan', 'Chicken Tikka', 'Masala Dosa', 'Cold Coffee', 'Gulab Jamun', 'Spring Rolls', 'Dal Makhani', 'Chowmein'];
    return sample(dishes, between(5, 8)).map((t) => ({ title: t, price: pick([90, 120, 150, 180, 220, 260]), veg: Math.random() < 0.5 }));
  }
  if (v.type === 'GROCERY') {
    const items = ['Aashirvaad Atta 5kg', 'Amul Milk 1L', 'Tata Salt 1kg', 'Fortune Oil 1L', 'Maggi 12-pack', 'Surf Excel 1kg', 'Basmati Rice 5kg', 'Sugar 1kg'];
    return sample(items, between(4, 7)).map((t) => ({ title: t, price: pick([45, 60, 120, 199, 250, 499]), veg: true }));
  }
  if (v.type === 'RETAIL') {
    const items = ['Cotton T-Shirt', 'Running Shoes', 'Wireless Earbuds', 'Denim Jeans', 'Wall Clock', 'Leather Wallet'];
    return sample(items, between(3, 6)).map((t) => ({ title: t, price: pick([499, 799, 1299, 1999, 2499]), veg: false }));
  }
  return [];
}

async function main() {
  console.log('→ resetting test data (local only)...');
  await prisma.businessProfile.deleteMany({}); // cascades media, catalog, categories, orders
  await prisma.user.deleteMany({});
  console.log('  cleared users + businesses');

  console.log('→ seeding cities...');
  const cityRows = [];
  for (const c of PROD_CITIES) {
    const row = await prisma.city.upsert({
      where: { slug: c.slug },
      update: {},
      create: { name: c.name, slug: c.slug, state: c.state || 'Haryana', district: c.district || c.name },
    });
    cityRows.push(row);
  }
  console.log(`  ${cityRows.length} cities`);

  console.log('→ seeding categories (one per vertical)...');
  const catByType = {};
  for (const v of VERTICALS) {
    const cat = await prisma.category.upsert({
      where: { slug: v.cat.slug },
      update: { archetype: v.arch },
      create: { name: v.cat.name, slug: v.cat.slug, archetype: v.arch },
    });
    catByType[v.type] = cat;
  }
  console.log(`  ${Object.keys(catByType).length} categories`);

  const passwordHash = await bcrypt.hash('12345678', 12);
  const usedPhones = new Set();
  const phone = () => { let p; do { p = '9' + String(between(100000000, 999999999)); } while (usedPhones.has(p)); usedPhones.add(p); return p; };
  const fullName = () => `${pick(FIRST)} ${pick(LAST)}`;

  console.log('→ seeding 50 customer users (user1..user50)...');
  for (let i = 1; i <= 50; i++) {
    await prisma.user.create({
      data: {
        email: `user${i}@test.com`, passwordHash, name: fullName(), role: 'customer',
        phoneNumber: phone(), hasCustomerProfile: true, isPhoneVerified: true,
      },
    });
  }

  // Weighted city distribution: most vendors land in a few focus districts so
  // each vertical page looks rich; remaining cities still get a sprinkle.
  const FOCUS = ['gurugram', 'hisar', 'fatehabad', 'karnal'];
  const focusCities = cityRows.filter((c) => FOCUS.includes(c.slug));
  const otherCities = cityRows.filter((c) => !FOCUS.includes(c.slug));
  const cityPool = [...focusCities, ...focusCities, ...focusCities, ...otherCities];
  const FLAGSHIP = new Set(['FOOD_BEVERAGE', 'GROCERY', 'SALON_BEAUTY', 'RETAIL', 'HEALTH_MEDICAL']);

  // Build vendor specs (vertical + city) before creating, so vendorN numbering is stable.
  const specs = [];
  let poolCursor = 0;
  for (const v of VERTICALS) {
    const count = FLAGSHIP.has(v.type) ? 12 : 5;
    for (let k = 0; k < count; k++) {
      let city;
      if (k < focusCities.length * (FLAGSHIP.has(v.type) ? 2 : 1)) {
        city = focusCities[k % focusCities.length]; // guarantee per-focus-city coverage
      } else {
        city = cityPool[poolCursor++ % cityPool.length];
      }
      specs.push({ v, city });
    }
  }
  const TOTAL_VENDORS = specs.length;
  console.log(`→ seeding ${TOTAL_VENDORS} vendor users + business profiles (vendor1..vendor${TOTAL_VENDORS})...`);
  const usedSlugs = new Set();
  for (let i = 1; i <= TOTAL_VENDORS; i++) {
    const { v, city } = specs[i - 1];
    const baseName = pick(v.names);
    let slug = slugify(baseName);
    while (usedSlugs.has(slug)) slug = `${slugify(baseName)}-${between(10, 999)}`;
    usedSlugs.add(slug);
    const owner = fullName();

    const user = await prisma.user.create({
      data: {
        email: `vendor${i}@test.com`, passwordHash, name: owner, role: 'vendor',
        phoneNumber: phone(), hasVendorProfile: true, isPhoneVerified: true,
      },
    });

    const meta = metaFor(v);
    const rating = round1(between(35, 49) / 10); // 3.5 – 4.9
    const business = await prisma.businessProfile.create({
      data: {
        userId: user.id,
        businessName: `${baseName} ${city.name}`,
        slug,
        registrationNumber: `NBZ-${String(i).padStart(4, '0')}-${between(1000, 9999)}`,
        businessType: v.type,
        isOnline: Math.random() < 0.8,
        status: 'available',
        metaData: meta,
        moduleConfig: {},
        listingTier: v.tier,
        bookingMode: v.booking,
        themeFlavor: v.theme,
        membershipTier: pick(['Free', 'Free', 'Starter', 'Pro']),
        rating,
        isFeatured: Math.random() < 0.2,
        isClaimed: true,
        source: 'self',
        idVerified: Math.random() < 0.6,
        localityName: `${pick(LOCALITIES)}, ${city.name}`,
        chowkLandmark: `Near ${pick(['Bus Stand', 'Main Chowk', 'Clock Tower', 'Civil Hospital', 'Railway Station'])}`,
        pincode: String(between(121001, 136999)),
        cityId: city.id,
        latitude: round1(between(2840, 2920) / 100),
        longitude: round1(between(7500, 7720) / 100),
        connectionMode: 'REQUIRE_APPROVAL',
        categories: { create: [{ categoryId: catByType[v.type].id }] },
        media: {
          create: [
            { type: 'profile_image', secureUrl: img(pick(v.imgs)), publicId: `dev_${slug}_cover_${i}` },
            { type: 'gallery', secureUrl: img(pick(v.imgs)), publicId: `dev_${slug}_g1_${i}` },
          ],
        },
      },
    });

    const items = catalogFor(v);
    if (items.length) {
      await prisma.catalogItem.createMany({
        data: items.map((it) => ({
          businessProfileId: business.id,
          categoryId: catByType[v.type].id,
          title: it.title,
          price: it.price,
          metaData: { isVeg: it.veg },
          isActive: true,
          isAvailable: true,
        })),
      });
    }
  }

  const [u, b, c, cat, ci] = await Promise.all([
    prisma.user.count(), prisma.businessProfile.count(), prisma.city.count(),
    prisma.category.count(), prisma.catalogItem.count(),
  ]);
  console.log(`\n✅ DONE — users:${u} vendors:${b} cities:${c} categories:${cat} catalogItems:${ci}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
