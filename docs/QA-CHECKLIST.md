# Atharav Kitchen — Manual QA Checklist
**Version:** v1.0 | **Last Updated:** 2026-08

Run this checklist **before every deploy to `main`** (staging mein pehle test karo).
Each flow mein ✅ ya ❌ mark karo. Koi bhi ❌ = deploy block karo.

---

## 🔐 FLOW 1 — Authentication (Customer)

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 1.1 | "Login" button click karo | OTP/Google login modal khule | |
| 1.2 | Valid phone number se OTP bhejo | OTP aaye, verify ho | |
| 1.3 | Google sign-in karo | Redirect ho, user logged in dikhe | |
| 1.4 | Logout karo | Cart clear ho, login button wapas aaye | |
| 1.5 | Already logged-in pe page reload karo | Session restore ho | |

---

## 🛒 FLOW 2 — Cart & Order Placement

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 2.1 | Menu se item add karo | Cart badge update ho, item dikhey | |
| 2.2 | Quantity increase/decrease karo | Total update ho correctly | |
| 2.3 | Item remove karo | Cart se hat jaaye | |
| 2.4 | Coupon code apply karo (test: `WELCOME20`) | Discount apply ho | |
| 2.5 | Invalid coupon try karo | Error message aaye | |
| 2.6 | Order place karo (name, phone, address fill karo) | WhatsApp pe order message jaye, confirmation aaye | |
| 2.7 | ₹399+ order pe delivery charge check karo | ₹0 delivery dikhey | |
| 2.8 | ₹399 se kam order pe delivery charge check | ₹30 dikhey | |

---

## 🚴 FLOW 3 — Rider App

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 3.1 | rider.html kholo + rider credentials se login | Rider dashboard aaye | |
| 3.2 | Assigned order dikhey | Order details, customer name dikhey | |
| 3.3 | "Out for Delivery" mark karo | Status update ho Firestore mein | |
| 3.4 | "Delivered" mark karo | Order delivered dikhey, phone number chhupp jaaye | |
| 3.5 | Rider logout karo | Login page aaye | |

---

## 🔧 FLOW 4 — Admin Panel

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 4.1 | admin.html kholo + admin email se login | Admin dashboard aaye | |
| 4.2 | Naye orders realtime mein dikhein | Live updates aaye without refresh | |
| 4.3 | Order status change karo (New → Preparing) | Customer ko update dikhey | |
| 4.4 | Rider assign karo | Rider dashboard mein order aaye | |
| 4.5 | Menu item add/edit/delete karo | Changes live site pe reflect hon | |
| 4.6 | Coupon create karo | Customer use kar sake | |
| 4.7 | Non-admin account se admin.html access try | Redirect ho / access denied aaye | |

---

## 🔒 FLOW 5 — Security Checks

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 5.1 | Browser DevTools > Network > Response Headers check | CSP, X-Frame-Options, HSTS sab dikhein | |
| 5.2 | CSP violations check (Console mein) | Koi CSP error na aaye | |
| 5.3 | `https://atharav-kitchen.pages.dev/admin.html` seedha open karo (logged out) | Login page aaye ya redirect ho | |
| 5.4 | Firestore console > orders > manual write try (non-admin) | Permission denied aaye | |
| 5.5 | Site ko `<iframe>` mein load karne ki koshish | Block ho (X-Frame-Options) | |
| 5.6 | Sentry dashboard check karo | No unexpected errors | |

---

## 📱 FLOW 6 — Mobile & PWA

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 6.1 | Chrome Mobile (Android) pe kholo | Layout sahi dikhey | |
| 6.2 | iPhone Safari pe kholo | Layout sahi dikhey | |
| 6.3 | "Add to Home Screen" karo | PWA install ho, icon aaye | |
| 6.4 | Offline mode mein kholo (Network tab > Offline) | Service Worker cached page dikhe | |
| 6.5 | Slow 3G simulate karo | Page load ho, no broken images | |

---

## ⚡ FLOW 7 — Performance

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 7.1 | PageSpeed Insights run karo (pagespeed.web.dev) | Mobile score ≥ 70 | |
| 7.2 | Core Web Vitals check (LCP, CLS, FID) | LCP < 2.5s, CLS < 0.1 | |
| 7.3 | Image loading check | WebP format load ho | |
| 7.4 | JS errors in console check | Zero errors in production | |

---

## ✅ Pre-Deploy Sign-off

```
Date: ___________
Tested by: ___________
Branch: ___________
All flows passed: YES / NO

Notes:
```

---

> **Tip:** Staging pe pehle test karo (`staging` branch), phir `main` mein merge karo.
> QA fail hone pe **deploy mat karo** — pehle fix karo.
