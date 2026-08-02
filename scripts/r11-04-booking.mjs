/**
 * Round 11 — the visitor booking journey end to end, plus the lookup validation copy.
 * Maps localhost to the frontend container so the Turnstile stub engages.
 * Cancels whatever it books.
 */
import { chromium } from 'playwright'

const HOST_IP = process.env.FRONTEND_IP || '172.24.0.3'
const BASE = 'http://localhost:5173'
const out = []
const check = (name, pass, detail = '') => {
  out.push(pass)
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP localhost ${HOST_IP}`] })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))

let cancelUrl = null
try {
  await page.goto(`${BASE}/#calendar`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)

  // ---- lookup validation copy (fix #4) ---------------------------------------
  const lookupForm = page.locator('form:has(#manage-bookings-email)')
  const lookupBtn = lookupForm.locator('button[type="submit"]')
  await page.locator('#manage-bookings-email').scrollIntoViewIfNeeded()
  await page.waitForTimeout(800)
  check('lookup button is enabled once the spam check stubs', !(await lookupBtn.isDisabled()))
  await lookupBtn.click()
  await page.waitForTimeout(500)
  const emptyMsg = (await lookupForm.locator('[role="alert"]').innerText().catch(() => '')).trim()
  check('empty lookup says what to enter', emptyMsg === 'Enter the email address you booked with.', `"${emptyMsg}"`)
  await page.screenshot({ path: '/app/tmp-e2e/r11-lookup-empty.png', clip: await lookupForm.boundingBox() })

  await page.locator('#manage-bookings-email').fill('not-an-email')
  await lookupBtn.click()
  await page.waitForTimeout(500)
  const badMsg = (await lookupForm.locator('[role="alert"]').innerText().catch(() => '')).trim()
  check('malformed lookup names the typo', badMsg === 'That does not look like an email address — check for a typo.', `"${badMsg}"`)
  await page.screenshot({ path: '/app/tmp-e2e/r11-lookup-bad.png', clip: await lookupForm.boundingBox() })

  // A real lookup for an address with no bookings
  await page.locator('#manage-bookings-email').fill('nobody-r11@example.com')
  await lookupBtn.click()
  await page.waitForTimeout(2500)
  const emptyState = await page.locator('text=No upcoming bookings').count()
  check('a lookup with no results shows an empty state, not an error', emptyState === 1)
  await page.screenshot({ path: '/app/tmp-e2e/r11-lookup-none.png', fullPage: false })

  // ---- book a meeting ---------------------------------------------------------
  await page.goto(`${BASE}/#calendar`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2500)
  const day = page.locator('#calendar button:not([disabled])').filter({ hasText: 'slots' }).first()
  check('an open day is clickable', await day.count() > 0)
  await day.click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: '/app/tmp-e2e/r11-slotpicker.png', fullPage: false })
  const slotCount = await page.locator('#slot-picker button').count()
  check('picking a day reveals its times', slotCount > 1, `${slotCount} controls`)

  const slot = page.locator('#slot-picker button').filter({ hasText: /AM|PM/ }).first()
  const slotLabel = (await slot.textContent())?.trim()
  await slot.click()
  await page.waitForTimeout(1000)
  check('picking a time opens the booking form', await page.locator('#firstName').count() === 1, `slot "${slotLabel}"`)
  await page.screenshot({ path: '/app/tmp-e2e/r11-bookingform.png', fullPage: false })

  // Submit empty — should list every problem at once
  await page.locator('button[type="submit"]:has-text("Book this time")').click()
  await page.waitForTimeout(500)
  const formErr = (await page.locator('form [role="alert"]').first().innerText().catch(() => '')).trim()
  check('an empty booking form lists every missing field at once', /First name/.test(formErr) && /Last name/.test(formErr) && /Email/.test(formErr), `"${formErr}"`)
  await page.screenshot({ path: '/app/tmp-e2e/r11-booking-validation.png', fullPage: false })

  await page.locator('#firstName').fill('Round')
  await page.locator('#lastName').fill('Eleven')
  await page.locator('#email').fill('round11-review@example.com')
  await page.locator('#purpose').fill('UI review booking — please ignore')
  await page.locator('button[type="submit"]:has-text("Book this time")').click()
  await page.waitForTimeout(4000)

  const panel = page.locator('text=Meeting Confirmed').first()
  check('the booking succeeds and confirms', await panel.count() > 0)
  const panelBox = page.locator('#slot-picker .card, .card:has-text("Meeting Confirmed")').first()
  await page.screenshot({ path: '/app/tmp-e2e/r11-booking-confirmed.png', fullPage: false })
  const panelText = await panelBox.innerText().catch(() => page.locator('body').innerText())
  console.log('--- confirmation panel ---\n' + panelText + '\n---')

  check('confirmation shows the purpose back', /UI review booking/.test(panelText))
  check('no Resend / vendor error text reaches the visitor', !/Resend|422|statusCode|api\/debug|documentation/i.test(panelText), panelText.match(/Resend[^\n]*/)?.[0] || '')
  check('placeholder meet link is explained in plain English', !/fake-/.test(panelText) || /This video link is a placeholder/.test(panelText))
  if (/This video link is a placeholder/.test(panelText)) {
    check('placeholder copy reassures the booking is saved', /Your booking is saved/.test(panelText))
  }

  cancelUrl = await page.locator('a:has-text("Cancel meeting")').first().getAttribute('href')
  console.log('cancelUrl:', cancelUrl)

  // .ics download
  const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null)
  await page.locator('button:has-text("Download invite")').first().click()
  const download = await dl
  check('“Download invite (.ics)” produces a file', !!download, download ? await download.suggestedFilename() : 'no download event')

  // Book another resets the flow
  await page.locator('button:has-text("Book another")').first().click()
  await page.waitForTimeout(1500)
  check('“Book another” returns to the day picker', (await page.locator('text=Select a day above').count()) === 1)
  await page.screenshot({ path: '/app/tmp-e2e/r11-book-another.png', fullPage: false })

  // ---- lookup finds the booking, and cancels it -------------------------------
  await page.locator('#manage-bookings-email').fill('round11-review@example.com')
  await page.locator('form:has(#manage-bookings-email) button[type="submit"]').click()
  await page.waitForTimeout(3000)
  const listText = await page.locator('section:has(#manage-bookings-email)').innerText()
  console.log('--- lookup result ---\n' + listText.slice(0, 900) + '\n---')
  check('the new booking is found by email', /1 found/.test(listText), listText.match(/— \d+ found/)?.[0] || '')
  check('the listed time is the meeting time, not "just now"', new RegExp(String(new Date().getFullYear())).test(listText))
  await page.screenshot({ path: '/app/tmp-e2e/r11-lookup-found.png', fullPage: false })

  page.once('dialog', (d) => d.accept())
  await page.locator('button:has-text("Cancel meeting")').first().click()
  await page.waitForTimeout(3000)
  const afterCancel = await page.locator('section:has(#manage-bookings-email)').innerText()
  check('cancelling removes the booking from the list', !/Cancel meeting/.test(afterCancel), afterCancel.slice(0, 200))
  cancelUrl = null
  await page.screenshot({ path: '/app/tmp-e2e/r11-after-cancel.png', fullPage: false })

  check('no uncaught page errors during booking', errors.length === 0, errors.slice(0, 3).join(' | '))
} finally {
  if (cancelUrl) {
    const r = await page.request.get(cancelUrl.startsWith('http') ? cancelUrl : `${BASE}${cancelUrl}`, { headers: { Accept: 'application/json' } })
    console.log('cleanup cancel status:', r.status())
  }
}

console.log(`\n${out.filter(Boolean).length}/${out.length} passed`)
await browser.close()
