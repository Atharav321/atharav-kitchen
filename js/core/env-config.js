/**
 * Atharav Kitchen — Environment Configuration
 * IMPORTANT: This file is intentionally public.
 * Firebase client keys are NOT secrets — they are locked down
 * via Firestore Security Rules and App Check.
 * DO NOT put server-side secrets here.
 */
(function () {
  'use strict';
  window.__ENV_FIREBASE_API_KEY = 'AIzaSyCFUKTAZQJ4XnJ7RDK50k14gMQOeDW5-2g';
  window.__ENV_FIREBASE_AUTH_DOMAIN = 'atharav-kitchen-e587b.firebaseapp.com';
  window.__ENV_FIREBASE_PROJECT_ID = 'atharav-kitchen-e587b';
  window.__ENV_FIREBASE_STORAGE_BUCKET = 'atharav-kitchen-e587b.firebasestorage.app';
  window.__ENV_FIREBASE_MESSAGING_ID = '405541916369';
  window.__ENV_FIREBASE_APP_ID = '1:405541916369:web:b0ffc50a3a7aabc005ac';
  window.__ENV_FIREBASE_MEASUREMENT_ID = 'G-1Z105Q39G2';
  window.__ENV_GMAPS_KEY = 'AIzaSyD7Vb4zFHfzsI79BbHjZTIi0s8Asxte6rI';

  // ── CLOUDFLARE WORKER URLS ─────────────────────────────────────
  // 🔴 ACTION REQUIRED: Apne Workers deploy karne ke baad URLs yahan daalo
  //
  // 1. Coupon Validation Worker (workers/coupon-validate.js):
  //    dash.cloudflare.com → Workers → Create → paste coupon-validate.js → deploy
  //    URL milegi: https://ak-coupon-validate.YOUR_SUBDOMAIN.workers.dev
  window.AK_COUPON_WORKER_URL = ''; // TODO: 'https://ak-coupon-validate.YOUR.workers.dev'
  //
  // 2. Push Notification Worker (workers/order-notify.js) — admin panel mein bhi set hota hai:
  //    Site Settings → Push Notifications → Worker URL
  //    (Yahan set karne ki zarurat nahi — admin panel se set karo)
})();
