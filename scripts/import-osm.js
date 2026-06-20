/**
 * F1 supply importer — seed unclaimed DIRECTORY (T1) stubs from OpenStreetMap
 * via the Overpass API, so each PB/HR district has live listings to discover and
 * later "claim". Legitimate, key-free, ToS-clean (NOT competitor scraping).
 *
 * ⚠️ The .env DATABASE_URL points at PRODUCTION. This script is DRY-RUN by
 * default — it queries Overpass (read-only network) and prints what it WOULD
 * import. Pass --apply to actually write BusinessProfile stubs to prod.
 *
 *   node scripts/import-osm.js                          # dry run, ALL PB/HR districts
 *   node scripts/import-osm.js --district=hisar         # dry run, one district (by slug)
 *   node scripts/import-osm.js --district=hisar --apply # write Hisar stubs to prod
 *   node scripts/import-osm.js --verticals=FOOD_BEVERAGE,SALON_BEAUTY
 *   node scripts/import-osm.js --limit=50               # cap stubs per district
 *
 * Idempotent: re-runs dedup on (source='osm', externalId='<type>/<id>') and
 * refresh existing stubs in place rather than duplicating. Stubs are created with
 * userId=null, isClaimed=false, listingTier from the resolved vertical/subcategory.
 * The listed phone + address + OSM tags are stashed in metaData.osm for the future
 * claim flow (F3). Only NAMED elements are imported.
 */

import slugify from 'slugify';
import prisma from '../src/config/prisma.js';
import { allDistricts, districtBySlug, canonicalDistrict } from '../src/config/regions.js';
import { TIERS, getVertical } from '../src/config/verticals.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const UA = 'NearByBazar/1.0 (directory seeding; devs@intelliticks.com)';

// ---- CLI flags ----------------------------------------------------------
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const flag = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
};
const onlyDistrict = flag('district');                 // district slug
const onlyState = flag('state');                       // 'Haryana' | 'Punjab'
const verticalFilter = (flag('verticals') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
const excludeFilter = (flag('exclude') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
const perDistrictLimit = flag('limit') ? parseInt(flag('limit'), 10) : Infinity;

// ---- OSM tag → taxonomy mapping -----------------------------------------
// Each rule maps an OSM key=value to our { vertical, subcategory }. The listing
// tier is then resolved from the vertical/sub-category (verticals.js), so a
// mapped doctor lands BOOKABLE while a pharmacy lands DIRECTORY, etc.
const MAP = {
  amenity: {
    restaurant: ['FOOD_BEVERAGE', 'restaurant'],
    cafe: ['FOOD_BEVERAGE', 'cafe'],
    fast_food: ['FOOD_BEVERAGE', 'street-food'],
    food_court: ['FOOD_BEVERAGE', 'restaurant'],
    ice_cream: ['FOOD_BEVERAGE', 'street-food'],
    pharmacy: ['HEALTH_MEDICAL', 'pharmacy'],
    clinic: ['HEALTH_MEDICAL', 'general-physician'],
    doctors: ['HEALTH_MEDICAL', 'general-physician'],
    dentist: ['HEALTH_MEDICAL', 'dentist'],
    hospital: ['HEALTH_MEDICAL', 'hospital'],
    veterinary: ['HEALTH_MEDICAL', 'vet'],
    school: ['EDUCATION', 'school'],
    college: ['EDUCATION', 'coaching'],
    language_school: ['EDUCATION', 'coaching'],
    music_school: ['EDUCATION', 'music-dance'],
    bank: ['FINANCIAL_SERVICES', 'atm'],
    atm: ['FINANCIAL_SERVICES', 'atm'],
    car_wash: ['AUTOMOTIVE', 'car-wash'],
    fuel: null, // usually unnamed; skip
  },
  shop: {
    bakery: ['FOOD_BEVERAGE', 'bakery'],
    confectionery: ['FOOD_BEVERAGE', 'mithai'],
    pastry: ['FOOD_BEVERAGE', 'bakery'],
    supermarket: ['GROCERY', 'supermarket'],
    convenience: ['GROCERY', 'kirana'],
    general: ['GROCERY', 'kirana'],
    greengrocer: ['GROCERY', 'kirana'],
    dairy: ['GROCERY', 'dairy'],
    clothes: ['RETAIL', 'apparel'],
    shoes: ['RETAIL', 'footwear'],
    jewelry: ['RETAIL', 'jewellery'],
    mobile_phone: ['RETAIL', 'mobile-electronics'],
    electronics: ['RETAIL', 'mobile-electronics'],
    optician: ['RETAIL', 'optical'],
    gift: ['RETAIL', 'gift-shop'],
    hardware: ['RETAIL', 'hardware'],
    doityourself: ['RETAIL', 'hardware'],
    stationery: ['RETAIL', 'stationery'],
    hairdresser: ['SALON_BEAUTY', 'haircut'],
    beauty: ['SALON_BEAUTY', 'bridal-makeup'],
    car_repair: ['AUTOMOTIVE', 'car-service'],
    motorcycle: ['AUTOMOTIVE', 'car-service'],
    tyres: ['AUTOMOTIVE', 'tyres'],
    car_parts: ['AUTOMOTIVE', 'spare-parts'],
    tailor: ['PERSONAL_SERVICES', 'tailor'],
    laundry: ['PERSONAL_SERVICES', 'laundry'],
    dry_cleaning: ['PERSONAL_SERVICES', 'laundry'],
    shoe_repair: ['PERSONAL_SERVICES', 'cobbler'],
    travel_agency: ['TRAVEL', 'travel-agent'],
  },
  tourism: {
    hotel: ['HOTELS', 'hotel'],
    guest_house: ['HOTELS', 'guest-house'],
    motel: ['HOTELS', 'guest-house'],
    resort: ['HOTELS', 'resort'],
  },
  office: {
    lawyer: ['PROFESSIONAL_SERVICES', 'lawyer'],
    accountant: ['PROFESSIONAL_SERVICES', 'ca-accountant'],
    estate_agent: ['REAL_ESTATE', 'agent'],
    insurance: ['FINANCIAL_SERVICES', 'insurance'],
    travel_agent: ['TRAVEL', 'travel-agent'],
    it: ['PROFESSIONAL_SERVICES', 'it-services'],
  },
  leisure: {
    fitness_centre: ['FITNESS', 'gym'],
    sports_centre: ['FITNESS', 'gym'],
  },
  craft: {
    electrician: ['HOME_ESSENTIALS', 'electrician'],
    plumber: ['HOME_ESSENTIALS', 'plumber'],
    carpenter: ['HOME_ESSENTIALS', 'carpenter'],
    hvac: ['HOME_ESSENTIALS', 'ac-repair'],
  },
};

/** Resolve an OSM element's tags → { vertical, subcategory } or null if unmapped. */
const classify = (tags) => {
  for (const key of Object.keys(MAP)) {
    const val = tags[key];
    if (val && Object.prototype.hasOwnProperty.call(MAP[key], val)) {
      const rule = MAP[key][val];
      if (rule) return { vertical: rule[0], subcategory: rule[1] };
    }
  }
  return null;
};

// ---- Overpass helpers ---------------------------------------------------
async function overpass(query) {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Resolve a district's Overpass area id. Districts are admin_level 6 in PB/HR;
 * admin_level 5 is the (larger) division, so prefer 6, then 7, then 5. Returns
 * the area id (3600000000 + relation id) or null.
 */
async function resolveDistrictArea(name) {
  const j = await overpass(
    `[out:json][timeout:25];relation["name"="${name}"]["boundary"="administrative"]["admin_level"];out tags;`
  );
  const rels = j.elements || [];
  for (const lvl of ['6', '7', '5']) {
    const hit = rels.find((r) => r.tags?.admin_level === lvl);
    if (hit) return { areaId: 3600000000 + hit.id, level: lvl, relId: hit.id };
  }
  return null;
}

/** Build the union query selecting every mapped tag within an area. */
function poiQuery(areaId) {
  const parts = [];
  for (const key of Object.keys(MAP)) {
    const values = Object.entries(MAP[key]).filter(([, v]) => v).map(([k]) => k);
    if (!values.length) continue;
    const regex = values.join('|');
    parts.push(`node["${key}"~"^(${regex})$"](area.a);`);
    parts.push(`way["${key}"~"^(${regex})$"](area.a);`);
  }
  return `[out:json][timeout:90];area(${areaId})->.a;(${parts.join('')});out center tags;`;
}

// ---- Stub upsert --------------------------------------------------------
async function findOrCreateCity(districtName, state) {
  const slug = slugify(districtName, { lower: true, strict: true });
  let city = await prisma.city.findUnique({ where: { slug } });
  if (!city) {
    city = await prisma.city.create({ data: { name: districtName, slug, state, district: districtName } });
  } else if (!city.district) {
    city = await prisma.city.update({ where: { id: city.id }, data: { district: districtName } });
  }
  return city;
}

function buildStub(el, klass, cityId, districtName) {
  const tags = el.tags || {};
  const name = tags.name || tags['name:en'];
  const lat = el.lat ?? el.center?.lat ?? null;
  const lng = el.lon ?? el.center?.lon ?? null;
  const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || null;
  const locality =
    tags['addr:street'] || tags['addr:suburb'] || tags['addr:neighbourhood'] || districtName;
  const pincode = tags['addr:postcode'] || '000000';
  const externalId = `${el.type}/${el.id}`;
  // Unclaimed imports are ALWAYS DIRECTORY (T1): a directory card (Call / Directions)
  // with no menu/booking until the owner claims it and upgrades. The vertical's
  // default tier only applies when a real vendor self-onboards (createBusinessProfile).
  return {
    externalId,
    create: {
      businessName: name,
      registrationNumber: `OSM-${el.type}-${el.id}`,
      slug: slugify(`${name}-${districtName}-${el.id}`, { lower: true, strict: true }),
      localityName: locality,
      pincode,
      cityId,
      businessType: klass.vertical,
      listingTier: 'DIRECTORY',
      isClaimed: false,
      source: 'osm',
      externalId,
      userId: null,
      moduleConfig: TIERS.DIRECTORY.moduleConfig,
      latitude: lat,
      longitude: lng,
      locationType: 'Shop',
      metaData: {
        osm: {
          id: externalId,
          subcategory: klass.subcategory,
          contactPhone: phone,
          addr: {
            street: tags['addr:street'] || null,
            city: tags['addr:city'] || null,
            postcode: tags['addr:postcode'] || null,
          },
          website: tags.website || tags['contact:website'] || null,
        },
      },
    },
  };
}

async function importDistrict(d, stats) {
  process.stdout.write(`\n[${d.state}] ${d.name} … `);
  const area = await resolveDistrictArea(d.name);
  if (!area) {
    console.log('no admin boundary found — skipped');
    return;
  }
  const data = await overpass(poiQuery(area.areaId));
  const elements = data.elements || [];

  // Classify + filter to named, mapped, (optionally) vertical-filtered elements.
  let candidates = [];
  for (const el of elements) {
    const tags = el.tags || {};
    if (!(tags.name || tags['name:en'])) continue; // unnamed → can't list
    const klass = classify(tags);
    if (!klass) continue;
    if (verticalFilter.length && !verticalFilter.includes(klass.vertical)) continue;
    if (excludeFilter.length && excludeFilter.includes(klass.vertical)) continue;
    candidates.push({ el, klass });
  }
  const total = candidates.length;
  if (Number.isFinite(perDistrictLimit)) candidates = candidates.slice(0, perDistrictLimit);

  // Per-vertical tally for the report.
  const byVertical = {};
  for (const c of candidates) byVertical[c.klass.vertical] = (byVertical[c.klass.vertical] || 0) + 1;
  console.log(`area L${area.level}, ${elements.length} POIs → ${total} mapped+named${total > candidates.length ? ` (capped ${candidates.length})` : ''}`);
  console.log('   ', Object.entries(byVertical).map(([k, n]) => `${k}:${n}`).join('  ') || '(none)');

  stats.scanned += elements.length;
  stats.mapped += candidates.length;

  if (!APPLY) return;

  const city = await findOrCreateCity(d.name, d.state);
  for (const { el, klass } of candidates) {
    const stub = buildStub(el, klass, city.id, d.name);
    const existing = await prisma.businessProfile.findFirst({
      where: { source: 'osm', externalId: stub.externalId },
      select: { id: true, isClaimed: true },
    });
    if (existing) {
      // Never clobber a claimed listing; refresh unclaimed metadata only.
      if (!existing.isClaimed) {
        await prisma.businessProfile.update({
          where: { id: existing.id },
          data: { listingTier: stub.create.listingTier, metaData: stub.create.metaData, latitude: stub.create.latitude, longitude: stub.create.longitude },
        });
        stats.updated += 1;
      } else {
        stats.skippedClaimed += 1;
      }
      continue;
    }
    try {
      await prisma.businessProfile.create({ data: stub.create });
      stats.created += 1;
    } catch (e) {
      stats.errors += 1;
      console.log(`    ! create failed for ${stub.externalId}: ${e.message}`);
    }
  }
}

async function main() {
  let districts = allDistricts();
  if (onlyDistrict) {
    const d = districtBySlug(onlyDistrict);
    districts = d ? [d] : [];
    if (!d) console.log(`Unknown district slug: ${onlyDistrict}`);
  } else if (onlyState) {
    const canon = onlyState.charAt(0).toUpperCase() + onlyState.slice(1).toLowerCase();
    districts = districts.filter((x) => x.state === canon);
  }

  console.log(`Mode: ${APPLY ? 'APPLY (writing to PROD)' : 'DRY RUN (no writes)'}`);
  console.log(`Districts: ${districts.length}${verticalFilter.length ? `  verticals=${verticalFilter.join(',')}` : ''}${Number.isFinite(perDistrictLimit) ? `  limit=${perDistrictLimit}/district` : ''}`);
  if (verticalFilter.some((v) => !getVertical(v))) {
    console.log('⚠️  Unknown vertical in --verticals filter; check spelling.');
  }

  const stats = { scanned: 0, mapped: 0, created: 0, updated: 0, skippedClaimed: 0, errors: 0 };
  for (const d of districts) {
    try {
      await importDistrict(d, stats);
    } catch (e) {
      console.log(`  ! ${d.name} failed: ${e.message}`);
    }
    await sleep(1200); // be gentle with the public Overpass endpoint
  }

  console.log('\n— Summary —');
  console.log(`POIs scanned:   ${stats.scanned}`);
  console.log(`Mapped+named:   ${stats.mapped}`);
  if (APPLY) {
    console.log(`Created:        ${stats.created}`);
    console.log(`Updated:        ${stats.updated}`);
    console.log(`Skipped claimed:${stats.skippedClaimed}`);
    console.log(`Errors:         ${stats.errors}`);
  } else {
    console.log(`\nDry run only. Re-run with --apply (optionally --district / --verticals / --limit) to write.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
