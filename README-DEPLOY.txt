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

---

## ✅ Latest Session Fixes (July 2026 — merge + AI Agent debugging)

Do alag-alag code versions ban gaye the (ek referral/ETA/kitchen-gallery wala,
doosra AI Marketing Agent/Reports wala) — is session mein **dono ko ek mein merge
kiya gaya**, plus 2 naye bugs fix kiye:

| # | Bug | Fix |
|---|-----|-----|
| 1 | `admin.html` mein Firebase SDK **do baar** load ho rahi thi (`firebase-config.js` ke andar se dynamically + admin.html mein hardcoded `<script>` tags se) — race condition ki wajah se `firebase is not defined` error aata tha | Duplicate hardcoded script tags hata diye; ab sirf `firebase-config.js` (jo pehle se hi app/auth/firestore/storage/messaging sabko sahi order mein load karta hai) use hoti hai |
| 2 | CSP `connect-src` mein **koi bhi `*.workers.dev` domain allow nahi tha** — isliye AI Marketing Agent, AI Banner Generator, Social Auto-Post, Push Notification — sab Workers calls silently CSP se block ho rahe the (browser console mein confusing "CORS error" jaisa dikhta tha) | `_headers` mein `connect-src` ke andar `https://*.workers.dev` + `https://fcm.googleapis.com` + `https://fcmregistrations.googleapis.com` add kiya |
| 3 | `_redirects` mein SPA-style `/* → index.html` wildcard tha — is wajah se `/admin.html` aur `/rider.html` bhi zabardasti customer site pe redirect ho jaate the | Wildcard rewrite hata diya — yeh multi-page static site hai, SPA nahi |

### Naye features is session mein add hue:
- Referral program (secure, `referral_claims` collection ke through — koi customer directly kisi doosre ke wallet mein likh nahi sakta)
- Live ETA countdown timer (order tracking mein)
- Item Detail popup + "Customers Also Liked" cross-sell
- Kitchen/Hygiene photo gallery (admin se upload, customer site pe dikhta hai)
- AI Banner Generator (`cloudflare-worker/ai-banner-generator.js`)
- Push Notifications (order status updates — `cloudflare-worker/order-notify.js`)
- AI Marketing Agent (`cloudflare-worker/ai-marketing-agent.js`) — GA4 + Search Console + Claude se weekly report/offer, "Agent Abhi Chalao" manual test button ke saath
- Menu Intelligence auto-bestseller sync + cart upsell box (donon merge karke saath rakhe)
- Real-photo-only menu items (emoji hata diya) — bina photo ke item save nahi hota

### Deploy karne se pehle in Workers ko setup karna hoga (agar use karne hain):
Har ek `cloudflare-worker/*.js` file ke top comment mein poora step-by-step
deploy guide hai — konsa environment variable/secret kahan se milega,
sab likha hai. Koi bhi feature use karne se pehle uski Worker file ka
top comment zaroor padho.


