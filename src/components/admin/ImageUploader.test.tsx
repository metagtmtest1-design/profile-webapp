import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ImageUploader } from './ImageUploader'

const mockResizeImage = vi.fn()
vi.mock('../../lib/imageResize', async () => {
  const actual = await vi.importActual<any>('../../lib/imageResize')
  return {
    ...actual,
    resizeImage: (...args: any[]) => mockResizeImage(...args),
    isImageFile: (file: File) => file.type.startsWith('image/'),
    MAX_FILE_SIZE: 1_048_576,
    MAX_DIMENSION: 1200,
  }
})

function makeFile(name: string, size: number, type: string): File {
  const buf = new Uint8Array(size)
  return new File([buf], name, { type })
}

describe('ImageUploader — PNG if ≤1MB else WebP within 1MB', () => {
  const mockFetch = vi.fn()
  const originalFetch = global.fetch
  const originalCreateObjectURL = (global as any).URL?.createObjectURL
  const originalRevokeObjectURL = (global as any).URL?.revokeObjectURL

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = mockFetch as any
    // Mock URL.createObjectURL for jsdom
    if (!(global as any).URL) (global as any).URL = {}
    ;(global as any).URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    ;(global as any).URL.revokeObjectURL = vi.fn()
    mockResizeImage.mockImplementation(async (file: File) => {
      // Simulate PNG if ≤1MB else WebP
      const isSmall = file.size <= 600_000
      const format = isSmall ? 'png' : 'webp'
      const size = isSmall ? 500_000 : 350_000
      const blob = new Blob([new Uint8Array(size)], { type: `image/${format}` })
      return {
        blob,
        format,
        width: 1200,
        height: 900,
        originalSize: file.size,
        finalSize: size,
        quality: format === 'webp' ? 0.8 : undefined,
      }
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    if (originalCreateObjectURL) (global as any).URL.createObjectURL = originalCreateObjectURL
    if (originalRevokeObjectURL) (global as any).URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('renders file input', () => {
    render(<ImageUploader onUploadComplete={vi.fn()} />)
    expect(screen.getByText(/Drop or click to replace/i)).toBeInTheDocument()
    expect(screen.getByText(/Free tier info/i)).toBeInTheDocument()
  })

  it('rejects non-image file type', async () => {
    const onError = vi.fn()
    render(<ImageUploader onUploadComplete={vi.fn()} onError={onError} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const txtFile = makeFile('doc.txt', 1000, 'text/plain')
    fireEvent.change(input, { target: { files: [txtFile] } })
    await waitFor(() => expect(screen.getByText(/only images allowed/i)).toBeInTheDocument())
    expect(onError).toHaveBeenCalled()
  })

  it('resizes on client and uploads PNG when PNG ≤1MB (lossless)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ key: 'portfolio/abc.png', url: '/api/images/portfolio/abc.png', size: 500_000, format: 'png' }),
    } as any)

    const onComplete = vi.fn()
    render(<ImageUploader onUploadComplete={onComplete} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const smallFile = makeFile('profile.png', 500_000, 'image/png')
    fireEvent.change(input, { target: { files: [smallFile] } })

    await waitFor(() => expect(mockResizeImage).toHaveBeenCalled())
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/admin/upload-image', expect.anything()))
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ format: 'png' })))
  })

  it('resizes and uploads WebP fallback when PNG >1MB to compress within 1MB', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ key: 'portfolio/photo.webp', url: '/api/images/portfolio/photo.webp', size: 350_000, format: 'webp' }),
    } as any)

    const onComplete = vi.fn()
    render(<ImageUploader onUploadComplete={onComplete} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const bigFile = makeFile('big.png', 2_000_000, 'image/png')
    // Our mock will return WebP for big file (>600KB)
    mockResizeImage.mockImplementationOnce(async () => ({
      blob: new Blob([new Uint8Array(350_000)], { type: 'image/webp' }),
      format: 'webp',
      width: 1200,
      height: 900,
      originalSize: 2_000_000,
      finalSize: 350_000,
      quality: 0.8,
    }))

    fireEvent.change(input, { target: { files: [bigFile] } })
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ format: 'webp', size: 350_000 })))
  })

  it('sends oldKey for replace-on-update to stay under 10GB free tier', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ key: 'portfolio/new.png', url: '/api/images/portfolio/new.png', size: 300_000, format: 'png' }),
    } as any)

    render(<ImageUploader oldKey="portfolio/old.png" onUploadComplete={vi.fn()} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = makeFile('new.png', 300_000, 'image/png')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    const fetchCall = mockFetch.mock.calls[0]
    const fetchOpts = fetchCall[1] as any
    const formData = fetchOpts.body as FormData
    expect(formData.get('oldKey')).toBe('portfolio/old.png')
  })

  it('handles upload error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'File too large >1MB' }),
    } as any)

    render(<ImageUploader onUploadComplete={vi.fn()} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = makeFile('big.png', 500_000, 'image/png')
    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(screen.getByText(/File too large/i)).toBeInTheDocument())
  })

  it('shows 100 images free tier note: 40MB per env, 80MB combined <1% of 10GB', async () => {
    render(<ImageUploader onUploadComplete={vi.fn()} />)
    expect(screen.getByText(/100 images.*40MB per env.*80-100MB.*<1% of 10GB/i)).toBeInTheDocument()
  })
})
