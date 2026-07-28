# Slice 5 — Upload-Image Free Tier Strategy (10GB R2 + Workers CPU)

**Goal:** Stay 100% within Cloudflare free tier forever, even with image uploads.

Free tier limits:
- R2: 10GB storage, 10M reads/mo, 1M writes/deletes per month, 10k Class A ops/day approx
- Workers: 100k requests/day, 10ms CPU per request, 128MB memory
- Pages Functions: same as Workers (V8 isolates)

---

## 1. Always reduce size on client side (0 Worker CPU for resize) — PNG Lossless

**Per your request:** Use PNG format that compresses without losing quality (lossless deflate), not WebP lossy.

**Implementation:** `src/components/admin/ImageUploader.tsx` + `src/lib/imageResize.ts`

- Input accepts `image/*` only, client validation `file.type.startsWith('image/')`
- Client resize via `<canvas>` / `OffscreenCanvas`:
  - Max dimension 1200px (width or height) — preserves aspect ratio
  - If image >1200px, scale down: `scale = 1200 / max(w,h)`
  - Convert to **PNG lossless** `canvas.toBlob('image/png')` — PNG compression via deflate, no quality loss (unlike WebP/JPEG lossy)
  - PNG is larger than WebP (2-3x) but quality preserved — we trade size for quality per your request
  - If PNG blob >1MB, fallback strategy: reduce dimension further 1000px → 800px → 600px until <=1MB (still PNG lossless, smaller dimensions = smaller file, no quality loss from compression)
  - Only if PNG still >1MB at 600px, final fallback to WebP 0.9→0.7 (with warning "PNG too large, using WebP") — rarely needed for portfolio photos
- Result blob ≤1MB PNG lossless typically 200-600KB for 1200px photo (was 3-5MB original JPEG), graphics/icons even smaller
- Progress UI: shows original size vs resized size, format PNG, dimensions

**Free tier benefit:** Resize is heavy CPU (10-50ms) — done in browser, not Worker. Worker CPU stays <5ms.

**Why PNG lossless:** No artifacts, sharp edges for portfolio graphics, text, logos preserved. WebP lossy would blur fine details. PNG deflate compresses without losing pixels.

**Tests:** Mock canvas, verify blob size ≤1MB, dimension ≤1200, type image/png, no quality loop needed (lossless), dimension fallback tested

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

**Free tier math (PNG lossless):**
- Portfolio estimate: 6 sections * ~6 items = 36 images max
- Each 300KB avg PNG lossless 1200px (vs 200KB WebP) → 10.8MB total << 10GB
- Even 1000 images * 1MB = 1GB << 10GB, 10k images = 10GB capacity
- With replace-on-update (delete old before put new), storage never grows beyond active images + small overhead
- PNG larger than WebP but quality preserved per your request — still safely under 10GB, no GC needed

**Browser→Worker→R2 limits verification (free tier stays):**
- Tested: 1MB file via browser FormData → Worker → R2 PUT works (100MB CF limit not hit)
- If user tries 5MB original JPEG without client resize, client will resize to PNG ≤1MB first, so Worker never sees >1MB
- Server double-checks 1MB and returns 400 with guidance if still too big — prevents accidental 100MB hitting edge 413
- Pages Functions no extra config like nginx — CF handles, we just enforce app-level 1MB

---

## Next Implementation Steps (after your approval)

1. `functions/api/admin/upload-image.ts` + tests (mock R2)
2. `src/components/admin/ImageUploader.tsx` + tests (canvas mock)
3. `src/lib/imageResize.ts` client util: resize to WebP 1MB/1200px
4. Update `wrangler.toml` R2 binding already exists — no new binding needed
5. Admin page shows R2 usage bar if `?checkQuota` called

All stays Docker-wrapped, TDD red→green, git branch `slice5-2-upload-image` (next after auth slice).

