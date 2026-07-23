import { useEffect, useState, useMemo, useCallback } from 'react'
import { fetchCalendarSlots, type CalendarSlot, type FetchOptions } from '../lib/api'

export interface UseCalendarReturn {
  slots: CalendarSlot[]
  grouped: Record<string, CalendarSlot[]>
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useCalendar(weeks: number = 2, options?: FetchOptions): UseCalendarReturn {
  const [slots, setSlots] = useState<CalendarSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchCalendarSlots(weeks, options)
      setSlots(result)
    } catch (e: any) {
      setError(e.message || String(e))
      setSlots([])
    } finally {
      setLoading(false)
    }
  }, [weeks])

  useEffect(() => {
    fetch()
  }, [fetch])

  const grouped = useMemo(() => {
    const map: Record<string, CalendarSlot[]> = {}
    slots.forEach((s) => {
      if (!map[s.date]) map[s.date] = []
      map[s.date].push(s)
    })
    return map
  }, [slots])

  return { slots, grouped, loading, error, refetch: fetch }
}
