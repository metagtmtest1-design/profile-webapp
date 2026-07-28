# Portfolio Website — Cloudflare Free Tier ($0/month)

Single-page dynamic portfolio with integrated meeting scheduler. 100% Cloudflare free tier — React + Vite frontend, Pages Functions (Workers) backend, D1 SQLite, R2 Object Storage.

**Live URLs:**
- **Prod:** https://profile-webapp.pages.dev — `env:production`, D1 `f6dfc0c2-a7db-4e4a-b2de-abc5926fbf8b`, R2 `portfolio-images` — health `db:ok r2:ok`
- **Alpha:** https://alpha.profile-webapp.pages.dev — `env:alpha`, D1 `30b1ea40-63cd-41ef-84d5-2d9007bea311`, R2 `portfolio-images-alpha` — health `db:ok r2:ok`
- **Health:** `/api/health` → `{status, db, r2, env, checks, diagnostics}`
- **Content:** `/api/content/home` → `{page, sections: [hero, cards-grid, text-block, testimonials, cta-banner, image-gallery]}`
- **Slots:** `/api/calendar/slots?weeks=2` → `{slots[], weeks, source live|stub, workingHours}` — cache bust via `_t`
- **Debug:** `/api/debug/diag` → secrets presence + guidance (no PII leak), `/api/debug/check-calendar?write=true` → tests writer permission (creates/deletes test event)

## Architecture — Slice 0-4 Complete ✅

- **Frontend:** Vite React TS → `dist/` → Pages CDN, proxy `/api` → backend 8788 via `VITE_API_PROXY_TARGET`
- **Backend:** Pages Functions `functions/` — file path = route (dynamic `[slug]` → `params.slug`)
- **DB:** D1 SQLite 5 tables + `pending_bookings` (double opt-in, now unused after revert to immediate), migrations `0001_initial`, `0002_seed` (6 sections 18 items), `0003_double_optin`
- **Storage:** R2 `portfolio-images` / `portfolio-images-alpha`
- **Calendar:** Google Calendar API — 2 booking group calendars alpha `4b32...bf4a0@group` + prod `33b9...5847a@group` (via Secrets), personal `metagtmtest1@gmail.com` (free/busy only), SA `portfolio-calendar@portfolio-webapp-503319.iam.gserviceaccount.com` + OAuth `GOOGLE_OAUTH_*` for real Meet on group calendars
- **Email:** Resend `re_...` + Gmail API fallback via OAuth (`gmail.send` scope) when Resend test mode 403 without custom domain
- **Anti-bot:** Turnstile invisible `0x4AAAAAAD8-3h6x-RUDasMf` public site key, secret encrypted
- **Config:** `wrangler.toml` only `preview`/`production` envs (Pages doesn't support custom `alpha` name), non-PII vars public, PII calendar IDs + secrets as Encrypted Secrets via Dashboard (since Dashboard locks plaintext when toml exists)
- **Env isolation:** Single Pages project `profile-webapp` — Production branch `main` → prod D1/R2, Preview Custom `alpha` only → alpha D1/R2 (full code+data isolation)

### Completed Slices

**Slice 0 — Infra Proof (27→122 tests now)**
- Vite React TS scaffold, `wrangler.toml` preview=alpha + production, `migrations/0001_initial` 5 tables, `functions/api/health` checks D1+R2 both envs, Docker frontend 5173 + backend 8788 (node:20 debian, workerd needs glibc) bypasses host `x2pagentd` proxy 503, CI Node 20 lint/build/test, Pages branch control Production `main` + Preview Custom `alpha` only

**Slice 1 — Portfolio Content + Premium UI (61→60→122 tests)**
- Backend `functions/_lib/content.ts` + `functions/api/content/[slug].ts` `[slug]` → D1 query pages→sections→items ordered/filtered, `max-age=300`, fallback seed for local Miniflare
- Frontend `lib/api.ts` `fetchContent(slug)` + `useContent` hook + 6 sections: Hero (trust badge, Playfair headline, stats bar), CardsGrid (icons `w-12 h-12` not full-width bar bug), TextBlock (About, no duplicate pill), Testimonials (stars), CTABanner (buttons `px-8 py-4` not `px-7` undefined), ImageGallery (hover scale)
- Nav sticky blur, Footer 3-col no blog/login, clean UI (no BOLD ENV banner on main, only at `/health`), seed 6 sections 18 items

**Slice 2 — Calendar Slots (89→95→122 tests)**
- `google-calendar.ts`: `TIMEZONE America/New_York`, `normalizeSlotMinutes()` multiple 15, `parseExcludeToday()` default true (don't schedule today), `getNext14Days` + `getSunday`/`getSaturday` for 3-week Sun-Sat grid max 21 days only 14 selectable, Eastern wall→UTC via `getEasternOffsetHours()`, `getFreeBusy()` SA JWT RS256
- `GET /api/calendar/slots?weeks=2`: configurable `WORKING_HOURS_START/END`, `WORKING_DAYS`, `SLOT_DURATION_MINUTES`, `EXCLUDE_TODAY`, `TIMEZONE`, safeSlots only date/start/end/available (privacy), cache `max-age=300` + `X-Cache`
- Frontend `useCalendar` + `CalendarView` 3-week Sun-Sat 7 per row, Today badge padded `px-4 py-1.5`, SlotPicker interval `9:00-9:30` ET smaller buttons `px-3 py-2.5 text-xs gap-3`, close ✕ button

**Slice 3 — Booking Meeting (core) ✅ (53 FE + 69 BE = 122 green, build 192-195KB)**

- **Turnstile**: Invisible widget `0x4AAAAAAD8-3h6x-RUDasMf` public site key, secret encrypted, real script `challenges.cloudflare.com/turnstile/v0/api.js`. Fixed single-use token (Cloudflare tokens single-use → second booking with same token → 400) via `widgetIdRef` + `resetTurnstile()`, frontend disables Confirm until new token.
- **Booking `POST /api/booking`**: Validation 400, invalid email 400, Turnstile verify, rate limit configurable `BOOKING_MAX_PER_WEEK` (0=disabled, default 3) via `getMaxBookingsPerWeek()` + `isBookingLimitEnabled()` + `BOOKING_LIMIT_ENABLED` flag — currently `0/false` disabled per request, diag at `.../debug/diag → bookingLimit`, FreeBusy race guard past 409 + busy 409, upsert contact, `cancel_token` UUIDv4.
- **GCal event**: `conferenceDataVersion=1` + `createRequest {type: hangoutsMeet, requestId: cancelToken}` → `meetLink`. **Fake Meet fixes via `!!!` logs**: 
  - `forbiddenForServiceAccounts` (SA cannot invite attendees without DWD) → retry without attendees
  - `Invalid conference type value` on group calendars `...@group` via SA → retry bare event without Meet (live event slot blocked) + PATCH attempt, logs `!!! GCAL_CREATE_RETRY_BARE_EVENT`
  - **Purpose fix**: summary `Meeting with X — ${purpose}` + description `Purpose: ${purpose}\nContact...\nDetails...\nCancel...` (was missing)
  - **Unknown sender fix**: SA in group calendar → organizer = group ID → unknown sender; OAuth path creates main event with Meet in **primary** calendar (organizer known `metagtmtest1@gmail.com`) + blocking bare in booking group calendar
  - **DB only after Google 200**: per requirement only record after Google confirms 200 → `!!! BOOKING_ABORT_DB_INSERT` returns 502 if expected live but got stub (was inserting fake)
- **Email**: Resend `api.resend.com/emails` with Meet + cancel + purpose + dateTime ET, `[ALPHA]` prefix. **Resend 403** `onboarding@resend.dev` only to own `metagtmtest1@gmail.com` without custom domain → now Gmail API fallback `sendViaGmail()` via OAuth `GOOGLE_OAUTH_*` with `gmail.send` scope — can send to any email without domain. Custom domain fix: `resend.com/domains` → verify SPF/DKIM TXT in Cloudflare → `EMAIL_FROM=bookings@yourdomain.com` as Encrypted Secret (see Setup.md Sec 16)
- **OAuth real Meet (Option B for personal Gmail, alternative if Gmail domain)**: GCP OAuth client Web app redirect `https://developers.google.com/oauthplayground`, get refresh token `1//04p...` via playground with scopes `calendar` + `calendar.events` + `gmail.send`, store `GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN` as Encrypted Secrets + `.dev.vars` gitignored (never GitHub). Code tries OAuth first `!!! GCAL_TRY_OAUTH_FIRST` → real Meet `https://meet.google.com/xxx` live, fallback to SA bare. Custom domain Workspace alternative: DWD enable + `setSubject('user@yourdomain.com')` impersonation (see Setup.md Sec 15.5, not possible for personal Gmail)
- **Slot disappears fix**: After booking, availability still showed until reload due to 5-min cache → now `api.ts` cache bust `_t=Date.now()` + `no-store` + `useCalendar.removeSlot()` optimistic → slot vanishes immediately, delayed refetch 2s for propagation, logs `!!! USECALENDAR_REMOVE_SLOT`
- **Debug logs**: Added `!!!+message` format across full flow — `BOOKING_REQUEST_RECEIVED`, `TURNSTILE_VERIFY_RESULT`, `FREEBUSY_START/RESULT`, `GCAL_CREATE_START/RESULT`, `EMAIL_START/SUCCESS/FAILED`, `SLOTS_REQUEST_START` etc — view in Cloudflare Workers Logs + browser console
- **Debug endpoints**: `.../debug/diag` → booleans for calendar/email/turnstile/oauth/bookingLimit + guidance, `.../check-calendar?write=true` → tests writer permission creates/deletes test event live
- **Frontend**: BookingForm first/last/email/phone/purpose + Turnstile + validation + duplicate warning Confirm intent? with actual rebook `doBooking(true)` (was only flag), pending UI `Check your email 📧` with confirm link when Resend 403 for testing + purpose included, success `Meeting Confirmed ✅` with .ics download static import fix `require()` crash + cancel meeting button + Book another `px-6 py-3`, interval `9:00-9:30` ET, close X
- **Wrangler**: Non-PII vars public `ENVIRONMENT`, `SITE_URL`, `WORKING_HOURS`, `SLOT_DURATION`, `EXCLUDE_TODAY=true`, `TIMEZONE=America/New_York`, `TURNSTILE_SITE_KEY` + `BOOKING_MAX_PER_WEEK=0` disabled, PII calendar IDs + SA JSON + OAuth + secrets encrypted via Dashboard

**Slice 4 — Cancellation + Confirm ✅**
- `GET /api/cancel/[token]`: `params.token` → DELETE GCal event (primary + booking group) + status cancelled + cache invalidate `X-Cache-Invalidate`, returns HTML + JSON
- `GET /api/booking/confirm/[token]`: For double opt-in Option 1 (implemented in `slice3-14` then reverted to immediate per your final request) — verifies expiry 30min, creates Google event only after click with purpose, inserts only after Google 200, deletes pending, sends final email with Meet+purpose+cancel+.ics

## Quick Start with Docker (Recommended — bypasses host x2pagentd proxy 503)

```bash
# Backend auto-migrates local D1
docker compose up -d --build backend
docker compose logs backend -f  # wait Ready 0.0.0.0:8788

curl http://localhost:8788/api/health | jq . # → {status ok, db ok, r2 ok, env local, diagnostics{...}}
curl http://localhost:8788/api/content/home | jq '.page.slug, (.sections|length)' # → home, 6
curl "http://localhost:8788/api/calendar/slots?weeks=1" | jq . # → weeks 1 source stub|live 80 slots, _t busts cache
curl http://localhost:8788/api/debug/diag | jq . # → booleans, no PII leak

docker compose up -d frontend
open http://localhost:5173
open http://localhost:5173/health # debug only

docker compose down -v
```

### Tests via Docker (no host proxy)

```bash
docker run --rm -v "$PWD":/app -w /app node:20 npm run lint      # tsc --noEmit
docker run --rm -v "$PWD":/app -w /app node:20 npm run build     # dist 0.69KB html + 9KB css + 195KB js
docker run --rm -v "$PWD":/app -w /app node:20 npm test -- --run # FE 14 files 53 tests
docker run --rm -v "$PWD":/app -w /app node:20 npm run test:workers -- --run # BE 9 files 69 tests (122 total)
```

Live local with real GCal + email (safe, .dev.vars gitignored):

```bash
# Create .dev.vars from original SA JSON via jq -c (single line, never commit):
cat ~/Downloads/portfolio-webapp-*.json | jq -c . > /tmp/sa.json
cat > .dev.vars <<EOF
GCAL_SERVICE_ACCOUNT_KEY=$(cat /tmp/sa.json)
BOOKING_CALENDAR_ID=4b320f7127d04517322eed13a69ecb276f4f371ac7684a6c8d10a5c03b5bf4a0@group.calendar.google.com
PERSONAL_CALENDAR_ID=metagtmtest1@gmail.com
RESEND_API_KEY=re_...
TURNSTILE_SECRET_KEY=...
EMAIL_FROM=onboarding@resend.dev
GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-...
GOOGLE_OAUTH_REFRESH_TOKEN=1//04p...
BOOKING_MAX_PER_WEEK=0
BOOKING_LIMIT_ENABLED=false
EOF
docker compose up -d backend
curl "http://localhost:8788/api/debug/check-calendar?write=true" | jq .checks.writeTest # ok:true
```

## Cloudflare Setup — One-time (Docker-wrapped wrangler)

### 1. API Token
- https://dash.cloudflare.com/profile/api-tokens → Create Custom Token → Perms Account: `D1:Edit, R2:Edit, Pages:Edit, Scripts:Edit` + Zone `Workers Routes:Edit` → Copy raw (no Bearer/quotes) → `export CLOUDFLARE_API_TOKEN=...` → verify via Docker `wrangler whoami`

### 2. D1 + R2 (Scripted Idempotent)
```bash
chmod +x scripts/setup-cloudflare.sh
CLOUDFLARE_API_TOKEN=... ./scripts/setup-cloudflare.sh
# Choose alpha+prod → creates D1 alpha 30b1ea40... + prod f6dfc0c2... + R2 portfolio-images-alpha + portfolio-images (needs R2 enabled via Dashboard R2 Overview, card free tier $0)
# Alpha seed needs --env preview flag:
docker run ... wrangler d1 migrations apply portfolio-db-alpha --remote --env preview
```

### 3. Pages Project
- Dashboard → Workers & Pages → Create → Pages → Connect GitHub `metagtmtest1-design/profile-webapp`
- Project `profile-webapp`, Production `main`, Preview Custom `alpha` only (full isolation), Build `npm run build`, Output `dist`, Node 20, vars via `wrangler.toml`, secrets via Dashboard Encrypted (PII calendar IDs + SA JSON + OAuth + Turnstile secret + Resend key)
- Custom domains auto `*.pages.dev` + optional custom

## GitHub PR Flow (Protected — No Direct Commits to Alpha/Main)

Branch naming: `slice# + count + words` e.g. `slice3-16-revert-double-optin` — later contains previous superset, only latest needs PR.

```
slice3-14-double-optin df0fc2c → slice3-15 email fallback 1dede38 → slice3-16 revert c4479b9 (immediate) → alpha 46fd0de PR #29 + main 53cdded PR #30
→ PR vs alpha → CI green → Merge → alpha.profile-webapp.pages.dev → verify .../health, .../debug/diag, .../calendar/slots?weeks=1 live → PR alpha → main → prod
```

## Slice 2-4 — What was done (1-2 sentences)

- **Slice 2 — Calendar Slots:** Built `GET /api/calendar/slots?weeks=2` that returns next 14 days as 3-week Sun-Sat grid (7 per row, 21 max, only 14 selectable from tomorrow due to `EXCLUDE_TODAY=true`), Eastern timezone `America/New_York` with configurable `SLOT_DURATION_MINUTES` multiple 15 and working hours `09:00-17:00` Mon-Fri, SA JWT free/busy for booking + personal calendars, frontend `CalendarView` + `SlotPicker` with interval `9:00-9:30` ET and close button.
- **Slice 3 — Booking Meeting:** Implemented `POST /api/booking` with Turnstile invisible anti-bot (single-use token reset fix), duplicate warning + confirm actually rebooks, FreeBusy race guard, upsert contact, Google Calendar event with 3-step retry for fake Meet (`forbiddenForServiceAccounts` without DWD + `Invalid conference type` on group calendars via SA) to bare live event + OAuth real Meet via `GOOGLE_OAUTH_*` in primary calendar (fixes unknown sender), purpose in summary `— ${purpose}` + description `Purpose:`, Resend 403 fallback to Gmail API, DB only after Google 200, max per week disabled via env, slot optimistic removal + cache bust, `!!!` logs + debug endpoints `diag` + `check-calendar`.
- **Slice 4 — Cancellation + Confirm:** Added `GET /api/cancel/[token]` and `GET /api/booking/confirm/[token]` — cancel deletes Google event (primary + booking group) + status cancelled + `X-Cache-Invalidate`, confirm creates event only after email click for double opt-in Option 1 (now reverted to immediate per final request but code kept).

## Next Slices — Slice 0-4 Complete ✅

- **Slice 5:** Materials `POST /api/materials/lookup` email → Drive URL — next (requires Drive OAuth + `GOOGLE_OAUTH_*` already)
- **Slice 6:** Admin Edit — `upload-image` R2 + sections/items CRUD/reorder + `auth.ts` + `ADMIN_BYPASS` dev flag
- **Slice 7:** Admin Bookings — list JOIN + resend + cancel + purpose display
- **Slice 8:** Admin Contacts + Drive — ?email= filter + PATCH drive URL validation, full E2E
- **Slice 9:** Polish + SEO + OG + perf headers + responsive final + error boundaries

See `doc/Setup.md` Sec 15-16 for Google project creation with calendar scopes + OAuth Playground refresh token + personal Gmail vs Workspace custom domain + Resend custom domain.

## TDD Notes

Docker for all (bypasses `x2pagentd` 503), tests co-located `**/*.test.*`, stub mode `STUB=true`, Branch naming superset chain.

## Troubleshooting

- **R2 10042:** Enable via Dashboard R2 Overview (card free tier $0)
- **wrangler.toml env.alpha not supported:** Pages only preview/production — use preview for alpha
- **Branch not selectable:** Needs successful deployment first
- **Host proxy x2pagentd 443 No route:** Use Docker for npm + wrangler
- **Invalid uuid placeholder:** Replace with real IDs from `d1 create`, script auto-updates
- **no such table: pages locally:** Backend runs `d1 migrations apply DB --local` before dev, plus fallback seed
- **Buttons px-7 no CSS:** Fixed to px-8 py-4, Today badge px-4 py-1.5, SlotPicker px-3 py-2.5 no overlap
- **Turnstile verification failed after confirm:** Tokens single-use → reset via widgetIdRef
- **Fake Meet fake-xxxx:** SA cannot attendees without DWD 403 + group calendar 400 invalid type → retry bare + OAuth primary calendar
- **Resend 403 only to own email:** Verify domain at resend.com/domains + EMAIL_FROM secret, or Gmail fallback via OAuth gmail.send scope
