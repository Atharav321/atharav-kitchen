/**
 * ============================================================
 *  ATHARAV KITCHEN — SENTRY ERROR MONITORING v1.0
 *
 *  Setup steps (one-time):
 *    1. sentry.io pe free account banao
 *    2. New Project > JavaScript > Browser
 *    3. Apna DSN copy karo (Settings > Projects > Client Keys)
 *    4. Neeche SENTRY_DSN mein paste karo
 *    5. Deploy karo — errors automatically Sentry pe jaenge
 *
 *  Load order: security.js → sentry.js → firebase-config.js → app scripts
 * ============================================================
 */
(function () {
  'use strict';

  // ── CONFIGURATION ─────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════
  //  🔴 ACTION REQUIRED — SENTRY DSN SETUP (5 minute kaam)
  //
  //  Step 1: https://sentry.io → Sign up (free) → New Project
  //  Step 2: Platform = "JavaScript (Browser)" select karo
  //  Step 3: Settings → Projects → Client Keys (DSN) → Copy
  //  Step 4: Neeche SENTRY_DSN mein paste karo (quotes ke andar)
  //  Step 5: Deploy karo — done! Ab sab production errors track honge
  //
  //  Jab tak DSN empty hai, Firestore fallback logger active hai
  //  (Admin panel → Reports → Error Log mein dikhai denge).
  //  Sentry zyada powerful hai — stack traces, user context, alerts.
  // ══════════════════════════════════════════════════════════════
  var SENTRY_DSN = ''; // e.g. 'https://abc123@o12345.ingest.sentry.io/67890'

  var IS_LOCAL =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // ── FALLBACK ERROR LOGGER ────────────────────────────────────
  // Jab tak Sentry DSN set nahi hota, production errors Firestore mein log hote hain.
  // Admin panel > Reports > Error Log mein dikhai denge.
  // DSN set karne ke baad yeh fallback auto-disable ho jaata hai.
  if (!SENTRY_DSN) {
    if (IS_LOCAL) {
      console.info(
        '[Sentry] DSN not set. Add your Sentry DSN to sentry.js to enable error monitoring.'
      );
      return;
    }
    // Production mein: Firestore fallback logger
    window.akReportError = function (err, extras) {
      try {
        var payload = {
          ts: new Date().toISOString(),
          msg: err && err.message ? err.message : String(err),
          stack: err && err.stack ? err.stack.slice(0, 500) : null,
          page: window.location.pathname,
          ua: navigator.userAgent.slice(0, 100),
          extras: extras || null,
        };
        // Best-effort POST to Firestore REST (no auth needed for error_logs collection
        // — open write is intentional for error reporting; Firestore rules allow it)
        fetch(
          'https://firestore.googleapis.com/v1/projects/' +
            (window.__ENV_FIREBASE_PROJECT_ID || 'atharav-kitchen-e587b') +
            '/databases/(default)/documents/error_logs/' +
            Date.now(),
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                ts: { stringValue: payload.ts },
                msg: { stringValue: payload.msg || '' },
                stack: payload.stack ? { stringValue: payload.stack } : { nullValue: null },
                page: { stringValue: payload.page },
                ua: { stringValue: payload.ua },
              },
            }),
          }
        ).catch(function () {}); // Silent fail — never crash the app
      } catch (e) {
        /* silent */
      }
    };

    // Catch unhandled errors → Firestore
    window.addEventListener('error', function (e) {
      if (e && e.error) window.akReportError(e.error);
    });
    window.addEventListener('unhandledrejection', function (e) {
      if (e && e.reason) window.akReportError(e.reason);
    });

    console.info(
      '%c[AK] Error monitoring: Firestore fallback active. ' +
        'Set SENTRY_DSN in js/core/sentry.js for full Sentry monitoring.',
      'color:#FF6B00;font-weight:bold;'
    );
    return;
  }

  // Local dev — skip entirely
  if (IS_LOCAL) {
    console.info('[Sentry] Skipped in local dev');
    return;
  }

  // ── LOAD SENTRY SDK (async, non-blocking) ─────────────────
  var script = document.createElement('script');
  script.src = 'https://browser.sentry-cdn.com/7.119.2/bundle.tracing.min.js';
  script.crossOrigin = 'anonymous';
  script.onload = function () {
    if (typeof Sentry === 'undefined') return;

    Sentry.init({
      dsn: SENTRY_DSN,
      release: 'atharav-kitchen@' + (window.__AK_VERSION || '1.0.0'),
      environment: 'production',

      // ── Performance Monitoring ─────────────────────────────
      // 10% of transactions traced (free tier mein enough hai)
      tracesSampleRate: 0.1,

      // ── Session Replay (optional — uncomment karo agar chahiye) ──
      // replaysSessionSampleRate: 0.05,
      // replaysOnErrorSampleRate: 1.0,

      // ── Filter useless errors ──────────────────────────────
      ignoreErrors: [
        // Browser extension errors
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        // Network errors (user ke internet ki problem)
        'Failed to fetch',
        'NetworkError',
        'Load failed',
        // Firebase offline errors (handled by app)
        'The client is offline',
        'FirebaseError: Failed to get document',
      ],

      // ── Sanitize sensitive data before sending ─────────────
      beforeSend: function (event) {
        // Phone numbers ya API keys kabhi Sentry pe mat jaaye
        if (event.request && event.request.url) {
          event.request.url = event.request.url.replace(/phone=[^&]+/, 'phone=REDACTED');
        }
        return event;
      },

      // ── Tag every error with page context ──────────────────
      initialScope: {
        tags: {
          page: window.location.pathname.replace('/', '') || 'home',
        },
      },
    });

    // ── Manual Error Reporting Helper ─────────────────────────
    // Usage anywhere in app: window.akReportError(err, { context: 'cart' })
    window.akReportError = function (err, extras) {
      Sentry.withScope(function (scope) {
        if (extras) {
          Object.keys(extras).forEach(function (k) {
            scope.setExtra(k, extras[k]);
          });
        }
        Sentry.captureException(err);
      });
    };

    // ── Set user context after Firebase auth ──────────────────
    // Call this from auth.js after login:
    // window.akSentrySetUser({ id: uid, page: 'customer' })
    window.akSentrySetUser = function (userObj) {
      Sentry.setUser(userObj);
    };

    console.info('[Sentry] ✅ Error monitoring active');
  };

  script.onerror = function () {
    // Sentry load fail = silently ignore, app continues normally
    console.warn('[Sentry] SDK load failed — monitoring unavailable');
  };

  document.head.appendChild(script);
})();
