import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface TextBlockProps {
  section: Section
  items: SectionItem[]
}

export function TextBlock({ section, items }: TextBlockProps) {
  const first = items[0]
  return (
    <section className="py-12 bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row gap-8 items-center">
        <div className="flex-1">
          {first?.image_url && (
            <img src={first.image_url} alt={first.title || 'About'} className="w-full rounded-lg object-cover h-64 md:h-80" loading="lazy" />
          )}
        </div>
        <div className="flex-1">
          {section.heading && <h2 className="text-3xl font-bold mb-2">{section.heading}</h2>}
          {section.subheading && <p className="text-gray-600 mb-4">{section.subheading}</p>}
          {first?.title && <h3 className="font-semibold mb-2">{first.title}</h3>}
          {first?.body && <p className="text-gray-700 mb-3 whitespace-pre-wrap">{first.body}</p>}
          {first?.author && <p className="text-sm text-gray-500 italic">{first.author}</p>}
        </div>
      </div>
    </section>
  )
}
