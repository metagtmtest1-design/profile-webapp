import React from 'react'

export interface EnvBannerProps {
  env: string
}

export function EnvBanner({ env }: EnvBannerProps) {
  const normalized = (env || '').toLowerCase()
  const isProd = normalized === 'production'
  const isAlpha = normalized === 'alpha'
  const isPreview = normalized === 'preview'

  if (isProd) {
    return null
  }

  let bg = 'bg-yellow-500'
  let label = `[${env.toUpperCase()}]`
  let detail = 'Testing environment'

  if (isAlpha) {
    bg = 'bg-orange-500'
    detail = 'Alpha testing — not production'
  } else if (isPreview) {
    bg = 'bg-blue-500'
    detail = 'Preview deployment — testing'
  } else if (normalized === 'local' || normalized === 'test') {
    bg = 'bg-gray-500'
    detail = 'Local development'
  }

  // Visual bold for alpha verification (prod will stay old until merged)
  const isBoldVisual = isAlpha
  return (
    <div className={`${bg} text-white text-center py-3 px-4 text-sm font-mono ${isBoldVisual ? 'font-black text-lg border-4 border-black' : ''}`}>
      <span className="font-bold" style={isBoldVisual ? { fontWeight: 900, fontSize: '1.5em', textTransform: 'uppercase' } : {}}>{label} — BOLD ALPHA MODE</span> — {detail} — env: <strong style={{ fontWeight: 900 }}>{env}</strong> — {isBoldVisual ? '✅ Alpha deploy working!' : ''}
    </div>
  )
}
