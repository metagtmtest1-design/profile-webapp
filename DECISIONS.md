# Portfolio Website — Architectural Decisions Log

Reference this for future context. Each decision includes rationale and date.

| # | Category | Decision | Rationale | Date |
|---|----------|----------|-----------|------|
| D-01 | Hosting | Entirely Cloudflare free tier (Pages, Functions, D1, R2, Access, Turnstile) | $0/month, 330+ edge, <2s global | 2026-07-16 |
| D-02 | Frontend | React + Vite + TypeScript, no Next.js | Pages optimized for static SPA + Functions | 2026-07-16 |
| D-03 | Backend | Pages Functions (Workers), TS, V8 isolates <10ms CPU | Co-located with Pages, cold start <5ms | 2026-07-16 |
| D-04 | Database | D1 SQLite, 5 tables: pages, sections, section_items, contacts, bookings | Free tier, relational, edge-replicated | 2026-07-16 |
| D-05 | Content Model | pages 1—N sections 1—N section_items, types: hero, cards-grid, testimonials, text-block, cta-banner, image-gallery | Flexible single-page sections | 2026-07-16 |
| D-06 | Images | R2 + client-side resize: WebP max 1MB/1200px, 1yr cache | Saves storage/bandwidth | 2026-07-16 |
| D-07 | Calendar | GCal API via Service Account, 2 calendars: BOOKING + PERSONAL free/busy only | No OAuth dance, privacy | 2026-07-16 |
| D-08 | Slot Computation | Working hours 09-17 Mon-Fri via vars, 30min slots, subtract FreeBusy, Workers Cache 5-min TTL | Mitigates rate limit | 2026-07-16 |
| D-09 | Meet Links | Auto via conferenceData.createRequest { type: hangoutsMeet } | Zero extra service | 2026-07-16 |
| D-10 | Booking Race Guard | Final FreeBusy re-check before D1 insert | Prevent double-book | 2026-07-16 |
| D-11 | Cancel = DELETE | DELETE GCal event (not decline), invalidate cache | Decline leaves slot blocked | 2026-07-16 |
| D-12 | Cancel Token | UUID v4, one-time use, bookings table | Secure, guess-proof | 2026-07-16 |
| D-13 | Email | Resend 100/day, SPF/DKIM, plus GCal auto-invite | Free adequate | 2026-07-16 |
| D-14 | Admin Auth | Cloudflare Access Zero Trust Google OAuth allowlist, edge-intercept | No auth code | 2026-07-16 |
| D-15 | Anti-Bot | Turnstile invisible + D1 3/email/week + same-week confirm prompt | Defense in depth | 2026-07-16 |
| D-16 | Materials | Shared Drive Contributor (view+add), same folder, lookup email→drive_folder_url | Simple sharing | 2026-07-16 |
| D-17 | Caching | Workers Cache 5-min content+calendar, R2 max-age=31536000, CPU ~2ms | 300-500ms ideal | 2026-07-16 |
| D-18 | Development | Vertical slicing by workflow, each independently testable, infra proof first | Demo-able increments | 2026-07-16 |
| D-19 | Deployment | GitHub → Cloudflare Pages Git integration, PR=preview, alpha branch=alpha env, main=prod | Zero manual publish, preview per PR | 2026-07-16 |
| D-20 | TDD | Vitest + Testing Library + jsdom (FE), Vitest node env (BE, mocks D1/R2), STUB=true for external, LIVE_INTEGRATION flag | TDD never blocked, bypasses host proxy via Docker node:20 | 2026-07-16 |
| D-21 | Alpha Env | Separate alpha branch → alpha.profile-webapp.pages.dev custom domain via Branch control Custom alpha only (screenshot), own D1/R2 (portfolio-db-alpha ID 30b1ea40-63cd-41ef-84d5-2d9007bea311), Production main → profile-webapp.pages.dev own D1/R2 prod ID f6dfc0c2-a7db-4e4a-b2de-abc5926fbf8b | Safe testing before prod, full isolation code+data (not just data), single project with Custom alpha only, not All non-prod | 2026-07-18 |
| D-22 | Out-of-Scope | No multi-lang, no blog/rich editor, no payments, no visitor accounts, no login | MVP focus, portfolio single-page, no blog/login on screen per requirement | 2026-07-16 |
| D-23 | Wrangler.toml | Only preview/production envs supported by Pages (not custom alpha name), preview holds alpha DB+R2+ENV alpha, production holds prod DB+R2+ENV production, top-level vars not inherited so duplicate, pages_build_output_dir = dist, functions/ exact name required | Fixed build error configuration file contains env names not supported: alpha, Pages reads only preview/production | 2026-07-18 |
| D-24 | R2 Active | R2 initially blocked by Please enable R2 [10042] needs billing, made optional r2:skipped 200 OK workaround for Slice 0, after activation via Dashboard R2 Overview Enable, uncomment R2 buckets in wrangler.toml, health now requires both D1+R2 for both envs (alpha R2 portfolio-images-alpha and prod R2 portfolio-images) → db:ok r2:ok | R2 Object Storage free tier 10GB active | 2026-07-19 |
| D-25 | Functions Naming | functions/ folder at root auto-detected as Pages Functions (no config, typo fucntions not treated), file path = URL via functions/api/content/[slug].ts:14 params.slug → /api/content/:slug, POST body via request.json() and both path param + body allowed params.id + request.json() | Convention, no router config needed | 2026-07-22 |
| D-26 | UI/UX | Clean UI — no debug banners on main page (BOLD LOCAL/ALPHA/PROD banner moved to /health UI + /api/health JSON), no infra health details in Home, icons fixed w-12 h-12 rounded-xl bg-slate-50 border flex-none not full-width bar (screenshot 1), About spacing gap-12 lg:gap-16 py-20 items-center, remove redundant About pill repeated (screenshot 2), repeated pills across sections removed, buttons px-7 had no CSS text close to border fixed to px-8 py-4 leading-none gap-4 breathing room, mobile friendly sm:grid-cols-2 lg:grid-cols-3 + Nav flex-wrap, user-friendly copy Services coming soon etc, calendar placeholder premium no raw API path, premium Tristan CPA accounting firm inspiration (Playfair Display, navy slate-900, rounded-2xl, shadows) combined with our requirements per user note: calendar kept, no blog/login on screen | >90% user-friendly, professional conversion-focused | 2026-07-23 |
| D-27 | Branch Naming | slice# + commitcount + few words e.g. slice1-1-portfolio-content, slice1-2-ui-polish, slice1-3-clean-ui, slice1-4-premium-ui, slice1-5-button-fix — each later contains previous (superset), so only latest needs PR | Per convention for PR tracking | 2026-07-23 |

## Environments — Final (Isolated)

| Branch | Domain (CF Pages) | D1 ID | R2 Bucket | Purpose | Branch Control |
|--------|-------------------|-------|-----------|---------|----------------|
| `slice/*` feature (e.g. `slice1-5-button-fix`) | `<hash>.profile-webapp.pages.dev` if Preview All non-prod, none if Custom alpha only | `portfolio-db-alpha` or `portfolio-db-preview` shared for dev | `portfolio-images-alpha` or `portfolio-images-preview` | Dev per PR, isolated, only builds if Preview All non-prod, not when Custom alpha only | Preview: Custom `alpha` only → feature branches don't preview (full isolation), All non-prod → they do |
| `alpha` | `alpha.profile-webapp.pages.dev` | `portfolio-db-alpha` ID `30b1ea40-63cd-41ef-84d5-2d9007bea311` ENAM, 6 sections 18 items seeded via 0002_seed.sql | `portfolio-images-alpha` | QA before prod, client verification, clean premium UI no debug, icons fixed, About spaced, buttons px-8 py-4 | Preview env: `ENVIRONMENT=alpha`, `SITE_URL=https://alpha.profile-webapp.pages.dev`, D1 alpha, R2 alpha |
| `main` | `profile-webapp.pages.dev` | `portfolio-db` ID `f6dfc0c2-a7db-4e4a-b2de-abc5926fbf8b` ENAM, same seed | `portfolio-images` | Production, clean, no bold debug (only at /health) | Production env: `ENVIRONMENT=production`, `SITE_URL=https://profile-webapp.pages.dev`, D1 prod, R2 prod |

**Setup via:** `scripts/setup-cloudflare.sh` idempotent, prompts `CLOUDFLARE_API_TOKEN`, options `alpha/prod/alpha+prod/all` (prod-only fixed), creates D1 list reuse via regex, R2 bucket create (needs R2 enabled via Dashboard), migrations apply --local/--remote for 0001_initial + 0002_seed, updates `wrangler.toml` IDs via Python (fixes multiline bug, top-level DB ID)

**Branch Control Screenshot (Important):**

Production branch: `main` Enable automatic prod deployments ON
Preview branch: Custom branches `alpha` only — only alpha gets preview, not all feature branches — full isolation code+data (Option B within single project)

## External Services Multi-Env — Final

- **GCal SA:** 1 SA shared across envs, 3 calendars (prod/alpha/preview booking) isolated via BOOKING_CALENDAR_ID var (preview=alpha-booking, prod=prod-booking), PERSONAL shared free/busy only
- **Resend:** 1 key, 1 domain verified SPF/DKIM, same key across envs, FROM differs or subject prefix `[ALPHA]` for alpha vs prod
- **Turnstile:** 1 widget allowed hosts `profile-webapp.pages.dev, alpha.profile-webapp.pages.dev, *.pages.dev`, same site/secret keys, anti-bot invisible on booking
- **Access:** 2 Zero Trust apps for `/admin/*` on prod + alpha (admin `profile-webapp` and `profile-webapp-alpha` if 2 projects, or same project with path rules), Google OAuth allowlist your email

## Current Status — Slice 1 ✅ Complete (Premium UI)

- **Deployed:** Prod `profile-webapp.pages.dev` and Alpha `alpha.profile-webapp.pages.dev` both have health `db:ok r2:ok` required for both envs (after R2 activation, R2: ok you saw in alpha)
- **Content:** `GET /api/content/home` returns page home Jane Doe title + 6 sections ordered hero (Welcome to My Portfolio), services 6 cards Brand Strategy etc with icons, about Jane Doe + photo, testimonials 3 with stars, CTA Let’s build together + Book a Call, gallery 6 images — 18 items total, filtered visible, ordered sort, cached 5-min `max-age=300`, fallback seed for local no-table quirk
- **Frontend:** Premium UI inspired by Tristan CPA accounting firm (Behance: https://www.behance.net/gallery/194615225/Tristan-CPA-An-accounting-firm-website-design) + Nicepage branding template, combined with requirements per user note: calendar kept (premium card pulse dot, no raw API path), no blog/login on screen, clean no debug banners on main (only at `/health` UI), icons fixed w-12 h-12 not bar, About gap-12 no pill, buttons px-8 py-4 breathing room (fixed px-7 undefined bug)
- **Tests:** 29 FE (App 5 clean UI no debug, api 8 health 5 + content 3, useContent 4, Hero 2, CardsGrid 2, TextBlock 2, Testimonials 2, CTABanner 2, Gallery 2) + 31 BE (env 10, health 8 both alpha+prod require D1+R2, content lib 4, content endpoint 9) = **60 tests green** via Docker `node:20`, build CSS 8.76KB JS 166KB (was 26, 27, 29, 61 intermediate)
- **Local:** Docker Compose frontend 5173 + backend 8788 with auto migrations apply DB --local before pages dev, content home 6 sections, health local db ok r2 ok
- **Docs:** `doc/Setup.md` general reproducible setup guide (not project status, 12KB 13 sections) with token fetch Custom Token example summary, D1+R2 script idempotent, branch control screenshot Custom alpha only, Functions naming conventions file:line, Docker workaround, protected branches, isolated-git-env, plus root README project overview + status + per-PR checklist, this DECISIONS.md updated to D-27

Next: Slice 2 Calendar Slots `GET /api/calendar/slots` — Service Account JWT + FreeBusy + slot computation + cache + stub

