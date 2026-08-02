/**
 * Round 10 — remaining /admin interactions: required-field validation, Escape,
 * hide/show, reorder, publish/unpublish, icon picker, rating stars, delete confirm.
 */
import { chromium } from 'playwright'

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
let lastDialog = null
page.on('dialog', (d) => { lastDialog = `${d.type()} | ${d.message()}`; d.dismiss() })

const getContent = async () => (await (await page.request.get(`${API}/api/admin/content`)).json())
const before = await getContent()
const originalPage = { ...before.page }
const originalVis = before.sections.map((s) => ({ id: s.id, is_visible: s.is_visible }))
const originalOrder = before.sections.slice().sort((a, b) => a.sort_order - b.sort_order).map((s) => s.id)
const originalItemVis = before.sections.flatMap((s) => (s.items || []).map((i) => ({ id: i.id, is_visible: i.is_visible })))
const originalIcons = before.sections.flatMap((s) => (s.items || []).map((i) => ({ id: i.id, icon: i.icon, rating: i.rating })))

const load = async () => { await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' }); await page.waitForTimeout(2500) }
const edit = (label) => page.getByRole('button', { name: new RegExp(`^Edit ${label}$`, 'i') }).first()
const field = (label) => page.locator(`textarea[aria-label="${label}"]`).first()

try {
  // ---- required-field validation on Site name -----------------------------------
  await load()
  await edit('Site name').click()
  await page.waitForTimeout(400)
  await field('Site name').fill('   ')
  await field('Site name').press('Enter')
  await page.waitForTimeout(900)
  log('BLANK SITE NAME -> inline error:', await page.evaluate(() => {
    const el = [...document.querySelectorAll('span')].find((s) => s.innerText === 'Value required')
    return el ? 'shown' : 'MISSING'
  }))
  log('BLANK SITE NAME -> server unchanged:', JSON.stringify((await getContent()).page.site_name))
  await page.screenshot({ path: `${OUT}/r10-03-sitename-required.png` })
  await field('Site name').press('Escape')
  await page.waitForTimeout(400)

  // ---- Escape cancels -------------------------------------------------------------
  await edit('Browser tab title').click()
  await page.waitForTimeout(400)
  await field('Browser tab title').fill('SHOULD NOT SAVE')
  await field('Browser tab title').press('Escape')
  await page.waitForTimeout(900)
  log('ESCAPE cancels -> server title:', JSON.stringify((await getContent()).page.title))

  // ---- Cancel button + Save button --------------------------------------------------
  await edit('Footer tagline').click()
  await page.waitForTimeout(400)
  await field('Footer tagline').fill('temp tagline r10')
  await page.getByRole('button', { name: 'Cancel' }).first().click()
  await page.waitForTimeout(900)
  log('CANCEL button -> server tagline unchanged:', (await getContent()).page.footer_tagline === originalPage.footer_tagline)

  await edit('Footer tagline').click()
  await page.waitForTimeout(400)
  await field('Footer tagline').fill('temp tagline r10')
  await page.getByRole('button', { name: 'Save' }).first().click()
  await page.waitForTimeout(1500)
  log('SAVE button -> server tagline:', JSON.stringify((await getContent()).page.footer_tagline))
  log('SAVED ✓ toast:', await page.getByText('Saved ✓').count())
  await page.screenshot({ path: `${OUT}/r10-03-saved-toast.png` })

  // ---- Hide / Show a section ----------------------------------------------------
  await load()
  log('\nHIDE count:', await page.getByRole('button', { name: 'Hide section' }).count(),
    'SHOW count:', await page.getByRole('button', { name: 'Show section' }).count())
  await page.getByRole('button', { name: 'Hide section' }).first().click()
  await page.waitForTimeout(1500)
  log('AFTER HIDE:', JSON.stringify((await getContent()).sections.map((s) => [s.id, s.is_visible])))
  log('Hidden badge visible:', await page.getByText('Hidden — not on live site').count())
  await page.screenshot({ path: `${OUT}/r10-03-hidden-section.png`, fullPage: false })
  await page.getByRole('button', { name: 'Show section' }).first().click()
  await page.waitForTimeout(1500)
  log('AFTER SHOW:', JSON.stringify((await getContent()).sections.map((s) => [s.id, s.is_visible])))

  // ---- Reorder ------------------------------------------------------------------
  await load()
  log('\nUP disabled on first:', await page.getByRole('button', { name: 'Move section up' }).first().isDisabled())
  log('DOWN disabled on last:', await page.getByRole('button', { name: 'Move section down' }).last().isDisabled())
  await page.getByRole('button', { name: 'Move section down' }).first().click()
  await page.waitForTimeout(1800)
  log('AFTER DOWN:', JSON.stringify((await getContent()).sections.slice().sort((a, b) => a.sort_order - b.sort_order).map((s) => s.id)))
  log('SECTION BADGE now:', await page.locator('[data-section]').first().innerText().then((t) => t.split('\n')[0]))
  await page.getByRole('button', { name: 'Move section up' }).nth(1).click()
  await page.waitForTimeout(1800)
  log('AFTER UP:', JSON.stringify((await getContent()).sections.slice().sort((a, b) => a.sort_order - b.sort_order).map((s) => s.id)))

  // ---- Publish / Unpublish an item ------------------------------------------------
  await load()
  const unpub = page.getByRole('button', { name: /^Unpublish / }).first()
  const lbl = await unpub.getAttribute('aria-label')
  await unpub.click()
  await page.waitForTimeout(1500)
  log('\nUNPUBLISHED:', lbl, '| badge count:', await page.getByText('Not on your live site yet').count())
  log('server item vis:', JSON.stringify((await getContent()).sections.flatMap((s) => (s.items || []).map((i) => i.is_visible))))
  await page.screenshot({ path: `${OUT}/r10-03-unpublished.png` })
  await page.getByRole('button', { name: /^Publish / }).first().click()
  await page.waitForTimeout(1500)
  log('REPUBLISHED | badges left:', await page.getByText('Not on your live site yet').count())

  // ---- Icon picker ----------------------------------------------------------------
  await load()
  const iconBtn = page.locator('button[aria-label*="icon" i]').first()
  log('\nICONPICKER trigger count:', await page.locator('button[aria-label*="icon" i]').count(),
    '| label:', await iconBtn.getAttribute('aria-label'))
  await iconBtn.click()
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${OUT}/r10-03-iconpicker.png` })
  const opts = await page.evaluate(() => {
    const grid = document.querySelector('[role="listbox"], [role="dialog"], [role="menu"]')
    return grid ? { role: grid.getAttribute('role'), n: grid.querySelectorAll('button, [role="option"]').length } : null
  })
  log('ICONPICKER popover:', JSON.stringify(opts))
  const firstOpt = page.locator('[role="listbox"] button, [role="dialog"] button, [role="menu"] button').first()
  if (await firstOpt.count()) {
    const t = await firstOpt.innerText()
    await firstOpt.click()
    await page.waitForTimeout(1500)
    const icons = (await getContent()).sections.flatMap((s) => (s.items || []).map((i) => i.icon)).filter(Boolean)
    log('ICON PICKED:', JSON.stringify(t), '| server icons now:', JSON.stringify(icons))
  }
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  log('ICONPICKER after Escape:', await page.locator('[role="listbox"], [role="dialog"], [role="menu"]').count())

  // ---- Rating stars ------------------------------------------------------------------
  await load()
  const stars = await page.evaluate(() => [...document.querySelectorAll('button[aria-label*="star" i]')]
    .slice(0, 7).map((b) => { const r = b.getBoundingClientRect(); return { l: b.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height) } }))
  log('\nRATING STARS:', JSON.stringify(stars))
  const star3 = page.locator('button[aria-label*="star" i]').nth(2)
  if (await star3.count()) {
    await star3.click()
    await page.waitForTimeout(1500)
    log('AFTER STAR CLICK server ratings:', JSON.stringify((await getContent()).sections.flatMap((s) => (s.items || []).map((i) => i.rating)).filter((r) => r != null)))
    await page.screenshot({ path: `${OUT}/r10-03-rating.png` })
  }

  // ---- Alt text ------------------------------------------------------------------------
  await load()
  const altBtn = page.getByRole('button', { name: /^Edit Image description/i }).first()
  log('\nALT TEXT trigger count:', await page.getByRole('button', { name: /^Edit Image description/i }).count())
  if (await altBtn.count()) {
    const al = await altBtn.getAttribute('aria-label')
    await altBtn.click()
    await page.waitForTimeout(400)
    const ta = page.locator('textarea[aria-label^="Image description"]').first()
    await ta.fill('R10 alt probe')
    await ta.press('Enter')
    await page.waitForTimeout(1500)
    const alts = (await getContent()).sections.flatMap((s) => (s.items || []).map((i) => i.image_alt)).filter(Boolean)
    log('ALT saved:', al, '->', JSON.stringify(alts))
  }

  // ---- Delete confirm (dismissed) -----------------------------------------------------
  await load()
  await page.getByRole('button', { name: 'Delete section' }).first().click()
  await page.waitForTimeout(1200)
  log('\nDELETE SECTION dialog:', lastDialog)
  log('sections after dismiss:', (await getContent()).sections.length)
  lastDialog = null
  await page.getByRole('button', { name: /^Remove /i }).first().click()
  await page.waitForTimeout(1200)
  log('REMOVE ITEM dialog:', lastDialog)
  log('items after dismiss:', (await getContent()).sections.flatMap((s) => s.items || []).length)

  // ---- View site link -----------------------------------------------------------------
  await page.getByRole('link', { name: 'View site' }).click()
  await page.waitForTimeout(2500)
  log('VIEW SITE -> url:', page.url())
} finally {
  await page.request.put(`${API}/api/admin/pages/home`, { data: { site_name: originalPage.site_name, footer_tagline: originalPage.footer_tagline, title: originalPage.title, meta_description: originalPage.meta_description } })
  for (const s of originalVis) await page.request.put(`${API}/api/admin/sections/${s.id}`, { data: { is_visible: s.is_visible } })
  await page.request.post(`${API}/api/admin/sections/reorder`, { data: { orderedIds: originalOrder } }).catch((e) => log('reorder restore failed', e))
  for (const i of originalItemVis) await page.request.put(`${API}/api/admin/items/${i.id}`, { data: { is_visible: i.is_visible } })
  for (const i of originalIcons) await page.request.put(`${API}/api/admin/items/${i.id}`, { data: { icon: i.icon, rating: i.rating, image_alt: null } })
  const after = await getContent()
  log('\nRESTORED page:', JSON.stringify(after.page))
  log('RESTORED order:', JSON.stringify(after.sections.slice().sort((a, b) => a.sort_order - b.sort_order).map((s) => s.id)))
  log('ERRORS:', JSON.stringify([...new Set(errors)].slice(0, 20)))
  await browser.close()
}
