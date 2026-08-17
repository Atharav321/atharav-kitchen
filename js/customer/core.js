/* ============================================================
   ATHARAV KITCHEN — CUSTOMER APP — core.js
   Global timers, loader, nav scroll, FAQ/mobile-menu, localStorage+toast+esc helpers, rate-limit/validation, Firebase bootstrap + kitchen-status/announcements/hero listeners
   Extracted from legacy app.js (lines 1-222) — v14 -> v15 modular split
   Load order matters: this file assumes files loaded before it in
   index.html (see js/customer/*.js <script> order) are already parsed.
   ============================================================ */
/* GMAPS_KEY: GPS se address detect karne ke liye (geocoding).
   SECURITY: Google Cloud Console mein HTTP referrer restriction lagao:
   atharav-kitchen.pages.dev/* ONLY allow karo
   Cloudflare: Pages → Settings → Environment Variables → GMAPS_KEY */
var GMAPS_KEY = window.__ENV_GMAPS_KEY || 'AIzaSyD7Vb4zFHfzsI79BbHjZTIi0s8Asxte6rI';
// SECURITY: Set window.__ENV_GMAPS_KEY before loading, or use build tool injection

// ═══════════════════════════════════════════════════════════════
//  CENTRAL CONFIG — Change here, applies everywhere
// ═══════════════════════════════════════════════════════════════
var AK_CONFIG = {
  ZOMATO_LINK: 'https://link.zomato.com/xqzv/rshare?id=8966837430563d60',
  SWIGGY_LINK: 'https://www.swiggy.com/search?query=Atharav+Kitchen+Dhanbad',
  WHATSAPP_NUMBER: '917903567007',
  PHONE_DISPLAY: '+91 79035 67007',
  PHONE_SECONDARY: '+91 98524 66996',
  TIMING: '11:00 AM – 3:00 AM',
  ADDRESS:
    '1st Floor, Shastri Nagar, Jain Mandir Road, Near Saroj Apartment, Bank More, Dhanbad, JH – 826001',
  FSSAI: '21124172000376',
  DELIVERY_CHARGE: 30,
  FREE_DELIVERY_MIN: 399,
  MAX_DELIVERY_KM: 5,
  KITCHEN_LAT: 23.7957,
  KITCHEN_LNG: 86.4304,
};
// ═══════════════════════════════════════════════════════════════

if (GMAPS_KEY === 'YOUR_GMAPS_KEY_HERE') {
  console.warn(
    '%c[AK Security] ⚠️ GMAPS_KEY placeholder. Set window.__ENV_GMAPS_KEY.',
    'color:#FF6B00;font-weight:bold;'
  );
}

function startDealTimer() {
  var now = new Date(),
    midnight = new Date(now);
  midnight.setHours(23, 59, 59, 0);
  function tick() {
    var diff = midnight - new Date();
    if (diff < 0) diff = 0;
    var h = Math.floor(diff / 3600000),
      m = Math.floor((diff % 3600000) / 60000),
      s = Math.floor((diff % 60000) / 1000);
    var p = function (n) {
      return String(n).padStart(2, '0');
    };
    var hEl = document.getElementById('dt-h'),
      mEl = document.getElementById('dt-m'),
      sEl = document.getElementById('dt-s');
    if (hEl) hEl.textContent = p(h);
    if (mEl) mEl.textContent = p(m);
    if (sEl) sEl.textContent = p(s);
  }
  tick();
  setInterval(tick, 1000);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startDealTimer);
} else {
  startDealTimer();
}

/* ================================================
   ATHARAV KITCHEN — MAIN SITE JS v4.0
   Customer Auth + Full Order System
   ================================================ */

// ---- LOADER ----
window.addEventListener('load', function () {
  setTimeout(function () {
    var l = document.getElementById('loader');
    if (l) l.classList.add('hide');
  }, 700);
  // Fallback: agar kuch bhi fail ho, 8 seconds mein loader force-hide
  setTimeout(function () {
    var l = document.getElementById('loader');
    if (l) l.classList.add('hide');
  }, 8000);
  // Kitchen closed notice for guests
  try {
    var s = JSON.parse(localStorage.getItem('ak_settings')) || {};
    var isOpen = s.orders !== false;
    var notice = document.getElementById('kitchen-closed-notice');
    var badge = document.querySelector('.hero-badge');
    if (notice) {
      notice.style.display = isOpen ? 'none' : 'flex';
    }
    if (badge) {
      badge.style.display = isOpen ? '' : 'none';
    }
  } catch (e) {}
});

// ---- NAV ----
window.addEventListener('scroll', function () {
  var nb = document.getElementById('navbar');
  if (nb) nb.classList.toggle('scrolled', window.scrollY > 40);
});
function goTo(id) {
  var el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

/* ================================================
   ★ FAQ ACCORDION
   ================================================ */
function toggleFaq(btn) {
  var ans = btn.nextElementSibling;
  var isOpen = ans.style.display === 'block';
  // Close all
  document.querySelectorAll('.faq-a').forEach(function (a) {
    a.style.display = 'none';
  });
  document.querySelectorAll('.faq-q').forEach(function (b) {
    b.classList.remove('open');
  });
  if (!isOpen) {
    ans.style.display = 'block';
    btn.classList.add('open');
  }
}

function toggleMob() {
  document.getElementById('mob-menu').classList.toggle('open');
}
function closeMob() {
  document.getElementById('mob-menu').classList.remove('open');
}

// ---- HELPERS ----
function lsGet(k, def) {
  try {
    var v = JSON.parse(localStorage.getItem(k));
    return v != null ? v : def;
  } catch {
    return def;
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
}
function showToast(msg, cls) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = cls || '';
  t.classList.add('show');
  setTimeout(function () {
    t.classList.remove('show');
  }, 3200);
}
// SECURITY FIX: Enhanced HTML escape — quotes bhi escape hoti hain (XSS boundary layer 1)
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// SECURITY: Rate limiter — brute force / spam protection (boundary layer 2)
var _akRateLimits = {};
function akRateLimit(key, maxCalls, windowMs) {
  var now = Date.now();
  if (!_akRateLimits[key]) _akRateLimits[key] = [];
  _akRateLimits[key] = _akRateLimits[key].filter(function (t) {
    return now - t < windowMs;
  });
  if (_akRateLimits[key].length >= maxCalls) return false;
  _akRateLimits[key].push(now);
  return true;
}

// SECURITY: Session token — CSRF-like protection for sensitive actions (boundary layer 3)
var _akSessionToken = (function () {
  var t = sessionStorage.getItem('_ak_st');
  if (!t) {
    t = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    sessionStorage.setItem('_ak_st', t);
  }
  return t;
})();
function akVerifySession(token) {
  return token === _akSessionToken;
}

// SECURITY: Input sanitizer — phone, name, address strict validation (boundary layer 4)
function akValidatePhone(p) {
  return /^[6-9]\d{9}$/.test(String(p || '').trim());
}
function akValidateName(n) {
  var s = String(n || '').trim();
  return s.length > 0 && s.length < 100 && /^[a-zA-Z0-9 \u0900-\u097F',.\-]+$/.test(s);
}
function akValidateAddress(a) {
  var s = String(a || '').trim();
  return s.length > 5 && s.length < 300;
}

/* ---- Firebase (keys: firebase-config.js) ---- */
var firebaseConfig = window.FIREBASE_CONFIG || {};
var akFirebaseReady = false;

// FIX: Sync with firebase-config.js akFirebaseReady event
window.addEventListener('akFirebaseReady', function () {
  if (!akFirebaseReady) {
    akFirebaseReady = true;
    tryInitFirebase();
    try {
      checkAuthOnLoad();
    } catch (e) {}
    try {
      ensureGuestAuthSession();
    } catch (e) {}
    try {
      startMenuFirebaseSync();
    } catch (e) {}
    try {
      resyncPendingOrders();
    } catch (e) {}
    try {
      ensureKitchenStatusListener();
    } catch (e) {}
  }
});

var SHOP_LAT = 23.7957,
  SHOP_LNG = 86.4304,
  MAX_DELIVERY_KM = 5;
// withinDeliveryRadius: true = confirmed within 5km, false = CONFIRMED outside 5km
// (real GPS coords measured — hard block), null = unknown/unverified (GPS denied or
// unavailable — do NOT hard block, we simply couldn't verify).
var withinDeliveryRadius = null,
  deliveryRadiusChecked = false;

function tryInitFirebase() {
  try {
    if (!firebase || !window.isAkFirebaseConfigured || !window.isAkFirebaseConfigured()) {
      return;
    }
    firebaseConfig = window.FIREBASE_CONFIG;
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    akFirebaseReady = true;
    try {
      ensureKitchenStatusListener();
    } catch (e) {}
  } catch (e) {
    console.warn('Firebase init failed', e);
  }
}
// NOTE: tryInitFirebase() is NOT called here directly anymore.
// Firebase compat scripts load asynchronously (see firebase-config.js) —
// calling tryInitFirebase() at parse time referenced the global `firebase`
// before it existed, throwing "ReferenceError: firebase is not defined"
// on every page load. The akFirebaseReady listener above (line ~217)
// already calls tryInitFirebase() at the correct time, once Firebase is
// actually loaded.

// ═══════════════════════════════════════════════════════════════
//  LIVE KITCHEN STATUS — synced from Firestore settings/store doc,
//  written by admin.html saveSettings()/toggleKitchenStatus(). Replaces
//  the localStorage-only 'ak_settings' check, which never crossed
//  devices/browsers (admin toggling Offline on their phone never
//  reached a customer's browser on a different device).
// ═══════════════════════════════════════════════════════════════
var akKitchenOpen = true; // optimistic default until first snapshot arrives
var akKitchenStatusUnsub = null;
function ensureKitchenStatusListener() {
  if (!akFirebaseReady || !firebase || !firebase.firestore) return;
  if (akKitchenStatusUnsub) return; // already listening
  akKitchenStatusUnsub = subscribeKitchenStatus(
    function (snap) {
      var d = snap.exists ? snap.data() : {};
      akKitchenOpen = d.orders !== false;
      // Keep localStorage cache for the offline-notice-on-load path too
      var s = JSON.parse(localStorage.getItem('ak_settings') || '{}') || {};
      s.orders = akKitchenOpen;
      localStorage.setItem('ak_settings', JSON.stringify(s));
      var notice = document.getElementById('kitchen-closed-notice');
      var badge = document.querySelector('.hero-badge');
      if (notice) {
        notice.style.display = akKitchenOpen ? 'none' : 'flex';
      }
      if (badge) {
        badge.style.display = akKitchenOpen ? '' : 'none';
      }
      try {
        updateCheckoutLockUI();
      } catch (e) {}
    },
    function (err) {
      console.warn(
        '[Atharav Kitchen] Kitchen status sync error — falling back to cached/localStorage value.',
        err
      );
    }
  );
}

function ensureAnnouncementsListener() {
  if (!akFirebaseReady || !firebase || !firebase.firestore) return;
  subscribeAnnouncements(
    function (snap) {
      var d = snap.exists ? snap.data() : {};
      renderAnnouncementBanners(d.banners || []);
      if (d.topbar && d.topbar.trim()) {
        var scroll = document.getElementById('topbar-scroll');
        if (scroll) scroll.innerHTML = '<span>' + esc(d.topbar) + '</span>';
      }
    },
    function (err) {
      console.warn('[Atharav Kitchen] Announcements sync error:', err);
    }
  );
}
function renderAnnouncementBanners(banners) {
  var wrap = document.getElementById('announcement-banners');
  if (!wrap) return;
  var colorMap = {
    forest: 'linear-gradient(135deg,#1B4332,#2D6A4F)',
    saffron: 'linear-gradient(135deg,#FF6B00,#FF8C00)',
    red: 'linear-gradient(135deg,#E23744,#a0222e)',
    dark: 'linear-gradient(135deg,#2D1A00,#5C3A1E)',
  };
  if (!banners.length) {
    wrap.innerHTML = '';
    return;
  }
  wrap.innerHTML = banners
    .map(function (b) {
      return (
        '<div style="background:' +
        (colorMap[b.color] || colorMap.forest) +
        ';color:#fff;padding:0.7rem 1rem;text-align:center;font-weight:700;font-size:0.85rem;">' +
        esc(b.text) +
        '</div>'
      );
    })
    .join('');
}
window.addEventListener('akFirebaseReady', ensureAnnouncementsListener);

// ═══════════════════════════════════════════════════════════════
//  LIVE HERO CONTENT — synced from Firestore settings/hero doc,
//  written by admin.html saveHeroSettings(). Previously the admin's
//  headline/tagline/description fields only saved to the admin's own
//  browser localStorage and never reached the live customer site —
//  this fixes that using the same pattern as ensureAnnouncementsListener.
// ═══════════════════════════════════════════════════════════════
function ensureHeroContentListener() {
  if (!akFirebaseReady || !firebase || !firebase.firestore) return;
  subscribeHeroContent(
    function (snap) {
      var d = snap.exists ? snap.data() : {};
      var l1 = document.getElementById('hero-l1-text');
      var l2 = document.getElementById('hero-l2-text');
      var l3 = document.getElementById('hero-l3-text');
      var tag = document.getElementById('hero-tag-text');
      var desc = document.getElementById('hero-desc-text');
      if (l1 && d.l1) l1.textContent = d.l1;
      if (l2 && d.l2) l2.textContent = d.l2;
      if (l3 && d.l3) l3.textContent = d.l3;
      if (tag && d.tag) tag.textContent = d.tag;
      if (desc && d.desc) desc.textContent = d.desc;
    },
    function (err) {
      console.warn('[Atharav Kitchen] Hero content sync error:', err);
    }
  );
}
window.addEventListener('akFirebaseReady', ensureHeroContentListener);
