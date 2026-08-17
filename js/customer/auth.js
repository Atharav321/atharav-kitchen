/* ============================================================
   ATHARAV KITCHEN — CUSTOMER APP — auth.js
   Delivery-radius calc, guest/session helpers, welcome-coupon helpers, OTP register/login/logout, Google/Facebook login, nav-user update, coupon-success + offer popups
   Extracted from legacy app.js (lines 223-1157) — v14 -> v15 modular split
   Load order matters: this file assumes files loaded before it in
   index.html (see js/customer/*.js <script> order) are already parsed.
   ============================================================ */

function customerEmailFromPhone(phone) {
  return String(phone).replace(/\D/g, '') + '@akcustomer.app';
}

function customerPasswordFromPhonePin(phone, pin) {
  return 'AK' + String(phone).replace(/\D/g, '') + '_' + String(pin);
}

function haversineKm(lat1, lng1, lat2, lng2) {
  var R = 6371,
    toRad = function (d) {
      return (d * Math.PI) / 180;
    };
  var dLat = toRad(lat2 - lat1),
    dLng = toRad(lng2 - lng1);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function applyDeliveryDistanceFromCoords(lat, lng) {
  var d = haversineKm(lat, lng, SHOP_LAT, SHOP_LNG);
  deliveryRadiusChecked = true;
  if (d > MAX_DELIVERY_KM) {
    withinDeliveryRadius = false;
    showToast('Sorry — delivery sirf 5km tak hai (Dhanbad mein). 😔', 'red');
  } else {
    withinDeliveryRadius = true;
  }
  updateCheckoutLockUI();
}

function checkUserDeliveryRadius() {
  // GPS se 5km radius verify hota hai, lekin GPS na milne/deny hone par order
  // HARD BLOCK nahi hoga — hum bas verify nahi kar paaye, customer address
  // manually daal ke aage badh sakta hai. Sirf CONFIRMED outside-5km (real
  // coords se) hi block hota hai — see applyDeliveryDistanceFromCoords().
  if (!navigator.geolocation) {
    deliveryRadiusChecked = true;
    withinDeliveryRadius = null;
    showToast(
      'Location detect nahi ho paya — address manually daal ke order continue kar sakte ho.',
      'orange'
    );
    updateCheckoutLockUI();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      applyDeliveryDistanceFromCoords(pos.coords.latitude, pos.coords.longitude);
    },
    function () {
      // User ne GPS deny kiya — verify nahi kar sakte, isliye BLOCK nahi karenge.
      // Address manually daal ke order place kar sakta hai; hum 5km ke bahar
      // waale orders ko genuine GPS/coords se hi confirm-block karte hain.
      deliveryRadiusChecked = true;
      withinDeliveryRadius = null;
      showToast(
        'Location access allow nahi kiya — koi baat nahi, apna address manually daal do.',
        'orange'
      );
      updateCheckoutLockUI();
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
}

// FIX: Anonymous auth session (used only so guest Firestore writes/reads pass
// security rules) should NEVER count as a "real" logged-in user. Always check
// !isAnonymous wherever we mean "customer is registered/logged in".
function realFirebaseUser() {
  var u = akFirebaseReady && firebase && firebase.auth && firebase.auth().currentUser;
  return u && !u.isAnonymous ? u : null;
}
function firebaseUser() {
  return realFirebaseUser();
}
function customerLoggedIn() {
  // Registered user — Firebase auth (excludes anonymous guest sessions)
  if (realFirebaseUser()) return true;
  // Registered user — localStorage (Firebase offline)
  if (!akFirebaseReady && currentUser && currentUser.phone) return true;
  // Guest — allow if they have filled name+phone in checkout form
  var gName = (
    (document.getElementById('ord-name') && document.getElementById('ord-name').value) ||
    ''
  ).trim();
  var gPhone = (
    (document.getElementById('ord-phone') && document.getElementById('ord-phone').value) ||
    ''
  ).trim();
  if (gName && gPhone && gPhone.replace(/\D/g, '').length === 10) return true;
  return false;
}
// Guest helper — returns true if user is ordering as guest (not registered)
function isGuestOrder() {
  if (realFirebaseUser()) return false;
  if (currentUser && currentUser.phone) return false;
  return true;
}

// FIX: Ensure an anonymous Firebase Auth session exists so guest checkout
// (Firestore order create + live tracking read) passes security rules, which
// require request.auth != null. This does NOT make the guest "registered" —
// see realFirebaseUser() above. Requires Anonymous sign-in to be enabled in
// Firebase Console → Authentication → Sign-in method.
function ensureGuestAuthSession() {
  if (!akFirebaseReady || !firebase || !firebase.auth) return;
  if (firebase.auth().currentUser) return; // already signed in (real or anon)
  firebase
    .auth()
    .signInAnonymously()
    .catch(function (e) {
      console.warn(
        '[Atharav Kitchen] Anonymous auth failed — guest orders may not sync live. Enable Anonymous sign-in in Firebase Console.',
        e
      );
    });
}

// Waits (with timeout) for a real Firebase Auth session — real login OR anonymous —
// so Firestore writes that require request.auth != null don't get silently rejected.
// Returns a Promise<boolean> (true = have a session, false = gave up after timeout).
function waitForAuthSession(timeoutMs) {
  timeoutMs = timeoutMs || 4000;
  return new Promise(function (resolve) {
    if (!akFirebaseReady || !firebase || !firebase.auth) {
      resolve(false);
      return;
    }
    if (firebase.auth().currentUser) {
      resolve(true);
      return;
    }
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      resolve(false);
    }, timeoutMs);
    firebase
      .auth()
      .signInAnonymously()
      .then(function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(true);
      })
      .catch(function (e) {
        console.warn('[Atharav Kitchen] Anonymous auth failed:', e);
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(false);
      });
  });
}

// saveOrderWithRetry() and resyncPendingOrders() now live in
// firestoreService.js (single data-access layer for Firestore).

function updateCheckoutLockUI() {
  var loggedIn = realFirebaseUser() || (currentUser && currentUser.phone);
  var guestMsg = document.getElementById('cart-guest-msg');
  var cartBtn = document.getElementById('cartbar-order-btn');
  var placeBtn = document.getElementById('place-order-btn');
  var banner = document.getElementById('order-lock-banner');
  // Guest message — show as tip (not blocker) when not registered
  if (guestMsg) {
    guestMsg.style.display = loggedIn ? 'none' : 'flex';
  }
  // Cart button — always show (guest can open cart)
  if (cartBtn) {
    cartBtn.style.display = 'inline-block';
    cartBtn.disabled = false;
    cartBtn.classList.remove('disabled');
  }
  // HARD BLOCK — Kitchen closed (admin toggle, live from Firestore via
  // ensureKitchenStatusListener()). Highest priority check: agar kitchen
  // band hai, order place hi nahi hone dena — chahe delivery radius/login
  // sahi ho. Pehle sirf banner dikhta tha, button disable nahi hota tha.
  if (typeof akKitchenOpen !== 'undefined' && akKitchenOpen === false) {
    if (placeBtn) {
      placeBtn.disabled = true;
      placeBtn.style.opacity = '0.45';
      placeBtn.style.cursor = 'not-allowed';
    }
    if (banner) {
      banner.textContent = '🔴 Kitchen abhi band hai — ordering temporarily disabled hai.';
      banner.classList.add('show');
    }
    return;
  }
  // Place order button — sirf CONFIRMED outside-5km (false) pe hard block.
  // null (GPS deny/unavailable) = unverified, order allowed hone dete hain.
  if (!deliveryRadiusChecked) {
    if (placeBtn) {
      placeBtn.disabled = true;
      placeBtn.style.opacity = '0.6';
      placeBtn.style.cursor = 'wait';
    }
    if (banner) {
      banner.textContent = 'Checking delivery range...';
      banner.classList.add('show');
    }
    return;
  }
  if (withinDeliveryRadius === false) {
    if (placeBtn) {
      placeBtn.disabled = true;
      placeBtn.style.opacity = '0.45';
      placeBtn.style.cursor = 'not-allowed';
    }
    if (banner) {
      banner.textContent =
        'Sorry — we only deliver within 5km of our kitchen. Ordering is disabled.';
      banner.classList.add('show');
    }
    return;
  }
  if (withinDeliveryRadius === null) {
    // Unverified — allow ordering, just a soft heads-up (not a blocker)
    if (placeBtn) {
      placeBtn.disabled = false;
      placeBtn.style.opacity = '1';
      placeBtn.style.cursor = 'pointer';
    }
    if (banner) {
      banner.textContent =
        '📍 Location verify nahi ho paayi — sirf Dhanbad ke 5km radius mein hi deliver karte hain.';
      banner.classList.add('show');
    }
    return;
  }
  if (placeBtn) {
    placeBtn.disabled = false;
    placeBtn.style.opacity = '1';
    placeBtn.style.cursor = 'pointer';
  }
  if (banner) {
    banner.classList.remove('show');
  }
}

var currentUser = null;

// Welcome coupon amount — admin can change via ak_settings
function getWelcomeCouponAmt() {
  return lsGet('ak_settings', {}).welcomeCouponAmt || 100;
}
function getWelcomeCouponMin() {
  return lsGet('ak_settings', {}).welcomeCouponMin || 200;
}

// Generate unique coupon code per customer
function genWelcomeCode(phone) {
  var amt = getWelcomeCouponAmt();
  return 'WELCOME' + amt + '_' + phone.slice(-4);
}
// Generate unique referral code per customer (stored in their Firestore profile
// so it works across devices — not just localStorage on their own phone)
function genReferralCode(seed) {
  var s = String(seed || Date.now());
  return 'AK' + s.slice(-4).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

// Update coupon amount display in modal
function updateCouponDisplay() {
  var amt = getWelcomeCouponAmt();
  var el1 = document.getElementById('wm-coupon-preview-amt');
  var el2 = document.getElementById('wcp-amount-display');
  var el3 = document.getElementById('reg-coupon-display');
  if (el1) el1.textContent = '₹' + amt;
  if (el2) el2.textContent = '₹' + amt + ' OFF';
  if (el3) el3.textContent = '₹' + amt + ' OFF';
}

// Show auth screen
function showScreen(name) {
  ['welcome', 'register', 'login'].forEach(function (s) {
    var el = document.getElementById('screen-' + s);
    if (el) el.style.display = 'none';
  });
  var target = document.getElementById('screen-' + name);
  if (target) {
    target.style.display = 'block';
  }
  document.getElementById('auth-overlay').style.display = 'flex';
  updateCouponDisplay();
}

function skipAuth() {
  document.getElementById('auth-overlay').style.display = 'none';
  lsSet('ak_auth_skipped', true);
}

function loadCustomerProfile(uid) {
  if (!akFirebaseReady) return Promise.resolve(null);
  return getCustomerDoc(uid)
    .then(function (snap) {
      return snap.exists ? snap.data() : null;
    })
    .catch(function () {
      return null;
    });
}

// ════════════════════════════════════════════════
//  PHONE OTP AUTH SYSTEM
// ════════════════════════════════════════════════

var _regConfirmation = null;
var _loginConfirmation = null;
var _regRecaptcha = null;
var _loginRecaptcha = null;
var _otpTimerReg = null;
var _otpTimerLogin = null;

// ---- OTP Countdown Timer ----
function startOTPCountdown(timerElId, resendFn) {
  var el = document.getElementById(timerElId);
  var secs = 60;
  var t = setInterval(function () {
    secs--;
    if (el) el.textContent = 'OTP valid for ' + secs + ' seconds';
    if (secs <= 0) {
      clearInterval(t);
      if (el) el.textContent = 'OTP expired. Tap Resend.';
    }
  }, 1000);
  return t;
}

// ---- REGISTER: Step 1 — Collect Info & Send OTP ----
function sendRegisterOTP() {
  // SECURITY: Rate limit OTP requests — max 3 per 5 min (boundary layer 7)
  if (!akRateLimit('sendOTP', 3, 300000)) {
    showToast('OTP limit reached! 5 minutes baad try karo.', 'red');
    return;
  }
  var name = document.getElementById('reg-name').value.trim();
  var phone = document
    .getElementById('reg-phone')
    .value.replace(/\D/g, '')
    .replace(/^0+/, '')
    .trim();
  var dob = document.getElementById('reg-dob').value;

  ['reg-name', 'reg-phone', 'reg-dob'].forEach(function (id) {
    var inp = document.getElementById(id);
    var err = document.getElementById('err-' + id);
    if (inp) inp.classList.remove('err');
    if (err) err.classList.remove('show');
  });

  var ok = true;
  if (!name) {
    document.getElementById('reg-name').classList.add('err');
    document.getElementById('err-reg-name').classList.add('show');
    ok = false;
  }
  if (!phone || phone.length !== 10) {
    document.getElementById('reg-phone').classList.add('err');
    document.getElementById('err-reg-phone').classList.add('show');
    ok = false;
  }
  if (!dob) {
    document.getElementById('reg-dob').classList.add('err');
    document.getElementById('err-reg-dob').classList.add('show');
    ok = false;
  }
  if (!ok) return;

  // Offline fallback
  if (!akFirebaseReady) {
    _offlineRegister(name, phone, dob, document.getElementById('reg-email').value.trim());
    return;
  }

  var btn = document.getElementById('reg-send-otp-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Sending OTP...';

  try {
    // FIX: Clear old recaptcha completely before creating new one
    if (_regRecaptcha) {
      try {
        _regRecaptcha.clear();
      } catch (e) {}
      _regRecaptcha = null;
    }
    // FIX: Remove old recaptcha DOM nodes to avoid duplicate widget error
    var rcEl = document.getElementById('recaptcha-reg');
    if (rcEl) rcEl.innerHTML = '';
    _regRecaptcha = new firebase.auth.RecaptchaVerifier('recaptcha-reg', {
      size: 'invisible',
      callback: function () {},
      'expired-callback': function () {
        if (_regRecaptcha) {
          try {
            _regRecaptcha.clear();
          } catch (e) {}
          _regRecaptcha = null;
        }
      },
    });
    // FIX: render() first so it's ready on mobile browsers
    _regRecaptcha
      .render()
      .then(function () {
        return firebase.auth().signInWithPhoneNumber('+91' + phone, _regRecaptcha);
      })
      .then(function (confirmation) {
        _regConfirmation = confirmation;
        document.getElementById('reg-step-1').style.display = 'none';
        document.getElementById('reg-step-2').style.display = 'block';
        document.getElementById('reg-otp-sent-to').textContent = 'OTP sent to +91 ' + phone;
        _otpTimerReg = startOTPCountdown('reg-otp-timer');
        showToast('OTP sent to +91' + phone + '! 📱', 'green');
        btn.disabled = false;
        btn.textContent = '📱 Send OTP to My Number';
      })
      .catch(function (e) {
        btn.disabled = false;
        btn.textContent = '📱 Send OTP to My Number';
        if (_regRecaptcha) {
          try {
            _regRecaptcha.clear();
          } catch (ex) {}
          _regRecaptcha = null;
        }
        var rcEl2 = document.getElementById('recaptcha-reg');
        if (rcEl2) rcEl2.innerHTML = '';
        var msg = 'OTP bhejne mein error. ';
        if (e.code === 'auth/invalid-phone-number')
          msg = 'Phone number galat hai. 10 digit number daalo.';
        else if (e.code === 'auth/too-many-requests')
          msg = 'Bahut zyada attempts. 10 minute baad try karo.';
        else if (e.code === 'auth/quota-exceeded')
          msg = 'SMS limit khatam. WhatsApp se order karo: wa.me/917903567007';
        else if (e.code === 'auth/app-not-authorized')
          msg =
            'Firebase Phone Auth enable nahi hai. Firebase Console → Auth → Sign-in methods → Phone enable karo.';
        else if (e.code === 'auth/network-request-failed')
          msg = 'Network error. Internet connection check karo.';
        else msg = 'OTP error: ' + (e.message || e.code || 'Try again');
        showToast(msg, 'red');
      });
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '📱 Send OTP to My Number';
    var rcEl3 = document.getElementById('recaptcha-reg');
    if (rcEl3) rcEl3.innerHTML = '';
    showToast('OTP start nahi hua: ' + (e.message || 'Internet check karo'), 'red');
  }
}

// ---- REGISTER: Step 2 — Verify OTP & Save Profile ----
function verifyRegisterOTP() {
  var otp = document.getElementById('reg-otp').value.trim();
  var name = document.getElementById('reg-name').value.trim();
  var phone = document
    .getElementById('reg-phone')
    .value.replace(/\D/g, '')
    .replace(/^0+/, '')
    .trim();
  var dob = document.getElementById('reg-dob').value;
  var email = document.getElementById('reg-email').value.trim();

  document.getElementById('reg-otp').classList.remove('err');
  document.getElementById('err-reg-otp').classList.remove('show');

  if (!otp || otp.length !== 6) {
    document.getElementById('reg-otp').classList.add('err');
    document.getElementById('err-reg-otp').classList.add('show');
    return;
  }
  if (!_regConfirmation) {
    showToast('Pehle OTP send karo.', 'red');
    return;
  }

  var btn = document.getElementById('reg-verify-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Verifying...';

  _regConfirmation
    .confirm(otp)
    .then(function (cred) {
      if (_otpTimerReg) clearInterval(_otpTimerReg);
      var uid = cred.user.uid;
      var code = genWelcomeCode(phone);
      var customer = {
        id: uid,
        firebaseUid: uid,
        name: name,
        phone: phone,
        dob: dob,
        email: email || '',
        welcomeCode: code,
        welcomeCodeUsed: false,
        referralCode: genReferralCode(phone),
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: new Date().toLocaleString('en-IN'),
        orders: [],
      };
      return createCustomerDoc(uid, customer);
    })
    .then(function (customer) {
      if (welcomeAuthTimer) {
        clearTimeout(welcomeAuthTimer);
        welcomeAuthTimer = null;
      }
      currentUser = customer;
      // Sentry user context — errors tagged with customer (no PII)
      if (window.akSentrySetUser) window.akSentrySetUser({ id: customer.id || 'unknown', page: 'customer' });
      var refInput = document.getElementById('reg-referral');
      if (refInput && refInput.value.trim()) applyReferralBonus(refInput.value, customer);
      injectCustomerCoupon(customer);
      document.getElementById('auth-overlay').style.display = 'none';
      showCouponSuccess(customer);
      updateNavUser();
      checkUserDeliveryRadius();
    })
    .catch(function (e) {
      btn.disabled = false;
      btn.textContent = '✅ Verify & Create Account';
      document.getElementById('reg-otp').classList.add('err');
      document.getElementById('err-reg-otp').classList.add('show');
      if (e.code === 'auth/code-expired') {
        document.getElementById('err-reg-otp').textContent = 'OTP expire ho gaya. Resend karo.';
      } else if (e.code === 'auth/invalid-verification-code') {
        document.getElementById('err-reg-otp').textContent = 'Galat OTP. Dobara check karo.';
      } else {
        document.getElementById('err-reg-otp').textContent = 'OTP verify nahi hua. Try again.';
      }
    });
}

// ---- REGISTER: Resend OTP ----
function resetRegisterOTP() {
  if (_otpTimerReg) clearInterval(_otpTimerReg);
  _regConfirmation = null;
  document.getElementById('reg-step-2').style.display = 'none';
  document.getElementById('reg-step-1').style.display = 'block';
  document.getElementById('reg-otp').value = '';
  document.getElementById('reg-otp').classList.remove('err');
  document.getElementById('err-reg-otp').classList.remove('show');
  document.getElementById('err-reg-otp').textContent = 'Wrong OTP. Please try again.';
}

// ---- LOGIN: Step 1 — Send OTP ----
function sendLoginOTP() {
  // SECURITY: Rate limit
  if (!akRateLimit('sendOTP', 3, 300000)) {
    showToast('OTP limit reached! 5 minutes baad try karo.', 'red');
    return;
  }
  var phone = document
    .getElementById('login-phone')
    .value.replace(/\D/g, '')
    .replace(/^0+/, '')
    .trim();
  document.getElementById('login-phone').classList.remove('err');
  document.getElementById('err-login-phone').classList.remove('show');

  if (!phone || phone.length !== 10) {
    document.getElementById('login-phone').classList.add('err');
    document.getElementById('err-login-phone').classList.add('show');
    return;
  }

  // Try to init Firebase once more before giving up
  if (!akFirebaseReady) {
    tryInitFirebase();
  }
  if (!akFirebaseReady) {
    showToast('Internet ya Firebase connected nahi. Check karo aur retry karo.', 'red');
    return;
  }

  var btn = document.getElementById('login-send-otp-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Sending OTP...';

  // Cleanup any previous reCAPTCHA instance completely
  if (_loginRecaptcha) {
    try {
      _loginRecaptcha.clear();
    } catch (e) {}
    _loginRecaptcha = null;
  }
  var rcEl = document.getElementById('recaptcha-login');
  if (rcEl) rcEl.innerHTML = '';

  try {
    _loginRecaptcha = new firebase.auth.RecaptchaVerifier('recaptcha-login', {
      size: 'invisible',
      callback: function () {},
      'expired-callback': function () {
        if (_loginRecaptcha) {
          try {
            _loginRecaptcha.clear();
          } catch (e) {}
          _loginRecaptcha = null;
        }
        var rcE = document.getElementById('recaptcha-login');
        if (rcE) rcE.innerHTML = '';
      },
    });
    _loginRecaptcha
      .render()
      .then(function () {
        return firebase.auth().signInWithPhoneNumber('+91' + phone, _loginRecaptcha);
      })
      .then(function (confirmation) {
        _loginConfirmation = confirmation;
        document.getElementById('login-step-1').style.display = 'none';
        document.getElementById('login-step-2').style.display = 'block';
        document.getElementById('login-otp-sent-to').textContent = 'OTP sent to +91 ' + phone;
        _otpTimerLogin = startOTPCountdown('login-otp-timer');
        showToast('OTP +91' + phone + ' pe bheja! 📱', 'green');
        btn.disabled = false;
        btn.textContent = '📱 Send OTP';
      })
      .catch(function (e) {
        btn.disabled = false;
        btn.textContent = '📱 Send OTP';
        if (_loginRecaptcha) {
          try {
            _loginRecaptcha.clear();
          } catch (ex) {}
          _loginRecaptcha = null;
        }
        var rcE2 = document.getElementById('recaptcha-login');
        if (rcE2) rcE2.innerHTML = '';
        var msg = 'OTP nahi bheja.';
        if (e.code === 'auth/invalid-phone-number')
          msg = 'Phone number galat hai — 10 digit Indian number daalo.';
        else if (e.code === 'auth/too-many-requests')
          msg = 'Bahut zyada attempts! 10 minute baad try karo.';
        else if (e.code === 'auth/app-not-authorized')
          msg = 'Phone Auth enable nahi hai. Firebase Console → Auth → Phone enable karo.';
        else if (e.code === 'auth/network-request-failed')
          msg = 'Network error. Internet check karo.';
        else if (e.code === 'auth/quota-exceeded') msg = 'OTP quota exceed. Kal try karo.';
        else if (e.code === 'auth/captcha-check-failed')
          msg = 'reCAPTCHA fail hua. Page refresh karo.';
        else msg = 'OTP error: ' + (e.message || e.code || 'Try again');
        showToast(msg, 'red');
      });
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '📱 Send OTP';
    if (_loginRecaptcha) {
      try {
        _loginRecaptcha.clear();
      } catch (ex) {}
      _loginRecaptcha = null;
    }
    var rcE3 = document.getElementById('recaptcha-login');
    if (rcE3) rcE3.innerHTML = '';
    showToast('OTP start nahi hua: ' + (e.message || 'Page refresh karo'), 'red');
  }
}

// ---- LOGIN: Step 2 — Verify OTP ----
function verifyLoginOTP() {
  var otp = document.getElementById('login-otp').value.trim();
  var phone = document
    .getElementById('login-phone')
    .value.replace(/\D/g, '')
    .replace(/^0+/, '')
    .trim();

  document.getElementById('login-otp').classList.remove('err');
  document.getElementById('err-login-otp').classList.remove('show');

  if (!otp || otp.length !== 6) {
    document.getElementById('login-otp').classList.add('err');
    document.getElementById('err-login-otp').classList.add('show');
    return;
  }
  if (!_loginConfirmation) {
    showToast('Pehle OTP send karo.', 'red');
    return;
  }

  var btn = document.getElementById('login-verify-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Verifying...';

  _loginConfirmation
    .confirm(otp)
    .then(function (cred) {
      if (_otpTimerLogin) clearInterval(_otpTimerLogin);
      var uid = cred.user.uid;
      return loadCustomerProfile(uid).then(function (data) {
        if (!data) {
          // Pehli baar phone se login — profile create karo
          var customer = {
            id: uid,
            firebaseUid: uid,
            name: 'Customer',
            phone: phone,
            welcomeCode: genWelcomeCode(phone),
            welcomeCodeUsed: false,
            referralCode: genReferralCode(phone),
            joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: new Date().toLocaleString('en-IN'),
            orders: [],
          };
          return createCustomerDoc(uid, customer);
        }
        return data;
      });
    })
    .then(function (customer) {
      if (welcomeAuthTimer) {
        clearTimeout(welcomeAuthTimer);
        welcomeAuthTimer = null;
      }
      currentUser = customer;
      if (!currentUser.id) currentUser.id = firebase.auth().currentUser.uid;
      injectCustomerCoupon(currentUser);
      document.getElementById('auth-overlay').style.display = 'none';
      updateNavUser();
      showToast('Welcome back ' + (currentUser.name || '') + '! 🎉', 'green');
      checkUserDeliveryRadius();
      scheduleOfferPopups();
      if (document.getElementById('fb-name'))
        document.getElementById('fb-name').value = currentUser.name || '';
      if (document.getElementById('ord-name'))
        document.getElementById('ord-name').value = currentUser.name || '';
      if (document.getElementById('ord-phone'))
        document.getElementById('ord-phone').value = currentUser.phone || '';
    })
    .catch(function (e) {
      btn.disabled = false;
      btn.textContent = '🔑 Verify & Sign In';
      document.getElementById('login-otp').classList.add('err');
      document.getElementById('err-login-otp').classList.add('show');
      if (e.code === 'auth/code-expired') {
        document.getElementById('err-login-otp').textContent = 'OTP expire ho gaya. Resend karo.';
      } else {
        document.getElementById('err-login-otp').textContent = 'Galat OTP. Dobara check karo.';
      }
    });
}

// ---- LOGIN: Resend OTP ----
function resetLoginOTP() {
  if (_otpTimerLogin) clearInterval(_otpTimerLogin);
  _loginConfirmation = null;
  document.getElementById('login-step-2').style.display = 'none';
  document.getElementById('login-step-1').style.display = 'block';
  document.getElementById('login-otp').value = '';
  document.getElementById('login-otp').classList.remove('err');
  document.getElementById('err-login-otp').classList.remove('show');
  document.getElementById('err-login-otp').textContent = 'Wrong OTP. Please try again.';
}

// ---- Offline Register Fallback ----
function _offlineRegister(name, phone, dob, email) {
  var customers = lsGet('ak_customers', []);
  if (
    customers.find(function (c) {
      return c.phone === phone;
    })
  ) {
    document.getElementById('reg-phone').classList.add('err');
    document.getElementById('err-reg-phone').textContent =
      'Yeh number already registered hai! Sign in karo.';
    document.getElementById('err-reg-phone').classList.add('show');
    return;
  }
  var code = genWelcomeCode(phone);
  var customer = {
    id: 'CUST' + Date.now(),
    name: name,
    phone: phone,
    dob: dob,
    email: email,
    welcomeCode: code,
    welcomeCodeUsed: false,
    joinedAt: new Date().toISOString(),
    orders: [],
  };
  customers.push(customer);
  lsSet('ak_customers', customers);
  if (welcomeAuthTimer) {
    clearTimeout(welcomeAuthTimer);
    welcomeAuthTimer = null;
  }
  currentUser = customer;
  lsSet('ak_logged_user', customer);
  injectCustomerCoupon(customer);
  document.getElementById('auth-overlay').style.display = 'none';
  showCouponSuccess(customer);
  updateNavUser();
  checkUserDeliveryRadius();
}

// Inject personal welcome coupon into active coupons
function injectCustomerCoupon(customer) {
  if (!customer || !customer.welcomeCode) return;
  var amt = getWelcomeCouponAmt();
  var min = getWelcomeCouponMin();
  COUPONS[customer.welcomeCode] = {
    type: 'flat',
    value: amt,
    min: min,
    maxDisc: amt,
    label: '₹' + amt + ' OFF — Welcome Gift for ' + customer.name + '!',
  };
}

// ---- LOGOUT ----
function doLogout() {
  if (akFirebaseReady) {
    firebase
      .auth()
      .signOut()
      .catch(function () {});
  } else {
    lsSet('ak_logged_user', null);
  }
  currentUser = null;
  updateNavUser();
  updateCheckoutLockUI();
  showToast('Logged out. Come back soon! 👋', '');
}

// ---- UPDATE NAV ----
function updateNavUser() {
  var btn = document.getElementById('nav-user-btn');
  var lbl = document.getElementById('nav-user-lbl');
  var avatar = document.getElementById('nav-user-avatar');
  if (!currentUser) {
    if (btn) btn.classList.remove('logged-in');
    if (lbl) lbl.textContent = 'Login / Register';
    if (avatar) avatar.textContent = '👤';
    document.getElementById('user-dropdown').style.display = 'none';
    document.getElementById('ud-coupon-row').style.display = 'none';
    return;
  }
  if (btn) btn.classList.add('logged-in');
  if (lbl) lbl.textContent = (currentUser.name || 'You').split(' ')[0];
  if (avatar) avatar.textContent = (currentUser.name || 'U')[0].toUpperCase();
  document.getElementById('ud-name').textContent = currentUser.name || '';
  document.getElementById('ud-phone').textContent = '+91 ' + (currentUser.phone || '');
  if (!currentUser.welcomeCodeUsed && currentUser.welcomeCode) {
    document.getElementById('ud-coupon-row').style.display = 'flex';
    document.getElementById('ud-coupon-code').textContent = currentUser.welcomeCode;
  } else {
    document.getElementById('ud-coupon-row').style.display = 'none';
  }
}

function toggleUserDropdown() {
  if (!currentUser) {
    showScreen('welcome');
    return;
  }
  var dd = document.getElementById('user-dropdown');
  dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}
// Close dropdown on outside click
document.addEventListener('click', function (e) {
  var wrap = document.getElementById('user-btn-wrap');
  if (wrap && !wrap.contains(e.target)) {
    var dd = document.getElementById('user-dropdown');
    if (dd) dd.style.display = 'none';
  }
});

function openAuthOrProfile() {
  if (!currentUser) showScreen('welcome');
  else toggleUserDropdown();
}

// ---- COUPON SUCCESS ----
function showCouponSuccess(customer) {
  var amt = getWelcomeCouponAmt();
  document.getElementById('csb-name').textContent =
    'Hi ' + (customer.name || 'friend').split(' ')[0] + '! 🎉';
  document.getElementById('csb-code').textContent = customer.welcomeCode;
  document.getElementById('csb-val').textContent = '₹' + amt + ' OFF on your first order!';
  document.getElementById('coupon-success').style.display = 'flex';
}

function closeCouponSuccess() {
  document.getElementById('coupon-success').style.display = 'none';
  updateNavUser();
  scheduleOfferPopups();
  showToast('Welcome to Atharav Kitchen! 🍽️ Happy ordering!', 'green');
}

function copyCsbCode() {
  var code = document.getElementById('csb-code').textContent;
  if (navigator.clipboard) navigator.clipboard.writeText(code).catch(function () {});
  showToast('Code ' + code + ' copied! 📋', 'green');
}

/* ================================================
   ★ OFFER POPUPS (timed, for logged-in users)
   ================================================ */
var OFFER_POPUPS = [
  {
    emoji: '🔥',
    title: 'Weekend Special!',
    sub: 'Today only — Buy 2 get 1 free!',
    code: 'WEEKEND',
    desc: 'Order via WhatsApp. Buy 2 mains, get 1 drink free! Valid Sat-Sun.',
    bg: 'linear-gradient(135deg,#E23744,#a0222e)',
    cta: 'https://wa.me/917903567007',
  },
  {
    emoji: '💬',
    title: 'WhatsApp Exclusive!',
    sub: '₹50 OFF on orders above ₹300',
    code: 'WA50',
    desc: 'Order directly on WhatsApp and save ₹50! Minimum order ₹300.',
    bg: 'linear-gradient(135deg,#25D366,#0e8f47)',
    cta: 'https://wa.me/917903567007',
  },
  {
    emoji: '🎉',
    title: 'Free Delivery Day!',
    sub: 'Free delivery on orders above ₹399',
    code: 'FREEDEL',
    desc: 'Today is your lucky day! Get free delivery on orders above ₹399.',
    bg: 'linear-gradient(135deg,#1B4332,#2D6A4F)',
    cta: 'https://link.zomato.com/xqzv/rshare?id=8966837430563d60',
  },
];
var popupTimers = [];
var currentPopupCTA = '';

function scheduleOfferPopups() {
  popupTimers.forEach(function (t) {
    clearTimeout(t);
  });
  popupTimers = [];
  // Show admin-set offers or defaults
  var adminOffers = lsGet('ak_offers', []);
  var activeOffers = adminOffers.filter(function (o) {
    return o.active;
  });
  // Show 1st popup after 90 seconds, then every 4 minutes
  [90000, 330000, 570000].forEach(function (delay, i) {
    var t = setTimeout(function () {
      if (!currentUser) return;
      var offer = activeOffers.length > i ? null : OFFER_POPUPS[i % OFFER_POPUPS.length];
      if (activeOffers.length > 0) {
        var ao = activeOffers[i % activeOffers.length];
        offer = {
          emoji: '🎁',
          title: ao.title,
          sub: ao.disc,
          code: ao.code,
          desc: ao.desc,
          bg: 'linear-gradient(135deg,#FF6B00,#FF8C00)',
          cta: 'https://wa.me/917903567007',
        };
      }
      if (offer) showOfferPopup(offer);
    }, delay);
    popupTimers.push(t);
  });
}

function showOfferPopup(offer) {
  document.getElementById('opb-top').style.background =
    offer.bg || 'linear-gradient(135deg,#FF6B00,#FF8C00)';
  document.getElementById('opb-emoji').textContent = offer.emoji;
  document.getElementById('opb-title').textContent = offer.title;
  document.getElementById('opb-sub').textContent = offer.sub;
  document.getElementById('opb-code-txt').textContent = offer.code;
  document.getElementById('opb-desc').textContent = offer.desc;
  currentPopupCTA = offer.cta || 'https://wa.me/917903567007';
  document.getElementById('offer-popup').style.display = 'flex';
}
function closeOfferPopup() {
  document.getElementById('offer-popup').style.display = 'none';
}
function copyPopupCode() {
  var code = document.getElementById('opb-code-txt').textContent;
  if (navigator.clipboard) navigator.clipboard.writeText(code).catch(function () {});
  showToast('Code ' + code + ' copied! 📋', 'green');
}
function popupCTA() {
  closeOfferPopup();
  window.open(currentPopupCTA, '_blank');
}

/* ================================================
   ★ SOCIAL LOGIN (Google + Facebook)
   ================================================ */
function handleGoogleResult(user) {
  var uid = user.uid;
  return loadCustomerProfile(uid)
    .then(function (data) {
      if (!data) {
        var customer = {
          id: uid,
          firebaseUid: uid,
          name: user.displayName || 'Customer',
          phone: user.phoneNumber || '',
          email: user.email || '',
          photoURL: user.photoURL || '',
          welcomeCode: genWelcomeCode(uid.slice(-4)),
          welcomeCodeUsed: false,
          referralCode: genReferralCode(uid.slice(-4)),
          loginMethod: 'google',
          joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
          createdAt: new Date().toLocaleString('en-IN'),
          orders: [],
        };
        return createCustomerDoc(uid, customer);
      }
      return data;
    })
    .then(function (customer) {
      if (welcomeAuthTimer) {
        clearTimeout(welcomeAuthTimer);
        welcomeAuthTimer = null;
      }
      currentUser = customer;
      if (!currentUser.id) currentUser.id = firebase.auth().currentUser.uid;
      injectCustomerCoupon(currentUser);
      document.getElementById('auth-overlay').style.display = 'none';
      updateNavUser();
      showToast('Welcome ' + (currentUser.name || '') + '! Google se login hua ✅', 'green');
      checkUserDeliveryRadius();
      scheduleOfferPopups();
      initNewFeatures();
      if (document.getElementById('fb-name'))
        document.getElementById('fb-name').value = currentUser.name || '';
      if (document.getElementById('ord-name'))
        document.getElementById('ord-name').value = currentUser.name || '';
    })
    .catch(function (e) {
      showToast('Google login failed: ' + (e.message || 'Try again'), 'red');
    });
}

function loginWithGoogle() {
  if (!akFirebaseReady) {
    showToast('Firebase connected nahi hai.', 'red');
    return;
  }
  var provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  // FIX: signInWithPopup use karo — works on both desktop & mobile
  // Popup fail hone par redirect fallback use karo
  firebase
    .auth()
    .signInWithPopup(provider)
    .then(function (result) {
      if (result && result.user) {
        handleGoogleResult(result.user);
      }
    })
    .catch(function (e) {
      if (
        e.code === 'auth/popup-blocked' ||
        e.code === 'auth/popup-cancelled-by-user' ||
        e.code === 'auth/cancelled-popup-request'
      ) {
        showToast('Popup blocked — redirect se try kar raha hoon...', 'orange');
        setTimeout(function () {
          firebase.auth().signInWithRedirect(provider);
        }, 300);
      } else if (e.code === 'auth/popup-closed-by-user') {
        return; // User ne khud band kiya — silent
      } else if (e.code === 'auth/unauthorized-domain') {
        showToast(
          '⚠️ Firebase Console mein atharav321.github.io aur atharav-kitchen.pages.dev dono ko Authorized Domains mein add karo!',
          'red'
        );
      } else if (e.code === 'auth/network-request-failed') {
        showToast('Network error. Internet check karo aur retry karo.', 'red');
      } else {
        showToast('Google login failed: ' + (e.message || e.code || 'Try again'), 'red');
      }
    });
}

// Page load pe redirect result check karo (popup-blocked fallback ke liye)
// FIX: Race condition — check immediately if akFirebaseReady already true, AND listen for event
function checkGoogleRedirectResult() {
  if (!akFirebaseReady || !firebase || !firebase.auth) return;
  firebase
    .auth()
    .getRedirectResult()
    .then(function (result) {
      if (result && result.user) {
        handleGoogleResult(result.user);
      }
    })
    .catch(function (e) {
      if (e.code && e.code !== 'auth/no-current-user' && e.code !== 'auth/null-user') {
        showToast('Google login error: ' + e.message, 'red');
      }
    });
}
window.addEventListener('akFirebaseReady', checkGoogleRedirectResult);
// Also try immediately in case Firebase already loaded before this line ran
if (akFirebaseReady) setTimeout(checkGoogleRedirectResult, 500);
if (akFirebaseReady)
  setTimeout(function () {
    try {
      startMenuFirebaseSync();
    } catch (e) {}
  }, 500);

function loginWithFacebook() {
  if (!akFirebaseReady) {
    showToast('Firebase connected nahi hai.', 'red');
    return;
  }
  var provider = new firebase.auth.FacebookAuthProvider();
  provider.addScope('email');
  firebase
    .auth()
    .signInWithPopup(provider)
    .then(function (result) {
      var user = result.user;
      var uid = user.uid;
      return loadCustomerProfile(uid).then(function (data) {
        if (!data) {
          var customer = {
            id: uid,
            firebaseUid: uid,
            name: user.displayName || 'Customer',
            phone: user.phoneNumber || '',
            email: user.email || '',
            photoURL: user.photoURL || '',
            welcomeCode: genWelcomeCode(uid.slice(-4)),
            welcomeCodeUsed: false,
            referralCode: genReferralCode(uid.slice(-4)),
            loginMethod: 'facebook',
            joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdAt: new Date().toLocaleString('en-IN'),
            orders: [],
          };
          return createCustomerDoc(uid, customer);
        }
        return data;
      });
    })
    .then(function (customer) {
      if (welcomeAuthTimer) {
        clearTimeout(welcomeAuthTimer);
        welcomeAuthTimer = null;
      }
      currentUser = customer;
      if (!currentUser.id) currentUser.id = firebase.auth().currentUser.uid;
      injectCustomerCoupon(currentUser);
      document.getElementById('auth-overlay').style.display = 'none';
      updateNavUser();
      showToast('Welcome ' + (currentUser.name || '') + '! Facebook se login hua ✅', 'green');
      checkUserDeliveryRadius();
      scheduleOfferPopups();
      if (document.getElementById('fb-name'))
        document.getElementById('fb-name').value = currentUser.name || '';
      if (document.getElementById('ord-name'))
        document.getElementById('ord-name').value = currentUser.name || '';
    })
    .catch(function (e) {
      if (e.code === 'auth/popup-closed-by-user') return;
      if (
        e.code === 'auth/popup-blocked' ||
        e.code === 'auth/popup-cancelled-by-user' ||
        e.code === 'auth/cancelled-popup-request'
      ) {
        showToast('Popup blocked — redirect se try kar raha hoon...', 'orange');
        var provider2 = new firebase.auth.FacebookAuthProvider();
        provider2.addScope('email');
        setTimeout(function () {
          firebase.auth().signInWithRedirect(provider2);
        }, 300);
      } else if (e.code === 'auth/unauthorized-domain') {
        showToast('⚠️ Firebase Console mein atharav321.github.io aur atharav-kitchen.pages.dev dono ko Authorized Domains mein add karo!', 'red');
      } else if (e.code === 'auth/network-request-failed') {
        showToast('Network error. Internet check karo aur retry karo.', 'red');
      } else {
        showToast('Facebook login failed: ' + (e.message || e.code || 'Try again'), 'red');
      }
    });
}

var welcomeAuthTimer = null;

function checkAuthOnLoad() {
  var dobEl = document.getElementById('reg-dob');
  if (dobEl) dobEl.max = new Date().toISOString().split('T')[0];

  if (akFirebaseReady) {
    firebase.auth().onAuthStateChanged(function (user) {
      if (welcomeAuthTimer) {
        clearTimeout(welcomeAuthTimer);
        welcomeAuthTimer = null;
      }
      // FIX: Anonymous sessions (guest checkout auth) must NOT be treated as
      // a real logged-in customer — fall through to the guest/else branch.
      if (user && user.isAnonymous) {
        currentUser = null;
        updateNavUser();
        updateCheckoutLockUI();
        var skippedAnon = lsGet('ak_auth_skipped', false);
        if (!skippedAnon) {
          welcomeAuthTimer = setTimeout(function () {
            updateCouponDisplay();
            showScreen('welcome');
          }, 2200);
        }
        return;
      }
      if (user) {
        loadCustomerProfile(user.uid).then(function (data) {
          if (data) {
            currentUser = data;
            if (!currentUser.id) currentUser.id = user.uid;
            injectCustomerCoupon(currentUser);
            updateNavUser();
            updateCheckoutLockUI();
            scheduleOfferPopups();
            initNewFeatures();
            document.getElementById('auth-overlay').style.display = 'none';
            if (document.getElementById('fb-name'))
              document.getElementById('fb-name').value = currentUser.name || '';
            if (document.getElementById('ord-name'))
              document.getElementById('ord-name').value = currentUser.name || '';
            if (document.getElementById('ord-phone'))
              document.getElementById('ord-phone').value = currentUser.phone || '';
          }
        });
      } else {
        currentUser = null;
        updateNavUser();
        updateCheckoutLockUI();
        var skipped = lsGet('ak_auth_skipped', false);
        if (!skipped) {
          welcomeAuthTimer = setTimeout(function () {
            updateCouponDisplay();
            showScreen('welcome');
          }, 2200);
        }
      }
    });
  } else {
    var saved = lsGet('ak_logged_user', null);
    if (saved && saved.phone) {
      var customers = lsGet('ak_customers', []);
      var found = customers.find(function (c) {
        return c.phone === saved.phone;
      });
      if (found) {
        currentUser = found;
        injectCustomerCoupon(found);
        updateNavUser();
        updateCheckoutLockUI();
        scheduleOfferPopups();
        if (document.getElementById('fb-name'))
          document.getElementById('fb-name').value = found.name || '';
        if (document.getElementById('ord-name'))
          document.getElementById('ord-name').value = found.name || '';
        if (document.getElementById('ord-phone'))
          document.getElementById('ord-phone').value = found.phone || '';
        return;
      }
    }
    currentUser = null;
    updateNavUser();
    updateCheckoutLockUI();
    var skipped = lsGet('ak_auth_skipped', false);
    if (!skipped) {
      welcomeAuthTimer = setTimeout(function () {
        updateCouponDisplay();
        showScreen('welcome');
      }, 2200);
    }
    setTimeout(function () {
      showToast(
        'Local demo mode — same browser mein admin/rider ke saath orders sync honge. Cloud ke liye firebase-config.js bharo.',
        'orange'
      );
    }, 4000);
  }
}

/* ================================================
   ★ MENU SYSTEM — Firestore-backed (live sync from admin)
   ================================================ */
var AK_MENU_LIVE = null; // populated by Firestore onSnapshot; null until first snapshot arrives
var akMenuUnsub = null;
