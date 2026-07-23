import React from 'react'
import { useContent } from '../hooks/useContent'
import { HeroSection } from '../components/sections/HeroSection'
import { CardsGrid } from '../components/sections/CardsGrid'
import { TextBlock } from '../components/sections/TextBlock'
import { Testimonials } from '../components/sections/Testimonials'
import { CTABanner } from '../components/sections/CTABanner'
import { ImageGallery } from '../components/sections/ImageGallery'
import type { Section } from '../lib/api'

function renderSection(section: Section) {
  const items = section.items || []
  switch (section.type) {
    case 'hero': return <HeroSection key={section.id} section={section} items={items} />
    case 'cards-grid': return <div key={section.id} id="services"><CardsGrid section={section} items={items} /></div>
    case 'text-block': return <div key={section.id} id="about"><TextBlock section={section} items={items} /></div>
    case 'testimonials': return <div key={section.id} id="testimonials"><Testimonials section={section} items={items} /></div>
    case 'cta-banner': return <CTABanner key={section.id} section={section} items={items} />
    case 'image-gallery': return <ImageGallery key={section.id} section={section} items={items} />
    default: return null
  }
}

export function Home() {
  const { data, loading, error } = useContent('home')

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-24 text-center">
        <div className="inline-block w-2 h-2 rounded-full bg-gray-400 animate-pulse mr-2"></div>
        <span className="text-gray-600">Loading portfolio…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-24 text-center">
        <h1 className="text-2xl font-bold mb-3 tracking-tight">Unable to load portfolio</h1>
        <p className="text-gray-600 text-sm">Please try again later.</p>
      </div>
    )
  }

  const sections = data?.sections || []

  if (sections.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-black tracking-tight mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>{data?.page?.title || 'Portfolio'}</h1>
        <p className="text-gray-600">Content is being prepared. Please check back soon.</p>
      </div>
    )
  }

  return (
    <div>
      {sections.map(renderSection)}
      <section id="calendar" className="py-20 lg:py-24 bg-white border-t">
        <div className="max-w-5xl mx-auto px-6">
          <div className="max-w-3xl mx-auto rounded-2xl border bg-slate-50 p-8 lg:p-10 text-center">
            <div className="w-10 h-10 rounded-full bg-white border shadow-sm mx-auto flex items-center justify-center mb-4">📅</div>
            <h2 className="text-2xl lg:text-3xl font-black tracking-tight mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>Book a meeting</h2>
            <p className="text-gray-600 mb-6 max-w-xl mx-auto">30-minute intro call. We’ll discuss goals, scope, timeline, and next steps — no pitch.</p>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border text-xs font-medium text-gray-600">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Calendar integration coming in next update
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
