# Git & Deploy Workflow — Atharav Kitchen

Solo-dev friendly 3-branch flow, mapped 1:1 to Cloudflare Pages environments.

## Branches

| Branch    | Purpose                                    | Cloudflare Pages env       |
|-----------|---------------------------------------------|-----------------------------|
| `main`    | LIVE — what customers see right now         | Production (atharav-kitchen.pages.dev / your custom domain) |
| `staging` | Final check before going live               | Preview (auto URL, e.g. staging.atharav-kitchen.pages.dev) |
| `dev`     | Day-to-day work-in-progress                 | Preview (auto URL per push) |

Rule of thumb: **never edit `main` directly.** Everything flows dev → staging → main.

## One-time setup

```bash
cd atharav-kitchen-v15-modular
git init
git add .
git commit -m "chore: v15 modular restructure (foundation)"
git branch -M main
git remote add origin https://github.com/<your-username>/atharav-kitchen.git
git push -u origin main

git checkout -b staging
git push -u origin staging

git checkout -b dev
git push -u origin dev
```

## Daily workflow

```bash
git checkout dev
# ...make changes...
node build/version-assets.js      # cache-bust before every deploy-worthy commit
git add .
git commit -m "fix: <what you fixed>"
git push
```

Cloudflare Pages auto-builds a **preview URL** for every push to `dev` — test there
first (phone + desktop), not on the live site.

## Promoting to staging → production

```bash
# once dev is stable:
git checkout staging
git merge dev
git push                # staging preview URL updates — do a final check here

# once staging looks good:
git checkout main
git merge staging
git push                # THIS goes live on the production domain
```

## Cloudflare Pages project settings (one-time, in dashboard)

1. Pages → your project → **Settings → Builds & deployments**
2. Production branch: `main`
3. Preview branches: **All non-production branches** (this auto-gives you a
   preview URL for both `dev` and `staging` on every push)
4. Build command: leave empty (static site) — or `node build/version-assets.js`
   if you want cache-busting to run automatically on every Cloudflare build
   instead of running it locally
5. Build output directory: `/` (repo root)

## Commit message convention (keeps history scannable)

- `feat: ...` — new feature
- `fix: ...` — bug fix
- `chore: ...` — restructuring, config, no behavior change
- `docs: ...` — documentation only
