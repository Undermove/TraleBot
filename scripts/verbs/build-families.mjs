#!/usr/bin/env node
// Семьи глаголов: один и тот же глагол с разными приставками направления («идти» → «выходить»,
// «входить», «спускаться»…). Скрипт сам находит такие группы в каталоге и сверяет каждую клетку
// таблицы спряжения: форма члена семьи должна быть равна «приставка + форма без приставки».
// Читает каталог (src/Trale/Verbs/verbs.json), уроки про приставки (их словарики — единственный
// источник списка приставок и их русского значения) и families.plan.json (имя семьи, основной
// глагол, показывать ли в разделе); пишет
//   src/Trale/Verbs/families.json — то, что читает сервер (VerbFamilyCatalog),
//   scripts/verbs/FAMILIES.md     — таблицы сверки для вычитки.
// Сети не требует; одинаковый вход — одинаковый выход. Грузинских букв в этом файле нет и быть
// не должно: приставки, основы и формы берутся только из данных.
//
//   node scripts/verbs/build-families.mjs            собрать
//   node scripts/verbs/build-families.mjs --check    только проверки (код выхода 1, если не прошли)
//
// ── Как находится семья ─────────────────────────────────────────────────────────────────────
// 1. Приставки — леммы с дефисом из словариков уроков модуля «Приставки направления»
//    (Lessons/GeorgianPreverbs) и словарик урока «Приставки направления» модуля про глаголы
//    движения (Lessons/GeorgianVerbsOfMovement/questions2.json; там приставка «через» записана в
//    усечённом виде — так она стоит перед приставкой «сюда»). Значение — русская колонка словарика.
// 2. Приставка «сюда» — та, чьё значение в словарике «к говорящему». Составная приставка =
//    простая + «сюда» («наружу» + «сюда» = «наружу, сюда»). Составная засчитывается, только если
//    каталог сам помечает такой глагол словом «(сюда)» в переводе.
// 3. Глагол — кандидат, если все шесть форм настоящего времени начинаются с одной приставки.
//    Глаголы, у которых настоящее без приставки совпало, — одна группа. Глагол попадает в самую
//    большую из своих групп.
// 4. Основа семьи — в каждой клетке то, что остаётся без приставки у большинства членов группы.
// 5. Сверка: каждая клетка каждого времени члена семьи = одна приставка на всё время + основа.
//    Доля совпавших клеток и список несовпавших — в FAMILIES.md и в families.json.
// 6. Член семьи — тот, у кого есть все времена основы и совпало не меньше minRegular клеток.
//    Остальные — «родственные»: остаются обычными глаголами, семья их только упоминает.
// Отдельно (только в FAMILIES.md) — глаголы, у которых разные приставки лежат внутри одной
// карточки (поле alt): это та же идея, но приставка там чаще не направление, а «сделаю / сделал».
import { readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { formatJson } from './format.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const readJson = path => JSON.parse(readFileSync(resolve(root, path), 'utf8'))
const check = process.argv.includes('--check')

const TENSES = ['present', 'imperfect', 'presentSubjunctive', 'future', 'conditional', 'futureSubjunctive',
  'aorist', 'optative', 'perfect', 'pluperfect', 'perfectSubjunctive']
const TENSE_RU = {
  present: 'сейчас', imperfect: 'прошедшее «делал»', presentSubjunctive: '«чтобы делал»', future: 'будущее',
  conditional: '«сделал бы»', futureSubjunctive: '«если бы сделал»', aorist: 'прошедшее «сделал»', optative: '«надо сделать»',
  perfect: '«оказывается, сделал»', pluperfect: '«должен был сделать»', perfectSubjunctive: 'пожелание'
}
const PERSONS = ['я', 'ты', 'он', 'мы', 'вы', 'они']

/** Место на схеме семьи — по русскому значению приставки из словарика урока. */
const SLOT_BY_GLOSS = { 'внутрь': 'in', 'наружу': 'out', 'вверх': 'up', 'вниз': 'down', 'через': 'across' }
const HERE_GLOSS = 'к говорящему'
const THERE_GLOSS = 'от говорящего'

const PREVERB_LESSONS = [1, 2, 3, 4, 5].map(n => `src/Trale/Lessons/GeorgianPreverbs/questions${n === 1 ? '' : n}.json`)
const MOTION_PREFIX_LESSON = 'src/Trale/Lessons/GeorgianVerbsOfMovement/questions2.json'

const plan = readJson('scripts/verbs/families.plan.json')
const catalog = readJson('src/Trale/Verbs/verbs.json').verbs
const byLemma = new Map(catalog.map(v => [v.lemma, v]))

// ── 1. Приставки из уроков ───────────────────────────────────────────────────────────────────
/** «через / пере-» → «через»; «от говорящего (туда)» → «от говорящего». */
const shortGloss = ru => ru.split(' / ')[0].split(' (')[0].trim()

/** приставка → { ru, source } */
const simple = new Map()
for (const file of PREVERB_LESSONS) {
  for (const entry of readJson(file).lexicon) {
    if (typeof entry !== 'object' || !entry.lemma.endsWith('-')) continue
    const prefix = entry.lemma.slice(0, -1)
    if (!simple.has(prefix)) simple.set(prefix, { ru: shortGloss(entry.ru), source: file })
  }
}
const motionLesson = readJson(MOTION_PREFIX_LESSON)
for (const entry of motionLesson.lexicon) {
  if (!simple.has(entry.lemma)) simple.set(entry.lemma, { ru: shortGloss(entry.ru), source: MOTION_PREFIX_LESSON })
}
const hereEntry = [...simple].find(([, p]) => p.ru === HERE_GLOSS)
const thereEntry = [...simple].find(([, p]) => p.ru === THERE_GLOSS)
if (!hereEntry || !thereEntry) {
  console.error(`В словариках уроков нет приставки со значением «${HERE_GLOSS}» или «${THERE_GLOSS}» — семьи не собрать`)
  process.exit(1)
}
const HERE = hereEntry[0], THERE = thereEntry[0]

/** Все приставки, которые умеем узнавать: простые и «простая + сюда». */
const known = new Map()
for (const [prefix, info] of simple) known.set(prefix, { parts: [prefix], ru: info.ru, source: info.source })
for (const [prefix, info] of simple) {
  if (prefix === HERE || prefix === THERE) continue
  if (!known.has(prefix + HERE)) known.set(prefix + HERE, { parts: [prefix, HERE], ru: info.ru, source: info.source })
}
const longestFirst = [...known.keys()].sort((a, b) => b.length - a.length || (a < b ? -1 : 1))

// ── 2. Группы по настоящему времени без приставки ────────────────────────────────────────────
const cell = (verb, tense, person, table = verb.tenses) => table[tense]?.[person] ?? []
const firstForms = (verb, tense, table = verb.tenses) => PERSONS.map((_, p) => cell(verb, tense, p, table)[0] ?? '')
const hasTense = (verb, tense, table = verb.tenses) => firstForms(verb, tense, table).some(Boolean)

const groups = new Map()   // настоящее без приставки → [{ verb, prefix }]
for (const verb of catalog) {
  const present = firstForms(verb, 'present')
  if (present.some(f => !f)) continue
  for (const prefix of longestFirst) {
    if (!present.every(f => f.startsWith(prefix) && f.length > prefix.length)) continue
    const key = present.map(f => f.slice(prefix.length)).join(' ')
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ verb, prefix })
  }
}
const taken = new Set()
const found = []
for (const group of [...groups.values()].sort((a, b) => b.length - a.length)) {
  const free = group.filter(m => !taken.has(m.verb.lemma))
  if (free.length < 2) continue
  free.forEach(m => taken.add(m.verb.lemma))
  found.push(free)
}

// ── 3. Основа и сверка ───────────────────────────────────────────────────────────────────────
/** Приставка, с которой начинаются все формы времени; при нескольких — самая длинная, дающая основу. */
function tensePrefix(verb, tense, stemRow) {
  const forms = firstForms(verb, tense)
  for (const prefix of longestFirst) {
    if (forms.every((f, p) => !f || f === prefix + (stemRow?.[p] ?? f.slice(prefix.length)))) {
      if (forms.every(f => !f || f.startsWith(prefix))) return prefix
    }
  }
  return null
}

function stemOf(group) {
  const stem = {}
  for (const tense of TENSES) {
    const row = PERSONS.map((_, person) => {
      const votes = new Map()
      for (const { verb, prefix } of group) {
        const form = cell(verb, tense, person)[0]
        if (!form || !form.startsWith(prefix)) continue
        const rest = form.slice(prefix.length)
        votes.set(rest, (votes.get(rest) ?? 0) + 1)
      }
      return [...votes].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? ''
    })
    if (row.some(Boolean)) stem[tense] = row
  }
  return stem
}

function verify(verb, prefix, stem) {
  const stemTenses = Object.keys(stem)
  const missing = stemTenses.filter(t => !hasTense(verb, t))
  let cells = 0, regular = 0
  const deviations = []
  const prefixes = new Set()
  for (const tense of stemTenses) {
    if (!hasTense(verb, tense)) continue
    // Сначала — приставка самого глагола; не подошла — любая известная, одна на всё время
    // (у основного глагола в будущем и прошедшем приставка другая).
    const own = firstForms(verb, tense).every((f, p) => !f || f === prefix + stem[tense][p])
    const used = own ? prefix : tensePrefix(verb, tense, stem[tense]) ?? prefix
    for (let person = 0; person < PERSONS.length; person++) {
      const variants = cell(verb, tense, person)
      if (!variants.length && !stem[tense][person]) continue
      cells++
      const expected = used + stem[tense][person]
      if (variants[0] === expected) { regular++; prefixes.add(used) } else {
        deviations.push({ tense, person, form: variants[0] ?? '', expected })
      }
    }
  }
  return { cells, regular, share: cells ? regular / cells : 0, deviations, missing, prefixes: [...prefixes] }
}

function describe(prefix) {
  const info = known.get(prefix)
  if (prefix === HERE) return { direction: 'none', toward: 'here', ru: null, source: info.source }
  if (prefix === THERE) return { direction: 'none', toward: 'there', ru: null, source: info.source }
  const slot = SLOT_BY_GLOSS[info.ru] ?? null
  return { direction: slot, toward: info.parts.length > 1 ? 'here' : 'there', ru: info.ru, source: info.source }
}

const fail = []
const families = []
const reports = []
for (const group of found) {
  const stem = stemOf(group)
  const planned = plan.families.find(f => group.some(m => m.verb.ru === f.base))
  const rows = group.map(({ verb, prefix }) => {
    const v = verify(verb, prefix, stem)
    const d = describe(prefix)
    const saysHere = /\(сюда\)/.test(verb.ru)
    const reasons = []
    if (v.missing.length) reasons.push(`в каталоге нет времён: ${v.missing.map(t => TENSE_RU[t]).join(', ')} (есть ${Object.keys(stem).length - v.missing.length} из ${Object.keys(stem).length})`)
    if (v.share < plan.minRegular) reasons.push(`правильных клеток ${(v.share * 100).toFixed(1)}% — меньше ${plan.minRegular * 100}%`)
    if (!d.direction) reasons.push(`значение приставки в уроке («${known.get(prefix).ru}») — не направление`)
    if (d.toward === 'here' && d.direction !== 'none' && !saysHere) reasons.push('приставка похожа на составную с «сюда», но каталог этого не подтверждает')
    return { verb, prefix, ...v, ...d, saysHere, reasons }
  })
  const base = planned ? rows.find(r => r.verb.ru === planned.base) : null
  const members = rows.filter(r => !r.reasons.length)
  const related = rows.filter(r => r.reasons.length)
  const clean = members.length >= 2 && members.every(r => r.share >= plan.minRegular)
  reports.push({ planned, rows, stem, base, clean })
  if (!planned) continue
  if (!base || base.reasons.length) fail.push(`семья ${planned.id}: основной глагол «${planned.base}» не прошёл сверку`)
  if (planned.enabled && !clean) fail.push(`семья ${planned.id} включена, но сверка не чистая`)
  // Два члена семьи не могут занимать одно место на схеме.
  const places = members.map(r => `${r.direction}:${r.toward}`)
  if (new Set(places).size !== places.length) fail.push(`семья ${planned.id}: два глагола на одном месте схемы`)
  families.push({
    id: planned.id,
    title: planned.title,
    baseName: planned.baseName,
    enabled: !!planned.enabled && clean,
    base: base?.verb.lemma,
    lessonModule: planned.lessonModule,
    introLessons: planned.introLessons,
    members: members.map(r => ({
      lemma: r.verb.lemma,
      role: r === base ? 'base' : 'member',
      // Приставки, которые стоят в формах этого глагола (у основного их две: в настоящем и в будущем/прошедшем).
      prefixes: [r.prefix, ...r.prefixes.filter(p => p !== r.prefix)],
      direction: r.direction,
      toward: r.toward,
      directionRu: r.ru,
      cells: r.cells,
      regular: r.regular,
      deviations: r.deviations
    })),
    related: related.map(r => ({ lemma: r.verb.lemma, prefix: r.prefix, cells: r.cells, regular: r.regular, reasons: r.reasons }))
  })
}
for (const f of plan.families) if (!families.some(x => x.id === f.id)) fail.push(`семья ${f.id}: в каталоге не нашлось группы с основным глаголом «${f.base}»`)

// ── 4. Приставки внутри одной карточки (alt) — только в отчёт ────────────────────────────────
const FUTURE_SERIES = ['future', 'conditional', 'futureSubjunctive', 'aorist', 'optative']
/** Приставка таблицы: чем «я сделаю» длиннее, чем «я делаю»; null — будущее устроено иначе. */
function tablePrefix(verb, table) {
  const i = cell(verb, 'present', 0, table)[0], will = cell(verb, 'future', 0, table)[0]
  if (!i || !will || !will.endsWith(i)) return null
  return will.slice(0, will.length - i.length)
}
const inner = []
for (const verb of catalog) {
  if (!verb.alt?.length || taken.has(verb.lemma)) continue
  const mainPrefix = tablePrefix(verb, verb.tenses)
  const tables = verb.alt.map(table => {
    const prefix = tablePrefix(verb, table)
    let cells = 0, regular = 0
    if (prefix !== null && mainPrefix !== null) {
      for (const tense of FUTURE_SERIES) for (let p = 0; p < 6; p++) {
        const a = cell(verb, tense, p, table)[0], m = cell(verb, tense, p)[0]
        if (!a && !m) continue
        cells++
        if (a && m && a.startsWith(prefix) && m.startsWith(mainPrefix) && a.slice(prefix.length) === m.slice(mainPrefix.length)) regular++
      }
    }
    return { prefix, cells, regular, future: cell(verb, 'future', 0, table)[0] ?? '' }
  })
  inner.push({ verb, mainPrefix, tables })
}

if (fail.length) {
  console.error('Семьи не собраны:\n' + fail.map(f => '  · ' + f).join('\n'))
  process.exit(1)
}

// ── 5. Отчёт ─────────────────────────────────────────────────────────────────────────────────
const pct = r => r.cells ? (r.regular / r.cells * 100).toFixed(1).replace('.0', '') + '%' : '—'
const TOWARD_RU = { there: 'туда', here: 'сюда' }
const glossOf = prefix => (prefix === '' ? 'без приставки' : known.has(prefix) ? `«${known.get(prefix).ru}»${known.get(prefix).parts.length > 1 ? ' + «сюда»' : ''}` : 'нет в уроках')
const lines = [
  '# Глаголы: семьи',
  '',
  'Собрано `node scripts/verbs/build-families.mjs` из каталога (`src/Trale/Verbs/verbs.json`), словариков уроков про приставки',
  'и `families.plan.json`. Руками этот файл не правится.',
  '',
  '**Семья** — один глагол с разными приставками направления. **Клетка** — одна форма таблицы спряжения (время × лицо).',
  'Клетка «правильная», если форма равна «приставка + основа», где основа — то, что остаётся без приставки у большинства',
  'глаголов группы. Членом семьи становится глагол, у которого есть все времена основы и правильных клеток не меньше',
  `${plan.minRegular * 100}%; остальные остаются обычными глаголами.`,
  '',
  '## Приставки, которые скрипт знает',
  '',
  '| Приставка | Значение в уроке | Откуда |',
  '|---|---|---|'
]
for (const [prefix, info] of simple) lines.push(`| ${prefix}- | ${info.ru} | \`${info.source.replace('src/Trale/', '')}\` |`)
lines.push('', `«Сюда» — приставка со значением «${HERE_GLOSS}» (${HERE}-); «туда» — «${THERE_GLOSS}» (${THERE}-). Составная приставка — простая + «сюда».`, '')

lines.push('## Семьи из разных глаголов каталога', '')
if (!reports.length) lines.push('Не найдено.', '')
for (const r of reports) {
  const name = r.planned ? `«${r.planned.baseName}» (\`${r.planned.id}\`)` : r.rows.map(x => x.verb.ru).join(' / ')
  const state = r.planned ? (r.planned.enabled && r.clean ? 'показывается в разделе' : 'в данных, в разделе выключена') : 'кандидат, в план не внесена'
  lines.push(`### ${name} — ${state}`, '',
    `Глаголов в группе: ${r.rows.length}; членов семьи: ${r.rows.filter(x => !x.reasons.length).length}.`, '',
    '| Глагол | По-грузински | Приставка | Направление | Клеток | Правильных | Отклонения | Итог |', '|---|---|---|---|---|---|---|---|')
  for (const x of r.rows) {
    const where = x.direction === 'none' ? TOWARD_RU[x.toward] : x.direction ? `${x.ru}, ${TOWARD_RU[x.toward]}` : `— («${known.get(x.prefix).ru}»)`
    const extra = x.prefixes.filter(p => p !== x.prefix)
    const dev = x.deviations.length
      ? x.deviations.map(d => `${TENSE_RU[d.tense]}, ${PERSONS[d.person]}: ${d.form || '—'} вместо ${d.expected}`).join('; ')
      : extra.length ? `нет; в части времён приставка другая: ${extra.map(p => `${p}- ${glossOf(p)}`).join(', ')}` : 'нет'
    const verdict = x.reasons.length ? `родственный — ${x.reasons.join('; ')}` : x === r.base ? 'основной' : 'член семьи'
    lines.push(`| ${x.verb.ru} | ${x.verb.lemma} | ${x.prefix}- | ${where} | ${x.cells} | ${x.regular} (${pct(x)}) | ${dev} | ${verdict} |`)
  }
  lines.push('', 'Основа (то, что остаётся без приставки), лицо «я»: ' + Object.entries(r.stem).map(([t, row]) => `${TENSE_RU[t]} — ${row[0]}`).join('; ') + '.', '')
}

lines.push('## Одна карточка — несколько приставок (поле `alt`)', '',
  'У этих глаголов каталог хранит вторую (третью) таблицу с другой приставкой внутри той же карточки. Отдельных глаголов',
  'для таких таблиц в каталоге нет, поэтому семей из них раздел не собирает. «Правильных» — сколько клеток будущего и',
  'прошедшего «сделал» второй таблицы равны клеткам главной с заменой приставки.', '',
  '| Глагол | По-грузински | Приставка главной таблицы | Другие таблицы: приставка, «я сделаю», правильных клеток |', '|---|---|---|---|')
for (const { verb, mainPrefix, tables } of inner) {
  const main = mainPrefix === null ? 'будущее — не «приставка + настоящее»' : mainPrefix === '' ? 'без приставки' : `${mainPrefix}- ${glossOf(mainPrefix)}`
  const others = tables.map(t => t.prefix === null ? `${t.future} — не «приставка + настоящее»`
    : `${t.prefix === '' ? 'без приставки' : `${t.prefix}- ${glossOf(t.prefix)}`}, ${t.future}, ${t.cells ? `${t.regular} из ${t.cells}` : 'не сверить'}`).join('<br>')
  lines.push(`| ${verb.ru} | ${verb.lemma} | ${main} | ${others} |`)
}
lines.push('')

const out = {
  comment: 'Собрано scripts/verbs/build-families.mjs; руками не правится. Таблицы сверки — scripts/verbs/FAMILIES.md.',
  here: HERE,
  there: THERE,
  families
}
if (!check) {
  writeFileSync(resolve(root, 'src/Trale/Verbs/families.json'), formatJson(out) + '\n')
  writeFileSync(resolve(here, 'FAMILIES.md'), lines.join('\n'))
}
const shown = families.filter(f => f.enabled)
console.log(`${check ? 'Проверено' : 'Собрано'}: групп ${reports.length}, семей в плане ${families.length}, в разделе ${shown.length}`
  + families.map(f => `; ${f.id}: членов ${f.members.length}, родственных ${f.related.length}`).join(''))
