# Setup Guide — Reproducible Cloudflare + GitHub + Docker

**For future LLMs, new contributors, or anyone cloning this repo.**
This is the **general setup + conventions** doc. It lets you reproduce the entire Cloudflare + GitHub deployment from scratch (alpha/prod isolation, D1/R2, Pages Functions, Google Calendar).

**Different from root `README.md`:** Root README = project overview + current status. This `doc/Setup.md` = from-zero setup instructions.

**Reference:** Original design doc + architectural decisions in `DECISIONS.md`.

---

## 1. Overview

- **Repo:** `metagtmtest1-design/profile-webapp` (example, replace with your fork)
- **Frontend:** React + Vite TS in `src/` → `npm run build` → `dist/` → Cloudflare Pages CDN
- **Backend (Pages Functions):** `functions/` folder → each file = Worker route, auto-deployed by Pages
- **Config:** `wrangler.toml` — D1 + R2 bindings + non-PII vars (`ENVIRONMENT`, `SITE_URL`, working hours) — PII/calendar IDs as Encrypted Secrets via Dashboard
- **DB:** D1 SQLite (IDs: alpha `30b1ea40-63cd-41ef-84d5-2d9007bea311`, prod `f6dfc0c2-a7db-4e4a-b2de-abc5926fbf8b`), **Storage:** R2 (`portfolio-images-alpha` + `portfolio-images`) — requires billing enable
- **Envs:** Single Pages project `profile-webapp` with branch-based isolation (see Branch Control screenshot) — Production `main`, Preview Custom `alpha` only

---

## 2. Prerequisites

- Cloudflare account (free tier)
- GitHub account
- Docker + Docker Compose (required — host proxy `x2pagentd` on `:10054` blocks npm + wrangler without Docker)
- Node 20 inside Docker (host `npm install` may fail 503)

---

## 3. Cloudflare API Token — How to Fetch

`wrangler login` OAuth fails behind proxy (localhost `http://localhost:8976` refuses). Use **API Token** instead (no browser).

**Steps:**

1. **https://dash.cloudflare.com/profile/api-tokens** → **Create Token** → **Create Custom Token** (NOT template)

2. **Permissions** Account Resources: your account:

   - Account: `D1:Edit`, `Workers R2 Storage:Edit`, `Cloudflare Pages:Edit`, `Workers Scripts:Edit`
   - Optional extras: `Workers KV Storage:Edit`, `Workers Tail:Read`, `Workers Builds Config:Edit`, `Account Settings:Read`, `User Details:Read`, `Memberships:Read`
   - Zones: `Workers Routes:Edit` All zones

   Example summary we use:

   ```
   Metagtmtest1@gmail.com's Account - Workers KV Storage:Edit, Workers Scripts:Edit, Account Settings:Read, Workers Tail:Read, Workers R2 Storage:Edit, Cloudflare Pages:Edit, Workers Builds Configuration:Edit, Workers Agents Configuration:Edit, Workers Observability:Edit, Containers:Edit, D1:Edit
   All zones - Workers Routes:Edit
   All users - User Details:Read, Memberships:Read
   ```

3. Zone Resources: All zones or specific zone
4. TTL: 30 days / 6 months / no expiry
5. **Create → Copy token** raw only (no Bearer, no quotes, no newline — use Copy button)

**Verify:**

```bash
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY CLOUDFLARE_API_TOKEN=your_token npx wrangler whoami

# Docker (recommended):
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=your_token node:20 npx wrangler whoami
```

**Error `Invalid request headers [6003] Invalid format for Authorization header [6111]`:** Quotes, Bearer prefix, truncated, newline → `tr -d '\n'`.

**Store:**

```bash
export CLOUDFLARE_API_TOKEN=your_token
echo 'export CLOUDFLARE_API_TOKEN=your_token' >> ~/.zshrc
```

---

## 4. D1 + R2 Setup — Scripted (Idempotent)

**Script:** `scripts/setup-cloudflare.sh` — creates D1+R2 via Docker, runs migrations, updates `wrangler.toml` IDs. Safe to re-run (upsert via `d1 list`, skip buckets, skip applied migrations).

```bash
chmod +x scripts/setup-cloudflare.sh
./scripts/setup-cloudflare.sh
# Prompt token, envs: alpha / prod / alpha+prod / all (preview+alpha+prod) + prod-only option, y

# Non-interactive:
CLOUDFLARE_API_TOKEN=your_token ./scripts/setup-cloudflare.sh
```

Per env:

- `d1 create portfolio-db[-alpha]` → UUID, handles already-exists
- `r2 bucket create portfolio-images[-alpha]` → if `Please enable R2 [10042]`, enable via Dashboard → R2 Overview (requires card, free tier $0) or make R2 optional (health `r2:skipped` → after activation `r2:ok`)
- `d1 migrations apply --remote --env preview` for alpha (since alpha DB only under `[env.preview]` not top-level) → runs `migrations/0001_initial.sql` 5 tables + `0002_seed.sql` 6 sections 18 items
- Verifies tables, updates `wrangler.toml` database_id via Python

**Manual:**

```bash
export CLOUDFLARE_API_TOKEN=your_token
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$TOKEN node:20 npx wrangler d1 create portfolio-db-alpha
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$TOKEN node:20 npx wrangler r2 bucket create portfolio-images-alpha
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$TOKEN node:20 npx wrangler d1 migrations apply portfolio-db-alpha --remote --env preview
```

**R2 optional before billing:** Comment out `[[r2_buckets]]` in `wrangler.toml`, health `r2:skipped` 200 OK if DB ok. After enable, uncomment → health `r2:ok` for both envs (you saw R2: ok in alpha after activation).

---

## 5. Google Calendar API — GCP + Service Account + 2 Calendars + Sharing + Secrets (PII Handling)

**Goal:** Isolated booking calendars per env (alpha vs prod) + personal free/busy only, SA shared.

**Real IDs from this repo:**

- SA: `portfolio-calendar@portfolio-webapp-503319.iam.gserviceaccount.com`
- Alpha booking: `4b320f7127d04517322eed13a69ecb276f4f371ac7684a6c8d10a5c03b5bf4a0@group.calendar.google.com`
- Prod booking: `33b92d647e20775bc5781b918d84fb78a92dc69e9389a9a65de137523765847a@group.calendar.google.com`
- Personal: `metagtmtest1@gmail.com` — PII, Encrypted Secret via Dashboard, not public toml
- Alpha D1: `30b1ea40-63cd-41ef-84d5-2d9007bea311`, Prod D1: `f6dfc0c2-a7db-4e4a-b2de-abc5926fbf8b`

**5.1 — GCP Project + Enable Calendar API:**

1. **https://console.cloud.google.com** → Project dropdown → New Project `portfolio-webapp-503319` → Create → Select
2. Enable: **https://console.cloud.google.com/apis/library/calendar-json.googleapis.com** → **Enable** (or search “Google Calendar API” → Enable). New UI no green checkmark, button becomes Manage.

**5.2 — Service Account + JSON Key (exact URLs):**

1. Service Accounts list: **https://console.cloud.google.com/iam-admin/serviceaccounts** → Ensure project = your project
2. **+ Create Service Account** → Name `portfolio-calendar`, ID auto, Description `For portfolio booking calendar FreeBusy + create events` → Create and Continue → Skip roles → Done
3. Copy SA email `portfolio-calendar@portfolio-webapp-503319.iam.gserviceaccount.com` (client_email)
4. Create key: Click SA row → **Keys tab** → **Add Key → Create new key → JSON → Create** → Downloads JSON `portfolio-webapp-503319-xxxx.json` → Save. Whole JSON (private_key, client_email, token_uri) is secret `GCAL_SERVICE_ACCOUNT_KEY`.

- Keys URL pattern: **https://console.cloud.google.com/iam-admin/serviceaccounts/details/<SA-ID>/keys**

**5.3 — Create 2 Booking Calendars (Alpha + Prod):**

- Google Calendar: **https://calendar.google.com/calendar/r/settings/createcalendar** orleft sidebar Settings → General → Add calendar → **Create new calendar** (as in your screenshot General → Add calendar)
- Alpha: Name `Bookings Alpha`, Description `Alpha bookings isolated from prod` → Create calendar → Appears under Settings for my calendars
- Prod: Name `Bookings Production` → Create

**Get Calendar ID (Integrate calendar):**

- Click calendar name in left **Settings for my calendars** (e.g. `Bookings Alpha`) → Scroll down to **Integrate calendar** → **Calendar ID** field (e.g. `4b32...@group.calendar.google.com`) → Copy both alpha and prod IDs. This section missing when in General settings — must click specific calendar name.

**Personal Calendar ID:** Click main calendar (e.g. `Cheng Chen` blue dot) → Integrate calendar → Calendar ID → likely `...@gmail.com` (e.g. `metagtmtest1@gmail.com`) → Copy.

**5.4 — Share Calendars with SA (Permission Choices — New UI):**

- Google Calendar left sidebar → hover `Bookings Alpha` → ⋮ → **Settings and sharing** → **Share with specific people → Add people** → Paste SA email `portfolio-calendar@...` → Permission dropdown:

  - **For booking calendars** (alpha + prod): Choose **`Make changes and see all event details`** (old UI `Make changes to events` — allows SA to create events with Meet links `conferenceData`). Other options: `See only free/busy (hide details)` = personal, `See all event details` = read only, `Make changes (see private as free/busy)` = restricted, `Make changes and manage sharing` = owner. We need `Make changes and see all event details` for booking.

  - **For personal calendar** (`Cheng Chen`): Add same SA email → Permission **`See only free/busy (hide details)`** (first option) — privacy, SA sees busy blocks only, not titles, so visitors via `GET /api/calendar/slots` see available/unavailable no details.

- Send for all 3 calendars.

**5.5 — Wrangler.toml + Dashboard Secrets — PII Handling:**

- **Public GitHub must NOT contain PII email or calendar IDs.** `wrangler.toml` should have only non-PII vars:

```toml
[vars]
ENVIRONMENT = "local"
SITE_URL = "http://localhost:8788"
WORKING_HOURS_START = "09:00"
WORKING_HOURS_END = "17:00"
WORKING_DAYS = "1,2,3,4,5"
SLOT_DURATION_MINUTES = "30"
# BOOKING_CALENDAR_ID and PERSONAL_CALENDAR_ID NOT here — Encrypted Secrets via Dashboard

[env.preview.vars]
ENVIRONMENT = "alpha"
SITE_URL = "https://alpha.profile-webapp.pages.dev"
WORKING_HOURS_START = "09:00"
WORKING_HOURS_END = "17:00"
WORKING_DAYS = "1,2,3,4,5"
SLOT_DURATION_MINUTES = "30"

[env.production.vars]
ENVIRONMENT = "production"
SITE_URL = "https://profile-webapp.pages.dev"
WORKING_HOURS_START = "09:00"
WORKING_HOURS_END = "17:00"
WORKING_DAYS = "1,2,3,4,5"
SLOT_DURATION_MINUTES = "30"
```

- **Why Dashboard locks plaintext when `wrangler.toml` exists:** "Environment variables for this project are being managed through wrangler.toml. Only Secrets (encrypted variables) can be managed via the Dashboard."

- **Fix:** Store calendar IDs + personal email as **Encrypted Secrets** via Dashboard (Secrets CAN be managed via Dashboard even when vars in toml):

  Dashboard → Workers & Pages → profile-webapp → Settings → Variables and secrets → **Choose Environment: Preview** → Add Encrypted:

  - `BOOKING_CALENDAR_ID` = `4b320f7127d04517322eed13a69ecb276f4f371ac7684a6c8d10a5c03b5bf4a0@group.calendar.google.com` (alpha)
  - `PERSONAL_CALENDAR_ID` = `metagtmtest1@gmail.com`
  - `GCAL_SERVICE_ACCOUNT_KEY` = whole JSON from Step 5.2 (encrypted)

  Choose Environment **Production** → Add Encrypted:

  - `BOOKING_CALENDAR_ID` = `33b92d647e20775bc5781b918d84fb78a92dc69e9389a9a65de137523765847a@group.calendar.google.com` (prod)
  - `PERSONAL_CALENDAR_ID` = `metagtmtest1@gmail.com`
  - `GCAL_SERVICE_ACCOUNT_KEY` = same JSON

- After this, public `wrangler.toml` has no email, only public working hours + site URLs, but deployed alpha/prod read real IDs from Encrypted secrets via `env.BOOKING_CALENDAR_ID`.

- **Migrations remote for alpha needs `--env preview` flag** because alpha DB `portfolio-db-alpha` only under `[env.preview]` not top-level:

```bash
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$TOKEN node:20 npx wrangler d1 migrations apply portfolio-db-alpha --remote --env preview
# → 0001_initial ✅ + 0002_seed ✅ to alpha D1 30b1ea40...
```

- **Verify isolation:**

```bash
curl https://alpha.profile-webapp.pages.dev/api/content/home | jq '.page.slug, (.sections | length)'  # → home, 6 real D1
curl https://alpha.profile-webapp.pages.dev/api/health | jq .env  # → alpha, db ok r2 ok
# After Slice 2, slots:
curl https://alpha.profile-webapp.pages.dev/api/calendar/slots?weeks=1 | jq .
# Should exclude busy from both booking alpha and personal, no event titles leaked
```

**Code mapping:** `functions/_lib/google-calendar.ts` reads `env.BOOKING_CALENDAR_ID` + `PERSONAL_CALENDAR_ID` — preview env (alpha branch) uses alpha calendar, production (main) uses prod calendar → data isolated like D1.

---

## 6. wrangler.toml Conventions — Critical

**Full file pattern (current, no PII):**

```toml
name = "portfolio-site"
compatibility_date = "2024-01-01"
pages_build_output_dir = "dist"

[vars]
ENVIRONMENT = "local"
SITE_URL = "http://localhost:8788"
WORKING_HOURS_START = "09:00"
WORKING_HOURS_END = "17:00"
WORKING_DAYS = "1,2,3,4,5"
SLOT_DURATION_MINUTES = "30"
# BOOKING and PERSONAL as Encrypted Secrets via Dashboard

[[d1_databases]]
binding = "DB"
database_name = "portfolio-db"
database_id = "f6dfc0c2-a7db-4e4a-b2de-abc5926fbf8b"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "portfolio-images"

[env.preview]
[[env.preview.d1_databases]]
binding = "DB"
database_name = "portfolio-db-alpha"
database_id = "30b1ea40-63cd-41ef-84d5-2d9007bea311"

[[env.preview.r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "portfolio-images-alpha"

[env.preview.vars]
ENVIRONMENT = "alpha"
SITE_URL = "https://alpha.profile-webapp.pages.dev"
WORKING_HOURS_START = "09:00"
WORKING_HOURS_END = "17:00"
WORKING_DAYS = "1,2,3,4,5"
SLOT_DURATION_MINUTES = "30"

[env.production]
[[env.production.d1_databases]]
binding = "DB"
database_name = "portfolio-db"
database_id = "f6dfc0c2-a7db-4e4a-b2de-abc5926fbf8b"

[[env.production.r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "portfolio-images"

[env.production.vars]
ENVIRONMENT = "production"
SITE_URL = "https://profile-webapp.pages.dev"
WORKING_HOURS_START = "09:00"
WORKING_HOURS_END = "17:00"
WORKING_DAYS = "1,2,3,4,5"
SLOT_DURATION_MINUTES = "30"
```

**Rules:**

- Pages only supports `env.preview` and `env.production`, NOT `env.alpha` — build fails `Configuration file contains environment names not supported: "alpha"`. Use `preview` for alpha DB/R2 + calendar IDs (preview holds alpha).
- Top-level `[vars]` not inherited by envs — duplicate working hours into each env vars or warning.
- `pages_build_output_dir = "dist"` = static output. Functions auto `functions/`.
- When vars in toml, Dashboard locks plaintext vars: "Environment variables are being managed through wrangler.toml. Only Secrets can be managed via the Dashboard" — manage non-PII vars via toml (public ok), PII (calendar IDs + personal email + SA JSON) as Encrypted Secrets via Dashboard to keep public repo clean.
- Real calendar IDs and personal email must NOT be in public GitHub — store as Encrypted secrets.
- Migrations remote for alpha needs `--env preview` flag because alpha DB only under `[env.preview]`.
- Health endpoint now requires both D1+R2 for both envs (was optional `skipped` before billing, after R2 activation `r2:ok` you saw in alpha).

---

## 7. Pages Functions Naming

- Folder must be `functions` at root — typo not treated as Functions.

| File | URL | Method |
|------|-----|--------|
| `functions/api/health.ts` line 27 `onRequestGet` | `/api/health` | GET, checks both D1+R2 for both envs |
| `functions/api/content/[slug].ts` line 14 `params.slug` | `/api/content/:slug` → `/home` | GET, `params.slug` dynamic `[slug]` file = path param, cached 5-min |
| `functions/api/calendar/slots.ts` | `/api/calendar/slots?weeks=2` | GET, uses `BOOKING_CALENDAR_ID` + `PERSONAL_CALENDAR_ID` secrets |
| `functions/api/booking.ts` | `/api/booking` | POST, `request.json()` body + path param both allowed |
| `functions/api/cancel/[token].ts` | `/api/cancel/:token` | `params.token` |
| `functions/_lib/env.ts` / `_lib/content.ts` / `_lib/google-calendar.ts` | NOT route — `_` prefix ignored | lib |

POST with both path param + body allowed:
```ts
export const onRequestPost = async ({ request, params, env }) => {
  const id = params.id as string
  const body = await request.json() as { reason?: string }
}
```

---

## 8. Branch Control — Isolation (Screenshot Important)

**Dashboard → Pages → Settings → Builds → Branch control (screenshot you provided):**

```
Production branch: main
  Enable automatic production branch deployments: ON
  Commits to Production branch automatically trigger deployments to Production env.

Preview branch: Custom branches
  alpha
```

**Meaning — Single project isolation (full isolation code+data, not just data):**

- 1 project `profile-webapp`
- Production `main` → Production env (`[env.production]`) → prod D1 `f6dfc0c2-...` + prod R2 `portfolio-images` + `ENVIRONMENT=production`, `SITE_URL=https://profile-webapp.pages.dev` → `https://profile-webapp.pages.dev`
- Preview Custom `alpha` only → Preview env (`[env.preview]`) → alpha D1 `30b1ea40-...` + R2 `portfolio-images-alpha` + `ENVIRONMENT=alpha`, `BOOKING alpha 4b32...`, `PERSONAL metagtmtest1@gmail.com` as Secrets → `https://alpha.profile-webapp.pages.dev` — code+data isolated, push to alpha only rebuilds alpha, main untouched until merge `alpha→main`

Preview options:

- `All non-Production branches` → all `slice/*` + PRs share Preview env (alpha DB) — okay solo dev, you only use alpha anyway
- `None (Disable automatic branch deployments)` → no preview deployments, only production
- `Custom branches` → `alpha` only → only alpha gets preview → full alpha-only isolation (screenshot, recommended for client verification)

**2 projects alternative (even more isolation):**

- `profile-webapp` Prod=`main` → prod D1+R2, Preview=None → only main builds → prod domain
- `profile-webapp-alpha` Prod=`alpha` → alpha D1+R2, Preview=None → only alpha builds → alpha domain

We use single project Custom `alpha` only as screenshot — full isolation.

---

## 9. GitHub — Protected Branches + Branch Naming

- Branches: `main` (prod), `alpha` (alpha env), `slice/*` feature per naming convention

**Protected for verification (you said no direct to protected):**

- Do NOT commit directly to `alpha` and `main` — use `slice# + commitcount + few words` e.g. `slice1-1-portfolio-content`, `slice1-2-ui-polish`, `slice1-3-clean-ui`, `slice1-4-premium-ui`, `slice1-5-button-fix` → PR vs `alpha` → client verifies `alpha.profile-webapp.pages.dev` → PR `alpha` → `main` → prod `profile-webapp.pages.dev` — later PR contains previous (superset), so only latest `slice1-5` needs PR.

GitHub Settings → Branches → Rules:

- `main`: Require PR, Require status checks (CI + Pages)
- `alpha`: Require PR (lighter)

**GitHub App for Pages (collaborator issue):**

If repo not visible in Cloudflare Connect (personal repo collaborator can't install App — only owner):

- Owner: Cloudflare Dashboard → Pages → Connect → GitHub authorize → select `FanWebApp`/`profile-webapp` → Install (30s), or GitHub → owner avatar → Settings → Applications → Cloudflare Pages → Configure → add repo.

**Isolated Git Env container:**

Host git has auth issues (`chc421` vs `hohodsj`). Container `isolated-git-env` at `/workspace` mounting repo, bypasses proxy:

```bash
docker exec isolated-git-env git -C /workspace/profile-webapp status
docker exec isolated-git-env git -C /workspace/profile-webapp push origin slice2-1-calendar-slots
```

**Do NOT use container to push directly to protected `alpha`/`main` after Slice 0 setup — feature branches only.**

---

## 10. Local Verification — Docker (Host Proxy Bypass)

**Why Docker:** Host `x2pagentd` proxy on `:10054` blocks npm registry 503 + breaks `wrangler login` localhost. Docker network bypasses.

Compose: frontend `node:20-alpine` Vite 5173 proxies `/api` → `http://backend:8788` via `VITE_API_PROXY_TARGET`, backend `node:20` debian (workerd needs glibc, not alpine) runs `d1 migrations apply DB --local` before `pages dev` (fix for `no such table: pages` where `d1 create portfolio-db` vs `d1 create DB` binding name mismatch).

```bash
# Unit — TDD red→green
docker run --rm -v "$PWD":/app -w /app node:20 npm test -- --run
# FE 9 files 29 tests: api 8 (health 5 + content 3), App 5 clean UI (no BOLD ENV on main, only at /health), useContent 4, Hero 2, CardsGrid 2, TextBlock 2, Testimonials 2, CTABanner 2, Gallery 2
docker run --rm -v "$PWD":/app -w /app node:20 npm run test:workers -- --run
# BE 4 files 31 tests: env 10, health 8 (both alpha+prod require D1+R2 R2:ok), content lib 4, content endpoint 9 (404, ordered, filtered, config, meta, cache, empty) + explicit alpha and prod checks
docker compose --profile test run --rm tests  # both

# Lint + Build
docker run --rm -v "$PWD":/app -w /app node:20 npm run lint
docker run --rm -v "$PWD":/app -w /app node:20 npm run build
# → dist 0.46KB html + 8.76KB css (premium Tristan CPA + Nicepage) + 166KB js (51KB gz)

# Integration full stack local
rm -rf .wrangler/state
docker compose up -d backend
sleep 40
curl http://localhost:8788/api/health | jq .  # → status ok db ok r2 ok env local (both D1+R2 checked for both envs)
curl http://localhost:8788/api/content/home | jq '.page.title, (.sections | length)'  # → Jane Doe — Designer & Developer, 6 (hero, services 6, about, testimonials 3, CTA, gallery) from D1 local or fallback seed same as 0002 when Miniflare empty
docker compose up -d frontend
curl http://localhost:5173/api/content/home | jq '.page.slug, (.sections | length)'  # → home, 6 via proxy
open http://localhost:5173
# Clean premium UI (no 🚀 BOLD ENV banner on main per user request, env only at /health + /api/health):
# Nav sticky blur Playfair, Hero badge green pulse Available for new projects • Boston-based + Playfair headline + stats bar 10+ yrs 120+ projects 98% retention + dual CTA + image offset + floating card, Services 6 cards icons w-12 h-12 rounded-xl bg-slate-50 border flex-none not bar (fixed from screenshot weird sizing), About gap-12 lg:gap-16 py-20 no duplicate About pill, Testimonials stars, CTA banner buttons px-8 py-4 breathing room (fixed from px-7 undefined text close to border), Gallery hover scale, Calendar premium card no raw API path, Footer 3-col no blog/login (Services, About, Testimonials, Calendar, Contact only per requirement combining Tristan CPA premium with our calendar)
# /health debug: http://localhost:5173/health → System Health Debug DB:ok R2:ok env local — env only here, not main
docker compose down -v
```

---

## 11. Remote Verification — Alpha + Prod (Both Envs)

```bash
# Alpha (Preview Custom alpha only) — after PR feature → alpha merged + D1 remote migrations --env preview
curl https://alpha.profile-webapp.pages.dev/api/health | jq .  # → env alpha, db ok, r2 ok, d1Ms 11, r2Ms 382 (you saw R2: ok after activation)
curl https://alpha.profile-webapp.pages.dev/api/content/home | jq '.page.title, (.sections | length)'  # → Jane Doe..., 6 real D1 (X-Content-Source: d1, not fallback-local-no-table)

# Prod (Production main)
curl https://profile-webapp.pages.dev/api/health | jq .  # → env production, db ok, r2 ok
curl https://profile-webapp.pages.dev/api/content/home | jq '.page.title, (.sections | length)'  # → same 6

# After Slice 2, slots (real FreeBusy when secrets set, stub mock when missing for local TDD):
curl https://alpha.profile-webapp.pages.dev/api/calendar/slots?weeks=1 | jq .
# Should exclude busy from both booking alpha 4b32... and personal metagtmtest1@gmail.com (free/busy only, no titles leaked), available true/false only
```

Browser `https://alpha.profile-webapp.pages.dev`:

- No 🚀 BOLD ENV banner on main (only at `/health` + `/api/health` JSON per your request C1/C2)
- No Infra health `<details>` debug on Home (removed)
- Services icons correctly sized `w-12 h-12 rounded-xl bg-slate-50 border flex-none` not full-width gray bar tiny centered (screenshot 1 fixed)
- About image and text spaced `gap-12 lg:gap-16`, no duplicate About pill (`About` div repeated removed, screenshot 2 fixed)
- CTA banner buttons `px-8 py-4 leading-none gap-4` breathing room (was `px-7` undefined → text close to border, your report fixed)
- No blog/login on screen (only Services/About/Testimonials/Calendar/Contact per your note combining Tristan CPA with requirements)
- Calendar placeholder premium card with pulse dot, no raw API path
- Responsive mobile 375px 1 col, nav wraps `flex-wrap`, `hidden sm:inline`
- `/health` route shows debug badge `DB: ok, R2: ok, env alpha` — env only here

After client approves alpha → PR `alpha` → `main` → prod `profile-webapp.pages.dev` same clean premium UI green.

---

## 12. Pitfalls — Fixed

- **npm 503 `x2pagentd` CONNECT port 443 No route to host:** Host proxy on `:10054` blocks registry, use Docker `node:20` for npm + wrangler remote, token via `-e CLOUDFLARE_API_TOKEN`.
- **R2 `Please enable R2 [10042]`:** Enable via Dashboard → R2 Overview → Enable (needs card, free tier $0 stays). Before enable, R2 bindings commented out in `wrangler.toml`, health `r2:skipped` 200 OK workaround. After enable, uncomment R2 `portfolio-images(-alpha)` + health `r2:ok` for both envs you saw `R2: ok` in alpha.
- **wrangler.toml `env.alpha` not supported:** Pages only allows `preview`/`production` — build fails `Configuration file contains environment names not supported: "alpha"`. Use `preview` env for alpha DB+R2+calendar IDs, `production` for prod.
- **Couldn't find D1 DB with name `portfolio-db-alpha` in wrangler.toml:** Alpha DB only under `[env.preview]` not top-level, so need `--env preview` flag: `d1 migrations apply portfolio-db-alpha --remote --env preview` → 0001 ✅ 0002 ✅ to alpha D1 `30b1ea40-...` (you hit this after alpha showed `no such table: pages` then prod had `slug home` — isolation, prod had seed, alpha needed seeding via `--env preview`).
- **Branch not selectable for custom domain:** Needs successful deployment — push branch with code first (alpha was initially empty initial `f228e03` no deployment → not selectable) → merge Slice 0 fix `02944b0` + triggers into alpha → green → now selectable.
- **Environment variables managed through wrangler.toml. Only Secrets can be managed via Dashboard:** When vars in toml, Dashboard locks plaintext vars, only Encrypted secrets allowed. So PII `metagtmtest1@gmail.com` + calendar IDs cannot be plaintext in public GitHub — store as Encrypted Secrets via Dashboard (Preview + Production) to avoid PII. Non-PII working hours + SITE_URL can stay in toml (public ok). After removing `BOOKING_CALENDAR_ID`/`PERSONAL_CALENDAR_ID` from toml, public repo has no email, but deployed alpha/prod read real IDs from secrets via `env.BOOKING_CALENDAR_ID`.
- **Invalid uuid `local-placeholder-portfolio-db` / `prod-placeholder-id`:** Replace placeholders with real IDs from `d1 create` — top-level DB ID `f6dfc0c2-...` prod, preview DB `30b1ea40-...` alpha, script auto-updates via Python (fixed multiline bug that caused `SyntaxError: unterminated string literal`).
- **workerd ENOENT:** Backend must be `node:20` debian not alpine (workerd needs glibc, alpine musl fails).
- **TS2591 `process`:** `vite.config.ts` uses `process.env.VITE_API_PROXY_TARGET` → needs `@types/node` devDep + `"node"` in tsconfig types (fixed CI lint).
- **Double `--run` error `Expected a single value for option "--run"`:** CI runs `npm test -- --run`, so `package.json` must have `test: "vitest"` not `"vitest --run"` (otherwise expands to `--run --run`) — fixed to `test: vitest`, `test:watch: vitest --watch`, `test:workers: vitest --config ...` (no --run), CI adds `-- --run`.
- **Content endpoint `no such table: pages` locally:** `pages dev --d1=DB` uses binding name DB (creates `local-DB` ephemeral) not `portfolio-db`, so `d1 migrations apply portfolio-db --local` applies to different file than pages dev uses. Fix: backend compose runs `d1 migrations apply DB --local` before `pages dev` to ensure same binding, plus fallback seed in endpoint when no table for local dev returns same as `0002_seed.sql` for `home` only (remote uses real D1 via `--remote`).
- **Buttons text close to border `px-7 py-3`:** `px-7` had no CSS rule in `index.css` (only px-3,4,6,8) → horizontal padding 0, text hugged border. Fixed to `px-8 py-4 leading-none gap-4` breathing room + added missing utilities `px-7`, `py-3.5`, `inline-flex`, `leading-none`, etc.
- **Icons weird sizing screenshot 1:** Old full-width gray bar tiny centered — fixed to `w-12 h-12 rounded-xl bg-slate-50 border flex-none text-xl` span `22px`.
- **About text too close to image + About pill repeated screenshot 2:** Fixed `gap-12 lg:gap-16 py-20 items-center`, removed About pill `About` repeated.
- **BOLD ENV banner on main page `🚀 BOLD LOCAL ENV — LOCAL ✅ — Slice 1 Content` not needed, should be in /health endpoint:** Removed from `App.tsx` main (was Slice 0 verification carryover) → now only at `/health` UI + `/api/health` JSON per user request C1/C2.
- **Infra health details `Infra health (D1+R2) — env local` not needed on main:** Removed from Home.tsx `<details>` debug per user.
- **GitHub Pages app not visible for collaborator:** Personal repo collaborator can't install GitHub App — only owner at account level, need owner to install App via Cloudflare Dashboard → Connect → GitHub authorize → select repo → Install.

---

## 13. TL;DR From Scratch (Someone Else Cloning Your Repo)

```bash
# 1. Clone + Token
git clone https://github.com/metagtmtest1-design/profile-webapp.git
cd profile-webapp
# Get CF API Token: https://dash.cloudflare.com/profile/api-tokens → Create Custom Token → D1:Edit, Workers R2 Storage:Edit, Pages:Edit, Scripts:Edit → Copy raw token (no Bearer, no quotes)
export CLOUDFLARE_API_TOKEN=your_token

# 2. D1 + R2 + Migrations (Docker, idempotent, no PII in public toml — real IDs via Dashboard Secrets)
chmod +x scripts/setup-cloudflare.sh
./scripts/setup-cloudflare.sh
# Prompt Which envs: alpha / prod / alpha+prod / all + prod-only option, y
# Choose alpha+prod → creates D1 portfolio-db-alpha ID 30b1ea40... + portfolio-db ID f6dfc0c2... + R2 portfolio-images-alpha + portfolio-images (needs R2 enabled via Dash → R2 Overview Enable, card required free tier $0)
# Then manually for alpha seed (since alpha only under [env.preview]):
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN node:20 npx wrangler d1 migrations apply portfolio-db-alpha --remote --env preview
# → 0001_initial ✅ + 0002_seed ✅ 6 sections 18 items to alpha D1

# 3. GCP + GCal (see Section 5)
# Create project portfolio-webapp-503319 → Enable Calendar API https://console.cloud.google.com/apis/library/calendar-json.googleapis.com
# Service Accounts https://console.cloud.google.com/iam-admin/serviceaccounts → Create portfolio-calendar → Copy email portfolio-calendar@portfolio-webapp-503319.iam.gserviceaccount.com + JSON key file whole JSON
# Google Calendar https://calendar.google.com/calendar/r/settings/createcalendar → Create Bookings Alpha + Bookings Production → get IDs via Integrate calendar (click calendar name → Calendar ID)
# Share: Bookings Alpha + Prod with SA as Make changes and see all event details, Personal (your main) with SA as See only free/busy (hide details)
# Dashboard Secrets Encrypted for both Preview and Production: BOOKING_CALENDAR_ID = alpha/prod group IDs, PERSONAL_CALENDAR_ID = your email (PII encrypted not public), GCAL_SERVICE_ACCOUNT_KEY = JSON

# 4. Local TDD
docker run --rm -v "$PWD":/app -w /app node:20 npm test -- --run  # FE 29 tests
docker run --rm -v "$PWD":/app -w /app node:20 npm run test:workers -- --run  # BE 31 tests both envs db ok r2 ok
docker compose up -d backend && curl http://localhost:8788/api/health | jq . && curl http://localhost:8788/api/content/home | jq '.page.slug, (.sections | length)' && docker compose down -v
# → status ok db ok r2 ok env local, home 6

# 5. Pages Project
# Workers & Pages → Create → Pages → Connect to Git → metagtmtest1-design/profile-webapp
# Project name: profile-webapp, Production branch: main, Preview: Custom branches alpha only (screenshot) for full isolation code+data (Production main → prod D1+R2 env production, Preview Custom alpha → alpha D1+R2 env alpha)
# Build: Framework None (Vite not auto-detected ok), Build command npm run build, Output dist, Root /, Node 20 NODE_VERSION=20, Vars managed via wrangler.toml (non-PII working hours + SITE_URL public ok), Secrets via Dashboard Encrypted (PII calendar IDs + personal email + SA JSON)
# Deployments: alpha branch → Preview alias https://alpha.profile-webapp.pages.dev, main → Production https://profile-webapp.pages.dev
# Custom domains optional

# 6. PR Flow (protected, no direct to alpha/main, branch naming slice# + count + words)
# Feature slice1-5-button-fix (contains all slice1) → PR vs alpha → CI green → Merge → Pages Preview alpha → https://alpha.profile-webapp.pages.dev/api/health → env alpha db ok r2 ok, .../api/content/home → home 6 real D1 (after remote migrations --env preview)
# After client approves alpha → PR alpha → main → prod https://profile-webapp.pages.dev same clean premium UI no debug (only at /health)

# 7. Verify
curl https://alpha.profile-webapp.pages.dev/api/health | jq .env  # → alpha
curl https://profile-webapp.pages.dev/api/health | jq .env  # → production
```
