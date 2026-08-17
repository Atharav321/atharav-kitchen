# Atharav Kitchen — Testing Guide
**Version:** v1.0 | **Date:** August 2026

---

## Phase 5 — Testing Reality Check

| Test Type | Code mein possible? | Tool | Action |
|-----------|-------------------|------|--------|
| Cross-browser | ❌ Real browsers chahiye | BrowserStack / manual | Neeche dekho |
| Cross-device | ❌ Real devices chahiye | Chrome DevTools / real phone | Neeche dekho |
| Load testing | ✅ Config file banaya | k6 (free) | `npm run load-test` |
| Regression | ✅ Checklist hai | Manual + QA-CHECKLIST.md | Neeche dekho |

---

## 18. Cross-Browser Testing Checklist

**Minimum required browsers (test on staging URL first):**

| Browser | Version | Platform | Status |
|---------|---------|----------|--------|
| Chrome | Latest | Windows/Android | |
| Safari | Latest | iPhone/iPad | |
| Firefox | Latest | Windows | |
| Samsung Internet | Latest | Android | |
| Edge | Latest | Windows | |

**What to test in each browser:**
1. Homepage loads, hero section correct
2. Login (OTP + Google Sign-In)
3. Menu displays, images load
4. Add to cart, coupon apply
5. Order placement → WhatsApp message
6. Chatbot opens + types
7. Fonts render correctly (Playfair + Nunito)
8. CSS variables (colors consistent)

**Free tools:**
- [browserstack.com](https://browserstack.com) — Free trial (1 hour)  
- Chrome DevTools → Toggle device toolbar (Ctrl+Shift+M) for mobile simulation
- [lambdatest.com](https://lambdatest.com) — Free 100 minutes/month

---

## 19. Cross-Device Testing Checklist

**Screen sizes to verify:**

| Device Type | Width | Test Priority |
|-------------|-------|--------------|
| iPhone SE | 375px | 🔴 High |
| iPhone 14 | 390px | 🔴 High |
| Android mid-range | 412px | 🔴 High |
| iPad | 768px | 🟡 Medium |
| Desktop 1080p | 1920px | 🟢 Normal |

**Device-specific checks:**
- iOS Safari: bottom nav bar doesn't cover checkout button
- Android Chrome: PWA "Add to Home Screen" prompt appears
- Slow 3G (DevTools → Network throttle): page usable within 5s
- Touch targets: all buttons ≥ 44×44px

---

## 20. Load Testing — k6 Script

**Install k6:**
```bash
# Ubuntu/Debian
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Mac
brew install k6

# OR just use k6 Cloud free tier: app.k6.io
```

**Run load test:**
```bash
npm run load-test
# OR
k6 run build/load-test.js
```

**Expected results (Cloudflare Pages = CDN = handles load easily):**
- 100 concurrent users: response time < 200ms (static files from edge)
- Firebase Firestore: bottleneck is auth-required operations (orders, menu)
- Alert if p95 latency > 1000ms

---

## 21. Full Regression Test

Run `docs/QA-CHECKLIST.md` — all 7 flows × 50+ test cases.

**Before EVERY deploy to main:**
1. `npm test` — ESLint + Prettier (automated)
2. Manual QA on staging URL — 20 min
3. Sentry dashboard — no spike in errors
4. Core Web Vitals — pagespeed.web.dev score ≥ 70

