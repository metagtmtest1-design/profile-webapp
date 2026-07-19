# Portfolio Website — Cloudflare Free Tier

Single-page dynamic portfolio with integrated meeting scheduler. 100% Cloudflare free tier ($0/month).

## Architecture (Slice 0 — Infra Proof ✅)

- **Frontend:** React + Vite + TypeScript → Cloudflare Pages CDN
- **Backend:** Pages Functions (Workers) → `GET /api/health` checks D1 + R2
- **DB:** D1 SQLite — 5 tables: pages, sections, section_items, contacts, bookings (migrations/0001)
- **Images:** R2 buckets — portfolio-images (+ preview + alpha)
- **Envs:** 3 isolated: preview (PRs `<hash>.pages.dev`), alpha (`alpha.somewebsite.com`), prod (`somewebsite.com`)
- **Docker:** `docker-compose.yml` with 2 containers: `frontend` (5173) + `backend` (8788) sharing D1/R2 local via Miniflare

### Tests (Slice 0)
- `npm test` → 11 tests (App + api client)
- `npm run test:workers` → 15 tests (env + health endpoint)
- All green via Docker (bypasses host proxy)

---

## Quick Start with Docker (Recommended — bypasses host proxy issues)

### Prerequisites
- Docker + Docker Compose (you confirmed available)
- No need for local `npm install` — Docker handles it via container network

### 1. Start full stack (React + backend + D1 + R2 local)
```bash
# Frontend at http://localhost:5173 (Vite HMR) proxies /api to backend
# Backend at http://localhost:8788 (Wrangler pages dev, D1+R2 Miniflare)
docker compose up -d --build frontend backend
# Wait ~30s for npm install + build
docker compose logs frontend -f   # check vite ready
docker compose logs backend -f    # check wrangler ready

# Health check — proves Pages+Functions+D1+R2 wiring:
curl http://localhost:8788/api/health
# → {"status":"ok","db":"ok","r2":"ok","env":"local","checks":{"d1Ms":..,"r2Ms":..}}

# Via frontend proxy:
curl http://localhost:5173/api/health
# → same ok response

# Open browser:
open http://localhost:5173   # should show DB: ok, R2: ok, env banner

# Stop:
docker compose down
```

### 2. Run tests via Docker (no host proxy needed)
```bash
docker run --rm -v "$PWD":/app -w /app node:20 npm test
docker run --rm -v "$PWD":/app -w /app node:20 npm run test:workers
# Or via compose:
docker compose run --rm tests
```

### 3. Build
```bash
docker run --rm -v "$PWD":/app -w /app node:20 npm run build
# → dist/ created, ready for Cloudflare Pages
```

### Docker Files
- `docker-compose.yml` — frontend (node:20-alpine Vite) + backend (node:20 Debian, workerd needs glibc) + init + tests
- `Dockerfile.frontend` / `Dockerfile.backend` — standalone Dockerfiles
- Volumes: `backend_nm` separate for linux workerd binary

---

## Local Dev Without Docker (if network proxy works)

```bash
npm ci
npm run build
npm test
npm run test:workers
npx wrangler pages dev dist --d1=DB --r2=R2_BUCKET --local
curl http://localhost:8788/api/health
```

---

## One-time Cloudflare + GitHub Setup for Slice 0 + Alpha Env

You confirmed you have CF account + domain.

### 1. Wrangler Login + D1/R2 Create (local only, but IDs needed for prod)
```bash
npx wrangler login
# D1 3 envs
npx wrangler d1 create portfolio-db
npx wrangler d1 create portfolio-db-preview
npx wrangler d1 create portfolio-db-alpha
# Save IDs into wrangler.toml env.preview/alpha/production database_id fields
# R2 3 envs
npx wrangler r2 bucket create portfolio-images
npx wrangler r2 bucket create portfolio-images-preview
npx wrangler r2 bucket create portfolio-images-alpha

# Migrations local + remote
npx wrangler d1 migrations apply portfolio-db --local
npx wrangler d1 migrations apply portfolio-db --remote
npx wrangler d1 migrations apply portfolio-db-preview --remote
npx wrangler d1 migrations apply portfolio-db-alpha --remote

# Verify tables
npx wrangler d1 execute portfolio-db --local --command "SELECT name FROM sqlite_master WHERE type='table'"
# → pages, sections, section_items, contacts, bookings
```

### 2. GitHub Repo → Cloudflare Pages (Git integration)
1. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git → Select repo `hohodsj/FanWebApp`
2. Build config:
   - Framework: Vite
   - Build command: `npm run build`
   - Output: `dist`
   - Root: `/`
   - Prod branch: `main`
   - Node: 20 (`NODE_VERSION=20`)
3. Settings → Builds → Preview deployments: Enable for all branches (gives `<hash>.pages.dev` per PR)
4. Settings → Functions → Compatibility date: `2024-01-01`
5. Settings → Functions → Bindings:
   - **Production** (`main` → `somewebsite.com`):
     - D1 `DB` → `portfolio-db`
     - R2 `R2_BUCKET` → `portfolio-images`
     - Vars: `ENVIRONMENT=production`, `SITE_URL=https://somewebsite.com`, `WORKING_HOURS_START=09:00`, `WORKING_HOURS_END=17:00`, `WORKING_DAYS=1,2,3,4,5`, `SLOT_DURATION_MINUTES=30`
   - **Preview** (PRs → `<hash>.pages.dev`):
     - D1 `portfolio-db-preview`, R2 `portfolio-images-preview`, `ENVIRONMENT=preview`, `SITE_URL=https://preview...`
   - **Alpha** (`alpha` → `alpha.somewebsite.com`):
     - If Dashboard has branch-specific vars UI: set for `alpha` branch D1 `portfolio-db-alpha`, R2 `portfolio-images-alpha`, `ENVIRONMENT=alpha`, `SITE_URL=https://alpha.somewebsite.com`
     - Else use `wrangler.toml` `[env.alpha]` — we will document actual UI after you create alpha branch.
6. Custom domains:
   - `somewebsite.com` → branch `main` → auto DNS + SSL
   - `alpha.somewebsite.com` → branch `alpha` (create branch first: `git checkout -b alpha && git push -u origin alpha`) → auto DNS + SSL
7. GitHub → Settings → Branches:
   - `main` protected: require PR, require CI + Pages checks
   - `alpha` protected lighter (allow faster merge, but require CI)

### 3. GitHub Actions CI (already added `.github/workflows/ci.yml`)
- Runs `npm ci`, `build`, `test`, `test:workers` on every push/PR
- Appears as GitHub Check `test`
- Cloudflare Pages also posts check `Cloudflare Pages` with preview URL

### 4. Secrets (not needed for Slice 0, but for later slices)
```bash
# For Slice 2+ (GCal etc), set same SA JSON across envs but different calendar IDs via vars:
cat gcal-key.json | npx wrangler secret put GCAL_SERVICE_ACCOUNT_KEY --env production
cat gcal-key.json | npx wrangler secret put GCAL_SERVICE_ACCOUNT_KEY --env alpha
cat gcal-key.json | npx wrangler secret put GCAL_SERVICE_ACCOUNT_KEY --env preview

# Or via Dashboard → Settings → Variables → Encrypted (per env)
```

Create `.dev.vars` (gitignored) for `wrangler pages dev` if you run outside Docker.

---

## GitHub PR Flow with Alpha Env (Your Requested Flow)

```
Feature branch slice/N → PR vs alpha → CI green + Preview https://<hash>.pages.dev
  → test preview /api/health
  → merge → alpha branch → auto deploy → https://alpha.somewebsite.com/api/health (alpha DB/R2) QA
  → if green → PR alpha → main → auto deploy → https://somewebsite.com/api/health (prod DB/R2)
```

### Per PR Checklist (I will provide per slice)
1. Local: `docker run ... npm test && npm run build` green, or `docker compose up` health ok
2. Push branch: `git push origin slice/N`
3. Open PR vs `alpha` (or vs `main` if alpha deferred)
4. GitHub: CI `test` job green + Cloudflare Pages preview green + preview URL posted as comment
5. Hit preview URL: `https://<hash>.portfolio-site.pages.dev/api/health` → `{db:ok,r2:ok,env:preview}`
6. Merge to `alpha` → `https://alpha.somewebsite.com/api/health` → ok (alpha DB/R2)
7. PR `alpha` → `main` → `https://somewebsite.com/api/health` → ok

### How to Deploy Slice 0 Feature (Current PR)

**Local (Docker, recommended):**
```bash
docker compose up -d backend
sleep 20
curl http://localhost:8788/api/health
# → {"status":"ok","db":"ok","r2":"ok","env":"local"}
docker compose down
```

**GitHub → Cloudflare Preview:**
1. Push branch: `git push origin slice-0-infra-proof` (current branch)
2. GitHub: Open PR vs `main` or vs `alpha` (if alpha exists)
   - Title: `Slice 0: Infra Proof — Pages+Functions+D1+R2`
   - Body includes: tests `npm test` + `test:workers` green, build green, files list, deploy steps
3. Wait for Checks: `CI / test` + `Cloudflare Pages` → both green
4. Open preview URL from PR comment: `https://<hash>.FanWebApp.pages.dev`
5. Test:
   - `https://<hash>.pages.dev/` → shows Pill with DB:ok R2:ok
   - `https://<hash>.pages.dev/api/health` → JSON ok, env=preview, d1Ms <100, r2Ms <100
6. If you have prod domain connected: merge to main → `https://somewebsite.com/api/health` → ok
7. If you have alpha domain: push alpha branch after → `https://alpha.somewebsite.com/api/health` → ok

**Cloudflare Dashboard Manual Verification per Env:**
- Pages → project → Deployment → Preview/Production → Logs: build + Functions no errors
- D1 → `portfolio-db-preview` → `SELECT * FROM pages` etc empty for Slice 0 (tables exist), check via `wrangler d1 execute portfolio-db-preview --remote --command "SELECT name FROM sqlite_master WHERE type='table'"`
- R2 → `portfolio-images-preview` bucket exists via `wrangler r2 bucket list` and `r2 object list`
- Zero Trust Access not needed yet for Slice 0 (admin comes later)

---

## Slice 0 Deliverables ✅

- `wrangler.toml` — 3 envs: preview (PR), alpha (alpha subdomain), production (prod), placeholder IDs + vars
- `migrations/0001_initial.sql` — 5 tables: pages, sections, section_items, contacts, bookings + indexes
- `functions/api/health.ts` — GET /api/health checks D1 SELECT 1 + R2 PUT/GET/DELETE
- `functions/_lib/env.ts` — ENVIRONMENT detection (production/preview/alpha/local/test) + helpers isPreview/isAlpha/etc
- `functions/_lib/db.ts` — checkD1()
- `functions/_lib/r2.ts` — checkR2()
- Tests:
  - `functions/_lib/env.test.ts` (10 tests) — env detection
  - `functions/api/health.test.ts` (5 tests) — db ok, r2 ok, failure modes, timing + env
  - `src/lib/api.ts` — typed fetchHealth() with timeout/abort + ApiError
  - `src/lib/api.test.ts` (5 tests) — fetch ok, 500 error, network error, timeout, minimal
  - `src/components/EnvBanner.tsx` — shows [ALPHA]/[PREVIEW] when not production
  - `src/components/HealthBadge.tsx` — DB:R2 status pills
  - `src/App.tsx` — full page with health check + R2 placeholder + docs
  - `src/App.test.tsx` (6 tests) — loading, ok, error, R2 image, env banner
- `vite.config.ts` — proxy /api to backend (respects VITE_API_PROXY_TARGET for Docker), jsdom tests
- `vite.workers.config.ts` — node env for functions tests (avoids workers pool version mismatch)
- `docker-compose.yml` — frontend (5173) + backend (8788) + init + tests services, uses node:20 for backend (glibc for workerd)
- `Dockerfile.frontend` / `Dockerfile.backend`
- `.github/workflows/ci.yml` — runs build + test + test:workers on push/PR
- `DECISIONS.md` — 22 decisions + env table + external services multi-env
- `wrangler.toml` — ready for 3 envs

**Stats:**
- Frontend tests: 11 passed
- Workers tests: 15 passed
- Total: 26 tests green
- Build: 150KB JS (48KB gz) + 2.3KB CSS
- Health endpoint: D1 ~20-40ms, R2 ~30-50ms local, <100ms target

---

## Next Slices (Vertical)

- **Slice 1:** Content Display `GET /api/content/home` — D1 pages→sections→items + R2 images, seed migration, section components (Hero, CardsGrid, etc.)
- **Slice 2:** Calendar Slots `GET /api/calendar/slots` — GCal FreeBusy + slot math + 5-min cache
- **Slice 3:** Booking `POST /api/booking` — Turnstile + contact upsert + GCal event with Meet + Resend + cancel token
- **Slice 4:** Cancel `GET /api/cancel/{token}` — DELETE event + reopen slot
- **Slice 5:** Materials `POST /api/materials/lookup` — email → Drive URL
- **Slice 6:** Admin Edit — inline editing + R2 upload + Access auth
- **Slice 7:** Admin Bookings — list/resend/cancel
- **Slice 8:** Admin Contacts + Drive — ?email= filter + set Drive URL, full E2E
- **Slice 9:** Polish + SEO + deploy docs + Lighthouse

Each slice: TDD red→green, one PR, preview URL, alpha test, prod merge.

---

## TDD Notes

- Tests written first (RED), then impl (GREEN) — Slice 0 done this way
- Frontend: Vitest + Testing Library + jsdom
- Backend: Vitest node env (not workers pool due to version mismatch, but mocks D1/R2 — real miniflare for later slices)
- Stub mode `STUB=true` for GCal/Resend/Turnstile (later), `LIVE_INTEGRATION=1` for real when secrets set
- Docker bypasses host proxy (x2pagentd) for npm install + wrangler

---

## Decisions

See `DECISIONS.md` for 22 architectural decisions, 3-env table (preview/alpha/prod), and external services multi-env (1 SA shared, 3 calendars isolated, 1 Resend key, 1 Turnstile widget).

## Troubleshooting

**Docker workerd ENOENT:** Use `node:20` not `node:20-alpine` for backend (workerd needs glibc). Fixed in compose.

**npm install hangs on host:** Host proxy `http://localhost:10054` (x2pagentd) may return 503. Use Docker: `docker run --rm -v "$PWD":/app -w /app node:20 npm install` or `docker compose up`.

**vitest rollup darwin-arm64 missing:** Host installed linux rollup via Docker. Run tests via Docker: `docker run --rm -v "$PWD":/app -w /app node:20 npm test` or clean `node_modules` and reinstall via Docker with proper arch.

**Wrangler placeholders:** `wrangler.toml` has `preview-placeholder-id` etc — replace with real IDs after `wrangler d1 create ...` for prod deploy, but local Docker uses `--local` so placeholders ok for local dev.
