import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

async function main() {
  console.log('Starting demo seeding...');
  
  // 1. Get references
  const city = await prisma.city.findFirst({ where: { slug: 'hisar' } });
  const category = await prisma.category.findFirst({ where: { slug: 'food-beverage' } });

  if (!city || !category) {
    throw new Error('Missing city or category in DB');
  }

  // 2. Create Vendor User
  const vendorEmail = 'sales_vendor@nearbybazar.com';
  const vendorPass = 'vendor123';
  let vendorUser = await prisma.user.findUnique({ where: { email: vendorEmail } });
  if (!vendorUser) {
    vendorUser = await prisma.user.create({
      data: {
        email: vendorEmail,
        passwordHash: hashPassword(vendorPass),
        name: 'Sales Vendor Demo',
        role: 'vendor',
        phoneNumber: '9999999999',
        hasCustomerProfile: false,
        hasVendorProfile: true,
      }
    });
    console.log('Created Vendor User');
  }

  // 3. Create Business Profile
  const businessSlug = 'sales-demo-kitchen';
  let business = await prisma.businessProfile.findUnique({ where: { slug: businessSlug } });
  if (!business) {
    business = await prisma.businessProfile.create({
      data: {
        userId: vendorUser.id,
        businessName: 'Sales Demo Kitchen',
        slug: businessSlug,
        registrationNumber: 'FSSAI-12345678',
        businessType: 'FOOD_BEVERAGE',
        isOnline: true,
        localityName: 'Sector 14',
        pincode: '125001',
        cityId: city.id,
        metaData: {
          restaurantDetails: {
            isVeg: false,
            fssai: 'FSSAI-12345678'
          }
        },
        categories: {
          create: [{ categoryId: category.id }]
        }
      }
    });
    console.log('Created Business Profile');

    // Create some Catalog Items
    await prisma.catalogItem.createMany({
      data: [
        {
          businessProfileId: business.id,
          categoryId: category.id,
          title: 'Butter Chicken Combo',
          price: 350,
          isActive: true,
          metaData: { isVeg: false }
        },
        {
          businessProfileId: business.id,
          categoryId: category.id,
          title: 'Paneer Tikka Masala',
          price: 250,
          isActive: true,
          metaData: { isVeg: true }
        }
      ]
    });
    console.log('Created Catalog Items');
  }

  // 4. Create Customer User
  const customerEmail = 'sales_customer@nearbybazar.com';
  const customerPass = 'customer123';
  let customerUser = await prisma.user.findUnique({ where: { email: customerEmail } });
  if (!customerUser) {
    customerUser = await prisma.user.create({
      data: {
        email: customerEmail,
        passwordHash: hashPassword(customerPass),
        name: 'Sales Customer Demo',
        role: 'customer',
        phoneNumber: '8888888888',
        hasCustomerProfile: true,
        hasVendorProfile: false,
      }
    });
    console.log('Created Customer User');
  }

  console.log('Demo seeding complete!');
  console.log('----------------------------------------------------');
  console.log('VENDOR CREDENTIALS:');
  console.log('Email:', vendorEmail);
  console.log('Password:', vendorPass);
  console.log('----------------------------------------------------');
  console.log('CUSTOMER CREDENTIALS:');
  console.log('Email:', customerEmail);
  console.log('Password:', customerPass);
  console.log('----------------------------------------------------');
}

main().catch(console.error).finally(() => prisma.$disconnect());
