import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Testimonials } from './Testimonials'

describe('Testimonials', () => {
  it('should render quotes cards with author', () => {
    render(
      <Testimonials
        section={{ id: 'sec4', type: 'testimonials', heading: 'Happy Clients' } as any}
        items={[
          { id: 'i1', body: 'Great work, highly recommended!', author: 'John Smith', sort_order: 0, is_visible: 1 } as any,
          { id: 'i2', body: 'Amazing collaboration', author: 'Alice Johnson', sort_order: 1, is_visible: 1 } as any,
        ]}
      />
    )
    expect(screen.getByRole('heading', { name: /Happy Clients/ })).toBeInTheDocument()
    expect(screen.getByText(/Great work/)).toBeInTheDocument()
    expect(screen.getByText(/John Smith/)).toBeInTheDocument()
  })

  it('should handle empty testimonials', () => {
    render(<Testimonials section={{ id: 'sec4', type: 'testimonials', heading: 'Testimonials' } as any} items={[]} />)
    expect(screen.getByRole('heading', { name: /testimonials/i })).toBeInTheDocument()
    expect(screen.getByText(/Client feedback coming soon/i)).toBeInTheDocument()
  })
})
