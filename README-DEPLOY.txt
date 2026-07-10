# Atharav Kitchen — Fixed & Ready to Deploy (v5 — Deep Audit)

## 🔴 IMPORTANT: Deploy Se Pehle Yeh 2 Cheeze Zaroor Karo

### 1. Firebase Console → Anonymous Sign-In ENABLE karo (CRITICAL — naya fix)
Firebase Console → Authentication → Sign-in method → **Anonymous** → Enable.
Bina iske GUEST orders Firestore mein save nahi honge (neeche "Kya Naya Fix Kiya" mein detail hai).

### 2. Hosting Domain ko Firebase Authorized Domains mein add karo
Firebase Console → Authentication → Settings → Authorized domains →
apna Cloudflare Pages domain (e.g. `atharav-kitchen.pages.dev` ya custom domain) add karo.
Iske bina Google login popup fail hoga.

### 3. Admin Password Change Karo
Pehli baar `admin.html` login ke baad **turant password change karo**.

### 4. API Key Restriction (recommended)
Google Cloud Console → Credentials → apna Maps/Firebase API key ko domain-restricted karo
(HTTP referrer restriction → apna Cloudflare domain).

---

## ✅ Is Deep-Audit Session Mein Kya NAYA Fix Hua (July 2026)

Screenshot mein jo 9 points the ("OTP login, Google login, guest order, guest coupon,
order popup, live tracking, smoothness, guest safety, deep scan, promo banner") — **sab
verify kiye gaye aur genuinely fixed the**, code mein confirm ho gaya.

Lekin deep-scan mein **3 CRITICAL bugs mile jo screenshot mein claim nahi hue the** —
inko is session mein fix kiya gaya:

| # | Bug | Impact | Fix |
|---|-----|--------|-----|
| 1 | **Guest orders Firestore mein save nahi ho rahe the** — Firestore rules `request.auth != null` maangte hain, guest ke paas koi auth session hi nahi tha. Order popup + WhatsApp to chal jata tha, par order silently DB mein save nahi hota tha. | Admin panel ko guest orders live nahi dikhte the; guest live-tracking bhi kaam nahi karta tha | `app.js` mein Firebase **Anonymous Auth** bootstrap add kiya — guest ke liye invisible background session banta hai jo unhe "registered" nahi banata (naya `realFirebaseUser()` helper use hota hai har jagah "logged in" check ke liye) |
| 2 | `Permissions-Policy: geolocation=()` header **sabke liye GPS block** kar raha tha — apni khud ki site ke liye bhi | GPS button / delivery-radius check / auto address-fill kabhi kaam nahi karta | `_headers` mein `geolocation=(self)` kiya |
| 3 | CSP `connect-src` mein `nominatim.openstreetmap.org` missing tha | GPS se address auto-fill (fallback geocoding) silently fail hota tha | `_headers` mein Nominatim domain add kiya |
| 4 | CSP `frame-src` mein Firebase `authDomain` (`atharav-kitchen-e587b.firebaseapp.com`) missing tha | Google login popup kabhi kabhi silently fail ho sakta tha | `_headers` mein add kiya |

---

## ✅ Pehle Se Verified Fixes (screenshot ke 9 points — sab confirm hue)
1. OTP login — retry logic + clear Hinglish error messages ✅
2. Google login — popup with redirect fallback + race-condition-safe redirect check ✅
3. Guest checkout — koi login wall nahi, cart→address→payment tak bina login chal sakta hai ✅
4. Guest/loyalty coupons — GUEST5 + per-customer WELCOME₹ code ✅
5. Order confirmation popup pehle dikhta hai, WhatsApp 100ms baad khulta hai ✅
6. Live order tracking — Firestore `onSnapshot` real-time ✅
7. UI smoothness — hover/transition animations, smooth scroll, toast animations ✅
8. Guest safety badge — Step 3 pe blue "100% Safe" badge ✅
9. Deep scan — koi duplicate `placeOrder`/tracking function nahi mila, code clean hai ✅
10. Promo video banner — Admin se YouTube/MP4 URL, homepage 16:9 embed ✅

## 📁 Deploy
Sab files seedha Cloudflare Pages root mein upload karo. Netlify use mat karo (discontinued) —
is package mein `netlify.toml` intentionally nahi hai.

