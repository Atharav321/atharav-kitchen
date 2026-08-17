/* ============================================================
   ATHARAV KITCHEN — CUSTOMER APP — menu.js
   Menu Firestore sync, render/filter/search, item-detail popup, cross-sell, offers rail
   Extracted from legacy app.js (lines 1158-1483) — v14 -> v15 modular split
   Load order matters: this file assumes files loaded before it in
   index.html (see js/customer/*.js <script> order) are already parsed.
   ============================================================ */
function startMenuFirebaseSync() {
  if (!akFirebaseReady) return;
  if (akMenuUnsub) {
    akMenuUnsub();
    akMenuUnsub = null;
  }
  akMenuUnsub = subscribeMenu(
    function (snap) {
      var items = snap.docs.map(function (d) {
        var x = d.data() || {};
        if (x.id == null) x.id = d.id;
        return x;
      });
      if (items.length) {
        AK_MENU_LIVE = items;
        try {
          localStorage.setItem('ak_menu', JSON.stringify(items));
        } catch (e) {}
        // Re-render menu grid live if page already painted once
        if (typeof renderMenu === 'function') renderMenu();
      }
    },
    function (err) {
      console.warn('Menu Firestore sync error:', err);
    }
  );
}
function getMenu() {
  if (AK_MENU_LIVE && AK_MENU_LIVE.length) return AK_MENU_LIVE;
  try {
    var m = JSON.parse(localStorage.getItem('ak_menu'));
    if (m && m.length) return m;
  } catch {}
  return [
    {
      id: 1,
      name: 'Peri Peri Burger',
      cat: 'Indo-Western',
      price: 120,
      desc: 'Crispy patty with spicy peri-peri sauce, lettuce & tomato',
      veg: false,
      emoji: '🍔',
      imgData: '',
    },
    {
      id: 2,
      name: 'Veg Grilled Sandwich',
      cat: 'Indo-Western',
      price: 80,
      desc: 'Fresh veggies grilled to perfection with mint chutney',
      veg: true,
      emoji: '🥪',
      imgData: '',
    },
    {
      id: 3,
      name: 'Chicken Wrap',
      cat: 'Indo-Western',
      price: 130,
      desc: 'Tender chicken tikka wrapped in soft roti with sauces',
      veg: false,
      emoji: '🌯',
      imgData: '',
    },
    {
      id: 4,
      name: 'Masala Fries',
      cat: 'Indo-Western',
      price: 70,
      desc: 'Crispy golden fries tossed in special masala blend',
      veg: true,
      emoji: '🍟',
      imgData: '',
    },
    {
      id: 5,
      name: 'Veg Hakka Noodles',
      cat: 'Chinese',
      price: 100,
      desc: 'Classic stir-fried noodles with fresh vegetables & soy sauce',
      veg: true,
      emoji: '🍜',
      imgData: '',
    },
    {
      id: 6,
      name: 'Chicken Fried Rice',
      cat: 'Chinese',
      price: 130,
      desc: 'Wok-tossed rice with chicken, eggs & vegetables',
      veg: false,
      emoji: '🍛',
      imgData: '',
    },
    {
      id: 7,
      name: 'Chilli Chicken',
      cat: 'Chinese',
      price: 160,
      desc: 'Crispy chicken tossed in spicy chilli sauce with capsicum',
      veg: false,
      emoji: '🌶️',
      imgData: '',
    },
    {
      id: 8,
      name: 'Veg Momos (8 pcs)',
      cat: 'Chinese',
      price: 80,
      desc: 'Steamed dumplings stuffed with spiced vegetables',
      veg: true,
      emoji: '🥟',
      imgData: '',
    },
    {
      id: 9,
      name: 'Manchow Soup',
      cat: 'Chinese',
      price: 80,
      desc: 'Hot & sour soup with crispy noodles on top',
      veg: true,
      emoji: '🍲',
      imgData: '',
    },
    {
      id: 10,
      name: 'Butter Chicken',
      cat: 'Indian',
      price: 180,
      desc: 'Tender chicken in rich creamy tomato-butter gravy',
      veg: false,
      emoji: '🍗',
      imgData: '',
    },
    {
      id: 11,
      name: 'Dal Makhani',
      cat: 'Indian',
      price: 140,
      desc: 'Slow-cooked black lentils in buttery tomato gravy',
      veg: true,
      emoji: '🫘',
      imgData: '',
    },
    {
      id: 12,
      name: 'Paneer Butter Masala',
      cat: 'Indian',
      price: 160,
      desc: 'Soft paneer in aromatic butter masala sauce',
      veg: true,
      emoji: '🧀',
      imgData: '',
    },
    {
      id: 13,
      name: 'Butter Naan (2 pcs)',
      cat: 'Indian',
      price: 50,
      desc: 'Soft leavened bread baked to golden perfection',
      veg: true,
      emoji: '🫓',
      imgData: '',
    },
    {
      id: 14,
      name: 'Mango Lassi',
      cat: 'Drinks',
      price: 60,
      desc: 'Thick creamy mango yogurt drink',
      veg: true,
      emoji: '🥭',
      imgData: '',
    },
    {
      id: 15,
      name: 'Masala Chai',
      cat: 'Drinks',
      price: 30,
      desc: 'Traditional spiced Indian tea',
      veg: true,
      emoji: '☕',
      imgData: '',
    },
    {
      id: 16,
      name: 'Fresh Lime Soda',
      cat: 'Drinks',
      price: 50,
      desc: 'Chilled lime soda — sweet or salted',
      veg: true,
      emoji: '🍋',
      imgData: '',
    },
  ];
}

var currentCat = 'All';
var currentVegFilter = 'all';
var menuSearchQuery = '';
var BESTSELLERS = [
  'Peri Peri Burger',
  'Veg Hakka Noodles',
  'Chilli Chicken',
  'Veg Momos (8 pcs)',
  'Butter Chicken',
  'Chicken Fried Rice',
];

function showMenuSkeleton() {
  var sk = document.getElementById('menu-skeleton');
  var grid = document.getElementById('menu-grid');
  if (sk) {
    sk.style.display = 'grid';
  }
  if (grid) {
    grid.style.display = 'none';
  }
}
function hideMenuSkeleton() {
  var sk = document.getElementById('menu-skeleton');
  var grid = document.getElementById('menu-grid');
  if (sk) {
    sk.style.display = 'none';
  }
  if (grid) {
    grid.style.display = 'grid';
  }
}

function setVegFilter(type) {
  currentVegFilter = type;
  ['all', 'veg', 'nonveg'].forEach(function (t) {
    var btn = document.getElementById('veg-btn-' + t);
    if (btn) btn.classList.toggle('active', t === type);
  });
  renderMenu();
}

function filterMenu() {
  var inp = document.getElementById('menu-search');
  menuSearchQuery = inp ? inp.value.trim().toLowerCase() : '';
  var clr = document.getElementById('menu-search-clear');
  if (clr) clr.style.display = menuSearchQuery ? 'block' : 'none';
  renderMenu();
}
function clearMenuSearch() {
  var inp = document.getElementById('menu-search');
  if (inp) {
    inp.value = '';
    menuSearchQuery = '';
  }
  var clr = document.getElementById('menu-search-clear');
  if (clr) clr.style.display = 'none';
  renderMenu();
}

function renderMenu(skipSkeleton) {
  if (skipSkeleton) {
    // Cart quantity changed — menu data itself hasn't changed, so update
    // the DOM instantly. Skeleton is for genuine content changes only
    // (filters/search/category/first load), not every "+"/"-" tap.
    _doRenderMenu();
    return;
  }
  showMenuSkeleton();
  setTimeout(function () {
    _doRenderMenu();
    hideMenuSkeleton();
  }, 300);
}

function _doRenderMenu() {
  renderRecommended();
  var items = getMenu();
  var cats = [
    'All',
    ...new Set(
      items.map(function (i) {
        return i.cat;
      })
    ),
  ];
  document.getElementById('menu-pills').innerHTML = cats
    .map(function (c) {
      return (
        '<button class="pill' +
        (c === currentCat ? ' active' : '') +
        '" onclick="filterCat(\'' +
        c +
        '\')">' +
        c +
        '</button>'
      );
    })
    .join('');
  var items2 = items.filter(function (i) {
    return i.available !== false;
  });
  // Category filter
  var filtered =
    currentCat === 'All'
      ? items2
      : items2.filter(function (i) {
          return i.cat === currentCat;
        });
  // Veg/NonVeg filter
  if (currentVegFilter === 'veg')
    filtered = filtered.filter(function (i) {
      return i.veg === true;
    });
  else if (currentVegFilter === 'nonveg')
    filtered = filtered.filter(function (i) {
      return i.veg === false;
    });
  // Search filter
  if (menuSearchQuery) {
    filtered = filtered.filter(function (i) {
      return (
        (i.name || '').toLowerCase().includes(menuSearchQuery) ||
        (i.desc || '').toLowerCase().includes(menuSearchQuery) ||
        (i.cat || '').toLowerCase().includes(menuSearchQuery)
      );
    });
  }
  // Bestseller-first sort — admin panel ke "Menu Intelligence Sync" se aaya hua menuRank
  // (jitna zyada bika utna upar). Rank missing ho to original order rehta hai.
  if (
    filtered.some(function (i) {
      return i.menuRank !== undefined;
    })
  ) {
    filtered = filtered.slice().sort(function (a, b) {
      var ra = a.menuRank !== undefined ? a.menuRank : 9999;
      var rb = b.menuRank !== undefined ? b.menuRank : 9999;
      return ra - rb;
    });
  }
  var grid = document.getElementById('menu-grid');
  if (!filtered.length) {
    grid.innerHTML = '<div class="empty-cat">Koi item nahi mila. Try another search! 🍽️</div>';
    return;
  }
  grid.innerHTML = filtered
    .map(function (item) {
      var imgSrc = item.imgUrl || item.imgData || '';
      var imgHtml = imgSrc
        ? '<img src="' +
          imgSrc +
          '" alt="' +
          esc(item.name) +
          '" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=&quot;mc-noimg&quot;><span class=&quot;mc-noimg-letter&quot;>' +
          esc((item.name || '?').charAt(0).toUpperCase()) +
          '</span><span class=&quot;mc-noimg-label&quot;>Photo coming soon</span></div>\'">' +
          '<div class="mc-img-overlay"></div>'
        : '<div class="mc-noimg"><span class="mc-noimg-letter">' +
          esc((item.name || '?').charAt(0).toUpperCase()) +
          '</span><span class="mc-noimg-label">Photo coming soon</span></div>';
      var btnHtml = buildMenuCardQtyHtml(item);
      var isBestseller = BESTSELLERS.includes(item.name) || item.bestseller === true;
      var bsTag = isBestseller ? '<div class="mc-bestseller-tag">🔥 Bestseller</div>' : '';
      var vegIcon = '<div class="vi ' + (item.veg ? 'v' : 'nv') + '"></div>';
      var wl = getWishlist();
      var isWished = wl.some(function (w) {
        return w.name === item.name;
      });
      var heartBtn =
        '<button class="wl-heart-btn ' +
        (isWished ? 'wished' : '') +
        '" onclick="toggleWishlist(' +
        JSON.stringify(JSON.stringify(item)) +
        ',event)" title="Favourite mein add karo">' +
        (isWished ? '❤️' : '🤍') +
        '</button>';
      return (
        '<div class="mc" data-item-name="' +
        esc(item.name) +
        '"><div class="mc-top" onclick="openItemDetail(' +
        item.id +
        ')" style="cursor:pointer;">' +
        imgHtml +
        vegIcon +
        bsTag +
        heartBtn +
        '</div>' +
        '<div class="mc-body"><h3 onclick="openItemDetail(' +
        item.id +
        ')" style="cursor:pointer;">' +
        esc(item.name) +
        '</h3><p onclick="openItemDetail(' +
        item.id +
        ')" style="cursor:pointer;">' +
        esc(item.desc) +
        '</p>' +
        '<div class="mc-foot"><span class="mc-price">₹' +
        item.price +
        '</span><span class="mc-qty-slot">' +
        btnHtml +
        '</span></div></div></div>'
      );
    })
    .join('');
}
// Builds just the "+ Add" / quantity-stepper HTML for one item — shared by
// both the full grid render above and the single-card updater below, so
// the two can never drift out of sync.
function buildMenuCardQtyHtml(item) {
  var inCart = cart[item.name] ? cart[item.name].qty : 0;
  var safeName = item.name.replace(/'/g, "\\'");
  if (inCart > 0) {
    return (
      '<div style="display:flex;align-items:center;gap:6px;background:#FF6B00;border-radius:8px;padding:4px 8px;">' +
      '<button onclick="changeQty(\'' +
      safeName +
      "'," +
      item.price +
      ',-1,event)" style="background:transparent;border:none;color:#fff;font-size:1rem;cursor:pointer;font-weight:800;line-height:1;padding:0 2px;">−</button>' +
      '<span style="color:#fff;font-weight:800;font-size:0.9rem;min-width:16px;text-align:center;">' +
      inCart +
      '</span>' +
      '<button onclick="changeQty(\'' +
      safeName +
      "'," +
      item.price +
      ',1,event)" style="background:transparent;border:none;color:#fff;font-size:1rem;cursor:pointer;font-weight:800;line-height:1;padding:0 2px;">+</button>' +
      '</div>'
    );
  }
  return (
    '<button class="mc-add" onclick="addCart(\'' +
    safeName +
    "'," +
    item.price +
    ',event)">+ Add</button>'
  );
}
// Updates ONLY the one changed item's quantity control in place — no full
// grid re-render, so the page never jumps/loses scroll position when a
// customer taps +/- while scrolled down the menu. Falls back to a full
// renderMenu() only if the card isn't currently on screen (e.g. it's in
// a different category/filter than what's shown right now).
function updateMenuCardQtyInPlace(name) {
  var card = document.querySelector('.mc[data-item-name="' + cssEscape(name) + '"]');
  if (!card) {
    renderMenu(true);
    return;
  }
  var slot = card.querySelector('.mc-qty-slot');
  var item = getMenu().find(function (i) {
    return i.name === name;
  });
  if (!slot || !item) {
    renderMenu(true);
    return;
  }
  slot.innerHTML = buildMenuCardQtyHtml(item);
  // Recommended rail + cart upsell box still need their own refresh since
  // they show separate "+" buttons and (for the rail) don't reflect qty,
  // but keep this cheap — no skeleton, no full grid rebuild.
  renderUpsellBox();
}
function cssEscape(s) {
  return String(s).replace(/["\\]/g, '\\$&');
}

function renderRecommended() {
  var wrap = document.getElementById('menu-reco-wrap');
  var rail = document.getElementById('menu-reco-rail');
  if (!wrap || !rail) return;
  var items = getMenu().filter(function (i) {
    return i.available !== false;
  });
  var favs = items.filter(function (i) {
    return BESTSELLERS.includes(i.name) || i.bestseller === true;
  });
  if (!favs.length) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';
  rail.innerHTML = favs
    .map(function (item) {
      var imgSrc = item.imgUrl || item.imgData || '';
      var imgHtml = imgSrc
        ? '<img src="' +
          imgSrc +
          '" alt="' +
          esc(item.name) +
          '" loading="lazy" onerror="this.parentElement.innerHTML=\'<div class=&quot;mc-noimg&quot; style=&quot;height:100%;&quot;><span class=&quot;mc-noimg-letter&quot; style=&quot;font-size:1.6rem;&quot;>' +
          esc((item.name || '?').charAt(0).toUpperCase()) +
          '</span></div>\'">'
        : '<div class="mc-noimg" style="height:100%;"><span class="mc-noimg-letter" style="font-size:1.6rem;">' +
          esc((item.name || '?').charAt(0).toUpperCase()) +
          '</span></div>';
      return (
        '<div class="reco-card" onclick="scrollToMenuItem(\'' +
        item.name.replace(/'/g, "\\'") +
        '\')">' +
        '<div class="reco-img">' +
        imgHtml +
        '<span class="reco-badge">🔥 Bestseller</span></div>' +
        '<div class="reco-body"><div class="reco-name">' +
        esc(item.name) +
        '</div>' +
        '<div class="reco-foot"><span class="reco-price">₹' +
        item.price +
        '</span>' +
        '<button class="reco-add" onclick="event.stopPropagation();addCart(\'' +
        item.name.replace(/'/g, "\\'") +
        "'," +
        item.price +
        ',event)">+</button></div></div></div>'
      );
    })
    .join('');
}
function scrollToMenuItem(name) {
  currentCat = 'All';
  menuSearchQuery = name.toLowerCase();
  var searchInput = document.getElementById('menu-search');
  if (searchInput) searchInput.value = name;
  renderMenu();
  var grid = document.getElementById('menu-grid');
  if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function filterCat(cat) {
  currentCat = cat;
  renderMenu();
}

// ===== ITEM DETAIL POPUP (+ "Customers Also Liked" cross-sell) =====
var _detailItemId = null;
var _detailQty = 1;
function openItemDetail(id) {
  var item = getMenu().find(function (i) {
    return i.id === id;
  });
  if (!item) return;
  _detailItemId = id;
  _detailQty = 1;
  var modal = document.getElementById('item-detail-modal');
  if (!modal) return;
  var imgSrc = item.imgUrl || item.imgData || '';
  var imgWrap = document.getElementById('id-img-wrap');
  imgWrap.innerHTML = imgSrc
    ? '<img src="' +
      imgSrc +
      '" alt="' +
      esc(item.name) +
      '" style="width:100%;height:100%;object-fit:cover;">'
    : '<div class="mc-noimg" style="height:100%;"><span class="mc-noimg-letter" style="font-size:2.4rem;">' +
      esc((item.name || '?').charAt(0).toUpperCase()) +
      '</span><span class="mc-noimg-label">Photo coming soon</span></div>';
  document.getElementById('id-veg-icon').className = 'vi ' + (item.veg ? 'v' : 'nv');
  document.getElementById('id-name').textContent = item.name;
  document.getElementById('id-desc').textContent = item.desc || '';
  document.getElementById('id-price').textContent = '₹' + item.price;
  var isBestseller = BESTSELLERS.includes(item.name) || item.bestseller === true;
  document.getElementById('id-bestseller-tag').style.display = isBestseller ? '' : 'none';
  document.getElementById('id-qty-display').textContent = _detailQty;
  renderAlsoLiked(item);
  modal.style.display = 'flex';
}
function closeItemDetail() {
  var modal = document.getElementById('item-detail-modal');
  if (modal) modal.style.display = 'none';
  _detailItemId = null;
}
function changeDetailQty(delta) {
  _detailQty = Math.max(1, _detailQty + delta);
  document.getElementById('id-qty-display').textContent = _detailQty;
}
function addFromItemDetail() {
  var item = getMenu().find(function (i) {
    return i.id === _detailItemId;
  });
  if (!item) return;
  if (!cart[item.name]) cart[item.name] = { qty: 0, price: item.price };
  cart[item.name].qty += _detailQty;
  updateCartBar();
  updateMenuCardQtyInPlace(item.name);
  showToast(item.name + ' added! 🛒 (' + _detailQty + 'x)', 'orange');
  closeItemDetail();
}
function renderAlsoLiked(currentItem) {
  var rail = document.getElementById('id-also-liked-rail');
  var wrap = document.getElementById('id-also-liked-wrap');
  if (!rail || !wrap) return;
  var items = getMenu().filter(function (i) {
    return i.available !== false && i.id !== currentItem.id;
  });
  var sameCat = items.filter(function (i) {
    return i.cat === currentItem.cat;
  });
  var picks = sameCat.length >= 3 ? sameCat : items;
  // Shuffle-ish: prioritize bestsellers first, then rest, cap at 4
  picks = picks
    .slice()
    .sort(function (a, b) {
      var aBest = BESTSELLERS.includes(a.name) || a.bestseller === true ? 1 : 0;
      var bBest = BESTSELLERS.includes(b.name) || b.bestseller === true ? 1 : 0;
      return bBest - aBest;
    })
    .slice(0, 4);
  if (!picks.length) {
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = '';
  rail.innerHTML = picks
    .map(function (item) {
      var imgSrc = item.imgUrl || item.imgData || '';
      var imgHtml = imgSrc
        ? '<img src="' + imgSrc + '" alt="' + esc(item.name) + '">'
        : '<div class="mc-noimg" style="height:100%;"><span class="mc-noimg-letter" style="font-size:1.4rem;">' +
          esc((item.name || '?').charAt(0).toUpperCase()) +
          '</span></div>';
      return (
        '<div class="reco-card" style="width:130px;" onclick="openItemDetail(' +
        item.id +
        ')">' +
        '<div class="reco-img" style="height:80px;">' +
        imgHtml +
        '</div>' +
        '<div class="reco-body" style="padding:0.5rem 0.6rem 0.6rem;"><div class="reco-name" style="font-size:0.72rem;min-height:1.9em;">' +
        esc(item.name) +
        '</div>' +
        '<div class="reco-foot"><span class="reco-price" style="font-size:0.82rem;">₹' +
        item.price +
        '</span>' +
        '<button class="reco-add" style="width:24px;height:24px;font-size:0.85rem;" onclick="event.stopPropagation();addCart(\'' +
        item.name.replace(/'/g, "\\'") +
        "'," +
        item.price +
        ',event)">+</button></div></div></div>'
      );
    })
    .join('');
}

/* ================================================
   ★ OFFERS SECTION
   ================================================ */
function renderOffers() {
  var adminOffers = lsGet('ak_offers', []);
  var colorMap = {
    red: 'linear-gradient(135deg,#E23744,#a0222e)',
    orange: 'linear-gradient(135deg,#FF6B00,#FF8C00)',
    green: 'linear-gradient(135deg,#25D366,#0e8f47)',
    forest: 'linear-gradient(135deg,#1B4332,#2D6A4F)',
  };
  var defaults = [
    {
      title: 'Welcome Offer',
      code: 'WELCOME' + getWelcomeCouponAmt(),
      disc: '₹' + getWelcomeCouponAmt() + ' OFF',
      min: getWelcomeCouponMin(),
      color: 'orange',
      desc: 'New customer? Register & get ₹' + getWelcomeCouponAmt() + ' off first order!',
      active: true,
    },
    {
      title: 'Free Delivery',
      code: 'FREEDEL',
      disc: 'FREE DELIVERY',
      min: 399,
      color: 'forest',
      desc: 'Order above ₹399 and get free delivery!',
      active: true,
    },
    {
      title: 'WhatsApp Special',
      code: 'WA50',
      disc: '₹50 OFF',
      min: 300,
      color: 'green',
      desc: 'Order on WhatsApp & save ₹50!',
      active: true,
    },
    {
      title: 'Weekend Special',
      code: 'WEEKEND',
      disc: 'BUY 2 GET 1',
      min: 0,
      color: 'red',
      desc: 'Sat-Sun: Buy 2 mains, get 1 drink free!',
      active: true,
    },
  ];
  var offers = adminOffers.filter(function (o) {
    return o.active;
  }).length
    ? adminOffers.filter(function (o) {
        return o.active;
      })
    : defaults;
  var grid = document.getElementById('offers-grid');
  if (!grid) return;
  grid.innerHTML = offers
    .map(function (o) {
      var bg = colorMap[o.color] || colorMap.orange;
      return (
        '<div class="offer-card"><div class="offer-top" style="background:' +
        bg +
        '"><span class="offer-big">' +
        esc(o.disc) +
        '</span><span class="offer-sm">Min order: ₹' +
        o.min +
        '</span></div>' +
        '<div class="offer-bot"><h3>' +
        esc(o.title) +
        '</h3><p>' +
        esc(o.desc) +
        '</p>' +
        '<div class="offer-code">' +
        esc(o.code) +
        '</div><br>' +
        '<button class="copy-btn" onclick="copyOffer(\'' +
        esc(o.code) +
        '\',this)">Copy Code</button></div></div>'
      );
    })
    .join('');
  // Also update coupon chips in cart
  var chips = document.getElementById('coupon-chips');
  if (chips) {
    chips.innerHTML = offers
      .map(function (o) {
        return (
          '<button onclick="tapCoupon(\'' +
          esc(o.code) +
          '\')" style="padding:6px 14px;background:var(--saffron-light);border:1.5px solid var(--saffron);border-radius:50px;font-size:0.72rem;font-weight:800;cursor:pointer;font-family:\'Nunito\',sans-serif;color:var(--deep-brown);">' +
          esc(o.code) +
          '</button>'
        );
      })
      .join('');
  }
}

/* ================================================
   ★ CART SYSTEM
   ================================================ */
var cart = {};
var appliedCoupon = null;
var currentStep = 1;

var COUPONS = {
  WELCOME20: { type: 'percent', value: 20, min: 200, maxDisc: 100, label: '20% OFF (Max ₹100)' },
  FREEDEL: { type: 'delivery', value: 0, min: 0, maxDisc: 999, label: 'Free Delivery' },
  WA50: { type: 'flat', value: 50, min: 300, maxDisc: 50, label: '₹50 OFF' },
  WEEKEND: { type: 'flat', value: 40, min: 200, maxDisc: 40, label: '₹40 OFF (Weekend)' },
  GUEST5: { type: 'flat', value: 5, min: 0, maxDisc: 5, label: '₹5 OFF — Guest Discount' },
};
// FIX: Admin settings se jo bhi welcome coupon amount ho (default 100), uska code bhi add karo
(function () {
  var amt = getWelcomeCouponAmt();
  var min = getWelcomeCouponMin();
  var dynamicKey = 'WELCOME' + amt;
  if (!COUPONS[dynamicKey]) {
    COUPONS[dynamicKey] = {
      type: 'flat',
      value: amt,
      min: min,
      maxDisc: amt,
      label: '\u20b9' + amt + ' OFF (Welcome Offer)',
    };
  }
})();
