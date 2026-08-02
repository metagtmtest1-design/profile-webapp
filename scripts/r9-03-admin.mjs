/**
 * Round 9 — exercise every admin control and verify the effect, then restore.
 * Creates its own scratch section so destructive controls are tested on throwaway data.
 */
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
page.on('console', (m) => m.type() === 'error' && log('CONSOLE ERROR:', m.text()))
page.on('dialog', (d) => { log('DIALOG:', d.type(), JSON.stringify(d.message())); d.accept() })

const getContent = async () => (await (await page.request.get(`${API}/api/admin/content`)).json())
const setVisible = (id, v) => page.request.put(`${API}/api/admin/sections/${id}`, { data: { is_visible: v } })
const before = await getContent()
const original = before.sections.map((s) => ({ id: s.id, is_visible: s.is_visible }))
const scratchIds = []

try {
  for (const s of original) if (!s.is_visible) await setVisible(s.id, 1)
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)

  // ---- inventory ------------------------------------------------------------------
  const controls = await page.evaluate(() => {
    const seen = new Map()
    for (const e of document.querySelectorAll('a[href], button, [role="button"], input, select, textarea')) {
      const r = e.getBoundingClientRect()
      const key = (e.getAttribute('aria-label') || e.innerText || e.placeholder || e.tagName).trim().replace(/\n/g, ' ').slice(0, 46)
      const v = seen.get(key) || { key, n: 0, minH: 999, minW: 999, hidden: 0 }
      v.n++
      if (r.width === 0) v.hidden++
      else { v.minH = Math.min(v.minH, Math.round(r.height)); v.minW = Math.min(v.minW, Math.round(r.width)) }
      seen.set(key, v)
    }
    return [...seen.values()]
  })
  log('ADMIN CONTROLS:', JSON.stringify(controls, null, 0))

  // ---- 1. Add-section validation ----------------------------------------------------
  await page.locator('button[aria-label="Add section"]').click()
  await page.waitForTimeout(600)
  log('add-section empty error:', JSON.stringify(await page.locator('[role="alert"]').allInnerTexts()))

  // ---- 2. Add a scratch section ------------------------------------------------------
  await page.locator('select').first().selectOption('cards-grid')
  await page.locator('input[aria-label="New section heading"]').fill('R9 Scratch Section')
  await page.locator('button[aria-label="Add section"]').click()
  await page.waitForTimeout(2000)
  const afterAdd = await getContent()
  const scratch = afterAdd.sections.find((s) => s.heading === 'R9 Scratch Section')
  if (scratch) scratchIds.push(scratch.id)
  log('scratch section created:', !!scratch, scratch?.id, 'type', scratch?.type, 'visible', scratch?.is_visible, 'items', scratch?.items?.length)
  log('section count in header:', await page.locator('text=/\\d+ sections · \\d+ live/').innerText())

  const scratchCard = page.locator(`[data-section]`).filter({ hasText: 'R9 Scratch Section' }).first()
  await scratchCard.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await scratchCard.screenshot({ path: `${OUT}/r9-admin-scratch-new.png` })

  // ---- 3. Add an item into it, exercise IconPicker / publish / remove -----------------
  await scratchCard.locator('button', { hasText: 'Add a service' }).first().click()
  await page.waitForTimeout(1800)
  let s2 = (await getContent()).sections.find((s) => s.id === scratch.id)
  log('items after Add a service:', s2.items.length, JSON.stringify(s2.items[0]))
  await scratchCard.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await scratchCard.screenshot({ path: `${OUT}/r9-admin-scratch-newitem.png` })

  // IconPicker
  const iconBtn = scratchCard.locator('button[aria-label^="Change the icon"]').first()
  log('icon trigger box:', JSON.stringify(await iconBtn.boundingBox()))
  await iconBtn.click()
  await page.waitForTimeout(500)
  await scratchCard.screenshot({ path: `${OUT}/r9-admin-iconpicker-open.png` })
  const choiceCount = await scratchCard.locator('button[aria-label^="Use "]').count()
  log('icon choices:', choiceCount)
  await scratchCard.locator('button[aria-label^="Use 🚀"]').first().click()
  await page.waitForTimeout(1500)
  s2 = (await getContent()).sections.find((s) => s.id === scratch.id)
  log('icon saved as:', JSON.stringify(s2.items[0].icon), 'picker closed:', (await scratchCard.locator('button[aria-label^="Use "]').count()) === 0)

  // custom icon
  await iconBtn.click(); await page.waitForTimeout(400)
  await scratchCard.locator('input[aria-label^="Custom icon"]').fill('🦊')
  await scratchCard.locator('button', { hasText: 'Use this' }).click()
  await page.waitForTimeout(1500)
  s2 = (await getContent()).sections.find((s) => s.id === scratch.id)
  log('custom icon saved as:', JSON.stringify(s2.items[0].icon))

  // EditableText on the new item
  const titleEditor = scratchCard.locator('[role="button"]').filter({ hasText: /Service name|Edit/ }).first()
  log('editable placeholders in scratch card:', JSON.stringify(await scratchCard.locator('[role="button"]').allInnerTexts()))

  // Publish toggle
  const pub = scratchCard.locator('button[aria-label^="Publish"]').first()
  log('new item starts unpublished:', await pub.count())
  if (await pub.count()) {
    await pub.click()
    await page.waitForTimeout(1500)
    s2 = (await getContent()).sections.find((s) => s.id === scratch.id)
    log('after Publish, is_visible =', s2.items[0].is_visible)
  }

  // Hide / Show the scratch section
  await scratchCard.locator('button[aria-label="Hide section"]').click()
  await page.waitForTimeout(1500)
  s2 = (await getContent()).sections.find((s) => s.id === scratch.id)
  log('after Hide, section is_visible =', s2.is_visible, 'badge:', await scratchCard.locator('text=Hidden — not on live site').count())
  await scratchCard.screenshot({ path: `${OUT}/r9-admin-hidden-section.png` })
  await scratchCard.locator('button[aria-label="Show section"]').click()
  await page.waitForTimeout(1500)
  log('after Show, section is_visible =', (await getContent()).sections.find((s) => s.id === scratch.id).is_visible)

  // Up / Down reorder
  const orderBefore = (await getContent()).sections.sort((a, b) => a.sort_order - b.sort_order).map((s) => s.id)
  await scratchCard.locator('button[aria-label="Move section up"]').click()
  await page.waitForTimeout(1800)
  const orderAfter = (await getContent()).sections.sort((a, b) => a.sort_order - b.sort_order).map((s) => s.id)
  log('reorder up worked:', JSON.stringify(orderBefore.indexOf(scratch.id)), '->', JSON.stringify(orderAfter.indexOf(scratch.id)))
  await page.locator(`[data-section]`).filter({ hasText: 'R9 Scratch Section' }).first().locator('button[aria-label="Move section down"]').click()
  await page.waitForTimeout(1800)
  log('reorder back:', (await getContent()).sections.sort((a, b) => a.sort_order - b.sort_order).map((s) => s.id).indexOf(scratch.id))

  // ---- 4. RatingPicker on a real testimonial (restore after) --------------------------
  const testi = (await getContent()).sections.find((s) => s.type === 'testimonials')
  const t0 = testi.items[0]
  const tCard = page.locator('[data-section]').filter({ hasText: 'Happy Clients Say' }).first()
  await tCard.scrollIntoViewIfNeeded(); await page.waitForTimeout(500)
  const star3 = tCard.locator('button[aria-label*="3 out of 5"]').first()
  await star3.click()
  await page.waitForTimeout(1500)
  const tAfter = (await getContent()).sections.find((s) => s.type === 'testimonials').items.find((i) => i.id === t0.id)
  log('rating after clicking 3rd star:', tAfter.rating, '(was', t0.rating, ')')
  log('Saved-confirmation shown:', await tCard.locator('text=Saved').count())
  await tCard.screenshot({ path: `${OUT}/r9-admin-rating.png` })
  // live page reflects it?
  const p2 = await ctx.newPage()
  await p2.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await p2.waitForTimeout(2000)
  const liveStars = await p2.evaluate(() => {
    const sec = document.getElementById('testimonials')
    const first = sec?.querySelector('[aria-label*="out of"], [role="img"]')
    return first ? { label: first.getAttribute('aria-label'), text: first.textContent } : null
  })
  log('live first testimonial stars:', JSON.stringify(liveStars))
  await p2.close()
  await page.request.put(`${API}/api/admin/items/${t0.id}`, { data: { rating: t0.rating } })
  log('rating restored to', t0.rating)

  // ---- 5. EditableText round-trip on the hero heading ---------------------------------
  const heroCard = page.locator('[data-section]').first()
  await heroCard.scrollIntoViewIfNeeded(); await page.waitForTimeout(400)
  const heroHeadingBefore = (await getContent()).sections.find((s) => s.type === 'hero').heading
  const hEdit = heroCard.locator('[role="button"][aria-label="Hero heading"], [aria-label="Hero heading"]').first()
  log('hero heading editor found:', await hEdit.count())
  await hEdit.click()
  await page.waitForTimeout(600)
  await heroCard.screenshot({ path: `${OUT}/r9-admin-editing.png` })
  const ta = heroCard.locator('input:visible, textarea:visible').first()
  await ta.fill('R9 EDIT PROBE')
  await ta.press('Enter')
  await page.waitForTimeout(1800)
  log('hero heading after edit:', JSON.stringify((await getContent()).sections.find((s) => s.type === 'hero').heading))
  await page.request.put(`${API}/api/admin/sections/${before.sections.find((s) => s.type === 'hero').id}`, { data: { heading: heroHeadingBefore } })
  log('hero heading restored:', JSON.stringify((await getContent()).sections.find((s) => s.type === 'hero').heading))

  // ---- 6. alt-text editor present where there is an image ------------------------------
  const altFields = await page.locator('text=Describe this image').count()
  log('alt-text editors on page:', altFields)

  // ---- 7. header buttons -----------------------------------------------------------------
  await page.locator('button[aria-label="Check storage usage"]').click()
  await page.waitForTimeout(3000)
  log('storage button now reads:', await page.locator('button[aria-label="Check storage usage"]').innerText())
  log('storage detail row:', await page.locator('text=/images stored/').count())
  await page.locator('button[aria-label="Reload content from the server"]').click()
  await page.waitForTimeout(2000)
  log('after Refresh, sections rendered:', await page.locator('[data-section]').count())

  // ---- 8. delete the scratch section --------------------------------------------------
  const sc = page.locator('[data-section]').filter({ hasText: 'R9 Scratch Section' }).first()
  await sc.scrollIntoViewIfNeeded(); await page.waitForTimeout(400)
  await sc.locator('button[aria-label="Delete section"]').click()
  await page.waitForTimeout(2500)
  const gone = !(await getContent()).sections.some((s) => s.id === scratch.id)
  log('scratch section deleted:', gone)
  if (gone) scratchIds.length = 0

  // ---- 9. admin at 393 / 768 ---------------------------------------------------------
  for (const [w, h] of [[768, 1024], [393, 852]]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${OUT}/r9-admin-top-${w}.png`, fullPage: false })
    const ov = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }))
    log(`ADMIN OVERFLOW @${w}:`, JSON.stringify(ov))
    const hero = page.locator('[data-section]').first()
    await hero.scrollIntoViewIfNeeded(); await page.waitForTimeout(500)
    await hero.screenshot({ path: `${OUT}/r9-admin-hero-${w}.png` })
  }
} finally {
  for (const id of scratchIds) await page.request.delete(`${API}/api/admin/sections/${id}`)
  for (const s of original) await setVisible(s.id, s.is_visible)
  const end = await getContent()
  log('FINAL section ids/visibility:', JSON.stringify(end.sections.map((s) => [s.id, s.is_visible, s.heading])))
}
await browser.close()
