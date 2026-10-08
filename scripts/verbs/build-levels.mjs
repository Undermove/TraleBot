#!/usr/bin/env node
// Уровни и наборы раздела «Глаголы»: в каком порядке приложение ведёт человека по каталогу.
// Читает levels.plan.json (руками: уровни, наборы по пять глаголов с темой), frequency.json
// (числа из открытых корпусов, см. SOURCES.md), каталог и семьи (src/Trale/Verbs/families.json —
// его пишет build-families.mjs, запускать перед этим скриптом); пишет
//   src/Trale/Verbs/levels.json — то, что читает сервер (VerbLevelCatalog),
//   scripts/verbs/LEVELS.md     — таблицу для вычитки: уровень → набор → глаголы с числами.
// Сети и внешних файлов не требует; одинаковый вход — одинаковый выход.
//
//   node scripts/verbs/build-levels.mjs            собрать
//   node scripts/verbs/build-levels.mjs --check    только проверки (код выхода 1, если не прошли)
//   node scripts/verbs/build-levels.mjs --force    разрешить переезд глагола из набора в набор
//
// ── Как глагол получает уровень ───────────────────────────────────────────────────────────────
// 1. Счёт употребительности — как score() в build-catalog.mjs (для каждого источника
//    log(1 + частота), нормированный на максимум по источнику), но с весами под разговорную речь:
//    порядок обучения — это «что нужнее в быту», а не «что чаще в газете». Предложения Tatoeba
//    весят вдвое больше общего веба, новости и Википедия — вчетверо меньше (канцелярит: «заявлять»,
//    «осуществлять», «финансировать»). Правильность спряжения в счёт не входит: самые нужные
//    глаголы — как раз неправильные.
// 2. Глаголы выстраиваются по счёту; первые 20 — уровень 1, следующие 30 — уровень 2 и так далее
//    (sizes в levels.plan.json). Это «уровень по счёту».
// 3. Список базовых бытовых значений (core в levels.plan.json, по русскому переводу) — всегда
//    уровень 1: шум корпуса не должен утопить «смотреть» или «ходить».
// 4. Наборы собраны руками по смыслу. Глагол может стоять не на своём уровне по счёту только
//    если он из списка core или у него есть запись в moved с причиной; иначе сборка падает.
// 5. Внутри уровня наборы идут по убыванию среднего счёта, глаголы в наборе — по убыванию счёта.
// 6. Семья (families в levels.plan.json) — один глагол с разными приставками направления. Её члены,
//    которых нет ни в одном наборе, идут в уровне одной карточкой семьи, а не наборами: уровень им
//    задаёт семья, причина в moved не нужна (и запись о таком глаголе в moved не читается).
//    Карточка семьи стоит в уровне первой. Состав семьи считает build-families.mjs.
// ── Что нельзя ломать ────────────────────────────────────────────────────────────────────────
// id набора — навсегда: по нему набор узнаётся после пересборки. Новый глагол каталога кладётся
// в набор, где меньше шести глаголов, или в новый набор; уже разложенные глаголы не переезжают
// (сборка сверяется с прежним levels.json; переезд — только с --force).
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { formatJson } from './format.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const read = name => JSON.parse(readFileSync(resolve(here, name), 'utf8'))
const outFile = resolve(here, '../../src/Trale/Verbs/levels.json')
const check = process.argv.includes('--check'), force = process.argv.includes('--force')

const WEIGHTS = { tatoeba: 2, lessons: 1, subs: 1, web: 1, news: 0.25, wiki: 0.25 }
const PACK_MIN = 4, PACK_MAX = 6

const plan = read('levels.plan.json')
const frequency = read('frequency.json').verbs
const catalog = JSON.parse(readFileSync(resolve(here, '../../src/Trale/Verbs/verbs.json'), 'utf8')).verbs
const byLemma = new Map(catalog.map(v => [v.lemma, v]))
const familiesFile = resolve(here, '../../src/Trale/Verbs/families.json')
const families = existsSync(familiesFile) ? JSON.parse(readFileSync(familiesFile, 'utf8')).families : []

const max = {}
for (const f of Object.values(frequency)) for (const [k, n] of Object.entries(f)) max[k] = Math.max(max[k] ?? 0, n)
const score = lemma => {
  const f = frequency[lemma] ?? {}
  let s = 0
  for (const [k, w] of Object.entries(WEIGHTS)) s += max[k] ? w * Math.log1p(f[k] ?? 0) / Math.log1p(max[k]) : 0
  return s
}

// место и уровень по счёту
const ranked = [...catalog].sort((a, b) => score(b.lemma) - score(a.lemma) || (a.lemma < b.lemma ? -1 : 1))
const rank = new Map(ranked.map((v, i) => [v.lemma, i + 1]))
const levelByRank = lemma => {
  let upTo = 0
  for (let i = 0; i < plan.sizes.length; i++) { upTo += plan.sizes[i]; if (rank.get(lemma) <= upTo) return i + 1 }
  return plan.sizes.length
}
// Перевод с уточнением в скобках («писать (кому-то)») — уже другой глагол.
const ruWords = text => text.toLowerCase().split(/[,;]/).map(s => s.trim()).filter(Boolean)
const isCore = v => ruWords(v.ru).some(w => plan.core.glosses.includes(w))

const fail = []
const FAMILY_PREFIX = 'family-'
const placed = new Map()   // лемма → { level, pack }
const packIds = new Set()
for (const level of plan.levels) {
  for (const pack of level.packs) {
    if (!/^[a-z][a-z0-9-]*$/.test(pack.id)) fail.push(`набор «${pack.title}»: id «${pack.id}» — только латиница, цифры и дефис`)
    if (pack.id.startsWith(FAMILY_PREFIX)) fail.push(`id набора «${pack.id}» начинается с «${FAMILY_PREFIX}» — так называются карточки семей`)
    if (packIds.has(pack.id)) fail.push(`id набора «${pack.id}» встречается дважды`)
    packIds.add(pack.id)
    if (pack.verbs.length < PACK_MIN || pack.verbs.length > PACK_MAX)
      fail.push(`набор ${pack.id}: глаголов ${pack.verbs.length}, должно быть от ${PACK_MIN} до ${PACK_MAX}`)
    for (const lemma of pack.verbs) {
      if (!byLemma.has(lemma)) fail.push(`набор ${pack.id}: глагола ${lemma} нет в каталоге`)
      else if (placed.has(lemma)) fail.push(`${lemma} (${byLemma.get(lemma).ru}) стоит в двух наборах: ${placed.get(lemma).pack} и ${pack.id}`)
      else placed.set(lemma, { level: level.id, pack: pack.id })
    }
  }
}
// Семьи: члены семьи, не стоящие в наборах, — одной карточкой в уровне семьи.
const familyCards = []   // { level, id, title, verbs }
const inFamily = new Map()   // лемма → семья
for (const entry of plan.families ?? []) {
  const family = families.find(f => f.id === entry.id)
  if (!family) { fail.push(`семья ${entry.id}: нет в families.json — сначала node scripts/verbs/build-families.mjs`); continue }
  if (!family.enabled) { fail.push(`семья ${entry.id} выключена в families.plan.json — её глаголы надо разложить по наборам`); continue }
  if (!plan.levels.some(l => l.id === entry.level)) { fail.push(`семья ${entry.id}: уровня ${entry.level} нет`); continue }
  const verbs = family.members.map(m => m.lemma).filter(lemma => !placed.has(lemma))
  for (const lemma of verbs) {
    if (!byLemma.has(lemma)) { fail.push(`семья ${entry.id}: глагола ${lemma} нет в каталоге`); continue }
    placed.set(lemma, { level: entry.level, pack: FAMILY_PREFIX + family.id })
    inFamily.set(lemma, family)
  }
  if (!verbs.length) fail.push(`семья ${entry.id}: все её глаголы уже стоят в наборах — карточке нечего показывать`)
  familyCards.push({ level: entry.level, id: family.id, title: family.title, baseName: family.baseName, verbs })
}
for (const v of catalog) if (!placed.has(v.lemma)) fail.push(`${v.lemma} (${v.ru}) не стоит ни в одном наборе и ни в одной семье`)

// почему глагол не на своём уровне по счёту
const why = new Map()
for (const v of catalog) {
  const at = placed.get(v.lemma)
  if (!at) continue
  const byNumbers = levelByRank(v.lemma)
  if (inFamily.has(v.lemma)) {
    if (at.level !== byNumbers) why.set(v.lemma, `Семья «${inFamily.get(v.lemma).baseName}»: все направления одного глагола идут одной карточкой на уровне ${at.level}.`)
    continue
  }
  if (isCore(v) && at.level !== 1) fail.push(`${v.ru}: базовое значение (core) должно стоять на уровне 1, стоит на ${at.level}`)
  if (at.level === byNumbers) {
    if (plan.moved[v.lemma]) fail.push(`${v.ru}: запись в moved лишняя — глагол стоит на своём уровне по счёту`)
    continue
  }
  if (isCore(v)) why.set(v.lemma, `Базовое бытовое значение (список core): уровень 1, хотя по счёту ${rank.get(v.lemma)}-й.`)
  else if (plan.moved[v.lemma]) why.set(v.lemma, plan.moved[v.lemma])
  else fail.push(`${v.ru}: по счёту ${rank.get(v.lemma)}-й (уровень ${byNumbers}), а стоит на уровне ${at.level} — нужна причина в moved`)
}
for (const lemma of Object.keys(plan.moved)) if (!byLemma.has(lemma)) fail.push(`moved: глагола ${lemma} нет в каталоге`)

// уже разложенные глаголы не переезжают
if (existsSync(outFile) && !force) {
  const before = JSON.parse(readFileSync(outFile, 'utf8'))
  for (const level of before.levels) {
    const units = [...level.packs, ...(level.families ?? []).map(f => ({ ...f, id: FAMILY_PREFIX + f.id }))]
    for (const pack of units) for (const lemma of pack.verbs) {
      const now = placed.get(lemma)
      if (now && now.pack !== pack.id) fail.push(`${lemma} переехал из ${pack.id} в ${now.pack} — так нельзя без --force`)
    }
  }
}

if (fail.length) {
  console.error('Уровни не собраны:\n' + fail.map(f => '  · ' + f).join('\n'))
  process.exit(1)
}

const mean = pack => pack.verbs.reduce((s, l) => s + score(l), 0) / pack.verbs.length
const byScore = lemmas => [...lemmas].sort((a, b) => score(b) - score(a) || (a < b ? -1 : 1))
const levels = plan.levels.map(level => ({
  id: level.id,
  title: level.title,
  // Ключа нет у уровня без семей — так файл не меняется там, где семей нет.
  families: familyCards.some(f => f.level === level.id)
    ? familyCards.filter(f => f.level === level.id).map(f => ({ id: f.id, title: f.title, verbs: byScore(f.verbs) }))
    : undefined,
  packs: [...level.packs]
    .sort((a, b) => mean(b) - mean(a) || (a.id < b.id ? -1 : 1))
    .map(pack => ({
      id: pack.id,
      title: pack.title,
      verbs: [...pack.verbs].sort((a, b) => score(b) - score(a) || (a < b ? -1 : 1))
    }))
}))

// ── таблица для вычитки ──────────────────────────────────────────────────────────────────────
const n = x => Math.round(x ?? 0)
const lines = [
  '# Глаголы: уровни и наборы',
  '',
  'Собрано `node scripts/verbs/build-levels.mjs` из `levels.plan.json` (наборы и темы — руками) и `frequency.json`',
  '(числа — из открытых корпусов, источники и лицензии в `SOURCES.md`). Руками этот файл не правится.',
  '',
  '**Как читать числа.** «Место» — место глагола среди всех ' + catalog.length + ' по счёту употребительности. Счёт складывается из шести',
  'источников (у каждого — логарифм частоты, делённый на максимум по источнику): предложения Tatoeba ×2, наши уроки ×1,',
  'субтитры ×1, сайты ×1, новости и Википедия ×0,25 каждый. Столбцы: **T** — в скольких грузинских предложениях Tatoeba',
  'есть форма глагола; **У** — сколько раз формы встречаются в наших уроках; **С** — субтитры (OpenSubtitles);',
  '**В** — сайты .ge (Leipzig web 2019); **Н** — новости + Википедия (Leipzig). Частота глагола — сумма частот всех его форм.',
  '',
  '**Порядок.** Первые ' + plan.sizes[0] + ' по счёту — уровень 1, следующие ' + plan.sizes[1] + ' — уровень 2 и так далее. Внутри уровня наборы идут',
  'по убыванию среднего счёта, глаголы в наборе — по убыванию счёта. Правильность спряжения на порядок не влияет.',
  '',
  '**Базовые значения — всегда уровень 1** (список `core`): ' + plan.core.glosses.join(', ') + '.',
  ''
]
function row(lemma) {
  const v = byLemma.get(lemma), f = frequency[lemma] ?? {}
  return `| ${v.ru}${why.has(lemma) ? ' ¹' : ''} | ${lemma} | ${rank.get(lemma)} | ${n(f.tatoeba)} | ${n(f.lessons)} | ${n(f.subs)} | ${n(f.web)} | ${n((f.news ?? 0) + (f.wiki ?? 0))} |`
}
const movedRows = catalog.filter(v => why.has(v.lemma)).sort((a, b) => rank.get(a.lemma) - rank.get(b.lemma))
lines.push('## Где числа поправлены руками', '')
if (!movedRows.length) lines.push('Нигде.', '')
else {
  lines.push('| Глагол | Место | Уровень по счёту | Стоит на уровне | Почему |', '|---|---|---|---|---|')
  for (const v of movedRows)
    lines.push(`| ${v.ru} (${v.lemma}) | ${rank.get(v.lemma)} | ${levelByRank(v.lemma)} | ${placed.get(v.lemma).level} | ${why.get(v.lemma)} |`)
  lines.push('')
}
for (const level of levels) {
  const cards = level.families ?? []
  const count = level.packs.reduce((s, p) => s + p.verbs.length, 0) + cards.reduce((s, f) => s + f.verbs.length, 0)
  lines.push(`## Уровень ${level.id}. ${level.title} (глаголов: ${count}, наборов: ${level.packs.length}${cards.length ? `, семей: ${cards.length}` : ''})`, '')
  for (const card of cards) {
    lines.push(`### Семья. ${card.title} \`${FAMILY_PREFIX}${card.id}\``, '',
      'Одна карточка вместо наборов: это один глагол с разными приставками направления (сверка — `FAMILIES.md`).',
      'Остальные члены семьи стоят в своих наборах и на карточке семьи тоже показаны.', '',
      '| Глагол | По-грузински | Место | T | У | С | В | Н |', '|---|---|---|---|---|---|---|---|')
    for (const lemma of card.verbs) lines.push(row(lemma))
    lines.push('')
  }
  level.packs.forEach((pack, i) => {
    lines.push(`### ${level.id}.${i + 1}. ${pack.title} \`${pack.id}\``, '', '| Глагол | По-грузински | Место | T | У | С | В | Н |', '|---|---|---|---|---|---|---|---|')
    for (const lemma of pack.verbs) lines.push(row(lemma))
    lines.push('')
  })
}
lines.push('¹ — уровень поправлен руками, причина в таблице «Где числа поправлены руками».', '')

const total = levels.reduce((s, l) => s + [...l.packs, ...(l.families ?? [])].reduce((p, k) => p + k.verbs.length, 0), 0)
if (!check) {
  writeFileSync(outFile, formatJson({ levels }))
  writeFileSync(resolve(here, 'LEVELS.md'), lines.join('\n'))
}
console.log(`${check ? 'Проверено' : 'Собрано'}: ${levels.length} уровней, ${packIds.size} наборов, семей ${familyCards.length}, ${total} глаголов; поправлено руками — ${movedRows.length}`)
