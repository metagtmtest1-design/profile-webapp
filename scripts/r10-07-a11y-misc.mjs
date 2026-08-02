/**
 * Round 10 — keyboard focus, contrast, the live look of a freshly added section,
 * unknown routes, and legible admin close-ups at 393/768.
 */
import { chromium } from 'playwright'

const IP = process.env.FRONTEND_IP || '172.24.0.3'
const BASE = 'http://localhost:5173'
const API = 'http://frontend:5173'
const OUT = '/app/tmp-e2e'
const log = (...a) => console.log(...a)

const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP localhost ${IP}, MAP frontend ${IP}`] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

const getContent = async () => (await (await page.request.get(`${API}/api/admin/content`)).json())
const before = await getContent()
const originalVis = before.sections.map((s) => ({ id: s.id, is_visible: s.is_visible }))
const originalSectionIds = before.sections.map((s) => s.id)

try {
  // ---- keyboard: tab order + visible focus ------------------------------------------
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2200)
  log('=== KEYBOARD TAB ORDER (public, 1440) ===')
  const seen = []
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab')
    await page.waitForTimeout(120)
    seen.push(await page.evaluate(() => {
      const e = document.activeElement
      if (!e || e === document.body) return { t: 'BODY' }
      const cs = getComputedStyle(e)
      const r = e.getBoundingClientRect()
      return {
        t: e.tagName.toLowerCase(),
        text: (e.innerText || e.getAttribute('aria-label') || e.id || '').trim().slice(0, 32).replace(/\s+/g, ' '),
        outline: cs.outlineStyle === 'none' ? null : `${cs.outlineWidth} ${cs.outlineColor}`,
        shadow: cs.boxShadow === 'none' ? null : cs.boxShadow.slice(0, 40),
        onScreen: r.top >= -2 && r.bottom <= window.innerHeight + 2,
      }
    }))
  }
  for (const s of seen) log(' ', JSON.stringify(s))
  const noFocusRing = seen.filter((s) => s.t !== 'BODY' && !s.outline && !s.shadow)
  log('NO VISIBLE FOCUS RING:', noFocusRing.length, JSON.stringify(noFocusRing.map((s) => s.text)))

  // skip link
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.keyboard.press('Tab')
  await page.waitForTimeout(400)
  log('\nSKIP LINK on focus:', await page.evaluate(() => {
    const e = document.activeElement
    const r = e.getBoundingClientRect()
    return JSON.stringify({ text: e.innerText.trim(), w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) })
  }))
  await page.screenshot({ path: `${OUT}/r10-07-skiplink.png`, clip: { x: 0, y: 0, width: 700, height: 140 } })

  // ---- contrast on the main text colours ---------------------------------------------
  log('\n=== CONTRAST (public) ===')
  const contrast = await page.evaluate(() => {
    const lum = (c) => {
      const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const parse = (s) => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number)
    const bgOf = (el) => {
      let e = el
      while (e) { const b = getComputedStyle(e).backgroundColor; if (b && !/rgba\(0, 0, 0, 0\)|transparent/.test(b)) return parse(b); e = e.parentElement }
      return [255, 255, 255]
    }
    const out = []
    const targets = [...document.querySelectorAll('p, a, span, div, h1, h2, h3, button, label')]
      .filter((e) => e.children.length === 0 && e.innerText && e.innerText.trim().length > 3)
    for (const e of targets) {
      const cs = getComputedStyle(e)
      const r = e.getBoundingClientRect()
      if (r.width === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue
      const fg = parse(cs.color), bg = bgOf(e)
      const l1 = lum(fg), l2 = lum(bg)
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
      const px = parseFloat(cs.fontSize)
      const large = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight) >= 700)
      const min = large ? 3 : 4.5
      if (ratio < min) out.push({ text: e.innerText.trim().slice(0, 40), ratio: ratio.toFixed(2), min, px, color: cs.color })
    }
    return out
  })
  log('CONTRAST FAILURES:', contrast.length)
  for (const c of contrast.slice(0, 15)) log(' ', JSON.stringify(c))

  // ---- unknown route ------------------------------------------------------------------
  await page.goto(`${BASE}/does-not-exist`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  log('\n=== UNKNOWN ROUTE /does-not-exist ===')
  log('title:', await page.title())
  log('body (200):', (await page.evaluate(() => document.body.innerText)).slice(0, 200).replace(/\n/g, ' | '))
  await page.screenshot({ path: `${OUT}/r10-07-404.png` })

  // ---- a freshly added section on the LIVE site -----------------------------------------
  log('\n=== NEW SECTION GOES LIVE? ===')
  const created = await page.request.post(`${API}/api/admin/sections`, { data: { type: 'cards-grid', heading: 'R10 Live Check' } })
  const cj = await created.json()
  const newId = cj?.section?.id || cj?.id
  log('created section:', newId, 'is_visible:', (await getContent()).sections.find((s) => s.id === newId)?.is_visible)
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2200)
  log('appears on live page:', await page.getByText('R10 Live Check').count())
  const shape = await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((e) => /R10 Live Check/.test(e.innerText))
    if (!h) return 'not rendered'
    const sec = h.closest('section')
    const r = sec.getBoundingClientRect()
    return { height: Math.round(r.height), text: sec.innerText.replace(/\n/g, ' | ').slice(0, 160) }
  })
  log('live shape:', JSON.stringify(shape))
  await page.screenshot({ path: `${OUT}/r10-07-empty-section-live.png`, fullPage: true })
  await page.request.delete(`${API}/api/admin/sections/${newId}`)
  log('cleaned up:', !(await getContent()).sections.some((s) => s.id === newId))

  // ---- admin close-ups at 393 / 768 -------------------------------------------------------
  for (const [w, tag] of [[393, 'mobile'], [768, 'tablet']]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `${OUT}/r10-07-admin-${tag}-top.png` })
    await page.locator('[data-section]').first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/r10-07-admin-${tag}-section.png` })
    const hdr = await page.evaluate(() => {
      const strip = document.querySelector('[data-section] > div')
      const r = strip.getBoundingClientRect()
      return { h: Math.round(r.height), text: strip.innerText.replace(/\n/g, ' | ') }
    })
    log(`\nADMIN ${tag} section header strip:`, JSON.stringify(hdr))
  }
} finally {
  for (const s of originalVis) await page.request.put(`${API}/api/admin/sections/${s.id}`, { data: { is_visible: s.is_visible } })
  const fin = await getContent()
  for (const s of fin.sections) if (!originalSectionIds.includes(s.id)) await page.request.delete(`${API}/api/admin/sections/${s.id}`).catch(() => {})
  log('\nFINAL sections:', (await getContent()).sections.length)
  await browser.close()
}
