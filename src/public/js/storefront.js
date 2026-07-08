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

// Lightweight toast — the public storefront page does not load app.js, so it
// has no showNotification of its own.
function showNotification(message, type = 'info') {
  let el = document.getElementById('sf-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sf-toast';
    el.style.cssText = 'position:fixed; left:50%; bottom:24px; transform:translateX(-50%); z-index:2000; padding:12px 20px; border-radius:10px; font-size:14px; font-weight:600; color:#fff; box-shadow:0 8px 24px rgba(0,0,0,0.35); opacity:0; transition:opacity .25s; pointer-events:none; max-width:90%; text-align:center;';
    document.body.appendChild(el);
  }
  const colors = { success: '#16a34a', error: '#dc2626', warning: '#d97706', info: '#4f46e5' };
  el.style.background = colors[type] || colors.info;
  el.textContent = message;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 2600);
}

// Compute today's open/closed status from an operatingHours map (IST-based).
// Handles overnight ranges (e.g. 18:00–02:00). Returns null when no schedule.
function computeOpenStatus(operatingHours) {
  if (!operatingHours || typeof operatingHours !== 'object') return null;
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 3600000 * 5.5);
  const todayKey = dayKeys[ist.getDay()];
  const today = operatingHours[todayKey];
  if (!today || today.closed || !today.open || !today.close) {
    return { isOpen: false, todayKey, today: today || { closed: true } };
  }
  const [oH, oM] = today.open.split(':').map(Number);
  const [cH, cM] = today.close.split(':').map(Number);
  const openVal = oH * 60 + oM;
  const closeVal = cH * 60 + cM;
  const cur = ist.getHours() * 60 + ist.getMinutes();
  const isOpen = closeVal <= openVal
    ? (cur >= openVal || cur < closeVal) // overnight
    : (cur >= openVal && cur < closeVal);
  return { isOpen, todayKey, today };
}

// ─── TRUST BADGE REGISTRY (data-driven; add tiers here without redesign) ───────
const TRUST_TIERS = [
  {
    key: 'featured',
    label: 'Featured Partner',
    icon: 'fa-star',
    color: 'var(--accent2)',
    desc: 'Hand-picked and promoted by NearByBazar.',
    test: (b) => b.isFeatured === true,
  },
  {
    key: 'verified',
    label: 'Verified Business',
    icon: 'fa-circle-check',
    color: 'var(--success)',
    desc: 'Identity and credentials verified by NearByBazar.',
    test: (b) => b.idVerified === true,
  },
  {
    key: 'top_rated',
    label: 'Top Rated',
    icon: 'fa-award',
    color: '#f59e0b',
    desc: 'Consistently rated 4.5★ and above by customers.',
    test: (b) => (b.rating || 0) >= 4.5 && (b._count?.reviews || 0) >= 3,
  },
  {
    key: 'trusted',
    label: 'Trusted Seller',
    icon: 'fa-shield-halved',
    color: 'var(--accent)',
    desc: 'Established member with a claimed, active profile.',
    test: (b) => b.isClaimed === true && b.membershipTier && b.membershipTier !== 'Free',
  },
];

function getTrustBadges(biz) {
  return TRUST_TIERS.filter((t) => {
    try { return t.test(biz); } catch { return false; }
  });
}

function trustBadgeHTML(badge) {
  return `
    <div class="sf-trust-badge" style="display:flex; align-items:center; gap:10px;">
      <i class="fa-solid ${badge.icon}" style="color:${badge.color}; font-size:18px; width:20px; text-align:center;"></i>
      <div>
        <strong style="display:block; font-size:14px; color:var(--text-primary);">${badge.label}</strong>
        <span style="font-size:12px; color:var(--text-secondary);">${badge.desc}</span>
      </div>
    </div>`;
}

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

let lightboxImages = [];
let currentImageIndex = 0;

function setupLightboxGallery(biz) {
  // Only true gallery photos — cover banner and verification docs are excluded.
  const media = (biz.media || []).filter((m) => m.type !== 'cover' && m.type !== 'verification_doc');
  const cats = biz.metaData?.galleryCategories || {};
  lightboxImages = media.map(m => m.secureUrl);

  const modal = document.getElementById('sf-lightbox-modal');
  const modalImg = document.getElementById('sf-lightbox-img');
  const closeBtn = document.getElementById('sf-lightbox-close');
  const prevBtn = document.getElementById('sf-lightbox-prev');
  const nextBtn = document.getElementById('sf-lightbox-next');

  if (!modal || !modalImg) return;

  const section = document.getElementById('sf-gallery-section');
  const gallery = document.getElementById('sf-gallery');

  if (media.length === 0) {
    if (section) section.style.display = 'none';
    return;
  }

  if (section) section.style.display = 'block';
  if (gallery) {
    gallery.innerHTML = media.map((m, index) => {
      const cat = cats[m.id];
      const catBadge = cat
        ? `<span style="position:absolute; bottom:4px; left:4px; background:rgba(0,0,0,0.65); color:#fff; font-size:10px; padding:2px 6px; border-radius:4px; pointer-events:none;">${cat}</span>`
        : '';
      return `
      <div style="position:relative;">
        <img src="${m.secureUrl}" alt="${biz.businessName}${cat ? ' — ' + cat : ''}" loading="lazy" style="cursor:pointer; width:100%; display:block; border-radius:6px;" data-gallery-index="${index}">
        ${catBadge}
      </div>`;
    }).join('');

    // Attach click events
    gallery.querySelectorAll('img[data-gallery-index]').forEach(img => {
      img.onclick = () => {
        currentImageIndex = parseInt(img.getAttribute('data-gallery-index'), 10);
        showLightboxImage();
        modal.classList.add('open');
      };
    });
  }

  function showLightboxImage() {
    if (currentImageIndex < 0) currentImageIndex = lightboxImages.length - 1;
    if (currentImageIndex >= lightboxImages.length) currentImageIndex = 0;
    modalImg.src = lightboxImages[currentImageIndex];
  }

  if (closeBtn) {
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      modal.classList.remove('open');
    };
  }

  modal.onclick = (e) => {
    if (e.target === modal || e.target === modalImg) {
      modal.classList.remove('open');
    }
  };

  if (prevBtn) {
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      currentImageIndex--;
      showLightboxImage();
    };
  }

  if (nextBtn) {
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      currentImageIndex++;
      showLightboxImage();
    };
  }

  // Keyboard controls
  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('open')) return;
    if (e.key === 'Escape') modal.classList.remove('open');
    if (e.key === 'ArrowLeft') {
      currentImageIndex--;
      showLightboxImage();
    }
    if (e.key === 'ArrowRight') {
      currentImageIndex++;
      showLightboxImage();
    }
  });
}

function renderTrustSection(biz) {
  const container = document.getElementById('sf-trust-section');
  if (!container) return;

  const items = [];

  // 1. Trust Badges (data-driven — Featured / Verified / Top Rated / Trusted)
  const badges = getTrustBadges(biz);
  if (badges.length > 0) {
    badges.forEach((b) => items.push(trustBadgeHTML(b)));
  } else {
    items.push(`
      <div style="display:flex; align-items:center; gap:10px;">
        <i class="fa-solid fa-circle-minus" style="color:var(--text-muted); font-size:18px; width:20px; text-align:center;"></i>
        <div>
          <strong style="display:block; font-size:14px; color:var(--text-primary);">Community Listing</strong>
          <span style="font-size:12px; color:var(--text-secondary);">This business has not yet completed verification.</span>
        </div>
      </div>
    `);
  }

  // 2. Member Since
  if (biz.createdAt) {
    const createdDate = new Date(biz.createdAt);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const formattedDate = `${months[createdDate.getMonth()]} ${createdDate.getFullYear()}`;
    items.push(`
      <div style="display:flex; align-items:center; gap:10px;">
        <i class="fa-solid fa-calendar-check" style="color:var(--accent); font-size:16px; width:18px; text-align:center;"></i>
        <div style="font-size:13px; color:var(--text-secondary);">
          Member since <strong>${formattedDate}</strong>
        </div>
      </div>
    `);
  }

  // 3. Last Updated
  if (biz.updatedAt) {
    const updatedDate = new Date(biz.updatedAt);
    const formattedUpdate = updatedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    items.push(`
      <div style="display:flex; align-items:center; gap:10px;">
        <i class="fa-solid fa-clock-rotate-left" style="color:var(--accent); font-size:16px; width:18px; text-align:center;"></i>
        <div style="font-size:13px; color:var(--text-secondary);">
          Last updated: <strong>${formattedUpdate}</strong>
        </div>
      </div>
    `);
  }

  // 4. Operating Hours Dropdown / Collapsible
  if (biz.operatingHours) {
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    const dayLabels = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
    const hours = biz.operatingHours || {};

    const status = computeOpenStatus(hours) || { isOpen: false, todayKey: null };
    const currentDayKey = status.todayKey;
    const openStatusLabel = status.isOpen
      ? `<span style="color: var(--success); font-weight:700;"><i class="fa-solid fa-circle-check"></i> Open Now</span>`
      : `<span style="color: var(--danger); font-weight:700;"><i class="fa-solid fa-circle-xmark"></i> Closed</span>`;

    const hoursListHTML = days.map(d => {
      const config = hours[d] || { closed: true };
      const hoursStr = config.closed ? '<span style="color:var(--danger)">Closed</span>' : `<strong>${config.open}</strong> - <strong>${config.close}</strong>`;
      const isToday = d === currentDayKey ? 'style="background: rgba(99,102,241,0.08); font-weight:700; border-radius:4px; padding:2px 6px;"' : '';
      return `<div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; padding:2px 0;" ${isToday}>
        <span style="text-transform: capitalize; color:var(--text-secondary);">${dayLabels[d]}</span>
        <span>${hoursStr}</span>
      </div>`;
    }).join('');

    items.push(`
      <div style="border-top: 1px solid var(--border); padding-top:12px; margin-top:4px;">
        <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="toggleHoursCollapse()">
          <span style="font-size:13px; color:var(--text-secondary); display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-business-time" style="color:var(--accent);"></i> Store Timing: ${openStatusLabel}
          </span>
          <i class="fa-solid fa-chevron-down" id="hours-chevron" style="color:var(--text-muted); font-size:12px; transition:transform 0.2s;"></i>
        </div>
        <div id="hours-collapsible-list" style="display:none; margin-top:12px; padding:10px; background:var(--bg-elevated); border:1px solid var(--border); border-radius:8px;">
          ${hoursListHTML}
        </div>
      </div>
    `);
  }

  // 5. Payment Methods, Languages, Service Areas
  const meta = biz.metaData || {};
  const subdetails = [];
  if (meta.paymentMethods?.length) {
    subdetails.push(`
      <div style="margin-bottom:8px;">
        <span style="font-size:10px; text-transform:uppercase; color:var(--text-muted); font-weight:700; display:block;">Payments Accepted</span>
        <span style="font-size:12px; color:var(--text-primary); font-weight:600;">${meta.paymentMethods.join(', ')}</span>
      </div>
    `);
  }
  if (meta.languages?.length) {
    subdetails.push(`
      <div style="margin-bottom:8px;">
        <span style="font-size:10px; text-transform:uppercase; color:var(--text-muted); font-weight:700; display:block;">Languages Spoken</span>
        <span style="font-size:12px; color:var(--text-primary); font-weight:600;">${meta.languages.join(', ')}</span>
      </div>
    `);
  }
  if (meta.serviceAreas?.length) {
    subdetails.push(`
      <div>
        <span style="font-size:10px; text-transform:uppercase; color:var(--text-muted); font-weight:700; display:block;">Service Areas</span>
        <span style="font-size:12px; color:var(--text-primary); font-weight:600;">${meta.serviceAreas.join(', ')}</span>
      </div>
    `);
  }

  if (subdetails.length > 0) {
    items.push(`
      <div style="border-top: 1px solid var(--border); padding-top:12px; margin-top:4px; display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:10px;">
        ${subdetails.join('')}
      </div>
    `);
  }

  container.innerHTML = items.join('');
}

window.toggleHoursCollapse = function() {
  const panel = document.getElementById('hours-collapsible-list');
  const chevron = document.getElementById('hours-chevron');
  if (panel && chevron) {
    if (panel.style.display === 'none') {
      panel.style.display = 'block';
      chevron.style.transform = 'rotate(180deg)';
    } else {
      panel.style.display = 'none';
      chevron.style.transform = 'rotate(0deg)';
    }
  }
};

function renderIdentitySection(biz) {
  const container = document.getElementById('sf-identity-card');
  if (!container) return;

  const meta = biz.metaData || {};
  
  const story = meta.description || meta.about || meta.bio || '';
  const highlights = meta.highlights || [];
  const specializations = meta.specialisations || meta.specializations || [];
  const whyChooseUs = meta.whyChooseUs || '';

  const items = [];

  if (story) {
    items.push(`
      <div style="margin-bottom: 20px;">
        <h3 style="font-size:16px; font-weight:700; color:var(--accent2); margin-bottom:8px;"><i class="fa-solid fa-book-open-reader"></i> Our Story</h3>
        <p style="font-size:14px; color:var(--text-secondary); line-height:1.6; text-align:justify;">${story}</p>
      </div>
    `);
  }

  if (whyChooseUs) {
    items.push(`
      <div style="margin-bottom: 20px;">
        <h3 style="font-size:16px; font-weight:700; color:var(--accent2); margin-bottom:8px;"><i class="fa-solid fa-award"></i> Why Choose Us</h3>
        <p style="font-size:14px; color:var(--text-secondary); line-height:1.6;">${whyChooseUs}</p>
      </div>
    `);
  }

  const listItems = [];
  if (highlights.length > 0) {
    listItems.push(`
      <div>
        <h4 style="font-size:12px; text-transform:uppercase; color:var(--text-muted); font-weight:700; margin-bottom:8px;">Business Highlights</h4>
        <ul style="list-style:none; padding-left:0; font-size:13px; color:var(--text-primary); display:grid; gap:6px;">
          ${highlights.map(h => `<li><i class="fa-solid fa-circle-check" style="color:var(--success); margin-right:6px;"></i> ${h}</li>`).join('')}
        </ul>
      </div>
    `);
  }

  if (specializations.length > 0) {
    listItems.push(`
      <div>
        <h4 style="font-size:12px; text-transform:uppercase; color:var(--text-muted); font-weight:700; margin-bottom:8px;">Areas of Speciality</h4>
        <ul style="list-style:none; padding-left:0; font-size:13px; color:var(--text-primary); display:grid; gap:6px;">
          ${specializations.map(s => `<li><i class="fa-solid fa-certificate" style="color:var(--accent); margin-right:6px;"></i> ${s}</li>`).join('')}
        </ul>
      </div>
    `);
  }

  if (listItems.length > 0) {
    items.push(`
      <div style="border-top:1px solid var(--border); padding-top:16px; display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:16px;">
        ${listItems.join('')}
      </div>
    `);
  }

  if (items.length > 0) {
    container.style.display = 'block';
    container.innerHTML = items.join('');
  } else {
    container.style.display = 'none';
  }
}

function setupShareButton(biz) {
  const shareBtn = document.getElementById('sf-btn-share');
  if (shareBtn) {
    shareBtn.onclick = () => {
      const storefrontUrl = `${window.location.origin}/s/${biz.slug}`;
      if (navigator.share) {
        navigator.share({
          title: biz.businessName,
          text: `Check out ${biz.businessName}'s digital profile storefront on NearByBazar!`,
          url: storefrontUrl
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(storefrontUrl).then(() => {
          showNotification('Storefront link copied to clipboard!', 'success');
        }).catch(() => {
          showNotification('Could not copy link.', 'warning');
        });
      }
    };
  }

  const directionsBtn = document.getElementById('sf-btn-directions');
  if (directionsBtn) {
    if (biz.latitude != null && biz.longitude != null) {
      directionsBtn.style.display = 'inline-flex';
      directionsBtn.href = `https://www.google.com/maps/search/?api=1&query=${biz.latitude},${biz.longitude}`;
    } else {
      directionsBtn.style.display = 'none';
    }
  }
}

// ─── HERO STATISTICS ──────────────────────────────────────────────────────────
// Reusable metric strip. Every metric is optional and self-hides when its
// underlying data is unavailable, so the row never shows empty slots.
function renderHeroStats(biz) {
  const row = document.getElementById('sf-hero-stats-row');
  if (!row) return;

  const meta = biz.metaData || {};
  const stats = [];

  // Serving Since
  if (biz.createdAt) {
    const yr = new Date(biz.createdAt).getFullYear();
    if (!Number.isNaN(yr)) stats.push({ icon: 'fa-calendar-check', label: 'Serving Since', value: yr });
  }

  // Open Now / Closed
  const openStatus = computeOpenStatus(biz.operatingHours);
  if (openStatus) {
    stats.push({
      icon: openStatus.isOpen ? 'fa-door-open' : 'fa-door-closed',
      label: 'Status',
      value: openStatus.isOpen ? 'Open Now' : 'Closed',
      color: openStatus.isOpen ? 'var(--success)' : 'var(--danger)',
    });
  }

  // Response Time (vendor-declared)
  if (meta.responseTime) {
    stats.push({ icon: 'fa-bolt', label: 'Responds', value: meta.responseTime });
  }

  // Photos Count (gallery only — excludes cover / docs)
  const photoCount = (biz.media || []).filter((m) => m.type !== 'cover' && m.type !== 'verification_doc').length;
  if (photoCount > 0) {
    stats.push({ icon: 'fa-images', label: 'Photos', value: photoCount });
  }

  // Customer Count (review count as a proxy, or vendor-declared)
  const customers = meta.customerCount || biz._count?.reviews || 0;
  if (customers) {
    stats.push({ icon: 'fa-users', label: 'Customers', value: `${customers}+` });
  }

  // Verification Status
  if (biz.idVerified) {
    stats.push({ icon: 'fa-circle-check', label: 'Verified', value: 'Yes', color: 'var(--success)' });
  }

  if (stats.length === 0) {
    row.style.display = 'none';
    return;
  }
  row.style.display = 'flex';
  row.innerHTML = stats.map((s) => `
    <div class="sf-hero-stat" style="display:flex; flex-direction:column; align-items:center; min-width:68px;">
      <i class="fa-solid ${s.icon}" style="font-size:16px; color:${s.color || 'var(--accent)'}; margin-bottom:6px;"></i>
      <span style="font-size:15px; font-weight:700; color:${s.color || 'var(--text-primary)'};">${s.value}</span>
      <span style="font-size:11px; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.3px;">${s.label}</span>
    </div>
  `).join('');
}

// ─── COVER BANNER ─────────────────────────────────────────────────────────────
function renderCover(biz) {
  const banner = document.getElementById('sf-cover-banner');
  const img = document.getElementById('sf-cover-img');
  if (!banner || !img) return;

  const coverMedia = (biz.media || []).find((m) => m.type === 'cover');
  const coverUrl = coverMedia?.secureUrl || biz.metaData?.coverImage || '';

  if (coverUrl) {
    // Graceful fallback: if the image 404s, hide the banner so the hero is clean.
    img.onerror = () => { banner.style.display = 'none'; };
    img.src = coverUrl;
    banner.style.display = 'block';
  } else {
    banner.style.display = 'none';
  }
}

// ─── OVERFLOW ("More") MENU ───────────────────────────────────────────────────
function setupOverflowMenu(biz) {
  const moreBtn = document.getElementById('sf-btn-more');
  const menu = document.getElementById('sf-more-menu');
  if (!moreBtn || !menu) return;

  const closeMenu = () => { menu.style.display = 'none'; };

  moreBtn.onclick = (e) => {
    e.stopPropagation();
    const isOpen = menu.style.display === 'block';
    menu.style.display = isOpen ? 'none' : 'block';
  };

  // Dismiss on outside click / Escape (keyboard + mobile friendly)
  document.addEventListener('click', (e) => {
    if (menu.style.display !== 'block') return;
    if (!menu.contains(e.target) && !moreBtn.contains(e.target)) closeMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  // QR item just closes the menu — the modal open is wired in setupQRCode.
  const qrItem = document.getElementById('sf-btn-show-qr-overflow');
  if (qrItem) qrItem.addEventListener('click', closeMenu);

  // Report item
  const reportBtn = document.getElementById('sf-btn-report-overflow');
  if (reportBtn) {
    reportBtn.onclick = () => {
      closeMenu();
      handleReport(biz);
    };
  }
}

function handleReport(biz) {
  const reason = window.prompt(`Report a problem with "${biz.businessName}". Briefly describe the issue:`);
  if (!reason) return;
  fetch(`${API_BASE}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'Report', message: `[Storefront Report — ${biz.slug}] ${reason}` }),
  })
    .then((r) => {
      if (!r.ok) throw new Error();
      showNotification('Thank you. Your report has been submitted.', 'success');
    })
    .catch(() => {
      // Fallback to email if the feedback endpoint is unavailable/anonymous-blocked.
      window.location.href = `mailto:support@nearbybazar.com?subject=${encodeURIComponent('Report: ' + biz.businessName)}&body=${encodeURIComponent(reason)}`;
    });
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
  // QR now lives inside the "More" overflow menu (Batch 3.5 action reorder).
  const showBtn = document.getElementById('sf-btn-show-qr-overflow');
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
    renderCover(biz);
    renderHeroStats(biz);
    renderActions(biz);
    renderInfoCard(biz);
    renderTags(biz);
    renderTrustSection(biz);
    renderIdentitySection(biz);
    setupLightboxGallery(biz);
    setupShareButton(biz);
    setupOverflowMenu(biz);
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
