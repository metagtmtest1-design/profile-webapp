/** Round 9 — full booking journey, then cancel it so no data is left behind. */
import { chromium } from 'playwright'

const IP = process.env.FRONTEND_IP || '172.24.0.3'
const BASE = 'http://localhost:5173'
const OUT = '/app/tmp-e2e'
const log = (...a) => console.log(...a)

const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP localhost ${IP}, MAP frontend ${IP}`] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => log('PAGEERROR:', e.message))
page.on('dialog', (d) => { log('DIALOG:', JSON.stringify(d.message())); d.accept() })

const EMAIL = 'r9-review-probe@example.com'

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

// ---- skip link + focus visibility ----------------------------------------------
await page.keyboard.press('Tab')
await page.waitForTimeout(400)
log('first tab stop:', JSON.stringify(await page.evaluate(() => {
  const a = document.activeElement
  const r = a.getBoundingClientRect()
  return { text: a.innerText, w: Math.round(r.width), h: Math.round(r.height), outline: getComputedStyle(a).outlineWidth, top: Math.round(r.top) }
})))
await page.screenshot({ path: `${OUT}/r9-skiplink.png`, clip: { x: 0, y: 0, width: 700, height: 120 } })

// focus ring on the hero CTA
await page.evaluate(() => document.querySelector('section a[href$="#calendar"]').focus())
await page.waitForTimeout(300)
log('hero CTA focus style:', JSON.stringify(await page.evaluate(() => {
  const s = getComputedStyle(document.activeElement)
  return { outline: s.outline, boxShadow: s.boxShadow.slice(0, 60) }
})))
await page.screenshot({ path: `${OUT}/r9-focus-hero.png`, clip: { x: 100, y: 300, width: 600, height: 220 } })

// ---- booking journey ---------------------------------------------------------------
await page.locator('#calendar').scrollIntoViewIfNeeded()
await page.waitForTimeout(600)
await page.locator('#calendar button:not([disabled])').filter({ hasText: /slots/ }).last().click()
await page.waitForTimeout(1200)
await page.locator('#slot-picker button').filter({ hasText: /\d{1,2}:\d{2}/ }).last().click()
await page.waitForTimeout(1000)
await page.locator('#firstName').fill('Review')
await page.locator('#lastName').fill('Probe')
await page.locator('#email').fill(EMAIL)
await page.locator('#purpose').fill('Round 9 UI review — will be cancelled immediately')
await page.locator('#slot-picker').scrollIntoViewIfNeeded()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/r9-booking-filled.png`, fullPage: false })
await page.locator('#slot-picker button[type="submit"]').click()
await page.waitForTimeout(6000)
await page.locator('#slot-picker').scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
await page.screenshot({ path: `${OUT}/r9-booking-result.png`, fullPage: false })
log('after submit, slot-picker text:\n', (await page.locator('#slot-picker').innerText()).slice(0, 1200))

// double-opt-in? follow the confirm link if it is offered
const confirmLink = page.locator('#slot-picker a', { hasText: /Confirm now/ })
if (await confirmLink.count()) {
  const href = await confirmLink.first().getAttribute('href')
  log('confirm url:', href)
  const p3 = await ctx.newPage()
  await p3.goto(href, { waitUntil: 'networkidle' })
  await p3.waitForTimeout(2500)
  await p3.screenshot({ path: `${OUT}/r9-booking-confirmed.png`, fullPage: false })
  log('confirm page text:', (await p3.locator('body').innerText()).slice(0, 600))
  await p3.close()
}

// ---- look the booking up and cancel it ------------------------------------------------
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
await page.locator('#manage-bookings-email').scrollIntoViewIfNeeded()
await page.waitForTimeout(500)
await page.locator('#manage-bookings-email').fill(EMAIL)
await page.locator('form:has(#manage-bookings-email) button[type="submit"]').click()
await page.waitForTimeout(3000)
await page.locator('#manage-bookings-email').scrollIntoViewIfNeeded()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/r9-manage-found.png`, fullPage: false })
const found = await page.locator('button', { hasText: 'Cancel meeting' }).count()
log('bookings found for probe email:', found)
for (let i = 0; i < found; i++) {
  await page.locator('button', { hasText: 'Cancel meeting' }).first().click()
  await page.waitForTimeout(3000)
}
log('after cancelling, remaining:', await page.locator('button', { hasText: 'Cancel meeting' }).count())
await page.screenshot({ path: `${OUT}/r9-manage-cancelled.png`, fullPage: false })

// verify nothing left
await page.locator('#manage-bookings-email').fill(EMAIL)
await page.locator('form:has(#manage-bookings-email) button[type="submit"]').click()
await page.waitForTimeout(3000)
log('final lookup:', (await page.locator('form:has(#manage-bookings-email)').locator('..').innerText()).slice(0, 300))

await browser.close()
