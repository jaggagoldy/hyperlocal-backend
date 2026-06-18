/**
 * Vertical blueprint registry — the single source of truth for the business
 * verticals the platform supports, their sub-categories, capability blueprint,
 * taxonomy fields, booking modes, storefront template family, and onboarding
 * steps. The frontend renders onboarding dynamically from GET /verticals.
 *
 * Which verticals are LIVE is controlled by ENABLED_VERTICALS (env). Others are
 * returned with comingSoon:true so the UI can offer the waitlist.
 *
 * archetype: FOOD | SERVICE | PRODUCT
 * moduleConfig: capability flags that drive dashboard tabs + consumer CTA.
 */

export const VERTICALS = {
  FOOD_BEVERAGE: {
    key: 'FOOD_BEVERAGE',
    label: 'Food & Beverage',
    icon: 'utensils',
    archetype: 'FOOD',
    templateFamily: 'food',
    moduleConfig: { commerce: true, scheduling: false, leadGen: false, estimation: false },
    bookingModes: ['ORDER'],
    // Top-level category slugs that represent this vertical in the Category table.
    categorySlugs: ['food-dining', 'restaurant-cafe', 'food-beverage'],
    subcategories: [
      { slug: 'restaurant', label: 'Restaurant', icon: 'utensils' },
      { slug: 'cloud-kitchen', label: 'Cloud Kitchen', icon: 'chef-hat' },
      { slug: 'street-food', label: 'Street Food', icon: 'sandwich' },
      { slug: 'bakery', label: 'Bakery', icon: 'cake' },
      { slug: 'mithai', label: 'Mithai & Sweets', icon: 'candy' },
    ],
    taxonomyFields: [
      { id: 'cuisines', label: 'Cuisine Types', type: 'multi_select', options: ['North Indian', 'South Indian', 'Chinese', 'Italian', 'Continental', 'Fast Food', 'Beverages', 'Desserts'] },
      { id: 'dietary', label: 'Dietary', type: 'multi_select', options: ['Pure Veg', 'Non Veg', 'Vegan', 'Jain Options'] },
      { id: 'facilities', label: 'Facilities', type: 'multi_select', options: ['Dine-In', 'Takeaway', 'AC Seating', 'Outdoor Seating'] },
    ],
    onboardingSteps: ['category', 'subcategory', 'details', 'menu', 'storefront'],
  },

  SALON_BEAUTY: {
    key: 'SALON_BEAUTY',
    label: 'Salon & Beauty',
    icon: 'scissors',
    archetype: 'SERVICE',
    templateFamily: 'vcard',
    moduleConfig: { commerce: false, scheduling: true, leadGen: false, estimation: false },
    bookingModes: ['DIRECT_BOOK', 'REQUEST_TO_BOOK'],
    categorySlugs: ['salon-beauty', 'salon-spa', 'salon-booking'],
    subcategories: [
      { slug: 'haircut', label: 'Hair & Styling', icon: 'scissors' },
      { slug: 'massage', label: 'Spa & Massage', icon: 'flower' },
      { slug: 'bridal-makeup', label: 'Bridal Makeup', icon: 'sparkles' },
    ],
    taxonomyFields: [
      { id: 'gender', label: 'Caters To', type: 'single_select', options: ['Unisex', 'Female Only', 'Male Only'] },
      { id: 'expertise', label: 'Services Offered', type: 'multi_select', options: ['Haircut & Styling', 'Coloring', 'Facial & Skin', 'Manicure/Pedicure', 'Bridal Makeup', 'Massage'] },
    ],
    onboardingSteps: ['category', 'subcategory', 'details', 'services', 'storefront'],
  },

  HOME_ESSENTIALS: {
    key: 'HOME_ESSENTIALS',
    label: 'Home & Repair Services',
    icon: 'wrench',
    archetype: 'SERVICE',
    templateFamily: 'vcard',
    moduleConfig: { commerce: false, scheduling: false, leadGen: true, estimation: true },
    bookingModes: ['REQUEST_TO_BOOK', 'DIRECT_BOOK'],
    categorySlugs: ['home-services', 'repairs-services'],
    subcategories: [
      { slug: 'ac-repair', label: 'AC Repair', icon: 'wind' },
      { slug: 'ro-repair', label: 'RO / Water Purifier', icon: 'droplet' },
      { slug: 'electrician', label: 'Electrician', icon: 'zap' },
      { slug: 'plumber', label: 'Plumber', icon: 'wrench' },
      { slug: 'cleaning', label: 'Home Cleaning', icon: 'spray-can' },
    ],
    taxonomyFields: [
      { id: 'services', label: 'Services Offered', type: 'multi_select', options: ['AC Repair', 'RO Water Purifier', 'Washing Machine', 'Refrigerator', 'Electrician', 'Plumber', 'Carpenter', 'Deep Cleaning', 'Pest Control'] },
    ],
    onboardingSteps: ['category', 'subcategory', 'details', 'services', 'storefront'],
  },

  GROCERY: {
    key: 'GROCERY',
    label: 'Grocery & Daily Needs',
    icon: 'shopping-basket',
    archetype: 'PRODUCT',
    templateFamily: 'retail',
    moduleConfig: { commerce: true, scheduling: false, leadGen: false, estimation: false },
    bookingModes: ['CART'],
    categorySlugs: ['retail-grocery'],
    subcategories: [
      { slug: 'kirana', label: 'Kirana Store', icon: 'store' },
      { slug: 'supermarket', label: 'Supermarket', icon: 'shopping-cart' },
    ],
    taxonomyFields: [
      { id: 'product_types', label: 'Product Categories', type: 'multi_select', options: ['Fresh Produce', 'Dairy & Bakery', 'Snacks & Beverages', 'Personal Care', 'Home Essentials'] },
      { id: 'delivery', label: 'Delivery Options', type: 'multi_select', options: ['Click & Collect', 'Home Delivery'] },
    ],
    onboardingSteps: ['category', 'subcategory', 'details', 'catalog', 'storefront'],
  },

  ECOMMERCE: {
    key: 'ECOMMERCE',
    label: 'Shops & Products',
    icon: 'shopping-bag',
    archetype: 'PRODUCT',
    templateFamily: 'retail',
    moduleConfig: { commerce: true, scheduling: false, leadGen: false, estimation: false },
    bookingModes: ['CART'],
    categorySlugs: ['retail-shop', 'fashion', 'electronics'],
    subcategories: [
      { slug: 'fashion', label: 'Fashion & Apparel', icon: 'shirt' },
      { slug: 'electronics', label: 'Electronics', icon: 'smartphone' },
      { slug: 'general-store', label: 'General Store', icon: 'store' },
    ],
    taxonomyFields: [],
    onboardingSteps: ['category', 'subcategory', 'details', 'catalog', 'storefront'],
  },

  DOCTOR: {
    key: 'DOCTOR',
    label: 'Doctors & Clinics',
    icon: 'stethoscope',
    archetype: 'SERVICE',
    templateFamily: 'vcard',
    moduleConfig: { commerce: false, scheduling: true, leadGen: false, estimation: false },
    bookingModes: ['DIRECT_BOOK', 'REQUEST_TO_BOOK'],
    categorySlugs: ['doctors'],
    subcategories: [
      { slug: 'general-physician', label: 'General Physician', icon: 'stethoscope' },
      { slug: 'dentist', label: 'Dentist', icon: 'tooth' },
    ],
    taxonomyFields: [
      { id: 'speciality', label: 'Speciality', type: 'multi_select', options: ['Dentist', 'Pediatrician', 'Gynecologist', 'Orthopedic', 'General Physician', 'Dermatologist', 'Cardiologist'] },
      { id: 'consultation', label: 'Consultation Mode', type: 'multi_select', options: ['In-Clinic', 'Video Consult'] },
    ],
    onboardingSteps: ['category', 'subcategory', 'details', 'services', 'storefront'],
  },

  REAL_ESTATE: {
    key: 'REAL_ESTATE',
    label: 'Real Estate',
    icon: 'building',
    archetype: 'SERVICE',
    templateFamily: 'vcard',
    moduleConfig: { commerce: false, scheduling: false, leadGen: true, estimation: false },
    bookingModes: ['REQUEST_TO_BOOK'],
    categorySlugs: ['real-estate'],
    subcategories: [
      { slug: 'agent', label: 'Property Agent', icon: 'user' },
      { slug: 'pg-hostel', label: 'PG / Hostel', icon: 'bed' },
    ],
    taxonomyFields: [
      { id: 'property_type', label: 'Property Types', type: 'multi_select', options: ['Residential', 'Commercial', 'Plots/Land', 'PG/Co-living'] },
      { id: 'transaction_type', label: 'Deals In', type: 'multi_select', options: ['Rentals', 'Buy/Sell'] },
    ],
    onboardingSteps: ['category', 'subcategory', 'details', 'services', 'storefront'],
  },
};

/**
 * Returns all verticals with a `comingSoon` flag derived from the enabled list.
 * Live verticals carry the full config; coming-soon ones expose only the
 * shell (key/label/icon/archetype) the UI needs for the tile + waitlist.
 */
export const listVerticals = (enabledKeys) => {
  const enabled = new Set(enabledKeys.map((k) => k.toUpperCase()));
  return Object.values(VERTICALS).map((v) => {
    const comingSoon = !enabled.has(v.key);
    if (comingSoon) {
      return { key: v.key, label: v.label, icon: v.icon, archetype: v.archetype, comingSoon: true };
    }
    return { ...v, comingSoon: false };
  });
};

export const getVertical = (key) => VERTICALS[(key || '').toUpperCase()] || null;

export const getModuleConfig = (key) => {
  const v = getVertical(key);
  return v ? v.moduleConfig : { commerce: false, scheduling: false, leadGen: true, estimation: false };
};

/**
 * All Category slugs (top-level + sub-categories) belonging to the enabled
 * verticals. Used to gate the public /categories list.
 */
export const enabledCategorySlugs = (enabledKeys) => {
  const enabled = new Set(enabledKeys.map((k) => k.toUpperCase()));
  const slugs = [];
  for (const v of Object.values(VERTICALS)) {
    if (!enabled.has(v.key)) continue;
    slugs.push(...(v.categorySlugs || []));
    slugs.push(...(v.subcategories || []).map((s) => s.slug));
  }
  return slugs;
};

/** Find which vertical owns a given sub-category slug. */
export const verticalForSubcategory = (subSlug) => {
  for (const v of Object.values(VERTICALS)) {
    if ((v.subcategories || []).some((s) => s.slug === subSlug)) return v;
  }
  return null;
};
