/** Round 9 — remaining admin checks (EditableText round trip, header buttons, responsive). */
import { chromium } from 'playwright'

const IP = process.env.FRONTEND_IP || '172.24.0.3'
const BASE = 'http://localhost:5173'
const API = 'http://frontend:5173'
const OUT = '/app/tmp-e2e'
const log = (...a) => console.log(...a)

const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP localhost ${IP}, MAP frontend ${IP}`] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => log('PAGEERROR:', e.message))
page.on('dialog', (d) => { log('DIALOG:', JSON.stringify(d.message())); d.accept() })

const getContent = async () => (await (await page.request.get(`${API}/api/admin/content`)).json())
const setVisible = (id, v) => page.request.put(`${API}/api/admin/sections/${id}`, { data: { is_visible: v } })
const before = await getContent()
const original = before.sections.map((s) => ({ id: s.id, is_visible: s.is_visible }))

try {
  for (const s of original) if (!s.is_visible) await setVisible(s.id, 1)
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  // ---- EditableText round-trip ---------------------------------------------------
  const heroSection = before.sections.find((s) => s.type === 'hero')
  const heroCard = page.locator('[data-section]').first()
  const hEdit = heroCard.locator('[aria-label="Edit Hero heading"]').first()
  await hEdit.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await heroCard.screenshot({ path: `${OUT}/r9-admin-hero-idle.png` })
  await hEdit.click()
  await page.waitForTimeout(700)
  await heroCard.screenshot({ path: `${OUT}/r9-admin-hero-editing.png` })
  const field = heroCard.locator('input:visible, textarea:visible').first()
  await field.fill('R9 EDIT PROBE')
  await page.waitForTimeout(300)
  const saveBtn = heroCard.locator('button:visible', { hasText: /^Save$/ })
  log('explicit Save button present:', await saveBtn.count())
  if (await saveBtn.count()) await saveBtn.first().click()
  else await field.press('Enter')
  await page.waitForTimeout(2000)
  log('hero heading after edit:', JSON.stringify((await getContent()).sections.find((s) => s.type === 'hero').heading))
  await page.request.put(`${API}/api/admin/sections/${heroSection.id}`, { data: { heading: heroSection.heading } })
  log('restored:', JSON.stringify((await getContent()).sections.find((s) => s.type === 'hero').heading))

  // Escape cancels?
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  const h2 = page.locator('[data-section]').first().locator('[aria-label="Edit Hero heading"]').first()
  await h2.click(); await page.waitForTimeout(500)
  await page.locator('[data-section]').first().locator('input:visible, textarea:visible').first().fill('THROWAWAY')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1500)
  log('after Escape, heading in DB:', JSON.stringify((await getContent()).sections.find((s) => s.type === 'hero').heading))

  // ---- required-field guard ---------------------------------------------------------
  await page.locator('[data-section]').first().locator('[aria-label="Edit Hero heading"]').first().click()
  await page.waitForTimeout(500)
  await page.locator('[data-section]').first().locator('input:visible, textarea:visible').first().fill('')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(1200)
  log('empty-required error:', JSON.stringify(await page.locator('[data-section]').first().locator('[role="alert"], .text-red-600, .text-red-700').allInnerTexts()))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  // ---- alt-text editor round trip ----------------------------------------------------
  const heroItem = before.sections.find((s) => s.type === 'hero').items[0]
  const altEd = page.locator('[aria-label^="Edit Image description for a photo"]').first()
  await altEd.scrollIntoViewIfNeeded(); await page.waitForTimeout(400)
  await altEd.click(); await page.waitForTimeout(500)
  const altField = page.locator('[data-section]').first().locator('input:visible, textarea:visible').first()
  await altField.fill('R9 alt probe')
  await altField.press('Enter')
  await page.waitForTimeout(1800)
  log('alt saved:', JSON.stringify((await getContent()).sections.find((s) => s.type === 'hero').items[0].image_alt))
  const p2 = await ctx.newPage()
  await p2.goto(`${BASE}/`, { waitUntil: 'networkidle' }); await p2.waitForTimeout(1500)
  log('live hero img alt:', JSON.stringify(await p2.evaluate(() => document.querySelector('section img')?.getAttribute('alt'))))
  await p2.close()
  await page.request.put(`${API}/api/admin/items/${heroItem.id}`, { data: { image_alt: heroItem.image_alt ?? null } })
  log('alt restored:', JSON.stringify((await getContent()).sections.find((s) => s.type === 'hero').items[0].image_alt))

  // ---- header buttons ------------------------------------------------------------------
  await page.locator('button[aria-label="Check storage usage"]').click()
  await page.waitForTimeout(4000)
  log('storage button reads:', JSON.stringify(await page.locator('button[aria-label="Check storage usage"]').innerText()))
  log('storage detail row present:', await page.locator('text=/images stored/').count())
  await page.screenshot({ path: `${OUT}/r9-admin-storage.png`, fullPage: false })
  await page.locator('button[aria-label="Reload content from the server"]').click()
  await page.waitForTimeout(2500)
  log('after Refresh, sections rendered:', await page.locator('[data-section]').count())

  // ---- image uploader click opens a file dialog? ------------------------------------------
  const chooserPromise = page.waitForEvent('filechooser', { timeout: 5000 }).then(() => 'opened').catch(() => 'NO FILE CHOOSER')
  await page.locator('[aria-label="Replace hero image"]').first().click()
  log('clicking the hero image:', await chooserPromise)

  // ---- responsive ---------------------------------------------------------------------------
  for (const [w, h] of [[768, 1024], [393, 852]]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${OUT}/r9-admin-top-${w}.png`, fullPage: false })
    log(`ADMIN OVERFLOW @${w}:`, JSON.stringify(await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }))))
    const hero = page.locator('[data-section]').first()
    await hero.scrollIntoViewIfNeeded(); await page.waitForTimeout(600)
    await hero.screenshot({ path: `${OUT}/r9-admin-hero-${w}.png` })
    const svc = page.locator('[data-section]').filter({ hasText: 'Branding & More Services' }).first()
    await svc.scrollIntoViewIfNeeded(); await page.waitForTimeout(600)
    await svc.screenshot({ path: `${OUT}/r9-admin-services-${w}.png` })
  }
} finally {
  for (const s of original) await setVisible(s.id, s.is_visible)
  const end = await getContent()
  log('FINAL:', JSON.stringify(end.sections.map((s) => [s.id, s.is_visible, s.heading, s.items.length])))
}
await browser.close()
