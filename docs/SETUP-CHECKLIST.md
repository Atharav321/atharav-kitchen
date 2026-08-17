# Atharav Kitchen — One-Time Setup Checklist
**For new developers / fresh machine setup**

---

## ✅ DONE IN CODE (no action needed)

| Item | Status | Details |
|------|--------|---------|
| ESLint config | ✅ Complete | `eslint.config.mjs` — run `npm run lint` |
| `npm test` script | ✅ Complete | Runs ESLint + Prettier check |
| CSP script-src | ✅ No unsafe-inline | Phase 2 fix |
| CSP style-src | ✅ Documented | unsafe-inline kept intentionally (358 inline attrs + static hosting = no nonce possible) |
| Sentry fallback | ✅ Firestore logger | Errors logged to `error_logs` collection until real DSN set |
| Privacy Policy | ✅ Complete | `privacy-policy.html` |
| Terms & Conditions | ✅ Complete | `terms.html` |
| AI Tools fixed | ✅ Complete | FB API v21, anthropic-version 2025, token errors |
| Security module | ✅ v2.0 | Fake devtools block removed |

---

## 🔧 NEEDS YOUR ACTION (one-time setup, can't be done in code)

### 1. Git Init on your machine
```bash
git init
git remote add origin https://github.com/YOUR_USERNAME/atharav-kitchen.git
git add .
git commit -m "chore: initial commit v18"
git push -u origin main

# Create branches:
git checkout -b dev && git push -u origin dev
git checkout -b staging && git push -u origin staging
git checkout main
```

### 2. Sentry DSN (Free — takes 5 min)
1. [sentry.io](https://sentry.io) → Free account → New Project → JavaScript → Browser
2. Copy DSN (Settings → Client Keys)
3. Open `js/core/sentry.js` → Line 20 → Paste DSN:
   ```js
   var SENTRY_DSN = 'https://abc123@o12345.ingest.sentry.io/67890';
   ```
4. Deploy — real error monitoring active

### 3. Cloudflare Pages Staging Environment
1. [dash.cloudflare.com](https://dash.cloudflare.com) → Pages → `atharav-kitchen`
2. Settings → Builds & Deployments → Branch Deployments
3. Add branch: `staging` → Auto-deploy enabled
4. You'll get: `staging.atharav-kitchen.pages.dev` URL

### 4. Firestore Automated Backup
Full guide: `docs/BACKUP-SETUP.md`
Quick version:
```
GCP Console → Cloud Storage → Create bucket: atharav-kitchen-backups
Cloud Scheduler → Create job → runs daily 2AM IST
```

### 5. Firestore Backup — actual bucket creation
See `docs/BACKUP-SETUP.md` Steps 1-5.

---

## ❌ NOT POSSIBLE WITHOUT REAL DEVICES/SERVICES

| Item | Why Not Automatable | What To Do |
|------|---------------------|-----------|
| Cross-browser testing | Real browsers needed | Chrome, Firefox, Safari, Mobile Chrome on staging before each deploy |
| Device testing | Real phones needed | Test on Android + iPhone on staging URL |
| Load testing | Real traffic needed | Use [k6.io](https://k6.io) free tier — `k6 run load-test.js` |
| Real AI chatbot | Requires per-message API calls from browser (adds cost) | Current FAQ bot handles 90% of queries. Upgrade when order volume justifies cost. |

---

## Real AI Chatbot — When to Upgrade

Current chatbot = rule-based FAQ (free, instant, offline-capable).

Upgrade to real AI chatbot when:
- Monthly orders > 500 (enough revenue to justify API cost)
- Customers asking questions not in FAQ list regularly
- Budget: ~₹500-1000/month for AI API calls

**How to upgrade:**
Replace `js/customer/chatbot.js` with a version that calls your AI marketing agent worker's `/chat` endpoint (add a new endpoint to `workers/ai-marketing-agent.js`). The worker proxies to Claude API server-side so API key stays secret.

