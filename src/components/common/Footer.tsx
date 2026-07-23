import React from 'react'

export function Footer() {
  return (
    <footer id="contact" className="border-t bg-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex flex-col lg:flex-row justify-between gap-10 text-sm">
          <div className="max-w-sm">
            <div className="font-black text-2xl tracking-tight mb-3" style={{ fontFamily: 'Playfair Display, serif' }}>Portfolio</div>
            <p className="text-gray-600 leading-relaxed">Strategic brand design and development for ambitious teams. Based in Boston, working globally. Book a free intro call to start.</p>
            <div className="mt-5 flex gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">in</div>
              <div className="w-8 h-8 rounded-full bg-slate-100 border flex items-center justify-center text-xs">gh</div>
              <div className="w-8 h-8 rounded-full bg-slate-100 border flex items-center justify-center text-xs">𝕏</div>
            </div>
          </div>
          <div>
            <div className="font-bold mb-4 tracking-tight">Services</div>
            <div className="flex flex-col gap-2 text-gray-600">
              <a href="#services" className="hover:text-black">Brand Strategy</a>
              <a href="#services" className="hover:text-black">Logo & Identity</a>
              <a href="#services" className="hover:text-black">Web Design</a>
              <a href="#services" className="hover:text-black">Art Direction</a>
            </div>
          </div>
          <div>
            <div className="font-bold mb-4 tracking-tight">Company</div>
            <div className="flex flex-col gap-2 text-gray-600">
              <a href="#about" className="hover:text-black">About</a>
              <a href="#testimonials" className="hover:text-black">Testimonials</a>
              <a href="#calendar" className="hover:text-black">Book a call</a>
              <a href="/health" className="hover:text-black text-xs">System health</a>
            </div>
          </div>
          <div className="bg-slate-50 border rounded-xl p-5 h-fit">
            <div className="font-bold mb-2">Start your project</div>
            <p className="text-gray-600 text-xs mb-4 max-w-[22ch]">Book a 30-min call. No pitch, just practical next steps.</p>
            <a href="#calendar" className="btn-primary text-sm w-full justify-center">Book free call →</a>
          </div>
        </div>
        <div className="border-t mt-10 pt-6 flex flex-col sm:flex-row justify-between gap-3 text-xs text-gray-500">
          <div>© {new Date().getFullYear()} Portfolio. All rights reserved.</div>
          <div className="flex gap-4"><span>Privacy</span><span>Terms</span><span>Boston • Remote-first</span></div>
        </div>
      </div>
    </footer>
  )
}
