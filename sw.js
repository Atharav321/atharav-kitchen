// ═══════════════════════════════════════════════════════════════
//  ATHARAV KITCHEN — SERVICE WORKER v4.1 (FIXED)
//  Strategy: Cache-First for assets, Network-First for pages
//  FIX: WebP extensions, proper cache cleanup
// ═══════════════════════════════════════════════════════════════

// --- PUSH NOTIFICATIONS (Firebase Cloud Messaging, background) ---
// Isi service worker mein FCM background handler add kiya hai (alag se
// firebase-messaging-sw.js file banane ki zaroorat nahi).
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');
try {
  firebase.initializeApp({
    apiKey:            'AIzaSyCFUKTAZQJ4XnJ7RDK50k14gMQOeDW5-2g',
    authDomain:        'atharav-kitchen-e587b.firebaseapp.com',
    projectId:         'atharav-kitchen-e587b',
    storageBucket:     'atharav-kitchen-e587b.firebasestorage.app',
    messagingSenderId: '405541916369',
    appId:             '1:405541916369:web:b0ffc50a3a7aabc005ac',
  });
  var akMessagingSw = firebase.messaging();
  akMessagingSw.onBackgroundMessage(function(payload) {
    var title = (payload.notification && payload.notification.title) || 'Atharav Kitchen';
    var body = (payload.notification && payload.notification.body) || '';
    self.registration.showNotification(title, {
      body: body,
      icon: 'icon-192.webp',
      badge: 'icon-192.webp',
      data: payload.data || {}
    });
  });
} catch (e) {
  console.warn('[SW] Firebase Messaging init skipped:', e);
}

const CACHE_NAME = 'atharav-v26';
const STATIC_CACHE = 'atharav-static-v26';
const DYNAMIC_CACHE = 'atharav-dynamic-v6';

const PRECACHE_FILES = [
  'index.html','admin.html','rider.html','blog.html',
  'blog-best-cloud-kitchen-dhanbad.html',
  'blog-order-food-online-dhanbad.html',
  'blog-indo-western-food-dhanbad.html',
  'css/home.css','css/admin.css','css/rider.css',
  'js/core/firebase-config.js','js/core/firestoreService.js','js/core/security.js',
  'js/customer/core.js','js/customer/auth.js','js/customer/menu.js',
  'js/customer/cart.js','js/customer/coupons.js','js/customer/orders.js',
  'js/customer/order-history.js','js/customer/tracking.js','js/customer/reviews.js',
  'js/customer/loyalty.js','js/customer/engagement.js',
  'js/admin/admin.js','js/rider/rider.js',
  'manifest.json','robots.txt','sitemap.xml',
  // Images
  'logo_png.png','logo_png_new.png','delivery-boy-new.png',
  'logo.webp','icon-192.webp','icon-512.webp','delivery-boy-new.webp'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache) {
      return cache.addAll(PRECACHE_FILES).catch(function(err){
        console.warn('[SW] Some precache files failed:', err);
      });
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k){ return k!==STATIC_CACHE&&k!==DYNAMIC_CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);
  if(event.request.method!=='GET') return;

  // Skip Firebase/Google APIs — they handle their own caching
  if(url.hostname.includes('firebase')||url.hostname.includes('googleapis')||
     url.hostname.includes('gstatic')||url.hostname.includes('google')||
     url.hostname.includes('maps.googleapis')) return;

  // Skip external origins
  if(url.origin!==location.origin) return;

  // Images: Cache-first
  if(url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/)){
    event.respondWith(cacheFirst(event.request)); return;
  }

  // HTML pages: Network-first
  if(url.pathname.match(/\.html?$/)|| url.pathname==='/'||
     url.pathname.includes('blog')){
    event.respondWith(networkFirst(event.request)); return;
  }

  // Everything else: Stale-while-revalidate
  event.respondWith(staleWhileRevalidate(event.request));
});

function cacheFirst(req){
  return caches.match(req).then(function(c){
    return c||fetch(req).then(function(r){
      if(r.ok){var cl=r.clone();caches.open(STATIC_CACHE).then(function(cache){cache.put(req,cl);});}
      return r;
    }).catch(function(){return new Response('Offline',{status:503});});
  });
}

function networkFirst(req){
  return fetch(req).then(function(r){
    if(r.ok){var cl=r.clone();caches.open(DYNAMIC_CACHE).then(function(c){c.put(req,cl);});}
    return r;
  }).catch(function(){
    return caches.match(req).then(function(c){return c||caches.match('index.html');});
  });
}

function staleWhileRevalidate(req){
  return caches.open(DYNAMIC_CACHE).then(function(cache){
    return cache.match(req).then(function(cached){
      var net=fetch(req).then(function(r){if(r.ok)cache.put(req,r.clone());return r;});
      return cached||net;
    });
  });
}

// ── PUSH NOTIFICATION HANDLER ─────────────────────────────────────
// FCM v1 API se push aata hai (order-notify.js Worker bhejta hai)
self.addEventListener('push', function (e) {
  if (!e.data) return;
  var d;
  try { d = e.data.json(); } catch (err) { d = { title: 'Atharav Kitchen', body: e.data.text() }; }

  var title = d.title || 'Atharav Kitchen 🍽️';
  var body = d.body || 'Tumhare order mein update hai!';
  var orderId = d.orderId || d.data && d.data.orderId || '';

  e.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/icon-192.webp',
      badge: '/icon-192.webp',
      tag: 'ak-order-' + (orderId || 'update'),
      renotify: true,
      data: { orderId: orderId, url: '/?track=' + (orderId || '') },
      actions: [
        { action: 'track', title: '📦 Track Order' },
        { action: 'close', title: '✕ Close' },
      ],
    })
  );
});

// ── NOTIFICATION CLICK — App open karo + tracking modal ──────────
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var targetUrl = (e.notification.data && e.notification.data.url) || '/';

  if (e.action === 'close') return;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Already open window mein focus karo
      for (var i = 0; i < clientList.length; i++) {
        var c = clientList[i];
        if (c.url.includes(self.location.origin) && 'focus' in c) {
          c.focus();
          // Message bhejo tracking modal khulne ke liye
          if (e.notification.data && e.notification.data.orderId) {
            c.postMessage({ type: 'AK_OPEN_TRACKING', orderId: e.notification.data.orderId });
          }
          return;
        }
      }
      // Koi window nahi khuli — naya tab open karo
      return clients.openWindow(targetUrl);
    })
  );
});
