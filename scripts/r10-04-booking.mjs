/**
 * Round 10 — booking end to end: pick a day, pick a slot, validation, submit,
 * then look the booking up and check the time it reports is the meeting time.
 */
import { chromium } from 'playwright'

const IP = process.env.FRONTEND_IP || '172.24.0.3'
const BASE = 'http://localhost:5173'
const OUT = '/app/tmp-e2e'
const log = (...a) => console.log(...a)
const EMAIL = `r10probe+${Date.now()}@example.com`

const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP localhost ${IP}, MAP frontend ${IP}`] })
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 160)) })
let lastDialog = null
page.on('dialog', (d) => { lastDialog = `${d.type()} | ${d.message()}`; d.accept() })

try {
  await page.goto(`${BASE}/#calendar`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  // ---- day cells ------------------------------------------------------------------
  const days = await page.evaluate(() => [...document.querySelectorAll('button[aria-label*="slots available"], button[aria-label*="unavailable"]')]
    .map((b) => ({ l: b.getAttribute('aria-label'), dis: b.disabled })))
  log('DAY CELLS:', days.length, '| selectable:', days.filter((d) => !d.dis).length)
  log('SAMPLE:', JSON.stringify(days.slice(0, 9)))
  log('EMPTY STATE:', await page.evaluate(() => {
    const el = [...document.querySelectorAll('p,div')].find((e) => /Select a day above/i.test(e.innerText || '') && e.innerText.length < 80)
    return el ? el.innerText : 'not found'
  }))

  // ---- click a day ------------------------------------------------------------------
  const day = page.locator('button[aria-label*="slots available"]').first()
  const dayLabel = await day.getAttribute('aria-label')
  await day.click()
  await page.waitForTimeout(1800)
  log('\nCLICKED DAY:', dayLabel)
  log('SELECTED aria:', await day.getAttribute('aria-selected'))
  const slots = await page.evaluate(() => [...document.querySelectorAll('button')]
    .filter((b) => /^\d{1,2}:\d{2}\s*[–-]/.test(b.innerText.trim()))
    .map((b) => ({ t: b.innerText.trim().replace(/\n/g, ' '), dis: b.disabled })))
  log('SLOTS shown:', slots.length, '| first 6:', JSON.stringify(slots.slice(0, 6)))
  await page.screenshot({ path: `${OUT}/r10-04-slots.png`, fullPage: false })

  // ---- pick a slot ---------------------------------------------------------------
  const slot = page.locator('button').filter({ hasText: /^\d{1,2}:\d{2}\s*[–-]/ }).first()
  const slotText = (await slot.innerText()).trim().replace(/\n/g, ' ')
  await slot.click()
  await page.waitForTimeout(1500)
  log('\nPICKED SLOT:', slotText)
  log('FORM visible:', await page.locator('#firstName').count(), '| heading:', await page.evaluate(() => {
    const h = [...document.querySelectorAll('h3,h2')].map((e) => e.innerText.trim()).filter((t) => /book|confirm|your details/i.test(t))
    return JSON.stringify(h)
  }))
  await page.screenshot({ path: `${OUT}/r10-04-form.png`, fullPage: false })

  // ---- validation: submit empty -----------------------------------------------------
  await page.evaluate(() => {
    for (const el of ['#firstName', '#lastName', '#email']) document.querySelector(el)?.removeAttribute('required')
  })
  await page.getByRole('button', { name: /Book this time/i }).click()
  await page.waitForTimeout(1000)
  const alerts = await page.evaluate(() => [...document.querySelectorAll('[role="alert"]')].map((e) => e.innerText.trim()))
  log('\nEMPTY SUBMIT alerts:', JSON.stringify(alerts))
  await page.screenshot({ path: `${OUT}/r10-04-validation.png`, fullPage: false })

  // ---- bad email --------------------------------------------------------------------
  await page.fill('#firstName', 'Round')
  await page.fill('#email', 'not-an-email')
  await page.getByRole('button', { name: /Book this time/i }).click()
  await page.waitForTimeout(900)
  log('BAD EMAIL alerts:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('[role="alert"]')].map((e) => e.innerText.trim()))))

  // ---- real submit --------------------------------------------------------------------
  await page.fill('#firstName', 'Round')
  await page.fill('#lastName', 'Ten')
  await page.fill('#email', EMAIL)
  await page.fill('#purpose', 'Round 10 UI review probe')
  await page.getByRole('button', { name: /Book this time/i }).click()
  await page.waitForTimeout(6000)
  const after = await page.evaluate(() => document.body.innerText)
  log('\nSUBMIT RESULT contains "Check your email":', /Check your email/i.test(after),
    '| "Booked"/"Confirmed":', /booked|confirmed/i.test(after))
  await page.screenshot({ path: `${OUT}/r10-04-submitted.png`, fullPage: false })
  const panel = await page.evaluate(() => {
    const el = [...document.querySelectorAll('div.card, div')].find((d) => /Check your email|You're booked|Confirmed/i.test(d.innerText) && d.innerText.length < 700)
    return el ? el.innerText : 'NOT FOUND'
  })
  log('RESULT PANEL:\n' + panel)

  // ---- follow confirm link if double opt-in ------------------------------------------
  const confirmLink = await page.evaluate(() => {
    const a = [...document.querySelectorAll('a')].find((x) => /\/api\/booking\/confirm|confirm\?token|confirm\//.test(x.href))
    return a ? a.href : null
  })
  log('CONFIRM LINK:', confirmLink)
  if (confirmLink) {
    const r = await page.request.get(confirmLink)
    log('CONFIRM STATUS:', r.status())
    const body = await r.text()
    log('CONFIRM BODY (300):', body.slice(0, 300).replace(/\s+/g, ' '))
  }

  // ---- lookup -------------------------------------------------------------------------
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  await page.fill('#manage-bookings-email', EMAIL)
  const findBtn = page.getByRole('button', { name: /Find my bookings/i })
  log('\nLOOKUP button disabled before submit:', await findBtn.isDisabled())
  await findBtn.click()
  await page.waitForTimeout(4000)
  const lookup = await page.evaluate(() => {
    const h = [...document.querySelectorAll('h3')].find((e) => /Bookings for/i.test(e.innerText))
    const list = [...document.querySelectorAll('li.card, li')].map((li) => li.innerText.replace(/\n/g, ' | ')).filter((t) => t.length > 10)
    return { heading: h ? h.innerText : 'NONE', list: list.slice(0, 5) }
  })
  log('LOOKUP:', JSON.stringify(lookup, null, 1))
  await page.screenshot({ path: `${OUT}/r10-04-lookup.png`, fullPage: false })
  log('SLOT PICKED WAS:', slotText, '| DAY:', dayLabel)

  // ---- lookup: unknown email --------------------------------------------------------
  await page.fill('#manage-bookings-email', 'nobody-r10@example.com')
  await page.getByRole('button', { name: /Find my bookings/i }).click()
  await page.waitForTimeout(3000)
  log('\nUNKNOWN EMAIL:', await page.evaluate(() => {
    const el = [...document.querySelectorAll('p')].find((e) => /No upcoming bookings/i.test(e.innerText))
    return el ? el.innerText : 'NO EMPTY STATE'
  }))

  // ---- lookup: bad email format -------------------------------------------------------
  await page.fill('#manage-bookings-email', 'garbage')
  await page.getByRole('button', { name: /Find my bookings/i }).click()
  await page.waitForTimeout(1500)
  log('BAD FORMAT:', await page.evaluate(() => {
    const el = [...document.querySelectorAll('[role="alert"]')].map((e) => e.innerText.trim())
    return JSON.stringify(el)
  }))

  // ---- cancel the probe booking -------------------------------------------------------
  await page.fill('#manage-bookings-email', EMAIL)
  await page.getByRole('button', { name: /Find my bookings/i }).click()
  await page.waitForTimeout(3500)
  const cancelBtn = page.getByRole('button', { name: /Cancel meeting/i }).first()
  if (await cancelBtn.count()) {
    await cancelBtn.click()
    await page.waitForTimeout(4000)
    log('\nCANCEL dialog:', lastDialog)
    log('CANCEL remaining cards:', await page.getByRole('button', { name: /Cancel meeting/i }).count())
    await page.screenshot({ path: `${OUT}/r10-04-cancelled.png`, fullPage: false })
  } else log('\nCANCEL: no button (nothing to cancel)')

  // ---- mobile + tablet booking views ---------------------------------------------------
  for (const [w, h, tag] of [[768, 1024, 'tablet'], [393, 852, 'mobile']]) {
    await page.setViewportSize({ width: w, height: h })
    await page.goto(`${BASE}/#calendar`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2500)
    const d = page.locator('button[aria-label*="slots available"]').first()
    if (await d.count()) {
      await d.click()
      await page.waitForTimeout(1500)
      await page.screenshot({ path: `${OUT}/r10-04-${tag}-slots.png`, fullPage: false })
      const s = page.locator('button').filter({ hasText: /^\d{1,2}:\d{2}\s*[–-]/ }).first()
      if (await s.count()) {
        await s.click()
        await page.waitForTimeout(1500)
        await page.screenshot({ path: `${OUT}/r10-04-${tag}-form.png`, fullPage: false })
        const of = await page.evaluate(() => {
          const bad = []
          for (const e of document.querySelectorAll('*')) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.right > window.innerWidth + 1) bad.push(e.tagName + '.' + (e.className || '').toString().slice(0, 30)) }
          return { docW: document.documentElement.scrollWidth, bad: bad.slice(0, 5) }
        })
        log(`${tag} FORM OVERFLOW:`, JSON.stringify(of))
      }
    }
  }
} finally {
  log('\nERRORS:', JSON.stringify([...new Set(errors)].slice(0, 20)))
  log('PROBE EMAIL:', EMAIL)
  await browser.close()
}
