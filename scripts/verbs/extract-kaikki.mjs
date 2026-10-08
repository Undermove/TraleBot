#!/usr/bin/env node
// Шаг 1. Собирает парадигмы грузинских глаголов из выгрузки английского Викисловаря
// (Wiktextract / kaikki.org, текст CC BY-SA 4.0) → verbs.raw.json. Сети не требует.
//
//   node scripts/verbs/extract-kaikki.mjs <путь к kaikki.org-dictionary-Georgian.jsonl>
//   (или переменная KAIKKI_KA; где скачать выгрузку — см. SOURCES.md; в git её не кладём: 139 МБ)
//
// Формы берутся только из таблиц спряжения в выгрузке. Ничего не достраивается: пустая ячейка
// остаётся пустой, ряд без подписи времени пропускается, запись с мусором в ячейках отбрасывается.
//
// Что считается одним глаголом. У Викисловаря отдельные статьи бывают и у формы настоящего времени
// (აკეთებს), и у формы будущего (გააკეთებს), и на обеих — полная таблица с одним и тем же настоящим.
// Для ученика это один глагол, поэтому таблицы группируются по форме 3-го лица настоящего времени:
//   • лемма карточки — эта форма; основная таблица и толкование — со страницы, названной ею;
//     остальные таблицы той же страницы (другой преверб в будущем/аористе) идут в alt — по ним
//     разбор находит форму, в карточке они не показаны;
//   • страница будущей формы, чья таблица совпадает с таблицей страницы настоящего, — дубль,
//     она просто сливается (ссылка остаётся в pages);
//   • страница будущей формы с ДРУГИМ превербом, которого на странице настоящего нет (აღწერს
//     «опишет» при წერს «пишет»), в карточку не подмешивается: это отдельное слово со своим
//     значением, а настоящее в её таблице шаблон получил, отрезав преверб. Уходит в rejected;
//   • если у формы настоящего есть своя статья, но без таблицы, а таблица есть только на странице
//     будущей формы — лемма и толкование берутся из статьи, формы из таблицы (lemmaFrom: "entry");
//   • если у формы настоящего статьи нет вовсе, лемму подтвердить нечем (шаблон мог отрезать
//     преверб и получить несуществующее или другое слово: მიმართავს → მართავს) — в rejected;
//   • таблица без ряда настоящего времени карточкой стать не может (см. SUPPLETIVE и rejected).
import { createReadStream, readFileSync, writeFileSync, existsSync } from 'fs'
import { createInterface } from 'readline'
import { createHash } from 'crypto'
import { dirname, resolve, basename } from 'path'
import { fileURLToPath } from 'url'
import { tablesOf, glossesOf, headMasdar, crossCheck, TENSES } from './kaikki.mjs'
import { formatJson } from './format.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const dumpPath = process.argv.slice(2).find(a => !a.startsWith('--')) ?? process.env.KAIKKI_KA
const outFile = resolve(here, 'verbs.raw.json')
if (!dumpPath || !existsSync(dumpPath)) {
  console.error('Нужен путь к выгрузке kaikki (аргумент или KAIKKI_KA). Где скачать — scripts/verbs/SOURCES.md.')
  process.exit(2)
}

// У глаголов движения на странице несколько таблиц (с разными приставками). Здесь — какая основная:
// «идти» берём с წა- в будущем и прошедшем, как это дают на уроках. Остальные таблицы уходят в alt.
const MAIN_TABLE = { 'მიდის': 1 }

// Супплетивные пары: настоящее и будущее/аорист — разные корни и разные статьи Викисловаря.
// Ключ — статья с настоящим временем, значение — статья, из которой берутся ряды будущего и аориста.
// Формы по-прежнему только из выгрузки; вручную задано лишь то, что это один глагол
// (в статье სვამს статья დალევს указана в «related terms»). Свои ряды будущего у статьи-ключа при
// этом отбрасываются: у სვამს они с превербом შე- и относятся к другому значению («сажать»).
const SUPPLETIVE = { 'სვამს': 'დალევს' }

// Таблицы-матрицы «кто × кого», из которых берётся строка с объектом 3-го лица (см. tablesOf в
// kaikki.mjs). Список задан вручную: что таблица именно такая, проверяется глазами по статье.
//   უყვარს «любить» — сверено с живой страницей (ревизия 93143363 от 30.09.2026): шесть рядов совпали;
//   аориста в таблице нет, ряд перфекта выгрузка отдаёт без подписи времени — он пропускается.
const OBJECT_MATRIX = new Set(['უყვარს'])

const sourceUrl = word => `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}#Georgian`
const serial = tenses => JSON.stringify(TENSES.map(k => tenses[k] ?? null))
// Слова-переводы из толкований: «to sell; to betray» → sell, betray (без пояснений в скобках).
const glossWords = entry => [...new Set(glossesOf(entry).flatMap(g => g.gloss.replace(/\([^)]*\)/g, '').split(/[,;]/))
  .map(s => s.trim().replace(/^to /, '').trim()).filter(Boolean))]
const enOf = entry => glossesOf(entry).map(g => (g.labels.length ? `(${g.labels.join(', ')}) ` : '') + g.gloss)

// ── чтение выгрузки ──────────────────────────────────────────────────────────────────────────
const entries = []
const otherWords = new Set()   // не-глаголы: заглавные слова статей
const otherForms = new Set()   // …и их падежные формы
const hash = createHash('sha256')
let total = 0
const stream = createReadStream(dumpPath)
stream.on('data', chunk => hash.update(chunk))
for await (const line of createInterface({ input: stream })) {
  if (!line) continue
  const e = JSON.parse(line)
  if (e.lang_code !== 'ka') continue
  if (e.pos !== 'verb') {
    // Самостоятельные слова (масдар — тоже: «verbal noun of …» это существительное) и их словоформы
    // из таблиц склонения (დის — и «течёт», и «сестры»). Статья-«падежная форма» сама не в счёт:
    // эта форма придёт из таблицы склонения своей леммы.
    const real = x => (x.tags ?? []).includes('noun-from-verb') || (!x.form_of && !x.alt_of && !(x.tags ?? []).includes('form-of'))
    if ((e.senses ?? []).some(real)) {
      otherWords.add(e.word)
      for (const f of e.forms ?? []) if (f.source === 'declension' && /^[ა-ჰ]+$/.test(f.form)) otherForms.add(f.form)
    }
    continue
  }
  total++
  entries.push(e)
}

// ── записи → таблицы ─────────────────────────────────────────────────────────────────────────
const rejected = []
const reject = (word, reason) => rejected.push({ word, reason })
const pages = []            // { word, entry, tables }
let mappingChecked = 0
const mappingDiffs = []
for (const entry of entries) {
  const objectMatrix = OBJECT_MATRIX.has(entry.word)
  const tables = tablesOf(entry, { objectMatrix })
  if (!tables.length) { reject(entry.word, 'в статье нет таблицы спряжения'); continue }
  if (objectMatrix) for (const t of tables) t.objectMatrix = true
  const junk = tables.flatMap(t => t.junk)
  if (tables.some(t => t.matrix)) { reject(entry.word, 'таблица-матрица (лицо субъекта × лицо объекта) — в шесть лиц не укладывается'); continue }
  if (junk.length) { reject(entry.word, `в ячейках не только грузинские формы (${junk.slice(0, 2).join('; ')})`); continue }
  // Самопроверка разметки: позиционные аргументы шаблона против разбора по тегам.
  const diffs = crossCheck(entry)
  if (diffs) { mappingChecked++; mappingDiffs.push(...diffs.filter(d => !d.startsWith('таблиц по тегам'))) }
  pages.push({ word: entry.word, entry, tables })
}
if (mappingDiffs.length) {
  console.error(`Разметка времён/лиц расходится с аргументами шаблонов (${mappingDiffs.length}):\n` + mappingDiffs.slice(0, 20).join('\n'))
  process.exit(1)
}

// ── таблицы → глаголы ────────────────────────────────────────────────────────────────────────
const groups = new Map()    // форма 3 л. ед. ч. настоящего → [{ page, table, index }]
const suppletiveSources = new Set(Object.values(SUPPLETIVE))
for (const page of pages) {
  page.tables.forEach((table, index) => {
    const p3 = table.tenses.present?.[2]?.[0]
    if (!p3) {
      if (!suppletiveSources.has(page.word)) reject(page.word, 'в таблице нет ряда настоящего времени (страница формы будущего без пары)')
      return
    }
    if (!groups.has(p3)) groups.set(p3, [])
    groups.get(p3).push({ page, table, index })
  })
}

const byWord = new Map()
// Глагольная статья по заглавному слову; если их несколько — та, где есть толкование, а не «форма от…».
for (const e of entries) if (!byWord.has(e.word) || (!glossesOf(byWord.get(e.word)).length && glossesOf(e).length)) byWord.set(e.word, e)

const verbs = []
for (const [lemma, members] of groups) {
  const own = members.filter(m => m.page.word === lemma)
  const foreign = members.filter(m => m.page.word !== lemma)
  const ownEntry = byWord.get(lemma)
  if (!ownEntry) {
    for (const w of new Set(foreign.map(m => m.page.word)))
      reject(w, `страница будущей формы; у настоящего «${lemma}» из её таблицы нет своей статьи — лемму подтвердить нечем`)
    continue
  }
  // Статья есть, таблицы в ней нет: таблицу со страницы будущей формы берём, только если
  // толкования двух статей пересекаются хотя бы одним словом-переводом (ყიდის «to sell» ←
  // გაყიდის «to sell»). Иначе это омоним: რთავს «украшает» и ჩართავს «включит» — разные глаголы.
  const ownWords = glossWords(ownEntry)
  const sameSense = m => glossWords(m.page.entry).some(w => ownWords.includes(w))
  if (!own.length) {
    for (const w of new Set(foreign.filter(m => !sameSense(m)).map(m => m.page.word)))
      reject(w, `страница будущей формы: толкование не пересекается со статьёй «${lemma}» — нечем подтвердить, что это тот же глагол`)
    if (!foreign.some(sameSense)) continue
  }
  const candidates = own.length ? own : foreign.filter(sameSense)
  const preferred = MAIN_TABLE[lemma]
  const main = (preferred !== undefined && own.find(m => m.index === preferred)) || candidates[0]
  const notes = []
  let tenses = main.table.tenses

  const partner = SUPPLETIVE[lemma]
  if (partner) {
    const other = pages.find(p => p.word === partner)?.tables[0]
    if (!other) { console.error(`SUPPLETIVE: нет таблицы у ${partner}`); process.exit(1) }
    const presentSeries = ['present', 'imperfect', 'presentSubjunctive']
    tenses = Object.fromEntries(TENSES
      .map(k => [k, presentSeries.includes(k) ? main.table.tenses[k] : other.tenses[k]])
      .filter(([, row]) => row))
    notes.push(`будущее и аорист взяты из статьи ${partner} (супплетивная пара, задана вручную в extract-kaikki.mjs)`)
  }

  const alt = [], seen = new Set([serial(main.table.tenses)])
  const merged = [main.page]
  for (const m of candidates) {
    if (m === main || seen.has(serial(m.table.tenses)) || partner) continue
    seen.add(serial(m.table.tenses))
    alt.push(m.table.tenses)
    if (!merged.includes(m.page)) merged.push(m.page)
  }
  if (own.length) {
    for (const m of foreign) {
      if (seen.has(serial(m.table.tenses))) { if (!merged.includes(m.page)) merged.push(m.page) }
      else reject(m.page.word, `страница будущей формы: преверба нет на странице «${lemma}», в её карточку не подмешивается`)
    }
  }

  if (!own.length) notes.push(`таблицы у статьи нет: формы взяты из таблицы на странице ${main.page.word}`)
  if (!own.length && alt.length) notes.push(`ещё ${alt.length} таблиц(ы) с другими превербами со страниц будущих форм — в alt`)
  if (main.table.extraBlock) notes.push('в таблице есть второй блок (страдательный залог) — не используется')
  if (main.table.objectMatrix) notes.push('таблица-матрица «кто × кого»: взята строка с объектом 3-го лица, клетки с другим объектом не используются')
  if (main.table.unlabeledRows) notes.push(`в таблице ${main.table.unlabeledRows} ряд(а) без подписи времени — пропущены`)
  const homographs = [...new Set(own.map(m => m.page.entry))]
  for (const e of homographs.slice(1)) if (!merged.some(p => p.entry === e)) merged.push(pages.find(p => p.entry === e))
  if (homographs.length > 1) notes.push(`на странице ${homographs.length} глагольных статьи-омонима — проверьте перевод`)

  // Масдар: «короткий» (несовершенный вид) и с превербом (совершенный) — из шапки таблицы;
  // если их нет — из заголовка статьи. Сама лемма масдаром не считается (так сломана таблица у არის).
  const m = main.table.masdar
  const clean = list => [...new Set(list)].filter(x => x !== lemma)
  const masdar = { imperfective: clean(m.imperfective), perfective: clean(m.perfective), head: headMasdar(ownEntry) }

  const allForms = [...new Set([tenses, ...alt].flatMap(t => Object.values(t).flat(2)))].sort()
  verbs.push({
    lemma,
    lemmaFrom: own.length ? 'page' : 'entry',
    masdar,
    en: enOf(own.length ? main.page.entry : ownEntry),
    tenses,
    alt,
    source: sourceUrl(main.page.word),
    // Все статьи Викисловаря, чьи таблицы вошли в карточку, с их толкованиями — для проверки.
    // Формы, совпадающие с самостоятельным не-глаголом (დაწერა — и «написал», и «написание»; უნდა —
    // и «хочет», и частица «надо»): не учитываются ни в частотности, ни при подборе предложений.
    homographs: allForms.filter(f => otherWords.has(f)),
    // Формы, совпадающие с падежной формой не-глагола (მოდის — и «идёт», и «моды»): в частотности не
    // учитываются, чтобы существительное не накручивало глагол; предложения по ним подбираются.
    homographForms: allForms.filter(f => !otherWords.has(f) && otherForms.has(f)),
    pages: merged.map(p => ({ word: p.word, url: sourceUrl(p.word), en: enOf(p.entry) })),
    notes
  })
}
for (const word of suppletiveSources) if (!Object.values(SUPPLETIVE).some(w => pages.some(p => p.word === w))) reject(word, 'нет таблицы')

verbs.sort((a, b) => (a.lemma < b.lemma ? -1 : a.lemma > b.lemma ? 1 : 0))
rejected.sort((a, b) => (a.word < b.word ? -1 : a.word > b.word ? 1 : a.reason < b.reason ? -1 : 1))

// Не затираем базу, если из новой выгрузки пропала часть глаголов.
const before = (() => { try { return JSON.parse(readFileSync(outFile, 'utf8')).verbs?.length ?? 0 } catch { return 0 } })()
if (verbs.length < before && !process.argv.includes('--force')) {
  console.error(`Собрано ${verbs.length}, а в verbs.raw.json было ${before}. Файл не тронут (--force, чтобы записать).`)
  process.exit(1)
}

writeFileSync(outFile, formatJson({
  dump: { file: basename(dumpPath), sha256: hash.digest('hex'), verbEntries: total },
  verbs,
  // Глагольные статьи, которые в каталог попасть не могут, и почему (без «нет таблицы» — их ~1800).
  rejected: rejected.filter(r => r.reason !== 'в статье нет таблицы спряжения'),
  // Статьи без таблицы спряжения: по этому списку видно, что слово в Викисловаре есть, а форм нет.
  noTable: rejected.filter(r => r.reason === 'в статье нет таблицы спряжения').map(r => r.word)
}) + '\n')
console.error(`Глагольных статей: ${total}, с пригодной таблицей: ${pages.length}, глаголов: ${verbs.length}`)
console.error(`Сверка разметки с аргументами шаблонов: ${mappingChecked} статей, расхождений 0`)
console.error(`Отброшено: ${rejected.length} (из них без таблицы ${rejected.filter(r => r.reason === 'в статье нет таблицы спряжения').length}) → ${outFile}`)
