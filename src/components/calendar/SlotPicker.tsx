import React from 'react'
import type { CalendarSlot } from '../../lib/api'

export interface SlotPickerProps {
  date: string
  slots: CalendarSlot[]
  onSlotSelect: (slot: CalendarSlot) => void
}

function formatSlotTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
  } catch {
    return iso
  }
}

export function SlotPicker({ date, slots, onSlotSelect }: SlotPickerProps) {
  if (!slots || slots.length === 0) {
    return (
      <div className="border rounded-xl p-6 bg-white text-center text-gray-500">
        <div className="text-sm">No slots for {date}</div>
        <div className="text-xs mt-1">No availability • Try another date</div>
      </div>
    )
  }

  const available = slots.filter((s) => s.available)
  const unavailable = slots.filter((s) => !s.available)

  return (
    <div className="border rounded-xl p-4 bg-white max-w-md">
      <div className="font-semibold mb-3 text-sm">Available times for {date}</div>
      <div className="flex flex-wrap gap-2">
        {available.map((slot) => (
          <button
            key={slot.start}
            onClick={() => onSlotSelect(slot)}
            className="px-4 py-2 rounded-full border bg-white text-slate-900 text-sm font-medium hover:bg-slate-900 hover:text-white focus:outline-none focus:ring-2 focus:ring-black"
          >
            {formatSlotTime(slot.start)} - {formatSlotTime(slot.end)}
          </button>
        ))}
      </div>
      {available.length === 0 && <div className="text-sm text-gray-500 mt-2">No slots — all busy</div>}
      {unavailable.length > 0 && (
        <div className="mt-4 text-xs text-gray-400">
          {unavailable.length} unavailable (privacy — no event details shown)
        </div>
      )}
    </div>
  )
}
