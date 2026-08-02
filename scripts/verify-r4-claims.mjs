/**
 * Checks round 4's two "1.00:1 border contrast" claims. Both buttons have solid fills
 * and no border, so a checker that reads border-color without checking border-width
 * sees currentColor against a same-coloured backdrop and reports exactly 1.00:1.
 */
import { chromium } from 'playwright'

const BASE = 'http://frontend:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)

const out = await page.evaluate(() => {
  const lum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const parse = (c) => {
    const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/)
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null
  }
  const ratio = (x, y) => {
    const a = lum(x.r, x.g, x.b), b = lum(y.r, y.g, y.b)
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
  }
  const backdrop = (el) => {
    let n = el.parentElement
    while (n) {
      const c = parse(getComputedStyle(n).backgroundColor)
      if (c && c.a > 0.5) return c
      n = n.parentElement
    }
    return { r: 255, g: 255, b: 255, a: 1 }
  }
  const targets = [
    ['CTA banner button', '#contact a, section a[href="#calendar"].bg-white, .bg-slate-900 a'],
    ['Find my bookings', 'button[type="submit"]'],
  ]
  const res = []
  for (const [name, sel] of targets) {
    for (const el of document.querySelectorAll(sel)) {
      const cs = getComputedStyle(el)
      const fill = parse(cs.backgroundColor)
      const bg = backdrop(el)
      const border = parse(cs.borderTopColor)
      res.push({
        name,
        text: (el.textContent || '').trim().slice(0, 28),
        borderWidth: cs.borderTopWidth,
        borderColor: cs.borderTopColor,
        fill: cs.backgroundColor,
        backdrop: `rgb(${bg.r},${bg.g},${bg.b})`,
        fillVsBackdrop: fill && fill.a > 0.5 ? +ratio(fill, bg).toFixed(2) : null,
        borderVsBackdrop: border ? +ratio(border, bg).toFixed(2) : null,
      })
    }
  }
  return res
})

for (const r of out) {
  console.log(`\n${r.name} — "${r.text}"`)
  console.log(`  border-width : ${r.borderWidth}   border-color: ${r.borderColor}`)
  console.log(`  fill ${r.fill} on backdrop ${r.backdrop}`)
  console.log(`  FILL vs backdrop   = ${r.fillVsBackdrop}:1   <-- what actually identifies the control`)
  console.log(`  border vs backdrop = ${r.borderVsBackdrop}:1  (meaningless when border-width is 0)`)
}
await browser.close()
