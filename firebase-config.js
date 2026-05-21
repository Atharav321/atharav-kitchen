/**
 * ============================================================
 *  ATHARAV KITCHEN — FIREBASE CONFIG (REAL KEYS — LIVE MODE)
 *  Project: atharav-kitchen-e587b
 * ============================================================
 */

(function () {

  window.FIREBASE_CONFIG = {
    apiKey:            'AIzaSyCFUKTAZQJ4XnJ7RDK50k14gMQOeDW5-2g',
    authDomain:        'atharav-kitchen-e587b.firebaseapp.com',
    projectId:         'atharav-kitchen-e587b',
    storageBucket:     'atharav-kitchen-e587b.firebasestorage.app',
    messagingSenderId: '405541916369',
    appId:             '1:405541916369:web:b0ffc50a3a7aabc005ac',
    measurementId:     'G-1Z105Q39G2',
  };

  window.isAkFirebaseConfigured = function () {
    var c = window.FIREBASE_CONFIG;
    if (!c || !c.apiKey || !c.projectId) return false;
    if (c.apiKey === 'YOUR_API_KEY') return false;
    if (c.projectId === 'YOUR_PROJECT_ID') return false;
    return true;
  };

  window.akFirebaseReady = false;

  /* ---------------------------------------------------------
     Firebase SDK scripts load karo
  --------------------------------------------------------- */
  var FIREBASE_SCRIPTS = [
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
  ];

  var loaded = 0;

  // Guard: agar firebase already loaded aur initialized hai toh scripts dobara mat load karo
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length) {
    window.akFirebaseReady = true;
    window.dispatchEvent(new Event('akFirebaseReady'));
    return;
  }

  function onAllLoaded() {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(window.FIREBASE_CONFIG);
      }
      window.akFirebaseReady = true;
      console.info('%c[Atharav Kitchen] ✅ Firebase LIVE — Cloud sync ACTIVE!', 'color:#16A34A;font-weight:bold;font-size:14px;');

      // Offline persistence ON karo
      try {
        firebase.firestore().settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED });
        firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(function(){});
      } catch(e) {}

      window.dispatchEvent(new Event('akFirebaseReady'));

    } catch (e) {
      console.error('[Atharav Kitchen] Firebase init error:', e);
    }
  }

  FIREBASE_SCRIPTS.forEach(function (src) {
    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.onload = function () {
      loaded++;
      if (loaded === FIREBASE_SCRIPTS.length) onAllLoaded();
    };
    document.head.appendChild(s);
  });

})();

/* ============================================================
   HELPER FUNCTIONS — index.html + admin.html + rider.html
   ============================================================ */

// Orders real-time listener
window.akListenOrders = function (callback) {
  return firebase.firestore()
    .collection('orders')
    .orderBy('createdAtMs', 'desc')
    .onSnapshot(function (snap) {
      var orders = [];
      snap.forEach(function (doc) {
        orders.push(Object.assign({ _docId: doc.id }, doc.data()));
      });
      callback(orders);
    }, function (err) {
      console.error('[AK] Orders listener error:', err);
    });
};

// Order status update
window.akUpdateOrderStatus = function (orderId, status, extraData, onSuccess, onError) {
  var patch = Object.assign({ status: status }, extraData || {});
  firebase.firestore().collection('orders').doc(orderId)
    .update(patch)
    .then(function () { if (onSuccess) onSuccess(); })
    .catch(function (e) { if (onError) onError(e); });
};

// Rider assign
window.akAssignRider = function (orderId, riderName, onSuccess, onError) {
  akUpdateOrderStatus(orderId, 'Out for Delivery',
    { deliveredBy: riderName, assignedAt: new Date().toISOString() },
    onSuccess, onError);
};

// Menu save/load
window.akSaveMenu = function (menuItems, onSuccess, onError) {
  localStorage.setItem('ak_menu', JSON.stringify(menuItems));
  firebase.firestore().collection('menu').doc('items')
    .set({ items: menuItems, updatedAt: new Date().toISOString() })
    .then(function () { if (onSuccess) onSuccess(); })
    .catch(function (e) { if (onError) onError(e); });
};

window.akGetMenu = function (callback) {
  firebase.firestore().collection('menu').doc('items').get()
    .then(function (snap) {
      callback(snap.exists ? snap.data().items || null : null);
    })
    .catch(function () { callback(null); });
};

// Settings
window.akSaveSettings = function (settings, onSuccess) {
  localStorage.setItem('ak_settings', JSON.stringify(settings));
  firebase.firestore().collection('settings').doc('main')
    .set(settings)
    .then(function () { if (onSuccess) onSuccess(); })
    .catch(function () { if (onSuccess) onSuccess(); });
};

window.akGetSettings = function (callback) {
  firebase.firestore().collection('settings').doc('main').get()
    .then(function (snap) { callback(snap.exists ? snap.data() : null); })
    .catch(function () { callback(null); });
};

// Feedback
window.akSaveFeedback = function (fbObj, onSuccess, onError) {
  firebase.firestore().collection('feedback').add(fbObj)
    .then(function () { if (onSuccess) onSuccess(); })
    .catch(function (e) { if (onError) onError(e); });
};

// Rider status
window.akUpdateRiderStatus = function (riderName, isOnline) {
  firebase.firestore()
    .collection('riders')
    .doc(riderName.replace(/\s+/g, '_').toLowerCase())
    .set({ name: riderName, online: isOnline, lastSeen: new Date().toISOString() }, { merge: true })
    .catch(function () {});
};

// Customer profile load
window.loadCustomerProfile = function (uid) {
  if (!uid) return Promise.resolve(null);
  return firebase.firestore().collection('customers').doc(uid).get()
    .then(function (snap) { return snap.exists ? snap.data() : null; })
    .catch(function () { return null; });
};

// Offers
window.akListenOffers = function (callback) {
  return firebase.firestore().collection('offers').doc('list')
    .onSnapshot(function (snap) {
      callback(snap.exists ? snap.data().items || [] : []);
    }, function () { callback([]); });
};

window.akSaveOffers = function (offers, onSuccess) {
  localStorage.setItem('ak_offers', JSON.stringify(offers));
  firebase.firestore().collection('offers').doc('list')
    .set({ items: offers, updatedAt: new Date().toISOString() })
    .then(function () { if (onSuccess) onSuccess(); })
    .catch(function () { if (onSuccess) onSuccess(); });
};

// Banners
window.akSaveBanners = function (banners, onSuccess) {
  localStorage.setItem('ak_banners', JSON.stringify(banners));
  firebase.firestore().collection('banners').doc('list')
    .set({ items: banners, updatedAt: new Date().toISOString() })
    .then(function () { if (onSuccess) onSuccess(); })
    .catch(function () { if (onSuccess) onSuccess(); });
};

window.akGetBanners = function (callback) {
  firebase.firestore().collection('banners').doc('list').get()
    .then(function (snap) { callback(snap.exists ? snap.data().items || [] : []); })
    .catch(function () { callback([]); });
};

// Admin new order listener
window.akAdminOrderListener = function (onNewOrder) {
  var initialized = false;
  var seenIds = new Set();

  return firebase.firestore()
    .collection('orders')
    .where('status', 'in', ['New', 'Pending'])
    .onSnapshot(function (snap) {
      if (!initialized) {
        snap.forEach(function (doc) { seenIds.add(doc.id); });
        initialized = true;
        return;
      }
      snap.docChanges().forEach(function (change) {
        if (change.type === 'added' && !seenIds.has(change.doc.id)) {
          seenIds.add(change.doc.id);
          if (onNewOrder) onNewOrder(Object.assign({ _docId: change.doc.id }, change.doc.data()));
        }
      });
    }, function (e) {
      console.error('[AK] Admin order listener error:', e);
    });
};
