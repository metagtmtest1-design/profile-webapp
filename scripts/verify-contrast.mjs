/**
 * Verifies WCAG 2.1 SC 1.4.11 (3:1 non-text contrast) for the boundary of every
 * interactive control on the public page and the admin, plus touch-target sizes at 393px.
 *
 * Walks up from each control to find the first ancestor with a non-transparent
 * background — comparing a border against `transparent` is what let the earlier
 * hairlines look fine on paper.
 */
import { chromium } from 'playwright'

const BASE = 'http://frontend:5173'
const browser = await chromium.launch()

const AUDIT = () => {
  const lum = (r, g, b) => {
    const f = (c) => {
      c /= 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const parse = (c) => {
    const m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/)
    if (!m) return null
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] }
  }
  const ratio = (x, y) => {
    const a = lum(x.r, x.g, x.b)
    const b = lum(y.r, y.g, y.b)
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

  const out = []
  const controls = document.querySelectorAll('button, a, input, select, textarea, [role="button"]')
  for (const el of controls) {
    const cs = getComputedStyle(el)
    const box = el.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) continue
    if (el.disabled) continue // disabled controls are exempt from 1.4.11
    if (cs.borderTopWidth === '0px') continue

    const border = parse(cs.borderTopColor)
    if (!border || border.a === 0) continue
    const fill = parse(cs.backgroundColor)
    const bg = backdrop(el)

    // If the control has its own opaque fill that already separates it, the fill is
    // the boundary signal; otherwise the border must carry it.
    const fillRatio = fill && fill.a > 0.5 ? ratio(fill, bg) : 1
    const borderRatio = ratio(border, fill && fill.a > 0.5 ? fill : bg)
    const best = Math.max(fillRatio, borderRatio)

    out.push({
      label: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 44),
      tag: el.tagName.toLowerCase(),
      borderColor: cs.borderTopColor,
      backdrop: `rgb(${bg.r},${bg.g},${bg.b})`,
      ratio: +best.toFixed(2),
      w: Math.round(box.width),
      h: Math.round(box.height),
      pass: best >= 3,
    })
  }
  return out
}

let failures = 0
let small = 0

/**
 * Reveals UI that only exists after an interaction. A load-time-only sweep reported
 * "0 failures" while the whole SlotPicker — which appears only once a day is clicked —
 * still had 1.23:1 borders.
 */
const revealHiddenUi = async (page, name) => {
  if (name === 'landing') {
    const day = page.locator('button[aria-label*="slots available"]').first()
    if (await day.count()) {
      await day.click()
      await page.waitForTimeout(800)
      // Park the pointer away from the grid: a hovered control reports its hover
      // border, which is dark, and would mask the real default-state ratio.
      await page.mouse.move(0, 0)
      await page.waitForTimeout(300)
    }
  } else {
    const icon = page.locator('button[aria-label^="Change the icon"]').first()
    if (await icon.count()) {
      await icon.click()
      await page.waitForTimeout(400)
    }
    const edit = page.locator('button[aria-label^="Edit "]').first()
    if (await edit.count()) {
      await edit.click()
      await page.waitForTimeout(400)
    }
    await page.mouse.move(0, 0)
  }
}

for (const [name, url] of [['landing', `${BASE}/`], ['admin', `${BASE}/admin`]]) {
  for (const width of [1440, 393]) {
    const page = await browser.newPage({ viewport: { width, height: width === 393 ? 850 : 1000 } })
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    await revealHiddenUi(page, name)
    const rows = await page.evaluate(AUDIT)

    const bad = rows.filter((r) => !r.pass)
    // Dedupe by label+colour so 21 identical calendar cells report once.
    const seen = new Set()
    const uniq = bad.filter((r) => {
      const k = r.label + r.borderColor + r.backdrop
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    failures += uniq.length
    console.log(`\n${name} @${width} — ${rows.length} controls, ${bad.length} below 3:1 (${uniq.length} distinct)`)
    for (const r of uniq.slice(0, 12)) {
      console.log(`  FAIL ${r.ratio}:1  <${r.tag}> "${r.label}"  border=${r.borderColor} on ${r.backdrop}`)
    }

    if (width === 393) {
      const tiny = rows.filter((r) => r.w < 44 || r.h < 44)
      const tseen = new Set()
      const tuniq = tiny.filter((r) => (tseen.has(r.label) ? false : (tseen.add(r.label), true)))
      small += tuniq.length
      console.log(`  touch targets under 44px: ${tiny.length} (${tuniq.length} distinct)`)
      for (const r of tuniq.slice(0, 30)) console.log(`    SMALL ${r.w}x${r.h}  "${r.label}"`)
    }
    await page.close()
  }
}

console.log(`\n=== ${failures} distinct contrast failures, ${small} distinct undersized targets`)
await browser.close()
process.exit(failures === 0 ? 0 : 1)
