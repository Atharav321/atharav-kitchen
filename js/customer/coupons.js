/**
 * ============================================================
 *  ATHARAV KITCHEN — coupons.js  v2.0 (Server-side validated)
 *
 *  Responsibility: Coupon / discount code management
 *    - Server-side validate via Cloudflare Worker (tamper-proof)
 *    - Client-side COUPONS object sirf UI fallback ke liye
 *    - Apply discount to cart total
 *    - One coupon per order enforcement
 *    - Coupon usage confirm on order place (Worker se)
 *
 *  Depends on: core.js, firebase-config.js
 *  Global API: applyCoupon(), removeCoupon(), confirmCouponUsage(couponCode, orderId)
 * ============================================================
 */

// ── SERVER-VALIDATED DISCOUNT (set by Worker response) ────────────
// Jab Worker discount confirm kare, yahan store hota hai
// calcBill() is value ko use karta hai — COUPONS object ko nahi
var serverValidatedDiscount = null; // { discount, type, label } | null

// ── APPLY COUPON (with server-side validation) ────────────────────
function applyCoupon() {
  var code = (document.getElementById('coupon-inp').value || '').trim().toUpperCase();
  tapCoupon(code);
}

function tapCoupon(code) {
  document.getElementById('coupon-inp').value = code;
  var res = document.getElementById('coupon-result');
  var bill = calcBill();

  if (!code) {
    _showCouponMsg(res, 'red', '❌ Coupon code daalo.');
    appliedCoupon = null;
    serverValidatedDiscount = null;
    renderCartItems();
    return;
  }

  // ── If Worker URL configured → server-side validate ──────────
  var workerUrl = (window.AK_COUPON_WORKER_URL || '').trim();
  if (workerUrl && akFirebaseReady && firebase.auth().currentUser && !firebase.auth().currentUser.isAnonymous) {
    _serverValidateCoupon(code, bill.subtotal, res);
    return;
  }

  // ── Fallback: client-side (Worker URL nahi set, ya guest user) ──
  _clientValidateCoupon(code, bill, res);
}

// ── SERVER VALIDATION via Cloudflare Worker ───────────────────────
function _serverValidateCoupon(code, subtotal, resEl) {
  // Loading state
  _showCouponMsg(resEl, 'gray', '⏳ Validating coupon...');
  var applyBtn = document.getElementById('coupon-apply-btn');
  if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = '⏳'; }

  firebase.auth().currentUser.getIdToken(false)
    .then(function (idToken) {
      return fetch(window.AK_COUPON_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate',
          idToken: idToken,
          couponCode: code,
          subtotal: subtotal,
        }),
      });
    })
    .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
    .then(function (result) {
      if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = 'Apply'; }
      if (!result.ok || !result.data.ok) {
        _showCouponMsg(resEl, 'red', result.data.error || '❌ Invalid coupon');
        appliedCoupon = null;
        serverValidatedDiscount = null;
        renderCartItems();
        return;
      }
      // ✅ Server approved
      appliedCoupon = code;
      serverValidatedDiscount = {
        discount: result.data.discount,
        type: result.data.type,
        label: result.data.label,
        isWelcome: !!result.data.isWelcome,
      };
      _showCouponMsg(resEl, 'green', result.data.message || '✅ Coupon applied!');
      showToast('Coupon applied! ₹' + result.data.discount + ' bachoge 🎉', 'green');
      renderCartItems();
      renderFinalBill();
    })
    .catch(function (e) {
      if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = 'Apply'; }
      console.warn('[AK Coupon] Worker error, falling back to client-side', e);
      // Network fail hone par client-side fallback
      _clientValidateCoupon(code, calcBill(), resEl);
    });
}

// ── CLIENT-SIDE FALLBACK (offline / Worker not configured) ───────
function _clientValidateCoupon(code, bill, resEl) {
  // Welcome coupon re-use block
  if (currentUser && code === currentUser.welcomeCode && currentUser.welcomeCodeUsed) {
    _showCouponMsg(resEl, 'red', '❌ Yeh welcome coupon already use ho chuka hai — sirf ek baar milta hai.');
    appliedCoupon = null;
    serverValidatedDiscount = null;
    return;
  }

  var c = COUPONS[code];
  if (!c) {
    _showCouponMsg(resEl, 'red', '❌ Invalid code. Try: WELCOME' + getWelcomeCouponAmt() + ', FREEDEL, WA50, WEEKEND');
    appliedCoupon = null;
    serverValidatedDiscount = null;
    return;
  }
  if (bill.subtotal < (c.min || 0)) {
    _showCouponMsg(resEl, 'yellow', '⚠️ Min order ₹' + c.min + ' needed. Add ₹' + (c.min - bill.subtotal) + ' more.');
    appliedCoupon = null;
    serverValidatedDiscount = null;
    return;
  }

  appliedCoupon = code;
  // Client-side mein serverValidatedDiscount null — calcBill() COUPONS se fallback karega
  serverValidatedDiscount = null;

  // Mark welcome code
  if (currentUser && code === currentUser.welcomeCode && !currentUser.welcomeCodeUsed) {
    currentUser.welcomeCodeUsed = true;
    if (akFirebaseReady && firebase.auth().currentUser) {
      markWelcomeCodeUsedDirect(firebase.auth().currentUser.uid).catch(function () {});
    }
    updateNavUser();
  }

  var newBill = calcBill();
  _showCouponMsg(resEl, 'green', '✅ "' + code + '" applied! You save ₹' + newBill.discount + '. ' + c.label);
  showToast('Coupon applied! Saving ₹' + newBill.discount + ' 🎉', 'green');
  renderCartItems();
  renderFinalBill();
}

// ── CONFIRM COUPON USAGE (call after order saved) ─────────────────
// Yeh function orders.js se call hota hai jab order successfully save ho jaata hai
function confirmCouponUsage(couponCode, orderId) {
  if (!couponCode || !orderId) return;
  var workerUrl = (window.AK_COUPON_WORKER_URL || '').trim();
  if (!workerUrl || !akFirebaseReady || !firebase.auth().currentUser) return;
  if (firebase.auth().currentUser.isAnonymous) return;

  firebase.auth().currentUser.getIdToken(false)
    .then(function (idToken) {
      return fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          idToken: idToken,
          couponCode: couponCode,
          orderId: orderId,
        }),
      });
    })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.ok) console.info('[AK Coupon] Usage confirmed server-side for', couponCode);
    })
    .catch(function (e) {
      console.warn('[AK Coupon] Usage confirm failed (will retry on next validate):', e);
    });

  // Also mark welcome coupon used in Firestore (existing logic)
  if (currentUser && couponCode === currentUser.welcomeCode) {
    var uid = firebase.auth().currentUser.uid;
    markWelcomeCodeUsedDirect(uid).catch(function () {});
  }
}

// ── REMOVE COUPON ──────────────────────────────────────────────────
function removeCoupon() {
  appliedCoupon = null;
  serverValidatedDiscount = null;
  var res = document.getElementById('coupon-result');
  if (res) { res.style.display = 'none'; res.textContent = ''; }
  var inp = document.getElementById('coupon-inp');
  if (inp) inp.value = '';
  renderCartItems();
  renderFinalBill();
}

// ── UI HELPER ──────────────────────────────────────────────────────
function _showCouponMsg(el, color, text) {
  if (!el) return;
  var styles = {
    red:    { bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' },
    green:  { bg: '#D1FAE5', color: '#065F46', border: '#A7F3D0' },
    yellow: { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
    gray:   { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' },
  };
  var s = styles[color] || styles.gray;
  el.style.display = 'block';
  el.style.background = s.bg;
  el.style.color = s.color;
  el.style.border = '1px solid ' + s.border;
  el.textContent = text;
}

// ── RENDER FINAL BILL (uses server-validated discount if available) ─
function renderFinalBill() {
  var bill = calcBill(); // calcBill ab serverValidatedDiscount use karta hai
  var summaryHtml = '<div style="font-weight:700;color:#2D1A00;margin-bottom:0.5rem;">📦 Order Items:</div>';
  Object.entries(cart).forEach(function (e) {
    summaryHtml += '• ' + esc(e[0]) + ' × ' + e[1].qty + ' = <b>₹' + e[1].qty * e[1].price + '</b><br>';
  });
  if (appliedCoupon) {
    var couponLabel = (serverValidatedDiscount && serverValidatedDiscount.label) || appliedCoupon;
    summaryHtml += '<div style="margin-top:0.5rem;color:#16A34A;font-weight:700;">🏷️ Coupon: ' + couponLabel + '</div>';
  }
  if (walletApplied) {
    summaryHtml += '<div style="margin-top:0.5rem;color:#7C3AED;font-weight:700;">💰 Wallet: -₹' + bill.walletDiscount + '</div>';
  }
  document.getElementById('final-order-summary').innerHTML = summaryHtml;

  var el = function (id, v) { var e = document.getElementById(id); if (e) e.textContent = v; };
  el('final-subtotal', '₹' + bill.subtotal);
  el('final-gst', '₹' + bill.gst);
  el('final-total', '₹' + bill.total);
  el('pay-btn-total', bill.total);

  var dEl = document.getElementById('final-delivery');
  if (dEl) {
    dEl.textContent = bill.delivery === 0 ? 'FREE' : '₹' + bill.delivery;
    dEl.style.color = bill.delivery === 0 ? '#16A34A' : '#5C3A1E';
  }
  var dr = document.getElementById('final-discount-row');
  if (dr) dr.style.display = bill.discount > 0 ? 'flex' : 'none';
  el('final-discount', '-₹' + bill.discount);

  var cl = document.getElementById('final-coupon-label');
  if (cl && appliedCoupon) {
    cl.textContent = 'Discount (' + appliedCoupon + ')';
  }
  var wr = document.getElementById('final-wallet-row');
  if (wr) wr.style.display = bill.walletDiscount > 0 ? 'flex' : 'none';
  el('final-wallet-disc', '-₹' + bill.walletDiscount);
}
