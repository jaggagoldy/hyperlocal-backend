/**
 * One-time backfill: set BusinessProfile.listingTier for legacy rows where it's
 * null, derived from each profile's businessType → the vertical's defaultTier
 * (Phase F). All current rows are self-onboarded single-vertical businesses, so
 * the vertical default is correct; sub-category tier overrides (e.g. a doctor in
 * Health & Medical → BOOKABLE) only apply to NEW onboarding via createBusinessProfile.
 *
 * ⚠️ The .env DATABASE_URL points at PRODUCTION. This script is DRY-RUN by
 * default — it only prints the proposed changes. Pass --apply to actually write.
 *
 *   node scripts/backfill-listing-tiers.js            # dry run (no writes)
 *   node scripts/backfill-listing-tiers.js --apply     # perform the update
 *
 * Rows whose businessType isn't a known vertical fall back to DIRECTORY and are
 * reported so they can be reviewed.
 */

import prisma from '../src/config/prisma.js';
import { getVertical, getDefaultTier } from '../src/config/verticals.js';

const APPLY = process.argv.includes('--apply');

async function main() {
  const rows = await prisma.businessProfile.findMany({
    where: { listingTier: null, deletedAt: null },
    select: { id: true, businessName: true, businessType: true },
    orderBy: { businessName: 'asc' },
  });

  console.log(`Mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`);
  console.log(`Rows with listingTier = null: ${rows.length}\n`);

  const planned = [];
  const unknown = [];
  for (const r of rows) {
    const tier = getDefaultTier(r.businessType);
    const known = !!getVertical(r.businessType);
    (known ? planned : unknown).push({ ...r, tier });
    console.log(`  ${known ? '•' : '?'} ${r.businessName} [${r.businessType}] -> ${tier}`);
  }

  if (unknown.length) {
    console.log(`\n⚠️  ${unknown.length} row(s) have an unknown businessType (defaulted to DIRECTORY) — review above.`);
  }

  if (!APPLY) {
    console.log(`\nDry run only. Re-run with --apply to write ${planned.length + unknown.length} update(s).`);
    return;
  }

  let written = 0;
  for (const r of [...planned, ...unknown]) {
    await prisma.businessProfile.update({ where: { id: r.id }, data: { listingTier: r.tier } });
    written += 1;
  }
  console.log(`\n✅ Updated listingTier on ${written} row(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
