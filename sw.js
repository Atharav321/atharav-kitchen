// ═══════════════════════════════════════════════════════════════
//  ATHARAV KITCHEN — SERVICE WORKER v4.0
//  Strategy: Cache-First for assets, Network-First for pages
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'atharav-v5';
const STATIC_CACHE = 'atharav-static-v5';
const DYNAMIC_CACHE = 'atharav-dynamic-v5';

const PRECACHE_FILES = [
  'index.html','admin.html','rider.html','start.html',
  'app.js','styles.css','firebase-config.js',
  'manifest.json','icon-192.webp','icon-512.webp','logo.webp','logo_png.png',
  'robots.txt','sitemap.xml',
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function(cache) {
      return cache.addAll(PRECACHE_FILES).catch(function(){});
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
  if(url.hostname.includes('firebase')||url.hostname.includes('googleapis')||
     url.hostname.includes('gstatic')||url.hostname.includes('google')) return;
  if(url.origin!==location.origin) return;

  if(url.pathname.match(/\.(png|jpg|jpeg|webp|svg|ico|woff2?)$/)){
    event.respondWith(cacheFirst(event.request)); return;
  }
  if(url.pathname.match(/\.html?$/)|| url.pathname==='/'){
    event.respondWith(networkFirst(event.request)); return;
  }
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
    body:d.body||'New update!',icon:'icon-192.png',badge:'icon-192.png',tag:'ak-notif',renotify:true
  }));
});
self.addEventListener('notificationclick',function(e){
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window'}).then(function(cl){
    return cl.length>0?cl[0].focus():clients.openWindow('/');
  }));
});
