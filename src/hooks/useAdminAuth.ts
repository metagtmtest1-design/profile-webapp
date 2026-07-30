import { useEffect, useState, useCallback } from 'react'
import { fetchAdminAuth, type AdminAuthResponse, type FetchOptions } from '../lib/api'

export interface UseAdminAuthReturn {
  data: AdminAuthResponse | null
  loading: boolean
  error: string | null
  isAuthed: boolean
  isBypass: boolean
  email: string | null
  refetch: () => Promise<void>
}

export function useAdminAuth(options?: FetchOptions): UseAdminAuthReturn {
  const [data, setData] = useState<AdminAuthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAuth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchAdminAuth(options)
      setData(result)
    } catch (e: any) {
      // ApiError with status 401/403 contains body with authed false
      if (e?.body?.authed === false) {
        setData(e.body as AdminAuthResponse)
        setError(e.body?.error || e.message)
      } else {
        setError(e.message || String(e))
        setData(null)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAuth()
  }, [fetchAuth])

  return {
    data,
    loading,
    error,
    isAuthed: !!data?.authed,
    isBypass: !!data?.bypass,
    email: (data?.email as string) || null,
    refetch: fetchAuth,
  }
}
