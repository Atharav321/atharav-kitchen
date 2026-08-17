# Atharav Kitchen — AI Tools Setup & Troubleshooting
**Version:** v1.0 | **Date:** August 2026

---

## 3 AI Tools Overview

| Tool | Worker File | What It Does |
|------|-------------|--------------|
| AI Marketing Agent | `workers/ai-marketing-agent.js` | GA4 + Search Console padhke Claude se weekly report + offer likhwata hai |
| AI Banner Generator | `workers/ai-banner-generator.js` | Text prompt se food banner image banata hai (Cloudflare Workers AI, FREE) |
| Social Poster | `workers/social-poster.js` | Facebook + Instagram pe seedha post karta hai |

---

## Common Errors & Fixes

### ❌ "Facebook token expire ho gaya"
**Cause:** Facebook Page Access Token ki validity 60-90 days hoti hai.  
**Fix:**
1. [business.facebook.com](https://business.facebook.com) → Settings → Advanced → Page Access Tokens
2. Naya long-lived token generate karo (Graph API Explorer se)
3. Worker Settings → Variables → `FB_PAGE_ACCESS_TOKEN` update karo

### ❌ "Workers AI binding missing"
**Cause:** AI Banner Worker mein AI binding set nahi hai.  
**Fix:**
1. Cloudflare Dashboard → Workers → `atharav-ai-banner` → Settings → Bindings
2. Add binding → Type: **Workers AI** → Variable name: **AI**
3. Save → Re-deploy

### ❌ "Image URL public nahi hai" (Instagram)
**Cause:** Instagram ke Graph API ko publicly accessible image URL chahiye.  
**Fix:** Admin panel mein pehle banner banao → "Upload & Get URL" button dabao → phir post karo. Base64 images directly post nahi ho sakti Instagram pe.

### ❌ "GA4 fetch failed" / "Search Console fetch failed"
**Cause:** Service Account ko proper permissions nahi di gayi.  
**Fix:**
1. GA4 property → Admin → Account Access Management → Service Account email add karo as "Viewer"
2. Search Console → Settings → Users and Permissions → Service Account email add karo
3. `GOOGLE_SERVICE_ACCOUNT_JSON` Worker secret mein latest JSON paste karo

### ❌ "Instagram rate limit (code 36000)"
**Cause:** Instagram allow karta hai sirf 25 posts per day per account.  
**Fix:** Kal dobara try karo. Automated weekly agent se sirf 1 post/week hoti hai — manually zyada mat karo.

### ❌ Canvas banner download nahi ho raha
**Cause:** Menu item ki image CORS block ho rahi hai canvas mein.  
**Fix:** Menu items ki images Firebase Storage pe upload karo (`gs://atharav-kitchen-e587b.appspot.com/menu/`). External URLs (Zomato/Swiggy images) canvas mein CORS fail karte hain.

---

## Facebook Token — Long-Lived Token Kaise Banaye

Short-lived token (1 hour) → Long-lived token (60 days) → Never-expiring Page Token:

```
1. graph.facebook.com/oauth/access_token?
   grant_type=fb_exchange_token&
   client_id={APP_ID}&
   client_secret={APP_SECRET}&
   fb_exchange_token={SHORT_TOKEN}
   
   → Milega: long-lived user token (60 days)

2. graph.facebook.com/{PAGE_ID}?
   fields=access_token&
   access_token={LONG_LIVED_USER_TOKEN}
   
   → Milega: Page access token (never expires as long as user has page access)
```

**Easiest way:** [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer) → Select App → Select Page → Get Page Token → Extend to 60 days.

---

## Cron Schedule (Auto-run every Monday)

Worker → Settings → Triggers → Cron Triggers:
```
0 3 * * 1   ← Har Monday 3:00 AM UTC = 8:30 AM IST
```

---

## Test Checklist (Har deploy ke baad)

- [ ] Admin panel → Reports → "Agent Abhi Chalao" → Success message aaya?
- [ ] Admin panel → Marketing → AI Banner → Ek banner generate hua?
- [ ] Admin panel → Marketing → Social Post → FB + IG pe test post gaya?
- [ ] Cloudflare Workers Dashboard → Errors tab mein koi spike nahi?
