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
        <h2 className="font-semibold mb-2">Passwordless Google Login — Cloudflare Zero Trust</h2>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          ✅ <strong>No password field anywhere</strong> — auth is <strong>passwordless Google OAuth</strong> via Cloudflare Access edge-intercept.
          You click <code>/admin</code> → redirect to Google login → pick Google account → CF sets{' '}
          <code>Cf-Access-Jwt-Assertion</code> header with email. Only allowlisted emails in{' '}
          <code className="bg-slate-50 border px-1.5 py-0.5 rounded text-xs">ADMIN_EMAILS</code> (PII secret via Dashboard) can access.
          Local dev uses <code className="bg-slate-50 border px-1.5 py-0.5 rounded text-xs">ADMIN_BYPASS=true</code> to skip Google.
        </p>
        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border">
            <div className="font-semibold mb-1">Current Session — Passwordless</div>
            <div>Email: {email} {isBypass ? '(bypass local, no Google)' : '(real Google via Access JIT)'}</div>
            <div>Env: {data?.env} — {isBypass ? 'ADMIN_BYPASS=true local/dev, no password' : 'ADMIN_BYPASS=false prod/alpha, Google login required'}</div>
            <div>Bypass: {isBypass ? 'Yes — local/dev convenience, no Google' : 'No — real Access JWT from Google'}</div>
            <div>Allowlist configured: {data?.allowlistConfigured ? 'Yes — only listed Google emails allowed' : 'No — any Google email with valid CF JWT allowed (open)'}</div>
            <div className="mt-2 text-[11px] text-gray-500">No password input in code — see Setup.md Sec 14 for Access app creation with Google IdP, policy Allow Emails, Instant Auth.</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border">
            <div className="font-semibold mb-1">Free Tier Safety — 100 Images + Alpha/Prod</div>
            <ul className="list-disc pl-4 space-y-1">
              <li>Client resize: max 1200px, <strong>PNG if ≤1MB else WebP compress within 1MB</strong> — PNG lossless first, WebP fallback to stay under 1MB, 0 Worker CPU</li>
              <li>Server checks ≤1MB + type, rejects &gt;1MB — Cloudflare edge limit 100MB Free, our 1MB well below, no nginx config needed</li>
              <li>Replace-on-update: delete old R2 key before PUT new → 100 images ×400KB avg =40MB per env, alpha+prod=80MB total &lt;1% of 10GB free tier</li>
              <li>Quota endpoint: <code>GET /api/admin/r2-usage?checkQuota=true</code> on-demand LIST sums size, cheap path without LIST saves CPU</li>
              <li>Env isolation: alpha bucket <code>portfolio-images-alpha</code> + prod <code>portfolio-images</code> share account 10GB but combined still &lt;200MB worst case</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-dashed p-8 text-center">
        <h3 className="font-semibold mb-2">Next: Sections/Items CRUD + ImageUploader PNG→WebP</h3>
        <p className="text-sm text-gray-600">
          Auth slice complete with <strong>passwordless Google login</strong> (no password form) — next adds <code>EditableText</code>,{' '}
          <code>ImageUploader</code> with <strong>PNG if ≤1MB else WebP within 1MB</strong> client resize 1200px, and R2 upload with oldKey delete-before-PUT to stay under 10GB for 100 images across alpha/prod (80-100MB total &lt;1% of 10GB).
        </p>
      </div>
    </div>
  )
}
