/**
 * Atharav Kitchen — Central Link Configuration
 * Replaces inline link-updater snippet in index.html
 * All platform links managed from ONE place
 */
(function () {
  'use strict';
  var CFG = {
    zomato: 'https://link.zomato.com/xqzv/rshare?id=8966837430563d60',
    swiggy: 'https://www.swiggy.com/search?query=Atharav+Kitchen+Dhanbad',
    whatsapp: 'https://wa.me/917903567007',
    phone: '+91 79035 67007',
  };

  function updateLinks() {
    document.querySelectorAll('a[href*="zomato.com"]').forEach(function (a) {
      a.href = CFG.zomato;
    });
    document.querySelectorAll('a[href*="swiggy.com"]').forEach(function (a) {
      a.href = CFG.swiggy;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateLinks);
  } else {
    updateLinks();
  }

  // Expose config globally so other modules can use it
  window.AK_LINKS = CFG;
})();
