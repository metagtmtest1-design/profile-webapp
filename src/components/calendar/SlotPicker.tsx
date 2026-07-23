import React, { useMemo } from 'react'
import type { CalendarSlot } from '../../lib/api'

export interface SlotPickerProps {
  date: string
  slots: CalendarSlot[]
  onSlotSelect: (slot: CalendarSlot) => void
  slotMinutes?: number
}

function formatSlotTime(iso: string): string {
  try {
    const d = new Date(iso)
    // 12h without leading zero, e.g. 9:00 — strip AM/PM for interval display like 9:00 - 9:30 per user request
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })
    return time.replace(/\s?[AP]M/i, '').trim()
  } catch {
    return iso
  }
}

function formatSlotInterval(start: string, end: string): string {
  return `${formatSlotTime(start)} - ${formatSlotTime(end)}`
}

function formatDateLong(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
  } catch {
    return dateStr
  }
}

export function SlotPicker({ date, slots, onSlotSelect, slotMinutes = 30 }: SlotPickerProps) {
  const { morning, afternoon, availableCount } = useMemo(() => {
    const available = slots.filter((s) => s.available)
    const morning: CalendarSlot[] = []
    const afternoon: CalendarSlot[] = []
    available.forEach((s) => {
      const hour = new Date(s.start).getUTCHours()
      if (hour < 12) morning.push(s)
      else afternoon.push(s)
    })
    return { morning, afternoon, availableCount: available.length }
  }, [slots])

  if (!slots || slots.length === 0) {
    return (
      <div className="card rounded-2xl p-6 bg-white text-center">
        <div className="w-10 h-10 rounded-full bg-slate-50 border mx-auto flex items-center justify-center mb-3">📅</div>
        <div className="text-sm font-semibold">No slots for {formatDateLong(date)}</div>
        <div className="text-xs text-gray-500 mt-1">No availability • Try another date in the next 14 days</div>
      </div>
    )
  }

  return (
    <div className="card rounded-2xl p-6 bg-white shadow-sm max-w-md w-full">
      <div className="flex justify-between items-start gap-3 mb-5">
        <div>
          <div className="font-bold text-base tracking-tight">{formatDateLong(date)}</div>
          <div className="text-xs text-gray-500 mt-1">{availableCount} available • {slotMinutes} min each</div>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white text-xs">{slotMinutes}m</span>
      </div>

      {availableCount === 0 ? (
        <div className="text-sm text-gray-500 py-4 text-center">All slots booked for this day</div>
      ) : (
        <div className="space-y-6">
          {morning.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-3 font-semibold">Morning (9AM-12PM)</div>
              <div className="grid grid-cols-2 gap-2">
                {morning.map((slot) => (
                  <button
                    key={slot.start}
                    onClick={() => onSlotSelect(slot)}
                    className="px-4 py-3 rounded-full border bg-white text-slate-900 text-sm font-medium hover:bg-slate-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors leading-none"
                  >
                    {formatSlotInterval(slot.start, slot.end)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {afternoon.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-widest text-gray-400 mb-3 font-semibold">Afternoon (12PM-5PM)</div>
              <div className="grid grid-cols-2 gap-2">
                {afternoon.map((slot) => (
                  <button
                    key={slot.start}
                    onClick={() => onSlotSelect(slot)}
                    className="px-4 py-3 rounded-full border bg-white text-slate-900 text-sm font-medium hover:bg-slate-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-slate-900 transition-colors leading-none"
                  >
                    {formatSlotInterval(slot.start, slot.end)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 text-[11px] text-gray-400 text-center">
        Privacy: only free/busy shown, no event details. Slots are {slotMinutes} min (multiple of 15 configurable).
      </div>
    </div>
  )
}
