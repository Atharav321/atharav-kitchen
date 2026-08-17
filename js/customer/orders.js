/* ============================================================
   ATHARAV KITCHEN — CUSTOMER APP — orders.js
   Place order, feedback/contact forms, GPS detect, owner alert+WhatsApp, PWA install prompt, wallet/loyalty points engine
   Extracted from legacy app.js (lines 1716-2170) — v14 -> v15 modular split
   Load order matters: this file assumes files loaded before it in
   index.html (see js/customer/*.js <script> order) are already parsed.
   ============================================================ */
function placeOrder() {
  // SECURITY: Rate limit
  if (!akRateLimit('placeOrder', 3, 60000)) {
    showToast('Bahut jaldi! Thoda wait karo. ⏳', 'red');
    return;
  }
  // HARD GUARD — kitchen band hone par order place hi nahi hone dena.
  // Button already disabled via updateCheckoutLockUI(), but re-checked
  // here too in case of a stale UI state (e.g. rapid double-click).
  if (typeof akKitchenOpen !== 'undefined' && akKitchenOpen === false) {
    showToast('🔴 Kitchen abhi band hai — order place nahi ho sakta.', 'red');
    return;
  }

  var name = (document.getElementById('ord-name').value || '').trim();
  var phone = (document.getElementById('ord-phone').value || '').trim();
  var addr = (document.getElementById('ord-address').value || '').trim();
  var note = (document.getElementById('ord-note').value || '').trim();
  if (!name || !phone || !addr) {
    showToast('Name, Phone & Address fill karo!', 'red');
    goStep(3);
    return;
  }
  if (!akValidateName(name)) {
    showToast('Invalid name — sirf letters/numbers/spaces allowed!', 'red');
    return;
  }
  var cleanPhone = phone.replace(/\D/g, '').replace(/^0+/, '');
  if (!akValidatePhone(cleanPhone)) {
    showToast('Valid 10-digit mobile number daalo!', 'red');
    return;
  }
  if (!akValidateAddress(addr)) {
    showToast('Valid delivery address daalo (min 6 chars)!', 'red');
    return;
  }
  if (note.length > 200) {
    showToast('Note too long (max 200 chars)', 'red');
    return;
  }
  if (!deliveryRadiusChecked) {
    showToast('Delivery range check pending — thoda wait karo. 📍', 'red');
    return;
  }
  if (withinDeliveryRadius === false) {
    showToast('Sorry — aap 5km delivery range ke bahar hain. 📍', 'red');
    return;
  }

  name = name.replace(/[<>'"&]/g, '');
  addr = addr.replace(/[<>'"&]/g, '');
  note = note.replace(/[<>'"&]/g, '');

  var payMethod = document.querySelector('input[name="pay-method"]:checked');
  var pay = payMethod ? payMethod.value : 'cod';
  var bill = calcBill();
  var now = new Date().toLocaleString('en-IN');
  var orderId = 'AK' + Date.now().toString().slice(-6);
  var uid = akFirebaseReady && firebase.auth().currentUser ? firebase.auth().currentUser.uid : null;
  var localCustId = currentUser ? currentUser.id : null;
  var guestMode = isGuestOrder();

  var orderObj = {
    id: orderId,
    name: name,
    phone: cleanPhone,
    address: addr,
    note: note,
    items: JSON.parse(JSON.stringify(cart)),
    bill: bill,
    coupon: appliedCoupon || null,
    payment: pay,
    status: 'New',
    time: now,
    platform: 'WhatsApp',
    customerId: uid || localCustId || (guestMode ? 'guest_' + cleanPhone : null),
    isGuest: guestMode,
    createdAtMs: Date.now(),
  };

  // GA4
  ga4Event('purchase', { transaction_id: orderId, value: bill.total, currency: 'INR' });
  var walletDisc = bill.walletDiscount || 0;

  function afterSaved() {
    // Save to localStorage
    var orders = lsGet('ak_orders', []);
    orders.push(orderObj);
    lsSet('ak_orders', orders);
    // Save customer order history — registered users only
    if (!guestMode) {
      if (currentUser && uid && akFirebaseReady) {
        var markWelcome = !!(appliedCoupon && currentUser.welcomeCode === appliedCoupon);
        updateCustomerAfterOrder(uid, orderId, bill.total, now, markWelcome).then(function (patch) {
          if (patch.welcomeCodeUsed) currentUser.welcomeCodeUsed = true;
        });
      } else if (currentUser && currentUser.phone && !akFirebaseReady) {
        var customers = lsGet('ak_customers', []);
        var cidx = customers.findIndex(function (c) {
          return c.phone === currentUser.phone;
        });
        if (cidx > -1) {
          if (!customers[cidx].orders) customers[cidx].orders = [];
          customers[cidx].orders.push({ id: orderId, total: bill.total, date: now });
          customers[cidx].lastOrder = now;
          if (appliedCoupon && currentUser.welcomeCode === appliedCoupon)
            customers[cidx].welcomeCodeUsed = true;
          lsSet('ak_customers', customers);
          currentUser = customers[cidx];
          lsSet('ak_logged_user', currentUser);
          updateNavUser();
        }
      }
    }
    // Award points (registered only)
    if (!guestMode) {
      awardPoints(orderObj);
    }
    if (walletDisc > 0) deductWalletPoints(walletDisc);

    // Build success summary HTML
    var summaryHtml =
      '<div class="success-row"><span>🆔</span><strong>Order ID: ' + orderId + '</strong></div>';
    summaryHtml +=
      '<div class="success-row" style="flex-wrap:wrap;">' +
      Object.entries(cart)
        .map(function (e) {
          return (
            '<span style="background:#FFF0E0;padding:2px 8px;border-radius:6px;margin:2px;font-size:0.78rem;font-weight:700;">' +
            esc(e[0]) +
            ' ×' +
            e[1].qty +
            '</span>'
          );
        })
        .join('') +
      '</div>';
    summaryHtml += '<hr class="success-divider">';
    if (bill.discount > 0)
      summaryHtml +=
        '<div class="success-row" style="color:#16A34A;">🏷️ <span>Coupon Saved: -₹' +
        bill.discount +
        '</span></div>';
    if (walletDisc > 0)
      summaryHtml +=
        '<div class="success-row" style="color:#7C3AED;">💰 <span>Wallet Saved: -₹' +
        walletDisc +
        '</span></div>';
    summaryHtml +=
      '<div class="success-row">💰 <span>Total: <strong>₹' + bill.total + '</strong></span></div>';
    summaryHtml +=
      '<div class="success-row" style="background:#FEF9C3;border:1.5px solid #FDE68A;border-radius:8px;padding:8px 12px;margin-top:8px;font-size:0.85rem;">⏳ <span><strong>Order Received!</strong> Owner confirm karega jaldi.</span></div>';
    summaryHtml +=
      '<div class="success-row" style="font-size:0.8rem;">📱 <span>Confirm hone par <strong>' +
      esc(name) +
      '</strong> ko WhatsApp aayega</span></div>';
    if (guestMode)
      summaryHtml +=
        '<div class="success-row" style="font-size:0.78rem;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:8px 12px;margin-top:6px;">💡 <span>Register karke loyalty points &amp; offers pao!</span></div>';
    summaryHtml +=
      '<div class="success-row" style="font-size:0.75rem;color:#A08060;border-top:1px dashed #EEE;padding-top:8px;margin-top:4px;">Order ID: <strong>' +
      orderId +
      '</strong> — Screenshot karke rakhein</div>';

    document.getElementById('success-summary').innerHTML = summaryHtml;
    var _sTitle = document.querySelector('#order-success .success-title');
    if (_sTitle) _sTitle.textContent = '📋 Order Received!';
    var _sSub = document.querySelector('#order-success .success-subtitle');
    if (_sSub) _sSub.textContent = 'Owner aapka order dekh raha hai — confirmation ka wait karo ⏳';

    // SHOW CONFIRMATION POPUP FIRST (before WhatsApp opens)
    document.getElementById('order-success').style.display = 'flex';
    showOwnerNotification(orderObj);
    closeCartModal();
    if (typeof showTrackFAB === 'function') showTrackFAB(orderId);
    // SERVER-SIDE: Coupon usage confirm karo (usage count increment + per-user lock)
    if (appliedCoupon && typeof confirmCouponUsage === 'function') {
      confirmCouponUsage(appliedCoupon, orderId);
    }
    cart = {};
    appliedCoupon = null;
    if (typeof serverValidatedDiscount !== 'undefined') serverValidatedDiscount = null;
    walletApplied = false;
    currentStep = 1;
    updateCartBar();
    renderMenu(true);
    updateWalletUI();

    // WA message to owner — opens AFTER confirmation popup shown (100ms delay)
    setTimeout(function () {
      var msg = '🍽️ *NEW ORDER — ATHARAV KITCHEN*\n';
      msg += '━━━━━━━━━━━━━━━━━━\n';
      msg += '🆔 Order ID: *' + orderId + '*\n';
      msg += '👤 Name: *' + name + '*\n';
      msg += '📞 Phone: *' + cleanPhone + '*\n';
      msg += '📍 Address: *' + addr + '*\n';
      if (note) msg += '📝 Note: ' + note + '\n';
      msg += guestMode ? '👤 Guest Order\n' : '⭐ Registered Customer: YES\n';
      if (appliedCoupon) msg += '🏷️ Coupon Used: *' + appliedCoupon + '*\n';
      if (walletDisc > 0) msg += '💰 Wallet Used: -Rs.' + walletDisc + '\n';
      msg += '\n📋 *ORDER ITEMS:*\n';
      Object.entries(orderObj.items).forEach(function (e) {
        msg += '• ' + e[0] + ' × ' + e[1].qty + ' = Rs.' + e[1].qty * e[1].price + '\n';
      });
      msg += '\n💰 *BILL:*\nSubtotal: Rs.' + bill.subtotal + '\n';
      if (bill.discount > 0) msg += 'Discount (' + appliedCoupon + '): -Rs.' + bill.discount + '\n';
      if (walletDisc > 0) msg += 'Wallet: -Rs.' + walletDisc + '\n';
      msg += 'Delivery: ' + (bill.delivery === 0 ? 'FREE' : 'Rs.' + bill.delivery) + '\n';
      msg += 'GST (5%): Rs.' + bill.gst + '\n';
      msg += '*GRAND TOTAL: Rs.' + bill.total + '*\n';
      msg += 'Payment: ' + (pay === 'cod' ? 'Cash on Delivery' : 'UPI/Online') + '\n';
      msg += '\n⏰ ' + now;
      // Rs. used instead of the ₹ symbol here — avoids the WhatsApp
      // deep-link occasionally mangling the encoded rupee character
      // into garbled bytes on some devices/WhatsApp client versions.
      window.open('https://wa.me/917903567007?text=' + encodeURIComponent(msg), '_blank');
    }, 3000);
  }

  // Save to Firestore then show confirmation
  if (akFirebaseReady) {
    waitForAuthSession(4000)
      .then(function () {
        return saveOrderWithRetry(orderId, orderObj);
      })
      .then(afterSaved)
      .catch(function (e) {
        // Still show confirmation (WhatsApp msg to owner is the safety net),
        // but the order is now queued in localStorage and will auto-retry —
        // it will NOT silently vanish like before.
        console.warn('Firestore save failed after retries, queued for resync:', e);
        afterSaved();
      });
  } else {
    afterSaved();
  }
}

/* ================================================
   ★ RATINGS & FEEDBACK
   ================================================ */
var ratings = { food: 0, delivery: 0, value: 0 };
function rate(type, val) {
  ratings[type] = val;
  document.querySelectorAll('#s-' + type + ' .star').forEach(function (s, i) {
    s.classList.toggle('on', i < val);
  });
}
function submitFb() {
  // FIX 1: Rating validation — teen mein se ek bhi 0 ho toh submit nahi
  if (ratings.food === 0 || ratings.delivery === 0 || ratings.value === 0) {
    showToast('Please rate Food, Delivery and Value before submitting! ⭐', 'red');
    // Highlight unrated stars
    ['food', 'delivery', 'value'].forEach(function (type) {
      if (ratings[type] === 0) {
        var el = document.getElementById('s-' + type);
        if (el) {
          el.style.outline = '2px solid #DC2626';
          el.style.borderRadius = '4px';
        }
        setTimeout(function () {
          if (el) el.style.outline = '';
        }, 2500);
      }
    });
    return;
  }
  var name = (document.getElementById('fb-name').value || '').trim();
  if (!name) {
    showToast('Please enter your name!', 'red');
    return;
  }
  var fb = {
    id: Date.now(),
    name: name || 'Anonymous',
    date: document.getElementById('fb-date').value || new Date().toISOString().split('T')[0],
    food: ratings.food,
    delivery: ratings.delivery,
    value: ratings.value,
    rating: Math.round((ratings.food + ratings.delivery + ratings.value) / 3),
    comment: (document.getElementById('fb-comment').value || '').trim(),
    platform: document.getElementById('fb-platform').value || '',
    customerId: currentUser ? currentUser.id : null,
    createdAt: new Date().toISOString(),
  };
  var all = lsGet('ak_feedback', []);
  all.push(fb);
  lsSet('ak_feedback', all);
  // Save via data-access layer (firestoreService.js)
  saveFeedback(fb);
  var ok = document.getElementById('fb-ok');
  ok.style.display = 'block';
  setTimeout(function () {
    ok.style.display = 'none';
  }, 5000);
  // Reset form after submit
  ratings = { food: 0, delivery: 0, value: 0 };
  document.querySelectorAll('.star').forEach(function (s) {
    s.classList.remove('on');
  });
  document.getElementById('fb-name').value = '';
  document.getElementById('fb-comment').value = '';
  showToast('Feedback submitted! Thank you 🙏', 'green');
}

/* ================================================
   ★ CONTACT
   ================================================ */
function submitContact() {
  var name = (document.getElementById('ct-name').value || '').trim();
  var phone = (document.getElementById('ct-phone').value || '').trim();
  var subject = document.getElementById('ct-subject').value || 'General Enquiry';
  var msg = (document.getElementById('ct-msg').value || '').trim();
  // FIX 2: Validation
  if (!name) {
    showToast('Please enter your name!', 'red');
    return;
  }
  if (!msg) {
    showToast('Please write a message!', 'red');
    return;
  }
  var contactEntry = {
    id: Date.now(),
    name: name,
    phone: phone,
    subject: subject,
    message: msg,
    createdAt: new Date().toISOString(),
  };
  // Save to localStorage
  var contacts = lsGet('ak_contacts', []);
  contacts.push(contactEntry);
  lsSet('ak_contacts', contacts);
  // Save to Firebase if available
  if (akFirebaseReady) {
    saveContact(contactEntry).catch(function () {});
  }
  // Clear form
  document.getElementById('ct-name').value = '';
  document.getElementById('ct-phone').value = '';
  document.getElementById('ct-msg').value = '';
  var ok = document.getElementById('ct-ok');
  ok.style.display = 'block';
  setTimeout(function () {
    ok.style.display = 'none';
  }, 5000);
  showToast('Message sent! ✅', 'green');
}

/* ================================================
   ★ OFFERS COPY
   ================================================ */
function copyOffer(code, btn) {
  if (navigator.clipboard) navigator.clipboard.writeText(code).catch(function () {});
  btn.textContent = '✅ Copied!';
  setTimeout(function () {
    btn.textContent = 'Copy Code';
  }, 2000);
  showToast('"' + code + '" copied! 🎉', 'green');
}

/* ================================================
   ★ GPS LOCATION
   ================================================ */
function detectGPSLocation() {
  var btn = document.getElementById('gps-btn');
  var btnText = document.getElementById('gps-btn-text');
  var status = document.getElementById('gps-status');
  var addrEl = document.getElementById('ord-address');
  if (!navigator.geolocation) {
    showToast('GPS not supported.', 'red');
    return;
  }
  btnText.textContent = '🔍 Detecting...';
  btn.style.opacity = '0.7';
  btn.disabled = true;
  status.style.display = 'block';
  status.textContent = '📡 Getting GPS...';
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      var lat = pos.coords.latitude,
        lng = pos.coords.longitude;
      applyDeliveryDistanceFromCoords(lat, lng);
      status.textContent = '🗺️ Converting...';
      // FIX 5: Try Google Geocoding first, fallback to OpenStreetMap Nominatim (free, no key)
      function applyAddress(addr) {
        addrEl.value = addr;
        addrEl.style.borderColor = '#22C55E';
        status.textContent = '✅ Location detect ho gaya! Flat/house number add karo.';
        status.style.color = '#16A34A';
        btnText.textContent = '✅ Location Detected';
        btn.style.background = 'linear-gradient(135deg,#16A34A,#22C55E)';
        showToast('📍 Address auto-fill ho gaya!', 'green');
        btn.disabled = false;
        btn.style.opacity = '1';
      }
      function fallbackNominatim() {
        // OpenStreetMap free geocoding — no API key needed
        fetch(
          'https://nominatim.openstreetmap.org/reverse?lat=' +
            lat +
            '&lon=' +
            lng +
            '&format=json&accept-language=en',
          {
            headers: { 'User-Agent': 'AtharavKitchenApp/1.0' },
          }
        )
          .then(function (r) {
            return r.json();
          })
          .then(function (d) {
            if (d && d.display_name) {
              applyAddress(d.display_name);
            } else {
              // Last resort: coordinates + city
              addrEl.value =
                'Near ' + lat.toFixed(4) + '°N ' + lng.toFixed(4) + '°E, Dhanbad, Jharkhand';
              btn.disabled = false;
              btn.style.opacity = '1';
              status.textContent = '⚠️ Address detect nahi hua — manually type karo.';
              status.style.color = '#D97706';
            }
          })
          .catch(function () {
            addrEl.value = 'Lat:' + lat.toFixed(5) + ', Lng:' + lng.toFixed(5) + ', Dhanbad, JH';
            btn.disabled = false;
            btn.style.opacity = '1';
            status.textContent = '⚠️ Address auto-fill nahi hua — manually type karo.';
            status.style.color = '#D97706';
          });
      }
      if (GMAPS_KEY && GMAPS_KEY.length > 10) {
        fetch(
          'https://maps.googleapis.com/maps/api/geocode/json?latlng=' +
            lat +
            ',' +
            lng +
            '&key=' +
            GMAPS_KEY +
            '&language=en'
        )
          .then(function (r) {
            return r.json();
          })
          .then(function (data) {
            if (data.status === 'OK' && data.results && data.results.length) {
              applyAddress(data.results[0].formatted_address);
            } else {
              // Google failed (quota/billing), try Nominatim
              fallbackNominatim();
            }
          })
          .catch(function () {
            fallbackNominatim();
          });
      } else {
        fallbackNominatim();
      }
    },
    function (err) {
      btn.disabled = false;
      btn.style.opacity = '1';
      status.textContent = '❌ Enable location access.';
      status.style.color = '#DC2626';
      status.style.display = 'block';
      btnText.textContent = '📍 Try Again';
      showToast('Enable location permission!', 'red');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

/* ================================================
   ★ ORDER SUCCESS & OWNER NOTIFICATION
   ================================================ */
function dismissOrderSuccess() {
  document.getElementById('order-success').style.display = 'none';
}

var _lastOrder = null;
function showOwnerNotification(order) {
  _lastOrder = order;
  document.getElementById('oa-order-id').textContent = '📦 Order #' + order.id;
  document.getElementById('oa-customer').textContent =
    '👤 ' + order.name + ' | 📞 ' + order.phone + '\n📍 ' + (order.address || '').substring(0, 50);
  document.getElementById('oa-total').textContent = '₹' + order.bill.total;
  var alertEl = document.getElementById('owner-alert');
  alertEl.style.display = 'block';
  playOwnerAlarm();
  setTimeout(function () {
    alertEl.style.display = 'none';
  }, 15000);
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('🔔 NEW ORDER!', {
      body: 'Order #' + order.id + ' | ₹' + order.bill.total,
      icon: 'logo_png.png',
    });
  }
}
function ownerAccept() {
  document.getElementById('owner-alert').style.display = 'none';
  showToast('✅ Order accepted!', 'green');
  if (_lastOrder) ownerWhatsApp();
}
function ownerWhatsApp() {
  if (!_lastOrder) return;
  var o = _lastOrder;
  var msg =
    '✅ *ORDER CONFIRMED — ATHARAV KITCHEN*\n\nHi ' +
    o.name +
    '! 🎉\n\nYour order *#' +
    o.id +
    '* is confirmed!\n\n💰 *Total: Rs.' +
    o.bill.total +
    '*\n🛵 ETA: 30-45 mins\n\n🍽️ Atharav Kitchen — Taste That Travels Fast!';
  window.open(
    'https://wa.me/' + o.phone.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(msg),
    '_blank'
  );
}
function playOwnerAlarm() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.4, 0.8].forEach(function (t) {
      var osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.6, ctx.currentTime + t);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.35);
    });
  } catch (e) {}
}

/* ================================================
   ★ PWA
   ================================================ */
var deferredPrompt;
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  deferredPrompt = e;
  setTimeout(function () {
    var b = document.getElementById('install-banner');
    if (b) b.classList.add('show');
  }, 3000);
});
var ibInstall = document.getElementById('ib-install');
var ibClose = document.getElementById('ib-close');
if (ibInstall) {
  ibInstall.addEventListener('click', function () {
    var b = document.getElementById('install-banner');
    if (b) b.classList.remove('show');
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (r) {
        if (r.outcome === 'accepted') showToast('App installed! 🎉', 'green');
        deferredPrompt = null;
      });
    }
  });
}
if (ibClose) {
  ibClose.addEventListener('click', function () {
    var b = document.getElementById('install-banner');
    if (b) b.classList.remove('show');
  });
}
var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent),
  isStandalone = 'standalone' in window.navigator && window.navigator.standalone;
if (isIOS && !isStandalone) {
  setTimeout(function () {
    showToast('iPhone: Tap Share → "Add to Home Screen" 📱', 'orange');
  }, 4000);
}
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('sw.js')
      .then(function () {})
      .catch(function () {});
  });
}

/* ================================================
   ★ REWARDS & WALLET SYSTEM
   ================================================ */
var POINTS_PER_ORDER = 100; // ₹350+ order pe 100 points
var POINTS_ORDER_MIN = 350; // minimum order for points
var POINTS_STREAK_BONUS = 50; // 3 orders streak bonus
var POINTS_BIRTHDAY_MULT = 2; // birthday double points
var POINTS_VALUE = 0.5; // 1 point = ₹0.5

function getWallet() {
  var ru = realFirebaseUser();
  if (ru) {
    // Firebase se milega — async load hoga
    return lsGet('ak_wallet_' + ru.uid, { points: 0, history: [] });
  }
  if (currentUser && currentUser.phone)
    return lsGet('ak_wallet_' + currentUser.phone, { points: 0, history: [] });
  return { points: 0, history: [] };
}
function saveWallet(w) {
  var ru = realFirebaseUser();
  if (ru) {
    lsSet('ak_wallet_' + ru.uid, w);
    // Firebase mein bhi save — wallet sirf server write, lekin localStorage se bhi cache
    saveWalletDoc(ru.uid, w).catch(function () {});
    return;
  }
  if (currentUser && currentUser.phone) lsSet('ak_wallet_' + currentUser.phone, w);
}
function loadWalletFromFirebase() {
  var ru = realFirebaseUser();
  if (!ru) return;
  var uid = ru.uid;
  getWalletDoc(uid)
    .then(function (snap) {
      if (snap.exists) {
        lsSet('ak_wallet_' + uid, snap.data());
        updateWalletUI();
      }
    })
    .catch(function () {});
}
function updateWalletUI() {
  var w = getWallet();
  var pts = w.points || 0;
  var rupees = Math.floor(pts * POINTS_VALUE);
  var els = ['wallet-points-display', 'wallet-pts-nav'];
  els.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.textContent = pts + ' pts (₹' + rupees + ')';
  });
  var useBtn = document.getElementById('wallet-use-btn');
  if (useBtn) useBtn.disabled = pts < 20; // min 20 points to use
  var walletRow = document.getElementById('wallet-row');
  if (walletRow) walletRow.style.display = currentUser ? 'block' : 'none';
}

var walletApplied = false;
function toggleWallet() {
  if (!currentUser) {
    showToast('Login karo pehle!', 'red');
    return;
  }
  var w = getWallet();
  if (w.points < 20) {
    showToast('Minimum 20 points chahiye wallet use karne ke liye.', 'red');
    return;
  }
  if (appliedCoupon && !walletApplied) {
    showToast('Coupon remove karo pehle — ek hi discount ek baar!', 'red');
    return;
  }
  walletApplied = !walletApplied;
  var btn = document.getElementById('wallet-use-btn');
  if (btn) btn.textContent = walletApplied ? '❌ Remove Wallet' : '💰 Use Wallet';
  if (walletApplied) showToast('Wallet applied! Points se discount milega ✅', 'green');
  else showToast('Wallet removed.', 'orange');
  renderFinalBill();
  updateCheckoutLockUI();
}

function getWalletDiscount(subtotal) {
  if (!walletApplied || !currentUser) return 0;
  var w = getWallet();
  var maxRupees = Math.floor((w.points || 0) * POINTS_VALUE);
  return Math.min(maxRupees, Math.floor(subtotal * 0.5)); // max 50% off from wallet
}

function awardPoints(order) {
  if (!currentUser) return;
  var subtotal = order.bill ? order.bill.subtotal : 0;
  if (subtotal < POINTS_ORDER_MIN) return;
  var w = getWallet();
  var pts = POINTS_PER_ORDER;
  // Birthday double points
  if (isBirthday()) pts = pts * POINTS_BIRTHDAY_MULT;
  // Streak bonus
  var orders = getMyOrderHistory();
  if (orders.length > 0 && orders.length % 3 === 0) pts += POINTS_STREAK_BONUS;
  w.points = (w.points || 0) + pts;
  w.history = w.history || [];
  w.history.push({
    type: 'earn',
    pts: pts,
    orderId: order.id,
    date: new Date().toLocaleString('en-IN'),
    reason: 'Order ' + order.id,
  });
  saveWallet(w);
  updateWalletUI();
  if (pts > POINTS_PER_ORDER) {
    var reason = isBirthday() ? '🎂 Birthday Double Points!' : '🔥 3-Order Streak Bonus!';
    showToast('+' + pts + ' points earned! ' + reason, 'green');
  } else {
    showToast('+' + pts + ' Reward Points earned! 🌟', 'green');
  }
}

function deductWalletPoints(discountAmount) {
  if (!walletApplied || !currentUser) return;
  var pointsUsed = Math.ceil(discountAmount / POINTS_VALUE);
  var w = getWallet();
  w.points = Math.max(0, (w.points || 0) - pointsUsed);
  w.history = w.history || [];
  w.history.push({
    type: 'use',
    pts: -pointsUsed,
    date: new Date().toLocaleString('en-IN'),
    reason: 'Redeemed at checkout',
  });
  saveWallet(w);
  walletApplied = false;
  updateWalletUI();
}

function isBirthday() {
  if (!currentUser || !currentUser.dob) return false;
  var dobStr = String(currentUser.dob).trim();
  var parts = dobStr.split('-');
  var dobMonth, dobDay;
  if (parts.length === 3) {
    dobMonth = parseInt(parts[1], 10) - 1; // month is 0-indexed
    dobDay = parseInt(parts[2], 10);
  } else {
    var dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return false;
    dobMonth = dob.getMonth();
    dobDay = dob.getDate();
  }
  var now = new Date();
  return dobDay === now.getDate() && dobMonth === now.getMonth();
}
