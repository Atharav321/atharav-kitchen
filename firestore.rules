/**
 * ============================================================
 *  ATHARAV KITCHEN — FIREBASE CONFIG (LIVE MODE)
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

  // Push notifications (order status updates) — VAPID key generate karo:
  // Firebase Console → Project Settings → Cloud Messaging → Web configuration
  // → "Generate key pair", phir wahi key yahan paste karo.
  window.AK_VAPID_KEY = 'PASTE_YOUR_VAPID_KEY_HERE';

  var FIREBASE_SCRIPTS = [
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js',
  ];

  var loaded = 0;

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

      try {
        firebase.firestore().settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED });
        firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(function(){});
      } catch(e) {}

      try {
        window.akStorage = firebase.storage();
      } catch(e) {
        console.error('[Atharav Kitchen] Firebase Storage init error:', e);
      }

      window.akMessaging = null;
      try {
        if (firebase.messaging && firebase.messaging.isSupported) {
          firebase.messaging.isSupported().then(function (supported) {
            if (supported) {
              try { window.akMessaging = firebase.messaging(); } catch (e) { window.akMessaging = null; }
            }
          }).catch(function(){ window.akMessaging = null; });
        }
      } catch(e) {
        window.akMessaging = null; // Push notifications not supported in this browser — silently skip
      }

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
