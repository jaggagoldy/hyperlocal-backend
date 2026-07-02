/**
 * REMOVE PROD DEMO DATA — deletes everything seed-prod-demo.cjs created, and
 * ONLY that (demo users on @nbb-demo.test + businesses tagged metaData.isDemo).
 * Real data is untouched. Run this at launch.
 *
 *   DATABASE_URL="<prod-neon-url>" node scripts/remove-prod-demo.cjs --yes
 */
const { PrismaClient } = require('@prisma/client');

if (!process.argv.includes('--yes')) {
  console.error('REFUSING: append --yes to confirm deletion of demo data.');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) { console.error('Set DATABASE_URL to the PROD connection string.'); process.exit(1); }

const prisma = new PrismaClient({ datasources: { db: { url } } });
const DOMAIN = '@nbb-demo.test';

(async () => {
  console.log('DB host:', (() => { try { return new URL(url).host; } catch { return '?'; } })());

  const demoUsers = await prisma.user.findMany({ where: { email: { endsWith: DOMAIN } }, select: { id: true } });
  const userIds = demoUsers.map((u) => u.id);
  const demoBiz = await prisma.businessProfile.findMany({
    where: { OR: [{ metaData: { path: ['isDemo'], equals: true } }, { userId: { in: userIds } }] },
    select: { id: true },
  });
  const bizIds = demoBiz.map((b) => b.id);
  console.log(`Found ${userIds.length} demo users, ${bizIds.length} demo businesses.`);
  if (!userIds.length && !bizIds.length) { console.log('Nothing to remove.'); await prisma.$disconnect(); return; }

  const orders = await prisma.orderEnquiry.deleteMany({ where: { OR: [{ businessProfileId: { in: bizIds } }, { customerId: { in: userIds } }] } });
  const biz = await prisma.businessProfile.deleteMany({ where: { id: { in: bizIds } } }); // cascades catalog/media/categories
  const users = await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  console.log(`✅ Removed — orders:${orders.count} businesses:${biz.count} users:${users.count}`);
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
