/* ================================================
   ★ FIRESTORE SERVICE — single data-access layer
   ================================================
   Har Firestore read/write yahin se guzarna chahiye — app.js mein
   seedha firebase.firestore().collection(...) mat likhna.
   Naya feature jo Firestore ko touch kare, uska function yahan
   add karo — taaki firestore.rules ke saath field-mismatch
   (jaisa Bug #1, #3, #4 mein hua tha) dobara na ho.

   IMPORTANT: index.html mein isse app.js SE PEHLE load karo:
     <script src="firebase-config.js"></script>
     <script src="firestoreService.js"></script>
     <script src="app.js"></script>
   ================================================ */

/* ---------- ORDERS ---------- */

// Retries a Firestore order-save up to 3 times (short backoff). If it still
// fails (e.g. Anonymous sign-in disabled in Firebase Console), the order is
// queued in localStorage and auto-retried next time the site loads — so an
// order is never silently lost.
// orderObj.items MUST be a map ({name: {qty, price}}) — firestore.rules
// requires `items is map`. Do not change this to an array without also
// updating the rule.
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

/* ---------- CUSTOMERS ---------- */

// Patches a customer's Firestore doc after a successful order: appends the
// order to their history, updates lastOrder, and marks welcomeCodeUsed if
// this order used their welcome coupon.
// IMPORTANT: firestore.rules customers/{userId} `update` rule only allows
// affectedKeys ['name','address','email','dob','couponUsed','updatedAt',
// 'orders','lastOrder','welcomeCodeUsed'] — if you add a new field to the
// patch here, you MUST add it to that hasOnly() list too, or every write
// will be silently rejected (this is exactly what Bug #4 was).
function updateCustomerAfterOrder(uid,orderId,billTotal,dateStr,markWelcomeUsed){
  var ref=firebase.firestore().collection('customers').doc(uid);
  return ref.get().then(function(snap){
    var olist=(snap.exists&&snap.data().orders)?snap.data().orders:[];
    olist.push({id:orderId,total:billTotal,date:dateStr});
    var patch={orders:olist,lastOrder:dateStr};
    if(markWelcomeUsed)patch.welcomeCodeUsed=true;
    return ref.set(patch,{merge:true}).then(function(){return patch;});
  });
}

/* ---------- CUSTOMERS (continued) ---------- */

// Creates a new customer doc. Used identically across all 4 signup flows
// (phone-OTP register, phone-OTP first-login, Google login, Facebook
// login) — previously each flow had its own copy of this exact call.
function createCustomerDoc(uid,customerObj){
  return firebase.firestore().collection('customers').doc(uid).set(customerObj)
    .then(function(){return customerObj;});
}

// Reads a customer's Firestore doc once (used by loadCustomerProfile()).
function getCustomerDoc(uid){
  return firebase.firestore().collection('customers').doc(uid).get();
}

// Direct welcomeCodeUsed flip (used when applying the welcome coupon at
// checkout, separate from the post-order patch in updateCustomerAfterOrder).
// Must stay inside the customers/{userId} update rule's hasOnly() allow-list.
function markWelcomeCodeUsedDirect(uid){
  return firebase.firestore().collection('customers').doc(uid).update({welcomeCodeUsed:true});
}

// Saves a customer's referral code onto their own doc.
function saveReferralCode(uid,code){
  return firebase.firestore().collection('customers').doc(uid).set({referralCode:code},{merge:true});
}

/* ---------- REFERRALS ---------- */

function getReferralStats(uid){
  return firebase.firestore().collection('referral_stats').doc(uid).get();
}

function addReferralClaim(claimObj){
  return firebase.firestore().collection('referral_claims').add(claimObj);
}

/* ---------- WALLET ---------- */

function saveWalletDoc(uid,walletObj){
  return firebase.firestore().collection('wallets').doc(uid).set(walletObj,{merge:true});
}

function getWalletDoc(uid){
  return firebase.firestore().collection('wallets').doc(uid).get();
}

/* ---------- ORDERS (continued) ---------- */

function updateOrderFcmToken(orderId,token){
  return firebase.firestore().collection('orders').doc(String(orderId)).update({fcmToken:token});
}

function getOrderOnce(orderId){
  return firebase.firestore().collection('orders').doc(String(orderId)).get();
}

/* ---------- MISC ---------- */

function saveContact(contactEntry){
  return firebase.firestore().collection('contacts').doc(String(contactEntry.id)).set(contactEntry);
}

function logSpinWin(winObj){
  return firebase.firestore().collection('spinWins').add(winObj);
}

/* ---------- ANNOUNCEMENTS (banners + topbar) ---------- */

// Admin's "Announcements & Banners" panel previously only wrote to its own
// browser's localStorage — customers never saw any of it. This syncs it
// through settings/announcements (same pattern as kitchen_gallery/promo_video).
function saveAnnouncements(data){
  return firebase.firestore().collection('settings').doc('announcements').set(data,{merge:true});
}

function subscribeAnnouncements(onNext,onError){
  return firebase.firestore().collection('settings').doc('announcements').onSnapshot(onNext,onError);
}

/* ---------- HERO CONTENT (headline, tagline, description) ---------- */

// Admin's "Hero Section Text" fields (headline lines, tagline, description)
// previously only wrote to the admin's own browser localStorage — customers
// never saw any of it. This syncs it through settings/hero, same pattern as
// settings/announcements above.
function saveHeroContent(data){
  return firebase.firestore().collection('settings').doc('hero').set(data,{merge:true});
}

function subscribeHeroContent(onNext,onError){
  return firebase.firestore().collection('settings').doc('hero').onSnapshot(onNext,onError);
}

/* ---------- LIVE LISTENERS ---------- */

// Kitchen open/close status — real-time listener.
function subscribeKitchenStatus(onNext,onError){
  return firebase.firestore().collection('settings').doc('store').onSnapshot(onNext,onError);
}

// Live menu sync — real-time listener.
function subscribeMenu(onNext,onError){
  return firebase.firestore().collection('menu').onSnapshot(onNext,onError);
}

// Single order's live status — used by the tracking modal.
function subscribeOrder(orderId,onNext,onError){
  return firebase.firestore().collection('orders').doc(orderId).onSnapshot(onNext,onError);
}

/* ---------- SETTINGS / CONTENT ---------- */

function queryRecentFeedback(limitCount){
  return firebase.firestore().collection('feedback').orderBy('createdAt','desc').limit(limitCount||20).get();
}

function getKitchenGallerySettings(){
  return firebase.firestore().collection('settings').doc('kitchen_gallery').get();
}

function getPromoVideoSettings(){
  return firebase.firestore().collection('settings').doc('promo_video').get();
}

/* ---------- FEEDBACK ---------- */


// Single entry point for every feedback write (detailed form, quick tap,
// auto-rating prompt). firestore.rules requires keys ['name','rating',
// 'createdAt'] AND `comment is string` to be present on every write — this
// function guarantees all four are always set, so a new feedback feature
// can't accidentally ship without them again (that was Bug #3).
function saveFeedback(fbObj){
  var fb={
    id:fbObj.id||Date.now(),
    name:fbObj.name||'Guest',
    rating:fbObj.rating,
    comment:fbObj.comment||'',
    createdAt:fbObj.createdAt||new Date().toISOString(),
    date:fbObj.date||new Date().toISOString(),
    customerId:fbObj.customerId||'guest'
  };
  // carry through any extra fields the caller passed (quick, orderId, food,
  // delivery, value, platform, autoPrompt) without overwriting the required ones above.
  Object.keys(fbObj).forEach(function(k){if(!(k in fb))fb[k]=fbObj[k];});
  if(!akFirebaseReady)return Promise.resolve(fb);
  return firebase.firestore().collection('feedback').doc(String(fb.id)).set(fb)
    .then(function(){return fb;})
    .catch(function(e){console.warn('[Atharav Kitchen] Feedback save failed:',e.code||e.message);return fb;});
}
