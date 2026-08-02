/**
 * Checks the four round-3 parity claims against the running app rather than taking
 * them at face value. Prints raw measurements for each.
 */
import { chromium } from 'playwright'

const BASE = 'http://frontend:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })

const opaqueBg = (el) => {
  let n = el
  while (n && n !== document.body) {
    const c = getComputedStyle(n).backgroundColor
    if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c
    n = n.parentElement
  }
  return 'none'
}

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
const landing = await page.evaluate((fn) => {
  const opaque = eval('(' + fn + ')')
  const out = {}
  for (const id of ['services', 'about', 'testimonials', 'work', 'calendar']) {
    const el = document.getElementById(id)
    if (!el) { out[id] = null; continue }
    const cs = getComputedStyle(el)
    out[id] = { bg: opaque(el), padTop: cs.paddingTop }
  }
  const grid = document.querySelector('#services .grid')
  out.servicesGap = grid ? getComputedStyle(grid).gap : 'n/a'
  return out
}, opaqueBg.toString())

await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
await page.waitForTimeout(2500)
const admin = await page.evaluate((fn) => {
  const opaque = eval('(' + fn + ')')
  const out = { sections: [] }
  for (const sec of document.querySelectorAll('[data-section]')) {
    const badge = sec.querySelector('span')
    const label = badge ? badge.textContent.trim() : '?'
    // The content wrapper, NOT the header strip — the strip is py-3 bg-slate-50 and
    // matching [class*="py-"] first is what made padding look like 12px everywhere.
    const inner = sec.querySelector('[class*="py-20"]')
    const h2 = sec.querySelector('h2')
    out.sections.push({
      label: label.slice(0, 40),
      innerBg: inner ? opaque(inner) : 'none',
      innerPadTop: inner ? getComputedStyle(inner).paddingTop : 'n/a',
      heading: h2 ? h2.textContent.replace(/✎ Edit|Saved ✓/g, '').trim().slice(0, 30) : '(no h2)',
      visible: sec.getBoundingClientRect().height > 0,
      height: Math.round(sec.getBoundingClientRect().height),
    })
  }
  const grid = document.querySelector('[data-section] .grid')
  const grids = [...document.querySelectorAll('[data-section] .grid')].map((g) => getComputedStyle(g).gap)
  out.grids = grids
  // Claim: "Testimonials section completely invisible in the admin preview"
  const t = [...document.querySelectorAll('[data-section]')].find((s) => /Testimonials/.test(s.textContent))
  out.testimonials = t
    ? { found: true, height: Math.round(t.getBoundingClientRect().height), cards: t.querySelectorAll('[aria-label^="Unpublish"], [aria-label^="Publish"]').length }
    : { found: false }
  return out
}, opaqueBg.toString())

console.log('LANDING section backgrounds + padding:')
for (const [k, v] of Object.entries(landing)) {
  if (k === 'servicesGap') continue
  console.log(`  ${k.padEnd(13)} bg=${v ? v.bg : 'ABSENT'}  padTop=${v ? v.padTop : '-'}`)
}
console.log(`  services grid gap = ${landing.servicesGap}`)

console.log('\nADMIN sections:')
for (const s of admin.sections) {
  console.log(`  ${s.label.padEnd(34)} bg=${s.innerBg.padEnd(22)} padTop=${String(s.innerPadTop).padEnd(6)} h=${s.height}px  "${s.heading}"`)
}
console.log(`  admin grid gaps = ${JSON.stringify(admin.grids)}`)
console.log(`\nCLAIM "Testimonials invisible in admin": ${JSON.stringify(admin.testimonials)}`)

await browser.close()
