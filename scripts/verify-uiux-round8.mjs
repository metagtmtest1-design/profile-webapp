/**
 * Verifies the four blockers raised in the eighth UI/UX review.
 * Shows every section for the duration of the run, then restores visibility.
 * docker run --rm --network profile-webapp_portfolio-net -v "$PWD":/app -w /tmp/pw \
 *   mcr.microsoft.com/playwright:v1.50.0-noble sh -c "... node verify-uiux-round8.mjs"
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://frontend:5173'
const out = []
const check = (name, pass, detail = '') => {
  out.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

const sections = async () => (await (await page.request.get(`${BASE}/api/admin/content`)).json()).sections
const setVisible = (id, v) => page.request.put(`${BASE}/api/admin/sections/${id}`, { data: { is_visible: v } })

const original = (await sections()).map((s) => ({ id: s.id, is_visible: s.is_visible }))
for (const s of original) if (!s.is_visible) await setVisible(s.id, 1)

try {
  // 1 — the admin About preview matches the live two-column layout ---------------
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const adminAbout = await page.evaluate(() => {
    const heading = [...document.querySelectorAll('h2')].find((h) => /About Me/.test(h.textContent))
    const card = heading?.closest('[data-section]')
    const img = card?.querySelector('[role="button"][aria-label*="about image"]')
    if (!heading || !img) return null
    const h = heading.getBoundingClientRect()
    const i = img.getBoundingClientRect()
    return { imageLeftOfText: i.right <= h.left + 2, sameBand: Math.abs(i.top - h.top) < i.height }
  })
  check('the admin About preview puts the photo left of the text', adminAbout?.imageLeftOfText === true, JSON.stringify(adminAbout))

  const stray = await page.evaluate(() => {
    const heading = [...document.querySelectorAll('h2')].find((h) => /About Me/.test(h.textContent))
    const card = heading?.closest('[data-section]')
    const sub = [...card.querySelectorAll('*')].find((e) => /Passion for design/.test(e.textContent) && !e.children.length)
    if (!sub) return null
    const h = heading.getBoundingClientRect()
    const s = sub.getBoundingClientRect()
    return Math.abs(s.left - h.left)
  })
  check('the About heading and subheading share a left edge', stray !== null && stray <= 8, `${stray}px apart`)

  // 2 — the CTA banner says one thing once ---------------------------------------
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const ctaLines = await page.evaluate(() => {
    const banner = [...document.querySelectorAll('section')].find((s) => /Ready to start/.test(s.textContent))
    return banner ? banner.innerText.split('\n').map((l) => l.trim()).filter((l) => l && l !== '\u2192') : []
  })
  check('the CTA banner is heading + one line + one button', ctaLines.length <= 3, JSON.stringify(ctaLines))
  const availableTwice = ctaLines.filter((l) => /available for new projects/i.test(l)).length
  check('the CTA does not repeat "Available for new projects"', availableTwice <= 1, `${availableTwice} times`)

  // 3 — the booking CTA is not repeated across every card ------------------------
  const ctaCount = await page.$$eval('a[href$="#calendar"]', (els) => els.length)
  check('the booking CTA appears a handful of times, not on every card', ctaCount <= 6, `${ctaCount} links`)
  check('service cards no longer carry a repeated CTA', (await page.$$eval('#services a', (e) => e.length)) === 0)

  // 4 — a dead image URL says so instead of leaving a white hole -----------------
  const gallery = (await sections()).find((s) => s.type === 'image-gallery')
  const victim = gallery.items[0]
  const originalUrl = victim.image_url
  await page.request.put(`${BASE}/api/admin/items/${victim.id}`, { data: { image_url: 'https://example.invalid/missing.png' } })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  check('a broken image shows a fallback, not a blank box', (await page.getByText('Image unavailable').count()) >= 1)
  await page.request.put(`${BASE}/api/admin/items/${victim.id}`, { data: { image_url: originalUrl } })

  // nits closed -------------------------------------------------------------------
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  check('weekend cells are labelled at 393', (await page.getByText('Wknd').count()) >= 2)
  await page.screenshot({ path: '/app/tmp-e2e/round8-mobile.png', fullPage: true })
} finally {
  for (const s of original) await setVisible(s.id, s.is_visible)
}

await browser.close()
const failed = out.filter((p) => !p).length
console.log(`\n${out.length - failed}/${out.length} checks passed`)
process.exit(failed ? 1 : 0)
