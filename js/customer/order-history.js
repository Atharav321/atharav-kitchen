/* ============================================================
   ATHARAV KITCHEN — CUSTOMER APP — order-history.js
   Feedback popup, GA4 analytics events, customer order history, init hook for new features
   Extracted from legacy app.js (lines 2171-2367) — v14 -> v15 modular split
   Load order matters: this file assumes files loaded before it in
   index.html (see js/customer/*.js <script> order) are already parsed.
   ============================================================ */

function getMyOrderHistory() {
  if (currentUser && currentUser.orders) return currentUser.orders;
  return lsGet('ak_orders', []).filter(function (o) {
    return currentUser && (o.customerId === currentUser.id || o.phone === currentUser.phone);
  });
}

function renderOrderHistory() {
  var el = document.getElementById('order-history-list');
  if (!el) return;
  var orders = getMyOrderHistory();
  if (!orders || !orders.length) {
    el.innerHTML =
      '<div style="text-align:center;padding:1.5rem;color:#A08060;font-size:0.85rem;">No orders yet. Place your first order! 🍽️</div>';
    return;
  }
  var sorted = orders.slice().reverse().slice(0, 10);
  el.innerHTML = sorted
    .map(function (o) {
      var itemsObj = o.items || {};
      var itemsArr = Array.isArray(itemsObj)
        ? itemsObj
        : Object.entries(itemsObj).map(function (e) {
            return { name: e[0], qty: e[1].qty, price: e[1].price };
          });
      var itemsSummary =
        itemsArr
          .slice(0, 2)
          .map(function (i) {
            return i.name;
          })
          .join(', ') + (itemsArr.length > 2 ? ' +more' : '');
      return (
        '<div style="padding:12px 0;border-bottom:1.5px solid #F5EDE5;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<div><div style="font-weight:800;color:#2D1A00;font-size:0.85rem;">📦 #' +
        (o.id || o.orderId) +
        '</div>' +
        '<div style="color:#A08060;font-size:0.72rem;margin-top:2px;">' +
        (o.date || o.time || '') +
        '</div></div>' +
        '<div style="font-weight:900;color:#FF6B00;font-size:0.9rem;">₹' +
        (o.total || (o.bill && o.bill.total) || '—') +
        '</div></div>' +
        (itemsSummary
          ? '<div style="font-size:0.75rem;color:#5C3A1E;margin-bottom:8px;background:#FFF8F0;padding:4px 8px;border-radius:6px;">' +
            esc(itemsSummary) +
            '</div>'
          : '') +
        '<button onclick="repeatOrder(' +
        JSON.stringify(JSON.stringify(o)) +
        ')" style="padding:7px 14px;background:linear-gradient(135deg,#FF6B00,#FF8C00);color:#fff;border:none;border-radius:8px;font-family:Nunito,sans-serif;font-weight:800;font-size:0.75rem;cursor:pointer;">🔄 Repeat Order</button>' +
        '</div>'
      );
    })
    .join('');
}

function repeatOrder(orderJson) {
  var order = JSON.parse(orderJson);
  var items = order.items || {};
  var itemsArr = Array.isArray(items)
    ? items
    : Object.entries(items).map(function (e) {
        return { name: e[0], qty: e[1].qty, price: e[1].price };
      });
  if (!itemsArr.length) {
    showToast('Order items nahi mile!', 'red');
    return;
  }
  itemsArr.forEach(function (it) {
    cart[it.name] = { qty: it.qty, price: it.price };
  });
  updateCartBar();
  renderMenu(true);
  closeOrderHistory();
  goTo('menu');
  showToast('🔄 Pichla order cart mein add ho gaya!', 'green');
}

/* ================================================
   ★ WHATSAPP DETAILED BILL
   ================================================ */
function sendWhatsAppBill(order) {
  var bill = order.bill || {};
  var msg = '🧾 *BILL — ATHARAV KITCHEN*\n';
  msg += '━━━━━━━━━━━━━━━━━━\n';
  msg += '🆔 Order: *' + order.id + '*\n';
  msg += '👤 ' + order.name + '\n';
  msg += '📍 ' + order.address + '\n\n';
  msg += '📋 *ITEMS:*\n';
  var items = order.items || {};
  if (Array.isArray(items)) {
    items.forEach(function (it) {
      msg += '• ' + it.name + ' × ' + it.qty + ' = Rs.' + it.qty * it.price + '\n';
    });
  } else {
    Object.entries(items).forEach(function (e) {
      msg += '• ' + e[0] + ' × ' + e[1].qty + ' = Rs.' + e[1].qty * e[1].price + '\n';
    });
  }
  msg += '\n💰 *BILL DETAILS:*\n';
  msg += 'Subtotal: Rs.' + (bill.subtotal || 0) + '\n';
  if (bill.discount > 0) msg += 'Coupon (' + order.coupon + '): -Rs.' + bill.discount + '\n';
  if (bill.walletDiscount > 0) msg += 'Wallet: -Rs.' + bill.walletDiscount + '\n';
  msg += 'Delivery: ' + (bill.delivery === 0 ? 'FREE' : 'Rs.' + (bill.delivery || 30)) + '\n';
  msg += 'GST (5%): Rs.' + (bill.gst || 0) + '\n';
  msg += '━━━━━━━━━━━━━━━━━━\n';
  msg += '*TOTAL: Rs.' + bill.total + '*\n';
  msg += 'Payment: ' + (order.payment === 'cod' ? 'Cash on Delivery' : 'UPI/Online') + '\n\n';
  msg += 'Thank you for ordering from Atharav Kitchen! 🍽️\n';
  msg += '⭐ Rate us: g.page/AtharavKitchen\n';
  msg += '📞 Support: wa.me/917903567007';
  window.open(
    'https://wa.me/' +
      String(order.phone || '').replace(/[^0-9]/g, '') +
      '?text=' +
      encodeURIComponent(msg),
    '_blank'
  );
}

/* ================================================
   ★ FEEDBACK POPUP (har website open pe)
   ================================================ */
function checkFeedbackPopup() {
  var lastShown = lsGet('ak_fb_popup_last', 0);
  var now = Date.now();
  var COOLDOWN = 24 * 60 * 60 * 1000; // FIX: was showing on every page load — now once per 24h
  if (currentUser && now - lastShown >= COOLDOWN) {
    setTimeout(function () {
      var pop = document.getElementById('feedback-popup');
      if (pop) pop.style.display = 'flex';
    }, 8000);
  }
}
function closeFeedbackPopup() {
  var pop = document.getElementById('feedback-popup');
  if (pop) pop.style.display = 'none';
  lsSet('ak_fb_popup_last', Date.now());
}
// Google Business Profile review link — apna actual GBP review link yahan daalo
var AK_GBP_REVIEW_URL = 'YOUR_GOOGLE_REVIEW_LINK';

function quickFeedback(val) {
  // Guest bhi feedback de sakta hai
  var fb = {
    id: Date.now(),
    name: (currentUser && currentUser.name) || 'Guest',
    customerId: (currentUser && (currentUser.id || currentUser.phone)) || 'guest',
    quick: val,
    rating: val,
  };
  saveFeedback(fb);
  closeFeedbackPopup();
  if (val >= 4) {
    showToast('Thanks for the love! ❤️ Google pe bhi rate karo!', 'green');
    if (AK_GBP_REVIEW_URL && AK_GBP_REVIEW_URL.indexOf('YOUR_') < 0) {
      setTimeout(function () {
        window.open(AK_GBP_REVIEW_URL, '_blank');
      }, 1200);
    }
  } else {
    showToast("Thanks! We'll improve 🙏", 'orange');
  }
}

/* ================================================
   ★ GA4 CUSTOM EVENTS
   ================================================ */
function ga4Event(name, params) {
  try {
    if (window.gtag) gtag('event', name, params || {});
  } catch (e) {}
}
// Cart abandon tracking
var cartAbandonTimer = null;
function trackCartOpen() {
  ga4Event('cart_open', { items_count: Object.keys(cart).length });
  if (cartAbandonTimer) clearTimeout(cartAbandonTimer);
  cartAbandonTimer = setTimeout(function () {
    if (Object.keys(cart).length > 0) {
      ga4Event('cart_abandon', {
        items_count: Object.keys(cart).length,
        cart_value: Object.values(cart).reduce(function (s, i) {
          return s + i.qty * i.price;
        }, 0),
      });
    }
  }, 300000); // 5 min mein abandon consider
}
function trackCheckoutDrop(step) {
  ga4Event('checkout_drop', {
    step: step,
    cart_value: Object.values(cart).reduce(function (s, i) {
      return s + i.qty * i.price;
    }, 0),
  });
}
function trackPageSection(section) {
  ga4Event('section_view', { section_name: section });
}

/* ================================================
   ★ ORDER HISTORY MODAL
   ================================================ */
function openOrderHistory() {
  var modal = document.getElementById('order-history-modal');
  if (modal) {
    renderOrderHistory();
    modal.style.display = 'flex';
    var w = getWallet();
    var wEl = document.getElementById('oh-wallet-pts');
    if (wEl)
      wEl.textContent =
        (w.points || 0) + ' points (₹' + Math.floor((w.points || 0) * POINTS_VALUE) + ')';
  }
}
function closeOrderHistory() {
  var modal = document.getElementById('order-history-modal');
  if (modal) modal.style.display = 'none';
}

/* ================================================
   ★ PATCH: tapCoupon — block if wallet active
   ================================================ */
var _origTapCoupon = tapCoupon;
tapCoupon = function (code) {
  if (walletApplied) {
    showToast('Wallet remove karo pehle — ek hi discount ek baar!', 'red');
    return;
  }
  _origTapCoupon(code);
};

/* ================================================
   ★ INIT NEW FEATURES after auth
   ================================================ */
function initNewFeatures() {
  updateWalletUI();
  loadWalletFromFirebase();
  checkFeedbackPopup();
  // Birthday notification
  if (isBirthday()) {
    setTimeout(function () {
      showToast(
        '🎂 Happy Birthday ' +
          ((currentUser && currentUser.name) || '') +
          '! Double points aaj! 🎉',
        'green'
      );
    }, 3000);
  }
}

/* ================================================
   ★ INIT
   ================================================ */

/* ================================================
   ★ FIX 4: CUSTOMER LIVE ORDER TRACKING SYSTEM
   ================================================ */

var _trackingOrderId = null;
var _trackingInterval = null;
var _trackingUnsubscribe = null;
var _etaCountdownInterval = null;
var _etaTargetByOrderId = {};
var TRACK_STEPS = [
  { key: 'New', icon: '📋', title: 'Order Received', sub: 'Aapka order humne receive kar liya' },
  {
    key: 'Confirmed',
    icon: '✅',
    title: 'Order Confirmed',
    sub: 'Kitchen ne order confirm kar diya',
  },
  {
    key: 'Preparing',
    icon: '🍳',
    title: 'Khana Ban Raha Hai',
    sub: 'Chef aapka order prepare kar raha hai',
  },
  {
    key: 'Out for Delivery',
    icon: '🛵',
    title: 'Out for Delivery',
    sub: 'Rider aapke paas aa raha hai!',
  },
  {
    key: 'Delivered',
    icon: '🎉',
    title: 'Delivered!',
    sub: 'Order deliver ho gaya. Enjoy your meal!',
  },
];
