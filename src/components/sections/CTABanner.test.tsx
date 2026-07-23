import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CTABanner } from './CTABanner'

describe('CTABanner', () => {
  it('should render title + link button', () => {
    render(
      <CTABanner
        section={{ id: 'sec5', type: 'cta-banner', heading: 'Ready to start?' } as any}
        items={[
          { id: 'i1', title: 'Let’s talk', body: 'Contact me today', link_url: '/#contact', link_text: 'Contact Now', sort_order: 0, is_visible: 1 } as any,
        ]}
      />
    )
    expect(screen.getByText(/Ready to start/)).toBeInTheDocument()
    expect(screen.getByText(/Let’s talk/)).toBeInTheDocument()
    expect(screen.getByText(/Contact me today/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Contact Now/ })).toHaveAttribute('href', '/#contact')
  })

  it('should handle no items', () => {
    render(<CTABanner section={{ id: 'sec5', type: 'cta-banner', heading: 'CTA' } as any} items={[]} />)
    expect(screen.getByText(/CTA/)).toBeInTheDocument()
  })
})
