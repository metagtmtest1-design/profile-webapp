import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

vi.mock('./lib/api', () => ({
  fetchHealth: vi.fn().mockResolvedValue({
    status: 'ok',
    db: 'ok',
    r2: 'ok',
    timestamp: new Date().toISOString(),
    env: 'test',
    checks: { d1Ms: 2, r2Ms: 3 },
  }),
  fetchContent: vi.fn().mockResolvedValue({
    page: { id: 'p1', slug: 'home', title: 'Portfolio', meta_description: 'Desc', sort_order: 0, is_published: 1 },
    sections: [],
  }),
  fetchCalendarSlots: vi.fn().mockResolvedValue([]),
  fetchSlotsFull: vi.fn().mockResolvedValue({ slots: [], weeks: 2, source: 'stub' }),
}))

import { fetchContent, fetchHealth, fetchCalendarSlots } from './lib/api'

describe('App component - clean UI (no debug banners)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Default mocks
    vi.mocked(fetchContent).mockResolvedValue({
      page: { id: 'p1', slug: 'home', title: 'Portfolio', meta_description: 'Desc', sort_order: 0, is_published: 1 },
      sections: [],
    } as any)
    vi.mocked(fetchHealth).mockResolvedValue({
      status: 'ok',
      db: 'ok',
      r2: 'ok',
      timestamp: new Date().toISOString(),
      env: 'test',
      checks: { d1Ms: 2, r2Ms: 3 },
    } as any)
    vi.mocked(fetchCalendarSlots).mockResolvedValue([] as any)
    vi.mocked(fetchHealth).mockResolvedValue({
      status: 'ok',
      db: 'ok',
      r2: 'ok',
      timestamp: new Date().toISOString(),
      env: 'test',
      checks: { d1Ms: 2, r2Ms: 3 },
    } as any)
    // Ensure pathname is root for main tests
    Object.defineProperty(window, 'location', {
      value: { pathname: '/' },
      writable: true,
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it('should render portfolio content from D1 (Home) without debug banners', async () => {
    vi.mocked(fetchContent).mockResolvedValue({
      page: { id: 'p1', slug: 'home', title: 'My Portfolio', sort_order: 0, is_published: 1 },
      sections: [
        { id: 'sec1', page_id: 'p1', type: 'hero', heading: 'Welcome Home', sort_order: 0, is_visible: 1, config: {}, items: [{ id: 'i1', title: 'Hero Title', sort_order: 0, is_visible: 1 }] } as any,
      ],
    } as any)

    render(<App />)
    await waitFor(() => expect(screen.getByText(/Welcome Home/)).toBeInTheDocument())
    // Should NOT show BOLD ENV debug banner on main page (moved to /health)
    expect(screen.queryByText(/BOLD .* ENV/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/DB: ok/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/R2: ok/i)).not.toBeInTheDocument()
  })

  it('should render loading state for content', () => {
    vi.mocked(fetchContent).mockReturnValue(new Promise(() => {}) as any)
    render(<App />)
    expect(screen.getByText(/loading portfolio/i)).toBeInTheDocument()
  })

  it('should handle content empty gracefully', async () => {
    render(<App />)
    await waitFor(() => screen.getByText(/content is being prepared/i))
    expect(screen.getByText(/check back soon/i)).toBeInTheDocument()
  })

  it('should render health debug page at /health route (env in /health, not main)', async () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/health' },
      writable: true,
    })
    vi.mocked(fetchHealth).mockResolvedValue({
      status: 'ok',
      db: 'ok',
      r2: 'ok',
      timestamp: new Date().toISOString(),
      env: 'alpha',
      checks: { d1Ms: 2, r2Ms: 3 },
      sampleImageUrl: 'https://example.com/img.jpg',
    } as any)

    render(<App />)
    await waitFor(() => expect(screen.getByText(/System Health — Debug/i)).toBeInTheDocument())
    await waitFor(() => expect(screen.getAllByText(/DB: ok/i).length).toBeGreaterThanOrEqual(1))
    expect(screen.getAllByText(/R2: ok/i).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/alpha/i).length).toBeGreaterThanOrEqual(1)
  })

  it('should not show infra health details on main portfolio page', async () => {
    render(<App />)
    await waitFor(() => screen.getByText(/content is being prepared/i))
    expect(screen.queryByText(/Infra health/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/D1\+R2/i)).not.toBeInTheDocument()
  })
})
