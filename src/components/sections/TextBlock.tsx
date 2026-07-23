import React from 'react'
import type { Section, SectionItem } from '../../lib/api'

export interface TextBlockProps {
  section: Section
  items: SectionItem[]
}

export function TextBlock({ section, items }: TextBlockProps) {
  const first = items[0]
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 flex flex-col lg:flex-row gap-12 lg:gap-16 items-center">
        <div className="flex-1 w-full">
          {first?.image_url ? (
            <img src={first.image_url} alt={first.title || section.heading || 'Portrait of the portfolio owner'} className="w-full rounded-xl object-cover shadow-md aspect-[4/3] h-auto" loading="lazy" decoding="async" />
          ) : (
            <div className="w-full aspect-[4/3] bg-white border rounded-xl flex items-center justify-center text-gray-400">Photo</div>
          )}
        </div>
        <div className="flex-1 w-full max-w-[65ch]">
          {section.heading && <h2 className="text-3xl font-black mb-3 tracking-tight">{section.heading}</h2>}
          {section.subheading && <p className="text-gray-600 mb-5">{section.subheading}</p>}
          {first?.title && <h3 className="text-xl font-bold mb-3">{first.title}</h3>}
          {first?.body && <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{first.body}</p>}
          {first?.author && (
            <div className="mt-6 p-4 bg-white border rounded-lg text-sm text-gray-600">
              <span className="font-semibold">Credentials:</span> {first.author}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
