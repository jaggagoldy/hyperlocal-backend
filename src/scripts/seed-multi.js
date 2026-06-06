import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

async function main() {
  console.log('Cleaning up previous seed data...');
  await prisma.user.deleteMany({
    where: {
      phoneNumber: { in: ['9999955555', '9999966666'] }
    }
  });

  console.log('Seeding restaurant and multi-business vendor profiles...');

  const city = await prisma.city.findFirst({ where: { slug: 'hisar' } });
  if (!city) throw new Error("City 'hisar' not found");

  const foodCat = await prisma.category.findFirst({ where: { slug: 'food-beverage' } });
  const salonCat = await prisma.category.findFirst({ where: { slug: 'salon-spa' } });

  const passwordHash = hashPassword('Test1234');

  // ==========================================
  // 1. DEDICATED RESTAURANT ACCOUNT
  // ==========================================
  const restUser = await prisma.user.create({
    data: {
      name: 'Chef Sanjeev',
      email: 'sanjeev@example.com',
      phoneNumber: '9999955555',
      role: 'VENDOR',
      passwordHash,
      hasVendorProfile: true
    }
  });

  const restBiz = await prisma.businessProfile.create({
    data: {
      userId: restUser.id,
      businessName: "Sanjeev's Kitchen",
      slug: 'sanjeevs-kitchen',
      businessType: 'FOOD_BEVERAGE',
      cityId: city.id,
      localityName: 'Urban Estate',
      latitude: 29.1550,
      longitude: 75.7250,
      status: 'available',
      idVerified: true,
      registrationNumber: 'FSSAI-5555',
      pincode: '125001',
      metaData: { isVeg: true, packagingCharge: 20 },
    }
  });

  await prisma.businessCategory.create({ data: { businessProfileId: restBiz.id, categoryId: foodCat.id, categoryId: foodCat.id } });

  await prisma.catalogItem.createMany({
    data: [
      { businessProfileId: restBiz.id, categoryId: foodCat.id, title: 'Paneer Butter Masala', price: 250, description: 'Rich gravy with paneer.' },
      { businessProfileId: restBiz.id, categoryId: foodCat.id, title: 'Garlic Naan', price: 40, description: 'Crispy butter garlic naan.' },
      { businessProfileId: restBiz.id, categoryId: foodCat.id, title: 'Dal Makhani', price: 180, description: 'Overnight cooked black lentil.' },
    ]
  });


  // ==========================================
  // 2. MULTI-BUSINESS ACCOUNT (RESTAURANT + SALON)
  // ==========================================
  const multiUser = await prisma.user.create({
    data: {
      name: 'Emperor Holdings',
      email: 'emperor@example.com',
      phoneNumber: '9999966666',
      role: 'VENDOR',
      passwordHash,
      hasVendorProfile: true
    }
  });

  // Business A: The Burger Joint
  const bizA = await prisma.businessProfile.create({
    data: {
      userId: multiUser.id,
      businessName: "The Burger Joint",
      slug: 'the-burger-joint',
      businessType: 'FOOD_BEVERAGE',
      cityId: city.id,
      localityName: 'PLA Market',
      latitude: 29.1600,
      longitude: 75.7350,
      status: 'available',
      idVerified: true,
      registrationNumber: 'FSSAI-6666-A',
      pincode: '125001',
      metaData: { isVeg: false, packagingCharge: 15 },
    }
  });
  await prisma.businessCategory.create({ data: { businessProfileId: bizA.id, categoryId: foodCat.id, categoryId: foodCat.id } });
  await prisma.catalogItem.createMany({
    data: [
      { businessProfileId: bizA.id, categoryId: foodCat.id, title: 'Classic Chicken Burger', price: 150, description: 'Juicy chicken patty.' },
      { businessProfileId: bizA.id, categoryId: foodCat.id, title: 'French Fries', price: 80, description: 'Crispy salted fries.' }
    ]
  });

  // Business B: The Luxury Spa
  const bizB = await prisma.businessProfile.create({
    data: {
      userId: multiUser.id,
      businessName: "The Luxury Spa",
      slug: 'the-luxury-spa',
      businessType: 'SALON_BEAUTY',
      cityId: city.id,
      localityName: 'PLA Market',
      latitude: 29.1605,
      longitude: 75.7355,
      status: 'available',
      idVerified: true,
      registrationNumber: 'REG-6666-B',
      pincode: '125001',
      metaData: { experience: 'Premium', amenities: ['Steam Room', 'AC'] },
    }
  });
  await prisma.businessCategory.create({ data: { businessProfileId: bizB.id, categoryId: salonCat.id, categoryId: salonCat.id } });
  await prisma.catalogItem.createMany({
    data: [
      { businessProfileId: bizB.id, categoryId: salonCat.id, title: 'Swedish Massage', price: 1200, description: '60 mins relaxing massage.' },
      { businessProfileId: bizB.id, categoryId: salonCat.id, title: 'Gold Facial', price: 800, description: 'Instant glow gold facial.' }
    ]
  });

  console.log('✅ Multi-Seeding complete!');
  console.log('====================================');
  console.log('NEW VENDOR ACCOUNTS (Password: Test1234 / OTP: 111111):');
  console.log('- Restaurant Only: 9999955555 (Sanjeev\'s Kitchen)');
  console.log('- Multi-Business : 9999966666 (Owns: The Burger Joint & The Luxury Spa)');
  console.log('====================================');
}

main().catch(console.error).finally(() => prisma.$disconnect());
