/* ==========================================================================
   NearByBazar - Core Frontend Application Engine
   ========================================================================== */

// Global Application State
const state = {
  user: null, // Logged in user profile { id, email, phoneNumber, name, role, vendor: { id, ... } }
  token: localStorage.getItem('token') || null,
  cities: [],
  categories: [],
  searchResults: [],
  activeSearch: {
    citySlug: '',
    categorySlug: '',
    query: '',
    lat: null,
    lng: null,
    radius: 5
  },
  indianRegions: [],
};

// API Base URL (relative to serve locally)
const API_BASE = '/api/v1';

// DOM Elements
const views = {
  home: document.getElementById('view-home'),
  searchResults: document.getElementById('view-search-results'),
  vendorDashboard: document.getElementById('view-vendor-dashboard'),
  adminDashboard: document.getElementById('view-admin-dashboard'),
  userProfile: document.getElementById('view-user-profile'),
};

// ==========================================================================
// Initialization & Startup
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  initTheme();
  registerServiceWorker();
  
  // Load initial cities and categories for dropdowns
  await loadMetadata();
  
  // Authenticate user if token exists
  if (state.token) {
    await fetchUserProfile();
  }
  
  renderApp();
});

// Register PWA Service Worker
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    });
  }
}

// Load cities, categories, and region data
async function loadMetadata() {
  try {
    const [citiesRes, categoriesRes, regionsRes] = await Promise.all([
      fetchAPI('/search/cities'),
      fetchAPI('/search/categories'),
      fetch('/data/indian_regions.json').then(res => res.json()).catch(() => ({ states: [] }))
    ]);
    
    state.cities = citiesRes.data || [];
    state.categories = categoriesRes.data || [];
    state.indianRegions = regionsRes.states || [];
    
    populateDropdowns();
    renderCategoriesGrid();
  } catch (error) {
    showNotification('Failed to load system metadata', 'error');
  }
}

// Populate search fields and dropdowns
function populateDropdowns() {
  const stateSelect = document.getElementById('search-state');
  const citySelect = document.getElementById('search-city');
  const regStateSelect = document.getElementById('reg-state');
  const regCitySelect = document.getElementById('reg-city');
  const catSelect = document.getElementById('search-category');
  
  // Populate States
  if (state.indianRegions.length > 0) {
    const stateOptions = '<option value="">-- Choose State --</option>' + 
      state.indianRegions.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
    
    if (stateSelect) stateSelect.innerHTML = stateOptions;
    if (regStateSelect) regStateSelect.innerHTML = stateOptions;
  }
  
  // Setup cascading cities for Search
  if (stateSelect && citySelect) {
    stateSelect.addEventListener('change', (e) => {
      const selectedState = state.indianRegions.find(s => s.name === e.target.value);
      if (selectedState) {
        citySelect.innerHTML = '<option value="">-- Choose City --</option>' + 
          selectedState.cities.map(c => `<option value="${c.toLowerCase().replace(/ /g, '-')}">${c}</option>`).join('');
      } else {
        citySelect.innerHTML = '<option value="">-- Choose City --</option>';
      }
    });
  }

  // Setup cascading cities for Registration
  if (regStateSelect && regCitySelect) {
    regStateSelect.addEventListener('change', (e) => {
      const selectedState = state.indianRegions.find(s => s.name === e.target.value);
      if (selectedState) {
        regCitySelect.innerHTML = '<option value="">-- Choose City --</option>' + 
          selectedState.cities.map(c => `<option value="${c}">${c}</option>`).join('');
      } else {
        regCitySelect.innerHTML = '<option value="">-- Choose City --</option>';
      }
    });
  }

  if (catSelect) {
    catSelect.innerHTML = '<option value="">-- Choose Service --</option>' + 
      state.categories.map(c => `<option value="${c.slug}">${c.name}</option>`).join('');
  }
  
  // Populate category checkboxes in vendor signup
  const regCatList = document.getElementById('reg-categories-list');
  if (regCatList) {
    regCatList.innerHTML = state.categories.map(c => `
      <label class="checkbox-option">
        <input type="checkbox" name="reg-category" value="${c.id}">
        <span class="custom-checkbox"></span>
        <span>${c.name}</span>
      </label>
    `).join('');
  }
}

// Render service icons grid on homepage
// Verticals not yet live — shown as "Coming Soon" tiles that open the waitlist.
const COMING_SOON_VERTICALS = [
  { key: 'GROCERY', name: 'Grocery & Daily Needs', icon: 'fa-basket-shopping' },
  { key: 'ECOMMERCE', name: 'Shops & Products', icon: 'fa-bag-shopping' },
  { key: 'SALON_BEAUTY', name: 'Salon & Beauty', icon: 'fa-scissors' },
  { key: 'REAL_ESTATE', name: 'Real Estate', icon: 'fa-building' },
  { key: 'DOCTOR', name: 'Doctors & Clinics', icon: 'fa-user-doctor' },
  { key: 'CLEANING', name: 'Home Cleaning', icon: 'fa-broom' },
  { key: 'TECHNICAL', name: 'Technical Services', icon: 'fa-screwdriver-wrench' },
];

function renderCategoriesGrid() {
  const grid = document.getElementById('homepage-categories-grid');
  if (!grid) return;

  // Map slugs to FontAwesome icons (live food categories).
  const iconMap = {
    'food-beverage': 'fa-utensils',
    'food-dining': 'fa-utensils',
    'restaurant-cafe': 'fa-mug-saucer',
    restaurant: 'fa-utensils',
    'cloud-kitchen': 'fa-kitchen-set',
    'street-food': 'fa-burger',
    bakery: 'fa-cake-candles',
    mithai: 'fa-cookie-bite',
  };

  const liveCards = state.categories.map(c => {
    const icon = iconMap[c.slug] || 'fa-utensils';
    return `
      <div class="category-card" data-action="category-search" data-slug="${c.slug}">
        <div class="icon-box"><i class="fa-solid ${icon}"></i></div>
        <h3>${c.name}</h3>
      </div>
    `;
  }).join('');

  const soonCards = COMING_SOON_VERTICALS.map(v => `
    <div class="category-card" data-action="waitlist" data-vertical="${v.key}" data-name="${v.name}"
         style="position:relative;opacity:0.65;cursor:pointer;">
      <span style="position:absolute;top:8px;right:8px;font-size:10px;font-weight:600;background:var(--accent,#6366f1);color:#fff;padding:2px 8px;border-radius:999px;">Coming Soon</span>
      <div class="icon-box"><i class="fa-solid ${v.icon}"></i></div>
      <h3>${v.name}</h3>
    </div>
  `).join('');

  grid.innerHTML = liveCards + soonCards;
}

// Fetch logged in user profile
async function fetchUserProfile() {
  try {
    const res = await fetchAPI('/auth/me');
    if (res.status === 'success' && res.data.user) {
      state.user = res.data.user;
      showNotification(`Welcome back, ${state.user.name || 'User'}!`, 'success');
    } else {
      logout();
    }
  } catch (error) {
    logout();
  }
}

// ==========================================================================
// Routing & Rendering View States
// ==========================================================================
function switchView(viewName) {
  Object.keys(views).forEach(key => {
    if (key === viewName) {
      views[key].classList.add('active-view');
    } else {
      views[key].classList.remove('active-view');
    }
  });

  // Update navigation menu highlighting
  document.querySelectorAll('.nav-link').forEach(link => {
    if (link.getAttribute('data-view') === viewName) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
  
  // Trigger specific dashboard loadings
  if (viewName === 'vendor-dashboard') {
    loadVendorDashboard();
  } else if (viewName === 'admin-dashboard') {
    loadAdminDashboard();
  }
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderApp() {
  const authBtns = document.getElementById('auth-buttons');
  const userProfile = document.getElementById('user-profile');
  const userDisplayName = document.getElementById('user-display-name');
  const navVendor = document.getElementById('nav-vendor-dash');
  const navAdmin = document.getElementById('nav-admin-dash');
  
  if (state.user) {
    authBtns.classList.add('hide');
    userProfile.classList.remove('hide');
    userDisplayName.textContent = state.user.name || 'User';
    
    // Vendor option
    if (state.user.role === 'vendor') {
      navVendor.classList.remove('hide');
    } else {
      navVendor.classList.remove('hide'); // Let customers see the portal so they can onboard
    }
    
    // Admin option
    if (state.user.role === 'admin') {
      navAdmin.classList.remove('hide');
    } else {
      navAdmin.classList.add('hide');
    }
  } else {
    authBtns.classList.remove('hide');
    userProfile.classList.add('hide');
    navVendor.classList.add('hide');
    navAdmin.classList.add('hide');
  }
}

// ==========================================================================
// Client API Engine
// ==========================================================================
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  
  const config = {
    ...options,
    headers,
  };
  
  const response = await fetch(url, config);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }
  
  return data;
}

// ==========================================================================
// Core Business Flows (Auth, Search, Dashboards)
// ==========================================================================

// Email Registration
async function handleEmailSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signup-name').value;
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const phoneNumber = document.getElementById('signup-phone').value;
  const role = document.querySelector('input[name="signup-role"]:checked').value;
  
  try {
    const res = await fetchAPI('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, phoneNumber, role }),
    });
    
    if (res.status === 'success') {
      saveSession(res.data.token, res.data.user);

      closeAuthModal();
      showNotification('Account created successfully!', 'success');
      
      if (role === 'vendor') {
        switchView('vendor-dashboard');
      } else {
        switchView('home');
      }
    }
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// Email Login
async function handleEmailLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  try {
    const res = await fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (res.status === 'success') {
      saveSession(res.data.token, res.data.user);
      closeAuthModal();
      showNotification('Logged in successfully!', 'success');
      
      if (res.data.user.role === 'vendor') {
        switchView('vendor-dashboard');
      } else if (res.data.user.role === 'admin') {
        switchView('admin-dashboard');
      } else {
        switchView('home');
      }
    }
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// Update Profile
async function handleUpdateProfile(e) {
  e.preventDefault();
  const name = document.getElementById('profile-name').value;
  const email = document.getElementById('profile-email').value;
  const phoneNumber = document.getElementById('profile-phone').value;
  
  try {
    const res = await fetchAPI('/users/me', {
      method: 'PUT',
      body: JSON.stringify({ name, email, phoneNumber }),
    });
    
    if (res.status === 'success') {
      state.user = res.data;
      saveSession(state.token, state.user); // refresh token in local storage not needed if we just update user
      document.getElementById('user-display-name').textContent = state.user.name;
      showNotification('Profile updated successfully!', 'success');
    }
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// Change Password
async function handleChangePassword(e) {
  e.preventDefault();
  const oldPassword = document.getElementById('profile-old-password').value;
  const newPassword = document.getElementById('profile-new-password').value;
  
  try {
    const res = await fetchAPI('/users/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    });
    
    if (res.status === 'success') {
      document.getElementById('form-change-password').reset();
      showNotification('Password changed successfully!', 'success');
    }
  } catch (error) {
    showNotification(error.message, 'error');
  }
}
// Save authentication session
function saveSession(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('token', token);
  renderApp();
}

// Log out user
function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  renderApp();
  switchView('home');
  showNotification('Logged out successfully', 'success');
}

// ==========================================================================
// Public Searching & Interactive Ads
// ==========================================================================

// Homepage category fast search trigger
function triggerCategorySearch(categorySlug) {
  // Select first city as default search context
  const defaultCity = state.cities[0]?.slug || 'greater-noida';
  executeSearch(defaultCity, categorySlug, '');
}

// Execute Public Vendor Search
async function executeSearch(citySlug, categorySlug, query = '') {
  if (!citySlug || !categorySlug) {
    showNotification('Please select both City and Service Category to search.', 'warning');
    return;
  }
  
  state.activeSearch.citySlug = citySlug;
  state.activeSearch.categorySlug = categorySlug;
  state.activeSearch.query = query;
  
  // Get radius from DOM if present
  const radiusEl = document.getElementById('search-radius');
  if (radiusEl) state.activeSearch.radius = radiusEl.value;
  
  try {
    const queryParams = new URLSearchParams({
      query: state.activeSearch.query,
      page: 1,
      limit: 10,
      radius: state.activeSearch.radius
    });
    
    if (state.activeSearch.lat && state.activeSearch.lng) {
      queryParams.append('lat', state.activeSearch.lat);
      queryParams.append('lng', state.activeSearch.lng);
    }
    
    const res = await fetchAPI(`/search/explore/${citySlug}/${categorySlug}?${queryParams.toString()}`);
    
    state.searchResults = res.data || [];
    
    // Update breadcrumbs and counts
    const cityName = state.cities.find(c => c.slug === citySlug)?.name || citySlug;
    const categoryName = state.categories.find(c => c.slug === categorySlug)?.name || categorySlug;
    
    document.getElementById('breadcrumb-city').textContent = cityName;
    document.getElementById('breadcrumb-category').textContent = categoryName;
    document.getElementById('search-title-text').textContent = `${categoryName} Professionals in ${cityName}`;
    document.getElementById('search-results-count').textContent = `${res.meta.total} matching listings found`;
    
    renderSearchResults();
    switchView('searchResults');
    
    // Increment Profile Impression analytics for all visible search results in background
    state.searchResults.forEach(vendor => {
      logLeadAnalytic(vendor.id, 'profile_view');
    });
    
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// Render listings cards on search page
function renderSearchResults() {
  const container = document.getElementById('listings-container');
  if (!container) return;
  
  if (state.searchResults.length === 0) {
    container.innerHTML = `
      <div class="dash-card text-center" style="padding: 60px;">
        <i class="fa-solid fa-face-frown" style="font-size: 50px; color: var(--text-muted); margin-bottom: 20px;"></i>
        <h2>No Service Providers Found</h2>
        <p style="color: var(--text-muted); margin-top: 10px;">We couldn't find anyone offering these services in your locality. The query has been logged for our administration team to address.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = state.searchResults.map(vendor => {
    // Generate star rating display
    const stars = '★'.repeat(Math.round(vendor.rating)) + '☆'.repeat(5 - Math.round(vendor.rating));
    
    // Tier Badge
    const tierBadge = vendor.membershipTier !== 'Free' 
      ? `<span class="badge-tier ${vendor.membershipTier}">${vendor.membershipTier} Pro</span>` 
      : '';
      
    // Photo wrapper
    const shopPhoto = vendor.media && vendor.media.length > 0 
      ? `<img src="${vendor.media[0].secureUrl}" alt="${vendor.businessName}">`
      : '<i class="fa-solid fa-screwdriver-wrench"></i>';
      
    const landmarkText = vendor.chowkLandmark ? ` &bull; Near ${vendor.chowkLandmark}` : '';

    return `
      <div class="vendor-card ${vendor.membershipTier}">
        <div class="vendor-img-wrapper" style="cursor: pointer;" data-action="open-resume" data-vendor="${vendor.id}" title="View Profile">
          ${shopPhoto}
        </div>
        <div class="vendor-info">
          <div class="vendor-info-header">
            <h3 class="vendor-title">${vendor.businessName}</h3>
            ${tierBadge}
          </div>
          <div class="vendor-meta-row">
            <span class="ad-rating">${stars} ${vendor.rating.toFixed(1)}</span>
            <span><i class="fa-solid fa-location-crosshairs"></i> ${vendor.localityName}${landmarkText}</span>
            <span><i class="fa-solid fa-map-pin"></i> ${vendor.pincode}</span>
          </div>
          <div class="vendor-badge-row">
            <span class="badge-status ${vendor.status}">${vendor.status}</span>
            <span class="badge-city">${vendor.city?.name || 'Local'}</span>
          </div>
        </div>
        <div class="vendor-action-col">
          <button class="btn btn-primary btn-block" data-action="contact-vendor" data-type="call_click" data-vendor="${vendor.id}">
            <i class="fa-solid fa-phone"></i> Call Professional
          </button>
          <button class="btn btn-secondary btn-block" data-action="contact-vendor" data-type="whatsapp_click" data-vendor="${vendor.id}">
            <i class="fa-solid fa-message text-success"></i> WhatsApp Chat
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Log Click interaction metrics
async function triggerContactAction(vendorId, type) {
  if (!state.user) {
    showNotification('Please sign in to connect with professionals.', 'warning');
    openAuthModal('login');
    return;
  }
  
  const typeText = type === 'call_click' ? 'calling link' : 'WhatsApp window';
  showNotification(`Initiating connection... opening ${typeText}`, 'success');
  
  // Call backend log event
  await logLeadAnalytic(vendorId, type);
}

// Background Analytics Log
async function logLeadAnalytic(vendorId, type) {
  try {
    await fetchAPI('/analytics/interaction', {
      method: 'POST',
      body: JSON.stringify({ vendorId, type }),
    });
  } catch (err) {
    // Fail silently in background
  }
}

// Render dynamic homepage sponsored Ads
function renderAdsCarousel(vendors) {
  const container = document.getElementById('ads-container');
  if (!container) return;
  
  // Filter Pro/Starter vendors for display in carousel ads
  const featured = vendors.filter(v => v.membershipTier === 'Pro' || v.membershipTier === 'Starter');
  
  if (featured.length === 0) {
    container.innerHTML = `
      <div class="ad-slide-placeholder">
        <i class="fa-solid fa-star text-accent" style="font-size: 24px;"></i> 
        Advertise with NearByBazar! Upgrade your profile to Pro to feature here.
      </div>
    `;
    return;
  }
  
  container.innerHTML = featured.map(vendor => {
    const stars = '★'.repeat(Math.round(vendor.rating)) + '☆'.repeat(5 - Math.round(vendor.rating));
    return `
      <div class="ad-card">
        <div class="ad-card-header">
          <span class="ad-card-badge">${vendor.membershipTier} Partner</span>
          <span class="ad-rating">${stars}</span>
        </div>
        <div class="ad-card-body">
          <h4>${vendor.businessName}</h4>
          <p>Local licensed services in ${vendor.localityName}. Verified status active.</p>
          <span class="ad-locality"><i class="fa-solid fa-circle-check text-success"></i> Available Now</span>
        </div>
        <div class="ad-card-footer">
          <button class="btn btn-primary btn-block" data-action="contact-vendor" data-type="call_click" data-vendor="${vendor.id}">
            Connect
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Fetch featured vendors to load dynamic homepage ads
async function loadFeaturedAds() {
  try {
    // Query plumber/electrician explore route to fetch mock vendors
    const res = await fetchAPI('/search/explore/greater-noida/electrician');
    const res2 = await fetchAPI('/search/explore/dadri/plumber');
    const allVendors = [...(res.data || []), ...(res2.data || [])];
    renderAdsCarousel(allVendors);
  } catch (error) {
    // Ignore ads load fail
    renderAdsCarousel([]);
  }
}

// ==========================================================================
// Vendor Dashboard Panel Logic
// ==========================================================================
async function loadVendorDashboard() {
  const regState = document.getElementById('vendor-registration-state');
  const dashState = document.getElementById('vendor-dashboard-state');
  
  if (!state.token) {
    showNotification('Please sign in to access the vendor portal.', 'warning');
    openAuthModal('signup');
    switchView('home');
    return;
  }
  
  // Re-check profile values to get vendor details
  await fetchUserProfile();
  
  if (state.user && state.user.vendor) {
    // User already has vendor profile
    regState.classList.add('hide');
    dashState.classList.remove('hide');
    await loadVendorMetrics();
  } else {
    // Needs to register vendor profile
    regState.classList.remove('hide');
    dashState.classList.add('hide');
    initVendorSetupForm();
  }
}

// Initialize Wizard Setup forms
function initVendorSetupForm() {
  // Make step 1 panel active
  document.querySelectorAll('.form-step-panel').forEach(p => p.classList.remove('active-panel'));
  document.getElementById('panel-step-1').classList.add('active-panel');
  
  document.querySelectorAll('.setup-progress .step').forEach(s => s.classList.remove('step-active'));
  document.querySelector('.setup-progress .step[data-step="1"]').classList.add('step-active');
  
  // Clear file uploads previews
  document.getElementById('media-previews').innerHTML = '';
}

// Load metrics, status, and subscription values onto dashboard
async function loadVendorMetrics() {
  try {
    const res = await fetchAPI('/vendors/my-profile');
    const vendorData = res.data.vendor;
    const analytics = res.data.analytics;
    
    // Core details
    document.getElementById('dash-business-name').textContent = vendorData.businessName;
    document.getElementById('dash-city-badge').innerHTML = `<i class="fa-solid fa-location-dot"></i> ${vendorData.city?.name || 'Local'}`;
    document.getElementById('dash-tier-badge').innerHTML = `<i class="fa-solid fa-crown"></i> ${vendorData.membershipTier} Tier`;
    document.getElementById('dash-rating-badge').innerHTML = `<i class="fa-solid fa-star"></i> ${vendorData.rating.toFixed(1)} Rating`;
    
    // Status selectors
    document.querySelectorAll('.status-btn').forEach(btn => {
      if (btn.getAttribute('data-status') === vendorData.status) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    
    // Analytics counters
    document.getElementById('analytic-views').textContent = analytics.views;
    document.getElementById('analytic-calls').textContent = analytics.callClicks;
    document.getElementById('analytic-whatsapp').textContent = analytics.whatsappClicks;
    document.getElementById('analytic-ctr').textContent = analytics.conversionRate;
    
    // Load current tier selected highlight
    document.getElementById('dash-sub-tier-text').textContent = `${vendorData.membershipTier} Tier`;
    document.querySelectorAll('.tier-card').forEach(card => {
      if (card.getAttribute('data-tier') === vendorData.membershipTier) {
        card.classList.add('active');
        const btn = card.querySelector('.btn-upgrade');
        if (btn) btn.textContent = 'Active Tier';
      } else {
        card.classList.remove('active');
        const btn = card.querySelector('.btn-upgrade');
        if (btn) {
          const tier = card.getAttribute('data-tier');
          btn.textContent = tier === 'Free' ? 'Downgrade to Free' : `Upgrade to ${tier}`;
        }
      }
    });
    
    // Load inputs for metadata modify form
    document.getElementById('dash-input-business').value = vendorData.businessName;
    document.getElementById('dash-input-locality').value = vendorData.localityName;
    document.getElementById('dash-input-pincode').value = vendorData.pincode;
    document.getElementById('dash-input-landmark').value = vendorData.chowkLandmark || '';
    
    // Media previews grid on dashboard
    renderVendorGalleryGrid(vendorData.media || []);
    
    // Generate Storefront QR Code
    renderDashboardStorefrontQR(vendorData);
    
  } catch (error) {
    showNotification('Error loading dashboard profile data', 'error');
  }
}

// Render storefront QR code in vendor dashboard
function renderDashboardStorefrontQR(vendorData) {
  if (!vendorData.slug) return;
  
  const storefrontUrl = `${window.location.origin}/s/${vendorData.slug}`;
  const qrContainer = document.getElementById('dash-qr-canvas');
  const urlText = document.getElementById('dash-qr-url-text');
  const viewLink = document.getElementById('dash-view-storefront');
  const copyBtn = document.getElementById('dash-qr-copy');
  const downloadBtn = document.getElementById('dash-qr-download');
  
  if (urlText) urlText.textContent = storefrontUrl;
  if (viewLink) viewLink.href = storefrontUrl;
  
  // Generate QR code
  if (qrContainer && typeof QRCode !== 'undefined') {
    qrContainer.innerHTML = '';
    const qr = new QRCode(qrContainer, {
      text: storefrontUrl,
      width: 160,
      height: 160,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });
    
    // Download QR
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        const canvas = qrContainer.querySelector('canvas');
        const img = qrContainer.querySelector('img');
        if (canvas) {
          const link = document.createElement('a');
          link.download = `${vendorData.slug}-qr.png`;
          link.href = canvas.toDataURL('image/png');
          link.click();
        } else if (img) {
          const link = document.createElement('a');
          link.download = `${vendorData.slug}-qr.png`;
          link.href = img.src;
          link.click();
        }
      };
    }
  }
  
  // Copy link to clipboard
  if (copyBtn) {
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(storefrontUrl).then(() => {
        showNotification('Storefront link copied to clipboard!', 'success');
      }).catch(() => {
        showNotification('Could not copy link automatically.', 'warning');
      });
    };
  }
}

// Render files list inside gallery dashboard card
function renderVendorGalleryGrid(mediaItems) {
  const container = document.getElementById('dash-gallery-grid');
  if (!container) return;
  
  if (mediaItems.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 13px; padding: 20px;">No images uploaded yet.</p>`;
    return;
  }
  
  container.innerHTML = mediaItems.map(item => `
    <div class="gallery-mgmt-item">
      <img src="${item.secureUrl}" alt="Vendor Gallery">
      <button class="gallery-delete-btn" data-action="delete-media" data-media="${item.id}" title="Delete image">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  `).join('');
}

// Update vendor business details profile
async function handleUpdateVendorProfile(e) {
  e.preventDefault();
  const businessName = document.getElementById('dash-input-business').value;
  const localityName = document.getElementById('dash-input-locality').value;
  const pincode = document.getElementById('dash-input-pincode').value;
  const chowkLandmark = document.getElementById('dash-input-landmark').value;
  
  try {
    const res = await fetchAPI(`/vendors/${state.user.vendor.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ businessName, localityName, pincode, chowkLandmark }),
    });
    
    if (res.status === 'success') {
      showNotification('Profile updated successfully!', 'success');
      await loadVendorMetrics();
    }
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// Update vendor operational status badge
async function changeVendorStatus(status) {
  try {
    const res = await fetchAPI(`/vendors/${state.user.vendor.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    
    if (res.status === 'success') {
      showNotification(`Availability updated to: ${status}`, 'success');
      await loadVendorMetrics();
    }
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// Register new vendor profile
async function handleVendorRegistration(e) {
  e.preventDefault();
  const businessName = document.getElementById('reg-businessName').value;
  const registrationNumber = document.getElementById('reg-registrationNumber').value;
  const cityId = document.getElementById('reg-city').value;
  const localityName = document.getElementById('reg-locality').value;
  const pincode = document.getElementById('reg-pincode').value;
  const chowkLandmark = document.getElementById('reg-landmark').value;
  const timeAvailability = document.getElementById('reg-timeAvailability').value;
  const workingDays = document.getElementById('reg-workingDays').value;
  const locationType = document.querySelector('input[name="reg-locationType"]:checked').value;
  const idType = document.getElementById('reg-idType').value;
  const idNumber = document.getElementById('reg-idNumber').value;
  const membershipTier = document.querySelector('input[name="reg-membershipTier"]:checked').value;
  
  // Notice cityId is now a City Name string from the dropdown. We pass it as cityName to backend.
  const cityName = cityId; 
  
  // Fetch selected categories checkboxes
  const categoryIds = Array.from(document.querySelectorAll('input[name="reg-category"]:checked')).map(cb => cb.value);
  
  if (categoryIds.length === 0) {
    showNotification('Please select at least one primary service category.', 'warning');
    return;
  }
  
  try {
    const res = await fetchAPI('/vendors/register', {
      method: 'POST',
      body: JSON.stringify({
        businessName,
        registrationNumber,
        cityName,
        localityName,
        pincode,
        chowkLandmark,
        timeAvailability,
        workingDays,
        locationType,
        idType,
        idNumber,
        membershipTier,
        categoryIds,
      }),
    });
    
    if (res.status === 'success') {
      showNotification('Business profile registered successfully!', 'success');
      await fetchUserProfile();
      loadVendorDashboard();
    }
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// Upgrade visibility tier
async function upgradeVendorTier(tier) {
  try {
    // For local dev convenience, let vendor request mock payment upgrade which updates DB directly
    showNotification(`Contacting billing gateways... upgrading to ${tier} tier`, 'success');
    
    // Simulate API delay, call mock update
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Mock the direct update of subscription tier
    const res = await fetchAPI(`/vendors/${state.user.vendor.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ membershipTier: tier }),
    });
    
    // Directly fetch update
    showNotification(`Membership upgraded to ${tier}!`, 'success');
    await loadVendorMetrics();
  } catch (error) {
    // Fallback: If patch membership tier directly is restricted, make an override update or display error
    showNotification('Simulating subscription upgrade successfully', 'success');
    // Set locally to test Pro visuals
    state.user.vendor.membershipTier = tier;
    await loadVendorMetrics();
  }
}

// Simulated Media Uploads
function handleMediaFilesSelect(files) {
  const previews = document.getElementById('media-previews');
  if (!previews) return;
  
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      const div = document.createElement('div');
      div.className = 'preview-item';
      div.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
      previews.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
  
  showNotification('Credentials loaded. Ready for submission.', 'success');
}

// Dashboard gallery file mock add
function handleDashboardImageUpload(file) {
  const reader = new FileReader();
  reader.onload = async function(e) {
    showNotification('Simulating image upload to server...', 'success');
    
    // Simulating database insert of mock media
    const mockMedia = {
      id: 'media-' + Math.floor(Math.random() * 9999),
      secureUrl: e.target.result,
    };
    
    // Append to local state list
    if (!state.user.vendor.media) state.user.vendor.media = [];
    state.user.vendor.media.push(mockMedia);
    
    showNotification('Image added to gallery!', 'success');
    renderVendorGalleryGrid(state.user.vendor.media);
  };
  reader.readAsDataURL(file);
}

// Delete media item from gallery
function deleteVendorMedia(mediaId) {
  if (confirm('Are you sure you want to delete this gallery photo?')) {
    state.user.vendor.media = state.user.vendor.media.filter(m => m.id !== mediaId);
    showNotification('Gallery image deleted', 'success');
    renderVendorGalleryGrid(state.user.vendor.media);
  }
}

// ==========================================================================
// Administrative Operations Dashboard
// ==========================================================================
async function loadAdminDashboard() {
  if (!state.user || state.user.role !== 'admin') {
    showNotification('Forbidden: Administrative credentials required.', 'error');
    switchView('home');
    return;
  }
  
  try {
    const res = await fetchAPI('/admin/metrics/dashboard');
    const metrics = res.data;
    
    // Admin widget counts
    document.getElementById('admin-stat-total-vendors').textContent = metrics.vendorDistribution.reduce((sum, v) => sum + v.count, 0);
    document.getElementById('admin-stat-total-clicks').textContent = metrics.leadMetrics.clicks;
    document.getElementById('admin-stat-conversion').textContent = metrics.leadMetrics.conversionRate;
    document.getElementById('admin-stat-deficits').textContent = metrics.searchDeficits.length;
    
    // Load Search Deficits table
    const deficitTbody = document.getElementById('admin-deficit-tbody');
    if (metrics.searchDeficits.length === 0) {
      deficitTbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color: var(--text-muted)">No unfulfilled search queries logged.</td></tr>`;
    } else {
      deficitTbody.innerHTML = metrics.searchDeficits.map(d => `
        <tr>
          <td><span class="badge-city">${d.citySlug}</span></td>
          <td><strong class="text-accent">${d.categorySlug}</strong></td>
          <td><code>${d.query || 'N/A'}</code></td>
          <td>${new Date(d.createdAt).toLocaleString()}</td>
        </tr>
      `).join('');
    }
    
    // Render Vendor Moderation rows
    await loadAllVendorsForModeration();
    
    // Load Feedbacks
    await loadAdminFeedbacks();
    
  } catch (error) {
    showNotification('Failed to fetch admin metrics', 'error');
  }
}

// Fetch all vendors to populate the moderation list
async function loadAllVendorsForModeration() {
  const tbody = document.getElementById('admin-vendor-tbody');
  
  try {
    // In our simplified API we query the explore route for Noida + Plumber & Noida + Electrician to construct a comprehensive list
    const res1 = await fetchAPI('/search/explore/greater-noida/electrician');
    const res2 = await fetchAPI('/search/explore/dadri/plumber');
    const vendors = [...(res1.data || []), ...(res2.data || [])];
    
    if (vendors.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center">No vendors registered in Noida or Dadri.</td></tr>`;
      return;
    }
    
    tbody.innerHTML = vendors.map(v => `
      <tr>
        <td><strong>${v.businessName}</strong><br><small style="color: var(--text-muted)">Reg: ${v.registrationNumber}</small></td>
        <td>${v.city?.name || 'Noida'}<br><small style="color: var(--text-muted)">Locality: ${v.localityName}</small></td>
        <td>${v.categories?.map(c => c.category?.name).join(', ') || 'Service'}</td>
        <td>
          <select class="custom-select" style="border: 1px solid var(--border); padding: 4px; border-radius: 4px; font-size: 13px;" onchange="adminOverrideSubscription('${v.id}', this.value)">
            <option value="Free" ${v.membershipTier === 'Free' ? 'selected' : ''}>Free</option>
            <option value="Starter" ${v.membershipTier === 'Starter' ? 'selected' : ''}>Starter</option>
            <option value="Pro" ${v.membershipTier === 'Pro' ? 'selected' : ''}>Pro</option>
          </select>
        </td>
        <td><span class="badge-status ${v.status}">${v.status}</span></td>
        <td>
          <div class="status-buttons-row" style="padding: 2px;">
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" data-action="moderate-status" data-status="available" data-vendor="${v.id}" title="Approve"><i class="fa-solid fa-check text-success"></i></button>
            <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" data-action="moderate-status" data-status="suspended" data-vendor="${v.id}" title="Suspend"><i class="fa-solid fa-ban text-danger"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="color: var(--danger)">Error loading vendors</td></tr>`;
  }
}

async function loadAdminFeedbacks() {
  const tbody = document.getElementById('admin-feedback-tbody');
  if (!tbody) return;
  
  try {
    const res = await fetchAPI('/feedback');
    const feedbacks = res.data;
    
    if (feedbacks.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color: var(--text-muted)">No feedback received.</td></tr>`;
    } else {
      tbody.innerHTML = feedbacks.map(f => `
        <tr>
          <td><span class="badge-status open">${f.type}</span></td>
          <td>${f.message}</td>
          <td><span class="badge-tier Free">${f.status}</span></td>
          <td>${new Date(f.createdAt).toLocaleString()}</td>
        </tr>
      `).join('');
    }
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center" style="color: var(--danger)">Error loading feedbacks</td></tr>`;
  }
}

// Override subscription tier as admin
async function adminOverrideSubscription(vendorId, tier) {
  try {
    const res = await fetchAPI(`/admin/vendors/${vendorId}/subscription`, {
      method: 'PATCH',
      body: JSON.stringify({ tier, durationDays: 30 }),
    });
    
    if (res.status === 'success') {
      showNotification(`Vendor tier overridden to ${tier}`, 'success');
      loadAdminDashboard();
    }
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// Moderate status of vendor profile as admin
async function adminModerateStatus(vendorId, status) {
  try {
    const res = await fetchAPI(`/admin/vendors/${vendorId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    
    if (res.status === 'success') {
      showNotification(`Vendor status set to: ${status}`, 'success');
      loadAdminDashboard();
    }
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// Admin add new operational city
async function handleAdminAddCity(e) {
  e.preventDefault();
  const name = document.getElementById('admin-city-name').value;
  const slug = document.getElementById('admin-city-slug').value;
  
  try {
    const res = await fetchAPI('/admin/cities', {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
    
    if (res.status === 'success') {
      showNotification(`City registered: ${name}`, 'success');
      document.getElementById('admin-add-city-form').reset();
      await loadMetadata();
    }
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// Admin add new service category
async function handleAdminAddCategory(e) {
  e.preventDefault();
  const name = document.getElementById('admin-cat-name').value;
  const slug = document.getElementById('admin-cat-slug').value;
  
  try {
    const res = await fetchAPI('/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name, slug }),
    });
    
    if (res.status === 'success') {
      showNotification(`Category registered: ${name}`, 'success');
      document.getElementById('admin-add-category-form').reset();
      await loadMetadata();
    }
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

// ==========================================================================
// Setup Listeners, Toasts, Themes, Modals
// ==========================================================================
function setupEventListeners() {
  // Global Event Delegation for dynamic elements
  document.addEventListener('click', (e) => {
    // Category Search
    const catCard = e.target.closest('.category-card[data-action="category-search"]');
    if (catCard) {
      triggerCategorySearch(catCard.getAttribute('data-slug'));
      return;
    }

    // Coming-Soon vertical → waitlist
    const soonCard = e.target.closest('.category-card[data-action="waitlist"]');
    if (soonCard) {
      openWaitlistModal(soonCard.getAttribute('data-vertical'), soonCard.getAttribute('data-name'));
      return;
    }

    // Vendor Resume
    const imgWrapper = e.target.closest('.vendor-img-wrapper[data-action="open-resume"]');
    if (imgWrapper) {
      openVendorResume(imgWrapper.getAttribute('data-vendor'));
      return;
    }
    
    // Contact Vendor
    const contactBtn = e.target.closest('button[data-action="contact-vendor"]');
    if (contactBtn) {
      triggerContactAction(contactBtn.getAttribute('data-vendor'), contactBtn.getAttribute('data-type'));
      return;
    }
    
    // Delete Media
    const deleteBtn = e.target.closest('button[data-action="delete-media"]');
    if (deleteBtn) {
      deleteVendorMedia(deleteBtn.getAttribute('data-media'));
      return;
    }
    
    // Moderate Status
    const moderateBtn = e.target.closest('button[data-action="moderate-status"]');
    if (moderateBtn) {
      adminModerateStatus(moderateBtn.getAttribute('data-vendor'), moderateBtn.getAttribute('data-status'));
      return;
    }
  });

  // Navigation Routing Links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.getAttribute('data-view');
      switchView(view);
    });
  });
  
  // Home brand trigger
  document.getElementById('btn-nav-home').addEventListener('click', (e) => {
    e.preventDefault();
    switchView('home');
  });

  document.getElementById('nav-find-services').addEventListener('click', (e) => {
    e.preventDefault();
    // Default search Noida plumbing
    executeSearch('greater-noida', 'plumber');
  });
  
  // Modal open triggers
  document.getElementById('btn-login-modal').addEventListener('click', () => openAuthModal('login'));
  document.getElementById('btn-signup-modal').addEventListener('click', () => openAuthModal('signup'));
  document.getElementById('btn-close-auth-modal').addEventListener('click', closeAuthModal);
  
  // Onboarding button from home
  document.getElementById('btn-onboard-business').addEventListener('click', () => {
    if (!state.token) {
      showNotification('Please sign up or sign in to offer your services.', 'warning');
      openAuthModal('signup');
    } else {
      switchView('vendor-dashboard');
    }
  });

  // Auth toggle panels
  document.getElementById('modal-tab-login').addEventListener('click', () => toggleAuthPanel('login'));
  document.getElementById('modal-tab-signup').addEventListener('click', () => toggleAuthPanel('signup'));
  
  // Signup Role Change (Customer vs Vendor)
  document.querySelectorAll('input[name="signup-role"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const isVendor = e.target.value === 'vendor';
      const phoneLabel = document.getElementById('signup-phone-label');
      const phoneInput = document.getElementById('signup-phone');
      const submitBtn = document.getElementById('btn-signup-submit');

      if (isVendor) {
        phoneLabel.innerHTML = 'Mobile Phone <span class="required">*</span>';
        phoneInput.required = true;
        submitBtn.textContent = 'Continue to Restaurant Setup';
      } else {
        phoneLabel.textContent = 'Mobile Phone (Optional)';
        phoneInput.required = false;
        submitBtn.textContent = 'Create Free Account';
      }
    });
  });
  
  // Auth Form Submissions
  document.getElementById('form-email-signup').addEventListener('submit', handleEmailSignup);
  document.getElementById('form-email-login').addEventListener('submit', handleEmailLogin);

  // Waitlist (Coming-Soon verticals)
  const waitlistForm = document.getElementById('waitlist-form');
  if (waitlistForm) waitlistForm.addEventListener('submit', handleWaitlistSubmit);
  const waitlistClose = document.getElementById('waitlist-close');
  if (waitlistClose) waitlistClose.addEventListener('click', closeWaitlistModal);
  const waitlistModal = document.getElementById('waitlist-modal');
  if (waitlistModal) waitlistModal.addEventListener('click', (e) => { if (e.target.id === 'waitlist-modal') closeWaitlistModal(); });

  // User details dropdown logout
  document.getElementById('profile-avatar-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('profile-dropdown-menu').classList.toggle('show');
  });
  document.addEventListener('click', () => {
    const dropdown = document.getElementById('profile-dropdown-menu');
    if (dropdown) dropdown.classList.remove('show');
  });
  document.getElementById('btn-logout').addEventListener('click', logout);
  document.getElementById('dropdown-dashboard-link').addEventListener('click', (e) => {
    e.preventDefault();
    if (state.user && state.user.role === 'vendor') {
      switchView('vendor-dashboard');
    } else if (state.user && state.user.role === 'admin') {
      switchView('admin-dashboard');
    } else {
      switchView('home');
    }
  });

  document.getElementById('dropdown-settings-link').addEventListener('click', (e) => {
    e.preventDefault();
    if (!state.token) return switchView('home');
    document.getElementById('profile-name').value = state.user.name || '';
    document.getElementById('profile-email').value = state.user.email || '';
    document.getElementById('profile-phone').value = state.user.phoneNumber || '';
    switchView('user-profile');
  });

  document.getElementById('form-update-profile').addEventListener('submit', handleUpdateProfile);
  document.getElementById('form-change-password').addEventListener('submit', handleChangePassword);

  // Execute Search from Homepage
  document.getElementById('btn-execute-search').addEventListener('click', () => {
    const city = document.getElementById('search-city').value;
    const cat = document.getElementById('search-category').value;
    const query = document.getElementById('search-query').value;
    executeSearch(city, cat, query);
  });
  
  // Geolocation Search trigger
  const btnUseLocation = document.getElementById('btn-use-location');
  if (btnUseLocation) {
    btnUseLocation.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showNotification('Geolocation is not supported by your browser.', 'error');
        return;
      }
      showNotification('Fetching your location...', 'success');
      navigator.geolocation.getCurrentPosition((position) => {
        state.activeSearch.lat = position.coords.latitude;
        state.activeSearch.lng = position.coords.longitude;
        showNotification('Location captured. You can now execute a search.', 'success');
      }, (error) => {
        showNotification('Failed to get location. Please allow permissions.', 'error');
      });
    });
  }

  // Support / Feedback interactions
  const btnFeedback = document.getElementById('btn-open-feedback');
  if (btnFeedback) {
    btnFeedback.addEventListener('click', () => {
      document.getElementById('feedback-modal').classList.remove('hide');
    });
  }
  document.getElementById('btn-close-feedback-modal')?.addEventListener('click', () => {
    document.getElementById('feedback-modal').classList.add('hide');
  });
  document.getElementById('form-submit-feedback')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const type = document.getElementById('feedback-type').value;
    const message = document.getElementById('feedback-message').value;
    try {
      const res = await fetchAPI('/feedback', {
        method: 'POST',
        body: JSON.stringify({ type, message })
      });
      if (res.status === 'success') {
        showNotification('Feedback submitted. Thank you!', 'success');
        document.getElementById('feedback-modal').classList.add('hide');
        document.getElementById('form-submit-feedback').reset();
      }
    } catch (err) {
      showNotification(err.message, 'error');
    }
  });

  // Resume modal close
  document.getElementById('btn-close-resume-modal')?.addEventListener('click', () => {
    document.getElementById('vendor-resume-modal').classList.add('hide');
  });
  
  // Results explore sidebar filters
  document.getElementById('filter-available-only').addEventListener('change', filterListings);
  document.querySelectorAll('.rating-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.rating-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterListings();
    });
  });
  document.querySelectorAll('.filter-tier').forEach(cb => {
    cb.addEventListener('change', filterListings);
  });
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    document.getElementById('filter-available-only').checked = false;
    document.querySelectorAll('.rating-chip').forEach(c => c.classList.remove('active'));
    document.querySelector('.rating-chip[data-rating="0"]').classList.add('active');
    document.querySelectorAll('.filter-tier').forEach(cb => cb.checked = false);
    filterListings();
  });
  
  // Vendor setup steps navigation wizard
  document.querySelectorAll('.btn-next-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const nextStepNum = btn.getAttribute('data-next');
      
      // Basic validations before stepping
      if (nextStepNum === '2') {
        const name = document.getElementById('reg-businessName').value;
        const reg = document.getElementById('reg-registrationNumber').value;
        if (!name || !reg) {
          showNotification('Please fill in both name and registration details', 'warning');
          return;
        }
      } else if (nextStepNum === '3') {
        const city = document.getElementById('reg-city').value;
        const locality = document.getElementById('reg-locality').value;
        const pincode = document.getElementById('reg-pincode').value;
        const checks = Array.from(document.querySelectorAll('input[name="reg-category"]:checked'));
        
        if (!city || !locality || !pincode || checks.length === 0) {
          showNotification('Please provide operating city, locality, pincode, and select service domains.', 'warning');
          return;
        }
      }
      
      document.querySelectorAll('.form-step-panel').forEach(p => p.classList.remove('active-panel'));
      document.getElementById(`panel-step-${nextStepNum}`).classList.add('active-panel');
      
      document.querySelectorAll('.setup-progress .step').forEach(s => s.classList.remove('step-active'));
      document.querySelector(`.setup-progress .step[data-step="${nextStepNum}"]`).classList.add('step-active');
    });
  });

  document.querySelectorAll('.btn-prev-step').forEach(btn => {
    btn.addEventListener('click', () => {
      const prevStepNum = btn.getAttribute('data-prev');
      document.querySelectorAll('.form-step-panel').forEach(p => p.classList.remove('active-panel'));
      document.getElementById(`panel-step-${prevStepNum}`).classList.add('active-panel');
      
      document.querySelectorAll('.setup-progress .step').forEach(s => s.classList.remove('step-active'));
      document.querySelector(`.setup-progress .step[data-step="${prevStepNum}"]`).classList.add('step-active');
    });
  });

  // Vendor registration submit
  document.getElementById('vendor-register-form').addEventListener('submit', handleVendorRegistration);
  
  // Vendor status click available updates
  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const status = btn.getAttribute('data-status');
      changeVendorStatus(status);
    });
  });

  // Vendor update profile details
  document.getElementById('dash-update-profile-form').addEventListener('submit', handleUpdateVendorProfile);
  
  // Vendor upgrades subscription button clicks
  document.querySelectorAll('.tier-card .btn-upgrade').forEach(btn => {
    btn.addEventListener('click', () => {
      const tier = btn.closest('.tier-card').getAttribute('data-tier');
      if (tier !== state.user?.vendor?.membershipTier) {
        upgradeVendorTier(tier);
      }
    });
  });

  // Drag Drop zone clicks
  const dropzone = document.getElementById('file-dropzone');
  const fileInput = document.getElementById('reg-media-files');
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleMediaFilesSelect(e.target.files));
  }

  // Dashboard gallery file mock add
  const dashGallBtn = document.getElementById('btn-dash-upload-gallery');
  const dashGallInput = document.getElementById('dash-upload-gallery-input');
  if (dashGallBtn && dashGallInput) {
    dashGallBtn.addEventListener('click', () => dashGallInput.click());
    dashGallInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleDashboardImageUpload(e.target.files[0]);
      }
    });
  }

  // Admin tabs switching
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const tabId = tab.getAttribute('data-tab');
      document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active-panel'));
      document.getElementById(tabId).classList.add('active-panel');
    });
  });
  
  // Admin form submits
  document.getElementById('admin-add-city-form').addEventListener('submit', handleAdminAddCity);
  document.getElementById('admin-add-category-form').addEventListener('submit', handleAdminAddCategory);

  // Forgot Password Handler
  const forgotForm = document.getElementById('form-forgot-password');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('forgot-email').value;
      
      try {
        const res = await fetchAPI('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        
        if (res.status === 'success') {
          showNotification('If this email is registered, a reset link has been sent.', 'success');
          document.getElementById('modal-panel-forgot-password').classList.remove('active-panel');
          document.getElementById('modal-panel-login').classList.add('active-panel');
        } else {
          showNotification(res.message || 'Error requesting reset', 'error');
        }
      } catch (err) {
        showNotification('System error. Try again later.', 'error');
      }
    });
  }
  
  const btnForgot = document.getElementById('btn-forgot-password');
  if (btnForgot) {
    btnForgot.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('modal-panel-login').classList.remove('active-panel');
      document.getElementById('modal-panel-forgot-password').classList.add('active-panel');
    });
  }
  
  const btnBackLogin = document.getElementById('btn-back-to-login');
  if (btnBackLogin) {
    btnBackLogin.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('modal-panel-forgot-password').classList.remove('active-panel');
      document.getElementById('modal-panel-login').classList.add('active-panel');
    });
  }
}

// Client filtering of currently search vendors on page
function filterListings() {
  const availableOnly = document.getElementById('filter-available-only').checked;
  const minRating = parseFloat(document.querySelector('.rating-filter-options .rating-chip.active').getAttribute('data-target') || document.querySelector('.rating-filter-options .rating-chip.active').getAttribute('data-rating') || 0);
  const selectedTiers = Array.from(document.querySelectorAll('.filter-tier:checked')).map(cb => cb.value);
  
  const container = document.getElementById('listings-container');
  if (!container) return;
  
  // Filter search results locally
  const filtered = state.searchResults.filter(vendor => {
    // 1. Availability Filter
    if (availableOnly && vendor.status !== 'available') return false;
    
    // 2. Rating Filter
    if (vendor.rating < minRating) return false;
    
    // 3. Membership Tier Filter
    if (selectedTiers.length > 0 && !selectedTiers.includes(vendor.membershipTier)) return false;
    
    return true;
  });
  
  document.getElementById('search-results-count').textContent = `${filtered.length} matching listings found (filtered)`;
  
  // Re-render only filtered
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="dash-card text-center" style="padding: 60px;">
        <i class="fa-solid fa-face-frown" style="font-size: 50px; color: var(--text-muted); margin-bottom: 20px;"></i>
        <h2>No Service Providers Match Filters</h2>
        <p style="color: var(--text-muted); margin-top: 10px;">Try relaxing your filters to discover more local service professionals.</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = filtered.map(vendor => {
    const stars = '★'.repeat(Math.round(vendor.rating)) + '☆'.repeat(5 - Math.round(vendor.rating));
    const tierBadge = vendor.membershipTier !== 'Free' 
      ? `<span class="badge-tier ${vendor.membershipTier}">${vendor.membershipTier} Pro</span>` 
      : '';
    const shopPhoto = vendor.media && vendor.media.length > 0 
      ? `<img src="${vendor.media[0].secureUrl}" alt="${vendor.businessName}">`
      : '<i class="fa-solid fa-screwdriver-wrench"></i>';
    const landmarkText = vendor.chowkLandmark ? ` &bull; Near ${vendor.chowkLandmark}` : '';

    return `
      <div class="vendor-card ${vendor.membershipTier}">
        <div class="vendor-img-wrapper" style="cursor: pointer;" data-action="open-resume" data-vendor="${vendor.id}" title="View Profile">
          ${shopPhoto}
        </div>
        <div class="vendor-info">
          <div class="vendor-info-header">
            <h3 class="vendor-title">${vendor.businessName}</h3>
            ${tierBadge}
          </div>
          <div class="vendor-meta-row">
            <span class="ad-rating">${stars} ${vendor.rating.toFixed(1)}</span>
            <span><i class="fa-solid fa-location-crosshairs"></i> ${vendor.localityName}${landmarkText}</span>
            <span><i class="fa-solid fa-map-pin"></i> ${vendor.pincode}</span>
          </div>
          <div class="vendor-badge-row">
            <span class="badge-status ${vendor.status}">${vendor.status}</span>
            <span class="badge-city">${vendor.city?.name || 'Local'}</span>
          </div>
        </div>
        <div class="vendor-action-col">
          <button class="btn btn-primary btn-block" data-action="contact-vendor" data-type="call_click" data-vendor="${vendor.id}">
            <i class="fa-solid fa-phone"></i> Call Professional
          </button>
          <button class="btn btn-secondary btn-block" data-action="contact-vendor" data-type="whatsapp_click" data-vendor="${vendor.id}">
            <i class="fa-solid fa-message text-success"></i> WhatsApp Chat
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ── Coming-Soon Waitlist ──────────────────────────────────────────────────
function openWaitlistModal(vertical, name) {
  const modal = document.getElementById('waitlist-modal');
  if (!modal) return;
  modal.querySelector('#waitlist-vertical').value = vertical;
  modal.querySelector('#waitlist-title').textContent = `${name} — Coming Soon`;
  modal.querySelector('#waitlist-form').reset();
  modal.querySelector('#waitlist-vertical').value = vertical; // reset() clears hidden too
  modal.classList.remove('hide');
}
function closeWaitlistModal() {
  const modal = document.getElementById('waitlist-modal');
  if (modal) modal.classList.add('hide');
}
async function handleWaitlistSubmit(e) {
  e.preventDefault();
  const vertical = document.getElementById('waitlist-vertical').value;
  const contact = document.getElementById('waitlist-contact').value.trim();
  const wlName = document.getElementById('waitlist-name').value.trim();
  const audience = document.querySelector('input[name="waitlist-audience"]:checked')?.value || 'customer';
  if (!contact) {
    showNotification('Please enter your phone or email.', 'warning');
    return;
  }
  try {
    await fetchAPI('/feedback/waitlist', {
      method: 'POST',
      body: JSON.stringify({ vertical, contact, name: wlName, audience }),
    });
    closeWaitlistModal();
    showNotification("You're on the list! We'll notify you when this launches.", 'success');
  } catch (err) {
    showNotification(err.message || 'Could not join the waitlist. Try again.', 'error');
  }
}

// Open Auth Modals
function openAuthModal(mode = 'login') {
  const modal = document.getElementById('auth-modal');
  modal.classList.remove('hide');
  toggleAuthPanel(mode);
}
function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hide');
  // Reset forms
  document.getElementById('form-email-signup').reset();
  document.getElementById('form-email-login').reset();
}

function toggleAuthPanel(mode) {
  const tabLogin = document.getElementById('modal-tab-login');
  const tabSignup = document.getElementById('modal-tab-signup');
  const panelLogin = document.getElementById('modal-panel-login');
  const panelSignup = document.getElementById('modal-panel-signup');
  
  if (mode === 'login') {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    panelLogin.classList.add('active-panel');
    panelSignup.classList.remove('active-panel');
  } else {
    tabLogin.classList.remove('active');
    tabSignup.classList.add('active');
    panelLogin.classList.remove('active-panel');
    panelSignup.classList.add('active-panel');
  }
}

// Theme Settings management
function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const activeTheme = localStorage.getItem('theme') || 'light';
  
  if (activeTheme === 'dark') {
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
    themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
  } else {
    document.body.classList.add('light-theme');
    document.body.classList.remove('dark-theme');
    themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
  }
  
  themeToggle.addEventListener('click', () => {
    if (document.body.classList.contains('dark-theme')) {
      document.body.classList.remove('dark-theme');
      document.body.classList.add('light-theme');
      themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.remove('light-theme');
      document.body.classList.add('dark-theme');
      themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
      localStorage.setItem('theme', 'dark');
    }
  });

  // Run initial Ads carousel load in background
  loadFeaturedAds();
}

// Toast notification alert popups
function showNotification(message, type = 'success') {
  const container = document.getElementById('notification-area');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-xmark';
  if (type === 'warning') icon = 'fa-triangle-exclamation';
  
  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Smooth dismiss timer
  setTimeout(() => {
    toast.style.animation = 'toastSlideIn 0.3s reverse forwards';
    toast.addEventListener('animationend', () => toast.remove());
  }, 4000);
}

// Vendor Resume Modal Logic
function openVendorResume(vendorId) {
  if (!state.user) {
    showNotification('Please sign in to view detailed professional profiles.', 'warning');
    openAuthModal('login');
    return;
  }
  
  const vendor = state.searchResults.find(v => v.id === vendorId);
  if (!vendor) return;

  document.getElementById('resume-business-name').textContent = vendor.businessName;
  document.getElementById('resume-hours').textContent = vendor.timeAvailability || '09:00 AM - 06:00 PM';
  document.getElementById('resume-days').textContent = vendor.workingDays || 'Mon - Sat';
  document.getElementById('resume-type').textContent = vendor.locationType || 'Freelancer';
  document.getElementById('resume-rating').textContent = vendor.rating ? vendor.rating.toFixed(1) : 'New';
  
  const verifiedBadge = document.getElementById('resume-verified-badge');
  if (vendor.idType && vendor.idNumber) {
    verifiedBadge.classList.remove('hide');
  } else {
    verifiedBadge.classList.add('hide');
  }

  const btnCall = document.getElementById('btn-resume-call');
  const btnWhatsApp = document.getElementById('btn-resume-whatsapp');
  
  // Need to clear old event listeners if any, so easiest is replace clone
  const newCall = btnCall.cloneNode(true);
  const newWa = btnWhatsApp.cloneNode(true);
  btnCall.parentNode.replaceChild(newCall, btnCall);
  btnWhatsApp.parentNode.replaceChild(newWa, btnWhatsApp);

  newCall.addEventListener('click', () => {
    triggerContactAction(vendor.id, 'call_click');
  });
  newWa.addEventListener('click', () => {
    triggerContactAction(vendor.id, 'whatsapp_click');
  });

  document.getElementById('vendor-resume-modal').classList.remove('hide');
}
