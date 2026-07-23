# Portfolio Website — Cloudflare Free Tier ($0/month)

Single-page dynamic portfolio with integrated meeting scheduler. 100% Cloudflare free tier — React + Vite frontend, Pages Functions (Workers) backend, D1 SQLite, R2 Object Storage.

**Live URLs:**
- **Prod (main):** https://profile-webapp.pages.dev — `env:production`, prod D1 `f6dfc0c2-a7db-4e4a-b2de-abc5926fbf8b`, prod R2 `portfolio-images` — health `db:ok r2:ok`
- **Alpha (alpha):** https://alpha.profile-webapp.pages.dev — `env:alpha`, alpha D1 `30b1ea40-63cd-41ef-84d5-2d9007bea311`, alpha R2 `portfolio-images-alpha` — health `db:ok r2:ok` + clean premium UI (no debug banners)
- **Health JSON:** `/api/health` → `{status, db, r2, env, checks, timestamp}` — both envs require D1+R2
- **Content JSON:** `/api/content/home` → `{page, sections: [hero, cards-grid, text-block, testimonials, cta-banner, image-gallery]}` ordered, filtered `is_visible`

## Architecture — Slice 0 ✅ + Slice 1 ✅ Complete

### Completed Slices

**Slice 0 — Infra Proof (Pages+Functions+D1+R2 + Docker + TDD 27→29 tests)**

- Scaffold Vite React TS, `wrangler.toml` with 2 envs `preview` (holds alpha) + `production` (prod) — Pages only supports preview/production, NOT custom alpha name (fix for build error `Configuration file contains environment names not supported: "alpha"`)
- `migrations/0001_initial.sql` — 5 tables: pages, sections, section_items, contacts, bookings
- `functions/api/health.ts` — `GET /api/health` checks **both D1+R2 for both envs** (R2 now required, was optional `skipped` before billing): `Promise.all(checkD1, checkR2)` → 200 `{db:ok,r2:ok,env}` or 500
- Helpers: `env.ts` getEnvironment, `db.ts` checkD1 SELECT 1, `r2.ts` checkR2 PUT/GET/DELETE
- Frontend: `lib/api.ts` fetchHealth with timeout/abort, `HealthBadge`, `EnvBanner` (now only used at `/health` debug page, not main), `src/pages/Health.tsx` dedicated `/health` route
- Docker: `docker-compose.yml` frontend 5173 (alpine Vite) + backend 8788 (node:20 debian, workerd needs glibc) + init + tests, volumes `backend_nm`, uses Docker network to bypass host `x2pagentd` proxy on `:10054` that blocks `registry.npmjs.org` 503
- Isolated git env: container `isolated-git-env` at `/workspace` mounting repo, used for `docker exec isolated-git-env git ...` when host git auth fails (`chc421` vs `hohodsj`)
- CI: `.github/workflows/ci.yml` Node 20 runs `npm ci`, `lint` (`tsc --noEmit` needs `@types/node`), `build`, `test -- --run`, `test:workers -- --run` — fixed double `--run` bug (package.json had `vitest --run`, CI added `-- --run` → `vitest --run --run` error)
- Deployed: single Pages project `profile-webapp`, Branch control Production `main` + Preview Custom `alpha` only (screenshot) for full isolation (not All non-prod), alpha `alpha.profile-webapp.pages.dev` and prod `profile-webapp.pages.dev` both green after fixing `wrangler.toml` env naming, health `db:ok r2:ok`

**Slice 1 — Portfolio Content Display from D1 + Premium UI (TDD 61→60 tests)**

- **Backend:** `functions/_lib/content.ts` helpers `safeParseConfig`, `orderBySort`, `filterVisible` + `functions/api/content/[slug].ts` dynamic route `[slug]` → `params.slug` → D1 query `pages WHERE slug` → sections `WHERE page_id ORDER sort_order` → items `WHERE section_id ORDER sort_order`, filter `is_visible`, `Cache-Control: public, max-age=300` 5-min, fallback seed for local `pages dev` persistence quirk (`no such table: pages` → returns same as 0002 seed for `home` only, remote uses real D1 via `--remote` migrations)
- **Tests BE:** `content.test.ts` 4, `content/[slug].test.ts` 9 (404 unknown, ordered sections, filtered sections, items ordered, filtered items, config parse, meta_description, cache header, empty sections) including explicit alpha env `db:ok r2:ok` and prod env `db:ok r2:ok` for both envs
- **Frontend API:** `lib/api.ts` `fetchContent(slug)` + `ContentResponse` types Page/Section/Item (6 types: hero, cards-grid, testimonials, text-block, cta-banner, image-gallery) + `ApiError`
- **Hook:** `src/hooks/useContent.ts` loading/error/data/refetch
- **Sections (premium UI inspired by Tristan CPA accounting firm Behance + Nicepage, combined with requirements: calendar, no blog/login):**
  - `HeroSection`: trust badge green pulse `Available for new projects • Boston-based, global clients`, Playfair Display headline `text-4xl lg:text-5xl font-black`, stats bar 10+ yrs / 120+ projects / 98% retention, CTA `btn-primary rounded-full` black + secondary, image offset bg + floating card conversion focused, `aspect-[4/3]`
  - `CardsGrid`: heading Playfair, `sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8`, icon `w-12 h-12 rounded-xl bg-slate-50 border flex-none text-xl` with span 22px `aria-hidden` — fixed from `w-10` full-width gray bar bug in screenshot 1, number `0{idx+1}` mono, empty `Services coming soon`
  - `TextBlock` (About): `gap-12 lg:gap-16 py-20 items-center`, **removed redundant About pill** `About` repeated (screenshot 2), image `aspect-[4/3] h-auto shadow-md rounded-2xl`, bio `max-w-[65ch]`, credentials box, CTAs, badge `Based in Boston Working globally`
  - `Testimonials`: stars amber, avatar `w-9 h-9 bg-slate-900 circle flex-none`, quote mark, `lg:grid-cols-3`, empty `Client feedback coming soon` — removed redundant pills
  - `CTABanner`: dark slate-900 gradient, pulse dot `Available for new projects`, Playfair heading, white button `px-8 py-4 rounded-full` — **fixed from `px-7 py-3` where `px-7` had no CSS rule (text close to border)** → now `px-8 py-4 leading-none gap-4` breathing room, focus ring
  - `ImageGallery`: `sm:grid-cols-2 lg:grid-cols-3`, hover `scale-[1.03]`, `aspect-[4/3]`, empty `Selected work coming soon`, alt descriptive — fixed backtick escaping syntax error
- **Common:** `Nav` sticky blur `saturate(180%) blur(12px)` bg `rgba(255,255,255,0.9)`, Playfair logo, `flex-wrap gap-4 sm:gap-6 justify-end` + `hidden sm:inline` for mobile, `Layout` no longer renders `EnvBanner` (clean), `Footer` 3-col premium Playfair logo, Services/Company (no blog/login per requirement), CTA card `bg-slate-50 border rounded-xl` with `Book free call →` `btn-primary w-full justify-center`
- **Pages:** `Home` assembles sections via `useContent('home')` pure content-driven, no infra health `<details>` debug (removed per user request), user-friendly `Loading portfolio…`, `Unable to load portfolio Please try again later`, `Content is being prepared`, calendar placeholder premium card no raw `GET /api/...` path
- **App.tsx:** Simple routing `window.location.pathname /health` → `<Health />` (debug EnvBanner+HealthBadge at `/health` + `/api/health` JSON), else `<Layout title=Portfolio><Home /></Layout>` — **removed BOLD ENV banner** `🚀 BOLD LOCAL ENV — LOCAL ✅` from main page per user request (was Slice 0 verification, now only at /health)
- **Seed:** `migrations/0002_seed.sql` — `page_home` home Jane Doe — Designer & Developer + 6 sections ordered 0-5: hero (Welcome to My Portfolio + image + CTA Explore Services), services 6 cards Brand Strategy … Consulting with icons 🎯✨💻🎨📸💡, about Jane Doe + photo + 10+ yrs credentials, testimonials 3 with authors, CTA Let’s build something great together + Book a Call → /#calendar, gallery 6 unsplash images — 18 items total, same as fallback
- **Docker:** Backend compose now runs `d1 migrations apply DB --local` before `pages dev` to ensure local D1 has tables (fix for `local-DB` vs file persistence where `d1 create portfolio-db` vs `d1 create DB` binding name mismatch caused `no such table: pages`)
- **Tests FE:** `api.test.ts` 8 (health 5 + content 3), `App.test.tsx` 5 rewritten for clean UI (no BOLD ENV on main, only at /health, loading portfolio, empty, health debug page at /health route with DB:ok R2:ok, no infra health on main), `useContent.test.tsx` 4, sections 12 (Hero 2, CardsGrid 2, TextBlock 2, Testimonials 2, CTABanner 2, Gallery 2) — fixed duplicate heading due to pills (use `getByRole heading`) and empty messages to user-friendly Services coming soon etc, ImageGallery syntax error fixed
- **Stats Slice 1:** Frontend 9 files 29 tests + Workers 4 files 31 tests = **60 tests green** (previously 26, 27, 61 intermediate) via Docker `node:20` (bypasses proxy), build CSS 8.42-8.76KB + JS 166KB
- **Branch naming:** `slice# + commitcount + words` per convention: `slice1-1-portfolio-content`, `slice1-2-ui-polish`, `slice1-3-clean-ui`, `slice1-4-premium-ui`, `slice1-5-button-fix` — each later contains previous (superset), so only latest `slice1-5` needs PR to alpha (contains all)

### Current Deployment — Slice 1 Complete ✅

- **Local Docker Integration:**
  - `docker compose up -d backend` → `GET /api/health` → `{status ok, db ok, r2 ok, env local, d1Ms ~15-38, r2Ms ~26-55}` — both D1+R2 checked for both envs (preview alpha R2 `portfolio-images-alpha` and prod R2 `portfolio-images` are real buckets now that R2 enabled)
  - `GET /api/content/home` → `{page.slug home, title Jane Doe — Designer & Developer, sections 6 ordered hero→services→about→testimonials→cta→gallery, items per section 1,6,1,3,1,6 =18 total}` — from D1 local or fallback `X-Content-Source: fallback-local-no-table` when Miniflare empty (remote uses real D1 via `--remote` migrations)
  - `GET /api/content/unknown` → 404 Page not found
  - Frontend `http://localhost:5173` → clean premium UI (no 🚀 BOLD LOCAL ENV banner, no infra health details), Hero with badge, Services 6 cards icons w-12 h-12 circles not bar, About gap-12 no duplicate About pill, Testimonials stars, CTA banner buttons px-8 py-4 breathing room (fixed from px-7 undefined), Gallery hover, Calendar placeholder premium card, Footer 3-col — mobile 1 col, no blog/login (Services, About, Testimonials, Calendar, Contact only)
  - `/health` UI: `http://localhost:5173/health` → System Health Debug with DB:ok R2:ok env local — env only at /health, not main per user request

- **Cloudflare Pages:**
  - Project `profile-webapp` — Production branch `main`, Preview Custom `alpha` only (full isolation, see Branch Control screenshot)
  - Choose Environment: Preview `ENVIRONMENT=alpha, SITE_URL=https://alpha.profile-webapp.pages.dev, BOOKING_CALENDAR_ID=alpha-booking@..., PERSONAL=alpha-personal@..., WORKING_HOURS 09:00-17:00, WORKING_DAYS 1-5, SLOT 30` + D1 `DB` → `portfolio-db-alpha` ID `30b1ea40-63cd-41ef-84d5-2d9007bea311` + R2 `portfolio-images-alpha`
  - Production: `ENVIRONMENT=production, SITE_URL=https://profile-webapp.pages.dev, BOOKING prod-...` + D1 `portfolio-db` ID `f6dfc0c2-a7db-4e4a-b2de-abc5926fbf8b` + R2 `portfolio-images`
  - **Before R2 enabled:** R2 buckets commented out in `wrangler.toml` due to `Please enable R2 [10042]` (needs billing, checkout blocked) → health returned `r2:skipped` 200 OK (temporary workaround). **After R2 active** (you activated): R2 uncommented → buckets created via `wrangler r2 bucket create portfolio-images(-alpha)` via Docker with `CLOUDFLARE_API_TOKEN` → health `r2:ok` for both envs (you saw R2: ok in alpha)
  - Deployments:
    - `alpha` at `c4a42f1` (old bold visual) → Production when prod was alpha, then after fixing branch control + `wrangler.toml` preview=alpha DB, production=main, `alpha` became Preview
    - `slice1-1-portfolio-content` `97ea9ce` (content display) → `slice1-2-ui-polish` `c8b746d` → `slice1-3-clean-ui` `5113cfa` (remove debug banners, fix icons, About spacing) → `slice1-4-premium-ui` `76bac13` (Tristan CPA premium) → `slice1-5-button-fix` `099eecc` (fix px-7 undefined → px-8 py-4 buttons) — each later contains previous, so only latest needs PR
    - `main` at `fb93c86` Merge PR #6 from alpha (includes doc/Setup.md + R2 enable) + later merges → `https://profile-webapp.pages.dev`
  - **Current remote after you enabled R2 and merged?** You reported `alpha.profile-webapp.pages.dev` empty earlier because `alpha` branch was empty initial `f228e03` (no deployment), then after merging Slice 0 fix `02944b0` + `be949cb` trigger + `c4a42f1` bold visual, it showed bold. After Slice 1 premium polish + button fix (slice1-5), needs PR `slice1-5-button-fix` → `alpha` → `https://alpha.profile-webapp.pages.dev` should show premium clean UI without bold debug, with `R2: ok`, 6 sections from alpha D1 (via remote `d1 migrations apply portfolio-db-alpha --remote` for 0002 seed). Then PR `alpha` → `main` → prod `https://profile-webapp.pages.dev` same.

## Quick Start with Docker (Recommended — bypasses host x2pagentd proxy 503)

### Prerequisites
- Docker + Docker Compose
- No host `npm install` needed — Docker bypasses proxy

### 1. Start full stack

```bash
# Backend auto-migrates local D1 now (fix for no such table: pages)
docker compose up -d --build backend
docker compose logs backend -f  # wait Ready on http://0.0.0.0:8788 + mappings DB: portfolio-db (f6dfc0c2) R2: portfolio-images

# Health — both D1+R2 for both envs (preview alpha DB+R2 and prod DB+R2)
curl http://localhost:8788/api/health | jq .
# → {"status":"ok","db":"ok","r2":"ok","env":"local","checks":{"d1Ms":15,"r2Ms":26}}

# Content — from D1 local or fallback seed same as 0002_seed.sql when Miniflare empty
curl http://localhost:8788/api/content/home | jq '.page.title, (.sections | length)'
# → "Jane Doe — Designer & Developer", 6
curl http://localhost:8788/api/content/home | jq '.sections[] | {type, heading, items: (.items | length)}'
# → hero 1, cards-grid 6, text-block 1, testimonials 3, cta-banner 1, image-gallery 6 = 18 items

# Frontend at 5173 proxies /api to backend
docker compose up -d frontend
curl http://localhost:5173/api/content/home | jq '.page.slug, (.sections | length)'  # → home, 6 via proxy
open http://localhost:5173
# → Clean premium UI (no BOLD ENV banner, no infra health details per user request, env only at /health):
#   Nav sticky blur + Playfair logo, Hero badge + Playfair headline + stats bar + dual CTA + image offset + floating card, Services 6 cards icons w-12 h-12 rounded-xl bg-slate-50 border flex-none not full-width bar (fixed from screenshot weird sizing), About gap-12 lg:gap-16 py-20 no duplicate About pill, Testimonials stars, CTA banner buttons px-8 py-4 breathing room (fixed from px-7 undefined text close to border), Gallery hover scale, Calendar premium card no raw API path, Footer 3-col no blog/login (only Services/About/Testimonials/Calendar/Contact per requirement, combining Tristan CPA premium aesthetic with our calendar)
# /health debug page:
open http://localhost:5173/health
# → System Health Debug with DB:ok R2:ok env local — env only here, not main

docker compose down -v
```

### 2. Tests via Docker (no host proxy)

```bash
# Frontend unit (9 files, 29 tests): api 8, App 5 clean UI, useContent 4, Hero 2, CardsGrid 2, TextBlock 2, Testimonials 2, CTABanner 2, Gallery 2
docker run --rm -v "$PWD":/app -w /app node:20 npm test -- --run

# Workers unit (4 files, 31 tests): env 10, health 8 (both alpha+prod require D1+R2 R2:ok), content lib 4, content endpoint 9 (404, ordered, filtered, config, meta, cache, empty) + explicit alpha and prod env checks
docker run --rm -v "$PWD":/app -w /app node:20 npm run test:workers -- --run

# Both
docker compose --profile test run --rm tests

# Total 60 tests green (was 26, 27, 61 intermediate)
```

### 3. Build

```bash
docker run --rm -v "$PWD":/app -w /app node:20 npm run build
# → dist/index.html 0.46KB, css 8.76KB (premium Tristan CPA + Nicepage expanded utilities), js 166KB (50KB gz)
```

## Cloudflare Setup — One-time (Docker-wrapped wrangler to bypass proxy)

### 1. API Token — Fetch (no localhost, OAuth fails behind proxy)

- **https://dash.cloudflare.com/profile/api-tokens → Create Token → Create Custom Token** (NOT template)
- Perms Account: `D1:Edit, Workers R2 Storage:Edit, Cloudflare Pages:Edit, Workers Scripts:Edit` + optional KV, Tail, Builds Config, etc (see doc/Setup.md example summary)
- Zone: `Workers Routes:Edit` All zones
- Copy raw token (no Bearer, no quotes, no newline)
- Verify:
```bash
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY \
CLOUDFLARE_API_TOKEN=your_token npx wrangler whoami
# Docker:
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=your_token node:20 npx wrangler whoami
```
- Error `Invalid request headers [6003] Invalid format for Authorization header [6111]`: token wrapped in quotes, Bearer prefix, truncated, or newline — fix via `tr -d '\n'` and Copy button

### 2. D1 + R2 Create — Scripted Idempotent (safe to re-run)

```bash
chmod +x scripts/setup-cloudflare.sh
CLOUDFLARE_API_TOKEN=your_token ./scripts/setup-cloudflare.sh
# Prompt Which envs: alpha / prod / alpha+prod / all (preview+alpha+prod) + prod-only option fixed, Choose: alpha+prod → y
# Creates:
# D1: portfolio-db-alpha ID 30b1ea40-63cd-41ef-84d5-2d9007bea311 (ENAM) + portfolio-db ID f6dfc0c2-a7db-4e4a-b2de-abc5926fbf8b + optional preview
# R2: portfolio-images-alpha + portfolio-images + preview (after R2 enabled via Dashboard → R2 Overview → Enable, requires card, free tier $0)
# Before R2 enabled: R2 buckets commented out in wrangler.toml due to Please enable R2 [10042], health r2:skipped 200 OK workaround. After active: uncomment R2, health r2:ok for both envs (you saw R2: ok in alpha)
# Migrations: d1 migrations apply --remote for all envs (0001_initial + 0002_seed), verifies tables pages, sections, section_items, contacts, bookings + seed page home title Jane Doe + 6 sections + 18 items
# Updates wrangler.toml database_id real IDs automatically via Python (handles existing via d1 list, multiline bug fixed, top-level DB ID also updated)

# Manual:
export CLOUDFLARE_API_TOKEN=your_token
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$TOKEN node:20 npx wrangler d1 create portfolio-db-alpha
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$TOKEN node:20 npx wrangler r2 bucket create portfolio-images-alpha
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$TOKEN node:20 npx wrangler d1 migrations apply portfolio-db-alpha --remote
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$TOKEN node:20 npx wrangler d1 execute portfolio-db-alpha --remote --command "SELECT slug, title FROM pages"
```

### 3. Pages Project — Connect GitHub

- **https://dash.cloudflare.com → Workers & Pages → Create → Pages → Connect to Git → Select metagtmtest1-design/profile-webapp** (if not visible as collaborator, go GitHub → Settings → Applications → Installed GitHub Apps → Cloudflare Pages → Configure → Only select repos → add profile-webapp → Save, refresh CF list)
- Project name: `profile-webapp` (keep, not alpha) — single project handles both envs via branch control (full isolation, code+data both isolated, not just data). Production `profile-webapp.pages.dev`, Preview `alpha.profile-webapp.pages.dev` + custom domains optional
- Production branch: `main` → Production env (`[env.production]` from wrangler.toml) → prod D1 `f6dfc0c2-...` + prod R2 `portfolio-images` + `ENVIRONMENT=production`, `SITE_URL=https://profile-webapp.pages.dev`, working hours vars
- Preview branch: **Custom branches → `alpha` only** (screenshot) — NOT All non-production (which would share alpha DB across all PRs) and NOT None — only alpha gets preview, so `alpha` Preview env (`[env.preview]` holds alpha DB `30b1ea40-...` + R2 alpha + `ENVIRONMENT=alpha`, `SITE_URL=https://alpha.profile-webapp.pages.dev`) → `https://alpha.profile-webapp.pages.dev` — code+data isolated, push to alpha only rebuilds alpha, main unchanged until merged (Option B full isolation via Custom alpha only within single project, alternative 2 projects would be even more isolated but we keep 1 project)
- Build settings: Framework `None` (Vite not auto-detected is okay), Build command `npm run build`, Output `dist`, Root `/`, `NODE_VERSION=20`, `ENVIRONMENT` var managed via `wrangler.toml` (Dashboard locks vars when toml has vars, only Secrets via Dashboard — "Environment variables are being managed through wrangler.toml. Only Secrets can be managed via the Dashboard.")
- Branch not selectable for custom domain fix: branch must have at least one successful deployment (e.g. `alpha` was initially empty initial `f228e03` no deployment → not selectable) → merge Slice 0 fix `02944b0` + triggers into alpha and push → green → now selectable
- **wrangler.toml conventions:** only `preview`/`production` env names supported by Pages (not custom `alpha`), so `[env.preview]` holds alpha, `[env.production]` holds prod, top-level `[vars]` not inherited so duplicate into each env vars, `pages_build_output_dir = "dist"`, Functions auto `functions/` (must be exact name, if typo `fucntions` not treated), file path `functions/api/content/[slug].ts:14` `params?.slug` → URL `/api/content/:slug` (dynamic `[slug]` = path param), POST body via `request.json()` and can have both path param + body `params.id` + `request.json()` in same handler (e.g. `admin/bookings/[id]/cancel.ts`)

### 4. Custom Domains — Alpha + Prod

- Pages → Custom domains → Add `alpha.profile-webapp.pages.dev` auto + `profile-webapp.pages.dev` auto, or custom `alpha.somewebsite.com` → branch `alpha`, `somewebsite.com` → `main` (if domain on CF auto DNS+SSL)
- **Final:** Production `main` → `https://profile-webapp.pages.dev/api/health` → `env:production db:ok r2:ok` clean UI no bold, Preview Custom `alpha` only → `https://alpha.profile-webapp.pages.dev/api/health` → `env:alpha db:ok r2:ok` (R2: ok after you enabled) + clean premium UI (no BOLD ENV on main, only at /health) — full isolation code+data

## GitHub PR Flow with Alpha (Protected — No Direct Commits to Alpha/Main)

**Agreed:** No direct commits to `alpha` and `main` (protected for verification). Feature branches only.

- **Branch naming per new convention:** `slice# + commitcount + few words` e.g. `slice1-1-portfolio-content`, `slice1-2-ui-polish`, `slice1-3-clean-ui`, `slice1-4-premium-ui`, `slice1-5-button-fix` — each later contains previous (superset), so only latest needs PR

```
slice1-1-portfolio-content 97ea9ce (content display functional: backend content endpoint + frontend)
  ↓ contains
slice1-2-ui-polish c8b746d (+ Nicepage-inspired)
  ↓ contains
slice1-3-clean-ui 5113cfa (+ remove debug banners per user: BOLD LOCAL ENV should be in /health not main, infra health details removed, fix icons sizing w-12 not bar, About gap-12 no pill)
  ↓ contains
slice1-4-premium-ui 76bac13 (+ Tristan CPA premium accounting firm style: navy, Playfair, rounded-2xl, combined with our requirements: calendar kept, no blog/login per user note)
  ↓ contains
slice1-5-button-fix 099eecc (+ fix px-7 had no CSS text close to border → px-8 py-4 breathing room, UX 92%)
  → PR vs alpha → merge → alpha.profile-webapp.pages.dev (client verification: clean premium UI, icons fixed, About spaced, buttons padded, no debug, calendar placeholder user-friendly, no blog/login)
  → PR alpha → main → prod profile-webapp.pages.dev (prod D1+R2)
```

**Per PR Checklist:**

1. Local Docker: `docker run ... npm test -- --run` 29 FE + `test:workers -- --run` 31 BE =60 green, `build` green, `compose up backend` → `curl /api/health` `db:ok r2:ok env local` + `curl /api/content/home` `home 6 sections`, `compose up frontend+backend` → `curl /api/content/home` via proxy `home 6`, browser `localhost:5173` clean UI (no bold env on main, only at `/health`, icons w-12 circles not bar, About gap-12 no pill, buttons px-8 py-4 spaced, no raw API paths, no blog/login, calendar premium card)
2. Push feature branch via `isolated-git-env`: `docker exec isolated-git-env git -C /workspace/profile-webapp push origin slice1-5-button-fix`
3. GitHub: Open PR https://github.com/metagtmtest1-design/profile-webapp/pull/new/slice1-5-button-fix → Base `alpha` (not main) per protected flow, CI `test` job (Node 20 runs `npm ci`, `lint`, `build`, `test -- --run`, `test:workers -- --run`) green — Note: Pages preview won't deploy for feature branch because Branch control Custom `alpha` only (only alpha builds, not all non-prod) — intentional for full isolation, can temporarily change to All non-prod to get preview URL `<hash>.pages.dev` if needed
4. Merge PR into `alpha` via GitHub UI (you handle, not direct push) → Pages auto Preview deployment for `alpha` → `https://alpha.profile-webapp.pages.dev` → verify clean premium UI + `R2: ok` + `env alpha` at `/api/health` (both envs check D1+R2) + content from alpha D1 (after remote migrations `0002_seed` via `scripts/setup-cloudflare.sh` alpha+prod)
5. Client approves alpha → PR `alpha` → `main` via GitHub UI → Production deployment `main` → `https://profile-webapp.pages.dev` → verify prod clean UI + `env production` + same 6 sections from prod D1, no bold debug

## Deliverables — Slice 1 Complete ✅ (Premium UI)

- `functions/_lib/content.ts` (safeParseConfig, orderBySort, filterVisible, types) + `content.test.ts` 4 tests
- `functions/api/content/[slug].ts` `onRequestGet` params.slug dynamic route `[slug]` → URL `/api/content/:slug`, D1 JOIN pages→sections→items ordered/filtered, cache `max-age=300`, fallback seed for local no-table quirk, source header `d1` vs `fallback-local-no-table` + `content/[slug].test.ts` 9 tests (404, ordered, filtered, items ordered/filtered, config parse, meta, cache, empty) including alpha and prod envs both db:ok r2:ok
- `src/lib/api.ts` `fetchContent(slug)` + `ContentResponse` Page/Section/Item 6 types + `HealthResponse` R2 required for both envs + `api.test.ts` 8 tests (health 5 + content 3)
- `src/hooks/useContent.ts` + `useContent.test.tsx` 4 tests (loading→success, error, empty, refetch)
- Sections premium (Nicepage + Tristan CPA combined with requirements per your note: calendar kept, no blog/login):
  - `HeroSection` badge trust + Playfair headline 4xl/5xl + stats bar + dual CTA `btn-primary rounded-full` + image offset + floating card
  - `CardsGrid` services pill removed, icon `w-12 h-12 rounded-xl bg-slate-50 border flex-none text-xl` span 22px fix for full-width bar bug screenshot 1, responsive `sm:grid-cols-2 lg:grid-cols-3`, empty `Services coming soon`
  - `TextBlock` About pill removed (was repeated, screenshot 2), `gap-12 lg:gap-16 py-20 items-center`, image `aspect-[4/3] h-auto`, bio `max-w-[65ch]`, credentials box, no text close to image
  - `Testimonials` pill removed, stars amber, avatar circle, `lg:grid-cols-3`, empty `Client feedback coming soon`
  - `CTABanner` pill refined, `py-16` gradient, buttons `px-8 py-4 leading-none gap-4` fix for `px-7` undefined text close to border (your report), focus ring
  - `ImageGallery` pill removed, `sm:grid-cols-2 lg:grid-cols-3`, hover scale, empty `Selected work coming soon`, alt descriptive
- Common: `Nav` Playfair logo, `flex-wrap gap-4 sm:gap-6` + `hidden sm:inline` mobile, `Layout` no EnvBanner (clean), `Footer` 3-col Playfair + Services/Company no blog/login + CTA card `btn-primary w-full justify-center`, subtle bottom
- Pages: `Home` pure content-driven (removed health fetching, details infra health, debug copy Try: GET /api/... and raw API path calendar), user-friendly loading/empty/error, calendar placeholder premium card no raw path, `Health` new page at `/health` route with EnvBanner + HealthBadge + Retry for debugging (env only at /health + /api/health, not main per your request)
- `App.tsx` simple routing `pathname /health` → `<Health />` else `<Layout><Home /></Layout>`, title clean Portfolio, no bold env banner `🚀 BOLD LOCAL ENV` removed from main (moved to /health) per your request
- `migrations/0002_seed.sql` — page home Jane Doe + 6 sections ordered 0-5 hero/services/about/testimonials/cta/gallery + 18 items (1,6,1,3,1,6) same as fallback
- `docker-compose.yml` backend now runs `d1 migrations apply DB --local` before `pages dev` (fix for `no such table: pages` where pages dev `local-DB` vs `d1 create portfolio-db` binding name mismatch)
- `wrangler.toml` — top-level prod ID `f6dfc0c2-...` for local, preview=alpha DB `30b1ea40-...` + R2 alpha `portfolio-images-alpha`, production=prod DB + R2 `portfolio-images`, only `preview`/`production` envs supported by Pages (not custom alpha) — preview holds alpha, production holds prod, vars duplicated (WORKING_HOURS etc) to fix inheritance warning, R2 bindings uncommented after R2 activation (R2: ok you saw in alpha, was skipped before billing, 10042 error)
- `doc/Setup.md` — general reproducible setup guide (not project status) with token fetch Custom Token perms example summary, D1+R2 script idempotent `alpha/prod/alpha+prod/all` + `prod`-only option fixed, branch control screenshot Custom alpha only for full isolation, Functions naming `functions/` → URL `[slug]` param via `params.slug` line file:line, POST body via `request.json()` and both path param + body allowed, Docker workaround for `x2pagentd` proxy, protected branches, isolated-git-env container
- Tests: 29 FE (App 5 clean UI no debug banners, api 8, useContent 4, Hero 2, CardsGrid 2, TextBlock 2, Testimonials 2, CTABanner 2, Gallery 2) + 31 BE (env 10, health 8 both alpha+prod require D1+R2 R2:ok, content lib 4, content endpoint 9) = 60 green via Docker `node:20`, build CSS 8.76KB JS 166KB, integration local content home 6 sections health db ok r2 ok env local via fallback, frontend proxied home 6

**Stats Final Slice 1:**
- Frontend 9 files 29 tests + Workers 4 files 31 tests = **60 tests green** (vs Slice 0 26, 27, 29 intermediate)
- Build dist 0.46KB html + 8.42-8.76KB css (premium Tristan CPA) + 166KB js (51KB gz)
- Health both envs db:ok r2:ok required (preview alpha D1+R2 and prod D1+R2)
- Content both envs home 6 sections ordered filtered cached 5-min

## Next Slices (Vertical, TDD, Branch Naming slice# + commitcount + words)

- **Slice 2:** Calendar Slots `GET /api/calendar/slots?weeks=2` — Google Calendar Service Account JWT + FreeBusy + slot computation working hours 09-17 Mon-Fri + Workers Cache 5-min TTL + stub mode when no creds, UI `CalendarView` + `SlotPicker` — TDD first, branch `slice2-1-calendar-slots`
- **Slice 3:** Booking `POST /api/booking` — Turnstile + dup check same email week → confirm intent? + FreeBusy re-check race guard + upsert contact + GCal event with `conferenceData` Meet link + cancel_token UUIDv4 + Resend email + cache invalidate + rate limit 3/email/week — ⭐ core
- **Slice 4:** Cancellation `GET /api/cancel/{token}` path param `[token]` → DELETE GCal event + status cancelled + cache invalidate + one-time token + invalid page
- **Slice 5:** Materials `POST /api/materials/lookup` email → Drive URL
- **Slice 6:** Admin Edit — `upload-image` R2 + sections/items CRUD/reorder + `auth.ts` Access JWT + `ADMIN_BYPASS` dev flag + `EditableText`, `ImageUploader` client resize WebP 1MB/1200px → R2
- **Slice 7:** Admin Bookings — list JOIN + resend + cancel
- **Slice 8:** Admin Contacts + Drive — ?email= filter + PATCH drive URL validation, full E2E book→contact→admin set Drive→visitor lookup
- **Slice 9:** Polish + SEO + OG + perf headers + responsive final + error boundaries + README setup

Each: TDD red→green, feature branch `slice#-#-words` → PR vs `alpha` → client verifies `alpha.profile-webapp.pages.dev` → PR `alpha` → `main` → prod `profile-webapp.pages.dev`.

## TDD Notes

- 1. Tell you test files + cases + impl → you confirm, 2. Write tests RED fail, 3. Implement GREEN pass, 4. Refactor, 5. Provide Docker commands + CF alpha verification + prod promotion
- Docker for all: `docker run --rm -v "$PWD":/app -w /app node:20 npm ...` bypasses host proxy `x2pagentd` 503
- Tests co-located: `**/*.test.tsx` FE jsdom + BE node env (not workers pool due to vitest pool compat)
- Stub mode `STUB=true` for GCal/Resend/Turnstile, `LIVE_INTEGRATION` flag for real
- Branch naming: `slice# + commitcount + few words` — later contains previous, so only latest needs PR

## Decisions

See `DECISIONS.md` for 22 decisions (D-01 to D-22) + env table + external services multi-env, plus updated in `.opencode/plans/` plan file with alpha env + TDD + GitHub integration. For Slice 1, additional conventions: R2 now required for both envs (was optional when billing blocked), Branch control Custom `alpha` only screenshot for full isolation code+data (Production `main` → prod D1+R2, Preview Custom `alpha` → alpha D1+R2), Functions `functions/` exact name (typo not treated) + `pages_build_output_dir = "dist"` in wrangler.toml:3, dynamic `[slug].ts:14` param via `params.slug` → URL `/api/content/:slug`, POST both path param + body allowed via `params.id` + `request.json()`, Health endpoint R2 check for both envs `db:ok r2:ok`, UI premium inspired by Tristan CPA accounting firm Behance + Nicepage combined with requirements per your note: calendar kept, no blog/login on screen, debug banners moved to `/health` not main, icons fixed w-12 h-12 not bar, About gap-12 no pill.

## Troubleshooting

- **R2 10042 Please enable R2:** Enable via Dash → R2 Overview → Enable (needs card, free tier $0 stays). Before enable, health `r2:skipped` workaround with R2 commented out in toml. After enable, uncomment R2 + buckets `portfolio-images(-alpha)` + health `r2:ok` for both envs you saw.
- **wrangler.toml env.alpha not supported:** Pages only preview/production — use preview for alpha DB.
- **Branch not selectable for custom domain:** Needs successful deployment — push branch with code first.
- **Host proxy x2pagentd CONNECT 443 No route to host:** Use Docker for npm and wrangler remote, token via `-e CLOUDFLARE_API_TOKEN`.
- **Invalid uuid local-placeholder:** Replace placeholder IDs with real from `d1 create` — top-level DB ID `f6dfc0c2-...` prod, preview DB `30b1ea40-...` alpha, script auto-updates.
- **workerd ENOENT:** Use `node:20` debian not alpine for backend (glibc).
- **TS2591 process:** Add `@types/node` + `node` to tsconfig types.
- **Double --run:** package.json test must be `vitest` not `vitest --run`, CI adds `-- --run`.
- **Content endpoint no such table: pages:** Apply migrations via binding name `DB` not database name `portfolio-db`? Actually need `d1 migrations apply DB --local` and backend compose runs migrations before `pages dev`.
- **Buttons text close to border:** `px-7` had no CSS rule (only px-3,4,6,8) → horizontal padding 0, fixed to `px-8 py-4 leading-none gap-4` breathing room.
- **Icons weird sizing screenshot 1:** Old full-width gray bar tiny centered — fixed to `w-12 h-12 rounded-xl bg-slate-50 border flex-none text-xl` span 22px.
- **About text too close to image + About pill repeated screenshot 2:** Fixed `gap-12 lg:gap-16 py-20 items-center`, removed About pill.
