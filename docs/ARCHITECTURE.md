# Atharav Kitchen — Architecture & Scalability Guide
**Version:** v16 | **Date:** August 2026  
**For:** Any developer joining this project in future

---

## 1. Project Philosophy

> "Simple > Clever. Explicit > Magic. Copy-paste > Over-abstraction."

This is a **vanilla JS + Firebase** project with zero build tooling required. No React, no Webpack, no TypeScript. The goal is that any developer familiar with HTML/CSS/JS can read, edit, and deploy this project without learning a framework.

---

## 2. Folder Structure

```
atharav-kitchen/
│
├── index.html                    ← Customer-facing main page
├── blog.html                     ← Blog listing
├── blog-*.html                   ← Individual blog posts
├── admin.html                    ← Admin panel (protected)
├── rider.html                    ← Rider app (protected)
├── privacy-policy.html           ← Legal: Privacy Policy
├── terms.html                    ← Legal: Terms & Conditions
├── start.html                    ← Splash/redirect page
│
├── css/
│   ├── home.css                  ← Customer site styles (scoped: .home-*)
│   ├── admin.css                 ← Admin panel styles (scoped: .ak-admin-*)
│   └── rider.css                 ← Rider app styles (scoped: .ak-rider-*)
│
├── js/
│   ├── core/                     ← Infrastructure (load FIRST, no business logic)
│   │   ├── security.js           ← XSS filter, clickjacking guard, console warning
│   │   ├── sentry.js             ← Error monitoring (async, non-blocking)
│   │   ├── env-config.js         ← Firebase + Maps public keys
│   │   ├── firebase-config.js    ← Firebase SDK init + readiness helpers
│   │   ├── firestoreService.js   ← Shared Firestore CRUD helpers
│   │   ├── analytics.js          ← Google Analytics init
│   │   ├── sw-register.js        ← Service Worker registration
│   │   └── start-redirect.js     ← Splash page redirect
│   │
│   ├── customer/                 ← Customer-facing logic (index.html only)
│   │   ├── core.js               ← Shared helpers: toast, formatRupee, rate-limit, etc.
│   │   ├── auth.js               ← OTP login, Google login, logout, session helpers
│   │   ├── menu.js               ← Menu fetch, render, category filter
│   │   ├── cart.js               ← Cart state, add/remove/quantity, total calc
│   │   ├── orders.js             ← Place order, WhatsApp message, PWA install
│   │   ├── order-history.js      ← Order history display, cancel order
│   │   ├── coupons.js            ← Coupon apply, validate, remove
│   │   ├── loyalty.js            ← Loyalty points, wallet, referral engine
│   │   ├── tracking.js           ← Live order tracking, status modal
│   │   ├── reviews.js            ← Feedback / reviews form
│   │   ├── engagement.js         ← Birthday offers, pop-ups, promotions
│   │   ├── chatbot.js            ← FAQ chatbot widget
│   │   └── link-config.js        ← Central platform links (Zomato, Swiggy, WA)
│   │
│   ├── admin/
│   │   └── admin.js              ← Full admin panel logic (~4500 lines)
│   │
│   └── rider/
│       └── rider.js              ← Rider app logic
│
├── workers/                      ← Cloudflare Workers (server-side)
│   ├── order-notify.js           ← Push notifications on new order
│   ├── ai-banner-generator.js    ← AI promo banner generation
│   ├── ai-marketing-agent.js     ← AI marketing suggestions
│   └── social-poster.js         ← Social media auto-post
│
├── docs/                         ← Team documentation
│   ├── ARCHITECTURE.md           ← This file
│   ├── BRANCHING.md              ← Git workflow
│   ├── QA-CHECKLIST.md           ← Pre-deploy QA flows
│   ├── BACKUP-SETUP.md           ← Firestore backup guide
│   ├── ROLLBACK.md               ← How to rollback deployments
│   └── SEO-ACTION-GUIDE.md       ← SEO checklist
│
├── build/
│   └── version-assets.js         ← Cache-busting script (node build/version-assets.js)
│
├── _headers                      ← Cloudflare Pages: CSP, caching, security headers
├── _redirects                    ← Cloudflare Pages: URL redirects
├── firestore.rules               ← Firestore Security Rules
├── storage.rules                 ← Firebase Storage Rules
├── firebase.json                 ← Firebase project config
├── firestore.indexes.json        ← Firestore composite indexes
├── sitemap.xml                   ← SEO sitemap
├── robots.txt                    ← Search engine crawl rules
├── manifest.json                 ← PWA manifest
└── sw.js                         ← Service Worker (PWA offline cache)
```

---

## 3. Script Load Order (Critical)

Scripts must load in this exact order in every HTML page. **Do not change order.**

```html
<!-- STEP 1: Security first (sync — blocks XSS before anything runs) -->
<script src="js/core/security.js?v=N" defer></script>
<script src="js/core/sentry.js?v=N" defer></script>

<!-- STEP 2: Firebase keys + SDK -->
<script src="js/core/env-config.js?v=N"></script>
<script src="js/core/firebase-config.js?v=N"></script>

<!-- STEP 3: Shared helpers -->
<script src="js/customer/core.js?v=N" defer></script>

<!-- STEP 4: Feature modules (order matters — auth before menu, menu before cart) -->
<script src="js/customer/auth.js?v=N" defer></script>
<script src="js/customer/menu.js?v=N" defer></script>
<script src="js/customer/cart.js?v=N" defer></script>
<!-- ...etc -->

<!-- STEP 5: Analytics (non-blocking, last) -->
<script src="js/core/analytics.js?v=N" defer></script>
```

---

## 4. CSS Architecture

Each page has its own scoped CSS file. **Never add admin/rider styles to home.css.**

| File | Scope | Used by |
|------|-------|---------|
| `css/home.css` | Customer site | `index.html`, `blog*.html` |
| `css/admin.css` | Admin panel | `admin.html` |
| `css/rider.css` | Rider app | `rider.html` |

**CSS Variables** (defined in `home.css :root`):
```css
--saffron: #ff6b00      /* Primary brand color */
--gold: #d4af37         /* Accent / highlights */
--deep-brown: #2d1a00   /* Dark backgrounds */
--cream: #fff8f0        /* Light backgrounds */
--forest: #1b4332       /* Success states */
```
Always use CSS variables. Never hardcode colors in new code.

---

## 5. Data Flow

```
User Action
    │
    ▼
js/customer/*.js  ──── reads/writes ────▶  Firestore (via firestoreService.js)
    │                                           │
    │                                     Security Rules
    │                                     (firestore.rules)
    ▼
DOM Update
    │
    ▼
(if order placed)
WhatsApp Message ──▶ Customer
Push Notification ──▶ Admin (via workers/order-notify.js)
```

---

## 6. Adding a New Feature — Checklist

When adding a new customer-facing feature:

1. **New JS file** → `js/customer/your-feature.js` (don't add to existing files unless tiny)
2. **Wrap in IIFE** if it has private state, otherwise simple functions are fine
3. **Use `core.js` helpers** — don't re-implement `showToast()`, `formatRupee()`, `akRateLimit()` etc.
4. **Write to Firestore via `firestoreService.js`** — don't use `db.collection()` directly in feature files
5. **Add `<script>` tag to `index.html`** — bump `?v=N` version number
6. **Update QA checklist** — add test cases for new flow
7. **Test on staging branch** before merging to main

When adding a new admin feature:
- Add to `js/admin/admin.js` (already large but co-located; split if > 6000 lines)
- Keep admin-only styles in `css/admin.css`

---

## 7. Firestore Collections Reference

| Collection | Documents | Purpose |
|------------|-----------|---------|
| `customers` | `{uid}` | Customer profile, wallet, loyalty points |
| `orders` | `{orderId}` | Order data, status, rider assignment |
| `menu` | `{itemId}` | Menu items, price, availability |
| `coupons` | `{code}` | Coupon config, usage tracking |
| `wallets` | `{uid}` | Wallet balance (separate for security) |
| `feedback` | `{id}` | Customer reviews |
| `riders` | `{uid}` | Rider profile, assigned orders |
| `settings` | `global` | Kitchen open/close, delivery charge, etc. |

---

## 8. Cache Busting

When you update any JS or CSS file, bump the version number in the `<script>` or `<link>` tag:

```html
<!-- Old -->
<script src="js/customer/cart.js?v=4" defer></script>
<!-- New (after cart.js change) -->
<script src="js/customer/cart.js?v=5" defer></script>
```

Or run the automated script:
```bash
node build/version-assets.js
```

---

## 9. Deployment

```bash
# Standard deploy flow:
git add .
git commit -m "feat/fix/chore: description"
git push origin dev          # ← push to dev first
# Test on staging deployment
git checkout staging
git merge dev
git push origin staging      # ← Cloudflare auto-deploys staging URL
# After QA passes:
git checkout main
git merge staging
git push origin main         # ← Cloudflare auto-deploys live site
```

Full guide: `docs/BRANCHING.md`

---

## 10. Key Contacts

| Role | Name | Contact |
|------|------|---------|
| Owner | Atharav Kitchen | +91 79035 67007 |
| Email | — | chotugupta7395@gmail.com |
| Developer | Shyam | — |

