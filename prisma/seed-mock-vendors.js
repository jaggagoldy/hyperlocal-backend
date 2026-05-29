import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

const CITIES = ['Fatehabad', 'Hisar', 'Sirsa'];

async function main() {
  const defaultPassword = hashPassword('password123');

  // Upsert Cities
  const cityMap = {};
  for (const cityName of CITIES) {
    const slug = cityName.toLowerCase();
    const city = await prisma.city.upsert({
      where: { slug },
      update: {},
      create: { name: cityName, slug },
    });
    cityMap[cityName] = city;
  }

  // Ensure some categories exist
  const sampleCategories = [
    { name: 'Electrician', slug: 'electrician' },
    { name: 'Plumber', slug: 'plumber' },
    { name: 'Carpenter', slug: 'carpenter' },
    { name: 'Painter', slug: 'painter' },
    { name: 'AC Repair', slug: 'ac-repair' },
    { name: 'Car Rental', slug: 'car-rental' },
    { name: 'Salon Booking', slug: 'salon-booking' },
    { name: 'Real Estate', slug: 'real-estate' },
  ];
  
  const categories = [];
  for (const cat of sampleCategories) {
    const category = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
    categories.push(category);
  }

  // Create main vendor account
  const vendorUser = await prisma.user.upsert({
    where: { email: 'vendor@hyperlocal.com' },
    update: { passwordHash: defaultPassword, role: 'vendor' },
    create: {
      email: 'vendor@hyperlocal.com',
      phoneNumber: '9999999991',
      passwordHash: defaultPassword,
      name: 'Test Vendor',
      role: 'vendor',
    }
  });

  await prisma.vendor.upsert({
    where: { userId: vendorUser.id },
    update: {},
    create: {
      userId: vendorUser.id,
      businessName: 'Test Vendor Services',
      slug: 'test-vendor-services',
      registrationNumber: 'REG-TEST-001',
      localityName: 'Test Area',
      pincode: '125050',
      status: 'available',
      cityId: cityMap['Fatehabad'].id,
    }
  });

  // Create main user account
  await prisma.user.upsert({
    where: { email: 'user@hyperlocal.com' },
    update: { passwordHash: defaultPassword, role: 'customer' },
    create: {
      email: 'user@hyperlocal.com',
      phoneNumber: '9999999992',
      passwordHash: defaultPassword,
      name: 'Test User',
      role: 'customer',
    }
  });

  // Generate 150 random vendors
  console.log("Generating 150 mock vendors...");
  for (let i = 1; i <= 150; i++) {
    const city = cityMap[CITIES[i % 3]];
    const num = Math.floor(Math.random() * 100000);
    
    // Create User
    const user = await prisma.user.create({
      data: {
        email: `vendor${i}_${num}@hyperlocal.com`,
        phoneNumber: `888${String(i).padStart(7, '0')}${Math.floor(Math.random() * 10)}`, // Make sure phone is unique, 10 digits
        passwordHash: defaultPassword,
        name: `Mock Vendor ${i}`,
        role: 'vendor',
      }
    });

    const category = categories[i % categories.length];

    const vendor = await prisma.vendor.create({
      data: {
        userId: user.id,
        businessName: `Mock ${category.name} ${i}`,
        slug: `mock-${category.slug}-${i}-${num}`,
        registrationNumber: `REG-MOCK-${num}-${i}`,
        localityName: 'Main Market',
        pincode: '125050',
        cityId: city.id,
        status: 'available',
        rating: 3 + Math.random() * 2, // 3 to 5
      }
    });

    await prisma.vendorCategory.create({
      data: {
        vendorId: vendor.id,
        categoryId: category.id,
      }
    });

    await prisma.catalogItem.create({
      data: {
        vendorId: vendor.id,
        categoryId: category.id,
        title: `${category.name} Services by Mock ${i}`,
        description: `Professional ${category.name} services in ${city.name}. Reliable and verified.`,
        price: Math.floor(Math.random() * 1000) + 100,
      }
    });
  }

  console.log("Mock data generated successfully!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
