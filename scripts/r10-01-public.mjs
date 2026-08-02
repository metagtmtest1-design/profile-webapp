/**
 * Round 10 — public page: inventory + click every control, at 1440 / 768 / 393.
 * Sections hidden by migration 0004 are shown for the duration and restored in `finally`.
 */
import { chromium } from 'playwright'

const IP = process.env.FRONTEND_IP || '172.24.0.3'
const BASE = 'http://localhost:5173'
const API = 'http://frontend:5173'
const OUT = '/app/tmp-e2e'
const log = (...a) => console.log(...a)

const browser = await chromium.launch({
  args: [`--host-resolver-rules=MAP localhost ${IP}, MAP frontend ${IP}`],
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 200)) })

const setVisible = (id, v) => page.request.put(`${API}/api/admin/sections/${id}`, { data: { is_visible: v } })
const original = (await (await page.request.get(`${API}/api/admin/content`)).json()).sections.map((s) => ({ id: s.id, is_visible: s.is_visible }))
log('ORIGINAL VISIBILITY:', JSON.stringify(original))

try {
  for (const s of original) if (!s.is_visible) await setVisible(s.id, 1)

  for (const [w, h, tag] of [[1440, 1000, 'desktop'], [768, 1024, 'tablet'], [393, 852, 'mobile']]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2200)
    log(`\n===== ${tag} ${w}px =====`)
    log('TITLE:', await page.title())
    log('META DESC:', await page.evaluate(() => document.querySelector('meta[name="description"]')?.content))

    await page.screenshot({ path: `${OUT}/r10-01-${tag}-full.png`, fullPage: true })

    // Every visible interactive element, with its box + accessible name.
    const controls = await page.evaluate(() => {
      const out = []
      for (const e of document.querySelectorAll('a[href], button, [role="button"], input, select, textarea')) {
        const r = e.getBoundingClientRect()
        const cs = getComputedStyle(e)
        if (cs.display === 'none' || cs.visibility === 'hidden' || (r.width === 0 && r.height === 0)) continue
        out.push({
          tag: e.tagName.toLowerCase(),
          text: (e.innerText || e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.value || '').trim().slice(0, 46).replace(/\s+/g, ' '),
          href: e.getAttribute('href'),
          disabled: e.disabled === true,
          w: Math.round(r.width), h: Math.round(r.height),
        })
      }
      return out
    })
    log('CONTROL COUNT:', controls.length)
    const small = controls.filter((c) => !c.disabled && (c.h < 40 || c.w < 40) && c.tag !== 'input')
    log('TAP TARGETS < 40px:', JSON.stringify(small))

    // Anchors resolve?
    const anchors = await page.evaluate(() =>
      [...document.querySelectorAll('a[href*="#"]')].map((a) => ({
        href: a.getAttribute('href'),
        text: a.innerText.trim().slice(0, 24),
        ok: !!document.getElementById(a.getAttribute('href').split('#')[1]),
      })))
    log('ANCHORS:', JSON.stringify(anchors))

    // Horizontal overflow
    const overflow = await page.evaluate(() => {
      const bad = []
      for (const e of document.querySelectorAll('*')) {
        const r = e.getBoundingClientRect()
        if (r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1)) {
          bad.push({ t: e.tagName.toLowerCase(), c: (e.className || '').toString().slice(0, 40), l: Math.round(r.left), r: Math.round(r.right) })
        }
      }
      return { docW: document.documentElement.scrollWidth, winW: window.innerWidth, bad: bad.slice(0, 8) }
    })
    log('OVERFLOW:', JSON.stringify(overflow))
  }

  // ---- interaction pass at 1440 --------------------------------------------------
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  log('\n===== INTERACTIONS 1440 =====')

  for (const label of ['Services', 'About', 'Testimonials', 'Work', 'Book a call', 'Contact']) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(250)
    const link = page.locator('header a:visible, nav a:visible').filter({ hasText: new RegExp(`^${label}$`, 'i') }).first()
    if (await link.count()) {
      await link.click()
      await page.waitForTimeout(900)
      log(`NAV "${label}": scrollY=${await page.evaluate(() => Math.round(window.scrollY))}`)
    } else log(`NAV "${label}": absent`)
  }

  // Hero CTA
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
  const heroCta = page.locator('section').first().locator('a').first()
  log('HERO CTA text:', (await heroCta.innerText()).trim(), 'href:', await heroCta.getAttribute('href'))
  await heroCta.click()
  await page.waitForTimeout(1000)
  log('HERO CTA scrollY:', await page.evaluate(() => Math.round(window.scrollY)))

  // Gallery tile: clickable? hover effect?
  const gal = page.locator('#work img').first()
  if (await gal.count()) {
    const before = await page.evaluate(() => document.body.innerHTML.length)
    await gal.click({ force: true })
    await page.waitForTimeout(700)
    log('GALLERY click: bodyLenDelta=', (await page.evaluate(() => document.body.innerHTML.length)) - before,
      'dialogOpen=', await page.locator('[role="dialog"]').count())
  } else log('GALLERY: no img under #work')

  // Footer links
  const footer = await page.evaluate(() =>
    [...document.querySelectorAll('footer a')].map((a) => ({ t: a.innerText.trim().slice(0, 24), h: a.getAttribute('href') })))
  log('FOOTER LINKS:', JSON.stringify(footer))
  log('FOOTER TEXT:', (await page.locator('footer').innerText()).replace(/\n/g, ' | '))

  // ---- mobile hamburger ----------------------------------------------------------
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  log('\n===== MOBILE MENU 393 =====')
  const burger = page.locator('header button, nav button').first()
  if (await burger.count()) {
    log('BURGER label:', await burger.getAttribute('aria-label'), 'expanded:', await burger.getAttribute('aria-expanded'))
    await burger.click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/r10-01-mobile-menu-open.png` })
    const items = await page.evaluate(() =>
      [...document.querySelectorAll('header a, nav a')].filter((a) => a.getBoundingClientRect().height > 0)
        .map((a) => ({ t: a.innerText.trim(), h: a.getAttribute('href'), y: Math.round(a.getBoundingClientRect().top), hh: Math.round(a.getBoundingClientRect().height) })))
    log('MENU ITEMS:', JSON.stringify(items))
    log('EXPANDED after open:', await burger.getAttribute('aria-expanded'))
    // click one and verify it closes + scrolls
    const first = page.locator('header a[href*="#"]:visible, nav a[href*="#"]:visible').first()
    if (await first.count()) {
      await first.click()
      await page.waitForTimeout(900)
      log('AFTER MENU LINK CLICK: scrollY=', await page.evaluate(() => Math.round(window.scrollY)),
        'expanded=', await burger.getAttribute('aria-expanded'))
      await page.screenshot({ path: `${OUT}/r10-01-mobile-after-menuclick.png` })
    }
  } else log('BURGER: none found')

  // Mobile calendar screenshot
  await page.evaluate(() => document.getElementById('calendar')?.scrollIntoView())
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${OUT}/r10-01-mobile-calendar.png` })

  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto(`${BASE}/#calendar`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${OUT}/r10-01-tablet-calendar.png` })

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${BASE}/#calendar`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${OUT}/r10-01-desktop-calendar.png` })
  log('\nCALENDAR BADGE:', await page.evaluate(() => {
    const el = [...document.querySelectorAll('span')].find((s) => s.innerText.startsWith('First opening'))
    return el ? el.innerText : 'NOT FOUND'
  }))
} finally {
  for (const s of original) await setVisible(s.id, s.is_visible)
  const after = (await (await page.request.get(`${API}/api/admin/content`)).json()).sections.map((s) => ({ id: s.id, is_visible: s.is_visible }))
  log('\nRESTORED VISIBILITY:', JSON.stringify(after))
  log('ERRORS:', JSON.stringify([...new Set(errors)].slice(0, 20)))
  await browser.close()
}
