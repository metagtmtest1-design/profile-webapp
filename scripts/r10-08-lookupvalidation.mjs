import { chromium } from 'playwright'
const IP = process.env.FRONTEND_IP || '172.24.0.3'
const BASE = 'http://localhost:5173'
const log = (...a) => console.log(...a)
const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP localhost ${IP}, MAP frontend ${IP}`] })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2200)
await page.fill('#manage-bookings-email', 'garbage')
await page.getByRole('button', { name: /Find my bookings/i }).click()
await page.waitForTimeout(1500)
log('native validity:', await page.evaluate(() => {
  const i = document.getElementById('manage-bookings-email')
  return JSON.stringify({ valid: i.checkValidity(), msg: i.validationMessage, type: i.type, required: i.required })
}))
log('visible alerts:', await page.evaluate(() => JSON.stringify([...document.querySelectorAll('[role="alert"]')].map(e => e.innerText.trim()))))
log('results heading:', await page.evaluate(() => { const h=[...document.querySelectorAll('h3')].find(e=>/Bookings for/.test(e.innerText)); return h?h.innerText:'none' }))
// empty email
await page.fill('#manage-bookings-email', '')
await page.getByRole('button', { name: /Find my bookings/i }).click()
await page.waitForTimeout(1200)
log('EMPTY -> alerts:', await page.evaluate(() => JSON.stringify([...document.querySelectorAll('[role="alert"]')].map(e => e.innerText.trim()))))
await page.screenshot({ path: '/app/tmp-e2e/r10-08-lookup-garbage.png', clip: { x: 300, y: 300, width: 840, height: 500 } })
await browser.close()
