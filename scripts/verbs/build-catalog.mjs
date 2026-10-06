#!/usr/bin/env node
// Шаг 3. Собирает каталог проверенных глаголов для приложения → src/Trale/Verbs/verbs.json
// и таблицу для вычитки → scripts/verbs/REVIEW.md. При старте сервер загружает verbs.json в базу
// (SeedVerbCatalog). Внешних файлов и сети не нужно — только то, что лежит в scripts/verbs:
//
//   verbs.raw.json      парадигмы из выгрузки Викисловаря            (шаг 1, extract-kaikki.mjs)
//   frequency.json      частотность форм по корпусам                 (шаг 2, collect-evidence.mjs)
//   sentences.raw.json  предложения Tatoeba с формами глаголов       (шаг 2)
//   ru.json             русские переводы — пишутся руками по английским толкованиям Викисловаря
//   ru.unsure.json      { лемма: "в чём сомнение" } — попадает в REVIEW.md, на сборку не влияет
//   ru-forms.json       русские формы переводов для фраз «я хочу», «ты хотел(а)» (ru-forms.py + pymorphy3;
//                       после правки ru.json его нужно пересобрать — сборка проверяет, что он не отстал)
//   verbs.skip.json     { лемма: "почему вычеркнут" } — глаголы, вычеркнутые при вычитке
//   sentences.skip.json [id, …] — предложения Tatoeba, вычеркнутые при вычитке
//
//   node scripts/verbs/build-catalog.mjs [--force] [--check]
//     --force  записать, даже если глаголов стало меньше, чем в лежащем в git verbs.json
//     --check  ничего не писать, только прогнать проверки (код выхода 1, если не прошли)
//
// ── Какие глаголы попадают в каталог ──────────────────────────────────────────────────────────
// 1. Форма. Основная таблица должна честно ложиться в карточку: ряды настоящего, будущего и
//    аориста есть и в каждом заполнены все шесть лиц. Исключение — PARTIAL_OK.
// 2. Употребительность. Глагол считается общеупотребимым, если его формы встречаются в живой
//    речи/учебном материале (Tatoeba, наши уроки, субтитры) либо достаточно часты в больших
//    корпусах: не реже MIN_CORPUS раз суммарно в трёх корпусах Leipzig по 300 тыс. предложений.
// 3. Место в каталоге — по score(): для каждого источника log(1 + частота), нормированный на
//    максимум по источнику (так один огромный корпус не давит остальные), с весами WEIGHTS.
//    Уроки весят больше всего (ученик эти формы уже видел), новости и Википедия — вдвое меньше
//    общего веба (канцелярит и энциклопедический стиль), субтитры — вдвое меньше (список засорён).
//    Плюс PROD_BOOST глаголам, чей перевод входит в список слов, которые ученики чаще всего
//    искали в словаре (prod-lookups.json, замер на проде).
// 4. Берутся первые LIMIT. Если честных меньше — каталог меньше; добивать нельзя.
// Грубые слова (помета vulgar в Викисловаре) не берутся.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { analyze } from './analyze.mjs'
import { formatJson } from './format.mjs'
import { meaningsOf } from './meanings.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const read = name => JSON.parse(readFileSync(resolve(here, name), 'utf8'))
const outFile = resolve(here, '../../src/Trale/Verbs/verbs.json')
const reviewFile = resolve(here, 'REVIEW.md')
const force = process.argv.includes('--force'), checkOnly = process.argv.includes('--check')

const { verbs: raw, rejected, noTable } = read('verbs.raw.json')
const frequency = read('frequency.json').verbs
const ru = read('ru.json')
const unsure = read('ru.unsure.json')
// Русские формы переводов (ru-forms.py) — из них собираются фразы «я хочу», «ты хотел(а)».
const ruForms = read('ru-forms.json')
const skipVerbs = read('verbs.skip.json')
const prodLookups = read('prod-lookups.json').words
const wanted = read('wanted.json')

const LIMIT = 200
const MIN_CORPUS = 100
const WEIGHTS = { web: 1, news: 0.5, wiki: 0.5, subs: 0.5, tatoeba: 1, lessons: 1.5 }
const PROD_BOOST = 1
// Глаголы, у которых в Викисловаре таблица неполная (только система настоящего, у «иметь» ещё
// будущее), но без которых каталог «самых употребимых» бессмыслен: иметь, хотеть, знать, ходить —
// из первой десятки по всем источникам; «болит» и «голоден» — из наших уроков. Берём как есть,
// с честной пометкой в карточке: лучше половина парадигмы «знать», чем ничего.
const PARTIAL_OK = new Set(['აქვს', 'ჰყავს', 'უნდა', 'იცის', 'დადის', 'სტკივა', 'შია'])
const CARD = ['present', 'aorist', 'imperfect', 'optative', 'conditional', 'future']
const ALL_TENSES = ['present', 'imperfect', 'presentSubjunctive', 'future', 'conditional', 'futureSubjunctive', 'aorist', 'optative', 'perfect', 'pluperfect', 'perfectSubjunctive']

const fail = []
const complete = row => Array.isArray(row) && row.length === 6 && row.every(c => c.length > 0)
const isPartial = v => !(complete(v.tenses.present) && complete(v.tenses.future) && complete(v.tenses.aorist))
// Перевод с уточнением в скобках («писать (кому-то)») — уже другой глагол, надбавку не получает.
const ruWords = text => text.toLowerCase().split(/[,;]/).map(s => s.trim()).filter(Boolean)

const max = {}
for (const f of Object.values(frequency)) for (const [k, n] of Object.entries(f)) max[k] = Math.max(max[k] ?? 0, n)
function score(v) {
  const f = frequency[v.lemma] ?? {}
  let s = 0
  for (const [k, w] of Object.entries(WEIGHTS)) s += max[k] ? w * Math.log1p(f[k] ?? 0) / Math.log1p(max[k]) : 0
  if (ru[v.lemma] && ruWords(ru[v.lemma]).some(w => prodLookups.includes(w))) s += PROD_BOOST
  return s
}
const isCommon = v => {
  const f = frequency[v.lemma] ?? {}
  return (f.tatoeba ?? 0) >= 1 || (f.lessons ?? 0) >= 1 || (f.subs ?? 0) >= 1 || (f.web ?? 0) + (f.news ?? 0) + (f.wiki ?? 0) >= MIN_CORPUS
}

// ── отбор ────────────────────────────────────────────────────────────────────────────────────
const left = []   // { lemma, why } — что не вошло и почему (идёт в REVIEW.md)
const pool = []
for (const v of raw) {
  const why =
    v.lemma in skipVerbs ? `вычеркнут (verbs.skip.json): ${skipVerbs[v.lemma]}`
    : v.en.some(g => /\bvulgar\b/.test(g.match(/^\(([^)]*)\)/)?.[1] ?? '')) ? 'грубое слово'
    : !complete(v.tenses.present) ? 'в настоящем времени заполнены не все лица'
    : isPartial(v) && !PARTIAL_OK.has(v.lemma) ? 'в таблице Викисловаря нет полного будущего или аориста'
    : !isCommon(v) ? 'редкий: нет в живых источниках и мало в корпусах'
    : null
  if (why) left.push({ lemma: v.lemma, en: v.en.join('; '), why })
  else pool.push(v)
}
pool.sort((a, b) => score(b) - score(a) || (a.lemma < b.lemma ? -1 : 1))
for (const v of pool.slice(LIMIT)) left.push({ lemma: v.lemma, en: v.en.join('; '), why: `не вошёл в первые ${LIMIT} по употребительности` })
const chosen = pool.slice(0, LIMIT)

// ── предложения ──────────────────────────────────────────────────────────────────────────────
// Живые предложения с формами глаголов: Tatoeba (CC BY 2.0 FR), пары «грузинский — русский».
// Корпус пишут добровольцы, в нём бывают ошибки: id в sentences.skip.json исключаются после проверки.
const sentences = read('sentences.raw.json')
const skip = new Set(read('sentences.skip.json'))
const MAX_SENTENCES_PER_FORM = 4
const wordsOf = text => text.match(/[ა-ჰ]+/g) ?? []

// Комиксы (src/Trale/Verbs/stories/*.json) берут реплики по id предложения. Такое предложение попадает
// в карточку своего глагола всегда, даже сверх лимита на форму: иначе история осталась бы без реплики.
const storiesDir = resolve(here, '../../src/Trale/Verbs/stories')
const pinned = new Map()
for (const file of existsSync(storiesDir) ? readdirSync(storiesDir).filter(f => f.endsWith('.json')) : []) {
  const story = JSON.parse(readFileSync(resolve(storiesDir, file), 'utf8'))
  const ids = pinned.get(story.verb) ?? new Set()
  for (const frame of story.frames ?? []) ids.add(frame.sentence)
  pinned.set(story.verb, ids)
}

function sentencesFor(v) {
  const out = []
  const perForm = new Map()
  const pins = pinned.get(v.lemma) ?? new Set()
  // Форма, совпадающая с самостоятельным не-глаголом, предложение не «притягивает»: неизвестно,
  // глагол в нём или существительное.
  const homographs = new Set(v.homographs)
  const own = new Set(Object.values(v.tenses).flat(2).filter(f => !homographs.has(f)))
  for (const s of sentences) {
    if (skip.has(s.id)) continue
    const form = wordsOf(s.ka).find(w => own.has(w))
    if (!form) continue
    const count = perForm.get(form) ?? 0
    if (count >= MAX_SENTENCES_PER_FORM && !pins.has(s.id)) continue
    perForm.set(form, count + 1)
    out.push({ id: s.id, ka: s.ka, ru: s.ru, form })
  }
  const lost = [...pins].filter(id => !out.some(s => s.id === id))
  if (lost.length) {
    fail.push(`комикс про «${v.lemma}» ссылается на предложения, которых нет в выборке для этого глагола ` +
      `(нет в sentences.raw.json, исключены в sentences.skip.json или в них нет формы глагола): ${lost.join(', ')}`)
  }
  return out
}

// Заголовок карточки — масдар. Сначала тот, что Викисловарь даёт в шапке статьи («verbal noun»),
// иначе самый короткий из шапки таблицы (в паре «с превербом / без» это масдар без преверба),
// иначе сама лемма.
const titleOf = v => v.masdar.head ?? [...v.masdar.imperfective, ...v.masdar.perfective].sort((a, b) => a.length - b.length)[0] ?? v.lemma

const analysed = chosen.map(v => ({ v, a: analyze(v, { partial: isPartial(v) }) }))
// Образец схемы — самый употребительный глагол «по образцу» с той же схемой, кроме самого глагола.
const modelFor = ({ v, a }) =>
  a.scheme ? analysed.find(o => o.v !== v && o.a.kind === 'pattern' && o.a.scheme === a.scheme) ?? null : null

const verbs = analysed.map(entry => {
  const { v, a } = entry
  const model = modelFor(entry)
  // Значение каждой формы простыми словами. Без русских форм глагол в каталог не идёт: упражнение
  // осталось бы без текста.
  const forms = ruForms[v.lemma]
  if (!forms) fail.push(`${v.lemma}: нет русских форм в ru-forms.json — запусти python3 scripts/verbs/ru-forms.py`)
  else if (forms.ru !== ru[v.lemma]) fail.push(`${v.lemma}: ru-forms.json собран для «${forms.ru}», а в ru.json теперь «${ru[v.lemma]}» — запусти python3 scripts/verbs/ru-forms.py`)
  const plain = forms ? meaningsOf(forms, Object.keys(v.tenses)) : { meanings: {}, chips: {}, problems: [] }
  for (const problem of plain.problems) fail.push(`${v.lemma} (${ru[v.lemma]}): ${problem}`)
  return {
    lemma: v.lemma,
    title: titleOf(v),
    ru: ru[v.lemma] ?? null,
    kind: a.kind,
    reason: a.reason,
    root: a.root,
    oddTenses: a.oddTenses,
    model: model ? { id: model.v.lemma, title: titleOf(model.v), ru: ru[model.v.lemma] ?? null } : null,
    masdarWithPreverb: v.masdar.perfective.filter(m => m !== titleOf(v)),
    tenses: v.tenses,
    // Что значит каждая форма по-русски: время → шесть фраз («я хочу», «ты хочешь», …).
    meanings: plain.meanings,
    // Пометки для времён, чьи фразы по-русски совпадают («я писал(а)»: один раз или долго).
    meaningChips: plain.chips,
    alt: v.alt,
    // Формы, которые пишутся так же, как самостоятельное слово-неглагол (უნდა — и «хочет», и «надо»).
    // По ним разбор не строится: встретив такое слово во фразе, нельзя утверждать, что это глагол.
    // Собственный масдар глагола сюда не входит — это то же слово, подсказка про глагол к месту.
    notForParse: (v.homographs ?? []).filter(f => f !== titleOf(v) && !v.masdar.perfective.includes(f)),
    sentences: sentencesFor(v),
    source: v.source
  }
})

const orphans = [...pinned.keys()].filter(lemma => !verbs.some(v => v.lemma === lemma))
if (orphans.length) fail.push(`комиксы ссылаются на глаголы, которых нет в каталоге: ${orphans.join(', ')}`)

// ── проверки качества: любая из них останавливает сборку ─────────────────────────────────────
const GEO = /^[ა-ჰ]+$/
const rawOf = new Map(raw.map(v => [v.lemma, v]))
const lemmas = new Set()
const titleGloss = new Map()
for (const v of verbs) {
  if (!v.ru || !v.ru.trim()) fail.push(`${v.lemma}: нет русского перевода в ru.json (англ.: ${rawOf.get(v.lemma).en.join('; ') || '—'})`)
  if (lemmas.has(v.lemma)) fail.push(`${v.lemma}: лемма встречается дважды`)
  lemmas.add(v.lemma)
  if (!GEO.test(v.lemma) || !GEO.test(v.title)) fail.push(`${v.lemma}: в лемме или заголовке «${v.title}» не только грузинские буквы`)
  for (const [where, table] of [['tenses', v.tenses], ...v.alt.map((t, i) => [`alt[${i}]`, t])]) {
    for (const [tense, row] of Object.entries(table)) {
      if (!ALL_TENSES.includes(tense)) fail.push(`${v.lemma}: неизвестное время ${where}.${tense}`)
      if (!Array.isArray(row) || row.length !== 6) { fail.push(`${v.lemma}: ${where}.${tense} — не шесть ячеек`); continue }
      for (const cell of row) for (const form of cell) if (typeof form !== 'string' || !GEO.test(form)) fail.push(`${v.lemma}: ${where}.${tense} — форма «${form}» содержит не грузинские символы`)
    }
  }
  if (!complete(v.tenses.present)) fail.push(`${v.lemma}: в настоящем времени заполнены не все лица`)
  if (!['pattern', 'feature', 'special'].includes(v.kind)) fail.push(`${v.lemma}: неизвестный тип «${v.kind}»`)
  const key = `${v.title}|${v.ru}`
  if (titleGloss.has(key)) fail.push(`${v.lemma} и ${titleGloss.get(key)}: одинаковые заголовок и перевод (${v.title} — ${v.ru}) — похоже на дубль`)
  titleGloss.set(key, v.lemma)
  for (const s of v.sentences) if (!Object.values(v.tenses).flat(2).includes(s.form)) fail.push(`${v.lemma}: предложение ${s.id} привязано к чужой форме ${s.form}`)
}
for (const v of verbs) if (v.model && !lemmas.has(v.model.id)) fail.push(`${v.lemma}: глагол-образец ${v.model.id} не найден в каталоге`)
for (const lemma of Object.keys(skipVerbs)) if (!raw.some(v => v.lemma === lemma)) fail.push(`verbs.skip.json: ${lemma} нет в verbs.raw.json — опечатка?`)
for (const lemma of Object.keys(ru)) if (!raw.some(v => v.lemma === lemma)) fail.push(`ru.json: ${lemma} нет в verbs.raw.json — опечатка?`)
for (const lemma of Object.keys(unsure)) if (!raw.some(v => v.lemma === lemma)) fail.push(`ru.unsure.json: ${lemma} нет в verbs.raw.json — опечатка?`)

const before = existsSync(outFile) ? JSON.parse(readFileSync(outFile, 'utf8')).verbs : []
const gone = before.map(v => v.lemma).filter(l => !lemmas.has(l))
if (verbs.length < before.length && !force)
  fail.push(`каталог уменьшился: было ${before.length}, стало ${verbs.length} (пропали: ${gone.join(', ')}). Если так и задумано — запусти с --force`)

if (fail.length) {
  console.error(`Сборка остановлена, проверок не прошло: ${fail.length}\n` + fail.map(f => ` ✗ ${f}`).join('\n'))
  process.exit(1)
}

// Подозрительные места в самих таблицах — не чинятся и сборку не останавливают, а выносятся в
// REVIEW.md: решать, вычёркивать ли глагол, должен человек.
//  • 3-е лицо настоящего на -ს обычно равно 2-му лицу + ს; если нет — в шаблоне Викисловаря могли
//    перепутать параметры (у глаголов-перевёртышей и глаголов движения это норма, их не трогаем);
//  • окончание аориста 1-го лица: если у глаголов с тем же суффиксом настоящего оно почти всегда
//    одно, а у этого другое — отметить.
const aoristClass = v => {
  const p = v.tenses.present?.[0]?.[0] ?? '', a = v.tenses.aorist?.[0]?.[0] ?? ''
  return a ? { suffix: p.match(/(ებ|ავ|ამ|ობ|ევ|ი)$/)?.[1] ?? '', ending: a.slice(-1) } : null
}
const classStats = new Map()
for (const v of raw) { const c = aoristClass(v); if (c) { const m = classStats.get(c.suffix) ?? classStats.set(c.suffix, new Map()).get(c.suffix); m.set(c.ending, (m.get(c.ending) ?? 0) + 1) } }
function anomalies(v, kind) {
  const out = []
  const p2 = v.tenses.present?.[1]?.[0] ?? ''
  if (kind !== 'special' && v.lemma.endsWith('ს') && p2 + 'ს' !== v.lemma) out.push(`3-е лицо ${v.lemma} не равно 2-му лицу ${p2} + ს`)
  const c = aoristClass(v)
  if (c && c.suffix) {
    const m = classStats.get(c.suffix), total = [...m.values()].reduce((a, b) => a + b, 0)
    if (total >= 20 && m.get(c.ending) / total < 0.05) out.push(`аорист на -${c.ending} при настоящем на -${c.suffix} (так только у ${m.get(c.ending)} из ${total})`)
  }
  return out
}

// ── REVIEW.md ────────────────────────────────────────────────────────────────────────────────
const first = (v, tense) => v.tenses[tense]?.[0]?.join(' / ') || '—'
const KIND = { pattern: 'образец', feature: 'особенность', special: 'особый' }
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const esc = s => s.replace(/\|/g, '/')
const rows = verbs.map((v, i) => {
  const r = rawOf.get(v.lemma)
  const flags = [unsure[v.lemma] && `перевод: ${unsure[v.lemma]}`, ...r.notes, ...anomalies(r, v.kind)].filter(Boolean).join('; ')
  return `| ${i + 1} | ${v.title} | ${v.lemma} | ${esc(v.ru)} | ${esc(cut(r.en.join('; '), 90))} | ${KIND[v.kind]} | ${CARD.map(t => first(v, t)).join(' | ')} | [wikt](${v.source}) | ${esc(flags)} |`
})
const kinds = verbs.reduce((n, v) => ({ ...n, [v.kind]: (n[v.kind] ?? 0) + 1 }), {})
const present = new Set(verbs.map(v => v.lemma))
const missing = wanted.map(w => {
  if (present.has(w.lemma)) return null
  const l = left.find(x => x.lemma === w.lemma)
  const rej = rejected.filter(x => x.word === w.lemma).map(x => x.reason)
  const why = l ? l.why : rej.length ? rej.join('; ') : noTable.includes(w.lemma) ? 'статья в Викисловаре есть, таблицы спряжения в ней нет' : 'в Викисловаре нет глагольной статьи'
  return `| ${w.ru} | ${w.lemma} | ${why} |`
}).filter(Boolean)

const review = `# Глаголы каталога — таблица для вычитки

Файл собран автоматически (\`node scripts/verbs/build-catalog.mjs\`), руками не править.
Глаголов: **${verbs.length}** (${Object.entries(kinds).map(([k, n]) => `${KIND[k]} — ${n}`).join(', ')}). Порядок — по употребительности.

Как вычеркнуть: добавить строку \`"лемма": "почему"\` (лемма — третий столбец) в \`scripts/verbs/verbs.skip.json\` и пересобрать с \`--force\`.
Как поправить перевод: \`scripts/verbs/ru.json\`. Формы руками не правятся — они из Викисловаря (ссылка в строке);
если форма неверна, глагол вычёркивается целиком.

Шесть форм в строке — это «я» в шести временах карточки: настоящее, аорист, имперфект, оптатив, условное, будущее.
Последний столбец — на что обратить внимание.

| № | масдар | лемма | перевод | Wiktionary | тип | наст. | аорист | имперф. | оптатив | условн. | будущее | источник | внимание |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}

## Нужные глаголы, которых в каталоге нет

Список «нужных» — \`scripts/verbs/wanted.json\` (то, что ученики чаще всего искали в словаре, и глаголы из уроков).

| по-русски | лемма | почему нет |
|---|---|---|
${missing.join('\n')}

## Не вошли из тех, у кого таблица в Викисловаре есть

| лемма | Wiktionary | почему |
|---|---|---|
${left.map(l => `| ${l.lemma} | ${esc(cut(l.en, 80))} | ${l.why} |`).join('\n')}
`

console.error(`Каталог: ${verbs.length} глаголов, ${verbs.reduce((n, v) => n + v.sentences.length, 0)} предложений`)
console.error(Object.entries(kinds).map(([k, n]) => `${k}: ${n}`).join(', '))
console.error(`Форм для разбора: ${verbs.reduce((n, v) => n + new Set([v.tenses, ...v.alt].flatMap(t => Object.entries(t).flatMap(([k, row]) => row.flatMap((c, p) => c.map(f => `${f}|${k}|${p}`))))).size, 0)}`)
if (gone.length) console.error(`Ушли из каталога: ${gone.join(', ')}`)
if (checkOnly) process.exit(0)
writeFileSync(outFile, formatJson({ verbs }) + '\n')
writeFileSync(reviewFile, review)
console.error(`→ ${outFile}\n→ ${reviewFile}`)
