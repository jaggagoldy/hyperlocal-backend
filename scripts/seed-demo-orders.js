/**
 * seed-demo-orders.js
 *
 * Creates realistic order history for all 50 demo customer accounts and
 * incoming orders/leads for all 115 demo vendor accounts.
 *
 * Run: DATABASE_URL="postgresql://goldy@localhost:5432/hyperlocal_dev" \
 *      node scripts/seed-demo-orders.js
 *
 * What it seeds:
 *  - 3 orders per customer (PENDING → CONFIRMED → COMPLETED)
 *  - 2–4 additional "guest" orders per vendor (so vendor dashboards show activity)
 *  - Mix of TRANSACTIONAL (food/grocery/retail) and SERVICE_BOOKING (salon/health/etc.)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── realistic Indian customer names & locations ─────────────────────────────

const GUEST_NAMES = [
  'Rajesh Kumar', 'Sunita Devi', 'Vikram Singh', 'Pooja Sharma', 'Amit Jain',
  'Kavita Gupta', 'Deepak Verma', 'Rekha Agarwal', 'Suresh Yadav', 'Nisha Chauhan',
  'Manish Bansal', 'Priya Mehta', 'Anil Bhardwaj', 'Seema Rawat', 'Ravi Malhotra',
  'Geeta Dubey', 'Mohit Tiwari', 'Sonal Pandey', 'Vikas Saxena', 'Anju Mishra',
  'Harish Garg', 'Meena Kapoor', 'Naveen Arora', 'Shikha Nair', 'Pawan Batra',
  'Suneel Kaur', 'Dinesh Chopra', 'Ritu Sehgal', 'Yogesh Khanna', 'Poonam Sethi',
];

const GUEST_PHONES = [
  '9876543210', '8765432109', '7654321098', '6543210987', '9988776655',
  '8877665544', '7766554433', '6655443322', '9900112233', '8811223344',
  '7722334455', '6633445566', '9123456789', '8234567890', '7345678901',
  '6456789012', '9567890123', '8678901234', '7789012345', '6890123456',
  '9012345678', '8901234567', '7890123456', '6789012345', '9234567801',
  '8345678912', '7456789023', '6567890134', '9678901245', '8789012356',
];

const LOCATIONS = [
  'Sector 14, Hisar', 'Model Town, Fatehabad', 'Subhash Nagar, Karnal',
  'DLF Phase 2, Gurugram', 'Civil Lines, Panipat', 'Old City, Ambala',
  'Rohtak Road, Jhajjar', 'Patel Nagar, Sonipat', 'Green Park, Faridabad',
  'Shastri Colony, Sirsa', 'Arjun Nagar, Rohtak', 'Rajiv Colony, Rewari',
];

const FOOD_MESSAGES = [
  'Please pack everything neatly',
  'Extra gravy please',
  'Less spicy for 2 kids',
  'Please add 2 extra rotis',
  'Deliver to gate, I will come down',
  'No onion in the salad please',
];

const SERVICE_MESSAGES = [
  'Please confirm availability before visiting',
  'Preferred timing: after 5 PM',
  'Home visit required at the above address',
  'Available on weekdays only',
  'Urgent — please call first',
  'Can we schedule for Saturday morning?',
];

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('── Seed: Demo Orders ─────────────────────────────────────────');

  // 1. Wipe existing orders for a clean slate
  const deleted = await prisma.orderEnquiry.deleteMany({});
  console.log(`Cleared ${deleted.count} existing orders`);

  // 2. Load all customer users
  const customers = await prisma.user.findMany({
    where: { hasCustomerProfile: true },
    orderBy: { email: 'asc' },
    select: { id: true, name: true, phoneNumber: true, email: true },
  });
  console.log(`Loaded ${customers.length} customer accounts`);

  // 3. Load all businesses with their catalog items, grouped by businessType
  const businesses = await prisma.businessProfile.findMany({
    include: {
      catalogItems: { where: { isActive: true }, select: { id: true, price: true, title: true } },
      city: { select: { name: true } },
    },
    orderBy: { businessName: 'asc' },
  });

  // Group by archetype
  const foodBiz    = businesses.filter(b => b.businessType === 'FOOD_BEVERAGE');
  const groceryBiz = businesses.filter(b => b.businessType === 'GROCERY');
  const retailBiz  = businesses.filter(b => b.businessType === 'RETAIL');
  const serviceBiz = businesses.filter(b => !['FOOD_BEVERAGE', 'GROCERY', 'RETAIL'].includes(b.businessType));

  console.log(`Businesses: ${foodBiz.length} food, ${groceryBiz.length} grocery, ${retailBiz.length} retail, ${serviceBiz.length} service`);

  let orderCount = 0;

  // ─── helper: build order items from catalog ──────────────────────────────
  function pickItems(catalogItems, count = 2) {
    const picked = [];
    const shuffled = [...catalogItems].sort(() => Math.random() - 0.5).slice(0, count);
    let total = 0;
    for (const item of shuffled) {
      const qty = randInt(1, 3);
      const price = Number(item.price) || 150;
      total += price * qty;
      picked.push({ catalogItemId: item.id, quantity: qty, priceAtTimeOfOrder: price });
    }
    return { items: picked, total };
  }

  // ─── 4. Customer orders (3 per customer) ────────────────────────────────
  console.log('\nCreating customer orders…');

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    const customerName = customer.name || `Customer ${i + 1}`;
    const customerPhone = customer.phoneNumber || GUEST_PHONES[i % GUEST_PHONES.length];

    // Assign vendors round-robin so every vendor gets coverage
    const foodVendor    = foodBiz[i % foodBiz.length];
    const serviceVendor = serviceBiz[i % serviceBiz.length];
    const shopVendor    = [...groceryBiz, ...retailBiz][i % (groceryBiz.length + retailBiz.length)];

    // ── Order 1: PENDING food order (active, in-progress) ──
    if (foodVendor && foodVendor.catalogItems.length > 0) {
      const { items, total } = pickItems(foodVendor.catalogItems, randInt(2, 3));
      await prisma.orderEnquiry.create({
        data: {
          businessProfileId: foodVendor.id,
          customerId: customer.id,
          orderType: 'TRANSACTIONAL',
          customerName,
          customerPhone,
          serviceLocation: rand(LOCATIONS),
          totalValue: total,
          status: 'PENDING',
          items: { create: items },
        },
      });
      orderCount++;
    }

    // ── Order 2: CONFIRMED service booking ──
    if (serviceVendor) {
      const { items, total } = serviceVendor.catalogItems.length > 0
        ? pickItems(serviceVendor.catalogItems, 1)
        : { items: [], total: randInt(200, 2000) };
      await prisma.orderEnquiry.create({
        data: {
          businessProfileId: serviceVendor.id,
          customerId: customer.id,
          orderType: 'SERVICE_BOOKING',
          customerName,
          customerPhone,
          serviceLocation: rand(LOCATIONS),
          totalValue: total,
          status: 'CONFIRMED',
          scheduledAt: new Date(Date.now() + randInt(1, 7) * 24 * 60 * 60 * 1000),
          items: items.length ? { create: items } : undefined,
        },
      });
      orderCount++;
    }

    // ── Order 3: COMPLETED retail/grocery order (history) ──
    if (shopVendor && shopVendor.catalogItems.length > 0) {
      const { items, total } = pickItems(shopVendor.catalogItems, randInt(1, 3));
      await prisma.orderEnquiry.create({
        data: {
          businessProfileId: shopVendor.id,
          customerId: customer.id,
          orderType: 'TRANSACTIONAL',
          customerName,
          customerPhone,
          serviceLocation: rand(LOCATIONS),
          totalValue: total,
          status: 'COMPLETED',
          createdAt: new Date(Date.now() - randInt(3, 30) * 24 * 60 * 60 * 1000),
          items: { create: items },
        },
      });
      orderCount++;
    }
  }

  console.log(`  → Created ${orderCount} customer-linked orders`);

  // ─── 5. Vendor-side: extra "guest" orders so every vendor dashboard is populated ──
  console.log('\nCreating extra vendor-facing orders…');
  let extraCount = 0;

  // All food vendors get 3 extra TRANSACTIONAL orders (new orders to process)
  for (const biz of foodBiz) {
    if (biz.catalogItems.length === 0) continue;
    const statuses = ['PENDING', 'CONFIRMED', 'COMPLETED'];
    for (const status of statuses) {
      const { items, total } = pickItems(biz.catalogItems, randInt(2, 4));
      await prisma.orderEnquiry.create({
        data: {
          businessProfileId: biz.id,
          orderType: 'TRANSACTIONAL',
          customerName: rand(GUEST_NAMES),
          customerPhone: rand(GUEST_PHONES),
          serviceLocation: rand(LOCATIONS),
          totalValue: total,
          status,
          createdAt: new Date(Date.now() - randInt(0, 15) * 24 * 60 * 60 * 1000),
          items: { create: items },
        },
      });
      extraCount++;
    }
  }

  // Grocery/retail vendors get 2 extra orders (PENDING + COMPLETED)
  for (const biz of [...groceryBiz, ...retailBiz]) {
    if (biz.catalogItems.length === 0) continue;
    for (const status of ['PENDING', 'COMPLETED']) {
      const { items, total } = pickItems(biz.catalogItems, randInt(1, 3));
      await prisma.orderEnquiry.create({
        data: {
          businessProfileId: biz.id,
          orderType: 'TRANSACTIONAL',
          customerName: rand(GUEST_NAMES),
          customerPhone: rand(GUEST_PHONES),
          serviceLocation: rand(LOCATIONS),
          totalValue: total,
          status,
          createdAt: new Date(Date.now() - randInt(0, 10) * 24 * 60 * 60 * 1000),
          items: { create: items },
        },
      });
      extraCount++;
    }
  }

  // Service vendors get 2 leads each (PENDING lead + 1 COMPLETED)
  for (const biz of serviceBiz) {
    const msgs = [SERVICE_MESSAGES[randInt(0, SERVICE_MESSAGES.length - 1)], SERVICE_MESSAGES[randInt(0, SERVICE_MESSAGES.length - 1)]];
    const statusPairs = [['PENDING', false], ['COMPLETED', true]];
    for (const [status, isPast] of statusPairs) {
      const { items, total } = biz.catalogItems.length > 0
        ? pickItems(biz.catalogItems, 1)
        : { items: [], total: randInt(300, 5000) };
      await prisma.orderEnquiry.create({
        data: {
          businessProfileId: biz.id,
          orderType: 'SERVICE_BOOKING',
          customerName: rand(GUEST_NAMES),
          customerPhone: rand(GUEST_PHONES),
          serviceLocation: rand(LOCATIONS),
          totalValue: total,
          status,
          scheduledAt: isPast
            ? new Date(Date.now() - randInt(2, 20) * 24 * 60 * 60 * 1000)
            : new Date(Date.now() + randInt(1, 5) * 24 * 60 * 60 * 1000),
          createdAt: isPast
            ? new Date(Date.now() - randInt(5, 25) * 24 * 60 * 60 * 1000)
            : new Date(),
          items: items.length ? { create: items } : undefined,
        },
      });
      extraCount++;
    }
  }

  console.log(`  → Created ${extraCount} extra vendor-facing orders`);

  // ─── 6. Final counts ──────────────────────────────────────────────────────
  const total = await prisma.orderEnquiry.count();
  const byStatus = await prisma.orderEnquiry.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  console.log(`\n── Done ─────────────────────────────────────────────────────`);
  console.log(`Total orders: ${total}`);
  byStatus.forEach(s => console.log(`  ${s.status}: ${s._count.id}`));

  // Verify a sample customer has orders
  const sample = await prisma.orderEnquiry.findMany({
    where: { customerId: customers[0]?.id },
    select: { status: true, orderType: true, totalValue: true },
  });
  if (customers[0]) {
    console.log(`\nSample — ${customers[0].email}:`);
    sample.forEach(o => console.log(`  ${o.status} | ${o.orderType} | ₹${o.totalValue}`));
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
