const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database...');
  await prisma.orderItem.deleteMany();
  await prisma.orderEnquiry.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.catalogItem.deleteMany();
  await prisma.review.deleteMany();
  await prisma.businessMedia.deleteMany();
  await prisma.searchAnalytic.deleteMany();
  await prisma.leadAnalytic.deleteMany();
  await prisma.businessSubscription.deleteMany();
  await prisma.businessCategory.deleteMany();
  await prisma.businessProfile.deleteMany();
  await prisma.category.deleteMany();
  await prisma.city.deleteMany();
  await prisma.otpSession.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.user.deleteMany();

  console.log('Database cleared!');

  // Generate Base Data
  const passwordHash = await bcrypt.hash('Test@123', 10);

  console.log('Seeding Cities...');
  const citiesData = [
    { name: 'Greater Noida', slug: 'greater-noida' },
    { name: 'Dadri', slug: 'dadri' },
    { name: 'Noida', slug: 'noida' },
    { name: 'Delhi', slug: 'delhi' }
  ];
  const cities = [];
  for (const c of citiesData) {
    cities.push(await prisma.city.create({ data: c }));
  }

  console.log('Seeding Categories...');
  const parentCategoriesData = [
    { name: 'Food & Dining', slug: 'food-dining', type: 'FOOD_BEVERAGE' },
    { name: 'Cab & Transport', slug: 'cab-transport', type: 'CAB_TRANSPORT' },
    { name: 'Home Services', slug: 'home-services', type: 'HOME_ESSENTIALS' },
    { name: 'Salon & Beauty', slug: 'salon-beauty', type: 'SALON_BEAUTY' }
  ];
  
  const parentCats = {};
  for (const pc of parentCategoriesData) {
    parentCats[pc.type] = await prisma.category.create({ data: { name: pc.name, slug: pc.slug } });
  }

  const subCategoriesData = {
    FOOD_BEVERAGE: ['Restaurants', 'Street Food', 'Cloud Kitchen', 'Mithai', 'Bakery'],
    CAB_TRANSPORT: ['Sedan', 'SUV', 'Hatchback', 'Auto', 'Bike'],
    HOME_ESSENTIALS: ['Plumber', 'Electrician', 'AC Repair', 'Painter', 'Carpenter'],
    SALON_BEAUTY: ['Haircut', 'Massage', 'Bridal Makeup', 'Manicure', 'Pedicure']
  };

  const categories = {};
  for (const [type, subs] of Object.entries(subCategoriesData)) {
    categories[type] = [];
    for (const sub of subs) {
      categories[type].push(await prisma.category.create({
        data: {
          name: sub,
          slug: faker.helpers.slugify(sub).toLowerCase(),
          parentId: parentCats[type].id
        }
      }));
    }
  }

  console.log('Seeding Users & Profiles...');
  const businessProfiles = [];

  // Create 4 known test accounts to share with user
  const knownTestAccounts = [
    { email: 'food@test.com', name: 'Ramesh Cloud Kitchen', type: 'FOOD_BEVERAGE' },
    { email: 'cab@test.com', name: 'Suresh Transport', type: 'CAB_TRANSPORT' },
    { email: 'home@test.com', name: 'Prateek Plumbers', type: 'HOME_ESSENTIALS' },
    { email: 'salon@test.com', name: 'Glow Beauty Parlour', type: 'SALON_BEAUTY' }
  ];

  for (const account of knownTestAccounts) {
    const user = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: account.email,
        passwordHash,
        phoneNumber: faker.phone.number({ style: 'national' }).replace(/[^0-9]/g, '').slice(0, 10),
        role: 'vendor',
        hasVendorProfile: true,
        isPhoneVerified: true
      }
    });

    const category = faker.helpers.arrayElement(categories[account.type]);
    const bp = await prisma.businessProfile.create({
      data: {
        userId: user.id,
        businessName: account.name,
        slug: faker.helpers.slugify(account.name).toLowerCase() + '-' + Date.now(),
        registrationNumber: faker.string.alphanumeric(8).toUpperCase(),
        businessType: account.type,
        localityName: faker.location.street(),
        pincode: '201310',
        status: 'available',
        cityId: faker.helpers.arrayElement(cities).id,
        rating: faker.number.float({ min: 3.5, max: 5.0, fractionDigits: 1 }),
        themeFlavor: account.type === 'FOOD_BEVERAGE' ? 'playful-vibrant' : account.type === 'CAB_TRANSPORT' ? 'trust-utility' : 'premium-elegant'
      }
    });

    await prisma.businessCategory.create({
      data: {
        businessProfileId: bp.id,
        categoryId: category.id
      }
    });
    
    businessProfiles.push(bp);
  }

  // Create 20 random vendors
  for (let i = 0; i < 20; i++) {
    const user = await prisma.user.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        passwordHash,
        phoneNumber: faker.phone.number({ style: 'national' }).replace(/[^0-9]/g, '').slice(0, 10),
        role: 'vendor',
        hasVendorProfile: true,
        isPhoneVerified: true
      }
    });

    const type = faker.helpers.arrayElement(['FOOD_BEVERAGE', 'CAB_TRANSPORT', 'HOME_ESSENTIALS', 'SALON_BEAUTY']);
    const category = faker.helpers.arrayElement(categories[type]);
    const businessName = faker.company.name() + (type === 'FOOD_BEVERAGE' ? ' Restaurant' : '');

    const bp = await prisma.businessProfile.create({
      data: {
        userId: user.id,
        businessName,
        slug: faker.helpers.slugify(businessName).toLowerCase() + '-' + Date.now() + i,
        registrationNumber: faker.string.alphanumeric(8).toUpperCase(),
        businessType: type,
        localityName: faker.location.street(),
        pincode: '201310',
        status: 'available',
        cityId: faker.helpers.arrayElement(cities).id,
        rating: faker.number.float({ min: 3.5, max: 5.0, fractionDigits: 1 }),
        themeFlavor: type === 'FOOD_BEVERAGE' ? 'playful-vibrant' : type === 'CAB_TRANSPORT' ? 'trust-utility' : 'premium-elegant'
      }
    });

    await prisma.businessCategory.create({
      data: {
        businessProfileId: bp.id,
        categoryId: category.id
      }
    });
    businessProfiles.push(bp);
  }

  console.log('Seeding Catalogs, Orders, Leads, Analytics...');
  
  for (const bp of businessProfiles) {
    // Analytics (Profile Views & Clicks)
    for (let i = 0; i < 3; i++) {
      await prisma.leadAnalytic.create({
        data: {
          businessProfileId: bp.id,
          type: faker.helpers.arrayElement(['profile_view', 'profile_view', 'call_click', 'whatsapp_click'])
        }
      });
    }

    if (bp.businessType === 'CAB_TRANSPORT') {
      // Direct Whatsapp Leads for Cabs
      const dummy = await prisma.catalogItem.create({
        data: {
          businessProfileId: bp.id,
          categoryId: parentCats[bp.businessType].id,
          title: 'Base Fare',
          price: 50,
        }
      });

      for (let i = 0; i < 3; i++) {
        await prisma.lead.create({
          data: {
            businessProfileId: bp.id,
            catalogItemId: dummy.id,
            customerName: faker.person.fullName(),
            customerPhone: faker.phone.number({ style: 'national' }).replace(/[^0-9]/g, '').slice(0, 10),
            status: faker.helpers.arrayElement(['NEW', 'CONTACTED', 'CONVERTED'])
          }
        });
      }
      continue;
    }

    // Create 3 Catalog Items
    const numItems = 3;
    const items = [];
    for (let i = 0; i < numItems; i++) {
      const item = await prisma.catalogItem.create({
        data: {
          businessProfileId: bp.id,
          categoryId: faker.helpers.arrayElement(categories[bp.businessType]).id,
          title: bp.businessType === 'FOOD_BEVERAGE' ? faker.food.dish() : faker.commerce.productName(),
          description: faker.commerce.productDescription(),
          price: faker.number.float({ min: 50, max: 1500, fractionDigits: 0 }),
          isActive: true,
          isAvailable: true,
          metaData: bp.businessType === 'FOOD_BEVERAGE' ? { foodCategory: faker.helpers.arrayElement(['Starters', 'Main Course', 'Desserts', 'Beverages']), isVeg: faker.datatype.boolean() } : {}
        }
      });
      items.push(item);
    }

    // Create Orders / Leads
    if (bp.businessType === 'FOOD_BEVERAGE') {
      // In-app Transactional Orders
      for (let i = 0; i < 3; i++) {
        const orderItemsCount = 2;
        const selectedItems = faker.helpers.arrayElements(items, orderItemsCount);
        let totalValue = 0;
        
        const orderItemsData = selectedItems.map(si => {
          const qty = faker.number.int({ min: 1, max: 3 });
          const price = parseFloat(si.price);
          totalValue += (price * qty);
          return {
            catalogItemId: si.id,
            quantity: qty,
            priceAtTimeOfOrder: price
          };
        });

        await prisma.orderEnquiry.create({
          data: {
            businessProfileId: bp.id,
            orderType: 'TRANSACTIONAL',
            customerName: faker.person.fullName(),
            customerPhone: faker.phone.number({ style: 'national' }).replace(/[^0-9]/g, '').slice(0, 10),
            totalValue,
            status: faker.helpers.arrayElement(['PENDING', 'CONFIRMED', 'COMPLETED', 'REJECTED']),
            items: {
              create: orderItemsData
            }
          }
        });
      }
    } else {
      // Home Services / Salon Leads
      for (let i = 0; i < 3; i++) {
        await prisma.lead.create({
          data: {
            businessProfileId: bp.id,
            catalogItemId: faker.helpers.arrayElement(items).id,
            customerName: faker.person.fullName(),
            customerPhone: faker.phone.number({ style: 'national' }).replace(/[^0-9]/g, '').slice(0, 10),
            status: faker.helpers.arrayElement(['NEW', 'CONTACTED', 'CONVERTED'])
          }
        });
      }
    }
  }

  console.log('Seed completed successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
