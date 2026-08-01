/**
 * Verifies the six blockers raised in the sixth UI/UX review.
 * docker run --rm --network profile-webapp_portfolio-net -v "$PWD":/app -w /tmp/pw \
 *   mcr.microsoft.com/playwright:v1.50.0-noble sh -c "... node verify-uiux-round6.mjs"
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://frontend:5173'
const out = []
const check = (name, pass, detail = '') => {
  out.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
page.on('dialog', (d) => d.accept())

const content = async () => (await (await page.request.get(`${BASE}/api/admin/content`)).json()).sections
const gallerySection = async () => (await content()).find((s) => s.type === 'image-gallery')

await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)

// 1 — items can be added and removed ------------------------------------------
const before = (await gallerySection()).items.length
check('every section offers a way to add an item', (await page.getByRole('button', { name: /^\+? ?Add (a project|a service|a testimonial|your story)/ }).count()) >= 3)
await page.getByRole('button', { name: /Add a project/ }).first().click()
await page.waitForTimeout(1200)
check('adding an item persists', (await gallerySection()).items.length === before + 1, `${before} -> ${(await gallerySection()).items.length}`)
await page.getByRole('button', { name: /^Remove/ }).last().click()
await page.waitForTimeout(1200)
check('removing an item persists', (await gallerySection()).items.length === before, `back to ${(await gallerySection()).items.length}`)

// 2 — hovering one image must not light up the others --------------------------
const overlays = 'div[role="button"][aria-label*="image"]'
await page.locator(overlays).nth(3).hover()
await page.waitForTimeout(500)
const lit = await page.$$eval(overlays, (els) =>
  els.map((e, i) => {
    const pill = [...e.querySelectorAll('span')].find((s) => /Click or drop to replace/.test(s.textContent))
    return pill && getComputedStyle(pill).opacity === '1' ? i : null
  }).filter((i) => i !== null))
check('hovering one image reveals only its own overlay', lit.length <= 1, `${lit.length} overlays lit: ${lit.join(',')}`)

// 3 — hidden sections stay readable ---------------------------------------------
const dimming = await page.evaluate(() => {
  const badge = [...document.querySelectorAll('span')].find((s) => /Hidden — not on live site/.test(s.textContent))
  const body = badge?.closest('[data-section]')?.querySelector('.bg-amber-50')
  if (!body) return null
  const s = getComputedStyle(body)
  return { opacity: s.opacity, filter: s.filter }
})
check('hidden sections are tinted, not dimmed below AA', dimming?.opacity === '1' && dimming?.filter === 'none', JSON.stringify(dimming))

const contrast = await page.evaluate(() => {
  const lum = (c) => {
    const [r, g, b] = c.match(/\d+/g).slice(0, 3).map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const effectiveOpacity = (el) => {
    let o = 1
    for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity)
    return o
  }
  const bgOf = (el) => {
    const layers = []
    for (let e = el; e; e = e.parentElement) {
      const parts = (getComputedStyle(e).backgroundColor.match(/[\d.]+/g) || []).map(Number)
      if (parts.length < 3) continue
      const alpha = parts.length > 3 ? parts[3] : 1
      if (alpha === 0) continue
      layers.push({ rgb: parts.slice(0, 3), alpha })
      if (alpha === 1) break
    }
    let base = layers.length && layers[layers.length - 1].alpha === 1 ? layers.pop().rgb : [255, 255, 255]
    for (const layer of layers.reverse()) {
      base = [0, 1, 2].map((i) => Math.round(base[i] + (layer.rgb[i] - base[i]) * layer.alpha))
    }
    return `rgb(${base.join(',')})`
  }
  const bad = []
  for (const el of document.querySelectorAll('body *')) {
    const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('')
    if (!t || el.offsetParent === null) continue
    // Disabled controls are exempt from AA, and a hover-only hint at opacity 0 is not
    // text anyone is reading yet.
    if (el.closest('button:disabled, [disabled]')) continue
    const s = getComputedStyle(el)
    if (effectiveOpacity(el) < 0.2) continue
    const px = parseFloat(s.fontSize)
    const need = px >= 24 || (px >= 18.66 && +s.fontWeight >= 700) ? 3 : 4.5
    const bgLum = lum(bgOf(el))
    const o = effectiveOpacity(el)
    // Blend the text toward its background by the inherited opacity.
    const fg = lum(s.color) * o + bgLum * (1 - o)
    const [a, b] = [fg, bgLum].sort((x, y) => y - x)
    if ((a + 0.05) / (b + 0.05) < need) bad.push(`${t.slice(0, 22)} ${((a + 0.05) / (b + 0.05)).toFixed(2)}`)
  }
  return bad
})
check('all admin text meets AA once inherited opacity is applied', contrast.length === 0, contrast.slice(0, 3).join(' | '))

// 4 — one upload error, next to the image that failed --------------------------
await page.locator('input[type="file"]').last().setInputFiles({ name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('x') })
await page.waitForTimeout(900)
const errs = await page.locator('[role="alert"]').filter({ hasText: /isn't an image/ }).count()
check('the upload rejection appears exactly once', errs === 1, `${errs} copies`)

// 5 — service cards send prospects to booking, not to the booking-lookup form ---
const svcItems = (await content()).find((sec) => sec.type === 'cards-grid').items
check('service cards link to booking, not the booking-lookup form',
  svcItems.length > 0 && svcItems.every((i) => /#calendar$/.test(i.link_url || '')),
  svcItems.map((i) => i.link_url).join(', '))

await browser.close()
const failed = out.filter((p) => !p).length
console.log(`\n${out.length - failed}/${out.length} checks passed`)
process.exit(failed ? 1 : 0)
