/**
 * prisma/create-kundi-sotta.js
 * Script to create and configure Kundi Sotta restaurant vendor and catalog with portion rates.
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

async function main() {
  console.log('🌱 Starting Kundi Sotta merchant registration with portions...');

  // 1. Ensure Fatehabad City exists
  console.log('🏙️ Ensuring City Fatehabad exists...');
  const city = await prisma.city.upsert({
    where: { slug: 'fatehabad' },
    update: {},
    create: {
      name: 'Fatehabad',
      slug: 'fatehabad'
    }
  });
  console.log(`✓ City ID: ${city.id}`);

  // 2. Ensure Food & Beverage categories exist
  console.log('🏷️ Ensuring Food & Beverage categories exist...');
  const parentCategory = await prisma.category.upsert({
    where: { slug: 'food-beverage' },
    update: { name: 'Food & Beverage' },
    create: {
      name: 'Food & Beverage',
      slug: 'food-beverage',
      archetype: 'FOOD_BEVERAGE'
    }
  });

  const subCategory = await prisma.category.upsert({
    where: { slug: 'restaurant' },
    update: { name: 'Restaurant', parentId: parentCategory.id },
    create: {
      name: 'Restaurant',
      slug: 'restaurant',
      parentId: parentCategory.id,
      archetype: 'FOOD_BEVERAGE'
    }
  });
  console.log(`✓ Parent ID: ${parentCategory.id}, Subcategory ID: ${subCategory.id}`);

  // 3. Create/Update User Account
  const phoneNumber = '8816019619';
  const email = 'kundisotta@gmail.com';
  const plainPassword = 'pass-123456789';
  const passwordHash = hashPassword(plainPassword);

  console.log(`👥 Creating/Updating user account for phone: ${phoneNumber}...`);
  const user = await prisma.user.upsert({
    where: { phoneNumber },
    update: {
      email,
      passwordHash,
      name: 'Kundi Sotta Owner',
      hasVendorProfile: true,
      hasCustomerProfile: true,
      isPhoneVerified: true
    },
    create: {
      phoneNumber,
      email,
      passwordHash,
      name: 'Kundi Sotta Owner',
      role: 'customer',
      hasVendorProfile: true,
      hasCustomerProfile: true,
      isPhoneVerified: true
    }
  });
  console.log(`✓ User ID: ${user.id}`);

  // 4. Create/Update Business Profile
  console.log('🏪 Creating/Updating business profile for Kundi Sotta...');
  
  // Clean up any existing profile
  const existingProfile = await prisma.businessProfile.findUnique({
    where: { slug: 'kundi-sotta' }
  });
  if (existingProfile) {
    console.log('🧹 Cleaning up existing business profile and catalog items for kundi-sotta...');
    await prisma.catalogItem.deleteMany({
      where: { businessProfileId: existingProfile.id }
    });
    await prisma.businessCategory.deleteMany({
      where: { businessProfileId: existingProfile.id }
    });
    await prisma.businessProfile.delete({
      where: { id: existingProfile.id }
    });
  }

  const businessProfile = await prisma.businessProfile.create({
    data: {
      userId: user.id,
      businessName: 'Kundi Sotta',
      slug: 'kundi-sotta',
      registrationNumber: `BP-KUNDISOTTA-${phoneNumber}`,
      businessType: 'FOOD_BEVERAGE',
      isStreetVendor: false,
      isOnline: true,
      localityName: 'Model Town',
      landmark: 'In Front of Papiha Park',
      pincode: '125050',
      status: 'available',
      membershipTier: 'Free',
      rating: 4.8,
      isFeatured: true,
      cityId: city.id,
      latitude: 29.5186,
      longitude: 75.4526,
      themeFlavor: 'food-premium-vibrant',
      idVerified: true,
      metaData: {
        cuisines: ['North Indian', 'Chinese', 'Beverages', 'Fast Food'],
        dietary: ['Pure Veg'],
        facilities: ['Dine-In', 'Takeaway', 'AC Seating']
      },
      moduleConfig: {
        commerce: true,
        scheduling: false,
        leadGen: false,
        estimation: false
      }
    }
  });
  console.log(`✓ Business Profile ID: ${businessProfile.id}`);

  // 5. Connect Business to Categories
  console.log('🔗 Connecting business to categories...');
  await prisma.businessCategory.createMany({
    data: [
      { businessProfileId: businessProfile.id, categoryId: parentCategory.id },
      { businessProfileId: businessProfile.id, categoryId: subCategory.id }
    ]
  });

  // 6. Seed Catalog Items with portion variants
  console.log('🍽️ Seeding catalog menu items with portion sizes...');
  const menuItems = [
    {
      title: 'Dal Makhani',
      description: 'Creamy slow-cooked black lentils with butter and cream. A house specialty.',
      price: 199,
      metaData: { dietary: 'veg', spicyLevel: 'medium' }
    },
    {
      title: 'Kadhai Paneer',
      description: 'Paneer cubes cooked with bell peppers, onions and freshly ground spices in a traditional kadhai.',
      price: 209,
      metaData: { dietary: 'veg', spicyLevel: 'high' }
    },
    {
      title: 'Shahi Paneer',
      description: 'Rich and creamy cottage cheese gravy cooked in cashew paste, cream, and mild spices.',
      price: 209,
      metaData: { dietary: 'veg', spicyLevel: 'low' }
    },
    {
      title: 'Lemon Kadhai Paneer',
      description: 'Tangy twist to the traditional kadhai paneer with a splash of fresh lemon juice.',
      price: 209,
      metaData: { dietary: 'veg', spicyLevel: 'medium' }
    },
    {
      title: 'Malai Chaap',
      description: 'Soya chaap marinated in rich cream, cashew paste, and light spices, grilled in tandoor.',
      variants: [
        { name: 'Half', price: 169 },
        { name: 'Full', price: 229 }
      ],
      metaData: { dietary: 'veg', spicyLevel: 'low' }
    },
    {
      title: 'Masala Chaap',
      description: 'Spicy soya chaap marinated in traditional yogurt and tandoori spices, char-grilled.',
      variants: [
        { name: 'Half', price: 169 },
        { name: 'Full', price: 229 }
      ],
      metaData: { dietary: 'veg', spicyLevel: 'high' }
    },
    {
      title: 'Tandoori Momos',
      description: 'Vegetable dumplings marinated in robust tandoori spices and roasted in the clay oven.',
      variants: [
        { name: 'Half', price: 109 },
        { name: 'Full', price: 159 }
      ],
      metaData: { dietary: 'veg', spicyLevel: 'high' }
    },
    {
      title: 'Veg. Chowmein',
      description: 'Stir-fried noodles tossed with crunchy fresh vegetables, soy sauce, and green chillies.',
      price: 109,
      metaData: { dietary: 'veg', spicyLevel: 'medium' }
    },
    {
      title: 'Chilly Garlic Noodles',
      description: 'Spicy stir-fried noodles with garlic, red chillies, and mixed seasonal veggies.',
      price: 139,
      metaData: { dietary: 'veg', spicyLevel: 'high' }
    },
    {
      title: 'Honey Chilly Potato',
      description: 'Crispy fried potato fingers tossed in a sweet and spicy honey chilli sauce with sesame seeds.',
      price: 159,
      metaData: { dietary: 'veg', spicyLevel: 'medium' }
    },
    {
      title: 'Manchurian (Dry/Gravy)',
      description: 'Deep-fried mixed vegetable balls in a tangy, savory, and aromatic soy-garlic sauce.',
      variants: [
        { name: 'Half', price: 79 },
        { name: 'Full', price: 109 }
      ],
      metaData: { dietary: 'veg', spicyLevel: 'medium' }
    },
    {
      title: 'Cheese Chilli',
      description: 'Paneer cubes tossed with capsicum, onions, and hot green chillies in a spicy soy-chilli sauce.',
      variants: [
        { name: 'Half', price: 139 },
        { name: 'Full', price: 209 }
      ],
      metaData: { dietary: 'veg', spicyLevel: 'high' }
    },
    {
      title: 'Garlic Naan',
      description: 'Leavened clay-oven flatbread topped with minced garlic and brushed with fresh butter.',
      price: 65,
      metaData: { dietary: 'veg' }
    },
    {
      title: 'Lacha Parantha',
      description: 'Multi-layered wheat flatbread prepared in the tandoor with Amul butter.',
      price: 40,
      metaData: { dietary: 'veg' }
    },
    {
      title: 'Butter Naan',
      description: 'Soft and fluffy refined flour flatbread baked in tandoor and glazed with butter.',
      price: 65,
      metaData: { dietary: 'veg' }
    },
    {
      title: 'Dry Platter',
      description: 'Assorted platter featuring dry paneer tikka, grilled chaap, and mushrooms with mint chutney.',
      price: 249,
      metaData: { dietary: 'veg', spicyLevel: 'medium' }
    },
    {
      title: 'Chinese Platter',
      description: 'Assorted platter containing Noodles, Fried Rice, Veg Manchurian, and Spring Rolls.',
      price: 299,
      metaData: { dietary: 'veg', spicyLevel: 'medium' }
    },
    {
      title: 'Strawberry Milkshake',
      description: 'Thick, creamy strawberry milkshake blended with fresh strawberry pulp and vanilla ice cream.',
      price: 99,
      metaData: { dietary: 'veg' }
    },
    {
      title: 'Turkish Hazelnut Coffee',
      description: 'Rich, smooth cold-brewed coffee infused with Turkish hazelnut syrup and milk.',
      price: 99,
      metaData: { dietary: 'veg' }
    },
    {
      title: 'Dal Makhani + 1 Butter Naan Combo',
      description: 'Perfect meal combo: Creamy Dal Makhani served alongside one hot tandoori Butter Naan.',
      price: 129,
      metaData: { dietary: 'veg' }
    }
  ];

  for (const item of menuItems) {
    await prisma.catalogItem.create({
      data: {
        businessProfileId: businessProfile.id,
        categoryId: subCategory.id,
        title: item.title,
        description: item.description,
        price: item.price !== undefined ? item.price : null,
        variants: item.variants || null,
        metaData: item.metaData,
        isAvailable: true,
        isActive: true
      }
    });
  }

  console.log(`✓ Successfully seeded ${menuItems.length} menu items!`);
  console.log('───────────────────────────────────────────────────────');
  console.log('🎉 Merchant Setup with Portions Complete!');
  console.log(`Login Phone Number: ${phoneNumber}`);
  console.log(`Login Password:     ${plainPassword}`);
  console.log(`Business Slug:      ${businessProfile.slug}`);
  console.log('───────────────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('❌ Error during setup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
