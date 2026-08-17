/**
 * ============================================================
 *  ATHARAV KITCHEN — tracking.js
 *
 *  Responsibility: Live order tracking
 *    - Real-time Firestore listener for order status
 *    - Status progress bar UI update
 *    - Rider name + ETA display
 *    - Track modal open / close
 *
 *  Depends on: core.js, firebase-config.js
 *  Global API: openTrackModal(orderId), closeTrackModal()
 * ============================================================
 */
function openTrackModal() {
  var modal = document.getElementById('track-modal');
  if (!modal) return;
  var lastOrderId = _trackingOrderId || lsGet('ak_last_order_id', null);
  if (!lastOrderId) {
    showToast('Koi active order nahi hai.', 'red');
    return;
  }
  _trackingOrderId = lastOrderId;
  modal.style.display = 'flex';
  var notifyBtn = document.getElementById('track-notify-btn');
  if (notifyBtn) {
    notifyBtn.disabled = false;
    notifyBtn.style.background = '#FFF0E0';
    notifyBtn.style.color = '#FF6B00';
    notifyBtn.style.borderColor = 'var(--saffron)';
    notifyBtn.textContent = '🔔 Order updates ke liye notification allow karo';
  }
  document.getElementById('track-order-id-lbl').textContent = 'Order ID: ' + lastOrderId;
  // Cancel any previous listener
  if (_trackingUnsubscribe) {
    _trackingUnsubscribe();
    _trackingUnsubscribe = null;
  }
  if (_trackingInterval) {
    clearInterval(_trackingInterval);
    _trackingInterval = null;
  }
  if (akFirebaseReady) {
    // REALTIME: onSnapshot — instant update jab bhi admin status change kare
    _trackingUnsubscribe = subscribeOrder(
      lastOrderId,
      function (snap) {
        if (snap.exists) {
          renderTrackingUI(snap.data());
        } else {
          var orders = lsGet('ak_orders', []);
          var o = orders.find(function (x) {
            return x.id === lastOrderId;
          });
          if (o) renderTrackingUI(o);
        }
      },
      function () {
        // Fallback to localStorage if listener fails
        loadAndRenderTracking(lastOrderId);
      }
    );
  } else {
    // Offline fallback: poll every 30s
    loadAndRenderTracking(lastOrderId);
    _trackingInterval = setInterval(function () {
      loadAndRenderTracking(lastOrderId);
    }, 30000);
  }
}

function enablePushForCurrentOrder() {
  var btn = document.getElementById('track-notify-btn');
  var oid = _trackingOrderId;
  if (!oid) {
    showToast('Order track ho raha nahi hai abhi', 'orange');
    return;
  }
  if (!('Notification' in window)) {
    if (btn) btn.textContent = '⚠️ Is browser mein notifications support nahi hain';
    return;
  }
  if (
    !window.akMessaging ||
    !window.AK_VAPID_KEY ||
    window.AK_VAPID_KEY === 'PASTE_YOUR_VAPID_KEY_HERE'
  ) {
    if (btn) btn.textContent = '⚠️ Notifications abhi setup nahi hue hain';
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Allow kar rahe hain...';
  }
  Notification.requestPermission()
    .then(function (perm) {
      if (perm !== 'granted') {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🔔 Notification allow nahi hui — dubara try karo';
        }
        return;
      }
      return window.akMessaging.getToken({ vapidKey: window.AK_VAPID_KEY }).then(function (token) {
        if (!token) throw new Error('No token');
        return updateOrderFcmToken(oid, token);
      });
    })
    .then(function () {
      if (btn) {
        btn.textContent = '✅ Notifications ON — order updates milte rahenge!';
        btn.style.background = '#DCFCE7';
        btn.style.color = '#16A34A';
        btn.style.borderColor = '#16A34A';
        btn.disabled = true;
      }
    })
    .catch(function (e) {
      console.warn('Push enable failed', e);
      if (btn) {
        btn.disabled = false;
        btn.textContent = '⚠️ Kuch gadbad hui, dubara try karo';
      }
    });
}
function closeTrackModal() {
  var modal = document.getElementById('track-modal');
  if (modal) modal.style.display = 'none';
  if (_trackingUnsubscribe) {
    _trackingUnsubscribe();
    _trackingUnsubscribe = null;
  }
  if (_trackingInterval) {
    clearInterval(_trackingInterval);
    _trackingInterval = null;
  }
  if (_etaCountdownInterval) {
    clearInterval(_etaCountdownInterval);
    _etaCountdownInterval = null;
  }
}

function loadAndRenderTracking(orderId) {
  if (akFirebaseReady) {
    getOrderOnce(orderId)
      .then(function (snap) {
        if (snap.exists) {
          renderTrackingUI(snap.data());
        } else {
          // Try localStorage
          var orders = lsGet('ak_orders', []);
          var o = orders.find(function (x) {
            return x.id === orderId;
          });
          if (o) renderTrackingUI(o);
          else
            document.getElementById('track-steps').innerHTML =
              '<div style="text-align:center;color:#A08060;padding:1rem;">Order details nahi mile. Order ID check karo.</div>';
        }
      })
      .catch(function () {
        var orders = lsGet('ak_orders', []);
        var o = orders.find(function (x) {
          return x.id === orderId;
        });
        if (o) renderTrackingUI(o);
      });
  } else {
    var orders = lsGet('ak_orders', []);
    var o = orders.find(function (x) {
      return x.id === orderId;
    });
    if (o) renderTrackingUI(o);
    else
      document.getElementById('track-steps').innerHTML =
        '<div style="text-align:center;color:#A08060;padding:1rem;">Order ' +
        orderId +
        ' nahi mila localStorage mein.</div>';
  }
}

function renderTrackingUI(order) {
  var status = order.status || 'New';
  var statusOrder = ['New', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];
  var currentIdx = statusOrder.indexOf(status);

  // Order finished (delivered/cancelled) — stop persisting/resurrecting this
  // tracker on future page loads, and hide the floating "Track Order" button.
  if (status === 'Delivered' || status === 'Cancelled') {
    var savedId = lsGet('ak_last_order_id', null);
    if (savedId === (order.id || order.orderId || _trackingOrderId)) {
      localStorage.removeItem('ak_last_order_id');
      localStorage.removeItem('ak_last_order_ts');
    }
    var fabEl = document.getElementById('track-order-fab');
    if (fabEl) fabEl.style.display = 'none';
  }

  // Render steps
  var stepsHtml = '';
  TRACK_STEPS.forEach(function (step, i) {
    var stepIdx = statusOrder.indexOf(step.key);
    var isDone = stepIdx < currentIdx;
    var isActive = step.key === status;
    var cls = isDone ? 'done' : isActive ? 'active' : '';
    stepsHtml += '<div class="track-step ' + cls + '">';
    stepsHtml +=
      '<div class="track-step-dot">' + (isDone ? '✓' : isActive ? step.icon : step.icon) + '</div>';
    stepsHtml += '<div class="track-step-info">';
    stepsHtml += '<div class="track-step-title">' + step.title + '</div>';
    stepsHtml += '<div class="track-step-sub">' + step.sub + '</div>';
    stepsHtml += '</div></div>';
  });

  // Cancelled state
  if (status === 'Cancelled') {
    stepsHtml =
      '<div style="text-align:center;padding:1.5rem;color:#DC2626;"><div style="font-size:2rem;">❌</div><div style="font-weight:800;margin-top:8px;">Order Cancel Hua</div><div style="font-size:0.82rem;margin-top:4px;">Agar koi issue hai to humse contact karo.</div></div>';
  }

  document.getElementById('track-steps').innerHTML = stepsHtml;

  // LIVE ETA COUNTDOWN — ticks down every second instead of a static range
  var etaSubMap = {
    New: 'Order abhi receive hua hai',
    Confirmed: 'Kitchen mein preparation shuru hogi',
    Preparing: 'Chef aapka khana bana raha hai 🍳',
    'Out for Delivery': 'Rider aapke raste mein hai! 🛵',
    Delivered: 'Thank you for ordering! Rate us ⭐',
    Cancelled: 'Order cancelled hai',
  };
  // Total estimated minutes remaining from NOW for each status stage —
  // used as an upper-bound; the countdown only ever tightens, never grows.
  var etaMinsFromNowMap = {
    New: 42,
    Confirmed: 35,
    Preparing: 25,
    'Out for Delivery': 13,
  };
  var etaEl = document.getElementById('track-eta');
  var etaSubEl = document.getElementById('track-eta-sub');
  var oid = order.id || order.orderId || _trackingOrderId || 'order';
  if (_etaCountdownInterval) {
    clearInterval(_etaCountdownInterval);
    _etaCountdownInterval = null;
  }
  if (status === 'Delivered' || status === 'Cancelled') {
    if (etaEl) etaEl.textContent = status === 'Delivered' ? 'Delivered! 🎉' : '—';
    if (etaSubEl) etaSubEl.textContent = etaSubMap[status] || '';
    delete _etaTargetByOrderId[oid];
  } else {
    var candidateTarget = Date.now() + (etaMinsFromNowMap[status] || 35) * 60000;
    var existingTarget = _etaTargetByOrderId[oid];
    // Only tighten the promise (order can get "closer", never "further")
    var target = existingTarget ? Math.min(existingTarget, candidateTarget) : candidateTarget;
    _etaTargetByOrderId[oid] = target;
    if (etaSubEl) etaSubEl.textContent = etaSubMap[status] || '';
    var tickEta = function () {
      var remainingMs = target - Date.now();
      if (remainingMs <= 0) {
        if (etaEl) etaEl.textContent = 'Any moment now! 🍽️';
        clearInterval(_etaCountdownInterval);
        _etaCountdownInterval = null;
        return;
      }
      var mins = Math.floor(remainingMs / 60000);
      var secs = Math.floor((remainingMs % 60000) / 1000);
      if (etaEl) etaEl.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs + ' min';
    };
    tickEta();
    _etaCountdownInterval = setInterval(tickEta, 1000);
  }

  // Show rider card if assigned
  var riderCard = document.getElementById('track-rider-card');
  if (order.deliveredBy && (status === 'Out for Delivery' || status === 'Preparing')) {
    if (riderCard) riderCard.style.display = 'block';
    var riderName = document.getElementById('track-rider-name');
    var riderPhone = document.getElementById('track-rider-phone');
    var riderCall = document.getElementById('track-rider-call');
    if (riderName) riderName.textContent = '🛵 ' + order.deliveredBy;
    // Rider phone comes straight from the live order document (set by
    // admin when assigning the rider) — never from local device storage,
    // which a customer's own browser would never have populated.
    if (riderPhone)
      riderPhone.textContent = order.riderPhone ? '+91 ' + order.riderPhone : 'Rider assigned';
    if (riderCall) {
      if (order.riderPhone)
        riderCall.href = 'tel:+91' + String(order.riderPhone).replace(/[^0-9]/g, '');
      else riderCall.removeAttribute('href');
    }
  } else {
    if (riderCard) riderCard.style.display = 'none';
  }
}

// Show Track Order FAB after order is placed
function showTrackFAB(orderId) {
  _trackingOrderId = orderId;
  lsSet('ak_last_order_id', orderId);
  lsSet('ak_last_order_ts', Date.now());
  var fab = document.getElementById('track-order-fab');
  if (fab) fab.style.display = 'block';
  // Auto-open tracking modal so user sees order status immediately
  setTimeout(function () {
    openTrackModal();
  }, 800);
}

// ── SW MESSAGE LISTENER — Notification click se tracking auto-open ─
// Jab user push notification pe tap kare, SW yeh message bhejta hai
// aur tracking modal automatically khul jaata hai
if (navigator.serviceWorker) {
  navigator.serviceWorker.addEventListener('message', function (event) {
    if (event.data && event.data.type === 'AK_OPEN_TRACKING') {
      var oid = event.data.orderId;
      if (oid) {
        _trackingOrderId = oid;
        lsSet('ak_last_order_id', oid);
        setTimeout(function () { openTrackModal(); }, 500);
      }
    }
  });
}

// ── URL PARAM ?track=ORDERID — Direct tracking link ───────────────
// Notification ya WhatsApp link se aane par auto-open
(function () {
  var params = new URLSearchParams(window.location.search);
  var trackId = params.get('track');
  if (trackId) {
    _trackingOrderId = trackId;
    lsSet('ak_last_order_id', trackId);
    setTimeout(function () { openTrackModal(); }, 1200);
  }
})();

restoreCartFromStorage();
renderMenu();
renderOffers();
checkAuthOnLoad();
checkUserDeliveryRadius();
// Restore tracking FAB if there's a recent, genuinely still-active order
// (verified live against Firestore — never trust the local flag alone,
// since a stale/expired/already-delivered order should not keep coming
// back just because this browser touched it once).
(function () {
  var lastId = lsGet('ak_last_order_id', null);
  var lastTs = lsGet('ak_last_order_ts', null);
  if (!lastId) return;
  // No timestamp (older data from before this fix) OR older than 24 hours
  // → treat as stale, clear it, never show it again.
  var MAX_AGE_MS = 24 * 60 * 60 * 1000;
  if (!lastTs || Date.now() - lastTs > MAX_AGE_MS) {
    localStorage.removeItem('ak_last_order_id');
    localStorage.removeItem('ak_last_order_ts');
    return;
  }
  function showFabIfStillActive(status) {
    if (status === 'Delivered' || status === 'Cancelled') {
      localStorage.removeItem('ak_last_order_id');
      localStorage.removeItem('ak_last_order_ts');
      return;
    }
    setTimeout(function () {
      var fab = document.getElementById('track-order-fab');
      if (fab) fab.style.display = 'block';
      _trackingOrderId = lastId;
    }, 2000);
  }
  if (akFirebaseReady) {
    getOrderOnce(lastId)
      .then(function (snap) {
        if (!snap.exists) {
          // Order doesn't actually exist server-side (e.g. leftover local/test
          // data) — clear it, never show a phantom tracker again.
          localStorage.removeItem('ak_last_order_id');
          localStorage.removeItem('ak_last_order_ts');
          return;
        }
        showFabIfStillActive(snap.data().status);
      })
      .catch(function () {
        /* offline — silently skip, will re-check next load */
      });
  } else {
    window.addEventListener('akFirebaseReady', function retryOnce() {
      window.removeEventListener('akFirebaseReady', retryOnce);
      getOrderOnce(lastId)
        .then(function (snap) {
          if (!snap.exists) {
            localStorage.removeItem('ak_last_order_id');
            localStorage.removeItem('ak_last_order_ts');
            return;
          }
          showFabIfStillActive(snap.data().status);
        })
        .catch(function () {});
    });
  }
})();
// Auto-update copyright year
(function () {
  var yr = new Date().getFullYear();
  var y = document.getElementById('footer-year');
  if (y) y.textContent = yr;
  var y2 = document.getElementById('footer-year-2');
  if (y2) y2.textContent = yr;
})();
// Keyboard accessibility: close modals on Escape
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    if (document.getElementById('cart-modal').style.display !== 'none') closeCartModal();
    if (document.getElementById('auth-overlay').style.display === 'flex') skipAuth();
    if (document.getElementById('offer-popup').style.display === 'flex') closeOfferPopup();
    if (
      document.getElementById('track-modal') &&
      document.getElementById('track-modal').style.display === 'flex' &&
      typeof closeTrackModal === 'function'
    )
      closeTrackModal();
  }
});
// Auto-fill address input scroll — keyboard push fix
document.querySelectorAll('input, textarea, select').forEach(function (el) {
  el.addEventListener('focus', function () {
    var self = this;
    setTimeout(function () {
      self.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  });
});

/* ================================================
   ★ REAL REVIEWS — Firebase se public display
   ================================================ */
