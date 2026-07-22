import React, { useEffect, useState } from 'react'
import { fetchHealth, type HealthResponse } from './lib/api'
import { HealthBadge } from './components/HealthBadge'
import { EnvBanner } from './components/EnvBanner'

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadHealth = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchHealth({ timeoutMs: 8000 })
      setHealth(data)
    } catch (e: any) {
      setError(e.message || String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadHealth()
  }, [])

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {health && <EnvBanner env={health.env} />}

      <header className="border-b">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="font-bold text-xl">Portfolio — Infra Proof (Slice 0)</div>
          <div className="text-sm text-gray-500">env: {health?.env ?? 'loading...'}</div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <section className="mb-10">
          {/* Both envs bold now to verify prod deploy after merge */}
          {health && (
            <div style={{ 
              background: health.env === 'alpha' ? '#ff6b00' : '#00aa00', 
              color: 'white', 
              padding: '20px', 
              border: '5px solid black', 
              textAlign: 'center', 
              marginBottom: '20px',
              fontWeight: 900
            }}>
              <h1 style={{ fontWeight: 900, fontSize: '2.5em', textTransform: 'uppercase' }}>
                🚀 BOLD {health.env.toUpperCase()} ENV — {health.env.toUpperCase()} ✅
              </h1>
              <p style={{ fontWeight: 'bold', fontSize: '1.2em' }}>
                {health.env === 'alpha' 
                  ? 'ALPHA — bold orange proves isolation!' 
                  : 'PROD — bold green proves merge alpha→main worked! ✅'}
              </p>
              <p>Deployed: {new Date().toLocaleString()} — Env: {health.env} — Database {health.db} Storage {health.r2}</p>
            </div>
          )}
          <h1 className="text-3xl font-bold mb-2">Portfolio Site — Slice 0: Infra Connectivity Proof</h1>
          <p className="text-gray-600 mb-4">
            This slice verifies GitHub → Cloudflare Pages → Functions → D1 → R2 are wired together.
            <br />
            Expected: DB ok + R2 {health?.r2 === 'skipped' ? 'skipped (no billing)' : 'ok'}, env bold for alpha: <strong>{health?.env}</strong>
          </p>

          <div className="mb-6">
            <h2 className="font-semibold mb-2">Health Check: GET /api/health</h2>
            <HealthBadge health={health} loading={loading} error={error} />
            <button
              onClick={loadHealth}
              className="mt-3 px-4 py-2 bg-black text-white rounded text-sm hover:bg-gray-800"
            >
              Retry health check
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="border p-4 rounded">
              <h3 className="font-semibold mb-2">D1 Check</h3>
              <p className="text-sm text-gray-600 mb-2">
                Performs <code className="bg-gray-100 px-1">SELECT 1</code> against D1 binding <code>DB</code>.
                Proves D1 table creation + migration worked.
              </p>
              <div className="text-xs font-mono bg-gray-50 p-2 rounded">
                wrangler d1 migrations apply --local
                <br />
                wrangler d1 migrations apply --remote (preview/alpha/prod)
              </div>
            </div>
            <div className="border p-4 rounded">
              <h3 className="font-semibold mb-2">R2 Check</h3>
              <p className="text-sm text-gray-600 mb-2">
                Performs PUT → GET → DELETE of tiny object in <code>R2_BUCKET</code>. Proves R2 bucket binding.
              </p>
              <div className="text-xs font-mono bg-gray-50 p-2 rounded">
                wrangler r2 bucket create portfolio-images
                <br />
                wrangler r2 bucket create portfolio-images-preview
                <br />
                wrangler r2 bucket create portfolio-images-alpha
              </div>
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="font-semibold mb-2">R2 Sample Image</h2>
          <p className="text-sm text-gray-600 mb-3">
            If R2 is working, this image should load from R2 or placeholder. For Slice 0, we use placeholder
            until Slice 1 implements real R2 serving.
          </p>
          <div className="border rounded overflow-hidden max-w-md">
            {health?.sampleImageUrl ? (
              <img
                src={health.sampleImageUrl}
                alt="R2 sample"
                className="w-full h-48 object-cover"
                onError={(e) => {
                  // fallback to placeholder on error
                  ;(e.target as HTMLImageElement).src =
                    'https://via.placeholder.com/400x200?text=R2+placeholder+Slice0'
                }}
              />
            ) : (
              <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400">
                No image yet — health loading
              </div>
            )}
          </div>
        </section>

        <section className="text-xs text-gray-500 font-mono border-t pt-4">
          <div>Slice 0 files:</div>
          <ul className="list-disc ml-4 mt-1">
            <li>wrangler.toml — 3 envs: preview (PR), alpha (alpha subdomain), production (prod)</li>
            <li>migrations/0001_initial.sql — pages, sections, section_items, contacts, bookings</li>
            <li>functions/api/health.ts — D1 + R2 check</li>
            <li>functions/_lib/env.ts, db.ts, r2.ts — helpers</li>
            <li>src/lib/api.ts — typed client</li>
            <li>src/App.tsx + HealthBadge + EnvBanner</li>
          </ul>
          <div className="mt-3">
            Next: Slice 1 — Content Display (GET /api/content/home) from D1 + R2 images.
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
