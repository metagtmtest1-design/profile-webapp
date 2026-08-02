/** Round 9 — visual close-ups, contrast probes and remaining behaviour checks. */
import { chromium } from 'playwright'

const IP = process.env.FRONTEND_IP || '172.24.0.3'
const BASE = 'http://localhost:5173'
const API = 'http://frontend:5173'
const OUT = '/app/tmp-e2e'
const log = (...a) => console.log(...a)

const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP localhost ${IP}, MAP frontend ${IP}`] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()
const getContent = async () => (await (await page.request.get(`${API}/api/admin/content`)).json())
const setVisible = (id, v) => page.request.put(`${API}/api/admin/sections/${id}`, { data: { is_visible: v } })
const original = (await getContent()).sections.map((s) => ({ id: s.id, is_visible: s.is_visible }))

try {
  // ---- admin in its SHIPPED state: four sections hidden -----------------------------
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${OUT}/r9-admin-default-1440.png`, fullPage: true })
  const hiddenCard = page.locator('[data-section]').filter({ hasText: 'Branding & More Services' }).first()
  await hiddenCard.scrollIntoViewIfNeeded(); await page.waitForTimeout(600)
  await hiddenCard.screenshot({ path: `${OUT}/r9-admin-hidden-default.png` })
  log('hidden badges in shipped state:', await page.locator('text=Hidden — not on live site').count())

  for (const s of original) if (!s.is_visible) await setVisible(s.id, 1)

  // ---- live close-ups ------------------------------------------------------------------
  for (const [w, h] of [[1440, 1000], [768, 1024], [393, 852]]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    for (const [name, sel] of [['services', '#services'], ['about', '#about'], ['testimonials', '#testimonials']]) {
      const el = page.locator(sel).first()
      if (await el.count()) {
        await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(500)
        await el.screenshot({ path: `${OUT}/r9-live-${name}-${w}.png` })
      }
    }
    const cta = page.locator('section').filter({ hasText: 'Ready to start your project?' }).last()
    await cta.scrollIntoViewIfNeeded(); await page.waitForTimeout(500)
    await cta.screenshot({ path: `${OUT}/r9-live-cta-${w}.png` })
    const gal = page.locator('section').filter({ hasText: 'Selected Projects' }).last()
    await gal.scrollIntoViewIfNeeded(); await page.waitForTimeout(700)
    await gal.screenshot({ path: `${OUT}/r9-live-gallery-${w}.png` })
    const foot = page.locator('footer')
    await foot.scrollIntoViewIfNeeded(); await page.waitForTimeout(500)
    await foot.screenshot({ path: `${OUT}/r9-live-footer-${w}.png` })
  }

  // ---- gallery hover behaviour -----------------------------------------------------------
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  const firstTile = page.locator('section').filter({ hasText: 'Selected Projects' }).last().locator('img').first()
  await firstTile.scrollIntoViewIfNeeded(); await page.waitForTimeout(400)
  await firstTile.hover()
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/r9-gallery-hover.png`, fullPage: false })

  // ---- contrast probes ---------------------------------------------------------------------
  const contrast = await page.evaluate(() => {
    const lum = (rgb) => {
      const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const parse = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number)
    const bgOf = (el) => {
      let e = el
      while (e) {
        const c = getComputedStyle(e).backgroundColor
        if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return parse(c)
        e = e.parentElement
      }
      return [255, 255, 255]
    }
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2) }
    const targets = [
      ['hero eyebrow', '#main .uppercase'],
      ['hero body', '#main p'],
      ['booking hint', '#calendar p'],
      ['weekend label', '#calendar button[disabled] span'],
      ['manage hint', 'form:has(#manage-bookings-email) p'],
      ['footer blurb', 'footer p'],
      ['footer copyright', 'footer .text-xs'],
      ['slot picker note', '#slot-picker'],
    ]
    const out = []
    for (const [name, sel] of targets) {
      const el = document.querySelector(sel)
      if (!el) { out.push({ name, missing: true }); continue }
      const cs = getComputedStyle(el)
      out.push({ name, color: cs.color, size: cs.fontSize, weight: cs.fontWeight, ratio: ratio(parse(cs.color), bgOf(el)) })
    }
    return out
  })
  log('CONTRAST:', JSON.stringify(contrast, null, 1))

  // ---- heading order ---------------------------------------------------------------------------
  log('HEADINGS:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('h1,h2,h3')].map((h) => h.tagName + ': ' + h.innerText.trim().slice(0, 40)))))

  // ---- does the shipped (default) page have any nav at all? --------------------------------------
  for (const s of original) await setVisible(s.id, s.is_visible)
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  log('default-state 393 hamburger present:', await page.locator('button[aria-label="Open menu"]').count())
  log('default-state nav links:', JSON.stringify(await page.locator('nav a').allInnerTexts()))
  await page.screenshot({ path: `${OUT}/r9-default-393-top.png`, fullPage: false })
} finally {
  for (const s of original) await setVisible(s.id, s.is_visible)
  log('restored:', JSON.stringify((await getContent()).sections.map((s) => [s.id, s.is_visible])))
}
await browser.close()
