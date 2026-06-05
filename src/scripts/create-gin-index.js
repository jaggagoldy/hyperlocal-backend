import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database to create GIN index...');
  
  try {
    // Execute the raw PostgreSQL command to create a GIN index on the Jsonb metaData column
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS business_profile_metadata_gin_idx 
      ON "BusinessProfile" USING gin ("metaData");
    `);
    
    console.log('✅ Successfully created GIN index on "BusinessProfile"."metaData"');
  } catch (error) {
    console.error('❌ Failed to create GIN index:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
