// Reads lesson theory straight from the mini-app's C# content provider (the repo's own
// source of truth for theory texts) — as DATA, at build time. Nothing is imported or executed:
// the file is scanned for `Lesson(n, "title", …)`, `List("ka — ru", …)`, `Example("ka", "ru")`
// and `Paragraph("…")` calls. The site never invents Georgian; it only republishes these strings.

import { readFileSync } from 'node:fs'

/** Reads one C# string literal starting at src[i] === '"' (or @"…"). Returns [value, nextIndex]. */
function readString(src, i) {
  let verbatim = false
  if (src[i] === '@') { verbatim = true; i++ }
  if (src[i] !== '"') throw new Error(`theory: expected string literal at ${i}`)
  i++
  let out = ''
  for (; i < src.length; i++) {
    const c = src[i]
    if (verbatim) {
      if (c === '"') { if (src[i + 1] === '"') { out += '"'; i++; continue } return [out, i + 1] }
      out += c
    } else if (c === '\\') {
      const n = src[++i]
      if (n === 'n') out += '\n'
      else if (n === 't') out += '\t'
      else if (n === 'u') { out += String.fromCharCode(parseInt(src.slice(i + 1, i + 5), 16)); i += 4 }
      else out += n
    } else if (c === '"') return [out, i + 1]
    else out += c
  }
  throw new Error('theory: unterminated string literal')
}

/** Collects the string arguments of a call whose "(" is at src[open]; nested calls are skipped. Returns [strings, indexAfterCall]. */
function readCallStrings(src, open) {
  const strings = []
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const c = src[i]
    if (c === '"' || (c === '@' && src[i + 1] === '"')) {
      const [s, next] = readString(src, i)
      // adjacent literals joined with + are one argument
      if (depth === 1) {
        const before = src.slice(0, i).trimEnd()
        if (before.endsWith('+') && strings.length) strings[strings.length - 1] += s
        else strings.push(s)
      }
      i = next - 1
    } else if (c === '(') depth++
    else if (c === ')') { depth--; if (depth === 0) return [strings, i + 1] }
  }
  throw new Error('theory: unbalanced call')
}

/** "ka — ru" → { ka, ru }. Items without a dash are kept as { text }. */
export function splitPair(item) {
  const m = item.match(/^(.*?)\s+[—–]\s+(.*)$/s)
  return m ? { ka: m[1].trim(), ru: m[2].trim() } : { text: item.trim() }
}

/**
 * @returns {Record<string, { id: string, title: string, lessons: { n: number, title: string, blocks: ({type:'list', items:{ka?:string,ru?:string,text?:string}[]}|{type:'example',ka:string,ru:string}|{type:'paragraph',text:string})[] }[] }>}
 */
export function loadTheory(csPath) {
  const src = readFileSync(csPath, 'utf8')
  const modules = {}
  const fnRe = /private static ModuleDto Build(\w+)Module\(\)/g
  const starts = [...src.matchAll(fnRe)].map((m) => m.index)
  const allStatics = [...src.matchAll(/\n    private static /g)].map((m) => m.index + 1)
  for (const start of starts) {
    const end = allStatics.find((x) => x > start) ?? src.length
    const body = src.slice(start, end)
    const id = body.match(/Id = "([^"]+)"/)?.[1]
    const title = body.match(/Title = "([^"]+)"/)?.[1]
    if (!id) continue
    const lessons = []
    const lessonRe = /\bLesson\(\s*(\d+)\s*,\s*"/g
    const marks = [...body.matchAll(lessonRe)]
    marks.forEach((m, k) => {
      const chunk = body.slice(m.index, k + 1 < marks.length ? marks[k + 1].index : body.length)
      const [ltitle] = readString(chunk, chunk.indexOf('"'))
      const blocks = []
      const callRe = /\b(List|Example|Paragraph)\(/g
      let c
      while ((c = callRe.exec(chunk))) {
        const [args, next] = readCallStrings(chunk, c.index + c[1].length)
        callRe.lastIndex = next
        if (c[1] === 'List') blocks.push({ type: 'list', items: args.map(splitPair) })
        else if (c[1] === 'Example' && args.length >= 2) blocks.push({ type: 'example', ka: args[0], ru: args[1] })
        else if (c[1] === 'Paragraph' && args.length) blocks.push({ type: 'paragraph', text: args[0] })
      }
      lessons.push({ n: Number(m[1]), title: ltitle, blocks })
    })
    modules[id] = { id, title: title || id, lessons }
  }
  return modules
}
