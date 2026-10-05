#!/usr/bin/env node
// Шаг 2. Считает, насколько каждый глагол из verbs.raw.json употребителен, и отбирает живые
// предложения с его формами. Пишет frequency.json и sentences.raw.json. Сети не требует; внешние
// файлы нужны только этому шагу, сборке каталога (шаг 3) хватает того, что лежит в git.
//
//   node scripts/verbs/collect-evidence.mjs --tatoeba <kat_pairs.json> \
//        --web <…-words.txt> --news <…-words.txt> --wiki <…-words.txt> [--subs <ka_50k.txt>]
//   (где взять файлы — SOURCES.md; любой источник можно не давать, тогда его прежние числа
//    остаются как были в frequency.json)
//
// Что считаем. Леммной частотности грузинского в открытом доступе нет, поэтому частота глагола —
// это сумма частот его словоформ (основная таблица + параллельные) в списках словоформ:
//   web   — Leipzig Corpora, kat-ge_web_2019 (сайты .ge, общий язык)                 CC BY 4.0
//   news  — Leipzig Corpora, kat_newscrawl_2016 (новости)                            CC BY 4.0
//   wiki  — Leipzig Corpora, kat_wikipedia_2021                                      CC BY 4.0
//   subs  — FrequencyWords/OpenSubtitles «ka» (см. оговорку в SOURCES.md: список засорён)
//   tatoeba — в скольких грузинских предложениях Tatoeba есть форма глагола          CC BY 2.0 FR
//   lessons — сколько раз формы глагола встречаются в наших уроках (src/Trale/Lessons)
// Форма, общая для нескольких глаголов (перфект у версионных пар), делится между ними поровну.
// Форма, совпадающая с не-глаголом или его падежной формой (homographs и homographForms
// в verbs.raw.json), не считается.
// Как из этих чисел получается место в каталоге — в build-catalog.mjs (score()).
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs'
import { dirname, resolve, join } from 'path'
import { fileURLToPath } from 'url'
import { formatJson } from './format.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const arg = name => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : null }
const raw = JSON.parse(readFileSync(resolve(here, 'verbs.raw.json'), 'utf8')).verbs
const freqFile = resolve(here, 'frequency.json')
const previous = existsSync(freqFile) ? JSON.parse(readFileSync(freqFile, 'utf8')).verbs : {}
const wordsOf = text => text.match(/[ა-ჰ]+/g) ?? []

// форма → глаголы, которым она принадлежит: counted — для частотности, sentenceForms — для предложений
const owners = new Map()
const sentenceForms = new Set()
for (const v of raw) {
  const words = new Set(v.homographs), caseForms = new Set(v.homographForms)
  for (const form of new Set([v.tenses, ...v.alt].flatMap(t => Object.values(t).flat(2)))) {
    if (words.has(form)) continue
    sentenceForms.add(form)
    if (caseForms.has(form)) continue
    if (!owners.has(form)) owners.set(form, [])
    owners.get(form).push(v.lemma)
  }
}
const totals = {}   // источник → лемма → число
const credit = (source, form, n) => {
  const list = owners.get(form)
  if (!list) return
  const t = (totals[source] ??= {})
  for (const lemma of list) t[lemma] = (t[lemma] ?? 0) + n / list.length
}

// Списки словоформ: «слово число» (FrequencyWords) или «id<TAB>слово<TAB>число» (Leipzig).
for (const source of ['web', 'news', 'wiki', 'subs']) {
  const file = arg(source)
  if (!file) continue
  totals[source] = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const cols = line.includes('\t') ? line.split('\t').slice(1) : line.split(' ')
    const [word, count] = cols
    if (owners.has(word) && Number.isFinite(Number(count))) credit(source, word, Number(count))
  }
}

// Наши уроки: любое грузинское слово в любом JSON урока.
const lessonsDir = resolve(here, '../../src/Trale/Lessons')
const walk = dir => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') ? [p] : [] })
totals.lessons = {}
for (const file of walk(lessonsDir).sort()) for (const w of wordsOf(readFileSync(file, 'utf8'))) credit('lessons', w, 1)

// Tatoeba: частота + предложения для упражнений.
// Отбор предложений — прежний (2–6 грузинских слов, есть русский перевод, есть форма из базы) плюс
// дешёвые проверки от типичного мусора корпуса:
//   • в грузинской стороне нет латиницы/кириллицы, в русской есть кириллица и нет грузинского —
//     иначе пара перепутана по языку или не переведена;
//   • вопрос ↔ вопрос: «?» в конце есть либо у обеих сторон, либо ни у одной — частый признак
//     того, что перевод привязан не к тому предложению;
//   • числа цифрами совпадают, если есть с обеих сторон;
//   • русская сторона не длиннее грузинской больше чем втрое (+3 слова) — отсекает пересказы;
//   • дубли по грузинскому тексту (без регистра знаков и пробелов) — остаётся меньший id.
// Ручной список исключений sentences.skip.json применяется при сборке каталога, не здесь.
const tatoeba = arg('tatoeba')
if (tatoeba) {
  const pairs = JSON.parse(readFileSync(tatoeba, 'utf8')).sort((a, b) => a.id - b.id)
  totals.tatoeba = {}
  const out = [], seenText = new Set()
  const dropped = { язык: 0, вопрос: 0, числа: 0, длина: 0, дубль: 0 }
  const digits = s => (s.match(/\d+/g) ?? []).sort().join(',')
  const isQuestion = s => /[?？]\s*["»“”'’)]*\s*$/.test(s.trim())
  for (const s of pairs) {
    const words = wordsOf(s.ka)
    const hit = [...new Set(words)].filter(w => owners.has(w))
    for (const w of hit) credit('tatoeba', w, 1)
    const ru = s.ru[0]
    if (!words.some(w => sentenceForms.has(w)) || !ru || words.length < 2 || words.length > 6) continue
    if (/[A-Za-zА-Яа-яЁё]/.test(s.ka) || !/[А-Яа-яЁё]/.test(ru) || /[ა-ჰ]/.test(ru)) { dropped['язык']++; continue }
    if (isQuestion(s.ka) !== isQuestion(ru)) { dropped['вопрос']++; continue }
    if (digits(s.ka) && digits(ru) && digits(s.ka) !== digits(ru)) { dropped['числа']++; continue }
    if (ru.split(/\s+/).length > words.length * 3 + 3) { dropped['длина']++; continue }
    const key = words.join(' ')
    if (seenText.has(key)) { dropped['дубль']++; continue }
    seenText.add(key)
    out.push({ id: s.id, ka: s.ka, ru })
  }
  writeFileSync(resolve(here, 'sentences.raw.json'), formatJson(out) + '\n')
  console.error(`Tatoeba: ${pairs.length} предложений, отобрано ${out.length}; отсеяно проверками: ${Object.entries(dropped).map(([k, n]) => `${k} ${n}`).join(', ')}`)
}

const SOURCES = ['web', 'news', 'wiki', 'subs', 'tatoeba', 'lessons']
const round = n => Math.round(n * 10) / 10
const verbs = {}
for (const v of raw) {
  verbs[v.lemma] = Object.fromEntries(SOURCES.map(s => [s, totals[s] ? round(totals[s][v.lemma] ?? 0) : previous[v.lemma]?.[s] ?? 0]))
}
writeFileSync(freqFile, formatJson({ sources: SOURCES, verbs }).replace(/\{\n\s+"web": ([^}]*?)\n\s+\}/g, (m) => m.replace(/\n\s+/g, ' ')) + '\n')
console.error(`Частотность: ${raw.length} глаголов → ${freqFile}`)
for (const s of SOURCES) console.error(`  ${s}: ${totals[s] ? Object.values(verbs).filter(x => x[s] > 0).length + ' глаголов с ненулевой частотой' : 'источник не дан, числа прежние'}`)
