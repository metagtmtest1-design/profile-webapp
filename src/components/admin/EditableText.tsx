import React, { useState, useEffect, useRef } from 'react'

export interface EditableTextProps {
  value: string
  onSave: (newValue: string) => Promise<void> | void
  placeholder?: string
  required?: boolean
  multiline?: boolean
  className?: string
  displayClassName?: string
  inputClassName?: string
}

export function EditableText({ value, onSave, placeholder = 'Click to edit', required = false, multiline = false, className = '', displayClassName = '', inputClassName = '' }: EditableTextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const startEdit = () => {
    setDraft(value)
    setError(null)
    setEditing(true)
  }

  const cancel = () => {
    setDraft(value)
    setError(null)
    setEditing(false)
  }

  const save = async () => {
    const trimmed = draft.trim()
    if (required && !trimmed) {
      setError('Value required')
      return
    }
    if (trimmed === value.trim()) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(trimmed)
      console.log(`!!! EDITABLE_TEXT_SAVED from="${value}" to="${trimmed}"`)
      setEditing(false)
    } catch (e: any) {
      setError(e?.message || String(e))
      console.log(`!!! EDITABLE_TEXT_SAVE_ERROR ${e?.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      save()
    }
    if (e.key === 'Escape') {
      cancel()
    }
  }

  if (editing) {
    return (
      <div className={`inline-flex flex-col gap-1 ${className}`}>
        {multiline ? (
          <textarea
            ref={inputRef as any}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 min-w-[200px] ${inputClassName}`}
            rows={3}
            disabled={saving}
          />
        ) : (
          <input
            ref={inputRef as any}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 min-w-[200px] ${inputClassName}`}
            disabled={saving}
          />
        )}
        {saving && <span className="text-[11px] text-gray-500">Saving…</span>}
        {error && <span className="text-[11px] text-red-600">{error}</span>}
      </div>
    )
  }

  return (
    <div className={`group inline-flex items-center gap-2 cursor-pointer ${className}`} onDoubleClick={startEdit} onClick={startEdit}>
      <span className={`text-sm ${displayClassName}`}>{value || <span className="text-gray-400 italic">{placeholder}</span>}</span>
      <span className="opacity-0 group-hover:opacity-100 text-[11px] text-gray-400 transition-opacity">✎ edit</span>
    </div>
  )
}
