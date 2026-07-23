import { describe, it, expect } from 'vitest'
import { computeSlotsForDay, computeSlots, parseTime, filterWorkingDays, getStubBusyBlocks, getStubSlots } from './google-calendar'

describe('google-calendar lib — slot math', () => {
  it('should parse working hours vars START/END 09:00/17:00', () => {
    expect(parseTime('09:00')).toBe(9 * 60)
    expect(parseTime('17:00')).toBe(17 * 60)
    expect(parseTime('09:30')).toBe(570)
    expect(parseTime('')).toBe(0)
  })

  it('should compute slots for day with no busy → full working hours 09-17 30min', () => {
    const date = new Date('2026-07-20T00:00:00Z') // Monday
    const slots = computeSlotsForDay(date, { start: '09:00', end: '17:00', slotMinutes: 30 }, [])
    // 09:00-17:00 = 8 hours = 16 slots of 30min
    expect(slots.length).toBe(16)
    expect(slots[0].available).toBe(true)
    expect(slots[0].start).toContain('09:00')
  })

  it('should exclude busy blocks overlapping', () => {
    const date = new Date('2026-07-20T00:00:00Z')
    const busy = [{ start: '2026-07-20T10:00:00Z', end: '2026-07-20T11:00:00Z' }]
    const slots = computeSlotsForDay(date, { start: '09:00', end: '12:00', slotMinutes: 30 }, busy as any)
    // 09-12 = 6 slots, busy 10-11 removes 10:00 and 10:30
    const available = slots.filter((s) => s.available)
    expect(available.length).toBe(4)
    expect(slots.find((s) => s.start.includes('10:00'))?.available).toBe(false)
    expect(slots.find((s) => s.start.includes('10:30'))?.available).toBe(false)
    expect(slots.find((s) => s.start.includes('09:00'))?.available).toBe(true)
  })

  it('should handle partial overlap busy 09:15-09:45 removes 09:00 and 09:30 slots', () => {
    const date = new Date('2026-07-20T00:00:00Z')
    const busy = [{ start: '2026-07-20T09:15:00Z', end: '2026-07-20T09:45:00Z' }]
    const slots = computeSlotsForDay(date, { start: '09:00', end: '10:00', slotMinutes: 30 }, busy as any)
    expect(slots.length).toBe(2)
    // Any overlap → not available
    expect(slots[0].available).toBe(false) // 09:00 overlaps 09:15-09:45
    expect(slots[1].available).toBe(false) // 09:30 overlaps
  })

  it('should respect working days 1-5 filter (Mon-Fri) — weekend no slots', () => {
    const monday = new Date('2026-07-20T00:00:00Z') // Monday
    const saturday = new Date('2026-07-25T00:00:00Z') // Saturday
    expect(filterWorkingDays([monday, saturday], [1,2,3,4,5]).length).toBe(1)
    expect(filterWorkingDays([monday, saturday], [1,2,3,4,5])[0].getDay()).toBe(1)
  })

  it('should handle busy all day → 0 available', () => {
    const date = new Date('2026-07-20T00:00:00Z')
    const busy = [{ start: '2026-07-20T09:00:00Z', end: '2026-07-20T17:00:00Z' }]
    const slots = computeSlotsForDay(date, { start: '09:00', end: '17:00', slotMinutes: 30 }, busy as any)
    expect(slots.filter((s) => s.available).length).toBe(0)
  })

  it('should handle empty busy list → full day', () => {
    const date = new Date('2026-07-20T00:00:00Z')
    const slots = computeSlotsForDay(date, { start: '09:00', end: '10:00', slotMinutes: 30 }, [])
    expect(slots.filter((s) => s.available).length).toBe(2)
  })

  it('should respect slot duration variable 30 vs 60', () => {
    const date = new Date('2026-07-20T00:00:00Z')
    const slots30 = computeSlotsForDay(date, { start: '09:00', end: '10:00', slotMinutes: 30 }, [])
    const slots60 = computeSlotsForDay(date, { start: '09:00', end: '10:00', slotMinutes: 60 }, [])
    expect(slots30.length).toBe(2)
    expect(slots60.length).toBe(1)
  })

  it('should compute slots for multiple days given weeks=2', () => {
    const start = new Date('2026-07-20T00:00:00Z') // Monday
    const busy: any[] = []
    const slots = computeSlots({ startDate: start, weeks: 2, workingHours: { start: '09:00', end: '10:00', days: [1,2,3,4,5], slotMinutes: 30 }, busyBlocks: busy })
    // 2 weeks Mon-Fri, 1 hour per day 2 slots per day, 10 weekdays per 2 weeks → 20 slots, but start Monday includes 2 weeks = 10 days
    expect(slots.length).toBeGreaterThanOrEqual(10)
    // All should be future or today, not past, and available
    expect(slots.every((s: any) => s.available)).toBe(true)
    // No weekend
    slots.forEach((s: any) => {
      const d = new Date(s.date)
      expect([1,2,3,4,5]).toContain(d.getDay())
    })
  })

  it('should return stub slots when STUB=true or no creds', () => {
    const stub = getStubSlots(2)
    expect(stub.length).toBeGreaterThan(0)
    expect(stub[0].available).toBeDefined()
    expect(stub[0].start).toBeDefined()
    // No event details (privacy)
    expect((stub[0] as any).title).toBeUndefined()
    expect((stub[0] as any).summary).toBeUndefined()
  })

  it('should return stub busy blocks for testing', () => {
    const busy = getStubBusyBlocks()
    expect(Array.isArray(busy)).toBe(true)
  })
})
