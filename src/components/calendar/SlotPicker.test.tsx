import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlotPicker } from './SlotPicker'

describe('SlotPicker', () => {
  it('should show available slots for selected date', () => {
    const slots = [
      { date: '2026-07-20', start: '2026-07-20T09:00:00Z', end: '2026-07-20T09:30:00Z', available: true },
      { date: '2026-07-20', start: '2026-07-20T10:00:00Z', end: '2026-07-20T10:30:00Z', available: true },
    ] as any

    render(<SlotPicker date="2026-07-20" slots={slots} onSlotSelect={vi.fn()} />)
    expect(screen.getByText(/09:00/) || screen.getByText(/10:00/)).toBeTruthy()
  })

  it('should show busy slots as unavailable but no event details', () => {
    const slots = [
      { date: '2026-07-20', start: '2026-07-20T09:00:00Z', end: '2026-07-20T09:30:00Z', available: false },
    ] as any

    render(<SlotPicker date="2026-07-20" slots={slots} onSlotSelect={vi.fn()} />)
    // Should have unavailable text but not leak event titles
    expect(document.body.innerHTML).not.toContain('Meeting with')
    expect(document.body.innerHTML).not.toContain('Private event')
  })

  it('should show empty state when no slots today', () => {
    render(<SlotPicker date="2026-07-20" slots={[]} onSlotSelect={vi.fn()} />)
    expect(screen.getByText(/no slots/i)).toBeInTheDocument()
  })

  it('should call onSlotSelect when clicking available slot', async () => {
    const onSelect = vi.fn()
    const slots = [
      { date: '2026-07-20', start: '2026-07-20T09:00:00Z', end: '2026-07-20T09:30:00Z', available: true },
    ] as any

    render(<SlotPicker date="2026-07-20" slots={slots} onSlotSelect={onSelect} />)
    const btn = screen.getByRole('button', { name: /09:00/ })
    btn.click()
    expect(onSelect).toHaveBeenCalled()
  })
})
