/**
 * Final verification sweep across every issue raised in UI/UX review.
 * docker run --rm --network profile-webapp_portfolio-net -v "$PWD":/app -w /tmp/pw \
 *   mcr.microsoft.com/playwright:v1.50.0-noble sh -c "... node verify-final.mjs"
 */
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://frontend:5173'
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC',
  'base64',
)
const out = []
const check = (name, pass, detail = '') => {
  out.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

const sections = async () => (await (await page.request.get(`${BASE}/api/admin/content`)).json()).sections

await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' })

// --- upload (the original bug) -------------------------------------------
check('hero has exactly one upload control', (await page.getByRole('button', { name: /replace hero image|upload hero image/i }).count()) === 1)
const input = page.locator('input[type="file"]').first()
check('hero input is sr-only, not display:none', (await input.evaluate((e) => getComputedStyle(e).display)) !== 'none')
const chooser = page.waitForEvent('filechooser', { timeout: 4000 }).catch(() => null)
await page.getByRole('button', { name: /replace hero image|upload hero image/i }).click()
check('clicking the hero image opens the picker', Boolean(await chooser))
await page.keyboard.press('Escape')
const upload = page.waitForResponse((r) => r.url().includes('/api/admin/upload-image'), { timeout: 20000 })
await input.setInputFiles({ name: 'h.png', mimeType: 'image/png', buffer: PNG })
const body = await (await upload).json()
await page.waitForTimeout(900)
const heroItem = (await sections()).find((s) => s.type === 'hero').items[0]
check('hero upload persists to the database', heroItem.image_url === body.url)
check('hero upload shows confirmation', (await page.getByText(/Uploaded ✓/).count()) > 0)

// --- noise copy -----------------------------------------------------------
const text = await page.locator('body').innerText()
const noise = ['No image', 'Select image to upload', 'max 1200px', '1MB max', '10GB', '80MB combined']
check('no free-tier or spec noise', noise.every((n) => !text.includes(n)), noise.filter((n) => text.includes(n)).join(' | '))

// --- styling regressions --------------------------------------------------
check('no UA grey buttonface buttons', (await page.$$eval('button', (els) => els.filter((e) => /buttonface|rgb\(240, 240, 240\)/i.test(getComputedStyle(e).backgroundColor)).length)) === 0)
check('no UA blue underlined links', (await page.$$eval('a', (els) => els.filter((e) => getComputedStyle(e).color === 'rgb(0, 0, 238)').length)) === 0)
check('only one sticky bar on /admin', (await page.$$eval('*', (els) => els.filter((e) => getComputedStyle(e).position === 'sticky').length)) === 1)
check('no dead in-page anchors on /admin', (await page.$$eval('a[href^="#"]', (els) => els.filter((e) => !document.querySelector(e.getAttribute('href'))).length)) === 0)

// --- hidden badge ---------------------------------------------------------
const badge = page.getByText(/Hidden — not on live site/).first()
if (await badge.count()) {
  const inset = await badge.evaluate((e) => e.getBoundingClientRect().left - e.closest('[data-section]').getBoundingClientRect().left)
  check('hidden badge is inset, not flush to the edge', inset >= 12, `${Math.round(inset)}px`)
  check('hidden badge visible without hover', (await badge.evaluate((e) => getComputedStyle(e).opacity)) === '1')
}

// --- CTA edit contrast ----------------------------------------------------
const ctaHeading = page.getByRole('button', { name: /Edit CTA heading/i }).first()
if (await ctaHeading.count()) {
  await ctaHeading.click()
  await page.waitForTimeout(300)
  const field = page.locator('input[aria-label*="CTA"], textarea[aria-label*="CTA"]').first()
  const colors = await field.evaluate((e) => ({ c: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor }))
  check('CTA edit field is readable (not white on white)', colors.c !== colors.bg, JSON.stringify(colors))
  await page.keyboard.press('Escape')
}

// --- accessibility --------------------------------------------------------
await page.keyboard.press('Tab')
const focusRing = await page.evaluate(() => {
  const s = getComputedStyle(document.activeElement)
  return { outline: s.outlineWidth, shadow: s.boxShadow }
})
check('keyboard focus shows a visible ring', focusRing.outline !== '0px' || focusRing.shadow !== 'none', JSON.stringify(focusRing))

const contrast = await page.evaluate(() => {
  const lum = (c) => {
    const [r, g, b] = c.match(/\d+/g).slice(0, 3).map((v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  // Composites translucent layers over the first solid colour behind them, so white
  // text on a 10%-white wash over a dark banner is not mistaken for white-on-white.
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
    const s = getComputedStyle(el)
    const px = parseFloat(s.fontSize)
    const need = px >= 24 || (px >= 18.66 && +s.fontWeight >= 700) ? 3 : 4.5
    const [a, b] = [lum(s.color), lum(bgOf(el))].sort((x, y) => y - x)
    const ratio = (a + 0.05) / (b + 0.05)
    if (ratio < need) bad.push({ t: t.slice(0, 20), ratio: +ratio.toFixed(2), need })
  }
  return bad
})
check('all admin text meets WCAG AA contrast', contrast.length === 0, JSON.stringify(contrast.slice(0, 4)))

// --- responsive -----------------------------------------------------------
for (const [w, h] of [[1440, 900], [768, 1024], [393, 852]]) {
  await page.setViewportSize({ width: w, height: h })
  await page.waitForTimeout(400)
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
  check(`no horizontal overflow on /admin @${w}`, scrollW <= w, `${scrollW} vs ${w}`)
  const small = await page.$$eval('button, a', (els) =>
    els.filter((e) => {
      const r = e.getBoundingClientRect()
      return r.width > 0 && (r.height < 32 || r.width < 32)
    }).map((e) => `${(e.textContent || e.ariaLabel || '').trim().slice(0, 14)}:${Math.round(e.getBoundingClientRect().height)}`))
  check(`all touch targets >= 32px on /admin @${w}`, small.length === 0, small.slice(0, 5).join(', '))
  await page.screenshot({ path: `/app/tmp-e2e/final-admin-${w}.png`, fullPage: w === 1440 })
}
check('no console errors on /admin', errors.length === 0, errors.slice(0, 2).join(' | '))

// --- public page ----------------------------------------------------------
await page.setViewportSize({ width: 1440, height: 1000 })
errors.length = 0
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const day = page.locator('button:not([disabled])').filter({ hasText: /slots/ }).first()
const dayLabel = (await day.innerText()).replace(/\s+/g, ' ')
await day.click()
await page.waitForTimeout(800)
const picker = await page.locator('div.font-bold.text-base').first().innerText()
const dayNum = dayLabel.match(/\b(\d{1,2})\b/)[1]
check('slot picker shows the day that was clicked', picker.includes(dayNum), `${dayLabel} -> ${picker}`)
const dimmed = await page.locator('button[disabled]').filter({ hasText: /Weekend|Full/ }).first().evaluate((e) => getComputedStyle(e).opacity).catch(() => '1')
check('unavailable calendar days are visually dimmed', parseFloat(dimmed) < 1, `opacity ${dimmed}`)
check('booking lookup input has an associated label', await page.evaluate(() => {
  const i = document.getElementById('manage-bookings-email')
  return Boolean(i && document.querySelector('label[for="manage-bookings-email"]'))
}))
for (const [w, h] of [[1440, 900], [768, 1024], [393, 852]]) {
  await page.setViewportSize({ width: w, height: h })
  await page.waitForTimeout(400)
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth)
  check(`no horizontal overflow on / @${w}`, scrollW <= w, `${scrollW} vs ${w}`)
  await page.screenshot({ path: `/app/tmp-e2e/final-public-${w}.png`, fullPage: w === 1440 })
}
const realErrors = errors.filter((e) => !/turnstile|challenges\.cloudflare|110200|400/i.test(e))
check('no console errors on / (Turnstile excluded)', realErrors.length === 0, realErrors.slice(0, 2).join(' | '))

await browser.close()
const failed = out.filter((p) => !p).length
console.log(`\n${out.length - failed}/${out.length} checks passed`)
process.exit(failed ? 1 : 0)
