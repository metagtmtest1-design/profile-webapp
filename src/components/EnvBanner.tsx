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

  return (
    <div className={`${bg} text-white text-center py-2 px-4 text-sm font-mono`}>
      <span className="font-bold">{label}</span> — {detail} — env: {env}
    </div>
  )
}
