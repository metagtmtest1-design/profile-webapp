import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * This project ships hand-written utility CSS instead of a Tailwind build step,
 * so a class name that is not defined in index.css silently does nothing —
 * that is how hover-only overlays ended up permanently visible in admin.
 * This test fails the build when a component uses a class nobody defined.
 */

const SRC_DIR = join(dirname(fileURLToPath(import.meta.url)))

function listTsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return listTsxFiles(full)
    if (full.endsWith('.tsx') && !full.includes('.test.')) return [full]
    return []
  })
}

function definedClasses(css: string): Set<string> {
  const found = new Set<string>()
  for (const match of css.matchAll(/\.((?:[-\w]|\\.)+)/g)) {
    found.add(match[1].replace(/\\/g, ''))
  }
  return found
}

type ClassNameValue = { kind: 'string' | 'expression'; text: string }

/** Pull the full className value, whether it is a quoted string or a {expression}. */
function classNameValues(source: string): ClassNameValue[] {
  const values: ClassNameValue[] = []
  for (const match of source.matchAll(/className=/g)) {
    let i = match.index! + match[0].length
    if (source[i] === '"') {
      const end = source.indexOf('"', i + 1)
      if (end > -1) values.push({ kind: 'string', text: source.slice(i + 1, end) })
    } else if (source[i] === '{') {
      let depth = 0
      const start = i
      for (; i < source.length; i++) {
        if (source[i] === '{') depth++
        else if (source[i] === '}' && --depth === 0) break
      }
      values.push({ kind: 'expression', text: source.slice(start + 1, i) })
    }
  }
  return values
}

function usedClasses({ kind, text }: ClassNameValue): string[] {
  if (kind === 'string') return text.split(/\s+/).filter(Boolean)

  // Inside an expression, class names live in string literals. Scan quoted and
  // backticked literals in separate passes: a single alternating regex lets an
  // outer template literal swallow the `'...'` branches of the ternaries inside
  // its own `${}` slots, which silently hid undefined classes.
  // Drop comparison operands (`status === 'confirmed' ? …`) — those are values, not classes.
  const scanned = text.replace(/[=!]==?\s*(['"])[^'"]*\1/g, ' ').replace(/(['"])[^'"]*\1\s*[=!]==?/g, ' ')
  const chunks = [
    ...[...scanned.matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2] ?? ''),
    ...[...scanned.matchAll(/`([^`]*)`/g)].map((m) => m[1] ?? ''),
  ]
  return chunks
    .flatMap((chunk) => chunk.replace(/\$\{[^}]*\}/g, ' ').split(/\s+/))
    .filter((token) => token && !token.includes('${'))
}

describe('CSS utility coverage', () => {
  const defined = definedClasses(readFileSync(join(SRC_DIR, 'index.css'), 'utf8'))

  it('defines every utility class used in components', () => {
    const missing = new Map<string, Set<string>>()

    for (const file of listTsxFiles(SRC_DIR)) {
      const source = readFileSync(file, 'utf8')
      for (const value of classNameValues(source)) {
        for (const token of usedClasses(value)) {
          if (defined.has(token)) continue
          if (!missing.has(token)) missing.set(token, new Set())
          missing.get(token)!.add(file.replace(SRC_DIR, 'src'))
        }
      }
    }

    const report = [...missing.entries()].map(([cls, files]) => `${cls} (${[...files].join(', ')})`)
    expect(report, `Undefined CSS classes — add them to src/index.css:\n${report.join('\n')}`).toEqual([])
  })
})
