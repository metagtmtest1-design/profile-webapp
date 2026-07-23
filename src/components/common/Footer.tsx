import React from 'react'

export function Footer() {
  return (
    <footer id="contact" className="border-t py-8 bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-4 text-sm text-gray-600">
        <div>
          <div className="font-bold">Contact</div>
          <div>Email: hello@example.com</div>
          <div>Phone: +1 (555) 123-4567</div>
        </div>
        <div>
          <div className="font-bold">Social</div>
          <div className="flex gap-3">
            <a href="#" className="hover:underline">LinkedIn</a>
            <a href="#" className="hover:underline">GitHub</a>
            <a href="#" className="hover:underline">Twitter</a>
          </div>
        </div>
        <div className="text-xs">© {new Date().getFullYear()} Portfolio. All rights reserved.</div>
      </div>
    </footer>
  )
}
