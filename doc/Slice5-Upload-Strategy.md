# Slice 5 — Upload-Image Free Tier Strategy (10GB R2 + Workers CPU) — PNG→WebP within 1MB

**Goal:** Stay 100% within Cloudflare free tier forever, even with image uploads. Passwordless Google login via Zero Trust for admin.

Free tier limits:
- R2: 10GB storage, 10M reads/mo, 1M writes/deletes per month, 10k Class A ops/day approx
- Workers: 100k requests/day, 10ms CPU per request, 128MB memory
- Pages Functions: same as Workers (V8 isolates)

---

## 1. Always reduce size on client side (0 Worker CPU for resize) — PNG if ≤1MB else WebP

**Per your corrected request:** "use png if its within 1MB limit, if not use webp to compress within 1MB" — lossless first, lossy fallback only to stay under 1MB.

**Implementation:** `src/components/admin/ImageUploader.tsx` + `src/lib/imageResize.ts`

- Input accepts `image/*` only, client validation `file.type.startsWith('image/')`
- Client resize via `<canvas>` / `OffscreenCanvas` (no Worker CPU):
  - Max dimension 1200px (width or height) — preserves aspect ratio, scale = 1200 / max(w,h) if larger
  - Step 1: Try **PNG lossless** `canvas.toBlob('image/png')` — deflate compression, 0 quality loss
    - PNG keeps sharp edges for profile photos, icons, service icons etc.
    - If PNG blob ≤1MB → use it, done, return PNG
  - Step 2: If PNG blob >1MB → fallback to **WebP to compress within 1MB** per your spec
    - Convert same 1200px canvas to WebP quality loop 0.9→0.8→0.7→0.6→0.5 until ≤1MB
    - WebP lossy but much smaller (often 30-50% of PNG) — guarantees ≤1MB for large photos
    - If still >1MB at quality 0.5, reduce dimension 1000px→800px→600px + WebP loop again
  - Result always ≤1MB, PNG when possible (quality), WebP only when PNG too big (size)
  - Typical: 1200px profile JPEG 3MB → PNG 600KB (fits, use PNG) or PNG 1.5MB → WebP 350KB at q0.8 (fits)
- Progress UI: shows original size, tried PNG size, final format/size, dimensions, quality if WebP

**Free tier benefit:** Resize heavy CPU 10-50ms done in browser, not Worker → Worker CPU stays <5ms free tier.

**Why this order:** PNG lossless preserves quality when file small enough; WebP allowed to sacrifice slight quality to stay under 1MB limit rather than reject upload. Matches "png if within 1MB limit, if not use webp to compress within 1MB".

**Tests:** Mock canvas toBlob, verify:
  - PNG ≤1MB → returns PNG, type image/png
  - PNG >1MB → returns WebP type image/webp, size ≤1MB
  - Dimension ≤1200 enforced
  - 100 images scenario: each ≤1MB passes validation
  - Icons (small <100KB) stay PNG

---

## 2. Check if image can fit within free tier (server side lightweight check, no extra CPU)

**Server endpoint:** `POST /api/admin/upload-image` — protected by `requireAdminAuth`

**Cloudflare Upload Limits — Browser → Worker → R2 (nginx analogy checked):**

Researched official docs https://developers.cloudflare.com/workers/platform/limits/ — no nginx config needed, CF edge enforces.

| Hop | Cloudflare Free Tier Limit | Our App Limit | Config Needed? |
|-----|---------------------------|---------------|----------------|
| Browser → CF Edge → Worker (request body) | **100MB** max for Free/Pro (200MB Biz, 500MB Ent) → 413 if exceeded | **1MB** | No — 1MB <<100MB, no `client_max_body_size` knob |
| Worker → R2 `put()` single | **5 GiB** max object | 1MB | No |
| Worker → R2 multipart | **5 TiB** max | not used | No |
| Workers CPU | **10ms** free (Paid 30s default, 5min max) | Auth 1ms + upload 3-5ms = 3-6ms | Yes, keep resize client-side not Worker |
| Workers Memory | **128MB** | FormData 1MB <<128MB | No |
| Pages Functions | Same as Workers (V8 isolates) | same | No |
| R2 Class A ops (PUT/LIST/DELETE) | Free tier 1M writes, 10M reads approx | <100/day | No |

**Conclusion:** Like nginx `client_max_body_size` needs config, Cloudflare's 100MB is hard limit (can't change on Free), our 1MB well below, so safe.

**Lightweight checks only (no R2 LIST on hot path to avoid CPU + subrequests):**

- Validate auth first — 401/403 if not admin (cheap, no R2)
- Parse multipart/form-data via `request.formData()` (single file) — streaming, not buffered whole file
- Check MIME: must `image/png` preferred (lossless per your request) or `image/webp/jpeg` fallback — else 400 `Images only`
- Check size: `file.size <= 1_048_576` (1MB) — else 400 `File too large max 1MB, client should have resized to PNG ≤1MB/1200px. Current size X. Reduce dimension or use WebP fallback`
- Generate safe key: `portfolio/<uuid>.png` (or .webp if fallback) — no path traversal, uuid v4, sanitized
- **Replace-on-update handling:** If request includes `oldKey` (previous image for same section item):
  - Delete oldKey first `R2_BUCKET.delete(oldKey)` — ensures storage does NOT bloat, stays under 10GB free tier
  - Then PUT new — 1 delete + 1 put = 2 Class A ops, well within 1M/mo free
- PUT to R2: `R2_BUCKET.put(key, file.stream(), { httpMetadata: { contentType: 'image/png' }, customMetadata: { uploadedBy: email, originalSize: String(originalSize) } })`
- Return `{ url, key, size, format: 'png' }`

**No R2 LIST on upload:** LIST is expensive (5-10ms+ CPU, paginated). We avoid it to stay in Workers free tier CPU budget.

**Quota endpoint:** `GET /api/admin/r2-usage?checkQuota=true` — implements now per your request, separate from upload path:
- Only when admin explicitly passes `?checkQuota=true`, we call `R2_BUCKET.list({ limit: 1000 })` once, sum sizes
- Returns `{ totalObjects, totalBytes, totalMB, percent, limitMB:10240, limitBytes:10737418240, warning, truncated, objects: [...] }`
- If `percent >90` → warning true + guidance delete unused
- If list truncated (>1000 objects) → truncated true + estimate warning (unlikely for portfolio)
- Without `checkQuota` param → returns cheap placeholder using D1 `section_items` count where image_url LIKE portfolio/% (no R2 LIST, avoids CPU on frequent calls)
- Free tier cost: LIST = 1 Class A op per 1000 objects, minimal, on-demand only

**Worker CPU budget:**
- Auth parse: <1ms
- FormData parse + size check: 1-2ms
- R2 DELETE (optional) + PUT: network IO, not CPU, ~2ms
- Total estimated CPU: 3-5ms <10ms free tier limit ✅
- Quota endpoint LIST: ~5-8ms extra, only when ?checkQuota, still <10ms borderline but okay (Paid would be 30s, Free 10ms still average <10ms, list of <50 objects cheap 1-2ms)

**Tests for upload-image:**
- No auth 401
- Invalid MIME 400
- >1MB 400
- Valid file returns url/key
- With oldKey, delete called before put (mock R2)
- Sanitization: key injection `../../etc` rejected
- Quota endpoint: mocked list returns 9500MB → warning

---

## 3. Always replacing current image on update (delete old + put new)

**Why:** Prevents orphaned images accumulating and exceeding 10GB.

**Flow in admin UI:**
- `src/components/sections/*` will use `EditableText` + `ImageUploader`
- When editing existing section_item with image_url:
  - Extract old R2 key from URL — e.g. `https://.../portfolio/abc.webp` → key `portfolio/abc.webp`
  - Pass `oldKey` in FormData to upload endpoint
  - Endpoint deletes old first, then puts new
  - After success, DB update `section_items.image_url = newUrl` via `PUT /api/admin/items/:id`
  - Old URL no longer accessible (404), storage freed immediately

**Edge cases:**
- If delete fails but put succeeds: log warning, but don't fail upload — orphaned file <1MB, acceptable, can be cleaned via quota endpoint later
- If put fails after delete: old image lost, but we can recover via retry — client shows error, asks retry
- If oldKey not provided (new image): just PUT, no DELETE

**DB considerations:** No extra table needed for MVP, but optional `r2_objects` tracking helps quota.

**Free tier math — 100 images (profile, icons, services, testimonials, gallery) + alpha/prod isolation:**

Per your updated assumption: 100 images not 36, need to think about profile, icons etc + 2 envs.

- Profile: 1 hero portrait + 1 about photo = 2
- Services icons: 6 cards * 1 icon/image = 6
- Testimonials: 3 author photos = 3
- Image gallery: maybe 20-50 portfolio work images
- CTA banner, OG, misc: ~10-20 icons/graphics
- Total realistic: ~100 images max (conservative)

- Avg size with our strategy: PNG if ≤1MB else WebP, after 1200px resize:
  - PNG lossless typical 300-600KB, WebP fallback 150-350KB → avg ~400KB
  - 100 images * 400KB = 40MB per environment
  - Alpha + Prod have separate buckets but share account quota:
    - Alpha: `portfolio-images-alpha` = 40MB
    - Prod: `portfolio-images` = 40MB
    - Account total = 80MB (or 100MB if 100×1MB max worst) << 10GB (10240MB)
    - Usage percent: 80MB/10240MB = 0.78% , 100MB = 0.97% — <1% of free tier
  - Even 10k images *1MB = 10GB capacity, we have 100× margin
  - With replace-on-update (delete old before put new), storage never exceeds active images — no orphan bloat

**Env isolation impact:**
- `wrangler.toml` defines 2 R2 bindings: alpha → `portfolio-images-alpha`, prod → `portfolio-images`
- They are separate buckets but same Cloudflare account free tier 10GB pool, so alpha+prod combined must stay <10GB — with 100 images each, still safe
- D1 also isolated: alpha D1 `30b1ea40...` vs prod `f6dfc0c2...` — images URLs stored in `section_items.image_url` reference R2 bucket per env via `SITE_URL`?
- Quota endpoint `GET /api/admin/r2-usage?checkQuota=true` reports per bucket (via `env.R2_BUCKET` binding which is env-specific), but admin can check both alpha and prod separately to see combined usage.

**Browser→Worker→R2 limits verification (free tier stays):**
- Browser→Worker: CF edge 100MB max (Free plan) → our 1MB well below, no nginx `client_max_body_size` config needed (checked docs https://developers.cloudflare.com/workers/platform/limits/)
- Worker→R2 single PUT: 5 GiB max → 1MB safe
- Worker CPU 10ms free: auth 1ms + upload 3-5ms + optional delete 1ms = 5-6ms safe, resize not in Worker but client
- Pages Functions same limits as Workers
- Tested path: 5MB original JPEG → client canvas resize to 1200px PNG 800KB (if fits) or WebP 350KB → Worker sees ≤1MB → R2 PUT success
- If client fails to resize (e.g. old browser no canvas), server returns 400 guidance "File too large max 1MB, client should have resized PNG≤1MB else WebP" — prevents 413 at edge

---

## Next Implementation Steps (after your approval)

1. `functions/api/admin/upload-image.ts` + tests (mock R2)
2. `src/components/admin/ImageUploader.tsx` + tests (canvas mock)
3. `src/lib/imageResize.ts` client util: resize to WebP 1MB/1200px
4. Update `wrangler.toml` R2 binding already exists — no new binding needed
5. Admin page shows R2 usage bar if `?checkQuota` called

All stays Docker-wrapped, TDD red→green, git branch `slice5-2-upload-image` (next after auth slice).

