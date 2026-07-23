import React, { useEffect, useState } from 'react'
import { fetchHealth, type HealthResponse } from './lib/api'
import { Layout } from './components/common/Layout'
import { Home } from './pages/Home'

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
    <Layout env={health?.env} title={health ? `Portfolio — ${health.env}` : 'Portfolio'}>
      {/* Bold banner for alpha/prod verification — Slice 0 carryover, now for Slice 1 */}
      {health && (
        <div
          style={{
            background: health.env === 'alpha' ? '#ff6b00' : health.env === 'production' ? '#00aa00' : '#6b7280',
            color: 'white',
            padding: '20px',
            border: '5px solid black',
            textAlign: 'center',
            fontWeight: 900,
          }}
        >
          <h1 style={{ fontWeight: 900, fontSize: '2em', textTransform: 'uppercase' }}>
            🚀 BOLD {health.env.toUpperCase()} ENV — {health.env.toUpperCase()} ✅ — Slice 1 Content
          </h1>
          <p style={{ fontWeight: 'bold' }}>
            {health.env === 'alpha' ? 'ALPHA — orange proves isolation!' : 'PROD — green proves merge worked!'} — DB: {health.db} R2: {health.r2}
          </p>
          <p className="text-sm">Deployed: {new Date().toLocaleString()}</p>
        </div>
      )}
      {loading && !health && (
        <div className="max-w-5xl mx-auto px-6 py-4 text-center animate-pulse">Checking infra… DB + R2 health</div>
      )}
      {error && (
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="p-4 border border-red-300 bg-red-50 text-red-700 rounded">Health error: {error}</div>
        </div>
      )}

      {/* Slice 1: Content from D1 */}
      <Home envOverride={health?.env} />
    </Layout>
  )
}

export default App
