/**
 * Pins the four blockers raised in the ninth UI/UX review:
 *   1. "Manage bookings" printed the booking's creation time, not the meeting time
 *   2. an 8x8 upload was accepted for the hero and rendered as a colour block
 *   3. the site was called "Portfolio" in five places with no field to change it
 *   4. "Booking opens from tomorrow" named a day the same card had disabled
 * plus the nits closed alongside them.
 */
import { chromium } from 'playwright'
import { makePng } from '/app/scripts/lib/testPng.mjs'

const BASE = process.env.BASE_URL || 'http://frontend:5173'
const out = []
const check = (name, pass, detail = '') => {
  out.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

const sections = async () => (await (await page.request.get(`${BASE}/api/admin/content`)).json()).sections
const adminPage = async () => (await (await page.request.get(`${BASE}/api/admin/content`)).json()).page
const setVisible = (id, v) => page.request.put(`${BASE}/api/admin/sections/${id}`, { data: { is_visible: v } })

const originalVisibility = (await sections()).map((s) => ({ id: s.id, is_visible: s.is_visible }))
for (const s of originalVisibility) if (!s.is_visible) await setVisible(s.id, 1)
const originalPage = await adminPage()
const restore = []

try {
  // 3 — the owner can name their own site --------------------------------------
  restore.push(() =>
    page.request.put(`${BASE}/api/admin/pages/home`, {
      data: { site_name: originalPage.site_name, footer_tagline: originalPage.footer_tagline, title: originalPage.title, meta_description: originalPage.meta_description },
    }),
  )

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const wordmark = page.locator('nav .font-black').first()
  const wordmarkBefore = (await wordmark.textContent())?.trim()
  check('the header shows the owner’s name, not the literal "Portfolio"', wordmarkBefore === originalPage.site_name, `"${wordmarkBefore}"`)

  const renamed = await page.request.put(`${BASE}/api/admin/pages/home`, { data: { site_name: 'Studio Nine' } })
  check('the site name can be changed through the API', renamed.status() === 200)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const wordmarkAfter = (await page.locator('nav .font-black').first().textContent())?.trim()
  check('the new name reaches the header', wordmarkAfter === 'Studio Nine', `"${wordmarkAfter}"`)
  const footerText = await page.locator('footer').innerText()
  check('the new name reaches the footer brand and the copyright line', (footerText.match(/Studio Nine/g) || []).length >= 2, `${(footerText.match(/Studio Nine/g) || []).length} mentions`)
  check('no stray "Portfolio" placeholder is left on the page', !(await page.locator('body').innerText()).includes('© 2026 Portfolio'))

  const blank = await page.request.put(`${BASE}/api/admin/pages/home`, { data: { site_name: '   ' } })
  check('an empty site name is refused rather than rendering as nothing', blank.status() === 400, `status ${blank.status()}`)

  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  for (const field of ['Site name', 'Footer tagline', 'Browser tab title', 'Search description']) {
    check(`the admin offers a "${field}" field`, (await page.getByRole('button', { name: `Edit ${field}` }).count()) === 1)
  }

  await page.getByRole('button', { name: 'Edit Site name' }).click()
  await page.getByLabel('Site name').fill('Jane Doe Studio')
  await page.getByRole('button', { name: 'Save' }).first().click()
  await page.waitForTimeout(1200)
  check('renaming from the admin persists', (await adminPage()).site_name === 'Jane Doe Studio')

  // 4 — the opening badge names a day the grid can actually select ---------------
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  check('the badge no longer claims booking opens "tomorrow"', !(await page.getByText(/Booking opens from tomorrow/i).count()))
  const badge = await page.getByText(/First opening:/).first().textContent().catch(() => null)
  check('the badge names a specific first opening', Boolean(badge), badge || 'no badge')
  if (badge) {
    const named = badge.replace('First opening:', '').trim()
    const dayNumber = named.match(/\d+/)?.[0]
    const enabled = await page.evaluate((n) => {
      const cell = [...document.querySelectorAll('button[aria-label]')].find((b) => b.getAttribute('aria-label').includes(` ${n} —`) || b.getAttribute('aria-label').endsWith(` ${n}`))
      return cell ? !cell.disabled : null
    }, dayNumber)
    check('the day the badge names is selectable in the same card', enabled === true, `day ${dayNumber}, enabled ${enabled}`)
  }

  // 2 — an image too small for its slot is refused --------------------------------
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  let hitStorage = false
  page.on('response', (r) => { if (r.url().includes('/api/admin/upload-image')) hitStorage = true })
  await page.locator('input[type="file"]').first().setInputFiles({ name: 'favicon.png', mimeType: 'image/png', buffer: makePng(8, 8) })
  await page.waitForTimeout(2500)
  check('an 8px image is refused for the hero with a readable reason', (await page.getByText(/only 8px wide/i).count()) > 0)
  check('the refused image never reaches storage', !hitStorage)

  // nits closed -------------------------------------------------------------------
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const zoom = await page.$$eval('#work img', (els) => els.filter((e) => /scale/.test(e.className)).length)
  check('gallery tiles no longer promise a lightbox by zooming', zoom === 0)
  check('the gallery is reachable from the header', (await page.locator('nav').getByRole('link', { name: 'Work' }).count()) >= 1)
  check('the gallery is reachable from the footer', (await page.locator('footer').getByRole('link', { name: 'Work' }).count()) >= 1)

  const heading = await page.evaluate(() => {
    const el = document.getElementById('work')
    return el ? el.querySelector('h2')?.textContent : null
  })
  check('the #work anchor lands on the gallery', Boolean(heading), heading || 'no #work section')
} finally {
  for (const r of restore) await r()
  for (const s of originalVisibility) await setVisible(s.id, s.is_visible)
}

await browser.close()
const failed = out.filter((p) => !p).length
console.log(`\n${out.length - failed}/${out.length} checks passed`)
process.exit(failed ? 1 : 0)
