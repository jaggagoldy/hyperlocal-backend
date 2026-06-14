/* ==========================================================================
   NearByBazar — Business Storefront Engine (storefront.js)
   Fetches business profile + catalog and renders the full mini-site
   ========================================================================== */

const API_BASE = '/api/v1';
let businessData = null;
let qrInstance = null;

// ─── UTILS ────────────────────────────────────────────────────────────────────

function getSlugFromPath() {
  // Supports /s/:slug pattern
  const parts = window.location.pathname.split('/');
  const sIdx = parts.indexOf('s');
  if (sIdx !== -1 && parts[sIdx + 1]) return parts[sIdx + 1];
  // Fallback: last path segment
  return parts.filter(Boolean).pop() || null;
}

function starsHTML(rating) {
  const full = Math.round(rating);
  return '★'.repeat(Math.min(full, 5)) + '☆'.repeat(Math.max(0, 5 - full));
}

function formatPrice(price) {
  if (!price && price !== 0) return null;
  return `<span class="rupee">₹</span>${Number(price).toLocaleString('en-IN')}`;
}

function show(id) { const el = document.getElementById(id); if (el) el.style.display = 'flex'; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
function setDisplay(id, display) { const el = document.getElementById(id); if (el) el.style.display = display; }

// ─── DATA FETCH ───────────────────────────────────────────────────────────────

async function fetchBusiness(slug) {
  const res = await fetch(`${API_BASE}/business/${slug}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message || 'Failed to load business');
  return json.data;
}

// ─── RENDER FUNCTIONS ────────────────────────────────────────────────────────

function renderHero(biz) {
  // Type badge
  const typeMap = {
    FOOD_BEVERAGE: { label: 'Restaurant', icon: 'fa-utensils' },
    SALON_BEAUTY:  { label: 'Salon & Beauty', icon: 'fa-scissors' },
    HOME_MAINTENANCE: { label: 'Home Services', icon: 'fa-screwdriver-wrench' },
  };
  const type = typeMap[biz.businessType] || { label: 'Business', icon: 'fa-store' };
  const badge = document.getElementById('sf-type-badge');
  if (badge) badge.innerHTML = `<i class="fa-solid ${type.icon}"></i><span>${type.label}</span>`;

  document.getElementById('sf-business-name').textContent = biz.businessName;
  document.title = `${biz.businessName} — NearByBazar`;

  // Meta chips
  const chips = [];
  if (biz.status) {
    const statusLabels = { available: 'Open Now', busy: 'Busy', closed: 'Closed', emergency: 'Emergency Only' };
    const statusIcons = { available: 'fa-circle-check', busy: 'fa-clock', closed: 'fa-circle-xmark', emergency: 'fa-kit-medical' };
    chips.push(`<span class="sf-chip status-${biz.status}">
      <i class="fa-solid ${statusIcons[biz.status] || 'fa-circle'}"></i>
      ${statusLabels[biz.status] || biz.status}
    </span>`);
  }
  if (biz.city) chips.push(`<span class="sf-chip"><i class="fa-solid fa-location-dot"></i> ${biz.city.name}</span>`);
  if (biz.localityName) chips.push(`<span class="sf-chip"><i class="fa-solid fa-map-pin"></i> ${biz.localityName}</span>`);
  if (biz.membershipTier && biz.membershipTier !== 'Free') {
    chips.push(`<span class="sf-chip"><i class="fa-solid fa-crown"></i> ${biz.membershipTier} Partner</span>`);
  }
  document.getElementById('sf-meta-chips').innerHTML = chips.join('');

  // Rating
  const rating = biz.rating ? parseFloat(biz.rating) : 0;
  document.getElementById('sf-stars').textContent = starsHTML(rating);
  document.getElementById('sf-rating-score').textContent = rating.toFixed(1);
}

function renderActions(biz) {
  const phoneNumber = biz.user?.phoneNumber || '';
  const btnCall = document.getElementById('sf-btn-call');
  const btnWa = document.getElementById('sf-btn-wa');

  if (phoneNumber) {
    btnCall.onclick = () => { window.location.href = `tel:+91${phoneNumber}`; };
    btnWa.onclick = () => {
      const msg = encodeURIComponent(`Hi! I found you on NearByBazar. I'd like to enquire about your services.`);
      window.open(`https://wa.me/91${phoneNumber}?text=${msg}`, '_blank');
    };
  } else {
    btnCall.disabled = true;
    btnCall.style.opacity = '0.5';
    btnWa.disabled = true;
    btnWa.style.opacity = '0.5';
  }
}

function renderInfoCard(biz) {
  const card = document.getElementById('sf-info-card');
  if (!card) return;

  const items = [];

  if (biz.timeAvailability) {
    items.push(`<div class="sf-info-item">
      <span class="sf-info-label"><i class="fa-solid fa-clock" style="color:var(--accent)"></i> Working Hours</span>
      <span class="sf-info-value">${biz.timeAvailability}</span>
    </div>`);
  }

  if (biz.workingDays) {
    items.push(`<div class="sf-info-item">
      <span class="sf-info-label"><i class="fa-solid fa-calendar" style="color:var(--accent)"></i> Working Days</span>
      <span class="sf-info-value">${biz.workingDays}</span>
    </div>`);
  }

  if (biz.localityName) {
    const landmark = biz.chowkLandmark ? ` · ${biz.chowkLandmark}` : '';
    items.push(`<div class="sf-info-item">
      <span class="sf-info-label"><i class="fa-solid fa-map-pin" style="color:var(--accent)"></i> Location</span>
      <span class="sf-info-value">${biz.localityName}${landmark}, ${biz.city?.name || ''}</span>
    </div>`);
  }

  if (biz.pincode) {
    items.push(`<div class="sf-info-item">
      <span class="sf-info-label"><i class="fa-solid fa-mailbox" style="color:var(--accent)"></i> Pincode</span>
      <span class="sf-info-value">${biz.pincode}</span>
    </div>`);
  }

  if (biz.locationType) {
    items.push(`<div class="sf-info-item">
      <span class="sf-info-label"><i class="fa-solid fa-store" style="color:var(--accent)"></i> Type</span>
      <span class="sf-info-value">${biz.locationType === 'Shop' ? 'Dine-In / Shop' : 'Mobile / Freelancer'}</span>
    </div>`);
  }

  card.innerHTML = items.length > 0 ? items.join('') : '<p style="color:var(--text-muted)">No additional info.</p>';
}

function renderTags(biz) {
  const meta = biz.metaData || {};
  const tags = [];

  // Restaurant-specific
  if (meta.cuisines?.length) meta.cuisines.forEach(c => tags.push(c));
  if (meta.dietary?.length) meta.dietary.forEach(d => tags.push(d));
  if (meta.facilities?.length) meta.facilities.forEach(f => tags.push(f));

  // Salon-specific
  if (meta.services?.length) meta.services.forEach(s => tags.push(s));

  // Category names
  if (biz.categories?.length) {
    biz.categories.forEach(bc => {
      if (bc.category?.name) tags.push(bc.category.name);
    });
  }

  if (tags.length === 0) return;

  const section = document.getElementById('sf-tags-section');
  const container = document.getElementById('sf-tags');
  if (section) section.style.display = 'block';
  if (container) container.innerHTML = [...new Set(tags)].map(t => `<span class="sf-tag">${t}</span>`).join('');
}

function renderGallery(biz) {
  const media = biz.media || [];
  if (media.length === 0) return;

  const section = document.getElementById('sf-gallery-section');
  const gallery = document.getElementById('sf-gallery');
  if (section) section.style.display = 'block';
  if (gallery) {
    gallery.innerHTML = media.map(m => `<img src="${m.secureUrl}" alt="${biz.businessName}" loading="lazy">`).join('');
  }
}

function renderMenuCatalogue(biz) {
  const items = biz.catalogItems || [];
  const menuSection = document.getElementById('sf-menu-section');
  const catNav = document.getElementById('sf-cat-nav');
  const menuContainer = document.getElementById('sf-menu-items');

  if (!menuSection || !catNav || !menuContainer) return;

  if (items.length === 0) {
    catNav.style.display = 'none';
    menuContainer.innerHTML = `
      <div class="sf-empty">
        <i class="fa-solid fa-book-open"></i>
        <p>Menu coming soon. Call us to enquire!</p>
      </div>`;
    return;
  }

  // Group items by their food category (from metaData) or a default group
  const grouped = {};
  items.forEach(item => {
    const grpLabel = item.metaData?.foodCategory
      || item.metaData?.serviceCategory
      || item.category?.name
      || 'Menu';
    if (!grouped[grpLabel]) grouped[grpLabel] = [];
    grouped[grpLabel].push(item);
  });

  const groupKeys = Object.keys(grouped);

  // Category navigation pills
  const allPill = `<button class="sf-cat-pill active" data-group="all" onclick="filterMenuGroup('all', this)">
    <i class="fa-solid fa-border-all"></i> All
  </button>`;
  const groupPills = groupKeys.map(key =>
    `<button class="sf-cat-pill" data-group="${key}" onclick="filterMenuGroup('${key.replace(/'/g, "\\'")}', this)">
      ${key}
    </button>`
  ).join('');
  catNav.innerHTML = allPill + groupPills;

  // Build all groups HTML
  const groupsHTML = groupKeys.map(key => {
    const groupItems = grouped[key];
    const cardsHTML = groupItems.map(item => buildMenuCard(item)).join('');
    return `
      <div class="sf-menu-group" data-group="${key}">
        <div class="sf-menu-group-title">
          <i class="fa-solid fa-circle-dot"></i> ${key}
          <span style="color:var(--text-muted);font-size:13px;font-weight:400">${groupItems.length} item${groupItems.length > 1 ? 's' : ''}</span>
        </div>
        <div class="sf-menu-grid">${cardsHTML}</div>
      </div>`;
  }).join('');

  menuContainer.innerHTML = groupsHTML;
}

function buildMenuCard(item) {
  const isVeg = item.metaData?.dietary === 'veg' || item.metaData?.isVeg === true;
  const isNonVeg = item.metaData?.dietary === 'non-veg' || item.metaData?.isVeg === false;

  const indicator = (isVeg || isNonVeg)
    ? `<div class="sf-food-indicator ${isVeg ? 'veg' : 'nonveg'}" title="${isVeg ? 'Vegetarian' : 'Non-Vegetarian'}"></div>`
    : '';

  const spicyLevel = item.metaData?.spicyLevel;
  const spicyEmoji = { low: '🌶', medium: '🌶🌶', high: '🌶🌶🌶' }[spicyLevel] || '';

  // Price display
  let priceHTML = '';
  const variants = Array.isArray(item.variants) ? item.variants : [];

  if (variants.length > 0) {
    // Show variants (Half/Full etc.)
    const variantChips = variants.map(v =>
      `<div class="sf-variant-chip">
        ${v.name}: <span class="v-price">₹${Number(v.price).toLocaleString('en-IN')}</span>
      </div>`
    ).join('');
    priceHTML = `<div class="sf-variants">${variantChips}</div>`;
  } else if (item.price) {
    priceHTML = `<div class="sf-menu-price">${formatPrice(item.price)}</div>`;
  }

  const unavailableTag = !item.isAvailable
    ? `<span class="sf-unavailable-tag">Unavailable</span>` : '';

  const desc = item.description
    ? `<p class="sf-menu-card-desc">${item.description}</p>` : '';

  return `
    <div class="sf-menu-card ${!item.isAvailable ? 'opacity-50' : ''}">
      <div class="sf-menu-card-top">
        <h4 class="sf-menu-card-title">${item.title} ${spicyEmoji}</h4>
        ${indicator}
      </div>
      ${desc}
      <div class="sf-menu-card-footer">
        ${priceHTML}
        ${unavailableTag}
      </div>
    </div>`;
}

// Filter menu by group category
window.filterMenuGroup = function(group, btn) {
  // Update pills
  document.querySelectorAll('.sf-cat-pill').forEach(p => p.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const groups = document.querySelectorAll('.sf-menu-group');
  groups.forEach(g => {
    if (group === 'all' || g.dataset.group === group) {
      g.style.display = 'block';
    } else {
      g.style.display = 'none';
    }
  });
};

// ─── QR CODE ─────────────────────────────────────────────────────────────────

function setupQRCode(biz) {
  const storefrontUrl = `${window.location.origin}/s/${biz.slug}`;
  const qrContainer = document.getElementById('sf-qr-canvas');
  const urlText = document.getElementById('sf-qr-url-text');
  const modal = document.getElementById('sf-qr-modal');
  const showBtn = document.getElementById('sf-btn-show-qr');
  const closeBtn = document.getElementById('sf-qr-close-btn');
  const downloadBtn = document.getElementById('sf-qr-download');

  if (urlText) urlText.textContent = storefrontUrl;

  // Generate QR code
  if (qrContainer && typeof QRCode !== 'undefined') {
    qrContainer.innerHTML = ''; // clear previous
    qrInstance = new QRCode(qrContainer, {
      text: storefrontUrl,
      width: 220,
      height: 220,
      colorDark: '#1e293b',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });
  }

  // Show modal
  if (showBtn && modal) {
    showBtn.onclick = () => modal.classList.add('open');
  }

  // Close modal
  if (closeBtn && modal) {
    closeBtn.onclick = () => modal.classList.remove('open');
  }
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) modal.classList.remove('open');
    };
  }

  // Download QR
  if (downloadBtn) {
    downloadBtn.onclick = () => {
      const canvas = qrContainer?.querySelector('canvas');
      const img = qrContainer?.querySelector('img');
      if (canvas) {
        const link = document.createElement('a');
        link.download = `${biz.slug}-qr.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else if (img) {
        const link = document.createElement('a');
        link.download = `${biz.slug}-qr.png`;
        link.href = img.src;
        link.click();
      }
    };
  }
}

// ─── PWA INSTALL PROMPT ───────────────────────────────────────────────────────

let pwaInstallEvent = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  pwaInstallEvent = e;
  const banner = document.getElementById('sf-install-banner');
  if (banner) banner.style.display = 'flex';
});

document.addEventListener('DOMContentLoaded', () => {
  const banner = document.getElementById('sf-install-banner');
  if (banner) {
    banner.addEventListener('click', (e) => {
      if (e.target.id === 'sf-install-dismiss') {
        banner.style.display = 'none';
        return;
      }
      if (pwaInstallEvent) {
        pwaInstallEvent.prompt();
        banner.style.display = 'none';
      }
    });
  }
});

// ─── SERVICE WORKER REGISTRATION ──────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// ─── MAIN INIT ────────────────────────────────────────────────────────────────

async function init() {
  const slug = getSlugFromPath();

  if (!slug) {
    document.getElementById('sf-loading').style.display = 'none';
    document.getElementById('sf-error').style.display = 'flex';
    return;
  }

  try {
    const biz = await fetchBusiness(slug);
    businessData = biz;

    // Render all sections
    renderHero(biz);
    renderActions(biz);
    renderInfoCard(biz);
    renderTags(biz);
    renderGallery(biz);
    renderMenuCatalogue(biz);
    setupQRCode(biz);

    // Show main content
    document.getElementById('sf-loading').style.display = 'none';
    document.getElementById('sf-main').style.display = 'block';

  } catch (err) {
    console.error('Storefront load error:', err);
    document.getElementById('sf-loading').style.display = 'none';
    document.getElementById('sf-error').style.display = 'flex';
  }
}

// Start
document.addEventListener('DOMContentLoaded', init);
