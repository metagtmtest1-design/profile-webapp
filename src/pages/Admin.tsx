import React, { useState } from 'react'
import { useAdminAuth } from '../hooks/useAdminAuth'
import { useAdminContent } from '../hooks/useAdminContent'
import { EditableText } from '../components/admin/EditableText'
import { ImageUploader } from '../components/admin/ImageUploader'
import { fetchR2Usage } from '../lib/api'

export function Admin() {
  console.log('!!! ADMIN_PAGE_RENDER_START windowPath=' + (typeof window !== 'undefined' ? window.location.pathname : 'no-window'))
  // Hooks must be called unconditionally before any early return — fixes React error #310 Rendered more hooks than previous
  const auth = useAdminAuth()
  const { data, loading, error, isAuthed, isBypass, email, refetch } = auth
  const content = useAdminContent()
  const [quota, setQuota] = useState<any>(null)
  const [quotaLoading, setQuotaLoading] = useState(false)
  console.log('!!! ADMIN_AUTH_STATE loading=' + loading + ' isAuthed=' + isAuthed + ' email=' + email + ' bypass=' + isBypass + ' error=' + error + ' data=' + JSON.stringify(data)?.slice(0,200))
  console.log('!!! ADMIN_CONTENT_HOOK sections=' + content.sections.length + ' loading=' + content.loading + ' error=' + content.error)

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
          <p className="text-sm text-gray-700 mb-4 leading-relaxed">
            This admin is <strong>passwordless</strong> — there is no username/password field in our code.
            You login with <strong>Google OAuth via Cloudflare Access</strong> at the edge. Only few recognized Google emails can access (allowlist via{' '}
            <code className="bg-white px-1.5 py-0.5 rounded border text-xs">ADMIN_EMAILS</code> secret).
          </p>
          {data?.error && (
            <div className="mx-auto max-w-md p-3 rounded-lg bg-white border border-amber-200 text-xs text-amber-800 text-left mb-4">
              <div className="font-semibold">Reason:</div>
              <div className="font-mono break-all">{data.error}</div>
            </div>
          )}
          {error && !data?.error && (
            <div className="mx-auto max-w-md p-3 rounded-lg bg-white border border-red-200 text-xs text-red-700 text-left mb-4">
              {error}
            </div>
          )}
          <div className="text-xs text-gray-600 mb-6 text-left mx-auto max-w-md">
            <strong>Passwordless flow (no password input):</strong>
            <ol className="list-decimal pl-5 mt-2 space-y-1">
              <li>Visit <code>/admin</code> → Cloudflare Zero Trust edge intercepts (before Worker).</li>
              <li>Edge redirects to <strong>Google login</strong> (OAuth) — pick your Google account, no password form in our app.</li>
              <li>Google returns to CF Access callback <code>https://&lt;team&gt;.cloudflareaccess.com/cdn-cgi/access/callback</code>.</li>
              <li>CF verifies your email is in Access policy Allow list + sets <code>Cf-Access-Jwt-Assertion</code> header with your Google email.</li>
              <li>Worker verifies header + checks <code>ADMIN_EMAILS</code> allowlist double-check (same list as policy, PII secret via Dashboard).</li>
              <li>Success → Admin Dashboard. Fail → Cloudflare block page "That account does not have access". No password anywhere.</li>
              <li>Local/Docker: <code>ADMIN_BYPASS=true</code> skips Google for dev, shows bypass badge.</li>
            </ol>
            <div className="mt-3 p-2.5 bg-white rounded-lg border">
              <div className="font-semibold">Setup required (one-time, see doc/Setup.md Sec 14):</div>
              <ul className="list-disc pl-4 mt-1 space-y-0.5">
                <li>Enable Zero Trust, team domain e.g. <code>portfolio.cloudflareaccess.com</code></li>
                <li>Create Google OAuth client ID/Secret for Access (Authorized redirect = team domain callback)</li>
                <li>Zero Trust → Add Identity Provider Google → paste ID/Secret</li>
                <li>Add Access Application Self-hosted public hostname <code>alpha.profile-webapp.pages.dev/admin/*</code> + <code>/api/admin/*</code> + prod same</li>
                <li>Policy Allow → Emails = your allowlist (only those Google emails can login)</li>
              </ul>
            </div>
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => refetch()}
              className="px-6 py-3 bg-slate-900 text-white rounded-full text-sm font-semibold hover:bg-black leading-none"
            >
              Retry auth check — triggers Google login when Access configured
            </button>
            <a
              href="/"
              className="px-6 py-3 bg-white border border-slate-200 rounded-full text-sm font-semibold leading-none inline-flex items-center justify-center"
            >
              Back to home
            </a>
          </div>
          <p className="text-[11px] text-gray-500 mt-4">No password field exists in our app — all auth handled by Cloudflare Access + Google OAuth.</p>
        </div>
      </div>
    )
  }

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

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
            Admin Dashboard — Slice 5
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Logged in as <span className="font-semibold">{email}</span>{' '}
            {isBypass && <span className="ml-2 inline-flex px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[10px] uppercase tracking-wide">Bypass Mode — Local Dev</span>}
            {data?.env && <span className="ml-2 text-xs text-gray-500">env: {data.env}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              refetch()
              content.refetch()
            }}
            className="px-4 py-2 bg-white border border-slate-200 rounded-full text-xs font-semibold hover:border-slate-900"
          >
            Refresh
          </button>
          <a
            href="/"
            className="px-4 py-2 bg-slate-900 text-white rounded-full text-xs font-semibold hover:bg-black leading-none inline-flex items-center"
          >
            View site
          </a>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-6 shadow-sm mb-8">
        <h2 className="font-semibold mb-2">Passwordless Google Login — Cloudflare Zero Trust</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          ✅ <strong>No password field anywhere</strong> — auth is <strong>passwordless Google OAuth</strong> via Cloudflare Access edge-intercept.
          You click <code>/admin</code> → redirect to Google login → pick Google account → CF sets{' '}
          <code>Cf-Access-Jwt-Assertion</code> header with email. Only allowlisted emails in{' '}
          <code className="bg-slate-50 border px-1.5 py-0.5 rounded text-xs">ADMIN_EMAILS</code> (PII secret via Dashboard) can access or, when empty, Zero Trust policy is source of truth.
          Local dev uses <code className="bg-slate-50 border px-1.5 py-0.5 rounded text-xs">ADMIN_BYPASS=true</code> to skip Google.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border">
            <div className="font-semibold mb-1">Current Session — Passwordless</div>
            <div>Email: {email} {isBypass ? '(bypass local, no Google)' : '(real Google via Access JIT)'}</div>
            <div>Env: {data?.env} — {isBypass ? 'ADMIN_BYPASS=true local/dev, no password' : 'ADMIN_BYPASS=false prod/alpha, Google login required'}</div>
            <div>Bypass: {isBypass ? 'Yes — local/dev convenience, no Google' : 'No — real Access JWT from Google'}</div>
            <div>Allowlist configured: {data?.allowlistConfigured ? 'Yes — only listed Google emails allowed' : 'No — Zero Trust policy is source of truth (open in Worker, restricted at edge)'}</div>
            <div className="mt-3">
              <button
                onClick={handleCheckQuota}
                disabled={quotaLoading}
                className="px-3 py-1.5 bg-slate-900 text-white rounded-full text-[11px] font-semibold hover:bg-black disabled:opacity-50"
              >
                {quotaLoading ? 'Checking…' : 'Check R2 Quota ?checkQuota=true'}
              </button>
              {quota && (
                <div className="mt-2 p-2 bg-white rounded-lg border text-[11px]">
                  <div>Objects: {quota.totalObjects} — {quota.totalMB}MB / {quota.limitMB}MB ({quota.percent?.toFixed(3)}%)</div>
                  <div>Warning: {quota.warning ? 'Yes — >90% of 10GB' : 'No — safe'}</div>
                  <div>Truncated: {quota.truncated ? 'Yes — >1000 objects' : 'No'}</div>
                  <div className="font-mono break-all">{quota.guidance?.slice(0, 200)}</div>
                </div>
              )}
            </div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border">
            <div className="font-semibold mb-1">Free Tier Safety — 100 Images + Alpha/Prod</div>
            <ul className="list-disc pl-4 space-y-1">
              <li>Client resize: max 1200px, <strong>PNG if ≤1MB else WebP compress within 1MB</strong> — PNG lossless first, WebP fallback to stay under 1MB, 0 Worker CPU</li>
              <li>Server checks ≤1MB + type, rejects &gt;1MB — Cloudflare edge limit 100MB Free, our 1MB well below, no nginx config needed</li>
              <li>Replace-on-update: delete old R2 key before PUT new → 100 images ×400KB avg =40MB per env, alpha+prod=80MB total &lt;1% of 10GB free tier</li>
              <li>Quota endpoint: <code>GET /api/admin/r2-usage?checkQuota=true</code> on-demand LIST sums size, cheap path without LIST saves CPU</li>
              <li>Env isolation: alpha bucket <code>portfolio-images-alpha</code> + prod <code>portfolio-images</code> share account 10GB but combined still &lt;200MB worst case</li>
              <li>Worker→R2 single PUT max 5 GiB, multipart 5 TiB — our PNG/WebP ≤1MB safe</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Sections CRUD */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="font-semibold mb-4">Content Sections — Admin Edit (6 sections, 100 images scenario)</h2>
        {content.loading ? (
          <div className="text-sm text-gray-500">Loading admin content…</div>
        ) : content.error ? (
          <div className="text-sm text-red-600">Error: {content.error}</div>
        ) : (
          <div className="space-y-6">
            {content.sections.map((sec, secIdx) => (
              <div key={sec.id} className="p-4 border rounded-xl bg-slate-50">
                <div className="flex justify-between items-start gap-4 mb-2">
                  <div className="flex-1">
                    <div className="text-[11px] text-gray-500 uppercase tracking-wide">
                      #{sec.sort_order} — {sec.type} — {sec.id} — visible: {sec.is_visible ? 'Yes' : 'No'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-semibold">Heading:</span>
                      <EditableText
                        value={sec.heading || ''}
                        onSave={async (v) => await content.updateSection(sec.id, { heading: v })}
                        placeholder="Section heading"
                        required
                      />
                    </div>
                    {sec.subheading !== undefined && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs">Subheading:</span>
                        <EditableText value={sec.subheading || ''} onSave={async (v) => await content.updateSection(sec.id, { subheading: v })} multiline />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      disabled={secIdx === 0}
                      onClick={async () => {
                        const ordered = [...content.sections].sort((a, b) => a.sort_order - b.sort_order)
                        const currentIdx = ordered.findIndex((s) => s.id === sec.id)
                        if (currentIdx > 0) {
                          const tmp = ordered[currentIdx - 1]
                          ordered[currentIdx - 1] = ordered[currentIdx]
                          ordered[currentIdx] = tmp
                          await content.reorderSections(ordered.map((s) => s.id))
                        }
                      }}
                      className="px-2 py-1 bg-white border rounded-full text-[10px] disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      disabled={secIdx === content.sections.length - 1}
                      onClick={async () => {
                        const ordered = [...content.sections].sort((a, b) => a.sort_order - b.sort_order)
                        const currentIdx = ordered.findIndex((s) => s.id === sec.id)
                        if (currentIdx < ordered.length - 1) {
                          const tmp = ordered[currentIdx + 1]
                          ordered[currentIdx + 1] = ordered[currentIdx]
                          ordered[currentIdx] = tmp
                          await content.reorderSections(ordered.map((s) => s.id))
                        }
                      }}
                      className="px-2 py-1 bg-white border rounded-full text-[10px] disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                </div>

                {/* Items */}
                <div className="mt-3 space-y-2">
                  {sec.items.map((item, itemIdx) => (
                    <div key={item.id} className="p-3 bg-white rounded-xl border flex gap-3">
                      <div className="flex-1 space-y-1">
                        <div className="text-[10px] text-gray-500">
                          #{item.sort_order} — {item.id} — visible: {item.is_visible ? 'Yes' : 'No'}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold">Title:</span>
                          <EditableText value={item.title || ''} onSave={async (v) => await content.updateItem(item.id, { title: v })} />
                        </div>
                        {item.body !== undefined && (
                          <div className="flex items-center gap-2">
                            <span className="text-[11px]">Body:</span>
                            <EditableText value={item.body || ''} onSave={async (v) => await content.updateItem(item.id, { body: v })} multiline />
                          </div>
                        )}
                        <div className="text-[11px] break-all">Image: {item.image_url || 'none'}</div>
                        <div className="mt-2">
                          <ImageUploader
                            currentImageUrl={item.image_url}
                            oldKey={item.image_url?.startsWith('/api/images/') ? item.image_url.replace('/api/images/', '') : item.image_url?.startsWith('portfolio/') ? item.image_url : undefined}
                            onUploadComplete={async (result) => {
                              console.log(`!!! ADMIN_ITEM_IMAGE_UPLOADED item=${item.id} key=${result.key} url=${result.url} format=${result.format}`)
                              await content.updateItem(item.id, { image_url: result.url })
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          disabled={itemIdx === 0}
                          onClick={async () => {
                            const ordered = [...sec.items].sort((a, b) => a.sort_order - b.sort_order)
                            const cur = ordered.findIndex((i) => i.id === item.id)
                            if (cur > 0) {
                              const tmp = ordered[cur - 1]
                              ordered[cur - 1] = ordered[cur]
                              ordered[cur] = tmp
                              await content.reorderItems(sec.id, ordered.map((i) => i.id))
                            }
                          }}
                          className="px-2 py-1 bg-slate-50 border rounded-full text-[10px] disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          disabled={itemIdx === sec.items.length - 1}
                          onClick={async () => {
                            const ordered = [...sec.items].sort((a, b) => a.sort_order - b.sort_order)
                            const cur = ordered.findIndex((i) => i.id === item.id)
                            if (cur < ordered.length - 1) {
                              const tmp = ordered[cur + 1]
                              ordered[cur + 1] = ordered[cur]
                              ordered[cur] = tmp
                              await content.reorderItems(sec.id, ordered.map((i) => i.id))
                            }
                          }}
                          className="px-2 py-1 bg-slate-50 border rounded-full text-[10px] disabled:opacity-30"
                        >
                          ↓
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
