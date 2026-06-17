/**
 * One-time backfill for the single-role auth model.
 *
 * Sets role='vendor' for any non-admin user who owns a business profile or has
 * the legacy hasVendorProfile flag. Admins are left untouched; everyone else
 * stays 'customer' (the column default). Non-destructive and idempotent.
 *
 * Usage:
 *   node scripts/backfill-roles.js          # apply
 *   node scripts/backfill-roles.js --dry    # report only, no writes
 */
import prisma from '../src/config/prisma.js';

const dryRun = process.argv.includes('--dry');

async function main() {
  // Vendor candidates: own a business profile OR carry the legacy flag, and are not admins.
  const ownerIds = (
    await prisma.businessProfile.findMany({ select: { userId: true }, distinct: ['userId'] })
  ).map((b) => b.userId).filter(Boolean);

  const vendorWhere = {
    role: { not: 'admin' },
    OR: [{ id: { in: ownerIds } }, { hasVendorProfile: true }],
  };

  const vendorCount = await prisma.user.count({ where: vendorWhere });
  const adminCount = await prisma.user.count({ where: { role: 'admin' } });
  const totalCount = await prisma.user.count();

  console.log(`Users total: ${totalCount} | admins: ${adminCount} | vendor candidates: ${vendorCount}`);

  if (dryRun) {
    console.log('Dry run — no changes written.');
    return;
  }

  const result = await prisma.user.updateMany({
    where: { ...vendorWhere, role: { notIn: ['admin', 'vendor'] } },
    data: { role: 'vendor' },
  });
  console.log(`✅ Updated ${result.count} user(s) to role='vendor'.`);
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
