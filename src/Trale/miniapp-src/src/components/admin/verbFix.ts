import { TENSES, type TenseKey } from '../../verbs/types'

// «Исправление одним текстом»: владелец получает его готовым (например, от Claude), копирует и
// вставляет на экране глагола — вместо того чтобы набирать формы по клетке. Пример:
//
//   глагол: ეკითხება
//   будущее: ვკითხავ ჰკითხავ ჰკითხავს ვკითხავთ ჰკითხავთ ჰკითხავენ
//   прошедшее: сделал: ვკითხე ჰკითხე ჰკითხა ვკითხეთ ჰკითხეთ ჰკითხეს
//   подтвердить: сейчас, прошедшее: делал
//   глагол проверен
//
// Время называется так же, как на экране («Будущее», «Прошедшее: сделал»), или ключом (future, aorist).
// Шесть форм — я, ты, он, мы, вы, они; «—» — клетка пустая.

export interface VerbFix {
  /** Глагол, для которого исправление написано; null — не указан. */
  lemma: string | null
  edits: { tense: TenseKey; cells: (string | null)[] }[]
  confirm: TenseKey[]
  approve: boolean
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()

const TENSE_BY_NAME = new Map<string, TenseKey>(
  (Object.keys(TENSES) as TenseKey[]).flatMap(k => [[norm(TENSES[k].name), k], [k.toLowerCase(), k]] as [string, TenseKey][]))

const GEORGIAN_WORD = /^[ა-ჰ]+$/
const EMPTY = new Set(['—', '-', '–'])

function tenseOf(name: string): TenseKey | null {
  return TENSE_BY_NAME.get(norm(name)) ?? null
}

/** Разбирает текст исправления; при ошибке — понятная фраза, что не так и в какой строке. */
export function parseVerbFix(text: string): { fix: VerbFix } | { error: string } {
  const fix: VerbFix = { lemma: null, edits: [], confirm: [], approve: false }
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  for (const line of lines) {
    const head = norm(line)
    if (head === 'глагол проверен' || head === 'approve') { fix.approve = true; continue }
    const first = line.indexOf(':')
    const key = first < 0 ? '' : norm(line.slice(0, first))
    if (key === 'глагол' || key === 'verb') {
      const lemma = line.slice(first + 1).trim()
      if (!GEORGIAN_WORD.test(lemma)) return { error: `глагол — одно слово грузинскими буквами: «${line}»` }
      fix.lemma = lemma
      continue
    }
    if (key === 'подтвердить' || key === 'confirm') {
      for (const name of line.slice(first + 1).split(',').map(s => s.trim()).filter(Boolean)) {
        const tense = tenseOf(name)
        if (!tense) return { error: `нет такого времени: «${name}»` }
        if (!fix.confirm.includes(tense)) fix.confirm.push(tense)
      }
      continue
    }
    // Название времени само бывает с двоеточием («Прошедшее: сделал»), поэтому формы — после последнего.
    const at = line.lastIndexOf(':')
    if (at < 0) return { error: `не понял строку «${line}»` }
    const rest = line.slice(at + 1).trim()
    const tense = tenseOf(line.slice(0, at))
    if (!tense) return { error: `нет такого времени: «${line.slice(0, at).trim()}»` }
    const words = rest.split(/[\s,;]+/).filter(Boolean)
    if (words.length !== 6) return { error: `${TENSES[tense].name}: нужно шесть форм (я, ты, он, мы, вы, они), а их ${words.length}` }
    const bad = words.find(w => !EMPTY.has(w) && !GEORGIAN_WORD.test(w))
    if (bad) return { error: `${TENSES[tense].name}: «${bad}» — не слово грузинскими буквами` }
    if (fix.edits.some(e => e.tense === tense)) return { error: `${TENSES[tense].name} встречается дважды` }
    fix.edits.push({ tense, cells: words.map(w => (EMPTY.has(w) ? null : w)) })
  }
  if (!fix.edits.length && !fix.confirm.length && !fix.approve) return { error: 'в тексте нет ни одного исправления' }
  const both = fix.confirm.find(t => fix.edits.some(e => e.tense === t))
  if (both) return { error: `${TENSES[both].name}: и исправить, и подтвердить как есть — выбери одно` }
  return { fix }
}
