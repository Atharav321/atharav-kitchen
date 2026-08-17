# Atharav Kitchen — Rollback Guide
**Version:** v1.0 | **Date:** August 2026

---

## Rollback kab karna chahiye?

- Live site pe kuch toot gaya (orders nahi ho rahe, login broken hai)
- Galat deploy ho gaya (wrong branch merge)
- Security issue mila deployed code mein

---

## Method 1 — Cloudflare Pages Instant Rollback (Fastest — 30 seconds)

Yeh sabse fast tarika hai. Koi Git knowledge needed nahi.

1. [dash.cloudflare.com](https://dash.cloudflare.com) kholo
2. **Pages** > `atharav-kitchen` project
3. **Deployments** tab
4. Jo purana deployment stable tha, uske `...` menu mein:
   **"Rollback to this deployment"** click karo
5. Confirm karo

> ✅ Site **turant** purane version pe wapas aa jaayegi. Git history change nahi hoti.

---

## Method 2 — Git Revert (Safe, recommended for code history)

Yeh method Git history preserve karta hai — ek "undo commit" banata hai.

```bash
# 1. Recent commits dekho
git log --oneline -10

# Output example:
# a3f9c2b fix: cart total calculation
# 7d1e4a0 feat: add loyalty points display   ← yeh toot raha hai
# c8f7a6b chore: fix orders.js split boundary ← yeh stable tha

# 2. Broken commit revert karo (new undo commit create hota hai)
git revert 7d1e4a0

# 3. Agar multiple commits revert karne hon:
git revert 7d1e4a0 a3f9c2b --no-commit
git commit -m "revert: rollback broken loyalty + cart changes"

# 4. Push karo — Cloudflare auto-deploy karega
git push origin main
```

---

## Method 3 — Git Reset (Nuclear option — history change hoti hai)

Sirf tab use karo jab revert kafi na ho (e.g. sensitive data accidentally committed).

```bash
# 1. Jis commit pe wapas jaana hai uska hash dekho
git log --oneline -10

# 2. Us commit pe hard reset karo
git reset --hard c8f7a6b

# 3. Force push (⚠️ team ko pehle bata do — purana history delete hoti hai)
git push origin main --force-with-lease
```

> ⚠️ `--force-with-lease` safer hai regular `--force` se — conflict check karta hai.

---

## Method 4 — Emergency Maintenance Mode

Agar site completely down hai aur fix mein time lagega:

```html
<!-- maintenance.html banao aur index se redirect karo -->
<!-- _redirects file mein add karo: -->
/*    /maintenance.html    200
```

Maintenance khatam hone ke baad `_redirects` se yeh line hata do.

---

## Branch Strategy (Rollback Prevention)

```
main ────── live site (Cloudflare deploy)
staging ─── test karo pehle yahan
dev ──────── daily development
```

**Rule:** Kabhi seedha `main` pe push mat karo. Hamesha:
```
dev → staging → QA pass → main
```

---

## Checklist — Deploy ke Baad

Koi bhi deploy ke 5 minute baad yeh check karo:

- [ ] Homepage load ho raha hai?
- [ ] Login kaam kar raha hai?
- [ ] Menu items dikh rahe hain?
- [ ] Cart mein item add hota hai?
- [ ] Console mein koi error nahi?
- [ ] Sentry dashboard mein spike nahi?

Koi bhi fail = turant Method 1 (Cloudflare rollback) use karo.

---

## Git Tags — Stable Release Mark Karna

Har stable release ko tag karo taaki future rollback easy ho:

```bash
# Stable version tag karo
git tag -a v16.0 -m "v16.0 — Security hardening complete"
git push origin v16.0

# Tags dekho
git tag -l

# Kisi specific tag pe wapas jaana ho
git checkout v16.0
```

---

## Firestore Data Rollback

Code rollback ke baad agar Firestore data bhi recover karna ho:
→ Dekho: `docs/BACKUP-SETUP.md` — Recovery section

