/**
 * Compares the admin preview against the live landing page section by section:
 * heading font-size and the section's vertical padding. The admin hardcoded text-3xl
 * and py-16 where the live components use text-3xl lg:text-4xl and py-20 lg:py-24,
 * so the preview understated both by 25% and 33% at desktop.
 */
import { chromium } from 'playwright'

const BASE = 'http://frontend:5173'
const browser = await chromium.launch()

const measure = async (page, url) => {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  return page.evaluate(() => {
    const out = {}
    for (const h of document.querySelectorAll('h2')) {
      // The admin h2 wraps an EditableText, whose "✎ Edit" hint and "Saved ✓" toast
      // are part of textContent — strip them so the two pages key on the same heading.
      const text = (h.textContent || '').replace(/✎ Edit|Saved ✓/g, '').trim().slice(0, 28)
      if (!text) continue
      // Walk to the element that owns the section's vertical padding.
      let n = h
      let pad = null
      while (n && n !== document.body) {
        const cs = getComputedStyle(n)
        if (parseFloat(cs.paddingTop) >= 48) { pad = cs.paddingTop; break }
        n = n.parentElement
      }
      // The nearest opaque background and the section's own grid gap. Both diverged
      // silently: every admin section rendered on white, losing the live page's
      // alternating white/slate-50 rhythm, and two admin grids used gap-4.
      let bgNode = h
      let bg = 'none'
      while (bgNode && bgNode !== document.body) {
        const c = getComputedStyle(bgNode).backgroundColor
        if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) { bg = c; break }
        bgNode = bgNode.parentElement
      }
      const section = n || h.closest('section') || h.parentElement
      const grid = section ? section.querySelector('.grid') : null
      out[text] = {
        size: getComputedStyle(h).fontSize,
        pad,
        bg,
        gap: grid ? getComputedStyle(grid).gap : 'n/a',
      }
    }
    return out
  })
}

for (const width of [1440, 393]) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } })
  const land = await measure(page, `${BASE}/`)
  const admin = await measure(page, `${BASE}/admin`)
  await page.screenshot({ path: `/app/tmp-e2e/fix-admin-${width}.png`, fullPage: true })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `/app/tmp-e2e/fix-land-${width}.png`, fullPage: true })

  console.log(`\n=== ${width}px`)
  for (const k of Object.keys(land)) {
    const a = admin[k]
    if (!a) { console.log(`  (admin has no h2 "${k}")`); continue }
    const l = land[k]
    const ok = l.size === a.size && l.pad === a.pad && l.bg === a.bg && l.gap === a.gap
    console.log(
      `  ${ok ? 'MATCH' : 'DIFF '} "${k}"  size ${l.size}/${a.size}  pad ${l.pad}/${a.pad}  bg ${l.bg}/${a.bg}  gap ${l.gap}/${a.gap}`
    )
  }
  await page.close()
}

await browser.close()
