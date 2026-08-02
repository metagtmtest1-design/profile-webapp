/**
 * Pins the two round-8 gaps closed alongside the reported three:
 *   - below 640px there was no in-page navigation at all
 *   - image alt text was not editable anywhere in the admin
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://frontend:5173'
const out = []
const check = (name, pass, detail = '') => {
  out.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 393, height: 852 } })

const sections = async () => (await (await page.request.get(`${BASE}/api/admin/content`)).json()).sections
const setVisible = (id, v) => page.request.put(`${BASE}/api/admin/sections/${id}`, { data: { is_visible: v } })
const original = (await sections()).map((s) => ({ id: s.id, is_visible: s.is_visible }))
for (const s of original) if (!s.is_visible) await setVisible(s.id, 1)

const heroItem = (await sections()).find((s) => s.type === 'hero').items[0]
const restore = []

try {
  // Mobile navigation --------------------------------------------------------------
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  const menu = page.getByRole('button', { name: 'Open menu' })
  check('a phone gets a menu button in the header', (await menu.count()) === 1)

  const headerHeight = await page.evaluate(() => Math.round(document.querySelector('nav').getBoundingClientRect().height))
  check('the header stays one row on a phone', headerHeight <= 90, `${headerHeight}px`)

  await menu.click()
  await page.waitForTimeout(400)
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('nav a')].filter((a) => a.offsetParent !== null).map((a) => a.textContent.trim()),
  )
  check('the menu reveals the in-page sections', ['Services', 'About', 'Testimonials'].every((l) => links.includes(l)), JSON.stringify(links))

  const tapTargets = await page.evaluate(() =>
    [...document.querySelectorAll('nav a, nav button')].filter((e) => e.offsetParent !== null).map((e) => Math.round(e.getBoundingClientRect().height)),
  )
  check('every header control clears the 44px tap-target floor', tapTargets.every((h) => h >= 44), JSON.stringify(tapTargets))

  await page.locator('nav').getByRole('link', { name: 'About', exact: true }).click()
  await page.waitForTimeout(900)
  const scrolled = await page.evaluate(() => {
    const el = document.getElementById('about')
    return el ? Math.round(el.getBoundingClientRect().top) : null
  })
  check('choosing a section scrolls to it, clear of the sticky header', scrolled !== null && scrolled >= 0 && scrolled < 200, `heading at ${scrolled}px`)
  check('the menu closes once a section is chosen', (await page.getByRole('button', { name: 'Open menu' }).count()) === 1)

  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('Escape closes the menu', (await page.getByRole('button', { name: 'Open menu' }).count()) === 1)
  await page.screenshot({ path: '/app/tmp-e2e/slice16-mobile-nav.png' })

  // Editable image descriptions -----------------------------------------------------
  restore.push(() => page.request.put(`${BASE}/api/admin/items/${heroItem.id}`, { data: { image_alt: heroItem.image_alt ?? null } }))

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  const altFields = await page.getByRole('button', { name: /Edit Image description for/ }).count()
  check('the admin offers an image description on every image it uploads', altFields >= 3, `${altFields} fields`)

  await page.getByRole('button', { name: /Edit Image description for a photo of you/ }).click()
  await page.waitForTimeout(300)
  await page.getByLabel(/Image description for a photo of you/).fill('Jane sketching a logo at her desk')
  await page.getByRole('button', { name: 'Save' }).first().click()
  await page.waitForTimeout(1200)

  const stored = (await sections()).find((s) => s.type === 'hero').items[0]
  check('the description is written through to the database', stored.image_alt === 'Jane sketching a logo at her desk', String(stored.image_alt))

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const heroAlt = await page.getAttribute('.hero img', 'alt')
  check('the live hero image carries the description', heroAlt === 'Jane sketching a logo at her desk', String(heroAlt))
} finally {
  for (const r of restore) await r()
  for (const s of original) await setVisible(s.id, s.is_visible)
}

await browser.close()
const failed = out.filter((p) => !p).length
console.log(`\n${out.length - failed}/${out.length} checks passed`)
process.exit(failed ? 1 : 0)
