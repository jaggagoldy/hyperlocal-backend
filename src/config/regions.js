/**
 * Region registry — the canonical Haryana + Punjab district lists used to pin
 * every vendor to a real district at onboarding and to drive the consumer
 * location filter. Hardcoded config (no District table), mirroring the
 * verticals.js pattern; served via the public, cached GET /api/v1/regions.
 *
 * District names are the source of truth: `City.district` stores the name
 * string, onboarding sets `cityName = district`, and search filters on
 * `City.district === <name>`. The `slug` is derived with the SAME slugify
 * config createBusinessProfile uses, so a district's slug here equals the
 * `City.slug` minted at onboarding — letting the consumer dropdown filter by
 * `citySlug` without any extra mapping.
 */

import slugify from 'slugify';

const toSlug = (name) => slugify(name, { lower: true, strict: true });

// Canonical district names. Common/recognizable names are used as the display
// label (e.g. "Mohali", "Nawanshahr"); these are also what gets stored.
const HARYANA_DISTRICT_NAMES = [
  'Ambala', 'Bhiwani', 'Charkhi Dadri', 'Faridabad', 'Fatehabad', 'Gurugram',
  'Hisar', 'Jhajjar', 'Jind', 'Kaithal', 'Karnal', 'Kurukshetra',
  'Mahendragarh', 'Nuh', 'Palwal', 'Panchkula', 'Panipat', 'Rewari',
  'Rohtak', 'Sirsa', 'Sonipat', 'Yamunanagar',
]; // 22

const PUNJAB_DISTRICT_NAMES = [
  'Amritsar', 'Barnala', 'Bathinda', 'Faridkot', 'Fatehgarh Sahib', 'Fazilka',
  'Ferozepur', 'Gurdaspur', 'Hoshiarpur', 'Jalandhar', 'Kapurthala', 'Ludhiana',
  'Malerkotla', 'Mansa', 'Moga', 'Sri Muktsar Sahib', 'Pathankot', 'Patiala',
  'Rupnagar', 'Mohali', 'Sangrur', 'Nawanshahr', 'Tarn Taran',
]; // 23

const toDistrict = (state) => (name) => ({ name, slug: toSlug(name), state });

export const HARYANA_DISTRICTS = HARYANA_DISTRICT_NAMES.map(toDistrict('Haryana'));
export const PUNJAB_DISTRICTS = PUNJAB_DISTRICT_NAMES.map(toDistrict('Punjab'));

// Canonical state -> districts map. Order here is the order the UI renders.
export const REGIONS = [
  { name: 'Haryana', districts: HARYANA_DISTRICTS },
  { name: 'Punjab', districts: PUNJAB_DISTRICTS },
];

const STATE_LOOKUP = new Map(REGIONS.map((r) => [r.name.toLowerCase(), r]));

/** Districts ([{name, slug, state}]) for a given state, or [] if unknown. */
export const districtsForState = (state) => {
  const region = STATE_LOOKUP.get((state || '').trim().toLowerCase());
  return region ? region.districts : [];
};

/** Every district across all supported states (for the consumer location list). */
export const allDistricts = () => REGIONS.flatMap((r) => r.districts);

const SLUG_LOOKUP = new Map(allDistricts().map((d) => [d.slug, d]));

/** Resolve a slug to its canonical district ({name, slug, state}), or null. */
export const districtBySlug = (slug) => SLUG_LOOKUP.get(slug) || null;

/** True if `district` is a valid district name within `state` (case-insensitive). */
export const isValidDistrict = (state, district) => {
  if (!state || !district) return false;
  const target = district.trim().toLowerCase();
  return districtsForState(state).some((d) => d.name.toLowerCase() === target);
};

/** Resolve a free-text district to its canonical name within a state, or null. */
export const canonicalDistrict = (state, district) => {
  if (!district) return null;
  const target = district.trim().toLowerCase();
  const match = districtsForState(state).find((d) => d.name.toLowerCase() === target);
  return match ? match.name : null;
};
