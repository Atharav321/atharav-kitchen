/* ============================================================
   ATHARAV KITCHEN — CUSTOMER APP — loyalty.js
   Referral program, loyalty tiers, saved-address book, wishlist
   Extracted from legacy app.js (lines 2825-3160) — v14 -> v15 modular split
   Load order matters: this file assumes files loaded before it in
   index.html (see js/customer/*.js <script> order) are already parsed.
   ============================================================ */
function getReferralCode() {
  if (!currentUser) return null;
  if (currentUser.referralCode) return currentUser.referralCode;
  var key = 'ak_ref_' + (currentUser.phone || currentUser.id);
  var code = lsGet(key, null);
  if (!code) {
    code = genReferralCode(currentUser.phone || currentUser.id);
    lsSet(key, code);
    // Legacy account without a cloud referralCode yet — save it to their
    // profile too, so it works across their other devices from now on.
    if (realFirebaseUser()) {
      saveReferralCode(realFirebaseUser().uid, code).catch(function () {});
      currentUser.referralCode = code;
    }
  }
  return code;
}

function openReferralModal() {
  if (!currentUser) {
    showToast('Pehle login karo!', 'red');
    openAuthOrProfile();
    return;
  }
  var modal = document.getElementById('referral-modal');
  if (!modal) return;
  var code = getReferralCode();
  var codeEl = document.getElementById('ref-code-display');
  if (codeEl) codeEl.textContent = code || '—';
  // Show cached stats instantly, then refresh from cloud if possible
  var statsKey = 'ak_ref_stats_' + (currentUser.phone || currentUser.id);
  var stats = lsGet(statsKey, { count: 0, earned: 0 });
  var earnEl = document.getElementById('ref-earned-display');
  var cntEl = document.getElementById('ref-count-display');
  if (earnEl) earnEl.textContent = '₹' + stats.earned;
  if (cntEl) cntEl.textContent = stats.count;
  modal.style.display = 'flex';
  var ru = realFirebaseUser();
  if (ru && akFirebaseReady) {
    getReferralStats(ru.uid)
      .then(function (snap) {
        if (!snap.exists) return;
        var cloud = snap.data();
        lsSet(statsKey, cloud);
        if (earnEl) earnEl.textContent = '₹' + (cloud.earned || 0);
        if (cntEl) cntEl.textContent = cloud.count || 0;
      })
      .catch(function () {});
  }
}
function closeReferralModal() {
  var m = document.getElementById('referral-modal');
  if (m) m.style.display = 'none';
}
function copyReferralCode() {
  var code = getReferralCode();
  if (!code) return;
  navigator.clipboard
    .writeText(code)
    .then(function () {
      showToast('Code copied! ✅', 'green');
    })
    .catch(function () {
      showToast('Code: ' + code, 'green');
    });
}
function shareReferralCode() {
  var code = getReferralCode();
  if (!code) return;
  var msg =
    '🍽️ *Atharav Kitchen — Best Cloud Kitchen in Dhanbad!*\n\nMere saath order karo aur dono ko Rs.50 milega!\n\n🎟️ Mera Referral Code: *' +
    code +
    '*\n\nRegister karo: https://atharav-kitchen.pages.dev\n\n💬 Ya seedha order karo: wa.me/917903567007';
  window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
}
// Apply referral on registration — check if referral code entered.
// SECURE DESIGN: naya customer sirf apna "maine yeh code use kiya" claim
// Firestore mein create karta hai (apna hi record — rules isko allow
// karte hain). Referrer ka wallet credit karna admin panel karta hai jab
// woh open hota hai (already-trusted admin access se) — isse koi customer
// kisi doosre ke wallet mein directly points inject nahi kar sakta.
function applyReferralBonus(referrerCode, newCustomer) {
  referrerCode = (referrerCode || '').trim().toUpperCase();
  newCustomer = newCustomer || currentUser;
  if (!referrerCode || !newCustomer) return;
  if (referrerCode === (newCustomer.referralCode || '').toUpperCase()) {
    showToast('Apna hi referral code use nahi kar sakte!', 'orange');
    return;
  }
  if (!akFirebaseReady || !firebase.firestore) {
    showToast('Referral code save nahi ho paya — internet check karo.', 'orange');
    return;
  }
  addReferralClaim({
    code: referrerCode,
    newCustomerId: newCustomer.id,
    newCustomerName: newCustomer.name || '',
    createdAt: new Date().toISOString(),
    status: 'pending',
  })
    .then(function () {
      // Naye customer ka apna welcome bonus — turant milta hai
      var bonus = 100;
      var w = getWallet();
      w.points = (w.points || 0) + bonus;
      w.history = w.history || [];
      w.history.push({
        type: 'referral_new_user',
        pts: bonus,
        date: new Date().toISOString(),
        note: 'Welcome referral bonus',
      });
      saveWallet(w);
      updateWalletUI();
      showToast('🎉 Referral bonus! ₹50 wallet mein add hua!', 'green');
    })
    .catch(function (e) {
      console.warn('Referral claim failed', e);
      showToast('Referral code save nahi ho paya, dubara try karo.', 'orange');
    });
}

/* ------------------------------------------------
   2. LOYALTY TIERS
   ------------------------------------------------ */
var TIERS = [
  {
    name: 'Bronze',
    min: 0,
    max: 499,
    emoji: '🥉',
    color: '#CD7F32',
    bg: 'linear-gradient(135deg,#CD7F32,#b8681d)',
    cashback: 5,
  },
  {
    name: 'Silver',
    min: 500,
    max: 1499,
    emoji: '🥈',
    color: '#9CA3AF',
    bg: 'linear-gradient(135deg,#9CA3AF,#6B7280)',
    cashback: 10,
  },
  {
    name: 'Gold',
    min: 1500,
    max: 999999,
    emoji: '🥇',
    color: '#F59E0B',
    bg: 'linear-gradient(135deg,#F59E0B,#D97706)',
    cashback: 15,
  },
];

function getCurrentTier(points) {
  return (
    TIERS.slice()
      .reverse()
      .find(function (t) {
        return points >= t.min;
      }) || TIERS[0]
  );
}
function getNextTier(points) {
  return TIERS.find(function (t) {
    return points < t.max;
  });
}

function openLoyaltyModal() {
  if (!currentUser) {
    showToast('Pehle login karo!', 'red');
    openAuthOrProfile();
    return;
  }
  var modal = document.getElementById('loyalty-modal');
  if (!modal) return;
  var w = getWallet();
  var pts = w.points || 0;
  var tier = getCurrentTier(pts);
  var next = getNextTier(pts);
  // Update header
  var header = document.getElementById('loyalty-header');
  if (header) header.style.background = tier.bg;
  var emo = document.getElementById('loyalty-badge-emoji');
  if (emo) emo.textContent = tier.emoji;
  var tname = document.getElementById('loyalty-tier-name');
  if (tname) tname.textContent = tier.name + ' Member';
  var ptsLine = document.getElementById('loyalty-pts-line');
  if (ptsLine) ptsLine.textContent = pts + ' points earned';
  // Progress
  var progLabel = document.getElementById('loyalty-progress-label');
  var progPts = document.getElementById('loyalty-progress-pts');
  var progBar = document.getElementById('loyalty-progress-bar');
  if (next && next.name !== tier.name) {
    var pct = Math.min(100, Math.round(((pts - tier.min) / (next.min - tier.min)) * 100));
    if (progLabel) progLabel.textContent = 'Progress to ' + next.name;
    if (progPts) progPts.textContent = pts + ' / ' + next.min + ' pts';
    if (progBar) {
      progBar.style.width = pct + '%';
      progBar.style.background = tier.color;
    }
  } else {
    if (progLabel) progLabel.textContent = '🏆 Maximum tier reached!';
    if (progPts) progPts.textContent = pts + ' pts';
    if (progBar) progBar.style.width = '100%';
  }
  // Highlight current tier row
  ['bronze', 'silver', 'gold'].forEach(function (t) {
    var row = document.getElementById('tier-' + t);
    var chk = document.getElementById('tier-' + t + '-check');
    if (row) {
      row.style.border =
        tier.name.toLowerCase() === t ? '2.5px solid ' + tier.color : '2px solid #F0D8C0';
      row.style.background = tier.name.toLowerCase() === t ? '#FFF8F0' : '#fff';
    }
    if (chk) chk.textContent = tier.name.toLowerCase() === t ? '✅' : '';
  });
  modal.style.display = 'flex';
}
function closeLoyaltyModal() {
  var m = document.getElementById('loyalty-modal');
  if (m) m.style.display = 'none';
}
// Update tier label in nav dropdown
function updateTierLabel() {
  var lbl = document.getElementById('ud-tier-lbl');
  if (!lbl || !currentUser) return;
  var w = getWallet();
  var tier = getCurrentTier(w.points || 0);
  lbl.textContent = tier.emoji + ' ' + tier.name;
  lbl.style.color = tier.color;
}

/* ------------------------------------------------
   3. ADDRESS BOOK
   ------------------------------------------------ */
function getAddresses() {
  if (!currentUser) return [];
  return lsGet('ak_addrs_' + (currentUser.phone || currentUser.id), []);
}
function saveAddresses(arr) {
  if (!currentUser) return;
  lsSet('ak_addrs_' + (currentUser.phone || currentUser.id), arr);
}

function openAddressBook() {
  if (!currentUser) {
    showToast('Pehle login karo!', 'red');
    openAuthOrProfile();
    return;
  }
  var modal = document.getElementById('address-modal');
  if (!modal) return;
  renderAddressList();
  modal.style.display = 'flex';
}
function closeAddressBook() {
  var m = document.getElementById('address-modal');
  if (m) m.style.display = 'none';
}
function renderAddressList() {
  var list = document.getElementById('address-list');
  if (!list) return;
  var addrs = getAddresses();
  if (!addrs.length) {
    list.innerHTML =
      '<div style="text-align:center;padding:1rem;color:#A08060;font-size:0.82rem;">Koi saved address nahi hai.</div>';
    return;
  }
  list.innerHTML = addrs
    .map(function (a, i) {
      return (
        '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1.5px solid #F5EDE5;">' +
        '<span style="font-size:1.2rem;margin-top:2px;">📍</span>' +
        '<div style="flex:1;"><div style="font-weight:800;font-size:0.82rem;color:#2D1A00;">' +
        esc(a.label || 'Address ' + (i + 1)) +
        '</div>' +
        '<div style="font-size:0.75rem;color:#5C3A1E;margin-top:2px;">' +
        esc(a.text) +
        '</div></div>' +
        '<div style="display:flex;gap:4px;">' +
        '<button onclick="useAddress(' +
        i +
        ')" style="padding:5px 10px;background:#FF6B00;color:#fff;border:none;border-radius:8px;font-family:\'Nunito\',sans-serif;font-weight:800;font-size:0.7rem;cursor:pointer;">Use</button>' +
        '<button onclick="deleteAddress(' +
        i +
        ')" style="padding:5px 8px;background:#FEE2E2;color:#DC2626;border:none;border-radius:8px;font-family:\'Nunito\',sans-serif;font-weight:700;font-size:0.7rem;cursor:pointer;">✕</button>' +
        '</div></div>'
      );
    })
    .join('');
}
function saveNewAddress() {
  var label = (document.getElementById('addr-label').value || '').trim();
  var text = (document.getElementById('addr-text').value || '').trim();
  if (!text) {
    showToast('Address likhna zaruri hai!', 'red');
    return;
  }
  var addrs = getAddresses();
  addrs.push({ label: label || 'Address ' + (addrs.length + 1), text: text });
  saveAddresses(addrs);
  document.getElementById('addr-label').value = '';
  document.getElementById('addr-text').value = '';
  renderAddressList();
  showToast('Address save ho gaya! ✅', 'green');
}
function deleteAddress(idx) {
  var addrs = getAddresses();
  addrs.splice(idx, 1);
  saveAddresses(addrs);
  renderAddressList();
  showToast('Address hata diya', 'orange');
}
function useAddress(idx) {
  var addrs = getAddresses();
  var a = addrs[idx];
  if (!a) return;
  var addrInput = document.getElementById('ord-address');
  if (addrInput) addrInput.value = a.text;
  closeAddressBook();
  openCartModal();
  goStep(3);
  showToast('Address fill ho gaya! ✅', 'green');
}

/* ------------------------------------------------
   4. WISHLIST / FAVOURITES
   ------------------------------------------------ */
function getWishlist() {
  if (!currentUser) return lsGet('ak_wishlist_guest', []);
  return lsGet('ak_wishlist_' + (currentUser.phone || currentUser.id), []);
}
function saveWishlist(arr) {
  if (!currentUser) {
    lsSet('ak_wishlist_guest', arr);
    return;
  }
  lsSet('ak_wishlist_' + (currentUser.phone || currentUser.id), arr);
}

function toggleWishlist(itemJson, event) {
  if (event) {
    event.stopPropagation();
  }
  var item = JSON.parse(itemJson);
  var wl = getWishlist();
  var idx = wl.findIndex(function (w) {
    return w.name === item.name;
  });
  if (idx >= 0) {
    wl.splice(idx, 1);
    showToast('Favourites se hata diya 💔', 'orange');
  } else {
    wl.push({
      name: item.name,
      price: item.price,
      imgUrl: item.imgUrl || '',
      imgData: item.imgData || '',
      cat: item.cat,
      desc: item.desc,
      veg: item.veg,
    });
    showToast('❤️ Favourites mein add!', 'green');
  }
  saveWishlist(wl);
  _doRenderMenu(); // re-render to update hearts
}

function openWishlist() {
  var modal = document.getElementById('wishlist-modal');
  if (!modal) return;
  renderWishlistItems();
  modal.style.display = 'flex';
}
function closeWishlist() {
  var m = document.getElementById('wishlist-modal');
  if (m) m.style.display = 'none';
}
function renderWishlistItems() {
  var container = document.getElementById('wishlist-items');
  var empty = document.getElementById('wishlist-empty');
  var wl = getWishlist();
  if (!wl.length) {
    if (container) container.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (!container) return;
  container.innerHTML = wl
    .map(function (item) {
      var inCart = cart[item.name] ? cart[item.name].qty : 0;
      var wlImgSrc = item.imgUrl || item.imgData || '';
      var wlImgHtml = wlImgSrc
        ? '<img src="' +
          wlImgSrc +
          '" alt="' +
          esc(item.name) +
          '" style="width:100%;height:90px;object-fit:cover;border-radius:10px;margin-bottom:6px;">'
        : '<div style="width:100%;height:90px;border-radius:10px;margin-bottom:6px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#FFE4C4,#FFD1A3);font-family:\'Playfair Display\',serif;font-weight:900;font-size:1.8rem;color:rgba(45,26,0,0.35);">' +
          esc((item.name || '?').charAt(0).toUpperCase()) +
          '</div>';
      return (
        '<div style="background:#FFF8F0;border:2px solid #F0D8C0;border-radius:14px;padding:0.9rem;text-align:center;">' +
        wlImgHtml +
        '<div style="font-weight:800;font-size:0.8rem;color:#2D1A00;margin-bottom:4px;">' +
        esc(item.name) +
        '</div>' +
        '<div style="font-weight:900;color:#FF6B00;font-size:0.82rem;margin-bottom:8px;">₹' +
        item.price +
        '</div>' +
        (inCart > 0
          ? '<div style="background:#FF6B00;border-radius:8px;padding:5px;display:flex;align-items:center;justify-content:center;gap:8px;">' +
            '<button onclick="changeQty(\'' +
            item.name.replace(/'/g, "\\'") +
            "'," +
            item.price +
            ',-1,event)" style="background:transparent;border:none;color:#fff;font-size:1rem;cursor:pointer;font-weight:800;">−</button>' +
            '<span style="color:#fff;font-weight:800;">' +
            inCart +
            '</span>' +
            '<button onclick="changeQty(\'' +
            item.name.replace(/'/g, "\\'") +
            "'," +
            item.price +
            ',1,event)" style="background:transparent;border:none;color:#fff;font-size:1rem;cursor:pointer;font-weight:800;">+</button>' +
            '</div>'
          : '<button onclick="addCart(\'' +
            item.name.replace(/'/g, "\\'") +
            "'," +
            item.price +
            ',event);renderWishlistItems();" style="width:100%;padding:7px;background:linear-gradient(135deg,#FF6B00,#FF8C00);color:#fff;border:none;border-radius:8px;font-family:\'Nunito\',sans-serif;font-weight:800;font-size:0.78rem;cursor:pointer;">+ Add</button>') +
        '</div>'
      );
    })
    .join('');
}

/* ------------------------------------------------
   5. SPIN THE WHEEL
   ------------------------------------------------ */
var SPIN_PRIZES = [
  { label: '₹30 OFF', code: 'SPIN30', type: 'flat', value: 30, color: '#FF6B00', emoji: '💰' },
  {
    label: 'Free Delivery',
    code: 'FREEDEL',
    type: 'delivery',
    value: 0,
    color: '#25D366',
    emoji: '🛵',
  },
  { label: 'Try Again', code: null, type: 'nothing', value: 0, color: '#9CA3AF', emoji: '😅' },
  { label: '₹50 OFF', code: 'SPIN50', type: 'flat', value: 50, color: '#DC2626', emoji: '🎉' },
  { label: '10% OFF', code: 'SPIN10', type: 'percent', value: 10, color: '#7C3AED', emoji: '🏷️' },
  { label: 'Try Again', code: null, type: 'nothing', value: 0, color: '#9CA3AF', emoji: '😅' },
  { label: '₹20 OFF', code: 'SPIN20', type: 'flat', value: 20, color: '#F59E0B', emoji: '⭐' },
  {
    label: 'Free Dessert',
    code: 'DESSERT',
    type: 'flat',
    value: 40,
    color: '#E11D48',
    emoji: '🍰',
  },
];

// FIX: spin prizes were never registered as real coupons — applying a
// won spin code at checkout used to fail silently. Register them here.
SPIN_PRIZES.forEach(function (p) {
  if (!p.code || p.type === 'nothing') return; // "Try Again" slices have no coupon
  if (!COUPONS[p.code]) {
    var maxDisc = p.type === 'percent' ? 100 : p.value;
    COUPONS[p.code] = {
      type: p.type,
      value: p.value,
      min: 0,
      maxDisc: maxDisc,
      label: p.label + ' (Spin Prize)',
    };
  }
});

var spinAngle = 0;
var isSpinning = false;
