/**
 * PROD DEMO SEED (API-based) — adds TAGGED, easily-removable demo data to the
 * LIVE backend for client demos. It NEVER deletes anything and talks only to the
 * public API (no direct DB / no secrets).
 *
 * Everything it creates is tagged for one-command cleanup at launch:
 *   - users   → email domain @nbb-demo.test
 *   - business→ metaData.isDemo = true
 * Remove later with:  DATABASE_URL="<prod>" node scripts/remove-prod-demo.cjs --yes
 *
 * Run (guarded):
 *   CONFIRM_PROD=yes node scripts/seed-prod-demo.cjs
 * Optional: VENDORS=20 CUSTOMERS=10 ORDERS=15 PROD_API="https://.../api/v1"
 */
const fs = require('fs');
const path = require('path');

const API = process.env.PROD_API || 'https://hyperlocal-backend-n690.onrender.com/api/v1';
const VENDORS = parseInt(process.env.VENDORS || '20', 10);
const CUSTOMERS = parseInt(process.env.CUSTOMERS || '10', 10);
const ORDERS = parseInt(process.env.ORDERS || '15', 10);
const PASS = '12345678';
const DOMAIN = '@nbb-demo.test';

if (process.env.CONFIRM_PROD !== 'yes') {
  console.error('REFUSING TO RUN: this writes DEMO data to the LIVE API.\nRe-run with:  CONFIRM_PROD=yes node scripts/seed-prod-demo.cjs');
  process.exit(1);
}

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];
const sample = (a, k) => [...a].sort(() => Math.random() - 0.5).slice(0, k);
const between = (a, b) => a + rnd(b - a + 1);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function req(method, p, { body, token, businessId } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (businessId) headers['x-business-id'] = businessId;
  const res = await fetch(`${API}${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch {}
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${json?.message || ''}`);
  return json?.data ?? json;
}

const DISTRICTS = ['Gurugram', 'Hisar', 'Fatehabad', 'Karnal', 'Rohtak', 'Panipat'];
const LOCALITIES = ['Model Town', 'Civil Lines', 'Sector 14', 'Main Bazaar', 'Railway Road', 'Green Park'];
const FIRST = ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Priya', 'Ananya', 'Diya', 'Kavya', 'Rahul', 'Rohit', 'Amit', 'Simran'];
const LAST = ['Sharma', 'Verma', 'Gupta', 'Singh', 'Yadav', 'Jain', 'Mehta', 'Bansal', 'Goyal', 'Chauhan'];
const name = () => `${pick(FIRST)} ${pick(LAST)}`;
const phone = () => '9' + String(between(100000000, 999999999));
const IMG = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=70`;

const VERTS = [
  { type: 'FOOD_BEVERAGE', sub: 'restaurant', names: ['Spice Junction', 'Tandoori Nights', 'Cafe Mocha', 'Biryani House', 'Chaat Bazaar', 'Green Chilli', 'Royal Treat', 'Punjabi Dhaba'],
    items: ['Paneer Butter Masala', 'Veg Biryani', 'Butter Naan', 'Chicken Tikka', 'Masala Dosa', 'Cold Coffee', 'Gulab Jamun', 'Dal Makhani'], img: 'photo-1517248135467-4c7edcad34c4' },
  { type: 'GROCERY', sub: 'kirana', names: ['Daily Fresh Mart', 'Apna Kirana', 'SuperSave Bazaar', 'FreshPick Grocery'],
    items: ['Aashirvaad Atta 5kg', 'Amul Milk 1L', 'Tata Salt 1kg', 'Fortune Oil 1L', 'Basmati Rice 5kg', 'Sugar 1kg'], img: 'photo-1604719312566-8912e9227c6a' },
  { type: 'RETAIL', sub: 'apparel', names: ['Trendz Apparel', 'Mobile World', 'Style Studio', 'Sole Mate Footwear'],
    items: ['Cotton T-Shirt', 'Running Shoes', 'Wireless Earbuds', 'Denim Jeans', 'Leather Wallet'], img: 'photo-1441986300917-64674bd600d8' },
  { type: 'SALON_BEAUTY', sub: 'haircut', names: ['Glamour Salon', 'The Style Lounge', 'Blush Beauty Bar', 'Bliss Spa'],
    items: ['Haircut & Styling', 'Facial', 'Manicure', 'Hair Spa', 'Bridal Makeup'], img: 'photo-1521590832167-7bcbfaa6381f' },
  { type: 'HEALTH_MEDICAL', sub: 'pharmacy', names: ['City Care Clinic', 'Wellness Pharmacy', 'LifeLine Diagnostics', 'Smile Dental'],
    items: ['General Consultation', 'Blood Test', 'Dental Checkup'], img: 'photo-1519494026892-80bbd2d6fd0d' },
  { type: 'HOME_ESSENTIALS', sub: 'ac-repair', names: ['QuickFix Electricals', 'Cool Breeze AC Repair', 'Sharma Plumbing', 'Sparkle Cleaning'],
    items: ['AC Service', 'RO Repair', 'Deep Cleaning', 'Plumbing Visit'], img: 'photo-1581578731548-c64695cc6952' },
  { type: 'FITNESS', sub: 'gym', names: ['Iron Paradise Gym', 'Zen Yoga Studio', 'FlexFit'],
    items: ['Monthly Membership', 'Personal Training', 'Yoga Class'], img: 'photo-1571902943202-507ec2618e8f' },
  { type: 'EDUCATION', sub: 'coaching', names: ['BrightMinds Coaching', 'Genius Tuition', 'Rhythm Music Academy'],
    items: ['Maths Batch', 'Science Batch', 'Spoken English'], img: 'photo-1503676260728-1c00da094a0b' },
];

function meta(v) {
  const base = { isDemo: true, displayName: '', contactPhone: '' };
  if (v.type === 'FOOD_BEVERAGE') return { ...base, cuisines: sample(['North Indian', 'Chinese', 'Fast Food', 'South Indian'], 2), isVegOnly: Math.random() < 0.35, avgPrice: pick([200, 250, 300, 400]), deliveryTime: pick(['25–35 min', '30–40 min']) };
  return base;
}

async function main() {
  console.log(`→ Seeding PROD demo data via ${API}`);
  await req('GET', '/meta').catch(() => {}); // warm up (Render cold start)

  const results = { customers: [], vendors: [], orders: 0, errors: [] };

  console.log(`→ ${CUSTOMERS} demo customers…`);
  for (let i = 1; i <= CUSTOMERS; i++) {
    try {
      const d = await req('POST', '/auth/register', { body: { email: `user${i}${DOMAIN}`, password: PASS, name: name(), role: 'customer' } });
      results.customers.push({ email: `user${i}${DOMAIN}`, token: d.token, name: d.user?.name });
    } catch (e) { results.errors.push(`customer${i}: ${e.message}`); }
  }

  console.log(`→ ${VENDORS} demo vendors + businesses + catalog…`);
  for (let i = 1; i <= VENDORS; i++) {
    const v = VERTS[(i - 1) % VERTS.length];
    const district = pick(DISTRICTS);
    const bn = `${pick(v.names)} ${district}`;
    const contact = phone();
    try {
      const reg = await req('POST', '/auth/register', { body: { email: `vendor${i}${DOMAIN}`, password: PASS, name: name(), role: 'customer' } });
      const m = meta(v); m.displayName = bn; m.contactPhone = contact;
      const biz = await req('POST', '/business/register', {
        token: reg.token,
        body: {
          businessName: bn, businessType: v.type, subcategorySlug: v.sub,
          state: 'Haryana', district, cityName: district,
          localityName: `${pick(LOCALITIES)}, ${district}`, pincode: String(between(121001, 136999)),
          connectionMode: 'REQUIRE_APPROVAL', metaData: m,
        },
      });
      const vToken = biz.token || reg.token;
      const bizId = biz.id;
      const itemIds = [];
      for (const title of sample(v.items, between(4, Math.min(6, v.items.length)))) {
        try {
          const it = await req('POST', '/catalog', { token: vToken, businessId: bizId, body: { businessProfileId: bizId, title, price: pick([90, 120, 150, 199, 250, 499]), isVeg: Math.random() < 0.6, metaData: { isDemo: true } } });
          if (it?.id) itemIds.push(it.id);
        } catch (e) { results.errors.push(`catalog ${bn}/${title}: ${e.message}`); }
      }
      results.vendors.push({ email: `vendor${i}${DOMAIN}`, business: bn, type: v.type, bizId, vToken, itemIds });
      process.stdout.write(`  ✓ ${i}/${VENDORS} ${bn} (${itemIds.length} items)\n`);
    } catch (e) { results.errors.push(`vendor${i}: ${e.message}`); process.stdout.write(`  ✗ ${i}/${VENDORS} ${e.message}\n`); }
    await sleep(120);
  }

  console.log(`→ ${ORDERS} demo orders…`);
  const sellable = results.vendors.filter((v) => v.itemIds.length);
  for (let k = 0; k < ORDERS && results.customers.length && sellable.length; k++) {
    const cust = pick(results.customers);
    const v = pick(sellable);
    try {
      const items = sample(v.itemIds, between(1, Math.min(3, v.itemIds.length))).map((id) => ({ catalogItemId: id, quantity: between(1, 3) }));
      const order = await req('POST', '/orders', { token: cust.token, body: { businessProfileId: v.bizId, orderType: 'TRANSACTIONAL', customerName: cust.name || 'Demo Customer', customerPhone: phone(), serviceLocation: 'Demo address', items } });
      results.orders++;
      // mark ~1 in 3 completed so vendor dashboards look active
      if (order?.id && Math.random() < 0.35) {
        try { await req('PATCH', `/orders/vendor/${order.id}`, { token: v.vToken, businessId: v.bizId, body: { status: 'COMPLETED' } }); } catch {}
      }
    } catch (e) { results.errors.push(`order${k}: ${e.message}`); }
  }

  // credentials file
  const OUT = path.join(__dirname, '..', 'PROD_DEMO_CREDENTIALS.md');
  let md = `# NearByBazar — PROD Demo Credentials (REMOVE AT LAUNCH)\n\n`;
  md += `Password for all: \`${PASS}\`  ·  Login with the email.\n\n`;
  md += `All demo users use the **@nbb-demo.test** domain and all demo businesses are\ntagged \`metaData.isDemo = true\`. Remove everything with:\n\n`;
  md += '```\nDATABASE_URL="<prod-neon-url>" node scripts/remove-prod-demo.cjs --yes\n```\n\n';
  md += `## Vendors (${results.vendors.length})\n\n| Login | Business | Vertical |\n|---|---|---|\n`;
  results.vendors.forEach((v) => { md += `| ${v.email} | ${v.business} | ${v.type} |\n`; });
  md += `\n## Customers (${results.customers.length})\n\n`;
  results.customers.forEach((c) => { md += `- ${c.email}\n`; });
  fs.writeFileSync(OUT, md);

  console.log(`\n✅ DONE — vendors:${results.vendors.length} customers:${results.customers.length} orders:${results.orders} errors:${results.errors.length}`);
  if (results.errors.length) console.log('first errors:\n' + results.errors.slice(0, 8).map((e) => '  - ' + e).join('\n'));
  console.log(`Credentials written to PROD_DEMO_CREDENTIALS.md`);
}

main().catch((e) => { console.error(e); process.exit(1); });
