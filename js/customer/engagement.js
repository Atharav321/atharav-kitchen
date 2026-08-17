/* ============================================================
   ATHARAV KITCHEN — CUSTOMER APP — engagement.js
   Spin-the-wheel offer, init hooks, upsell banner, abandoned-cart nudge, live order-status bar, promo video banner
   Extracted from legacy app.js (lines 3161-3489) — v14 -> v15 modular split
   Load order matters: this file assumes files loaded before it in
   index.html (see js/customer/*.js <script> order) are already parsed.
   ============================================================ */
function drawWheel() {
  var canvas = document.getElementById('spin-wheel');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var cx = 150,
    cy = 150,
    r = 140;
  var sliceAngle = (2 * Math.PI) / SPIN_PRIZES.length;
  SPIN_PRIZES.forEach(function (p, i) {
    var start = spinAngle + i * sliceAngle;
    var end = start + sliceAngle;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Label
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + sliceAngle / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Nunito,sans-serif';
    ctx.fillText(p.label, r - 10, 4);
    ctx.restore();
  });
}

function openSpinModal() {
  if (!currentUser) {
    showToast('Spin karne ke liye pehle login karo!', 'red');
    openAuthOrProfile();
    return;
  }
  var modal = document.getElementById('spin-modal');
  if (!modal) return;
  // Check cooldown
  var lastSpin = lsGet('ak_last_spin', 0);
  var now = Date.now();
  var cooldown = 24 * 60 * 60 * 1000; // 24 hours
  var remaining = cooldown - (now - lastSpin);
  var cdMsg = document.getElementById('spin-cooldown-msg');
  var spinBtn = document.getElementById('spin-btn');
  var result = document.getElementById('spin-result');
  if (result) result.style.display = 'none';
  if (remaining > 0) {
    var hrs = Math.floor(remaining / 3600000);
    var mins = Math.floor((remaining % 3600000) / 60000);
    if (cdMsg) cdMsg.textContent = 'Next spin ' + hrs + 'h ' + mins + 'm mein milega';
    if (spinBtn) {
      spinBtn.disabled = true;
      spinBtn.style.opacity = '0.5';
    }
  } else {
    if (cdMsg) cdMsg.textContent = 'Ek spin har 24 ghante!';
    if (spinBtn) {
      spinBtn.disabled = false;
      spinBtn.style.opacity = '1';
    }
  }
  modal.style.display = 'flex';
  setTimeout(drawWheel, 50);
}
function closeSpinModal() {
  var m = document.getElementById('spin-modal');
  if (m) m.style.display = 'none';
}

function spinWheel() {
  if (isSpinning) return;
  var lastSpin = lsGet('ak_last_spin', 0);
  if (Date.now() - lastSpin < 24 * 60 * 60 * 1000) {
    showToast('Kal phir aao! 24 ghante wait karo 🕐', 'red');
    return;
  }
  isSpinning = true;
  var spinBtn = document.getElementById('spin-btn');
  if (spinBtn) {
    spinBtn.disabled = true;
    spinBtn.textContent = 'Spinning...';
  }
  var result = document.getElementById('spin-result');
  if (result) result.style.display = 'none';
  // Weighted random — nothing has 2 slots out of 8 = 25% chance
  var prizeIdx = Math.floor(Math.random() * SPIN_PRIZES.length);
  var sliceAngle = (2 * Math.PI) / SPIN_PRIZES.length;
  // Calculate target angle so winning slice is at top (pointer position)
  var targetAngle = -(prizeIdx * sliceAngle + sliceAngle / 2) + 2 * Math.PI * 5; // 5 full spins
  var duration = 4000;
  var start = null;
  var startAngle = spinAngle;

  function animate(ts) {
    if (!start) start = ts;
    var elapsed = ts - start;
    var t = Math.min(elapsed / duration, 1);
    // Ease out cubic
    var ease = 1 - Math.pow(1 - t, 3);
    spinAngle = startAngle + targetAngle * ease;
    drawWheel();
    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      isSpinning = false;
      lsSet('ak_last_spin', Date.now());
      showSpinResult(SPIN_PRIZES[prizeIdx]);
      if (spinBtn) {
        spinBtn.textContent = '🎰 SPIN!';
        spinBtn.disabled = true;
        spinBtn.style.opacity = '0.5';
      }
      var cdMsg = document.getElementById('spin-cooldown-msg');
      if (cdMsg) cdMsg.textContent = 'Kal phir aao spin karne!';
    }
  }
  requestAnimationFrame(animate);
}

function showSpinResult(prize) {
  var result = document.getElementById('spin-result');
  if (!result) return;
  result.style.display = 'block';
  var emoEl = document.getElementById('spin-prize-emoji');
  var nameEl = document.getElementById('spin-prize-name');
  var codeWrap = document.getElementById('spin-prize-code-wrap');
  var codeEl = document.getElementById('spin-prize-code');
  if (emoEl) emoEl.textContent = prize.emoji;
  if (nameEl) nameEl.textContent = prize.label;
  if (prize.code) {
    if (codeWrap) codeWrap.style.display = 'block';
    if (codeEl) codeEl.textContent = prize.code;
    // Save coupon to user's wallet
    if (akFirebaseReady && firebase.auth().currentUser) {
      logSpinWin({
        uid: firebase.auth().currentUser.uid,
        prize: prize.label,
        code: prize.code,
        date: new Date().toISOString(),
      }).catch(function () {});
    }
    showToast('🎉 Jeet gaye! Code: ' + prize.code, 'green');
  } else {
    if (codeWrap) codeWrap.style.display = 'none';
    showToast('Baar phir try karo! Kal phir spin milega 😅', 'orange');
  }
}
function copySpinCode() {
  var code = document.getElementById('spin-prize-code');
  if (!code) return;
  navigator.clipboard
    .writeText(code.textContent)
    .then(function () {
      showToast('Code copied! ✅', 'green');
    })
    .catch(function () {
      showToast('Code: ' + code.textContent, 'green');
    });
}

/* ------------------------------------------------
   INIT — Show spin FAB for logged-in users
   ------------------------------------------------ */
function initPartB() {
  // Show spin fab
  var fab = document.getElementById('spin-fab');
  if (currentUser && fab) fab.style.display = 'block';
  // Update tier label
  updateTierLabel();
}

// Hook into existing login success — patch updateNavUser
var _origUpdateUserUI = updateNavUser;
updateNavUser = function () {
  _origUpdateUserUI();
  initPartB();
};

// Run on load if already logged in
setTimeout(function () {
  if (currentUser) {
    initPartB();
  }
}, 1500);

/* ================================================================
   PART C — REVENUE FEATURES
   ================================================================ */

/* ------------------------------------------------
   1. MINIMUM ORDER + UPSELL POPUP
   ------------------------------------------------ */
function showUpsellBanner(subtotal) {
  var need = MIN_ORDER - subtotal;
  // Remove old banner if exists
  var old = document.getElementById('upsell-banner');
  if (old) old.remove();

  var banner = document.createElement('div');
  banner.id = 'upsell-banner';
  banner.style.cssText =
    'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:5000;width:calc(100% - 2rem);max-width:400px;background:linear-gradient(135deg,#FF6B00,#FF8C00);border-radius:16px;padding:14px 18px;box-shadow:0 8px 30px rgba(255,107,0,0.45);display:flex;align-items:center;justify-content:space-between;gap:10px;animation:slideUp 0.3s ease;';
  banner.innerHTML =
    '<div style="color:#fff;">' +
    '<div style="font-weight:900;font-size:0.92rem;">🛒 ₹' +
    need +
    ' aur karo!</div>' +
    '<div style="font-size:0.72rem;opacity:0.9;margin-top:2px;">Min order ₹' +
    MIN_ORDER +
    ' · Free delivery at ₹399</div>' +
    '</div>' +
    "<button onclick=\"document.getElementById('upsell-banner').remove();goTo('menu');\" style=\"background:rgba(255,255,255,0.25);border:none;color:#fff;padding:8px 14px;border-radius:10px;font-family:'Nunito',sans-serif;font-weight:800;font-size:0.78rem;cursor:pointer;white-space:nowrap;\">+ Add Items</button>";
  document.body.appendChild(banner);
  setTimeout(function () {
    var b = document.getElementById('upsell-banner');
    if (b) b.remove();
  }, 5000);
}

function checkUpsell(subtotal) {
  // Free delivery upsell — show if between 149 and 399
  if (subtotal >= MIN_ORDER && subtotal < 399) {
    var need = 399 - subtotal;
    showToast('₹' + need + ' aur karo — FREE delivery milegi! 🛵', 'orange');
  }
}

/* ------------------------------------------------
   2. ABANDONED CART RECOVERY (WhatsApp)
   ------------------------------------------------ */
var abandonedCartTimer = null;

function resetAbandonedCartTimer() {
  if (abandonedCartTimer) clearTimeout(abandonedCartTimer);
  if (Object.keys(cart).length === 0) return;
  if (!currentUser || !currentUser.phone) return;
  // 15 min baad fire
  abandonedCartTimer = setTimeout(
    function () {
      fireAbandonedCartMsg();
    },
    15 * 60 * 1000
  );
}

function fireAbandonedCartMsg() {
  if (Object.keys(cart).length === 0) return;
  var items = Object.keys(cart).slice(0, 3).join(', ');
  var total = Object.values(cart).reduce(function (s, i) {
    return s + i.qty * i.price;
  }, 0);
  var msg =
    'Namaste *' +
    (currentUser.name || '') +
    '* ji! 🙏\n\n' +
    'Aapne cart mein items chhod diye hain:\n🍽️ *' +
    items +
    '*' +
    (Object.keys(cart).length > 3 ? ' +aur...' : '') +
    '\n\n' +
    '💰 Cart Total: *₹' +
    total +
    '*\n\n' +
    'Abhi order karo:\n👉 https://atharav-kitchen.pages.dev\n\n' +
    'Ya WhatsApp pe bolo: wa.me/917903567007\n\n' +
    '— Atharav Kitchen 🍽️';
  // Show reminder popup instead of auto-WA (can't auto-send)
  showAbandonedCartPopup(msg, total);
}

function showAbandonedCartPopup(msg, total) {
  var old = document.getElementById('abandoned-popup');
  if (old) old.remove();
  var pop = document.createElement('div');
  pop.id = 'abandoned-popup';
  pop.style.cssText =
    'position:fixed;inset:0;background:rgba(45,26,0,0.7);backdrop-filter:blur(6px);z-index:8000;display:flex;align-items:flex-end;justify-content:center;padding:1rem;';
  pop.innerHTML =
    '<div style="max-width:420px;width:100%;background:#fff;border-radius:24px 24px 0 0;padding:1.5rem;box-shadow:0 -10px 40px rgba(45,26,0,0.2);animation:slideUp 0.3s ease;">' +
    '<div style="text-align:center;margin-bottom:1rem;">' +
    '<div style="font-size:2.5rem;">🛒</div>' +
    '<div style="font-family:\'Playfair Display\',serif;font-size:1.1rem;font-weight:700;color:#2D1A00;margin-top:6px;">Cart mein items hain!</div>' +
    '<div style="font-size:0.8rem;color:#A08060;margin-top:4px;">Aapke items wait kar rahe hain — ₹' +
    total +
    ' ka order pending hai</div>' +
    '</div>' +
    '<button onclick="document.getElementById(\'abandoned-popup\').remove();openCartModal();" style="width:100%;padding:13px;background:linear-gradient(135deg,#FF6B00,#FF8C00);color:#fff;border:none;border-radius:12px;font-family:\'Nunito\',sans-serif;font-weight:900;font-size:0.9rem;cursor:pointer;margin-bottom:0.6rem;">🍽️ Complete My Order</button>' +
    '<button onclick="document.getElementById(\'abandoned-popup\').remove();" style="width:100%;padding:10px;background:#FFF8F0;color:#A08060;border:1.5px solid #F0D8C0;border-radius:12px;font-family:\'Nunito\',sans-serif;font-weight:700;font-size:0.82rem;cursor:pointer;">Baad mein karta hoon</button>' +
    '</div>';
  document.body.appendChild(pop);
}

// Hook into addCart/changeQty to reset timer
var _origAddCart = addCart;
addCart = function (name, price, ev) {
  _origAddCart(name, price, ev);
  resetAbandonedCartTimer();
};

function showOrderStatusBar(order) {
  var bar = document.getElementById('order-track-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'order-track-bar';
    bar.style.cssText =
      'position:fixed;top:70px;left:0;right:0;z-index:4500;background:#fff;border-bottom:2px solid #F0D8C0;padding:10px 16px;box-shadow:0 4px 20px rgba(45,26,0,0.1);';
    document.body.appendChild(bar);
  }
  var STEPS = ['New', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'];
  var cur = STEPS.indexOf(order.status);
  var icons = ['📝', '✅', '👨‍🍳', '🛵', '🎉'];
  bar.innerHTML =
    '<div style="max-width:600px;margin:0 auto;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
    '<div style="font-weight:800;font-size:0.82rem;color:#2D1A00;">📦 Order #' +
    order.id +
    ' Tracking</div>' +
    '<button onclick="document.getElementById(\'order-track-bar\').remove();" style="background:none;border:none;cursor:pointer;color:#A08060;font-size:1rem;">×</button>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:0;">' +
    STEPS.map(function (s, i) {
      var done = i <= cur;
      var active = i === cur;
      return (
        '<div style="flex:1;text-align:center;">' +
        '<div style="font-size:' +
        (active ? '1.3rem' : '1rem') +
        ';transition:all 0.3s;">' +
        icons[i] +
        '</div>' +
        '<div style="font-size:0.58rem;font-weight:' +
        (active ? '900' : '600') +
        ';color:' +
        (active ? '#FF6B00' : done ? '#16A34A' : '#CCC') +
        ';margin-top:2px;line-height:1.2;">' +
        s +
        '</div>' +
        (i < STEPS.length - 1
          ? '<div style="height:2px;background:' +
            (done ? '#16A34A' : '#F0D8C0') +
            ';margin:4px -50%;position:relative;z-index:-1;"></div>'
          : '') +
        '</div>'
      );
    }).join('') +
    '</div></div>';
}

/* CSS for upsell animation */
var partCStyle = document.createElement('style');
partCStyle.textContent =
  '@keyframes slideUp{from{transform:translateY(20px) translateX(-50%);opacity:0;}to{transform:translateY(0) translateX(-50%);opacity:1;}}';
document.head.appendChild(partCStyle);

/* ================================================
   ★ PROMO VIDEO BANNER — load from localStorage/Firebase
   ================================================ */
function loadPromoVideoBanner() {
  function applyPromo(pv) {
    if (!pv || !pv.url || !pv.active) return;
    var section = document.getElementById('promo-video-section');
    var embed = document.getElementById('promo-video-embed');
    var header = document.getElementById('promo-video-header');
    var titleEl = document.getElementById('promo-video-title-el');
    var subEl = document.getElementById('promo-video-subtitle-el');
    if (!section || !embed) return;

    // Title/subtitle
    if (pv.title || pv.subtitle) {
      header.style.display = 'block';
      if (titleEl && pv.title) titleEl.textContent = pv.title;
      if (subEl && pv.subtitle) subEl.textContent = pv.subtitle;
    }

    // Detect YouTube vs direct video
    var ytM = (pv.url || '').match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
    );
    if (ytM) {
      var ytId = ytM[1];
      var muted = pv.muted !== false;
      embed.innerHTML =
        '<iframe src="https://www.youtube.com/embed/' +
        ytId +
        '?autoplay=1&loop=1&playlist=' +
        ytId +
        '&controls=1&rel=0' +
        (muted ? '&mute=1' : '') +
        '" style="position:absolute;inset:0;width:100%;height:100%;border:0;" allow="autoplay; encrypted-media" allowfullscreen></iframe>';
    } else {
      var muted2 = pv.muted !== false;
      embed.innerHTML =
        '<video src="' +
        pv.url +
        '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" controls autoplay' +
        (muted2 ? ' muted' : '') +
        '></video>';
    }
    section.style.display = 'block';
  }

  // Try Firebase first, fallback to localStorage
  var lsPv = null;
  try {
    lsPv = JSON.parse(localStorage.getItem('ak_promo_video'));
  } catch (e) {}

  if (akFirebaseReady) {
    getPromoVideoSettings()
      .then(function (snap) {
        if (snap.exists && snap.data() && snap.data().active) {
          applyPromo(snap.data());
          // Cache locally
          try {
            localStorage.setItem('ak_promo_video', JSON.stringify(snap.data()));
          } catch (e) {}
        } else if (lsPv && lsPv.active) {
          applyPromo(lsPv);
        }
      })
      .catch(function () {
        if (lsPv && lsPv.active) applyPromo(lsPv);
      });
  } else if (lsPv && lsPv.active) {
    applyPromo(lsPv);
  }
}

// Load promo video after page ready
window.addEventListener('akFirebaseReady', function () {
  loadPromoVideoBanner();
});
setTimeout(function () {
  if (!akFirebaseReady) loadPromoVideoBanner();
}, 1500);
