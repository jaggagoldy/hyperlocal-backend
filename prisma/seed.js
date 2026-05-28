/**
 * prisma/seed.js
 * HyperLocal Go — Full Development Seed Script
 * Run: npm run db:seed
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

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const log = (emoji, msg) => console.log(`  ${emoji}  ${msg}`);

const slugifyText = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱  HyperLocal Go — Seeding Database\n');
  console.log('─'.repeat(45));

  // Clean up old records to make re-runs clean
  console.log('🧹  Cleaning up existing lead analytics...');
  await prisma.leadAnalytic.deleteMany({});
  console.log('🧹  Cleaning up existing leads...');
  await prisma.lead.deleteMany({});
  console.log('🧹  Cleaning up existing catalog items...');
  await prisma.catalogItem.deleteMany({});
  console.log('🧹  Cleaning up existing vendors...');
  await prisma.vendorCategory.deleteMany({});
  await prisma.vendorSubscription.deleteMany({});
  await prisma.vendor.deleteMany({});
  console.log('🧹  Cleaning up existing users (except persistent system users if any)...');
  await prisma.user.deleteMany({});
  console.log('✓  Cleanup complete.');

  // ══════════════════════════════════════════════
  // 1. CITIES
  // ══════════════════════════════════════════════
  console.log('\n📍  Cities');

  const cityData = [
    { name: 'Gurugram',  slug: 'gurugram'  },
    { name: 'Noida',     slug: 'noida'     },
    { name: 'New Delhi', slug: 'new-delhi' },
    { name: 'Dadri',          slug: 'dadri'          },
    { name: 'Greater Noida',  slug: 'greater-noida'  },
    { name: 'Fatehabad',      slug: 'fatehabad'      },
    { name: 'Hisar',          slug: 'hisar'          },
    { name: 'Sirsa',          slug: 'sirsa'          },
  ];

  const cities = {};
  for (const c of cityData) {
    cities[c.slug] = await prisma.city.upsert({
      where:  { slug: c.slug },
      update: { name: c.name },
      create: c,
    });
    log('✓', c.name);
  }

  // ══════════════════════════════════════════════
  // 2. CATEGORIES
  // ══════════════════════════════════════════════
  console.log('\n🏷️   Categories');

  const categoryData = [
    { name: 'Electrician', slug: 'electrician' },
    { name: 'Plumber',     slug: 'plumber'     },
    { name: 'AC Repair',   slug: 'ac-repair'   },
    { name: 'Carpenter',   slug: 'carpenter'   },
    { name: 'Painter',     slug: 'painter'     },
    { name: 'RO Repair',   slug: 'ro-repair'   },
    { name: 'Car Rental',   slug: 'car-rental'   },
    { name: 'Salon Booking', slug: 'salon-booking' },
    { name: 'Real Estate',   slug: 'real-estate'   },
  ];

  const cats = {};
  for (const cat of categoryData) {
    cats[cat.slug] = await prisma.category.upsert({
      where:  { slug: cat.slug },
      update: { name: cat.name },
      create: cat,
    });
    log('✓', cat.name);
  }

  // ══════════════════════════════════════════════
  // 3. HARDCODED TEST ACCOUNTS
  // ══════════════════════════════════════════════
  console.log('\n👤  Hardcoded Developer Test Accounts');

  const adminPasswordHash = hashPassword('password123');

  // a) admin@hyperlocal.com (Superadmin/General Fallback Vendor)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@hyperlocal.com' },
    update: { role: 'admin', name: 'Super Admin', phoneNumber: '9999999999', passwordHash: adminPasswordHash },
    create: {
      email: 'admin@hyperlocal.com',
      name: 'Super Admin',
      phoneNumber: '9999999999',
      role: 'admin',
      passwordHash: adminPasswordHash,
    }
  });
  log('✓', `${adminUser.email} (admin)`);

  // b) vendor@hyperlocal.com (A fully populated vendor in Sirsa)
  const vendorUser = await prisma.user.upsert({
    where: { email: 'vendor@hyperlocal.com' },
    update: { role: 'vendor', name: 'Sirsa Electrician Pro', phoneNumber: '9888888888', passwordHash: adminPasswordHash },
    create: {
      email: 'vendor@hyperlocal.com',
      name: 'Sirsa Electrician Pro',
      phoneNumber: '9888888888',
      role: 'vendor',
      passwordHash: adminPasswordHash,
    }
  });
  log('✓', `${vendorUser.email} (vendor)`);

  // c) user@hyperlocal.com (Standard customer/consumer)
  const customerUser = await prisma.user.upsert({
    where: { email: 'user@hyperlocal.com' },
    update: { role: 'customer', name: 'Standard User', phoneNumber: '9777777777', passwordHash: adminPasswordHash, gender: 'Male', dateOfBirth: new Date(1995, 4, 15) },
    create: {
      email: 'user@hyperlocal.com',
      name: 'Standard User',
      phoneNumber: '9777777777',
      role: 'customer',
      gender: 'Male',
      dateOfBirth: new Date(1995, 4, 15),
      passwordHash: adminPasswordHash,
    }
  });
  log('✓', `${customerUser.email} (customer)`);

  // ══════════════════════════════════════════════
  // 4. HARDCODED VENDORS
  // ══════════════════════════════════════════════
  console.log('\n🏪  Hardcoded Vendor Profiles');

  // General Fallback Vendor for admin
  const adminVendor = await prisma.vendor.create({
    data: {
      userId: adminUser.id,
      businessName: 'HyperLocal General Services',
      slug: 'hyperlocal-general-services',
      registrationNumber: 'REG-SYSTEM-001',
      localityName: 'Sector 15',
      chowkLandmark: 'Admin Office',
      pincode: '122001',
      cityId: cities['gurugram'].id,
      status: 'available',
      membershipTier: 'Pro',
      rating: 5.0,
      locationType: 'Shop',
      categories: {
        create: Object.keys(cats).map((slug) => ({
          category: { connect: { id: cats[slug].id } }
        }))
      }
    }
  });
  log('✓', `General Fallback Vendor: ${adminVendor.businessName} (Gurugram)`);

  // Sirsa Electrician Pro Vendor
  const sirsaVendor = await prisma.vendor.create({
    data: {
      userId: vendorUser.id,
      businessName: 'Sirsa Electricals Pro',
      slug: 'sirsa-electricals-pro',
      registrationNumber: 'REG-ELEC-SIRSA',
      localityName: 'Rania Chowk',
      chowkLandmark: 'Near Main Market',
      pincode: '125055',
      cityId: cities['sirsa'].id,
      status: 'available',
      membershipTier: 'Pro',
      rating: 4.9,
      locationType: 'Shop',
      categories: {
        create: [
          { category: { connect: { id: cats['electrician'].id } } }
        ]
      }
    }
  });
  log('✓', `Sirsa Vendor: ${sirsaVendor.businessName} (Sirsa)`);

  // ══════════════════════════════════════════════
  // 5. MOCK DATA GENERATION: 50 USERS & 20 VENDORS
  // ══════════════════════════════════════════════
  console.log('\n👤 Generating 50 mock Users...');
  const firstNamesMale = ['Amit', 'Rajesh', 'Suresh', 'Rahul', 'Vikram', 'Rohan', 'Manish', 'Sanjay', 'Vikas', 'Arjun', 'Sunil', 'Vijay', 'Deepak', 'Anil', 'Alok'];
  const firstNamesFemale = ['Priya', 'Sunita', 'Deepika', 'Kavita', 'Ananya', 'Ritu', 'Neha', 'Shweta', 'Pooja', 'Aarti', 'Meera', 'Renu', 'Kiran', 'Sneha', 'Jyoti'];
  const lastNames = ['Sharma', 'Mehta', 'Singh', 'Kumar', 'Gupta', 'Verma', 'Agarwal', 'Joshi', 'Tiwari', 'Reddy', 'Chawla', 'Yadav', 'Jindal', 'Bansal', 'Garg'];

  // Add 50 mock users (rotating male/female names, dates of birth, genders)
  for (let i = 1; i <= 50; i++) {
    const isMale = i % 2 === 0;
    const firstName = isMale ? firstNamesMale[i % firstNamesMale.length] : firstNamesFemale[i % firstNamesFemale.length];
    const lastName = lastNames[i % lastNames.length];
    const name = `${firstName} ${lastName}`;
    const email = `mock.user.${i}@hyperlocal.com`;
    const phoneNumber = `980000${String(i).padStart(4, '0')}`;
    const gender = isMale ? 'Male' : 'Female';
    const birthYear = 1980 + (i % 26);
    const birthMonth = i % 12;
    const birthDay = 1 + (i % 28);
    const dateOfBirth = new Date(birthYear, birthMonth, birthDay);

    await prisma.user.create({
      data: {
        email,
        name,
        phoneNumber,
        gender,
        dateOfBirth,
        role: 'customer',
        passwordHash: adminPasswordHash,
      }
    });
  }
  log('✓', 'Created 50 mock users with demographic fields.');

  console.log('\n🏪 Generating 20 mock Vendors across Fatehabad, Hisar, Sirsa...');
  const targetCities = ['hisar', 'fatehabad', 'sirsa'];
  const categoriesList = ['electrician', 'plumber', 'ac-repair', 'carpenter', 'painter', 'ro-repair', 'car-rental', 'salon-booking', 'real-estate'];
  const businessTypes = ['Electricals', 'Plumbing Solutions', 'AC Service Centre', 'Woodworks', 'Painters', 'RO Care', 'Travel & Rentals', 'Grooming Salon', 'Properties'];

  for (let i = 1; i <= 20; i++) {
    const email = `mock.vendor.${i}@hyperlocal.com`;
    const phoneNumber = `990000${String(i).padStart(4, '0')}`;
    const userFirstName = firstNamesMale[i % firstNamesMale.length];
    const userLastName = lastNames[i % lastNames.length];
    const userName = `${userFirstName} ${userLastName}`;

    const vendorUser = await prisma.user.create({
      data: {
        email,
        name: userName,
        phoneNumber,
        role: 'vendor',
        passwordHash: adminPasswordHash,
      }
    });

    const citySlug = targetCities[i % targetCities.length];
    const categorySlug = categoriesList[i % categoriesList.length];
    const businessSuffix = businessTypes[i % businessTypes.length];
    const businessName = `${userLastName} ${businessSuffix}`;
    const slug = `${slugifyText(businessName)}-${citySlug}-${i}`;
    const registrationNumber = `REG-MOCK-${String(i).padStart(3, '0')}`;
    const localityName = `Local Area ${i}`;
    const chowkLandmark = `Chowk ${i}`;
    const pincode = String(125000 + i * 5);
    const membershipTier = i % 3 === 0 ? 'Pro' : (i % 3 === 1 ? 'Starter' : 'Free');
    const rating = parseFloat((4.0 + (i % 11) * 0.1).toFixed(1));

    const vendor = await prisma.vendor.create({
      data: {
        userId: vendorUser.id,
        businessName,
        slug,
        registrationNumber,
        localityName,
        chowkLandmark,
        pincode,
        cityId: cities[citySlug].id,
        status: 'available',
        membershipTier,
        rating,
        locationType: 'Shop',
        categories: {
          create: [{ category: { connect: { id: cats[categorySlug].id } } }]
        }
      }
    });

    // Create 2 catalog items for each mock vendor
    await prisma.catalogItem.create({
      data: {
        vendorId: vendor.id,
        categoryId: cats[categorySlug].id,
        title: `Premium ${cats[categorySlug].name} Service`,
        description: `High quality professional ${cats[categorySlug].name} services by ${businessName}.`,
        price: 500 + i * 50,
        isActive: true
      }
    });

    await prisma.catalogItem.create({
      data: {
        vendorId: vendor.id,
        categoryId: cats[categorySlug].id,
        title: `Express ${cats[categorySlug].name} Repair`,
        description: `Urgent and quick ${cats[categorySlug].name} fix within 2 hours.`,
        price: 300 + i * 30,
        isActive: true
      }
    });
  }
  log('✓', 'Created 20 mock vendors with catalogs across Hisar, Fatehabad, and Sirsa.');

  // ══════════════════════════════════════════════
  // 6. POPULATING vendor@hyperlocal.com CATALOG & LEADS
  // ══════════════════════════════════════════════
  console.log('\n📦 Seeding catalog items for vendor@hyperlocal.com (Sirsa)...');

  const sItem1 = await prisma.catalogItem.create({
    data: {
      vendorId: sirsaVendor.id,
      categoryId: cats['electrician'].id,
      title: 'Ceiling Fan Installation & Repair',
      description: 'Quick installation of new ceiling fans or repairs of old regulators and winding.',
      price: 250,
      isActive: true,
    }
  });

  const sItem2 = await prisma.catalogItem.create({
    data: {
      vendorId: sirsaVendor.id,
      categoryId: cats['electrician'].id,
      title: 'Home Re-wiring Audit',
      description: 'Complete inspection of house wiring, checking safety switches, earthing, and sockets.',
      price: 1500,
      isActive: true,
    }
  });

  const sItem3 = await prisma.catalogItem.create({
    data: {
      vendorId: sirsaVendor.id,
      categoryId: cats['electrician'].id,
      title: 'Air Conditioner Electric Line Setup',
      description: 'Heavy gauge copper wiring line installation for new AC units, with dedicated MCB switch.',
      price: 800,
      isActive: true,
    }
  });

  const sItem4 = await prisma.catalogItem.create({
    data: {
      vendorId: sirsaVendor.id,
      categoryId: cats['electrician'].id,
      title: 'Emergency Short Circuit Fix',
      description: 'Urgent troubleshooting and restoration of power for tripped fuse boxes or burnt wiring.',
      price: 400,
      isActive: true,
    }
  });

  const sItem5 = await prisma.catalogItem.create({
    data: {
      vendorId: sirsaVendor.id,
      categoryId: cats['electrician'].id,
      title: 'Inverter Battery Installation',
      description: 'Setting up home backup inverter systems, battery diagnostics, and filling distilled water.',
      price: 600,
      isActive: true,
    }
  });

  log('✓', 'Created 5 electrical catalog items.');

  console.log('\n📬 Seeding 10 mock leads for vendor@hyperlocal.com...');

  const leadsData = [
    {
      catalogItemId: sItem1.id, vendorId: sirsaVendor.id,
      customerName: 'Karan Johar', customerPhone: '9812400123',
      customerRequirement: 'Need 3 new ceiling fans installed in my newly built home in Sirsa.',
      status: 'NEW', createdAt: daysAgo(1),
    },
    {
      catalogItemId: sItem4.id, vendorId: sirsaVendor.id,
      customerName: 'Sunita Sharma', customerPhone: '9845322991',
      customerRequirement: 'Main switch board has burnt smell and sparks. Please come urgently!',
      status: 'NEW', createdAt: daysAgo(0),
    },
    {
      catalogItemId: sItem2.id, vendorId: sirsaVendor.id,
      customerName: 'Preet Gill', customerPhone: '9788012345',
      customerRequirement: 'Moving into a rented house in Sirsa, need all sockets and earthing checked.',
      status: 'CONTACTED', createdAt: daysAgo(2),
    },
    {
      catalogItemId: sItem3.id, vendorId: sirsaVendor.id,
      customerName: 'Gagan Deep', customerPhone: '9912388776',
      customerRequirement: 'Installing a new 2 Ton AC, need heavy power line and modular board set up.',
      status: 'CONTACTED', createdAt: daysAgo(3),
    },
    {
      catalogItemId: sItem5.id, vendorId: sirsaVendor.id,
      customerName: 'Hargun Singh', customerPhone: '9811122233',
      customerRequirement: 'Inverter battery is dying within 30 minutes of power cut. Need checkup.',
      status: 'CONVERTED', createdAt: daysAgo(4),
    },
    {
      catalogItemId: sItem1.id, vendorId: sirsaVendor.id,
      customerName: 'Amit Verma', customerPhone: '9876543211',
      customerRequirement: 'Regulator replacement needed for kitchen ceiling fan.',
      status: 'CONVERTED', createdAt: daysAgo(5),
    },
    {
      catalogItemId: sItem2.id, vendorId: sirsaVendor.id,
      customerName: 'Sanjay Bishnoi', customerPhone: '9991223344',
      customerRequirement: 'Periodic wiring safety audit for commercial shop near bus stand.',
      status: 'NEW', createdAt: daysAgo(6),
    },
    {
      catalogItemId: sItem3.id, vendorId: sirsaVendor.id,
      customerName: 'Manpreet Kaur', customerPhone: '9872244556',
      customerRequirement: 'AC wire installation in the drawing room.',
      status: 'CONTACTED', createdAt: daysAgo(7),
    },
    {
      catalogItemId: sItem4.id, vendorId: sirsaVendor.id,
      customerName: 'Ramesh Chander', customerPhone: '9896010203',
      customerRequirement: 'Power cut in half of the house, suspecting burnt MCB.',
      status: 'NEW', createdAt: daysAgo(8),
    },
    {
      catalogItemId: sItem5.id, vendorId: sirsaVendor.id,
      customerName: 'Deepak Yadav', customerPhone: '9815040302',
      customerRequirement: 'Complete installation of new luminous inverter and tubular battery.',
      status: 'CONVERTED', createdAt: daysAgo(9),
    },
  ];

  for (const lead of leadsData) {
    await prisma.lead.create({ data: lead });
    log('✓', `Lead [${lead.status}] from ${lead.customerName} added.`);
  }

  // ══════════════════════════════════════════════
  // 7. SEEDING FALLBACK CATALOG FOR HOMEPAGE RFQ
  // ══════════════════════════════════════════════
  console.log('\n📦 Seeding general fallback catalog items for admin/system vendor...');
  for (const catSlug of Object.keys(cats)) {
    await prisma.catalogItem.create({
      data: {
        vendorId: adminVendor.id,
        categoryId: cats[catSlug].id,
        title: `General ${cats[catSlug].name} Enquiry`,
        description: `Need assistance? Post a general requirement and get bids from verified local ${cats[catSlug].name}s.`,
        price: 0,
        isActive: true,
      }
    });
  }

  // ══════════════════════════════════════════════
  // 8. LEAD ANALYTICS (profile views / clicks)
  // ══════════════════════════════════════════════
  console.log('\n📊 Seeding Analytics Events for hardcoded Sirsa Vendor...');

  const analyticsData = [
    ...Array.from({ length: 55 }, (_, i) => ({ vendorId: sirsaVendor.id, type: 'profile_view',     createdAt: daysAgo(Math.floor(Math.random() * 30)) })),
    ...Array.from({ length: 22 }, (_, i) => ({ vendorId: sirsaVendor.id, type: 'call_click',        createdAt: daysAgo(Math.floor(Math.random() * 30)) })),
    ...Array.from({ length: 15 }, (_, i) => ({ vendorId: sirsaVendor.id, type: 'whatsapp_click',    createdAt: daysAgo(Math.floor(Math.random() * 30)) })),
  ];

  await prisma.leadAnalytic.createMany({ data: analyticsData });
  log('✓', `${analyticsData.length} analytics events for Sirsa Vendor seeded.`);

  // ══════════════════════════════════════════════
  // DONE
  // ══════════════════════════════════════════════
  console.log('\n' + '─'.repeat(45));
  console.log('✅  Seeding complete!\n');
  console.log('  📌  Test Accounts:');
  console.log('  ┌───────────────────────────────────────────┐');
  console.log('  │  Admin:    admin@hyperlocal.com           │');
  console.log('  │  Vendor:   vendor@hyperlocal.com          │');
  console.log('  │  Customer: user@hyperlocal.com            │');
  console.log('  │  Password: password123 (all accounts)     │');
  console.log('  │  OTP:      111111 (any phone number)      │');
  console.log('  └───────────────────────────────────────────┘\n');
}

main()
  .catch((e) => {
    console.error('\n❌  Seed failed:\n', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
