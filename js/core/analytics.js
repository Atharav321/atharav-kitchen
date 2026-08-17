/**
 * Atharav Kitchen — Google Analytics Initializer
 * External file replaces unsafe-inline GA snippet
 * Load with: <script async src="...gtag/js?id=G-1Z105Q39G2"></script>
 *            <script src="js/core/analytics.js?v=4" defer></script>
 */
(function () {
  'use strict';
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', 'G-1Z105Q39G2');
})();
