/**
 * ============================================================
 *  ATHARAV KITCHEN — RUNTIME SECURITY MODULE v2.0
 *  Load this FIRST in every HTML page (before firebase-config.js)
 *
 *  REMOVED in v2.0:
 *    - Fake devtools-block (window size heuristic) — unreliable,
 *      breaks on mobile split-screen, annoys developers, zero
 *      actual security value. Real security = Firestore Rules.
 *    - Right-click / F12 block — also fake; Ctrl+Shift+I still
 *      worked, merely annoyed legitimate developers.
 *
 *  KEPT / IMPROVED in v2.0:
 *    - Console warning (social engineering deterrent)
 *    - XSS param sanitizer
 *    - Clickjacking guard (X-Frame-Options already in _headers,
 *      this is a JS fallback)
 *    - Session integrity helper
 *    - Honeypot checker
 *    - Input flood protection
 *    - localStorage price-tampering detection
 *    - Error masking in production
 * ============================================================
 */
(function () {
  'use strict';

  var IS_LOCAL =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // ── LAYER 1: Console Warning — Social engineering deterrent ──
  if (typeof console !== 'undefined') {
    console.log('%c⛔ STOP!', 'color:red;font-size:3rem;font-weight:bold;');
    console.log(
      '%cYeh browser console developers ke liye hai.\n' +
        'Agar kisi ne tumhe yahan kuch paste karne ko kaha hai — woh SCAM hai!\n' +
        'Atharav Kitchen ki team kabhi console mein kuch paste karne ko nahi bolegi.',
      'color:#d63031;font-size:1rem;font-weight:bold;'
    );
  }

  // ── LAYER 2: XSS Filter — URL param sanitization ─────────
  window.akSafeParam = function (val) {
    if (val == null) return '';
    return String(val)
      .replace(/[<>"'`\\/]/g, '')
      .substring(0, 200);
  };

  // ── LAYER 3: Clickjacking Guard (JS fallback) ─────────────
  // Primary protection = X-Frame-Options: SAMEORIGIN in _headers
  try {
    if (window.self !== window.top) {
      window.top.location = window.self.location;
    }
  } catch (e) {
    // Cross-origin frame — render nothing
    document.documentElement.innerHTML =
      '<h1 style="font-family:sans-serif;text-align:center;padding:3rem;color:red;">⛔ Unauthorized Access</h1>';
  }

  // ── LAYER 4: Session Integrity Helper ─────────────────────
  window.akCheckSessionAge = function (maxAgeMs) {
    try {
      var s = JSON.parse(sessionStorage.getItem('ak_admin_session'));
      if (!s || !s.ts) return false;
      return Date.now() - s.ts < maxAgeMs;
    } catch (e) {
      return false;
    }
  };

  // ── LAYER 5: Honeypot Field Detector ──────────────────────
  // Forms mein hidden fields add karo — bots unhe fill karte hain
  window.akHoneypotCheck = function (formEl) {
    var hp = formEl.querySelector('[name="website"],[name="url"],[name="hp"]');
    if (hp && hp.value !== '') return false; // Bot detected
    return true;
  };

  // ── LAYER 6: Input Flood Protection ───────────────────────
  var _inputCounts = {};
  window.akInputFloodCheck = function (field, maxPerMin) {
    var now = Date.now();
    if (!_inputCounts[field]) _inputCounts[field] = [];
    _inputCounts[field] = _inputCounts[field].filter(function (t) {
      return now - t < 60000;
    });
    if (_inputCounts[field].length >= maxPerMin) return false;
    _inputCounts[field].push(now);
    return true;
  };

  // ── LAYER 7: localStorage Price-Tampering Detection ───────
  window.akStorageIntegrityCheck = function () {
    try {
      var menu = JSON.parse(localStorage.getItem('ak_menu'));
      if (menu && Array.isArray(menu)) {
        var suspicious = menu.some(function (i) {
          return i.price < 1 || i.price > 10000;
        });
        if (suspicious) {
          console.warn('[AK Security] Menu price tampering detected — clearing cache');
          localStorage.removeItem('ak_menu');
          return false;
        }
      }
      return true;
    } catch (e) {
      return true;
    }
  };

  // ── LAYER 8: Production Error Masking ─────────────────────
  window.addEventListener('error', function (e) {
    if (e && e.error && e.error.stack && !IS_LOCAL) {
      e.preventDefault(); // Stack trace ko user se hide karo
    }
  });

  // Run integrity check on DOM ready
  window.addEventListener('DOMContentLoaded', function () {
    window.akStorageIntegrityCheck();
  });

  window._akSecurityLoaded = true;
  if (IS_LOCAL) {
    console.info('[AK Security] ✅ Security Module v2.0 loaded (dev mode)');
  }
})();
