/* ============================================================
   ATHARAV KITCHEN — ADMIN PANEL
   Extracted from legacy admin.html inline <script> (lines 1085-3469)
   ============================================================ */
// ===== DATA KEYS =====
const KEYS = {
  auth: 'ak_admin_auth',
  pass: 'ak_admin_pass',
  menu: 'ak_menu',
  offers: 'ak_offers',
  banners: 'ak_banners',
  feedback: 'ak_feedback',
  settings: 'ak_settings',
  hero: 'ak_hero',
  ticker: 'ak_ticker',
  orders: 'ak_orders',
  riders: 'ak_riders',
  promo_video: 'ak_promo_video',
};

var firebaseConfig = window.FIREBASE_CONFIG || {};
var akFirebaseReady = false;
var firebaseOrdersUnsub = null;

function tryInitFirebaseAdmin() {
  try {
    if (!firebase || !window.isAkFirebaseConfigured || !window.isAkFirebaseConfigured()) return;
    firebaseConfig = window.FIREBASE_CONFIG;
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    akFirebaseReady = true;
    window.akStorage = firebase.storage();
  } catch (e) {
    console.warn('Firebase init failed', e);
  }
}
// NOTE: tryInitFirebaseAdmin() is NOT called eagerly here anymore — Firebase
// compat scripts load asynchronously (see firebase-config.js), so calling it
// at parse time referenced the global `firebase` before it existed, throwing
// "ReferenceError: firebase is not defined" on every admin.html load. The
// akFirebaseReady listener below already calls it once Firebase is ready.
window.addEventListener('akFirebaseReady', function () {
  if (!akFirebaseReady) tryInitFirebaseAdmin();
});

function startFirebaseOrdersListener() {
  if (!akFirebaseReady) return;
  if (firebaseOrdersUnsub) {
    firebaseOrdersUnsub();
    firebaseOrdersUnsub = null;
  }
  var q = firebase.firestore().collection('orders').limit(300);
  firebaseOrdersUnsub = q.onSnapshot(
    function (snap) {
      var orders = snap.docs.map(function (d) {
        var x = d.data() || {};
        if (!x.id) x.id = d.id;
        return x;
      });
      orders.sort(function (a, b) {
        return (b.createdAtMs || 0) - (a.createdAtMs || 0);
      });
      set(KEYS.orders, orders);
      renderOrdersTable();
      updateBadges();
      renderDashboard();
      renderDeliveries();
      checkForNewOrders();
    },
    function (err) {
      toast('Firestore orders sync error: ' + err.message, 'err');
    }
  );
}

var firebaseMenuUnsub = null;
function startFirebaseMenuListener() {
  if (!akFirebaseReady) return;
  if (firebaseMenuUnsub) {
    firebaseMenuUnsub();
    firebaseMenuUnsub = null;
  }
  var q = firebase.firestore().collection('menu');
  firebaseMenuUnsub = q.onSnapshot(
    function (snap) {
      var items = snap.docs.map(function (d) {
        var x = d.data() || {};
        if (x.id == null) x.id = d.id;
        return x;
      });
      if (!items.length && !akMenuSeeded) {
        akMenuSeeded = true;
        seedDefaultMenuToFirebase();
        return; // seed will trigger a fresh snapshot
      }
      set(KEYS.menu, items);
      renderMenuTable();
      renderDashboard();
    },
    function (err) {
      toast('Firestore menu sync error: ' + err.message, 'err');
    }
  );
}
var akMenuSeeded = false;
function seedDefaultMenuToFirebase() {
  if (!akFirebaseReady) return;
  var batch = firebase.firestore().batch();
  DEFAULT_MENU.forEach(function (item) {
    batch.set(firebase.firestore().collection('menu').doc(String(item.id)), item);
  });
  batch.commit().catch(function (e) {
    console.warn('Menu seed failed', e);
  });
}

// ===== DEFAULT DATA =====
const DEFAULT_MENU = [
  {
    id: 1,
    name: 'Peri Peri Burger',
    cat: 'Indo-Western',
    price: 120,
    desc: 'Crispy patty with spicy peri-peri sauce',
    veg: false,
    emoji: '🍔',
    imgData: '',
    available: true,
  },
  {
    id: 2,
    name: 'Veg Grilled Sandwich',
    cat: 'Indo-Western',
    price: 80,
    desc: 'Fresh veggies grilled to perfection',
    veg: true,
    emoji: '🥪',
    imgData: '',
    available: true,
  },
  {
    id: 3,
    name: 'Chicken Wrap',
    cat: 'Indo-Western',
    price: 130,
    desc: 'Tender chicken tikka wrapped in soft roti',
    veg: false,
    emoji: '🌯',
    imgData: '',
    available: true,
  },
  {
    id: 4,
    name: 'Masala Fries',
    cat: 'Indo-Western',
    price: 70,
    desc: 'Crispy golden fries in special masala',
    veg: true,
    emoji: '🍟',
    imgData: '',
    available: true,
  },
  {
    id: 5,
    name: 'Veg Hakka Noodles',
    cat: 'Chinese',
    price: 100,
    desc: 'Classic stir-fried noodles',
    veg: true,
    emoji: '🍜',
    imgData: '',
    available: true,
  },
  {
    id: 6,
    name: 'Chicken Fried Rice',
    cat: 'Chinese',
    price: 130,
    desc: 'Wok-tossed rice with chicken & eggs',
    veg: false,
    emoji: '🍛',
    imgData: '',
    available: true,
  },
  {
    id: 7,
    name: 'Chilli Chicken',
    cat: 'Chinese',
    price: 160,
    desc: 'Crispy chicken in spicy chilli sauce',
    veg: false,
    emoji: '🌶️',
    imgData: '',
    available: true,
  },
  {
    id: 8,
    name: 'Veg Momos (8 pcs)',
    cat: 'Chinese',
    price: 80,
    desc: 'Steamed dumplings',
    veg: true,
    emoji: '🥟',
    imgData: '',
    available: true,
  },
  {
    id: 9,
    name: 'Butter Chicken',
    cat: 'Indian',
    price: 180,
    desc: 'Rich creamy tomato-butter gravy',
    veg: false,
    emoji: '🍗',
    imgData: '',
    available: true,
  },
  {
    id: 10,
    name: 'Dal Makhani',
    cat: 'Indian',
    price: 140,
    desc: 'Slow-cooked black lentils',
    veg: true,
    emoji: '🫘',
    imgData: '',
    available: true,
  },
  {
    id: 11,
    name: 'Paneer Butter Masala',
    cat: 'Indian',
    price: 160,
    desc: 'Soft paneer in aromatic sauce',
    veg: true,
    emoji: '🧀',
    imgData: '',
    available: true,
  },
  {
    id: 12,
    name: 'Mango Lassi',
    cat: 'Drinks',
    price: 60,
    desc: 'Thick creamy mango yogurt drink',
    veg: true,
    emoji: '🥭',
    imgData: '',
    available: true,
  },
  {
    id: 13,
    name: 'Masala Chai',
    cat: 'Drinks',
    price: 30,
    desc: 'Traditional spiced Indian tea',
    veg: true,
    emoji: '☕',
    imgData: '',
    available: true,
  },
];
const DEFAULT_OFFERS = [
  {
    id: 1,
    title: 'Welcome Offer',
    code: 'WELCOME20',
    disc: '20% OFF',
    min: 200,
    color: 'red',
    desc: 'New customer? 20% off first order.',
    active: true,
  },
  {
    id: 2,
    title: 'Free Delivery',
    code: 'FREEDEL',
    disc: 'FREE DELIVERY',
    min: 399,
    color: 'orange',
    desc: 'Order above ₹399 — free delivery!',
    active: true,
  },
  {
    id: 3,
    title: 'WhatsApp Special',
    code: 'WA50',
    disc: '₹50 OFF',
    min: 300,
    color: 'green',
    desc: 'Order on WhatsApp and save ₹50!',
    active: true,
  },
  {
    id: 4,
    title: 'Weekend Special',
    code: 'WEEKEND',
    disc: 'BUY 2 GET 1',
    min: 0,
    color: 'forest',
    desc: 'Sat-Sun: Buy 2 mains, get 1 free drink!',
    active: true,
  },
];
const DEFAULT_SETTINGS = {
  name: 'Atharav Kitchen',
  tag: 'Taste That Travels Fast',
  ph1: '+91 79035 67007',
  ph2: '+91 98524 66996',
  email: 'shyamkumar98355@gmail.com',
  addr: '1st Floor, Shastri Nagar, Jain Mandir Road, Bank More, Dhanbad, JH – 826001',
  open: '11:00',
  close: '03:00',
  live: true,
  orders: true,
  topbar: true,
  wa: true,
  zomato: 'https://link.zomato.com/xqzv/rshare?id=8966837430563d60',
  swiggy: 'https://www.swiggy.com/search?query=Atharav+Kitchen+Dhanbad',
  whatsapp: '917903567007',
  fssai: '21124172000376',
  rating: '4.0',
  reviews: '134+',
  delcharge: 30,
  riderpay: 30,
  freethreshold: 399,
};

// ===== HELPERS =====
function get(k, def) {
  try {
    var v = JSON.parse(localStorage.getItem(k));
    return v != null ? v : def;
  } catch {
    return def;
  }
}
function set(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {
    toast('Storage full! Some data may not save.', 'err');
  }
}
function toast(msg, type) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = type || '';
  t.classList.add('show');
  setTimeout(function () {
    t.classList.remove('show');
  }, 3500);
}

// ===== AUTH — REAL FIREBASE AUTH LOGIN =====
var ADMIN_EMAIL = 'chotugupta7395@gmail.com';
var _loginAttempts = 0;
var _loginBlockedUntil = 0;

// Persist lockout across page refresh (anti-bypass)
(function () {
  try {
    var stored = JSON.parse(sessionStorage.getItem('ak_lockout') || 'null');
    if (stored && stored.until > Date.now()) {
      _loginBlockedUntil = stored.until;
      _loginAttempts = stored.attempts || 5;
    }
  } catch (e) {}
})();

async function _hashPass(p) {
  if (!p) return '';
  try {
    // SECURITY: Dynamic salt using timestamp + random — much harder to brute force
    var saltBase =
      sessionStorage.getItem('ak_salt_seed') ||
      Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem('ak_salt_seed', saltBase);
    var salt = 'AK_SALT_v2_' + saltBase + '_';
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + p));
    var hash = Array.from(new Uint8Array(buf))
      .map(function (b) {
        return b.toString(16).padStart(2, '0');
      })
      .join('');
    // Double hash for extra security
    var buf2 = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hash + salt));
    return Array.from(new Uint8Array(buf2))
      .map(function (b) {
        return b.toString(16).padStart(2, '0');
      })
      .join('');
  } catch (e) {
    return btoa('AK_v2_' + p);
  }
}

function doLogin() {
  var now = Date.now();
  if (_loginBlockedUntil > now) {
    var wait = Math.ceil((_loginBlockedUntil - now) / 1000);
    showLoginErr('Too many attempts. Try again in ' + wait + 's.');
    return;
  }
  var u = document.getElementById('l-user').value.trim();
  var p = document.getElementById('l-pass').value;
  if (!u || !p) {
    showLoginErr('Please enter username and password!');
    return;
  }
  if (!akFirebaseReady || !firebase.auth) {
    showLoginErr(
      'Firebase connect nahi ho paaya. Internet check karo, page refresh karo, phir try karo.'
    );
    return;
  }
  firebase
    .auth()
    .signInWithEmailAndPassword(ADMIN_EMAIL, p)
    .then(function () {
      _loginAttempts = 0;
      sessionStorage.removeItem('ak_lockout');
      logSecurityEvent('login_success', 'Admin login successful');
      // Store session with timestamp (expire after 8 hours)
      sessionStorage.setItem(
        'ak_admin_session',
        JSON.stringify({ ts: Date.now(), exp: Date.now() + 28800000 })
      );
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      initApp();
    })
    .catch(function (e) {
      // Show the REAL Firebase reason instead of always saying "wrong password" —
      // e.g. too-many-requests means Firebase itself has temporarily blocked this
      // account after repeated attempts, and no password will work until it clears.
      if (e.code === 'auth/too-many-requests') {
        logSecurityEvent('lockout', 'Firebase blocked account (too many attempts)');
        showLoginErr(
          'Firebase ne is account ko temporarily block kar diya hai (bahut zyada galat attempts). 15-30 min wait karo, ya Firebase Console se password reset karo.'
        );
        document.getElementById('l-pass').value = '';
        document.getElementById('l-pass').focus();
        return;
      }
      if (e.code === 'auth/user-disabled') {
        showLoginErr(
          'Ye account Firebase Console mein disable hai. Console mein jaake enable karo.'
        );
        document.getElementById('l-pass').value = '';
        document.getElementById('l-pass').focus();
        return;
      }
      if (e.code === 'auth/network-request-failed') {
        showLoginErr('Internet connection issue — check karo aur dobara try karo.');
        return;
      }
      _loginAttempts++;
      logSecurityEvent('login_fail', 'Wrong password attempt (' + e.code + ')');
      if (_loginAttempts >= 5) {
        _loginBlockedUntil = Date.now() + 300000; // 5 minute lockout
        sessionStorage.setItem(
          'ak_lockout',
          JSON.stringify({ until: _loginBlockedUntil, attempts: _loginAttempts })
        );
        showLoginErr('Too many failed attempts. Blocked for 5 minutes.');
      } else {
        showLoginErr(
          'Wrong password (' + e.code + '). (' + (5 - _loginAttempts) + ' attempts left)'
        );
      }
      document.getElementById('l-pass').value = '';
      document.getElementById('l-pass').focus();
    });
}
function showLoginErr(msg) {
  var e = document.getElementById('l-err');
  e.textContent = msg;
  e.style.display = 'block';
  setTimeout(function () {
    e.style.display = 'none';
  }, 5000);
}
function doLogout() {
  logSecurityEvent('logout', 'Admin logged out');
  sessionStorage.removeItem('ak_admin_session');
  sessionStorage.removeItem('ak_lockout');
  try {
    if (akFirebaseReady && firebase.auth) firebase.auth().signOut();
  } catch (e) {}
  location.reload();
}
// Auto-logout after 30 mins of inactivity
var _activityTimer;
function resetActivity() {
  clearTimeout(_activityTimer);
  _activityTimer = setTimeout(function () {
    var sess = JSON.parse(sessionStorage.getItem('ak_admin_session') || 'null');
    if (sess) {
      toast('Session expired due to inactivity. Logging out...', 'info');
      setTimeout(doLogout, 2000);
    }
  }, 1800000); // 30 minutes
}
['click', 'keydown', 'touchstart'].forEach(function (ev) {
  document.addEventListener(ev, resetActivity, { passive: true });
});
window.addEventListener('load', function () {
  localStorage.removeItem('ak_admin_auth'); // clear old insecure localStorage auth
  var sess;
  try {
    sess = JSON.parse(sessionStorage.getItem('ak_admin_session'));
  } catch (e) {
    sess = null;
  }
  if (!sess || sess.exp <= Date.now()) {
    resetActivity();
    return;
  }
  // Session timestamp valid — now confirm the REAL Firebase Auth session is also alive
  function waitForAuth() {
    if (!akFirebaseReady || !firebase.auth) {
      setTimeout(waitForAuth, 300);
      return;
    }
    firebase.auth().onAuthStateChanged(function (user) {
      if (user && user.email === ADMIN_EMAIL) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        initApp();
      } else {
        sessionStorage.removeItem('ak_admin_session');
        resetActivity();
      }
    });
  }
  waitForAuth();
});

// ===== APP INIT =====
function initApp() {
  if (document.getElementById('menu-search')) document.getElementById('menu-search').value = '';
  if (document.getElementById('menu-cat-filter'))
    document.getElementById('menu-cat-filter').value = '';
  startFirebaseOrdersListener();
  startFirebaseMenuListener();
  updateClock();
  setInterval(updateClock, 1000);
  setInterval(checkForNewOrders, 10000);
  var initSettings = get(KEYS.settings, DEFAULT_SETTINGS);
  updateKitchenStatusBtn(initSettings.orders !== false);
  startKitchenStatusListener();
  renderDashboard();
  renderMenuTable();
  renderOffersTable();
  renderBanners();
  renderFeedbackTable();
  loadSettings();
  loadHeroSettings();
  renderOrdersTable();
  renderRiders();
  renderDeliveries();
  updateBadges();
  processReferralClaims();
}
function updateClock() {
  var now = new Date();
  document.getElementById('tb-clock').textContent =
    now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) +
    ' | ' +
    now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ===== BADGES =====
function updateBadges() {
  var orders = get(KEYS.orders, []);
  var pending = orders.filter(function (o) {
    return o.status === 'New' || o.status === 'Confirmed';
  }).length;
  var pBadge = document.getElementById('pending-orders-badge');
  if (pBadge) {
    pBadge.textContent = pending;
    pBadge.style.display = pending > 0 ? 'inline-flex' : 'none';
  }

  var fb = get(KEYS.feedback, []);
  var fbSeen = get('ak_fb_seen', 0);
  var newFb = fb.length - fbSeen;
  var fbBadge = document.getElementById('new-fb-badge');
  if (fbBadge) {
    fbBadge.style.display = newFb > 0 ? 'inline-flex' : 'none';
  }
}

function checkForNewOrders() {
  updateBadges();
  var orders = get(KEYS.orders, []);
  var newCount = orders.filter(function (o) {
    return o.status === 'New';
  }).length;
  var lastSeen = get('ak_last_new_count', 0);
  if (newCount > lastSeen) {
    playOrderSound('new');
    set('ak_last_new_count', newCount);
  }
  if (newCount === 0) set('ak_last_new_count', 0);
}

// ===== SIDEBAR =====
function showPage(id, el) {
  document.querySelectorAll('.page').forEach(function (p) {
    p.classList.remove('active');
  });
  document.getElementById('page-' + id).classList.add('active');
  document.querySelectorAll('.sb-item').forEach(function (i) {
    i.classList.remove('active');
  });
  if (el) el.classList.add('active');
  else {
    document.querySelectorAll('.sb-item').forEach(function (i) {
      if (i.getAttribute('onclick') && i.getAttribute('onclick').includes("'" + id + "'"))
        i.classList.add('active');
    });
  }
  var titles = {
    dashboard: 'Dashboard & KPI',
    menu: 'Menu Items',
    offers: 'Offers & Coupons',
    banners: 'Announcements',
    feedback: 'Customer Feedback',
    settings: 'Site Settings',
    password: 'Change Password',
    orders: 'All Orders',
    riders: 'Riders & Tracking',
    wallet: 'Wallet & Points',
    marketing: 'Marketing',
    security: 'Security Center',
    reports: 'Reports & Analytics',
  };
  document.getElementById('page-title').textContent = titles[id] || id;
  closeSidebar();
  if (id === 'feedback') {
    set('ak_fb_seen', get(KEYS.feedback, []).length);
    updateBadges();
    renderFeedbackStats();
  }
  if (id === 'customers') {
    loadCustomerList();
  }
  if (id === 'riders') {
    renderRiders();
    renderDeliveries();
  }
  if (id === 'dashboard') {
    renderDashboard();
  }
  if (id === 'banners') {
    renderBanners();
    loadPromoVideoSettings();
  }
  if (id === 'wallet') {
    loadWalletLedger();
  }
  if (id === 'settings') {
    loadKitchenGalleryAdmin();
    var nw = document.getElementById('s-notify-worker-url');
    if (nw) nw.value = localStorage.getItem('ak_notify_worker_url') || '';
  }
  if (id === 'marketing') {
    populateMarketingItemSelect();
  }
  if (id === 'reports') {
    renderReportsPage();
  }
  if (id === 'security') {
    renderSecurityLog();
  }
}
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('mob-open');
  document.getElementById('mob-overlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('mob-open');
  document.getElementById('mob-overlay').classList.remove('show');
}

// ===== DASHBOARD / KPI =====
function renderDashboard() {
  var menu = get(KEYS.menu, DEFAULT_MENU);
  var offers = get(KEYS.offers, DEFAULT_OFFERS);
  var fb = get(KEYS.feedback, []);
  var orders = get(KEYS.orders, []);
  var riders = get(KEYS.riders, []);

  var delivered = orders.filter(function (o) {
    return o.status === 'Delivered';
  });
  var totalRev = delivered.reduce(function (s, o) {
    return s + (o.bill ? o.bill.total : 0);
  }, 0);
  var todayStr = new Date().toLocaleDateString('en-IN');
  var todayOrders = delivered.filter(function (o) {
    return (o.time || '').includes(todayStr) || (o.deliveredAt || '').includes(todayStr);
  });
  var todayRev = todayOrders.reduce(function (s, o) {
    return s + (o.bill ? o.bill.total : 0);
  }, 0);
  var avgFood = fb.length
    ? (
        fb.reduce(function (s, f) {
          return s + (f.food || 0);
        }, 0) / fb.length
      ).toFixed(1)
    : '—';
  var pendingOrders = orders.filter(function (o) {
    return o.status !== 'Delivered' && o.status !== 'Cancelled';
  }).length;

  // KPI cards
  document.getElementById('kpi-cards').innerHTML =
    kpiCard('📦', orders.length, 'Total Orders', '', '#2563EB') +
    kpiCard('✅', delivered.length, 'Delivered', '', 'var(--success)') +
    kpiCard('⏳', pendingOrders, 'Active Orders', '', 'var(--saffron)') +
    kpiCard('💰', '₹' + totalRev, 'Total Revenue', '', 'var(--forest)') +
    kpiCard('💰', '₹' + todayRev, 'Today Revenue', '', 'var(--saffron2)') +
    kpiCard('⭐', avgFood, 'Avg Food Rating', '', '#F59E0B') +
    kpiCard('💬', fb.length, 'Total Reviews', '', 'var(--mid-brown)') +
    kpiCard('🛵', riders.length, 'Delivery Riders', '', 'var(--forest2)') +
    kpiCard(
      '🍽️',
      menu.filter(function (m) {
        return m.available;
      }).length,
      'Available Items',
      '',
      'var(--text-mid)'
    ) +
    kpiCard(
      '🎁',
      offers.filter(function (o) {
        return o.active;
      }).length,
      'Active Offers',
      '',
      'var(--gold)'
    );

  // Platform breakdown
  var platCounts = { Zomato: 0, Swiggy: 0, WhatsApp: 0, Phone: 0 };
  var platRev = { Zomato: 0, Swiggy: 0, WhatsApp: 0, Phone: 0 };
  orders.forEach(function (o) {
    if (o.platform && platCounts[o.platform] !== undefined) {
      platCounts[o.platform]++;
      platRev[o.platform] += o.bill ? o.bill.total : 0;
    }
  });
  var totalOrd = orders.length || 1;
  var platIcons = { Zomato: '🔴', Swiggy: '🟠', WhatsApp: '🟢', Phone: '📞' };
  var platBarClass = { Zomato: 'z', Swiggy: 's', WhatsApp: 'w', Phone: 'p' };
  document.getElementById('platform-breakdown').innerHTML = [
    'Zomato',
    'Swiggy',
    'WhatsApp',
    'Phone',
  ]
    .map(function (p) {
      var pct = Math.round((platCounts[p] / totalOrd) * 100);
      return (
        '<div class="platform-row"><span class="plat-icon">' +
        platIcons[p] +
        '</span>' +
        '<span class="plat-name">' +
        p +
        '</span>' +
        '<div class="plat-bar-wrap"><div class="plat-bar ' +
        platBarClass[p] +
        '" style="width:' +
        pct +
        '%"></div></div>' +
        '<span class="plat-count">' +
        platCounts[p] +
        ' orders</span></div>'
      );
    })
    .join('');
  document.getElementById('platform-revenue').innerHTML = ['Zomato', 'Swiggy', 'WhatsApp', 'Phone']
    .map(function (p) {
      return (
        '<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.78rem;"><span style="color:var(--text-mid);font-weight:700;">' +
        platIcons[p] +
        ' ' +
        p +
        '</span><span style="font-weight:800;color:var(--saffron);">₹' +
        platRev[p] +
        '</span></div>'
      );
    })
    .join('');

  // Rating
  if (fb.length) {
    var avgF =
      fb.reduce(function (s, f) {
        return s + (f.food || 0);
      }, 0) / fb.length;
    var avgD =
      fb.reduce(function (s, f) {
        return s + (f.delivery || 0);
      }, 0) / fb.length;
    var avgV =
      fb.reduce(function (s, f) {
        return s + (f.value || 0);
      }, 0) / fb.length;
    document.getElementById('avg-rating-big').textContent = avgF.toFixed(1);
    document.getElementById('avg-stars-display').textContent =
      '★'.repeat(Math.round(avgF)) + '☆'.repeat(5 - Math.round(avgF));
    document.getElementById('total-reviews-display').textContent = fb.length + ' reviews total';
    document.getElementById('rating-bars').innerHTML =
      ratingBar('Food Quality', avgF) +
      ratingBar('Delivery Speed', avgD) +
      ratingBar('Value for Money', avgV);
  } else {
    document.getElementById('rating-bars').innerHTML =
      '<div style="color:var(--text-light);font-size:0.82rem;text-align:center;padding:1rem;">No reviews yet</div>';
  }

  // Top items from orders
  var itemCount = {};
  orders.forEach(function (o) {
    if (o.items) {
      if (typeof o.items === 'string') {
        o.items.split(',').forEach(function (i) {
          var nm = i.replace(/×\d+/, '').trim();
          if (nm) itemCount[nm] = (itemCount[nm] || 0) + 1;
        });
      } else {
        Object.keys(o.items).forEach(function (k) {
          itemCount[k] = (itemCount[k] || 0) + (o.items[k].qty || 1);
        });
      }
    }
  });
  var sorted = Object.entries(itemCount)
    .sort(function (a, b) {
      return b[1] - a[1];
    })
    .slice(0, 6);
  document.getElementById('top-items').innerHTML = sorted.length
    ? sorted
        .map(function (e, i) {
          var menuItem = get(KEYS.menu, DEFAULT_MENU).find(function (m) {
            return m.name === e[0];
          });
          var thumbSrc = menuItem ? menuItem.imgUrl || menuItem.imgData : '';
          var thumb = thumbSrc
            ? '<img src="' + thumbSrc + '" class="ti-thumb" alt="">'
            : '<span class="ti-emoji">' + esc(e[0].charAt(0).toUpperCase()) + '</span>';
          return (
            '<div class="top-item"><span class="ti-rank">#' +
            (i + 1) +
            '</span>' +
            thumb +
            '<span class="ti-name">' +
            e[0] +
            '</span><span class="ti-count">' +
            e[1] +
            ' orders</span></div>'
          );
        })
        .join('')
    : '<div style="color:var(--text-light);font-size:0.82rem;padding:1rem 0;">No order data yet.<br>Add orders to see top items.</div>';

  // Recent feedback
  var fbEl = document.getElementById('dash-feedback');
  if (!fb.length) {
    fbEl.innerHTML =
      '<div style="color:var(--text-light);font-size:0.83rem;padding:1rem 0;">No feedback yet.<br>Customers submit from your website.</div>';
    return;
  }
  var recent = fb.slice(-3).reverse();
  fbEl.innerHTML = recent
    .map(function (f) {
      return (
        '<div class="fb-item"><div class="fb-head"><span class="fb-name">' +
        esc(f.name) +
        '</span><span class="fb-stars">' +
        '★'.repeat(f.food || 0) +
        '</span></div><div class="fb-txt">' +
        (f.comment ? esc(f.comment) : '—') +
        '</div><div class="fb-meta"><span class="fb-plat-badge">' +
        esc(f.platform || '') +
        '</span><span>' +
        esc((f.date || f.createdAt || '').toString().substring(0, 20)) +
        '</span></div></div>'
      );
    })
    .join('');
}

function kpiCard(icon, num, lbl, trend, color) {
  return (
    '<div class="kpi-card"><div class="kpi-icon">' +
    icon +
    '</div><div class="kpi-num" style="color:' +
    color +
    '">' +
    num +
    '</div><div class="kpi-lbl">' +
    lbl +
    '</div>' +
    (trend ? '<div class="kpi-trend up">' + trend + '</div>' : '') +
    '</div>'
  );
}
function ratingBar(label, val) {
  return (
    '<div class="rating-row"><span class="rat-label">' +
    label.split(' ')[0] +
    '</span><div class="rat-bar-wrap"><div class="rat-bar" style="width:' +
    (val / 5) * 100 +
    '%"></div></div><span class="rat-val">' +
    val.toFixed(1) +
    '</span></div>'
  );
}
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
// SECURITY: Rate limiter for admin actions
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

// ===== ORDERS TABLE =====
function renderOrdersTable() {
  var orders = get(KEYS.orders, []).slice().reverse();
  var search = document.getElementById('order-search').value.toLowerCase();
  var statusF = document.getElementById('order-status-filter').value;
  var platF = document.getElementById('order-plat-filter').value;
  if (search)
    orders = orders.filter(function (o) {
      return (
        (o.name || '').toLowerCase().includes(search) || (o.id || '').toLowerCase().includes(search)
      );
    });
  if (statusF)
    orders = orders.filter(function (o) {
      return o.status === statusF;
    });
  if (platF)
    orders = orders.filter(function (o) {
      return o.platform === platF;
    });
  var tbody = document.getElementById('orders-tbody');
  if (!orders.length) {
    tbody.innerHTML =
      '<tr><td colspan="9" class="empty-row">No orders yet. Add some above!</td></tr>';
    return;
  }
  var statusBadgeMap = {
    New: 'badge-new',
    Confirmed: 'badge-new',
    Preparing: 'badge-cat',
    'Out for Delivery': 'badge-out',
    Delivered: 'badge-delivered',
    Cancelled: 'badge-nv',
  };
  tbody.innerHTML = orders
    .map(function (o) {
      var items = '';
      if (o.items) {
        if (typeof o.items === 'string') items = o.items.substring(0, 40) + '...';
        else items = Object.keys(o.items).slice(0, 2).join(', ');
      }
      return (
        '<tr>' +
        '<td><strong style="color:var(--saffron);">' +
        (o.id || '—') +
        '</strong></td>' +
        '<td><strong>' +
        esc(o.name || '—') +
        '</strong><br><span style="font-size:0.72rem;color:var(--text-light);">' +
        esc(o.phone || '') +
        '</span></td>' +
        '<td>' +
        esc(o.platform || '—') +
        '</td>' +
        '<td style="max-width:140px;font-size:0.76rem;">' +
        esc(items) +
        '</td>' +
        '<td><strong>₹' +
        (o.bill ? o.bill.total : o.total || '—') +
        '</strong></td>' +
        '<td><span class="badge ' +
        (statusBadgeMap[esc(o.status)] || 'badge-off') +
        '">' +
        esc(o.status || '—') +
        '</span></td>' +
        '<td style="font-size:0.76rem;">' +
        esc(o.deliveredBy || '—') +
        '</td>' +
        '<td style="font-size:0.72rem;white-space:nowrap;">' +
        esc((o.time || o.createdAt || '—').toString().substring(0, 25)) +
        '</td>' +
        '<td><div class="td-actions">' +
        '<button class="btn btn-secondary btn-sm" onclick="editOrder(\'' +
        o.id +
        '\')">✏️</button>' +
        '<button class="btn btn-danger btn-sm" onclick="deleteOrder(\'' +
        o.id +
        '\')">🗑️</button>' +
        '<div class="quick-status-wrap">' +
        (o.status === 'New'
          ? '<button class="qs-btn qs-accept" onclick="quickStatus(\'' +
            o.id +
            '\',\'Confirmed\')" title="Confirm">✅</button><button class="qs-btn qs-reject" onclick="rejectOrder(\'' +
            o.id +
            '\')" title="Reject">❌</button>'
          : '') +
        (o.status === 'Confirmed'
          ? '<button class="qs-btn qs-prep" onclick="quickStatus(\'' +
            o.id +
            '\',\'Preparing\')" title="Start Preparing">👨‍🍳 Prep</button>'
          : '') +
        (o.status === 'Preparing'
          ? '<button class="qs-btn qs-out" onclick="quickStatus(\'' +
            o.id +
            '\',\'Out for Delivery\')" title="Out for Delivery">🛵 Dispatch</button>'
          : '') +
        (o.status === 'Out for Delivery'
          ? '<button class="qs-btn qs-done" onclick="quickStatus(\'' +
            o.id +
            '\',\'Delivered\')" title="Mark Delivered">🎉 Done</button>'
          : '') +
        '</div>' +
        '</div></td>' +
        '</tr>'
      );
    })
    .join('');
}

function openAddOrderModal() {
  document.getElementById('ord-id').value = '';
  document.getElementById('ord-name').value = '';
  document.getElementById('ord-phone').value = '';
  document.getElementById('ord-address').value = '';
  document.getElementById('ord-items').value = '';
  document.getElementById('ord-total').value = '';
  document.getElementById('ord-status').value = 'New';
  document.getElementById('ord-platform').value = 'WhatsApp';
  document.getElementById('ord-payment').value = 'cod';
  // Populate rider select
  var riderSel = document.getElementById('ord-rider');
  riderSel.innerHTML = '<option value="">— Unassigned —</option>';
  get(KEYS.riders, []).forEach(function (r) {
    riderSel.innerHTML += '<option value="' + esc(r.name) + '">' + esc(r.name) + '</option>';
  });
  document.getElementById('order-modal').classList.add('open');
}
function editOrder(id) {
  var orders = get(KEYS.orders, []);
  var o = orders.find(function (x) {
    return x.id === id;
  });
  if (!o) return;
  openAddOrderModal();
  document.getElementById('ord-id').value = id;
  document.getElementById('ord-name').value = o.name || '';
  document.getElementById('ord-phone').value = o.phone || '';
  document.getElementById('ord-address').value = o.address || '';
  document.getElementById('ord-total').value = o.bill ? o.bill.total : o.total || '';
  document.getElementById('ord-status').value = o.status || 'New';
  document.getElementById('ord-platform').value = o.platform || 'WhatsApp';
  document.getElementById('ord-payment').value = o.payment || 'cod';
  if (o.deliveredBy) document.getElementById('ord-rider').value = o.deliveredBy;
  if (o.items) {
    if (typeof o.items === 'string') document.getElementById('ord-items').value = o.items;
    else
      document.getElementById('ord-items').value = Object.entries(o.items)
        .map(function (e) {
          return e[0] + ' ×' + (e[1].qty || 1);
        })
        .join(', ');
  }
}
function saveOrder() {
  var name = document.getElementById('ord-name').value.trim();
  if (!name) {
    toast('Customer name required', 'err');
    return;
  }
  var editId = document.getElementById('ord-id').value;
  var orders = get(KEYS.orders, []);
  var newId = editId || 'ORD' + Date.now();
  var status = document.getElementById('ord-status').value;
  var riderName = document.getElementById('ord-rider').value;
  var itemsStr = document.getElementById('ord-items').value.trim();
  // Parse items into object
  var itemsObj = {};
  if (itemsStr) {
    itemsStr.split(',').forEach(function (i) {
      var m = i.trim().match(/^(.+?)(?:\s*[×x]\s*(\d+))?$/);
      if (m) {
        var nm = m[1].trim();
        itemsObj[nm] = { qty: parseInt(m[2]) || 1 };
      }
    });
  }
  var o = {
    id: newId,
    name: name,
    phone: document.getElementById('ord-phone').value.trim(),
    address: document.getElementById('ord-address').value.trim(),
    platform: document.getElementById('ord-platform').value,
    payment: document.getElementById('ord-payment').value,
    items: itemsObj,
    bill: { total: parseInt(document.getElementById('ord-total').value) || 0 },
    status: status,
    time: new Date().toLocaleTimeString('en-IN'),
  };
  if (riderName) {
    o.deliveredBy = riderName;
    var riderObj = get(KEYS.riders, []).find(function (r) {
      return r.name === riderName;
    });
    if (riderObj && riderObj.phone) o.riderPhone = riderObj.phone;
  }
  if (status === 'Delivered' && !o.deliveredAt) {
    o.deliveredAt = new Date().toLocaleTimeString('en-IN');
  }
  if (!o.createdAtMs) o.createdAtMs = Date.now();
  if (editId) {
    var idx = orders.findIndex(function (x) {
      return x.id === editId;
    });
    if (idx > -1) orders[idx] = o;
    else orders.push(o);
  } else orders.push(o);

  function finishSave() {
    set(KEYS.orders, orders);
    closeModal('order-modal');
    renderOrdersTable();
    renderDashboard();
    renderDeliveries();
    updateBadges();
    toast('Order saved!', 'ok');
  }

  if (akFirebaseReady) {
    firebase
      .firestore()
      .collection('orders')
      .doc(o.id)
      .set(o, { merge: true })
      .then(finishSave)
      .catch(function (e) {
        toast('Firestore: ' + e.message, 'err');
      });
  } else {
    finishSave();
  }
}
function deleteOrder(id) {
  if (!confirm('Delete this order?')) return;
  function after() {
    renderOrdersTable();
    renderDashboard();
    toast('Order deleted', 'ok');
  }
  if (akFirebaseReady) {
    firebase
      .firestore()
      .collection('orders')
      .doc(id)
      .delete()
      .then(function () {
        var rest = get(KEYS.orders, []).filter(function (o) {
          return o.id !== id;
        });
        set(KEYS.orders, rest);
        after();
      })
      .catch(function (e) {
        toast(e.message, 'err');
      });
  } else {
    set(
      KEYS.orders,
      get(KEYS.orders, []).filter(function (o) {
        return o.id !== id;
      })
    );
    after();
  }
}

// ===== RIDERS =====
function renderRiders() {
  var riders = get(KEYS.riders, []);
  var orders = get(KEYS.orders, []);
  var el = document.getElementById('riders-list');
  if (!riders.length) {
    el.innerHTML =
      '<div style="background:#fff;border-radius:16px;padding:2.5rem;border:2px dashed var(--border);text-align:center;color:var(--text-light);font-size:0.9rem;">No riders added yet.<br>Click "+ Add Rider" to add your delivery partners.</div>';
    return;
  }
  el.innerHTML = riders
    .map(function (r) {
      var myDeliveries = orders.filter(function (o) {
        return o.deliveredBy === r.name && o.status === 'Delivered';
      });
      var todayStr = new Date().toLocaleDateString('en-IN');
      var todayDel = myDeliveries.filter(function (o) {
        return (
          (o.deliveredAt || o.time || '').includes(todayStr) ||
          orders.some(function (x) {
            return x.id === o.id;
          })
        );
      }).length;
      var totalEarned = myDeliveries.length * (get(KEYS.settings, DEFAULT_SETTINGS).riderpay || 30);
      var totalAmt = myDeliveries.reduce(function (s, o) {
        return s + (o.bill ? o.bill.total : 0);
      }, 0);
      var isOnline = r.online || false;
      return (
        '<div class="rider-card">' +
        '<div class="rc-top">' +
        '<div class="rc-avatar">🛵</div>' +
        '<div>' +
        '<div class="rc-name">' +
        esc(r.name) +
        '</div>' +
        '<div class="rc-id">' +
        esc(r.vehicle || 'No vehicle') +
        '  ·  ' +
        esc(r.phone || '') +
        '</div>' +
        '</div>' +
        '<div class="rc-status">' +
        '<div class="rc-status-dot ' +
        (isOnline ? 'online' : 'offline') +
        '"></div>' +
        '<span style="color:' +
        (isOnline ? '#22C55E' : '#888') +
        '">' +
        (isOnline ? 'Online' : 'Offline') +
        '</span>' +
        '</div>' +
        '<div style="margin-left:1rem;display:flex;gap:6px;">' +
        '<button class="btn btn-danger btn-sm" onclick="deleteRider(\'' +
        r.id +
        '\')">🗑️</button>' +
        '</div>' +
        '</div>' +
        '<div class="rc-stats">' +
        '<div class="rc-stat"><div class="rc-stat-num">' +
        myDeliveries.length +
        '</div><div class="rc-stat-lbl">Total Delivered</div></div>' +
        '<div class="rc-stat"><div class="rc-stat-num">' +
        todayDel +
        '</div><div class="rc-stat-lbl">Today Delivered</div></div>' +
        '<div class="rc-stat"><div class="rc-stat-num">₹' +
        totalEarned +
        '</div><div class="rc-stat-lbl">Rider Earnings</div></div>' +
        '<div class="rc-stat"><div class="rc-stat-num">₹' +
        totalAmt +
        '</div><div class="rc-stat-lbl">Revenue Handled</div></div>' +
        '</div>' +
        (myDeliveries.length
          ? '<div class="rider-orders-wrap">' +
            '<h4>Last 5 Deliveries</h4>' +
            myDeliveries
              .slice(-5)
              .reverse()
              .map(function (o) {
                return (
                  '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:0.78rem;">' +
                  '<span style="color:var(--saffron);font-weight:700;">' +
                  o.id +
                  '</span>' +
                  '<span>' +
                  esc(o.name || '') +
                  '</span>' +
                  '<span style="color:var(--text-light);">' +
                  esc(o.address || '').substring(0, 25) +
                  '...</span>' +
                  '<span style="font-weight:800;">₹' +
                  (o.bill ? o.bill.total : '—') +
                  '</span>' +
                  '<span style="color:var(--success);">' +
                  esc(o.deliveredAt || o.time || '') +
                  '</span>' +
                  '</div>'
                );
              })
              .join('') +
            '</div>'
          : '') +
        '</div>'
      );
    })
    .join('');
}

function renderDeliveries() {
  var orders = get(KEYS.orders, []).filter(function (o) {
    return o.status === 'Delivered' || o.status === 'Out for Delivery';
  });
  orders = orders.slice().reverse();
  var tbody = document.getElementById('deliveries-tbody');
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No deliveries yet.</td></tr>';
    return;
  }
  tbody.innerHTML = orders
    .map(function (o) {
      return (
        '<tr>' +
        '<td><strong style="color:var(--saffron);">' +
        esc(o.id) +
        '</strong></td>' +
        '<td>' +
        esc(o.deliveredBy || '—') +
        '</td>' +
        '<td><strong>' +
        esc(o.name || '—') +
        '</strong></td>' +
        '<td style="max-width:150px;font-size:0.76rem;">' +
        esc((o.address || '').substring(0, 40)) +
        '</td>' +
        '<td><strong>₹' +
        (o.bill ? o.bill.total : '—') +
        '</strong></td>' +
        '<td>' +
        (o.payment === 'cod' ? '💵 COD' : '📱 UPI') +
        '</td>' +
        '<td><span class="badge ' +
        (o.status === 'Delivered' ? 'badge-delivered' : 'badge-out') +
        '">' +
        o.status +
        '</span></td>' +
        '<td style="white-space:nowrap;font-size:0.74rem;">' +
        esc(o.deliveredAt || o.time || '—') +
        '</td>' +
        '</tr>'
      );
    })
    .join('');
}

function openAddRiderModal() {
  document.getElementById('rm-id').value = '';
  document.getElementById('rm-name').value = '';
  document.getElementById('rm-phone').value = '';
  document.getElementById('rm-pin').value = '';
  document.getElementById('rm-vehicle').value = '';
  document.getElementById('rider-modal').classList.add('open');
}
function saveRider() {
  var name = document.getElementById('rm-name').value.trim();
  var pin = document.getElementById('rm-pin').value.trim();
  if (!name) {
    toast('Rider name required', 'err');
    return;
  }
  if (pin && pin.length !== 4) {
    toast('PIN must be exactly 4 digits', 'err');
    return;
  }
  var riders = get(KEYS.riders, []);
  var r = {
    id: Date.now(),
    name: name,
    phone: document.getElementById('rm-phone').value.trim(),
    pin: pin || '1234',
    vehicle: document.getElementById('rm-vehicle').value.trim(),
    online: false,
    joinedAt: new Date().toLocaleDateString('en-IN'),
  };
  riders.push(r);
  set(KEYS.riders, riders);
  closeModal('rider-modal');
  renderRiders();
  toast('Rider ' + name + ' added! They can login at rider.html', 'ok');
}
function deleteRider(id) {
  if (!confirm('Remove this rider?')) return;
  set(
    KEYS.riders,
    get(KEYS.riders, []).filter(function (r) {
      return r.id !== id;
    })
  );
  renderRiders();
  toast('Rider removed', 'ok');
}

// ===== MENU TABLE =====
const FOOD_EMOJIS = [
  '🍔',
  '🌯',
  '🥪',
  '🍜',
  '🍛',
  '🍗',
  '🥟',
  '🌶️',
  '🍲',
  '🫘',
  '🧀',
  '🫓',
  '🍟',
  '🥭',
  '☕',
  '🍋',
  '🍕',
  '🥗',
  '🍱',
  '🎂',
  '🧁',
  '🍰',
  '🥤',
  '🧃',
  '🍦',
  '🥞',
  '🍳',
  '🥘',
  '🍝',
  '🫔',
  '🌮',
  '🌭',
  '🥙',
  '🧆',
  '🥚',
  '🍤',
  '🦐',
  '🥩',
  '🍖',
  '🥓',
  '🧇',
  '🫕',
];

function renderMenuTable() {
  var items = get(KEYS.menu, DEFAULT_MENU);
  var search = (document.getElementById('menu-search').value || '').toLowerCase();
  var catF = document.getElementById('menu-cat-filter').value;
  if (search)
    items = items.filter(function (i) {
      return i.name.toLowerCase().includes(search) || i.cat.toLowerCase().includes(search);
    });
  if (catF)
    items = items.filter(function (i) {
      return i.cat === catF;
    });
  var tbody = document.getElementById('menu-tbody');
  if (!items.length) {
    var filterActive = search || catF;
    tbody.innerHTML = filterActive
      ? '<tr><td colspan="7" class="empty-row">Koi item search/filter se match nahi hua. <a href="#" onclick="document.getElementById(\'menu-search\').value=\'\';document.getElementById(\'menu-cat-filter\').value=\'\';renderMenuTable();return false;" style="color:#ea580c;font-weight:700;">🔄 Filters clear karo</a></td></tr>'
      : '<tr><td colspan="7" class="empty-row">No items found. Firestore se load ho raha hai, thoda wait karo ya "+ ADD ITEM" se naya item banao.</td></tr>';
    return;
  }
  tbody.innerHTML = items
    .map(function (item) {
      var imgHtml =
        item.imgUrl || item.imgData
          ? '<img src="' +
            (item.imgUrl || item.imgData) +
            '" class="menu-item-img" alt="' +
            esc(item.name) +
            '" loading="lazy">'
          : '<div class="menu-item-emoji" title="Photo missing" style="display:flex;align-items:center;justify-content:center;color:#DC2626;font-size:1.1rem;">📷</div>';
      return (
        '<tr>' +
        '<td>' +
        imgHtml +
        '</td>' +
        '<td><strong>' +
        esc(item.name) +
        '</strong></td>' +
        '<td><span class="badge badge-cat">' +
        item.cat +
        '</span></td>' +
        '<td><strong>₹' +
        item.price +
        '</strong></td>' +
        '<td><span class="badge ' +
        (item.veg ? 'badge-v' : 'badge-nv') +
        '">' +
        (item.veg ? 'Veg' : 'Non-Veg') +
        '</span></td>' +
        '<td><span class="badge ' +
        (item.available ? 'badge-active' : 'badge-off') +
        '">' +
        (item.available ? 'Yes' : 'Hidden') +
        '</span></td>' +
        '<td><div class="td-actions"><button class="btn btn-secondary btn-sm" onclick="editMenuItem(' +
        item.id +
        ')">✏️</button><button class="btn btn-danger btn-sm" onclick="deleteMenuItem(' +
        item.id +
        ')">🗑️</button></div></td>' +
        '</tr>'
      );
    })
    .join('');
}

// ===== IMAGE UPLOAD =====
function handleImgUpload(e) {
  var file = e.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    toast('Image too large! Max 5MB', 'err');
    return;
  }
  var reader = new FileReader();
  reader.onload = function (ev) {
    var img = new Image();
    img.onload = function () {
      // FIX 3: Compress to ~100KB max
      function compressToTarget(maxSizeKB) {
        var canvas = document.createElement('canvas');
        var MAX = 1200;
        var scale = Math.min(1, MAX / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        // Start with quality 0.8, reduce until under target
        var quality = 0.8;
        var base64 = canvas.toDataURL('image/jpeg', quality);
        var kb = Math.round((base64.length * 0.75) / 1024);
        // Iteratively reduce quality until under maxSizeKB
        while (kb > maxSizeKB && quality > 0.15) {
          quality = Math.round((quality - 0.05) * 100) / 100;
          base64 = canvas.toDataURL('image/jpeg', quality);
          kb = Math.round((base64.length * 0.75) / 1024);
        }
        // If still too large, scale down canvas further
        if (kb > maxSizeKB) {
          var newScale = Math.sqrt(maxSizeKB / kb) * scale;
          canvas.width = Math.round(img.width * newScale);
          canvas.height = Math.round(img.height * newScale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          base64 = canvas.toDataURL('image/jpeg', 0.65);
          kb = Math.round((base64.length * 0.75) / 1024);
        }
        return { base64: base64, kb: kb, canvas: canvas, quality: quality };
      }
      var result = compressToTarget(350);
      var base64 = result.base64;
      var canvas = result.canvas;
      // Try Firebase Storage first, fallback to base64
      if (window.akStorage) {
        canvas.toBlob(
          function (blob) {
            var path = 'menu-images/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.]/g, '_');
            var ref = window.akStorage.ref(path);
            toast('Uploading image...', '');
            // FIX 3: Ensure admin is authenticated before upload
            var currentAdmin = firebase.auth().currentUser;
            if (!currentAdmin) {
              // Admin not logged in to Firebase — use base64 fallback
              document.getElementById('mm-img-data').value = base64;
              document.getElementById('mm-img-url').value = '';
              var preview0 = document.getElementById('mm-img-preview');
              preview0.innerHTML =
                '<img src="' +
                base64 +
                '" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">';
              var st0 = document.getElementById('mm-img-status');
              if (st0)
                st0.innerHTML =
                  '<span style="color:#D97706;font-weight:800;">⚠️ Saved locally only.</span> Firebase login session expire ho gaya lagta hai — dubara login karo taaki photo cloud par (sab devices pe) save ho.';
              toast(
                'Image ready! (' + result.kb + 'KB) — Firebase login karo cloud upload ke liye',
                'ok'
              );
              return;
            }
            ref
              .put(blob, { contentType: 'image/jpeg' })
              .then(function (snap) {
                return snap.ref.getDownloadURL();
              })
              .then(function (url) {
                document.getElementById('mm-img-data').value = url;
                document.getElementById('mm-img-url').value = url;
                var preview = document.getElementById('mm-img-preview');
                preview.innerHTML =
                  '<img src="' +
                  url +
                  '" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">';
                var st1 = document.getElementById('mm-img-status');
                if (st1)
                  st1.innerHTML =
                    '<span style="color:#16A34A;font-weight:800;">✅ Photo cloud par upload ho gayi.</span>';
                toast('Image cloud par upload ho gaya! ✅', 'ok');
              })
              .catch(function (err) {
                console.warn('Storage upload failed:', err);
                // FIX 3: Better error messages
                var errMsg = 'Image save hua locally (' + result.kb + 'KB).';
                if (err.code === 'storage/unauthorized') {
                  errMsg =
                    'Storage permission denied! Firebase Console → Storage → Rules mein allow write karo. Tab tak local save ho gaya.';
                } else if (err.code === 'storage/canceled') {
                  errMsg = 'Upload cancel hua.';
                } else if (err.message && err.message.indexOf('CORS') > -1) {
                  errMsg = 'CORS error! Firebase Console → Storage → Rules check karo.';
                }
                document.getElementById('mm-img-data').value = base64;
                document.getElementById('mm-img-url').value = '';
                var preview = document.getElementById('mm-img-preview');
                preview.innerHTML =
                  '<img src="' +
                  base64 +
                  '" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">';
                var st2 = document.getElementById('mm-img-status');
                if (st2)
                  st2.innerHTML =
                    '<span style="color:#D97706;font-weight:800;">⚠️ Saved locally only (cloud upload failed).</span> ' +
                    esc(errMsg);
                toast(errMsg, 'ok');
              });
          },
          'image/jpeg',
          result.quality
        );
      } else {
        // No Firebase Storage — use compressed base64
        document.getElementById('mm-img-data').value = base64;
        document.getElementById('mm-img-url').value = '';
        var preview = document.getElementById('mm-img-preview');
        preview.innerHTML =
          '<img src="' +
          base64 +
          '" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">';
        var kb = result.kb;
        var st3 = document.getElementById('mm-img-status');
        if (st3)
          st3.innerHTML =
            '<span style="color:#16A34A;font-weight:800;">✅ Photo ready (' + kb + 'KB).</span>';
        toast('Image ready! ✅ (' + kb + 'KB compressed)', 'ok');
      }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}
// Drag & Drop
var dropZone = null;
window.addEventListener('DOMContentLoaded', function () {
  var dz = document.getElementById('img-drop-zone');
  if (!dz) return;
  dz.addEventListener('dragover', function (e) {
    e.preventDefault();
    dz.classList.add('drag-over');
  });
  dz.addEventListener('dragleave', function () {
    dz.classList.remove('drag-over');
  });
  dz.addEventListener('drop', function (e) {
    e.preventDefault();
    dz.classList.remove('drag-over');
    var file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      var fakeEvt = { target: { files: [file] } };
      handleImgUpload(fakeEvt);
    }
  });
});

function updateItemPreviewPlaceholder() {
  var preview = document.getElementById('mm-img-preview');
  if (!document.getElementById('mm-img-data').value) {
    var name = (document.getElementById('mm-name').value || '').trim();
    preview.style.fontSize = '1.6rem';
    preview.innerHTML = name
      ? '<span style="font-family:\'Playfair Display\',serif;font-weight:900;color:var(--saffron);font-size:1.8rem;">' +
        esc(name.charAt(0).toUpperCase()) +
        '</span>'
      : '📷';
  }
}

// ===== MENU MODAL =====
function openMenuModal(id) {
  document.getElementById('mm-img-data').value = '';
  document.getElementById('mm-img-url').value = '';
  if (id) {
    var item = get(KEYS.menu, DEFAULT_MENU).find(function (i) {
      return i.id === id;
    });
    if (!item) return;
    document.getElementById('mm-title').textContent = 'Edit Menu Item';
    document.getElementById('mm-id').value = id;
    document.getElementById('mm-name').value = item.name;
    document.getElementById('mm-price').value = item.price;
    document.getElementById('mm-cat').value = item.cat;
    document.getElementById('mm-desc').value = item.desc;
    document.getElementById('mm-veg').checked = item.veg;
    document.getElementById('mm-available').checked = item.available;
    var preview = document.getElementById('mm-img-preview');
    var displaySrc = item.imgUrl || item.imgData || '';
    var statusEl = document.getElementById('mm-img-status');
    if (displaySrc) {
      preview.innerHTML =
        '<img src="' +
        displaySrc +
        '" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">';
      document.getElementById('mm-img-data').value = displaySrc;
      if (item.imgUrl) document.getElementById('mm-img-url').value = item.imgUrl;
      if (statusEl)
        statusEl.innerHTML =
          '<span style="color:#16A34A;font-weight:800;">✅ Photo lagi hui hai.</span> Naya upload karke replace kar sakte ho.';
    } else {
      updateItemPreviewPlaceholder();
      if (statusEl)
        statusEl.innerHTML =
          '<span style="color:#DC2626;font-weight:800;">⚠️ Is item ki photo abhi tak nahi hai.</span> Customer ko yeh item bina photo ke dikhega — upload zaroor karo.';
    }
  } else {
    document.getElementById('mm-title').textContent = 'Add Menu Item';
    document.getElementById('mm-id').value = '';
    document.getElementById('mm-name').value = '';
    document.getElementById('mm-price').value = '';
    document.getElementById('mm-cat').value = 'Indo-Western';
    document.getElementById('mm-desc').value = '';
    document.getElementById('mm-veg').checked = false;
    document.getElementById('mm-available').checked = true;
    var preview2 = document.getElementById('mm-img-preview');
    preview2.style.fontSize = '1.6rem';
    preview2.innerHTML = '📷';
    var statusEl2 = document.getElementById('mm-img-status');
    if (statusEl2)
      statusEl2.textContent =
        'Koi photo nahi lagi hai abhi — customer ko is item ki asli photo dikhana zaroori hai.';
  }
  document.getElementById('menu-modal').classList.add('open');
}
function editMenuItem(id) {
  openMenuModal(id);
}
function saveMenuItem() {
  var name = document.getElementById('mm-name').value.trim();
  var price = parseInt(document.getElementById('mm-price').value) || 0;
  if (!name) {
    toast('Please enter item name', 'err');
    return;
  }
  if (!document.getElementById('mm-img-data').value) {
    toast('Is item ki real photo upload karo — bina photo ke save nahi hoga', 'err');
    return;
  }
  var editId = parseInt(document.getElementById('mm-id').value) || null;
  var id = editId || Date.now();
  var newItem = {
    id: id,
    name: name,
    cat: document.getElementById('mm-cat').value,
    price: price,
    desc: document.getElementById('mm-desc').value.trim(),
    emoji: '',
    imgData: document.getElementById('mm-img-data').value || '',
    imgUrl: document.getElementById('mm-img-url').value || '',
    veg: document.getElementById('mm-veg').checked,
    available: document.getElementById('mm-available').checked,
  };
  if (akFirebaseReady) {
    firebase
      .firestore()
      .collection('menu')
      .doc(String(id))
      .set(newItem, { merge: true })
      .then(function () {
        closeModal('menu-modal');
        toast(
          (editId ? 'Item updated!' : 'Item added! ✅') + ' — customer site pe live ho gaya',
          'ok'
        );
      })
      .catch(function (e) {
        toast('Save failed: ' + e.message, 'err');
      });
  } else {
    var items = get(KEYS.menu, DEFAULT_MENU);
    var idx = items.findIndex(function (i) {
      return i.id === id;
    });
    if (idx > -1) items[idx] = newItem;
    else items.push(newItem);
    set(KEYS.menu, items);
    closeModal('menu-modal');
    renderMenuTable();
    renderDashboard();
    toast(
      (editId ? 'Item updated!' : 'Item added! ✅') + ' (offline demo mode — sirf is browser mein)',
      'ok'
    );
  }
}
function deleteMenuItem(id) {
  if (!confirm('Delete this menu item?')) return;
  if (akFirebaseReady) {
    firebase
      .firestore()
      .collection('menu')
      .doc(String(id))
      .delete()
      .then(function () {
        toast('Item deleted — customer site pe bhi hat gaya', 'ok');
      })
      .catch(function (e) {
        toast('Delete failed: ' + e.message, 'err');
      });
  } else {
    set(
      KEYS.menu,
      get(KEYS.menu, DEFAULT_MENU).filter(function (i) {
        return i.id !== id;
      })
    );
    renderMenuTable();
    renderDashboard();
    toast('Item deleted', 'ok');
  }
}

// ===== OFFERS =====
function renderOffersTable() {
  var offers = get(KEYS.offers, DEFAULT_OFFERS);
  var colorMap = { red: '#E23744', orange: '#FF6B00', green: '#25D366', forest: '#1B4332' };
  var tbody = document.getElementById('offers-tbody');
  if (!offers.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No offers yet.</td></tr>';
    return;
  }
  tbody.innerHTML = offers
    .map(function (o) {
      return (
        '<tr>' +
        '<td><strong>' +
        esc(o.title) +
        '</strong><br><span style="font-size:0.75rem;color:var(--text-light);">' +
        esc(o.desc) +
        '</span></td>' +
        '<td><span style="background:' +
        colorMap[o.color] +
        ';color:#fff;padding:3px 10px;border-radius:6px;font-size:0.75rem;font-weight:800;">' +
        esc(o.code) +
        '</span></td>' +
        '<td><strong>' +
        esc(o.disc) +
        '</strong></td>' +
        '<td>₹' +
        o.min +
        '</td>' +
        '<td><span class="badge ' +
        (o.active ? 'badge-active' : 'badge-off') +
        '">' +
        (o.active ? 'Active' : 'Off') +
        '</span></td>' +
        '<td><div class="td-actions"><button class="btn btn-secondary btn-sm" onclick="editOffer(' +
        o.id +
        ')">✏️</button><button class="btn btn-danger btn-sm" onclick="deleteOffer(' +
        o.id +
        ')">🗑️</button></div></td>' +
        '</tr>'
      );
    })
    .join('');
}
function openOfferModal(id) {
  if (id) {
    var o = get(KEYS.offers, DEFAULT_OFFERS).find(function (x) {
      return x.id === id;
    });
    if (!o) return;
    document.getElementById('om-title').textContent = 'Edit Offer';
    document.getElementById('om-id').value = id;
    document.getElementById('om-title-inp').value = o.title;
    document.getElementById('om-code').value = o.code;
    document.getElementById('om-disc').value = o.disc;
    document.getElementById('om-min').value = o.min;
    document.getElementById('om-color').value = o.color;
    document.getElementById('om-desc').value = o.desc;
    document.getElementById('om-active').checked = o.active;
  } else {
    document.getElementById('om-title').textContent = 'Add Offer';
    ['om-id', 'om-title-inp', 'om-code', 'om-disc', 'om-min', 'om-desc'].forEach(function (x) {
      document.getElementById(x).value = '';
    });
    document.getElementById('om-color').value = 'orange';
    document.getElementById('om-active').checked = true;
  }
  document.getElementById('offer-modal').classList.add('open');
}
function editOffer(id) {
  openOfferModal(id);
}
function saveOffer() {
  var title = document.getElementById('om-title-inp').value.trim();
  var code = document.getElementById('om-code').value.trim();
  if (!title || !code) {
    toast('Title and Code required', 'err');
    return;
  }
  var offers = get(KEYS.offers, DEFAULT_OFFERS);
  var editId = parseInt(document.getElementById('om-id').value) || null;
  var o = {
    id: editId || Date.now(),
    title: title,
    code: code,
    disc: document.getElementById('om-disc').value.trim(),
    min: parseInt(document.getElementById('om-min').value) || 0,
    color: document.getElementById('om-color').value,
    desc: document.getElementById('om-desc').value.trim(),
    active: document.getElementById('om-active').checked,
  };
  if (editId) {
    var idx = offers.findIndex(function (x) {
      return x.id === editId;
    });
    if (idx > -1) offers[idx] = o;
  } else offers.push(o);
  set(KEYS.offers, offers);
  closeModal('offer-modal');
  renderOffersTable();
  renderDashboard();
  toast('Offer saved!', 'ok');
}
function deleteOffer(id) {
  if (!confirm('Delete this offer?')) return;
  set(
    KEYS.offers,
    get(KEYS.offers, DEFAULT_OFFERS).filter(function (o) {
      return o.id !== id;
    })
  );
  renderOffersTable();
  renderDashboard();
  toast('Offer deleted', 'ok');
}

// ===== BANNERS =====
function renderBanners() {
  var banners = get(KEYS.banners, []);
  var colorMap = {
    forest: 'linear-gradient(135deg,#1B4332,#2D6A4F)',
    saffron: 'linear-gradient(135deg,#FF6B00,#FF8C00)',
    red: 'linear-gradient(135deg,#E23744,#a0222e)',
    dark: 'linear-gradient(135deg,#2D1A00,#5C3A1E)',
  };
  var el = document.getElementById('banners-list');
  if (!banners.length) {
    el.innerHTML =
      '<div style="background:#fff;border-radius:16px;padding:2rem;border:2px dashed var(--border);text-align:center;color:var(--text-light);font-size:0.86rem;">No banners yet. Add one above!</div>';
    return;
  }
  el.innerHTML = banners
    .map(function (b) {
      return (
        '<div class="banner-card">' +
        '<div class="bc-top"><h4>' +
        esc(b.text.substring(0, 60)) +
        '…</h4>' +
        '<div class="bc-actions">' +
        '<span class="badge ' +
        (b.active ? 'badge-active' : 'badge-off') +
        '">' +
        (b.active ? 'Active' : 'Off') +
        '</span> ' +
        '<button class="btn btn-secondary btn-sm" onclick="editBanner(' +
        b.id +
        ')">✏️</button>' +
        '<button class="btn btn-danger btn-sm" onclick="deleteBanner(' +
        b.id +
        ')">🗑️</button>' +
        '</div></div>' +
        '<div class="bc-preview" style="background:' +
        colorMap[b.color] +
        ';color:#fff;">' +
        esc(b.text) +
        '</div>' +
        '</div>'
      );
    })
    .join('');
  // Load hero settings
  var hero = get(KEYS.hero, {});
  document.getElementById('hero-l1').value = hero.l1 || 'TASTE THAT';
  document.getElementById('hero-l2').value = hero.l2 || 'Travels';
  document.getElementById('hero-l3').value = hero.l3 || 'FAST';
  document.getElementById('hero-tag').value = hero.tag || 'Cloud Kitchen · Dhanbad, Jharkhand';
  document.getElementById('hero-desc').value = hero.desc || '';
  document.getElementById('topbar-text').value = hero.topbar || '';
}
function openBannerModal(id) {
  if (id) {
    var b = get(KEYS.banners, []).find(function (x) {
      return x.id === id;
    });
    if (!b) return;
    document.getElementById('bm-title').textContent = 'Edit Banner';
    document.getElementById('bm-id').value = id;
    document.getElementById('bm-text').value = b.text;
    document.getElementById('bm-color').value = b.color;
    document.getElementById('bm-active').checked = b.active;
  } else {
    document.getElementById('bm-title').textContent = 'Add Announcement';
    document.getElementById('bm-id').value = '';
    document.getElementById('bm-text').value = '';
    document.getElementById('bm-color').value = 'forest';
    document.getElementById('bm-active').checked = true;
  }
  document.getElementById('banner-modal').classList.add('open');
}
function editBanner(id) {
  openBannerModal(id);
}
function saveBanner() {
  var text = document.getElementById('bm-text').value.trim();
  if (!text) {
    toast('Please enter banner text', 'err');
    return;
  }
  var banners = get(KEYS.banners, []);
  var editId = parseInt(document.getElementById('bm-id').value) || null;
  var b = {
    id: editId || Date.now(),
    text: text,
    color: document.getElementById('bm-color').value,
    active: document.getElementById('bm-active').checked,
  };
  if (editId) {
    var idx = banners.findIndex(function (x) {
      return x.id === editId;
    });
    if (idx > -1) banners[idx] = b;
  } else banners.push(b);
  set(KEYS.banners, banners);
  closeModal('banner-modal');
  renderBanners();
  toast('Banner saved!', 'ok');
  syncAnnouncementsToLive();
}
function deleteBanner(id) {
  if (!confirm('Delete?')) return;
  set(
    KEYS.banners,
    get(KEYS.banners, []).filter(function (b) {
      return b.id !== id;
    })
  );
  renderBanners();
  toast('Banner deleted', 'ok');
  syncAnnouncementsToLive();
}
// FIX: banners were previously localStorage-only (admin's own browser) —
// customers never saw them. Push active banners + topbar text to Firestore
// so the live customer site can display them.
function syncAnnouncementsToLive() {
  if (!akFirebaseReady) return;
  var activeBanners = get(KEYS.banners, []).filter(function (b) {
    return b.active;
  });
  var topbarEl = document.getElementById('topbar-text');
  saveAnnouncements({ banners: activeBanners, topbar: topbarEl ? topbarEl.value : '' }).catch(
    function (e) {
      toast('Live sync failed: ' + e.message, 'err');
    }
  );
}
function saveHeroSettings() {
  var topbarEl = document.getElementById('topbar-text') || document.getElementById('hero-topbar');
  var heroData = {
    l1: document.getElementById('hero-l1').value,
    l2: document.getElementById('hero-l2').value,
    l3: document.getElementById('hero-l3').value,
    tag: document.getElementById('hero-tag').value,
    desc: document.getElementById('hero-desc').value,
    topbar: topbarEl ? topbarEl.value : '',
  };
  set(KEYS.hero, heroData);
  // FIX: headline/tagline/description were previously localStorage-only
  // (admin's own browser) — customers never saw any of it. Push to
  // Firestore settings/hero, same pattern as syncAnnouncementsToLive().
  if (akFirebaseReady) {
    saveHeroContent({
      l1: heroData.l1,
      l2: heroData.l2,
      l3: heroData.l3,
      tag: heroData.tag,
      desc: heroData.desc,
    })
      .then(function () {
        toast('Hero settings saved & live on website!', 'ok');
      })
      .catch(function (e) {
        toast('Saved locally, but live sync failed: ' + e.message, 'err');
      });
  } else {
    toast('Hero settings saved locally — Firebase not connected, live sync skipped.', 'err');
  }
  syncAnnouncementsToLive();
}

// ===== FEEDBACK TABLE =====
function renderFeedbackStats() {
  var fb = get(KEYS.feedback, []);
  var el = document.getElementById('fb-stats-row');
  if (!el) return;
  var platCounts = {};
  fb.forEach(function (f) {
    platCounts[f.platform] = (platCounts[f.platform] || 0) + 1;
  });
  var avgFood = fb.length
    ? (
        fb.reduce(function (s, f) {
          return s + (f.food || 0);
        }, 0) / fb.length
      ).toFixed(1)
    : '—';
  var avgDel = fb.length
    ? (
        fb.reduce(function (s, f) {
          return s + (f.delivery || 0);
        }, 0) / fb.length
      ).toFixed(1)
    : '—';
  el.innerHTML =
    '<div class="kpi-card"><div class="kpi-icon">💬</div><div class="kpi-num">' +
    fb.length +
    '</div><div class="kpi-lbl">Total Reviews</div></div>' +
    '<div class="kpi-card"><div class="kpi-icon">⭐</div><div class="kpi-num" style="color:#F59E0B;">' +
    avgFood +
    '</div><div class="kpi-lbl">Avg Food Rating</div></div>' +
    '<div class="kpi-card"><div class="kpi-icon">🚀</div><div class="kpi-num" style="color:var(--forest);">' +
    avgDel +
    '</div><div class="kpi-lbl">Avg Delivery Rating</div></div>' +
    Object.entries(platCounts)
      .map(function (e) {
        return (
          '<div class="kpi-card"><div class="kpi-icon">📱</div><div class="kpi-num" style="color:var(--saffron);">' +
          e[1] +
          '</div><div class="kpi-lbl">Via ' +
          e[0] +
          '</div></div>'
        );
      })
      .join('');
}
function renderFeedbackTable() {
  var fb = get(KEYS.feedback, []).slice().reverse();
  var search = (document.getElementById('fb-search').value || '').toLowerCase();
  var platF = document.getElementById('fb-plat-filter').value;
  if (search)
    fb = fb.filter(function (f) {
      return (
        (f.name || '').toLowerCase().includes(search) ||
        (f.comment || '').toLowerCase().includes(search)
      );
    });
  if (platF)
    fb = fb.filter(function (f) {
      return f.platform === platF;
    });
  var tbody = document.getElementById('feedback-tbody');
  if (!fb.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="empty-row">No feedback yet. Customers submit via your website.</td></tr>';
    return;
  }
  tbody.innerHTML = fb
    .map(function (f) {
      return (
        '<tr>' +
        '<td><strong>' +
        esc(f.name || 'Anonymous') +
        '</strong></td>' +
        '<td>' +
        stars(f.food) +
        '</td>' +
        '<td>' +
        stars(f.delivery) +
        '</td>' +
        '<td>' +
        stars(f.value) +
        '</td>' +
        '<td><span class="badge badge-cat">' +
        esc(f.platform || '—') +
        '</span></td>' +
        '<td style="max-width:200px;font-size:0.8rem;">' +
        esc(f.comment || '—') +
        '</td>' +
        '<td style="white-space:nowrap;font-size:0.74rem;">' +
        esc(f.date || f.createdAt || '—') +
        '</td>' +
        '</tr>'
      );
    })
    .join('');
  renderFeedbackStats();
}
function stars(n) {
  return n
    ? '<span style="color:#F59E0B;">' + ('★'.repeat(n) + '☆'.repeat(5 - n)) + '</span>'
    : '—';
}
function clearFeedback() {
  if (!confirm('Clear ALL feedback? This cannot be undone!')) return;
  set(KEYS.feedback, []);
  set('ak_fb_seen', 0);
  renderFeedbackTable();
  renderDashboard();
  toast('Feedback cleared', 'ok');
}

// ===== SETTINGS =====
function loadSettings() {
  var s = get(KEYS.settings, DEFAULT_SETTINGS);
  document.getElementById('s-name').value = s.name || '';
  document.getElementById('s-tag').value = s.tag || '';
  document.getElementById('s-ph1').value = s.ph1 || '';
  document.getElementById('s-ph2').value = s.ph2 || '';
  document.getElementById('s-email').value = s.email || '';
  document.getElementById('s-addr').value = s.addr || '';
  document.getElementById('s-open').value = s.open || '11:00';
  document.getElementById('s-close').value = s.close || '03:00';
  document.getElementById('s-live').checked = s.live !== false;
  document.getElementById('s-orders').checked = s.orders !== false;
  document.getElementById('s-topbar').checked = s.topbar !== false;
  document.getElementById('s-wa').checked = s.wa !== false;
  document.getElementById('s-zomato').value = s.zomato || AK_CONFIG.ZOMATO_LINK;
  document.getElementById('s-swiggy').value = s.swiggy || AK_CONFIG.SWIGGY_LINK;
  document.getElementById('s-whatsapp').value = s.whatsapp || '';
  document.getElementById('s-fssai').value = s.fssai || '';
  document.getElementById('s-rating').value = s.rating || '';
  document.getElementById('s-reviews').value = s.reviews || '';
  document.getElementById('s-delcharge').value = s.delcharge || 30;
  document.getElementById('s-riderpay').value = s.riderpay || 30;
  document.getElementById('s-freethreshold').value = s.freethreshold || 399;
}
function saveSettings() {
  var s = {
    name: document.getElementById('s-name').value,
    tag: document.getElementById('s-tag').value,
    ph1: document.getElementById('s-ph1').value,
    ph2: document.getElementById('s-ph2').value,
    email: document.getElementById('s-email').value,
    addr: document.getElementById('s-addr').value,
    open: document.getElementById('s-open').value,
    close: document.getElementById('s-close').value,
    live: document.getElementById('s-live').checked,
    orders: document.getElementById('s-orders').checked,
    topbar: document.getElementById('s-topbar').checked,
    wa: document.getElementById('s-wa').checked,
    zomato: document.getElementById('s-zomato').value,
    swiggy: document.getElementById('s-swiggy').value,
    whatsapp: document.getElementById('s-whatsapp').value,
    fssai: document.getElementById('s-fssai').value,
    rating: document.getElementById('s-rating').value,
    reviews: document.getElementById('s-reviews').value,
    delcharge: parseInt(document.getElementById('s-delcharge').value) || 30,
    riderpay: parseInt(document.getElementById('s-riderpay').value) || 30,
    freethreshold: parseInt(document.getElementById('s-freethreshold').value) || 399,
  };
  set(KEYS.settings, s);
  pushKitchenStatusToFirestore(s.orders);
  updateKitchenStatusBtn(s.orders);
  toast('Settings saved! Refresh your site to see changes.', 'ok');
}
function loadHeroSettings() {
  var hero = get(KEYS.hero, {});
  ['l1', 'l2', 'l3', 'tag', 'desc'].forEach(function (k) {
    var el = document.getElementById('hero-' + k);
    if (el && hero[k] !== undefined) el.value = hero[k];
  });
  var topbarEl = document.getElementById('topbar-text');
  if (topbarEl && hero.topbar !== undefined) topbarEl.value = hero.topbar;
}

// ===== PASSWORD — REAL FIREBASE AUTH VERSION =====
function changePassword() {
  var old = document.getElementById('cp-old').value;
  var newp = document.getElementById('cp-new').value;
  var conf = document.getElementById('cp-confirm').value;
  if (newp.length < 8) {
    toast('New password must be at least 8 characters', 'err');
    return;
  }
  if (newp !== conf) {
    toast('Passwords do not match!', 'err');
    return;
  }
  if (!akFirebaseReady || !firebase.auth || !firebase.auth().currentUser) {
    toast('Firebase session missing — logout karke dobara login karo', 'err');
    return;
  }
  var user = firebase.auth().currentUser;
  var cred = firebase.auth.EmailAuthProvider.credential(ADMIN_EMAIL, old);
  user
    .reauthenticateWithCredential(cred)
    .then(function () {
      return user.updatePassword(newp);
    })
    .then(function () {
      document.getElementById('cp-old').value = '';
      document.getElementById('cp-new').value = '';
      document.getElementById('cp-confirm').value = '';
      toast('Password changed! ✅ Ab har device pe naya password use hoga.', 'ok');
    })
    .catch(function (e) {
      if (e.code === 'auth/wrong-password') {
        toast('Current password incorrect!', 'err');
      } else {
        toast('Failed: ' + e.message, 'err');
      }
    });
}

// ===== WALLET LEDGER =====
var _allWallets = [];
function loadWalletLedger() {
  var body = document.getElementById('wallet-list-body');
  body.innerHTML =
    '<div style="padding:2rem;text-align:center;color:var(--text-light);">Loading...</div>';
  if (!akFirebaseReady) {
    body.innerHTML =
      '<div style="padding:2rem;text-align:center;color:var(--text-light);">Firebase connect nahi hai.</div>';
    return;
  }
  Promise.all([
    firebase.firestore().collection('wallets').get(),
    firebase.firestore().collection('customers').get(),
  ])
    .then(function (res) {
      var walletDocs = res[0],
        custDocs = res[1];
      var custMap = {};
      custDocs.forEach(function (d) {
        custMap[d.id] = d.data();
      });
      var wallets = [];
      walletDocs.forEach(function (d) {
        var w = d.data() || {};
        var c = custMap[d.id] || {};
        wallets.push({
          uid: d.id,
          name: c.name || '—',
          phone: c.phone || (d.id.indexOf('guest_') === 0 ? d.id.replace('guest_', '') : '—'),
          points: w.points || 0,
          history: (w.history || []).slice().reverse(),
        });
      });
      wallets.sort(function (a, b) {
        return b.points - a.points;
      });
      _allWallets = wallets;
      renderWalletKPIs(wallets);
      renderWalletTable(wallets);
    })
    .catch(function (e) {
      body.innerHTML =
        '<div style="padding:2rem;text-align:center;color:#DC2626;">Load fail: ' +
        esc(e.message) +
        '</div>';
    });
}
function renderWalletKPIs(wallets) {
  var totalPts = wallets.reduce(function (s, w) {
    return s + w.points;
  }, 0);
  var totalEarned = 0,
    totalUsed = 0;
  wallets.forEach(function (w) {
    w.history.forEach(function (h) {
      if (h.pts > 0) totalEarned += h.pts;
      else totalUsed += Math.abs(h.pts);
    });
  });
  var cards = [
    { label: 'Total Customers with Wallet', val: wallets.length, color: 'var(--saffron)' },
    { label: 'Points Currently Outstanding', val: totalPts, color: '#7C3AED' },
    { label: 'Total Points Ever Earned', val: totalEarned, color: '#16A34A' },
    { label: 'Total Points Redeemed', val: totalUsed, color: '#DC2626' },
  ];
  document.getElementById('wallet-kpi-cards').innerHTML = cards
    .map(function (c) {
      return (
        '<div class="kpi-card"><div style="font-size:0.72rem;font-weight:800;color:var(--text-light);text-transform:uppercase;">' +
        c.label +
        '</div><div style="font-size:1.6rem;font-weight:800;color:' +
        c.color +
        ';margin-top:6px;">' +
        c.val +
        '</div></div>'
      );
    })
    .join('');
}
function renderWalletTable(wallets) {
  var body = document.getElementById('wallet-list-body');
  if (!wallets.length) {
    body.innerHTML =
      '<div style="padding:2rem;text-align:center;color:var(--text-light);">Koi wallet data nahi mila.</div>';
    return;
  }
  var html =
    '<table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#FAFAF7;border-bottom:2px solid var(--border);">' +
    '<th style="padding:10px 14px;text-align:left;font-size:0.72rem;text-transform:uppercase;color:var(--text-light);">Customer</th>' +
    '<th style="padding:10px 14px;text-align:left;font-size:0.72rem;text-transform:uppercase;color:var(--text-light);">Phone</th>' +
    '<th style="padding:10px 14px;text-align:center;font-size:0.72rem;text-transform:uppercase;color:var(--text-light);">Current Points</th>' +
    '<th style="padding:10px 14px;text-align:center;font-size:0.72rem;text-transform:uppercase;color:var(--text-light);">History</th>' +
    '</tr></thead><tbody>';
  wallets.forEach(function (w, i) {
    var bg = i % 2 === 0 ? '#fff' : '#FAFAF7';
    html +=
      '<tr style="background:' +
      bg +
      ';border-bottom:1px solid var(--border);">' +
      '<td style="padding:10px 14px;font-weight:700;color:var(--deep-brown);">' +
      esc(w.name) +
      '</td>' +
      '<td style="padding:10px 14px;color:var(--text-mid);">' +
      esc(w.phone) +
      '</td>' +
      '<td style="padding:10px 14px;text-align:center;font-weight:800;color:#7C3AED;">' +
      w.points +
      '</td>' +
      '<td style="padding:10px 14px;text-align:center;"><button class="btn btn-secondary btn-sm" onclick="toggleWalletHistory(this,\'' +
      w.uid +
      '\')">👁️ Dekho (' +
      w.history.length +
      ')</button></td>' +
      '</tr>' +
      '<tr id="wh-' +
      w.uid +
      '" style="display:none;"><td colspan="4" style="padding:0;background:#FFFBF5;">' +
      '<div style="padding:12px 20px;">' +
      (w.history.length
        ? w.history
            .map(function (h) {
              var color = h.pts > 0 ? '#16A34A' : '#DC2626';
              return (
                '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--border);font-size:0.8rem;">' +
                '<span>' +
                esc(h.reason || h.note || h.type || '—') +
                (h.orderId
                  ? ' <span style="color:var(--text-light);">(' + esc(h.orderId) + ')</span>'
                  : '') +
                '</span>' +
                '<span style="color:var(--text-light);margin-right:12px;">' +
                esc(h.date || '') +
                '</span>' +
                '<span style="font-weight:800;color:' +
                color +
                ';">' +
                (h.pts > 0 ? '+' : '') +
                h.pts +
                '</span>' +
                '</div>'
              );
            })
            .join('')
        : '<div style="color:var(--text-light);padding:10px 0;">Koi history nahi.</div>') +
      '</div>' +
      '</td></tr>';
  });
  html += '</tbody></table>';
  body.innerHTML = html;
}
function toggleWalletHistory(btn, uid) {
  var row = document.getElementById('wh-' + uid);
  if (row) row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}
function filterWalletLedger(q) {
  q = (q || '').toLowerCase().trim();
  var filtered = !q
    ? _allWallets
    : _allWallets.filter(function (w) {
        return w.name.toLowerCase().includes(q) || w.phone.toLowerCase().includes(q);
      });
  renderWalletTable(filtered);
}

// ===== MARKETING =====
function populateMarketingItemSelect() {
  var items = get(KEYS.menu, DEFAULT_MENU);
  var sel = document.getElementById('mkt-item-select');
  sel.innerHTML = items
    .map(function (i) {
      return '<option value="' + i.id + '">' + esc(i.name) + ' — ₹' + i.price + '</option>';
    })
    .join('');
  if (!sel._tone) sel._tone = 'launch';
  updateMarketingPreview();
  loadSocialWorkerUrl();
  loadAiBannerWorkerUrl();
}
var _mktTone = 'launch';
function setMarketingTone(tone) {
  _mktTone = tone;
  updateMarketingPreview();
}
function updateMarketingPreview() {
  var items = get(KEYS.menu, DEFAULT_MENU);
  var id = document.getElementById('mkt-item-select').value;
  var item =
    items.find(function (i) {
      return String(i.id) === String(id);
    }) || items[0];
  if (!item) return;
  var settings = get(KEYS.settings, DEFAULT_SETTINGS);
  var offer = document.getElementById('mkt-offer-text').value.trim();
  var wa = '',
    ig = '';
  var link = 'https://' + (location.hostname || 'atharav-kitchen.pages.dev');
  if (_mktTone === 'launch') {
    wa =
      '🆕 *NAYA ITEM ALERT!* 🆕\n\n*' +
      item.name +
      '* ab available hai — sirf ₹' +
      item.price +
      ' mein!\n\n' +
      (item.desc ? '📝 ' + item.desc + '\n\n' : '') +
      (offer ? '🎉 ' + offer + '\n\n' : '') +
      '📍 Order karo: ' +
      link +
      '\n📱 Ya seedha WhatsApp pe order karo!\n\n*Atharav Kitchen — Taste That Travels Fast* 🍽️';
    ig =
      '🆕 NEW ON THE MENU 🆕\n\n' +
      item.name +
      '\n₹' +
      item.price +
      ' only!\n\n' +
      (item.desc ? item.desc + '\n\n' : '') +
      'Order now → link in bio\n\n#AtharavKitchen #Dhanbad #FoodDelivery #NewLaunch #' +
      item.name.replace(/[^a-zA-Z0-9]/g, '');
  } else if (_mktTone === 'offer') {
    wa =
      '🔥 *SPECIAL OFFER!* 🔥\n\n*' +
      item.name +
      '* pe ' +
      (offer || 'special discount') +
      '!\n\nPrice: ₹' +
      item.price +
      '\n\n⏰ Limited time — abhi order karo!\n📍 ' +
      link +
      '\n\n*Atharav Kitchen* 🍽️';
    ig =
      '🔥 OFFER ALERT 🔥\n\n' +
      item.name +
      '\n' +
      (offer || 'Special discount') +
      '!\n\nSwipe up / link in bio to order 👆\n\n#AtharavKitchen #Dhanbad #Offer #FoodieDeals';
  } else if (_mktTone === 'reminder') {
    wa =
      '🍽️ Bhookh lag rahi hai kya? 😋\n\n*' +
      item.name +
      '* — sirf ₹' +
      item.price +
      ' mein, garam garam aapke ghar tak!\n\n📍 Order abhi: ' +
      link +
      '\n📱 ' +
      (settings.whatsapp ? '+91' + settings.whatsapp.slice(-10) : '') +
      '\n\n*Atharav Kitchen — Taste That Travels Fast* 🍽️';
    ig =
      'Craving something tasty? 😋\n\n' +
      item.name +
      ' — ₹' +
      item.price +
      '\n\nOrder now, link in bio!\n\n#AtharavKitchen #Dhanbad #FoodCravings';
  } else {
    wa =
      '⭐ Namaste! Umeed hai aapko humara khana pasand aaya! ⭐\n\nAgar aap khush hain hamari service se, to please Google/Zomato pe ek chhota sa review de dijiye — bahut madad milegi hume! 🙏\n\n📍 ' +
      link +
      '\n\n*Atharav Kitchen — Taste That Travels Fast* 🍽️';
    ig =
      'Thank you for ordering with us! 🙏\n\nLoved your meal? Drop us a review — it means the world 🌟\n\n#AtharavKitchen #Dhanbad #ThankYou';
  }
  document.getElementById('mkt-preview-wa').value = wa;
  document.getElementById('mkt-preview-ig').value = ig;
}
function copyMarketingText(id) {
  var el = document.getElementById(id);
  el.select();
  el.setSelectionRange(0, 999999);
  try {
    document.execCommand('copy');
    toast('Copy ho gaya! ✅', 'ok');
  } catch (e) {
    navigator.clipboard &&
      navigator.clipboard.writeText(el.value).then(function () {
        toast('Copy ho gaya! ✅', 'ok');
      });
  }
}
function shareMarketingWA() {
  var txt = document.getElementById('mkt-preview-wa').value;
  window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
}
function generatePromoBanner() {
  var items = get(KEYS.menu, DEFAULT_MENU);
  var id = document.getElementById('mkt-item-select').value;
  var item =
    items.find(function (i) {
      return String(i.id) === String(id);
    }) || items[0];
  if (!item) return;
  var settings = get(KEYS.settings, DEFAULT_SETTINGS);
  var offer = document.getElementById('mkt-offer-text').value.trim();
  var canvas = document.getElementById('mkt-banner-canvas');
  var ctx = canvas.getContext('2d');
  var W = canvas.width,
    H = canvas.height;
  function draw(imgOrNull) {
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#2D1A00');
    grad.addColorStop(1, '#7A3E00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    if (imgOrNull) {
      var scale = Math.max(W / imgOrNull.width, (H * 0.55) / imgOrNull.height);
      var iw = imgOrNull.width * scale,
        ih = imgOrNull.height * scale;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H * 0.55);
      ctx.clip();
      ctx.drawImage(imgOrNull, (W - iw) / 2, 0, iw, ih);
      ctx.restore();
    } else {
      ctx.font = 'bold 160px serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillText((item.name || '?').charAt(0).toUpperCase(), W / 2, H * 0.42);
    }
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px Arial';
    wrapText(ctx, item.name, W / 2, H * 0.66, W - 60, 46);
    ctx.font = 'bold 34px Arial';
    ctx.fillStyle = '#FFD27A';
    ctx.fillText('₹' + item.price, W / 2, H * 0.78);
    if (offer) {
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#FF7A00';
      ctx.fillText(offer, W / 2, H * 0.85);
    }
    ctx.font = '20px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(settings.name || 'Atharav Kitchen', W / 2, H * 0.94);
  }
  function wrapText(ctx, text, x, y, maxW, lh) {
    var words = text.split(' '),
      line = '',
      lines = [];
    words.forEach(function (w) {
      var test = line + w + ' ';
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w + ' ';
      } else line = test;
    });
    lines.push(line);
    var startY = y - ((lines.length - 1) * lh) / 2;
    lines.forEach(function (l, i) {
      ctx.fillText(l.trim(), x, startY + i * lh);
    });
  }
  var src = item.imgUrl || item.imgData;
  if (src) {
    var img = new Image();
    // Firebase Storage URLs support CORS — crossOrigin needed for canvas taint-check
    img.crossOrigin = 'anonymous';
    var _loadTimeout = setTimeout(function () {
      // If image takes too long (e.g. CORS blocked), draw with text placeholder
      draw(null);
      toast('Banner ready! (Image load nahi hua — text ke saath bana)', 'ok');
    }, 6000);
    img.onload = function () {
      clearTimeout(_loadTimeout);
      draw(img);
      toast('Banner ready! Download button dabao.', 'ok');
    };
    img.onerror = function () {
      clearTimeout(_loadTimeout);
      // Retry without crossOrigin — works for display but canvas will be tainted
      // (download will still work since we use toDataURL on a non-cross-origin canvas)
      var img2 = new Image();
      img2.onload = function () {
        draw(img2);
        toast('Banner ready! Download button dabao.', 'ok');
      };
      img2.onerror = function () {
        draw(null);
        toast('Banner ready! (Image nahi mila)', 'ok');
      };
      img2.src = src + (src.includes('?') ? '&' : '?') + '_t=' + Date.now();
    };
    img.src = src;
  } else {
    draw(null);
    toast('Banner ready! Download button dabao.', 'ok');
  }
}
function downloadPromoBanner() {
  var canvas = document.getElementById('mkt-banner-canvas');
  var a = document.createElement('a');
  a.download = 'atharav-kitchen-promo.png';
  try {
    a.href = canvas.toDataURL('image/png');
    a.click();
  } catch (e) {
    // Canvas tainted by cross-origin image — try JPEG which has fewer restrictions
    try {
      a.href = canvas.toDataURL('image/jpeg', 0.95);
      a.click();
    } catch (e2) {
      toast(
        'Download failed — image CORS block ho rahi hai. Firebase Storage URL use karo.',
        'err'
      );
    }
  }
}

function saveSocialWorkerUrl(url) {
  localStorage.setItem('ak_social_worker_url', url.trim());
}
function loadSocialWorkerUrl() {
  var el = document.getElementById('mkt-worker-url');
  if (el) el.value = localStorage.getItem('ak_social_worker_url') || '';
}

// ===== AI BANNER GENERATOR =====
function saveAiBannerWorkerUrl(url) {
  localStorage.setItem('ak_ai_banner_worker_url', url.trim());
}
function loadAiBannerWorkerUrl() {
  var el = document.getElementById('ai-banner-worker-url');
  if (el) el.value = localStorage.getItem('ak_ai_banner_worker_url') || '';
}
var _aiBannerLastImage = null;
function generateAiBanner() {
  var statusEl = document.getElementById('ai-banner-status');
  var workerUrl = (localStorage.getItem('ak_ai_banner_worker_url') || '').trim();
  var prompt = (document.getElementById('ai-banner-prompt').value || '').trim();
  var btn = document.getElementById('ai-banner-generate-btn');
  if (!workerUrl) {
    statusEl.innerHTML =
      '<span style="color:#DC2626;">⚠️ Pehle upar Worker URL daalo (deploy guide: cloudflare-worker/ai-banner-generator.js).</span>';
    return;
  }
  if (!prompt) {
    statusEl.innerHTML = '<span style="color:#DC2626;">⚠️ Pehle likho AI ko kya banana hai.</span>';
    return;
  }
  if (!akFirebaseReady || !firebase.auth || !firebase.auth().currentUser) {
    statusEl.innerHTML =
      '<span style="color:#DC2626;">⚠️ Firebase login session missing — dubara login karo.</span>';
    return;
  }
  var style = document.getElementById('ai-banner-style').value;
  var aspect = document.getElementById('ai-banner-aspect').value;
  btn.disabled = true;
  btn.textContent = '✨ Banaya ja raha hai...';
  document.getElementById('ai-banner-preview-wrap').style.display = 'none';
  statusEl.innerHTML = '⏳ AI banner bana raha hai — 10-20 second lagenge...';
  firebase
    .auth()
    .currentUser.getIdToken()
    .then(function (idToken) {
      return fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: idToken, prompt: prompt, style: style, aspect: aspect }),
      });
    })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      btn.disabled = false;
      btn.textContent = '✨ AI Se Banner Banao';
      if (!data.ok) {
        statusEl.innerHTML =
          '<span style="color:#DC2626;">❌ ' +
          esc(data.error || 'Banner generate nahi hua') +
          '</span>';
        return;
      }
      _aiBannerLastImage = data.imageBase64;
      document.getElementById('ai-banner-preview-img').src =
        'data:image/png;base64,' + data.imageBase64;
      document.getElementById('ai-banner-preview-wrap').style.display = '';
      statusEl.innerHTML =
        '<span style="color:#16A34A;font-weight:800;">✅ Banner ready hai!</span>';
    })
    .catch(function (err) {
      btn.disabled = false;
      btn.textContent = '✨ AI Se Banner Banao';
      statusEl.innerHTML =
        '<span style="color:#DC2626;">❌ Error: ' + esc(String(err.message || err)) + '</span>';
    });
}
function downloadAiBanner() {
  if (!_aiBannerLastImage) return;
  var a = document.createElement('a');
  a.download = 'atharav-kitchen-ai-banner.png';
  a.href = 'data:image/png;base64,' + _aiBannerLastImage;
  a.click();
}

// Uploads the current banner canvas to Firebase Storage so Instagram/Facebook's
// Graph API (which needs a real public image URL, not base64) can fetch it.
function uploadBannerForSocial() {
  return new Promise(function (resolve, reject) {
    var canvas = document.getElementById('mkt-banner-canvas');
    if (!window.akStorage) {
      reject(new Error('Firebase Storage ready nahi hai'));
      return;
    }
    canvas.toBlob(
      function (blob) {
        if (!blob) {
          reject(new Error('Banner pehle banao (🎨 Banner Banao dabao)'));
          return;
        }
        var path = 'social-posts/' + Date.now() + '.jpg';
        window.akStorage
          .ref(path)
          .put(blob, { contentType: 'image/jpeg' })
          .then(function (snap) {
            return snap.ref.getDownloadURL();
          })
          .then(resolve)
          .catch(reject);
      },
      'image/jpeg',
      0.9
    );
  });
}

function postToSocial(platforms) {
  var statusEl = document.getElementById('mkt-post-status');
  var workerUrl = (localStorage.getItem('ak_social_worker_url') || '').trim();
  if (!workerUrl) {
    statusEl.innerHTML =
      '<span style="color:#DC2626;">⚠️ Pehle Worker URL daalo upar (deploy guide: cloudflare-worker/social-poster.js).</span>';
    return;
  }
  if (!akFirebaseReady || !firebase.auth || !firebase.auth().currentUser) {
    statusEl.innerHTML = '<span style="color:#DC2626;">⚠️ Firebase login session missing.</span>';
    return;
  }
  var message =
    document.getElementById('mkt-preview-wa').value ||
    document.getElementById('mkt-preview-ig').value;
  if (!message) {
    statusEl.innerHTML =
      '<span style="color:#DC2626;">⚠️ Pehle upar se caption generate karo.</span>';
    return;
  }

  statusEl.innerHTML = '⏳ Banner upload ho raha hai...';
  uploadBannerForSocial()
    .then(function (imageUrl) {
      statusEl.innerHTML = '⏳ Post ho raha hai...';
      return firebase
        .auth()
        .currentUser.getIdToken()
        .then(function (idToken) {
          return fetch(workerUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idToken: idToken,
              message: message,
              imageUrl: imageUrl,
              platforms: platforms,
            }),
          });
        });
    })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (!data.ok) {
        statusEl.innerHTML =
          '<span style="color:#DC2626;">❌ ' + esc(data.error || 'Post fail ho gaya') + '</span>';
        return;
      }
      var lines = [];
      Object.keys(data.results || {}).forEach(function (p) {
        var r = data.results[p];
        lines.push(r.error ? '❌ ' + p + ': ' + esc(r.error) : '✅ ' + p + ': posted!');
      });
      statusEl.innerHTML = lines.join('<br>');
      if (
        lines.every(function (l) {
          return l.indexOf('✅') === 0;
        })
      )
        toast('Social media pe post ho gaya! 🎉', 'ok');
    })
    .catch(function (e) {
      statusEl.innerHTML =
        '<span style="color:#DC2626;">❌ ' + esc(e.message || String(e)) + '</span>';
    });
}

// ===== REPORTS & ANALYTICS =====
function saveAgentWorkerUrl(url) {
  localStorage.setItem('ak_agent_worker_url', url.trim());
}
function loadAgentWorkerUrl() {
  var el = document.getElementById('rep-worker-url');
  if (el) el.value = localStorage.getItem('ak_agent_worker_url') || '';
}

function simpleBarChart(rows, labelKey, valueKey, fmt) {
  // rows: [{label,value}], sabse bada value 100% bar
  if (!rows.length)
    return '<div style="color:var(--text-light);font-size:0.82rem;padding:0.8rem 0;">Abhi data nahi hai.</div>';
  var max =
    Math.max.apply(
      null,
      rows.map(function (r) {
        return r[valueKey] || 0;
      })
    ) || 1;
  return rows
    .map(function (r) {
      var pct = Math.max(2, Math.round(((r[valueKey] || 0) / max) * 100));
      return (
        '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:8px;">' +
        '<span style="width:64px;font-size:0.72rem;color:var(--text-mid);font-weight:700;flex-shrink:0;">' +
        esc(String(r[labelKey])) +
        '</span>' +
        '<div style="flex:1;background:var(--cream);border-radius:6px;overflow:hidden;height:18px;">' +
        '<div style="height:100%;width:' +
        pct +
        '%;background:var(--saffron2,#F97316);border-radius:6px;"></div></div>' +
        '<span style="width:64px;text-align:right;font-size:0.74rem;font-weight:800;color:var(--deep-brown);flex-shrink:0;">' +
        (fmt ? fmt(r[valueKey]) : r[valueKey]) +
        '</span>' +
        '</div>'
      );
    })
    .join('');
}

function renderReportsPage() {
  loadAgentWorkerUrl();
  var orders = get(KEYS.orders, []);
  var now = Date.now();
  var DAY = 86400000;

  // ---- SALES REPORT ----
  var last7 = orders.filter(function (o) {
    return (o.createdAtMs || 0) >= now - 7 * DAY;
  });
  var delivered7 = last7.filter(function (o) {
    return o.status === 'Delivered';
  });
  var rev7 = delivered7.reduce(function (s, o) {
    return s + (o.bill ? o.bill.total : 0);
  }, 0);
  var todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  var todayOrders = orders.filter(function (o) {
    return (o.createdAtMs || 0) >= todayStart.getTime();
  });
  var todayDelivered = todayOrders.filter(function (o) {
    return o.status === 'Delivered';
  });
  var revToday = todayDelivered.reduce(function (s, o) {
    return s + (o.bill ? o.bill.total : 0);
  }, 0);
  var avgOrderVal = delivered7.length ? Math.round(rev7 / delivered7.length) : 0;

  document.getElementById('rep-sales-kpi').innerHTML =
    kpiCard('💰', '₹' + revToday, 'Aaj ka Revenue', '', 'var(--saffron2)') +
    kpiCard('📦', todayOrders.length, 'Aaj ke Orders', '', '#2563EB') +
    kpiCard('💰', '₹' + rev7, '7-Din Revenue', '', 'var(--forest)') +
    kpiCard('📊', '₹' + avgOrderVal, 'Avg Order Value', '', 'var(--gold)');

  // Daily chart (last 7 days)
  var dayBuckets = {};
  for (var i = 6; i >= 0; i--) {
    var d = new Date(now - i * DAY);
    var key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    dayBuckets[key] = 0;
  }
  delivered7.forEach(function (o) {
    var d = new Date(o.createdAtMs || now);
    var key = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    if (dayBuckets[key] !== undefined) dayBuckets[key] += o.bill ? o.bill.total : 0;
  });
  var dayRows = Object.keys(dayBuckets).map(function (k) {
    return { label: k, value: dayBuckets[k] };
  });
  document.getElementById('rep-daily-chart').innerHTML = simpleBarChart(
    dayRows,
    'label',
    'value',
    function (v) {
      return '₹' + v;
    }
  );

  // Hourly chart (today, 0-23)
  var hourBuckets = {};
  for (var h = 0; h < 24; h++) hourBuckets[h] = 0;
  todayOrders.forEach(function (o) {
    var d = new Date(o.createdAtMs || now);
    hourBuckets[d.getHours()]++;
  });
  var hourRows = Object.keys(hourBuckets)
    .map(function (k) {
      return { label: k + ':00', value: hourBuckets[k] };
    })
    .filter(function (r, idx) {
      return idx % 2 === 0;
    }); // har 2 ghante dikhao, compact rahe
  document.getElementById('rep-hourly-chart').innerHTML = simpleBarChart(
    hourRows,
    'label',
    'value',
    function (v) {
      return v + ' ord';
    }
  );

  // ---- CUSTOMER REPORT ----
  var byPhone = {};
  orders.forEach(function (o) {
    var ph = (o.phone || '').trim();
    if (!ph) return;
    if (!byPhone[ph]) byPhone[ph] = { name: o.name || '—', phone: ph, orders: 0, spend: 0 };
    byPhone[ph].orders++;
    byPhone[ph].spend += o.bill ? o.bill.total : 0;
  });
  var custArr = Object.values(byPhone);
  var repeatCust = custArr.filter(function (c) {
    return c.orders > 1;
  }).length;
  var newThisWeek = custArr.filter(function (c) {
    return (
      last7.some(function (o) {
        return o.phone === c.phone;
      }) &&
      c.orders ===
        last7.filter(function (o) {
          return o.phone === c.phone;
        }).length
    );
  }).length;

  document.getElementById('rep-customer-kpi').innerHTML =
    kpiCard('👥', custArr.length, 'Total Unique Customers', '', '#2563EB') +
    kpiCard('🔁', repeatCust, 'Repeat Customers', '', 'var(--forest)') +
    kpiCard('🆕', newThisWeek, 'Naye Customers (7 din)', '', 'var(--saffron2)') +
    kpiCard(
      '📈',
      custArr.length ? Math.round((repeatCust / custArr.length) * 100) + '%' : '0%',
      'Repeat Rate',
      '',
      'var(--gold)'
    );

  var topCust = custArr
    .slice()
    .sort(function (a, b) {
      return b.spend - a.spend;
    })
    .slice(0, 5);
  document.getElementById('rep-top-customers').innerHTML = topCust.length
    ? topCust
        .map(function (c, i) {
          return (
            '<div class="top-item"><span class="ti-rank">#' +
            (i + 1) +
            '</span><span class="ti-emoji">👤</span><span class="ti-name">' +
            esc(c.name) +
            ' (' +
            esc(c.phone) +
            ')</span><span class="ti-count">₹' +
            c.spend +
            ' · ' +
            c.orders +
            ' orders</span></div>'
          );
        })
        .join('')
    : '<div style="color:var(--text-light);font-size:0.82rem;padding:0.8rem 0;">Abhi customer data nahi hai.</div>';

  // ---- SERVICE REPORT ----
  var delivAll = orders.filter(function (o) {
    return o.status === 'Delivered';
  });
  var cancelled = orders.filter(function (o) {
    return o.status === 'Cancelled';
  });
  var totalItemsCount = 0;
  delivAll.forEach(function (o) {
    if (o.items && typeof o.items === 'object' && !Array.isArray(o.items)) {
      Object.keys(o.items).forEach(function (k) {
        totalItemsCount += o.items[k].qty || 1;
      });
    }
  });
  var avgItems = delivAll.length ? (totalItemsCount / delivAll.length).toFixed(1) : '—';
  var cancelRate = orders.length ? Math.round((cancelled.length / orders.length) * 100) : 0;

  document.getElementById('rep-service-kpi').innerHTML =
    kpiCard('✅', delivAll.length, 'Total Delivered', '', 'var(--success)') +
    kpiCard('❌', cancelled.length, 'Cancelled', '', '#DC2626') +
    kpiCard('📉', cancelRate + '%', 'Cancellation Rate', '', 'var(--saffron)') +
    kpiCard('🍽️', avgItems, 'Avg Items/Order', '', 'var(--mid-brown)');
}

function loadTrafficReport() {
  var statusEl = document.getElementById('rep-traffic-status');
  var bodyEl = document.getElementById('rep-traffic-body');
  var workerUrl = (localStorage.getItem('ak_agent_worker_url') || '').trim();
  if (!workerUrl) {
    statusEl.innerHTML =
      '<span style="color:#DC2626;">⚠️ Pehle upar AI Agent Worker URL daalo aur save karo.</span>';
    return;
  }
  if (!akFirebaseReady || !firebase.auth || !firebase.auth().currentUser) {
    statusEl.innerHTML = '<span style="color:#DC2626;">⚠️ Firebase login session missing.</span>';
    return;
  }

  statusEl.innerHTML = '⏳ Traffic data la rahe hain...';
  bodyEl.innerHTML = '';
  firebase
    .auth()
    .currentUser.getIdToken()
    .then(function (idToken) {
      return fetch(workerUrl.replace(/\/$/, '') + '/traffic-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: idToken }),
      });
    })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (!data.ok) {
        var extra = data.debug ? ' — ' + esc(JSON.stringify(data.debug)) : '';
        statusEl.innerHTML =
          '<span style="color:#DC2626;">❌ ' +
          esc(data.error || 'Fetch fail ho gaya') +
          extra +
          '</span>';
        return;
      }
      statusEl.innerHTML = '<span style="color:#16A34A;">✅ Live data aa gaya</span>';
      var t = data.traffic;
      var wc = t.weekCompare;
      var growth = wc.lastWeek.users
        ? Math.round(((wc.thisWeek.users - wc.lastWeek.users) / wc.lastWeek.users) * 100)
        : 0;
      var dailyRows = (t.daily || []).map(function (d) {
        var lbl = d.date.slice(6, 8) + '/' + d.date.slice(4, 6);
        return { label: lbl, value: d.users };
      });
      var hourlyRows = (t.hourly || [])
        .filter(function (r, i) {
          return i % 2 === 0;
        })
        .map(function (h) {
          return { label: h.hour + ':00', value: h.views };
        });
      bodyEl.innerHTML =
        '<div class="kpi-grid" style="margin-bottom:1rem;">' +
        kpiCard('👥', wc.thisWeek.users, 'Users (7 din)', '', '#2563EB') +
        kpiCard('👁️', wc.thisWeek.views, 'Page Views (7 din)', '', 'var(--forest)') +
        kpiCard(
          growth >= 0 ? '📈' : '📉',
          (growth >= 0 ? '+' : '') + growth + '%',
          'Growth vs Pichla Hafta',
          '',
          growth >= 0 ? 'var(--success)' : '#DC2626'
        ) +
        '</div>' +
        '<div style="font-size:0.72rem;font-weight:800;color:var(--text-light);text-transform:uppercase;letter-spacing:1px;margin-bottom:0.6rem;">Daily Users (7 din)</div>' +
        simpleBarChart(dailyRows, 'label', 'value') +
        '<div style="font-size:0.72rem;font-weight:800;color:var(--text-light);text-transform:uppercase;letter-spacing:1px;margin:1rem 0 0.6rem;">Aaj — Hourly Page Views</div>' +
        simpleBarChart(hourlyRows, 'label', 'value');
    })
    .catch(function (e) {
      statusEl.innerHTML =
        '<span style="color:#DC2626;">❌ ' + esc(e.message || String(e)) + '</span>';
    });
}

// Manual "run it right now" test — Monday ka wait kiye bina abhi ek baar
// chala kar test karta hai ki agent (GA4+GSC+Claude+social post+Firestore
// save) sahi kaam kar raha hai ya nahi.
function runAgentManualTest() {
  var statusEl = document.getElementById('rep-agent-test-status');
  var workerUrl = (localStorage.getItem('ak_agent_worker_url') || '').trim();
  if (!workerUrl) {
    statusEl.innerHTML =
      '<span style="color:#DC2626;">⚠️ Pehle upar AI Agent Worker URL daalo aur save karo.</span>';
    return;
  }
  if (!akFirebaseReady || !firebase.auth || !firebase.auth().currentUser) {
    statusEl.innerHTML =
      '<span style="color:#DC2626;">⚠️ Firebase login session missing — dubara login karo.</span>';
    return;
  }
  statusEl.innerHTML =
    '⏳ Agent chal raha hai — GA4, Search Console, aur Claude se report ban raha hai (10-20 second lagenge)...';
  firebase
    .auth()
    .currentUser.getIdToken()
    .then(function (idToken) {
      return fetch(workerUrl.replace(/\/$/, '') + '/run-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: idToken }),
      });
    })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (!data.ok) {
        var extra = data.debug
          ? '<br><span style="font-size:0.72rem;color:var(--text-light);">Debug: ' +
            esc(JSON.stringify(data.debug)) +
            '</span>'
          : '';
        statusEl.innerHTML =
          '<span style="color:#DC2626;">❌ ' +
          esc(data.error || 'Agent fail ho gaya') +
          '</span>' +
          extra;
        return;
      }
      var r = data.result && data.result.reportDoc;
      statusEl.innerHTML =
        '<span style="color:#16A34A;font-weight:800;">✅ Agent successfully chal gaya!</span>' +
        (r
          ? '<div style="margin-top:0.6rem;padding:0.8rem;background:var(--cream);border-radius:10px;font-size:0.82rem;white-space:pre-wrap;">' +
            esc(r.reportText || '') +
            '</div>'
          : '');
      toast('AI Agent test successful! ✅', 'ok');
    })
    .catch(function (e) {
      statusEl.innerHTML =
        '<span style="color:#DC2626;">❌ ' + esc(e.message || String(e)) + '</span>';
    });
}

// ---- AI BLOG DRAFT GENERATOR ----
var _blogDraftCache = {}; // id -> draft object, taaki copy button ke liye dubara fetch na karna pade

function generateBlogDraft() {
  var statusEl = document.getElementById('blog-draft-status');
  var bodyEl = document.getElementById('blog-draft-body');
  var workerUrl = (localStorage.getItem('ak_agent_worker_url') || '').trim();
  var keyword = (document.getElementById('blog-draft-keyword').value || '').trim();
  if (!workerUrl) {
    statusEl.innerHTML =
      '<span style="color:#DC2626;">⚠️ Pehle upar AI Agent Worker URL daalo aur save karo.</span>';
    return;
  }
  if (!akFirebaseReady || !firebase.auth || !firebase.auth().currentUser) {
    statusEl.innerHTML = '<span style="color:#DC2626;">⚠️ Firebase login session missing.</span>';
    return;
  }

  statusEl.innerHTML =
    '⏳ Draft likh raha hai — SEO data padh ke Claude se content generate ho raha hai (15-25 second lagenge)...';
  bodyEl.innerHTML = '';
  firebase
    .auth()
    .currentUser.getIdToken()
    .then(function (idToken) {
      return fetch(workerUrl.replace(/\/$/, '') + '/generate-blog-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: idToken, keyword: keyword || undefined }),
      });
    })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (!data.ok) {
        var extra = data.debug ? ' — ' + esc(JSON.stringify(data.debug)) : '';
        statusEl.innerHTML =
          '<span style="color:#DC2626;">❌ ' +
          esc(data.error || 'Draft nahi ban paya') +
          extra +
          '</span>';
        return;
      }
      statusEl.innerHTML =
        '<span style="color:#16A34A;">✅ Draft ban gaya — neeche review karo</span>';
      _blogDraftCache[data.draft.id] = data.draft;
      bodyEl.innerHTML = renderBlogDraftCard(data.draft) + bodyEl.innerHTML;
    })
    .catch(function (e) {
      statusEl.innerHTML =
        '<span style="color:#DC2626;">❌ ' + esc(e.message || String(e)) + '</span>';
    });
}

function loadBlogDrafts() {
  var statusEl = document.getElementById('blog-draft-status');
  var bodyEl = document.getElementById('blog-draft-body');
  var workerUrl = (localStorage.getItem('ak_agent_worker_url') || '').trim();
  if (!workerUrl) {
    statusEl.innerHTML =
      '<span style="color:#DC2626;">⚠️ Pehle upar AI Agent Worker URL daalo aur save karo.</span>';
    return;
  }
  if (!akFirebaseReady || !firebase.auth || !firebase.auth().currentUser) {
    statusEl.innerHTML = '<span style="color:#DC2626;">⚠️ Firebase login session missing.</span>';
    return;
  }

  statusEl.innerHTML = '⏳ Purane drafts la rahe hain...';
  bodyEl.innerHTML = '';
  firebase
    .auth()
    .currentUser.getIdToken()
    .then(function (idToken) {
      return fetch(workerUrl.replace(/\/$/, '') + '/list-blog-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: idToken }),
      });
    })
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (!data.ok) {
        var extra = data.debug ? ' — ' + esc(JSON.stringify(data.debug)) : '';
        statusEl.innerHTML =
          '<span style="color:#DC2626;">❌ ' +
          esc(data.error || 'Load nahi ho paya') +
          extra +
          '</span>';
        return;
      }
      if (!data.drafts || !data.drafts.length) {
        statusEl.innerHTML =
          '<span style="color:var(--text-light);">Koi draft nahi mila abhi tak.</span>';
        return;
      }
      statusEl.innerHTML =
        '<span style="color:#16A34A;">✅ ' + data.drafts.length + ' draft(s) mile</span>';
      data.drafts.forEach(function (d) {
        _blogDraftCache[d.id] = d;
      });
      bodyEl.innerHTML = data.drafts.map(renderBlogDraftCard).join('');
    })
    .catch(function (e) {
      statusEl.innerHTML =
        '<span style="color:#DC2626;">❌ ' + esc(e.message || String(e)) + '</span>';
    });
}

function renderBlogDraftCard(d) {
  var statusColor = d.status === 'pending_review' ? '#B45309' : '#16A34A';
  var statusLabel = d.status === 'pending_review' ? '⏳ Review Pending' : d.status;
  return (
    '<div style="border:1.5px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem;">' +
    '<div style="display:flex;justify-content:space-between;align-items:start;gap:0.6rem;flex-wrap:wrap;">' +
    '<div><div style="font-size:0.7rem;font-weight:800;color:' +
    statusColor +
    ';text-transform:uppercase;letter-spacing:1px;">' +
    statusLabel +
    '</div>' +
    '<div style="font-weight:800;font-size:1rem;color:var(--text-dark);margin-top:2px;">' +
    esc(d.title || '(no title)') +
    '</div>' +
    '<div style="font-size:0.75rem;color:var(--text-light);margin-top:2px;">Target keyword: <strong>' +
    esc(d.targetKeyword || '—') +
    '</strong> · slug: ' +
    esc(d.slug || '—') +
    '</div></div>' +
    '<button class="btn btn-secondary btn-sm" onclick="copyBlogDraftHtml(\'' +
    d.id +
    '\')">📋 Copy Full HTML</button>' +
    '</div>' +
    '<div style="margin-top:0.7rem;font-size:0.8rem;color:var(--text-mid);"><strong>Meta description:</strong> ' +
    esc(d.metaDescription || '—') +
    '</div>' +
    '<div style="margin-top:0.6rem;padding:0.8rem;background:var(--cream);border-radius:10px;font-size:0.82rem;max-height:220px;overflow-y:auto;">' +
    (d.htmlBody || '') +
    '</div>' +
    '</div>'
  );
}

// Draft ke structured fields se ek poori, ready-to-save blog-*.html file
// banata hai — bilkul wahi template use karke jo existing blog posts
// (blog-best-cloud-kitchen-dhanbad.html etc.) use karte hain, taaki style/SEO
// setup consistent rahe. Isko clipboard pe copy karke ek naye
// "blog-<slug>.html" file mein paste karke Cloudflare Pages pe upload karo,
// phir blog.html aur sitemap.xml mein iska link/entry add karo.
function buildBlogHtmlFile(d) {
  var slug = d.slug || 'new-post';
  var today = new Date().toISOString().slice(0, 10);
  return (
    '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <script src="security.js"><\/script>\n\n' +
    '<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '<title>' +
    esc(d.title || '') +
    '</title>\n' +
    '<meta name="description" content="' +
    esc(d.metaDescription || '') +
    '">\n' +
    '<meta name="robots" content="index, follow">\n' +
    '<link rel="canonical" href="https://atharav-kitchen.pages.dev/blog-' +
    slug +
    '.html">\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">\n' +
    '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "BlogPosting",\n  "headline": "' +
    esc(d.title || '') +
    '",\n  "description": "' +
    esc(d.metaDescription || '') +
    '",\n  "author": {"@type": "Organization", "name": "Atharav Kitchen"},\n  "publisher": {"@type": "Organization", "name": "Atharav Kitchen", "url": "https://atharav-kitchen.pages.dev/"},\n  "datePublished": "' +
    today +
    '",\n  "dateModified": "' +
    today +
    '",\n  "url": "https://atharav-kitchen.pages.dev/blog-' +
    slug +
    '.html",\n  "mainEntityOfPage": "https://atharav-kitchen.pages.dev/blog-' +
    slug +
    '.html"\n}\n<\/script>\n' +
    "<style>\n*{margin:0;padding:0;box-sizing:border-box;}\nbody{font-family:'Nunito',sans-serif;background:#FFFCF8;color:#1A0E00;}\nnav{background:#2D1A00;padding:1rem 2rem;display:flex;align-items:center;justify-content:space-between;}\nnav a{color:#FF6B00;font-weight:800;text-decoration:none;}\nnav a.back{color:#fff;font-size:0.9rem;}\n.post-wrap{max-width:780px;margin:3rem auto;padding:0 1.5rem;}\n.post-meta{font-size:0.75rem;color:#A08060;text-transform:uppercase;letter-spacing:1px;margin-bottom:1rem;}\nh1{font-family:'Playfair Display',serif;font-size:clamp(2rem,5vw,3rem);color:#2D1A00;margin-bottom:1.2rem;line-height:1.2;}\nh2{font-family:'Playfair Display',serif;font-size:1.6rem;color:#2D1A00;margin:2.5rem 0 0.8rem;}\nh3{font-size:1.05rem;font-weight:800;color:#5C3A1E;margin:1.5rem 0 0.5rem;}\np{line-height:1.85;color:#3D2010;margin-bottom:1.1rem;font-size:0.95rem;}\nul{padding-left:1.5rem;margin-bottom:1.1rem;}\nli{line-height:1.85;color:#3D2010;font-size:0.95rem;}\nfooter{background:#2D1A00;color:rgba(255,255,255,0.6);text-align:center;padding:2rem;font-size:0.8rem;margin-top:4rem;}\nfooter a{color:#FF6B00;text-decoration:none;}\n</style>\n" +
    '</head>\n<body>\n\n<nav>\n  <a href="index.html" class="back">← Atharav Kitchen</a>\n  <a href="blog.html">📖 All Posts</a>\n</nav>\n\n' +
    '<div class="post-wrap">\n  <a href="blog.html" class="back-link">← Back to Blog</a>\n  \n  <div class="post-meta">Dhanbad Food Guide · ' +
    today +
    '</div>\n  \n  <h1>' +
    esc(d.h1 || d.title || '') +
    '</h1>\n\n' +
    (d.htmlBody || '') +
    '\n</div>\n\n' +
    '<footer>© Atharav Kitchen — Dhanbad. <a href="index.html">Order Now</a></footer>\n\n</body>\n</html>'
  );
}

function copyBlogDraftHtml(id) {
  var d = _blogDraftCache[id];
  if (!d) {
    toast('Draft data nahi mila, page refresh karo.', 'err');
    return;
  }
  var html = buildBlogHtmlFile(d);
  navigator.clipboard
    .writeText(html)
    .then(function () {
      toast(
        'Poori HTML file copy ho gayi — "blog-' +
          (d.slug || 'new-post') +
          '.html" naam se save karo!',
        'ok'
      );
    })
    .catch(function () {
      toast('Copy fail ho gaya — browser permission check karo.', 'err');
    });
}

function syncBestsellerTags() {
  var statusEl = document.getElementById('menu-intel-status');
  var previewEl = document.getElementById('menu-intel-preview');
  if (!akFirebaseReady || !firebase.auth || !firebase.auth().currentUser) {
    statusEl.innerHTML = '<span style="color:#DC2626;">⚠️ Firebase login session missing.</span>';
    return;
  }

  var orders = get(KEYS.orders, []);
  var menu = get(KEYS.menu, DEFAULT_MENU);
  var itemCount = {};
  orders.forEach(function (o) {
    if (o.items && typeof o.items === 'object' && !Array.isArray(o.items)) {
      Object.keys(o.items).forEach(function (k) {
        itemCount[k] = (itemCount[k] || 0) + (o.items[k].qty || 1);
      });
    } else if (typeof o.items === 'string') {
      o.items.split(',').forEach(function (i) {
        var nm = i.replace(/×\d+/, '').trim();
        if (nm) itemCount[nm] = (itemCount[nm] || 0) + 1;
      });
    }
  });

  // Rank: sabse zyada bikne wale sabse upar
  var ranked = menu.slice().sort(function (a, b) {
    return (itemCount[b.name] || 0) - (itemCount[a.name] || 0);
  });
  var topN = ranked.slice(0, Math.min(6, ranked.length)).map(function (i) {
    return i.name;
  });

  statusEl.innerHTML = '⏳ Firestore mein sync ho raha hai...';
  var batch = firebase.firestore().batch();
  ranked.forEach(function (item, idx) {
    var ref = firebase.firestore().collection('menu').doc(String(item.id));
    batch.set(
      ref,
      {
        orderCount: itemCount[item.name] || 0,
        menuRank: idx,
        bestseller: topN.includes(item.name),
      },
      { merge: true }
    );
  });
  batch
    .commit()
    .then(function () {
      statusEl.innerHTML =
        '<span style="color:#16A34A;">✅ Menu sync ho gaya! Website pe bestseller order se dikhega.</span>';
      previewEl.innerHTML =
        '<div style="font-size:0.72rem;font-weight:800;color:var(--text-light);text-transform:uppercase;letter-spacing:1px;margin-bottom:0.6rem;">Naya Order (top 8)</div>' +
        ranked
          .slice(0, 8)
          .map(function (item, i) {
            var tag = topN.includes(item.name) ? ' 🔥' : '';
            var thumbSrc = item.imgUrl || item.imgData || '';
            var thumb = thumbSrc
              ? '<img src="' + thumbSrc + '" class="ti-thumb" alt="">'
              : '<span class="ti-emoji">' +
                esc((item.name || '?').charAt(0).toUpperCase()) +
                '</span>';
            return (
              '<div class="top-item"><span class="ti-rank">#' +
              (i + 1) +
              '</span>' +
              thumb +
              '<span class="ti-name">' +
              esc(item.name) +
              tag +
              '</span><span class="ti-count">' +
              (itemCount[item.name] || 0) +
              ' orders</span></div>'
            );
          })
          .join('');
      toast('Menu bestseller tags sync ho gaye! 🔥', 'ok');
    })
    .catch(function (e) {
      statusEl.innerHTML =
        '<span style="color:#DC2626;">❌ ' + esc(e.message || String(e)) + '</span>';
    });
}

// ===== SECURITY LOG =====
function logSecurityEvent(type, detail) {
  try {
    var log = JSON.parse(localStorage.getItem('ak_security_log') || '[]');
    log.unshift({ type: type, detail: detail, ts: new Date().toLocaleString('en-IN') });
    if (log.length > 50) log = log.slice(0, 50);
    localStorage.setItem('ak_security_log', JSON.stringify(log));
  } catch (e) {}
}
function renderSecurityLog() {
  var body = document.getElementById('security-log-body');
  var log = [];
  try {
    log = JSON.parse(localStorage.getItem('ak_security_log') || '[]');
  } catch (e) {}
  if (!log.length) {
    body.innerHTML =
      '<div style="padding:1rem;color:var(--text-light);font-size:0.85rem;">Koi activity log nahi hai abhi.</div>';
    return;
  }
  var icons = { login_success: '✅', login_fail: '❌', logout: '🚪', lockout: '🔒' };
  body.innerHTML = log
    .map(function (l) {
      return (
        '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--border);font-size:0.82rem;">' +
        '<span>' +
        (icons[l.type] || '•') +
        ' ' +
        esc(l.detail || l.type) +
        '</span>' +
        '<span style="color:var(--text-light);">' +
        esc(l.ts) +
        '</span></div>'
      );
    })
    .join('');
}
function clearSecurityLog() {
  localStorage.removeItem('ak_security_log');
  renderSecurityLog();
  toast('Log clear ho gaya', 'ok');
}

// ===== EXPORT =====
function exportData() {
  var data = {
    menu: get(KEYS.menu, DEFAULT_MENU),
    offers: get(KEYS.offers, DEFAULT_OFFERS),
    feedback: get(KEYS.feedback, []),
    orders: get(KEYS.orders, []),
    riders: get(KEYS.riders, []),
    settings: get(KEYS.settings, DEFAULT_SETTINGS),
    banners: get(KEYS.banners, []),
    hero: get(KEYS.hero, {}),
    exportedAt: new Date().toISOString(),
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'atharav_kitchen_data_' + new Date().toISOString().split('T')[0] + '.json';
  a.click();
  toast('Data exported!', 'ok');
}
function refreshKPI() {
  renderDashboard();
  toast('KPI refreshed ✅', 'ok');
}

// ===== RESET =====
function resetAllData() {
  if (!confirm('⚠️ Reset ALL data? This is irreversible!')) return;
  if (!confirm('FINAL WARNING: All menu, orders, feedback, riders will be deleted!')) return;
  [
    KEYS.menu,
    KEYS.offers,
    KEYS.feedback,
    KEYS.banners,
    KEYS.settings,
    KEYS.hero,
    KEYS.ticker,
    KEYS.orders,
    KEYS.riders,
  ].forEach(function (k) {
    localStorage.removeItem(k);
  });
  toast('All data reset!', 'ok');
  setTimeout(function () {
    location.reload();
  }, 1500);
}

// ===== KITCHEN STATUS TOGGLE (topbar) =====
// FIX: This used to be localStorage-only, so toggling it here never actually
// reached the customer site (different browser/device = different localStorage).
// Now also pushes to Firestore settings/store, which app.js listens to live.
function pushKitchenStatusToFirestore(ordersOpen) {
  if (!akFirebaseReady) return;
  firebase
    .firestore()
    .collection('settings')
    .doc('store')
    .set({ orders: ordersOpen }, { merge: true })
    .catch(function (e) {
      toast('⚠️ Kitchen status cloud sync failed: ' + e.message, 'err');
    });
}
var kitchenStatusUnsub = null;
function startKitchenStatusListener() {
  if (!akFirebaseReady || kitchenStatusUnsub) return;
  kitchenStatusUnsub = firebase
    .firestore()
    .collection('settings')
    .doc('store')
    .onSnapshot(function (snap) {
      var isOpen = snap.exists ? snap.data().orders !== false : true;
      var s = get(KEYS.settings, DEFAULT_SETTINGS);
      s.orders = isOpen;
      set(KEYS.settings, s);
      updateKitchenStatusBtn(isOpen);
    });
}
function toggleKitchenStatus() {
  var s = get(KEYS.settings, DEFAULT_SETTINGS);
  s.orders = !s.orders;
  s.live = s.orders;
  set(KEYS.settings, s);
  pushKitchenStatusToFirestore(s.orders);
  updateKitchenStatusBtn(s.orders);
  toast(
    s.orders
      ? '✅ Kitchen is now ONLINE — accepting orders!'
      : '🔴 Kitchen is now OFFLINE (site par turant reflect hoga)',
    'ok'
  );
}
function updateKitchenStatusBtn(isOnline) {
  var btn = document.getElementById('kitchen-status-btn');
  var txt = document.getElementById('kitchen-status-txt');
  if (!btn) return;
  btn.className = 'status-toggle-btn ' + (isOnline ? 'online' : 'offline');
  txt.textContent = isOnline ? 'Online' : 'Offline';
}

// ===== ACCEPT / REJECT ORDER =====
function quickStatus(id, newStatus) {
  var orders = get(KEYS.orders, []);
  var idx = orders.findIndex(function (o) {
    return o.id === id;
  });
  if (idx < 0) {
    toast('Order not found', 'err');
    return;
  }
  var o = orders[idx];
  o.status = newStatus;
  if (newStatus === 'Delivered') o.deliveredAt = new Date().toLocaleTimeString('en-IN');
  set(KEYS.orders, orders);
  // Firebase sync
  if (akFirebaseReady) {
    firebase
      .firestore()
      .collection('orders')
      .doc(String(id))
      .update({ status: newStatus, deliveredAt: o.deliveredAt || null })
      .catch(function () {});
  }
  // WhatsApp customer notify
  var statusMsg = {
    Confirmed: '✅ Aapka order *confirm* ho gaya! Hum prepare kar rahe hain 👨‍🍳',
    Preparing: '👨‍🍳 Aapka order *kitchen mein ban raha hai!* Thoda wait karo 🙏',
    'Out for Delivery': '🛵 Aapka order *raste mein hai!* Delivery boy aa raha hai.',
    Delivered:
      '🎉 Aapka order *deliver ho gaya!* Khana enjoy karo 😋\n\n⭐ 2 min mein rating do: https://atharav-kitchen.pages.dev',
  };
  if (o.phone && statusMsg[newStatus]) {
    var waMsg =
      'Namaste *' +
      (o.name || '') +
      '* ji! 🙏\n\n' +
      statusMsg[newStatus] +
      '\n\n📦 Order #' +
      o.id +
      '\n\n— Atharav Kitchen 🍽️';
    window.open(
      'https://wa.me/91' +
        (o.phone || '').replace(/[^0-9]/g, '') +
        '?text=' +
        encodeURIComponent(waMsg),
      '_blank'
    );
  }
  renderOrdersTable();
  updateBadges();
  toast('Order #' + id + ' → ' + newStatus, 'ok');
  sendPushForOrderStatus(o, newStatus);
}
function sendPushForOrderStatus(order, newStatus) {
  var workerUrl = (localStorage.getItem('ak_notify_worker_url') || '').trim();

  // Worker URL not set — admin panel mein site settings mein daalo
  if (!workerUrl) {
    console.info('[AK Push] Worker URL not set. Admin panel → Site Settings → Push Notifications mein daalo.');
    return;
  }

  // Customer ne notification allow nahi kiya — silently skip, no error
  if (!order.fcmToken) {
    console.info('[AK Push] Order #' + order.id + ': Customer ne notification allow nahi kiya (no FCM token).');
    return;
  }

  var pushMsgMap = {
    Confirmed: { title: '✅ Order Confirmed!', body: 'Aapka order confirm ho gaya! Kitchen mein prepare ho raha hai 👨‍🍳' },
    Preparing: { title: '🍳 Khana Ban Raha Hai!', body: 'Aapka order kitchen mein tayyar ho raha hai!' },
    'Out for Delivery': { title: '🛵 Rider Raste Mein!', body: 'Delivery boy aapke ghar ki taraf aa raha hai. Thoda wait karo!' },
    Delivered: { title: '🎉 Order Delivered!', body: 'Atharav Kitchen ka khana mil gaya! Enjoy karo aur review zaroor do 😋' },
    Cancelled: { title: '❌ Order Cancelled', body: 'Aapka order cancel ho gaya. Koi issue? WhatsApp: 7903567007' },
  };

  var notif = pushMsgMap[newStatus];
  if (!notif) return; // Status pe notification nahi bhejni

  if (!akFirebaseReady || !firebase.auth().currentUser) {
    console.warn('[AK Push] Admin auth missing — push not sent');
    return;
  }

  firebase.auth().currentUser.getIdToken()
    .then(function (idToken) {
      return fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: idToken,
          fcmToken: order.fcmToken,
          title: notif.title,
          message: notif.body,
          orderId: order.id,
        }),
      });
    })
    .then(function (r) {
      if (!r.ok) {
        return r.json().then(function (d) {
          console.warn('[AK Push] FCM send failed:', d.error || r.status);
        });
      }
      console.info('[AK Push] ✅ Notification sent for order #' + order.id + ' → ' + newStatus);
    })
    .catch(function (e) {
      console.warn('[AK Push] Network error:', e.message || e);
    });
}

function acceptOrder(id) {
  var orders = get(KEYS.orders, []);
  var idx = orders.findIndex(function (o) {
    return o.id === id;
  });
  if (idx < 0) {
    toast('Order not found', 'err');
    return;
  }
  var order = orders[idx];

  // FIX 2A: Auto-assign available rider
  var riders = get(KEYS.riders, []);
  var availableRider = riders.find(function (r) {
    return r.status === 'online' && !r.currentOrderId;
  });
  if (availableRider && !order.deliveredBy) {
    order.deliveredBy = availableRider.name;
    order.riderId = availableRider.id || availableRider.name;
    order.riderPhone = availableRider.phone || null;
    // Mark rider as busy
    var rIdx = riders.findIndex(function (r) {
      return r.id === availableRider.id || r.name === availableRider.name;
    });
    if (rIdx > -1) {
      riders[rIdx].currentOrderId = id;
      set(KEYS.riders, riders);
    }
    if (akFirebaseReady) {
      firebase
        .firestore()
        .collection('riders')
        .doc(String(availableRider.id || availableRider.name))
        .update({ currentOrderId: id })
        .catch(function () {});
    }
    toast('🛵 Rider ' + availableRider.name + ' auto-assigned!', 'ok');
  }

  order.status = 'Confirmed';
  orders[idx] = order;
  set(KEYS.orders, orders);

  // FIX 2B: Send WhatsApp confirmation to customer
  if (order.phone) {
    var custPhone = String(order.phone).replace(/[^0-9]/g, '');
    if (custPhone.length >= 10) {
      // Build full bill confirmation message for customer
      var bill = order.bill || {};
      var wamsg = '✅ *ORDER CONFIRMED — ATHARAV KITCHEN* 🎉\n\n';
      wamsg += 'Hi *' + order.name + '*! Aapka order accept ho gaya! 🍽️\n\n';
      wamsg += '🆔 *Order ID: ' + order.id + '*\n';
      wamsg += '━━━━━━━━━━━━━━━━━━\n';
      wamsg += '📋 *ORDER ITEMS:*\n';
      var items = order.items || {};
      if (typeof items === 'object' && !Array.isArray(items)) {
        Object.entries(items).forEach(function (e) {
          var it = e[1];
          wamsg +=
            '• ' + e[0] + ' × ' + (it.qty || 1) + ' = ₹' + (it.qty || 1) * (it.price || 0) + '\n';
        });
      } else if (Array.isArray(items)) {
        items.forEach(function (it) {
          wamsg += '• ' + it.name + ' × ' + it.qty + ' = ₹' + it.qty * it.price + '\n';
        });
      }
      wamsg += '\n💰 *BILL:*\n';
      if (bill.subtotal) wamsg += 'Subtotal: ₹' + bill.subtotal + '\n';
      if (bill.discount > 0) wamsg += 'Discount: -₹' + bill.discount + '\n';
      if (bill.delivery === 0) wamsg += 'Delivery: FREE 🎉\n';
      else if (bill.delivery) wamsg += 'Delivery: ₹' + bill.delivery + '\n';
      if (bill.gst) wamsg += 'GST (5%): ₹' + bill.gst + '\n';
      wamsg += '━━━━━━━━━━━━━━━━━━\n';
      wamsg += '*TOTAL: ₹' + (bill.total || order.total || '—') + '*\n';
      wamsg +=
        'Payment: ' + (order.payment === 'cod' ? '💵 Cash on Delivery' : '📱 UPI/Online') + '\n\n';
      if (order.deliveredBy) wamsg += '🛵 *Rider: ' + order.deliveredBy + '* assigned!\n';
      wamsg += '⏰ *Delivery: 30-45 minutes*\n\n';
      wamsg += '📍 Deliver hoga:\n' + order.address + '\n\n';
      wamsg += '📞 Koi issue? Call/WhatsApp: +91 79035 67007\n';
      wamsg += '_Atharav Kitchen — Taste That Travels Fast!_ 🏆';
      // Open WhatsApp to customer
      window.open('https://wa.me/' + custPhone + '?text=' + encodeURIComponent(wamsg), '_blank');
    }
  }

  if (akFirebaseReady) {
    firebase
      .firestore()
      .collection('orders')
      .doc(id)
      .update({
        status: 'Confirmed',
        deliveredBy: order.deliveredBy || null,
        riderId: order.riderId || null,
        riderPhone: order.riderPhone || null,
      })
      .then(function () {
        renderOrdersTable();
        renderRiders();
        renderDeliveries();
        updateBadges();
        playOrderSound('accept');
        toast('✅ Order ' + id + ' Confirmed! Customer ko WhatsApp bheja.', 'ok');
      })
      .catch(function (e) {
        toast('Accept failed: ' + e.message, 'err');
      });
    return;
  }
  renderOrdersTable();
  renderRiders();
  renderDeliveries();
  updateBadges();
  playOrderSound('accept');
  toast('✅ Order ' + id + ' Confirmed! Customer ko WhatsApp bheja.', 'ok');
}
function rejectOrder(id) {
  if (!confirm('Reject order ' + id + '? Customer ko WhatsApp notification bhejega.')) return;
  var orders = get(KEYS.orders, []);
  var idx = orders.findIndex(function (o) {
    return o.id === id;
  });
  if (idx < 0) {
    toast('Order not found', 'err');
    return;
  }
  var order = orders[idx];
  orders[idx].status = 'Cancelled';
  set(KEYS.orders, orders);
  // FIX 2B: Notify customer via WhatsApp
  if (order.phone) {
    var custPhone = String(order.phone).replace(/[^0-9]/g, '');
    if (custPhone.length >= 10) {
      var wamsg =
        '❌ *ORDER UPDATE — ATHARAV KITCHEN*\n\nHi *' +
        order.name +
        '*,\n\nDukhkh ke saath batana pad raha hai ki aapka order *#' +
        order.id +
        '* abhi process nahi ho pa raha.\n\nKaran: Kitchen overloaded ya item unavailable.\n\n🔄 Dobara order karne ke liye:\n📱 wa.me/917903567007\n📞 +91 79035 67007\n\nMaafi chahte hain. Agli baar better service milegi! 🙏\n\n_Atharav Kitchen — Taste That Travels Fast_';
      window.open('https://wa.me/' + custPhone + '?text=' + encodeURIComponent(wamsg), '_blank');
    }
  }
  if (akFirebaseReady) {
    firebase
      .firestore()
      .collection('orders')
      .doc(id)
      .update({ status: 'Cancelled' })
      .then(function () {
        renderOrdersTable();
        updateBadges();
        toast('❌ Order ' + id + ' Cancelled. Customer ko WhatsApp bheja.', 'err');
      })
      .catch(function (e) {
        toast(e.message, 'err');
      });
    return;
  }
  renderOrdersTable();
  updateBadges();
  toast('❌ Order ' + id + ' Cancelled. Customer ko WhatsApp bheja.', 'err');
}

// ===== NOTIFICATION SOUND (Web Audio — no file needed) =====
function playOrderSound(type) {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (type === 'new') {
      // Zomato-style 3-ding
      [0, 0.18, 0.36].forEach(function (t) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0, ctx.currentTime + t);
        gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.35);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.4);
      });
    } else {
      // Single soft confirm beep
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = type === 'accept' ? 660 : 330;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    }
  } catch (e) {}
}

/* ===== CUSTOMER LIST ===== */
// ===== REFERRAL CLAIMS PROCESSING =====
// Naye customers referral code use karte waqt sirf ek "claim" banate hain
// (kisi ke wallet mein directly likh nahi sakte — fraud-safe design).
// Admin panel yeh claims process karta hai jab khulta hai, aur referrer
// ko ₹50 credit karta hai (admin ke already-trusted Firestore access se).
function processReferralClaims() {
  if (!akFirebaseReady) return;
  firebase
    .firestore()
    .collection('referral_claims')
    .where('status', '==', 'pending')
    .get()
    .then(function (snap) {
      if (snap.empty) return;
      var db = firebase.firestore();
      var FV = firebase.firestore.FieldValue;
      var processed = 0;
      snap.forEach(function (claimDoc) {
        var claim = claimDoc.data();
        db.collection('customers')
          .where('referralCode', '==', claim.code)
          .limit(1)
          .get()
          .then(function (custSnap) {
            if (custSnap.empty || custSnap.docs[0].id === claim.newCustomerId) {
              return claimDoc.ref.update({
                status: 'skipped',
                reason: custSnap.empty ? 'code_not_found' : 'self_referral',
              });
            }
            var referrerId = custSnap.docs[0].id;
            db.collection('wallets')
              .doc(referrerId)
              .set(
                {
                  points: FV.increment(100),
                  history: FV.arrayUnion({
                    type: 'referral_bonus',
                    pts: 100,
                    date: new Date().toISOString(),
                    note: 'Referral: ' + (claim.newCustomerName || 'Naya customer'),
                  }),
                },
                { merge: true }
              );
            db.collection('referral_stats')
              .doc(referrerId)
              .set(
                {
                  count: FV.increment(1),
                  earned: FV.increment(50),
                },
                { merge: true }
              );
            claimDoc.ref.update({ status: 'done', referrerId: referrerId });
            processed++;
          })
          .catch(function (e) {
            console.warn('Referral claim process failed', e);
          });
      });
    })
    .catch(function (e) {
      console.warn('Could not load referral claims', e);
    });
}

// ===== KITCHEN GALLERY (Hygiene Photos) =====
function handleKitchenGalleryUpload(e) {
  var file = e.target.files[0];
  if (!file) return;
  var statusEl = document.getElementById('kg-status');
  if (!window.akStorage || !akFirebaseReady || !firebase.auth().currentUser) {
    statusEl.innerHTML =
      '<span style="color:#DC2626;">⚠️ Storage/login ready nahi hai — thoda ruk kar try karo.</span>';
    return;
  }
  statusEl.innerHTML = '⏳ Upload ho raha hai...';
  var path = 'kitchen-gallery/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.]/g, '_');
  window.akStorage
    .ref(path)
    .put(file, { contentType: file.type || 'image/jpeg' })
    .then(function (snap) {
      return snap.ref.getDownloadURL();
    })
    .then(function (url) {
      return firebase
        .firestore()
        .collection('settings')
        .doc('kitchen_gallery')
        .get()
        .then(function (doc) {
          var images = (doc.exists && doc.data().images) || [];
          images.push(url);
          if (images.length > 8) images = images.slice(images.length - 8);
          return firebase
            .firestore()
            .collection('settings')
            .doc('kitchen_gallery')
            .set({ images: images }, { merge: true })
            .then(function () {
              return images;
            });
        });
    })
    .then(function (images) {
      statusEl.innerHTML =
        '<span style="color:#16A34A;font-weight:800;">✅ Photo add ho gayi!</span>';
      renderKitchenGalleryAdmin(images);
      document.getElementById('kg-file').value = '';
    })
    .catch(function (err) {
      statusEl.innerHTML =
        '<span style="color:#DC2626;">❌ ' + esc(String(err.message || err)) + '</span>';
    });
}
function renderKitchenGalleryAdmin(images) {
  var grid = document.getElementById('kg-gallery-grid');
  if (!grid) return;
  if (!images.length) {
    grid.innerHTML =
      '<div style="grid-column:1/-1;text-align:center;color:var(--text-light);font-size:0.78rem;padding:1rem 0;">Koi photo nahi hai abhi</div>';
    return;
  }
  grid.innerHTML = images
    .map(function (url, i) {
      return (
        '<div style="position:relative;border-radius:8px;overflow:hidden;aspect-ratio:1;background:var(--cream);">' +
        '<img src="' +
        url +
        '" style="width:100%;height:100%;object-fit:cover;" loading="lazy">' +
        '<button onclick="deleteKitchenGalleryImage(' +
        i +
        ')" title="Delete" style="position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.6);border:none;color:#fff;width:22px;height:22px;border-radius:50%;font-size:0.8rem;cursor:pointer;line-height:1;">×</button></div>'
      );
    })
    .join('');
}
function deleteKitchenGalleryImage(idx) {
  firebase
    .firestore()
    .collection('settings')
    .doc('kitchen_gallery')
    .get()
    .then(function (doc) {
      var images = (doc.exists && doc.data().images) || [];
      images.splice(idx, 1);
      return firebase
        .firestore()
        .collection('settings')
        .doc('kitchen_gallery')
        .set({ images: images }, { merge: true })
        .then(function () {
          return images;
        });
    })
    .then(function (images) {
      renderKitchenGalleryAdmin(images);
      toast('Photo hata di gayi', 'ok');
    });
}
function loadKitchenGalleryAdmin() {
  if (!akFirebaseReady) {
    var g = document.getElementById('kg-gallery-grid');
    if (g)
      g.innerHTML =
        '<div style="grid-column:1/-1;text-align:center;color:var(--text-light);font-size:0.78rem;">Firebase load ho raha hai...</div>';
    return;
  }
  firebase
    .firestore()
    .collection('settings')
    .doc('kitchen_gallery')
    .get()
    .then(function (doc) {
      renderKitchenGalleryAdmin((doc.exists && doc.data().images) || []);
    })
    .catch(function () {});
}

var _allCustomers = [];
function loadCustomerList() {
  var wrap = document.getElementById('customer-list-body');
  if (wrap)
    wrap.innerHTML = '<div style="padding:2rem;text-align:center;">⏳ Loading customers...</div>';

  function renderCustomers(customers) {
    _allCustomers = customers;
    filterCustomerList('');
    // Stats
    var statsDiv = document.getElementById('cust-stats');
    if (statsDiv) {
      var total = customers.length;
      var withOrders = customers.filter(function (c) {
        return c.orders && c.orders.length > 0;
      }).length;
      var totalRev = customers.reduce(function (s, c) {
        return (
          s +
          (c.orders || []).reduce(function (ss, o) {
            return ss + (o.total || 0);
          }, 0)
        );
      }, 0);
      statsDiv.innerHTML =
        '<div style="background:#fff;border:2px solid var(--border);border-radius:12px;padding:1rem 1.5rem;flex:1;min-width:140px;text-align:center;">' +
        '<div style="font-size:1.6rem;font-weight:900;color:var(--saffron);">' +
        total +
        '</div>' +
        '<div style="font-size:0.75rem;font-weight:700;color:var(--text-light);">Total Registered</div></div>' +
        '<div style="background:#fff;border:2px solid var(--border);border-radius:12px;padding:1rem 1.5rem;flex:1;min-width:140px;text-align:center;">' +
        '<div style="font-size:1.6rem;font-weight:900;color:#16A34A;">' +
        withOrders +
        '</div>' +
        '<div style="font-size:0.75rem;font-weight:700;color:var(--text-light);">Ordered At Least Once</div></div>' +
        '<div style="background:#fff;border:2px solid var(--border);border-radius:12px;padding:1rem 1.5rem;flex:1;min-width:140px;text-align:center;">' +
        '<div style="font-size:1.6rem;font-weight:900;color:#7C3AED;">₹' +
        totalRev +
        '</div>' +
        '<div style="font-size:0.75rem;font-weight:700;color:var(--text-light);">Total Revenue</div></div>';
    }
  }

  function buildRows(customers) {
    if (!customers.length)
      return '<div style="padding:2rem;text-align:center;color:var(--text-light);">No customers found</div>';
    var html = '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;">';
    html +=
      '<thead><tr style="background:var(--cream);font-size:0.72rem;font-weight:800;color:var(--text-mid);">' +
      '<th style="padding:10px 14px;text-align:left;">NAME</th>' +
      '<th style="padding:10px 14px;text-align:left;">PHONE</th>' +
      '<th style="padding:10px 14px;text-align:center;">ORDERS</th>' +
      '<th style="padding:10px 14px;text-align:right;">TOTAL SPENT</th>' +
      '<th style="padding:10px 14px;text-align:left;">LAST ORDER</th>' +
      '<th style="padding:10px 14px;text-align:center;">WELCOME COUPON</th>' +
      '</tr></thead><tbody>';
    customers.forEach(function (cu, i) {
      var orderCount = (cu.orders || []).length;
      var totalSpent = (cu.orders || []).reduce(function (s, o) {
        return s + (o.total || 0);
      }, 0);
      var lastOrder = cu.lastOrder || '—';
      var couponUsed = cu.welcomeCodeUsed ? '✅ Used' : '⏳ Unused';
      var couponColor = cu.welcomeCodeUsed ? '#16A34A' : '#D97706';
      var bg = i % 2 === 0 ? '#fff' : '#FAFAF7';
      html +=
        '<tr style="background:' +
        bg +
        ';border-bottom:1px solid var(--border);">' +
        '<td style="padding:10px 14px;font-weight:700;color:var(--deep-brown);">' +
        esc(cu.name || '—') +
        '</td>' +
        '<td style="padding:10px 14px;color:var(--text-mid);">' +
        esc(cu.phone || '—') +
        '</td>' +
        '<td style="padding:10px 14px;text-align:center;font-weight:800;color:var(--saffron);">' +
        orderCount +
        '</td>' +
        '<td style="padding:10px 14px;text-align:right;font-weight:800;color:#16A34A;">₹' +
        totalSpent +
        '</td>' +
        '<td style="padding:10px 14px;color:var(--text-light);font-size:0.75rem;">' +
        esc(lastOrder) +
        '</td>' +
        '<td style="padding:10px 14px;text-align:center;font-weight:700;color:' +
        couponColor +
        ';">' +
        couponUsed +
        '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  // Try Firebase first
  if (akFirebaseReady) {
    firebase
      .firestore()
      .collection('customers')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get()
      .then(function (snap) {
        var customers = [];
        snap.forEach(function (doc) {
          customers.push(Object.assign({ id: doc.id }, doc.data()));
        });
        if (!customers.length) {
          // Fallback to localStorage
          customers = get('ak_customers', []);
        }
        renderCustomers(customers);
        var wrap2 = document.getElementById('customer-list-body');
        if (wrap2) wrap2.innerHTML = buildRows(customers);
      })
      .catch(function () {
        var customers = get('ak_customers', []);
        renderCustomers(customers);
        var wrap2 = document.getElementById('customer-list-body');
        if (wrap2) wrap2.innerHTML = buildRows(customers);
      });
  } else {
    var customers = get('ak_customers', []);
    renderCustomers(customers);
    var wrap2 = document.getElementById('customer-list-body');
    if (wrap2) wrap2.innerHTML = buildRows(customers);
  }
}

function filterCustomerList(q) {
  q = (q || '').toLowerCase().trim();
  var filtered = !q
    ? _allCustomers
    : _allCustomers.filter(function (c) {
        return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
      });
  var wrap = document.getElementById('customer-list-body');
  if (!wrap) return;
  // Rebuild rows inline
  if (!filtered.length) {
    wrap.innerHTML =
      '<div style="padding:2rem;text-align:center;color:var(--text-light);">No customers match "' +
      q +
      '"</div>';
    return;
  }
  var html = '<table style="width:100%;border-collapse:collapse;font-size:0.82rem;">';
  html +=
    '<thead><tr style="background:var(--cream);font-size:0.72rem;font-weight:800;color:var(--text-mid);">' +
    '<th style="padding:10px 14px;text-align:left;">NAME</th><th style="padding:10px 14px;text-align:left;">PHONE</th>' +
    '<th style="padding:10px 14px;text-align:center;">ORDERS</th><th style="padding:10px 14px;text-align:right;">TOTAL SPENT</th>' +
    '<th style="padding:10px 14px;text-align:left;">LAST ORDER</th><th style="padding:10px 14px;text-align:center;">WELCOME COUPON</th>' +
    '</tr></thead><tbody>';
  filtered.forEach(function (cu, i) {
    var orderCount = (cu.orders || []).length;
    var totalSpent = (cu.orders || []).reduce(function (s, o) {
      return s + (o.total || 0);
    }, 0);
    var lastOrder = cu.lastOrder || '—';
    var couponUsed = cu.welcomeCodeUsed ? '✅ Used' : '⏳ Unused';
    var couponColor = cu.welcomeCodeUsed ? '#16A34A' : '#D97706';
    var bg = i % 2 === 0 ? '#fff' : '#FAFAF7';
    html +=
      '<tr style="background:' +
      bg +
      ';border-bottom:1px solid var(--border);">' +
      '<td style="padding:10px 14px;font-weight:700;color:var(--deep-brown);">' +
      esc(cu.name || '—') +
      '</td>' +
      '<td style="padding:10px 14px;color:var(--text-mid);">' +
      esc(cu.phone || '—') +
      '</td>' +
      '<td style="padding:10px 14px;text-align:center;font-weight:800;color:var(--saffron);">' +
      orderCount +
      '</td>' +
      '<td style="padding:10px 14px;text-align:right;font-weight:800;color:#16A34A;">₹' +
      totalSpent +
      '</td>' +
      '<td style="padding:10px 14px;color:var(--text-light);font-size:0.75rem;">' +
      esc(lastOrder) +
      '</td>' +
      '<td style="padding:10px 14px;text-align:center;font-weight:700;color:' +
      couponColor +
      ';">' +
      couponUsed +
      '</td>' +
      '</tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
document.querySelectorAll('.modal-bg').forEach(function (bg) {
  bg.addEventListener('click', function (e) {
    if (e.target === bg) bg.classList.remove('open');
  });
});

/* ===== PROMO VIDEO BANNER ===== */
function getYouTubeId(url) {
  var m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}
function buildEmbedUrl(url, muted) {
  var ytId = getYouTubeId(url);
  if (ytId) {
    return (
      'https://www.youtube.com/embed/' +
      ytId +
      '?autoplay=1&loop=1&playlist=' +
      ytId +
      '&controls=1&rel=0' +
      (muted ? '&mute=1' : '')
    );
  }
  return null; // direct video
}
function loadPromoVideoSettings() {
  var pv = get(KEYS.promo_video, null);
  if (!pv) return;
  if (document.getElementById('promo-video-url'))
    document.getElementById('promo-video-url').value = pv.url || '';
  if (document.getElementById('promo-video-title'))
    document.getElementById('promo-video-title').value = pv.title || '';
  if (document.getElementById('promo-video-subtitle'))
    document.getElementById('promo-video-subtitle').value = pv.subtitle || '';
  if (document.getElementById('promo-video-active'))
    document.getElementById('promo-video-active').checked = !!pv.active;
  if (document.getElementById('promo-video-muted'))
    document.getElementById('promo-video-muted').checked = pv.muted !== false;
  if (pv.url) renderPromoPreview(pv.url, pv.muted !== false);
}
function renderPromoPreview(url, muted) {
  var previewDiv = document.getElementById('promo-video-preview');
  var inner = document.getElementById('promo-preview-inner');
  if (!previewDiv || !inner || !url) {
    if (previewDiv) previewDiv.style.display = 'none';
    return;
  }
  var ytId = getYouTubeId(url);
  if (ytId) {
    inner.innerHTML =
      '<iframe src="' +
      buildEmbedUrl(url, muted) +
      '" style="position:absolute;inset:0;width:100%;height:100%;border:0;" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
  } else {
    inner.innerHTML =
      '<video src="' +
      url +
      '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" controls' +
      (muted ? ' muted' : '') +
      '></video>';
  }
  previewDiv.style.display = 'block';
}
function savePromoVideo() {
  var url = (document.getElementById('promo-video-url').value || '').trim();
  if (!url) {
    toast('Video URL daalo!', 'err');
    return;
  }
  var title = (document.getElementById('promo-video-title').value || '').trim();
  var subtitle = (document.getElementById('promo-video-subtitle').value || '').trim();
  var active = document.getElementById('promo-video-active').checked;
  var muted = document.getElementById('promo-video-muted').checked;
  var pv = {
    url: url,
    title: title,
    subtitle: subtitle,
    active: active,
    muted: muted,
    updatedAt: Date.now(),
  };
  set(KEYS.promo_video, pv);
  renderPromoPreview(url, muted);
  // Also save to Firebase if available — show REAL result, don't fake success
  if (akFirebaseReady) {
    firebase
      .firestore()
      .collection('settings')
      .doc('promo_video')
      .set(pv)
      .then(function () {
        toast('Video banner saved! Customer site pe dikhai dega. ✅', 'ok');
      })
      .catch(function (e) {
        toast(
          '⚠️ Cloud save FAILED: ' +
            e.message +
            ' — sirf is browser mein saved hai, customers ko nahi dikhega!',
          'err'
        );
      });
  } else {
    toast(
      '⚠️ Firebase connect nahi hai — sirf is browser mein saved hai (offline demo mode)',
      'err'
    );
  }
}
function clearPromoVideo() {
  if (!confirm('Video banner remove karna chahte ho?')) return;
  set(KEYS.promo_video, null);
  if (akFirebaseReady) {
    firebase
      .firestore()
      .collection('settings')
      .doc('promo_video')
      .delete()
      .then(function () {
        toast('Banner removed everywhere ✅', 'ok');
      })
      .catch(function (e) {
        toast('⚠️ Cloud delete FAILED: ' + e.message, 'err');
      });
  }
  document.getElementById('promo-video-url').value = '';
  document.getElementById('promo-video-title').value = '';
  document.getElementById('promo-video-subtitle').value = '';
  document.getElementById('promo-video-active').checked = false;
  document.getElementById('promo-video-preview').style.display = 'none';
  toast('Video banner removed!', 'ok');
}
