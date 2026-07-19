# PR: Slice 0 — Infra Proof Pages+Functions+D1+R2 + Docker + TDD

## Summary
Vertical slice 0: proves **GitHub → Cloudflare Pages → Functions → D1 → R2** works together with 3-env isolation (preview/alpha/prod) + Docker dev setup that bypasses host proxy.

This is the **BLOCKER** for all other slices.

## What

**Scaffold:**
- Vite React TS + `wrangler.toml` with 3 envs: `[env.preview]`, `[env.alpha]`, `[env.production]` each with D1 binding `DB` + R2 binding `R2_BUCKET` + `ENVIRONMENT` var + placeholder IDs
- `migrations/0001_initial.sql` — 5 tables per design doc: pages, sections, section_items, contacts, bookings + indexes

**Backend (Functions):**
- `functions/_lib/env.ts` — `getEnvironment()`, `isPreview()`, `isAlpha()`, `isProduction()`, `isLocal()`
- `functions/_lib/db.ts` — `checkD1()` via `SELECT 1`
- `functions/_lib/r2.ts` — `checkR2()` via PUT/GET/DELETE tiny object
- `functions/api/health.ts` — `GET /api/health` → runs D1+R2 checks in parallel, returns `{status, db, r2, timestamp, env, checks:{d1Ms,r2Ms}, sampleImageUrl}` + 200 or 500

**Frontend:**
- `src/lib/api.ts` — `fetchHealth({timeoutMs})` typed client with AbortController timeout, ApiError class
- `src/components/EnvBanner.tsx` — shows `[ALPHA]` / `[PREVIEW]` banner when env != production
- `src/components/HealthBadge.tsx` — DB:ok/R2:ok pills + timing
- `src/App.tsx` — mounts health check, shows badge, R2 sample image, docs sections
- `src/main.tsx`, `index.css` (minimal, no Tailwind yet to keep slice small), `index.html`

**Docker (Your Suggestion — Solves Proxy Issue):**
- `docker-compose.yml` — 2 containers:
  - `frontend`: node:20-alpine, Vite dev 5173, proxy `/api` → `http://backend:8788` (via `VITE_API_PROXY_TARGET`)
  - `backend`: node:20 (debian, not alpine — workerd needs glibc), Wrangler pages dev 8788, D1+R2 Miniflare local
  - `init` profile: D1 migrations apply local
  - `tests` profile: runs both test suites
- `Dockerfile.frontend` / `Dockerfile.backend` — standalone
- Verified:
  - `http://localhost:8788/api/health` → `{"status":"ok","db":"ok","r2":"ok","env":"local"}`
  - `http://localhost:5173/api/health` → same via frontend proxy
  - No host `npm install` needed — Docker container network bypasses host `x2pagentd` proxy that was returning 503

**Tests TDD Red→Green:**
- Wrote tests first:
  - `functions/_lib/env.test.ts` — 10 tests: getEnvironment for prod/alpha/preview/local/test, isPreview/isAlpha/isProduction/isLocal
  - `functions/api/health.test.ts` — 5 tests: db ok + r2 ok success, db error 500, r2 error 500, missing bindings 500, timing+env included
  - `src/lib/api.test.ts` — 5 tests: fetch ok parse, 500 throws ApiError, network error graceful, timeout aborts, minimal JSON
  - `src/App.test.tsx` — 6 tests: loading, ok badge, error, R2 image, [ALPHA] banner, no banner when prod
- Then implemented to green
- All 26 tests pass via Docker (host `x2pagentd` proxy blocks host npm, but Docker bypasses):

```bash
docker run --rm -v "$PWD":/app -w /app node:20 npm test
# 2 files, 11 tests passed

docker run --rm -v "$PWD":/app -w /app node:20 npm run test:workers
# 2 files, 15 tests passed

docker run --rm -v "$PWD":/app -w /app node:20 npm run build
# dist 150KB JS 48KB gz
```

**CI & Docs:**
- `.github/workflows/ci.yml` — runs build + test + test:workers on push/PR (Node 20)
- `DECISIONS.md` — 22 decisions + env table + external services multi-env
- `README.md` — full Docker quick start, local dev, CF+GitHub alpha setup, per-PR checklist, deploy steps for this slice

## Tests

**Local via Docker (Recommended):**
```bash
docker run --rm -v "$PWD":/app -w /app node:20 npm test
docker run --rm -v "$PWD":/app -w /app node:20 npm run test:workers
docker run --rm -v "$PWD":/app -w /app node:20 npm run build

# Full stack:
docker compose up -d backend
sleep 20
curl http://localhost:8788/api/health
# → {"status":"ok","db":"ok","r2":"ok","env":"local","checks":{"d1Ms":..,"r2Ms":..}}
docker compose up -d frontend
curl http://localhost:5173/api/health
# → same ok
docker compose down
```

**Without Docker (if proxy fixed):**
```bash
npm ci
npm run build
npm test
npm run test:workers
npx wrangler pages dev dist --d1=DB --r2=R2_BUCKET --local
curl http://localhost:8788/api/health
```

## How to Deploy This Slice (GitHub + Cloudflare Pages + Alpha Env)

### One-time Setup (If Not Done)

**A. Wrangler D1/R2 Create (local CLI, not via GitHub publish):**
```bash
npx wrangler login
npx wrangler d1 create portfolio-db
npx wrangler d1 create portfolio-db-preview
npx wrangler d1 create portfolio-db-alpha
# Copy IDs into wrangler.toml env.preview/alpha/production database_id
npx wrangler r2 bucket create portfolio-images
npx wrangler r2 bucket create portfolio-images-preview
npx wrangler r2 bucket create portfolio-images-alpha

# Migrations
npx wrangler d1 migrations apply portfolio-db --local
npx wrangler d1 migrations apply portfolio-db --remote
npx wrangler d1 migrations apply portfolio-db-preview --remote
npx wrangler d1 migrations apply portfolio-db-alpha --remote
```

**B. Cloudflare Pages Connect to GitHub:**
1. Dashboard → Workers & Pages → Create → Pages → Connect to Git → Select `hohodsj/FanWebApp`
2. Build: Vite, `npm run build`, output `dist`, prod branch `main`, Node 20
3. Settings → Builds → Preview deployments: Enable for all branches
4. Settings → Functions → Bindings:
   - Production: D1 `DB`→`portfolio-db`, R2 `R2_BUCKET`→`portfolio-images`, Vars `ENVIRONMENT=production`, `SITE_URL=https://somewebsite.com`
   - Preview: D1 `portfolio-db-preview`, R2 `portfolio-images-preview`, `ENVIRONMENT=preview`
   - Alpha: if UI supports branch vars, set for `alpha`: D1 `portfolio-db-alpha`, R2 `portfolio-images-alpha`, `ENVIRONMENT=alpha`, `SITE_URL=https://alpha.somewebsite.com`
5. Custom domains:
   - `somewebsite.com` → branch `main`
   - `alpha.somewebsite.com` → branch `alpha` (create alpha branch first)

### This PR Deploy Flow

**1. Push:**
```bash
git checkout -b slice-0-infra-proof  # already on this branch
git push -u origin slice-0-infra-proof
```

**2. Open PR on GitHub vs `alpha` (or vs `main` if alpha deferred):**
- Title: `Slice 0: Infra Proof — Pages+Functions+D1+R2`
- Description: copy this file

**3. GitHub Checks:**
- CI: `test` job → should be green (build + 26 tests)
- Cloudflare Pages: `Deploy preview` → green + posts preview URL like `https://a1b2c3.FanWebApp.pages.dev` as PR comment

**4. Test Preview Deployment (Cloudflare auto):**
- Open preview URL: `https://<hash>.FanWebApp.pages.dev`
- Should show: **Portfolio — Infra Proof** page with **DB: ok, R2: ok**, env badge if preview
- Hit `https://<hash>.FanWebApp.pages.dev/api/health`:
  ```json
  {"status":"ok","db":"ok","r2":"ok","env":"preview","checks":{"d1Ms":..,"r2Ms":..}}
  ```
- Check Cloudflare Dashboard → Pages → project → Deployment → Preview → Logs: build + Functions ok, no errors
- Verify D1: `wrangler d1 execute portfolio-db-preview --remote --command "SELECT name FROM sqlite_master WHERE type='table'"` → 5 tables
- Verify R2: `wrangler r2 bucket list` → 3 buckets, `r2 object list portfolio-images-preview` empty (ok for slice 0)

**5. Merge to Alpha:**
- Merge PR into `alpha` branch → GitHub pushes `alpha` → Pages auto deploys `alpha` branch → `https://alpha.somewebsite.com`
- Test: `https://alpha.somewebsite.com/api/health` → ok, env=alpha, DB ok, R2 ok
- UI: `https://alpha.somewebsite.com/` → shows [ALPHA] orange banner + DB:ok R2:ok

**6. Merge Alpha → Main (Prod):**
- PR `alpha` → `main` → merge → Pages auto prod → `https://somewebsite.com`
- Test: `https://somewebsite.com/api/health` → ok, env=production, no alpha banner
- Dashboard: Production deployment logs green

**Rollback:**
- Revert PR in GitHub → Pages auto redeploys previous main
- Preview D1/R2 isolated, prod unaffected

### Troubleshooting This Slice
- **D1/R2 placeholders in wrangler.toml:** Replace `preview-placeholder-id` etc with real IDs from `wrangler d1 create` for Cloudflare remote (local `--local` works with placeholders)
- **workerd ENOENT in Docker:** Use `node:20` not `node:20-alpine` for backend (alpine musl vs glibc) — fixed in compose
- **Host npm install 503:** Host proxy `x2pagentd` on :10054 may block. Use Docker: `docker run --rm -v "$PWD":/app -w /app node:20 npm install`
- **Rollup darwin-arm64 missing:** Host installed linux rollup via Docker. Use Docker for tests or `rm -rf node_modules && docker run ... npm install` to get correct arch

## Files

```
wrangler.toml
migrations/0001_initial.sql
functions/_lib/env.ts, env.test.ts, db.ts, r2.ts
functions/api/health.ts, health.test.ts
src/lib/api.ts, api.test.ts
src/components/EnvBanner.tsx, HealthBadge.tsx
src/App.tsx, App.test.tsx, main.tsx, index.css
src/test/setup.ts, vite-env.d.ts
vite.config.ts (proxy respects VITE_API_PROXY_TARGET for Docker)
vite.workers.config.ts (node env, not workers pool due to vitest 2.1 vs pool compat)
docker-compose.yml (frontend:5173 backend:8788)
Dockerfile.frontend/backend
.github/workflows/ci.yml
DECISIONS.md, README.md, .gitignore, .dev.vars.example
```

## Verification

- [x] `npm test` → 11 passed (via Docker)
- [x] `npm run test:workers` → 15 passed (via Docker)
- [x] `npm run build` → 150KB JS
- [x] `docker compose up backend` → `/api/health` → ok (db:ok r2:ok)
- [x] `docker compose up frontend+backend` → `/api/health` via proxy → ok
- [x] Local commit `slice-0-infra-proof`

## Next Slice
Slice 1: Content Display `GET /api/content/home` from D1 + R2 images, seed data, section components.

## Decisions
See `DECISIONS.md` for 22 decisions incl. D-19 (GitHub Pages Git integration), D-20 (TDD), D-21 (alpha branch → alpha.somewebsite.com custom domain with own D1/R2).

## Questions
- You have CF + domain — ready to connect Pages to GitHub?
- Should I create `alpha` branch now after Slice 0 merges, as per your earlier "Later" answer?
- Vitest workers pool version mismatch — kept node env for Slice 0, will resolve with wrangler 4 or vitest 1.6 in Slice 1 if needed, okay?

---

## How to Setup & Test in Cloudflare (Detailed per Your Request)

### You asked: How do I config in CF and GitHub? 2 D1/R2 env? Google APIs?

**A. GitHub:**
- Repo already `hohodsj/FanWebApp`, branch `slice-0-infra-proof` created
- Create `alpha` branch later: `git checkout -b alpha && git push -u origin alpha`
- Branch protection: `main` require PR + CI + Pages checks, `alpha` lighter
- GitHub App: Cloudflare Pages installs automatically when you Connect to Git in CF Dashboard

**B. Cloudflare Pages:**
- Project: `FanWebApp` or `portfolio-site`
- Connect to Git: Select repo, prod branch `main`, build `npm run build`, output `dist`
- Preview deployments: Enable all branches → PRs get `<hash>.pages.dev`
- Bindings:
  - Production: D1 `portfolio-db`, R2 `portfolio-images`, Vars `ENVIRONMENT=production`, `SITE_URL=https://somewebsite.com`, working hours
  - Preview: D1 `portfolio-db-preview`, R2 `portfolio-images-preview`, `ENVIRONMENT=preview`
  - Alpha: if Dashboard supports branch vars, D1 `portfolio-db-alpha`, R2 `portfolio-images-alpha`, `ENVIRONMENT=alpha`, `SITE_URL=https://alpha.somewebsite.com` — else via `wrangler.toml [env.alpha]`
- Custom domains:
  - `somewebsite.com` → `main`
  - `alpha.somewebsite.com` → `alpha` → auto DNS + SSL

**C. D1/R2 Envs: 3 not 2 (Recommended for Your Alpha Flow):**
| Env | Branch | D1 | R2 | Purpose |
|-----|--------|-----|-----|---------|
| Preview | PRs | `portfolio-db-preview` | `portfolio-images-preview` | Ephemeral per PR, can break |
| Alpha | `alpha` | `portfolio-db-alpha` | `portfolio-images-alpha` | Persistent QA, realistic data |
| Prod | `main` | `portfolio-db` | `portfolio-images` | Real |

Could do 2 (alpha reuses preview), but 3 gives clean alpha persisting across PRs.

**D. Google APIs / Resend / Turnstile:**
- **GCal SA:** 1 SA `portfolio@...iam` shared across envs, 3 calendars isolated: `bookings-prod`, `bookings-alpha`, `bookings-preview` each shared with SA as editor, personal calendar shared free/busy only. Each env's `BOOKING_CALENDAR_ID` var points to its calendar. Same JSON key secret in 3 envs via `wrangler secret put --env`. Alt: 1 SA per env for strict isolation.
- **Resend:** 1 key, 1 verified domain `somewebsite.com` SPF/DKIM, same key across envs, FROM differs or subject `[ALPHA]` prefix. 100/day shared fine.
- **Turnstile:** 1 widget, allowed hosts `somewebsite.com, alpha.somewebsite.com, *.pages.dev`, same site+secret keys across envs. Or 3 widgets.
- **Access:** 2 Zero Trust apps for `/admin/*` on prod + alpha, same allowlist email.

Secrets via `wrangler secret put ... --env preview/alpha/production` or Dashboard Encrypted Vars.

**E. Wrangler Local Only:**
- `wrangler d1 create ...` 3 DBs, `r2 bucket create ...` 3 buckets, `d1 migrations apply --local --remote` for all 3, `pages dev dist --d1=DB --r2=R2_BUCKET --local` for local dev
- No `wrangler pages publish` — GitHub push triggers Pages build via webhook

**F. GitHub Actions CI:**
- `.github/workflows/ci.yml` runs on push/PR: `npm ci`, `build`, `test`, `test:workers` — appears as check `test`, alongside Pages check
