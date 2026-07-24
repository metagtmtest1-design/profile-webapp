import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlotPicker } from './SlotPicker'

describe('SlotPicker', () => {
  it('should show available slots for selected date with Eastern time interval 9:00 - 9:30', () => {
    // For Eastern timezone, 09:00 ET in July =13:00 UTC, so use 13:00 UTC to display as 9:00 ET
    const slots = [
      { date: '2026-07-20', start: '2026-07-20T13:00:00Z', end: '2026-07-20T13:30:00Z', available: true },
      { date: '2026-07-20', start: '2026-07-20T14:00:00Z', end: '2026-07-20T14:30:00Z', available: true },
    ] as any

    render(<SlotPicker date="2026-07-20" slots={slots} onSlotSelect={vi.fn()} slotMinutes={30} />)
    // Interval format 9:00 - 9:30 per user request (Eastern)
    expect(screen.getByText(/9:00 - 9:30/) || screen.getByText(/10:00 - 10:30/)).toBeTruthy()
  })

  it('should show busy slots as unavailable but no event details', () => {
    const slots = [
      { date: '2026-07-20', start: '2026-07-20T13:00:00Z', end: '2026-07-20T13:30:00Z', available: false },
    ] as any

    render(<SlotPicker date="2026-07-20" slots={slots} onSlotSelect={vi.fn()} slotMinutes={30} />)
    expect(document.body.innerHTML).not.toContain('Meeting with')
    expect(document.body.innerHTML).not.toContain('Private event')
  })

  it('should show empty state when no slots today', () => {
    render(<SlotPicker date="2026-07-20" slots={[]} onSlotSelect={vi.fn()} slotMinutes={30} />)
    expect(screen.getByText(/no slots/i)).toBeInTheDocument()
  })

  it('should call onSlotSelect when clicking available slot and have close button', async () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    const slots = [
      { date: '2026-07-20', start: '2026-07-20T13:00:00Z', end: '2026-07-20T13:30:00Z', available: true },
    ] as any

    render(<SlotPicker date="2026-07-20" slots={slots} onSlotSelect={onSelect} onClose={onClose} slotMinutes={30} />)
    // Button shows interval 9:00 - 9:30 (Eastern)
    const btn = screen.getByRole('button', { name: /9:00 - 9:30/ })
    btn.click()
    expect(onSelect).toHaveBeenCalled()
    // Close button exists (can close modal)
    expect(screen.getByRole('button', { name: /Close/ })).toBeInTheDocument()
  })

  it('should have smaller buttons no border overlap (px-3 py-2.5 text-xs gap-3)', () => {
    const slots = [
      { date: '2026-07-20', start: '2026-07-20T13:00:00Z', end: '2026-07-20T13:30:00Z', available: true },
    ] as any
    render(<SlotPicker date="2026-07-20" slots={slots} onSlotSelect={vi.fn()} slotMinutes={30} />)
    const btn = screen.getByRole('button', { name: /9:00 - 9:30/ })
    // Smaller buttons per user request make button itself smaller
    expect(btn.className).toContain('px-3')
    expect(btn.className).toContain('py-2.5')
    expect(btn.className).toContain('text-xs')
    expect(btn.className).not.toContain('scale-')
  })
})
