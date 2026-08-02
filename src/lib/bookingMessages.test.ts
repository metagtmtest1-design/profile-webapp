import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { BOOKING_MESSAGES, isPlaceholderMeetLink } from './bookingMessages'

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8')

describe('booking confirmation copy', () => {
  it('detects the stub Meet link the backend returns with no calendar configured', () => {
    expect(isPlaceholderMeetLink('https://meet.google.com/fake-missing-calendar-abc')).toBe(true)
    expect(isPlaceholderMeetLink('https://meet.google.com/tsp-vvkk-tqy')).toBe(false)
    expect(isPlaceholderMeetLink(undefined)).toBe(false)
    expect(isPlaceholderMeetLink(null)).toBe(false)
  })

  it('leads with the fact that the meeting is booked', () => {
    expect(BOOKING_MESSAGES.emailNotSent.detail).toMatch(/booked/i)
    expect(BOOKING_MESSAGES.placeholderMeetLink.detail).toMatch(/saved/i)
  })

  it('says nothing a visitor would have to be a developer to act on', () => {
    const all = Object.values(BOOKING_MESSAGES).flatMap((m) => [m.heading, m.detail]).join(' ')
    for (const jargon of ['Resend', 'diag', 'API', 'stub', '422', 'secret', 'documentation']) {
      expect(all, `copy mentions "${jargon}"`).not.toContain(jargon)
    }
  })

  /**
   * The regression: both confirmation panels rendered the vendor's own error string, so
   * a delivery failure showed the visitor Resend's support copy — "use our testing email
   * address … see our documentation" — and the calendar case told them to check
   * /api/debug/diag.
   */
  it.each([
    ['src/pages/Home.tsx', ['emailResult.error', 'gcalError}', '/api/debug/diag']],
    ['src/components/calendar/BookingForm.tsx', ['emailResult.error', 'gcalError}']],
  ])('%s does not render a vendor error to the visitor', (file, forbidden) => {
    const source = read(file.replace(/^src\//, ''))
    // Rendered as JSX, i.e. inside braces in the returned markup — as opposed to being
    // passed to debug(), which is how these values legitimately still get recorded.
    for (const needle of forbidden) {
      expect(source, `${file} renders ${needle}`).not.toContain(`{${needle}`)
    }
  })

  it('routes the raw error to the DEV-only tracer instead', () => {
    expect(read('pages/Home.tsx')).toContain('HOME_BOOKING_EMAIL_ERROR')
    expect(read('pages/Home.tsx')).toContain('HOME_BOOKING_GCAL_ERROR')
  })
})
