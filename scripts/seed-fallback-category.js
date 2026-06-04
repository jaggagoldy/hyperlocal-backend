import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting DB seed for NearByBazar fallback category...');
  
  const categorySlug = 'nearbybazar-general-services';
  
  const existingCategory = await prisma.category.findUnique({
    where: { slug: categorySlug }
  });

  if (existingCategory) {
    console.log(`✅ Category '${categorySlug}' already exists.`);
  } else {
    await prisma.category.create({
      data: {
        name: 'General Services',
        slug: categorySlug
      }
    });
    console.log(`✅ Successfully created '${categorySlug}' category.`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error during DB seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log('✅ DB connection closed.');
  });
