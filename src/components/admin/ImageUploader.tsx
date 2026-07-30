import React, { useState, useRef } from 'react'
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
  const [info, setInfo] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setInfo(null)

    // Client validation: image only
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

      // Resize: PNG if ≤1MB else WebP within 1MB, max 1200px, 0 Worker CPU
      const resized = await resizeImage(file, MAX_DIMENSION, MAX_FILE_SIZE)

      console.log(
        `!!! IMAGE_UPLOADER_RESIZED orig=${resized.originalSize} final=${resized.finalSize} format=${resized.format} ${resized.width}x${resized.height} q=${resized.quality} dim=${resized.usedFallbackDimension}`
      )

      // Show preview from blob — mock fallback for jsdom
      try {
        if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
          const localPreview = URL.createObjectURL(resized.blob)
          setPreviewUrl(localPreview)
        }
      } catch {
        // ignore preview in test env
      }
      setInfo(`Resized ${resized.originalSize} → ${resized.finalSize} bytes, ${resized.width}×${resized.height}, format ${resized.format.toUpperCase()} ${resized.quality ? `q=${resized.quality}` : '(lossless)'} — 100 images avg 400KB =40MB per env, 80MB combined <1% of 10GB`)

      // Client size check again after resize (should be ≤1MB)
      if (resized.finalSize > MAX_FILE_SIZE) {
        const msg = `Resized file still >1MB (${resized.finalSize}) — cannot upload, stays in free tier`
        setError(msg)
        onError?.(msg)
        setUploading(false)
        return
      }

      // Upload to R2 via admin endpoint — auth via Zero Trust Google (passwordless), ADMIN_BYPASS for local
      const formData = new FormData()
      const filename = `resized.${resized.format}` // extension based on format
      formData.append('file', resized.blob, filename)
      if (oldKey) {
        formData.append('oldKey', oldKey)
      }

      console.log(`!!! IMAGE_UPLOADER_UPLOAD_START key=${oldKey || 'new'} format=${resized.format} size=${resized.finalSize}`)

      const response = await fetch('/api/admin/upload-image', {
        method: 'POST',
        body: formData,
        // No Content-Type header — browser sets multipart boundary
      })

      if (!response.ok) {
        const errJson = (await response.json().catch(() => ({ error: response.statusText }))) as any
        throw new Error(errJson?.error || `Upload failed ${response.status}`)
      }

      const result = (await response.json()) as any
      console.log(`!!! IMAGE_UPLOADER_UPLOAD_DONE key=${result.key} url=${result.url} size=${result.size}`)

      setPreviewUrl(result.url)
      setInfo(`Uploaded ${result.key} — ${result.size} bytes format ${result.format} — URL ${result.url}`)

      onUploadComplete(result)

      // Clear input for next upload
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="text-xs file:mr-3 file:px-4 file:py-2 file:rounded-full file:border-0 file:bg-slate-900 file:text-white file:text-xs hover:file:bg-black"
        />
        {uploading && <span className="text-[11px] text-gray-500 animate-pulse">Resizing + uploading… PNG if ≤1MB else WebP within 1MB, max 1200px</span>}
      </div>

      {previewUrl && (
        <div className="mt-1">
          <img src={previewUrl} alt="preview" className="w-32 h-32 object-cover rounded-xl border" />
          <div className="text-[10px] text-gray-500 mt-1 break-all">{previewUrl}</div>
        </div>
      )}

      {info && <div className="text-[11px] text-gray-600 bg-slate-50 p-2 rounded-lg border">{info}</div>}

      {error && <div className="text-[11px] text-red-700 bg-red-50 p-2 rounded-lg border border-red-200">{error}</div>}

      <div className="text-[10px] text-gray-400">
        Free tier safe: client resize PNG if ≤1MB (lossless) else WebP within 1MB, max 1200px — 0 Worker CPU. Server validates ≤1MB, oldKey delete-before-put stays under 10GB for 100 images (40MB per env, 80-100MB combined &lt;1% of 10GB). Env isolation: alpha bucket portfolio-images-alpha + prod portfolio-images share account quota but safe. Browser→Worker 100MB Free limit, Worker→R2 5 GiB single PUT, app 1MB well below, no nginx config.
      </div>
    </div>
  )
}
