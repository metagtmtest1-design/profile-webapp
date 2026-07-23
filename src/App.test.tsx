import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

// Mock lib/api — both health and content (Slice 1)
vi.mock('./lib/api', () => ({
  fetchHealth: vi.fn(),
  fetchContent: vi.fn().mockResolvedValue({
    page: { id: 'p1', slug: 'home', title: 'Portfolio', meta_description: 'Desc', sort_order: 0, is_published: 1 },
    sections: [],
  }),
}))

import { fetchHealth, fetchContent } from './lib/api'

describe('App component - Slice 0+1', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // Default mock for content (empty portfolio)
    vi.mocked(fetchContent).mockResolvedValue({
      page: { id: 'p1', slug: 'home', title: 'Portfolio', meta_description: 'Desc', sort_order: 0, is_published: 1 },
      sections: [],
    } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render loading state initially', () => {
    vi.mocked(fetchHealth).mockReturnValue(new Promise(() => {})) // never resolves
    render(<App />)
    expect(screen.getByText(/checking/i)).toBeInTheDocument()
  })

  it('should render health ok badge after fetch (bold banner)', async () => {
    vi.mocked(fetchHealth).mockResolvedValue({
      status: 'ok',
      db: 'ok',
      r2: 'ok',
      timestamp: new Date().toISOString(),
      env: 'test',
      checks: { d1Ms: 2, r2Ms: 3 },
    } as any)

    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/BOLD TEST ENV/i)).toBeInTheDocument()
    })
    // Health badge in details or banner contains db ok
    expect(screen.getAllByText(/db: ok/i).length + screen.getAllByText(/DB: ok/i).length).toBeGreaterThanOrEqual(1)
  })

  it('should render error when health fails', async () => {
    vi.mocked(fetchHealth).mockRejectedValue(new Error('D1 connection failed'))

    render(<App />)
    await waitFor(() => {
      expect(screen.getAllByText(/D1 connection failed/i).length).toBeGreaterThanOrEqual(1)
    })
  })

  it('should render portfolio content from D1 (Home) when health ok', async () => {
    vi.mocked(fetchHealth).mockResolvedValue({
      status: 'ok',
      db: 'ok',
      r2: 'ok',
      timestamp: new Date().toISOString(),
      env: 'test',
      checks: { d1Ms: 2, r2Ms: 3 },
    } as any)

    vi.mocked(fetchContent).mockResolvedValue({
      page: { id: 'p1', slug: 'home', title: 'My Portfolio', sort_order: 0, is_published: 1 },
      sections: [
        { id: 'sec1', page_id: 'p1', type: 'hero', heading: 'Welcome Home', sort_order: 0, is_visible: 1, config: {}, items: [{ id: 'i1', title: 'Hero Title', sort_order: 0, is_visible: 1 }] } as any,
      ],
    } as any)

    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/Welcome Home/)).toBeInTheDocument()
    })
  })

  it('should show ENVIRONMENT banner when not production (alpha)', async () => {
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
    await waitFor(() => {
      expect(screen.getByText(/BOLD ALPHA ENV/i)).toBeInTheDocument()
    })
    expect(screen.getAllByText(/ALPHA/i).length).toBeGreaterThanOrEqual(1)
  })

  it('should show bold production banner when env=production (merged PR)', async () => {
    vi.mocked(fetchHealth).mockResolvedValue({
      status: 'ok',
      db: 'ok',
      r2: 'ok',
      timestamp: new Date().toISOString(),
      env: 'production',
      checks: { d1Ms: 2, r2Ms: 3 },
    } as any)

    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/BOLD PRODUCTION ENV/i)).toBeInTheDocument()
    })
    expect(screen.getAllByText(/PRODUCTION/i).length).toBeGreaterThanOrEqual(1)
    // Prod banner text differs slightly after merge — check for green merge proof
    expect(screen.getByText(/green proves merge|PROD — green/i)).toBeInTheDocument()
  })
})
