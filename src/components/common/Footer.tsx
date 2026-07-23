import React from 'react'

export function Footer() {
  return (
    <footer id="contact" className="border-t py-12 bg-gray-50">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between gap-8 text-sm text-gray-600">
          <div>
            <div className="font-black text-lg mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>Portfolio</div>
            <div className="mb-1">Email: hello@example.com</div>
            <div className="mb-1">Phone: +1 (555) 123-4567</div>
            <div className="text-xs mt-3">Crafting brands that inspire.</div>
          </div>
          <div>
            <div className="font-bold mb-3">Navigation</div>
            <div className="flex flex-col gap-1">
              <a href="#services" className="hover:underline">Services</a>
              <a href="#about" className="hover:underline">About</a>
              <a href="#testimonials" className="hover:underline">Testimonials</a>
              <a href="#calendar" className="hover:underline">Book a Call</a>
            </div>
          </div>
          <div>
            <div className="font-bold mb-3">Social</div>
            <div className="flex gap-3">
              <a href="#" className="hover:underline">LinkedIn</a>
              <a href="#" className="hover:underline">GitHub</a>
              <a href="#" className="hover:underline">Dribbble</a>
            </div>
            <div className="mt-4">
              <a href="/materials" className="inline-block px-4 py-2 bg-black text-white rounded-lg text-xs font-bold">Lookup Materials</a>
            </div>
          </div>
        </div>
        <div className="border-t mt-8 pt-6 text-xs text-gray-500 flex justify-between">
          <div>© {new Date().getFullYear()} Portfolio. All rights reserved.</div>
          <div>Built on Cloudflare Free Tier — $0/month</div>
        </div>
      </div>
    </footer>
  )
}
