// Разбор записей Wiktextract (kaikki.org) для грузинских глаголов: forms[] → таблицы спряжения.
// Формы берутся только из выгрузки; пустая ячейка остаётся пустой, ничего не достраивается.

export const TENSES = [
  'present', 'imperfect', 'presentSubjunctive',
  'future', 'conditional', 'futureSubjunctive',
  'aorist', 'optative',
  'perfect', 'pluperfect', 'perfectSubjunctive'
]

const PERSON = { 'first-person': 0, 'second-person': 1, 'third-person': 2 }
const GEO = /^[ა-ჰ]+$/

// Wiktextract размечает ячейку набором тегов из заголовков строки и столбца. У Викисловаря два
// поколения таблиц, и теги у них разные:
//   новые шаблоны (ka-conj-table-*):  imperfect | conditional | optative | pluperfect
//   старые (ka-conj-movement, ყოფნა): imperfect+present | conditional+future | aorist+optative | perfect+pluperfect
// (у старых к времени приклеивается заголовок серии). Поэтому порядок проверок важен: сначала
// более узкий признак, потом серия. Сверено с позиционными аргументами шаблонов — см. crossCheck().
export function tenseOf(tags) {
  const has = t => tags.includes(t)
  if (has('imperative') || has('participle') || has('noun-from-verb')) return null
  if (has('subjunctive')) return has('present') ? 'presentSubjunctive' : has('future') ? 'futureSubjunctive' : has('perfect') ? 'perfectSubjunctive' : null
  if (has('pluperfect')) return 'pluperfect'
  if (has('optative')) return 'optative'
  if (has('conditional')) return 'conditional'
  if (has('imperfect')) return 'imperfect'
  if (has('aorist')) return 'aorist'
  if (has('perfect')) return 'perfect'
  if (has('future')) return 'future'
  if (has('present')) return 'present'
  return null
}

export function personOf(tags) {
  const p = Object.keys(PERSON).filter(t => tags.includes(t))
  const sg = tags.includes('singular'), pl = tags.includes('plural')
  if (p.length !== 1 || sg === pl) return null
  return PERSON[p[0]] + (pl ? 3 : 0)
}

// Варианты в одной ячейке Викисловарь пишет через «/» или запятую. Пустую ячейку — прочерком, «n/a»
// или незаполненной ссылкой («Term?»). Всё прочее, что не чисто грузинское слово (латиница, пометы,
// нераскрытые параметры шаблона вроде {{{SNM}}}), в ячейку не попадает, а возвращается в junk:
// запись с таким мусором в каталог не идёт целиком.
const EMPTY = /^(?:[-—–]+|n\/a|Term\?)$/i
function splitCell(text) {
  const cell = text.trim()
  if (!cell || EMPTY.test(cell)) return { forms: [], junk: [] }
  const parts = cell.split(/[\/,]/).map(s => s.trim()).filter(Boolean)
  return { forms: parts.filter(p => GEO.test(p)), junk: parts.filter(p => !GEO.test(p) && !EMPTY.test(p)) }
}

/**
 * Таблицы одной записи. Каждая таблица начинается служебной формой с тегом table-tags.
 *
 * В одной вики-таблице бывает два блока: действительный залог и рядом страдательный (шаблоны
 * ka-conj-table, ka-conj-present-ამ). Wiktextract отдаёт их формы с одинаковыми тегами, и отличить
 * «вторую половину таблицы» от «второго варианта в той же ячейке» можно только по порядку:
 * варианты одной ячейки идут подряд, а второй блок начинается, когда уже пройденная ячейка
 * встречается снова после других. Берём только первый блок; второй — это другой глагол
 * (страдательный), у которого на странице нет ни толкования, ни своей статьи, поэтому он не
 * используется, а факт отмечается в extraBlock.
 *
 * Возвращает [{ masdar: {imperfective, perfective}, tenses, junk, unlabeledRows, extraBlock, matrix }].
 */
export function tablesOf(entry) {
  const tables = []
  let cur = null, seen = null, last = null
  for (const f of entry.forms ?? []) {
    const tags = f.tags ?? []
    if (tags.includes('table-tags')) {
      cur = { masdar: { imperfective: [], perfective: [] }, tenses: {}, junk: [], unlabeled: 0, extraBlock: false, matrix: false }
      seen = new Set(); last = null
      tables.push(cur)
      continue
    }
    if (!cur || f.source !== 'conjugation' || tags.includes('inflection-template')) continue
    if (tags.includes('noun-from-verb')) {
      const slot = tags.includes('imperfective') ? 'imperfective' : tags.includes('perfective') ? 'perfective' : null
      if (slot) cur.masdar[slot].push(...splitCell(f.form).forms)
      continue
    }
    if (tags.includes('imperative') || tags.includes('participle')) continue
    const tense = tenseOf(tags)
    const person = personOf(tags)
    // Ряд без подписи времени (в рукописных таблицах так остаётся перфект) не угадываем.
    if (!tense || person === null) { cur.unlabeled++; continue }
    const key = `${tense}:${person}`
    if (key !== last && seen.has(key)) cur.extraBlock = true
    // Новая ячейка после начала второго блока — это уже не «две половины», а матрица
    // (у უყვარს: кто любит × кого любят). В шесть лиц она честно не укладывается.
    else if (cur.extraBlock && !seen.has(key)) cur.matrix = true
    seen.add(key); last = key
    if (cur.extraBlock) continue
    const row = (cur.tenses[tense] ??= [[], [], [], [], [], []])
    const { forms, junk } = splitCell(f.form)
    for (const form of forms) if (!row[person].includes(form)) row[person].push(form)
    cur.junk.push(...junk.map(j => `${tense}[${person}]: ${j}`))
  }
  for (const t of tables) {
    t.unlabeledRows = Math.ceil(t.unlabeled / 6)
    delete t.unlabeled
    // Ряд, в котором все шесть ячеек пусты, — это отсутствующее время, а не шесть пропусков.
    t.tenses = Object.fromEntries(TENSES.filter(k => t.tenses[k]?.some(c => c.length)).map(k => [k, t.tenses[k]]))
  }
  return tables.filter(t => Object.keys(t.tenses).length || t.junk.length)
}

/**
 * Независимая сверка разметки тегами: у шаблонов ka-conj-table-* ячейки лежат позиционными
 * аргументами 10…75 (11 времён × 6 лиц, в порядке TENSES). Возвращает список расхождений.
 */
export function crossCheck(entry) {
  const tpls = (entry.inflection_templates ?? []).filter(t => /^ka-conj-table-transitive$/.test(t.name))
  const tables = tablesOf(entry).filter(t => Object.keys(t.tenses).length)
  const diffs = []
  if (!tpls.length) return null
  if (tpls.length !== tables.length) return [`таблиц по тегам ${tables.length}, шаблонов ${tpls.length}`]
  tpls.forEach((tpl, ti) => {
    TENSES.forEach((tense, r) => {
      for (let p = 0; p < 6; p++) {
        const arg = tpl.args[String(10 + r * 6 + p)] ?? ''
        const expected = splitCell(arg.replace(/<[^>]+>/g, '')).forms
        const got = tables[ti].tenses[tense]?.[p] ?? []
        if (expected.join('/') !== got.join('/')) diffs.push(`${entry.word} #${ti} ${tense}[${p}]: шаблон «${arg}», теги «${got.join('/')}»`)
      }
    })
  })
  return diffs
}

// Толкования без служебных («alternative form of», «verbal noun of» и т.п.).
export function glossesOf(entry) {
  const out = []
  for (const s of entry.senses ?? []) {
    if ((s.tags ?? []).some(t => ['form-of', 'alt-of', 'nonstandard', 'misspelling'].includes(t))) continue
    const g = (s.glosses ?? []).at(-1)
    if (!g) continue
    const labels = (s.raw_tags ?? []).concat((s.tags ?? []).filter(t => ['transitive', 'intransitive', 'ditransitive', 'figuratively', 'colloquial', 'vulgar', 'slang', 'archaic', 'obsolete', 'dated', 'rare'].includes(t)))
    out.push({ gloss: g, labels: [...new Set(labels)].sort() })
  }
  return out
}

// Масдар из заголовка статьи («verbal noun …», параметр vn= шаблона ka-verb).
export function headMasdar(entry) {
  const f = (entry.forms ?? []).find(f => !f.source && (f.tags ?? []).length === 1 && f.tags[0] === 'noun-from-verb')
  return f && GEO.test(f.form) ? f.form : null
}
