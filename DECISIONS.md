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
| D-20 | TDD | Vitest + @cloudflare/vitest-pool-workers, STUB=true for external, LIVE_INTEGRATION flag | TDD never blocked | 2026-07-16 |
| D-21 | Alpha Env | Separate alpha branch → alpha.somewebsite.com custom domain, own D1/R2 (portfolio-db-alpha) | Safe testing before prod | 2026-07-16 |
| D-22 | Out-of-Scope | No multi-lang, no blog/rich editor, no payments, no visitor accounts | MVP focus | 2026-07-16 |

## Environments

| Branch | Domain | D1 | R2 | Purpose |
|--------|--------|-----|-----|---------|
| `slice/*` PR | `<hash>.portfolio-site.pages.dev` | `portfolio-db-preview` | `portfolio-images-preview` | Dev per PR |
| `alpha` | `alpha.somewebsite.com` | `portfolio-db-alpha` | `portfolio-images-alpha` | QA before prod |
| `main` | `somewebsite.com` | `portfolio-db` | `portfolio-images` | Production |

## External Services Multi-Env

- **GCal SA:** 1 SA shared across envs, 3 calendars (prod/alpha/preview booking) isolated via BOOKING_CALENDAR_ID var
- **Resend:** 1 key, 1 domain, same key across envs, FROM differs or subject prefix [ALPHA]
- **Turnstile:** 1 widget with allowed hosts `somewebsite.com, alpha.somewebsite.com, *.pages.dev`, same keys
- **Access:** 2 Zero Trust apps for `/admin/*` on prod + alpha, same allowlist email
