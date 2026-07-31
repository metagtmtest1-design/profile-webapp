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
  ariaLabel?: string
}

export function EditableText({
  value,
  onSave,
  placeholder = 'Click to edit',
  required = false,
  multiline = false,
  className = '',
  displayClassName = '',
  inputClassName = '',
  ariaLabel,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedJustNow, setSavedJustNow] = useState(false)
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
    setSavedJustNow(false)
    setEditing(true)
    if (import.meta.env.DEV) console.log('!!! EDITABLE_TEXT_START_EDIT value=' + value.slice(0, 100))
  }

  const cancel = () => {
    setDraft(value)
    setError(null)
    setEditing(false)
    if (import.meta.env.DEV) console.log('!!! EDITABLE_TEXT_CANCEL')
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
      if (import.meta.env.DEV) console.log(`!!! EDITABLE_TEXT_SAVED from="${value}" to="${trimmed}"`)
      setEditing(false)
      setSavedJustNow(true)
      setTimeout(() => setSavedJustNow(false), 2000)
    } catch (e: any) {
      setError(e?.message || String(e))
      if (import.meta.env.DEV) console.log(`!!! EDITABLE_TEXT_SAVE_ERROR ${e?.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault()
      save()
    }
    if (e.key === 'Enter' && multiline && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      save()
    }
    if (e.key === 'Escape') {
      cancel()
    }
  }

  if (editing) {
    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {multiline ? (
          <textarea
            ref={inputRef as any}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={ariaLabel || placeholder}
            className={`px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 min-w-[200px] ${inputClassName}`}
            rows={3}
            disabled={saving}
          />
        ) : (
          <input
            ref={inputRef as any}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={ariaLabel || placeholder}
            className={`px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 min-w-[200px] ${inputClassName}`}
            disabled={saving}
          />
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            aria-label="Save"
            className="px-3 py-1.5 bg-slate-900 text-white rounded-full text-xs font-semibold hover:bg-black disabled:opacity-50 leading-none"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={cancel} disabled={saving} aria-label="Cancel" className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-semibold hover:border-slate-900 leading-none">
            Cancel
          </button>
          {multiline && <span className="text-[10px] text-gray-400">Ctrl+Enter to save, Esc to cancel</span>}
          {error && <span className="text-[11px] text-red-600 ml-2">{error}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className={`group flex items-start gap-2 ${className}`}>
      <button
        onClick={startEdit}
        aria-label={ariaLabel ? `Edit ${ariaLabel}` : `Edit ${placeholder}`}
        className={`text-left p-1 -m-1 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors flex items-start gap-2 ${displayClassName}`}
      >
        <span className={displayClassName}>{value || <span className="text-gray-400 italic">{placeholder}</span>}</span>
        <span className="text-[11px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" aria-hidden>
          ✎ Edit
        </span>
      </button>
      <div aria-live="polite" aria-atomic="true">
        {savedJustNow && <span className="text-[11px] text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full" role="status">Saved ✓</span>}
      </div>
    </div>
  )
}
