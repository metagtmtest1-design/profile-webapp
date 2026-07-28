# Setup Guide — Reproducible Cloudflare + GitHub + Docker

**For future LLMs, new contributors, or anyone cloning this repo.** General setup + conventions doc — from-zero reproducible Cloudflare + GitHub deployment (alpha/prod isolation, D1/R2, Pages Functions, Google Calendar, Turnstile, Resend).

**Different from root `README.md`:** Root README = project overview + current status + slice completion. This `doc/Setup.md` = from-zero setup instructions (no slice history) — if someone clones, they can reproduce.

**Reference:** `DECISIONS.md` (D-01 to D-32), `.opencode/plans/` plan, `wrangler.toml` real IDs.

---

## 1. Overview

- **Repo:** `metagtmtest1-design/profile-webapp` (replace with your fork)
- **Frontend:** React + Vite TS `src/` → `npm run build` → `dist/` → Pages CDN
- **Backend:** Pages Functions `functions/` folder → each file = Worker route auto-deployed by Pages (no separate `wrangler deploy`)
- **Config:** `wrangler.toml` — D1 + R2 bindings + non-PII vars (`ENVIRONMENT`, `SITE_URL`, `WORKING_HOURS_START/END`, `WORKING_DAYS`, `SLOT_DURATION_MINUTES`, `EXCLUDE_TODAY`, `TIMEZONE`) — PII/calendar IDs + secrets as Encrypted Secrets via Dashboard (since Dashboard locks plaintext when toml exists: "Only Secrets can be managed")
- **DB:** D1 SQLite IDs alpha `30b1ea40-63cd-41ef-84d5-2d9007bea311` + prod `f6dfc0c2-a7db-4e4a-b2de-abc5926fbf8b`, 5 tables pages/sections/section_items/contacts/bookings + seed 0002 6 sections 18 items
- **Storage:** R2 `portfolio-images-alpha` + `portfolio-images` — requires billing enable via Dashboard → R2 Overview (card, free tier $0) — before enable health `r2:skipped` workaround, after `r2:ok` for both envs
- **Calendar:** Google Calendar API via Service Account `portfolio-calendar@portfolio-webapp-503319.iam.gserviceaccount.com` — 2 booking calendars alpha `4b32...bf4a0@group` + prod `33b9...5847a@group` + personal `metagtmtest1@gmail.com` (PII) as Encrypted Secrets, working hours 09-17 Mon-Fri, slot duration configurable multiple 15, exclude today true default
- **Envs:** Single Pages project `profile-webapp` Production `main` + Preview Custom `alpha` only (screenshot) for full isolation code+data (not just data) — `main` → `https://profile-webapp.pages.dev` prod D1+R2 + `ENVIRONMENT=production`, `alpha` → `https://alpha.profile-webapp.pages.dev` alpha D1+R2 + `ENVIRONMENT=alpha` — push to alpha only rebuilds alpha, prod untouched until merge alpha→main, 2 projects alternative also possible

---

## 2. Prerequisites

- Cloudflare account (free tier)
- GitHub account + admin access to repo (collaborator can't install GitHub App — only owner can, see GitHub App note)
- Docker + Docker Compose (required — host `x2pagentd` proxy on `:10054` blocks npm registry 503 + breaks `wrangler login` localhost `http://localhost:8976`)
- Node 20 inside Docker (host `npm install` may fail)

---

## 3. Cloudflare API Token — How to Fetch (One Step at a Time)

`wrangler login` OAuth starts local server `http://localhost:8976` for callback — fails behind proxy. Use API Token.

**Create Custom Token (not template):**

1. **https://dash.cloudflare.com/profile/api-tokens** → **Create Token** → **Create Custom Token**

2. **Permissions** Account Resources your account:

   - Account: `D1:Edit` — `d1 create`, `migrations apply --remote`, `execute`
   - `Workers R2 Storage:Edit` — `r2 bucket create`
   - `Cloudflare Pages:Edit` — deployments, custom domains
   - `Workers Scripts:Edit` — Functions
   - Optional extras from Worker template (harmless): `Workers KV Storage:Edit`, `Workers Tail:Read`, `Workers Builds Config:Edit`, `Account Settings:Read`, `User Details:Read`, `Memberships:Read`, Zones `Workers Routes:Edit` All zones

   Example summary we use (covers all):

   ```
   Metagtmtest1@gmail.com's Account - Workers KV Storage:Edit, Workers Scripts:Edit, Account Settings:Read, Workers Tail:Read, Workers R2 Storage:Edit, Cloudflare Pages:Edit, Workers Builds Configuration:Edit, Workers Agents Configuration:Edit, Workers Observability:Edit, Containers:Edit, D1:Edit
   All zones - Workers Routes:Edit
   All users - User Details:Read, Memberships:Read
   ```

3. Zone Resources: All zones or specific zone, TTL 30 days / no expiry, Create → **Copy token** raw only (no Bearer, no quotes, no newline — use Copy button)

**Verify:**

```bash
env -u http_proxy -u https_proxy -u HTTP_PROXY -u HTTPS_PROXY CLOUDFLARE_API_TOKEN=your_token npx wrangler whoami
# Docker (recommended, bypasses host proxy):
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=your_token node:20 npx wrangler whoami
```

**Error `Invalid request headers [6003] Invalid format for Authorization header [6111]`:** Quotes, Bearer prefix, truncated, newline → `tr -d '\n'`.

**Store:**

```bash
export CLOUDFLARE_API_TOKEN=your_token
echo 'export CLOUDFLARE_API_TOKEN=your_token' >> ~/.zshrc
```

---

## 4. D1 + R2 Setup — Scripted Idempotent

**Script** `scripts/setup-cloudflare.sh` — Docker-wrapped wrangler, prompts token securely (hidden input), options `alpha/prod/alpha+prod/all (preview+alpha+prod)` + `prod`-only option fixed, idempotent (upsert via `d1 list` regex extracting UUID `[a-f0-9]{8}...`, handles already-exists, skip buckets, skip applied migrations, fixes Python multiline bug `SyntaxError: unterminated string literal`).

```bash
chmod +x scripts/setup-cloudflare.sh
CLOUDFLARE_API_TOKEN=your_token ./scripts/setup-cloudflare.sh
# Which envs: alpha+prod → y
# Creates D1 portfolio-db-alpha ID 30b1ea40... (ENAM) + portfolio-db ID f6dfc0c2... + optional preview, R2 portfolio-images-alpha + portfolio-images (needs R2 enabled via Dashboard → R2 Overview Enable, requires card free tier $0), Migrations remote: 0001_initial 5 tables + 0002_seed 6 sections 18 items, Updates wrangler.toml database_id real IDs via Python

# Manual alpha needs --env preview because alpha DB only under [env.preview] not top-level:
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN node:20 npx wrangler d1 migrations apply portfolio-db-alpha --remote --env preview
# → 0001 ✅ + 0002 ✅ to alpha D1 30b1ea40...
# Error Couldn't find D1 DB with name portfolio-db-alpha in wrangler.toml → fixed by --env preview flag
```

**Manual:**

```bash
export CLOUDFLARE_API_TOKEN=your_token
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$TOKEN node:20 npx wrangler d1 create portfolio-db-alpha  # copy ID
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$TOKEN node:20 npx wrangler r2 bucket create portfolio-images-alpha
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$TOKEN node:20 npx wrangler d1 migrations apply portfolio-db-alpha --remote --env preview
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$TOKEN node:20 npx wrangler d1 execute portfolio-db-alpha --remote --command "SELECT slug FROM pages"  # → home
```

**R2 optional before billing:** Comment out `[[r2_buckets]]` in `wrangler.toml` due to `Please enable R2 [10042]`, health `r2:skipped` 200 OK if DB ok (temporary workaround). After enable, uncomment → health `r2:ok` for both envs (you saw R2: ok in alpha after activation).

---

## 5. Google Calendar API — GCP + Service Account + 2 Calendars + Sharing + Secrets (PII)

**Goal:** Isolated booking calendars per env (alpha vs prod) + personal free/busy only, SA shared.

**Real IDs:**

- SA: `portfolio-calendar@portfolio-webapp-503319.iam.gserviceaccount.com`
- Alpha booking: `4b320f7127d04517322eed13a69ecb276f4f371ac7684a6c8d10a5c03b5bf4a0@group.calendar.google.com`
- Prod booking: `33b92d647e20775bc5781b918d84fb78a92dc69e9389a9a65de137523765847a@group.calendar.google.com`
- Personal: `metagtmtest1@gmail.com` — PII, Encrypted Secret via Dashboard, not public toml
- D1: alpha `30b1ea40...`, prod `f6dfc0c2...`

**5.1 GCP Project + Enable Calendar API:**

1. **https://console.cloud.google.com** → Project dropdown → New Project `portfolio-webapp-503319` → Create → Select
2. Enable: **https://console.cloud.google.com/apis/library/calendar-json.googleapis.com** → **Enable** (or search “Google Calendar API” → Enable). New UI no green check, button becomes Manage is ok.

**5.2 Service Account + JSON Key (exact URLs you asked):**

1. **https://console.cloud.google.com/iam-admin/serviceaccounts** → Ensure project = your project
2. **+ Create Service Account** → Name `portfolio-calendar`, ID auto, Description `For portfolio booking calendar FreeBusy + create events` → Create and Continue → Skip roles → Done
3. Copy SA email `portfolio-calendar@portfolio-webapp-503319.iam.gserviceaccount.com` (client_email)
4. Create key: Click SA row → **Keys tab** → **Add Key → Create new key → JSON → Create** → Downloads JSON → Save. Whole JSON (private_key, client_email, token_uri) is secret `GCAL_SERVICE_ACCOUNT_KEY`.

- Keys URL: **https://console.cloud.google.com/iam-admin/serviceaccounts/details/<SA-ID>/keys**

**5.3 Create 2 Booking Calendars (Alpha + Prod):**

- **https://calendar.google.com/calendar/r/settings/createcalendar** or Settings → General → Add calendar → **Create new calendar** (your screenshot left sidebar)
- Alpha: Name `Bookings Alpha` → Create → appears under Settings for my calendars
- Prod: Name `Bookings Production` → Create

**Get Calendar ID via Integrate calendar:**

- Click calendar name in left **Settings for my calendars** (e.g. `Bookings Alpha`) → Scroll to **Integrate calendar** → **Calendar ID** field (e.g. `4b32...@group.calendar.google.com`) → Copy both alpha and prod. This section missing when in General settings — must click specific calendar name (your earlier screenshot was General → Language and region, not specific calendar, so Integrate missing).

**Personal Calendar ID:** Click main calendar `Cheng Chen` blue dot → Integrate calendar → Calendar ID → likely `...@gmail.com` (e.g. `metagtmtest1@gmail.com`) → Copy.

**5.4 Share Calendars with SA (Permission Choices — New UI from your screenshot 2):**

- Left sidebar → hover calendar `Bookings Alpha` → ⋮ → **Settings and sharing** → **Share with specific people → Add people** → Paste SA email → Permission dropdown:

  Options from your screenshot:
  - `See only free/busy (hide details)` — for personal `Cheng Chen` (privacy)
  - `See all event details` — read only
  - `Make changes (see private events as free/busy)` — restricted make changes
  - `Make changes and see all event details` — **for booking calendars** (allows SA to create events with Meet links `conferenceData`, old UI called Make changes to events) ← **Choose this for Bookings Alpha + Prod**
  - `Make changes and manage sharing` — owner

  So:
  - **Booking calendars** Alpha + Prod: **Make changes and see all event details** → Send
  - **Personal calendar** Cheng Chen: **See only free/busy (hide details)** → Send (first option, privacy, so visitors via `/api/calendar/slots` see available/unavailable no event titles per 6.2)

- After sharing 3 calendars, SA can FreeBusy query both booking + personal, but visitors see only available/unavailable.

**5.5 Wrangler + Dashboard Secrets — PII Handling + Meet Link:**

- **Public GitHub must NOT contain PII email or calendar IDs.** `wrangler.toml` keeps only non-PII vars: `ENVIRONMENT` local/alpha/production, `SITE_URL` localhost + `alpha.profile-webapp.pages.dev` + `profile-webapp.pages.dev` (public), `WORKING_HOURS_START/END`, `WORKING_DAYS`, `SLOT_DURATION_MINUTES` 30 configurable multiple 15, `EXCLUDE_TODAY` true, `TIMEZONE` America/New_York — real calendar IDs + personal email as Encrypted Secrets via Dashboard (not in public repo) because Dashboard locks plaintext when toml exists: "Environment variables for this project are being managed through wrangler.toml. Only Secrets (encrypted variables) can be managed via the Dashboard."

- **Google Meet link auto:** No separate Meet API, uses same Calendar API. When creating booking event in Slice 3, use `events.insert` with `conferenceDataVersion=1` + `conferenceData.createRequest {requestId: uuid, conferenceSolutionKey: {type: "hangoutsMeet"}}` → response `conferenceData.entryPoints[0].uri` is Meet link `https://meet.google.com/xxx` + `hangoutLink`. Also patch description to include Meet link + cancel link so invite contains meeting link text too: `description: ${purpose}\n\nMeet: ${meetLink}\nCancel: ${SITE_URL}/api/cancel/${token}`. Google auto-sends invite with Meet join button via `sendUpdates: 'all'`. Resend email also contains same Meet link + cancel link as backup.

- **Migrations remote for alpha needs `--env preview`:** Alpha DB `portfolio-db-alpha` only under `[env.preview]` not top-level, so `d1 migrations apply portfolio-db-alpha --remote` fails `Couldn't find D1 DB` → fix `... --remote --env preview` → 0001 ✅ 0002 ✅ to alpha D1 `30b1ea40...` (you hit this after alpha showed `no such table: pages` then prod had `slug home` — isolation, prod had seed, alpha needed seeding).

- **Verify isolation:**

```bash
curl https://alpha.profile-webapp.pages.dev/api/content/home | jq '.page.slug, (.sections | length)'  # → home, 6 real D1 X-Content-Source d1
curl https://alpha.profile-webapp.pages.dev/api/health | jq .env  # → alpha, db ok r2 ok (you saw R2: ok after activation, was skipped before)
# After Slice 2 deployment, slots:
curl "https://alpha.profile-webapp.pages.dev/api/calendar/slots?weeks=2" | jq '.weeks, .source, (.slots | length), .workingHours'
# → 2, stub or live, 144 slots from tomorrow (EXCLUDE_TODAY=true), slotMinutes 30 multiple 15, workingHours 09-17 Mon-Fri, no event titles leaked, cache max-age=300 X-Cache MISS/STUB
```

**Code mapping per env:** `functions/_lib/google-calendar.ts` reads `env.BOOKING_CALENDAR_ID` + `PERSONAL_CALENDAR_ID` (now Encrypted Secrets via Dashboard for Preview alpha `4b32...` + Production prod `33b9...` + same personal) — preview env (alpha branch) uses alpha calendar, production (main) uses prod calendar → data isolated like D1.

---

## 6. Cloudflare Turnstile (Anti-Bot) — Invisible Challenge

**What:** Invisible challenge on booking form per design 8.2 + 6.3, token verified server-side `functions/_lib/turnstile.ts`.

**Create Widget (exact URL):**

1. **https://dash.cloudflare.com/?to=/:account/turnstile** → Add widget

2. **Widget name:** `portfolio-booking`

3. **Hostname Management:** UI shows "You have configured 0 out of 10 available hostnames" + search box + **Add Hostnames** button (your screenshot). **Add hostnames** → Add:

   - `profile-webapp.pages.dev` → Add (prod)
   - `alpha.profile-webapp.pages.dev` → Add (alpha)

   Skip wildcard `*.profile-webapp.pages.dev` → error `Enter a valid domain (e.g. example.com), subdomain (e.g. sub.example.com)` — wildcard not allowed. Skip `localhost` / `127.0.0.1` for now — local Docker uses STUB mode `ENVIRONMENT=local/test` bypasses verification, so TDD not blocked when secrets missing (same as GCal stub pattern).

   After adding 2, should show `2 out of 10 configured`. If `pages.dev` rejected, add any custom domain you own placeholder, but for MVP 2 Pages domains should be valid as subdomains.

4. **Mode:** Choose **Managed** (shows challenge if bot) or **Invisible** (truly invisible) — design says Invisible anti-bot, either works, recommend Managed.

5. Click **Create** → **You can now configure your website to use Turnstile:** shows **Site Key** (public `0x4AAAA...` e.g. `0x4AAAAAAD8-3h6x-RUDasMf`) + **Secret Key** (secret) — copy both.

**Store — PII/Exposure Check (you asked):**

- **Site Key public `0x4AAAAAAD8-3h6x-RUDasMf`:** Public, meant for frontend HTML/JS, **okay in public GitHub `wrangler.toml` vars** `[vars] TURNSTILE_SITE_KEY` + `[env.preview.vars]` + `[env.production.vars]` — not PII, not secret.

- **Secret Key:** MUST NOT be in `wrangler.toml` — if in `[vars]` would be public (security risk, bots bypass). Must be **Encrypted Secret via Dashboard** (Variables and secrets → Add Encrypted) for Preview + Production, or `wrangler secret put TURNSTILE_SECRET_KEY --env preview/production` via Docker `CLOUDFLARE_API_TOKEN`.

  Current `wrangler.toml` after PII removal has no `BOOKING`/`PERSONAL` PII — those also stored as Encrypted Secrets via Dashboard (since only Secrets allowed when toml exists). Same pattern.

  So `wrangler.toml` contains only `TURNSTILE_SITE_KEY` public `0x4AAAAAAD8-3h6x-RUDasMf` (Safe) + non-PII working hours + D1/R2 IDs. Secret keys as Encrypted Secrets via Dashboard (not in public).

- **After you set via Dashboard:** Preview env has `TURNSTILE_SECRET_KEY` secret, Production same — backend verification uses it via `https://challenges.cloudflare.com/turnstile/v0/siteverify`. Local Docker uses STUB bypass.

**Verification:**

After `wrangler.toml` synced (push feature branch → PR vs `alpha` → merge → Preview Custom `alpha` only rebuilds), you can modify `BOOKING_CALENDAR_ID` as Secret — previously locked when toml had vars, now with new toml without BOOKING/PERSONAL vars, Dashboard allows Secrets (plaintext still locked, but Secrets allowed). For Turnstile, add site key to toml (public) then secret key as Encrypted via Dashboard.

---

## 7. Resend (Email Confirmations with Meet Link)

**What:** Sends confirmation email via `functions/_lib/email.ts` with Meet link + cancel link `https://alpha.profile-webapp.pages.dev/api/cancel/{token}` + dateTime per 6.3 + 6.4. Google also auto-sends its own calendar invite with Meet join button + description containing Meet link (patched after creation).

**Why need Resend when Google already sends invite (your question):**

- Google invite = calendar event Add to calendar with Meet join button, but **cannot include secure cancel_token link** `/api/cancel/{token}` — cancel token→event_id mapping is D1, Google's Decline does NOT delete event (slot stays blocked per 6.4). Resend email contains **Meet link + cancel link (token)** that DELETEs event and frees slot.
- Custom branding + purpose from your domain vs generic Google invite
- Admin can resend via `/admin/bookings` → `[Resend Email]` without duplicate booking per 6.7
- Fallback if Google invite spam

**Create Resend (exact URLs):**

1. **https://resend.com** → Sign up with `metagtmtest1@gmail.com` → free 100/day

2. **API Keys:** Left → **API Keys** → **Create API Key** → Name `portfolio-booking`, Permission **Full access** or Sending only → Create → Copy `re_...` key (starts `re_`)

3. **Domain verification (for `bookings@yourdomain.com`):** Resend → **Domains → Add Domain** → your custom domain `somewebsite.com` (if you own) → gives SPF `v=spf1 include:amazonses.com` + DKIM TXT 3 → add in Cloudflare DNS → Verify green → FROM `bookings@yourdomain.com`. For MVP without custom domain (your `*.pages.dev` not yours) → use **test mode** `onboarding@resend.dev` as FROM → Resend allows sending from this test address **only to your own verified** `metagtmtest1@gmail.com` without DNS — so for testing, emails only to yourself, not arbitrary visitors — okay for alpha client verification. Later verify custom domain to email any visitor.

4. **Store as Encrypted Secret via Dashboard (since only Secrets allowed when toml exists, sharing same key okay per your question):**

   - Dashboard → Pages → profile-webapp → Settings → Variables and secrets → Choose Environment: Preview → Add Encrypted Secret `RESEND_API_KEY` = `re_...` (sharing same key for preview + production is okay, 100/day shared, you asked if same key okay → yes, 1 key shared across envs like GCal SA JSON and Turnstile secret, differentiate via FROM `alpha-bookings@...` vs `bookings@...` or subject prefix `[ALPHA]` in `email.ts` based on ENVIRONMENT)
   - Choose Environment: Production → Add Encrypted Secret `RESEND_API_KEY` = same `re_...` key

   **Sharing same key is okay** — 1 key for both envs, 100/day shared fine for portfolio ~5-10/day.

5. **Local dev without real email:** When `RESEND_API_KEY` missing, `email.ts` returns mock `{id: mock}` and logs Meet + cancel URL, so `POST /api/booking` still inserts D1 contact+booking with mock Meet link for Docker verification `curl /api/booking` → real email only when secret set in alpha/prod.

**How Resend works — from Gmail or own? (your question):**

- **Not from your Gmail** — Resend has its own email infrastructure (like SendGrid), not Gmail OAuth. It sends via its servers but FROM is your verified domain `bookings@yourdomain.com` (after DNS) or test `onboarding@resend.dev` for MVP (only to your own `metagtmtest1@gmail.com`). No Gmail password needed, just API key. Emails appear as from your domain, not from `metagtmtest1@gmail.com` Gmail, but delivered to visitor inbox. Google Calendar invite separate auto from calendar.

---

## 8. wrangler.toml Conventions — Critical (No PII in Public)

**Full file pattern current — no PII (PII as Encrypted Secrets via Dashboard since only Secrets allowed when toml exists):**

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
SLOT_DURATION_MINUTES = "30"  # configurable multiple 15 — 15,30,45,60, round down non-multiple 20→15
EXCLUDE_TODAY = "true"  # true = dont schedule today, from tomorrow — per requirement assume we dont
TIMEZONE = "America/New_York"  # Eastern for now, configurable via admin TIMEZONE var later
TURNSTILE_SITE_KEY = "0x4AAAAAAD8-3h6x-RUDasMf"  # public, okay in public GitHub
# BOOKING_CALENDAR_ID and PERSONAL_CALENDAR_ID NOT here — Encrypted Secrets via Dashboard (PII, avoid public)
# GCAL_SERVICE_ACCOUNT_KEY, TURNSTILE_SECRET_KEY, RESEND_API_KEY also as Encrypted Secrets

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
EXCLUDE_TODAY = "true"
TIMEZONE = "America/New_York"
TURNSTILE_SITE_KEY = "0x4AAAAAAD8-3h6x-RUDasMf"
# BOOKING and PERSONAL as Encrypted Secrets via Dashboard

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
EXCLUDE_TODAY = "true"
TIMEZONE = "America/New_York"
TURNSTILE_SITE_KEY = "0x4AAAAAAD8-3h6x-RUDasMf"
```

**Rules:**

- Pages only supports `env.preview` and `env.production`, NOT `env.alpha` — build fails `Configuration file contains environment names not supported: "alpha"`. Use `preview` for alpha DB+R2+calendar IDs (preview holds alpha).
- Top-level `[vars]` not inherited by envs — duplicate working hours etc into each env vars or warning.
- `pages_build_output_dir = "dist"` = static. Functions auto `functions/` (must be exact name, typo `fucntions` not treated).
- When vars in toml, Dashboard locks plaintext vars: "Environment variables for this project are being managed through wrangler.toml. Only Secrets can be managed via the Dashboard" — manage non-PII vars via toml (public ok), PII/calendar IDs + SA JSON + Turnstile Secret + Resend API Key as Encrypted Secrets via Dashboard to keep public repo clean (you reported Dashboard does not allow plaintext only secret — correct, so we store BOOKING, PERSONAL, GCAL JSON, TURNSTILE_SECRET_KEY, RESEND_API_KEY all as Encrypted Secrets).
- Real calendar IDs and personal email must NOT be in public GitHub — Encrypted secrets, plus `wrangler.toml` sync needed via PR merge to `alpha` before you can modify secrets in Dashboard (you reported cannot modify BOOKING until sync wrangler.toml).
- Migrations remote for alpha needs `--env preview` flag because alpha DB only under `[env.preview]`.
- Health endpoint requires both D1+R2 for both envs (was optional `skipped` before billing, after R2 enabled `r2:ok` you saw in alpha `R2: ok`).
- Slot duration configurable multiple of 15 via `SLOT_DURATION_MINUTES` + `normalizeSlotMinutes()`, EXCLUDE_TODAY via `EXCLUDE_TODAY=true` default assume dont schedule today, TIMEZONE Eastern for now configurable admin later.

---

## 9. Pages Functions Naming + Path Params + POST Body

- Folder must be `functions` at root — exact.

| File | URL |
|------|-----|
| `functions/api/health.ts` line 27 `onRequestGet` | `/api/health` → D1+R2 check both envs |
| `functions/api/content/[slug].ts` line 14 `params.slug` | `/api/content/:slug` → `/home`, params.slug dynamic `[slug]` = path param, 5-min cache |
| `functions/api/calendar/slots.ts` line 40-48 | `/api/calendar/slots?weeks=2` → uses BOOKING/PERSONAL secrets, TIMEZONE, EXCLUDE_TODAY, SLOT_DURATION, cache, no details privacy |
| `functions/api/booking.ts` (Slice 3) | `POST /api/booking` → body via `request.json()` {firstName,lastName,email,phone,purpose,slot,turnstileToken} + re-verify slot via FreeBusy race guard + upsert contact + create GCal event with Meet link auto via conferenceData + cancel_token UUIDv4 + Resend email Meet+cancel link |
| `functions/api/cancel/[token].ts` | `/api/cancel/:token` → `params.token` path param `[token]` |
| `functions/api/admin/contacts/[id].ts` | POST can have both path param + body: `params.id` + `request.json()` {drive_folder_url} |
| `functions/_lib/*` | NOT route — `_` prefix ignored — lib: env.ts, content.ts, google-calendar.ts (TIMEZONE America/New_York constant), turnstile.ts, email.ts, cache.ts |

POST both param + body allowed:
```ts
export const onRequestPost = async ({ request, params, env }) => {
  const id = params.id as string
  const body = await request.json() as { reason?: string }
}
```

---

## 10. Branch Control — Isolation (Screenshot Important)

**Dashboard → Pages → Settings → Builds → Branch control (your screenshot):**

```
Production branch: main
  Enable automatic production branch deployments: ON

Preview branch: Custom branches
  alpha
```

**Meaning — Single project isolation (full isolation code+data):**

- 1 project `profile-webapp`
- Production `main` → Production env (`[env.production]`) → prod D1 `f6dfc0c2...` + prod R2 `portfolio-images` + `ENVIRONMENT=production`, `SITE_URL=https://profile-webapp.pages.dev` + `BOOKING prod 33b9...5847a@group` + `PERSONAL metagtmtest1@gmail.com` as Encrypted Secrets → `https://profile-webapp.pages.dev`
- Preview Custom `alpha` only → Preview env (`[env.preview]`) → alpha D1 `30b1ea40...` + R2 `portfolio-images-alpha` + `ENVIRONMENT=alpha`, `BOOKING alpha 4b32...bf4a0@group` + `PERSONAL` same as Secrets → `https://alpha.profile-webapp.pages.dev` — code+data isolated, push to alpha only rebuilds alpha, main untouched until merge alpha→main

Preview options:

- `All non-Production branches` → all `slice/*` + PRs share Preview env (alpha DB) — okay solo dev, you only use alpha anyway
- `None (Disable automatic branch deployments)` → no preview
- `Custom branches` → `alpha` only → only alpha gets preview → full alpha-only isolation (screenshot, recommended for client verification) — you chose this after we discussed Option A (single project All non-prod sharing) vs Option B (2 projects full isolation) — Custom alpha only gives alpha-only within single project, Option B would be 2 projects `profile-webapp` + `profile-webapp-alpha`

---

## 11. GitHub — Protected Branches + Branch Naming

- Branches: `main` (prod), `alpha` (alpha env), `slice/*` feature per new convention

**Protected for verification (you said no direct to protected + you handle git actions for now):**

- Do NOT commit directly to `alpha` and `main` — they are protected for verification purpose (you said). Use `slice# + commitcount + few words` e.g. `slice1-1-portfolio-content`, `slice1-5-button-fix`, `slice2-1-calendar-slots`, `slice2-6-eastern-timezone` → PR vs `alpha` → client verifies `alpha.profile-webapp.pages.dev` → PR `alpha` → `main` → prod `profile-webapp.pages.dev` — later contains previous superset, only latest needs PR (e.g. slice1-5 contains 1-4, slice2-6 contains 2-1..5)

GitHub Settings → Branches → Rules:

- `main` and `alpha` protected: Require PR, Require status checks (CI + Pages), No direct push — you said they meant to be protected

**GitHub App for Pages (collaborator issue):**

If repo not visible in Cloudflare Connect (personal repo collaborator can't install GitHub App — only owner at account level):

- Owner: CF Dashboard → Pages → Connect → GitHub authorize → select repo → Install

**Isolated Git Env container (for git when host has auth/proxy issues, you added to memory):**

- Container `isolated-git-env` at `/workspace` mounting repo, use `docker exec isolated-git-env git -C /workspace/profile-webapp status` + `push origin slice/...` — you said you can now use docker container isolated-git-env to run git commands, e.g. `docker exec -it isolated-git-env git add .`
- Do NOT use to push directly to protected `alpha`/`main` after Slice 0 setup — feature branches only (you said)

---

## 12. Local Verification — Docker (Host Proxy Bypass) + Timezone Eastern + Smaller Buttons

**Why Docker:** Host `x2pagentd` proxy on `:10054` blocks npm 503 + breaks `wrangler login` localhost. Docker network bypasses.

Compose: frontend `node:20-alpine` Vite 5173 proxies `/api` → `http://backend:8788` via `VITE_API_PROXY_TARGET`, backend `node:20` debian (workerd needs glibc, not alpine) runs `d1 migrations apply DB --local` before `pages dev` (fix for `no such table: pages`).

```bash
# Unit — TDD red→green
docker run --rm -v "$PWD":/app -w /app node:20 npm test -- --run
# FE 12 files 43 tests: api 11 (health 5 + content 3 + calendar slots 3), App 5 clean UI (no BOLD ENV banner on main, only at /health route), useContent 4, useCalendar 3 (grouped + slotMinutes + excludeToday), CalendarView 3 (3-week Sun-Sat max 3 weeks only 14 selectable, 7 per row, excludeToday badge, Today badge padded px-4 py-1.5 not close to border, 30m badge removed kept text only), SlotPicker 5 (interval 9:00-9:30 Eastern, smaller buttons px-3 py-2.5 text-xs gap-3 no border overlap, close ✕ button, no privacy note)
docker run --rm -v "$PWD":/app -w /app node:20 npm run test:workers -- --run
# BE 6 files 53 tests: env 10, health 8 (both alpha+prod require D1+R2 R2:ok), content lib 4, content endpoint 9, google-calendar 16 (Eastern conversion 09:00 ET=13:00 UTC July, exclude busy 10-11 ET=14-15 UTC, partial 09:15-09:45 ET=13:15-13:45 UTC, busy all day ET=13-21 UTC, normalize multiple 15, parseExcludeToday, next14 days, exclude today, etc), slots 6 (200 slots array stub, weeks param, cache header max-age=300 X-Cache, stub source, BOOKING/PERSONAL vars, weekend)

# Lint + Build
docker run --rm -v "$PWD":/app -w /app node:20 npm run lint
docker run --rm -v "$PWD":/app -w /app node:20 npm run build
# → dist html 0.46KB + css 9.04KB (premium Tristan CPA + Nicepage + calendar 3-week) + js 175KB (53KB gz)

# Integration local — stub mock data when no creds (per your question local won't sync with GCal but mock data? Yes, stub by default, real when .dev.vars has GCAL_SERVICE_ACCOUNT_KEY)
rm -rf .wrangler/state
docker compose up -d backend
sleep 40
curl -s "http://localhost:8788/api/health" | jq .  # → status ok db ok r2 ok env local checks d1Ms 15 r2Ms 26 (both D1+R2 checked for both envs)
curl -s "http://localhost:8788/api/content/home" | jq '.page.title, (.sections | length)'  # → Jane Doe — Designer & Developer, 6 (6 types) from D1 local or fallback seed same as 0002 when Miniflare empty (fallback-local-no-table)
curl -s "http://localhost:8788/api/calendar/slots?weeks=2" | jq '.weeks, .source, (.slots | length), .workingHours'
# → 2, stub, 144 slots (Mon-Fri 09-17 30min minus past, from tomorrow due to EXCLUDE_TODAY=true now per assume dont schedule today) workingHours slotMinutes 30 multiple 15 excludeToday true timezone ET America/New_York

# To sync real GCal locally (Eastern):
# Create .dev.vars (gitignored) with:
# GCAL_SERVICE_ACCOUNT_KEY={"type":"service_account",... private_key ... client_email portfolio-calendar@...}
# BOOKING_CALENDAR_ID=4b320f...@group (alpha) + PERSONAL=metagtmtest1@gmail.com
# Then docker compose up backend reads .dev.vars automatically → source live, slots exclude real busy from both booking and personal

docker compose up -d frontend backend
open http://localhost:5173
# Clean premium UI (no 🚀 BOLD ENV banner on main, env only at /health + /api/health):
# Nav sticky blur + Playfair, Hero badge + Playfair headline + stats bar, Services 6 cards icons w-12 h-12 rounded-xl bg-slate-50 border flex-none not bar (fixed screenshot 1), About gap-12/16 py-20 no About pill, Testimonials stars, CTA banner buttons px-8 py-4 breathing room (fixed px-7 undefined) now px-8 py-4 + SlotPicker smaller px-3 py-2.5 text-xs gap-3 no border overlap 5:30-6:00 fixed, Gallery hover, Calendar 3-week Sun-Sat 7 per row max 3 weeks depends on overlap of next 14 days only selectable from tomorrow (EXCLUDE_TODAY=true), Today badge px-4 py-1.5 not close to border, 30m badge removed kept text only, close ✕ button, interval 9:00-9:30 ET (was only start time), no Privacy note, no blog/login (Services/About/Testimonials/Calendar/Contact only combining Tristan CPA premium with calendar), Timezone Eastern for now configurable via TIMEZONE admin later (+ different timezone visitors converted via Eastern display)
# /health debug: http://localhost:5173/health → System Health Debug DB:ok R2:ok env local — env only here

# Alpha real GCal (Preview Custom alpha only):
# After secrets set via Dashboard Encrypted (since only Secrets allowed when toml exists): Preview env has GCAL_SERVICE_ACCOUNT_KEY JSON + BOOKING alpha 4b32...bf4a0@group + PERSONAL metagtmtest1@gmail.com as Secrets → source live, slots exclude real busy, no event details

docker compose down -v
```

---

## 13. Remote Verification — Alpha + Prod (Both Envs) — Slice 2 Complete

```bash
# After you enabled R2 + created buckets portfolio-images(-alpha), health now R2: ok (was skipped before billing 10042), and after remote migrations --env preview for alpha seed

# Content both envs real D1 (not fallback) after 0002_seed.sql via --env preview for alpha + prod
curl https://alpha.profile-webapp.pages.dev/api/content/home | jq '.page.title, (.sections | length)'  # → Jane Doe..., 6 real D1 X-Content-Source d1
curl https://profile-webapp.pages.dev/api/content/home | jq '.page.title, (.sections | length)'  # → same 6 for prod (you already had home)

# Health both envs require D1+R2 for both envs (now R2: ok after activation, you saw R2: ok in alpha)
curl https://alpha.profile-webapp.pages.dev/api/health | jq .  # → status ok db ok r2 ok env alpha d1Ms 11 r2Ms 382 (you verified env alpha)
curl https://profile-webapp.pages.dev/api/health | jq .  # → status ok db ok r2 ok env production

# Calendar slots — stub when no secrets (TDD not blocked), live when secrets set via Dashboard Encrypted for Preview (alpha) + Production
curl "https://alpha.profile-webapp.pages.dev/api/calendar/slots?weeks=2" | jq '.weeks, .source, (.slots | length), .workingHours'
# → 2, stub or live, 144 slots (Mon-Fri 09-17 30min from tomorrow due to EXCLUDE_TODAY=true), workingHours slotMinutes 30 multiple 15 excludeToday true timezone ET America/New_York, calendars booking alpha configured, personal configured, no event titles leaked, cache max-age=300 X-Cache STUB/MISS, safeSlots date/start/end/available only, interval like 9:00 - 9:30 Eastern per user request
# Before fix, alpha had no such table: pages (isolation, prod had slug home) → fixed via migrations apply --env preview → 0001 ✅ 0002 ✅

# Calendar UI fixes from screenshots:
# - Dates not within box due to -mx-2 negative margin overflow + missing lg:grid-cols-7 (only lg:grid-cols-3) → fixed grid-cols-7 lg:grid-cols-7 gap-2 sm:gap-3, 7 per row x2-3 rows, dates within box, 16 slots badge cut off fixed min-h-[90px] px-2.5 py-1 leading-none
# - Floating text Select a date from next 14 days 144 slots... blocks calendar date due to side-by-side lg:flex-row overlapping + 30m badge repeated → fixed Home vertical layout calendar top + SlotPicker below expand under not side, 30m badge removed kept just text per user suggestion
# - Buttons text close to border px-7 py-3 where px-7 had no CSS rule (only px-3,4,6,8) → fixed px-8 py-4 leading-none gap-4 breathing room + added missing utilities
# - Icons weird sizing screenshot 1 full-width gray bar tiny centered → fixed w-12 h-12 rounded-xl bg-slate-50 border flex-none text-xl span 22px
# - About text too close to image + About pill repeated screenshot 2 → fixed gap-12 lg:gap-16 py-20 items-center, removed About pill
# - BOLD ENV banner on main 🚀 BOLD LOCAL ENV — LOCAL ✅ — Slice 1 Content not needed, should be in /health endpoint per user — removed from App.tsx main (was Slice 0 verification), now only at /health UI + /api/health JSON
# - Infra health details Infra health (D1+R2) — env local not needed on main — removed from Home.tsx
# - Calendar UI better but still not good per latest screenshot: dates not within box + floating text Select a date... 144 slots • 9 days blocks calendar date → suggested display 2 next 2 weeks dates and # slots in two rows 7 days in 1 row + when selects date expand under and show available time interval like 9:00-9:30 per user + spin UIUX expert again — we did, fixed to 3-week Sun-Sat max 3 weeks depends on overlap of next 14 days only selectable per new requirement #1
# - Today badge px-1.5 py-0.5 rounded-full still too close to border + 30m badge px-2.5 py-1 same → fixed to px-4 py-1.5 and px-4 py-2 leading-none per your latest screenshot 5:30-6:00 border overlapped next button + make button itself smaller per request: now px-3 py-2.5 text-xs gap-3 no overlap, Eastern timezone America/New_York for now configurable via admin TIMEZONE later + removed Privacy note
# - No blog/login on screen per your note combining Tristan CPA premium with requirements: Nav only Services/About/Testimonials/Calendar/Contact, no blog/login

# Browser https://alpha.profile-webapp.pages.dev:
# No 🚀 BOLD ENV on main (only at /health + /api/health per C1/C2), No infra health details, Services icons w-12 circles not bar, About gap-12 no pill, CTA banner buttons px-8 py-4 breathing room, Calendar max 3 weeks Sun-Sat 7 per row max 3 weeks depends on overlap, only next 14 selectable from tomorrow (EXCLUDE_TODAY=true assume dont), Today badge px-4 py-1.5 not close to border, 30m badge removed kept text only per your #3, SlotPicker smaller buttons px-3 py-2.5 text-xs gap-3 no border overlap on hover (was px-4 py-3 overlapping 5:30-6:00 screenshot) + close ✕ button + interval 9:00-9:30 ET per your #2 with timezone Eastern for now, no privacy note per #5, no blog/login per your combine note
```

---

## 14. Cloudflare Zero Trust — Google Login for Admin (Slice 5 Auth) — Additional Setup

**Goal:** Protect `/admin/*` + `/api/admin/*` so only allowlisted Google emails can login, no username/password, via Cloudflare Access. This is extra beyond `functions/_lib/auth.ts` code (which verifies headers `Cf-Access-Jwt-Assertion` + `Cf-Access-Authenticated-User-Email`).

**Why need extra dashboard setup (your question):** Code alone cannot create Google OAuth flow — Cloudflare Zero Trust does edge intercept before Worker. You must enable Identity Provider Google + Access Application. Without it, `/admin` would be public + our code returns 401 (as you saw). With it, Google login page appears at edge.

**15 min setup — one-time:**

### A. Enable Zero Trust + Team Domain
1. **https://dash.cloudflare.com** → Left **Zero Trust** → If first time, onboarding: Choose Free plan → Team Name e.g. `portfolio` → Team Domain `portfolio.cloudflareaccess.com` → Save (this is `https://portfolio.cloudflareaccess.com` domain for callbacks)
2. Note Team Domain URL — needed for Google OAuth.

### B. Create Google OAuth Client for Access (separate from Calendar SA + from Gmail OAuth for Meet)
1. **https://console.cloud.google.com** → Use same project `portfolio-webapp-503319` or new project `portfolio-access` → **APIs & Services → Credentials**
2. If not configured consent screen (you already did for Calendar OAuth, reuse), check **OAuth Consent Screen** → User Type External → App name `Portfolio Admin Access`, Support email your email, Contact same → Save.
3. **Create Credentials → OAuth Client ID → Web Application → Name `cloudflare-access`**
   - Authorized JavaScript origins: `https://portfolio.cloudflareaccess.com` (your team domain from Zero Trust)
   - Authorized Redirect URIs: `https://portfolio.cloudflareaccess.com/cdn-cgi/access/callback`
   - Create → Copy **Client ID** `xxx.apps.googleusercontent.com` + **Client Secret** `GOCSPX-...`
   - This is different from `GOOGLE_OAUTH_CLIENT_ID` for calendar Meet (that one redirects to `https://developers.google.com/oauthplayground`), this one redirects to your team domain callback.

### C. Add Google Identity Provider in Zero Trust
1. **Zero Trust Dashboard** → **Settings → Authentication → Login methods** or **Access → Identity Providers** (new UI: **Zero Trust → Settings → Authentication → Add new provider**)
2. Choose **Google** → Paste Client ID (as App ID) + Client Secret → Enable PKCE optional → Save
3. Test: **Test** next to Google → should redirect to Google login and succeed.

### D. Create Access Application for Admin
1. **Zero Trust → Access → Applications → Add an application → Self-hosted**
2. **Public hostname** mode (since we use Pages, not Tunnel):
   - Click **Add public hostname**
   - Domain dropdown: if you have custom domain `yourdomain.com` use it, but for Pages free tier `*.pages.dev` we use **Switch to custom input** → Enter:
     - `alpha.profile-webapp.pages.dev`
     - Path: `/admin/*` → Add
     - Also add second hostname for API protection: same domain path `/api/admin/*`
     - Repeat for prod: `profile-webapp.pages.dev` `/admin/*` and `/api/admin/*`
   - Alternatively if UI supports Cloudflare Pages type: Choose **Cloudflare Pages** → Select project `profile-webapp` → Protection path `/admin/*`
   - For simplicity, you can also use wildcard: `*.profile-webapp.pages.dev` path `/admin/*` (covers both alpha+prod preview hashes) — if wildcard not allowed, add 2 separate apps for alpha and prod.
3. **Access policies:** Add existing or Create new policy:
   - Policy name: `Allow Admin Emails`
   - Action: **Allow**
   - Include → **Emails** → Enter your allowlisted emails comma-separated e.g. `admin@example.com, owner@company.com` — these are the only Google emails that can login. This matches `ADMIN_EMAILS` Worker check double defense.
   - You can also use **Emails ending in** `@yourdomain.com` if you own domain.
   - Save.
4. **Identity providers:** Select Google (only Google, disable others, no username/password). Turn on **Instant Auth** to skip Cloudflare Access intermediary page → direct to Google.
5. **Session Duration:** 24h or 1 week → Save.
6. **Create/Copy Application**

### E. Configure Wrangler Secrets for Worker Auth Double Check
Even though Access blocks at edge, our Worker also verifies `Cf-Access-Jwt-Assertion` header to prevent bypass if someone hits origin directly.

- Dashboard → Pages → `profile-webapp` → Settings → Variables and secrets → Choose **Preview** + **Production**:
  - Add Encrypted Secret `ADMIN_EMAILS` = `admin@example.com, owner@company.com` (same list as Access policy, PII encrypted, not in public toml)
  - Verify `ADMIN_BYPASS` var: `wrangler.toml` already has `ADMIN_BYPASS=true` for local/preview, `false` for production. For alpha preview while testing Access, you can keep `true` to allow bypass without Google, then set to `false` once Access works. In prod **must** be `false`.
- Local `.dev.vars`: `ADMIN_BYPASS=true` (already in example) + `ADMIN_EMAILS=admin@example.com`

### F. Verify End-to-End
```bash
# Local (bypass true, no Google needed)
curl http://localhost:8788/api/admin/auth | jq .  # → authed true bypass true env local

# Alpha with ADMIN_BYPASS=true (before Access configured)
curl https://alpha.profile-webapp.pages.dev/api/admin/auth | jq .  # → authed true bypass true (since preview var true)

# After setting ADMIN_BYPASS=false in preview + Access app created:
# Browser:
open https://alpha.profile-webapp.pages.dev/admin
# → Should redirect to https://portfolio.cloudflareaccess.com/... → Google OAuth login → pick allowed email → if allowed → shows Admin Dashboard, if not allowed email → Block page "That account does not have access"
# Then API:
curl -H "Cf-Access-Jwt-Assertion: <real-jwt-from-browser>" https://alpha.profile-webapp.pages.dev/api/admin/auth
# Or with explicit email header (CF adds automatically):
# Browser devtools Network → /api/admin/auth request headers include cf-access-authenticated-user-email automatically after login → 200 authed true
```

**Troubleshooting:**
- **Still shows Admin Access Required page instead of Google login:** Access application not created or path mismatch `/admin/*` vs `/admin` — check hostname exact + path includes wildcard `/*` + Policy Allow includes your email.
- **Google login loops:** Redirect URI mismatch in Google OAuth client — must be `https://<team>.cloudflareaccess.com/cdn-cgi/access/callback` exactly, not your pages.dev domain.
- **401 after Google login:** Our Worker allowlist `ADMIN_EMAILS` doesn't include your email though Access allowed — add email to secret `ADMIN_EMAILS` via Dashboard Encrypted.
- **Local can't access /admin:** Set `ADMIN_BYPASS=true` in `.dev.vars` + `wrangler.toml` [vars].

---

## 15. R2 Upload Limits + Free Tier Quota (Slice 5)

**Your question:** Any upload limit in browser → Worker → R2 like nginx `client_max_body_size`? Needs config?

**Answer via docs research (official Cloudflare limits page https://developers.cloudflare.com/workers/platform/limits/):**

| Hop | Free Tier Limit | Our Limit | Need Config? |
|-----|----------------|-----------|--------------|
| Browser → Cloudflare Edge (request body) | **100MB** for Free/Pro plan, 200MB Business, 500MB Enterprise — returns 413 if exceeded | **1MB** app-level | No — 1MB <<100MB, no nginx-like config needed, CF handles limit |
| Worker → R2 `put()` single upload | **5 GiB** max object, R2 free 10GB total storage | 1MB | No |
| Worker → R2 multipart | **5 TiB** max | not used | No |
| Workers CPU per request | **10ms** Free, 30sec default Paid (5min max) | Auth 1ms + upload 3-5ms = <10ms | Yes need to keep CPU low — client resize WebP/PNG, not Worker |
| Workers memory | **128MB** | FormData 1MB <<128MB | No |
| Pages Functions | Same as Workers (V8 isolates) | same | No |

**So no nginx-like `client_max_body_size` config needed** — Cloudflare edge already enforces 100MB. Our app enforces 1MB via code (server check) to stay free tier storage. No `wrangler.toml` upload limit knob exists for Pages Functions (only `limits.cpu_ms` etc for Paid). We keep `ADMIN_BYPASS` etc.

**Quota Endpoint to stay under 10GB R2 free tier:**

New endpoint implemented in next slice (`GET /api/admin/r2-usage`):

- **Auth required** (admin only via same Zero Trust)
- **Query `?checkQuota=true`** → triggers `R2_BUCKET.list({limit:1000})` — 1 Class A op, sums `size`
- Returns:
```json
{
  "totalObjects": 42,
  "totalBytes": 8234567,
  "totalMB": 7.85,
  "percent": 0.078,
  "limitMB": 10240,
  "limitBytes": 10737418240,
  "warning": false,
  "objects": [{ "key":"portfolio/xxx.png", "size": 245000 }, ...],
  "guidance": "Replace-on-update ensures no bloat..."
}
```
- If `percent >90` → `warning:true` + guidance to delete unused.
- If `list` truncated (>1000 objects) → returns `truncated:true` + estimate warning.
- Without `?checkQuota` → returns cheap placeholder counts from D1 `section_items` where `image_url` like `portfolio/%` (no R2 LIST, avoids CPU) — for free tier safety on frequent calls.

**Free tier math for replace-on-update:**
- Portfolio needs <50 images, avg PNG 300KB (lossless) after 1200px resize → 15MB total
- 10GB /1MB = 10k images capacity
- Replace strategy: delete old before put new → storage never grows beyond active images.

**PNG vs WebP choice (your request):** PNG lossless compression (deflate, no quality loss) via `canvas.toBlob('image/png')` preserves quality vs WebP lossy. Tradeoff: PNG larger (often 2-3× WebP) but still ≤1MB after resize. We will implement ImageUploader to output **PNG by default** to keep quality, with fallback to WebP only if PNG >1MB after resize attempts (quality lossless but size fallback).

---

## 16. Pitfalls — Fixed

- **npm 503 `x2pagentd` CONNECT port 443 No route to host:** Host proxy on `:10054` blocks registry, use Docker `node:20` for npm + wrangler remote, token via `-e CLOUDFLARE_API_TOKEN`.
- **R2 `Please enable R2 [10042]`:** Enable via Dashboard → R2 Overview → Enable (needs card, free tier $0). Before enable, R2 bindings commented out `wrangler.toml`, health `r2:skipped` 200 OK. After enable, uncomment `portfolio-images(-alpha)` + health `r2:ok` for both envs you saw `R2: ok` in alpha.
- **wrangler.toml `env.alpha` not supported:** Pages only `preview`/`production` — build fails `Configuration file contains environment names not supported: "alpha"`. Use `preview` env for alpha DB+R2+calendar IDs.
- **Couldn't find D1 DB with name `portfolio-db-alpha` in `wrangler.toml`:** Alpha DB only under `[env.preview]` not top-level → need `--env preview` flag: `d1 migrations apply portfolio-db-alpha --remote --env preview` → 0001 ✅ 0002 ✅ (you hit after alpha showed `no such table: pages` then prod had `slug home`).
- **Branch not selectable for custom domain:** Needs successful deployment — push branch with code first (alpha initially empty `f228e03` no deployment → not selectable) → merge Slice 0 fix `02944b0` + triggers into alpha → green → now selectable.
- **Environment variables managed through wrangler.toml. Only Secrets can be managed via the Dashboard:** When vars in toml, Dashboard locks plaintext vars, only Encrypted secrets allowed. So PII `metagtmtest1@gmail.com` + calendar IDs `4b32...` / `33b9...` cannot be plaintext in public GitHub — store as Encrypted Secrets via Dashboard (Preview `BOOKING alpha + PERSONAL email + GCAL JSON + TURNSTILE_SECRET_KEY + RESEND_API_KEY`, Production same but BOOKING prod `33b9...`) to avoid PII. Non-PII working hours + SITE_URL + ENVIRONMENT + SLOT_DURATION + EXCLUDE_TODAY + TIMEZONE can stay in toml (public ok). After removing `BOOKING`/`PERSONAL` from toml (public repo no email), Dashboard allows Secrets. You reported Dashboard does not allow plaintext only secret — correct, so we store calendar IDs + personal email + SA JSON + Turnstile Secret + Resend API Key all as Encrypted Secrets even though some not secret, to keep public repo clean. Real calendar IDs stored as secrets, not here.
- **Invalid uuid `local-placeholder-portfolio-db` / `prod-placeholder-id`:** Replace placeholders with real IDs from `d1 create` — top-level `f6dfc0c2-...` prod, preview `30b1ea40-...` alpha, script auto-updates via Python (fixed multiline bug `SyntaxError: unterminated string literal` + ID extraction returning full log + ID).
- **workerd ENOENT:** Backend must be `node:20` debian not alpine (glibc).
- **TS2591 `process`:** `vite.config.ts` uses `process.env.VITE_API_PROXY_TARGET` → needs `@types/node` + `node` in tsconfig types (fixed CI lint).
- **Double `--run` error `Expected a single value for option "--run"`:** CI runs `npm test -- --run`, so `package.json` test must be `vitest` not `vitest --run`, otherwise `vitest --run --run` error — fixed.
- **Content endpoint `no such table: pages` locally:** `pages dev --d1=DB` uses binding name DB (creates `local-DB` ephemeral) not `portfolio-db`, so `d1 migrations apply portfolio-db --local` applies to different file than pages dev. Fix: backend compose runs `d1 migrations apply DB --local` before `pages dev` + fallback seed in endpoint when no table for local dev returns same as `0002_seed.sql` for `home` only (remote uses real D1).
- **Buttons text close to border `px-7 py-3`:** `px-7` had no CSS rule (only px-3,4,6,8) → horizontal padding 0, text hugged border. Fixed to `px-8 py-4 leading-none gap-4` + added missing utilities `px-7`, `py-3.5`, `inline-flex`, `leading-none`, etc. Later CTA banner buttons `px-7 py-3` also fixed, and calendar `Today` badge `px-1.5 py-0.5 text-[9px]` too close → `px-4 py-1.5` + `30m` badge `px-2.5 py-1` → `px-4 py-2 leading-none` per latest screenshot.
- **Icons weird sizing screenshot 1:** Old full-width gray bar tiny centered — fixed to `w-12 h-12 rounded-xl bg-slate-50 border flex-none text-xl` span 22px, then to `w-12 h-12` with number `0{idx+1}`.
- **About text too close to image + About pill repeated screenshot 2:** Fixed `gap-12 lg:gap-16 py-20 items-center`, removed About pill `About` repeated.
- **BOLD ENV banner on main `🚀 BOLD LOCAL ENV — LOCAL ✅ — Slice 1 Content` not needed, should be in /health endpoint:** Removed from `App.tsx` main (was Slice 0 verification), now only at `/health` UI + `/api/health` JSON per user C1/C2.
- **Infra health details `Infra health (D1+R2) — env local` not needed on main:** Removed from Home.tsx `<details>` debug per user C2.
- **GitHub Pages app not visible for collaborator:** Personal repo collaborator can't install GitHub App — only owner at account level, need owner to install App via Cloudflare Dashboard → Connect → GitHub authorize → select repo.
- **Cloudflare Token fetch:** `wrangler login` starts local server `http://localhost:8976` fails `localhost refused to connect` behind proxy `x2pagentd` — fix via API Token Custom Token with perms D1:Edit, R2 Storage:Edit, Pages:Edit, Scripts:Edit etc (example summary) via https://dash.cloudflare.com/profile/api-tokens → Create Custom Token → Copy raw token (no Bearer, no quotes) → `CLOUDFLARE_API_TOKEN=xxx wrangler whoami` via Docker `node:20` bypass proxy, store in `~/.zshrc`, use `-e CLOUDFLARE_API_TOKEN` for docker runs.
- **Token `Invalid request headers [6003] Invalid format for Authorization header [6111]`:** Quotes, Bearer prefix, truncated, newline → fix via Copy button + `tr -d '\n'`.
- **Script not support only prod setup:** Added `prod` only option to `scripts/setup-cloudflare.sh` (was only alpha, alpha+prod, all).
- **Script upsert:** Safe to re-run, handles already exists via `d1 list` + migrations skip via `d1_migrations` table + Python toml update with cleaned UUID.
- **Calendar UI ugly — month grid 28-31 buttons + month nav conversion killer audit 32%:** Redesigned to 14-day strip then 3-week Sun-Sat max 3 weeks only 14 selectable (7 per row) per user rec display max 3 weeks depends on overlap of next 14 days and with Sunday first and Saturday last, only next 14 can be selected.
- **Dates not within box + floating text blocking + 16 slots badge cut off:** `-mx-2` negative margin overflow outside box + missing `lg:grid-cols-7` utility (only `lg:grid-cols-3`) + side-by-side `lg:flex-row` overlapping + min-h insufficient → fixed `grid-cols-7` `lg:grid-cols-7` gap-2 sm:gap-3, w-full not max-w-5xl, min-h 92/96, badge inline-block px-2.5 py-1 leading-none fully visible, Home vertical w-full calendar top + SlotPicker below expand under not floating side.
- **Buttons px-4 py-3 rounded-full border bg-white when hover border overlapped next button screenshot 5:30-6:00:** Gap-2 too tight for ring-2 outside, scale-1.02 scales border into next gutter → fixed to smaller `px-3 py-2.5 text-xs` `gap-3 grid-cols-2` `border-slate-200 hover:border-slate-900 hover:z-10 relative truncate leading-none` no scale, focus ring-1 offset-1, plus timezone conversion visitor local without timeZone (now Eastern per for now use Eastern).
- **30m repeated multiple places:** Was badge repeated in CalendarView header + SlotPicker header + footer badge + text — now removed badges, kept just text per user suggestion keep just the text, verify with UIUX.
- **Cannot close time slot modal:** No X button in old SlotPicker — added close button `✕` `w-9 h-9 rounded-full border` + `onClose={() => setSelectedDate(null)}` in Home.
- **Privacy note `Privacy: only free/busy shown...` not needed:** Removed from SlotPicker per user point 5.
- **Timezone: local won't sync with GCal but mock data (your question):** Yes, local Docker is stub mock by default when `GCAL_SERVICE_ACCOUNT_KEY` missing (TDD never blocked) — returns 144 mock slots next 2 weeks from tomorrow, workingHours 09-17 Mon-Fri ET. To sync real GCal locally, create `.dev.vars` (gitignored) with SA JSON + booking/personal IDs, then `docker compose up backend` reads `.dev.vars` → source live, slots exclude real busy.
- **Timezones: use Eastern for now configurable admin later:** `TIMEZONE = America/New_York` constant in `functions/_lib/google-calendar.ts` + `src/lib/constants.ts` `TIMEZONE_LABEL = ET (Eastern)` — Eastern for now per user request, future admin can set via `TIMEZONE` var in `wrangler.toml` (`TIMEZONE` non-PII public ok) + backend conversion Eastern wall time to UTC ISO via `getEasternOffsetHours()` Intl longOffset GMT-04:00 parsing + fallback DST, frontend display via `toLocaleTimeString timeZone: America/New_York` (was UTC then local, now Eastern).
- **PII exposure in wrangler.toml + public GitHub:** `metagtmtest1@gmail.com` personal email + booking calendar IDs `4b32...`/`33b9...` are PII/resource IDs, shouldn't be public — moved to Encrypted Secrets via Dashboard (since Dashboard only allows Secrets when toml exists, per message). Non-PII working hours, SITE_URL, ENVIRONMENT, SLOT_DURATION, EXCLUDE_TODAY, TIMEZONE, TURNSTILE_SITE_KEY public `0x4AAAAAAD8-3h6x-RUDasMf` remain in toml (public ok). After `wrangler.toml` sync via PR merge to `alpha`, you can modify secrets in Dashboard.
- **Turnstile hostname management:** UI shows "You have configured 0 out of 10 hostnames" + search + Add Hostnames — wildcard `*.profile-webapp.pages.dev` invalid `Enter a valid domain`, skip wildcard + localhost for now (local uses STUB), add only `profile-webapp.pages.dev` + `alpha.profile-webapp.pages.dev` valid subdomains — after creation you get Site Key public `0x4AAAAAAD8-3h6x-RUDasMf` + Secret Key secret — site key public okay in toml, secret key as Encrypted Secret via Dashboard (Preview + Production) — local dev STUB bypass TDD not blocked.
- **Resend same key sharing okay? (your question):** Yes, 1 key shared across preview+production okay, 100/day shared free tier, differentiate via FROM `alpha-bookings@...` vs `bookings@...` or subject `[ALPHA]` prefix via ENVIRONMENT.
- **Meet link in Google Meet invite also contain meeting link (your question):** Yes, via `conferenceData.createRequest {type: "hangoutsMeet"}` + `conferenceDataVersion=1` + patch description with Meet link + cancel link `/api/cancel/{token}` → Google auto-sends invite with Meet join button + description containing Meet link text + cancel link, plus Resend email also contains same Meet + cancel as backup.

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
# Which envs: alpha / prod / alpha+prod / all + prod-only option, y
# Choose alpha+prod → creates D1 portfolio-db-alpha ID 30b1ea40... + portfolio-db ID f6dfc0c2... + R2 portfolio-images-alpha + portfolio-images (needs R2 enabled via Dash → R2 Overview Enable, card required free tier $0)
# Then manually for alpha seed (since alpha only under [env.preview]):
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN node:20 npx wrangler d1 migrations apply portfolio-db-alpha --remote --env preview
# → 0001_initial ✅ + 0002_seed ✅ 6 sections 18 items to alpha D1
# Verify remote:
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN node:20 npx wrangler d1 execute portfolio-db-alpha --remote --command "SELECT slug FROM pages"  # → home
docker run --rm -v "$PWD":/app -w /app -e CLOUDFLARE_API_TOKEN=$CLOUDFLARE_API_TOKEN node:20 npx wrangler d1 execute portfolio-db --remote --command "SELECT slug FROM pages"  # → home for prod

# 3. GCP + GCal (see Section 5)
# Create project portfolio-webapp-503319 → Enable Calendar API https://console.cloud.google.com/apis/library/calendar-json.googleapis.com
# Service Accounts https://console.cloud.google.com/iam-admin/serviceaccounts → Create portfolio-calendar → Copy email portfolio-calendar@portfolio-webapp-503319.iam.gserviceaccount.com + JSON key file whole JSON
# Google Calendar https://calendar.google.com/calendar/r/settings/createcalendar → Create Bookings Alpha + Bookings Production → get IDs via Integrate calendar (click calendar name → Calendar ID) alpha 4b32...bf4a0@group prod 33b9...5847a@group + personal metagtmtest1@gmail.com
# Share: Bookings Alpha + Prod with SA as Make changes and see all event details (not See only free/busy, not See all event details), Personal (your main Cheng Chen) with SA as See only free/busy (hide details) for privacy
# Dashboard Secrets Encrypted for both Preview and Production: BOOKING_CALENDAR_ID = alpha/prod group IDs, PERSONAL_CALENDAR_ID = your email (PII encrypted not public), GCAL_SERVICE_ACCOUNT_KEY = JSON whole

# 4. Turnstile (see Section 6)
# Dashboard → Turnstile https://dash.cloudflare.com/?to=/:account/turnstile → Add widget portfolio-booking → Hostname Management Add Hostnames: profile-webapp.pages.dev + alpha.profile-webapp.pages.dev (skip wildcard *.profile-webapp.pages.dev invalid + localhost for STUB) → Mode Managed (or Invisible) → Create → Copy Site Key public 0x4AAAAAAD8-3h6x-RUDasMf + Secret Key
# wrangler.toml: TURNSTILE_SITE_KEY public 0x4AAAA... in [vars] + [env.preview.vars] + [env.production.vars] (public ok, not PII)
# Dashboard Secrets Encrypted: TURNSTILE_SECRET_KEY = secret for Preview + Production (since only Secrets allowed when toml exists)

# 5. Resend (see Section 7)
# https://resend.com → Sign up → API Keys → Create → copy re_... key
# For MVP without custom domain, FROM onboarding@resend.dev only to your own verified metagtmtest1@gmail.com without DNS — okay for alpha verification
# Later custom domain: Domains → Add Domain → DNS SPF/DKIM in Cloudflare → FROM bookings@yourdomain.com to any visitor
# Dashboard Secrets Encrypted: RESEND_API_KEY = re_... for Preview + Production (sharing same key okay, 100/day shared)

# 6. Local TDD via Docker (bypasses host x2pagentd proxy 503)
docker run --rm -v "$PWD":/app -w /app node:20 npm test -- --run  # FE 43 tests: api 11 (health+content+calendar slots), App 5 clean UI no debug banners only at /health, useContent 4, useCalendar 3, CalendarView 3 (3-week Sun-Sat max 3 weeks only 14 selectable, excludeToday, selected, Today badge padded, no 30m repeat), SlotPicker 5 (interval 9:00-9:30 ET, smaller buttons no overlap, close button)
docker run --rm -v "$PWD":/app -w /app node:20 npm run test:workers -- --run  # BE 6 files 53 tests: env 10, health 8 both envs db:ok r2:ok required, content lib 4, content endpoint 9, google-calendar 16 (Eastern conversion ET=UTC+offset, normalize multiple 15, excludeToday, next14, etc), slots 6
docker run --rm -v "$PWD":/app -w /app node:20 npm run lint
docker run --rm -v "$PWD":/app -w /app node:20 npm run build  # dist 0.46KB html + 9.04KB css (premium Tristan CPA) + 175KB js (53KB gz)
rm -rf .wrangler/state; docker compose up -d backend && sleep 40 && curl -s "http://localhost:8788/api/health" | jq . && curl -s "http://localhost:8788/api/content/home" | jq '.page.slug, (.sections | length)' && curl -s "http://localhost:8788/api/calendar/slots?weeks=2" | jq '.weeks, .source, (.slots | length), .workingHours' && docker compose down -v
# → health ok db ok r2 ok env local, home 6 sections, slots weeks 2 source stub 144 slots from tomorrow (EXCLUDE_TODAY=true true) workingHours slotMinutes 30 multiple 15 excludeToday true timezone ET America/New_York — stub mock, real when .dev.vars has GCAL_SERVICE_ACCOUNT_KEY

# 7. Pages Project + Branch Control (Single project isolation)
# Workers & Pages → Create → Pages → Connect to Git → metagtmtest1-design/profile-webapp
# Project name: profile-webapp, Production branch: main, Preview: Custom branches alpha only (screenshot) for full isolation code+data (Production main → prod D1+R2 env production SITE_URL https://profile-webapp.pages.dev BOOKING prod 33b9... as Encrypted Secret, Preview Custom alpha → alpha D1+R2 env alpha SITE_URL https://alpha.profile-webapp.pages.dev BOOKING alpha 4b32... as Encrypted Secret)
# Build: Framework None (Vite not auto-detected ok), Build command npm run build, Output dist, Root /, Node 20 NODE_VERSION=20, Vars managed via wrangler.toml (non-PII working hours + SITE_URL + ENVIRONMENT + SLOT_DURATION 30 multiple 15 + EXCLUDE_TODAY true + TIMEZONE America/New_York + TURNSTILE_SITE_KEY public), Secrets via Dashboard Encrypted (PII BOOKING, PERSONAL email, GCAL JSON, TURNSTILE_SECRET_KEY, RESEND_API_KEY)
# Deployments: alpha branch → Preview alias https://alpha.profile-webapp.pages.dev (you saw R2: ok, env alpha), main → Production https://profile-webapp.pages.dev (env production)
# Custom domains optional

# 8. PR Flow (protected, no direct to alpha/main per your instruction, branch naming slice# + count + words)
# Feature slice2-6-eastern-timezone (contains all Slice 2: configurable x15, exclude today always, 3-week Sun-Sat 7 per row only 14 selectable, interval 9:00-9:30 ET, smaller buttons no overlap, close button, no privacy note, Today/30m badges padded not close to border, no debug banners on main only at /health, no blog/login calendar kept per combine note) → PR vs alpha → CI green 96 tests (43 FE +53 BE) + build → Merge → Pages Preview alpha → https://alpha.profile-webapp.pages.dev/api/health → env alpha db ok r2 ok, .../api/content/home → home 6 real D1, .../api/calendar/slots?weeks=2 → weeks 2 source live when secrets set (GCAL JSON + BOOKING alpha + PERSONAL as Secrets) else stub 144 slots from tomorrow, calendar UI max 3 weeks Sun-Sat 7 per row only next 14 selectable from tomorrow, badges padded, close button, interval 9:00-9:30 ET smaller buttons no overlap
# After client approves alpha → PR alpha → main → prod https://profile-webapp.pages.dev same clean premium UI

# 9. Verify
curl https://alpha.profile-webapp.pages.dev/api/health | jq .env  # → alpha
curl https://profile-webapp.pages.dev/api/health | jq .env  # → production
curl "https://alpha.profile-webapp.pages.dev/api/content/home" | jq '.page.title, (.sections | length)'  # → Jane Doe..., 6 real D1
curl "https://alpha.profile-webapp.pages.dev/api/calendar/slots?weeks=2" | jq '.weeks, .source, (.slots | length)'  # → 2, live or stub, 144 from tomorrow
```

---

## 14. All Setups Completed — Confirmation (Slice 0-2)

- [x] Cloudflare account + Pages project `profile-webapp` Production `main` + Preview Custom `alpha` only (full isolation screenshot) — Branch control: Production `main` Enable auto ON, Preview Custom `alpha` only
- [x] GitHub repo `metagtmtest1-design/profile-webapp` connected via GitHub App (owner install needed for personal repo collaborator) — branches protected `alpha`/`main` no direct commits, naming `slice# + count + words` e.g. `slice1-5-button-fix` superset, `slice2-6-eastern-timezone` superset
- [x] Docker 2 containers: frontend `node:20-alpine` Vite 5173 proxies `/api` → backend `node:20` debian (workerd glibc) `pages dev dist --d1=DB --r2=R2_BUCKET --local` + auto `d1 migrations apply DB --local` before dev, plus `isolated-git-env` ubuntu at `/workspace` for `git` commands when host auth fails
- [x] D1: `portfolio-db-alpha` ID `30b1ea40-63cd-41ef-84d5-2d9007bea311` ENAM + `portfolio-db` ID `f6dfc0c2-a7db-4e4a-b2de-abc5926fbf8b` ENAM created via `docker run ... wrangler d1 create` (Docker bypasses proxy `x2pagentd`), IDs in `wrangler.toml` top-level prod + preview alpha, `migrations/0001_initial.sql` 5 tables + `0002_seed.sql` 6 sections 18 items seeded, applied via `--local` + `--remote` (alpha needs `--env preview` flag because only under `[env.preview]` not top-level, you hit `no such table: pages` then prod had `slug home` isolation)
- [x] R2: `portfolio-images-alpha` + `portfolio-images` (+ preview) buckets — initially blocked `Please enable R2 [10042]` needs billing card Dashboard → R2 Overview Enable (free tier $0), made optional health `r2:skipped` workaround for Slice 0, after activation uncomment R2 in `wrangler.toml` + health now requires both D1+R2 for both envs `db:ok r2:ok` you saw `R2: ok` in alpha after activation + in local `db:ok r2:ok` via Miniflare
- [x] GCP + GCal: Project `portfolio-webapp-503319` → Calendar API `https://console.cloud.google.com/apis/library/calendar-json.googleapis.com` Enable, Service Accounts `https://console.cloud.google.com/iam-admin/serviceaccounts` create `portfolio-calendar` → email `portfolio-calendar@portfolio-webapp-503319.iam.gserviceaccount.com` + Keys JSON → whole JSON = `GCAL_SERVICE_ACCOUNT_KEY` secret, Calendars create `https://calendar.google.com/calendar/r/settings/createcalendar` `Bookings Alpha` ID `4b32...bf4a0@group` + `Bookings Production` ID `33b9...5847a@group` + personal `Cheng Chen` personal ID `metagtmtest1@gmail.com` via Integrate calendar (click calendar name → Calendar ID, was missing when in General settings), Share with specific people permissions dropdown `See only free/busy (hide details)` for personal privacy, `Make changes and see all event details` for booking (allows create Meet via `conferenceData`), other options `See all event details`, `Make changes (see private as free/busy)`, `Make changes and manage sharing` — chose correct per your screenshot, shared 3 calendars sent
- [x] Wrangler + Dashboard Secrets — PII Handling: Public GitHub must NOT contain `metagtmtest1@gmail.com` + calendar IDs `4b32...`/`33b9...` — `wrangler.toml` now only non-PII vars `ENVIRONMENT` local/alpha/production, `SITE_URL` localhost + `alpha.profile-webapp.pages.dev` + `profile-webapp.pages.dev`, `WORKING_HOURS_START/END`, `WORKING_DAYS`, `SLOT_DURATION_MINUTES` 30 configurable multiple 15 via `normalizeSlotMinutes()` (20→15, 50→45), `EXCLUDE_TODAY` true default assume dont schedule today for all envs, `TIMEZONE` America/New_York Eastern for now configurable admin later via `TIMEZONE` var (future), `TURNSTILE_SITE_KEY` public `0x4AAAAAAD8-3h6x-RUDasMf` (public ok), real calendar IDs + personal email + SA JSON + Turnstile Secret + Resend API Key as Encrypted Secrets via Dashboard (since only Secrets allowed when toml exists: "Environment variables for this project are being managed through wrangler.toml. Only Secrets can be managed via the Dashboard.") — you reported Dashboard does not allow plaintext only secret — correct, so we store all PII as Encrypted Secrets even though not secret, to keep public repo clean, after `wrangler.toml` sync via PR merge to `alpha` you can modify secrets in Dashboard — you did and sync works
- [x] Turnstile: Dashboard `https://dash.cloudflare.com/?to=/:account/turnstile` → Add widget `portfolio-booking` → Hostname Management `0 out of 10` + search + Add Hostnames button → Add `profile-webapp.pages.dev` + `alpha.profile-webapp.pages.dev` valid subdomains (skip wildcard `*.profile-webapp.pages.dev` invalid `Enter a valid domain (e.g. example.com), subdomain (e.g. sub.example.com)` and `localhost`/`127.0.0.1` for STUB local), Mode Managed (or Invisible) → Create → Site Key public `0x4AAAAAAD8-3h6x-RUDasMf` + Secret Key secret → Site key public added to `wrangler.toml` vars public not PII (safe), Secret key as Encrypted Secret `TURNSTILE_SECRET_KEY` for Preview + Production via Dashboard (you added in profile-webapp setting per your note), local dev STUB bypass TDD not blocked when secrets missing
- [x] Resend: `https://resend.com` → API Keys → Create → `re_...` key → stored as Encrypted Secret `RESEND_API_KEY` for Preview + Production via Dashboard (sharing same key okay per your question same key for both preview and prod — yes, 1 key shared across envs like GCal SA JSON and Turnstile secret, 100/day shared free tier, differentiate via FROM `alpha-bookings@...` vs `bookings@...` or subject `[ALPHA]` prefix), Domain verification `bookings@yourdomain.com` via Domains → Add Domain → DNS SPF DKIM in Cloudflare → for MVP without custom domain use test mode `onboarding@resend.dev` only to your own verified `metagtmtest1@gmail.com` without DNS — okay for alpha verification, later verify custom domain for any visitor, How Resend works per your question: not from Gmail, has own email infrastructure (like SendGrid), FROM is your verified domain or onboarding@resend.dev, not Gmail OAuth
- [x] Meet link in invite: Google Calendar event with `conferenceData.createRequest {type: "hangoutsMeet"}` + `conferenceDataVersion=1` + patch description with Meet link + cancel link `/api/cancel/{token}` → Google auto-sends invite with Meet join button + description containing Meet link text + cancel link, plus Resend email also contains same Meet + cancel as backup per your request make Google Meet invite also contain meeting link
- [x] Health endpoint both envs require D1+R2 for both envs: `GET /api/health` checks D1 SELECT 1 + R2 PUT/GET/DELETE → `db:ok r2:ok` for both alpha `30b1ea40...` + R2 alpha and prod `f6dfc0c2...` + R2 prod — you verified via `curl .../api/health | jq .env` → `alpha` string (before you had `no such table: pages` for alpha then prod had `slug home` isolation, fixed via `--env preview` migrations apply → both have home now `Jane Doe...` 6)
- [x] Calendar slots both envs: `GET /api/calendar/slots?weeks=2` returns `weeks, source stub|live, slots[] {date,start,end,available}` no title/summary privacy, cache `max-age=300`, workingHours `slotMinutes 30` multiple 15 configurable, `excludeToday true` from tomorrow, timezone ET `America/New_York` Eastern for now configurable admin later — stub when no secrets (TDD not blocked, mock 144 slots next 14 days from tomorrow), live when secrets set via Dashboard Encrypted for Preview (alpha) + Production (prod) — already shared and verified via `curl .../api/calendar/slots?weeks=2` → weeks 2 source stub/live slots length 144 etc
- [x] UI/UX: Clean UI no debug banners on main (BOLD ENV banner `🚀 BOLD LOCAL ENV — LOCAL ✅ — Slice 1 Content` removed per your request should be in /health endpoint + infra health details removed), icons fixed `w-12 h-12 rounded-xl bg-slate-50 border flex-none` not full-width bar (screenshot 1), About gap-12 lg:gap-16 py-20 no duplicate About pill (screenshot 2), repeated pills removed, buttons `px-7` had no CSS text close to border fixed to `px-8 py-4 leading-none gap-4` + missing utilities `px-7`, `py-3.5`, `inline-flex`, etc, calendar ugly month grid 28-31 buttons + month nav (audit 32%) redesigned to 14-day strip then 3-week Sun-Sat max 3 weeks only 14 selectable 7 per row, dates not within box due to `-mx-2` negative margin + missing `lg:grid-cols-7` fixed, floating text blocking fixed via Home vertical layout calendar top + SlotPicker below expand under not side, interval `9:00 - 9:30` (was only start), Today badge `px-1.5 py-0.5` too close → `px-4 py-1.5` + 30m badge `px-2.5 py-1` → `px-4 py-2`, no close modal → close ✕ button added, privacy note removed, plus latest concerns: exclude today always true, smaller buttons `px-3 py-2.5 text-xs gap-3` no border overlap on hover fix for `5:30-6:00` screenshot thick border overlapping + timezone Eastern America/New_York for now configurable admin later + 30m repeated keep just text per your latest 4 suggestions + premium Tristan CPA accounting firm inspiration (https://www.behance.net/gallery/194615225/Tristan-CPA-An-accounting-firm-website-design) combined with requirements calendar kept, no blog/login per your note you dont have to follow it 100% we can combine with our requirement such as calendar and we dont need blog not login on the screen — we did, premium UI + calendar + no blog/login
- [x] Tests: 42-43 FE (12 files) +53 BE (6 files) =95-96 green via Docker `node:20` bypass proxy `x2pagentd`, build CSS 9.04KB JS 175KB (was 8.76KB 171KB)
- [x] Docs: This `doc/Setup.md` general reproducible guide with GCP + SA + 2 calendars + sharing + PII as Secrets + Turnstile (Hostname Management 0 out of 10 + search + Add Hostnames, wildcard invalid, Site Key public + Secret via Dashboard) + Resend (API Keys dashboard-agnostic, from Gmail or own? Not Gmail, own infrastructure via domain or onboarding@resend.dev, sharing same key okay) + Meet link auto via conferenceData + branch control screenshot Custom alpha only + token fetch, plus `README.md` project overview + status + slices, `DECISIONS.md` D-01..D-32

All setups completed for Slice 0-2 + Slice 3 prerequisites (Turnstile + Resend + GCal + R2). Ready for Slice 3 Booking.
```
