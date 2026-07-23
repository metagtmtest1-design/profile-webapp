import React from 'react'

export interface NavProps {
  title?: string
}

export function Nav({ title = 'Portfolio' }: NavProps) {
  return (
    <nav className="border-b bg-white sticky top-0 z-10">
      <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="font-black text-xl">{title}</div>
        <div className="flex gap-6 text-sm">
          <a href="#services" className="hover:underline">Services</a>
          <a href="#about" className="hover:underline">About</a>
          <a href="#testimonials" className="hover:underline">Testimonials</a>
          <a href="#calendar" className="hover:underline">Calendar</a>
          <a href="#contact" className="hover:underline">Contact</a>
          <a href="/materials" className="hover:underline">Materials</a>
        </div>
      </div>
    </nav>
  )
}
