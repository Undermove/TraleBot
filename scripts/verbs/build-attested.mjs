#!/usr/bin/env node
// Набор грузинских словоформ, которые встретились в настоящих текстах, — для проверки форм, которые
// модель составила сама (глаголы без таблицы в Викисловаре): форма, найденная в корпусе, — довод в её
// пользу; парадигма, из которой в текстах не встретилось ничего, подозрительна.
// Сами корпуса в git не кладутся: из них остаётся только фильтр Блума (ответ «встречалась / нет»,
// слова из него не восстановить) → src/Trale/Verbs/attested.bloom.
//
//   node scripts/verbs/build-attested.mjs --tatoeba kat_pairs.json <…-words.txt> [<…-words.txt> …]
//
// Списки словоформ — Leipzig Corpora (`*-words.txt`: номер, слово, частота), те же три корпуса, что в
// collect-evidence.mjs. Берутся слова из одних грузинских букв с суммарной частотой не ниже MIN_COUNT
// (единичные вхождения — в основном опечатки) и все слова из предложений Tatoeba.
// Формат файла: "TBF1", число бит (uint32 LE), число хешей (1 байт), биты. Хеши — два FNV-1a по UTF-8
// (см. AttestedForms.cs — там то же самое). Сборка детерминирована.
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const outFile = resolve(here, '../../src/Trale/Verbs/attested.bloom')
const args = process.argv.slice(2)
const tatoeba = args.includes('--tatoeba') ? args[args.indexOf('--tatoeba') + 1] : null
const lists = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--tatoeba')
if (!lists.length || lists.some(f => !existsSync(f))) {
  console.error('Нужны списки словоформ Leipzig (*-words.txt). Где скачать — SOURCES.md.')
  process.exit(2)
}

const GEO = /^[ა-ჰ]+$/
const MIN_COUNT = 2
const BITS_PER_WORD = 10, HASHES = 7   // ≈ 1 % ложных «встречалась»

const counts = new Map()
for (const file of lists) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const [, word, count] = line.split('\t')
    if (word && GEO.test(word)) counts.set(word, (counts.get(word) ?? 0) + Number(count))
  }
}
const words = new Set([...counts].filter(([, n]) => n >= MIN_COUNT).map(([w]) => w))
if (tatoeba) for (const s of JSON.parse(readFileSync(tatoeba, 'utf8'))) for (const w of s.ka.match(/[ა-ჰ]+/g) ?? []) words.add(w)

function fnv(bytes, basis) {
  let h = basis
  for (const b of bytes) { h ^= b; h = Math.imul(h, 0x01000193) }
  return h >>> 0
}
const bits = Math.ceil(words.size * BITS_PER_WORD / 8) * 8
const filter = Buffer.alloc(bits / 8)
const encoder = new TextEncoder()
for (const word of words) {
  const bytes = encoder.encode(word)
  const h1 = fnv(bytes, 0x811c9dc5), h2 = fnv(bytes, 0x01000193) | 1
  for (let i = 0; i < HASHES; i++) {
    const bit = (h1 + Math.imul(i, h2) >>> 0) % bits
    filter[bit >> 3] |= 1 << (bit & 7)
  }
}
const header = Buffer.alloc(9)
header.write('TBF1', 0, 'ascii'); header.writeUInt32LE(bits, 4); header.writeUInt8(HASHES, 8)
writeFileSync(outFile, Buffer.concat([header, filter]))
console.error(`Встречавшихся словоформ: ${words.size} (из ${counts.size} в корпусах, порог ${MIN_COUNT}) → ${outFile}, ${header.length + filter.length} байт`)
