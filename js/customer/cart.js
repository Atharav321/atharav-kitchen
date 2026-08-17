/**
 * ============================================================
 *  ATHARAV KITCHEN — cart.js
 *
 *  Responsibility: Cart state management
 *    - Add / remove / update item quantity
 *    - Cart total, delivery charge, coupon discount calculation
 *    - Cart UI render (sidebar + badge)
 *    - localStorage persistence of cart across page refresh
 *
 *  Depends on: core.js (showToast, formatRupee)
 *  Used by:    orders.js (reads cart on order placement)
 *  Global API: addToCart(id), removeFromCart(id), clearCart(),
 *              getCartTotal(), getCartItems()
 * ============================================================
 */
function addCart(name, price, e) {
  if (!cart[name]) cart[name] = { qty: 0, price: price };
  cart[name].qty++;
  updateCartBar();
  updateMenuCardQtyInPlace(name);
  showToast(name + ' added! 🛒', 'orange');
}
function changeQty(name, price, delta, e) {
  if (e) e.stopPropagation();
  if (!cart[name]) cart[name] = { qty: 0, price: price };
  cart[name].qty += delta;
  if (cart[name].qty <= 0) delete cart[name];
  updateCartBar();
  updateMenuCardQtyInPlace(name);
  if (document.getElementById('cart-modal').style.display !== 'none') {
    renderCartItems();
    updateStep1Summary();
  }
}
function updateCartBar() {
  var count = Object.values(cart).reduce(function (s, i) {
    return s + i.qty;
  }, 0);
  var total = Object.values(cart).reduce(function (s, i) {
    return s + i.qty * i.price;
  }, 0);
  document.getElementById('c-count').textContent = count;
  document.getElementById('c-total').textContent = total;
  document.getElementById('cartbar').style.display = count > 0 ? 'flex' : 'none';
  updateCheckoutLockUI();
  saveCartToStorage();
}
// Cart persistence — survives page refresh / back-button (previously
// lived only in memory and was silently wiped, a direct loss of sales).
// Expires after 6 hours so a very old cart doesn't resurrect with
// outdated prices/unavailable items.
function saveCartToStorage() {
  lsSet('ak_cart', { items: cart, savedAt: Date.now() });
}
function restoreCartFromStorage() {
  var saved = lsGet('ak_cart', null);
  if (!saved || !saved.items) return;
  var MAX_AGE_MS = 6 * 60 * 60 * 1000;
  if (!saved.savedAt || Date.now() - saved.savedAt > MAX_AGE_MS) {
    localStorage.removeItem('ak_cart');
    return;
  }
  cart = saved.items;
  updateCartBar();
}
var MIN_ORDER = 0;

function openCartModal() {
  if (Object.keys(cart).length === 0) {
    showToast('Cart is empty! Add items first.', 'red');
    return;
  }
  if (!deliveryRadiusChecked) checkUserDeliveryRadius();
  // Upsell check
  var subtotal = Object.values(cart).reduce(function (s, i) {
    return s + i.qty * i.price;
  }, 0);
  checkUpsell(subtotal);
  document.getElementById('cart-modal').style.display = 'block';
  document.body.classList.add('modal-open');
  document.body.style.top = '-' + window.scrollY + 'px';
  trackCartOpen(); // GA4
  goStep(1);
}
function closeCartModal() {
  var scrollY = document.body.style.top;
  document.getElementById('cart-modal').style.display = 'none';
  document.body.classList.remove('modal-open');
  document.body.style.top = '';
  window.scrollTo(0, parseInt(scrollY || '0') * -1);
  if (currentStep < 4 && Object.keys(cart).length > 0) {
    trackCheckoutDrop(currentStep); // GA4
  }
  if (cartAbandonTimer) {
    clearTimeout(cartAbandonTimer);
    cartAbandonTimer = null;
  }
}
function addMoreItems() {
  closeCartModal();
  document.getElementById('menu').scrollIntoView({ behavior: 'smooth' });
}

function goStep(n) {
  if (n === 2 || n === 3 || n === 4) {
    var subtotal = Object.values(cart).reduce(function (s, i) {
      return s + i.qty * i.price;
    }, 0);
    if (subtotal < MIN_ORDER) {
      showUpsellBanner(subtotal);
      return;
    }
  }
  if (n === 4) {
    if (!deliveryRadiusChecked) {
      showToast('Verifying your distance from our kitchen…', 'orange');
      checkUserDeliveryRadius();
      return;
    }
    if (withinDeliveryRadius === false) {
      showToast('Sorry — sirf 5km delivery range hai Dhanbad mein. 😔', 'red');
      return;
    }
    var name = (document.getElementById('ord-name').value || '').trim();
    var phone = (document.getElementById('ord-phone').value || '').trim();
    var addr = (document.getElementById('ord-address').value || '').trim();
    if (!name || !phone || !addr) {
      showToast('Name, Phone & Address fill karo!', 'red');
      return;
    }
    if (phone.replace(/\D/g, '').replace(/^0+/, '').length !== 10) {
      showToast('Valid 10-digit phone number daalo!', 'red');
      return;
    }
  }
  currentStep = n;
  [1, 2, 3, 4].forEach(function (i) {
    var el = document.getElementById('cart-step-' + i);
    if (el) el.style.display = i === n ? 'block' : 'none';
    var ind = document.getElementById('step-ind-' + i);
    if (ind) {
      ind.style.color = i < n ? '#16A34A' : i === n ? '#FF6B00' : '#CCC';
    }
  });
  if (n === 1) {
    renderCartItems();
    updateStep1Summary();
  }
  if (n === 2) {
    renderOffers();
  } // refresh coupon chips
  if (n === 3) {
    // Show safety note for guest users
    var safeNote = document.getElementById('guest-safety-note');
    if (safeNote) safeNote.style.display = isGuestOrder() ? 'block' : 'none';
  }
  if (n === 4) {
    renderFinalBill();
    updateCheckoutLockUI();
  }
}

function renderCartItems() {
  var list = document.getElementById('cart-items-list');
  var items = Object.entries(cart);
  if (!items.length) {
    list.innerHTML =
      '<div style="text-align:center;padding:2rem;color:#A08060;"><div style="font-size:3rem;">🛒</div><p style="font-weight:600;margin-top:0.5rem;">Cart is empty</p></div>';
    return;
  }
  list.innerHTML = items
    .map(function (e) {
      var n = e[0],
        it = e[1];
      return (
        '<div style="display:flex;align-items:center;padding:0.8rem 0;border-bottom:1px solid #F5EDE5;">' +
        '<div style="flex:1;"><div style="font-size:0.88rem;font-weight:700;color:#2D1A00;">' +
        esc(n) +
        '</div>' +
        '<div style="font-size:0.75rem;color:#A08060;margin-top:1px;">₹' +
        it.price +
        ' each</div></div>' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        '<button onclick="changeQty(\'' +
        n.replace(/'/g, "\\'") +
        "'," +
        it.price +
        ',-1)" style="width:28px;height:28px;border-radius:50%;background:#FF6B00;color:#fff;border:none;font-size:1.1rem;font-weight:800;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;">−</button>' +
        '<span style="font-weight:800;font-size:0.95rem;color:#2D1A00;min-width:22px;text-align:center;">' +
        it.qty +
        '</span>' +
        '<button onclick="changeQty(\'' +
        n.replace(/'/g, "\\'") +
        "'," +
        it.price +
        ',1)" style="width:28px;height:28px;border-radius:50%;background:#FF6B00;color:#fff;border:none;font-size:1.1rem;font-weight:800;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;">+</button>' +
        '<span style="font-weight:800;font-size:0.9rem;color:#FF6B00;min-width:52px;text-align:right;">₹' +
        it.qty * it.price +
        '</span></div></div>'
      );
    })
    .join('');
  renderUpsellBox();
}
function renderUpsellBox() {
  var box = document.getElementById('cart-upsell-box');
  if (!box) return;
  var menu = getMenu();
  var inCart = Object.keys(cart);
  if (!inCart.length) {
    box.innerHTML = '';
    return;
  }
  // Bestseller/high-orderCount items jo cart mein nahi hain, unme se top 2 suggest karo
  // (orderCount/bestseller flags admin ke "Menu Intelligence Sync" se aate hain)
  var suggestions = menu
    .filter(function (i) {
      return (
        i.available !== false &&
        inCart.indexOf(i.name) === -1 &&
        (i.bestseller === true || BESTSELLERS.includes(i.name))
      );
    })
    .sort(function (a, b) {
      return (b.orderCount || 0) - (a.orderCount || 0);
    })
    .slice(0, 2);
  if (!suggestions.length) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML =
    '<div style="font-size:0.72rem;font-weight:800;color:var(--text-light,#A08060);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">🔥 Log ye bhi order karte hain</div>' +
    suggestions
      .map(function (i) {
        var thumbSrc = i.imgUrl || i.imgData || '';
        var thumbHtml = thumbSrc
          ? '<img src="' +
            thumbSrc +
            '" style="width:22px;height:22px;border-radius:6px;object-fit:cover;display:inline-block;vertical-align:middle;margin-right:4px;">'
          : '';
        return (
          '<div style="display:flex;align-items:center;justify-content:space-between;background:#FFF7ED;border:1.5px solid #FFE4C4;border-radius:10px;padding:8px 12px;margin-bottom:6px;">' +
          '<span style="font-size:0.82rem;font-weight:700;color:#2D1A00;">' +
          thumbHtml +
          esc(i.name) +
          ' <span style="color:#FF6B00;">₹' +
          i.price +
          '</span></span>' +
          '<button onclick="addCart(\'' +
          i.name.replace(/'/g, "\\'") +
          "'," +
          i.price +
          ',event)" style="background:#FF6B00;color:#fff;border:none;border-radius:8px;padding:5px 12px;font-size:0.76rem;font-weight:800;cursor:pointer;">+ Add</button>' +
          '</div>'
        );
      })
      .join('');
}

function updateStep1Summary() {
  var bill = calcBill();
  var s1s = document.getElementById('s1-subtotal');
  var s1d = document.getElementById('s1-delivery');
  if (s1s) s1s.textContent = '₹' + bill.subtotal;
  if (s1d) {
    s1d.textContent = bill.delivery === 0 ? 'FREE' : '₹' + bill.delivery;
    s1d.style.color = bill.delivery === 0 ? '#16A34A' : '#5C3A1E';
  }
  var di = document.getElementById('delivery-info-text');
  if (di)
    di.textContent =
      bill.subtotal >= 399
        ? '✅ You got free delivery!'
        : 'Add ₹' + (399 - bill.subtotal) + ' more for free delivery';
}

function calcBill() {
  var subtotal = Object.values(cart).reduce(function (s, i) {
    return s + i.qty * i.price;
  }, 0);
  var discount = 0;
  var freeDeliveryCoupon = false;
  var walletDiscount = 0;

  if (appliedCoupon) {
    // ── SERVER-VALIDATED DISCOUNT (tamper-proof) ──────────────────
    // Agar Worker se validate hua hai, us value ko directly use karo.
    // COUPONS object par depend mat karo — user browser mein edit kar sakta hai.
    if (typeof serverValidatedDiscount !== 'undefined' && serverValidatedDiscount && typeof serverValidatedDiscount.discount === 'number') {
      if (serverValidatedDiscount.type === 'delivery') {
        freeDeliveryCoupon = true;
      } else {
        discount = serverValidatedDiscount.discount;
      }
    } else if (COUPONS[appliedCoupon]) {
      // ── CLIENT-SIDE FALLBACK (offline / Worker not configured) ──
      var c = COUPONS[appliedCoupon];
      if (c.type === 'percent')
        discount = Math.min(Math.round((subtotal * c.value) / 100), c.maxDisc);
      else if (c.type === 'flat') discount = Math.min(c.value, subtotal);
      else if (c.type === 'delivery') freeDeliveryCoupon = true;
    }
  }
  if (walletApplied && !appliedCoupon) {
    walletDiscount = getWalletDiscount(subtotal);
  }
  // Free-delivery threshold is checked against the NET amount (after
  // coupon + wallet discount) — a discount that drops the effective
  // order below ₹399 should not also grant free delivery on top of that.
  var netForDeliveryCheck = subtotal - discount - walletDiscount;
  var delivery = freeDeliveryCoupon || netForDeliveryCheck >= 399 ? 0 : 30;
  var gst = Math.round((subtotal - discount - walletDiscount) * 0.05);
  var total = Math.max(0, subtotal - discount - walletDiscount + delivery + gst);
  return {
    subtotal: subtotal,
    delivery: delivery,
    discount: discount,
    walletDiscount: walletDiscount,
    gst: gst,
    total: total,
  };
}
