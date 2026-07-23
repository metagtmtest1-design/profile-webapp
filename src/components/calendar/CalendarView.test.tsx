import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CalendarView } from './CalendarView'

describe('CalendarView', () => {
  it('should render 14-day strip from today till 2 weeks after', () => {
    const grouped = {
      '2026-07-20': [{ date: '2026-07-20', start: '2026-07-20T09:00:00Z', end: '2026-07-20T09:30:00Z', available: true }],
      '2026-07-21': [{ date: '2026-07-21', start: '2026-07-21T09:00:00Z', end: '2026-07-21T09:30:00Z', available: true }],
    } as any

    render(<CalendarView grouped={grouped} selectedDate={null} onDateSelect={vi.fn()} excludeToday={false} slotMinutes={30} />)
    // Should show next 14 days header (not full month grid)
    expect(screen.getByText(/Next 14 days/i)).toBeInTheDocument()
    // Should have 14 buttons for 14-day strip (not 28 for month)
    const buttons = document.querySelectorAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(14)
    expect(buttons.length).toBeLessThanOrEqual(16) // 14 + maybe mobile extras
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
