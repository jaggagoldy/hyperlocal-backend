/**
 * Data Migration: Dual-Profile Flags
 * 
 * Converts existing users to the new dual-profile architecture:
 * - Users with role='customer' -> hasCustomerProfile=true
 * - Users with role='vendor' -> hasVendorProfile=true  
 * - Users with role='admin' -> unchanged
 * - Also copies legacy gender/dateOfBirth/address -> customerGender/customerDateOfBirth/customerAddress
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting dual-profile migration...\n');

  // 1. Set hasCustomerProfile = true for all customer-role users
  const customerResult = await prisma.user.updateMany({
    where: { role: 'customer' },
    data: { hasCustomerProfile: true },
  });
  console.log(`✅ Set hasCustomerProfile=true for ${customerResult.count} customer users`);

  // 2. Set hasVendorProfile = true for all vendor-role users
  const vendorResult = await prisma.user.updateMany({
    where: { role: 'vendor' },
    data: { hasVendorProfile: true },
  });
  console.log(`✅ Set hasVendorProfile=true for ${vendorResult.count} vendor users`);

  // 3. For users who have a vendor relation, also ensure hasVendorProfile = true
  const usersWithVendor = await prisma.user.findMany({
    where: { vendor: { isNot: null } },
    select: { id: true },
  });
  if (usersWithVendor.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: usersWithVendor.map(u => u.id) } },
      data: { hasVendorProfile: true },
    });
    console.log(`✅ Ensured hasVendorProfile=true for ${usersWithVendor.length} users with vendor records`);
  }

  // 4. Copy legacy fields to customer-prefixed fields
  const usersToMigrate = await prisma.user.findMany({
    where: {
      hasCustomerProfile: true,
      OR: [
        { gender: { not: null } },
        { dateOfBirth: { not: null } },
        { address: { not: null } },
        { age: { not: null } },
      ],
    },
    select: { id: true, gender: true, dateOfBirth: true, address: true, age: true, name: true },
  });

  for (const user of usersToMigrate) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        customerName: user.name,
        customerGender: user.gender,
        customerDateOfBirth: user.dateOfBirth,
        customerAddress: user.address,
        customerAge: user.age,
      },
    });
  }
  console.log(`✅ Migrated legacy fields for ${usersToMigrate.length} customer users`);

  // 5. Final summary
  const stats = await prisma.user.groupBy({
    by: ['hasCustomerProfile', 'hasVendorProfile'],
    _count: { id: true },
  });
  console.log('\n📊 Final Profile Distribution:');
  stats.forEach(row => {
    const label = row.hasCustomerProfile && row.hasVendorProfile
      ? 'Dual-Profile (Customer + Vendor)'
      : row.hasCustomerProfile
      ? 'Customer Only'
      : row.hasVendorProfile
      ? 'Vendor Only'
      : 'No Profile (Admin or Legacy)';
    console.log(`  ${label}: ${row._count.id}`);
  });

  console.log('\n✨ Migration complete!');
}

main()
  .catch(e => { console.error('Migration failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
