/**
 * ============================================================
 *  ATHARAV KITCHEN — reviews.js
 *
 *  Responsibility: Customer feedback / reviews
 *    - Submit feedback form to Firestore
 *    - Star rating capture
 *    - Display recent public reviews on homepage
 *    - Rate-limit: 1 review per customer per 24h
 *
 *  Depends on: core.js, firebase-config.js, auth.js
 *  Global API: submitReview(), loadReviews()
 * ============================================================
 */
function loadPublicReviews() {
  var grid = document.getElementById('public-reviews-grid');
  if (!grid) return;

  var fallback = [
    {
      name: 'Rahul S.',
      rating: 5,
      comment: 'Butter Chicken ekdum amazing tha! Fast delivery bhi.',
      platform: 'Zomato',
      date: '2025-01-10',
    },
    {
      name: 'Priya M.',
      rating: 5,
      comment: 'Best momos in Dhanbad! Peri peri burger bhi loved.',
      platform: 'WhatsApp',
      date: '2025-01-08',
    },
    {
      name: 'Amit K.',
      rating: 4,
      comment: 'Good food, reasonable price. Will order again.',
      platform: 'Swiggy',
      date: '2025-01-06',
    },
  ];

  function renderCards(reviews) {
    if (!reviews || !reviews.length) {
      grid.innerHTML =
        '<div style="color:#A08060;font-size:0.85rem;padding:1rem;text-align:center;">Pehle order kar ke review do! 😊</div>';
      return;
    }
    grid.innerHTML = reviews
      .map(function (r) {
        var avg = r.rating || Math.round(((r.food || 3) + (r.delivery || 3) + (r.value || 3)) / 3);
        var stars = '';
        for (var i = 1; i <= 5; i++)
          stars += '<span style="color:' + (i <= avg ? '#FF6B00' : '#DDD') + ';">★</span>';
        return (
          '<div style="background:#fff;border-radius:14px;padding:1rem 1.2rem;box-shadow:0 2px 12px rgba(45,26,0,0.08);border:1.5px solid #F5EDE5;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;">' +
          '<span style="font-weight:800;color:var(--deep-brown);font-size:0.88rem;">' +
          esc(r.name || 'Customer') +
          '</span>' +
          '<span style="font-size:0.7rem;color:#A08060;background:#FFF0E0;padding:2px 8px;border-radius:20px;">' +
          esc(r.platform || '') +
          '</span>' +
          '</div>' +
          '<div style="font-size:1rem;margin-bottom:0.5rem;">' +
          stars +
          '</div>' +
          (r.comment
            ? '<p style="font-size:0.82rem;color:#5C3A1E;line-height:1.5;margin:0 0 0.4rem;">&#8220;' +
              esc(r.comment) +
              '&#8221;</p>'
            : '') +
          '<div style="font-size:0.7rem;color:#C0A080;">' +
          (r.date || r.createdAt || '').toString().substring(0, 10) +
          '</div>' +
          '</div>'
        );
      })
      .join('');
  }

  renderCards(fallback); // pehle fallback

  if (akFirebaseReady) {
    queryRecentFeedback(20)
      .then(function (snap) {
        if (snap.empty) return;
        var list = [];
        snap.forEach(function (doc) {
          list.push(doc.data());
        });
        // Client-side: 3+ star aur comment wale
        var good = list.filter(function (r) {
          var avg =
            r.rating || Math.round(((r.food || 0) + (r.delivery || 0) + (r.value || 0)) / 3);
          return avg >= 3 && r.comment && r.comment.trim().length > 5;
        });
        if (good.length >= 2) renderCards(good.slice(0, 9));
      })
      .catch(function (e) {
        console.warn('Reviews load error:', e);
      });
  }
}

// Page load pe reviews fetch
window.addEventListener('akFirebaseReady', function () {
  loadPublicReviews();
});

function loadKitchenGallery() {
  var section = document.getElementById('kitchen-gallery-section');
  var grid = document.getElementById('kitchen-gallery-grid');
  if (!section || !grid) return;
  getKitchenGallerySettings()
    .then(function (doc) {
      var images = (doc.exists && doc.data().images) || [];
      if (!images.length) {
        section.style.display = 'none';
        return;
      }
      grid.innerHTML = images
        .map(function (url) {
          return (
            '<div class="kg-photo"><img src="' +
            url +
            '" alt="Atharav Kitchen — hamari kitchen" loading="lazy"></div>'
          );
        })
        .join('');
      section.style.display = '';
    })
    .catch(function () {
      section.style.display = 'none';
    });
}
window.addEventListener('akFirebaseReady', function () {
  loadKitchenGallery();
});
window.addEventListener('load', function () {
  setTimeout(loadPublicReviews, 2000);
});

/* ================================================
   ★ AUTO RATING PROMPT (delivery ke baad)
   ================================================ */
function checkAutoRatingPrompt() {
  var orders = lsGet('ak_orders', []);
  var now = Date.now();
  orders.forEach(function (o) {
    if (o.ratingPromptShown) return;
    // 30 min baad prompt dikhao (30 * 60 * 1000)
    var orderTime = o.timestamp || o.createdAtMs || new Date(o.date || o.time || 0).getTime() || 0;
    if (orderTime && now - orderTime > 1800000 && now - orderTime < 86400000) {
      showAutoRatingPrompt(o);
      // Mark as shown
      o.ratingPromptShown = true;
      lsSet('ak_orders', orders);
    }
  });
}

function showAutoRatingPrompt(order) {
  // Don't show if already rated recently
  var lastRated = lsGet('ak_last_rated', 0);
  if (Date.now() - lastRated < 86400000) return;
  var pop = document.createElement('div');
  pop.id = 'auto-rating-popup';
  pop.style.cssText =
    'position:fixed;inset:0;background:rgba(45,26,0,0.7);backdrop-filter:blur(8px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:1rem;';
  pop.innerHTML =
    '<div style="max-width:360px;width:100%;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 30px 80px rgba(45,26,0,0.4);animation:popIn 0.3s ease;">' +
    '<div style="background:linear-gradient(135deg,#FF6B00,#FF8C00);padding:1.2rem;text-align:center;">' +
    '<div style="font-size:2.5rem;">⭐</div>' +
    '<div style="font-family:Playfair Display,serif;font-size:1.1rem;font-weight:700;color:#fff;margin-top:6px;">Aapka Order Kaisa Tha?</div>' +
    '<div style="font-size:0.75rem;color:rgba(255,255,255,0.85);margin-top:4px;">Order #' +
    (order.id || order.orderId) +
    ' — Feedback do! 🙏</div>' +
    '</div>' +
    '<div style="padding:1.4rem;text-align:center;">' +
    '<div style="font-size:0.85rem;color:#5C3A1E;font-weight:600;margin-bottom:1rem;">Kitne stars doge? 😊</div>' +
    '<div style="display:flex;justify-content:center;gap:0.6rem;margin-bottom:1.2rem;" id="ar-stars">' +
    '<button onclick="selectAutoRatingStar(1)" class="ar-star" data-val="1" style="font-size:2rem;background:none;border:none;cursor:pointer;opacity:0.4;transition:all 0.2s;">★</button>' +
    '<button onclick="selectAutoRatingStar(2)" class="ar-star" data-val="2" style="font-size:2rem;background:none;border:none;cursor:pointer;opacity:0.4;transition:all 0.2s;">★</button>' +
    '<button onclick="selectAutoRatingStar(3)" class="ar-star" data-val="3" style="font-size:2rem;background:none;border:none;cursor:pointer;opacity:0.4;transition:all 0.2s;">★</button>' +
    '<button onclick="selectAutoRatingStar(4)" class="ar-star" data-val="4" style="font-size:2rem;background:none;border:none;cursor:pointer;opacity:0.4;transition:all 0.2s;">★</button>' +
    '<button onclick="selectAutoRatingStar(5)" class="ar-star" data-val="5" style="font-size:2rem;background:none;border:none;cursor:pointer;opacity:0.4;transition:all 0.2s;">★</button>' +
    '</div>' +
    '<button onclick="submitAutoRating(' +
    JSON.stringify(JSON.stringify(order)) +
    ')" id="ar-submit-btn" style="width:100%;padding:13px;background:linear-gradient(135deg,#FF6B00,#FF8C00);color:#fff;border:none;border-radius:12px;font-family:Nunito,sans-serif;font-weight:900;font-size:0.9rem;cursor:pointer;margin-bottom:0.6rem;">⭐ Submit Rating</button>' +
    '<button onclick="closeAutoRatingPrompt()" style="background:none;border:none;color:#A08060;font-size:0.78rem;cursor:pointer;font-family:Nunito,sans-serif;text-decoration:underline;">Skip karo →</button>' +
    '</div></div>';
  document.body.appendChild(pop);
  window._autoRatingVal = 0;
}

var _autoRatingVal = 0;
function selectAutoRatingStar(val) {
  _autoRatingVal = val;
  var stars = document.querySelectorAll('.ar-star');
  stars.forEach(function (s, i) {
    s.style.opacity = i < val ? '1' : '0.35';
    s.style.color = i < val ? '#FF6B00' : '#ccc';
    s.style.transform = i < val ? 'scale(1.2)' : 'scale(1)';
  });
}

function submitAutoRating(orderJson) {
  if (_autoRatingVal === 0) {
    showToast('Pehle stars select karo!', 'red');
    return;
  }
  var order = JSON.parse(orderJson);
  var fb = {
    id: Date.now(),
    name: (currentUser && currentUser.name) || 'Guest',
    customerId: currentUser ? currentUser.id || currentUser.phone : 'guest',
    orderId: order.id || order.orderId,
    rating: _autoRatingVal,
    autoPrompt: true,
  };
  saveFeedback(fb);
  lsSet('ak_last_rated', Date.now());
  closeAutoRatingPrompt();
  if (_autoRatingVal >= 4) {
    showToast('Thank you! ❤️ Zomato pe bhi rate karo!', 'green');
    setTimeout(function () {
      window.open('https://link.zomato.com/xqzv/rshare?id=8966837430563d60', '_blank');
    }, 1500);
  } else {
    showToast('Feedback ke liye shukriya! Hum improve karenge 🙏', 'orange');
  }
}

function closeAutoRatingPrompt() {
  var pop = document.getElementById('auto-rating-popup');
  if (pop) pop.remove();
}

// Check on page load — 5 sec baad
setTimeout(function () {
  if (typeof currentUser !== 'undefined' && currentUser) {
    checkAutoRatingPrompt();
  }
}, 5000);

/* ================================================================
   ★ PART B — RETENTION FEATURES
   ================================================================ */

/* ------------------------------------------------
   1. REFERRAL SYSTEM
   ------------------------------------------------ */
