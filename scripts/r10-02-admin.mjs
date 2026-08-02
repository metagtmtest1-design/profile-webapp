/**
 * Round 10 — /admin: inventory every control at 1440/768/393, then click the
 * reversible ones and verify the effect actually lands (server + live page).
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
page.on('dialog', (d) => { log('DIALOG:', d.type(), '|', d.message()); d.dismiss() })

const getContent = async () => (await (await page.request.get(`${API}/api/admin/content`)).json())
const before = await getContent()
const originalPage = { ...before.page }
const originalVis = before.sections.map((s) => ({ id: s.id, is_visible: s.is_visible }))
const originalOrder = before.sections.slice().sort((a, b) => a.sort_order - b.sort_order).map((s) => s.id)
log('ORIGINAL PAGE:', JSON.stringify(originalPage))
log('ORIGINAL ORDER:', JSON.stringify(originalOrder))

try {
  for (const [w, h, tag] of [[1440, 1200, 'desktop'], [768, 1024, 'tablet'], [393, 852, 'mobile']]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    log(`\n===== ADMIN ${tag} ${w}px =====`)
    await page.screenshot({ path: `${OUT}/r10-02-admin-${tag}-full.png`, fullPage: true })

    const controls = await page.evaluate(() => {
      const out = []
      for (const e of document.querySelectorAll('a[href], button, [role="button"], input:not([type=file]), select, textarea')) {
        const r = e.getBoundingClientRect()
        const cs = getComputedStyle(e)
        if (cs.display === 'none' || cs.visibility === 'hidden' || (r.width === 0 && r.height === 0)) continue
        out.push({
          tag: e.tagName.toLowerCase(),
          text: (e.innerText || e.getAttribute('aria-label') || e.getAttribute('placeholder') || '').trim().slice(0, 40).replace(/\s+/g, ' '),
          w: Math.round(r.width), h: Math.round(r.height), disabled: e.disabled === true,
        })
      }
      return out
    })
    log('CONTROL COUNT:', controls.length)
    const counts = {}
    for (const c of controls) counts[c.text] = (counts[c.text] || 0) + 1
    log('BY LABEL:', JSON.stringify(counts))
    log('TAP < 40px:', JSON.stringify(controls.filter((c) => !c.disabled && (c.h < 40 || c.w < 40)).slice(0, 30)))

    const overflow = await page.evaluate(() => {
      const bad = []
      for (const e of document.querySelectorAll('*')) {
        const r = e.getBoundingClientRect()
        if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) bad.push({ t: e.tagName.toLowerCase(), c: (e.className || '').toString().slice(0, 50), l: Math.round(r.left), r: Math.round(r.right) })
      }
      return { docW: document.documentElement.scrollWidth, winW: window.innerWidth, bad: bad.slice(0, 6) }
    })
    log('OVERFLOW:', JSON.stringify(overflow))
  }

  // ================= interactions at 1440 =================
  await page.setViewportSize({ width: 1440, height: 1200 })
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  log('\n===== ADMIN INTERACTIONS =====')

  // -- Check storage
  const storage = page.getByRole('button', { name: /Check storage/i })
  await storage.click()
  await page.waitForTimeout(2500)
  log('STORAGE BUTTON after click:', (await storage.innerText().catch(() => '?')).trim())
  log('STORAGE PANEL:', await page.evaluate(() => {
    const el = [...document.querySelectorAll('div')].find((d) => /images stored/.test(d.innerText) && d.innerText.length < 120)
    return el ? el.innerText.replace(/\n/g, ' | ') : 'NOT SHOWN'
  }))
  await page.screenshot({ path: `${OUT}/r10-02-storage.png` })

  // -- Refresh
  await page.getByRole('button', { name: /Reload content from the server/i }).click()
  await page.waitForTimeout(1500)
  log('REFRESH: still rendering sections =', await page.locator('[data-section]').count())

  // -- Add section validation (empty heading)
  await page.getByRole('button', { name: 'Add section' }).click()
  await page.waitForTimeout(600)
  log('ADD SECTION empty:', await page.evaluate(() => {
    const el = [...document.querySelectorAll('[role="alert"]')].map((e) => e.innerText.trim())
    return JSON.stringify(el)
  }))
  await page.screenshot({ path: `${OUT}/r10-02-addsection-validation.png` })

  // -- "Your site" card: edit site name, verify live page, restore
  const nameField = page.getByRole('button', { name: /Site name/i }).first()
  const nameCount = await nameField.count()
  log('SITE NAME editable control count:', nameCount)
  if (nameCount) {
    await nameField.click()
    await page.waitForTimeout(400)
    const input = page.locator('input[aria-label="Site name"], textarea[aria-label="Site name"]').first()
    log('SITE NAME input appeared:', await input.count())
    await input.fill('Round Ten Studio')
    await input.press('Enter')
    await page.waitForTimeout(1500)
    const c = await getContent()
    log('SITE NAME saved server-side:', JSON.stringify(c.page.site_name))

    const pub = await ctx.newPage()
    await pub.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await pub.waitForTimeout(1500)
    log('LIVE header wordmark:', (await pub.locator('header').innerText()).split('\n')[0])
    log('LIVE footer:', (await pub.locator('footer').innerText()).replace(/\n/g, ' | ').slice(0, 200))
    log('LIVE title:', await pub.title())
    await pub.screenshot({ path: `${OUT}/r10-02-renamed-header.png` })
    await pub.close()

    // -- required-field validation: clear it
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    await page.getByRole('button', { name: /Site name/i }).first().click()
    await page.waitForTimeout(300)
    const i2 = page.locator('input[aria-label="Site name"]').first()
    await i2.fill('')
    await i2.press('Enter')
    await page.waitForTimeout(900)
    log('SITE NAME cleared -> alerts:', await page.evaluate(() => JSON.stringify([...document.querySelectorAll('[role="alert"]')].map((e) => e.innerText.trim()))))
    log('SITE NAME cleared -> server:', JSON.stringify((await getContent()).page.site_name))
    await page.screenshot({ path: `${OUT}/r10-02-sitename-required.png` })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
  }

  // -- Escape cancels an edit
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2200)
  await page.getByRole('button', { name: /Browser tab title/i }).first().click()
  await page.waitForTimeout(300)
  const t = page.locator('input[aria-label="Browser tab title"]').first()
  await t.fill('SHOULD NOT SAVE')
  await t.press('Escape')
  await page.waitForTimeout(900)
  log('ESCAPE cancels:', JSON.stringify((await getContent()).page.title))

  // -- Hide / Show a section, verify live page
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(2200)
  const hideBtn = page.getByRole('button', { name: 'Hide section' }).first()
  log('HIDE buttons:', await page.getByRole('button', { name: 'Hide section' }).count(), 'SHOW buttons:', await page.getByRole('button', { name: 'Show section' }).count())
  await hideBtn.click()
  await page.waitForTimeout(1500)
  log('AFTER HIDE server:', JSON.stringify((await getContent()).sections.map((s) => s.is_visible)))
  await page.screenshot({ path: `${OUT}/r10-02-hidden-section.png` })
  await page.getByRole('button', { name: 'Show section' }).first().click()
  await page.waitForTimeout(1500)
  log('AFTER SHOW server:', JSON.stringify((await getContent()).sections.map((s) => s.is_visible)))

  // -- Move a section down then back up
  const down = page.getByRole('button', { name: 'Move section down' }).first()
  await down.click()
  await page.waitForTimeout(1800)
  const movedOrder = (await getContent()).sections.slice().sort((a, b) => a.sort_order - b.sort_order).map((s) => s.id)
  log('AFTER DOWN:', JSON.stringify(movedOrder))
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(2200)
  await page.getByRole('button', { name: 'Move section up' }).nth(0).click()
  await page.waitForTimeout(1800)
  log('AFTER UP:', JSON.stringify((await getContent()).sections.slice().sort((a, b) => a.sort_order - b.sort_order).map((s) => s.id)))
  log('UP disabled on first:', await page.getByRole('button', { name: 'Move section up' }).first().isDisabled())
  log('DOWN disabled on last:', await page.getByRole('button', { name: 'Move section down' }).last().isDisabled())

  // -- Publish/Unpublish an item round-trip
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(2200)
  const unpub = page.getByRole('button', { name: /^Unpublish / }).first()
  if (await unpub.count()) {
    const label = await unpub.getAttribute('aria-label')
    await unpub.click()
    await page.waitForTimeout(1500)
    log('UNPUBLISHED:', label, '| badge shown:', await page.getByText('Not on your live site yet').count())
    await page.screenshot({ path: `${OUT}/r10-02-unpublished-item.png` })
    await page.getByRole('button', { name: /^Publish / }).first().click()
    await page.waitForTimeout(1500)
    log('REPUBLISHED | badges left:', await page.getByText('Not on your live site yet').count())
  } else log('UNPUBLISH: no button found')

  // -- Icon picker
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(2200)
  const iconBtns = page.locator('button[aria-label*="icon" i]')
  log('ICONPICKER buttons:', await iconBtns.count())
  if (await iconBtns.count()) {
    await iconBtns.first().click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/r10-02-iconpicker-open.png` })
    log('ICONPICKER open, options:', await page.locator('[role="dialog"] button, [role="listbox"] button, [role="menu"] button').count())
    await page.keyboard.press('Escape')
    await page.waitForTimeout(400)
    log('ICONPICKER after Escape, options:', await page.locator('[role="dialog"] button, [role="listbox"] button, [role="menu"] button').count())
  }

  // -- Rating picker sizes
  const stars = await page.evaluate(() => {
    const out = []
    for (const b of document.querySelectorAll('button[aria-label*="star" i]')) {
      const r = b.getBoundingClientRect()
      out.push({ l: b.getAttribute('aria-label'), w: Math.round(r.width), h: Math.round(r.height) })
    }
    return out.slice(0, 8)
  })
  log('RATING STARS:', JSON.stringify(stars))

  // -- Delete confirm is dismissable (dialog handler dismisses)
  const del = page.getByRole('button', { name: 'Delete section' }).first()
  await del.click()
  await page.waitForTimeout(1200)
  log('AFTER DELETE-DISMISS sections:', (await getContent()).sections.length)

  await page.screenshot({ path: `${OUT}/r10-02-admin-final.png`, fullPage: true })
} finally {
  // restore page record + visibility + order
  await page.request.put(`${API}/api/admin/pages/home`, {
    data: { site_name: originalPage.site_name, footer_tagline: originalPage.footer_tagline, title: originalPage.title, meta_description: originalPage.meta_description },
  })
  for (const s of originalVis) await page.request.put(`${API}/api/admin/sections/${s.id}`, { data: { is_visible: s.is_visible } })
  await page.request.post(`${API}/api/admin/sections/reorder`, { data: { orderedIds: originalOrder } }).catch(() => {})
  const after = await getContent()
  log('\nRESTORED page:', JSON.stringify(after.page))
  log('RESTORED order:', JSON.stringify(after.sections.slice().sort((a, b) => a.sort_order - b.sort_order).map((s) => s.id)))
  log('RESTORED vis:', JSON.stringify(after.sections.map((s) => [s.id, s.is_visible])))
  log('ERRORS:', JSON.stringify([...new Set(errors)].slice(0, 20)))
  await browser.close()
}
