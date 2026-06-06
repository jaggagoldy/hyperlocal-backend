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
      phoneNumber: { in: ['9999911111', '9999922222', '9999933333', '9999944444'] }
    }
  });

  console.log('Seeding more vendor profiles and a demo user...');

  const city = await prisma.city.findFirst({ where: { slug: 'hisar' } });
  if (!city) throw new Error("City 'hisar' not found");

  const salonCat = await prisma.category.findFirst({ where: { slug: 'salon-spa' } });
  const cabCat = await prisma.category.findFirst({ where: { slug: 'cab-service' } });
  const homeCat = await prisma.category.findFirst({ where: { slug: 'home-maintenance' } });

  const passwordHash = hashPassword('Test1234');

  const salonUser = await prisma.user.create({
    data: {
      name: 'Anita Sharma',
      email: 'anita@example.com',
      phoneNumber: '9999911111',
      role: 'VENDOR',
      passwordHash,
      hasVendorProfile: true
    }
  });

  const salonBiz = await prisma.businessProfile.create({
    data: {
      userId: salonUser.id,
      businessName: "Anita's Hair & Beauty",
      slug: 'anitas-hair-beauty',
      businessType: 'SALON_BEAUTY',
      cityId: city.id,
      localityName: 'Model Town',
      latitude: 29.1492,
      longitude: 75.7217,
      status: 'available',
      idVerified: true, pincode: '125001',
      registrationNumber: 'REG-1111',
      metaData: { experience: '10 Years', amenities: ['AC', 'Free Wifi'] },
    }
  });

  await prisma.businessCategory.create({ data: { businessProfileId: salonBiz.id, categoryId: salonCat.id, categoryId: salonCat.id } });

  await prisma.catalogItem.createMany({
    data: [
      { businessProfileId: salonBiz.id, categoryId: salonCat.id, title: 'Bridal Makeup', price: 5000, description: 'Complete bridal package.' },
      { businessProfileId: salonBiz.id, categoryId: salonCat.id, title: 'Hair Spa', price: 800, description: 'Loreal professional hair spa.' },
      { businessProfileId: salonBiz.id, categoryId: salonCat.id, title: 'Threading & Waxing', price: 400, description: 'Full face threading and waxing.' },
    ]
  });

  const cabUser = await prisma.user.create({
    data: {
      name: 'Ramesh Transport',
      email: 'cab@example.com',
      phoneNumber: '9999922222',
      role: 'VENDOR',
      passwordHash,
      hasVendorProfile: true
    }
  });

  const cabBiz = await prisma.businessProfile.create({
    data: {
      userId: cabUser.id,
      businessName: 'City Fast Cabs',
      slug: 'city-fast-cabs',
      businessType: 'CAB_TRANSPORT',
      cityId: city.id,
      localityName: 'Auto Market',
      latitude: 29.1500,
      longitude: 75.7200,
      status: 'available',
      idVerified: true, pincode: '125001',
      registrationNumber: 'REG-2222',
      metaData: { vehicles: ['Swift Dzire', 'Innova', 'Ertiga'] },
    }
  });

  await prisma.businessCategory.create({ data: { businessProfileId: cabBiz.id, categoryId: cabCat.id, categoryId: cabCat.id } });

  await prisma.catalogItem.createMany({
    data: [
      { businessProfileId: cabBiz.id, categoryId: cabCat.id, title: 'Airport Drop (Delhi)', price: 2500, description: 'One way drop to IGI Airport.' },
      { businessProfileId: cabBiz.id, categoryId: cabCat.id, title: 'Local 8Hr / 80Km', price: 1500, description: 'Full day local booking.' },
    ]
  });

  const elecUser = await prisma.user.create({
    data: {
      name: 'Raju Electrician',
      email: 'raju@example.com',
      phoneNumber: '9999933333',
      role: 'VENDOR',
      passwordHash,
      hasVendorProfile: true
    }
  });

  const elecBiz = await prisma.businessProfile.create({
    data: {
      userId: elecUser.id,
      businessName: 'Spark Electricians',
      slug: 'spark-electricians',
      businessType: 'HOME_ESSENTIALS',
      cityId: city.id,
      localityName: 'Sector 14',
      latitude: 29.1600,
      longitude: 75.7300,
      status: 'available',
      idVerified: true, pincode: '125001',
      registrationNumber: 'REG-3333',
      metaData: { experience: '5 Years' },
    }
  });

  await prisma.businessCategory.create({ data: { businessProfileId: elecBiz.id, categoryId: homeCat.id, categoryId: homeCat.id } });

  await prisma.catalogItem.createMany({
    data: [
      { businessProfileId: elecBiz.id, categoryId: homeCat.id, title: 'AC Servicing', price: 400, description: 'Window and Split AC servicing.' },
      { businessProfileId: elecBiz.id, categoryId: homeCat.id, title: 'Ceiling Fan Repair', price: 150, description: 'Capacitor replacement and greasing.' },
      { businessProfileId: elecBiz.id, categoryId: homeCat.id, title: 'House Wiring (Per point)', price: 80, description: 'Concealed or open wiring.' },
    ]
  });

  await prisma.user.create({
    data: {
      name: 'Demo Consumer',
      email: 'consumer@example.com',
      phoneNumber: '9999944444',
      role: 'USER',
      passwordHash,
      hasCustomerProfile: true
    }
  });

  console.log('✅ Seeding complete!');
  console.log('====================================');
  console.log('VENDOR ACCOUNTS (Password: Test1234 / OTP: 111111):');
  console.log('- Salon: 9999911111');
  console.log('- Cab: 9999922222');
  console.log('- Electrician: 9999933333');
  console.log('------------------------------------');
  console.log('CONSUMER ACCOUNT (Password: Test1234 / OTP: 111111):');
  console.log('- User: 9999944444');
  console.log('====================================');
}

main().catch(console.error).finally(() => prisma.$disconnect());
