/* GMAPS_KEY: GPS se address detect karne ke liye (geocoding).
   SECURITY: Google Cloud Console mein HTTP referrer restriction lagao:
   atharavkitchen.netlify.app/* ONLY allow karo
   Netlify: Site Settings → Environment Variables → GMAPS_KEY */
var GMAPS_KEY='AIzaSyD7Vb4zFHfzsI79BbHjZTIi0s8Asxte6rI';

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
function toggleMob(){document.getElementById('mob-menu').classList.toggle('open');}
function closeMob(){document.getElementById('mob-menu').classList.remove('open');}

// ---- HELPERS ----
function lsGet(k,def){try{var v=JSON.parse(localStorage.getItem(k));return v!=null?v:def;}catch{return def;}}
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function showToast(msg,cls){var t=document.getElementById('toast');t.textContent=msg;t.className=cls||'';t.classList.add('show');setTimeout(function(){t.classList.remove('show');},3200);}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

/* ---- Firebase (keys: firebase-config.js) ---- */
var firebaseConfig=window.FIREBASE_CONFIG||{};
var akFirebaseReady=false;

// FIX: Sync with firebase-config.js akFirebaseReady event
window.addEventListener('akFirebaseReady',function(){
  if(!akFirebaseReady){
    akFirebaseReady=true;
    tryInitFirebase();
    try{checkAuthOnLoad();}catch(e){}
  }
});

var SHOP_LAT=23.7957,SHOP_LNG=86.4304,MAX_DELIVERY_KM=5;
var withinDeliveryRadius=false,deliveryRadiusChecked=false;

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
  if(!navigator.geolocation){
    deliveryRadiusChecked=true;withinDeliveryRadius=false;
    showToast('Location not available on this device.','red');
    updateCheckoutLockUI();
    return;
  }
  navigator.geolocation.getCurrentPosition(function(pos){
    applyDeliveryDistanceFromCoords(pos.coords.latitude,pos.coords.longitude);
  },function(){
    deliveryRadiusChecked=true;withinDeliveryRadius=false;
    showToast('Please allow location access so we can verify you are within 5km of our kitchen in Dhanbad.','red');
    updateCheckoutLockUI();
  },{enableHighAccuracy:true,timeout:15000,maximumAge:60000});
}

function firebaseUser(){return akFirebaseReady&&firebase.auth().currentUser;}
function customerLoggedIn(){
  if(akFirebaseReady&&firebase&&firebase.auth&&firebase.auth().currentUser)return true;
  if(!akFirebaseReady&&currentUser&&currentUser.phone)return true;
  return false;
}

function updateCheckoutLockUI(){
  var logged=customerLoggedIn();
  var guestMsg=document.getElementById('cart-guest-msg');
  var cartBtn=document.getElementById('cartbar-order-btn');
  var placeBtn=document.getElementById('place-order-btn');
  var banner=document.getElementById('order-lock-banner');
  if(guestMsg){
    guestMsg.style.display=logged?'none':'flex';
  }
  if(cartBtn){
    cartBtn.style.display=logged?'inline-block':'none';
    cartBtn.disabled=false;
    cartBtn.classList.remove('disabled');
  }
  if(!logged){
    if(placeBtn){placeBtn.disabled=true;placeBtn.style.opacity='0.45';placeBtn.style.cursor='not-allowed';}
    if(banner){banner.textContent='Please Login to Order';banner.classList.add('show');}
    return;
  }
  if(!deliveryRadiusChecked){
    if(placeBtn){placeBtn.disabled=true;placeBtn.style.opacity='0.6';placeBtn.style.cursor='wait';}
    if(banner){banner.textContent='Checking delivery range (5km from Dhanbad)...';banner.classList.add('show');}
    return;
  }
  if(!withinDeliveryRadius){
    if(placeBtn){placeBtn.disabled=true;placeBtn.style.opacity='0.45';placeBtn.style.cursor='not-allowed';}
    if(banner){banner.textContent='Sorry — we only deliver within 5km of our kitchen. Ordering is disabled.';banner.classList.add('show');}
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
  });
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
    if(_regRecaptcha){try{_regRecaptcha.clear();}catch(e){}_regRecaptcha=null;}
    _regRecaptcha=new firebase.auth.RecaptchaVerifier('recaptcha-reg',{'size':'invisible','callback':function(){}});
    firebase.auth().signInWithPhoneNumber('+91'+phone,_regRecaptcha)
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
        var msg='OTP bhejne mein error. ';
        if(e.code==='auth/invalid-phone-number')msg='Phone number galat hai.';
        else if(e.code==='auth/too-many-requests')msg='Bahut zyada attempts. Kuch der baad try karo.';
        else if(e.code==='auth/quota-exceeded')msg='SMS limit khatam. WhatsApp se order karo.';
        showToast(msg,'red');
      });
  }catch(e){
    btn.disabled=false;btn.textContent='📱 Send OTP to My Number';
    showToast('OTP start nahi hua. Internet check karo.','red');
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
  var phone=document.getElementById('login-phone').value.replace(/\D/g,'').trim();
  document.getElementById('login-phone').classList.remove('err');
  document.getElementById('err-login-phone').classList.remove('show');

  if(!phone||phone.length!==10){
    document.getElementById('login-phone').classList.add('err');
    document.getElementById('err-login-phone').classList.add('show');
    return;
  }

  if(!akFirebaseReady){showToast('Firebase connected nahi hai.','red');return;}

  var btn=document.getElementById('login-send-otp-btn');
  btn.disabled=true;btn.textContent='⏳ Sending OTP...';

  try{
    if(_loginRecaptcha){try{_loginRecaptcha.clear();}catch(e){}_loginRecaptcha=null;}
    _loginRecaptcha=new firebase.auth.RecaptchaVerifier('recaptcha-login',{'size':'invisible','callback':function(){}});
    firebase.auth().signInWithPhoneNumber('+91'+phone,_loginRecaptcha)
      .then(function(confirmation){
        _loginConfirmation=confirmation;
        document.getElementById('login-step-1').style.display='none';
        document.getElementById('login-step-2').style.display='block';
        document.getElementById('login-otp-sent-to').textContent='OTP sent to +91 '+phone;
        _otpTimerLogin=startOTPCountdown('login-otp-timer');
        showToast('OTP sent to +91'+phone+'! 📱','green');
        btn.disabled=false;btn.textContent='📱 Send OTP';
      })
      .catch(function(e){
        btn.disabled=false;btn.textContent='📱 Send OTP';
        if(_loginRecaptcha){try{_loginRecaptcha.clear();}catch(ex){}_loginRecaptcha=null;}
        var msg='OTP bhejne mein error.';
        if(e.code==='auth/invalid-phone-number')msg='Phone number galat hai.';
        else if(e.code==='auth/too-many-requests')msg='Bahut zyada attempts. Kuch der baad try karo.';
        showToast(msg,'red');
      });
  }catch(e){
    btn.disabled=false;btn.textContent='📱 Send OTP';
    showToast('OTP start nahi hua. Internet check karo.','red');
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
function loginWithGoogle(){
  if(!akFirebaseReady){showToast('Firebase connected nahi hai.','red');return;}
  var provider=new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({'prompt':'select_account'});
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
            loginMethod:'google',
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
      showToast('Welcome '+(currentUser.name||'')+'! Google se login hua ✅','green');
      checkUserDeliveryRadius();
      scheduleOfferPopups();
      initNewFeatures();
      if(document.getElementById('fb-name'))document.getElementById('fb-name').value=currentUser.name||'';
      if(document.getElementById('ord-name'))document.getElementById('ord-name').value=currentUser.name||'';
    })
    .catch(function(e){
      if(e.code==='auth/popup-closed-by-user')return;
      showToast('Google login failed: '+(e.message||'Try again'),'red');
    });
}

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
   ★ MENU SYSTEM
   ================================================ */
function getMenu(){
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
function renderMenu(){
  var items=getMenu();
  var cats=['All',...new Set(items.map(function(i){return i.cat;}))];
  document.getElementById('menu-pills').innerHTML=cats.map(function(c){
    return '<button class="pill'+(c===currentCat?' active':'')+'\" onclick="filterCat(\''+c+'\')">'+c+'</button>';
  }).join('');
  var items2=items.filter(function(i){return i.available!==false;});
  var filtered=currentCat==='All'?items2:items2.filter(function(i){return i.cat===currentCat;});
  var grid=document.getElementById('menu-grid');
  if(!filtered.length){grid.innerHTML='<div class="empty-cat">No items yet. Check back soon!</div>';return;}
  grid.innerHTML=filtered.map(function(item){
    var imgSrc=item.imgUrl||item.imgData||'';
    var imgHtml=imgSrc?'<img src="'+imgSrc+'" alt="'+esc(item.name)+'" loading="lazy" onerror="this.style.display=\'none\'">'+'<div class="mc-img-overlay"></div>':'<div style="font-size:3.2rem;height:100%;display:flex;align-items:center;justify-content:center;">'+item.emoji+'</div>';
    var inCart=cart[item.name]?cart[item.name].qty:0;
    var btnHtml=inCart>0?
      '<div style="display:flex;align-items:center;gap:6px;background:#FF6B00;border-radius:8px;padding:4px 8px;">'+
      '<button onclick="changeQty(\''+item.name.replace(/'/g,"\\'")+'\',' +item.price+',-1,event)" style="background:transparent;border:none;color:#fff;font-size:1rem;cursor:pointer;font-weight:800;line-height:1;padding:0 2px;">−</button>'+
      '<span style="color:#fff;font-weight:800;font-size:0.9rem;min-width:16px;text-align:center;">'+inCart+'</span>'+
      '<button onclick="changeQty(\''+item.name.replace(/'/g,"\\'")+'\',' +item.price+',1,event)" style="background:transparent;border:none;color:#fff;font-size:1rem;cursor:pointer;font-weight:800;line-height:1;padding:0 2px;">+</button>'+
      '</div>':
      '<button class="mc-add" onclick="addCart(\''+item.name.replace(/'/g,"\\'")+'\',' +item.price+',event)">+ Add</button>';
    return '<div class="mc"><div class="mc-top">'+imgHtml+'<div class="vi '+(item.veg?'v':'nv')+'"></div></div>'+
      '<div class="mc-body"><h3>'+esc(item.name)+'</h3><p>'+esc(item.desc)+'</p>'+
      '<div class="mc-foot"><span class="mc-price">₹'+item.price+'</span>'+btnHtml+'</div></div></div>';
  }).join('');
}
function filterCat(cat){currentCat=cat;renderMenu();}

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
};

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
function openCartModal(){
  if(Object.keys(cart).length===0){showToast('Cart is empty! Add items first.','red');return;}
  if(!customerLoggedIn()){showToast('Please Login to Order','red');showScreen('login');return;}
  if(!deliveryRadiusChecked)checkUserDeliveryRadius();
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
  if(n===4){
    if(!customerLoggedIn()){showToast('Please Login to Order','red');return;}
    if(!deliveryRadiusChecked){showToast('Verifying your distance from our kitchen…','orange');checkUserDeliveryRadius();return;}
    if(!withinDeliveryRadius){showToast('Sorry — sirf 5km delivery range hai Dhanbad mein. 😔','red');return;}
    var name=(document.getElementById('ord-name').value||'').trim();
    var phone=(document.getElementById('ord-phone').value||'').trim();
    var addr=(document.getElementById('ord-address').value||'').trim();
    if(!name||!phone||!addr){showToast('Please fill Name, Phone & Address!','red');return;}
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
  if(!c){res.style.display='block';res.style.background='#FEE2E2';res.style.color='#DC2626';res.style.border='1px solid #FECACA';res.textContent='❌ Invalid code. Try: WELCOME20, FREEDEL, WA50, WEEKEND';appliedCoupon=null;}
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
   ★ PLACE ORDER (syncs customer to admin)
   ================================================ */
function placeOrder(){
  if(!customerLoggedIn()){showToast('Please Login to Order','red');return;}
  if(!deliveryRadiusChecked||!withinDeliveryRadius){showToast('Sorry — delivery check pending ya range se bahar. 📍','red');return;}
  var name=(document.getElementById('ord-name').value||'').trim();
  var phone=(document.getElementById('ord-phone').value||'').trim();
  var addr=(document.getElementById('ord-address').value||'').trim();
  var note=(document.getElementById('ord-note').value||'').trim();
  if(!name||!phone||!addr){showToast('Fill all required fields!','red');goStep(3);return;}

  // Input validation & sanitization
  if(name.length>100){showToast('Name too long!','red');return;}
  if(addr.length>500){showToast('Address too long!','red');return;}
  if(note.length>200){showToast('Note too long (max 200 chars)','red');return;}
  var cleanPhone=phone.replace(/\D/g,'');
  if(cleanPhone.length<10){showToast('Enter valid 10-digit phone number!','red');return;}
  // Prevent HTML injection in order data
  name=name.replace(/[<>'"]/g,'');
  addr=addr.replace(/[<>'"]/g,'');
  note=note.replace(/[<>'"]/g,'');
  var payMethod=document.querySelector('input[name="pay-method"]:checked');
  var pay=payMethod?payMethod.value:'cod';
  var bill=calcBill();
  var now=new Date().toLocaleString('en-IN');
  var orderId='AK'+Date.now().toString().slice(-6);
  var uid=(akFirebaseReady&&firebase.auth().currentUser)?firebase.auth().currentUser.uid:null;
  var localCustId=currentUser?currentUser.id:null;

  // WA message to owner
  var msg='🍽️ *NEW ORDER — ATHARAV KITCHEN*\n';
  msg+='━━━━━━━━━━━━━━━━━━\n';
  msg+='🆔 Order ID: *'+orderId+'*\n';
  msg+='👤 Name: *'+name+'*\n';
  msg+='📞 Phone: *'+phone+'*\n';
  msg+='📍 Address: *'+addr+'*\n';
  if(note)msg+='📝 Note: '+note+'\n';
  if(uid||localCustId)msg+='⭐ Registered Customer: YES\n';
  if(appliedCoupon)msg+='🏷️ Coupon Used: *'+appliedCoupon+'*\n';
  msg+='\n📋 *ORDER ITEMS:*\n';
  Object.entries(cart).forEach(function(e){msg+='• '+e[0]+' × '+e[1].qty+' = ₹'+(e[1].qty*e[1].price)+'\n';});
  msg+='\n💰 *BILL:*\nSubtotal: ₹'+bill.subtotal+'\n';
  if(bill.discount>0)msg+='Discount ('+appliedCoupon+'): -₹'+bill.discount+'\n';
  msg+='Delivery: '+(bill.delivery===0?'FREE':'₹'+bill.delivery)+'\n';
  msg+='GST (5%): ₹'+bill.gst+'\n';
  msg+='*GRAND TOTAL: ₹'+bill.total+'*\n';
  msg+='Payment: '+(pay==='cod'?'Cash on Delivery':'UPI/Online')+'\n';
  msg+='\n⏰ '+now;
  window.open('https://wa.me/917903567007?text='+encodeURIComponent(msg),'_blank');

  var orderObj={
    id:orderId,name:name,phone:phone,address:addr,note:note,
    items:JSON.parse(JSON.stringify(cart)),bill:bill,coupon:appliedCoupon||null,
    payment:pay,status:'New',time:now,platform:'WhatsApp',
    customerId:uid||localCustId,createdAtMs:Date.now()
  };

  function afterSaved(){
    var orders=lsGet('ak_orders',[]);
    orders.push(orderObj);
    lsSet('ak_orders',orders);
    if(currentUser&&uid&&akFirebaseReady){
      var ref=firebase.firestore().collection('customers').doc(uid);
      ref.get().then(function(snap){
        var olist=(snap.exists&&snap.data().orders)?snap.data().orders:[];
        olist.push({id:orderId,total:bill.total,date:now});
        var patch={orders:olist,lastOrder:now};
        if(appliedCoupon&&currentUser.welcomeCode===appliedCoupon)patch.welcomeCodeUsed=true;
        ref.set(patch,{merge:true}).then(function(){
          if(patch.welcomeCodeUsed)currentUser.welcomeCodeUsed=true;
        });
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
    var summaryHtml='<div class="success-row"><span>🆔</span><strong>Order ID: '+orderId+'</strong></div>';
    summaryHtml+='<div class="success-row" style="flex-wrap:wrap;">'+Object.entries(cart).map(function(e){return '<span style="background:#FFF0E0;padding:2px 8px;border-radius:6px;margin:2px;font-size:0.78rem;font-weight:700;">'+esc(e[0])+' ×'+e[1].qty+'</span>';}).join('')+'</div>';
    summaryHtml+='<hr class="success-divider">';
    if(bill.discount>0)summaryHtml+='<div class="success-row" style="color:#16A34A;">🏷️ <span>Coupon Saved: -₹'+bill.discount+'</span></div>';
    summaryHtml+='<div class="success-row">💰 <span>Total: <strong>₹'+bill.total+'</strong></span></div>';
    summaryHtml+='<div class="success-row">📞 <span>We\'ll confirm on <strong>'+phone+'</strong></span></div>';
    document.getElementById('success-summary').innerHTML=summaryHtml;
    document.getElementById('order-success').style.display='flex';
    showOwnerNotification(orderObj);
    closeCartModal();
    cart={};appliedCoupon=null;currentStep=1;
    updateCartBar();renderMenu();
  }

  if(akFirebaseReady){
    firebase.firestore().collection('orders').doc(orderId).set(orderObj).then(afterSaved).catch(function(e){
      showToast('Could not save order: '+(e&&e.message),'red');
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
    fetch('https://maps.googleapis.com/maps/api/geocode/json?latlng='+lat+','+lng+'&key='+GMAPS_KEY+'&language=en')
      .then(function(r){return r.json();}).then(function(data){
        if(data.status==='OK'&&data.results.length){
          addrEl.value=data.results[0].formatted_address;addrEl.style.borderColor='#22C55E';
          status.textContent='✅ Location detected! Add flat/house number if needed.';status.style.color='#16A34A';
          btnText.textContent='✅ Location Detected';btn.style.background='linear-gradient(135deg,#16A34A,#22C55E)';
          showToast('📍 Location auto-filled!','green');
        }else{addrEl.value='Lat:'+lat.toFixed(5)+', Lng:'+lng.toFixed(5)+', Dhanbad, JH';}
        btn.disabled=false;btn.style.opacity='1';
      }).catch(function(){btn.disabled=false;btn.style.opacity='1';});
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
  if(akFirebaseReady&&firebase.auth().currentUser){
    // Firebase se milega — async load hoga
    return lsGet('ak_wallet_'+firebase.auth().currentUser.uid,{points:0,history:[]});
  }
  if(currentUser&&currentUser.phone)return lsGet('ak_wallet_'+currentUser.phone,{points:0,history:[]});
  return {points:0,history:[]};
}
function saveWallet(w){
  if(akFirebaseReady&&firebase.auth().currentUser){
    lsSet('ak_wallet_'+firebase.auth().currentUser.uid,w);
    // Firebase mein bhi save — wallet sirf server write, lekin localStorage se bhi cache
    firebase.firestore().collection('wallets').doc(firebase.auth().currentUser.uid).set(w,{merge:true}).catch(function(){});
    return;
  }
  if(currentUser&&currentUser.phone)lsSet('ak_wallet_'+currentUser.phone,w);
}
function loadWalletFromFirebase(){
  if(!akFirebaseReady||!firebase.auth().currentUser)return;
  var uid=firebase.auth().currentUser.uid;
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
  var dob=new Date(currentUser.dob);
  var now=new Date();
  return dob.getDate()===now.getDate()&&dob.getMonth()===now.getMonth();
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
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #F5EDE5;font-size:0.82rem;">'
      +'<div><div style="font-weight:800;color:#2D1A00;">#'+(o.id||o.orderId)+'</div>'
      +'<div style="color:#A08060;font-size:0.75rem;">'+(o.date||o.time||'')+'</div></div>'
      +'<div style="font-weight:900;color:#FF6B00;">₹'+(o.total||(o.bill&&o.bill.total)||'—')+'</div>'
      +'</div>';
  }).join('');
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
function quickFeedback(val){
  if(!currentUser){closeFeedbackPopup();return;}
  var fb={id:Date.now(),customerId:currentUser.id||currentUser.phone,quick:val,date:new Date().toISOString()};
  if(akFirebaseReady){firebase.firestore().collection('feedback').doc(String(fb.id)).set(fb).catch(function(){});}
  closeFeedbackPopup();
  if(val>=4)showToast('Thanks for the love! ❤️','green');
  else showToast('Thanks! We\'ll improve 🙏','orange');
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
   ★ PATCH: placeOrder — award points + WA bill + GA4
   ================================================ */
var _origPlaceOrder=placeOrder;
placeOrder=function(){
  if(!customerLoggedIn()){showToast('Please Login to Order','red');return;}
  if(!deliveryRadiusChecked||!withinDeliveryRadius){showToast('Sorry — delivery check pending ya range se bahar. 📍','red');return;}
  var name=(document.getElementById('ord-name').value||'').trim();
  var phone=(document.getElementById('ord-phone').value||'').trim();
  var addr=(document.getElementById('ord-address').value||'').trim();
  var note=(document.getElementById('ord-note').value||'').trim();
  if(!name||!phone||!addr){showToast('Fill all required fields!','red');goStep(3);return;}
  if(name.length>100){showToast('Name too long!','red');return;}
  if(addr.length>500){showToast('Address too long!','red');return;}
  if(note.length>200){showToast('Note too long (max 200 chars)','red');return;}
  var cleanPhone=phone.replace(/\D/g,'');
  if(cleanPhone.length<10){showToast('Enter valid 10-digit phone number!','red');return;}
  name=name.replace(/[<>'"]/g,'');addr=addr.replace(/[<>'"]/g,'');note=note.replace(/[<>'"]/g,'');
  var payMethod=document.querySelector('input[name="pay-method"]:checked');
  var pay=payMethod?payMethod.value:'cod';
  var bill=calcBill();
  var now=new Date().toLocaleString('en-IN');
  var orderId='AK'+Date.now().toString().slice(-6);
  var uid=(akFirebaseReady&&firebase.auth().currentUser)?firebase.auth().currentUser.uid:null;
  var localCustId=currentUser?currentUser.id:null;

  var msg='🍽️ *NEW ORDER — ATHARAV KITCHEN*\n';
  msg+='━━━━━━━━━━━━━━━━━━\n';
  msg+='🆔 Order ID: *'+orderId+'*\n';
  msg+='👤 Name: *'+name+'*\n';
  msg+='📞 Phone: *'+phone+'*\n';
  msg+='📍 Address: *'+addr+'*\n';
  if(note)msg+='📝 Note: '+note+'\n';
  if(uid||localCustId)msg+='⭐ Registered Customer: YES\n';
  if(appliedCoupon)msg+='🏷️ Coupon Used: *'+appliedCoupon+'*\n';
  if(walletApplied)msg+='💰 Wallet Used: -₹'+bill.walletDiscount+'\n';
  msg+='\n📋 *ORDER ITEMS:*\n';
  Object.entries(cart).forEach(function(e){msg+='• '+e[0]+' × '+e[1].qty+' = ₹'+(e[1].qty*e[1].price)+'\n';});
  msg+='\n💰 *BILL:*\nSubtotal: ₹'+bill.subtotal+'\n';
  if(bill.discount>0)msg+='Discount ('+appliedCoupon+'): -₹'+bill.discount+'\n';
  if(bill.walletDiscount>0)msg+='Wallet Discount: -₹'+bill.walletDiscount+'\n';
  msg+='Delivery: '+(bill.delivery===0?'FREE':'₹'+bill.delivery)+'\n';
  msg+='GST (5%): ₹'+bill.gst+'\n';
  msg+='*GRAND TOTAL: ₹'+bill.total+'*\n';
  msg+='Payment: '+(pay==='cod'?'Cash on Delivery':'UPI/Online')+'\n';
  msg+='\n⏰ '+now;
  window.open('https://wa.me/917903567007?text='+encodeURIComponent(msg),'_blank');

  var orderObj={
    id:orderId,name:name,phone:phone,address:addr,note:note,
    items:JSON.parse(JSON.stringify(cart)),bill:bill,coupon:appliedCoupon||null,
    payment:pay,status:'New',time:now,platform:'WhatsApp',
    customerId:uid||localCustId,createdAtMs:Date.now()
  };

  // GA4: order placed
  ga4Event('purchase',{transaction_id:orderId,value:bill.total,currency:'INR'});

  // Deduct wallet points if used
  var walletDisc=bill.walletDiscount||0;

  function afterSaved(){
    var orders=lsGet('ak_orders',[]);
    orders.push(orderObj);
    lsSet('ak_orders',orders);
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

    // Award points
    awardPoints(orderObj);
    // Deduct wallet points
    if(walletDisc>0)deductWalletPoints(walletDisc);
    // Send WhatsApp bill to customer
    setTimeout(function(){sendWhatsAppBill(orderObj);},2000);

    var summaryHtml='<div class="success-row"><span>🆔</span><strong>Order ID: '+orderId+'</strong></div>';
    summaryHtml+='<div class="success-row" style="flex-wrap:wrap;">'+Object.entries(cart).map(function(e){return '<span style="background:#FFF0E0;padding:2px 8px;border-radius:6px;margin:2px;font-size:0.78rem;font-weight:700;">'+esc(e[0])+' ×'+e[1].qty+'</span>';}).join('')+'</div>';
    summaryHtml+='<hr class="success-divider">';
    if(bill.discount>0)summaryHtml+='<div class="success-row" style="color:#16A34A;">🏷️ <span>Coupon Saved: -₹'+bill.discount+'</span></div>';
    if(walletDisc>0)summaryHtml+='<div class="success-row" style="color:#7C3AED;">💰 <span>Wallet Saved: -₹'+walletDisc+'</span></div>';
    summaryHtml+='<div class="success-row">💰 <span>Total: <strong>₹'+bill.total+'</strong></span></div>';
    summaryHtml+='<div class="success-row">📞 <span>We\'ll confirm on <strong>'+phone+'</strong></span></div>';
    document.getElementById('success-summary').innerHTML=summaryHtml;
    document.getElementById('order-success').style.display='flex';
    showOwnerNotification(orderObj);
    closeCartModal();
    cart={};appliedCoupon=null;walletApplied=false;currentStep=1;
    updateCartBar();renderMenu();updateWalletUI();
  }

  if(akFirebaseReady){
    firebase.firestore().collection('orders').doc(orderId).set(orderObj).then(afterSaved).catch(function(e){showToast('Could not save order: '+(e&&e.message),'red');});
  }else{
    afterSaved();
  }
};

/* ================================================
   ★ PATCH: openCartModal — GA4 tracking
   ================================================ */
var _origOpenCartModal=openCartModal;
openCartModal=function(){
  if(Object.keys(cart).length===0){showToast('Cart is empty! Add items first.','red');return;}
  if(!customerLoggedIn()){showToast('Please Login to Order','red');showScreen('login');return;}
  if(!deliveryRadiusChecked)checkUserDeliveryRadius();
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
renderMenu();
renderOffers();
checkAuthOnLoad();
checkUserDeliveryRadius();
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
window.addEventListener('load',function(){setTimeout(loadPublicReviews,2000);});
