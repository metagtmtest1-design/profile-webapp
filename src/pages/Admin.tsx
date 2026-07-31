import React, { useState } from 'react'
import { useAdminAuth } from '../hooks/useAdminAuth'
import { useAdminContent, type AdminSection } from '../hooks/useAdminContent'
import { EditableText } from '../components/admin/EditableText'
import { ImageUploader } from '../components/admin/ImageUploader'
import { fetchR2Usage } from '../lib/api'

function getOldKeyFromUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  try {
    let path = url
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const u = new URL(url)
      path = u.pathname
    }
    path = path.split('?')[0]
    if (path.includes('/api/images/')) {
      const idx = path.indexOf('/api/images/')
      let key = path.slice(idx + '/api/images/'.length)
      if (key.startsWith('/')) key = key.slice(1)
      if (key.startsWith('portfolio/')) return key
    }
    if (path.startsWith('/api/images/')) return path.replace('/api/images/', '')
    if (path.startsWith('portfolio/')) return path.split('?')[0]
    return undefined
  } catch {
    return undefined
  }
}

export function Admin() {
  const auth = useAdminAuth()
  const { data, loading, error, isAuthed, isBypass, email, refetch } = auth
  const content = useAdminContent()
  const [quota, setQuota] = useState<any>(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [newSectionType, setNewSectionType] = useState('text-block')
  const [newSectionHeading, setNewSectionHeading] = useState('')

  const handleCheckQuota = async () => {
    setQuotaLoading(true)
    try {
      const result = await fetchR2Usage(true)
      setQuota(result)
    } catch (e: any) {
      setGlobalError(e?.message || String(e))
    } finally {
      setQuotaLoading(false)
    }
  }

  const handleAddSection = async () => {
    if (!newSectionHeading.trim()) {
      setGlobalError('Heading required for new section')
      return
    }
    try {
      await content.createSection(newSectionType, newSectionHeading.trim())
      setNewSectionHeading('')
      setGlobalError(null)
    } catch (e: any) {
      setGlobalError(e?.message || String(e))
    }
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto px-6 py-24 text-center text-sm text-gray-600">Checking admin access…</div>
  }

  if (!isAuthed) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20">
        <div className="rounded-2xl border bg-amber-50 p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black tracking-tight mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>Admin — Passwordless Google Login</h1>
          <p className="text-sm text-gray-700 mb-2">Please login via Google — only allowlisted emails can access (Zero Trust).</p>
          {data?.error && <div className="text-xs bg-white border p-2 rounded-lg mt-2 break-all">{data.error}</div>}
          {error && <div className="text-xs bg-white border border-red-200 text-red-700 p-2 rounded-lg mt-2">{error}</div>}
          <div className="flex gap-3 justify-center mt-4">
            <button onClick={() => refetch()} className="px-6 py-3 bg-slate-900 text-white rounded-full text-sm font-semibold">Retry — triggers Google login</button>
            <a href="/" className="px-6 py-3 bg-white border rounded-full text-sm font-semibold">Back to home</a>
          </div>
        </div>
      </div>
    )
  }

  const sortedSections = [...content.sections].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b">
        <div className="max-w-5xl mx-auto px-6 py-3 flex justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <h1 className="text-sm font-black tracking-tight">Admin</h1>
            <span className="w-1 h-1 bg-gray-300 rounded-full" aria-hidden />
            <span className="text-gray-600 font-medium">{email}</span>
            <span className="hidden sm:inline text-gray-400">{data?.env}</span>
            {isBypass && <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px] uppercase">Bypass</span>}
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={handleCheckQuota} disabled={quotaLoading} className="px-3 py-1.5 bg-white border rounded-full text-[11px] font-semibold hover:border-slate-900 disabled:opacity-50" aria-label="Check R2 quota">
              {quotaLoading ? 'Checking…' : quota ? `${quota.totalMB}MB / ${quota.limitMB}MB ${quota.percent?.toFixed(1)}%` : 'R2 Quota'}
            </button>
            <button onClick={() => { refetch(); content.refetch() }} className="px-3 py-1.5 bg-white border rounded-full text-[11px] font-semibold" aria-label="Refresh">Refresh</button>
            <a href="/" className="px-3 py-1.5 bg-slate-900 text-white rounded-full text-[11px] font-semibold" aria-label="View site">View site</a>
          </div>
        </div>
        {globalError && <div className="max-w-5xl mx-auto px-6 pb-2"><div className="p-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700" role="alert">{globalError}</div></div>}
        {content.error && <div className="max-w-5xl mx-auto px-6 pb-2"><div className="p-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">Content error: {content.error}</div></div>}
        {quota && (
          <div className="max-w-5xl mx-auto px-6 pb-3">
            <div className="p-2.5 bg-white rounded-xl border text-[11px] flex flex-wrap gap-3 items-center">
              <span>Objects: {quota.totalObjects}</span>
              <span>{quota.totalMB}MB / {quota.limitMB}MB</span>
              <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden" aria-label={`Storage ${quota.percent}%`}>
                <div className="h-full bg-slate-900" style={{ width: `${Math.min(100, quota.percent)}%` }} />
              </div>
              <span className={quota.warning ? 'text-red-600 font-semibold' : 'text-green-700'}>{quota.warning ? '⚠️ >90%' : 'Safe <1% for 100 images'}</span>
              <span className="text-gray-500 hidden md:inline">PNG if ≤1MB else WebP, oldKey delete-before-put</span>
            </div>
          </div>
        )}
      </div>

      {content.loading ? (
        <div className="max-w-5xl mx-auto px-6 py-24 text-center text-sm text-gray-500">Loading portfolio content…</div>
      ) : (
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
          {/* Add / Remove section — per your request */}
          <div className="p-4 border rounded-2xl bg-white shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Add / Remove Section — keeps hero, about, calendar simple, 100 images scenario</h3>
            <div className="flex flex-wrap gap-2 items-center">
              <select value={newSectionType} onChange={(e) => setNewSectionType(e.target.value)} className="px-3 py-2 border rounded-xl text-xs bg-white">
                <option value="hero">hero</option>
                <option value="text-block">text-block (About Me)</option>
                <option value="cards-grid">cards-grid (Services)</option>
                <option value="testimonials">testimonials</option>
                <option value="cta-banner">cta-banner</option>
                <option value="image-gallery">image-gallery</option>
              </select>
              <input type="text" value={newSectionHeading} onChange={(e) => setNewSectionHeading(e.target.value)} placeholder="New section heading — current" className="px-3 py-2 border rounded-xl text-xs min-w-[200px]" aria-label="New section heading" />
              <button onClick={handleAddSection} className="px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-semibold hover:bg-black" aria-label="Add section">Add section</button>
              <span className="text-[11px] text-gray-500">Now: {sortedSections.length} sections — hero, text-block visible (simple), others hidden via migration 0004 — 40MB/env 80-100MB combined &lt;1% of 10GB</span>
            </div>
          </div>

          {sortedSections.map((section, secIdx) => {
            const isHidden = !section.is_visible
            const items = [...(section.items || [])].sort((a, b) => a.sort_order - b.sort_order)
            return (
              <div key={section.id} className={`relative group rounded-2xl border bg-white shadow-sm overflow-hidden ${isHidden ? 'opacity-60 border-dashed border-amber-300' : 'border-slate-200'}`}>
                <div className="absolute top-4 right-4 sm:right-6 z-20 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="px-3 py-1.5 rounded-full bg-slate-900 text-white text-[10px] uppercase tracking-wide shadow-sm border border-slate-800">{section.type} #{section.sort_order}</span>
                  {isHidden && <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-[10px] shadow-sm">Hidden — not on live</span>}
                  <button aria-label="Move section up" disabled={secIdx === 0} onClick={async () => {
                    try {
                      const sorted = [...content.sections].sort((a, b) => a.sort_order - b.sort_order)
                      const idx = sorted.findIndex((s) => s.id === section.id)
                      if (idx > 0) { const tmp = sorted[idx - 1]; sorted[idx - 1] = sorted[idx]; sorted[idx] = tmp; await content.reorderSections(sorted.map((s) => s.id)) }
                    } catch (e: any) { setGlobalError(e?.message) }
                  }} className="px-2 py-1 bg-white border rounded-full text-[10px] disabled:opacity-20 hover:border-slate-900">↑</button>
                  <button aria-label="Move section down" disabled={secIdx === sortedSections.length - 1} onClick={async () => {
                    try {
                      const sorted = [...content.sections].sort((a, b) => a.sort_order - b.sort_order)
                      const idx = sorted.findIndex((s) => s.id === section.id)
                      if (idx < sorted.length - 1) { const tmp = sorted[idx + 1]; sorted[idx + 1] = sorted[idx]; sorted[idx] = tmp; await content.reorderSections(sorted.map((s) => s.id)) }
                    } catch (e: any) { setGlobalError(e?.message) }
                  }} className="px-2 py-1 bg-white border rounded-full text-[10px] disabled:opacity-20 hover:border-slate-900">↓</button>
                  <button aria-label={isHidden ? 'Show section' : 'Hide section'} onClick={async () => {
                    try { await content.updateSection(section.id, { is_visible: isHidden ? 1 : 0 } as any) } catch (e: any) { setGlobalError(e?.message) }
                  }} className="px-2 py-1 bg-white border rounded-full text-[10px] hover:border-slate-900">{isHidden ? 'Show' : 'Hide'}</button>
                  <button aria-label="Delete section" onClick={async () => {
                    if (!confirm(`Delete section ${section.type} "${section.heading}"? This deletes its ${section.items.length} items too.`)) return
                    try { await content.deleteSection(section.id) } catch (e: any) { setGlobalError(e?.message) }
                  }} className="px-2 py-1 bg-white border border-red-200 text-red-700 rounded-full text-[10px] hover:bg-red-50">Delete</button>
                </div>
                {isHidden && <div className="absolute inset-0 border-2 border-dashed border-amber-300 pointer-events-none" aria-hidden />}

                {section.type === 'hero' && (
                  <div className="py-16 px-6 sm:px-8">
                    <h1 className="text-4xl lg:text-5xl font-black leading-tight tracking-tight mb-4" style={{ fontFamily: 'Playfair Display, serif' }}>
                      <EditableText value={section.heading || ''} onSave={async (v) => { try { await content.updateSection(section.id, { heading: v } as any) } catch (e: any) { setGlobalError(e?.message) } }} placeholder="Hero heading — current" required ariaLabel="Hero heading" displayClassName="text-4xl lg:text-5xl font-black" inputClassName="text-4xl lg:text-5xl font-black" />
                    </h1>
                    <div className="text-xl text-gray-600 mb-4 max-w-[60ch]">
                      <EditableText value={section.subheading || ''} onSave={async (v) => { try { await content.updateSection(section.id, { subheading: v } as any) } catch (e: any) { setGlobalError(e?.message) } }} placeholder="Subheading — current" multiline ariaLabel="Hero subheading" displayClassName="text-xl text-gray-600" inputClassName="text-xl text-gray-600" />
                    </div>
                    {items[0] && (
                      <div className="space-y-3 max-w-[60ch]">
                        <div className="text-gray-600"><EditableText value={items[0].body || ''} onSave={async (v) => { try { await content.updateItem(items[0].id, { body: v } as any) } catch (e: any) { setGlobalError(e?.message) } }} placeholder="Body — current" multiline /></div>
                        <ImageUploader currentImageUrl={items[0].image_url} oldKey={getOldKeyFromUrl(items[0].image_url)} onUploadComplete={async (r) => { try { await content.updateItem(items[0].id, { image_url: r.url } as any) } catch (e: any) { setGlobalError(e?.message) } }} />
                      </div>
                    )}
                  </div>
                )}

                {section.type === 'cards-grid' && (
                  <div className="py-16 px-6 sm:px-8">
                    <div className="text-center mb-8">
                      <h2 className="text-3xl font-black tracking-tight mb-2"><EditableText value={section.heading || ''} onSave={async (v) => content.updateSection(section.id, { heading: v } as any)} placeholder="Services heading — current" displayClassName="text-3xl font-black" inputClassName="text-3xl font-black" /></h2>
                      <div className="text-gray-600"><EditableText value={section.subheading || ''} onSave={async (v) => content.updateSection(section.id, { subheading: v } as any)} placeholder="Subheading — current" /></div>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {items.map((item) => (
                        <div key={item.id} className="card p-5 group/item">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 border flex items-center justify-center mb-3 text-xl"><EditableText value={item.icon || '◈'} onSave={async (v) => content.updateItem(item.id, { icon: v } as any)} placeholder="Icon" /></div>
                          <div className="font-bold"><EditableText value={item.title || ''} onSave={async (v) => content.updateItem(item.id, { title: v } as any)} placeholder="Title — current" displayClassName="font-bold" inputClassName="font-bold" /></div>
                          <div className="text-sm text-gray-600 mt-1"><EditableText value={item.body || ''} onSave={async (v) => content.updateItem(item.id, { body: v } as any)} placeholder="Body — current" multiline /></div>
                          <div className="mt-2"><ImageUploader currentImageUrl={item.image_url} oldKey={getOldKeyFromUrl(item.image_url)} onUploadComplete={async (r) => await content.updateItem(item.id, { image_url: r.url } as any)} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {section.type === 'text-block' && (
                  <div className="py-16 px-6 sm:px-8">
                    <h2 className="text-3xl font-black mb-4"><EditableText value={section.heading || ''} onSave={async (v) => content.updateSection(section.id, { heading: v } as any)} placeholder="About heading — current" displayClassName="text-3xl font-black" inputClassName="text-3xl font-black" /></h2>
                    {items.map((item) => (
                      <div key={item.id} className="mt-4 space-y-2">
                        <div className="font-semibold"><EditableText value={item.title || ''} onSave={async (v) => content.updateItem(item.id, { title: v } as any)} placeholder="Title — current" /></div>
                        <div className="text-gray-600"><EditableText value={item.body || ''} onSave={async (v) => content.updateItem(item.id, { body: v } as any)} placeholder="Body — current" multiline displayClassName="text-gray-600 leading-relaxed" /></div>
                        <ImageUploader currentImageUrl={item.image_url} oldKey={getOldKeyFromUrl(item.image_url)} onUploadComplete={async (r) => await content.updateItem(item.id, { image_url: r.url } as any)} />
                      </div>
                    ))}
                  </div>
                )}

                {section.type === 'testimonials' && (
                  <div className="py-16 px-6 sm:px-8">
                    <h2 className="text-3xl font-black mb-6 text-center"><EditableText value={section.heading || ''} onSave={(v) => content.updateSection(section.id, { heading: v } as any)} placeholder="Testimonials heading — current" displayClassName="text-3xl font-black" /></h2>
                    <div className="grid md:grid-cols-2 gap-4">
                      {items.map((item) => (
                        <div key={item.id} className="p-5 border rounded-2xl bg-slate-50">
                          <div className="text-amber-400 mb-2">★★★★★</div>
                          <div className="text-sm"><EditableText value={item.body || ''} onSave={(v) => content.updateItem(item.id, { body: v } as any)} placeholder="Testimonial body — current" multiline /></div>
                          <div className="mt-3 text-sm font-semibold"><EditableText value={item.author || ''} onSave={(v) => content.updateItem(item.id, { author: v } as any)} placeholder="Author — current" /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {section.type === 'cta-banner' && (
                  <div className="p-2">
                    <div className="bg-slate-900 text-white rounded-2xl p-8 text-center">
                      <h2 className="text-3xl font-black mb-3"><EditableText value={section.heading || ''} onSave={(v) => content.updateSection(section.id, { heading: v } as any)} placeholder="CTA heading — current" displayClassName="text-white text-3xl font-black" inputClassName="text-white text-3xl font-black bg-transparent" /></h2>
                      <div className="text-gray-300 mb-4"><EditableText value={section.subheading || ''} onSave={(v) => content.updateSection(section.id, { subheading: v } as any)} placeholder="Subheading — current" multiline /></div>
                    </div>
                  </div>
                )}

                {section.type === 'image-gallery' && (
                  <div className="py-16 px-6 sm:px-8">
                    <h2 className="text-3xl font-black mb-6"><EditableText value={section.heading || ''} onSave={(v) => content.updateSection(section.id, { heading: v } as any)} placeholder="Gallery heading — current" /></h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {items.map((item) => (
                        <div key={item.id} className="space-y-2">
                          <ImageUploader currentImageUrl={item.image_url} oldKey={getOldKeyFromUrl(item.image_url)} onUploadComplete={async (r) => await content.updateItem(item.id, { image_url: r.url } as any)} />
                          <EditableText value={item.title || ''} onSave={(v) => content.updateItem(item.id, { title: v } as any)} placeholder="Image title — current" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
