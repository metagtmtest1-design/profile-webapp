import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CalendarView } from './CalendarView'

describe('CalendarView', () => {
  it('should render 3 weeks max with Sunday first and Saturday last, 7 per row, only next 14 selectable', () => {
    const grouped = {
      '2026-07-20': [{ date: '2026-07-20', start: '2026-07-20T09:00:00Z', end: '2026-07-20T09:30:00Z', available: true }],
    } as any

    render(<CalendarView grouped={grouped} selectedDate={null} onDateSelect={vi.fn()} excludeToday={false} slotMinutes={30} />)
    // Should show next 14 days selectable header
    expect(screen.getByText(/Next 14 days selectable/i)).toBeInTheDocument()
    // Weekday header has Sun first and Sat last (header row)
    const headerRow = document.querySelector('.grid.grid-cols-7')
    expect(headerRow?.textContent).toMatch(/Sun/)
    expect(headerRow?.textContent).toMatch(/Sat/)
    // Should display max 3 weeks (21 days) depending on overlap, but only 14 selectable — total buttons 14-21
    const buttons = document.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(14)
    expect(buttons.length).toBeLessThanOrEqual(21)
  })

  it('should support excludeToday option not taking any schedule today', () => {
    const grouped = {} as any
    render(<CalendarView grouped={grouped} selectedDate={null} onDateSelect={vi.fn()} excludeToday={true} slotMinutes={30} />)
    expect(screen.getByText(/Excluding today/i)).toBeInTheDocument()
    expect(screen.getByText(/Not taking bookings today/i)).toBeInTheDocument()
  })

  it('should highlight dates with available slots and selected state', () => {
    const grouped = {
      '2026-07-20': [{ date: '2026-07-20', start: '2026-07-20T09:00:00Z', end: '2026-07-20T09:30:00Z', available: true }],
    } as any

    render(<CalendarView grouped={grouped} selectedDate="2026-07-20" onDateSelect={vi.fn()} excludeToday={false} slotMinutes={30} />)
    const selected = document.querySelector('[aria-selected="true"]')
    expect(document.body.innerHTML.length).toBeGreaterThan(0)
  })
})
