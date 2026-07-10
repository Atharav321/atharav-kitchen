// ═══════════════════════════════════════════════════════════════
//  ATHARAV KITCHEN — SERVICE WORKER v4.1 (FIXED)
//  Strategy: Cache-First for assets, Network-First for pages
//  FIX: WebP extensions, proper cache cleanup
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'atharav-v7';
const STATIC_CACHE = 'atharav-static-v6';
const DYNAMIC_CACHE = 'atharav-dynamic-v6';

const PRECACHE_FILES = [
  'index.html','admin.html','rider.html','blog.html',
  'blog-best-cloud-kitchen-dhanbad.html',
  'blog-order-food-online-dhanbad.html',
  'blog-indo-western-food-dhanbad.html',
  'app.js','styles.css','firebase-config.js',
  'manifest.json','robots.txt','sitemap.xml',
  // Images (user will upload these)
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

self.addEventListener('push',function(e){
  if(!e.data)return;
  var d=e.data.json();
  e.waitUntil(self.registration.showNotification(d.title||'Atharav Kitchen',{
    body:d.body||'New update!',icon:'logo_png.png',badge:'logo_png.png',tag:'ak-notif',renotify:true
  }));
});

self.addEventListener('notificationclick',function(e){
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window'}).then(function(cl){
    return cl.length>0?cl[0].focus():clients.openWindow('/');
  }));
});
