/* GMAPS_KEY: GPS se address detect karne ke liye (geocoding).
   SECURITY: Google Cloud Console mein HTTP referrer restriction lagao:
   atharav-kitchen.pages.dev/* ONLY allow karo
   Cloudflare: Pages → Settings → Environment Variables → GMAPS_KEY */
var GMAPS_KEY=window.__ENV_GMAPS_KEY || 'AIzaSyD7Vb4zFHfzsI79BbHjZTIi0s8Asxte6rI';
// SECURITY: Set window.__ENV_GMAPS_KEY before loading, or use build tool injection

// ═══════════════════════════════════════════════════════════════
//  CENTRAL CONFIG — Change here, applies everywhere
// ═══════════════════════════════════════════════════════════════
var AK_CONFIG = {
  ZOMATO_LINK: 'https://link.zomato.com/xqzv/rshare?id=8966837430563d60',
  SWIGGY_LINK: 'https://www.swiggy.com/search?query=Atharav+Kitchen+Dhanbad',
  WHATSAPP_NUMBER: '917903567007',
  PHONE_DISPLAY: '+91 79035 67007',
  PHONE_SECONDARY: '+91 98524 66996',
  TIMING: '11:00 AM – 3:00 AM',
  ADDRESS: '1st Floor, Shastri Nagar, Jain Mandir Road, Near Saroj Apartment, Bank More, Dhanbad, JH – 826001',
  FSSAI: '21124172000376',
  DELIVERY_CHARGE: 30,
  FREE_DELIVERY_MIN: 399,
  MAX_DELIVERY_KM: 5,
  KITCHEN_LAT: 23.7957,
  KITCHEN_LNG: 86.4304
};
// ═══════════════════════════════════════════════════════════════

if(GMAPS_KEY==='YOUR_GMAPS_KEY_HERE'){
  console.warn('%c[AK Security] ⚠️ GMAPS_KEY placeholder. Set window.__ENV_GMAPS_KEY.','color:#FF6B00;font-weight:bold;');
}

function startDealTimer(){
  var now=new Date(),midnight=new Date(now);midnight.setHours(23,59,59,0);
  function tick(){var diff=midnight-new Date();if(diff<0)diff=0;var h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000);var p=function(n){return String(n).padStart(2,'0');};var hEl=document.getElementById('dt-h'),mEl=document.getElementById('dt-m'),sEl=document.getElementById('dt-s');if(hEl)hEl.textContent=p(h);if(mEl)mEl.textContent=p(m);if(sEl)sEl.textContent=p(s);}
  tick();setInterval(tick,1000);
}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",startDealTimer);}else{startDealTimer();}


/* ================================================
   ATHARAV KITCHEN — MAIN SITE JS v4.0
   Customer Auth + Full Order System
   ================================================ */

// ---- LOADER ----
window.addEventListener('load',function(){setTimeout(function(){var l=document.getElementById('loader');if(l)l.classList.add('hide');},700);
  // Fallback: agar kuch bhi fail ho, 8 seconds mein loader force-hide
  setTimeout(function(){var l=document.getElementById('loader');if(l)l.classList.add('hide');},8000);
  // Kitchen closed notice for guests
  try{
    var s=JSON.parse(localStorage.getItem('ak_settings'))||{};
    var isOpen=s.orders!==false;
    var notice=document.getElementById('kitchen-closed-notice');
    var badge=document.querySelector('.hero-badge');
    if(notice){notice.style.display=isOpen?'none':'flex';}
    if(badge){badge.style.display=isOpen?'':'none';}
  }catch(e){}
});

// ---- NAV ----
window.addEventListener('scroll',function(){var nb=document.getElementById('navbar');if(nb)nb.classList.toggle('scrolled',window.scrollY>40);});
function goTo(id){var el=document.getElementById(id);if(el)el.scrollIntoView({behavior:'smooth'});}

/* ================================================
   ★ FAQ ACCORDION
   ================================================ */
function toggleFaq(btn){
  var ans=btn.nextElementSibling;
  var isOpen=ans.style.display==='block';
  // Close all
  document.querySelectorAll('.faq-a').forEach(function(a){a.style.display='none';});
  document.querySelectorAll('.faq-q').forEach(function(b){b.classList.remove('open');});
  if(!isOpen){ans.style.display='block';btn.classList.add('open');}
}

function toggleMob(){document.getElementById('mob-menu').classList.toggle('open');}
function closeMob(){document.getElementById('mob-menu').classList.remove('open');}

// ---- HELPERS ----
function lsGet(k,def){try{var v=JSON.parse(localStorage.getItem(k));return v!=null?v:def;}catch{return def;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function showToast(msg,cls){var t=document.getElementById('toast');t.textContent=msg;t.className=cls||'';t.classList.add('show');setTimeout(function(){t.classList.remove('show');},3200);}
// SECURITY FIX: Enhanced HTML escape — quotes bhi escape hoti hain (XSS boundary layer 1)
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;').replace(/\//g,'&#x2F;');}

// SECURITY: Rate limiter — brute force / spam protection (boundary layer 2)
var _akRateLimits={};
function akRateLimit(key,maxCalls,windowMs){
  var now=Date.now();
  if(!_akRateLimits[key])_akRateLimits[key]=[];
  _akRateLimits[key]=_akRateLimits[key].filter(function(t){return now-t<windowMs;});
  if(_akRateLimits[key].length>=maxCalls)return false;
  _akRateLimits[key].push(now);
  return true;
}

// SECURITY: Session token — CSRF-like protection for sensitive actions (boundary layer 3)
var _akSessionToken=(function(){
  var t=sessionStorage.getItem('_ak_st');
  if(!t){t=Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);sessionStorage.setItem('_ak_st',t);}
  return t;
})();
function akVerifySession(token){return token===_akSessionToken;}

// SECURITY: Input sanitizer — phone, name, address strict validation (boundary layer 4)
function akValidatePhone(p){return /^[6-9]\d{9}$/.test(String(p||'').trim());}
function akValidateName(n){var s=String(n||'').trim();return s.length>0&&s.length<100&&/^[a-zA-Z0-9 \u0900-\u097F',.\-]+$/.test(s);}
function akValidateAddress(a){var s=String(a||'').trim();return s.length>5&&s.length<300;}

/* ---- Firebase (keys: firebase-config.js) ---- */
var firebaseConfig=window.FIREBASE_CONFIG||{};
var akFirebaseReady=false;

// FIX: Sync with firebase-config.js akFirebaseReady event
window.addEventListener('akFirebaseReady',function(){
  if(!akFirebaseReady){
    akFirebaseReady=true;
    tryInitFirebase();
    try{checkAuthOnLoad();}catch(e){}
    try{ensureGuestAuthSession();}catch(e){}
    try{startMenuFirebaseSync();}catch(e){}
    try{resyncPendingOrders();}catch(e){}
  }
});

var SHOP_LAT=23.7957,SHOP_LNG=86.4304,MAX_DELIVERY_KM=5;
// withinDeliveryRadius: true = confirmed within 5km, false = CONFIRMED outside 5km
// (real GPS coords measured — hard block), null = unknown/unverified (GPS denied or
// unavailable — do NOT hard block, we simply couldn't verify).
var withinDeliveryRadius=null,deliveryRadiusChecked=false;

function tryInitFirebase(){
  try{
    if(!firebase||!window.isAkFirebaseConfigured||!window.isAkFirebaseConfigured()){return;}
    firebaseConfig=window.FIREBASE_CONFIG;
    if(!firebase.apps.length)firebase.initializeApp(firebaseConfig);
    akFirebaseReady=true;
  }catch(e){console.warn('Firebase init failed',e);}
}
tryInitFirebase();

function customerEmailFromPhone(phone){return String(phone).replace(/\D/g,'')+'@akcustomer.app';}
function customerPasswordFromPhonePin(phone,pin){return 'AK'+String(phone).replace(/\D/g,'')+'_'+String(pin);}

function haversineKm(lat1,lng1,lat2,lng2){
  var R=6371,toRad=function(d){return d*Math.PI/180;};
  var dLat=toRad(lat2-lat1),dLng=toRad(lng2-lng1);
  var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)*Math.sin(dLng/2);
  return R*(2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)));
}

function applyDeliveryDistanceFromCoords(lat,lng){
  var d=haversineKm(lat,lng,SHOP_LAT,SHOP_LNG);
  deliveryRadiusChecked=true;
  if(d>MAX_DELIVERY_KM){
    withinDeliveryRadius=false;
    showToast('Sorry — delivery sirf 5km tak hai (Dhanbad mein). 😔','red');
  }else{
    withinDeliveryRadius=true;
  }
  updateCheckoutLockUI();
}

function checkUserDeliveryRadius(){
  // GPS se 5km radius verify hota hai, lekin GPS na milne/deny hone par order
  // HARD BLOCK nahi hoga — hum bas verify nahi kar paaye, customer address
  // manually daal ke aage badh sakta hai. Sirf CONFIRMED outside-5km (real
  // coords se) hi block hota hai — see applyDeliveryDistanceFromCoords().
  if(!navigator.geolocation){
    deliveryRadiusChecked=true;withinDeliveryRadius=null;
    showToast('Location detect nahi ho paya — address manually daal ke order continue kar sakte ho.','orange');
    updateCheckoutLockUI();
    return;
  }
  navigator.geolocation.getCurrentPosition(function(pos){
    applyDeliveryDistanceFromCoords(pos.coords.latitude,pos.coords.longitude);
  },function(){
    // User ne GPS deny kiya — verify nahi kar sakte, isliye BLOCK nahi karenge.
    // Address manually daal ke order place kar sakta hai; hum 5km ke bahar
    // waale orders ko genuine GPS/coords se hi confirm-block karte hain.
    deliveryRadiusChecked=true;withinDeliveryRadius=null;
    showToast('Location access allow nahi kiya — koi baat nahi, apna address manually daal do.','orange');
    updateCheckoutLockUI();
  },{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
}

// FIX: Anonymous auth session (used only so guest Firestore writes/reads pass
// security rules) should NEVER count as a "real" logged-in user. Always check
// !isAnonymous wherever we mean "customer is registered/logged in".
function realFirebaseUser(){
  var u=akFirebaseReady&&firebase&&firebase.auth&&firebase.auth().currentUser;
  return (u&&!u.isAnonymous)?u:null;
}
function firebaseUser(){return realFirebaseUser();}
function customerLoggedIn(){
  // Registered user — Firebase auth (excludes anonymous guest sessions)
  if(realFirebaseUser())return true;
  // Registered user — localStorage (Firebase offline)
  if(!akFirebaseReady&&currentUser&&currentUser.phone)return true;
  // Guest — allow if they have filled name+phone in checkout form
  var gName=(document.getElementById('ord-name')&&document.getElementById('ord-name').value||'').trim();
  var gPhone=(document.getElementById('ord-phone')&&document.getElementById('ord-phone').value||'').trim();
  if(gName&&gPhone&&gPhone.replace(/\D/g,'').length===10)return true;
  return false;
}
// Guest helper — returns true if user is ordering as guest (not registered)
function isGuestOrder(){
  if(realFirebaseUser())return false;
  if(currentUser&&currentUser.phone)return false;
  return true;
}

// FIX: Ensure an anonymous Firebase Auth session exists so guest checkout
// (Firestore order create + live tracking read) passes security rules, which
// require request.auth != null. This does NOT make the guest "registered" —
// see realFirebaseUser() above. Requires Anonymous sign-in to be enabled in
// Firebase Console → Authentication → Sign-in method.
function ensureGuestAuthSession(){
  if(!akFirebaseReady||!firebase||!firebase.auth)return;
  if(firebase.auth().currentUser)return; // already signed in (real or anon)
  firebase.auth().signInAnonymously().catch(function(e){
    console.warn('[Atharav Kitchen] Anonymous auth failed — guest orders may not sync live. Enable Anonymous sign-in in Firebase Console.',e);
  });
}

// Waits (with timeout) for a real Firebase Auth session — real login OR anonymous —
// so Firestore writes that require request.auth != null don't get silently rejected.
// Returns a Promise<boolean> (true = have a session, false = gave up after timeout).
function waitForAuthSession(timeoutMs){
  timeoutMs=timeoutMs||4000;
  return new Promise(function(resolve){
    if(!akFirebaseReady||!firebase||!firebase.auth){resolve(false);return;}
    if(firebase.auth().currentUser){resolve(true);return;}
    var settled=false;
    var timer=setTimeout(function(){
      if(settled)return;settled=true;resolve(false);
    },timeoutMs);
    firebase.auth().signInAnonymously().then(function(){
      if(settled)return;settled=true;clearTimeout(timer);resolve(true);
    }).catch(function(e){
      console.warn('[Atharav Kitchen] Anonymous auth failed:',e);
      if(settled)return;settled=true;clearTimeout(timer);resolve(false);
    });
  });
}

// Retries a Firestore order-save up to 3 times (short backoff). If it still fails
// (e.g. Anonymous sign-in disabled in Firebase Console), the order is queued in
// localStorage and auto-retried next time the site loads — so it's never silently lost.
function saveOrderWithRetry(orderId,orderObj,attempt){
  attempt=attempt||1;
  return firebase.firestore().collection('orders').doc(orderId).set(orderObj).catch(function(e){
    console.warn('[Atharav Kitchen] Order save attempt '+attempt+' failed:',e.code||e.message);
    if(attempt<3){
      return new Promise(function(res){setTimeout(res,800*attempt);}).then(function(){
        return saveOrderWithRetry(orderId,orderObj,attempt+1);
      });
    }
    // Give up for now — queue for retry on next page load, don't lose the order.
    var pending=lsGet('ak_unsynced_orders',[]);
    pending.push(orderObj);
    lsSet('ak_unsynced_orders',pending);
    throw e;
  });
}

// Called on page load — tries to push any orders that failed to sync earlier.
function resyncPendingOrders(){
  if(!akFirebaseReady)return;
  var pending=lsGet('ak_unsynced_orders',[]);
  if(!pending.length)return;
  waitForAuthSession(4000).then(function(ok){
    if(!ok)return;
    var stillPending=[];
    var remaining=pending.length;
    pending.forEach(function(o){
      firebase.firestore().collection('orders').doc(o.id).set(o).catch(function(){
        stillPending.push(o);
      }).finally(function(){
        remaining--;
        if(remaining===0)lsSet('ak_unsynced_orders',stillPending);
      });
    });
  });
}

function updateCheckoutLockUI(){
  var loggedIn=realFirebaseUser()||(currentUser&&currentUser.phone);
  var guestMsg=document.getElementById('cart-guest-msg');
  var cartBtn=document.getElementById('cartbar-order-btn');
  var placeBtn=document.getElementById('place-order-btn');
  var banner=document.getElementById('order-lock-banner');
  // Guest message — show as tip (not blocker) when not registered
  if(guestMsg){
    guestMsg.style.display=loggedIn?'none':'flex';
  }
  // Cart button — always show (guest can open cart)
  if(cartBtn){
    cartBtn.style.display='inline-block';
    cartBtn.disabled=false;
    cartBtn.classList.remove('disabled');
  }
  // Place order button — sirf CONFIRMED outside-5km (false) pe hard block.
  // null (GPS deny/unavailable) = unverified, order allowed hone dete hain.
  if(!deliveryRadiusChecked){
    if(placeBtn){placeBtn.disabled=true;placeBtn.style.opacity='0.6';placeBtn.style.cursor='wait';}
    if(banner){banner.textContent='Checking delivery range...';banner.classList.add('show');}
    return;
  }
  if(withinDeliveryRadius===false){
    if(placeBtn){placeBtn.disabled=true;placeBtn.style.opacity='0.45';placeBtn.style.cursor='not-allowed';}
    if(banner){banner.textContent='Sorry — we only deliver within 5km of our kitchen. Ordering is disabled.';banner.classList.add('show');}
    return;
  }
  if(withinDeliveryRadius===null){
    // Unverified — allow ordering, just a soft heads-up (not a blocker)
    if(placeBtn){placeBtn.disabled=false;placeBtn.style.opacity='1';placeBtn.style.cursor='pointer';}
    if(banner){banner.textContent='📍 Location verify nahi ho paayi — sirf Dhanbad ke 5km radius mein hi deliver karte hain.';banner.classList.add('show');}
    return;
  }
  if(placeBtn){placeBtn.disabled=false;placeBtn.style.opacity='1';placeBtn.style.cursor='pointer';}
  if(banner){banner.classList.remove('show');}
}

var currentUser=null;

// Welcome coupon amount — admin can change via ak_settings
function getWelcomeCouponAmt(){return lsGet('ak_settings',{}).welcomeCouponAmt||100;}
function getWelcomeCouponMin(){return lsGet('ak_settings',{}).welcomeCouponMin||200;}

// Generate unique coupon code per customer
function genWelcomeCode(phone){
  var amt=getWelcomeCouponAmt();
  return 'WELCOME'+amt+'_'+phone.slice(-4);
}
// Generate unique referral code per customer (stored in their Firestore profile
// so it works across devices — not just localStorage on their own phone)
function genReferralCode(seed){
  var s=String(seed||Date.now());
  return 'AK'+s.slice(-4).toUpperCase()+(Math.random().toString(36).slice(2,5)).toUpperCase();
}

// Update coupon amount display in modal
function updateCouponDisplay(){
  var amt=getWelcomeCouponAmt();
  var el1=document.getElementById('wm-coupon-preview-amt');
  var el2=document.getElementById('wcp-amount-display');
  var el3=document.getElementById('reg-coupon-display');
  if(el1)el1.textContent='₹'+amt;
  if(el2)el2.textContent='₹'+amt+' OFF';
  if(el3)el3.textContent='₹'+amt+' OFF';
}

// Show auth screen
function showScreen(name){
  ['welcome','register','login'].forEach(function(s){
    var el=document.getElementById('screen-'+s);
    if(el)el.style.display='none';
  });
  var target=document.getElementById('screen-'+name);
  if(target){target.style.display='block';}
  document.getElementById('auth-overlay').style.display='flex';
  updateCouponDisplay();
}

function skipAuth(){
  document.getElementById('auth-overlay').style.display='none';
  lsSet('ak_auth_skipped',true);
}

function loadCustomerProfile(uid){
  if(!akFirebaseReady)return Promise.resolve(null);
  return firebase.firestore().collection('customers').doc(uid).get().then(function(snap){
    return snap.exists?snap.data():null;
  }).catch(function(){return null;});
}

// ════════════════════════════════════════════════
//  PHONE OTP AUTH SYSTEM
// ════════════════════════════════════════════════

var _regConfirmation=null;
var _loginConfirmation=null;
var _regRecaptcha=null;
var _loginRecaptcha=null;
var _otpTimerReg=null;
var _otpTimerLogin=null;

// ---- OTP Countdown Timer ----
function startOTPCountdown(timerElId,resendFn){
  var el=document.getElementById(timerElId);
  var secs=60;
  var t=setInterval(function(){
    secs--;
    if(el)el.textContent='OTP valid for '+secs+' seconds';
    if(secs<=0){
      clearInterval(t);
      if(el)el.textContent='OTP expired. Tap Resend.';
    }
  },1000);
  return t;
}

// ---- REGISTER: Step 1 — Collect Info & Send OTP ----
function sendRegisterOTP(){
  // SECURITY: Rate limit OTP requests — max 3 per 5 min (boundary layer 7)
  if(!akRateLimit('sendOTP',3,300000)){showToast('OTP limit reached! 5 minutes baad try karo.','red');return;}
  var name=document.getElementById('reg-name').value.trim();
  var phone=document.getElementById('reg-phone').value.replace(/\D/g,'').trim();
  var dob=document.getElementById('reg-dob').value;

  ['reg-name','reg-phone','reg-dob'].forEach(function(id){
    var inp=document.getElementById(id);var err=document.getElementById('err-'+id);
    if(inp)inp.classList.remove('err');if(err)err.classList.remove('show');
  });

  var ok=true;
  if(!name){document.getElementById('reg-name').classList.add('err');document.getElementById('err-reg-name').classList.add('show');ok=false;}
  if(!phone||phone.length!==10){document.getElementById('reg-phone').classList.add('err');document.getElementById('err-reg-phone').classList.add('show');ok=false;}
  if(!dob){document.getElementById('reg-dob').classList.add('err');document.getElementById('err-reg-dob').classList.add('show');ok=false;}
  if(!ok)return;

  // Offline fallback
  if(!akFirebaseReady){
    _offlineRegister(name,phone,dob,document.getElementById('reg-email').value.trim());
    return;
  }

  var btn=document.getElementById('reg-send-otp-btn');
  btn.disabled=true;btn.textContent='⏳ Sending OTP...';

  try{
    // FIX: Clear old recaptcha completely before creating new one
    if(_regRecaptcha){
      try{_regRecaptcha.clear();}catch(e){}
      _regRecaptcha=null;
    }
    // FIX: Remove old recaptcha DOM nodes to avoid duplicate widget error
    var rcEl=document.getElementById('recaptcha-reg');
    if(rcEl)rcEl.innerHTML='';
    _regRecaptcha=new firebase.auth.RecaptchaVerifier('recaptcha-reg',{
      'size':'invisible',
      'callback':function(){},
      'expired-callback':function(){
        if(_regRecaptcha){try{_regRecaptcha.clear();}catch(e){}_regRecaptcha=null;}
      }
    });
    // FIX: render() first so it's ready on mobile browsers
    _regRecaptcha.render().then(function(){
      return firebase.auth().signInWithPhoneNumber('+91'+phone,_regRecaptcha);
    })
      .then(function(confirmation){
        _regConfirmation=confirmation;
        document.getElementById('reg-step-1').style.display='none';
        document.getElementById('reg-step-2').style.display='block';
        document.getElementById('reg-otp-sent-to').textContent='OTP sent to +91 '+phone;
        _otpTimerReg=startOTPCountdown('reg-otp-timer');
        showToast('OTP sent to +91'+phone+'! 📱','green');
        btn.disabled=false;btn.textContent='📱 Send OTP to My Number';
      })
      .catch(function(e){
        btn.disabled=false;btn.textContent='📱 Send OTP to My Number';
        if(_regRecaptcha){try{_regRecaptcha.clear();}catch(ex){}_regRecaptcha=null;}
        var rcEl2=document.getElementById('recaptcha-reg');if(rcEl2)rcEl2.innerHTML='';
        var msg='OTP bhejne mein error. ';
        if(e.code==='auth/invalid-phone-number')msg='Phone number galat hai. 10 digit number daalo.';
        else if(e.code==='auth/too-many-requests')msg='Bahut zyada attempts. 10 minute baad try karo.';
        else if(e.code==='auth/quota-exceeded')msg='SMS limit khatam. WhatsApp se order karo: wa.me/917903567007';
        else if(e.code==='auth/app-not-authorized')msg='Firebase Phone Auth enable nahi hai. Firebase Console → Auth → Sign-in methods → Phone enable karo.';
        else if(e.code==='auth/network-request-failed')msg='Network error. Internet connection check karo.';
        else msg='OTP error: '+(e.message||e.code||'Try again');
        showToast(msg,'red');
      });
  }catch(e){
    btn.disabled=false;btn.textContent='📱 Send OTP to My Number';
    var rcEl3=document.getElementById('recaptcha-reg');if(rcEl3)rcEl3.innerHTML='';
    showToast('OTP start nahi hua: '+(e.message||'Internet check karo'),'red');
  }
}

// ---- REGISTER: Step 2 — Verify OTP & Save Profile ----
function verifyRegisterOTP(){
  var otp=document.getElementById('reg-otp').value.trim();
  var name=document.getElementById('reg-name').value.trim();
  var phone=document.getElementById('reg-phone').value.replace(/\D/g,'').trim();
  var dob=document.getElementById('reg-dob').value;
  var email=document.getElementById('reg-email').value.trim();

  document.getElementById('reg-otp').classList.remove('err');
  document.getElementById('err-reg-otp').classList.remove('show');

  if(!otp||otp.length!==6){
    document.getElementById('reg-otp').classList.add('err');
    document.getElementById('err-reg-otp').classList.add('show');
    return;
  }
  if(!_regConfirmation){showToast('Pehle OTP send karo.','red');return;}

  var btn=document.getElementById('reg-verify-btn');
  btn.disabled=true;btn.textContent='⏳ Verifying...';

  _regConfirmation.confirm(otp)
    .then(function(cred){
      if(_otpTimerReg)clearInterval(_otpTimerReg);
      var uid=cred.user.uid;
      var code=genWelcomeCode(phone);
      var customer={
        id:uid,firebaseUid:uid,
        name:name,phone:phone,dob:dob,email:email||'',
        welcomeCode:code,welcomeCodeUsed:false,
        referralCode:genReferralCode(phone),
        joinedAt:firebase.firestore.FieldValue.serverTimestamp(),
        createdAt:new Date().toLocaleString('en-IN'),
        orders:[]
      };
      return firebase.firestore().collection('customers').doc(uid).set(customer)
        .then(function(){return customer;});
    })
    .then(function(customer){
      if(welcomeAuthTimer){clearTimeout(welcomeAuthTimer);welcomeAuthTimer=null;}
      currentUser=customer;
      var refInput=document.getElementById('reg-referral');
      if(refInput&&refInput.value.trim())applyReferralBonus(refInput.value,customer);
      injectCustomerCoupon(customer);
      document.getElementById('auth-overlay').style.display='none';
      showCouponSuccess(customer);
      updateNavUser();
      checkUserDeliveryRadius();
    })
    .catch(function(e){
      btn.disabled=false;btn.textContent='✅ Verify & Create Account';
      document.getElementById('reg-otp').classList.add('err');
      document.getElementById('err-reg-otp').classList.add('show');
      if(e.code==='auth/code-expired'){
        document.getElementById('err-reg-otp').textContent='OTP expire ho gaya. Resend karo.';
      }else if(e.code==='auth/invalid-verification-code'){
        document.getElementById('err-reg-otp').textContent='Galat OTP. Dobara check karo.';
      }else{
        document.getElementById('err-reg-otp').textContent='OTP verify nahi hua. Try again.';
      }
    });
}

// ---- REGISTER: Resend OTP ----
function resetRegisterOTP(){
  if(_otpTimerReg)clearInterval(_otpTimerReg);
  _regConfirmation=null;
  document.getElementById('reg-step-2').style.display='none';
  document.getElementById('reg-step-1').style.display='block';
  document.getElementById('reg-otp').value='';
  document.getElementById('reg-otp').classList.remove('err');
  document.getElementById('err-reg-otp').classList.remove('show');
  document.getElementById('err-reg-otp').textContent='Wrong OTP. Please try again.';
}

// ---- LOGIN: Step 1 — Send OTP ----
function sendLoginOTP(){
  // SECURITY: Rate limit
  if(!akRateLimit('sendOTP',3,300000)){showToast('OTP limit reached! 5 minutes baad try karo.','red');return;}
  var phone=document.getElementById('login-phone').value.replace(/\D/g,'').trim();
  document.getElementById('login-phone').classList.remove('err');
  document.getElementById('err-login-phone').classList.remove('show');

  if(!phone||phone.length!==10){
    document.getElementById('login-phone').classList.add('err');
    document.getElementById('err-login-phone').classList.add('show');
    return;
  }

  // Try to init Firebase once more before giving up
  if(!akFirebaseReady){tryInitFirebase();}
  if(!akFirebaseReady){showToast('Internet ya Firebase connected nahi. Check karo aur retry karo.','red');return;}

  var btn=document.getElementById('login-send-otp-btn');
  btn.disabled=true;btn.textContent='⏳ Sending OTP...';

  // Cleanup any previous reCAPTCHA instance completely
  if(_loginRecaptcha){
    try{_loginRecaptcha.clear();}catch(e){}
    _loginRecaptcha=null;
  }
  var rcEl=document.getElementById('recaptcha-login');
  if(rcEl)rcEl.innerHTML='';

  try{
    _loginRecaptcha=new firebase.auth.RecaptchaVerifier('recaptcha-login',{
      'size':'invisible',
      'callback':function(){},
      'expired-callback':function(){
        if(_loginRecaptcha){try{_loginRecaptcha.clear();}catch(e){}_loginRecaptcha=null;}
        var rcE=document.getElementById('recaptcha-login');if(rcE)rcE.innerHTML='';
      }
    });
    _loginRecaptcha.render()
      .then(function(){
        return firebase.auth().signInWithPhoneNumber('+91'+phone,_loginRecaptcha);
      })
      .then(function(confirmation){
        _loginConfirmation=confirmation;
        document.getElementById('login-step-1').style.display='none';
        document.getElementById('login-step-2').style.display='block';
        document.getElementById('login-otp-sent-to').textContent='OTP sent to +91 '+phone;
        _otpTimerLogin=startOTPCountdown('login-otp-timer');
        showToast('OTP +91'+phone+' pe bheja! 📱','green');
        btn.disabled=false;btn.textContent='📱 Send OTP';
      })
      .catch(function(e){
        btn.disabled=false;btn.textContent='📱 Send OTP';
        if(_loginRecaptcha){try{_loginRecaptcha.clear();}catch(ex){}_loginRecaptcha=null;}
        var rcE2=document.getElementById('recaptcha-login');if(rcE2)rcE2.innerHTML='';
        var msg='OTP nahi bheja.';
        if(e.code==='auth/invalid-phone-number')msg='Phone number galat hai — 10 digit Indian number daalo.';
        else if(e.code==='auth/too-many-requests')msg='Bahut zyada attempts! 10 minute baad try karo.';
        else if(e.code==='auth/app-not-authorized')msg='Phone Auth enable nahi hai. Firebase Console → Auth → Phone enable karo.';
        else if(e.code==='auth/network-request-failed')msg='Network error. Internet check karo.';
        else if(e.code==='auth/quota-exceeded')msg='OTP quota exceed. Kal try karo.';
        else if(e.code==='auth/captcha-check-failed')msg='reCAPTCHA fail hua. Page refresh karo.';
        else msg='OTP error: '+(e.message||e.code||'Try again');
        showToast(msg,'red');
      });
  }catch(e){
    btn.disabled=false;btn.textContent='📱 Send OTP';
    if(_loginRecaptcha){try{_loginRecaptcha.clear();}catch(ex){}_loginRecaptcha=null;}
    var rcE3=document.getElementById('recaptcha-login');if(rcE3)rcE3.innerHTML='';
    showToast('OTP start nahi hua: '+(e.message||'Page refresh karo'),'red');
  }
}


// ---- LOGIN: Step 2 — Verify OTP ----
function verifyLoginOTP(){
  var otp=document.getElementById('login-otp').value.trim();
  var phone=document.getElementById('login-phone').value.replace(/\D/g,'').trim();

  document.getElementById('login-otp').classList.remove('err');
  document.getElementById('err-login-otp').classList.remove('show');

  if(!otp||otp.length!==6){
    document.getElementById('login-otp').classList.add('err');
    document.getElementById('err-login-otp').classList.add('show');
    return;
  }
  if(!_loginConfirmation){showToast('Pehle OTP send karo.','red');return;}

  var btn=document.getElementById('login-verify-btn');
  btn.disabled=true;btn.textContent='⏳ Verifying...';

  _loginConfirmation.confirm(otp)
    .then(function(cred){
      if(_otpTimerLogin)clearInterval(_otpTimerLogin);
      var uid=cred.user.uid;
      return loadCustomerProfile(uid).then(function(data){
        if(!data){
          // Pehli baar phone se login — profile create karo
          var customer={
            id:uid,firebaseUid:uid,
            name:'Customer',phone:phone,
            welcomeCode:genWelcomeCode(phone),welcomeCodeUsed:false,
            referralCode:genReferralCode(phone),
            joinedAt:firebase.firestore.FieldValue.serverTimestamp(),
            createdAt:new Date().toLocaleString('en-IN'),orders:[]
          };
          return firebase.firestore().collection('customers').doc(uid).set(customer)
            .then(function(){return customer;});
        }
        return data;
      });
    })
    .then(function(customer){
      if(welcomeAuthTimer){clearTimeout(welcomeAuthTimer);welcomeAuthTimer=null;}
      currentUser=customer;
      if(!currentUser.id)currentUser.id=firebase.auth().currentUser.uid;
      injectCustomerCoupon(currentUser);
      document.getElementById('auth-overlay').style.display='none';
      updateNavUser();
      showToast('Welcome back '+(currentUser.name||'')+'! 🎉','green');
      checkUserDeliveryRadius();
      scheduleOfferPopups();
      if(document.getElementById('fb-name'))document.getElementById('fb-name').value=currentUser.name||'';
      if(document.getElementById('ord-name'))document.getElementById('ord-name').value=currentUser.name||'';
      if(document.getElementById('ord-phone'))document.getElementById('ord-phone').value=currentUser.phone||'';
    })
    .catch(function(e){
      btn.disabled=false;btn.textContent='🔑 Verify & Sign In';
      document.getElementById('login-otp').classList.add('err');
      document.getElementById('err-login-otp').classList.add('show');
      if(e.code==='auth/code-expired'){
        document.getElementById('err-login-otp').textContent='OTP expire ho gaya. Resend karo.';
      }else{
        document.getElementById('err-login-otp').textContent='Galat OTP. Dobara check karo.';
      }
    });
}

// ---- LOGIN: Resend OTP ----
function resetLoginOTP(){
  if(_otpTimerLogin)clearInterval(_otpTimerLogin);
  _loginConfirmation=null;
  document.getElementById('login-step-2').style.display='none';
  document.getElementById('login-step-1').style.display='block';
  document.getElementById('login-otp').value='';
  document.getElementById('login-otp').classList.remove('err');
  document.getElementById('err-login-otp').classList.remove('show');
  document.getElementById('err-login-otp').textContent='Wrong OTP. Please try again.';
}

// ---- Offline Register Fallback ----
function _offlineRegister(name,phone,dob,email){
  var customers=lsGet('ak_customers',[]);
  if(customers.find(function(c){return c.phone===phone;})){
    document.getElementById('reg-phone').classList.add('err');
    document.getElementById('err-reg-phone').textContent='Yeh number already registered hai! Sign in karo.';
    document.getElementById('err-reg-phone').classList.add('show');
    return;
  }
  var code=genWelcomeCode(phone);
  var customer={
    id:'CUST'+Date.now(),name:name,phone:phone,
    dob:dob,email:email,welcomeCode:code,welcomeCodeUsed:false,
    joinedAt:new Date().toISOString(),orders:[]
  };
  customers.push(customer);
  lsSet('ak_customers',customers);
  if(welcomeAuthTimer){clearTimeout(welcomeAuthTimer);welcomeAuthTimer=null;}
  currentUser=customer;
  lsSet('ak_logged_user',customer);
  injectCustomerCoupon(customer);
  document.getElementById('auth-overlay').style.display='none';
  showCouponSuccess(customer);
  updateNavUser();
  checkUserDeliveryRadius();
}

// Inject personal welcome coupon into active coupons
function injectCustomerCoupon(customer){
  if(!customer||!customer.welcomeCode)return;
  var amt=getWelcomeCouponAmt();
  var min=getWelcomeCouponMin();
  COUPONS[customer.welcomeCode]={
    type:'flat',value:amt,min:min,maxDisc:amt,
    label:'₹'+amt+' OFF — Welcome Gift for '+customer.name+'!'
  };
}

// ---- LOGOUT ----
function doLogout(){
  if(akFirebaseReady){
    firebase.auth().signOut().catch(function(){});
  }else{
    lsSet('ak_logged_user',null);
  }
  currentUser=null;
  updateNavUser();
  updateCheckoutLockUI();
  showToast('Logged out. Come back soon! 👋','');
}

// ---- UPDATE NAV ----
function updateNavUser(){
  var btn=document.getElementById('nav-user-btn');
  var lbl=document.getElementById('nav-user-lbl');
  var avatar=document.getElementById('nav-user-avatar');
  if(!currentUser){
    if(btn)btn.classList.remove('logged-in');
    if(lbl)lbl.textContent='Login / Register';
    if(avatar)avatar.textContent='👤';
    document.getElementById('user-dropdown').style.display='none';
    document.getElementById('ud-coupon-row').style.display='none';
    return;
  }
  if(btn)btn.classList.add('logged-in');
  if(lbl)lbl.textContent=(currentUser.name||'You').split(' ')[0];
  if(avatar)avatar.textContent=(currentUser.name||'U')[0].toUpperCase();
  document.getElementById('ud-name').textContent=currentUser.name||'';
  document.getElementById('ud-phone').textContent='+91 '+(currentUser.phone||'');
  if(!currentUser.welcomeCodeUsed&&currentUser.welcomeCode){
    document.getElementById('ud-coupon-row').style.display='flex';
    document.getElementById('ud-coupon-code').textContent=currentUser.welcomeCode;
  }else{
    document.getElementById('ud-coupon-row').style.display='none';
  }
}

function toggleUserDropdown(){
  if(!currentUser){showScreen('welcome');return;}
  var dd=document.getElementById('user-dropdown');
  dd.style.display=dd.style.display==='none'?'block':'none';
}
// Close dropdown on outside click
document.addEventListener('click',function(e){
  var wrap=document.getElementById('user-btn-wrap');
  if(wrap&&!wrap.contains(e.target)){
    var dd=document.getElementById('user-dropdown');
    if(dd)dd.style.display='none';
  }
});

function openAuthOrProfile(){
  if(!currentUser)showScreen('welcome');
  else toggleUserDropdown();
}

// ---- COUPON SUCCESS ----
function showCouponSuccess(customer){
  var amt=getWelcomeCouponAmt();
  document.getElementById('csb-name').textContent='Hi '+(customer.name||'friend').split(' ')[0]+'! 🎉';
  document.getElementById('csb-code').textContent=customer.welcomeCode;
  document.getElementById('csb-val').textContent='₹'+amt+' OFF on your first order!';
  document.getElementById('coupon-success').style.display='flex';
}

function closeCouponSuccess(){
  document.getElementById('coupon-success').style.display='none';
  updateNavUser();
  scheduleOfferPopups();
  showToast('Welcome to Atharav Kitchen! 🍽️ Happy ordering!','green');
}

function copyCsbCode(){
  var code=document.getElementById('csb-code').textContent;
  if(navigator.clipboard)navigator.clipboard.writeText(code).catch(function(){});
  showToast('Code '+code+' copied! 📋','green');
}

/* ================================================
   ★ OFFER POPUPS (timed, for logged-in users)
   ================================================ */
var OFFER_POPUPS=[
  {emoji:'🔥',title:'Weekend Special!',sub:'Today only — Buy 2 get 1 free!',code:'WEEKEND',desc:'Order via WhatsApp. Buy 2 mains, get 1 drink free! Valid Sat-Sun.',bg:'linear-gradient(135deg,#E23744,#a0222e)',cta:'https://wa.me/917903567007'},
  {emoji:'💬',title:'WhatsApp Exclusive!',sub:'₹50 OFF on orders above ₹300',code:'WA50',desc:'Order directly on WhatsApp and save ₹50! Minimum order ₹300.',bg:'linear-gradient(135deg,#25D366,#0e8f47)',cta:'https://wa.me/917903567007'},
  {emoji:'🎉',title:'Free Delivery Day!',sub:'Free delivery on orders above ₹399',code:'FREEDEL',desc:'Today is your lucky day! Get free delivery on orders above ₹399.',bg:'linear-gradient(135deg,#1B4332,#2D6A4F)',cta:'https://link.zomato.com/xqzv/rshare?id=8966837430563d60'},
];
var popupTimers=[];
var currentPopupCTA='';

function scheduleOfferPopups(){
  popupTimers.forEach(function(t){clearTimeout(t);});
  popupTimers=[];
  // Show admin-set offers or defaults
  var adminOffers=lsGet('ak_offers',[]);
  var activeOffers=adminOffers.filter(function(o){return o.active;});
  // Show 1st popup after 90 seconds, then every 4 minutes
  [90000,330000,570000].forEach(function(delay,i){
    var t=setTimeout(function(){
      if(!currentUser)return;
      var offer=activeOffers.length>i?null:OFFER_POPUPS[i%OFFER_POPUPS.length];
      if(activeOffers.length>0){
        var ao=activeOffers[i%activeOffers.length];
        offer={emoji:'🎁',title:ao.title,sub:ao.disc,code:ao.code,desc:ao.desc,bg:'linear-gradient(135deg,#FF6B00,#FF8C00)',cta:'https://wa.me/917903567007'};
      }
      if(offer)showOfferPopup(offer);
    },delay);
    popupTimers.push(t);
  });
}

function showOfferPopup(offer){
  document.getElementById('opb-top').style.background=offer.bg||'linear-gradient(135deg,#FF6B00,#FF8C00)';
  document.getElementById('opb-emoji').textContent=offer.emoji;
  document.getElementById('opb-title').textContent=offer.title;
  document.getElementById('opb-sub').textContent=offer.sub;
  document.getElementById('opb-code-txt').textContent=offer.code;
  document.getElementById('opb-desc').textContent=offer.desc;
  currentPopupCTA=offer.cta||'https://wa.me/917903567007';
  document.getElementById('offer-popup').style.display='flex';
}
function closeOfferPopup(){document.getElementById('offer-popup').style.display='none';}
function copyPopupCode(){
  var code=document.getElementById('opb-code-txt').textContent;
  if(navigator.clipboard)navigator.clipboard.writeText(code).catch(function(){});
  showToast('Code '+code+' copied! 📋','green');
}
function popupCTA(){
  closeOfferPopup();
  window.open(currentPopupCTA,'_blank');
}

/* ================================================
   ★ SOCIAL LOGIN (Google + Facebook)
   ================================================ */
function handleGoogleResult(user){
  var uid=user.uid;
  return loadCustomerProfile(uid).then(function(data){
    if(!data){
      var customer={
        id:uid,firebaseUid:uid,
        name:user.displayName||'Customer',
        phone:user.phoneNumber||'',
        email:user.email||'',
        photoURL:user.photoURL||'',
        welcomeCode:genWelcomeCode(uid.slice(-4)),
        welcomeCodeUsed:false,
        referralCode:genReferralCode(uid.slice(-4)),
        loginMethod:'google',
        joinedAt:firebase.firestore.FieldValue.serverTimestamp(),
        createdAt:new Date().toLocaleString('en-IN'),
        orders:[]
      };
      return firebase.firestore().collection('customers').doc(uid).set(customer)
        .then(function(){return customer;});
    }
    return data;
  }).then(function(customer){
    if(welcomeAuthTimer){clearTimeout(welcomeAuthTimer);welcomeAuthTimer=null;}
    currentUser=customer;
    if(!currentUser.id)currentUser.id=firebase.auth().currentUser.uid;
    injectCustomerCoupon(currentUser);
    document.getElementById('auth-overlay').style.display='none';
    updateNavUser();
    showToast('Welcome '+(currentUser.name||'')+'! Google se login hua ✅','green');
    checkUserDeliveryRadius();
    scheduleOfferPopups();
    initNewFeatures();
    if(document.getElementById('fb-name'))document.getElementById('fb-name').value=currentUser.name||'';
    if(document.getElementById('ord-name'))document.getElementById('ord-name').value=currentUser.name||'';
  }).catch(function(e){
    showToast('Google login failed: '+(e.message||'Try again'),'red');
  });
}

function loginWithGoogle(){
  if(!akFirebaseReady){showToast('Firebase connected nahi hai.','red');return;}
  var provider=new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({'prompt':'select_account'});
  // FIX: signInWithPopup use karo — works on both desktop & mobile
  // Popup fail hone par redirect fallback use karo
  firebase.auth().signInWithPopup(provider)
    .then(function(result){
      if(result&&result.user){
        handleGoogleResult(result.user);
      }
    })
    .catch(function(e){
      if(e.code==='auth/popup-blocked'||e.code==='auth/popup-cancelled-by-user'||e.code==='auth/cancelled-popup-request'){
        showToast('Popup blocked — redirect se try kar raha hoon...','orange');
        setTimeout(function(){firebase.auth().signInWithRedirect(provider);},300);
      } else if(e.code==='auth/popup-closed-by-user'){
        return; // User ne khud band kiya — silent
      } else if(e.code==='auth/unauthorized-domain'){
        showToast('⚠️ Firebase Console mein atharav-kitchen.pages.dev ko Authorized Domains mein add karo! Auth → Settings → Authorized Domains','red');
      } else if(e.code==='auth/network-request-failed'){
        showToast('Network error. Internet check karo aur retry karo.','red');
      } else {
        showToast('Google login failed: '+(e.message||e.code||'Try again'),'red');
      }
    });
}

// Page load pe redirect result check karo (popup-blocked fallback ke liye)
// FIX: Race condition — check immediately if akFirebaseReady already true, AND listen for event
function checkGoogleRedirectResult(){
  if(!akFirebaseReady||!firebase||!firebase.auth)return;
  firebase.auth().getRedirectResult().then(function(result){
    if(result&&result.user){
      handleGoogleResult(result.user);
    }
  }).catch(function(e){
    if(e.code&&e.code!=='auth/no-current-user'&&e.code!=='auth/null-user'){
      showToast('Google login error: '+e.message,'red');
    }
  });
}
window.addEventListener('akFirebaseReady',checkGoogleRedirectResult);
// Also try immediately in case Firebase already loaded before this line ran
if(akFirebaseReady)setTimeout(checkGoogleRedirectResult,500);
if(akFirebaseReady)setTimeout(function(){try{startMenuFirebaseSync();}catch(e){}},500);

function loginWithFacebook(){
  if(!akFirebaseReady){showToast('Firebase connected nahi hai.','red');return;}
  var provider=new firebase.auth.FacebookAuthProvider();
  provider.addScope('email');
  firebase.auth().signInWithPopup(provider)
    .then(function(result){
      var user=result.user;
      var uid=user.uid;
      return loadCustomerProfile(uid).then(function(data){
        if(!data){
          var customer={
            id:uid,firebaseUid:uid,
            name:user.displayName||'Customer',
            phone:user.phoneNumber||'',
            email:user.email||'',
            photoURL:user.photoURL||'',
            welcomeCode:genWelcomeCode(uid.slice(-4)),
            welcomeCodeUsed:false,
            referralCode:genReferralCode(uid.slice(-4)),
            loginMethod:'facebook',
            joinedAt:firebase.firestore.FieldValue.serverTimestamp(),
            createdAt:new Date().toLocaleString('en-IN'),
            orders:[]
          };
          return firebase.firestore().collection('customers').doc(uid).set(customer)
            .then(function(){return customer;});
        }
        return data;
      });
    })
    .then(function(customer){
      if(welcomeAuthTimer){clearTimeout(welcomeAuthTimer);welcomeAuthTimer=null;}
      currentUser=customer;
      if(!currentUser.id)currentUser.id=firebase.auth().currentUser.uid;
      injectCustomerCoupon(currentUser);
      document.getElementById('auth-overlay').style.display='none';
      updateNavUser();
      showToast('Welcome '+(currentUser.name||'')+'! Facebook se login hua ✅','green');
      checkUserDeliveryRadius();
      scheduleOfferPopups();
      if(document.getElementById('fb-name'))document.getElementById('fb-name').value=currentUser.name||'';
      if(document.getElementById('ord-name'))document.getElementById('ord-name').value=currentUser.name||'';
    })
    .catch(function(e){
      if(e.code==='auth/popup-closed-by-user')return;
      showToast('Facebook login failed: '+(e.message||'Try again'),'red');
    });
}


var welcomeAuthTimer=null;

function checkAuthOnLoad(){
  var dobEl=document.getElementById('reg-dob');
  if(dobEl)dobEl.max=new Date().toISOString().split('T')[0];

  if(akFirebaseReady){
    firebase.auth().onAuthStateChanged(function(user){
      if(welcomeAuthTimer){clearTimeout(welcomeAuthTimer);welcomeAuthTimer=null;}
      // FIX: Anonymous sessions (guest checkout auth) must NOT be treated as
      // a real logged-in customer — fall through to the guest/else branch.
      if(user&&user.isAnonymous){
        currentUser=null;
        updateNavUser();
        updateCheckoutLockUI();
        var skippedAnon=lsGet('ak_auth_skipped',false);
        if(!skippedAnon){
          welcomeAuthTimer=setTimeout(function(){
            updateCouponDisplay();
            showScreen('welcome');
          },2200);
        }
        return;
      }
      if(user){
        loadCustomerProfile(user.uid).then(function(data){
          if(data){
            currentUser=data;
            if(!currentUser.id)currentUser.id=user.uid;
            injectCustomerCoupon(currentUser);
            updateNavUser();
            updateCheckoutLockUI();
            scheduleOfferPopups();
            initNewFeatures();
            document.getElementById('auth-overlay').style.display='none';
            if(document.getElementById('fb-name'))document.getElementById('fb-name').value=currentUser.name||'';
            if(document.getElementById('ord-name'))document.getElementById('ord-name').value=currentUser.name||'';
            if(document.getElementById('ord-phone'))document.getElementById('ord-phone').value=currentUser.phone||'';
          }
        });
      }else{
        currentUser=null;
        updateNavUser();
        updateCheckoutLockUI();
        var skipped=lsGet('ak_auth_skipped',false);
        if(!skipped){
          welcomeAuthTimer=setTimeout(function(){
            updateCouponDisplay();
            showScreen('welcome');
          },2200);
        }
      }
    });
  }else{
    var saved=lsGet('ak_logged_user',null);
    if(saved&&saved.phone){
      var customers=lsGet('ak_customers',[]);
      var found=customers.find(function(c){return c.phone===saved.phone;});
      if(found){
        currentUser=found;
        injectCustomerCoupon(found);
        updateNavUser();
        updateCheckoutLockUI();
        scheduleOfferPopups();
        if(document.getElementById('fb-name'))document.getElementById('fb-name').value=found.name||'';
        if(document.getElementById('ord-name'))document.getElementById('ord-name').value=found.name||'';
        if(document.getElementById('ord-phone'))document.getElementById('ord-phone').value=found.phone||'';
        return;
      }
    }
    currentUser=null;
    updateNavUser();
    updateCheckoutLockUI();
    var skipped=lsGet('ak_auth_skipped',false);
    if(!skipped){
      welcomeAuthTimer=setTimeout(function(){
        updateCouponDisplay();
        showScreen('welcome');
      },2200);
    }
    setTimeout(function(){showToast('Local demo mode — same browser mein admin/rider ke saath orders sync honge. Cloud ke liye firebase-config.js bharo.','orange');},4000);
  }
}

/* ================================================
   ★ MENU SYSTEM — Firestore-backed (live sync from admin)
   ================================================ */
var AK_MENU_LIVE=null;      // populated by Firestore onSnapshot; null until first snapshot arrives
var akMenuUnsub=null;
function startMenuFirebaseSync(){
  if(!akFirebaseReady)return;
  if(akMenuUnsub){akMenuUnsub();akMenuUnsub=null;}
  akMenuUnsub=firebase.firestore().collection('menu').onSnapshot(function(snap){
    var items=snap.docs.map(function(d){var x=d.data()||{};if(x.id==null)x.id=d.id;return x;});
    if(items.length){
      AK_MENU_LIVE=items;
      try{localStorage.setItem('ak_menu',JSON.stringify(items));}catch(e){}
      // Re-render menu grid live if page already painted once
      if(typeof renderMenu==='function')renderMenu();
    }
  },function(err){console.warn('Menu Firestore sync error:',err);});
}
function getMenu(){
  if(AK_MENU_LIVE&&AK_MENU_LIVE.length)return AK_MENU_LIVE;
  try{var m=JSON.parse(localStorage.getItem('ak_menu'));if(m&&m.length)return m;}catch{}
  return[
    {id:1,name:'Peri Peri Burger',cat:'Indo-Western',price:120,desc:'Crispy patty with spicy peri-peri sauce, lettuce & tomato',veg:false,emoji:'🍔',imgData:''},
    {id:2,name:'Veg Grilled Sandwich',cat:'Indo-Western',price:80,desc:'Fresh veggies grilled to perfection with mint chutney',veg:true,emoji:'🥪',imgData:''},
    {id:3,name:'Chicken Wrap',cat:'Indo-Western',price:130,desc:'Tender chicken tikka wrapped in soft roti with sauces',veg:false,emoji:'🌯',imgData:''},
    {id:4,name:'Masala Fries',cat:'Indo-Western',price:70,desc:'Crispy golden fries tossed in special masala blend',veg:true,emoji:'🍟',imgData:''},
    {id:5,name:'Veg Hakka Noodles',cat:'Chinese',price:100,desc:'Classic stir-fried noodles with fresh vegetables & soy sauce',veg:true,emoji:'🍜',imgData:''},
    {id:6,name:'Chicken Fried Rice',cat:'Chinese',price:130,desc:'Wok-tossed rice with chicken, eggs & vegetables',veg:false,emoji:'🍛',imgData:''},
    {id:7,name:'Chilli Chicken',cat:'Chinese',price:160,desc:'Crispy chicken tossed in spicy chilli sauce with capsicum',veg:false,emoji:'🌶️',imgData:''},
    {id:8,name:'Veg Momos (8 pcs)',cat:'Chinese',price:80,desc:'Steamed dumplings stuffed with spiced vegetables',veg:true,emoji:'🥟',imgData:''},
    {id:9,name:'Manchow Soup',cat:'Chinese',price:80,desc:'Hot & sour soup with crispy noodles on top',veg:true,emoji:'🍲',imgData:''},
    {id:10,name:'Butter Chicken',cat:'Indian',price:180,desc:'Tender chicken in rich creamy tomato-butter gravy',veg:false,emoji:'🍗',imgData:''},
    {id:11,name:'Dal Makhani',cat:'Indian',price:140,desc:'Slow-cooked black lentils in buttery tomato gravy',veg:true,emoji:'🫘',imgData:''},
    {id:12,name:'Paneer Butter Masala',cat:'Indian',price:160,desc:'Soft paneer in aromatic butter masala sauce',veg:true,emoji:'🧀',imgData:''},
    {id:13,name:'Butter Naan (2 pcs)',cat:'Indian',price:50,desc:'Soft leavened bread baked to golden perfection',veg:true,emoji:'🫓',imgData:''},
    {id:14,name:'Mango Lassi',cat:'Drinks',price:60,desc:'Thick creamy mango yogurt drink',veg:true,emoji:'🥭',imgData:''},
    {id:15,name:'Masala Chai',cat:'Drinks',price:30,desc:'Traditional spiced Indian tea',veg:true,emoji:'☕',imgData:''},
    {id:16,name:'Fresh Lime Soda',cat:'Drinks',price:50,desc:'Chilled lime soda — sweet or salted',veg:true,emoji:'🍋',imgData:''},
  ];
}

var currentCat='All';
var currentVegFilter='all';
var menuSearchQuery='';
var BESTSELLERS=['Peri Peri Burger','Veg Hakka Noodles','Chilli Chicken','Veg Momos (8 pcs)','Butter Chicken','Chicken Fried Rice'];

function showMenuSkeleton(){
  var sk=document.getElementById('menu-skeleton');
  var grid=document.getElementById('menu-grid');
  if(sk){sk.style.display='grid';}
  if(grid){grid.style.display='none';}
}
function hideMenuSkeleton(){
  var sk=document.getElementById('menu-skeleton');
  var grid=document.getElementById('menu-grid');
  if(sk){sk.style.display='none';}
  if(grid){grid.style.display='grid';}
}

function setVegFilter(type){
  currentVegFilter=type;
  ['all','veg','nonveg'].forEach(function(t){
    var btn=document.getElementById('veg-btn-'+t);
    if(btn)btn.classList.toggle('active',t===type);
  });
  renderMenu();
}

function filterMenu(){
  var inp=document.getElementById('menu-search');
  menuSearchQuery=inp?inp.value.trim().toLowerCase():'';
  var clr=document.getElementById('menu-search-clear');
  if(clr)clr.style.display=menuSearchQuery?'block':'none';
  renderMenu();
}
function clearMenuSearch(){
  var inp=document.getElementById('menu-search');
  if(inp){inp.value='';menuSearchQuery='';}
  var clr=document.getElementById('menu-search-clear');
  if(clr)clr.style.display='none';
  renderMenu();
}

function renderMenu(){
  showMenuSkeleton();
  setTimeout(function(){
    _doRenderMenu();
    hideMenuSkeleton();
  }, 300);
}

function _doRenderMenu(){
  renderRecommended();
  var items=getMenu();
  var cats=['All',...new Set(items.map(function(i){return i.cat;}))];
  document.getElementById('menu-pills').innerHTML=cats.map(function(c){
    return '<button class="pill'+(c===currentCat?' active':'')+'" onclick="filterCat(\''+c+'\')">'+c+'</button>';
  }).join('');
  var items2=items.filter(function(i){return i.available!==false;});
  // Category filter
  var filtered=currentCat==='All'?items2:items2.filter(function(i){return i.cat===currentCat;});
  // Veg/NonVeg filter
  if(currentVegFilter==='veg') filtered=filtered.filter(function(i){return i.veg===true;});
  else if(currentVegFilter==='nonveg') filtered=filtered.filter(function(i){return i.veg===false;});
  // Search filter
  if(menuSearchQuery){
    filtered=filtered.filter(function(i){
      return (i.name||'').toLowerCase().includes(menuSearchQuery)||(i.desc||'').toLowerCase().includes(menuSearchQuery)||(i.cat||'').toLowerCase().includes(menuSearchQuery);
    });
  }
  // Bestseller-first sort — admin panel ke "Menu Intelligence Sync" se aaya hua menuRank
  if(filtered.some(function(i){return i.menuRank!==undefined;})){
    filtered=filtered.slice().sort(function(a,b){
      var ra=a.menuRank!==undefined?a.menuRank:9999;
      var rb=b.menuRank!==undefined?b.menuRank:9999;
      return ra-rb;
    });
  }
  var grid=document.getElementById('menu-grid');
  if(!filtered.length){grid.innerHTML='<div class="empty-cat">Koi item nahi mila. Try another search! 🍽️</div>';return;}
  grid.innerHTML=filtered.map(function(item){
    var imgSrc=item.imgUrl||item.imgData||'';
    var imgHtml=imgSrc?'<img src="'+imgSrc+'" alt="'+esc(item.name)+'" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=&quot;mc-noimg&quot;><span class=&quot;mc-noimg-letter&quot;>'+esc((item.name||'?').charAt(0).toUpperCase())+'</span><span class=&quot;mc-noimg-label&quot;>Photo coming soon</span></div>\'">'+'<div class="mc-img-overlay"></div>':'<div class="mc-noimg"><span class="mc-noimg-letter">'+esc((item.name||'?').charAt(0).toUpperCase())+'</span><span class="mc-noimg-label">Photo coming soon</span></div>';
    var inCart=cart[item.name]?cart[item.name].qty:0;
    var btnHtml=inCart>0?
      '<div style="display:flex;align-items:center;gap:6px;background:#FF6B00;border-radius:8px;padding:4px 8px;">'+
      '<button onclick="changeQty(\''+item.name.replace(/'/g,"\\'")+'\',' +item.price+',-1,event)" style="background:transparent;border:none;color:#fff;font-size:1rem;cursor:pointer;font-weight:800;line-height:1;padding:0 2px;">−</button>'+
      '<span style="color:#fff;font-weight:800;font-size:0.9rem;min-width:16px;text-align:center;">'+inCart+'</span>'+
      '<button onclick="changeQty(\''+item.name.replace(/'/g,"\\'")+'\',' +item.price+',1,event)" style="background:transparent;border:none;color:#fff;font-size:1rem;cursor:pointer;font-weight:800;line-height:1;padding:0 2px;">+</button>'+
      '</div>':
      '<button class="mc-add" onclick="addCart(\''+item.name.replace(/'/g,"\\'")+'\',' +item.price+',event)">+ Add</button>';
    var isBestseller=BESTSELLERS.includes(item.name)||(item.bestseller===true);
    var bsTag=isBestseller?'<div class="mc-bestseller-tag">🔥 Bestseller</div>':'';
    var vegIcon='<div class="vi '+(item.veg?'v':'nv')+'"></div>';
    var wl=getWishlist();var isWished=wl.some(function(w){return w.name===item.name;});
    var heartBtn='<button class="wl-heart-btn '+(isWished?'wished':'')+'" onclick="toggleWishlist('+JSON.stringify(JSON.stringify(item))+',event)" title="Favourite mein add karo">'+(isWished?'❤️':'🤍')+'</button>';
    return '<div class="mc"><div class="mc-top" onclick="openItemDetail('+item.id+')" style="cursor:pointer;">'+imgHtml+vegIcon+bsTag+heartBtn+'</div>'+
      '<div class="mc-body"><h3 onclick="openItemDetail('+item.id+')" style="cursor:pointer;">'+esc(item.name)+'</h3><p onclick="openItemDetail('+item.id+')" style="cursor:pointer;">'+esc(item.desc)+'</p>'+
      '<div class="mc-foot"><span class="mc-price">₹'+item.price+'</span>'+btnHtml+'</div></div></div>';
  }).join('');
}

function renderRecommended(){
  var wrap=document.getElementById('menu-reco-wrap');
  var rail=document.getElementById('menu-reco-rail');
  if(!wrap||!rail)return;
  var items=getMenu().filter(function(i){return i.available!==false;});
  var favs=items.filter(function(i){return BESTSELLERS.includes(i.name)||i.bestseller===true;});
  if(!favs.length){wrap.style.display='none';return;}
  wrap.style.display='';
  rail.innerHTML=favs.map(function(item){
    var imgSrc=item.imgUrl||item.imgData||'';
    var imgHtml=imgSrc?'<img src="'+imgSrc+'" alt="'+esc(item.name)+'" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=&quot;mc-noimg&quot; style=&quot;height:100%;&quot;><span class=&quot;mc-noimg-letter&quot; style=&quot;font-size:1.6rem;&quot;>'+esc((item.name||'?').charAt(0).toUpperCase())+'</span></div>\'">':
      '<div class="mc-noimg" style="height:100%;"><span class="mc-noimg-letter" style="font-size:1.6rem;">'+esc((item.name||'?').charAt(0).toUpperCase())+'</span></div>';
    return '<div class="reco-card" onclick="scrollToMenuItem(\''+item.name.replace(/'/g,"\\'")+'\')">'+
      '<div class="reco-img">'+imgHtml+'<span class="reco-badge">🔥 Bestseller</span></div>'+
      '<div class="reco-body"><div class="reco-name">'+esc(item.name)+'</div>'+
      '<div class="reco-foot"><span class="reco-price">₹'+item.price+'</span>'+
      '<button class="reco-add" onclick="event.stopPropagation();addCart(\''+item.name.replace(/'/g,"\\'")+'\','+item.price+',event)">+</button></div></div></div>';
  }).join('');
}
function scrollToMenuItem(name){
  currentCat='All';menuSearchQuery=name.toLowerCase();
  var searchInput=document.getElementById('menu-search');
  if(searchInput)searchInput.value=name;
  renderMenu();
  var grid=document.getElementById('menu-grid');
  if(grid)grid.scrollIntoView({behavior:'smooth',block:'start'});
}
function filterCat(cat){currentCat=cat;renderMenu();}

// ===== ITEM DETAIL POPUP (+ "Customers Also Liked" cross-sell) =====
var _detailItemId=null;
var _detailQty=1;
function openItemDetail(id){
  var item=getMenu().find(function(i){return i.id===id;});
  if(!item)return;
  _detailItemId=id;_detailQty=1;
  var modal=document.getElementById('item-detail-modal');
  if(!modal)return;
  var imgSrc=item.imgUrl||item.imgData||'';
  var imgWrap=document.getElementById('id-img-wrap');
  imgWrap.innerHTML=imgSrc?
    '<img src="'+imgSrc+'" alt="'+esc(item.name)+'" style="width:100%;height:100%;object-fit:cover;">':
    '<div class="mc-noimg" style="height:100%;"><span class="mc-noimg-letter" style="font-size:2.4rem;">'+esc((item.name||'?').charAt(0).toUpperCase())+'</span><span class="mc-noimg-label">Photo coming soon</span></div>';
  document.getElementById('id-veg-icon').className='vi '+(item.veg?'v':'nv');
  document.getElementById('id-name').textContent=item.name;
  document.getElementById('id-desc').textContent=item.desc||'';
  document.getElementById('id-price').textContent='₹'+item.price;
  var isBestseller=BESTSELLERS.includes(item.name)||(item.bestseller===true);
  document.getElementById('id-bestseller-tag').style.display=isBestseller?'':'none';
  document.getElementById('id-qty-display').textContent=_detailQty;
  renderAlsoLiked(item);
  modal.style.display='flex';
}
function closeItemDetail(){
  var modal=document.getElementById('item-detail-modal');
  if(modal)modal.style.display='none';
  _detailItemId=null;
}
function changeDetailQty(delta){
  _detailQty=Math.max(1,_detailQty+delta);
  document.getElementById('id-qty-display').textContent=_detailQty;
}
function addFromItemDetail(){
  var item=getMenu().find(function(i){return i.id===_detailItemId;});
  if(!item)return;
  if(!cart[item.name])cart[item.name]={qty:0,price:item.price};
  cart[item.name].qty+=_detailQty;
  updateCartBar();renderMenu();
  showToast(item.name+' added! 🛒 ('+_detailQty+'x)','orange');
  closeItemDetail();
}
function renderAlsoLiked(currentItem){
  var rail=document.getElementById('id-also-liked-rail');
  var wrap=document.getElementById('id-also-liked-wrap');
  if(!rail||!wrap)return;
  var items=getMenu().filter(function(i){return i.available!==false&&i.id!==currentItem.id;});
  var sameCat=items.filter(function(i){return i.cat===currentItem.cat;});
  var picks=sameCat.length>=3?sameCat:items;
  // Shuffle-ish: prioritize bestsellers first, then rest, cap at 4
  picks=picks.slice().sort(function(a,b){
    var aBest=(BESTSELLERS.includes(a.name)||a.bestseller===true)?1:0;
    var bBest=(BESTSELLERS.includes(b.name)||b.bestseller===true)?1:0;
    return bBest-aBest;
  }).slice(0,4);
  if(!picks.length){wrap.style.display='none';return;}
  wrap.style.display='';
  rail.innerHTML=picks.map(function(item){
    var imgSrc=item.imgUrl||item.imgData||'';
    var imgHtml=imgSrc?'<img src="'+imgSrc+'" alt="'+esc(item.name)+'">':
      '<div class="mc-noimg" style="height:100%;"><span class="mc-noimg-letter" style="font-size:1.4rem;">'+esc((item.name||'?').charAt(0).toUpperCase())+'</span></div>';
    return '<div class="reco-card" style="width:130px;" onclick="openItemDetail('+item.id+')">'+
      '<div class="reco-img" style="height:80px;">'+imgHtml+'</div>'+
      '<div class="reco-body" style="padding:0.5rem 0.6rem 0.6rem;"><div class="reco-name" style="font-size:0.72rem;min-height:1.9em;">'+esc(item.name)+'</div>'+
      '<div class="reco-foot"><span class="reco-price" style="font-size:0.82rem;">₹'+item.price+'</span>'+
      '<button class="reco-add" style="width:24px;height:24px;font-size:0.85rem;" onclick="event.stopPropagation();addCart(\''+item.name.replace(/'/g,"\\'")+'\','+item.price+',event)">+</button></div></div></div>';
  }).join('');
}

/* ================================================
   ★ OFFERS SECTION
   ================================================ */
function renderOffers(){
  var adminOffers=lsGet('ak_offers',[]);
  var colorMap={red:'linear-gradient(135deg,#E23744,#a0222e)',orange:'linear-gradient(135deg,#FF6B00,#FF8C00)',green:'linear-gradient(135deg,#25D366,#0e8f47)',forest:'linear-gradient(135deg,#1B4332,#2D6A4F)'};
  var defaults=[
    {title:'Welcome Offer',code:'WELCOME'+getWelcomeCouponAmt(),disc:'₹'+getWelcomeCouponAmt()+' OFF',min:getWelcomeCouponMin(),color:'orange',desc:'New customer? Register & get ₹'+getWelcomeCouponAmt()+' off first order!',active:true},
    {title:'Free Delivery',code:'FREEDEL',disc:'FREE DELIVERY',min:399,color:'forest',desc:'Order above ₹399 and get free delivery!',active:true},
    {title:'WhatsApp Special',code:'WA50',disc:'₹50 OFF',min:300,color:'green',desc:'Order on WhatsApp & save ₹50!',active:true},
    {title:'Weekend Special',code:'WEEKEND',disc:'BUY 2 GET 1',min:0,color:'red',desc:'Sat-Sun: Buy 2 mains, get 1 drink free!',active:true},
  ];
  var offers=adminOffers.filter(function(o){return o.active;}).length?adminOffers.filter(function(o){return o.active;}):defaults;
  var grid=document.getElementById('offers-grid');
  if(!grid)return;
  grid.innerHTML=offers.map(function(o){
    var bg=colorMap[o.color]||colorMap.orange;
    return '<div class="offer-card"><div class="offer-top" style="background:'+bg+'"><span class="offer-big">'+esc(o.disc)+'</span><span class="offer-sm">Min order: ₹'+o.min+'</span></div>'+
      '<div class="offer-bot"><h3>'+esc(o.title)+'</h3><p>'+esc(o.desc)+'</p>'+
      '<div class="offer-code">'+esc(o.code)+'</div><br>'+
      '<button class="copy-btn" onclick="copyOffer(\''+esc(o.code)+'\',this)">Copy Code</button></div></div>';
  }).join('');
  // Also update coupon chips in cart
  var chips=document.getElementById('coupon-chips');
  if(chips){
    chips.innerHTML=offers.map(function(o){
      return '<button onclick="tapCoupon(\''+esc(o.code)+'\')" style="padding:6px 14px;background:var(--saffron-light);border:1.5px solid var(--saffron);border-radius:50px;font-size:0.72rem;font-weight:800;cursor:pointer;font-family:\'Nunito\',sans-serif;color:var(--deep-brown);">'+esc(o.code)+'</button>';
    }).join('');
  }
}

/* ================================================
   ★ CART SYSTEM
   ================================================ */
var cart={};
var appliedCoupon=null;
var currentStep=1;

var COUPONS={
  'WELCOME20':{type:'percent',value:20,min:200,maxDisc:100,label:'20% OFF (Max ₹100)'},
  'FREEDEL':{type:'delivery',value:0,min:0,maxDisc:999,label:'Free Delivery'},
  'WA50':{type:'flat',value:50,min:300,maxDisc:50,label:'₹50 OFF'},
  'WEEKEND':{type:'flat',value:40,min:200,maxDisc:40,label:'₹40 OFF (Weekend)'},
  'GUEST5':{type:'flat',value:5,min:0,maxDisc:5,label:'₹5 OFF — Guest Discount'},
};
// FIX: Admin settings se jo bhi welcome coupon amount ho (default 100), uska code bhi add karo
(function(){
  var amt=getWelcomeCouponAmt();
  var min=getWelcomeCouponMin();
  var dynamicKey='WELCOME'+amt;
  if(!COUPONS[dynamicKey]){
    COUPONS[dynamicKey]={type:'flat',value:amt,min:min,maxDisc:amt,label:'\u20b9'+amt+' OFF (Welcome Offer)'};
  }
})();

function addCart(name,price,e){
  if(!cart[name])cart[name]={qty:0,price:price};
  cart[name].qty++;
  updateCartBar();renderMenu();
  showToast(name+' added! 🛒','orange');
}
function changeQty(name,price,delta,e){
  if(e)e.stopPropagation();
  if(!cart[name])cart[name]={qty:0,price:price};
  cart[name].qty+=delta;
  if(cart[name].qty<=0)delete cart[name];
  updateCartBar();renderMenu();
  if(document.getElementById('cart-modal').style.display!=='none'){renderCartItems();updateStep1Summary();}
}
function updateCartBar(){
  var count=Object.values(cart).reduce(function(s,i){return s+i.qty;},0);
  var total=Object.values(cart).reduce(function(s,i){return s+i.qty*i.price;},0);
  document.getElementById('c-count').textContent=count;
  document.getElementById('c-total').textContent=total;
  document.getElementById('cartbar').style.display=count>0?'flex':'none';
  updateCheckoutLockUI();
}
var MIN_ORDER=149;

function openCartModal(){
  if(Object.keys(cart).length===0){showToast('Cart is empty! Add items first.','red');return;}
  if(!deliveryRadiusChecked)checkUserDeliveryRadius();
  // Upsell check
  var subtotal=Object.values(cart).reduce(function(s,i){return s+i.qty*i.price;},0);
  checkUpsell(subtotal);
  document.getElementById('cart-modal').style.display='block';
  document.body.classList.add('modal-open');
  document.body.style.top='-'+window.scrollY+'px';
  goStep(1);
}
function closeCartModal(){
  var scrollY=document.body.style.top;
  document.getElementById('cart-modal').style.display='none';
  document.body.classList.remove('modal-open');
  document.body.style.top='';
  window.scrollTo(0,parseInt(scrollY||'0')*-1);
}
function addMoreItems(){closeCartModal();document.getElementById('menu').scrollIntoView({behavior:'smooth'});}

function goStep(n){
  if(n===2||n===3||n===4){
    var subtotal=Object.values(cart).reduce(function(s,i){return s+i.qty*i.price;},0);
    if(subtotal<MIN_ORDER){
      showUpsellBanner(subtotal);
      return;
    }
  }
  if(n===4){
    if(!deliveryRadiusChecked){showToast('Verifying your distance from our kitchen…','orange');checkUserDeliveryRadius();return;}
    if(withinDeliveryRadius===false){showToast('Sorry — sirf 5km delivery range hai Dhanbad mein. 😔','red');return;}
    var name=(document.getElementById('ord-name').value||'').trim();
    var phone=(document.getElementById('ord-phone').value||'').trim();
    var addr=(document.getElementById('ord-address').value||'').trim();
    if(!name||!phone||!addr){showToast('Name, Phone & Address fill karo!','red');return;}
    if(phone.replace(/\D/g,'').length!==10){showToast('Valid 10-digit phone number daalo!','red');return;}
  }
  currentStep=n;
  [1,2,3,4].forEach(function(i){
    var el=document.getElementById('cart-step-'+i);
    if(el)el.style.display=i===n?'block':'none';
    var ind=document.getElementById('step-ind-'+i);
    if(ind){ind.style.color=i<n?'#16A34A':i===n?'#FF6B00':'#CCC';}
  });
  if(n===1){renderCartItems();updateStep1Summary();}
  if(n===2){renderOffers();} // refresh coupon chips
  if(n===3){
    // Show safety note for guest users
    var safeNote=document.getElementById('guest-safety-note');
    if(safeNote)safeNote.style.display=isGuestOrder()?'block':'none';
  }
  if(n===4){renderFinalBill();updateCheckoutLockUI();}
}

function renderCartItems(){
  var list=document.getElementById('cart-items-list');
  var items=Object.entries(cart);
  if(!items.length){list.innerHTML='<div style="text-align:center;padding:2rem;color:#A08060;"><div style="font-size:3rem;">🛒</div><p style="font-weight:600;margin-top:0.5rem;">Cart is empty</p></div>';return;}
  list.innerHTML=items.map(function(e){
    var n=e[0],it=e[1];
    return '<div style="display:flex;align-items:center;padding:0.8rem 0;border-bottom:1px solid #F5EDE5;">'+
      '<div style="flex:1;"><div style="font-size:0.88rem;font-weight:700;color:#2D1A00;">'+esc(n)+'</div>'+
      '<div style="font-size:0.75rem;color:#A08060;margin-top:1px;">₹'+it.price+' each</div></div>'+
      '<div style="display:flex;align-items:center;gap:8px;">'+
      '<button onclick="changeQty(\''+n.replace(/'/g,"\\'")+'\',' +it.price+',-1)" style="width:28px;height:28px;border-radius:50%;background:#FF6B00;color:#fff;border:none;font-size:1.1rem;font-weight:800;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;">−</button>'+
      '<span style="font-weight:800;font-size:0.95rem;color:#2D1A00;min-width:22px;text-align:center;">'+it.qty+'</span>'+
      '<button onclick="changeQty(\''+n.replace(/'/g,"\\'")+'\',' +it.price+',1)" style="width:28px;height:28px;border-radius:50%;background:#FF6B00;color:#fff;border:none;font-size:1.1rem;font-weight:800;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;">+</button>'+
      '<span style="font-weight:800;font-size:0.9rem;color:#FF6B00;min-width:52px;text-align:right;">₹'+(it.qty*it.price)+'</span></div></div>';
  }).join('');
  renderUpsellBox();
}

function renderUpsellBox(){
  var box=document.getElementById('cart-upsell-box');
  if(!box)return;
  var menu=getMenu();
  var inCart=Object.keys(cart);
  if(!inCart.length){box.innerHTML='';return;}
  var suggestions=menu.filter(function(i){
    return i.available!==false && inCart.indexOf(i.name)===-1 && (i.bestseller===true||BESTSELLERS.includes(i.name));
  }).sort(function(a,b){return (b.orderCount||0)-(a.orderCount||0);}).slice(0,2);
  if(!suggestions.length){box.innerHTML='';return;}
  box.innerHTML='<div style="font-size:0.72rem;font-weight:800;color:var(--text-light,#A08060);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">🔥 Log ye bhi order karte hain</div>'+
    suggestions.map(function(i){
      return '<div style="display:flex;align-items:center;justify-content:space-between;background:#FFF7ED;border:1.5px solid #FFE4C4;border-radius:10px;padding:8px 12px;margin-bottom:6px;">'+
        '<span style="font-size:0.82rem;font-weight:700;color:#2D1A00;">'+(i.emoji||'🍽️')+' '+esc(i.name)+' <span style="color:#FF6B00;">₹'+i.price+'</span></span>'+
        '<button onclick="addCart(\''+i.name.replace(/'/g,"\\'")+'\','+i.price+',event)" style="background:#FF6B00;color:#fff;border:none;border-radius:8px;padding:5px 12px;font-size:0.76rem;font-weight:800;cursor:pointer;">+ Add</button>'+
        '</div>';
    }).join('');
}

function updateStep1Summary(){
  var bill=calcBill();
  var s1s=document.getElementById('s1-subtotal');var s1d=document.getElementById('s1-delivery');
  if(s1s)s1s.textContent='₹'+bill.subtotal;
  if(s1d){s1d.textContent=bill.delivery===0?'FREE':'₹'+bill.delivery;s1d.style.color=bill.delivery===0?'#16A34A':'#5C3A1E';}
  var di=document.getElementById('delivery-info-text');
  if(di)di.textContent=bill.subtotal>=399?'✅ You got free delivery!':'Add ₹'+(399-bill.subtotal)+' more for free delivery';
}

function calcBill(){
  var subtotal=Object.values(cart).reduce(function(s,i){return s+i.qty*i.price;},0);
  var delivery=subtotal>=399?0:30;
  var discount=0;
  if(appliedCoupon&&COUPONS[appliedCoupon]){
    var c=COUPONS[appliedCoupon];
    if(c.type==='percent')discount=Math.min(Math.round(subtotal*c.value/100),c.maxDisc);
    else if(c.type==='flat')discount=Math.min(c.value,subtotal);
    else if(c.type==='delivery')delivery=0;
  }
  var gst=Math.round((subtotal-discount)*0.05);
  var total=Math.max(0,subtotal-discount+delivery+gst);
  return{subtotal:subtotal,delivery:delivery,discount:discount,gst:gst,total:total};
}

function applyCoupon(){var code=(document.getElementById('coupon-inp').value||'').trim().toUpperCase();tapCoupon(code);}
function tapCoupon(code){
  document.getElementById('coupon-inp').value=code;
  var res=document.getElementById('coupon-result');
  var c=COUPONS[code];var bill=calcBill();
  if(!c){res.style.display='block';res.style.background='#FEE2E2';res.style.color='#DC2626';res.style.border='1px solid #FECACA';res.textContent='❌ Invalid code. Try: WELCOME'+getWelcomeCouponAmt()+', FREEDEL, WA50, WEEKEND';appliedCoupon=null;}
  else if(bill.subtotal<(c.min||0)){res.style.display='block';res.style.background='#FEF3C7';res.style.color='#D97706';res.style.border='1px solid #FDE68A';res.textContent='⚠️ Min order ₹'+c.min+' needed. Add ₹'+(c.min-bill.subtotal)+' more.';appliedCoupon=null;}
  else{
    appliedCoupon=code;
    // Mark welcome code as used if applicable
    if(currentUser&&code===currentUser.welcomeCode&&!currentUser.welcomeCodeUsed){
      currentUser.welcomeCodeUsed=true;
      if(akFirebaseReady&&firebase.auth().currentUser){
        firebase.firestore().collection('customers').doc(firebase.auth().currentUser.uid).update({welcomeCodeUsed:true}).catch(function(){});
      }else if(currentUser&&currentUser.phone){
        var customers2=lsGet('ak_customers',[]);
        var ix2=customers2.findIndex(function(c){return c.phone===currentUser.phone;});
        if(ix2>-1){customers2[ix2].welcomeCodeUsed=true;lsSet('ak_customers',customers2);}
        lsSet('ak_logged_user',currentUser);
      }
      updateNavUser();
    }
    var newBill=calcBill();
    res.style.display='block';res.style.background='#D1FAE5';res.style.color='#065F46';res.style.border='1px solid #A7F3D0';
    res.textContent='✅ "'+code+'" applied! You save ₹'+newBill.discount+'. '+c.label;
    showToast('Coupon applied! Saving ₹'+newBill.discount+' 🎉','green');
  }
}

function renderFinalBill(){
  var bill=calcBill();
  var summaryHtml='<div style="font-weight:700;color:#2D1A00;margin-bottom:0.5rem;">📦 Order Items:</div>';
  Object.entries(cart).forEach(function(e){summaryHtml+='• '+esc(e[0])+' × '+e[1].qty+' = <b>₹'+(e[1].qty*e[1].price)+'</b><br>';});
  if(appliedCoupon)summaryHtml+='<div style="margin-top:0.5rem;color:#16A34A;font-weight:700;">🏷️ Coupon: '+appliedCoupon+'</div>';
  document.getElementById('final-order-summary').innerHTML=summaryHtml;
  var el=function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
  el('final-subtotal','₹'+bill.subtotal);el('final-gst','₹'+bill.gst);el('final-total','₹'+bill.total);el('pay-btn-total',bill.total);
  var dEl=document.getElementById('final-delivery');if(dEl){dEl.textContent=bill.delivery===0?'FREE':'₹'+bill.delivery;dEl.style.color=bill.delivery===0?'#16A34A':'#5C3A1E';}
  var dr=document.getElementById('final-discount-row');if(dr){dr.style.display=bill.discount>0?'flex':'none';}
  el('final-discount','-₹'+bill.discount);
  var cl=document.getElementById('final-coupon-label');if(cl&&appliedCoupon)cl.textContent='Discount ('+appliedCoupon+')';
}

/* ================================================
   ★ PLACE ORDER — FINAL MERGED (guest + registered)
   ================================================ */
function placeOrder(){
  // SECURITY: Rate limit
  if(!akRateLimit('placeOrder',3,60000)){showToast('Bahut jaldi! Thoda wait karo. ⏳','red');return;}

  var name=(document.getElementById('ord-name').value||'').trim();
  var phone=(document.getElementById('ord-phone').value||'').trim();
  var addr=(document.getElementById('ord-address').value||'').trim();
  var note=(document.getElementById('ord-note').value||'').trim();
  if(!name||!phone||!addr){showToast('Name, Phone & Address fill karo!','red');goStep(3);return;}
  if(!akValidateName(name)){showToast('Invalid name — sirf letters/numbers/spaces allowed!','red');return;}
  var cleanPhone=phone.replace(/\D/g,'');
  if(!akValidatePhone(cleanPhone)){showToast('Valid 10-digit mobile number daalo!','red');return;}
  if(!akValidateAddress(addr)){showToast('Valid delivery address daalo (min 6 chars)!','red');return;}
  if(note.length>200){showToast('Note too long (max 200 chars)','red');return;}
  if(!deliveryRadiusChecked){showToast('Delivery range check pending — thoda wait karo. 📍','red');return;}
  if(withinDeliveryRadius===false){showToast('Sorry — aap 5km delivery range ke bahar hain. 📍','red');return;}

  name=name.replace(/[<>'"&]/g,'');
  addr=addr.replace(/[<>'"&]/g,'');
  note=note.replace(/[<>'"&]/g,'');

  var payMethod=document.querySelector('input[name="pay-method"]:checked');
  var pay=payMethod?payMethod.value:'cod';
  var bill=calcBill();
  var now=new Date().toLocaleString('en-IN');
  var orderId='AK'+Date.now().toString().slice(-6);
  var uid=(akFirebaseReady&&firebase.auth().currentUser)?firebase.auth().currentUser.uid:null;
  var localCustId=currentUser?currentUser.id:null;
  var guestMode=isGuestOrder();

  var orderObj={
    id:orderId,name:name,phone:cleanPhone,address:addr,note:note,
    items:JSON.parse(JSON.stringify(cart)),bill:bill,coupon:appliedCoupon||null,
    payment:pay,status:'New',time:now,platform:'WhatsApp',
    customerId:uid||localCustId||(guestMode?'guest_'+cleanPhone:null),
    isGuest:guestMode,createdAtMs:Date.now()
  };

  // GA4
  ga4Event('purchase',{transaction_id:orderId,value:bill.total,currency:'INR'});
  var walletDisc=bill.walletDiscount||0;

  function afterSaved(){
    // Save to localStorage
    var orders=lsGet('ak_orders',[]);
    orders.push(orderObj);
    lsSet('ak_orders',orders);
    // Save customer order history — registered users only
    if(!guestMode){
      if(currentUser&&uid&&akFirebaseReady){
        var ref=firebase.firestore().collection('customers').doc(uid);
        ref.get().then(function(snap){
          var olist=(snap.exists&&snap.data().orders)?snap.data().orders:[];
          olist.push({id:orderId,total:bill.total,date:now});
          var patch={orders:olist,lastOrder:now};
          if(appliedCoupon&&currentUser.welcomeCode===appliedCoupon)patch.welcomeCodeUsed=true;
          ref.set(patch,{merge:true}).then(function(){if(patch.welcomeCodeUsed)currentUser.welcomeCodeUsed=true;});
        });
      }else if(currentUser&&currentUser.phone&&!akFirebaseReady){
        var customers=lsGet('ak_customers',[]);
        var cidx=customers.findIndex(function(c){return c.phone===currentUser.phone;});
        if(cidx>-1){
          if(!customers[cidx].orders)customers[cidx].orders=[];
          customers[cidx].orders.push({id:orderId,total:bill.total,date:now});
          customers[cidx].lastOrder=now;
          if(appliedCoupon&&currentUser.welcomeCode===appliedCoupon)customers[cidx].welcomeCodeUsed=true;
          lsSet('ak_customers',customers);
          currentUser=customers[cidx];
          lsSet('ak_logged_user',currentUser);
          updateNavUser();
        }
      }
    }
    // Award points (registered only)
    if(!guestMode){awardPoints(orderObj);}
    if(walletDisc>0)deductWalletPoints(walletDisc);

    // Build success summary HTML
    var summaryHtml='<div class="success-row"><span>🆔</span><strong>Order ID: '+orderId+'</strong></div>';
    summaryHtml+='<div class="success-row" style="flex-wrap:wrap;">'+Object.entries(cart).map(function(e){return '<span style="background:#FFF0E0;padding:2px 8px;border-radius:6px;margin:2px;font-size:0.78rem;font-weight:700;">'+esc(e[0])+' ×'+e[1].qty+'</span>';}).join('')+'</div>';
    summaryHtml+='<hr class="success-divider">';
    if(bill.discount>0)summaryHtml+='<div class="success-row" style="color:#16A34A;">🏷️ <span>Coupon Saved: -₹'+bill.discount+'</span></div>';
    if(walletDisc>0)summaryHtml+='<div class="success-row" style="color:#7C3AED;">💰 <span>Wallet Saved: -₹'+walletDisc+'</span></div>';
    summaryHtml+='<div class="success-row">💰 <span>Total: <strong>₹'+bill.total+'</strong></span></div>';
    summaryHtml+='<div class="success-row" style="background:#FEF9C3;border:1.5px solid #FDE68A;border-radius:8px;padding:8px 12px;margin-top:8px;font-size:0.85rem;">⏳ <span><strong>Order Received!</strong> Owner confirm karega jaldi.</span></div>';
    summaryHtml+='<div class="success-row" style="font-size:0.8rem;">📱 <span>Confirm hone par <strong>'+name+'</strong> ko WhatsApp aayega</span></div>';
    if(guestMode)summaryHtml+='<div class="success-row" style="font-size:0.78rem;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px;padding:8px 12px;margin-top:6px;">💡 <span>Register karke loyalty points &amp; offers pao!</span></div>';
    summaryHtml+='<div class="success-row" style="font-size:0.75rem;color:#A08060;border-top:1px dashed #EEE;padding-top:8px;margin-top:4px;">Order ID: <strong>'+orderId+'</strong> — Screenshot karke rakhein</div>';

    document.getElementById('success-summary').innerHTML=summaryHtml;
    var _sTitle=document.querySelector('#order-success .success-title');
    if(_sTitle)_sTitle.textContent='📋 Order Received!';
    var _sSub=document.querySelector('#order-success .success-subtitle');
    if(_sSub)_sSub.textContent='Owner aapka order dekh raha hai — confirmation ka wait karo ⏳';

    // SHOW CONFIRMATION POPUP FIRST (before WhatsApp opens)
    document.getElementById('order-success').style.display='flex';
    showOwnerNotification(orderObj);
    closeCartModal();
    if(typeof showTrackFAB==='function')showTrackFAB(orderId);
    cart={};appliedCoupon=null;walletApplied=false;currentStep=1;
    updateCartBar();renderMenu();updateWalletUI();

    // WA message to owner — opens AFTER confirmation popup shown (100ms delay)
    setTimeout(function(){
      var msg='🍽️ *NEW ORDER — ATHARAV KITCHEN*\n';
      msg+='━━━━━━━━━━━━━━━━━━\n';
      msg+='🆔 Order ID: *'+orderId+'*\n';
      msg+='👤 Name: *'+name+'*\n';
      msg+='📞 Phone: *'+cleanPhone+'*\n';
      msg+='📍 Address: *'+addr+'*\n';
      if(note)msg+='📝 Note: '+note+'\n';
      msg+=guestMode?'👤 Guest Order\n':'⭐ Registered Customer: YES\n';
      if(appliedCoupon)msg+='🏷️ Coupon Used: *'+appliedCoupon+'*\n';
      if(walletDisc>0)msg+='💰 Wallet Used: -₹'+walletDisc+'\n';
      msg+='\n📋 *ORDER ITEMS:*\n';
      Object.entries(orderObj.items).forEach(function(e){msg+='• '+e[0]+' × '+e[1].qty+' = ₹'+(e[1].qty*e[1].price)+'\n';});
      msg+='\n💰 *BILL:*\nSubtotal: ₹'+bill.subtotal+'\n';
      if(bill.discount>0)msg+='Discount ('+appliedCoupon+'): -₹'+bill.discount+'\n';
      if(walletDisc>0)msg+='Wallet: -₹'+walletDisc+'\n';
      msg+='Delivery: '+(bill.delivery===0?'FREE':'₹'+bill.delivery)+'\n';
      msg+='GST (5%): ₹'+bill.gst+'\n';
      msg+='*GRAND TOTAL: ₹'+bill.total+'*\n';
      msg+='Payment: '+(pay==='cod'?'Cash on Delivery':'UPI/Online')+'\n';
      msg+='\n⏰ '+now;
      window.open('https://wa.me/917903567007?text='+encodeURIComponent(msg).replace(/%E2%82%B9/g,'₹'),'_blank');
    },100);
  }

  // Save to Firestore then show confirmation
  if(akFirebaseReady){
    waitForAuthSession(4000).then(function(){
      return saveOrderWithRetry(orderId,orderObj);
    }).then(afterSaved).catch(function(e){
      // Still show confirmation (WhatsApp msg to owner is the safety net),
      // but the order is now queued in localStorage and will auto-retry —
      // it will NOT silently vanish like before.
      console.warn('Firestore save failed after retries, queued for resync:',e);
      afterSaved();
    });
  }else{
    afterSaved();
  }
}

/* ================================================
   ★ RATINGS & FEEDBACK
   ================================================ */
var ratings={food:0,delivery:0,value:0};
function rate(type,val){
  ratings[type]=val;
  document.querySelectorAll('#s-'+type+' .star').forEach(function(s,i){s.classList.toggle('on',i<val);});
}
function submitFb(){
  // FIX 1: Rating validation — teen mein se ek bhi 0 ho toh submit nahi
  if(ratings.food===0||ratings.delivery===0||ratings.value===0){
    showToast('Please rate Food, Delivery and Value before submitting! ⭐','red');
    // Highlight unrated stars
    ['food','delivery','value'].forEach(function(type){
      if(ratings[type]===0){
        var el=document.getElementById('s-'+type);
        if(el){el.style.outline='2px solid #DC2626';el.style.borderRadius='4px';}
        setTimeout(function(){if(el)el.style.outline='';},2500);
      }
    });
    return;
  }
  var name=(document.getElementById('fb-name').value||'').trim();
  if(!name){showToast('Please enter your name!','red');return;}
  var fb={
    id:Date.now(),
    name:name||'Anonymous',
    date:document.getElementById('fb-date').value||new Date().toISOString().split('T')[0],
    food:ratings.food,delivery:ratings.delivery,value:ratings.value,
    rating:Math.round((ratings.food+ratings.delivery+ratings.value)/3),
    comment:(document.getElementById('fb-comment').value||'').trim(),
    platform:(document.getElementById('fb-platform').value||''),
    customerId:currentUser?currentUser.id:null,
    createdAt:new Date().toISOString()
  };
  var all=lsGet('ak_feedback',[]);
  all.push(fb);lsSet('ak_feedback',all);
  // Save to Firebase if available
  if(akFirebaseReady){
    firebase.firestore().collection('feedback').doc(String(fb.id)).set(fb).catch(function(){});
  }
  var ok=document.getElementById('fb-ok');
  ok.style.display='block';
  setTimeout(function(){ok.style.display='none';},5000);
  // Reset form after submit
  ratings={food:0,delivery:0,value:0};
  document.querySelectorAll('.star').forEach(function(s){s.classList.remove('on');});
  document.getElementById('fb-name').value='';
  document.getElementById('fb-comment').value='';
  showToast('Feedback submitted! Thank you 🙏','green');
}

/* ================================================
   ★ CONTACT
   ================================================ */
function submitContact(){
  var name=(document.getElementById('ct-name').value||'').trim();
  var phone=(document.getElementById('ct-phone').value||'').trim();
  var subject=(document.getElementById('ct-subject').value||'General Enquiry');
  var msg=(document.getElementById('ct-msg').value||'').trim();
  // FIX 2: Validation
  if(!name){showToast('Please enter your name!','red');return;}
  if(!msg){showToast('Please write a message!','red');return;}
  var contactEntry={
    id:Date.now(),
    name:name,phone:phone,subject:subject,message:msg,
    createdAt:new Date().toISOString()
  };
  // Save to localStorage
  var contacts=lsGet('ak_contacts',[]);
  contacts.push(contactEntry);
  lsSet('ak_contacts',contacts);
  // Save to Firebase if available
  if(akFirebaseReady){
    firebase.firestore().collection('contacts').doc(String(contactEntry.id)).set(contactEntry).catch(function(){});
  }
  // Clear form
  document.getElementById('ct-name').value='';
  document.getElementById('ct-phone').value='';
  document.getElementById('ct-msg').value='';
  var ok=document.getElementById('ct-ok');ok.style.display='block';
  setTimeout(function(){ok.style.display='none';},5000);
  showToast('Message sent! ✅','green');
}

/* ================================================
   ★ OFFERS COPY
   ================================================ */
function copyOffer(code,btn){
  if(navigator.clipboard)navigator.clipboard.writeText(code).catch(function(){});
  btn.textContent='✅ Copied!';
  setTimeout(function(){btn.textContent='Copy Code';},2000);
  showToast('"'+code+'" copied! 🎉','green');
}

/* ================================================
   ★ GPS LOCATION
   ================================================ */
function detectGPSLocation(){
  var btn=document.getElementById('gps-btn');var btnText=document.getElementById('gps-btn-text');var status=document.getElementById('gps-status');var addrEl=document.getElementById('ord-address');
  if(!navigator.geolocation){showToast('GPS not supported.','red');return;}
  btnText.textContent='🔍 Detecting...';btn.style.opacity='0.7';btn.disabled=true;status.style.display='block';status.textContent='📡 Getting GPS...';
  navigator.geolocation.getCurrentPosition(function(pos){
    var lat=pos.coords.latitude,lng=pos.coords.longitude;
    applyDeliveryDistanceFromCoords(lat,lng);
    status.textContent='🗺️ Converting...';
    // FIX 5: Try Google Geocoding first, fallback to OpenStreetMap Nominatim (free, no key)
    function applyAddress(addr){
      addrEl.value=addr;addrEl.style.borderColor='#22C55E';
      status.textContent='✅ Location detect ho gaya! Flat/house number add karo.';status.style.color='#16A34A';
      btnText.textContent='✅ Location Detected';btn.style.background='linear-gradient(135deg,#16A34A,#22C55E)';
      showToast('📍 Address auto-fill ho gaya!','green');
      btn.disabled=false;btn.style.opacity='1';
    }
    function fallbackNominatim(){
      // OpenStreetMap free geocoding — no API key needed
      fetch('https://nominatim.openstreetmap.org/reverse?lat='+lat+'&lon='+lng+'&format=json&accept-language=en',{
        headers:{'User-Agent':'AtharavKitchenApp/1.0'}
      }).then(function(r){return r.json();}).then(function(d){
        if(d&&d.display_name){
          applyAddress(d.display_name);
        }else{
          // Last resort: coordinates + city
          addrEl.value='Near '+lat.toFixed(4)+'°N '+lng.toFixed(4)+'°E, Dhanbad, Jharkhand';
          btn.disabled=false;btn.style.opacity='1';
          status.textContent='⚠️ Address detect nahi hua — manually type karo.';status.style.color='#D97706';
        }
      }).catch(function(){
        addrEl.value='Lat:'+lat.toFixed(5)+', Lng:'+lng.toFixed(5)+', Dhanbad, JH';
        btn.disabled=false;btn.style.opacity='1';
        status.textContent='⚠️ Address auto-fill nahi hua — manually type karo.';status.style.color='#D97706';
      });
    }
    if(GMAPS_KEY&&GMAPS_KEY.length>10){
      fetch('https://maps.googleapis.com/maps/api/geocode/json?latlng='+lat+','+lng+'&key='+GMAPS_KEY+'&language=en')
        .then(function(r){return r.json();}).then(function(data){
          if(data.status==='OK'&&data.results&&data.results.length){
            applyAddress(data.results[0].formatted_address);
          }else{
            // Google failed (quota/billing), try Nominatim
            fallbackNominatim();
          }
        }).catch(function(){fallbackNominatim();});
    }else{
      fallbackNominatim();
    }
  },function(err){btn.disabled=false;btn.style.opacity='1';status.textContent='❌ Enable location access.';status.style.color='#DC2626';status.style.display='block';btnText.textContent='📍 Try Again';showToast('Enable location permission!','red');},{enableHighAccuracy:true,timeout:10000,maximumAge:0});
}

/* ================================================
   ★ ORDER SUCCESS & OWNER NOTIFICATION
   ================================================ */
function dismissOrderSuccess(){document.getElementById('order-success').style.display='none';}

var _lastOrder=null;
function showOwnerNotification(order){
  _lastOrder=order;
  document.getElementById('oa-order-id').textContent='📦 Order #'+order.id;
  document.getElementById('oa-customer').textContent='👤 '+order.name+' | 📞 '+order.phone+'\n📍 '+(order.address||'').substring(0,50);
  document.getElementById('oa-total').textContent='₹'+order.bill.total;
  var alertEl=document.getElementById('owner-alert');alertEl.style.display='block';
  playOwnerAlarm();
  setTimeout(function(){alertEl.style.display='none';},15000);
  if('Notification' in window&&Notification.permission==='granted'){new Notification('🔔 NEW ORDER!',{body:'Order #'+order.id+' | ₹'+order.bill.total,icon:'logo_png.png'});}
}
function ownerAccept(){document.getElementById('owner-alert').style.display='none';showToast('✅ Order accepted!','green');if(_lastOrder)ownerWhatsApp();}
function ownerWhatsApp(){if(!_lastOrder)return;var o=_lastOrder;var msg='✅ *ORDER CONFIRMED — ATHARAV KITCHEN*\n\nHi '+o.name+'! 🎉\n\nYour order *#'+o.id+'* is confirmed!\n\n💰 *Total: ₹'+o.bill.total+'*\n🛵 ETA: 30-45 mins\n\n🍽️ Atharav Kitchen — Taste That Travels Fast!';window.open('https://wa.me/'+o.phone.replace(/[^0-9]/g,'')+'?text='+encodeURIComponent(msg),'_blank');}
function playOwnerAlarm(){try{var ctx=new(window.AudioContext||window.webkitAudioContext)();[0,0.4,0.8].forEach(function(t){var osc=ctx.createOscillator(),gain=ctx.createGain();osc.connect(gain);gain.connect(ctx.destination);osc.frequency.value=880;osc.type='sine';gain.gain.setValueAtTime(0.6,ctx.currentTime+t);gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+t+0.3);osc.start(ctx.currentTime+t);osc.stop(ctx.currentTime+t+0.35);});}catch(e){}}

/* ================================================
   ★ PWA
   ================================================ */
var deferredPrompt;
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferredPrompt=e;setTimeout(function(){var b=document.getElementById('install-banner');if(b)b.classList.add('show');},3000);});
var ibInstall=document.getElementById('ib-install');var ibClose=document.getElementById('ib-close');
if(ibInstall){ibInstall.addEventListener('click',function(){var b=document.getElementById('install-banner');if(b)b.classList.remove('show');if(deferredPrompt){deferredPrompt.prompt();deferredPrompt.userChoice.then(function(r){if(r.outcome==='accepted')showToast('App installed! 🎉','green');deferredPrompt=null;});}});}
if(ibClose){ibClose.addEventListener('click',function(){var b=document.getElementById('install-banner');if(b)b.classList.remove('show');});}
var isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent),isStandalone=('standalone' in window.navigator)&&window.navigator.standalone;
if(isIOS&&!isStandalone){setTimeout(function(){showToast('iPhone: Tap Share → "Add to Home Screen" 📱','orange');},4000);}
if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').then(function(){}).catch(function(){});});}

/* ================================================
   ★ REWARDS & WALLET SYSTEM
   ================================================ */
var POINTS_PER_ORDER=100;         // ₹350+ order pe 100 points
var POINTS_ORDER_MIN=350;         // minimum order for points
var POINTS_STREAK_BONUS=50;       // 3 orders streak bonus
var POINTS_BIRTHDAY_MULT=2;       // birthday double points
var POINTS_VALUE=0.5;             // 1 point = ₹0.5

function getWallet(){
  var ru=realFirebaseUser();
  if(ru){
    // Firebase se milega — async load hoga
    return lsGet('ak_wallet_'+ru.uid,{points:0,history:[]});
  }
  if(currentUser&&currentUser.phone)return lsGet('ak_wallet_'+currentUser.phone,{points:0,history:[]});
  return {points:0,history:[]};
}
function saveWallet(w){
  var ru=realFirebaseUser();
  if(ru){
    lsSet('ak_wallet_'+ru.uid,w);
    // Firebase mein bhi save — wallet sirf server write, lekin localStorage se bhi cache
    firebase.firestore().collection('wallets').doc(ru.uid).set(w,{merge:true}).catch(function(){});
    return;
  }
  if(currentUser&&currentUser.phone)lsSet('ak_wallet_'+currentUser.phone,w);
}
function loadWalletFromFirebase(){
  var ru=realFirebaseUser();
  if(!ru)return;
  var uid=ru.uid;
  firebase.firestore().collection('wallets').doc(uid).get().then(function(snap){
    if(snap.exists){
      lsSet('ak_wallet_'+uid,snap.data());
      updateWalletUI();
    }
  }).catch(function(){});
}
function updateWalletUI(){
  var w=getWallet();
  var pts=w.points||0;
  var rupees=Math.floor(pts*POINTS_VALUE);
  var els=['wallet-points-display','wallet-pts-nav'];
  els.forEach(function(id){var el=document.getElementById(id);if(el)el.textContent=pts+' pts (₹'+rupees+')';});
  var useBtn=document.getElementById('wallet-use-btn');
  if(useBtn)useBtn.disabled=pts<20; // min 20 points to use
  var walletRow=document.getElementById('wallet-row');
  if(walletRow)walletRow.style.display=currentUser?'block':'none';
}

var walletApplied=false;
function toggleWallet(){
  if(!currentUser){showToast('Login karo pehle!','red');return;}
  var w=getWallet();
  if(w.points<20){showToast('Minimum 20 points chahiye wallet use karne ke liye.','red');return;}
  if(appliedCoupon&&!walletApplied){showToast('Coupon remove karo pehle — ek hi discount ek baar!','red');return;}
  walletApplied=!walletApplied;
  var btn=document.getElementById('wallet-use-btn');
  if(btn)btn.textContent=walletApplied?'❌ Remove Wallet':'💰 Use Wallet';
  if(walletApplied)showToast('Wallet applied! Points se discount milega ✅','green');
  else showToast('Wallet removed.','orange');
  renderFinalBill();updateCheckoutLockUI();
}

function getWalletDiscount(subtotal){
  if(!walletApplied||!currentUser)return 0;
  var w=getWallet();
  var maxRupees=Math.floor((w.points||0)*POINTS_VALUE);
  return Math.min(maxRupees,Math.floor(subtotal*0.5)); // max 50% off from wallet
}

function awardPoints(order){
  if(!currentUser)return;
  var subtotal=order.bill?order.bill.subtotal:0;
  if(subtotal<POINTS_ORDER_MIN)return;
  var w=getWallet();
  var pts=POINTS_PER_ORDER;
  // Birthday double points
  if(isBirthday())pts=pts*POINTS_BIRTHDAY_MULT;
  // Streak bonus
  var orders=getMyOrderHistory();
  if(orders.length>0&&(orders.length)%3===0)pts+=POINTS_STREAK_BONUS;
  w.points=(w.points||0)+pts;
  w.history=w.history||[];
  w.history.push({type:'earn',pts:pts,orderId:order.id,date:new Date().toLocaleString('en-IN'),reason:'Order '+order.id});
  saveWallet(w);
  updateWalletUI();
  if(pts>POINTS_PER_ORDER){
    var reason=isBirthday()?'🎂 Birthday Double Points!':'🔥 3-Order Streak Bonus!';
    showToast('+'+pts+' points earned! '+reason,'green');
  }else{
    showToast('+'+pts+' Reward Points earned! 🌟','green');
  }
}

function deductWalletPoints(discountAmount){
  if(!walletApplied||!currentUser)return;
  var pointsUsed=Math.ceil(discountAmount/POINTS_VALUE);
  var w=getWallet();
  w.points=Math.max(0,(w.points||0)-pointsUsed);
  w.history=w.history||[];
  w.history.push({type:'use',pts:-pointsUsed,date:new Date().toLocaleString('en-IN'),reason:'Redeemed at checkout'});
  saveWallet(w);
  walletApplied=false;
  updateWalletUI();
}

function isBirthday(){
  if(!currentUser||!currentUser.dob)return false;
  var dobStr=String(currentUser.dob).trim();
  var parts=dobStr.split('-');
  var dobMonth,dobDay;
  if(parts.length===3){
    dobMonth=parseInt(parts[1],10)-1; // month is 0-indexed
    dobDay=parseInt(parts[2],10);
  }else{
    var dob=new Date(dobStr);
    if(isNaN(dob.getTime()))return false;
    dobMonth=dob.getMonth();
    dobDay=dob.getDate();
  }
  var now=new Date();
  return dobDay===now.getDate()&&dobMonth===now.getMonth();
}

function getMyOrderHistory(){
  if(currentUser&&currentUser.orders)return currentUser.orders;
  return lsGet('ak_orders',[]).filter(function(o){
    return currentUser&&(o.customerId===currentUser.id||o.phone===currentUser.phone);
  });
}

function renderOrderHistory(){
  var el=document.getElementById('order-history-list');
  if(!el)return;
  var orders=getMyOrderHistory();
  if(!orders||!orders.length){el.innerHTML='<div style="text-align:center;padding:1.5rem;color:#A08060;font-size:0.85rem;">No orders yet. Place your first order! 🍽️</div>';return;}
  var sorted=orders.slice().reverse().slice(0,10);
  el.innerHTML=sorted.map(function(o){
    var itemsObj=o.items||{};
    var itemsArr=Array.isArray(itemsObj)?itemsObj:Object.entries(itemsObj).map(function(e){return{name:e[0],qty:e[1].qty,price:e[1].price};});
    var itemsSummary=itemsArr.slice(0,2).map(function(i){return i.name;}).join(', ')+(itemsArr.length>2?' +more':'');
    return '<div style="padding:12px 0;border-bottom:1.5px solid #F5EDE5;">'
      +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
      +'<div><div style="font-weight:800;color:#2D1A00;font-size:0.85rem;">📦 #'+(o.id||o.orderId)+'</div>'
      +'<div style="color:#A08060;font-size:0.72rem;margin-top:2px;">'+(o.date||o.time||'')+'</div></div>'
      +'<div style="font-weight:900;color:#FF6B00;font-size:0.9rem;">₹'+(o.total||(o.bill&&o.bill.total)||'—')+'</div></div>'
      +(itemsSummary?'<div style="font-size:0.75rem;color:#5C3A1E;margin-bottom:8px;background:#FFF8F0;padding:4px 8px;border-radius:6px;">'+esc(itemsSummary)+'</div>':'')
      +'<button onclick="repeatOrder('+JSON.stringify(JSON.stringify(o))+')" style="padding:7px 14px;background:linear-gradient(135deg,#FF6B00,#FF8C00);color:#fff;border:none;border-radius:8px;font-family:Nunito,sans-serif;font-weight:800;font-size:0.75rem;cursor:pointer;">🔄 Repeat Order</button>'
      +'</div>';
  }).join('');
}

function repeatOrder(orderJson){
  var order=JSON.parse(orderJson);
  var items=order.items||{};
  var itemsArr=Array.isArray(items)?items:Object.entries(items).map(function(e){return{name:e[0],qty:e[1].qty,price:e[1].price};});
  if(!itemsArr.length){showToast('Order items nahi mile!','red');return;}
  itemsArr.forEach(function(it){
    cart[it.name]={qty:it.qty,price:it.price};
  });
  updateCartBar();renderMenu();
  closeOrderHistory();
  goTo('menu');
  showToast('🔄 Pichla order cart mein add ho gaya!','green');
}

/* ================================================
   ★ WHATSAPP DETAILED BILL
   ================================================ */
function sendWhatsAppBill(order){
  var bill=order.bill||{};
  var msg='🧾 *BILL — ATHARAV KITCHEN*\n';
  msg+='━━━━━━━━━━━━━━━━━━\n';
  msg+='🆔 Order: *'+order.id+'*\n';
  msg+='👤 '+order.name+'\n';
  msg+='📍 '+order.address+'\n\n';
  msg+='📋 *ITEMS:*\n';
  var items=order.items||{};
  if(Array.isArray(items)){
    items.forEach(function(it){msg+='• '+it.name+' × '+it.qty+' = ₹'+(it.qty*it.price)+'\n';});
  }else{
    Object.entries(items).forEach(function(e){msg+='• '+e[0]+' × '+e[1].qty+' = ₹'+(e[1].qty*e[1].price)+'\n';});
  }
  msg+='\n💰 *BILL DETAILS:*\n';
  msg+='Subtotal: ₹'+(bill.subtotal||0)+'\n';
  if(bill.discount>0)msg+='Coupon ('+order.coupon+'): -₹'+bill.discount+'\n';
  if(bill.walletDiscount>0)msg+='Wallet: -₹'+bill.walletDiscount+'\n';
  msg+='Delivery: '+(bill.delivery===0?'FREE':'₹'+(bill.delivery||30))+'\n';
  msg+='GST (5%): ₹'+(bill.gst||0)+'\n';
  msg+='━━━━━━━━━━━━━━━━━━\n';
  msg+='*TOTAL: ₹'+bill.total+'*\n';
  msg+='Payment: '+(order.payment==='cod'?'Cash on Delivery':'UPI/Online')+'\n\n';
  msg+='Thank you for ordering from Atharav Kitchen! 🍽️\n';
  msg+='⭐ Rate us: g.page/AtharavKitchen\n';
  msg+='📞 Support: wa.me/917903567007';
  window.open('https://wa.me/'+String(order.phone||'').replace(/[^0-9]/g,'')+'?text='+encodeURIComponent(msg),'_blank');
}

/* ================================================
   ★ FEEDBACK POPUP (har website open pe)
   ================================================ */
function checkFeedbackPopup(){
  var lastShown=lsGet('ak_fb_popup_last',0);
  var now=Date.now();
  // Show on every page load (cross se band kar sakta hai)
  if(currentUser){
    setTimeout(function(){
      var pop=document.getElementById('feedback-popup');
      if(pop)pop.style.display='flex';
    },8000);
  }
}
function closeFeedbackPopup(){
  var pop=document.getElementById('feedback-popup');
  if(pop)pop.style.display='none';
  lsSet('ak_fb_popup_last',Date.now());
}
// Google Business Profile review link — apna actual GBP review link yahan daalo
var AK_GBP_REVIEW_URL='YOUR_GOOGLE_REVIEW_LINK';

function quickFeedback(val){
  // Guest bhi feedback de sakta hai
  var fb={id:Date.now(),customerId:(currentUser&&(currentUser.id||currentUser.phone))||'guest',quick:val,date:new Date().toISOString()};
  if(akFirebaseReady){firebase.firestore().collection('feedback').doc(String(fb.id)).set(fb).catch(function(){});}
  closeFeedbackPopup();
  if(val>=4){
    showToast('Thanks for the love! ❤️ Google pe bhi rate karo!','green');
    if(AK_GBP_REVIEW_URL&&AK_GBP_REVIEW_URL.indexOf('YOUR_')<0){
      setTimeout(function(){window.open(AK_GBP_REVIEW_URL,'_blank');},1200);
    }
  } else {
    showToast('Thanks! We\'ll improve 🙏','orange');
  }
}

/* ================================================
   ★ GA4 CUSTOM EVENTS
   ================================================ */
function ga4Event(name,params){
  try{if(window.gtag)gtag('event',name,params||{});}catch(e){}
}
// Cart abandon tracking
var cartAbandonTimer=null;
function trackCartOpen(){
  ga4Event('cart_open',{items_count:Object.keys(cart).length});
  if(cartAbandonTimer)clearTimeout(cartAbandonTimer);
  cartAbandonTimer=setTimeout(function(){
    if(Object.keys(cart).length>0){
      ga4Event('cart_abandon',{items_count:Object.keys(cart).length,cart_value:Object.values(cart).reduce(function(s,i){return s+i.qty*i.price;},0)});
    }
  },300000); // 5 min mein abandon consider
}
function trackCheckoutDrop(step){
  ga4Event('checkout_drop',{step:step,cart_value:Object.values(cart).reduce(function(s,i){return s+i.qty*i.price;},0)});
}
function trackPageSection(section){
  ga4Event('section_view',{section_name:section});
}

/* ================================================
   ★ ORDER HISTORY MODAL
   ================================================ */
function openOrderHistory(){
  var modal=document.getElementById('order-history-modal');
  if(modal){
    renderOrderHistory();
    modal.style.display='flex';
    var w=getWallet();
    var wEl=document.getElementById('oh-wallet-pts');
    if(wEl)wEl.textContent=(w.points||0)+' points (₹'+Math.floor((w.points||0)*POINTS_VALUE)+')';
  }
}
function closeOrderHistory(){
  var modal=document.getElementById('order-history-modal');
  if(modal)modal.style.display='none';
}

/* ================================================
   ★ PATCH: calcBill with Wallet
   ================================================ */
var _origCalcBill=calcBill;
calcBill=function(){
  var subtotal=Object.values(cart).reduce(function(s,i){return s+i.qty*i.price;},0);
  var delivery=subtotal>=399?0:30;
  var discount=0;
  var walletDiscount=0;
  if(appliedCoupon&&COUPONS[appliedCoupon]){
    var c=COUPONS[appliedCoupon];
    if(c.type==='percent')discount=Math.min(Math.round(subtotal*c.value/100),c.maxDisc);
    else if(c.type==='flat')discount=Math.min(c.value,subtotal);
    else if(c.type==='delivery')delivery=0;
  }
  if(walletApplied&&!appliedCoupon){
    walletDiscount=getWalletDiscount(subtotal);
  }
  var gst=Math.round((subtotal-discount-walletDiscount)*0.05);
  var total=Math.max(0,subtotal-discount-walletDiscount+delivery+gst);
  return{subtotal:subtotal,delivery:delivery,discount:discount,walletDiscount:walletDiscount,gst:gst,total:total};
};

/* ================================================
   ★ PATCH: renderFinalBill with Wallet row
   ================================================ */
var _origRenderFinalBill=renderFinalBill;
renderFinalBill=function(){
  var bill=calcBill();
  var summaryHtml='<div style="font-weight:700;color:#2D1A00;margin-bottom:0.5rem;">📦 Order Items:</div>';
  Object.entries(cart).forEach(function(e){summaryHtml+='• '+esc(e[0])+' × '+e[1].qty+' = <b>₹'+(e[1].qty*e[1].price)+'</b><br>';});
  if(appliedCoupon)summaryHtml+='<div style="margin-top:0.5rem;color:#16A34A;font-weight:700;">🏷️ Coupon: '+appliedCoupon+'</div>';
  if(walletApplied)summaryHtml+='<div style="margin-top:0.5rem;color:#7C3AED;font-weight:700;">💰 Wallet: -₹'+bill.walletDiscount+'</div>';
  document.getElementById('final-order-summary').innerHTML=summaryHtml;
  var el=function(id,v){var e=document.getElementById(id);if(e)e.textContent=v;};
  el('final-subtotal','₹'+bill.subtotal);el('final-gst','₹'+bill.gst);el('final-total','₹'+bill.total);el('pay-btn-total',bill.total);
  var dEl=document.getElementById('final-delivery');if(dEl){dEl.textContent=bill.delivery===0?'FREE':'₹'+bill.delivery;dEl.style.color=bill.delivery===0?'#16A34A':'#5C3A1E';}
  var dr=document.getElementById('final-discount-row');if(dr){dr.style.display=bill.discount>0?'flex':'none';}
  el('final-discount','-₹'+bill.discount);
  var cl=document.getElementById('final-coupon-label');if(cl&&appliedCoupon)cl.textContent='Discount ('+appliedCoupon+')';
  var wr=document.getElementById('final-wallet-row');if(wr){wr.style.display=bill.walletDiscount>0?'flex':'none';}
  el('final-wallet-disc','-₹'+bill.walletDiscount);
};


/* ================================================
   ★ PATCH: openCartModal — GA4 tracking (no login block — guest allowed)
   ================================================ */
var _origOpenCartModal=openCartModal;
openCartModal=function(){
  if(Object.keys(cart).length===0){showToast('Cart is empty! Add items first.','red');return;}
  if(!deliveryRadiusChecked)checkUserDeliveryRadius();
  var subtotal=Object.values(cart).reduce(function(s,i){return s+i.qty*i.price;},0);
  checkUpsell(subtotal);
  document.getElementById('cart-modal').style.display='block';
  document.body.classList.add('modal-open');
  document.body.style.top='-'+window.scrollY+'px';
  trackCartOpen(); // GA4
  goStep(1);
};

/* ================================================
   ★ PATCH: closeCartModal — GA4 abandon
   ================================================ */
var _origCloseCartModal=closeCartModal;
closeCartModal=function(){
  var scrollY=document.body.style.top;
  document.getElementById('cart-modal').style.display='none';
  document.body.classList.remove('modal-open');
  document.body.style.top='';
  window.scrollTo(0,parseInt(scrollY||'0')*-1);
  if(currentStep<4&&Object.keys(cart).length>0){
    trackCheckoutDrop(currentStep); // GA4
  }
  if(cartAbandonTimer){clearTimeout(cartAbandonTimer);cartAbandonTimer=null;}
};

/* ================================================
   ★ PATCH: tapCoupon — block if wallet active
   ================================================ */
var _origTapCoupon=tapCoupon;
tapCoupon=function(code){
  if(walletApplied){showToast('Wallet remove karo pehle — ek hi discount ek baar!','red');return;}
  _origTapCoupon(code);
};

/* ================================================
   ★ INIT NEW FEATURES after auth
   ================================================ */
function initNewFeatures(){
  updateWalletUI();
  loadWalletFromFirebase();
  checkFeedbackPopup();
  // Birthday notification
  if(isBirthday()){
    setTimeout(function(){showToast('🎂 Happy Birthday '+((currentUser&&currentUser.name)||'')+'! Double points aaj! 🎉','green');},3000);
  }
}

/* ================================================
   ★ INIT
   ================================================ */

/* ================================================
   ★ FIX 4: CUSTOMER LIVE ORDER TRACKING SYSTEM
   ================================================ */

var _trackingOrderId=null;
var _trackingInterval=null;
var _trackingUnsubscribe=null;
var _etaCountdownInterval=null;
var _etaTargetByOrderId={};
var TRACK_STEPS=[
  {key:'New',      icon:'📋', title:'Order Received',      sub:'Aapka order humne receive kar liya'},
  {key:'Confirmed',icon:'✅', title:'Order Confirmed',      sub:'Kitchen ne order confirm kar diya'},
  {key:'Preparing',icon:'🍳', title:'Khana Ban Raha Hai',   sub:'Chef aapka order prepare kar raha hai'},
  {key:'Out for Delivery',icon:'🛵',title:'Out for Delivery',sub:'Rider aapke paas aa raha hai!'},
  {key:'Delivered',icon:'🎉', title:'Delivered!',           sub:'Order deliver ho gaya. Enjoy your meal!'},
];

function openTrackModal(){
  var modal=document.getElementById('track-modal');
  if(!modal)return;
  var lastOrderId=_trackingOrderId||lsGet('ak_last_order_id',null);
  if(!lastOrderId){showToast('Koi active order nahi hai.','red');return;}
  _trackingOrderId=lastOrderId;
  modal.style.display='flex';
  var notifyBtn=document.getElementById('track-notify-btn');
  if(notifyBtn){notifyBtn.disabled=false;notifyBtn.style.background='#FFF0E0';notifyBtn.style.color='#FF6B00';notifyBtn.style.borderColor='var(--saffron)';notifyBtn.textContent='🔔 Order updates ke liye notification allow karo';}
  document.getElementById('track-order-id-lbl').textContent='Order ID: '+lastOrderId;
  // Cancel any previous listener
  if(_trackingUnsubscribe){_trackingUnsubscribe();_trackingUnsubscribe=null;}
  if(_trackingInterval){clearInterval(_trackingInterval);_trackingInterval=null;}
  if(akFirebaseReady){
    // REALTIME: onSnapshot — instant update jab bhi admin status change kare
    _trackingUnsubscribe=firebase.firestore().collection('orders').doc(lastOrderId)
      .onSnapshot(function(snap){
        if(snap.exists){renderTrackingUI(snap.data());}
        else{
          var orders=lsGet('ak_orders',[]);
          var o=orders.find(function(x){return x.id===lastOrderId;});
          if(o)renderTrackingUI(o);
        }
      },function(){
        // Fallback to localStorage if listener fails
        loadAndRenderTracking(lastOrderId);
      });
  }else{
    // Offline fallback: poll every 30s
    loadAndRenderTracking(lastOrderId);
    _trackingInterval=setInterval(function(){loadAndRenderTracking(lastOrderId);},30000);
  }
}

function enablePushForCurrentOrder(){
  var btn=document.getElementById('track-notify-btn');
  var oid=_trackingOrderId;
  if(!oid){showToast('Order track ho raha nahi hai abhi','orange');return;}
  if(!('Notification' in window)){
    if(btn)btn.textContent='⚠️ Is browser mein notifications support nahi hain';
    return;
  }
  if(!window.akMessaging||!window.AK_VAPID_KEY||window.AK_VAPID_KEY==='PASTE_YOUR_VAPID_KEY_HERE'){
    if(btn)btn.textContent='⚠️ Notifications abhi setup nahi hue hain';
    return;
  }
  if(btn){btn.disabled=true;btn.textContent='⏳ Allow kar rahe hain...';}
  Notification.requestPermission().then(function(perm){
    if(perm!=='granted'){
      if(btn){btn.disabled=false;btn.textContent='🔔 Notification allow nahi hui — dubara try karo';}
      return;
    }
    return window.akMessaging.getToken({vapidKey:window.AK_VAPID_KEY}).then(function(token){
      if(!token)throw new Error('No token');
      return firebase.firestore().collection('orders').doc(String(oid)).update({fcmToken:token});
    });
  }).then(function(){
    if(btn){btn.textContent='✅ Notifications ON — order updates milte rahenge!';btn.style.background='#DCFCE7';btn.style.color='#16A34A';btn.style.borderColor='#16A34A';btn.disabled=true;}
  }).catch(function(e){
    console.warn('Push enable failed',e);
    if(btn){btn.disabled=false;btn.textContent='⚠️ Kuch gadbad hui, dubara try karo';}
  });
}
function closeTrackModal(){
  var modal=document.getElementById('track-modal');
  if(modal)modal.style.display='none';
  if(_trackingUnsubscribe){_trackingUnsubscribe();_trackingUnsubscribe=null;}
  if(_trackingInterval){clearInterval(_trackingInterval);_trackingInterval=null;}
  if(_etaCountdownInterval){clearInterval(_etaCountdownInterval);_etaCountdownInterval=null;}
}

function loadAndRenderTracking(orderId){
  if(akFirebaseReady){
    firebase.firestore().collection('orders').doc(orderId).get()
      .then(function(snap){
        if(snap.exists){
          renderTrackingUI(snap.data());
        }else{
          // Try localStorage
          var orders=lsGet('ak_orders',[]);
          var o=orders.find(function(x){return x.id===orderId;});
          if(o)renderTrackingUI(o);
          else document.getElementById('track-steps').innerHTML='<div style="text-align:center;color:#A08060;padding:1rem;">Order details nahi mile. Order ID check karo.</div>';
        }
      }).catch(function(){
        var orders=lsGet('ak_orders',[]);
        var o=orders.find(function(x){return x.id===orderId;});
        if(o)renderTrackingUI(o);
      });
  }else{
    var orders=lsGet('ak_orders',[]);
    var o=orders.find(function(x){return x.id===orderId;});
    if(o)renderTrackingUI(o);
    else document.getElementById('track-steps').innerHTML='<div style="text-align:center;color:#A08060;padding:1rem;">Order '+orderId+' nahi mila localStorage mein.</div>';
  }
}

function renderTrackingUI(order){
  var status=order.status||'New';
  var statusOrder=['New','Confirmed','Preparing','Out for Delivery','Delivered','Cancelled'];
  var currentIdx=statusOrder.indexOf(status);

  // Render steps
  var stepsHtml='';
  TRACK_STEPS.forEach(function(step,i){
    var stepIdx=statusOrder.indexOf(step.key);
    var isDone=stepIdx<currentIdx;
    var isActive=step.key===status;
    var cls=isDone?'done':(isActive?'active':'');
    stepsHtml+='<div class="track-step '+cls+'">';
    stepsHtml+='<div class="track-step-dot">'+(isDone?'✓':(isActive?step.icon:step.icon))+'</div>';
    stepsHtml+='<div class="track-step-info">';
    stepsHtml+='<div class="track-step-title">'+step.title+'</div>';
    stepsHtml+='<div class="track-step-sub">'+step.sub+'</div>';
    stepsHtml+='</div></div>';
  });

  // Cancelled state
  if(status==='Cancelled'){
    stepsHtml='<div style="text-align:center;padding:1.5rem;color:#DC2626;"><div style="font-size:2rem;">❌</div><div style="font-weight:800;margin-top:8px;">Order Cancel Hua</div><div style="font-size:0.82rem;margin-top:4px;">Agar koi issue hai to humse contact karo.</div></div>';
  }

  document.getElementById('track-steps').innerHTML=stepsHtml;

  // LIVE ETA COUNTDOWN — ticks down every second instead of a static range
  var etaSubMap={
    'New':'Order abhi receive hua hai',
    'Confirmed':'Kitchen mein preparation shuru hogi',
    'Preparing':'Chef aapka khana bana raha hai 🍳',
    'Out for Delivery':'Rider aapke raste mein hai! 🛵',
    'Delivered':'Thank you for ordering! Rate us ⭐',
    'Cancelled':'Order cancelled hai'
  };
  // Total estimated minutes remaining from NOW for each status stage —
  // used as an upper-bound; the countdown only ever tightens, never grows.
  var etaMinsFromNowMap={
    'New':42,'Confirmed':35,'Preparing':25,'Out for Delivery':13
  };
  var etaEl=document.getElementById('track-eta');
  var etaSubEl=document.getElementById('track-eta-sub');
  var oid=order.id||order.orderId||_trackingOrderId||'order';
  if(_etaCountdownInterval){clearInterval(_etaCountdownInterval);_etaCountdownInterval=null;}
  if(status==='Delivered'||status==='Cancelled'){
    if(etaEl)etaEl.textContent=status==='Delivered'?'Delivered! 🎉':'—';
    if(etaSubEl)etaSubEl.textContent=etaSubMap[status]||'';
    delete _etaTargetByOrderId[oid];
  }else{
    var candidateTarget=Date.now()+((etaMinsFromNowMap[status]||35)*60000);
    var existingTarget=_etaTargetByOrderId[oid];
    // Only tighten the promise (order can get "closer", never "further")
    var target=existingTarget?Math.min(existingTarget,candidateTarget):candidateTarget;
    _etaTargetByOrderId[oid]=target;
    if(etaSubEl)etaSubEl.textContent=etaSubMap[status]||'';
    var tickEta=function(){
      var remainingMs=target-Date.now();
      if(remainingMs<=0){
        if(etaEl)etaEl.textContent='Any moment now! 🍽️';
        clearInterval(_etaCountdownInterval);_etaCountdownInterval=null;
        return;
      }
      var mins=Math.floor(remainingMs/60000);
      var secs=Math.floor((remainingMs%60000)/1000);
      if(etaEl)etaEl.textContent=mins+':'+(secs<10?'0':'')+secs+' min';
    }
    tickEta();
    _etaCountdownInterval=setInterval(tickEta,1000);
  }

  // Show rider card if assigned
  var riderCard=document.getElementById('track-rider-card');
  if(order.deliveredBy&&(status==='Out for Delivery'||status==='Preparing')){
    if(riderCard)riderCard.style.display='block';
    var riderName=document.getElementById('track-rider-name');
    var riderPhone=document.getElementById('track-rider-phone');
    var riderCall=document.getElementById('track-rider-call');
    if(riderName)riderName.textContent='🛵 '+order.deliveredBy;
    // Try to get rider phone from riders list
    var riders=lsGet('ak_riders',[]);
    var rider=riders.find(function(r){return r.name===order.deliveredBy;});
    if(riderPhone)riderPhone.textContent=rider&&rider.phone?'+91 '+rider.phone:'Rider assigned';
    if(riderCall&&rider&&rider.phone)riderCall.href='tel:+91'+rider.phone.replace(/[^0-9]/g,'');
  }else{
    if(riderCard)riderCard.style.display='none';
  }
}

// Show Track Order FAB after order is placed
function showTrackFAB(orderId){
  _trackingOrderId=orderId;
  lsSet('ak_last_order_id',orderId);
  var fab=document.getElementById('track-order-fab');
  if(fab)fab.style.display='block';
  // Auto-open tracking modal so user sees order status immediately
  setTimeout(function(){openTrackModal();},800);
}

renderMenu();
renderOffers();
checkAuthOnLoad();
checkUserDeliveryRadius();
// Restore tracking FAB if there's a recent active order
(function(){
  var lastId=lsGet('ak_last_order_id',null);
  if(!lastId)return;
  var orders=lsGet('ak_orders',[]);
  var o=orders.find(function(x){return x.id===lastId;});
  if(o&&o.status!=='Delivered'&&o.status!=='Cancelled'){
    setTimeout(function(){
      var fab=document.getElementById('track-order-fab');
      if(fab)fab.style.display='block';
      _trackingOrderId=lastId;
      // openTrackModal() will start Firestore listener when user taps FAB
    },2000);
  }
})();
// Auto-update copyright year
(function(){var yr=new Date().getFullYear();var y=document.getElementById('footer-year');if(y)y.textContent=yr;var y2=document.getElementById('footer-year-2');if(y2)y2.textContent=yr;})();
// Keyboard accessibility: close modals on Escape
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    if(document.getElementById('cart-modal').style.display!=='none')closeCartModal();
    if(document.getElementById('auth-overlay').style.display==='flex')skipAuth();
    if(document.getElementById('offer-popup').style.display==='flex')closeOfferPopup();
    if(document.getElementById('track-modal')&&document.getElementById('track-modal').classList&&document.getElementById('track-modal').classList.contains('open')&&typeof closeTrackModal==='function')closeTrackModal();
  }
});
// Auto-fill address input scroll — keyboard push fix
document.querySelectorAll('input, textarea, select').forEach(function(el){
  el.addEventListener('focus',function(){
    var self=this;
    setTimeout(function(){
      self.scrollIntoView({behavior:'smooth',block:'center'});
    },300);
  });
});



/* ================================================
   ★ REAL REVIEWS — Firebase se public display
   ================================================ */
function loadPublicReviews(){
  var grid=document.getElementById('public-reviews-grid');
  if(!grid)return;

  var fallback=[
    {name:'Rahul S.',rating:5,comment:'Butter Chicken ekdum amazing tha! Fast delivery bhi.',platform:'Zomato',date:'2025-01-10'},
    {name:'Priya M.',rating:5,comment:'Best momos in Dhanbad! Peri peri burger bhi loved.',platform:'WhatsApp',date:'2025-01-08'},
    {name:'Amit K.',rating:4,comment:'Good food, reasonable price. Will order again.',platform:'Swiggy',date:'2025-01-06'},
  ];

  function renderCards(reviews){
    if(!reviews||!reviews.length){
      grid.innerHTML='<div style="color:#A08060;font-size:0.85rem;padding:1rem;text-align:center;">Pehle order kar ke review do! 😊</div>';
      return;
    }
    grid.innerHTML=reviews.map(function(r){
      var avg=r.rating||Math.round(((r.food||3)+(r.delivery||3)+(r.value||3))/3);
      var stars='';for(var i=1;i<=5;i++)stars+='<span style="color:'+(i<=avg?'#FF6B00':'#DDD')+';">★</span>';
      return '<div style="background:#fff;border-radius:14px;padding:1rem 1.2rem;box-shadow:0 2px 12px rgba(45,26,0,0.08);border:1.5px solid #F5EDE5;">'
        +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">'
        +'<span style="font-weight:800;color:var(--deep-brown);font-size:0.88rem;">'+esc(r.name||'Customer')+'</span>'
        +'<span style="font-size:0.7rem;color:#A08060;background:#FFF0E0;padding:2px 8px;border-radius:20px;">'+esc(r.platform||'')+'</span>'
        +'</div>'
        +'<div style="font-size:1rem;margin-bottom:0.5rem;">'+stars+'</div>'
        +(r.comment?'<p style="font-size:0.82rem;color:#5C3A1E;line-height:1.5;margin:0 0 0.4rem;">&#8220;'+esc(r.comment)+'&#8221;</p>':'')
        +'<div style="font-size:0.7rem;color:#C0A080;">'+(r.date||r.createdAt||'').toString().substring(0,10)+'</div>'
        +'</div>';
    }).join('');
  }

  renderCards(fallback); // pehle fallback

  if(akFirebaseReady){
    firebase.firestore().collection('feedback')
      .orderBy('createdAt','desc')
      .limit(20)
      .get()
      .then(function(snap){
        if(snap.empty)return;
        var list=[];
        snap.forEach(function(doc){list.push(doc.data());});
        // Client-side: 3+ star aur comment wale
        var good=list.filter(function(r){
          var avg=r.rating||Math.round(((r.food||0)+(r.delivery||0)+(r.value||0))/3);
          return avg>=3&&r.comment&&r.comment.trim().length>5;
        });
        if(good.length>=2)renderCards(good.slice(0,9));
      })
      .catch(function(e){console.warn('Reviews load error:',e);});
  }
}

// Page load pe reviews fetch
window.addEventListener('akFirebaseReady',function(){loadPublicReviews();});

function loadKitchenGallery(){
  var section=document.getElementById('kitchen-gallery-section');
  var grid=document.getElementById('kitchen-gallery-grid');
  if(!section||!grid)return;
  firebase.firestore().collection('settings').doc('kitchen_gallery').get().then(function(doc){
    var images=(doc.exists&&doc.data().images)||[];
    if(!images.length){section.style.display='none';return;}
    grid.innerHTML=images.map(function(url){
      return '<div class="kg-photo"><img src="'+url+'" alt="Atharav Kitchen — hamari kitchen" loading="lazy"></div>';
    }).join('');
    section.style.display='';
  }).catch(function(){section.style.display='none';});
}
window.addEventListener('akFirebaseReady',function(){loadKitchenGallery();});
window.addEventListener('load',function(){setTimeout(loadPublicReviews,2000);});


/* ================================================
   ★ AUTO RATING PROMPT (delivery ke baad)
   ================================================ */
function checkAutoRatingPrompt(){
  var orders=lsGet('ak_orders',[]);
  var now=Date.now();
  orders.forEach(function(o){
    if(o.ratingPromptShown)return;
    // 30 min baad prompt dikhao (30 * 60 * 1000)
    var orderTime=o.timestamp||o.createdAtMs||(new Date(o.date||o.time||0).getTime())||0;
    if(orderTime && (now-orderTime)>1800000 && (now-orderTime)<86400000){
      showAutoRatingPrompt(o);
      // Mark as shown
      o.ratingPromptShown=true;
      lsSet('ak_orders',orders);
    }
  });
}

function showAutoRatingPrompt(order){
  // Don't show if already rated recently
  var lastRated=lsGet('ak_last_rated',0);
  if(Date.now()-lastRated < 86400000) return;
  var pop=document.createElement('div');
  pop.id='auto-rating-popup';
  pop.style.cssText='position:fixed;inset:0;background:rgba(45,26,0,0.7);backdrop-filter:blur(8px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  pop.innerHTML='<div style="max-width:360px;width:100%;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 30px 80px rgba(45,26,0,0.4);animation:popIn 0.3s ease;">'
    +'<div style="background:linear-gradient(135deg,#FF6B00,#FF8C00);padding:1.2rem;text-align:center;">'
    +'<div style="font-size:2.5rem;">⭐</div>'
    +'<div style="font-family:Playfair Display,serif;font-size:1.1rem;font-weight:700;color:#fff;margin-top:6px;">Aapka Order Kaisa Tha?</div>'
    +'<div style="font-size:0.75rem;color:rgba(255,255,255,0.85);margin-top:4px;">Order #'+(order.id||order.orderId)+' — Feedback do! 🙏</div>'
    +'</div>'
    +'<div style="padding:1.4rem;text-align:center;">'
    +'<div style="font-size:0.85rem;color:#5C3A1E;font-weight:600;margin-bottom:1rem;">Kitne stars doge? 😊</div>'
    +'<div style="display:flex;justify-content:center;gap:0.6rem;margin-bottom:1.2rem;" id="ar-stars">'
    +'<button onclick="selectAutoRatingStar(1)" class="ar-star" data-val="1" style="font-size:2rem;background:none;border:none;cursor:pointer;opacity:0.4;transition:all 0.2s;">★</button>'
    +'<button onclick="selectAutoRatingStar(2)" class="ar-star" data-val="2" style="font-size:2rem;background:none;border:none;cursor:pointer;opacity:0.4;transition:all 0.2s;">★</button>'
    +'<button onclick="selectAutoRatingStar(3)" class="ar-star" data-val="3" style="font-size:2rem;background:none;border:none;cursor:pointer;opacity:0.4;transition:all 0.2s;">★</button>'
    +'<button onclick="selectAutoRatingStar(4)" class="ar-star" data-val="4" style="font-size:2rem;background:none;border:none;cursor:pointer;opacity:0.4;transition:all 0.2s;">★</button>'
    +'<button onclick="selectAutoRatingStar(5)" class="ar-star" data-val="5" style="font-size:2rem;background:none;border:none;cursor:pointer;opacity:0.4;transition:all 0.2s;">★</button>'
    +'</div>'
    +'<button onclick="submitAutoRating('+JSON.stringify(JSON.stringify(order))+')" id="ar-submit-btn" style="width:100%;padding:13px;background:linear-gradient(135deg,#FF6B00,#FF8C00);color:#fff;border:none;border-radius:12px;font-family:Nunito,sans-serif;font-weight:900;font-size:0.9rem;cursor:pointer;margin-bottom:0.6rem;">⭐ Submit Rating</button>'
    +'<button onclick="closeAutoRatingPrompt()" style="background:none;border:none;color:#A08060;font-size:0.78rem;cursor:pointer;font-family:Nunito,sans-serif;text-decoration:underline;">Skip karo →</button>'
    +'</div></div>';
  document.body.appendChild(pop);
  window._autoRatingVal=0;
}

var _autoRatingVal=0;
function selectAutoRatingStar(val){
  _autoRatingVal=val;
  var stars=document.querySelectorAll('.ar-star');
  stars.forEach(function(s,i){
    s.style.opacity=i<val?'1':'0.35';
    s.style.color=i<val?'#FF6B00':'#ccc';
    s.style.transform=i<val?'scale(1.2)':'scale(1)';
  });
}

function submitAutoRating(orderJson){
  if(_autoRatingVal===0){showToast('Pehle stars select karo!','red');return;}
  var order=JSON.parse(orderJson);
  var fb={id:Date.now(),customerId:currentUser?(currentUser.id||currentUser.phone):'guest',orderId:(order.id||order.orderId),rating:_autoRatingVal,date:new Date().toISOString(),autoPrompt:true};
  if(akFirebaseReady){firebase.firestore().collection('feedback').doc(String(fb.id)).set(fb).catch(function(){});}
  lsSet('ak_last_rated',Date.now());
  closeAutoRatingPrompt();
  if(_autoRatingVal>=4){
    showToast('Thank you! ❤️ Zomato pe bhi rate karo!','green');
    setTimeout(function(){window.open('https://link.zomato.com/xqzv/rshare?id=8966837430563d60','_blank');},1500);
  } else {
    showToast('Feedback ke liye shukriya! Hum improve karenge 🙏','orange');
  }
}

function closeAutoRatingPrompt(){
  var pop=document.getElementById('auto-rating-popup');
  if(pop)pop.remove();
}

// Check on page load — 5 sec baad
setTimeout(function(){
  if(typeof currentUser!=='undefined' && currentUser){
    checkAutoRatingPrompt();
  }
}, 5000);

/* ================================================================
   ★ PART B — RETENTION FEATURES
   ================================================================ */

/* ------------------------------------------------
   1. REFERRAL SYSTEM
   ------------------------------------------------ */
function getReferralCode(){
  if(!currentUser)return null;
  if(currentUser.referralCode)return currentUser.referralCode;
  var key='ak_ref_'+(currentUser.phone||currentUser.id);
  var code=lsGet(key,null);
  if(!code){
    code=genReferralCode(currentUser.phone||currentUser.id);
    lsSet(key,code);
    // Legacy account without a cloud referralCode yet — save it to their
    // profile too, so it works across their other devices from now on.
    if(realFirebaseUser()){
      firebase.firestore().collection('customers').doc(realFirebaseUser().uid).set({referralCode:code},{merge:true}).catch(function(){});
      currentUser.referralCode=code;
    }
  }
  return code;
}

function openReferralModal(){
  if(!currentUser){showToast('Pehle login karo!','red');openAuthOrProfile();return;}
  var modal=document.getElementById('referral-modal');
  if(!modal)return;
  var code=getReferralCode();
  var codeEl=document.getElementById('ref-code-display');
  if(codeEl)codeEl.textContent=code||'—';
  // Show cached stats instantly, then refresh from cloud if possible
  var statsKey='ak_ref_stats_'+(currentUser.phone||currentUser.id);
  var stats=lsGet(statsKey,{count:0,earned:0});
  var earnEl=document.getElementById('ref-earned-display');
  var cntEl=document.getElementById('ref-count-display');
  if(earnEl)earnEl.textContent='₹'+stats.earned;
  if(cntEl)cntEl.textContent=stats.count;
  modal.style.display='flex';
  var ru=realFirebaseUser();
  if(ru&&akFirebaseReady){
    firebase.firestore().collection('referral_stats').doc(ru.uid).get().then(function(snap){
      if(!snap.exists)return;
      var cloud=snap.data();
      lsSet(statsKey,cloud);
      if(earnEl)earnEl.textContent='₹'+(cloud.earned||0);
      if(cntEl)cntEl.textContent=cloud.count||0;
    }).catch(function(){});
  }
}
function closeReferralModal(){
  var m=document.getElementById('referral-modal');if(m)m.style.display='none';
}
function copyReferralCode(){
  var code=getReferralCode();
  if(!code)return;
  navigator.clipboard.writeText(code).then(function(){showToast('Code copied! ✅','green');}).catch(function(){showToast('Code: '+code,'green');});
}
function shareReferralCode(){
  var code=getReferralCode();
  if(!code)return;
  var msg='🍽️ *Atharav Kitchen — Best Cloud Kitchen in Dhanbad!*\n\nMere saath order karo aur dono ko ₹50 milega!\n\n🎟️ Mera Referral Code: *'+code+'*\n\nRegister karo: https://atharav-kitchen.pages.dev\n\n💬 Ya seedha order karo: wa.me/917903567007';
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}
// Apply referral on registration — check if referral code entered.
// SECURE DESIGN: naya customer sirf apna "maine yeh code use kiya" claim
// Firestore mein create karta hai (apna hi record — rules isko allow
// karte hain). Referrer ka wallet credit karna admin panel karta hai jab
// woh open hota hai (already-trusted admin access se) — isse koi customer
// kisi doosre ke wallet mein directly points inject nahi kar sakta.
function applyReferralBonus(referrerCode,newCustomer){
  referrerCode=(referrerCode||'').trim().toUpperCase();
  newCustomer=newCustomer||currentUser;
  if(!referrerCode||!newCustomer)return;
  if(referrerCode===(newCustomer.referralCode||'').toUpperCase()){
    showToast('Apna hi referral code use nahi kar sakte!','orange');
    return;
  }
  if(!akFirebaseReady||!firebase.firestore){
    showToast('Referral code save nahi ho paya — internet check karo.','orange');
    return;
  }
  firebase.firestore().collection('referral_claims').add({
    code:referrerCode,
    newCustomerId:newCustomer.id,
    newCustomerName:newCustomer.name||'',
    createdAt:new Date().toISOString(),
    status:'pending'
  }).then(function(){
    // Naye customer ka apna welcome bonus — turant milta hai
    var bonus=100;
    var w=getWallet();
    w.points=(w.points||0)+bonus;
    w.history=w.history||[];
    w.history.push({type:'referral_new_user',pts:bonus,date:new Date().toISOString(),note:'Welcome referral bonus'});
    saveWallet(w);
    updateWalletUI();
    showToast('🎉 Referral bonus! ₹50 wallet mein add hua!','green');
  }).catch(function(e){
    console.warn('Referral claim failed',e);
    showToast('Referral code save nahi ho paya, dubara try karo.','orange');
  });
}

/* ------------------------------------------------
   2. LOYALTY TIERS
   ------------------------------------------------ */
var TIERS=[
  {name:'Bronze',min:0,max:499,emoji:'🥉',color:'#CD7F32',bg:'linear-gradient(135deg,#CD7F32,#b8681d)',cashback:5},
  {name:'Silver',min:500,max:1499,emoji:'🥈',color:'#9CA3AF',bg:'linear-gradient(135deg,#9CA3AF,#6B7280)',cashback:10},
  {name:'Gold',min:1500,max:999999,emoji:'🥇',color:'#F59E0B',bg:'linear-gradient(135deg,#F59E0B,#D97706)',cashback:15}
];

function getCurrentTier(points){
  return TIERS.slice().reverse().find(function(t){return points>=t.min;})||TIERS[0];
}
function getNextTier(points){
  return TIERS.find(function(t){return points<t.max;});
}

function openLoyaltyModal(){
  if(!currentUser){showToast('Pehle login karo!','red');openAuthOrProfile();return;}
  var modal=document.getElementById('loyalty-modal');
  if(!modal)return;
  var w=getWallet();
  var pts=w.points||0;
  var tier=getCurrentTier(pts);
  var next=getNextTier(pts);
  // Update header
  var header=document.getElementById('loyalty-header');
  if(header)header.style.background=tier.bg;
  var emo=document.getElementById('loyalty-badge-emoji');
  if(emo)emo.textContent=tier.emoji;
  var tname=document.getElementById('loyalty-tier-name');
  if(tname)tname.textContent=tier.name+' Member';
  var ptsLine=document.getElementById('loyalty-pts-line');
  if(ptsLine)ptsLine.textContent=pts+' points earned';
  // Progress
  var progLabel=document.getElementById('loyalty-progress-label');
  var progPts=document.getElementById('loyalty-progress-pts');
  var progBar=document.getElementById('loyalty-progress-bar');
  if(next&&next.name!==tier.name){
    var pct=Math.min(100,Math.round((pts-tier.min)/(next.min-tier.min)*100));
    if(progLabel)progLabel.textContent='Progress to '+next.name;
    if(progPts)progPts.textContent=pts+' / '+next.min+' pts';
    if(progBar){progBar.style.width=pct+'%';progBar.style.background=tier.color;}
  } else {
    if(progLabel)progLabel.textContent='🏆 Maximum tier reached!';
    if(progPts)progPts.textContent=pts+' pts';
    if(progBar)progBar.style.width='100%';
  }
  // Highlight current tier row
  ['bronze','silver','gold'].forEach(function(t){
    var row=document.getElementById('tier-'+t);
    var chk=document.getElementById('tier-'+t+'-check');
    if(row){
      row.style.border=tier.name.toLowerCase()===t?'2.5px solid '+tier.color:'2px solid #F0D8C0';
      row.style.background=tier.name.toLowerCase()===t?'#FFF8F0':'#fff';
    }
    if(chk)chk.textContent=tier.name.toLowerCase()===t?'✅':'';
  });
  modal.style.display='flex';
}
function closeLoyaltyModal(){
  var m=document.getElementById('loyalty-modal');if(m)m.style.display='none';
}
// Update tier label in nav dropdown
function updateTierLabel(){
  var lbl=document.getElementById('ud-tier-lbl');
  if(!lbl||!currentUser)return;
  var w=getWallet();
  var tier=getCurrentTier(w.points||0);
  lbl.textContent=tier.emoji+' '+tier.name;
  lbl.style.color=tier.color;
}

/* ------------------------------------------------
   3. ADDRESS BOOK
   ------------------------------------------------ */
function getAddresses(){
  if(!currentUser)return[];
  return lsGet('ak_addrs_'+(currentUser.phone||currentUser.id),[]);
}
function saveAddresses(arr){
  if(!currentUser)return;
  lsSet('ak_addrs_'+(currentUser.phone||currentUser.id),arr);
}

function openAddressBook(){
  if(!currentUser){showToast('Pehle login karo!','red');openAuthOrProfile();return;}
  var modal=document.getElementById('address-modal');
  if(!modal)return;
  renderAddressList();
  modal.style.display='flex';
}
function closeAddressBook(){
  var m=document.getElementById('address-modal');if(m)m.style.display='none';
}
function renderAddressList(){
  var list=document.getElementById('address-list');
  if(!list)return;
  var addrs=getAddresses();
  if(!addrs.length){
    list.innerHTML='<div style="text-align:center;padding:1rem;color:#A08060;font-size:0.82rem;">Koi saved address nahi hai.</div>';
    return;
  }
  list.innerHTML=addrs.map(function(a,i){
    return '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1.5px solid #F5EDE5;">'
      +'<span style="font-size:1.2rem;margin-top:2px;">📍</span>'
      +'<div style="flex:1;"><div style="font-weight:800;font-size:0.82rem;color:#2D1A00;">'+esc(a.label||'Address '+(i+1))+'</div>'
      +'<div style="font-size:0.75rem;color:#5C3A1E;margin-top:2px;">'+esc(a.text)+'</div></div>'
      +'<div style="display:flex;gap:4px;">'
      +'<button onclick="useAddress('+i+')" style="padding:5px 10px;background:#FF6B00;color:#fff;border:none;border-radius:8px;font-family:\'Nunito\',sans-serif;font-weight:800;font-size:0.7rem;cursor:pointer;">Use</button>'
      +'<button onclick="deleteAddress('+i+')" style="padding:5px 8px;background:#FEE2E2;color:#DC2626;border:none;border-radius:8px;font-family:\'Nunito\',sans-serif;font-weight:700;font-size:0.7rem;cursor:pointer;">✕</button>'
      +'</div></div>';
  }).join('');
}
function saveNewAddress(){
  var label=(document.getElementById('addr-label').value||'').trim();
  var text=(document.getElementById('addr-text').value||'').trim();
  if(!text){showToast('Address likhna zaruri hai!','red');return;}
  var addrs=getAddresses();
  addrs.push({label:label||'Address '+(addrs.length+1),text:text});
  saveAddresses(addrs);
  document.getElementById('addr-label').value='';
  document.getElementById('addr-text').value='';
  renderAddressList();
  showToast('Address save ho gaya! ✅','green');
}
function deleteAddress(idx){
  var addrs=getAddresses();
  addrs.splice(idx,1);
  saveAddresses(addrs);
  renderAddressList();
  showToast('Address hata diya','orange');
}
function useAddress(idx){
  var addrs=getAddresses();
  var a=addrs[idx];
  if(!a)return;
  var addrInput=document.getElementById('ord-address');
  if(addrInput)addrInput.value=a.text;
  closeAddressBook();
  openCartModal();
  goStep(3);
  showToast('Address fill ho gaya! ✅','green');
}

/* ------------------------------------------------
   4. WISHLIST / FAVOURITES
   ------------------------------------------------ */
function getWishlist(){
  if(!currentUser)return lsGet('ak_wishlist_guest',[]);
  return lsGet('ak_wishlist_'+(currentUser.phone||currentUser.id),[]);
}
function saveWishlist(arr){
  if(!currentUser){lsSet('ak_wishlist_guest',arr);return;}
  lsSet('ak_wishlist_'+(currentUser.phone||currentUser.id),arr);
}

function toggleWishlist(itemJson,event){
  if(event){event.stopPropagation();}
  var item=JSON.parse(itemJson);
  var wl=getWishlist();
  var idx=wl.findIndex(function(w){return w.name===item.name;});
  if(idx>=0){
    wl.splice(idx,1);
    showToast('Favourites se hata diya 💔','orange');
  } else {
    wl.push({name:item.name,price:item.price,imgUrl:item.imgUrl||'',imgData:item.imgData||'',cat:item.cat,desc:item.desc,veg:item.veg});
    showToast('❤️ Favourites mein add!','green');
  }
  saveWishlist(wl);
  _doRenderMenu(); // re-render to update hearts
}

function openWishlist(){
  var modal=document.getElementById('wishlist-modal');
  if(!modal)return;
  renderWishlistItems();
  modal.style.display='flex';
}
function closeWishlist(){
  var m=document.getElementById('wishlist-modal');if(m)m.style.display='none';
}
function renderWishlistItems(){
  var container=document.getElementById('wishlist-items');
  var empty=document.getElementById('wishlist-empty');
  var wl=getWishlist();
  if(!wl.length){
    if(container)container.innerHTML='';
    if(empty)empty.style.display='block';
    return;
  }
  if(empty)empty.style.display='none';
  if(!container)return;
  container.innerHTML=wl.map(function(item){
    var inCart=cart[item.name]?cart[item.name].qty:0;
    var wlImgSrc=item.imgUrl||item.imgData||'';
    var wlImgHtml=wlImgSrc?'<img src="'+wlImgSrc+'" alt="'+esc(item.name)+'" style="width:100%;height:90px;object-fit:cover;border-radius:10px;margin-bottom:6px;">':'<div style="width:100%;height:90px;border-radius:10px;margin-bottom:6px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#FFE4C4,#FFD1A3);font-family:\'Playfair Display\',serif;font-weight:900;font-size:1.8rem;color:rgba(45,26,0,0.35);">'+esc((item.name||'?').charAt(0).toUpperCase())+'</div>';
    return '<div style="background:#FFF8F0;border:2px solid #F0D8C0;border-radius:14px;padding:0.9rem;text-align:center;">'
      +wlImgHtml
      +'<div style="font-weight:800;font-size:0.8rem;color:#2D1A00;margin-bottom:4px;">'+esc(item.name)+'</div>'
      +'<div style="font-weight:900;color:#FF6B00;font-size:0.82rem;margin-bottom:8px;">₹'+item.price+'</div>'
      +(inCart>0
        ?'<div style="background:#FF6B00;border-radius:8px;padding:5px;display:flex;align-items:center;justify-content:center;gap:8px;">'
          +'<button onclick="changeQty(\''+item.name.replace(/'/g,"\\'")+'\',' +item.price+',-1,event)" style="background:transparent;border:none;color:#fff;font-size:1rem;cursor:pointer;font-weight:800;">−</button>'
          +'<span style="color:#fff;font-weight:800;">'+inCart+'</span>'
          +'<button onclick="changeQty(\''+item.name.replace(/'/g,"\\'")+'\',' +item.price+',1,event)" style="background:transparent;border:none;color:#fff;font-size:1rem;cursor:pointer;font-weight:800;">+</button>'
          +'</div>'
        :'<button onclick="addCart(\''+item.name.replace(/'/g,"\\'")+'\','+item.price+',event);renderWishlistItems();" style="width:100%;padding:7px;background:linear-gradient(135deg,#FF6B00,#FF8C00);color:#fff;border:none;border-radius:8px;font-family:\'Nunito\',sans-serif;font-weight:800;font-size:0.78rem;cursor:pointer;">+ Add</button>')
      +'</div>';
  }).join('');
}

/* ------------------------------------------------
   5. SPIN THE WHEEL
   ------------------------------------------------ */
var SPIN_PRIZES=[
  {label:'₹30 OFF',code:'SPIN30',type:'flat',value:30,color:'#FF6B00',emoji:'💰'},
  {label:'Free Delivery',code:'FREEDEL',type:'delivery',value:0,color:'#25D366',emoji:'🛵'},
  {label:'Try Again',code:null,type:'nothing',value:0,color:'#9CA3AF',emoji:'😅'},
  {label:'₹50 OFF',code:'SPIN50',type:'flat',value:50,color:'#DC2626',emoji:'🎉'},
  {label:'10% OFF',code:'SPIN10',type:'percent',value:10,color:'#7C3AED',emoji:'🏷️'},
  {label:'Try Again',code:null,type:'nothing',value:0,color:'#9CA3AF',emoji:'😅'},
  {label:'₹20 OFF',code:'SPIN20',type:'flat',value:20,color:'#F59E0B',emoji:'⭐'},
  {label:'Free Dessert',code:'DESSERT',type:'flat',value:40,color:'#E11D48',emoji:'🍰'}
];

var spinAngle=0;
var isSpinning=false;

function drawWheel(){
  var canvas=document.getElementById('spin-wheel');
  if(!canvas)return;
  var ctx=canvas.getContext('2d');
  var cx=150,cy=150,r=140;
  var sliceAngle=2*Math.PI/SPIN_PRIZES.length;
  SPIN_PRIZES.forEach(function(p,i){
    var start=spinAngle+i*sliceAngle;
    var end=start+sliceAngle;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,start,end);
    ctx.closePath();
    ctx.fillStyle=p.color;
    ctx.fill();
    ctx.strokeStyle='#fff';
    ctx.lineWidth=2;
    ctx.stroke();
    // Label
    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(start+sliceAngle/2);
    ctx.textAlign='right';
    ctx.fillStyle='#fff';
    ctx.font='bold 11px Nunito,sans-serif';
    ctx.fillText(p.label,r-10,4);
    ctx.restore();
  });
}

function openSpinModal(){
  if(!currentUser){showToast('Spin karne ke liye pehle login karo!','red');openAuthOrProfile();return;}
  var modal=document.getElementById('spin-modal');
  if(!modal)return;
  // Check cooldown
  var lastSpin=lsGet('ak_last_spin',0);
  var now=Date.now();
  var cooldown=24*60*60*1000; // 24 hours
  var remaining=cooldown-(now-lastSpin);
  var cdMsg=document.getElementById('spin-cooldown-msg');
  var spinBtn=document.getElementById('spin-btn');
  var result=document.getElementById('spin-result');
  if(result)result.style.display='none';
  if(remaining>0){
    var hrs=Math.floor(remaining/3600000);
    var mins=Math.floor((remaining%3600000)/60000);
    if(cdMsg)cdMsg.textContent='Next spin '+hrs+'h '+mins+'m mein milega';
    if(spinBtn){spinBtn.disabled=true;spinBtn.style.opacity='0.5';}
  } else {
    if(cdMsg)cdMsg.textContent='Ek spin har 24 ghante!';
    if(spinBtn){spinBtn.disabled=false;spinBtn.style.opacity='1';}
  }
  modal.style.display='flex';
  setTimeout(drawWheel,50);
}
function closeSpinModal(){
  var m=document.getElementById('spin-modal');if(m)m.style.display='none';
}

function spinWheel(){
  if(isSpinning)return;
  var lastSpin=lsGet('ak_last_spin',0);
  if(Date.now()-lastSpin<24*60*60*1000){showToast('Kal phir aao! 24 ghante wait karo 🕐','red');return;}
  isSpinning=true;
  var spinBtn=document.getElementById('spin-btn');
  if(spinBtn){spinBtn.disabled=true;spinBtn.textContent='Spinning...';}
  var result=document.getElementById('spin-result');
  if(result)result.style.display='none';
  // Weighted random — nothing has 2 slots out of 8 = 25% chance
  var prizeIdx=Math.floor(Math.random()*SPIN_PRIZES.length);
  var sliceAngle=2*Math.PI/SPIN_PRIZES.length;
  // Calculate target angle so winning slice is at top (pointer position)
  var targetAngle=-(prizeIdx*sliceAngle+sliceAngle/2)+(2*Math.PI*5); // 5 full spins
  var duration=4000;
  var start=null;
  var startAngle=spinAngle;

  function animate(ts){
    if(!start)start=ts;
    var elapsed=ts-start;
    var t=Math.min(elapsed/duration,1);
    // Ease out cubic
    var ease=1-Math.pow(1-t,3);
    spinAngle=startAngle+targetAngle*ease;
    drawWheel();
    if(t<1){
      requestAnimationFrame(animate);
    } else {
      isSpinning=false;
      lsSet('ak_last_spin',Date.now());
      showSpinResult(SPIN_PRIZES[prizeIdx]);
      if(spinBtn){spinBtn.textContent='🎰 SPIN!';spinBtn.disabled=true;spinBtn.style.opacity='0.5';}
      var cdMsg=document.getElementById('spin-cooldown-msg');
      if(cdMsg)cdMsg.textContent='Kal phir aao spin karne!';
    }
  }
  requestAnimationFrame(animate);
}

function showSpinResult(prize){
  var result=document.getElementById('spin-result');
  if(!result)return;
  result.style.display='block';
  var emoEl=document.getElementById('spin-prize-emoji');
  var nameEl=document.getElementById('spin-prize-name');
  var codeWrap=document.getElementById('spin-prize-code-wrap');
  var codeEl=document.getElementById('spin-prize-code');
  if(emoEl)emoEl.textContent=prize.emoji;
  if(nameEl)nameEl.textContent=prize.label;
  if(prize.code){
    if(codeWrap)codeWrap.style.display='block';
    if(codeEl)codeEl.textContent=prize.code;
    // Save coupon to user's wallet
    if(akFirebaseReady&&firebase.auth().currentUser){
      firebase.firestore().collection('spinWins').add({uid:firebase.auth().currentUser.uid,prize:prize.label,code:prize.code,date:new Date().toISOString()}).catch(function(){});
    }
    showToast('🎉 Jeet gaye! Code: '+prize.code,'green');
  } else {
    if(codeWrap)codeWrap.style.display='none';
    showToast('Baar phir try karo! Kal phir spin milega 😅','orange');
  }
}
function copySpinCode(){
  var code=document.getElementById('spin-prize-code');
  if(!code)return;
  navigator.clipboard.writeText(code.textContent).then(function(){showToast('Code copied! ✅','green');}).catch(function(){showToast('Code: '+code.textContent,'green');});
}

/* ------------------------------------------------
   INIT — Show spin FAB for logged-in users
   ------------------------------------------------ */
function initPartB(){
  // Show spin fab
  var fab=document.getElementById('spin-fab');
  if(currentUser&&fab)fab.style.display='block';
  // Update tier label
  updateTierLabel();
}

// Hook into existing login success — patch updateNavUser
var _origUpdateUserUI=updateNavUser;
updateNavUser=function(){
  _origUpdateUserUI();
  initPartB();
};

// Run on load if already logged in
setTimeout(function(){
  if(currentUser){initPartB();}
},1500);

/* ================================================================
   PART C — REVENUE FEATURES
   ================================================================ */

/* ------------------------------------------------
   1. MINIMUM ORDER + UPSELL POPUP
   ------------------------------------------------ */
function showUpsellBanner(subtotal){
  var need=MIN_ORDER-subtotal;
  // Remove old banner if exists
  var old=document.getElementById('upsell-banner');
  if(old)old.remove();

  var banner=document.createElement('div');
  banner.id='upsell-banner';
  banner.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:5000;width:calc(100% - 2rem);max-width:400px;background:linear-gradient(135deg,#FF6B00,#FF8C00);border-radius:16px;padding:14px 18px;box-shadow:0 8px 30px rgba(255,107,0,0.45);display:flex;align-items:center;justify-content:space-between;gap:10px;animation:slideUp 0.3s ease;';
  banner.innerHTML='<div style="color:#fff;">'
    +'<div style="font-weight:900;font-size:0.92rem;">🛒 ₹'+need+' aur karo!</div>'
    +'<div style="font-size:0.72rem;opacity:0.9;margin-top:2px;">Min order ₹'+MIN_ORDER+' · Free delivery at ₹399</div>'
    +'</div>'
    +'<button onclick="document.getElementById(\'upsell-banner\').remove();goTo(\'menu\');" style="background:rgba(255,255,255,0.25);border:none;color:#fff;padding:8px 14px;border-radius:10px;font-family:\'Nunito\',sans-serif;font-weight:800;font-size:0.78rem;cursor:pointer;white-space:nowrap;">+ Add Items</button>';
  document.body.appendChild(banner);
  setTimeout(function(){var b=document.getElementById('upsell-banner');if(b)b.remove();},5000);
}

function checkUpsell(subtotal){
  // Free delivery upsell — show if between 149 and 399
  if(subtotal>=MIN_ORDER && subtotal<399){
    var need=399-subtotal;
    showToast('₹'+need+' aur karo — FREE delivery milegi! 🛵','orange');
  }
}

/* ------------------------------------------------
   2. ABANDONED CART RECOVERY (WhatsApp)
   ------------------------------------------------ */
var abandonedCartTimer=null;

function resetAbandonedCartTimer(){
  if(abandonedCartTimer)clearTimeout(abandonedCartTimer);
  if(Object.keys(cart).length===0)return;
  if(!currentUser||!currentUser.phone)return;
  // 15 min baad fire
  abandonedCartTimer=setTimeout(function(){
    fireAbandonedCartMsg();
  }, 15*60*1000);
}

function fireAbandonedCartMsg(){
  if(Object.keys(cart).length===0)return;
  var items=Object.keys(cart).slice(0,3).join(', ');
  var total=Object.values(cart).reduce(function(s,i){return s+i.qty*i.price;},0);
  var msg='Namaste *'+(currentUser.name||'')+'* ji! 🙏\n\n'
    +'Aapne cart mein items chhod diye hain:\n🍽️ *'+items+'*'+(Object.keys(cart).length>3?' +aur...':'')+'\n\n'
    +'💰 Cart Total: *₹'+total+'*\n\n'
    +'Abhi order karo:\n👉 https://atharav-kitchen.pages.dev\n\n'
    +'Ya WhatsApp pe bolo: wa.me/917903567007\n\n'
    +'— Atharav Kitchen 🍽️';
  // Show reminder popup instead of auto-WA (can't auto-send)
  showAbandonedCartPopup(msg, total);
}

function showAbandonedCartPopup(msg, total){
  var old=document.getElementById('abandoned-popup');
  if(old)old.remove();
  var pop=document.createElement('div');
  pop.id='abandoned-popup';
  pop.style.cssText='position:fixed;inset:0;background:rgba(45,26,0,0.7);backdrop-filter:blur(6px);z-index:8000;display:flex;align-items:flex-end;justify-content:center;padding:1rem;';
  pop.innerHTML='<div style="max-width:420px;width:100%;background:#fff;border-radius:24px 24px 0 0;padding:1.5rem;box-shadow:0 -10px 40px rgba(45,26,0,0.2);animation:slideUp 0.3s ease;">'
    +'<div style="text-align:center;margin-bottom:1rem;">'
    +'<div style="font-size:2.5rem;">🛒</div>'
    +'<div style="font-family:\'Playfair Display\',serif;font-size:1.1rem;font-weight:700;color:#2D1A00;margin-top:6px;">Cart mein items hain!</div>'
    +'<div style="font-size:0.8rem;color:#A08060;margin-top:4px;">Aapke items wait kar rahe hain — ₹'+total+' ka order pending hai</div>'
    +'</div>'
    +'<button onclick="document.getElementById(\'abandoned-popup\').remove();openCartModal();" style="width:100%;padding:13px;background:linear-gradient(135deg,#FF6B00,#FF8C00);color:#fff;border:none;border-radius:12px;font-family:\'Nunito\',sans-serif;font-weight:900;font-size:0.9rem;cursor:pointer;margin-bottom:0.6rem;">🍽️ Complete My Order</button>'
    +'<button onclick="document.getElementById(\'abandoned-popup\').remove();" style="width:100%;padding:10px;background:#FFF8F0;color:#A08060;border:1.5px solid #F0D8C0;border-radius:12px;font-family:\'Nunito\',sans-serif;font-weight:700;font-size:0.82rem;cursor:pointer;">Baad mein karta hoon</button>'
    +'</div>';
  document.body.appendChild(pop);
}

// Hook into addCart/changeQty to reset timer
var _origAddCart=addCart;
addCart=function(name,price,ev){
  _origAddCart(name,price,ev);
  resetAbandonedCartTimer();
};

function showOrderStatusBar(order){
  var bar=document.getElementById('order-track-bar');
  if(!bar){
    bar=document.createElement('div');
    bar.id='order-track-bar';
    bar.style.cssText='position:fixed;top:70px;left:0;right:0;z-index:4500;background:#fff;border-bottom:2px solid #F0D8C0;padding:10px 16px;box-shadow:0 4px 20px rgba(45,26,0,0.1);';
    document.body.appendChild(bar);
  }
  var STEPS=['New','Confirmed','Preparing','Out for Delivery','Delivered'];
  var cur=STEPS.indexOf(order.status);
  var icons=['📝','✅','👨‍🍳','🛵','🎉'];
  bar.innerHTML='<div style="max-width:600px;margin:0 auto;">'
    +'<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
    +'<div style="font-weight:800;font-size:0.82rem;color:#2D1A00;">📦 Order #'+order.id+' Tracking</div>'
    +'<button onclick="document.getElementById(\'order-track-bar\').remove();" style="background:none;border:none;cursor:pointer;color:#A08060;font-size:1rem;">×</button>'
    +'</div>'
    +'<div style="display:flex;align-items:center;gap:0;">'
    +STEPS.map(function(s,i){
      var done=i<=cur;var active=i===cur;
      return '<div style="flex:1;text-align:center;">'
        +'<div style="font-size:'+(active?'1.3rem':'1rem')+';transition:all 0.3s;">'+icons[i]+'</div>'
        +'<div style="font-size:0.58rem;font-weight:'+(active?'900':'600')+';color:'+(active?'#FF6B00':done?'#16A34A':'#CCC')+';margin-top:2px;line-height:1.2;">'+s+'</div>'
        +(i<STEPS.length-1?'<div style="height:2px;background:'+(done?'#16A34A':'#F0D8C0')+';margin:4px -50%;position:relative;z-index:-1;"></div>':'')
        +'</div>';
    }).join('')
    +'</div></div>';
}

/* CSS for upsell animation */
var partCStyle=document.createElement('style');
partCStyle.textContent='@keyframes slideUp{from{transform:translateY(20px) translateX(-50%);opacity:0;}to{transform:translateY(0) translateX(-50%);opacity:1;}}';
document.head.appendChild(partCStyle);

/* ================================================
   ★ PROMO VIDEO BANNER — load from localStorage/Firebase
   ================================================ */
function loadPromoVideoBanner(){
  function applyPromo(pv){
    if(!pv||!pv.url||!pv.active)return;
    var section=document.getElementById('promo-video-section');
    var embed=document.getElementById('promo-video-embed');
    var header=document.getElementById('promo-video-header');
    var titleEl=document.getElementById('promo-video-title-el');
    var subEl=document.getElementById('promo-video-subtitle-el');
    if(!section||!embed)return;

    // Title/subtitle
    if(pv.title||pv.subtitle){
      header.style.display='block';
      if(titleEl&&pv.title)titleEl.textContent=pv.title;
      if(subEl&&pv.subtitle)subEl.textContent=pv.subtitle;
    }

    // Detect YouTube vs direct video
    var ytM=(pv.url||'').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if(ytM){
      var ytId=ytM[1];
      var muted=pv.muted!==false;
      embed.innerHTML='<iframe src="https://www.youtube.com/embed/'+ytId+'?autoplay=1&loop=1&playlist='+ytId+'&controls=1&rel=0'+(muted?'&mute=1':'')+'" style="position:absolute;inset:0;width:100%;height:100%;border:0;" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
    }else{
      var muted2=pv.muted!==false;
      embed.innerHTML='<video src="'+pv.url+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" controls autoplay'+(muted2?' muted':'')+'></video>';
    }
    section.style.display='block';
  }

  // Try Firebase first, fallback to localStorage
  var lsPv=null;
  try{lsPv=JSON.parse(localStorage.getItem('ak_promo_video'));}catch(e){}

  if(akFirebaseReady){
    firebase.firestore().collection('settings').doc('promo_video').get()
      .then(function(snap){
        if(snap.exists&&snap.data()&&snap.data().active){
          applyPromo(snap.data());
          // Cache locally
          try{localStorage.setItem('ak_promo_video',JSON.stringify(snap.data()));}catch(e){}
        }else if(lsPv&&lsPv.active){
          applyPromo(lsPv);
        }
      }).catch(function(){
        if(lsPv&&lsPv.active)applyPromo(lsPv);
      });
  }else if(lsPv&&lsPv.active){
    applyPromo(lsPv);
  }
}

// Load promo video after page ready
window.addEventListener('akFirebaseReady',function(){loadPromoVideoBanner();});
setTimeout(function(){if(!akFirebaseReady)loadPromoVideoBanner();},1500);
