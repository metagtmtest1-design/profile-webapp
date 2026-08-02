/**
 * Round 11 — what the owner sees when they pick "Hero" from Add a section.
 */
import { chromium } from 'playwright'

const BASE = 'http://frontend:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })

await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)

const panel = page.locator('div.p-4:has-text("Add a section")').last()
const opts = await page.locator('select option').allInnerTexts()
console.log('dropdown options:', JSON.stringify(opts))

await page.selectOption('select', 'hero')
await page.locator('input[aria-label="New section heading"]').fill('R11 hero probe')
await page.locator('button[aria-label="Add section"]').click()
await page.waitForTimeout(2500)

const alerts = await page.locator('[role="alert"]').allInnerTexts()
console.log('messages shown:', JSON.stringify(alerts))
await page.screenshot({ path: '/app/tmp-e2e/r11-admin-hero-add-error.png', clip: { x: 0, y: 0, width: 1440, height: 700 } })
console.log('body has error:', (await page.locator('body').innerText()).includes('Hero section already exists'))

await browser.close()
