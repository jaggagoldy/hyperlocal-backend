import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed for vendor orders...');

  // 1. Find a vendor user (or just use the first available business profile)
  const vendor = await prisma.user.findFirst({
    where: { role: 'vendor' },
    include: { businessProfiles: true }
  });

  if (!vendor || vendor.businessProfiles.length === 0) {
    console.log('No vendor with a business profile found. Run main seeder first.');
    return;
  }

  // Use the first business profile, ideally a FOOD one if it exists
  let businessProfile = vendor.businessProfiles.find(bp => bp.businessType === 'FOOD');
  if (!businessProfile) {
    businessProfile = vendor.businessProfiles[0];
  }

  console.log(`Seeding data for Business: ${businessProfile.businessName} (ID: ${businessProfile.id})`);

  // 2. Ensure we have some catalog items to create orders with
  const catalogItems = await prisma.catalogItem.findMany({
    where: { businessProfileId: businessProfile.id }
  });

  if (catalogItems.length === 0) {
    console.log('No catalog items found for this business. Seed some items first.');
    return;
  }

  // 3. Clear existing leads/orders for this business (optional, but good for clean slate)
  await prisma.lead.deleteMany({ where: { businessProfileId: businessProfile.id } });
  await prisma.orderEnquiry.deleteMany({ where: { businessProfileId: businessProfile.id } });

  // 4. Seed Leads (Single item inquiries)
  console.log('Seeding Leads...');
  const leadData = [
    { customerName: 'Rahul Kumar', customerPhone: '9876543210', status: 'NEW', message: 'Is this available for delivery today?' },
    { customerName: 'Sneha Singh', customerPhone: '8765432109', status: 'CONTACTED', message: 'Do you offer bulk discounts for 10 units?' },
    { customerName: 'Amit Patel', customerPhone: '7654321098', status: 'CONVERTED', message: 'I will pick it up at 5 PM.' },
    { customerName: 'Priya Sharma', customerPhone: '6543210987', status: 'REJECTED', message: 'Can you deliver to sector 12?' }
  ];

  for (const l of leadData) {
    await prisma.lead.create({
      data: {
        businessProfileId: businessProfile.id,
        catalogItemId: catalogItems[Math.floor(Math.random() * catalogItems.length)].id,
        customerName: l.customerName,
        customerPhone: l.customerPhone,
        status: l.status,
        customerRequirement: l.message
      }
    });
  }

  // 5. Seed OrderEnquiries (Multi-item cart orders)
  console.log('Seeding Multi-item Orders...');
  const ordersData = [
    {
      customerName: 'Karan Malhotra',
      customerPhone: '9988776655',
      serviceLocation: 'Block C, Tech Park, City',
      status: 'PENDING',
      orderType: 'TRANSACTIONAL',
      itemCount: 3
    },
    {
      customerName: 'Neha Gupta',
      customerPhone: '8877665544',
      serviceLocation: 'Apt 402, Sunshine Residency',
      status: 'CONFIRMED',
      orderType: 'TRANSACTIONAL',
      itemCount: 2
    },
    {
      customerName: 'Ravi Desai',
      customerPhone: '7766554433',
      serviceLocation: 'Shop 14, Main Market',
      status: 'COMPLETED',
      orderType: 'TRANSACTIONAL',
      itemCount: 4
    }
  ];

  for (const o of ordersData) {
    // Pick random items
    let totalValue = 0;
    const orderItems = [];
    for (let i = 0; i < o.itemCount; i++) {
      const item = catalogItems[Math.floor(Math.random() * catalogItems.length)];
      const qty = Math.floor(Math.random() * 3) + 1;
      const price = item.price ? parseFloat(item.price.toString()) : 100;
      totalValue += (price * qty);
      
      orderItems.push({
        catalogItemId: item.id,
        quantity: qty,
        priceAtTimeOfOrder: price
      });
    }

    await prisma.orderEnquiry.create({
      data: {
        businessProfileId: businessProfile.id,
        orderType: o.orderType,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        serviceLocation: o.serviceLocation,
        totalValue: totalValue,
        status: o.status,
        items: {
          create: orderItems
        }
      }
    });
  }

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
