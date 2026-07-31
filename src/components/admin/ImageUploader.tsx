import React, { useState, useRef, useEffect } from 'react'
import { resizeImage, isImageFile, MAX_FILE_SIZE, MAX_DIMENSION } from '../../lib/imageResize'

export interface ImageUploaderProps {
  currentImageUrl?: string
  oldKey?: string // portfolio/old.png to delete before put new (replace-on-update to stay under 10GB free tier)
  onUploadComplete: (result: { url: string; key: string; size: number; format: string }) => void
  onError?: (error: string) => void
}

export function ImageUploader({ currentImageUrl, oldKey, onUploadComplete, onError }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null)
  const [lastResult, setLastResult] = useState<{ size: number; format: string; width: number; height: number; quality?: number; originalSize: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  // Keep preview in sync when currentImageUrl prop changes after upload refetch — fixes stale thumb
  useEffect(() => {
    setPreviewUrl(currentImageUrl || null)
  }, [currentImageUrl])

  // Revoke object URLs to avoid memory leak — H1
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        try { URL.revokeObjectURL(previewUrl) } catch {}
      }
    }
  }, [previewUrl])

  const processFile = async (file: File) => {
    setError(null)

    if (!isImageFile(file)) {
      const msg = `Invalid file type ${file.type} — only images allowed`
      setError(msg)
      onError?.(msg)
      console.log(`!!! IMAGE_UPLOADER_INVALID_TYPE type=${file.type}`)
      return
    }

    try {
      setUploading(true)
      console.log(`!!! IMAGE_UPLOADER_START name=${file.name} size=${file.size} type=${file.type}`)

      const resized = await resizeImage(file, MAX_DIMENSION, MAX_FILE_SIZE)

      console.log(`!!! IMAGE_UPLOADER_RESIZED orig=${resized.originalSize} final=${resized.finalSize} format=${resized.format} ${resized.width}x${resized.height} q=${resized.quality}`)

      // Preview — revoke previous blob URL to avoid leak
      try {
        if (previewUrl && previewUrl.startsWith('blob:')) {
          try { URL.revokeObjectURL(previewUrl) } catch {}
        }
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          const localPreview = URL.createObjectURL(resized.blob)
          setPreviewUrl(localPreview)
        }
      } catch {
        // ignore in test env
      }

      setLastResult({
        size: resized.finalSize,
        format: resized.format,
        width: resized.width,
        height: resized.height,
        quality: resized.quality,
        originalSize: resized.originalSize,
      })

      if (resized.finalSize > MAX_FILE_SIZE) {
        const msg = `Resized still >1MB (${resized.finalSize})`
        setError(msg)
        onError?.(msg)
        return
      }

      const formData = new FormData()
      formData.append('file', resized.blob, `resized.${resized.format}`)
      if (oldKey) formData.append('oldKey', oldKey)

      console.log(`!!! IMAGE_UPLOADER_UPLOAD_START key=${oldKey || 'new'} format=${resized.format} size=${resized.finalSize}`)

      const response = await fetch('/api/admin/upload-image', { method: 'POST', body: formData, credentials: 'same-origin' })

      if (!response.ok) {
        const errJson = (await response.json().catch(() => ({ error: response.statusText }))) as any
        throw new Error(errJson?.error || `Upload failed ${response.status}`)
      }

      const result = (await response.json()) as any
      console.log(`!!! IMAGE_UPLOADER_UPLOAD_DONE key=${result.key} url=${result.url}`)

      setPreviewUrl(result.url)
      setLastResult({ size: result.size, format: result.format, width: resized.width, height: resized.height, quality: resized.quality, originalSize: resized.originalSize })

      onUploadComplete(result)
      if (inputRef.current) inputRef.current.value = ''
    } catch (err: any) {
      const msg = err?.message || String(err)
      setError(msg)
      onError?.(msg)
      console.log(`!!! IMAGE_UPLOADER_ERROR ${msg}`)
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await processFile(file)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) await processFile(file)
  }

  // Determine display URL — prefer previewUrl (uploaded) else current
  const displayUrl = previewUrl || currentImageUrl || null
  const sizeBadge = lastResult
    ? `${lastResult.format.toUpperCase()} ${Math.round(lastResult.size / 1024)}KB ${lastResult.width}×${lastResult.height}${lastResult.quality ? ` q=${lastResult.quality}` : ' lossless'} — ${lastResult.originalSize}→${lastResult.size}`
    : null

  return (
    <div className="flex flex-col gap-2">
      {/* Compact dashed dropzone — single thumb, not duplicate */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`group border-2 border-dashed rounded-xl p-3 flex gap-3 items-center cursor-pointer transition-colors ${dragOver ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-900 hover:bg-slate-50'} ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
        aria-label="Upload image dropzone — PNG if ≤1MB else WebP within 1MB, max 1200px"
      >
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} className="hidden" aria-hidden />
        {displayUrl ? (
          <img src={displayUrl} alt="current" className="w-20 h-20 object-cover rounded-lg border shrink-0" loading="lazy" />
        ) : (
          <div className="w-20 h-20 rounded-lg border border-dashed bg-slate-50 flex items-center justify-center text-[11px] text-gray-400 shrink-0">No image</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold flex items-center gap-2">
            {uploading ? 'Resizing + uploading…' : currentImageUrl ? 'Replace image' : 'Select image to upload'}
            {uploading && <span className="w-3 h-3 border-2 border-gray-300 border-t-slate-900 rounded-full animate-spin" />}
          </div>
          <div className="text-[11px] text-gray-500 mt-0.5">
            {sizeBadge || 'PNG if ≤1MB else WebP within 1MB — max 1200px — 1MB max'}
          </div>
          {currentImageUrl && <div className="text-[10px] text-gray-400 truncate mt-0.5" title={currentImageUrl}>Current image: {currentImageUrl.split('/').pop()?.slice(0,30)}</div>}
          {!currentImageUrl && <div className="text-[10px] text-gray-400">100 images ×400KB avg=40MB/env, 80MB combined &lt;1% of 10GB</div>}
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }} className="ml-2 px-3 py-1.5 bg-slate-900 text-white rounded-full text-[11px] font-semibold hover:bg-black shrink-0 min-h-8 min-w-8" aria-label={currentImageUrl ? 'Replace image button' : 'Select image button'}>
          {currentImageUrl ? 'Select new' : 'Select image'}
        </button>
      </div>

      {error && <div className="text-[11px] text-red-700 bg-red-50 p-2 rounded-lg border border-red-200" role="alert">{error}</div>}

      <details className="text-[10px] text-gray-400">
        <summary className="cursor-pointer hover:text-gray-600">Free tier info — why PNG→WebP + replace</summary>
        <div className="mt-1 p-2 bg-slate-50 rounded-lg border text-[11px] leading-relaxed">
          Client resize PNG if ≤1MB (lossless) else WebP within 1MB, max 1200px — 0 Worker CPU. Server validates ≤1MB. oldKey delete-before-put stays under 10GB for 100 images (40MB per env, 80-100MB combined &lt;1% of 10GB). Env isolation alpha bucket portfolio-images-alpha + prod portfolio-images share account quota safe. Browser→Worker 100MB Free limit, Worker→R2 5 GiB single PUT, app 1MB well below, no nginx config.
        </div>
      </details>
    </div>
  )
}
