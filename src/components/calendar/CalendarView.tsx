import React from 'react'
import type { CalendarSlot } from '../../lib/api'

export interface CalendarViewProps {
  grouped: Record<string, CalendarSlot[]>
  selectedDate: string | null
  onDateSelect: (date: string) => void
  excludeToday?: boolean
  slotMinutes?: number
}

function getNext14Days(excludeToday: boolean): Date[] {
  const days: Date[] = []
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (excludeToday) start.setDate(start.getDate() + 1)
  for (let i = 0; i < 14; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push(d)
  }
  return days
}

function formatDayShort(date: Date): { dow: string; day: string; month: string; dateStr: string; isToday: boolean } {
  const todayStr = new Date().toISOString().split('T')[0]
  const dateStr = date.toISOString().split('T')[0]
  return {
    dow: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    day: date.getDate().toString(),
    month: date.toLocaleDateString('en-US', { month: 'short' }),
    dateStr,
    isToday: dateStr === todayStr,
  }
}

export function CalendarView({ grouped, selectedDate, onDateSelect, excludeToday = false, slotMinutes = 30 }: CalendarViewProps) {
  const days = getNext14Days(excludeToday)

  return (
    <div className="card rounded-2xl p-6 md:p-8 bg-white shadow-sm w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h3 className="text-xl font-black tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
            Your availability
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Next 14 days • {excludeToday ? 'From tomorrow (today excluded)' : 'From today'} • {slotMinutes} min slots
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="px-3 py-1 bg-slate-50 border rounded-full text-xs">
            {slotMinutes} min
          </span>
          {excludeToday && (
            <span className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-xs text-amber-700">
              Excluding today
            </span>
          )}
        </div>
      </div>

      {/* 14-day calendar — 2 rows, 7 days per row (per user request), from today → 2 weeks */}
      <div className="grid grid-cols-7 gap-2 sm:gap-3">
        {days.map((d) => {
          const { dow, day, month, dateStr, isToday } = formatDayShort(d)
          const daySlots = grouped[dateStr] || []
          const availableCount = daySlots.filter((s) => s.available).length
          const hasAvailability = availableCount > 0
          const isSelected = selectedDate === dateStr
          const isWeekend = [0, 6].includes(d.getDay())
          const isDisabled = !hasAvailability || isWeekend

          return (
            <button
              key={dateStr}
              onClick={() => !isDisabled && onDateSelect(dateStr)}
              disabled={isDisabled}
              aria-selected={isSelected}
              className={`flex flex-col items-center justify-start py-3 sm:py-4 px-1 sm:px-2 rounded-2xl border transition-all min-h-[88px] sm:min-h-[92px]
                ${isWeekend ? 'bg-gray-50 text-gray-400 border-gray-100' : ''}
                ${!isWeekend && !hasAvailability ? 'bg-gray-50 text-gray-400 border-gray-100' : ''}
                ${hasAvailability && !isSelected ? 'bg-white border-slate-200 hover:border-slate-900 hover:shadow-md' : ''}
                ${isSelected ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-[1.02]' : ''}
                ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className={`text-[10px] sm:text-[11px] uppercase tracking-widest ${isSelected ? 'text-slate-300' : 'text-gray-400'}`}>
                {dow}
              </div>
              <div className="text-[18px] sm:text-[22px] font-bold leading-none mt-1">{day}</div>
              <div className={`text-[10px] sm:text-[11px] mt-1 ${isSelected ? 'text-slate-300' : 'text-gray-500'}`}>{month}</div>
              {isToday && !excludeToday ? (
                <div className={`mt-1 text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}>Today</div>
              ) : null}
              <div className="mt-2">
                {hasAvailability ? (
                  <span className={`inline-block px-2 py-1 rounded-full text-[10px] sm:text-[11px] leading-none ${isSelected ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}>
                    {availableCount} slots
                  </span>
                ) : (
                  <span className="text-[10px] sm:text-[11px] text-gray-400">{isWeekend ? 'Weekend' : 'Full'}</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {excludeToday && (
        <div className="mt-4 text-xs text-gray-500 text-center">
          Not taking bookings today — next availability from tomorrow.
        </div>
      )}
    </div>
  )
}
