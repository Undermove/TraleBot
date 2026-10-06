// Lesson lexicons from src/Trale/Lessons/**/questions*.json: lesson_id → [{ ka, ru }].
// Entries come in three shapes ({lemma, ru} objects, "ka — ru" strings, bare Georgian strings);
// only the first two carry a translation, bare strings are skipped.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { splitPair } from './theory.mjs'

export function loadLexicons(lessonsDir) {
  const out = new Map()
  for (const mod of readdirSync(lessonsDir).sort()) {
    const dir = join(lessonsDir, mod)
    if (!statSync(dir).isDirectory()) continue
    for (const f of readdirSync(dir).sort()) {
      if (!/^questions\d*\.json$/.test(f)) continue
      const j = JSON.parse(readFileSync(join(dir, f), 'utf8'))
      const items = []
      for (const e of j.lexicon || []) {
        if (typeof e === 'string') { const p = splitPair(e); if (p.ka) items.push(p) }
        else if (e?.lemma && e?.ru) items.push({ ka: e.lemma, ru: e.ru })
      }
      if (j.lesson_id) out.set(j.lesson_id, items)
    }
  }
  return out
}
