import React from 'react'
import { useAdminAuth } from '../hooks/useAdminAuth'

export function Admin() {
  const { data, loading, error, isAuthed, isBypass, email, refetch } = useAdminAuth()

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
            Admin Access Required
          </h1>
          <p className="text-sm text-gray-700 mb-4 leading-relaxed">
            This area is protected by <strong>Cloudflare Zero Trust</strong> — Google login only, no password.
            Only a few recognized emails can login as admin (allowlist via <code className="bg-white px-1.5 py-0.5 rounded border text-xs">ADMIN_EMAILS</code>).
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
            <strong>How it works:</strong>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Production & Alpha: Cloudflare Zero Trust intercepts <code>/admin/*</code> at edge, Google OAuth required.</li>
              <li>Your email must be in <code>ADMIN_EMAILS</code> encrypted secret (comma-separated) via Dashboard.</li>
              <li>CF adds headers <code>Cf-Access-Jwt-Assertion</code> + <code>Cf-Access-Authenticated-User-Email</code> — verified by Worker (no username/password).</li>
              <li>Local/Docker: <code>ADMIN_BYPASS=true</code> allows access without Google login for dev.</li>
            </ul>
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => refetch()}
              className="px-6 py-3 bg-slate-900 text-white rounded-full text-sm font-semibold hover:bg-black leading-none"
            >
              Retry auth check
            </button>
            <a
              href="/"
              className="px-6 py-3 bg-white border border-slate-200 rounded-full text-sm font-semibold leading-none inline-flex items-center justify-center"
            >
              Back to home
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
            Admin Dashboard
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Logged in as <span className="font-semibold">{email}</span>{' '}
            {isBypass && <span className="ml-2 inline-flex px-2.5 py-0.5 rounded-full bg-slate-900 text-white text-[10px] uppercase tracking-wide">Bypass Mode — Local Dev</span>}
            {data?.env && <span className="ml-2 text-xs text-gray-500">env: {data.env}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
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

      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="font-semibold mb-2">Cloudflare Zero Trust — Google Login</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          ✅ Auth uses <strong>Cloudflare Access</strong> edge-intercept — no password logic in code. Only allowlisted emails in{' '}
          <code className="bg-slate-50 border px-1.5 py-0.5 rounded text-xs">ADMIN_EMAILS</code> can access admin. Local dev uses{' '}
          <code className="bg-slate-50 border px-1.5 py-0.5 rounded text-xs">ADMIN_BYPASS=true</code>.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border">
            <div className="font-semibold mb-1">Current Session</div>
            <div>Email: {email}</div>
            <div>Env: {data?.env}</div>
            <div>Bypass: {isBypass ? 'Yes (local/dev)' : 'No (real Access JWT)'}</div>
            <div>Allowlist configured: {data?.allowlistConfigured ? 'Yes' : 'No (open when empty, restricted when set)'}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border">
            <div className="font-semibold mb-1">Free Tier Safety — Upload-Image (next)</div>
            <ul className="list-disc pl-4 space-y-1">
              <li>Client resize: max 1200px, WebP, ≤1MB — zero Worker CPU for resize</li>
              <li>Server checks file size & type, rejects &gt;1MB — stays in free tier</li>
              <li>Replace-on-update: delete old R2 key before PUT new → no storage bloat, stays under 10GB</li>
              <li>No R2 LIST on upload path — avoids extra CPU/subrequests; quota check only on demand via ?checkQuota</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-dashed p-8 text-center">
        <h3 className="font-semibold mb-2">Next: Sections/Items CRUD + Image Uploader</h3>
        <p className="text-sm text-gray-600">
          Auth slice complete — next steps will add <code>EditableText</code>, <code>ImageUploader</code> with client WebP 1MB/1200px, and R2 upload with replace-old logic to stay under free tier 10GB.
        </p>
      </div>
    </div>
  )
}
