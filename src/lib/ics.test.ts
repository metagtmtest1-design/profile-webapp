import { describe, it, expect } from 'vitest'
import { generateIcsContent } from './ics'

describe('ics lib — calendar invite .ics download', () => {
  it('should generate VCALENDAR with event containing Meet link', () => {
    const ics = generateIcsContent({
      title: 'Meeting — Jane Doe',
      description: 'Brand strategy intro',
      location: 'https://meet.google.com/abc-defg-hij',
      start: '2026-07-30T13:00:00Z',
      end: '2026-07-30T13:30:00Z',
      meetLink: 'https://meet.google.com/abc-defg-hij',
      attendee: 'jane@example.com',
    })

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('VERSION:2.0')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('SUMMARY:Meeting — Jane Doe')
    expect(ics).toContain('https://meet.google.com/abc-defg-hij')
    expect(ics).toContain('LOCATION:')
    expect(ics).toContain('DTSTART:')
    expect(ics).toContain('DTEND:')
    expect(ics).toContain('END:VEVENT')
    expect(ics).toContain('END:VCALENDAR')
    // No calendar IDs leaked
    expect(ics).not.toContain('4b320f7127d04517322eed13a69ecb276f4f371ac7684a6c8d10a5c03b5bf4a0')
  })

  it('should handle minimal event without meetLink', () => {
    const ics = generateIcsContent({
      title: 'Test Meeting',
      start: '2026-07-30T13:00:00Z',
      end: '2026-07-30T13:30:00Z',
    })
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('SUMMARY:Test Meeting')
  })
})
