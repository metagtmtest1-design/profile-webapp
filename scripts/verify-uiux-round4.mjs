/**
 * Verifies the seven blockers raised in the fourth UI/UX review.
 * docker run --rm --network profile-webapp_portfolio-net -v "$PWD":/app -w /tmp/pw \
 *   mcr.microsoft.com/playwright:v1.50.0-noble sh -c "... node verify-uiux-round4.mjs"
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
await page.waitForTimeout(12000) // let the spam check time out

// 1 — the submit is blocked before the form is filled, not after ---------------
await page.locator('button[aria-label*="slots available"]').first().click()
await page.waitForTimeout(700)
await page.locator('#slot-picker button').filter({ hasText: /AM|PM/ }).first().click()
await page.waitForTimeout(11000)
const submit = page.locator('#slot-picker form button[type="submit"]')
check('Book button is blocked while the spam check is unresolved', await submit.isDisabled())

await page.fill('#firstName', 'Ada')
await page.fill('#lastName', 'Lovelace')
await page.fill('#email', 'ada@example.com')
await submit.click({ force: true }).catch(() => {})
await page.waitForTimeout(600)
const alerts = await page.locator('#slot-picker [role="alert"]').allInnerTexts()
check('exactly one failure message, not two contradictory ones', alerts.length <= 1, JSON.stringify(alerts))
check('no "finish the spam check above" instruction for an invisible widget',
  !alerts.join(' ').includes('finish the spam check above'), alerts.join(' | '))

// 2 — the vendor's own error chrome never renders -----------------------------
const vendorChrome = await page.evaluate(() => {
  const hosts = ['#turnstile-widget', '#manage-turnstile-widget']
  return hosts
    .map((sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      return { sel, display: getComputedStyle(el).display, height: Math.round(el.getBoundingClientRect().height) }
    })
    .filter(Boolean)
})
check('failed spam-check widgets are hidden, not left showing vendor errors',
  vendorChrome.every((w) => w.display === 'none' || w.height === 0), JSON.stringify(vendorChrome))
const bodyText = await page.locator('body').innerText()
check('no Cloudflare error chrome text on the page', !/Unable to connect to website|Troubleshoot/i.test(bodyText))

// 3 + 4 — anchors land on their own heading ------------------------------------
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const navHeight = await page.locator('nav').first().evaluate((e) => e.getBoundingClientRect().height)
for (const anchor of ['#about', '#calendar', '#contact']) {
  const count = await page.locator(anchor).count()
  check(`${anchor} appears exactly once in the document`, count === 1, `${count} elements`)
  if (!count) continue
  await page.evaluate((a) => { location.hash = ''; location.hash = a }, anchor)
  await page.waitForTimeout(900)
  const top = await page.locator(anchor).first().evaluate((e) => e.getBoundingClientRect().top)
  check(`${anchor} lands below the sticky nav`, top >= navHeight - 2, `top ${Math.round(top)} vs nav ${Math.round(navHeight)}`)
}
check('the footer offers a way to get in touch', (await page.getByText(/Get in touch/i).count()) > 0)

// 5 — nothing in the footer looks clickable but isn't --------------------------
const fakeAffordances = await page.evaluate(() => {
  const footer = document.querySelector('footer')
  return [...footer.querySelectorAll('span, div')]
    .filter((e) => !e.children.length && e.textContent.trim())
    .filter((e) => /^(Privacy|Terms|in|gh|𝕏)$/.test(e.textContent.trim()))
    .map((e) => e.textContent.trim())
})
check('no inert link-lookalikes in the footer', fakeAffordances.length === 0, fakeAffordances.join(', '))

// 6 — the admin header does not ghost content through itself -------------------
await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
const headerBg = await page.locator('.sticky').first().evaluate((e) => getComputedStyle(e).backgroundColor)
check('admin header is opaque', /^rgb\(/.test(headerBg) && !/rgba/.test(headerBg), headerBg)

// 7 — the admin preview matches the live hero ----------------------------------
const adminHero = await page.locator('body').innerText()
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
const liveHero = await page.locator('.hero').innerText()
// The live CTA label can legitimately differ when the owner's target is hidden — the
// admin says so explicitly, so accept either the label or that explanation.
const ctaSwapExplained = /points at a section that is hidden/.test(adminHero)
const missing = liveHero
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.length > 3 && !/^→$/.test(l))
  .filter((l) => !adminHero.includes(l))
  .filter((l) => !(ctaSwapExplained && /Book a free call/.test(l)))
check('everything on the live hero is present in the admin preview', missing.length === 0, missing.slice(0, 3).join(' | '))
check('no unverifiable hardcoded business claims in the hero',
  !/Trusted by \d+|\d+% Client retention|Years experience|Projects shipped/i.test(liveHero))

// nits that were cheap to close ------------------------------------------------
check('page has a meta description', Boolean(await page.getAttribute('meta[name="description"]', 'content')))
await page.keyboard.press('Tab')
const skip = await page.evaluate(() => {
  const el = document.activeElement
  return { text: el.textContent.trim(), visible: el.getBoundingClientRect().height > 1 }
})
check('first Tab reaches a visible skip link', /Skip to content/i.test(skip.text) && skip.visible, JSON.stringify(skip))

await page.screenshot({ path: '/app/tmp-e2e/round4-public.png', fullPage: true })
await browser.close()
const failed = out.filter((p) => !p).length
console.log(`\n${out.length - failed}/${out.length} checks passed`)
process.exit(failed ? 1 : 0)
