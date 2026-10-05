#!/usr/bin/env node
// Контрольная сверка: 23 глагола, которые раньше были скачаны с живых страниц Викисловаря
// (fetch по HTML-таблицам, файл wiktionary-live-23.json), против того, что extract-kaikki.mjs
// достал из выгрузки. Сравнивается каждая ячейка основной таблицы и набор параллельных таблиц.
// Запуск: node scripts/verbs/compare-live.mjs   (код выхода 1, если есть необъяснённые расхождения)
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { TENSES } from './kaikki.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const live = JSON.parse(readFileSync(resolve(here, 'wiktionary-live-23.json'), 'utf8'))
const dump = new Map(JSON.parse(readFileSync(resolve(here, 'verbs.raw.json'), 'utf8')).verbs.map(v => [v.lemma, v]))
const serial = t => JSON.stringify(TENSES.map(k => t[k] ?? null))

// Расхождения, у которых есть объяснение (проверены глазами), — чтобы сверка оставалась строгой
// ко всему остальному. Ключ: «лемма: что именно».
const EXPLAINED = {}

let cells = 0, diffs = 0, extraAlt = 0
for (const v of live) {
  const d = dump.get(v.lemma)
  if (!d) { console.log(`✗ ${v.lemma}: в выгрузке нет`); diffs++; continue }
  const problems = []
  for (const k of TENSES) {
    if (!v.tenses[k] !== !d.tenses[k]) problems.push(`ряд ${k}: live ${v.tenses[k] ? 'есть' : 'нет'}, dump ${d.tenses[k] ? 'есть' : 'нет'}`)
    for (let p = 0; p < 6 && v.tenses[k] && d.tenses[k]; p++) {
      cells++
      const a = v.tenses[k][p].join('/'), b = d.tenses[k][p].join('/')
      if (a !== b) problems.push(`${k}[${p}]: live «${a}», dump «${b}»`)
    }
  }
  const liveAlt = (v.alt ?? []).map(serial), dumpAlt = d.alt.map(serial)
  for (const a of liveAlt) if (!dumpAlt.includes(a)) problems.push('параллельная таблица из live не найдена в dump')
  const added = dumpAlt.filter(a => !liveAlt.includes(a)).length
  extraAlt += added
  const real = problems.filter(p => !EXPLAINED[`${v.lemma}: ${p}`])
  diffs += real.length
  console.log(`${real.length ? '✗' : '✓'} ${v.lemma}: основная таблица ${Object.keys(v.tenses).length} рядов, alt live ${liveAlt.length} / dump ${dumpAlt.length}${added ? ` (+${added} новых)` : ''}`)
  for (const p of real) console.log(`    ${p}`)
}
console.log(`\nГлаголов: ${live.length}, сверено ячеек основной таблицы: ${cells}, расхождений: ${diffs}, добавленных параллельных таблиц: ${extraAlt}`)
process.exit(diffs ? 1 : 0)
