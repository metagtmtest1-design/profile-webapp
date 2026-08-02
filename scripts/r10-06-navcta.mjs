/**
 * Round 10 — is the sticky-nav "Book a free call" CTA legible at 393px when the
 * hamburger is also present? Measure the text, not just the pill.
 */
import { chromium } from 'playwright'

const IP = process.env.FRONTEND_IP || '172.24.0.3'
const BASE = 'http://localhost:5173'
const API = 'http://frontend:5173'
const OUT = '/app/tmp-e2e'
const log = (...a) => console.log(...a)

const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP localhost ${IP}, MAP frontend ${IP}`] })
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()

const setVisible = (id, v) => page.request.put(`${API}/api/admin/sections/${id}`, { data: { is_visible: v } })
const original = (await (await page.request.get(`${API}/api/admin/content`)).json()).sections.map((s) => ({ id: s.id, is_visible: s.is_visible }))

try {
  for (const s of original) if (!s.is_visible) await setVisible(s.id, 1)

  for (const w of [320, 360, 393, 430, 640, 768]) {
    await page.setViewportSize({ width: w, height: 852 })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    const nav = await page.evaluate(() => {
      const bar = document.querySelector('nav')
      const wordmark = bar.querySelector('div')
      const cta = [...bar.querySelectorAll('a')].find((a) => a.getAttribute('href') === '#calendar')
      const burger = bar.querySelector('button')
      const box = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) } }
      // width the CTA's own text occupies vs the space it has inside its padding
      let textW = null, clipped = null
      if (cta) {
        const range = document.createRange()
        range.selectNodeContents(cta)
        textW = Math.round(range.getBoundingClientRect().width)
        clipped = cta.scrollWidth > cta.clientWidth + 1
      }
      return {
        navH: Math.round(bar.getBoundingClientRect().height),
        wordmark: { ...box(wordmark), text: wordmark.innerText.trim() },
        cta: cta ? { ...box(cta), text: JSON.stringify(cta.innerText), textW, clipped, scrollW: cta.scrollWidth, clientW: cta.clientWidth, color: getComputedStyle(cta).color, bg: getComputedStyle(cta).backgroundColor, overflow: getComputedStyle(cta).overflow } : null,
        burger: burger ? { ...box(burger), label: burger.getAttribute('aria-label') } : null,
        rightEdge: window.innerWidth,
      }
    })
    log(`\n=== ${w}px ===`)
    log(JSON.stringify(nav, null, 1))
    await page.locator('nav').screenshot({ path: `${OUT}/r10-06-nav-${w}.png` })
  }
} finally {
  for (const s of original) await setVisible(s.id, s.is_visible)
  log('\nrestored:', JSON.stringify((await (await page.request.get(`${API}/api/admin/content`)).json()).sections.map((s) => [s.id, s.is_visible])))
  await browser.close()
}
