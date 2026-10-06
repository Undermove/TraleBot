// The verb catalog as the site sees it. Source: src/Trale/Verbs/verbs.json (forms — Wiktionary,
// sentences — Tatoeba, see scripts/verbs/SOURCES.md). This module only reads and derives:
// slugs, transcription, lookups. It never produces a Georgian form of its own.

import { readFileSync, existsSync } from 'node:fs'

/** Six main times in the order they are learnt; the rest are "rare". Mirrors miniapp-src/src/verbs/types.ts. */
export const MAIN_TENSES = ['present', 'aorist', 'imperfect', 'optative', 'conditional', 'future']
export const RARE_TENSES = ['presentSubjunctive', 'futureSubjunctive', 'perfect', 'pluperfect', 'perfectSubjunctive']
export const ALL_TENSES = [...MAIN_TENSES, ...RARE_TENSES]

/**
 * name — how a time is called on the page (by what it says); term — the textbook word, shown once
 * and secondarily (people do search for it). Same wording as the mini-app (TENSES in types.ts);
 * test/verbs.test.mjs keeps the two in sync.
 */
export const TENSES = {
  present: { name: 'Сейчас', term: 'настоящее время' },
  aorist: { name: 'Прошедшее: сделал', term: 'аорист' },
  imperfect: { name: 'Прошедшее: делал', term: 'имперфект' },
  optative: { name: 'Надо сделать', term: 'оптатив, или конъюнктив аориста' },
  conditional: { name: 'Сделал бы', term: 'условное наклонение' },
  future: { name: 'Будущее', term: 'будущее время' },
  presentSubjunctive: { name: 'Чтобы делал', term: 'конъюнктив настоящего' },
  futureSubjunctive: { name: 'Если бы сделал', term: 'конъюнктив будущего' },
  perfect: { name: 'Оказывается, сделал', term: 'перфект' },
  pluperfect: { name: 'Должен был сделать', term: 'плюсквамперфект' },
  perfectSubjunctive: { name: 'Пожелание, тост', term: 'конъюнктив перфекта' }
}

export const PERSONS = ['я', 'ты', 'он', 'мы', 'вы', 'они']

const CYR = {
  ა: 'а', ბ: 'б', გ: 'г', დ: 'д', ე: 'э', ვ: 'в', ზ: 'з', თ: 'т', ი: 'и', კ: 'к’', ლ: 'л',
  მ: 'м', ნ: 'н', ო: 'о', პ: 'п’', ჟ: 'ж', რ: 'р', ს: 'с', ტ: 'т’', უ: 'у', ფ: 'п', ქ: 'к',
  ღ: 'гх', ყ: 'къ', შ: 'ш', ჩ: 'ч', ც: 'ц', ძ: 'дз', წ: 'ц’', ჭ: 'ч’', ხ: 'х', ჯ: 'дж', ჰ: 'х'
}
export const CYR_TABLE = CYR
/** Cyrillic transcription of Georgian text — the same letter-by-letter rule as cyr() in the mini-app. */
export const cyr = (s) => [...String(s)].map((c) => CYR[c] ?? c).join('')

// ---- slugs ------------------------------------------------------------------------------------
// Rule: <first Russian gloss, transliterated>-<Georgian dictionary form, romanised>.
//   მიდის «идти, уходить» → idti-midis      სწერს «писать (кому-то)» → pisat-stsers
// The Georgian half keeps the slug unique when two verbs share a gloss (показывать: აჩვენებს /
// ანახებს); the Russian half makes the URL readable for the audience. Shipped slugs are frozen in
// data/verb-slugs.json: the lock wins over the rule, so a corrected translation never moves a URL.

const RU_LAT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
}
const KA_LAT = {
  ა: 'a', ბ: 'b', გ: 'g', დ: 'd', ე: 'e', ვ: 'v', ზ: 'z', თ: 't', ი: 'i', კ: 'k', ლ: 'l', მ: 'm', ნ: 'n', ო: 'o',
  პ: 'p', ჟ: 'zh', რ: 'r', ს: 's', ტ: 't', უ: 'u', ფ: 'p', ქ: 'k', ღ: 'gh', ყ: 'q', შ: 'sh', ჩ: 'ch', ც: 'ts',
  ძ: 'dz', წ: 'ts', ჭ: 'ch', ხ: 'kh', ჯ: 'j', ჰ: 'h'
}
const latin = (s, table) =>
  [...s.toLowerCase()].map((c) => table[c] ?? (/[a-z0-9]/.test(c) ? c : '-')).join('').replace(/-+/g, '-').replace(/^-|-$/g, '')

/** First gloss without the bracketed clarification: «идти, уходить» → «идти», «писать (кому-то)» → «писать». */
export const firstGloss = (ru) => ru.replace(/\(.*?\)/g, '').split(',')[0].trim()

export function slugRule(verb) {
  return `${latin(firstGloss(verb.ru), RU_LAT)}-${latin(verb.lemma, KA_LAT)}`
}

export function loadSlugLock(lockPath) {
  return existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, 'utf8')) : {}
}

/** Every form of a verb (main table + parallel tables), for lookups and the "form exists" test. */
export function allForms(verb) {
  const out = new Set()
  for (const table of [verb.tenses, ...verb.alt]) for (const rows of Object.values(table)) for (const cell of rows) for (const f of cell) out.add(f)
  return out
}

const sameTable = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/**
 * @returns verbs in catalog order (most frequent first), each with: slug, path, rank (1-based),
 * cyr (transcription of the dictionary form), alt without tables identical to the main one.
 */
export function loadVerbs(jsonPath, lockPath) {
  const { verbs } = JSON.parse(readFileSync(jsonPath, 'utf8'))
  const lock = loadSlugLock(lockPath)
  const seen = new Map()
  const out = verbs.map((v, i) => {
    const slug = lock[v.lemma] ?? slugRule(v)
    if (!/^[a-z0-9]+(-[a-z0-9]+)+$/.test(slug)) throw new Error(`verbs: bad slug "${slug}" for ${v.lemma}`)
    if (slug.length > 54) throw new Error(`verbs: slug "${slug}" is too long for the Telegram start tag`)
    if (seen.has(slug)) throw new Error(`verbs: slug "${slug}" is used by both ${seen.get(slug)} and ${v.lemma}`)
    seen.set(slug, v.lemma)
    return {
      ...v,
      slug,
      path: `/verbs/${slug}/`,
      rank: i + 1,
      cyr: cyr(v.lemma),
      gloss: firstGloss(v.ru),
      alt: v.alt.filter((t) => !sameTable(t, v.tenses))
    }
  })
  const byLemma = new Map(out.map((v) => [v.lemma, v]))
  return { verbs: out, byLemma }
}

/** Cell → «ვწერ / ვსწერ». */
export const cell = (variants) => (variants || []).join(' / ')
