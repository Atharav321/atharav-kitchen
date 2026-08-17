/**
 * Atharav Kitchen — Service Worker Registration
 * External file replaces unsafe-inline SW snippet
 */
(function () {
  'use strict';
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {
        // SW registration failed — non-critical, app continues normally
      });
    });
  }
})();
