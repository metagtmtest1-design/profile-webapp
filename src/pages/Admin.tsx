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
  console.log('!!! ADMIN_PAGE_RENDER_START windowPath=' + (typeof window !== 'undefined' ? window.location.pathname : 'no-window'))
  const auth = useAdminAuth()
  const { data, loading, error, isAuthed, isBypass, email, refetch } = auth
  const content = useAdminContent()
  const [quota, setQuota] = useState<any>(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  console.log('!!! ADMIN_AUTH_STATE loading=' + loading + ' isAuthed=' + isAuthed + ' email=' + email + ' bypass=' + isBypass + ' error=' + error)
  console.log('!!! ADMIN_CONTENT_HOOK sections=' + content.sections.length + ' loading=' + content.loading + ' error=' + content.error)

  const handleCheckQuota = async () => {
    setQuotaLoading(true)
    try {
      const result = await fetchR2Usage(true)
      setQuota(result)
      console.log(`!!! ADMIN_R2_QUOTA_CHECK objects=${result.totalObjects} MB=${result.totalMB} percent=${result.percent}`)
    } catch (e: any) {
      console.log(`!!! ADMIN_R2_QUOTA_ERROR ${e?.message}`)
    } finally {
      setQuotaLoading(false)
    }
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
            <span className="w-2 h-2 rounded-full bg-green-500"></span> Cloudflare Zero Trust — Google only, no password form anywhere
          </div>
          <p className="text-sm text-gray-700 mb-2">Please login via Google — only allowlisted emails can access.</p>
          {data?.error && <div className="text-xs text-amber-800 bg-white border p-2 rounded-lg mt-2">{data.error}</div>}
          <div className="flex gap-3 justify-center mt-4">
            <button onClick={() => refetch()} className="px-6 py-3 bg-slate-900 text-white rounded-full text-sm font-semibold">Retry auth check</button>
            <a href="/" className="px-6 py-3 bg-white border rounded-full text-sm font-semibold">Back to home</a>
          </div>
        </div>
      </div>
    )
  }

  const renderSectionPreview = (section: AdminSection) => {
    const items = section.items || []
    // Convert AdminSection/AdminItem to Section/SectionItem shape expected by landing components
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

  return (
    <div className="bg-white min-h-screen">
      {/* Admin top bar — minimal, not passwordless card */}
      <div className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b">
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-black tracking-tight">Admin — Editing Portfolio</h1>
            <span className="text-xs text-gray-500">Logged in as <span className="font-semibold">{email}</span></span>
            {isBypass && <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px] uppercase">Bypass</span>}
            {data?.env && <span className="text-[11px] text-gray-400">env: {data.env}</span>}
            {data?.allowlistConfigured !== undefined && (
              <span className="text-[11px] text-gray-400">allowlist: {data.allowlistConfigured ? 'Yes' : 'No (Zero Trust source)'}</span>
            )}
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={handleCheckQuota} disabled={quotaLoading} className="px-3 py-1.5 bg-white border rounded-full text-[11px] font-semibold hover:border-slate-900 disabled:opacity-50">
              {quotaLoading ? 'Quota…' : `R2 ${quota ? `${quota.totalMB}MB` : 'Quota'}`}
            </button>
            <button onClick={() => { refetch(); content.refetch() }} className="px-3 py-1.5 bg-white border rounded-full text-[11px] font-semibold">Refresh</button>
            <a href="/" className="px-3 py-1.5 bg-slate-900 text-white rounded-full text-[11px] font-semibold">View site</a>
          </div>
        </div>
        {quota && (
          <div className="max-w-6xl mx-auto px-6 pb-3">
            <div className="p-2 bg-slate-50 rounded-xl border text-[11px] flex flex-wrap gap-3">
              <span>Objects: {quota.totalObjects}</span>
              <span>{quota.totalMB}MB / {quota.limitMB}MB ({quota.percent?.toFixed(3)}%)</span>
              <span className={quota.warning ? 'text-red-600 font-semibold' : 'text-green-700'}>{quota.warning ? '⚠️ >90% — delete unused' : 'Safe <1% for 100 images'}</span>
              <span className="text-gray-500">Strategy: PNG if ≤1MB else WebP, oldKey delete-before-put, 40MB per env, 80-100MB combined</span>
            </div>
          </div>
        )}
      </div>

      {/* Content — almost identical to landing page, but with editing fields */}
      {content.loading ? (
        <div className="max-w-5xl mx-auto px-6 py-24 text-center text-sm text-gray-500">Loading admin content…</div>
      ) : content.error ? (
        <div className="max-w-5xl mx-auto px-6 py-12 text-sm text-red-600">Error: {content.error}</div>
      ) : (
        <div>
          {/* Render each section twice: preview (landing identical) + edit panel */}
          {content.sections
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((section) => (
              <div key={section.id} className="relative group/section">
                {/* Preview — almost identical to landing page */}
                <div className="relative">
                  {renderSectionPreview(section)}
                  {/* Admin badge overlay */}
                  <div className="absolute top-3 left-6 z-20 flex gap-2">
                    <span className="px-2.5 py-1 rounded-full bg-slate-900 text-white text-[10px] uppercase tracking-wide shadow-sm">{section.type}</span>
                    <span className="px-2 py-1 rounded-full bg-white border text-[10px] shadow-sm">#{section.sort_order} {section.is_visible ? 'Visible' : 'Hidden'}</span>
                  </div>
                </div>

                {/* Edit panel — shows current text/image with text input, textarea, image upload */}
                <div className="max-w-5xl mx-auto px-6 pb-10">
                  <div className="mt-2 p-4 border rounded-2xl bg-white shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Edit — {section.type} — current text / current image</h3>
                      <div className="flex gap-1">
                        <button
                          onClick={async () => {
                            const sorted = [...content.sections].sort((a, b) => a.sort_order - b.sort_order)
                            const idx = sorted.findIndex((s) => s.id === section.id)
                            if (idx > 0) {
                              const tmp = sorted[idx - 1]
                              sorted[idx - 1] = sorted[idx]
                              sorted[idx] = tmp
                              await content.reorderSections(sorted.map((s) => s.id))
                            }
                          }}
                          disabled={section.sort_order === 0}
                          className="px-2 py-1 bg-white border rounded-full text-[10px] disabled:opacity-30"
                        >
                          ↑ Up
                        </button>
                        <button
                          onClick={async () => {
                            const sorted = [...content.sections].sort((a, b) => a.sort_order - b.sort_order)
                            const idx = sorted.findIndex((s) => s.id === section.id)
                            if (idx < sorted.length - 1) {
                              const tmp = sorted[idx + 1]
                              sorted[idx + 1] = sorted[idx]
                              sorted[idx] = tmp
                              await content.reorderSections(sorted.map((s) => s.id))
                            }
                          }}
                          className="px-2 py-1 bg-white border rounded-full text-[10px]"
                        >
                          ↓ Down
                        </button>
                        <button
                          onClick={async () => {
                            const vis = section.is_visible ? 0 : 1
                            await content.updateSection(section.id, { is_visible: vis } as any)
                          }}
                          className="px-2 py-1 bg-white border rounded-full text-[10px]"
                        >
                          {section.is_visible ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold text-gray-500">Section Heading — text input</div>
                        <EditableText value={section.heading || ''} onSave={(v) => content.updateSection(section.id, { heading: v } as any)} placeholder="Heading" required className="w-full" displayClassName="font-semibold" />
                      </div>
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold text-gray-500">Subheading — textarea input</div>
                        <EditableText value={section.subheading || ''} onSave={(v) => content.updateSection(section.id, { subheading: v } as any)} placeholder="Subheading" multiline className="w-full" />
                      </div>
                    </div>

                    {/* Items editing */}
                    <div className="mt-5 space-y-3">
                      <div className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Items — {section.items.length} — text input, textarea, image upload — shows current</div>
                      {section.items
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((item) => (
                          <div key={item.id} className="p-3 border rounded-xl bg-slate-50 flex gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="text-[10px] text-gray-500">#{item.sort_order} — {item.id} — visible: {item.is_visible ? 'Yes' : 'No'} — current</div>

                              <div className="grid sm:grid-cols-2 gap-3">
                                <div>
                                  <div className="text-[11px] text-gray-500">Title — text input — current: {item.title || 'empty'}</div>
                                  <EditableText value={item.title || ''} onSave={(v) => content.updateItem(item.id, { title: v } as any)} placeholder="Title" className="w-full" />
                                </div>
                                <div>
                                  <div className="text-[11px] text-gray-500">Icon — text input — current: {item.icon || 'default'}</div>
                                  <EditableText value={item.icon || ''} onSave={(v) => content.updateItem(item.id, { icon: v } as any)} placeholder="Icon e.g. 🎯" className="w-full" />
                                </div>
                              </div>

                              <div>
                                <div className="text-[11px] text-gray-500">Body — textarea input — current text</div>
                                <EditableText value={item.body || ''} onSave={(v) => content.updateItem(item.id, { body: v } as any)} placeholder="Body" multiline className="w-full" displayClassName="text-sm leading-relaxed" />
                              </div>

                              <div className="grid sm:grid-cols-2 gap-3">
                                <div>
                                  <div className="text-[11px] text-gray-500">Link text — text input — current: {item.link_text || 'empty'}</div>
                                  <EditableText value={item.link_text || ''} onSave={(v) => content.updateItem(item.id, { link_text: v } as any)} placeholder="Learn more" />
                                </div>
                                <div>
                                  <div className="text-[11px] text-gray-500">Link URL — text input — current: {item.link_url || 'empty'}</div>
                                  <EditableText value={item.link_url || ''} onSave={(v) => content.updateItem(item.id, { link_url: v } as any)} placeholder="https:// or /#services" />
                                </div>
                              </div>

                              {item.author !== undefined && (
                                <div>
                                  <div className="text-[11px] text-gray-500">Author — text input — current: {item.author || 'empty'}</div>
                                  <EditableText value={item.author || ''} onSave={(v) => content.updateItem(item.id, { author: v } as any)} placeholder="Author" />
                                </div>
                              )}

                              <div className="mt-2">
                                <div className="text-[11px] text-gray-500 mb-1">Current image — {item.image_url ? 'shows current' : 'no image'} — image upload: PNG if ≤1MB else WebP within 1MB, max 1200px, 100 images scenario</div>
                                {item.image_url && (
                                  <div className="mb-2">
                                    <img src={item.image_url} alt={item.title || 'current'} className="w-24 h-24 object-cover rounded-xl border" loading="lazy" />
                                    <div className="text-[10px] text-gray-400 break-all mt-1">{item.image_url}</div>
                                  </div>
                                )}
                                <ImageUploader
                                  currentImageUrl={item.image_url}
                                  oldKey={
                                    item.image_url?.startsWith('/api/images/')
                                      ? item.image_url.replace('/api/images/', '')
                                      : item.image_url?.startsWith('portfolio/')
                                        ? item.image_url
                                        : undefined
                                  }
                                  onUploadComplete={async (result) => {
                                    console.log(`!!! ADMIN_ITEM_IMAGE_UPLOADED item=${item.id} key=${result.key} url=${result.url} format=${result.format}`)
                                    await content.updateItem(item.id, { image_url: result.url } as any)
                                  }}
                                />
                              </div>
                            </div>

                            <div className="flex flex-col gap-1">
                              <button
                                onClick={async () => {
                                  const ordered = [...section.items].sort((a, b) => a.sort_order - b.sort_order)
                                  const idx = ordered.findIndex((i) => i.id === item.id)
                                  if (idx > 0) {
                                    const tmp = ordered[idx - 1]
                                    ordered[idx - 1] = ordered[idx]
                                    ordered[idx] = tmp
                                    await content.reorderItems(section.id, ordered.map((i) => i.id))
                                  }
                                }}
                                className="px-2 py-1 bg-white border rounded-full text-[10px]"
                              >
                                ↑
                              </button>
                              <button
                                onClick={async () => {
                                  const ordered = [...section.items].sort((a, b) => a.sort_order - b.sort_order)
                                  const idx = ordered.findIndex((i) => i.id === item.id)
                                  if (idx < ordered.length - 1) {
                                    const tmp = ordered[idx + 1]
                                    ordered[idx + 1] = ordered[idx]
                                    ordered[idx] = tmp
                                    await content.reorderItems(section.id, ordered.map((i) => i.id))
                                  }
                                }}
                                className="px-2 py-1 bg-white border rounded-full text-[10px]"
                              >
                                ↓
                              </button>
                              <button
                                onClick={async () => {
                                  const vis = item.is_visible ? 0 : 1
                                  await content.updateItem(item.id, { is_visible: vis } as any)
                                }}
                                className="px-2 py-1 bg-white border rounded-full text-[10px]"
                              >
                                {item.is_visible ? 'Hide' : 'Show'}
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
