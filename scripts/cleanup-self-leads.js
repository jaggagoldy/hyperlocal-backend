import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('Starting self-booking cleanup...');
  
  const leads = await prisma.lead.findMany({
    include: {
      vendor: {
        include: {
          user: true
        }
      }
    }
  });

  let deletedCount = 0;

  for (const lead of leads) {
    if (lead.vendor?.user?.phoneNumber === lead.customerPhone) {
      console.log(`Deleting self-booked lead ${lead.id} (Customer: ${lead.customerName}, Phone: ${lead.customerPhone})`);
      await prisma.lead.delete({
        where: { id: lead.id }
      });
      deletedCount++;
    }
  }

  console.log(`Cleanup complete. Deleted ${deletedCount} self-booked leads.`);
  await prisma.$disconnect();
}

cleanup().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
