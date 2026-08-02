/**
 * Round 9 — click every control on the public page and verify the effect.
 * Uses host-resolver-rules so the page believes it is on localhost, which is the
 * only way the Turnstile stub engages (ManageBookings/BookingForm check hostname).
 */
import { chromium } from 'playwright'

const IP = process.env.FRONTEND_IP || '172.24.0.3'
const BASE = `http://localhost:5173`
const API = 'http://frontend:5173'
const OUT = '/app/tmp-e2e'

const log = (...a) => console.log(...a)

const browser = await chromium.launch({
  args: [`--host-resolver-rules=MAP localhost ${IP}, MAP frontend ${IP}`],
})
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await ctx.newPage()
page.on('pageerror', (e) => log('PAGEERROR:', e.message))

const setVisible = (id, v) => page.request.put(`${API}/api/admin/sections/${id}`, { data: { is_visible: v } })
const original = (await (await page.request.get(`${API}/api/admin/content`)).json()).sections.map((s) => ({ id: s.id, is_visible: s.is_visible }))

try {
  for (const s of original) if (!s.is_visible) await setVisible(s.id, 1)

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  log('TITLE:', await page.title())

  // ---- inventory every clickable thing -----------------------------------------
  const controls = await page.evaluate(() => {
    const els = [...document.querySelectorAll('a[href], button, [role="button"], input, select, textarea')]
    return els.map((e) => {
      const r = e.getBoundingClientRect()
      return {
        tag: e.tagName.toLowerCase(),
        text: (e.innerText || e.getAttribute('aria-label') || e.getAttribute('placeholder') || '').trim().slice(0, 42).replace(/\n/g, ' '),
        href: e.getAttribute('href'),
        disabled: e.disabled === true,
        w: Math.round(r.width), h: Math.round(r.height),
      }
    })
  })
  log('CONTROLS 1440:', JSON.stringify(controls, null, 0))

  // ---- do all in-page anchors resolve? ------------------------------------------
  const anchors = await page.evaluate(() => {
    const out = []
    for (const a of document.querySelectorAll('a[href*="#"]')) {
      const h = a.getAttribute('href')
      const id = h.split('#')[1]
      out.push({ href: h, text: a.innerText.trim().slice(0, 30), targetExists: !!document.getElementById(id) })
    }
    return out
  })
  log('ANCHORS:', JSON.stringify(anchors))

  // ---- nav links actually scroll -------------------------------------------------
  for (const label of ['Services', 'About', 'Testimonials']) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(300)
    const link = page.locator(`nav a:visible`, { hasText: new RegExp(`^${label}$`) }).first()
    if (await link.count()) {
      await link.click()
      await page.waitForTimeout(900)
      const y = await page.evaluate(() => window.scrollY)
      log(`NAV ${label}: scrollY=${y}`)
    } else log(`NAV ${label}: NOT PRESENT`)
  }

  // ---- hero CTA ------------------------------------------------------------------
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(300)
  await page.locator('section a[href$="#calendar"]').first().click()
  await page.waitForTimeout(900)
  log('HERO CTA scrollY:', await page.evaluate(() => window.scrollY), 'calendar top:', await page.evaluate(() => Math.round(document.getElementById('calendar').getBoundingClientRect().top)))

  // ---- gallery image click: does anything happen? --------------------------------
  const galleryClickable = await page.evaluate(() => {
    const sec = [...document.querySelectorAll('section')].find((s) => /Selected Projects/.test(s.textContent))
    if (!sec) return 'no gallery'
    const img = sec.querySelector('img')
    const card = img?.closest('a,button,[role="button"]')
    return { hasWrapper: !!card, wrapperTag: card?.tagName, cursor: img ? getComputedStyle(img).cursor : null }
  })
  log('GALLERY:', JSON.stringify(galleryClickable))

  // ---- calendar: pick day -> slots -> form ---------------------------------------
  await page.locator('#calendar').scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  const dayBtns = page.locator('#calendar button:not([disabled])')
  log('enabled calendar buttons:', await dayBtns.count())
  const firstDay = page.locator('#calendar button:not([disabled])').filter({ hasText: /slots/ }).first()
  await firstDay.click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/r9-cal-day-1440.png`, fullPage: false })
  const slotCount = await page.locator('#slot-picker button').count()
  log('SLOT buttons after day click:', slotCount)
  const slotTexts = await page.locator('#slot-picker button').allInnerTexts()
  log('SLOTS:', JSON.stringify(slotTexts.slice(0, 8)))

  // pick a slot
  const slot = page.locator('#slot-picker button').filter({ hasText: /\d{1,2}:\d{2}/ }).first()
  await slot.click()
  await page.waitForTimeout(1000)
  await page.locator('#slot-picker').scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/r9-cal-form-1440.png`, fullPage: false })
  const formFields = await page.evaluate(() => [...document.querySelectorAll('#slot-picker input, #slot-picker textarea, #slot-picker select, #slot-picker button')].map((e) => ({ t: e.tagName, name: e.name || e.id, label: (e.innerText || e.placeholder || '').slice(0, 30), disabled: e.disabled })))
  log('BOOKING FORM:', JSON.stringify(formFields))

  // submit with empty fields to see validation
  const submit = page.locator('#slot-picker button[type="submit"]').first()
  if (await submit.count()) {
    await submit.click()
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${OUT}/r9-cal-form-empty-submit.png`, fullPage: false })
    log('after empty submit, visible errors:', JSON.stringify(await page.locator('#slot-picker [role="alert"], #slot-picker .text-red-600').allInnerTexts()))
  }

  // ---- Manage bookings: does the button ever enable? -----------------------------
  await page.locator('#manage-bookings-email').scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  const mbBtn = page.locator('form:has(#manage-bookings-email) button[type="submit"]')
  log('manage btn disabled (immediately):', await mbBtn.isDisabled())
  await page.waitForTimeout(3000)
  log('manage btn disabled (after 3.5s):', await mbBtn.isDisabled())
  await page.locator('#manage-bookings-email').fill('nobody-r9@example.com')
  if (!(await mbBtn.isDisabled())) {
    await mbBtn.click()
    await page.waitForTimeout(2500)
    log('lookup result text:', (await page.locator('form:has(#manage-bookings-email)').locator('..').innerText()).slice(0, 400))
  }
  await page.screenshot({ path: `${OUT}/r9-manage-1440.png`, fullPage: false })

  // invalid email
  await page.locator('#manage-bookings-email').fill('not-an-email')
  if (!(await mbBtn.isDisabled())) {
    await mbBtn.click()
    await page.waitForTimeout(800)
    log('invalid email error:', JSON.stringify(await page.locator('form:has(#manage-bookings-email) [role="alert"]').allInnerTexts()))
  }

  // ---- 393: hamburger -------------------------------------------------------------
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${OUT}/r9-393-top.png`, fullPage: false })
  const burger = page.locator('button[aria-label="Open menu"]')
  log('hamburger present at 393:', await burger.count())
  if (await burger.count()) {
    await burger.click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/r9-393-menu-open.png`, fullPage: false })
    const items = await page.locator('nav .absolute a').allInnerTexts()
    log('menu items:', JSON.stringify(items))
    await page.locator('nav .absolute a', { hasText: 'About' }).first().click()
    await page.waitForTimeout(1000)
    log('after menu About click scrollY:', await page.evaluate(() => window.scrollY), 'menu still open:', await page.locator('nav .absolute').count())
  }

  // 393 calendar
  await page.locator('#calendar').scrollIntoViewIfNeeded()
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/r9-393-calendar.png`, fullPage: false })
  const d393 = page.locator('#calendar button:not([disabled])').filter({ hasText: /slots/ }).first()
  await d393.click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: `${OUT}/r9-393-slots.png`, fullPage: false })

  // ---- 768 --------------------------------------------------------------------------
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  await page.screenshot({ path: `${OUT}/r9-768-top.png`, fullPage: false })
  log('hamburger present at 768:', await page.locator('button[aria-label="Open menu"]').count(), 'visible:', await page.locator('button[aria-label="Open menu"]').first().isVisible().catch(() => 'n/a'))
  const navVisible = await page.locator('nav a:visible').allInnerTexts()
  log('768 nav links visible:', JSON.stringify(navVisible))

  // ---- tap target audit at 393 ------------------------------------------------------
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const small = await page.evaluate(() => {
    const out = []
    for (const e of document.querySelectorAll('a[href], button, [role="button"]')) {
      const r = e.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (r.height < 40 || r.width < 40) out.push({ t: (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 32), w: Math.round(r.width), h: Math.round(r.height) })
    }
    return out
  })
  log('SMALL TAP TARGETS 393:', JSON.stringify(small))

  // ---- horizontal overflow at each width --------------------------------------------
  for (const w of [1440, 768, 393]) {
    await page.setViewportSize({ width: w, height: 900 })
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    const ov = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, win: window.innerWidth }))
    log(`OVERFLOW @${w}:`, JSON.stringify(ov))
  }
} finally {
  for (const s of original) await setVisible(s.id, s.is_visible)
  log('visibility restored')
}
await browser.close()
