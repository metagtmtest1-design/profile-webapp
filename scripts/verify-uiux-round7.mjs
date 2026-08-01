/**
 * Verifies the five blockers raised in the seventh UI/UX review.
 * Shows every section for the duration of the run, then restores visibility.
 * docker run --rm --network profile-webapp_portfolio-net -v "$PWD":/app -w /tmp/pw \
 *   mcr.microsoft.com/playwright:v1.50.0-noble sh -c "... node verify-uiux-round7.mjs"
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://frontend:5173'
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC',
  'base64',
)
const out = []
const check = (name, pass, detail = '') => {
  out.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.on('dialog', (d) => d.accept())

const sections = async () => (await (await page.request.get(`${BASE}/api/admin/content`)).json()).sections
const setVisible = async (id, v) =>
  page.request.put(`${BASE}/api/admin/sections/${id}`, { data: { is_visible: v } })
const putItem = async (id, data) => page.request.put(`${BASE}/api/admin/items/${id}`, { data })

const original = (await sections()).map((s) => ({ id: s.id, is_visible: s.is_visible }))
for (const s of original) if (!s.is_visible) await setVisible(s.id, 1)

try {
  // 1 — a service-card upload must reach the live page ------------------------
  const svc = (await sections()).find((s) => s.type === 'cards-grid')
  const svcItem = svc.items[0]
  const originalSvcImage = svcItem.image_url
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  const upload = page.waitForResponse((r) => r.url().includes('/api/admin/upload-image'), { timeout: 20000 })
  await page.locator(`input[type="file"]`).nth(1).setInputFiles({ name: 's.png', mimeType: 'image/png', buffer: PNG })
  const uploaded = await (await upload).json()
  await page.waitForTimeout(1200)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const liveImgs = await page.$$eval('#services img', (els) => els.map((e) => e.getAttribute('src')))
  check('a service-card upload appears on the live site', liveImgs.includes(uploaded.url), `${liveImgs.length} images in #services`)
  await putItem(svcItem.id, { image_url: originalSvcImage })

  // 2 + 3 — every live string has an editor behind it --------------------------
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const adminText = await page.locator('body').innerText()
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const liveText = await page.locator('main').innerText()
  const orphaned = liveText
    .split('\n')
    // The live testimonial wraps the body in quotation marks the owner never typed.
    .map((l) => l.trim().replace(/^["\u201c]|["\u201d]$/g, ''))
    .filter((l) => l.length > 8 && !/^\d/.test(l))
    .filter((l) => !adminText.includes(l))
    // Booking UI is app chrome, not owner content.
    .filter((l) => !/spam check|available|Book a meeting|Pick a time|Select a day|Manage bookings|Look up or cancel|Email address|Find my bookings|weekday in the next|Booking opens|free slots|Skip to content|Remote-first|rights reserved|Get in touch|30-min call|Strategic brand design|System health/i.test(l))
  check('no live copy is missing from the admin editor', orphaned.length === 0, orphaned.slice(0, 4).join(' | '))

  const ctaProbe = 'R7 VERIFY SUBHEAD'
  const cta = (await sections()).find((s) => s.type === 'cta-banner')
  const originalSub = cta.subheading
  await page.request.put(`${BASE}/api/admin/sections/${cta.id}`, { data: { subheading: ctaProbe } })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  check('the CTA subheading the admin edits is rendered live', (await page.locator('body').innerText()).includes(ctaProbe))
  await page.request.put(`${BASE}/api/admin/sections/${cta.id}`, { data: { subheading: originalSub } })

  // 4 — a new item must not publish itself -------------------------------------
  const gallery = (await sections()).find((s) => s.type === 'image-gallery')
  const liveBefore = await page.$$eval('#services ~ * , body', () => 0).catch(() => 0)
  const created = await (await page.request.post(`${BASE}/api/admin/items`, { data: { sectionId: gallery.id } })).json()
  check('a newly added item starts unpublished', created.is_visible === 0, `is_visible=${created.is_visible}`)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const publicGallery = (await (await page.request.get(`${BASE}/api/content/home`)).json()).sections.find((s) => s.type === 'image-gallery')
  check('the blank item is absent from the public page', !publicGallery.items.some((i) => i.id === created.id), `${publicGallery.items.length} live items`)
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  check('the admin flags it as not live yet', (await page.getByText('Not on your live site yet').count()) >= 1)
  check('the admin offers a Publish control', (await page.getByRole('button', { name: /^Publish/ }).count()) >= 1)
  await page.request.delete(`${BASE}/api/admin/items/${created.id}`)

  // 5 — the mobile header is one tidy row ---------------------------------------
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  const nav = await page.locator('nav').first().evaluate((e) => e.getBoundingClientRect().height)
  check('the sticky header is a single row @393', nav <= 90, `${Math.round(nav)}px tall`)
  const rows = await page.$$eval('nav a', (els) => new Set(els.filter((e) => e.getBoundingClientRect().height > 0).map((e) => Math.round(e.getBoundingClientRect().top))).size)
  check('all header links sit on one line @393', rows <= 1, `${rows} rows`)
  await page.screenshot({ path: '/app/tmp-e2e/round7-mobile-nav.png' })

  const wordings = await page.$$eval('a[href$="#calendar"]', (els) => [...new Set(els.map((e) => e.textContent.replace(/[→\s]+/g, ' ').trim()))])
  check('one wording for the booking action everywhere', wordings.length === 1, wordings.join(' | '))
} finally {
  for (const s of original) await setVisible(s.id, s.is_visible)
}

await browser.close()
const failed = out.filter((p) => !p).length
console.log(`\n${out.length - failed}/${out.length} checks passed`)
process.exit(failed ? 1 : 0)
