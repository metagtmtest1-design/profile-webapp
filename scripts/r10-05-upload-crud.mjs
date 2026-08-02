/**
 * Round 10 — uploader min-width guard, a real upload, and add/delete of a section
 * and an item. Everything created here is deleted again; the hero image is restored.
 */
import { chromium } from 'playwright'
import { makePng } from './lib/testPng.mjs'

const IP = process.env.FRONTEND_IP || '172.24.0.3'
const BASE = 'http://localhost:5173'
const API = 'http://frontend:5173'
const OUT = '/app/tmp-e2e'
const log = (...a) => console.log(...a)

const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP localhost ${IP}, MAP frontend ${IP}`] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 160)) })
page.on('dialog', (d) => { log('DIALOG:', d.message().slice(0, 120)); d.accept() })

const getContent = async () => (await (await page.request.get(`${API}/api/admin/content`)).json())
const before = await getContent()
const heroItem = before.sections.find((s) => s.type === 'hero').items[0]
const originalHeroUrl = heroItem.image_url
const originalSectionIds = before.sections.map((s) => s.id)
const originalItemIds = before.sections.flatMap((s) => (s.items || []).map((i) => i.id))
log('ORIGINAL hero image:', originalHeroUrl)
log('ORIGINAL sections:', originalSectionIds.length, 'items:', originalItemIds.length)

const load = async () => { await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500) }
const file = (name, w, h) => ({ name, mimeType: 'image/png', buffer: makePng(w, h) })

try {
  await load()

  // ---- hero slot: too-small image must be refused before R2 -------------------------
  const heroInput = page.locator(`input#upload-${heroItem.id}`)
  log('\nHERO file input present:', await heroInput.count())
  await heroInput.setInputFiles(file('tiny.png', 200, 150))
  await page.waitForTimeout(3000)
  log('TOO SMALL (200px into hero) -> alert:', await page.evaluate(() => {
    const el = [...document.querySelectorAll('[role="alert"]')].map((e) => e.innerText.trim()).filter((t) => /px wide|blurry/i.test(t))
    return JSON.stringify(el)
  }))
  log('hero url unchanged:', (await getContent()).sections.find((s) => s.type === 'hero').items[0].image_url === originalHeroUrl)
  await page.screenshot({ path: `${OUT}/r10-05-hero-too-small.png`, fullPage: false })

  // just under the 640 threshold
  await heroInput.setInputFiles(file('near.png', 639, 480))
  await page.waitForTimeout(3000)
  log('639px into hero -> alert:', await page.evaluate(() => JSON.stringify([...document.querySelectorAll('[role="alert"]')].map((e) => e.innerText.trim()).filter((t) => /px wide/i.test(t)))))

  // ---- card slot: 320px threshold -----------------------------------------------------
  const cardInputs = page.locator('input[type=file]')
  const n = await cardInputs.count()
  log('\nFILE INPUTS total:', n)
  // find a card-variant uploader (services section)
  const svcSection = page.locator('[data-section]').filter({ hasText: 'Branding & More Services' })
  const cardInput = svcSection.locator('input[type=file]').first()
  await cardInput.setInputFiles(file('tinycard.png', 200, 150))
  await page.waitForTimeout(3000)
  log('200px into card slot -> alert:', await page.evaluate(() => JSON.stringify([...document.querySelectorAll('[role="alert"]')].map((e) => e.innerText.trim()).filter((t) => /px wide/i.test(t)))))
  await page.screenshot({ path: `${OUT}/r10-05-card-too-small.png`, fullPage: false })

  // ---- non-image file --------------------------------------------------------------------
  await cardInput.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
  await page.waitForTimeout(2000)
  log("NON-IMAGE -> alert:", await page.evaluate(() => JSON.stringify([...document.querySelectorAll('[role="alert"]')].map((e) => e.innerText.trim()).filter((t) => /image/i.test(t)))))

  // ---- a real hero upload that should succeed ---------------------------------------------
  await load()
  await page.locator(`input#upload-${heroItem.id}`).setInputFiles(file('big.png', 1200, 900))
  await page.waitForTimeout(9000)
  const newUrl = (await getContent()).sections.find((s) => s.type === 'hero').items[0].image_url
  log('\nREAL UPLOAD -> new url:', newUrl, '| changed:', newUrl !== originalHeroUrl)
  log('Uploaded ✓ status:', await page.getByText('Uploaded ✓').count())
  log('errors on page:', await page.evaluate(() => JSON.stringify([...document.querySelectorAll('[role="alert"]')].map((e) => e.innerText.trim()))))
  await page.screenshot({ path: `${OUT}/r10-05-upload-ok.png`, fullPage: false })
  const img = await page.request.get(`${API}${newUrl}`)
  log('uploaded image fetch:', img.status(), img.headers()['content-type'], (await img.body()).length, 'bytes')

  // exactly one upload control for the hero
  const heroControls = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('[data-section]')][0]
    return {
      fileInputs: sec.querySelectorAll('input[type=file]').length,
      uploadButtons: [...sec.querySelectorAll('button,[role="button"]')].filter((b) => /upload|replace/i.test(b.getAttribute('aria-label') || b.innerText)).map((b) => b.getAttribute('aria-label') || b.innerText.trim()),
      images: sec.querySelectorAll('img').length,
    }
  })
  log('HERO SECTION controls:', JSON.stringify(heroControls))

  // ---- add a section, then delete it -------------------------------------------------------
  await load()
  await page.selectOption('select', 'testimonials')
  await page.fill('input[aria-label="New section heading"]', 'R10 Temp Section')
  await page.getByRole('button', { name: 'Add section' }).click()
  await page.waitForTimeout(2500)
  const afterAdd = await getContent()
  const added = afterAdd.sections.find((s) => !originalSectionIds.includes(s.id))
  log('\nADDED SECTION:', added ? `${added.id} ${added.type} "${added.heading}" visible=${added.is_visible}` : 'NOT CREATED')
  log('section count now:', afterAdd.sections.length)
  await page.screenshot({ path: `${OUT}/r10-05-added-section.png`, fullPage: true })
  log('empty-state copy:', await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find((d) => /Nothing here yet/.test(d.innerText) && d.innerText.length < 80)
    return el ? el.innerText.replace(/\n/g, ' | ') : 'NONE'
  }))

  // add an item into it
  const tempSec = page.locator('[data-section]').filter({ hasText: 'R10 Temp Section' })
  const addItem = tempSec.getByRole('button', { name: /Add a testimonial/i }).first()
  log('ADD ITEM button in new section:', await addItem.count())
  if (await addItem.count()) {
    await addItem.click()
    await page.waitForTimeout(2500)
    const c = await getContent()
    const newItem = c.sections.flatMap((s) => s.items || []).find((i) => !originalItemIds.includes(i.id))
    log('ADDED ITEM:', newItem ? `${newItem.id} visible=${newItem.is_visible}` : 'NOT CREATED')
    log('unpublished badge:', await page.getByText('Not on your live site yet').count())
  }

  // delete the temp section
  if (added) {
    const del = page.locator('[data-section]').filter({ hasText: 'R10 Temp Section' }).getByRole('button', { name: 'Delete section' }).first()
    await del.click()
    await page.waitForTimeout(2500)
    const c = await getContent()
    log('AFTER DELETE section count:', c.sections.length, '| temp gone:', !c.sections.some((s) => s.id === added.id))
  }
} finally {
  // restore hero image + remove anything left over
  const c = await getContent()
  for (const s of c.sections) if (!originalSectionIds.includes(s.id)) {
    await page.request.delete(`${API}/api/admin/sections/${s.id}`).catch(() => {})
    log('cleanup: removed stray section', s.id)
  }
  const c2 = await getContent()
  for (const i of c2.sections.flatMap((s) => s.items || [])) if (!originalItemIds.includes(i.id)) {
    await page.request.delete(`${API}/api/admin/items/${i.id}`).catch(() => {})
    log('cleanup: removed stray item', i.id)
  }
  await page.request.put(`${API}/api/admin/items/${heroItem.id}`, { data: { image_url: originalHeroUrl } })
  const fin = await getContent()
  log('\nRESTORED hero image:', fin.sections.find((s) => s.type === 'hero').items[0].image_url)
  log('RESTORED sections:', fin.sections.length, 'items:', fin.sections.flatMap((s) => s.items || []).length)
  log('ERRORS:', JSON.stringify([...new Set(errors)].slice(0, 20)))
  await browser.close()
}
