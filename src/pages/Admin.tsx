import React, { useState } from 'react'
import { useAdminAuth } from '../hooks/useAdminAuth'
import { useAdminContent, type AdminSection, type AdminItem } from '../hooks/useAdminContent'
import { EditableText } from '../components/admin/EditableText'
import { ImageUploader } from '../components/admin/ImageUploader'
import { fetchR2Usage } from '../lib/api'
import { HeroSection } from '../components/sections/HeroSection'
import { CardsGrid } from '../components/sections/CardsGrid'
import { TextBlock } from '../components/sections/TextBlock'
import { Testimonials } from '../components/sections/Testimonials'
import { CTABanner } from '../components/sections/CTABanner'
import { ImageGallery } from '../components/sections/ImageGallery'

export function Admin() {
  // Hooks must be before any early return — fixes React #310
  const auth = useAdminAuth()
  const { data, loading, error, isAuthed, isBypass, email, refetch } = auth
  const content = useAdminContent()
  const [quota, setQuota] = useState<any>(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [openSectionId, setOpenSectionId] = useState<string | null>(null)
  const [openItemIds, setOpenItemIds] = useState<Set<string>>(new Set())

  if (import.meta.env.DEV) {
    console.log('!!! ADMIN_PAGE_RENDER_START path=' + (typeof window !== 'undefined' ? window.location.pathname : 'no-window'))
    console.log('!!! ADMIN_AUTH_STATE loading=' + loading + ' isAuthed=' + isAuthed + ' email=' + email)
    console.log('!!! ADMIN_CONTENT_HOOK sections=' + content.sections.length + ' loading=' + content.loading)
  }

  const handleCheckQuota = async () => {
    setQuotaLoading(true)
    try {
      const result = await fetchR2Usage(true)
      setQuota(result)
      if (import.meta.env.DEV) console.log(`!!! ADMIN_R2_QUOTA_CHECK objects=${result.totalObjects} MB=${result.totalMB}`)
    } finally {
      setQuotaLoading(false)
    }
  }

  const toggleItem = (id: string) => {
    setOpenItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-24 text-center">
        <div className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-pulse mr-2"></div>
        <span className="text-gray-600 text-sm">Checking admin access…</span>
      </div>
    )
  }

  if (!isAuthed) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black tracking-tight mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>
            Admin — Passwordless Google Login
          </h1>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border text-[11px] font-semibold mb-3">
            <span className="w-2 h-2 rounded-full bg-green-500"></span> Google only, no password
          </div>
          <p className="text-sm text-gray-700 mb-2">Please login via Google — only allowlisted emails can access.</p>
          {data?.error && <div className="text-xs bg-white border p-2 rounded-lg mt-2">{data.error}</div>}
          <div className="flex gap-3 justify-center mt-4">
            <button onClick={() => refetch()} className="px-6 py-3 bg-slate-900 text-white rounded-full text-sm font-semibold">Retry</button>
            <a href="/" className="px-6 py-3 bg-white border rounded-full text-sm font-semibold">Back to home</a>
          </div>
        </div>
      </div>
    )
  }

  const renderPreview = (section: AdminSection) => {
    const items = section.items || []
    const secForPreview = { ...section, config: typeof section.config === 'string' ? JSON.parse(section.config || '{}') : section.config } as any
    switch (section.type) {
      case 'hero':
        return <HeroSection key={section.id} section={secForPreview} items={items as any} />
      case 'cards-grid':
        return <CardsGrid key={section.id} section={secForPreview} items={items as any} />
      case 'text-block':
        return <TextBlock key={section.id} section={secForPreview} items={items as any} />
      case 'testimonials':
        return <Testimonials key={section.id} section={secForPreview} items={items as any} />
      case 'cta-banner':
        return <CTABanner key={section.id} section={secForPreview} items={items as any} />
      case 'image-gallery':
        return <ImageGallery key={section.id} section={secForPreview} items={items as any} />
      default:
        return null
    }
  }

  // Contextual fields helper — M2
  const isHero = (type: string) => type === 'hero'
  const isCards = (type: string) => type === 'cards-grid'
  const isText = (type: string) => type === 'text-block'
  const isTestimonials = (type: string) => type === 'testimonials'
  const isCta = (type: string) => type === 'cta-banner'
  const isGallery = (type: string) => type === 'image-gallery'

  return (
    <div className="bg-white min-h-screen">
      {/* Minimal top bar — M3 — no verbose allowlist/strategy leak */}
      <div className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b">
        <div className="max-w-6xl mx-auto px-6 py-3 flex justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <h1 className="text-sm font-black tracking-tight">Admin</h1>
            <span className="w-1 h-1 bg-gray-300 rounded-full" aria-hidden />
            <span className="text-gray-600"><span className="font-semibold">{email}</span></span>
            <span className="w-1 h-1 bg-gray-300 rounded-full hidden sm:inline" aria-hidden />
            <span className="text-gray-500 hidden sm:inline">{data?.env}</span>
            {isBypass && <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px] uppercase">Bypass</span>}
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={handleCheckQuota} disabled={quotaLoading} className="px-3 py-1.5 bg-white border rounded-full text-[11px] font-semibold hover:border-slate-900 disabled:opacity-50" aria-label="Check R2 storage quota">
              {quotaLoading ? 'Checking…' : quota ? `${quota.totalMB}MB / ${quota.limitMB}MB` : 'R2 Quota'}
            </button>
            <button onClick={() => { refetch(); content.refetch() }} className="px-3 py-1.5 bg-white border rounded-full text-[11px] font-semibold hover:border-slate-900" aria-label="Refresh content">Refresh</button>
            <a href="/" className="px-3 py-1.5 bg-slate-900 text-white rounded-full text-[11px] font-semibold hover:bg-black" aria-label="View live site">View site</a>
          </div>
        </div>
        {quota && (
          <div className="max-w-6xl mx-auto px-6 pb-3">
            <div className="p-2.5 bg-slate-50 rounded-xl border text-[11px] flex flex-wrap gap-3 items-center">
              <span>Objects: {quota.totalObjects}</span>
              <span>{quota.totalMB}MB / {quota.limitMB}MB ({quota.percent?.toFixed(2)}%)</span>
              <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden" aria-label={`Storage ${quota.percent}%`}>
                <div className="h-full bg-slate-900" style={{ width: `${Math.min(100, quota.percent)}%` }} />
              </div>
              <span className={quota.warning ? 'text-red-600 font-semibold' : 'text-green-700'}>{quota.warning ? '⚠️ >90% — delete unused' : 'Safe — 100 images ~40MB/env <1% of 10GB'}</span>
            </div>
          </div>
        )}
      </div>

      {content.loading ? (
        <div className="max-w-5xl mx-auto px-6 py-24 text-center text-sm text-gray-500">Loading portfolio content…</div>
      ) : content.error ? (
        <div className="max-w-5xl mx-auto px-6 py-12 text-sm text-red-600">Error: {content.error}</div>
      ) : (
        <div>
          {[...content.sections]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((section, secIdx) => {
              const isOpen = openSectionId === section.id
              const isHidden = !section.is_visible
              return (
                <div key={section.id} className={`relative group/section border-b ${isHidden ? 'bg-amber-50/30' : ''}`}>
                  {/* Preview — almost identical to landing page — H1 + H4 */}
                  <div className={`relative ${isHidden ? 'opacity-60 grayscale' : ''}`}>
                    {renderPreview(section)}
                    <div className="absolute top-3 right-3 sm:right-6 z-20 flex gap-2">
                      <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white text-[10px] uppercase tracking-wide shadow-sm">{section.type}</span>
                      {isHidden && <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] shadow-sm">Hidden</span>}
                    </div>
                    {isHidden && <div className="absolute inset-0 border-2 border-dashed border-amber-300 pointer-events-none" aria-hidden />}
                  </div>

                  {/* Edit drawer — collapsed by default — M1, H1 */}
                  <div className="max-w-5xl mx-auto px-6">
                    <div className="border-x border-b rounded-b-2xl bg-white shadow-sm -mt-px">
                      <div className="px-4 py-2.5 flex justify-between items-center bg-white/90 backdrop-blur sticky top-[48px] z-10 border-b">
                        <button
                          onClick={() => setOpenSectionId(isOpen ? null : section.id)}
                          className="text-xs font-semibold hover:underline flex items-center gap-1.5 text-left"
                          aria-label={isOpen ? `Collapse edit for ${section.type}` : `Expand edit for ${section.type}`}
                          aria-expanded={isOpen}
                        >
                          <span aria-hidden>{isOpen ? '▼' : '▶'}</span> Edit {section.type} — {section.heading ? `"${section.heading.slice(0, 40)}${section.heading.length > 40 ? '…' : ''}"` : section.id} (current)
                        </button>
                        <div className="flex gap-1">
                          <button aria-label="Move section up" disabled={secIdx === 0} onClick={async () => {
                            const sorted = [...content.sections].sort((a, b) => a.sort_order - b.sort_order)
                            const idx = sorted.findIndex((s) => s.id === section.id)
                            if (idx > 0) {
                              const tmp = sorted[idx - 1]
                              sorted[idx - 1] = sorted[idx]
                              sorted[idx] = tmp
                              await content.reorderSections(sorted.map((s) => s.id))
                            }
                          }} className="px-2.5 py-1 bg-white border rounded-full text-[11px] disabled:opacity-20 hover:border-slate-900">↑</button>
                          <button aria-label="Move section down" disabled={secIdx === content.sections.length - 1} onClick={async () => {
                            const sorted = [...content.sections].sort((a, b) => a.sort_order - b.sort_order)
                            const idx = sorted.findIndex((s) => s.id === section.id)
                            if (idx < sorted.length - 1) {
                              const tmp = sorted[idx + 1]
                              sorted[idx + 1] = sorted[idx]
                              sorted[idx] = tmp
                              await content.reorderSections(sorted.map((s) => s.id))
                            }
                          }} className="px-2.5 py-1 bg-white border rounded-full text-[11px] disabled:opacity-20 hover:border-slate-900">↓</button>
                          <button aria-label={section.is_visible ? 'Hide section' : 'Show section'} onClick={async () => await content.updateSection(section.id, { is_visible: section.is_visible ? 0 : 1 } as any)} className="px-2.5 py-1 bg-white border rounded-full text-[11px] hover:border-slate-900">{section.is_visible ? 'Hide' : 'Show'}</button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="p-4 space-y-4">
                          {/* Section fields — contextual */}
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <div className="text-[11px] font-semibold text-gray-500 mb-1">Heading — text input — current</div>
                              <EditableText value={section.heading || ''} onSave={(v) => content.updateSection(section.id, { heading: v } as any)} placeholder="Heading" required ariaLabel={`Heading for ${section.type}`} />
                            </div>
                            <div>
                              <div className="text-[11px] font-semibold text-gray-500 mb-1">Subheading — textarea — current</div>
                              <EditableText value={section.subheading || ''} onSave={(v) => content.updateSection(section.id, { subheading: v } as any)} placeholder="Subheading" multiline ariaLabel={`Subheading for ${section.type}`} />
                            </div>
                          </div>

                          {/* Items — contextual fields M2 */}
                          <div className="space-y-3">
                            <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Items — {section.items.length} — shows current text/image — inline edit</div>
                            {section.items
                              .sort((a, b) => a.sort_order - b.sort_order)
                              .map((item, itemIdx) => {
                                const itemOpen = openItemIds.has(item.id)
                                const showIcon = isCards(section.type)
                                const showLink = isHero(section.type) || isCards(section.type) || isCta(section.type)
                                const showAuthor = isTestimonials(section.type)
                                const showBody = !isGallery(section.type) || item.body
                                return (
                                  <div key={item.id} className={`p-3 rounded-xl border ${item.is_visible ? 'bg-slate-50 border-slate-200' : 'bg-amber-50/50 border-amber-200 opacity-80'}`}>
                                    <div className="flex justify-between items-center">
                                      <button onClick={() => toggleItem(item.id)} className="text-xs font-semibold text-left flex items-center gap-1.5" aria-label={itemOpen ? `Collapse item ${item.title}` : `Expand item ${item.title}`} aria-expanded={itemOpen}>
                                        {itemOpen ? '▼' : '▶'} #{item.sort_order} {item.title || item.id} {item.is_visible ? '' : '(Hidden)'} — current
                                      </button>
                                      <div className="flex gap-1">
                                        <button aria-label="Move item up" disabled={itemIdx === 0} onClick={async () => {
                                          const ordered = [...section.items].sort((a, b) => a.sort_order - b.sort_order)
                                          const idx = ordered.findIndex((i) => i.id === item.id)
                                          if (idx > 0) {
                                            const tmp = ordered[idx - 1]
                                            ordered[idx - 1] = ordered[idx]
                                            ordered[idx] = tmp
                                            await content.reorderItems(section.id, ordered.map((i) => i.id))
                                          }
                                        }} className="px-2 py-1 bg-white border rounded-full text-[10px] disabled:opacity-20">↑</button>
                                        <button aria-label="Move item down" disabled={itemIdx === section.items.length - 1} onClick={async () => {
                                          const ordered = [...section.items].sort((a, b) => a.sort_order - b.sort_order)
                                          const idx = ordered.findIndex((i) => i.id === item.id)
                                          if (idx < ordered.length - 1) {
                                            const tmp = ordered[idx + 1]
                                            ordered[idx + 1] = ordered[idx]
                                            ordered[idx] = tmp
                                            await content.reorderItems(section.id, ordered.map((i) => i.id))
                                          }
                                        }} className="px-2 py-1 bg-white border rounded-full text-[10px] disabled:opacity-20">↓</button>
                                        <button aria-label={item.is_visible ? 'Hide item' : 'Show item'} onClick={async () => await content.updateItem(item.id, { is_visible: item.is_visible ? 0 : 1 } as any)} className="px-2 py-1 bg-white border rounded-full text-[10px]">{item.is_visible ? 'Hide' : 'Show'}</button>
                                      </div>
                                    </div>

                                    {itemOpen && (
                                      <div className="mt-3 space-y-3">
                                        <div className="grid sm:grid-cols-2 gap-3">
                                          <div>
                                            <div className="text-[11px] text-gray-500 mb-1">Title — text input — current: {item.title || 'empty'}</div>
                                            <EditableText value={item.title || ''} onSave={(v) => content.updateItem(item.id, { title: v } as any)} placeholder="Title" ariaLabel={`Title for ${item.id}`} />
                                          </div>
                                          {showIcon && (
                                            <div>
                                              <div className="text-[11px] text-gray-500 mb-1">Icon — text input — current: {item.icon || 'default'}</div>
                                              <EditableText value={item.icon || ''} onSave={(v) => content.updateItem(item.id, { icon: v } as any)} placeholder="🎯" ariaLabel={`Icon for ${item.id}`} />
                                            </div>
                                          )}
                                        </div>

                                        {showBody && (
                                          <div>
                                            <div className="text-[11px] text-gray-500 mb-1">Body — textarea — current text</div>
                                            <EditableText value={item.body || ''} onSave={(v) => content.updateItem(item.id, { body: v } as any)} placeholder="Body" multiline ariaLabel={`Body for ${item.id}`} />
                                          </div>
                                        )}

                                        {showLink && (
                                          <div className="grid sm:grid-cols-2 gap-3">
                                            <div>
                                              <div className="text-[11px] text-gray-500 mb-1">Link text — text input — current: {item.link_text || 'empty'}</div>
                                              <EditableText value={item.link_text || ''} onSave={(v) => content.updateItem(item.id, { link_text: v } as any)} placeholder="Learn more" ariaLabel={`Link text for ${item.id}`} />
                                            </div>
                                            <div>
                                              <div className="text-[11px] text-gray-500 mb-1">Link URL — text input — current: {item.link_url || 'empty'}</div>
                                              <EditableText value={item.link_url || ''} onSave={(v) => content.updateItem(item.id, { link_url: v } as any)} placeholder="/#services or https://" ariaLabel={`Link URL for ${item.id}`} />
                                            </div>
                                          </div>
                                        )}

                                        {showAuthor && (
                                          <div>
                                            <div className="text-[11px] text-gray-500 mb-1">Author — text input — current: {item.author || 'empty'}</div>
                                            <EditableText value={item.author || ''} onSave={(v) => content.updateItem(item.id, { author: v } as any)} placeholder="Author" ariaLabel={`Author for ${item.id}`} />
                                          </div>
                                        )}

                                        <div>
                                          <div className="text-[11px] text-gray-500 mb-1">Current image — {item.image_url ? 'shows current' : 'no image'} — image upload PNG if ≤1MB else WebP within 1MB, max 1200px</div>
                                          <ImageUploader
                                            currentImageUrl={item.image_url}
                                            oldKey={item.image_url?.startsWith('/api/images/') ? item.image_url.replace('/api/images/', '') : item.image_url?.startsWith('portfolio/') ? item.image_url : undefined}
                                            onUploadComplete={async (result) => {
                                              if (import.meta.env.DEV) console.log(`!!! ADMIN_ITEM_IMAGE_UPLOADED item=${item.id} key=${result.key} format=${result.format}`)
                                              await content.updateItem(item.id, { image_url: result.url } as any)
                                            }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
