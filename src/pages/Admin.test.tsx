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
    expect(screen.getAllByText(/Cloudflare Zero Trust/i).length).toBeGreaterThan(0)
  })

  it('shows admin editing portfolio header when authed via bypass', async () => {
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
    expect(screen.getByText(/Admin — Editing Portfolio/i)).toBeInTheDocument()
    expect(screen.getAllByText(/bypass@local/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Bypass/i).length).toBeGreaterThan(0)
  })

  it('renders almost identical to landing page with current text and current image', () => {
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
    // Preview identical to landing — HeroSection mocked shows heading
    expect(screen.getByTestId('hero-preview')).toBeInTheDocument()
    // Current text shown via EditableText — should show Welcome heading current
    expect(screen.getAllByText(/Welcome/).length).toBeGreaterThan(0)
    // Current image shown
    expect(screen.getAllByText(/Current image/i).length).toBeGreaterThan(0)
    // Editing fields: text input, textarea, image upload
    expect(screen.getByText(/Section Heading — text input/i)).toBeInTheDocument()
    expect(screen.getByText(/Subheading — textarea input/i)).toBeInTheDocument()
    expect(screen.getByText(/Title — text input — current/i)).toBeInTheDocument()
    expect(screen.getByText(/Body — textarea input — current text/i)).toBeInTheDocument()
  })

  it('does NOT show Passwordless Google Login — Cloudflare Zero Trust big card in authed view', () => {
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
    expect(screen.queryByText(/Passwordless Google Login — Cloudflare Zero Trust/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/Edit —.*current text \/ current image/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Admin — Editing Portfolio/i)).toBeInTheDocument()
  })

  it('shows free tier note with PNG≤1MB else WebP and 100 images', () => {
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
    expect(screen.getAllByText(/PNG if.*1MB.*WebP/i).length).toBeGreaterThan(0)
    // Replace-on-update text is in quota info or uploader note, may be hidden unless quota checked — check R2 Quota button exists
    expect(screen.getByText(/R2.*Quota/i)).toBeInTheDocument()
    expect(screen.getAllByText(/100 images/).length).toBeGreaterThan(0)
  })
})
