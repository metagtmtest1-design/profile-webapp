/**
 * Verifies the five blockers raised in the second UI/UX review.
 * docker run --rm --network profile-webapp_portfolio-net -v "$PWD":/app -w /tmp/pw \
 *   mcr.microsoft.com/playwright:v1.50.0-noble sh -c "... node verify-uiux-round2.mjs"
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
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)

// 1 — calendar weekday headers line up with the cells ------------------------
const grid = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.grid.grid-cols-7')]
  const headers = [...rows[0].children].map((c) => c.textContent.trim().toUpperCase())
  const cells = [...document.querySelectorAll('button[aria-label]')]
    .filter((b) => /^(SUN|MON|TUE|WED|THU|FRI|SAT) /.test(b.getAttribute('aria-label').toUpperCase()))
  return {
    headers,
    mismatched: cells
      .map((c, i) => ({ label: c.getAttribute('aria-label'), col: i % 7 }))
      .filter((c) => c.label.slice(0, 3).toUpperCase() !== headers[c.col]),
    count: cells.length,
  }
})
check('calendar renders a full grid of days', grid.count >= 14, `${grid.count} cells`)
check(
  'every calendar day sits under its own weekday header',
  grid.mismatched.length === 0,
  grid.mismatched.slice(0, 3).map((m) => `${m.label} in col ${grid.headers[m.col]}`).join(' | '),
)

// 2 — no vendor / spec copy on the public page --------------------------------
const bodyText = await page.locator('body').innerText()
const jargon = ['Resend', 'custom domain', 'Turnstile', 'max 3 weeks', 'multiple of 15', 'Booking ID', 'stub', '/api/']
check('no vendor or spec jargon on the public page', jargon.every((j) => !bodyText.includes(j)),
  jargon.filter((j) => bodyText.includes(j)).join(' | '))

// 3 — every in-page link resolves --------------------------------------------
const deadAnchors = await page.$$eval('a[href^="#"]', (els) =>
  els.filter((e) => e.getAttribute('href') !== '#' && !document.querySelector(e.getAttribute('href')))
     .map((e) => `${e.textContent.trim()} -> ${e.getAttribute('href')}`))
check('no link points at a section that is not on the page', deadAnchors.length === 0, deadAnchors.join(' | '))

// 4 — inline heading editor at large type -------------------------------------
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
const headingEditor = page.getByRole('button', { name: /Edit Hero heading/i }).first()
await headingEditor.click()
await page.waitForTimeout(400)
const field = page.locator('textarea[aria-label="Hero heading"]').first()
const box = await field.evaluate((e) => ({
  tag: e.tagName,
  fontSize: parseFloat(getComputedStyle(e).fontSize),
  clientH: e.clientHeight,
  scrollH: e.scrollHeight,
}))
check('heading editor is a textarea, not a one-line input', box.tag === 'TEXTAREA', box.tag)
check('heading editor renders at the heading size', box.fontSize >= 30, `${box.fontSize}px`)
check('heading editor grows to fit its text (no hidden overflow)', box.scrollH - box.clientH <= 2, `${box.scrollH} vs ${box.clientH}`)
const overlap = await page.evaluate(() => {
  const ta = document.querySelector('textarea[aria-label="Hero heading"]')
  const save = [...document.querySelectorAll('button[aria-label="Save"]')][0]
  if (!ta || !save) return null
  const a = ta.getBoundingClientRect(), b = save.getBoundingClientRect()
  return b.top >= a.bottom - 1
})
check('Save sits below the field, not on top of it', overlap === true)
await page.keyboard.press('Escape')

// 5 — hero empty state + tablet background seam -------------------------------
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
for (const w of [768, 1024]) {
  await page.setViewportSize({ width: w, height: 1024 })
  await page.waitForTimeout(500)
  const seam = await page.evaluate(() => {
    const hero = document.querySelector('.hero')
    if (!hero) return null
    const r = hero.getBoundingClientRect()
    const style = getComputedStyle(hero, '::before')
    return { width: style.width, inset: style.left, heroW: Math.round(r.width) }
  })
  check(`hero wash spans the full width @${w} (no vertical seam)`, seam && parseFloat(seam.width) >= seam.heroW - 1,
    JSON.stringify(seam))
}
await page.setViewportSize({ width: 1440, height: 1000 })
await page.screenshot({ path: '/app/tmp-e2e/round2-public.png', fullPage: true })
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
await page.waitForTimeout(600)
await page.screenshot({ path: '/app/tmp-e2e/round2-admin.png', fullPage: true })

// 6 — admin reads as human language ------------------------------------------
const adminText = await page.locator('body').innerText()
const devWords = ['HERO #', 'CARDS GRID #', 'bypass@local', 'cta-banner', 'text-block', 'image-gallery', 'R2 Quota', 'BYPASS']
check('no developer jargon in the admin UI', devWords.every((w) => !adminText.includes(w)),
  devWords.filter((w) => adminText.includes(w)).join(' | '))

await browser.close()
const failed = out.filter((p) => !p).length
console.log(`\n${out.length - failed}/${out.length} checks passed`)
process.exit(failed ? 1 : 0)
