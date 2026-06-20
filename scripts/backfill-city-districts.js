/**
 * One-time backfill: populate City.district for legacy rows that have it null,
 * by matching the city's slug (or slugified name) to a canonical PB/HR district.
 *
 * ⚠️ The .env DATABASE_URL points at PRODUCTION. This script is DRY-RUN by
 * default — it only prints the proposed changes. Pass --apply to actually write.
 *
 *   node scripts/backfill-city-districts.js            # dry run (no writes)
 *   node scripts/backfill-city-districts.js --apply     # perform the update
 *
 * Cities that don't match any canonical district (e.g. "Delhi", outside PB/HR)
 * are left untouched and reported as skipped.
 */

import prisma from '../src/config/prisma.js';
import slugify from 'slugify';
import { districtBySlug } from '../src/config/regions.js';

const APPLY = process.argv.includes('--apply');

const resolveDistrict = (city) =>
  districtBySlug(city.slug) ||
  districtBySlug(slugify(city.name, { lower: true, strict: true }));

async function main() {
  const nullCities = await prisma.city.findMany({
    where: { district: null },
    select: { id: true, name: true, slug: true, state: true, _count: { select: { businessProfiles: true } } },
    orderBy: { name: 'asc' },
  });

  console.log(`Mode: ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}`);
  console.log(`City rows with district = null: ${nullCities.length}\n`);

  const planned = [];
  const skipped = [];
  for (const city of nullCities) {
    const match = resolveDistrict(city);
    if (match) planned.push({ city, district: match.name, state: match.state });
    else skipped.push(city);
  }

  console.log(`Will set district on ${planned.length} cities:`);
  for (const p of planned) {
    console.log(`  ${JSON.stringify(p.city.name)} (${p.city._count.businessProfiles} vendors) -> district="${p.district}", state="${p.state}"`);
  }
  console.log(`\nSkipped (no canonical match, left null): ${skipped.length}`);
  for (const s of skipped) {
    console.log(`  ${JSON.stringify(s.name)} (${s._count.businessProfiles} vendors)`);
  }

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to write these changes.');
    return;
  }

  let updated = 0;
  for (const p of planned) {
    await prisma.city.update({
      where: { id: p.city.id },
      data: { district: p.district, state: p.state },
    });
    updated += 1;
  }
  console.log(`\n✅ Updated ${updated} city rows.`);
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
