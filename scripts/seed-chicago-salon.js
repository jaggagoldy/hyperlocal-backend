import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

async function main() {
  console.log('Seeding Hair Salon and Chicago Pizza Store...');

  const city = await prisma.city.findFirst({ where: { slug: 'gurugram' } }) || await prisma.city.findFirst();
  if (!city) throw new Error("City not found");

  const foodCat = await prisma.category.findFirst({ where: { slug: 'food-beverage' } });
  const salonCat = await prisma.category.findFirst({ where: { slug: 'salon-spa' } });

  const passwordHash = hashPassword('Test1234');

  // Create or find user 9999944444
  let user = await prisma.user.findFirst({ where: { phoneNumber: '9999944444' } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Demo Vendor',
        email: 'demovendor@example.com',
        phoneNumber: '9999944444',
        role: 'VENDOR',
        passwordHash,
        hasVendorProfile: true
      }
    });
  }

  // 1. Hair Salon
  const salonBiz = await prisma.businessProfile.create({
    data: {
      userId: user.id,
      businessName: "Prime Hair Salon",
      slug: 'prime-hair-salon',
      businessType: 'SALON_BEAUTY',
      cityId: city.id,
      localityName: 'Downtown',
      latitude: 28.4595,
      longitude: 77.0266,
      status: 'available',
      idVerified: true,
      registrationNumber: 'REG-SALON-123',
      pincode: '122001',
      metaData: { experience: 'Premium' },
    }
  });

  if (salonCat) {
    await prisma.businessCategory.create({ data: { businessProfileId: salonBiz.id, categoryId: salonCat.id } });
    await prisma.catalogItem.createMany({
      data: [
        { businessProfileId: salonBiz.id, categoryId: salonCat.id, title: 'Men Haircut', price: 200, description: 'Premium men haircut with styling.' },
        { businessProfileId: salonBiz.id, categoryId: salonCat.id, title: 'Beard Trim', price: 100, description: 'Professional beard trimming.' },
        { businessProfileId: salonBiz.id, categoryId: salonCat.id, title: 'Hair Spa', price: 500, description: 'Relaxing hair spa treatment.' },
      ]
    });
  }

  // 2. Chicago Pizza Store
  const pizzaBiz = await prisma.businessProfile.create({
    data: {
      userId: user.id,
      businessName: "Chicago Pizza Store",
      slug: 'chicago-pizza-store',
      businessType: 'FOOD_BEVERAGE',
      cityId: city.id,
      localityName: 'Sector 29',
      latitude: 28.4600,
      longitude: 77.0270,
      status: 'available',
      idVerified: true,
      registrationNumber: 'FSSAI-PIZZA-456',
      pincode: '122001',
      metaData: { isVeg: false, packagingCharge: 30 },
    }
  });

  if (foodCat) {
    await prisma.businessCategory.create({ data: { businessProfileId: pizzaBiz.id, categoryId: foodCat.id } });
    await prisma.catalogItem.createMany({
      data: [
        { businessProfileId: pizzaBiz.id, categoryId: foodCat.id, title: 'Deep Dish Pepperoni', price: 650, description: 'Authentic Chicago deep dish pizza with pepperoni.' },
        { businessProfileId: pizzaBiz.id, categoryId: foodCat.id, title: 'Margherita', price: 350, description: 'Classic cheese pizza.' },
        { businessProfileId: pizzaBiz.id, categoryId: foodCat.id, title: 'Garlic Breadsticks', price: 150, description: 'Freshly baked with cheese dip.' },
      ]
    });
  }

  console.log('✅ Seeding complete!');
  console.log('Login with: 9999944444 (OTP: 111111)');
}

main().catch(console.error).finally(() => prisma.$disconnect());
