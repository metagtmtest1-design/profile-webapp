/** Round 9 — alt-text round trip, header buttons, uploader, responsive admin shots. */
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
const heroItem = before.sections.find((s) => s.type === 'hero').items[0]

try {
  for (const s of original) if (!s.is_visible) await setVisible(s.id, 1)
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  // ---- alt-text round trip ----------------------------------------------------------
  const altEd = page.locator('[aria-label^="Edit Image description for a photo"]').first()
  await altEd.scrollIntoViewIfNeeded(); await page.waitForTimeout(400)
  await altEd.click(); await page.waitForTimeout(600)
  const altField = page.locator('textarea[aria-label^="Image description for a photo"]').first()
  await altField.fill('R9 alt probe')
  await altField.press('Enter')
  await page.waitForTimeout(2000)
  log('alt saved:', JSON.stringify((await getContent()).sections.find((s) => s.type === 'hero').items[0].image_alt))
  const p2 = await ctx.newPage()
  await p2.goto(`${BASE}/`, { waitUntil: 'networkidle' }); await p2.waitForTimeout(2000)
  log('live hero img alt:', JSON.stringify(await p2.evaluate(() => document.querySelector('section img')?.getAttribute('alt'))))
  log('live imgs missing alt attr:', JSON.stringify(await p2.evaluate(() => [...document.querySelectorAll('img')].filter((i) => i.getAttribute('alt') === null).length)))
  await p2.close()
  await page.request.put(`${API}/api/admin/items/${heroItem.id}`, { data: { image_alt: heroItem.image_alt ?? null } })
  log('alt restored:', JSON.stringify((await getContent()).sections.find((s) => s.type === 'hero').items[0].image_alt))

  // ---- header buttons ------------------------------------------------------------------
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(2500)
  await page.locator('button[aria-label="Check storage usage"]').click()
  await page.waitForTimeout(5000)
  log('storage button reads:', JSON.stringify(await page.locator('button[aria-label="Check storage usage"]').innerText()))
  log('storage detail row present:', await page.locator('text=/images stored/').count())
  await page.screenshot({ path: `${OUT}/r9-admin-storage.png`, fullPage: false })
  await page.locator('button[aria-label="Reload content from the server"]').click()
  await page.waitForTimeout(2500)
  log('after Refresh, sections rendered:', await page.locator('[data-section]').count())

  // ---- uploader opens a file dialog ---------------------------------------------------
  const chooser = page.waitForEvent('filechooser', { timeout: 6000 }).then(() => 'file dialog opened').catch(() => 'NO FILE CHOOSER')
  await page.locator('[aria-label="Replace hero image"]').first().click()
  log('click hero image ->', await chooser)
  await page.keyboard.press('Escape')

  const chooser2 = page.waitForEvent('filechooser', { timeout: 6000 }).then(() => 'file dialog opened').catch(() => 'NO FILE CHOOSER')
  await page.locator('button', { hasText: 'Upload image' }).first().click()
  log('click "Upload image" on a service card ->', await chooser2)
  await page.keyboard.press('Escape')

  // ---- responsive ---------------------------------------------------------------------
  for (const [w, h] of [[768, 1024], [393, 852]]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)
    await page.screenshot({ path: `${OUT}/r9-admin-top-${w}.png`, fullPage: false })
    log(`ADMIN OVERFLOW @${w}:`, JSON.stringify(await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }))))
    const hero = page.locator('[data-section]').first()
    await hero.scrollIntoViewIfNeeded(); await page.waitForTimeout(700)
    await hero.screenshot({ path: `${OUT}/r9-admin-hero-${w}.png` })
    const svc = page.locator('[data-section]').filter({ hasText: 'Branding & More Services' }).first()
    await svc.scrollIntoViewIfNeeded(); await page.waitForTimeout(700)
    await svc.screenshot({ path: `${OUT}/r9-admin-services-${w}.png` })
    const tst = page.locator('[data-section]').filter({ hasText: 'Happy Clients Say' }).first()
    await tst.scrollIntoViewIfNeeded(); await page.waitForTimeout(700)
    await tst.screenshot({ path: `${OUT}/r9-admin-testi-${w}.png` })
  }

  // ---- 1440 close-ups --------------------------------------------------------------------
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  for (const [name, text] of [['services', 'Branding & More Services'], ['testi', 'Happy Clients Say'], ['cta', 'Ready to start your project?'], ['gallery', 'My Work — Selected Projects'], ['about', 'About Me']]) {
    const c = page.locator('[data-section]').filter({ hasText: text }).first()
    await c.scrollIntoViewIfNeeded(); await page.waitForTimeout(700)
    await c.screenshot({ path: `${OUT}/r9-admin-${name}-1440.png` })
  }
} finally {
  for (const s of original) await setVisible(s.id, s.is_visible)
  await page.request.put(`${API}/api/admin/items/${heroItem.id}`, { data: { image_alt: heroItem.image_alt ?? null } })
  const end = await getContent()
  log('FINAL:', JSON.stringify(end.sections.map((s) => [s.id, s.is_visible, s.heading, s.items.length])))
}
await browser.close()
