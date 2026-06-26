# Atharav Kitchen — Fixed & Ready to Deploy

## 🔴 IMPORTANT: Deploy Se Pehle Yeh Karo

### 1. Firebase API Keys Daalo
`index.html` kholo, aur neeche wale section mein apni REAL keys daalo:

```html
<script>
window.__ENV_FIREBASE_API_KEY = 'AIzaSyCFUKTAZQJ4XnJ7RDK50k14gMQOeDW5-2g';
window.__ENV_FIREBASE_MESSAGING_ID = '405541916369';
window.__ENV_FIREBASE_APP_ID = '1:405541916369:web:b0ffc50a3a7aabc005ac';
window.__ENV_FIREBASE_MEASUREMENT_ID = 'G-1Z105Q39G2';
window.__ENV_GMAPS_KEY = 'AIzaSyD7Vb4zFHfzsI79BbHjZTIi0s8Asxte6rI';
</script>
```

### 2. Images Upload Karo (Aap Khud Karoge)
- `logo.webp` (512x512)
- `icon-192.webp` (192x192)
- `icon-512.webp` (512x512)
- `food-burger.jpg`, `food-noodles.jpg`, `food-momos.jpg`, `food-chicken.jpg`, `food-rice.jpg`
- `delivery-boy-new.webp`

### 3. Admin Password Change Karo
Pehli baar `admin.html` login ke baad **turant password change karo**.

### 4. Firebase Security
Firebase Console → API & Services → Credentials → Restrict API keys to your domain only.

---

## ✅ Kya Fix Kiya Gaya

| Issue | Fix |
|-------|-----|
| Firebase API keys exposed | Environment variable pattern |
| Google Maps key exposed | Environment variable pattern |
| Admin password weak | Dynamic salt + double SHA-256 |
| start.html duplicate content | Redirect to blog page |
| Timing inconsistent (10AM/10PM vs 11AM/3AM) | 11:00 AM – 3:00 AM everywhere |
| Zomato link hardcoded 10+ places | Central `AK_CONFIG` object |
| Service Worker .png vs .webp mismatch | Fixed extensions |
| WhatsApp ₹ encoding issue | Proper URL encoding |
| Birthday check fragile | Robust date parsing |

---

## 📁 Files in this folder

All files ready to upload directly to your hosting (Cloudflare Pages/Netlify/etc).
