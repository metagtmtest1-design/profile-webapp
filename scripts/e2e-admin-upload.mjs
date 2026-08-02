/**
 * Live check of the admin Hero upload flow against the running dev stack.
 * Run: docker run --rm -v "$PWD":/app -w /app mcr.microsoft.com/playwright:v1.50.0-noble \
 *        node scripts/e2e-admin-upload.mjs
 */
import { chromium } from 'playwright'
import { HERO_PNG } from '/app/scripts/lib/testPng.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL || 'http://host.docker.internal:5173'
const OUT = '/app/tmp-e2e'
mkdirSync(OUT, { recursive: true })

// 8×8 red PNG
// A real 1200x900 PNG. An 8x8 fixture is smaller than any slot the site renders, and
// the uploader now refuses undersized images for exactly that reason.
const PNG = HERO_PNG

const results = []
const record = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const consoleErrors = []
page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))

await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
await page.waitForSelector('text=Admin', { timeout: 15000 })

// 1 — hero renders exactly one file input and one upload target
const heroSection = page.locator('div').filter({ hasText: /hero #/ }).first()
const inputCount = await page.locator('input[type="file"]').count()
const heroTarget = page.getByRole('button', { name: /replace hero image|upload hero image/i })
record('hero exposes a single upload control', (await heroTarget.count()) === 1, `${await heroTarget.count()} control(s)`)

// 2 — the file input is not display:none (Safari refuses to open the picker on those)
const inputHidden = await page.locator('input[type="file"]').first().evaluate((el) => getComputedStyle(el).display)
record('file input is not display:none', inputHidden !== 'none', `display=${inputHidden}`)

// 3 — clicking the hero image opens the OS file chooser
let chooserOpened = false
page.on('filechooser', () => { chooserOpened = true })
const chooserPromise = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null)
await heroTarget.click()
const chooser = await chooserPromise
record('clicking hero image opens the file picker', Boolean(chooser) || chooserOpened)

await page.screenshot({ path: `${OUT}/01-admin-hero.png`, fullPage: false })

// 4 — a real upload round-trips to R2 and the preview updates
const heroInput = page.locator('input[type="file"]').first()
if (chooser) await page.keyboard.press('Escape')
const uploadResponse = page.waitForResponse((r) => r.url().includes('/api/admin/upload-image'), { timeout: 20000 })
await heroInput.setInputFiles({ name: 'test-hero.png', mimeType: 'image/png', buffer: PNG })
const resp = await uploadResponse.catch(() => null)
const body = resp ? await resp.json().catch(() => null) : null
record('upload-image returns 200 with a key', resp?.status() === 200 && Boolean(body?.key), JSON.stringify(body))

// 5 — the uploaded image is actually served back from R2 (not blank)
if (body?.url) {
  const img = await page.request.get(`${BASE}${body.url}`)
  const bytes = (await img.body()).length
  record('uploaded image is retrievable and non-empty', img.status() === 200 && bytes > 0, `${img.status()} ${bytes}B`)
}

// 5b — the new URL is persisted to the database, not just uploaded to R2
if (body?.url) {
  await page.waitForTimeout(800)
  const content = await (await page.request.get(`${BASE}/api/admin/content`)).json()
  const heroItem = content.sections?.find((s) => s.type === 'hero')?.items?.[0]
  record('new image URL is saved to the database', heroItem?.image_url === body.url, heroItem?.image_url)
}

// 6 — success feedback is shown to the user
await page.waitForTimeout(1200)
const uploadedNotice = await page.getByText(/Uploaded ✓/).count()
record('shows upload confirmation', uploadedNotice > 0)

// 7 — no leftover free-tier / spec noise anywhere on the page
const text = await page.locator('body').innerText()
const noise = ['1MB max', 'max 1200px', '10GB', '80MB combined', 'No image', 'Select image to upload']
const found = noise.filter((n) => text.includes(n))
record('no free-tier or spec noise in the UI', found.length === 0, found.join(' | '))

await page.screenshot({ path: `${OUT}/02-after-upload.png`, fullPage: true })

// 8 — mobile layout
await page.setViewportSize({ width: 393, height: 852 })
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/03-mobile.png`, fullPage: true })
record('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2))
await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
