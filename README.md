# Atharav Kitchen — Web Platform (v15, modular)

Cloud kitchen ordering platform: customer site + admin panel + rider app.
Plain HTML/CSS/JS (no bundler) on Firebase + Cloudflare Pages.

## Folder structure

```
/                        pages (index, admin, rider, blog + blog posts) + Cloudflare config
├── js/
│   ├── core/             shared across all 3 apps
│   │   ├── firebase-config.js
│   │   ├── firestoreService.js
│   │   └── security.js
│   ├── customer/         index.html only — loaded in THIS exact order (see index.html)
│   │   ├── core.js         loader, nav, helpers, Firebase bootstrap
│   │   ├── auth.js         OTP/Google/Facebook login, session, register
│   │   ├── menu.js         menu render/filter, item detail
│   │   ├── cart.js         cart + checkout steps + bill
│   │   ├── coupons.js      coupon apply at checkout
│   │   ├── orders.js       place order, wallet/loyalty points, feedback
│   │   ├── order-history.js
│   │   ├── tracking.js     live order tracking
│   │   ├── reviews.js      public reviews + kitchen gallery
│   │   ├── loyalty.js      referral, tiers, address book, wishlist
│   │   └── engagement.js   spin wheel, upsell, abandoned-cart nudge (loads LAST)
│   ├── admin/admin.js    admin.html only
│   └── rider/rider.js    rider.html only
├── css/
│   ├── home.css           index.html + blog.html (was styles.css)
│   ├── admin.css          admin.html only
│   └── rider.css          rider.html only
├── workers/               Cloudflare Workers (AI agent, banner gen, push, social)
├── build/
│   ├── version-assets.js  cache-busting script — RUN BEFORE EVERY DEPLOY
│   └── VERSION             auto-incremented, don't edit by hand
└── docs/
    ├── BRANCHING.md       git + Cloudflare Pages workflow
    ├── README-DEPLOY.txt  original deploy notes (Firebase console steps etc.)
    └── SEO-ACTION-GUIDE.md
```

## ⚠️ Why `js/customer/*.js` load order matters

These 11 files used to be **one single `app.js`**. All functions are still plain
globals (no ES modules, no bundler) — that part hasn't changed, so nothing about
*how the code runs* is different. What changed is only *which file each function
lives in* for readability/maintainability. Because a few later files reference
functions defined in earlier files (e.g. `engagement.js` wraps `addCart` from
`cart.js`), **the `<script>` order in `index.html` must stay exactly as generated.**
Don't reorder those 11 tags without checking cross-references first.

## Cache-busting

Run this before every deploy (or wire into Cloudflare's build command):
```bash
node build/version-assets.js
```
It stamps `?v=<n>` on every local `<script>`/`<link>` tag and bumps the service
worker's cache name, so browsers/Cloudflare edge always fetch the latest files
after a deploy instead of serving stale cached JS/CSS.

## Known scope of this pass

- ✅ `app.js` → 11 dependency-ordered modules (byte-for-byte lossless split, verified)
- ✅ `admin.html` inline script → `js/admin/admin.js`
- ✅ `rider.html` inline script → `js/rider/rider.js`
- ✅ `admin.html`/`rider.html` inline `<style>` → own scoped `css/admin.css` / `css/rider.css`
- ⏸️ `styles.css` (shared by index+blog) was renamed to `css/home.css` as-is —
  splitting it further into `base.css`/page-specific files needs visual QA
  against the live site (no build/preview here to check for regressions), so
  it's flagged as its own upcoming point rather than risked blind.
- ⏸️ Image assets (`logo.webp` etc.) intentionally **left at root** this round —
  moving them into `assets/img/` touches too many scattered references
  (HTML, manifest.json, sw.js, admin's blog-template JS strings) to do safely
  in the same pass as the JS/CSS split. Separate point when you're ready.
