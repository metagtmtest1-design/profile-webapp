import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface TextBlockProps {
  section: Section
  items: SectionItem[]
}

export function TextBlock({ section, items }: TextBlockProps) {
  const first = items[0]
  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row gap-10 items-start">
        <div className="flex-1">
          {first?.image_url ? (
            <img src={first.image_url} alt={first.title || 'About'} className="w-full rounded-xl object-cover h-80 shadow-md" loading="lazy" />
          ) : (
            <div className="w-full h-80 bg-white border rounded-xl flex items-center justify-center text-gray-400">Photo</div>
          )}
        </div>
        <div className="flex-1">
          <div className="inline-block px-3 py-1 bg-white border rounded-full text-xs font-semibold mb-3">About</div>
          {section.heading && <h2 className="text-3xl font-black mb-2">{section.heading}</h2>}
          {section.subheading && <p className="text-gray-600 mb-4">{section.subheading}</p>}
          {first?.title && <h3 className="text-xl font-bold mb-3">{first.title}</h3>}
          {first?.body && <p className="text-gray-700 mb-4 whitespace-pre-wrap leading-relaxed">{first.body}</p>}
          {first?.author && (
            <div className="mt-4 p-3 bg-white border rounded-lg text-sm text-gray-600">
              <span className="font-semibold">Credentials:</span> {first.author}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
