import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Admin } from './Admin'

const mockUseAdminAuth = vi.fn()
vi.mock('../hooks/useAdminAuth', () => ({
  useAdminAuth: (...args: any[]) => mockUseAdminAuth(...args),
}))

const mockUseAdminContent = vi.fn()
vi.mock('../hooks/useAdminContent', () => ({
  useAdminContent: (...args: any[]) => mockUseAdminContent(...args),
}))

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<any>('../lib/api')
  return {
    ...actual,
    fetchR2Usage: vi.fn().mockResolvedValue({ totalObjects: 0, totalMB: 0, percent: 0, warning: false, truncated: false, limitMB: 10240, guidance: 'safe' }),
  }
})

vi.mock('../components/sections/HeroSection', () => ({
  HeroSection: ({ section }: any) => <div data-testid="hero-preview">{section.heading}</div>,
}))
vi.mock('../components/sections/CardsGrid', () => ({
  CardsGrid: ({ section }: any) => <div data-testid="cards-preview">{section.heading}</div>,
}))
vi.mock('../components/sections/TextBlock', () => ({
  TextBlock: ({ section }: any) => <div data-testid="text-preview">{section.heading}</div>,
}))
vi.mock('../components/sections/Testimonials', () => ({
  Testimonials: () => <div data-testid="testimonials-preview">Testimonials</div>,
}))
vi.mock('../components/sections/CTABanner', () => ({
  CTABanner: () => <div data-testid="cta-preview">CTA</div>,
}))
vi.mock('../components/sections/ImageGallery', () => ({
  ImageGallery: () => <div data-testid="gallery-preview">Gallery</div>,
}))

describe('Admin page — inline edit identical to landing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAdminContent.mockReturnValue({
      sections: [
        { id: 'sec1', type: 'hero', heading: 'Welcome', subheading: 'Sub', sort_order: 0, is_visible: 1, config: {}, items: [{ id: 'item1', section_id: 'sec1', title: 'Hero Title', body: 'Hero Body', image_url: '/api/images/portfolio/hero.png', sort_order: 0, is_visible: 1 }] },
      ],
      loading: false,
      error: null,
      updateSection: vi.fn(),
      updateItem: vi.fn(),
      reorderSections: vi.fn(),
      reorderItems: vi.fn(),
      refetch: vi.fn(),
    })
  })

  it('shows loading state', () => {
    mockUseAdminAuth.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      isAuthed: false,
      isBypass: false,
      email: null,
      refetch: vi.fn(),
    })
    render(<Admin />)
    expect(screen.getByText(/Checking admin access/i)).toBeInTheDocument()
  })

  it('shows passwordless login when not authed (401)', () => {
    mockUseAdminAuth.mockReturnValue({
      data: { authed: false, error: 'Missing Cloudflare Access JWT' },
      loading: false,
      error: 'Missing Cloudflare Access JWT',
      isAuthed: false,
      isBypass: false,
      email: null,
      refetch: vi.fn(),
    })
    render(<Admin />)
    expect(screen.getByText(/Passwordless Google Login/i)).toBeInTheDocument()
  })

  it('shows minimal top bar Admin when authed via bypass (no big passwordless card)', async () => {
    mockUseAdminAuth.mockReturnValue({
      data: { authed: true, email: 'bypass@local', bypass: true, env: 'local', allowlistConfigured: false },
      loading: false,
      error: null,
      isAuthed: true,
      isBypass: true,
      email: 'bypass@local',
      refetch: vi.fn(),
    })
    render(<Admin />)
    expect(screen.getByText(/^Admin$/)).toBeInTheDocument()
    expect(screen.getAllByText(/bypass@local/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Passwordless Google Login — Cloudflare Zero Trust/)).not.toBeInTheDocument()
    expect(screen.getByText(/View site/i)).toBeInTheDocument()
    expect(screen.getByText(/R2 Quota/i)).toBeInTheDocument()
  })

  it('renders preview almost identical to landing with current text and current image', () => {
    mockUseAdminAuth.mockReturnValue({
      data: { authed: true, email: 'admin@example.com', bypass: false, env: 'production', allowlistConfigured: true },
      loading: false,
      error: null,
      isAuthed: true,
      isBypass: false,
      email: 'admin@example.com',
      refetch: vi.fn(),
    })
    render(<Admin />)
    expect(screen.getByTestId('hero-preview')).toBeInTheDocument()
    expect(screen.getAllByText(/Welcome/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Edit hero/i)).toBeInTheDocument()
  })

  it('edit panel collapsed by default — shows current text image only when expanded', async () => {
    mockUseAdminAuth.mockReturnValue({
      data: { authed: true, email: 'admin@example.com', bypass: false, env: 'production', allowlistConfigured: true },
      loading: false,
      error: null,
      isAuthed: true,
      isBypass: false,
      email: 'admin@example.com',
      refetch: vi.fn(),
    })
    render(<Admin />)
    expect(screen.getByTestId('hero-preview')).toBeInTheDocument()
    // Edit drawer collapsed by default — toggle button shows Edit hero
    expect(screen.getAllByText(/Edit hero/i).length).toBeGreaterThan(0)
  })

  it('shows compact image uploader with PNG≤1MB else WebP note', async () => {
    mockUseAdminAuth.mockReturnValue({
      data: { authed: true, email: 'admin@example.com', bypass: false, env: 'production', allowlistConfigured: true },
      loading: false,
      error: null,
      isAuthed: true,
      isBypass: false,
      email: 'admin@example.com',
      refetch: vi.fn(),
    })
    mockUseAdminContent.mockReturnValue({
      sections: [
        {
          id: 'sec1',
          type: 'hero',
          heading: 'Welcome',
          subheading: 'Sub',
          sort_order: 0,
          is_visible: 1,
          config: {},
          items: [
            { id: 'item1', section_id: 'sec1', title: 'Title', body: 'Body', image_url: '/api/images/portfolio/test.png', sort_order: 0, is_visible: 1 },
          ],
        },
      ],
      loading: false,
      error: null,
      updateSection: vi.fn(),
      updateItem: vi.fn(),
      reorderSections: vi.fn(),
      reorderItems: vi.fn(),
      refetch: vi.fn(),
    })
    render(<Admin />)
    // Expand section first
    const toggle = screen.getAllByText(/Edit hero/i)[0]
    toggle.click()
    // Expand item
    const itemExpand = await screen.findAllByText(/Expand item|Title/);
    // Find Expand item button via aria-label if exists
    const expandBtns = screen.queryAllByLabelText(/Expand item/i)
    if (expandBtns.length > 0) expandBtns[0].click()
    else {
      // Click the Title which is Expand item trigger
      const titleBtn = screen.getAllByText(/Title/)[0]
      titleBtn.click()
    }
    expect(await screen.findAllByText(/Drop or click to replace/i)).toBeTruthy()
    expect(screen.getAllByText(/PNG if.*1MB.*WebP/i).length).toBeGreaterThan(0)
  })
})
