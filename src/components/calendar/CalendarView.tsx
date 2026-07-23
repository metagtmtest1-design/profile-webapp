import React from 'react'
import type { CalendarSlot } from '../../lib/api'

export interface CalendarViewProps {
  grouped: Record<string, CalendarSlot[]>
  selectedDate: string | null
  onDateSelect: (date: string) => void
  excludeToday?: boolean
  slotMinutes?: number
}

function getNext14Range(excludeToday: boolean): { start: Date; end: Date; selectableSet: Set<string> } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  if (excludeToday) start.setDate(start.getDate() + 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 13) // 14 days inclusive start to +13
  const selectableSet = new Set<string>()
  for (let i = 0; i < 14; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    selectableSet.add(d.toISOString().split('T')[0])
  }
  return { start, end, selectableSet }
}

function getSunday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 Sun
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

function getSaturday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() + (6 - day))
  d.setHours(0, 0, 0, 0)
  return d
}

function getCalendarGrid(excludeToday: boolean): { weeks: Date[][]; selectableSet: Set<string> } {
  const { start, end, selectableSet } = getNext14Range(excludeToday)
  const gridStart = getSunday(start)
  const gridEnd = getSaturday(end)
  // Max 3 weeks per requirement — gridStart to gridEnd inclusive should be max 21 days (3 weeks)
  const weeks: Date[][] = []
  let current = new Date(gridStart)
  // Safety: max 3 weeks = 21 days, so max 3 rows
  let week: Date[] = []
  while (current <= gridEnd) {
    week.push(new Date(current))
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
    current.setDate(current.getDate() + 1)
    // Cap at 3 weeks per requirement
    if (weeks.length >= 3) break
  }
  if (week.length > 0 && weeks.length < 3) weeks.push(week)
  return { weeks, selectableSet }
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
  const { weeks, selectableSet } = getCalendarGrid(excludeToday)

  return (
    <div className="card rounded-2xl p-6 md:p-8 bg-white shadow-sm w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h3 className="text-xl font-black tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
            Your availability
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Next 14 days selectable • Display up to 3 weeks (Sun-Sat) • {slotMinutes} min
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="px-4 py-2 rounded-full bg-slate-50 border text-xs leading-none">
            {slotMinutes}m
          </span>
          {excludeToday && (
            <span className="px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-xs text-amber-700 leading-none">
              Excluding today
            </span>
          )}
        </div>
      </div>

      {/* Weekday header Sun first, Sat last */}
      <div className="grid grid-cols-7 gap-2 sm:gap-3 mb-3">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-[11px] uppercase tracking-widest font-semibold text-gray-400">
            {d}
          </div>
        ))}
      </div>

      {/* Max 3 weeks, 7 per row, but only next 14 days selectable */}
      <div className="space-y-3">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-2 sm:gap-3">
            {week.map((d) => {
              const { dow, day, month, dateStr, isToday } = formatDayShort(d)
              const daySlots = grouped[dateStr] || []
              const availableCount = daySlots.filter((s) => s.available).length
              const hasAvailability = availableCount > 0
              const isSelected = selectedDate === dateStr
              const isWeekend = [0, 6].includes(d.getDay())
              const isSelectable = selectableSet.has(dateStr) && !isWeekend && hasAvailability
              const isOutsideSelectable = !selectableSet.has(dateStr)

              return (
                <button
                  key={dateStr}
                  onClick={() => isSelectable && onDateSelect(dateStr)}
                  disabled={!isSelectable}
                  aria-selected={isSelected}
                  className={`flex flex-col items-center justify-start py-3 sm:py-4 px-1 sm:px-2 rounded-2xl border transition-all min-h-[90px] sm:min-h-[94px]
                    ${isWeekend ? 'bg-gray-50 text-gray-400 border-gray-100' : ''}
                    ${isOutsideSelectable ? 'bg-white text-gray-300 border-gray-100 opacity-50' : ''}
                    ${!isWeekend && !isOutsideSelectable && !hasAvailability ? 'bg-gray-50 text-gray-400 border-gray-100' : ''}
                    ${hasAvailability && isSelectable && !isSelected ? 'bg-white border-slate-200 hover:border-slate-900 hover:shadow-md' : ''}
                    ${isSelected ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-[1.02]' : ''}
                    ${!isSelectable ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className={`text-[10px] sm:text-[11px] uppercase tracking-widest ${isSelected ? 'text-slate-300' : 'text-gray-400'}`}>
                    {dow}
                  </div>
                  <div className="text-[18px] sm:text-[20px] font-bold leading-none mt-1">{day}</div>
                  <div className={`text-[10px] sm:text-[11px] mt-1 ${isSelected ? 'text-slate-300' : 'text-gray-500'}`}>{month}</div>
                  {isToday && !excludeToday && !isOutsideSelectable ? (
                    <div className={`mt-1 px-3 py-1 rounded-full text-[10px] font-medium leading-none ${isSelected ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}>
                      Today
                    </div>
                  ) : null}
                  <div className="mt-2">
                    {hasAvailability && selectableSet.has(dateStr) ? (
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] leading-none ${isSelected ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}>
                        {availableCount} slots
                      </span>
                    ) : (
                      <span className="text-[10px] sm:text-[11px] text-gray-400">
                        {isWeekend ? 'Weekend' : isOutsideSelectable ? '' : 'Full'}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {excludeToday && (
        <div className="mt-5 text-xs text-gray-500 text-center">
          Not taking bookings today — next availability from tomorrow.
        </div>
      )}
    </div>
  )
}
