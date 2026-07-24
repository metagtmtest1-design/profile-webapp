import React, { useMemo } from 'react'
import type { CalendarSlot } from '../../lib/api'

export interface SlotPickerProps {
  date: string
  slots: CalendarSlot[]
  onSlotSelect: (slot: CalendarSlot) => void
  onClose?: () => void
  slotMinutes?: number
}

function formatSlotTimeLocal(iso: string): string {
  try {
    const d = new Date(iso)
    // Convert to visitor's local timezone per requirement (different timezone visitors)
    // Using local time (no timeZone) so browser converts UTC ISO to local
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    return time.replace(/\s?[AP]M/i, '').trim()
  } catch {
    return iso
  }
}

function formatSlotInterval(start: string, end: string): string {
  return `${formatSlotTimeLocal(start)} - ${formatSlotTimeLocal(end)}`
}

function formatDateLong(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  } catch {
    return dateStr
  }
}

export function SlotPicker({ date, slots, onSlotSelect, onClose, slotMinutes = 30 }: SlotPickerProps) {
  const { morning, afternoon, availableCount } = useMemo(() => {
    const available = slots.filter((s) => s.available)
    const morning: CalendarSlot[] = []
    const afternoon: CalendarSlot[] = []
    available.forEach((s) => {
      const hour = new Date(s.start).getHours() // Local hour per timezone conversion
      if (hour < 12) morning.push(s)
      else afternoon.push(s)
    })
    return { morning, afternoon, availableCount: available.length }
  }, [slots])

  if (!slots || slots.length === 0) {
    return (
      <div className="card rounded-2xl p-6 bg-white text-center max-w-md w-full">
        <div className="w-10 h-10 rounded-full bg-slate-50 border mx-auto flex items-center justify-center mb-3">📅</div>
        <div className="text-sm font-semibold">No slots for {formatDateLong(date)}</div>
        <div className="text-xs text-gray-500 mt-1">No availability • Try another date in the next 14 days</div>
        {onClose && (
          <button onClick={onClose} className="mt-4 px-4 py-2 rounded-full border text-xs font-medium hover:bg-gray-50">
            Close
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="card rounded-2xl p-6 bg-white shadow-sm max-w-md w-full relative">
      <div className="flex justify-between items-start gap-3 mb-5">
        <div>
          <div className="font-bold text-base tracking-tight">{formatDateLong(date)}</div>
          <div className="text-xs text-gray-500 mt-1">{availableCount} available</div>
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close time slots" className="w-8 h-8 rounded-full border bg-white text-gray-600 hover:bg-gray-50 flex items-center justify-center text-sm focus:outline-none focus:ring-2">
            ✕
          </button>
        )}
      </div>

      {availableCount === 0 ? (
        <div className="text-sm text-gray-500 py-4 text-center">
          <div>All slots booked for this day</div>
          {onClose && (
            <button onClick={onClose} className="mt-3 px-4 py-2 rounded-full bg-slate-900 text-white text-xs">
              Close
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {morning.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-3 font-semibold">Morning</div>
              <div className="grid grid-cols-2 gap-2.5">
                {morning.map((slot) => (
                  <button
                    key={slot.start}
                    onClick={() => onSlotSelect(slot)}
                    className="px-3.5 py-2.5 rounded-full border border-slate-200 bg-white text-slate-900 text-sm font-medium hover:bg-slate-900 hover:text-white hover:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors leading-none"
                  >
                    {formatSlotInterval(slot.start, slot.end)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {afternoon.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-3 font-semibold">Afternoon</div>
              <div className="grid grid-cols-2 gap-2.5">
                {afternoon.map((slot) => (
                  <button
                    key={slot.start}
                    onClick={() => onSlotSelect(slot)}
                    className="px-3.5 py-2.5 rounded-full border border-slate-200 bg-white text-slate-900 text-sm font-medium hover:bg-slate-900 hover:text-white hover:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors leading-none"
                  >
                    {formatSlotInterval(slot.start, slot.end)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
