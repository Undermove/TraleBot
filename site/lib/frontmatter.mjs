// Minimal front-matter parser: a YAML *subset* that is enough for our pages
// (scalars, booleans, numbers, and inline lists like `related: [a, b]`).
// Kept dependency-free on purpose — content authors write simple key: value lines.

export function parseFrontmatter(raw) {
  const text = raw.replace(/^﻿/, '')
  if (!text.startsWith('---')) return { data: {}, body: text }
  const end = text.indexOf('\n---', 3)
  if (end === -1) throw new Error('Unterminated front matter (missing closing ---)')
  const header = text.slice(3, end).trim()
  const body = text.slice(end + 4).replace(/^\r?\n/, '')
  const data = {}
  for (const line of header.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const m = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/)
    if (!m) throw new Error(`Cannot parse front matter line: "${line}"`)
    data[m[1]] = parseValue(m[2].trim())
  }
  return { data, body }
}

function parseValue(v) {
  if (v === '') return ''
  if (v.startsWith('[') && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim()
    return inner ? inner.split(',').map((s) => unquote(s.trim())) : []
  }
  if (v === 'true') return true
  if (v === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  return unquote(v)
}

function unquote(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1)
  }
  return s
}
