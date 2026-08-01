/**
 * Verifies the five blockers raised in the fifth UI/UX review.
 * docker run --rm --network profile-webapp_portfolio-net -v "$PWD":/app -w /tmp/pw \
 *   mcr.microsoft.com/playwright:v1.50.0-noble sh -c "... node verify-uiux-round5.mjs"
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

// 1 — the vendor widget is never visible, not even before the timeout ----------
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
await page.locator('button[aria-label*="slots available"]').first().waitFor({ timeout: 20000 })
await page.locator('button[aria-label*="slots available"]').first().click()
await page.waitForTimeout(400)
await page.locator('#slot-picker button').filter({ hasText: /AM|PM/ }).first().click()

let everVisible = []
for (let t = 0; t < 13; t++) {
  const vis = await page.evaluate(() =>
    ['#turnstile-widget', '#manage-turnstile-widget']
      .map((sel) => document.querySelector(sel))
      .filter(Boolean)
      .filter((el) => el.getBoundingClientRect().height > 1)
      .map((el) => `${el.id}:${Math.round(el.getBoundingClientRect().height)}px`))
  const cf = await page.evaluate(() => /Unable to connect to website|Troubleshoot/i.test(document.body.innerText))
  if (vis.length || cf) everVisible.push(`t=${t}s ${vis.join(',')}${cf ? ' CF-TEXT' : ''}`)
  await page.waitForTimeout(1000)
}
check('the spam-check widget is never visible while it resolves', everVisible.length === 0, everVisible.slice(0, 3).join(' | '))

// 2 — one status message, in the resting state and after a retry ---------------
const statuses = async () =>
  page.evaluate(() =>
    [...document.querySelectorAll('#slot-picker [role="alert"], #slot-picker p')]
      .map((e) => e.textContent.trim())
      .filter((t) => /spam check/i.test(t)))
check('one spam-check message in the timed-out state', (await statuses()).length === 1, JSON.stringify(await statuses()))
await page.getByRole('button', { name: 'Try again' }).first().click()
await page.waitForTimeout(600)
check('one spam-check message after Try again', (await statuses()).length === 1, JSON.stringify(await statuses()))
check('Book stays disabled while the check is unresolved', await page.locator('#slot-picker form button[type="submit"]').isDisabled())

// 3 — the nav no longer dead-ends -----------------------------------------------
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const navLinks = await page.$$eval('nav a', (els) => els.map((e) => ({ text: e.textContent.trim(), href: e.getAttribute('href') })))
check('no nav link points at the footer, which a short page cannot scroll to',
  !navLinks.some((l) => l.href === '#contact'), JSON.stringify(navLinks))
for (const l of navLinks) {
  await page.evaluate((h) => { location.hash = ''; location.hash = h }, l.href)
  await page.waitForTimeout(800)
  const top = await page.locator(l.href).first().evaluate((e) => e.getBoundingClientRect().top)
  check(`nav "${l.text}" lands on its own heading`, top >= 59 && top < 200, `top ${Math.round(top)}`)
}
const ctaWordings = await page.$$eval('a[href="#calendar"]', (els) => [...new Set(els.map((e) => e.textContent.replace(/[→\s]+/g, ' ').trim()))])
check('one wording for the booking action', ctaWordings.length === 1, ctaWordings.join(' | '))

// 4 — the admin preview reads as the live site ----------------------------------
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const hidden = await page.evaluate(() => {
  const badge = [...document.querySelectorAll('span')].find((s) => /Hidden — not on live site/.test(s.textContent))
  if (!badge) return null
  const card = badge.closest('[data-section]')
  const body = [...card.children].find((c) => /bg-amber-50/.test(c.className || ''))
  if (!body) return { marked: false }
  // Tinted rather than dimmed — a blanket opacity dropped body text under WCAG AA.
  const s = getComputedStyle(body)
  return { marked: s.backgroundColor !== 'rgba(0, 0, 0, 0)', bg: s.backgroundColor }
})
check('hidden sections are visibly marked', hidden?.marked === true, JSON.stringify(hidden))

const previews = await page.$$eval('[role="button"][aria-label*="image"]', (els) =>
  els.map((e) => ({ label: e.getAttribute('aria-label'), w: Math.round(e.getBoundingClientRect().width) })))
check('every image preview is large enough to recognise', previews.length >= 8 && previews.every((p) => p.w >= 120),
  `${previews.length} previews, min ${Math.min(...previews.map((p) => p.w))}px`)
const noAlt = await page.$$eval('img', (els) => els.filter((e) => !e.hasAttribute('alt')).length)
check('every admin image has an alt attribute', noAlt === 0, `${noAlt} missing`)
check('/admin has exactly one h1', (await page.locator('h1').count()) === 1, `${await page.locator('h1').count()}`)

// 5 — plain-English upload rejection ---------------------------------------------
const fileInput = page.locator('input[type="file"]').nth(1)
await fileInput.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
await page.waitForTimeout(700)
const uploadError = await page.locator('[role="alert"]').filter({ hasText: /image/i }).first().innerText()
check('upload rejection avoids MIME jargon', !/text\/plain|Invalid file type/.test(uploadError), uploadError)
const errStyle = await page.locator('[role="alert"]').filter({ hasText: /image/i }).first()
  .evaluate((e) => ({ color: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor }))
check('upload rejection is styled as an error', errStyle.color === 'rgb(185, 28, 28)', JSON.stringify(errStyle))

// nits closed --------------------------------------------------------------------
await page.setViewportSize({ width: 393, height: 852 })
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const smallTargets = await page.$$eval('nav a, footer a', (els) =>
  els.filter((e) => e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 40)
     .map((e) => `${e.textContent.trim()}:${Math.round(e.getBoundingClientRect().height)}`))
check('nav and footer tap targets are >= 40px tall @393', smallTargets.length === 0, smallTargets.slice(0, 4).join(', '))
await page.locator('button[aria-label*="slots available"]').first().click()
await page.waitForTimeout(900)
const clipped = await page.$$eval('#slot-picker button', (els) =>
  els.filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim()))
check('no time slot label is clipped @393', clipped.length === 0, clipped.join(', '))

// Developer traces are DEV-only, so this dev server legitimately prints them. What
// matters is that they are compiled out — see scripts/verify-no-debug-in-build.sh.

await browser.close()
const failed = out.filter((p) => !p).length
console.log(`\n${out.length - failed}/${out.length} checks passed`)
process.exit(failed ? 1 : 0)
