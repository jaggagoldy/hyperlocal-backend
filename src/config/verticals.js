/**
 * Vertical blueprint registry — the single source of truth for the business
 * verticals the platform supports, their sub-categories, capability blueprint,
 * taxonomy fields, booking modes, storefront template family, listing tier, and
 * onboarding steps. The frontend renders onboarding dynamically from GET /verticals.
 *
 * Which verticals are LIVE is controlled by ENABLED_VERTICALS (env). Others are
 * returned with comingSoon:true so the UI can offer the waitlist.
 *
 * archetype:    FOOD | SERVICE | PRODUCT
 * moduleConfig: capability flags that drive dashboard tabs (the capability source
 *               of truth — stored per-business in BusinessProfile.moduleConfig).
 * defaultTier:  the listing TIER auto-assigned at onboarding (the public label that
 *               drives consumer-card CTAs + the upgrade upsell). DIRECTORY (T1) |
 *               BOOKABLE (T2) | COMMERCE (T3). A sub-category may override the
 *               vertical default via its own `tier`. Tier is the public label;
 *               moduleConfig stays the capability source. See TIERS below.
 * upgradeableTo: tiers a vendor can graduate this listing into ("Activate your
 *               storefront / your own app" upsell).
 */

/**
 * The 3 listing tiers (Phase F). Each maps a tier to its canonical capability
 * blueprint, default storefront family, and consumer-card CTAs, so cards and
 * dashboards render off `listingTier` without re-deriving from moduleConfig.
 */
export const TIERS = {
  DIRECTORY: {
    key: 'DIRECTORY',
    code: 'T1',
    label: 'Directory',
    tagline: 'Profile with Call / WhatsApp / Directions',
    moduleConfig: { commerce: false, scheduling: false, leadGen: true, estimation: false },
    templateFamily: 'vcard',
    hasStorefront: false,
    consumerCtas: ['call', 'whatsapp', 'directions'],
  },
  BOOKABLE: {
    key: 'BOOKABLE',
    code: 'T2',
    label: 'Bookable',
    tagline: 'Storefront + appointment booking',
    moduleConfig: { commerce: false, scheduling: true, leadGen: true, estimation: false },
    templateFamily: 'vcard',
    hasStorefront: true,
    consumerCtas: ['book', 'call'],
  },
  COMMERCE: {
    key: 'COMMERCE',
    code: 'T3',
    label: 'Commerce',
    tagline: 'Storefront + catalog + ordering (your own app)',
    moduleConfig: { commerce: true, scheduling: false, leadGen: false, estimation: false },
    templateFamily: null, // vertical-specific: 'food' | 'retail'
    hasStorefront: true,
    consumerCtas: ['order', 'cart'],
  },
};

export const getTier = (tierKey) => TIERS[(tierKey || '').toUpperCase()] || null;

export const VERTICALS = {
  FOOD_BEVERAGE: {
    key: 'FOOD_BEVERAGE',
    label: 'Food & Beverage',
    icon: 'utensils',
    description: 'Restaurants, cafes, cloud kitchens and sweet shops near you — order online or book a table.',
    seo: { color: null, keywords: ['restaurants near me', 'food delivery', 'cafe', 'cloud kitchen'], metaTitle: null, metaDescription: null },
    archetype: 'FOOD',
    templateFamily: 'food',
    defaultTier: 'COMMERCE',
    upgradeableTo: [],
    moduleConfig: { commerce: true, scheduling: false, leadGen: false, estimation: false },
    bookingModes: ['ORDER'],
    // Top-level category slugs that represent this vertical in the Category table.
    categorySlugs: ['food-dining', 'restaurant-cafe', 'food-beverage'],
    subcategories: [
      { slug: 'restaurant', label: 'Restaurant', icon: 'utensils' },
      { slug: 'cafe', label: 'Cafe', icon: 'coffee' },
      { slug: 'cloud-kitchen', label: 'Cloud Kitchen', icon: 'chef-hat' },
      { slug: 'street-food', label: 'Street Food', icon: 'sandwich' },
      { slug: 'bakery', label: 'Bakery & Cake', icon: 'cake' },
      { slug: 'mithai', label: 'Mithai & Sweets', icon: 'candy' },
      { slug: 'tiffin', label: 'Tiffin / Mess', icon: 'utensils-crossed' },
    ],
    taxonomyFields: [
      { id: 'cuisines', label: 'Cuisine Types', type: 'multi_select', options: ['North Indian', 'South Indian', 'Chinese', 'Italian', 'Continental', 'Fast Food', 'Beverages', 'Desserts'] },
      { id: 'dietary', label: 'Dietary', type: 'multi_select', options: ['Pure Veg', 'Non Veg', 'Vegan', 'Jain Options'] },
      { id: 'facilities', label: 'Facilities', type: 'multi_select', options: ['Dine-In', 'Takeaway', 'AC Seating', 'Outdoor Seating'] },
    ],
    onboardingSteps: ['category', 'subcategory', 'details', 'menu', 'storefront'],
  },

  GROCERY: {
    key: 'GROCERY',
    label: 'Grocery & Daily Needs',
    icon: 'shopping-basket',
    description: 'Kirana stores, supermarkets and dairies for your daily household needs.',
    seo: { color: null, keywords: ['grocery near me', 'kirana store', 'supermarket', 'daily needs'], metaTitle: null, metaDescription: null },
    archetype: 'PRODUCT',
    templateFamily: 'retail',
    defaultTier: 'COMMERCE',
    upgradeableTo: [],
    moduleConfig: { commerce: true, scheduling: false, leadGen: false, estimation: false },
    bookingModes: ['CART'],
    categorySlugs: ['retail-grocery'],
    subcategories: [
      { slug: 'kirana', label: 'Kirana Store', icon: 'store' },
      { slug: 'supermarket', label: 'Supermarket', icon: 'shopping-cart' },
      { slug: 'dairy', label: 'Dairy', icon: 'milk' },
    ],
    taxonomyFields: [
      { id: 'product_types', label: 'Product Categories', type: 'multi_select', options: ['Fresh Produce', 'Dairy & Bakery', 'Snacks & Beverages', 'Personal Care', 'Home Essentials'] },
      { id: 'delivery', label: 'Delivery Options', type: 'multi_select', options: ['Click & Collect', 'Home Delivery'] },
    ],
    onboardingSteps: ['category', 'subcategory', 'details', 'catalog', 'storefront'],
  },

  RETAIL: {
    key: 'RETAIL',
    label: 'Shops & Retail',
    icon: 'shopping-bag',
    description: 'Local shops for apparel, electronics, jewellery and more — visit or shop their storefront.',
    seo: { color: null, keywords: ['shops near me', 'retail store', 'apparel', 'electronics'], metaTitle: null, metaDescription: null },
    archetype: 'PRODUCT',
    templateFamily: 'retail',
    // Default DIRECTORY: most shops list first as a profile, then activate a
    // storefront (T3) when ready to sell online — our core upgrade upsell.
    defaultTier: 'DIRECTORY',
    upgradeableTo: ['COMMERCE'],
    moduleConfig: { commerce: false, scheduling: false, leadGen: true, estimation: false },
    bookingModes: ['REQUEST_TO_BOOK'],
    categorySlugs: ['retail-shop', 'fashion', 'electronics'],
    subcategories: [
      { slug: 'optical', label: 'Optical', icon: 'glasses' },
      { slug: 'gift-shop', label: 'Gift Shop', icon: 'gift' },
      { slug: 'mobile-electronics', label: 'Mobile / Electronics', icon: 'smartphone' },
      { slug: 'apparel', label: 'Apparel', icon: 'shirt' },
      { slug: 'footwear', label: 'Footwear', icon: 'footprints' },
      { slug: 'jewellery', label: 'Jewellery', icon: 'gem' },
      { slug: 'hardware', label: 'Hardware', icon: 'hammer' },
      { slug: 'stationery', label: 'Stationery', icon: 'pen-tool' },
    ],
    taxonomyFields: [
      { id: 'product_types', label: 'Product Categories', type: 'multi_select', options: ['Apparel', 'Footwear', 'Electronics', 'Jewellery', 'Optical', 'Gifts', 'Hardware', 'Stationery'] },
    ],
    onboardingSteps: ['category', 'subcategory', 'details'],
  },

  SALON_BEAUTY: {
    key: 'SALON_BEAUTY',
    label: 'Salon & Beauty',
    icon: 'scissors',
    description: 'Salons, spas and bridal studios — book your appointment instantly.',
    seo: { color: null, keywords: ['salon near me', 'spa', 'bridal makeup', 'haircut'], metaTitle: null, metaDescription: null },
    archetype: 'SERVICE',
    templateFamily: 'vcard',
    defaultTier: 'BOOKABLE',
    upgradeableTo: [],
    moduleConfig: { commerce: false, scheduling: true, leadGen: false, estimation: false },
    bookingModes: ['DIRECT_BOOK', 'REQUEST_TO_BOOK'],
    categorySlugs: ['salon-beauty', 'salon-spa', 'salon-booking'],
    subcategories: [
      { slug: 'haircut', label: 'Hair & Styling', icon: 'scissors' },
      { slug: 'massage', label: 'Spa & Massage', icon: 'flower' },
      { slug: 'bridal-makeup', label: 'Bridal Makeup', icon: 'sparkles' },
      { slug: 'nails', label: 'Nails', icon: 'hand' },
    ],
    taxonomyFields: [
      { id: 'gender', label: 'Caters To', type: 'single_select', options: ['Unisex', 'Female Only', 'Male Only'] },
      { id: 'expertise', label: 'Services Offered', type: 'multi_select', options: ['Haircut & Styling', 'Coloring', 'Facial & Skin', 'Manicure/Pedicure', 'Bridal Makeup', 'Massage'] },
    ],
    onboardingSteps: ['category', 'subcategory', 'details', 'services', 'storefront'],
  },

  HEALTH_MEDICAL: {
    key: 'HEALTH_MEDICAL',
    label: 'Health & Medical',
    icon: 'stethoscope',
    description: 'Pharmacies, clinics, diagnostic labs and hospitals for all your healthcare needs.',
    seo: { color: null, keywords: ['doctor near me', 'pharmacy', 'clinic', 'diagnostic lab'], metaTitle: null, metaDescription: null },
    archetype: 'SERVICE',
    templateFamily: 'vcard',
    // Vertical default is DIRECTORY (pharmacy, lab, hospital are listings); doctor/
    // clinic/dental sub-categories override to BOOKABLE (appointments).
    defaultTier: 'DIRECTORY',
    upgradeableTo: ['BOOKABLE'],
    moduleConfig: { commerce: false, scheduling: false, leadGen: true, estimation: false },
    bookingModes: ['REQUEST_TO_BOOK', 'DIRECT_BOOK'],
    categorySlugs: ['doctors', 'health-medical', 'pharmacy', 'clinic'],
    subcategories: [
      { slug: 'pharmacy', label: 'Pharmacy', icon: 'pill' },
      { slug: 'general-physician', label: 'Doctor / Clinic', icon: 'stethoscope', tier: 'BOOKABLE' },
      { slug: 'dentist', label: 'Dental', icon: 'tooth', tier: 'BOOKABLE' },
      { slug: 'diagnostic-lab', label: 'Diagnostic Lab', icon: 'microscope' },
      { slug: 'hospital', label: 'Hospital', icon: 'cross' },
      { slug: 'vet', label: 'Veterinary', icon: 'paw-print' },
    ],
    taxonomyFields: [
      { id: 'speciality', label: 'Speciality', type: 'multi_select', options: ['Dentist', 'Pediatrician', 'Gynecologist', 'Orthopedic', 'General Physician', 'Dermatologist', 'Cardiologist'] },
      { id: 'consultation', label: 'Consultation Mode', type: 'multi_select', options: ['In-Clinic', 'Video Consult'] },
    ],
    onboardingSteps: ['category', 'subcategory', 'details', 'services'],
  },

  HOME_ESSENTIALS: {
    key: 'HOME_ESSENTIALS',
    label: 'Home & Repair Services',
    icon: 'wrench',
    description: 'Electricians, plumbers, carpenters and repair professionals for your home.',
    seo: { color: null, keywords: ['home repair near me', 'electrician', 'plumber', 'ac repair'], metaTitle: null, metaDescription: null },
    archetype: 'SERVICE',
    templateFamily: 'vcard',
    defaultTier: 'DIRECTORY',
    upgradeableTo: ['BOOKABLE'],
    moduleConfig: { commerce: false, scheduling: false, leadGen: true, estimation: true },
    bookingModes: ['REQUEST_TO_BOOK', 'DIRECT_BOOK'],
    categorySlugs: ['home-services', 'repairs-services'],
    subcategories: [
      { slug: 'ac-repair', label: 'AC Repair', icon: 'wind' },
      { slug: 'ro-repair', label: 'RO / Water Purifier', icon: 'droplet' },
      { slug: 'electrician', label: 'Electrician', icon: 'zap' },
      { slug: 'plumber', label: 'Plumber', icon: 'wrench' },
      { slug: 'carpenter', label: 'Carpenter', icon: 'hammer' },
      { slug: 'cleaning', label: 'Home Cleaning', icon: 'spray-can' },
      { slug: 'pest-control', label: 'Pest Control', icon: 'bug' },
    ],
    taxonomyFields: [
      { id: 'services', label: 'Services Offered', type: 'multi_select', options: ['AC Repair', 'RO Water Purifier', 'Washing Machine', 'Refrigerator', 'Electrician', 'Plumber', 'Carpenter', 'Deep Cleaning', 'Pest Control'] },
    ],
    onboardingSteps: ['category', 'subcategory', 'details', 'services'],
  },

  PROFESSIONAL_SERVICES: {
    key: 'PROFESSIONAL_SERVICES',
    label: 'Professional Services',
    icon: 'briefcase',
    description: 'CAs, lawyers, consultants and other professional service providers.',
    seo: { color: null, keywords: ['ca near me', 'lawyer', 'consultant', 'professional services'], metaTitle: null, metaDescription: null },
    archetype: 'SERVICE',
    templateFamily: 'vcard',
    defaultTier: 'DIRECTORY',
    upgradeableTo: [],
    moduleConfig: { commerce: false, scheduling: false, leadGen: true, estimation: false },
    bookingModes: ['REQUEST_TO_BOOK'],
    categorySlugs: ['professional-services'],
    subcategories: [
      { slug: 'ca-accountant', label: 'CA / Accountant', icon: 'calculator' },
      { slug: 'lawyer', label: 'Lawyer', icon: 'scale' },
      { slug: 'insurance-advisor', label: 'Insurance', icon: 'shield' },
      { slug: 'consultant', label: 'Consultant', icon: 'briefcase' },
      { slug: 'architect', label: 'Architect', icon: 'ruler' },
      { slug: 'it-services', label: 'IT Services', icon: 'monitor' },
    ],
    taxonomyFields: [],
    onboardingSteps: ['category', 'subcategory', 'details'],
  },

  EDUCATION: {
    key: 'EDUCATION',
    label: 'Education & Coaching',
    icon: 'graduation-cap',
    description: 'Schools, coaching institutes and tuition centres for every stage of learning.',
    seo: { color: null, keywords: ['coaching near me', 'tuition', 'school', 'education'], metaTitle: null, metaDescription: null },
    archetype: 'SERVICE',
    templateFamily: 'vcard',
    defaultTier: 'DIRECTORY',
    upgradeableTo: ['BOOKABLE'],
    moduleConfig: { commerce: false, scheduling: false, leadGen: true, estimation: false },
    bookingModes: ['REQUEST_TO_BOOK'],
    categorySlugs: ['education-coaching'],
    subcategories: [
      { slug: 'school', label: 'School', icon: 'school' },
      { slug: 'coaching', label: 'Coaching Institute', icon: 'book-open' },
      { slug: 'tuition', label: 'Tuition', icon: 'pencil' },
      { slug: 'music-dance', label: 'Music / Dance', icon: 'music' },
      { slug: 'computer-classes', label: 'Computer Classes', icon: 'monitor' },
    ],
    taxonomyFields: [],
    onboardingSteps: ['category', 'subcategory', 'details'],
  },

  FITNESS: {
    key: 'FITNESS',
    label: 'Fitness & Wellness',
    icon: 'dumbbell',
    description: 'Gyms, yoga studios and physiotherapists to help you stay fit.',
    seo: { color: null, keywords: ['gym near me', 'yoga', 'physiotherapy', 'fitness'], metaTitle: null, metaDescription: null },
    archetype: 'SERVICE',
    templateFamily: 'vcard',
    defaultTier: 'BOOKABLE',
    upgradeableTo: [],
    moduleConfig: { commerce: false, scheduling: true, leadGen: true, estimation: false },
    bookingModes: ['DIRECT_BOOK', 'REQUEST_TO_BOOK'],
    categorySlugs: ['fitness-wellness'],
    subcategories: [
      { slug: 'gym', label: 'Gym', icon: 'dumbbell' },
      { slug: 'yoga', label: 'Yoga', icon: 'flower' },
      { slug: 'physio', label: 'Physiotherapy', icon: 'activity' },
      { slug: 'dietician', label: 'Dietician', icon: 'apple' },
    ],
    taxonomyFields: [],
    onboardingSteps: ['category', 'subcategory', 'details', 'services', 'storefront'],
  },

  AUTOMOTIVE: {
    key: 'AUTOMOTIVE',
    label: 'Automotive',
    icon: 'car',
    description: 'Car and bike service centres, spare parts dealers and driving schools.',
    seo: { color: null, keywords: ['car service near me', 'bike service', 'driving school', 'spare parts'], metaTitle: null, metaDescription: null },
    archetype: 'SERVICE',
    templateFamily: 'vcard',
    defaultTier: 'DIRECTORY',
    upgradeableTo: [],
    moduleConfig: { commerce: false, scheduling: false, leadGen: true, estimation: true },
    bookingModes: ['REQUEST_TO_BOOK'],
    categorySlugs: ['automotive'],
    subcategories: [
      { slug: 'car-service', label: 'Car / Bike Service', icon: 'car' },
      { slug: 'spare-parts', label: 'Spare Parts', icon: 'cog' },
      { slug: 'tyres', label: 'Tyres', icon: 'circle' },
      { slug: 'driving-school', label: 'Driving School', icon: 'steering-wheel' },
      { slug: 'car-wash', label: 'Car Wash', icon: 'droplets' },
    ],
    taxonomyFields: [],
    onboardingSteps: ['category', 'subcategory', 'details'],
  },

  REAL_ESTATE: {
    key: 'REAL_ESTATE',
    label: 'Real Estate',
    icon: 'building',
    description: 'Property agents, builders and rental listings across your district.',
    seo: { color: null, keywords: ['property agent near me', 'pg hostel', 'builder', 'rentals'], metaTitle: null, metaDescription: null },
    archetype: 'SERVICE',
    templateFamily: 'vcard',
    defaultTier: 'DIRECTORY',
    upgradeableTo: [],
    moduleConfig: { commerce: false, scheduling: false, leadGen: true, estimation: false },
    bookingModes: ['REQUEST_TO_BOOK'],
    categorySlugs: ['real-estate'],
    subcategories: [
      { slug: 'agent', label: 'Property Agent', icon: 'user' },
      { slug: 'pg-hostel', label: 'PG / Hostel', icon: 'bed' },
      { slug: 'builder', label: 'Builder', icon: 'building-2' },
      { slug: 'rentals', label: 'Rentals', icon: 'key' },
    ],
    taxonomyFields: [
      { id: 'property_type', label: 'Property Types', type: 'multi_select', options: ['Residential', 'Commercial', 'Plots/Land', 'PG/Co-living'] },
      { id: 'transaction_type', label: 'Deals In', type: 'multi_select', options: ['Rentals', 'Buy/Sell'] },
    ],
    onboardingSteps: ['category', 'subcategory', 'details'],
  },

  HOTELS: {
    key: 'HOTELS',
    label: 'Hotels & Hospitality',
    icon: 'hotel',
    description: 'Hotels, guest houses, resorts and banquet halls for your stay or event.',
    seo: { color: null, keywords: ['hotels near me', 'guest house', 'banquet hall', 'resort'], metaTitle: null, metaDescription: null },
    archetype: 'SERVICE',
    templateFamily: 'vcard',
    defaultTier: 'DIRECTORY',
    upgradeableTo: ['BOOKABLE'],
    moduleConfig: { commerce: false, scheduling: false, leadGen: true, estimation: false },
    bookingModes: ['REQUEST_TO_BOOK'],
    categorySlugs: ['hotels-hospitality'],
    subcategories: [
      { slug: 'hotel', label: 'Hotel', icon: 'hotel' },
      { slug: 'banquet', label: 'Banquet Hall', icon: 'utensils-crossed' },
      { slug: 'guest-house', label: 'Guest House', icon: 'bed' },
      { slug: 'resort', label: 'Resort', icon: 'palmtree' },
    ],
    taxonomyFields: [],
    onboardingSteps: ['category', 'subcategory', 'details'],
  },

  EVENTS: {
    key: 'EVENTS',
    label: 'Events & Wedding',
    icon: 'party-popper',
    description: 'Caterers, photographers, decorators and DJs to plan your perfect event.',
    seo: { color: null, keywords: ['caterer near me', 'photographer', 'decorator', 'wedding planner'], metaTitle: null, metaDescription: null },
    archetype: 'SERVICE',
    templateFamily: 'vcard',
    defaultTier: 'DIRECTORY',
    upgradeableTo: ['BOOKABLE'],
    moduleConfig: { commerce: false, scheduling: false, leadGen: true, estimation: true },
    bookingModes: ['REQUEST_TO_BOOK'],
    categorySlugs: ['events-wedding'],
    subcategories: [
      { slug: 'caterer', label: 'Caterer', icon: 'utensils-crossed' },
      { slug: 'photographer', label: 'Photographer', icon: 'camera' },
      { slug: 'decorator', label: 'Decorator', icon: 'flower-2' },
      { slug: 'dj', label: 'DJ', icon: 'disc' },
      { slug: 'tent-house', label: 'Tent House', icon: 'tent' },
    ],
    taxonomyFields: [],
    onboardingSteps: ['category', 'subcategory', 'details'],
  },

  PERSONAL_SERVICES: {
    key: 'PERSONAL_SERVICES',
    label: 'Personal Services',
    icon: 'shirt',
    description: 'Tailors, dry cleaners, cobblers and pet groomers for everyday errands.',
    seo: { color: null, keywords: ['tailor near me', 'dry clean', 'cobbler', 'pet grooming'], metaTitle: null, metaDescription: null },
    archetype: 'SERVICE',
    templateFamily: 'vcard',
    defaultTier: 'DIRECTORY',
    upgradeableTo: ['BOOKABLE'],
    moduleConfig: { commerce: false, scheduling: false, leadGen: true, estimation: false },
    bookingModes: ['REQUEST_TO_BOOK'],
    categorySlugs: ['personal-services'],
    subcategories: [
      { slug: 'tailor', label: 'Tailor', icon: 'scissors' },
      { slug: 'laundry', label: 'Laundry / Dry Clean', icon: 'shirt' },
      { slug: 'cobbler', label: 'Cobbler', icon: 'footprints' },
      { slug: 'pet-grooming', label: 'Pet Grooming', icon: 'paw-print' },
    ],
    taxonomyFields: [],
    onboardingSteps: ['category', 'subcategory', 'details'],
  },

  TRAVEL: {
    key: 'TRAVEL',
    label: 'Travel & Transport',
    icon: 'plane',
    description: 'Travel agents, cab services, packers and movers for every journey.',
    seo: { color: null, keywords: ['travel agent near me', 'cab service', 'packers and movers', 'courier'], metaTitle: null, metaDescription: null },
    archetype: 'SERVICE',
    templateFamily: 'vcard',
    defaultTier: 'DIRECTORY',
    upgradeableTo: [],
    moduleConfig: { commerce: false, scheduling: false, leadGen: true, estimation: false },
    bookingModes: ['REQUEST_TO_BOOK'],
    categorySlugs: ['travel-transport'],
    subcategories: [
      { slug: 'travel-agent', label: 'Travel Agent', icon: 'plane' },
      { slug: 'cab-taxi', label: 'Cab / Taxi', icon: 'car' },
      { slug: 'movers', label: 'Packers & Movers', icon: 'truck' },
      { slug: 'courier', label: 'Courier', icon: 'package' },
    ],
    taxonomyFields: [],
    onboardingSteps: ['category', 'subcategory', 'details'],
  },

  FINANCIAL_SERVICES: {
    key: 'FINANCIAL_SERVICES',
    label: 'Financial Services',
    icon: 'banknote',
    description: 'Loan agents, insurance advisors and financial planners near you.',
    seo: { color: null, keywords: ['loan agent near me', 'insurance advisor', 'mutual fund', 'financial services'], metaTitle: null, metaDescription: null },
    archetype: 'SERVICE',
    templateFamily: 'vcard',
    defaultTier: 'DIRECTORY',
    upgradeableTo: [],
    moduleConfig: { commerce: false, scheduling: false, leadGen: true, estimation: false },
    bookingModes: ['REQUEST_TO_BOOK'],
    categorySlugs: ['financial-services'],
    subcategories: [
      { slug: 'loan-agent', label: 'Loan Agent', icon: 'landmark' },
      { slug: 'insurance', label: 'Insurance', icon: 'shield' },
      { slug: 'mutual-fund', label: 'Mutual Fund', icon: 'trending-up' },
      { slug: 'atm', label: 'ATM', icon: 'credit-card' },
    ],
    taxonomyFields: [],
    onboardingSteps: ['category', 'subcategory', 'details'],
  },
};

/**
 * Returns all verticals with a `comingSoon` flag derived from the enabled list.
 * Live verticals carry the full config; coming-soon ones expose only the shell
 * (key/label/icon/archetype + tier hints) the UI needs for the tile + waitlist.
 */
export const listVerticals = (enabledKeys) => {
  const enabled = new Set(enabledKeys.map((k) => k.toUpperCase()));
  return Object.values(VERTICALS).map((v) => {
    const comingSoon = !enabled.has(v.key);
    if (comingSoon) {
      return {
        key: v.key,
        label: v.label,
        icon: v.icon,
        archetype: v.archetype,
        defaultTier: v.defaultTier,
        upgradeableTo: v.upgradeableTo || [],
        comingSoon: true,
      };
    }
    return { ...v, comingSoon: false };
  });
};

export const getVertical = (key) => VERTICALS[(key || '').toUpperCase()] || null;

export const getModuleConfig = (key) => {
  const v = getVertical(key);
  return v ? v.moduleConfig : { commerce: false, scheduling: false, leadGen: true, estimation: false };
};

/** The vertical's default listing tier, or DIRECTORY as a safe fallback. */
export const getDefaultTier = (key) => {
  const v = getVertical(key);
  return (v && v.defaultTier) || 'DIRECTORY';
};

/**
 * Resolve the listing tier for a (vertical, sub-category) pair: a sub-category's
 * own `tier` wins (e.g. a doctor within Health & Medical → BOOKABLE), else the
 * vertical's defaultTier. Returns a tier key (DIRECTORY | BOOKABLE | COMMERCE).
 */
export const resolveListingTier = (key, subSlug) => {
  const v = getVertical(key);
  if (!v) return 'DIRECTORY';
  if (subSlug) {
    const sub = (v.subcategories || []).find((s) => s.slug === subSlug);
    if (sub && sub.tier) return sub.tier;
  }
  return v.defaultTier || 'DIRECTORY';
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
