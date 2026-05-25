/**
 * ATHARAV KITCHEN — FIREBASE CONFIG
 * Project: atharav-kitchen-e587b
 */

// Firebase SDK seedha load karo — dynamic loading band
// Ye scripts index.html mein already load hoti hain

window.FIREBASE_CONFIG = {
  apiKey:            'AIzaSyCFUKTAZQJ4XnJ7RDK50k14gMQOeDW5-2g',
  authDomain:        'atharav-kitchen-e587b.firebaseapp.com',
  projectId:         'atharav-kitchen-e587b',
  storageBucket:     'atharav-kitchen-e587b.firebasestorage.app',
  messagingSenderId: '405541916369',
  appId:             '1:405541916369:web:b0ffc50a3a7aabc005ac',
  measurementId:     'G-1Z105Q39G2'
};

window.isAkFirebaseConfigured = function() { return true; };
window.akFirebaseReady = false;

function initFirebaseApp() {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(window.FIREBASE_CONFIG);
    }
    window.akFirebaseReady = true;
    console.info('%c[Atharav Kitchen] ✅ Firebase LIVE!', 'color:#16A34A;font-weight:bold;');
    try {
      firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(function(){});
    } catch(e) {}
    window.dispatchEvent(new Event('akFirebaseReady'));
  } catch(e) {
    console.error('Firebase init error:', e);
  }
}

// Firebase SDK already loaded check karo (index.html mein script tags hain)
if (typeof firebase !== 'undefined') {
  initFirebaseApp();
} else {
  // SDK load karo
  var scripts = [
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js'
  ];
  var loaded = 0;
  scripts.forEach(function(src) {
    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = function() {
      loaded++;
      if (loaded === scripts.length) initFirebaseApp();
    };
    s.onerror = function() {
      console.error('Firebase script load failed:', src);
    };
    document.head.appendChild(s);
  });
}

/* ============================================================
   HELPER FUNCTIONS
   ============================================================ */

window.akListenOrders = function(callback) {
  return firebase.firestore().collection('orders')
    .orderBy('createdAtMs', 'desc')
    .onSnapshot(function(snap) {
      var orders = [];
      snap.forEach(function(doc) {
        orders.push(Object.assign({ _docId: doc.id }, doc.data()));
      });
      callback(orders);
    }, function(err) { console.error('[AK] Orders error:', err); });
};

window.akUpdateOrderStatus = function(orderId, status, extraData, onSuccess, onError) {
  var patch = Object.assign({ status: status }, extraData || {});
  firebase.firestore().collection('orders').doc(orderId)
    .update(patch)
    .then(function() { if (onSuccess) onSuccess(); })
    .catch(function(e) { if (onError) onError(e); });
};

window.akAssignRider = function(orderId, riderName, onSuccess, onError) {
  akUpdateOrderStatus(orderId, 'Out for Delivery',
    { deliveredBy: riderName, assignedAt: new Date().toISOString() },
    onSuccess, onError);
};

window.akSaveMenu = function(menuItems, onSuccess, onError) {
  localStorage.setItem('ak_menu', JSON.stringify(menuItems));
  firebase.firestore().collection('menu').doc('items')
    .set({ items: menuItems, updatedAt: new Date().toISOString() })
    .then(function() { if (onSuccess) onSuccess(); })
    .catch(function(e) { if (onError) onError(e); });
};

window.akGetMenu = function(callback) {
  firebase.firestore().collection('menu').doc('items').get()
    .then(function(snap) { callback(snap.exists ? snap.data().items || null : null); })
    .catch(function() { callback(null); });
};

window.akSaveSettings = function(settings, onSuccess) {
  localStorage.setItem('ak_settings', JSON.stringify(settings));
  firebase.firestore().collection('settings').doc('main')
    .set(settings)
    .then(function() { if (onSuccess) onSuccess(); })
    .catch(function() { if (onSuccess) onSuccess(); });
};

window.akGetSettings = function(callback) {
  firebase.firestore().collection('settings').doc('main').get()
    .then(function(snap) { callback(snap.exists ? snap.data() : null); })
    .catch(function() { callback(null); });
};

window.akSaveFeedback = function(fbObj, onSuccess, onError) {
  firebase.firestore().collection('feedback').add(fbObj)
    .then(function() { if (onSuccess) onSuccess(); })
    .catch(function(e) { if (onError) onError(e); });
};

window.akUpdateRiderStatus = function(riderName, isOnline) {
  firebase.firestore().collection('riders')
    .doc(riderName.replace(/\s+/g, '_').toLowerCase())
    .set({ name: riderName, online: isOnline, lastSeen: new Date().toISOString() }, { merge: true })
    .catch(function() {});
};

window.loadCustomerProfile = function(uid) {
  if (!uid) return Promise.resolve(null);
  return firebase.firestore().collection('customers').doc(uid).get()
    .then(function(snap) { return snap.exists ? snap.data() : null; })
    .catch(function() { return null; });
};

window.akListenOffers = function(callback) {
  return firebase.firestore().collection('offers').doc('list')
    .onSnapshot(function(snap) {
      callback(snap.exists ? snap.data().items || [] : []);
    }, function() { callback([]); });
};

window.akSaveOffers = function(offers, onSuccess) {
  localStorage.setItem('ak_offers', JSON.stringify(offers));
  firebase.firestore().collection('offers').doc('list')
    .set({ items: offers, updatedAt: new Date().toISOString() })
    .then(function() { if (onSuccess) onSuccess(); })
    .catch(function() { if (onSuccess) onSuccess(); });
};

window.akSaveBanners = function(banners, onSuccess) {
  localStorage.setItem('ak_banners', JSON.stringify(banners));
  firebase.firestore().collection('banners').doc('list')
    .set({ items: banners, updatedAt: new Date().toISOString() })
    .then(function() { if (onSuccess) onSuccess(); })
    .catch(function() { if (onSuccess) onSuccess(); });
};

window.akGetBanners = function(callback) {
  firebase.firestore().collection('banners').doc('list').get()
    .then(function(snap) { callback(snap.exists ? snap.data().items || [] : []); })
    .catch(function() { callback([]); });
};

window.akAdminOrderListener = function(onNewOrder) {
  var initialized = false;
  var seenIds = new Set();
  return firebase.firestore().collection('orders')
    .where('status', 'in', ['New', 'Pending'])
    .onSnapshot(function(snap) {
      if (!initialized) {
        snap.forEach(function(doc) { seenIds.add(doc.id); });
        initialized = true;
        return;
      }
      snap.docChanges().forEach(function(change) {
        if (change.type === 'added' && !seenIds.has(change.doc.id)) {
          seenIds.add(change.doc.id);
          if (onNewOrder) onNewOrder(Object.assign({ _docId: change.doc.id }, change.doc.data()));
        }
      });
    }, function(e) { console.error('[AK] Admin listener error:', e); });
};
