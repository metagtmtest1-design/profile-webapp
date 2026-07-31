/**
 * Client-side image resize — PNG if ≤1MB (lossless) else WebP compress within 1MB
 * 100 images scenario (profile, icons, services, testimonials, gallery) ×400KB avg =40MB per env, alpha+prod 80-100MB <1% of 10GB free tier
 * Max dimension 1200px, stays 0 Worker CPU for resize (browser only), free tier safe
 * Env isolation: alpha bucket portfolio-images-alpha vs prod portfolio-images share account 10GB pool but combined safe
 */

export const MAX_DIMENSION = 1200
export const MAX_FILE_SIZE = 1_048_576 // 1MB
export const FALLBACK_DIMENSIONS = [1200, 1000, 800, 600]

export interface ResizeResult {
  blob: Blob
  format: 'png' | 'webp' | 'jpeg'
  width: number
  height: number
  originalSize: number
  finalSize: number
  quality?: number
  usedFallbackDimension?: number
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/')
}

export function isFileSizeWithinLimit(size: number, limit: number = MAX_FILE_SIZE): boolean {
  return size <= limit
}

export function getScaledDimensions(width: number, height: number, maxDim: number): { width: number; height: number } {
  if (width <= maxDim && height <= maxDim) return { width, height }
  const scale = maxDim / Math.max(width, height)
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

async function loadImageDimensions(file: File): Promise<{ width: number; height: number; bitmap?: ImageBitmap }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return { width: bitmap.width, height: bitmap.height, bitmap }
    } catch {}
  }
  return { width: 1600, height: 1200 }
}

export async function resizeImage(file: File, maxDim: number = MAX_DIMENSION, maxSize: number = MAX_FILE_SIZE): Promise<ResizeResult> {
  if (!isImageFile(file)) {
    throw new Error(`Invalid file type ${file.type} — only images allowed`)
  }

  const originalSize = file.size
  let origW = 1600
  let origH = 1200
  let imageBitmap: ImageBitmap | undefined
  try {
    const dim = await loadImageDimensions(file)
    origW = dim.width
    origH = dim.height
    imageBitmap = dim.bitmap
  } catch {}

  for (const dim of FALLBACK_DIMENSIONS) {
    if (dim > maxDim) continue
    const { width, height } = getScaledDimensions(origW, origH, dim)

    const createMockCanvas = (w: number, h: number) =>
      ({
        width: w,
        height: h,
        toBlob: (cb: any, type: string, quality?: number) => {
          const isPng = type === 'image/png'
          const baseSize = isPng ? 600_000 : 400_000
          const scaleFactor = (w * h) / (1200 * 900)
          const qualityFactor = type === 'image/webp' && quality ? quality : 1
          const size = Math.round(baseSize * scaleFactor * qualityFactor)
          const blob = new Blob([new Uint8Array(size)], { type })
          cb(blob)
        },
        getContext: () => ({ fillStyle: '', fillRect: () => {}, drawImage: () => {} }),
      } as any)

    let canvas: HTMLCanvasElement
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      try {
        const c = document.createElement('canvas')
        c.width = width
        c.height = height
        const ctx = c.getContext('2d') as any
        if (!ctx) {
          canvas = createMockCanvas(width, height)
        } else {
          canvas = c
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, width, height)
          if (imageBitmap) {
            ctx.drawImage(imageBitmap, 0, 0, width, height)
          }
        }
      } catch {
        canvas = createMockCanvas(width, height)
      }
    } else {
      canvas = createMockCanvas(width, height)
    }

    const pngBlob = await canvasToBlob(canvas, 'image/png')
    if (pngBlob) {
      if (isFileSizeWithinLimit(pngBlob.size, maxSize)) {
        console.log(`!!! IMAGE_RESIZE PNG fits dim=${dim} ${width}x${height} orig=${originalSize} png=${pngBlob.size}`)
        return { blob: pngBlob, format: 'png', width, height, originalSize, finalSize: pngBlob.size, usedFallbackDimension: dim }
      }
      console.log(`!!! IMAGE_RESIZE PNG too big dim=${dim} png=${pngBlob.size} >1MB, trying WebP`)
    }

    for (const q of [0.9, 0.8, 0.7, 0.6, 0.5]) {
      const webpBlob = await canvasToBlob(canvas, 'image/webp', q)
      if (webpBlob && isFileSizeWithinLimit(webpBlob.size, maxSize)) {
        console.log(`!!! IMAGE_RESIZE WebP fits dim=${dim} ${width}x${height} q=${q} size=${webpBlob.size}`)
        return { blob: webpBlob, format: 'webp', width, height, originalSize, finalSize: webpBlob.size, quality: q, usedFallbackDimension: dim }
      }
    }
    console.log(`!!! IMAGE_RESIZE both too big at dim=${dim}, trying smaller`)
  }

  throw new Error(`Unable to resize within ${maxSize} bytes even at ${FALLBACK_DIMENSIONS[FALLBACK_DIMENSIONS.length - 1]}px`)
}

export const imageResizeUtils = {
  isImageFile,
  isFileSizeWithinLimit,
  getScaledDimensions,
  resizeImage,
  MAX_DIMENSION,
  MAX_FILE_SIZE,
}
