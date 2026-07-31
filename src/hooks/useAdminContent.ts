import { useEffect, useState, useCallback } from 'react'
import { fetchJson } from '../lib/api'

export interface AdminSection {
  id: string
  type: string
  heading: string
  subheading?: string
  sort_order: number
  is_visible: number
  config: any
  items: AdminItem[]
}

export interface AdminItem {
  id: string
  section_id: string
  title: string
  body?: string
  image_url?: string
  sort_order: number
  is_visible: number
  icon?: string
  link_url?: string
  link_text?: string
  author?: string
}

export interface UseAdminContentReturn {
  sections: AdminSection[]
  loading: boolean
  error: string | null
  updateSection: (id: string, patch: Partial<AdminSection>) => Promise<void>
  updateItem: (id: string, patch: Partial<AdminItem>) => Promise<void>
  reorderSections: (orderedIds: string[]) => Promise<void>
  reorderItems: (sectionId: string, orderedIds: string[]) => Promise<void>
  refetch: () => Promise<void>
}

export function useAdminContent(): UseAdminContentReturn {
  const [sections, setSections] = useState<AdminSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchContent = useCallback(async () => {
    console.log('!!! USE_ADMIN_CONTENT_FETCH_START url=/api/admin/content')
    setLoading(true)
    setError(null)
    try {
      const { json } = await fetchJson('/api/admin/content', { cache: 'no-store' } as any)
      const data = json as any
      console.log('!!! USE_ADMIN_CONTENT_FETCHED raw=' + JSON.stringify(data)?.slice(0,500))
      setSections(data.sections || [])
      console.log(`!!! USE_ADMIN_CONTENT_FETCHED sections=${data.sections?.length}`)
    } catch (e: any) {
      console.log('!!! USE_ADMIN_CONTENT_ERROR error=' + e?.message + ' stack=' + e?.stack?.slice(0,500))
      setError(e?.message || String(e))
      console.log(`!!! USE_ADMIN_CONTENT_ERROR ${e?.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContent()
  }, [fetchContent])

  const updateSection = async (id: string, patch: Partial<AdminSection>) => {
    console.log(`!!! USE_ADMIN_CONTENT_UPDATE_SECTION id=${id} patch=${JSON.stringify(patch).slice(0, 200)}`)
    const { json } = await fetchJson(`/api/admin/sections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    } as any)
    const updated = json as AdminSection
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)))
  }

  const updateItem = async (id: string, patch: Partial<AdminItem>) => {
    console.log(`!!! USE_ADMIN_CONTENT_UPDATE_ITEM id=${id} patch=${JSON.stringify(patch).slice(0, 200)}`)
    const { json } = await fetchJson(`/api/admin/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    } as any)
    const updated = json as AdminItem
    setSections((prev) =>
      prev.map((sec) => ({
        ...sec,
        items: sec.items.map((it) => (it.id === id ? { ...it, ...updated } : it)),
      }))
    )
  }

  const reorderSections = async (orderedIds: string[]) => {
    console.log(`!!! USE_ADMIN_CONTENT_REORDER_SECTIONS ${orderedIds.join(',')}`)
    await fetchJson('/api/admin/sections/reorder', {
      method: 'POST',
      body: JSON.stringify({ orderedIds }),
    } as any)
    // Optimistic reorder
    setSections((prev) => {
      const map = new Map(prev.map((s) => [s.id, s]))
      return orderedIds.map((id, idx) => ({ ...map.get(id)!, sort_order: idx } as AdminSection)).filter(Boolean)
    })
  }

  const reorderItems = async (sectionId: string, orderedIds: string[]) => {
    console.log(`!!! USE_ADMIN_CONTENT_REORDER_ITEMS sec=${sectionId} ${orderedIds.join(',')}`)
    await fetchJson('/api/admin/items/reorder', {
      method: 'POST',
      body: JSON.stringify({ sectionId, orderedIds }),
    } as any)
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.id !== sectionId) return sec
        const itemMap = new Map(sec.items.map((it) => [it.id, it]))
        const reordered = orderedIds.map((id, idx) => ({ ...itemMap.get(id)!, sort_order: idx } as AdminItem)).filter(Boolean)
        return { ...sec, items: reordered }
      })
    )
  }

  return {
    sections,
    loading,
    error,
    updateSection,
    updateItem,
    reorderSections,
    reorderItems,
    refetch: fetchContent,
  }
}
