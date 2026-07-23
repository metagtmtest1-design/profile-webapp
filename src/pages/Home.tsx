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

export function Home() {
  const { data, loading, error } = useContent('home')

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <div className="animate-pulse text-gray-600">Loading portfolio…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Unable to load portfolio</h1>
        <p className="text-gray-600 text-sm">Please try again later.</p>
        <p className="text-xs text-gray-400 mt-2">{error}</p>
      </div>
    )
  }

  const page = data?.page
  const sections = data?.sections || []

  if (sections.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <h1 className="text-3xl font-bold mb-4">{page?.title || 'Portfolio'}</h1>
        <p className="text-gray-600">Content is being prepared. Please check back soon.</p>
      </div>
    )
  }

  return (
    <div>
      {sections.map(renderSection)}

      {/* Calendar placeholder for Slice 2 — user-friendly, no raw API path */}
      <section id="calendar" className="py-20 bg-white border-t">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-black mb-4">Book a Meeting</h2>
          <p className="text-gray-600 mb-6">Choose a time that works for you. Scheduling will be available soon.</p>
          <div className="inline-block px-6 py-3 bg-gray-100 border rounded-lg text-sm text-gray-600">Calendar coming in next update</div>
        </div>
      </section>
    </div>
  )
}
