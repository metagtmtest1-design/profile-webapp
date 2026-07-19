# Testing Guide — Local (Docker) → Alpha (Client) → Prod

**Principle:** 
1. Verify locally via Docker (unit + integration + manual)
2. Deploy to alpha env for client verification (alpha.somewebsite.com)
3. If client approves, promote to prod (somewebsite.com)

No `git` actions in this doc — you handle git. This doc is pure Docker/test/cloudflare verification commands.

---

## 0. Prerequisites

- Docker + Docker Compose installed (you confirmed)
- No host `npm install` needed — Docker container network bypasses host proxy (`x2pagentd` 503 issue)

---

## 1. Local Verification via Docker (Your Machine)

### 1A. Unit Tests (TDD — Red → Green)

**Frontend Unit Tests:** React components, hooks, api client (jsdom)

```bash
# Run via Docker (bypasses host proxy, uses linux node's node_modules)
docker run --rm -v "$PWD":/app -w /app node:20 npm test

# Expected: 2 files, 11 tests passed
# - src/lib/api.test.ts: fetchHealth ok, 500, network error, timeout
# - src/App.test.tsx: loading, DB:ok badge, error, R2 image, [ALPHA] banner
```

**Backend Unit Tests:** Functions _lib (pure) + health endpoint (mocked D1/R2)

```bash
docker run --rm -v "$PWD":/app -w /app node:20 npm run test:workers

# Expected: 2 files, 15 tests passed
# - functions/_lib/env.test.ts: getEnvironment prod/alpha/preview/local/test, isPreview etc (10 tests)
# - functions/api/health.test.ts: db ok+r2 ok, db error 500, r2 error 500, missing bindings, timing+env (5 tests)
```

**All Unit Tests at Once via compose:**

```bash
docker compose --profile test run --rm tests

# or

docker compose run --rm tests
# It runs: npm test && npm run test:workers
```

**Watch mode (if you want TDD red→green loop inside Docker):**

```bash
# Frontend watch
docker run --rm -v "$PWD":/app -w /app node:20 npm run test:watch

# Backend watch
docker run --rm -v "$PWD":/app -w /app node:20 npm run test:workers:watch
```

### 1B. Build Verification

```bash
docker run --rm -v "$PWD":/app -w /app node:20 npm run build

# Expected:
# vite v5.4.21 building...
# ✓ 34 modules transformed
# dist/index.html 0.46 kB
# dist/assets/index-*.css 2.31 kB
# dist/assets/index-*.js 150 kB (48KB gz)
```

### 1C. Integration Tests (Full Stack via Docker Compose)

**What “Integration” means for Slice 0:** Frontend (Vite) + Backend (Wrangler pages dev with D1+R2 Miniflare local) talking, proving Pages+Functions+D1+R2 wiring.

```bash
# Start backend only (D1+R2 simulated via Miniflare, no real CF needed)
docker compose up -d backend

# Wait for backend to ready (npm install + vite build + wrangler ready)
# Logs show: "Ready on http://0.0.0.0:8788" + bindings DB, R2_BUCKET, vars ENVIRONMENT=local
docker compose logs backend -f
# Wait until you see: [wrangler:inf] Ready on http://0.0.0.0:8788

# Test backend health direct — proves D1+R2 wiring:
curl http://localhost:8788/api/health | jq
# Expected:
# {
#   "status": "ok",
#   "db": "ok",
#   "r2": "ok",
#   "timestamp": "2026-07-17T04:..Z",
#   "env": "local",
#   "checks": {"d1Ms": ~20-40, "r2Ms": ~30-50},
#   "sampleImageUrl": "http://localhost:8788/r2-sample/test-image.jpg"
# }

# If jq not installed:
curl http://localhost:8788/api/health

# Start frontend (Vite HMR, proxies /api to backend:8788 via VITE_API_PROXY_TARGET)
docker compose up -d frontend
docker compose logs frontend -f
# Wait for: VITE ready in 160 ms, Local: http://localhost:5173/

# Test frontend proxy — proves React → Functions wiring:
curl http://localhost:5173/api/health | jq
# Should return same ok JSON (via frontend proxy to backend)

# Open browser manual verification:
open http://localhost:5173
# Should show:
# - Header "Portfolio — Infra Proof (Slice 0)"
# - Health badge: DB: ok (green), R2: ok (green), env: local, timing D1: xx ms R2: yy ms
# - No [ALPHA] banner when local? Actually shows [LOCAL] gray banner if not production — expected
# - R2 sample image placeholder
# - Docs sections: D1 check, R2 check

# Stop and clean:
docker compose down
docker compose down -v   # also remove volumes (D1 local state in .wrangler, backend_nm volume)
```

**Integration Test Script (One-liner to verify full stack):**

```bash
docker compose up -d backend && sleep 20 && \
curl -s http://localhost:8788/api/health | grep -q '"db":"ok"' && \
echo "✅ Backend D1+R2 ok" || echo "❌ Backend failed" && \
docker compose up -d frontend && sleep 10 && \
curl -s http://localhost:5173/api/health | grep -q '"r2":"ok"' && \
echo "✅ Frontend proxy to backend ok" || echo "❌ Frontend proxy failed" && \
docker compose down
```

**D1 Migration Verification (Integration — DB tables exist):**

```bash
# Local D1 tables via wrangler inside Docker (uses .wrangler/state)
docker run --rm -v "$PWD":/app -w /app -v "$PWD/.wrangler":/app/.wrangler node:20 \
  npx wrangler d1 execute portfolio-db --local --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

# Expected: pages, sections, section_items, contacts, bookings + sqlite_sequence
```

### 1D. Local Manual Checklist (Before Pushing to Alpha)

- [ ] `docker run ... npm test` → 11 passed
- [ ] `docker run ... npm run test:workers` → 15 passed
- [ ] `docker run ... npm run build` → dist built
- [ ] `docker compose up -d backend` → `curl localhost:8788/api/health` → `db:ok r2:ok env:local`
- [ ] `docker compose up -d frontend backend` → `curl localhost:5173/api/health` → ok via proxy
- [ ] Browser `http://localhost:5173` → shows DB:ok R2:ok, no errors in console
- [ ] `docker compose down` cleans up

If all green, proceed to alpha.

---

## 2. Alpha Env Verification (Client)

**Purpose:** Client/stakeholder tests real domain `https://alpha.somewebsite.com` with isolated alpha DB/R2, before prod.

### 2A. Deploy to Alpha (You Handle Git)

You said you handle git, but for reference:

```bash
# You are on slice-0-infra-proof branch, commit already done locally
# Push to GitHub (you handle auth):
git push -u origin slice-0-infra-proof

# On GitHub UI: Open PR vs alpha branch (not main)
# Title: Slice 0: Infra Proof
# Description: See PR_SLICE0.md

# After CI + Pages preview green, merge PR into alpha:

git checkout alpha
git merge slice-0-infra-proof
git push origin alpha

# Or via GitHub UI: Merge PR into alpha

# Cloudflare Pages auto deploys alpha branch → alpha.somewebsite.com
# Dashboard → Pages → portfolio-site → Deployments → branch alpha → logs
```

### 2B. Cloudflare Setup for Alpha (One-time, If Not Done)

**Wrangler D1/R2:** (local CLI, not via GitHub)

```bash
npx wrangler login
npx wrangler d1 create portfolio-db-alpha
npx wrangler r2 bucket create portfolio-images-alpha
# Copy ID into wrangler.toml [env.alpha] database_id

npx wrangler d1 migrations apply portfolio-db --local
npx wrangler d1 migrations apply portfolio-db-alpha --remote
npx wrangler d1 execute portfolio-db-alpha --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

**Pages Bindings for Alpha:**

Cloudflare Dashboard → Pages → portfolio-site → Settings → Functions → Bindings:

- Preview tab: D1 `portfolio-db-preview`, R2 `portfolio-images-preview`, Vars `ENVIRONMENT=preview`
- If custom domain supports branch vars (check UI):
  - Select branch `alpha` → D1 `portfolio-db-alpha`, R2 `portfolio-images-alpha`, Vars `ENVIRONMENT=alpha`, `SITE_URL=https://alpha.somewebsite.com`
  - Else, rely on `wrangler.toml [env.alpha]` — Pages will use it for alpha branch builds

**Custom Domain:**

Pages → Custom domains → Add `alpha.somewebsite.com` → select branch `alpha` → auto DNS + SSL

### 2C. Client Verification Checklist (What Client Should See on Alpha)

Give client this checklist and URL `https://alpha.somewebsite.com`:

**Automated (curl):**

```bash
curl https://alpha.somewebsite.com/api/health | jq

# Expected:
# {
#   "status": "ok",
#   "db": "ok",
#   "r2": "ok",
#   "env": "alpha",
#   "checks": {"d1Ms": <100, "r2Ms": <100},
#   "timestamp": "2026-..."
# }

# If jq not installed:
curl https://alpha.somewebsite.com/api/health
```

**Manual (Browser):**

- [ ] Open `https://alpha.somewebsite.com/`
- [ ] See orange banner `[ALPHA] — Alpha testing — not production — env: alpha` at top (proves ENVIRONMENT var working)
- [ ] See header `Portfolio — Infra Proof (Slice 0)`
- [ ] See health badge section:
  - `DB: ok` green pill
  - `R2: ok` green pill
  - `env: alpha` gray pill
  - Timing D1: ~xx ms, R2: ~yy ms
  - Timestamp recent
- [ ] No console errors (F12)
- [ ] Responsive: resize window, layout still works (mobile check)
- [ ] Retry button works: click `Retry health check` → badge reloads still ok
- [ ] R2 sample image placeholder visible (or broken image fallback to placeholder is ok for Slice 0)

**D1/R2 Verification (You, Not Client):**

```bash
# Alpha DB tables via wrangler remote:
npx wrangler d1 execute portfolio-db-alpha --remote --command "SELECT name FROM sqlite_master WHERE type='table'"

# Alpha R2 bucket exists:
npx wrangler r2 bucket list | grep portfolio-images-alpha
npx wrangler r2 object list portfolio-images-alpha --remote
# Expected empty for Slice 0 (no uploads yet)
```

**Slack/Message to Client Example:**

```
Alpha env ready for Slice 0 verification:
URL: https://alpha.somewebsite.com
Health: https://alpha.somewebsite.com/api/health

Please check:
- Orange [ALPHA] banner at top
- DB: ok, R2: ok badges
- No console errors
- Responsive

If green, reply "LGTM for Slice 0" and we will promote to prod.

Background: This slice proves Pages+Functions+D1+R2 wiring with 3 envs (preview/alpha/prod) isolated.
Tests: 26 passing (11 frontend + 15 backend) via Docker.
```

### 2D. Troubleshooting Alpha

- **500 error on /api/health:** Check Pages → Functions → Bindings for alpha branch — D1 `portfolio-db-alpha` and R2 `portfolio-images-alpha` must be bound, check `wrangler.toml` IDs match remote IDs. Check `wrangler d1 migrations apply portfolio-db-alpha --remote` was run.
- **env shows preview not alpha:** Check `ENVIRONMENT` var for alpha branch binding is `alpha`, not `preview`. Set in Dashboard or via `wrangler.toml [env.alpha] vars`.
- **Custom domain not working:** Ensure alpha branch pushed to GitHub, Pages → Deployments → alpha branch shows latest commit, Custom domains → alpha.somewebsite.com → branch alpha selected, DNS green.

---

## 3. Prod Deploy (After Client Approves Alpha)

**Promote Alpha → Main (Prod):**

```bash
# You handle git — example:
git checkout main
git merge alpha
git push origin main

# Or via GitHub UI: Open PR alpha → main, Title "Promote alpha with Slice 0 to prod", Merge

# Cloudflare Pages auto deploys main → https://somewebsite.com
```

**Prod Verification (Same as Alpha but on prod domain):**

```bash
curl https://somewebsite.com/api/health | jq
# Expected: status ok, db ok, r2 ok, env production, no alpha banner

# Browser: https://somewebsite.com/
# - No [ALPHA] or [PREVIEW] banner (production)
# - DB: ok, R2: ok
# - Same checklist as alpha
```

**Post-Prod Checks:**

- Pages → Deployments → main branch → Production → logs green
- `wrangler d1 execute portfolio-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"` → 5 tables
- `wrangler r2 bucket list` → `portfolio-images` exists
- If you have monitoring (optional): check Cloudflare Web Analytics no errors

**Rollback if Prod Fails:**

- GitHub: Revert merge commit `main`, push → Pages auto redeploys previous prod
- Or Cloudflare Dashboard → Pages → Deployments → previous production deployment → Rollback

---

## Quick Command Reference (Copy-Paste)

```bash
# Unit Tests
docker run --rm -v "$PWD":/app -w /app node:20 npm test
docker run --rm -v "$PWD":/app -w /app node:20 npm run test:workers
docker compose --profile test run --rm tests   # both

# Build
docker run --rm -v "$PWD":/app -w /app node:20 npm run build

# Integration Full Stack Local
docker compose up -d backend && sleep 20 && curl -s http://localhost:8788/api/health | jq && docker compose up -d frontend && sleep 10 && curl -s http://localhost:5173/api/health | jq && docker compose down

# Manual Browser Local
docker compose up -d frontend backend
open http://localhost:5173
docker compose down

# Alpha D1/R2 Check (Remote)
npx wrangler d1 execute portfolio-db-alpha --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
npx wrangler r2 object list portfolio-images-alpha --remote

# Alpha Health
curl https://alpha.somewebsite.com/api/health | jq

# Prod Health
curl https://somewebsite.com/api/health | jq
```

---

## What’s Next After Slice 0

- Slice 1: Content Display `GET /api/content/home` → D1 pages→sections→items + R2 images, seed data
- Same flow: Local Docker tests → alpha client verification → prod

---

## Notes

- No host `npm install` needed — Docker handles network bypassing host proxy `x2pagentd` that returns 503
- If you need to clean Docker cache: `docker compose down -v && docker volume prune -f`
- Wrangler local state in `.wrangler/` (gitignored), contains D1 SQLite local file
- `wrangler.toml` has placeholder IDs `*_placeholder-id` — replace with real IDs from `wrangler d1 create` for remote deploys, local `--local` works with placeholders
