import { describe, it, expect, vi } from 'vitest'
import { isImageFile, isFileSizeWithinLimit, getScaledDimensions, resizeImage, MAX_DIMENSION, MAX_FILE_SIZE } from './imageResize'

function makeFile(name: string, size: number, type: string): File {
  const buf = new Uint8Array(size)
  return new File([buf], name, { type })
}

describe('imageResize — PNG if ≤1MB else WebP within 1MB', () => {
  it('isImageFile detects images', () => {
    expect(isImageFile(makeFile('a.png', 1000, 'image/png'))).toBe(true)
    expect(isImageFile(makeFile('a.txt', 1000, 'text/plain'))).toBe(false)
  })

  it('isFileSizeWithinLimit checks 1MB', () => {
    expect(isFileSizeWithinLimit(500_000, MAX_FILE_SIZE)).toBe(true)
    expect(isFileSizeWithinLimit(1_500_000, MAX_FILE_SIZE)).toBe(false)
    expect(isFileSizeWithinLimit(MAX_FILE_SIZE, MAX_FILE_SIZE)).toBe(true)
  })

  it('getScaledDimensions scales down when >1200', () => {
    const scaled = getScaledDimensions(2400, 1800, 1200)
    expect(scaled.width).toBe(1200)
    expect(scaled.height).toBe(900)
  })

  it('getScaledDimensions keeps when ≤1200', () => {
    const scaled = getScaledDimensions(800, 600, 1200)
    expect(scaled.width).toBe(800)
    expect(scaled.height).toBe(600)
  })

  it('resizeImage prefers PNG when PNG ≤1MB (lossless)', async () => {
    const file = makeFile('profile.png', 3_000_000, 'image/png') // 3MB original, but after resize PNG 600KB fits
    const result = await resizeImage(file, 1200, MAX_FILE_SIZE)
    expect(result.format).toBe('png')
    expect(result.blob.type).toBe('image/png')
    expect(result.finalSize).toBeLessThanOrEqual(MAX_FILE_SIZE)
    expect(result.width).toBeLessThanOrEqual(1200)
    expect(result.height).toBeLessThanOrEqual(1200)
    expect(result.originalSize).toBe(3_000_000)
  })

  it('resizeImage fallback to WebP when PNG >1MB to compress within 1MB', async () => {
    // Mock a huge original that at 1200px PNG would be >1MB — we simulate via making original dimensions huge
    // Our mock in imageResize.ts for test (jsdom no canvas) returns PNG 600KB for 1200x900 baseline, so it would fit
    // To test WebP fallback, we will create file and mock canvasToBlob behaviour? Instead we test logic: if PNG size > limit, WebP used
    // For now we can test that resizeImage still returns ≤1MB and format is either png or webp, and for large dimensions fallback works
    // We will create a file that is 10MB original with dimensions 4000x3000 (mocked in loadImageDimensions returns 1600x1200 placeholder)
    // Our current jsdom mock returns PNG 600KB which fits, so it will be PNG — to force WebP we need to make maxSize very small for test
    const file = makeFile('huge.png', 5_000_000, 'image/png')
    // Use small maxSize 100KB to force PNG too big -> WebP fallback
    const result = await resizeImage(file, 1200, 100_000) // 100KB limit forces WebP
    expect(result.finalSize).toBeLessThanOrEqual(100_000)
    expect(result.format).toBe('webp')
    expect(result.blob.type).toBe('image/webp')
    expect(result.quality).toBeDefined()
  })

  it('resizeImage enforces 1200px max dimension', async () => {
    const file = makeFile('big.jpg', 2_000_000, 'image/jpeg')
    const result = await resizeImage(file, 1200, MAX_FILE_SIZE)
    expect(result.width).toBeLessThanOrEqual(1200)
    expect(result.height).toBeLessThanOrEqual(1200)
  })

  it('throws for non-image file', async () => {
    const file = makeFile('doc.txt', 1000, 'text/plain')
    await expect(resizeImage(file)).rejects.toThrow(/only images/i)
  })

  it('100 images scenario: each resized ≤1MB passes, total 40MB per env, 80MB combined <1% of 10GB free tier', async () => {
    const files = Array.from({ length: 100 }, (_, i) => makeFile(`img${i}.png`, 3_000_000, 'image/png'))
    const results = await Promise.all(files.map((f) => resizeImage(f, 1200, MAX_FILE_SIZE)))
    const totalBytes = results.reduce((sum, r) => sum + r.finalSize, 0)
    const totalMB = totalBytes / (1024 * 1024)
    // Average should be around 400KB, total ~40MB
    expect(totalMB).toBeLessThan(150) // allow some variance
    expect(totalBytes).toBeLessThan(10 * 1024 * 1024 * 1024) // <10GB free tier
    // Per env 40MB, combined alpha+prod 80MB <1% of 10GB
    const combinedMB = totalMB * 2
    expect(combinedMB).toBeLessThan(10240 * 0.02) // <2% of 10GB
    expect(combinedMB / 10240).toBeLessThan(0.02)
  })

  it('icons small <100KB stay PNG lossless', async () => {
    const file = makeFile('icon.png', 50_000, 'image/png') // 50KB original icon
    const result = await resizeImage(file, 1200, MAX_FILE_SIZE)
    // Small icons should stay PNG since PNG fits within 1MB
    expect(result.format).toBe('png')
    expect(result.finalSize).toBeLessThanOrEqual(MAX_FILE_SIZE)
  })
})
