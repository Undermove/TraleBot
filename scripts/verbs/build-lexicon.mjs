#!/usr/bin/env node
// Лексикон для самопроверки модели: все грузинские глаголы английского Викисловаря — и те, у которых
// нет таблицы спряжения (их нет в каталоге), — с английскими толкованиями, масдаром и, где это есть
// в русском Викисловаре, русскими переводами. Сервер загружает файл при старте (VerbLexicon) и по нему
// проверяет, что предложенная моделью лемма — настоящий глагол, и что её перевод сходится с источником.
//
//   node scripts/verbs/build-lexicon.mjs <en-dump.jsonl> [--ru-ka <ruwikt-georgian.jsonl>] [--ru <ru-ka-translations.jsonl>]
//
//   en-dump   выгрузка Wiktextract английского Викисловаря, грузинский (та же, что для extract-kaikki.mjs)
//   --ru-ka   выгрузка русского Викисловаря, грузинские статьи (слово → русские толкования)
//   --ru      переводы на грузинский из русских статей русского Викисловаря (отфильтрованные строки
//             { word, pos, ka: [{ word }] }; как получить — SOURCES.md)
// Источники и лицензии — SOURCES.md. Сборка детерминирована: одинаковый вход — одинаковый файл.
import { createHash } from 'crypto'
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'fs'
import { basename, dirname, resolve } from 'path'
import { createInterface } from 'readline'
import { fileURLToPath } from 'url'
import { glossesOf, headMasdar, tablesOf } from './kaikki.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outFile = resolve(here, '../../src/Trale/Verbs/lexicon.json')
const args = process.argv.slice(2)
const option = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null)
const dumpPath = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'))
if (!dumpPath || !existsSync(dumpPath)) {
  console.error('Нужен путь к выгрузке английского Викисловаря (см. SOURCES.md).')
  process.exit(2)
}

const GEO = /^[ა-ჰ]+$/
const RU_VERB = /^[а-яё]+(ть|ти|чь)(ся|сь)?$/
const MAX_GLOSSES = 4, MAX_GLOSS_LENGTH = 90
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const lines = path => createInterface({ input: createReadStream(path), crlfDelay: Infinity })
const uniq = list => [...new Set(list)]
// «говорить, сказать; сообщать» → отдельные инфинитивы; пояснения в скобках и не-глаголы отбрасываются.
const ruVerbs = text => text.toLowerCase().replace(/ё/g, 'е').replace(/\([^)]*\)/g, '').split(/[,;]/)
  .map(s => s.trim()).filter(s => RU_VERB.test(s))

// ── английский Викисловарь: глагольные статьи с собственным толкованием ──────────────────────────
const verbs = new Map()   // лемма → { vn, en, table, ru:Set }
for await (const line of lines(dumpPath)) {
  const e = JSON.parse(line)
  if (e.pos !== 'verb' || !GEO.test(e.word)) continue
  const en = glossesOf(e).map(g => g.gloss.trim()).filter(Boolean)
  if (!en.length) continue   // «форма слова X» — не словарная статья
  const prev = verbs.get(e.word) ?? { vn: null, en: [], table: false, ru: new Set() }
  prev.vn ??= headMasdar(e)
  prev.en.push(...en)
  prev.table ||= tablesOf(e).length > 0
  verbs.set(e.word, prev)
}
const byMasdar = new Map()
for (const [lemma, v] of verbs) if (v.vn) byMasdar.set(v.vn, [...(byMasdar.get(v.vn) ?? []), lemma])
// Русский перевод привязывается к лемме, если статья названа самой леммой или её масдаром.
const lemmasOf = word => (verbs.has(word) ? [word] : byMasdar.get(word) ?? [])

// ── русский Викисловарь, грузинские статьи: слово → русские толкования ───────────────────────────
const ruKaPath = option('--ru-ka'), ruPath = option('--ru')
if (ruKaPath) {
  for await (const line of lines(ruKaPath)) {
    const e = JSON.parse(line)
    if (e.pos !== 'verb') continue
    const ru = (e.senses ?? []).flatMap(s => (s.glosses ?? []).flatMap(ruVerbs))
    for (const lemma of lemmasOf(e.word)) ru.forEach(r => verbs.get(lemma).ru.add(r))
  }
}
// ── русский Викисловарь, русские статьи: блок переводов «Грузинский: …» ──────────────────────────
if (ruPath) {
  for await (const line of lines(ruPath)) {
    const e = JSON.parse(line)
    if (e.pos !== 'verb' || !RU_VERB.test((e.word ?? '').toLowerCase().replace(/ё/g, 'е'))) continue
    const ru = e.word.toLowerCase().replace(/ё/g, 'е')
    for (const t of e.ka ?? []) for (const lemma of lemmasOf((t.word ?? '').trim())) verbs.get(lemma).ru.add(ru)
  }
}

const rows = [...verbs.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([lemma, v]) => [
  lemma,
  v.vn,
  v.table ? 1 : 0,
  uniq(v.en).slice(0, MAX_GLOSSES).map(g => (g.length > MAX_GLOSS_LENGTH ? g.slice(0, MAX_GLOSS_LENGTH - 1) + '…' : g)),
  [...v.ru].sort()
])
const sources = {
  en: { file: basename(dumpPath), sha256: sha256(dumpPath) },
  ...(ruKaPath ? { ruKa: { file: basename(ruKaPath), sha256: sha256(ruKaPath) } } : {}),
  ...(ruPath ? { ru: { file: basename(ruPath), sha256: sha256(ruPath) } } : {})
}
// Строка на глагол: [лемма, масдар|null, есть ли таблица спряжения, английские толкования, русские переводы].
const body = rows.map(r => ' ' + JSON.stringify(r)).join(',\n')
writeFileSync(outFile, `{"sources": ${JSON.stringify(sources)},\n"verbs": [\n${body}\n]}\n`)
console.error(`Лексикон: ${rows.length} глаголов, с таблицей ${rows.filter(r => r[2]).length}, с масдаром ${rows.filter(r => r[1]).length}, ` +
  `с русским переводом ${rows.filter(r => r[4].length).length} → ${outFile}`)
