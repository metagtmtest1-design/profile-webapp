/**
 * Round 11 — is the "That does not look like an email address" copy reachable at all?
 */
import { chromium } from 'playwright'

const HOST_IP = process.env.FRONTEND_IP || '172.24.0.3'
const BASE = 'http://localhost:5173'
const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP localhost ${HOST_IP}`] })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

const form = page.locator('form:has(#manage-bookings-email)')
const input = page.locator('#manage-bookings-email')
const btn = form.locator('button[type="submit"]')
await input.scrollIntoViewIfNeeded()
await page.waitForTimeout(800)

console.log('form noValidate attr:', await form.evaluate((f) => f.noValidate))
console.log('input type:', await input.getAttribute('type'))

// Fresh page, no prior error. Type a malformed address and submit.
await input.fill('not-an-email')
console.log('input value after fill:', await input.inputValue())
console.log('checkValidity:', await input.evaluate((i) => i.checkValidity()), 'validationMessage:', await input.evaluate((i) => i.validationMessage))

let submitFired = false
await form.evaluate((f) => { f.addEventListener('submit', () => { window.__submitted = true }) })
await btn.click()
await page.waitForTimeout(800)
submitFired = await page.evaluate(() => !!window.__submitted)
console.log('submit event fired:', submitFired)

const alerts = await form.locator('[role="alert"]').allInnerTexts()
console.log('visible alerts after malformed submit:', JSON.stringify(alerts))
await page.screenshot({ path: '/app/tmp-e2e/r11-lookup-malformed-fresh.png', clip: await form.boundingBox() })
await page.screenshot({ path: '/app/tmp-e2e/r11-lookup-malformed-context.png' })

// And after a prior empty submit, is a stale message left on screen?
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
await input.scrollIntoViewIfNeeded()
await page.waitForTimeout(600)
await btn.click()
await page.waitForTimeout(500)
console.log('after empty submit:', JSON.stringify(await form.locator('[role="alert"]').allInnerTexts()))
await input.fill('not-an-email')
await btn.click()
await page.waitForTimeout(700)
console.log('after malformed submit following empty:', JSON.stringify(await form.locator('[role="alert"]').allInnerTexts()))
await page.screenshot({ path: '/app/tmp-e2e/r11-lookup-stale-error.png', clip: await form.boundingBox() })

// The malformed value the native check DOES let through, e.g. "a@b" (no dot)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
await input.scrollIntoViewIfNeeded()
await page.waitForTimeout(600)
await input.fill('jane@localhost')
console.log('a@b checkValidity:', await input.evaluate((i) => i.checkValidity()))
await btn.click()
await page.waitForTimeout(800)
console.log('after "jane@localhost":', JSON.stringify(await form.locator('[role="alert"]').allInnerTexts()))
await page.screenshot({ path: '/app/tmp-e2e/r11-lookup-nodot.png', clip: await form.boundingBox() })

await browser.close()
