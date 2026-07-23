import React from 'react'
import { useContent } from '../hooks/useContent'
import { HeroSection } from '../components/sections/HeroSection'
import { CardsGrid } from '../components/sections/CardsGrid'
import { TextBlock } from '../components/sections/TextBlock'
import { Testimonials } from '../components/sections/Testimonials'
import { CTABanner } from '../components/sections/CTABanner'
import { ImageGallery } from '../components/sections/ImageGallery'
import { HealthBadge } from '../components/HealthBadge'
import { useEffect, useState } from 'react'
import { fetchHealth, type HealthResponse } from '../lib/api'
import type { Section } from '../lib/api'

function renderSection(section: Section) {
  const items = section.items || []
  switch (section.type) {
    case 'hero':
      return <HeroSection key={section.id} section={section} items={items} />
    case 'cards-grid':
      return (
        <div key={section.id} id="services">
          <CardsGrid section={section} items={items} />
        </div>
      )
    case 'text-block':
      return (
        <div key={section.id} id="about">
          <TextBlock section={section} items={items} />
        </div>
      )
    case 'testimonials':
      return (
        <div key={section.id} id="testimonials">
          <Testimonials section={section} items={items} />
        </div>
      )
    case 'cta-banner':
      return <CTABanner key={section.id} section={section} items={items} />
    case 'image-gallery':
      return <ImageGallery key={section.id} section={section} items={items} />
    default:
      return null
  }
}

export function Home({ envOverride }: { envOverride?: string }) {
  const { data, loading, error } = useContent('home')
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  const [healthError, setHealthError] = useState<string | null>(null)

  useEffect(() => {
    fetchHealth({ timeoutMs: 8000 })
      .then(setHealth)
      .catch((e: any) => setHealthError(e.message))
      .finally(() => setHealthLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="animate-pulse">Loading portfolio content…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20">
        <div className="p-4 border border-red-300 bg-red-50 rounded mb-6">
          <div className="font-bold">Failed to load content</div>
          <div className="text-sm">{error}</div>
          <div className="text-xs mt-2">Try: GET /api/content/home should return JSON from D1</div>
        </div>
        {/* Show health for debugging even when content fails */}
        <div className="mt-6">
          <h3 className="font-semibold mb-2">Infra Health (Slice 0)</h3>
          <HealthBadge health={health} loading={healthLoading} error={healthError} />
        </div>
      </div>
    )
  }

  const page = data?.page
  const sections = data?.sections || []

  return (
    <div>
      {/* Optional health debug at top for Slice 0 compatibility — can be hidden later */}
      {(health || healthError) && (
        <div className="max-w-5xl mx-auto px-6 pt-6">
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500">Infra health (D1+R2) — env {health?.env || envOverride}</summary>
            <div className="mt-2">
              <HealthBadge health={health} loading={healthLoading} error={healthError} />
            </div>
          </details>
        </div>
      )}

      {/* Render sections from D1 ordered */}
      {sections.length > 0 ? (
        sections.map(renderSection)
      ) : (
        <div className="max-w-5xl mx-auto px-6 py-20 text-center text-gray-500">
          <h1 className="text-3xl font-bold mb-4">{page?.title || 'Portfolio'}</h1>
          <p>No sections yet — add via migrations/0002_seed.sql or Admin (Slice 6)</p>
          <p className="text-xs mt-2">GET /api/content/home returns {sections.length} sections — seed needed</p>
        </div>
      )}

      {/* Calendar placeholder for Slice 2 */}
      <section id="calendar" className="py-12 bg-gray-50 border-t">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Book a Meeting</h2>
          <p className="text-gray-600 mb-3">Calendar slots will appear here (Slice 2: Google Calendar FreeBusy)</p>
          <div className="text-xs font-mono bg-white border p-3 rounded inline-block">GET /api/calendar/slots?weeks=2 — coming in Slice 2</div>
        </div>
      </section>
    </div>
  )
}
