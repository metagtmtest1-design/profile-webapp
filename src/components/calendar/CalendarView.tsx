import React, { useState, useMemo } from 'react'
import type { CalendarSlot } from '../../lib/api'

export interface CalendarViewProps {
  grouped: Record<string, CalendarSlot[]>
  selectedDate: string | null
  onDateSelect: (date: string) => void
}

function getDaysInMonth(year: number, month: number): Date[] {
  const date = new Date(Date.UTC(year, month, 1))
  const days: Date[] = []
  while (date.getUTCMonth() === month) {
    days.push(new Date(date))
    date.setUTCDate(date.getUTCDate() + 1)
  }
  return days
}

export function CalendarView({ grouped, selectedDate, onDateSelect }: CalendarViewProps) {
  const [current, setCurrent] = useState(() => new Date())
  const year = current.getUTCFullYear()
  const month = current.getUTCMonth()

  const days = useMemo(() => getDaysInMonth(year, month), [year, month])

  const todayStr = new Date().toISOString().split('T')[0]

  const nextMonth = () => {
    const d = new Date(current)
    d.setUTCMonth(month + 1)
    setCurrent(d)
  }
  const prevMonth = () => {
    const d = new Date(current)
    d.setUTCMonth(month - 1)
    setCurrent(d)
  }

  return (
    <div className="border rounded-xl p-4 bg-white max-w-md">
      <div className="flex justify-between items-center mb-4">
        <button onClick={prevMonth} className="px-3 py-1 border rounded-lg text-sm">←</button>
        <div className="font-bold">
          {current.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </div>
        <button onClick={nextMonth} className="px-3 py-1 border rounded-lg text-sm">→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs text-center text-gray-500 mb-2">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => (
          <div key={d + Math.random()}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const dateStr = d.toISOString().split('T')[0]
          const hasSlots = grouped[dateStr] && grouped[dateStr].some((s) => s.available)
          const isPast = dateStr < todayStr
          const isSelected = selectedDate === dateStr
          return (
            <button
              key={dateStr}
              onClick={() => !isPast && onDateSelect(dateStr)}
              disabled={isPast}
              aria-selected={isSelected}
              className={`h-9 rounded-lg text-sm border flex items-center justify-center
                ${isPast ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed' : ''}
                ${!isPast && !hasSlots ? 'bg-white text-gray-600 border-gray-200' : ''}
                ${hasSlots ? 'bg-slate-900 text-white border-slate-900' : ''}
                ${isSelected ? 'selected ring-2 ring-black ring-offset-1 font-bold' : ''}`}
            >
              {d.getUTCDate()}
            </button>
          )
        })}
      </div>
      <div className="mt-3 text-xs text-gray-500 text-center">
        {Object.keys(grouped).length} days with availability • Select a date
      </div>
    </div>
  )
}
