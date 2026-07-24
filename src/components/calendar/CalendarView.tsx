import React from 'react'
import type { CalendarSlot } from '../../lib/api'
import { TIMEZONE, TIMEZONE_LABEL } from '../../lib/constants'

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
  end.setDate(start.getDate() + 13)
  const selectableSet = new Set<string>()
  for (let i = 0; i < 14; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    // Use Eastern date string for consistency with TIMEZONE
    const etStr = d.toLocaleDateString('en-CA', { timeZone: TIMEZONE }) // en-CA gives YYYY-MM-DD
    selectableSet.add(etStr)
  }
  return { start, end, selectableSet }
}

function getSunday(date: Date): Date {
  // Get Sunday of the week containing date in Eastern timezone, but using local getDay for simplicity (Sun first)
  const d = new Date(date)
  const day = d.getDay()
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
  const weeks: Date[][] = []
  let current = new Date(gridStart)
  let week: Date[] = []
  while (current <= gridEnd) {
    week.push(new Date(current))
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
    current.setDate(current.getDate() + 1)
    if (weeks.length >= 3) break
  }
  if (week.length > 0 && weeks.length < 3) weeks.push(week)
  return { weeks, selectableSet }
}

function formatDayShort(date: Date): { dow: string; day: string; month: string; dateStr: string; isToday: boolean } {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE })
  const dateStr = date.toLocaleDateString('en-CA', { timeZone: TIMEZONE })
  return {
    dow: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: TIMEZONE }).toUpperCase(),
    day: date.toLocaleDateString('en-US', { day: 'numeric', timeZone: TIMEZONE }),
    month: date.toLocaleDateString('en-US', { month: 'short', timeZone: TIMEZONE }),
    dateStr,
    isToday: dateStr === todayStr,
  }
}

export function CalendarView({ grouped, selectedDate, onDateSelect, excludeToday = true, slotMinutes = 30 }: CalendarViewProps) {
  const { weeks, selectableSet } = getCalendarGrid(excludeToday)

  return (
    <div className="card rounded-2xl p-6 md:p-8 bg-white shadow-sm w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h3 className="text-xl font-black tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
            Your availability
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Next 14 days selectable • {slotMinutes} min • {TIMEZONE_LABEL} • Sun–Sat, max 3 weeks
          </p>
        </div>
        {excludeToday && (
          <span className="px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-xs text-amber-700 leading-none">
            No bookings today • From tomorrow
          </span>
        )}
      </div>

      <div className="grid grid-cols-7 gap-2 sm:gap-3 mb-3">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-[11px] uppercase tracking-widest font-semibold text-gray-400">
            {d}
          </div>
        ))}
      </div>

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
                  className={`flex flex-col items-center justify-start py-3 sm:py-4 px-1 sm:px-2 rounded-2xl border transition-all min-h-[92px] sm:min-h-[96px]
                    ${isWeekend ? 'bg-gray-50 text-gray-400 border-gray-100' : ''}
                    ${isOutsideSelectable ? 'bg-white text-gray-300 border-gray-100 opacity-40' : ''}
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
                    <div className={`mt-2 px-4 py-1.5 rounded-full text-[10px] font-medium leading-none ${isSelected ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}>
                      Today
                    </div>
                  ) : null}
                  {isToday && excludeToday && (
                    <div className="mt-2 px-3 py-1 rounded-full text-[9px] bg-amber-100 border border-amber-200 text-amber-700 leading-none">
                      No bookings today
                    </div>
                  )}
                  <div className="mt-2">
                    {hasAvailability && selectableSet.has(dateStr) ? (
                      <span className={`inline-block px-3 py-1 rounded-full text-[10px] sm:text-[11px] leading-none ${isSelected ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}>
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
          Not taking bookings today — next availability from tomorrow • Times in {TIMEZONE_LABEL}
        </div>
      )}
    </div>
  )
}
