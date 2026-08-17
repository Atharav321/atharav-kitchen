/* ============================================================
   ATHARAV KITCHEN — RIDER APP
   Extracted from legacy rider.html inline <script> (lines 449-1126)
   ============================================================ */
/* ============================================================
   ATHARAV KITCHEN — RIDER APP v3.0
   Fully synced with admin.html via localStorage
   All bugs fixed: login, customer details, delivery tracking
   ============================================================ */

// ---- CONFIG ----
var KITCHEN_LAT = 23.7957;
var KITCHEN_LNG = 86.4304;
var KITCHEN_ADDR = 'Atharav Kitchen, Bank More, Dhanbad, Jharkhand';
var GMAPS_KEY = window.__ENV_GMAPS_KEY || 'AIzaSyD7Vb4zFHfzsI79BbHjZTIi0s8Asxte6rI';

var firebaseConfig = window.FIREBASE_CONFIG || {};
var akFirebaseReady = false;
var ordersLive = [];
var fbOrdersUnsub = null;

function tryInitFirebaseRider() {
  try {
    if (!firebase || !window.isAkFirebaseConfigured || !window.isAkFirebaseConfigured()) return;
    firebaseConfig = window.FIREBASE_CONFIG;
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    akFirebaseReady = true;
  } catch (e) {
    console.warn('Firebase init failed', e);
  }
}
// NOTE: tryInitFirebaseRider() is NOT called eagerly here anymore — Firebase
// compat scripts load asynchronously (see firebase-config.js), so calling it
// at parse time referenced the global `firebase` before it existed, throwing
// "ReferenceError: firebase is not defined" on every rider.html load. The
// akFirebaseReady listener below already calls it once Firebase is ready.
window.addEventListener('akFirebaseReady', function () {
  if (!akFirebaseReady) tryInitFirebaseRider();
});

function startRiderFirestoreOrders() {
  if (!akFirebaseReady) return;
  if (fbOrdersUnsub) {
    fbOrdersUnsub();
    fbOrdersUnsub = null;
  }
  fbOrdersUnsub = firebase
    .firestore()
    .collection('orders')
    .limit(200)
    .onSnapshot(
      function (snap) {
        ordersLive = snap.docs.map(function (d) {
          var x = d.data() || {};
          if (!x.id) x.id = d.id;
          return x;
        });
        ordersLive.sort(function (a, b) {
          return (b.createdAtMs || 0) - (a.createdAtMs || 0);
        });
        renderOrdersList();
        updateEarnings();
        checkNewOrders();
      },
      function () {
        rToast('Orders sync error — check Firebase config');
      }
    );
}

// ---- STATE ----
var riderName = '';
var riderData = null; // full rider object from admin
var isOnline = false;
var currentFilter = 'all';
var activeOrderId = null;
var shiftStart = null;
var refreshTimer = null;
var nomTimer = null;
var riderMap = null;
var riderMarker = null;
var destMarker = null;
var dirRenderer = null;
var lastNewCount = 0;
var pendingNomId = null;

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
function rToast(msg) {
  var t = document.getElementById('rider-toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(function () {
    t.classList.remove('show');
  }, 2800);
}
function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---- POPULATE RIDER DROPDOWN ----
function populateRiderDropdown() {
  var riders = lsGet('ak_riders', []);
  var sel = document.getElementById('l-name');
  sel.innerHTML = '<option value="">— Select Rider —</option>';
  if (riders.length === 0) {
    sel.innerHTML += '<option value="" disabled>No riders added yet. Ask admin.</option>';
  } else {
    riders.forEach(function (r) {
      sel.innerHTML += '<option value="' + esc(r.name) + '">' + esc(r.name) + '</option>';
    });
  }
}

// ---- LOGIN ----
function doLogin() {
  var name = document.getElementById('l-name').value.trim();
  var pin = document.getElementById('l-pin').value.trim();
  var err = document.getElementById('login-err');

  if (!name) {
    showLoginErr('Please select your name!');
    return;
  }
  if (!pin) {
    showLoginErr('Please enter your PIN!');
    return;
  }

  var riders = lsGet('ak_riders', []);
  var rider = riders.find(function (r) {
    return r.name === name;
  });

  if (!rider) {
    showLoginErr('Rider not found. Ask admin to add you.');
    return;
  }
  if (String(rider.pin) !== String(pin)) {
    showLoginErr('Wrong PIN! Contact admin.');
    return;
  }

  // Success
  riderName = name;
  riderData = rider;
  shiftStart = new Date().toLocaleTimeString('en-IN');

  // Update rider online status in admin data
  updateRiderOnlineStatus(true);

  // Setup UI
  document.getElementById('ah-name').textContent = name;
  document.getElementById('ah-avatar').textContent = name[0].toUpperCase();
  document.getElementById('ah-shift').textContent = 'Shift: ' + shiftStart;
  document.getElementById('ph-name').textContent = name;
  document.getElementById('ph-id').textContent =
    'ID: AK-' + name.toUpperCase().replace(/\s/g, '').slice(0, 6);
  document.getElementById('ph-avatar').textContent = name[0].toUpperCase();
  document.getElementById('ps-shift').textContent = shiftStart;
  document.getElementById('ps-vehicle').textContent = rider.vehicle || '—';
  document.getElementById('ps-phone').textContent = rider.phone || '—';
  var perPay = lsGet('ak_settings', {}).riderpay || 30;
  document.getElementById('ec-perpay').textContent = '₹' + perPay;

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').classList.add('active');
  document.getElementById('conn-bar').classList.add('show');
  err.style.display = 'none';

  renderOrdersList();
  updateEarnings();
  startAutoRefresh();
  startRiderFirestoreOrders();
  rToast('Welcome ' + name + '! Ready to deliver 🛵');
}

function showLoginErr(msg) {
  var e = document.getElementById('login-err');
  e.textContent = msg;
  e.style.display = 'block';
  setTimeout(function () {
    e.style.display = 'none';
  }, 4000);
}

function doLogout() {
  if (!confirm('End shift and logout?')) return;
  if (fbOrdersUnsub) {
    fbOrdersUnsub();
    fbOrdersUnsub = null;
  }
  ordersLive = [];
  updateRiderOnlineStatus(false);
  isOnline = false;
  clearInterval(refreshTimer);
  riderName = '';
  riderData = null;
  document.getElementById('app-screen').classList.remove('active');
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('l-pin').value = '';
  populateRiderDropdown();
}

// ---- RIDER ONLINE STATUS → syncs to admin ----
function updateRiderOnlineStatus(status) {
  var riders = lsGet('ak_riders', []);
  var idx = riders.findIndex(function (r) {
    return r.name === riderName;
  });
  if (idx > -1) {
    riders[idx].online = status;
    lsSet('ak_riders', riders);
  }
}

// ---- ONLINE TOGGLE ----
function toggleOnline() {
  isOnline = !isOnline;
  var dot = document.getElementById('online-dot');
  var lbl = document.getElementById('online-lbl');
  var btn = document.getElementById('online-btn');
  if (isOnline) {
    dot.classList.add('on');
    lbl.textContent = 'Online';
    btn.classList.add('active-online');
    document.getElementById('ps-status').textContent = 'Online ✅';
    document.getElementById('ps-status').style.color = '#22C55E';
    startGPS();
    rToast('You are Online 🟢 — Orders will appear!');
  } else {
    dot.classList.remove('on');
    lbl.textContent = 'Go Online';
    btn.classList.remove('active-online');
    document.getElementById('ps-status').textContent = 'Offline';
    document.getElementById('ps-status').style.color = '#888';
    rToast('You are Offline 🔴');
  }
  updateRiderOnlineStatus(isOnline);
}

// ---- GPS ----
function startGPS() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(
    function (pos) {
      if (riderMarker)
        riderMarker.setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    },
    null,
    { enableHighAccuracy: true, maximumAge: 8000, timeout: 10000 }
  );
}

// ---- AUTO REFRESH ----
function startAutoRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(function () {
    renderOrdersList();
    updateEarnings();
    checkNewOrders();
  }, 10000);
}

// ---- CHECK NEW ORDERS ----
function checkNewOrders() {
  if (!isOnline) return;
  var orders = getOrders();
  var newOrders = orders.filter(function (o) {
    return o.status === 'New' || o.status === 'Confirmed';
  });
  var badge = document.getElementById('notif-badge');
  var dot = document.getElementById('bn-dot');
  if (newOrders.length > 0) {
    badge.style.display = 'flex';
    badge.textContent = newOrders.length;
    dot.style.display = 'block';
    if (newOrders.length > lastNewCount) {
      // Show alert for newest unassigned order
      var newest = newOrders[newOrders.length - 1];
      if (newest.id !== pendingNomId) {
        showNOM(newest);
      }
      playAlert();
    }
  } else {
    badge.style.display = 'none';
    dot.style.display = 'none';
  }
  lastNewCount = newOrders.length;
}

// ---- GET / SAVE ORDERS (Firebase live, else localStorage) ----
function getOrders() {
  if (akFirebaseReady) return ordersLive.slice();
  return lsGet('ak_orders', []);
}
function saveOrders(orders) {
  if (!akFirebaseReady) lsSet('ak_orders', orders);
}

function updateOrderStatus(id, status) {
  var patch = { status: status };
  if (status === 'Out for Delivery') {
    patch.riderId = riderData ? riderData.id : '';
    patch.deliveredBy = riderName;
  }
  if (status === 'Delivered') {
    patch.deliveredAt = new Date().toLocaleTimeString('en-IN');
    patch.deliveredBy = riderName;
    patch.riderId = riderData ? riderData.id : '';
  }
  if (akFirebaseReady) {
    firebase
      .firestore()
      .collection('orders')
      .doc(id)
      .update(patch)
      .catch(function () {
        rToast('Could not update order in cloud');
      });
    return;
  }
  var orders = getOrders();
  var idx = orders.findIndex(function (o) {
    return o.id === id;
  });
  if (idx > -1) {
    orders[idx].status = status;
    if (status === 'Out for Delivery') {
      orders[idx].riderId = riderData ? riderData.id : '';
      orders[idx].deliveredBy = riderName;
    }
    if (status === 'Delivered') {
      orders[idx].deliveredAt = patch.deliveredAt;
      orders[idx].deliveredBy = riderName;
      orders[idx].riderId = riderData ? riderData.id : '';
    }
    saveOrders(orders);
  }
  renderOrdersList();
  updateEarnings();
}

// ---- FILTER ----
function filterOrders(status, el) {
  currentFilter = status;
  document.querySelectorAll('.filter-chip').forEach(function (c) {
    c.classList.remove('active');
  });
  el.classList.add('active');
  renderOrdersList();
}

// ---- RENDER ORDERS ----
function renderOrdersList() {
  var orders = getOrders().slice().reverse();
  if (currentFilter !== 'all')
    orders = orders.filter(function (o) {
      return o.status === currentFilter;
    });
  var el = document.getElementById('orders-list');
  if (!orders.length) {
    el.innerHTML =
      '<div class="empty-state"><span class="es-icon">📭</span><div class="es-text">No orders here.<br>Stay online to receive orders!</div></div>';
    return;
  }
  el.innerHTML = orders
    .map(function (o) {
      var isNew = o.status === 'New' || o.status === 'Confirmed' || o.status === 'Preparing';
      var isOut = o.status === 'Out for Delivery';
      var isDone = o.status === 'Delivered';
      var cardCls = isDone ? 'done-order' : isOut ? 'out-order' : isNew ? 'new-order' : '';
      var stripCls = isDone ? 's-done' : isOut ? 's-out' : 's-new';
      var stagCls = isDone ? 'stag-done' : isOut ? 'stag-out' : isNew ? 'stag-new' : 'stag-other';

      // Parse items
      var itemsHtml = '';
      if (o.items) {
        if (typeof o.items === 'string') {
          itemsHtml = '<div class="oc-item-row"><span>' + esc(o.items) + '</span></div>';
        } else {
          itemsHtml = Object.entries(o.items)
            .map(function (e) {
              return (
                '<div class="oc-item-row"><span>' +
                esc(e[0]) +
                '</span><span class="oc-item-qty">×' +
                (e[1].qty || 1) +
                '</span></div>'
              );
            })
            .join('');
        }
      }

      // Action buttons
      var actionBtns = '';
      if (o.status === 'New' || o.status === 'Confirmed' || o.status === 'Preparing') {
        actionBtns =
          '<button class="oc-btn btn-nav" onclick="goToKitchen()">🏪 Go Kitchen</button>' +
          '<button class="oc-btn btn-pickup" onclick="markPickedUp(\'' +
          o.id +
          '\')">📦 Picked Up</button>';
      } else if (o.status === 'Out for Delivery') {
        actionBtns =
          '<button class="oc-btn btn-nav" onclick="goToCustomer(\'' +
          encodeURIComponent(o.address || 'Dhanbad') +
          "','" +
          o.id +
          '\')">📍 Navigate</button>' +
          '<button class="oc-btn btn-delivered" onclick="markDelivered(\'' +
          o.id +
          '\')">✅ Delivered</button>';
      }

      var ph = esc(o.phone || 'Not available');
      var addr = esc(o.address || 'Address not provided');
      var total = o.bill && o.bill.total ? o.bill.total : o.total || '—';
      var isCOD = o.payment === 'cod';
      var phoneHidden = isDone; // hide phone for delivered orders

      return (
        '<div class="order-card ' +
        cardCls +
        '" data-orderid="' +
        esc(o.id) +
        '">' +
        '<div class="oc-stripe ' +
        stripCls +
        '"></div>' +
        '<div class="oc-top">' +
        '<span class="oc-id">' +
        esc(o.id) +
        '</span>' +
        '<span class="stag ' +
        stagCls +
        '">' +
        esc(o.status) +
        '</span>' +
        '<span class="oc-time">' +
        esc(o.time || '') +
        '</span>' +
        '</div>' +
        // Customer Details (full)
        '<div class="oc-customer">' +
        '<div class="oc-cust-avatar">' +
        esc((o.name || 'C')[0].toUpperCase()) +
        '</div>' +
        '<div style="flex:1;">' +
        '<div class="oc-cust-name">' +
        esc(o.name || 'Customer') +
        '</div>' +
        '<div class="oc-cust-phone' +
        (phoneHidden ? ' phone-hidden' : '') +
        '">📞 ' +
        (phoneHidden ? 'Hidden after delivery' : ph) +
        '</div>' +
        '</div>' +
        '<div class="oc-cust-actions">' +
        '<button class="mini-btn mbtn-call" onclick="' +
        (phoneHidden ? "rToast('Phone hidden after delivery')" : "callCustomer('" + ph + "'") +
        '" title="Call">📞</button>' +
        '<button class="mini-btn mbtn-wa" onclick="waCustomer(\'' +
        ph +
        "','" +
        o.id +
        '\')" title="WhatsApp">💬</button>' +
        '</div>' +
        '</div>' +
        // Address
        '<div class="oc-address">' +
        '<span class="oc-addr-icon">📍</span>' +
        '<span class="oc-addr-text">' +
        addr +
        '</span>' +
        '</div>' +
        // Items
        (itemsHtml
          ? '<div class="oc-items-wrap"><div class="oc-items-title">🍽️ Order Items</div>' +
            itemsHtml +
            '</div>'
          : '') +
        // Footer
        '<div class="oc-footer">' +
        '<div>' +
        '<div class="oc-total">₹' +
        total +
        '</div>' +
        '<div class="oc-pay-tag">' +
        (isCOD ? '💵 Cash on Delivery' : '📱 UPI — Already Paid') +
        '</div>' +
        '</div>' +
        '<div class="oc-actions">' +
        actionBtns +
        '</div>' +
        '</div>' +
        '</div>'
      );
    })
    .join('');
}

// ---- ACTIONS ----
function markPickedUp(orderId) {
  activeOrderId = orderId;
  updateOrderStatus(orderId, 'Out for Delivery');
  rToast('📦 Picked Up! Navigate to customer.');
  setTimeout(function () {
    var o = getOrders().find(function (x) {
      return x.id === orderId;
    });
    if (o && o.address) goToCustomer(o.address, orderId);
  }, 600);
}

function markDelivered(orderId) {
  var o = getOrders().find(function (x) {
    return x.id === orderId;
  });
  if (!o) return;
  var isCOD = o.payment === 'cod';
  var total = o.bill && o.bill.total ? o.bill.total : o.total || 0;
  var msg = '✅ Mark order as DELIVERED?\n\nCustomer: ' + o.name + '\n₹' + total;
  if (isCOD) msg += '\n\n💵 COLLECT CASH: ₹' + total;
  else msg += '\n\n📱 UPI — Already Paid ✓';
  if (!confirm(msg)) return;

  updateOrderStatus(orderId, 'Delivered');
  activeOrderId = null;
  document.getElementById('map-overlay-card').classList.remove('show');
  playSuccess();
  rToast('🎉 Order Delivered! Great job!');

  // Hide phone number from all order cards after delivery
  setTimeout(function () {
    document.querySelectorAll('.oc-cust-phone').forEach(function (el) {
      if (el.closest('[data-orderid="' + orderId + '"]')) {
        el.classList.add('phone-hidden');
        el.setAttribute('title', 'Phone hidden after delivery');
      }
    });
    // Also hide in notification overlay
    var nomPhone = document.getElementById('nom-phone-' + orderId);
    if (nomPhone) nomPhone.classList.add('phone-hidden');
  }, 500);

  // Send WA confirmation to customer
  sendDeliveryWA(o);
}

function sendDeliveryWA(o) {
  var ph = String(o.phone || '').replace(/[^0-9]/g, '');
  if (!ph) return;
  var msg =
    '✅ *Order Delivered!*\n\nHi ' +
    o.name +
    '! Your order *#' +
    o.id +
    '* has been delivered! 🎉\n\n🍽️ Enjoy your meal!\n⭐ Please rate us on Zomato/Google!\n\n— Atharav Kitchen 🙏';
  window.open('https://wa.me/' + ph + '?text=' + encodeURIComponent(msg), '_blank');
}

function callCustomer(phone) {
  var ph = String(phone || '').replace(/[^0-9]/g, '');
  if (!ph || ph === 'Notavailable') {
    rToast('No phone number!');
    return;
  }
  window.location.href = 'tel:+' + ph;
}

function waCustomer(phone, orderId) {
  var ph = String(phone || '').replace(/[^0-9]/g, '');
  if (!ph || ph === 'Notavailable') {
    rToast('No phone number!');
    return;
  }
  var msg =
    'Hi! I am your delivery partner from Atharav Kitchen. I am on my way with order #' +
    orderId +
    '. Will reach in 10-15 minutes! 🛵';
  window.open('https://wa.me/' + ph + '?text=' + encodeURIComponent(msg), '_blank');
}

// ---- NAVIGATION ----
function goToKitchen() {
  var url =
    'https://www.google.com/maps/dir/?api=1&destination=' +
    encodeURIComponent(KITCHEN_ADDR) +
    '&travelmode=driving';
  window.open(url, '_blank');
  rToast('Opening maps to Kitchen 🏪');
}

function goToCustomer(address, orderId) {
  activeOrderId = orderId;
  var decoded = decodeURIComponent(address);
  document.getElementById('moc-addr').textContent = decoded;
  document.getElementById('moc-btn-nav').onclick = function () {
    openGMaps(decoded);
  };
  switchTab('map');
  document.getElementById('map-overlay-card').classList.add('show');
  if (riderMap) showRouteOnMap(decoded);
  else
    loadGMaps(function () {
      initMap();
      setTimeout(function () {
        showRouteOnMap(decoded);
      }, 800);
    });
  rToast('📍 Navigate to customer!');
}

function openGMaps(addr) {
  var url =
    'https://www.google.com/maps/dir/?api=1&origin=' +
    KITCHEN_LAT +
    ',' +
    KITCHEN_LNG +
    '&destination=' +
    encodeURIComponent(addr) +
    '&travelmode=driving';
  window.open(url, '_blank');
}

// ---- GOOGLE MAPS ----
function loadGMaps(cb) {
  if (window.google && window.google.maps) {
    cb();
    return;
  }
  window._mapCb = cb;
  var s = document.createElement('script');
  s.src = 'https://maps.googleapis.com/maps/api/js?key=' + GMAPS_KEY + '&callback=_onMapLoad';
  s.async = true;
  document.head.appendChild(s);
}
window._onMapLoad = function () {
  if (window._mapCb) window._mapCb();
};

function initMap() {
  if (riderMap) return;
  var el = document.getElementById('rider-map');
  if (!el || !window.google) return;
  riderMap = new google.maps.Map(el, {
    center: { lat: KITCHEN_LAT, lng: KITCHEN_LNG },
    zoom: 14,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
  });
  // Kitchen marker
  new google.maps.Marker({
    position: { lat: KITCHEN_LAT, lng: KITCHEN_LNG },
    map: riderMap,
    title: 'Atharav Kitchen',
    icon: {
      url:
        'data:image/svg+xml;charset=UTF-8,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="#FF6B00" stroke="#fff" stroke-width="3"/><text x="22" y="28" text-anchor="middle" font-size="18">🏪</text></svg>'
        ),
      scaledSize: new google.maps.Size(44, 44),
    },
  });
  // Rider marker
  riderMarker = new google.maps.Marker({
    position: { lat: KITCHEN_LAT, lng: KITCHEN_LNG },
    map: riderMap,
    title: 'You',
    icon: {
      url:
        'data:image/svg+xml;charset=UTF-8,' +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20" fill="#1B4332" stroke="#F0CC5A" stroke-width="3"/><text x="22" y="28" text-anchor="middle" font-size="18">🛵</text></svg>'
        ),
      scaledSize: new google.maps.Size(44, 44),
    },
  });
  dirRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: false, map: riderMap });
  // Get GPS location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(function (pos) {
      var ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (riderMarker) riderMarker.setPosition(ll);
      riderMap.setCenter(ll);
    });
  }
}

function showRouteOnMap(destAddr) {
  if (!window.google || !riderMap) return;
  var svc = new google.maps.DirectionsService();
  var origin = KITCHEN_LAT + ',' + KITCHEN_LNG;
  svc.route(
    {
      origin: origin,
      destination: destAddr + ', Dhanbad, Jharkhand',
      travelMode: google.maps.TravelMode.DRIVING,
    },
    function (result, status) {
      if (status === 'OK' && dirRenderer) {
        dirRenderer.setDirections(result);
        var leg = result.routes[0].legs[0];
        rToast('ETA: ' + leg.duration.text + ' · ' + leg.distance.text);
      } else {
        // Fallback geocode
        new google.maps.Geocoder().geocode(
          { address: destAddr + ', Dhanbad, Jharkhand' },
          function (res, st) {
            if (st === 'OK') {
              var pos = res[0].geometry.location;
              if (destMarker) destMarker.setMap(null);
              destMarker = new google.maps.Marker({
                position: pos,
                map: riderMap,
                title: 'Customer',
              });
              riderMap.setCenter(pos);
              riderMap.setZoom(15);
            }
          }
        );
      }
    }
  );
}

// ---- NEW ORDER MODAL ----
function showNOM(order) {
  pendingNomId = order.id;
  clearInterval(nomTimer);
  var total = order.bill && order.bill.total ? order.bill.total : order.total || 0;

  // Parse items for display
  var itemsStr = '—';
  if (order.items) {
    if (typeof order.items === 'string') itemsStr = order.items;
    else
      itemsStr = Object.entries(order.items)
        .map(function (e) {
          return e[0] + ' ×' + (e[1].qty || 1);
        })
        .join(', ');
  }

  document.getElementById('nom-info').innerHTML =
    '<div class="nom-row"><span class="ni">🆔</span><span><strong>' +
    esc(order.id) +
    '</strong></span></div>' +
    '<div class="nom-row"><span class="ni">👤</span><span>' +
    esc(order.name || 'Customer') +
    '</span></div>' +
    '<div class="nom-row"><span class="ni">📞</span><span>' +
    esc(order.phone || '—') +
    '</span></div>' +
    '<div class="nom-row"><span class="ni">📍</span><span>' +
    esc(order.address || '—') +
    '</span></div>' +
    '<div class="nom-row"><span class="ni">🍽️</span><span>' +
    esc(itemsStr) +
    '</span></div>';
  document.getElementById('nom-total-amt').textContent = '₹' + total;
  document.getElementById('nom-pay').textContent =
    order.payment === 'cod' ? '💵 Cash on Delivery' : '📱 UPI (Paid)';

  var secs = 30;
  document.getElementById('nom-countdown').textContent = secs;
  document.getElementById('nom-timer-txt').textContent = secs;
  document.getElementById('nom').classList.add('show');
  playAlert();
  nomTimer = setInterval(function () {
    secs--;
    document.getElementById('nom-countdown').textContent = secs;
    document.getElementById('nom-timer-txt').textContent = secs;
    if (secs <= 0) {
      clearInterval(nomTimer);
      rejectOrder();
    }
  }, 1000);
}

function acceptOrder() {
  clearInterval(nomTimer);
  document.getElementById('nom').classList.remove('show');
  if (pendingNomId) {
    updateOrderStatus(pendingNomId, 'Confirmed');
    var o = getOrders().find(function (x) {
      return x.id === pendingNomId;
    });
    if (o) {
      var ph = String(o.phone || '').replace(/[^0-9]/g, '');
      if (ph) {
        var msg =
          '🛵 Hi ' +
          o.name +
          '! Your order *#' +
          o.id +
          '* has been *accepted* by our delivery partner!\n\nExpected delivery: 30-45 mins 🍽️\n\n— Atharav Kitchen';
        window.open('https://wa.me/' + ph + '?text=' + encodeURIComponent(msg), '_blank');
      }
    }
    rToast('✅ Order Accepted! Head to kitchen.');
  }
  pendingNomId = null;
}

function rejectOrder() {
  clearInterval(nomTimer);
  document.getElementById('nom').classList.remove('show');
  pendingNomId = null;
  rToast('Order skipped.');
}

// ---- EARNINGS ----
function updateEarnings() {
  var orders = getOrders();
  var settings = lsGet('ak_settings', {});
  var perPay = settings.riderpay || 30;
  var myDel = orders.filter(function (o) {
    return o.deliveredBy === riderName && o.status === 'Delivered';
  });
  var todayStr = new Date().toLocaleDateString('en-IN');
  var todayDel = myDel.filter(function (o) {
    return (o.deliveredAt || o.time || '').indexOf(todayStr) > -1 || true;
  });
  // Since we can't reliably filter by date from time strings, just show all delivered by this rider
  var earnTotal = myDel.length * perPay;
  var codAmt = myDel
    .filter(function (o) {
      return o.payment === 'cod';
    })
    .reduce(function (s, o) {
      return s + (o.bill ? o.bill.total : o.total || 0);
    }, 0);
  var upiAmt = myDel
    .filter(function (o) {
      return o.payment === 'upi';
    })
    .reduce(function (s, o) {
      return s + (o.bill ? o.bill.total : o.total || 0);
    }, 0);

  document.getElementById('earn-today').textContent = '₹' + earnTotal;
  document.getElementById('earn-sub').textContent = myDel.length + ' deliveries · Keep going! 🚀';
  document.getElementById('ec-total').textContent = myDel.length;
  document.getElementById('ec-perpay').textContent = '₹' + perPay;
  document.getElementById('ec-cod').textContent = '₹' + codAmt;
  document.getElementById('ec-upi').textContent = '₹' + upiAmt;
  document.getElementById('ps-del').textContent = myDel.length;
  document.getElementById('ps-earn').textContent = '₹' + earnTotal;

  // History
  var histEl = document.getElementById('earn-history');
  if (!myDel.length) {
    histEl.innerHTML =
      '<div style="color:var(--text3);font-size:0.82rem;text-align:center;padding:1rem;">No deliveries yet.</div>';
    return;
  }
  histEl.innerHTML = myDel
    .slice()
    .reverse()
    .map(function (o) {
      var total = o.bill && o.bill.total ? o.bill.total : o.total || 0;
      return (
        '<div class="earn-row">' +
        '<div class="er-left">' +
        '<div class="er-icon">✅</div>' +
        '<div>' +
        '<div class="er-id">' +
        esc(o.id) +
        '</div>' +
        '<div class="er-meta">' +
        esc(o.name || '') +
        '  ·  ' +
        esc(o.deliveredAt || o.time || '') +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div>' +
        '<div class="er-amt">+₹' +
        perPay +
        '</div>' +
        '<div style="font-size:0.68rem;color:var(--text3);text-align:right;">' +
        (o.payment === 'cod' ? '💵 COD ₹' + total : '📱 UPI') +
        '</div>' +
        '</div>' +
        '</div>'
      );
    })
    .join('');
}

// ---- SWITCH TAB ----
function switchTab(name) {
  document.querySelectorAll('.tab-page').forEach(function (p) {
    p.classList.remove('active');
  });
  document.getElementById('tab-' + name).classList.add('active');
  ['orders', 'map', 'earnings', 'profile'].forEach(function (t) {
    document.getElementById('bn-' + t).classList.remove('active');
  });
  document.getElementById('bn-' + name).classList.add('active');
  if (name === 'map') {
    if (!riderMap)
      loadGMaps(function () {
        initMap();
      });
    else google.maps.event.trigger(riderMap, 'resize');
  }
  if (name === 'earnings') updateEarnings();
}

// ---- SOUNDS ----
function playAlert() {
  if (!document.getElementById('sound-pref').checked) return;
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1047, 1175, 880].forEach(function (f, i) {
      var o = ctx.createOscillator(),
        g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = f;
      o.type = 'triangle';
      g.gain.setValueAtTime(0.5, ctx.currentTime + i * 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.12);
      o.start(ctx.currentTime + i * 0.15);
      o.stop(ctx.currentTime + i * 0.15 + 0.15);
    });
  } catch (e) {}
  if (document.getElementById('vibr-pref').checked && navigator.vibrate)
    navigator.vibrate([200, 100, 200, 100, 400]);
}

function playSuccess() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784, 1047].forEach(function (f, i) {
      var o = ctx.createOscillator(),
        g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.value = f;
      o.type = 'sine';
      g.gain.setValueAtTime(0.4, ctx.currentTime + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.15);
      o.start(ctx.currentTime + i * 0.12);
      o.stop(ctx.currentTime + i * 0.12 + 0.18);
    });
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 300]);
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', function () {
  populateRiderDropdown();
});
