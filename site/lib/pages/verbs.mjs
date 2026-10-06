// /verbs/ — one page per verb of the catalog and the index. Everything Georgian on these pages is
// read from verbs.json; the Russian copy around it is assembled from the catalog's own fields
// (ru, reason, meanings, meaningChips) and fixed phrases below.

import { esc, ka } from '../template.mjs'
import { MAIN_TENSES, RARE_TENSES, ALL_TENSES, TENSES, PERSONS, cyr, cell } from '../data/verbs.mjs'

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const tr = (text) => `<span class="tr">${esc(cyr(text))}</span>`
/** A verb form with its transcription: «მივდივარ» + «мивдивар». */
export const form = (variants) => `${ka(cell(variants), 'f')} ${tr(cell(variants))}`
/** Inline: მივდივარ (мивдивар). */
export const inlineForm = (variants) => `${ka(cell(variants), 'f')} (${esc(cyr(cell(variants)))})`
const term = (t) => `<span class="term">в учебниках — ${esc(t)}</span>`

/** One time as a card: heading by what the time says, six persons, phrase → form. */
export function tenseCard(verb, table, key, { level = 'h3', id = '', meanings = true } = {}) {
  const rows = table[key]
  if (!rows || !rows.some((c) => c.length)) return ''
  const chip = meanings && verb.meaningChips?.[key] ? ` <span class="chip">${esc(verb.meaningChips[key])}</span>` : ''
  const body = rows
    .map((variants, p) => {
      if (!variants.length) return ''
      const phrase = (meanings && verb.meanings?.[key]?.[p]) || PERSONS[p]
      return `<tr><td>${esc(phrase)}</td><td>${form(variants)}</td></tr>`
    })
    .join('')
  return `<section class="tense"${id ? ` id="${id}"` : ''}><${level}>${esc(TENSES[key].name)}${chip} ${term(TENSES[key].term)}</${level}><table class="forms"><tbody>${body}</tbody></table></section>`
}

/** Up to `max` sentences, different forms first — so the examples show the verb in different persons and times. */
export function pickSentences(verb, max = 5) {
  const picked = []
  const seenForms = new Set()
  for (const s of verb.sentences) if (picked.length < max && !seenForms.has(s.form)) { picked.push(s); seenForms.add(s.form) }
  for (const s of verb.sentences) if (picked.length < max && !picked.includes(s)) picked.push(s)
  return picked
}

/**
 * «Как сказать по-грузински»: phrase → form(s). Two times that read the same in Russian
 * («я писал(а)») are one question with both answers, told apart by the catalog's own notes.
 */
export function sayItems(verb) {
  const wanted = [['present', 0], ['present', 1], ['present', 2], ['present', 3], ['aorist', 0], ['imperfect', 0], ['future', 0], ['optative', 0]]
  const items = []
  for (const [tense, p] of wanted) {
    const phrase = verb.meanings?.[tense]?.[p]
    const variants = verb.tenses[tense]?.[p]
    if (!phrase || !variants?.length) continue
    let item = items.find((x) => x.phrase === phrase)
    if (!item) items.push((item = { phrase, answers: [] }))
    item.answers.push({ variants, note: verb.meaningChips?.[tense] || '' })
  }
  return items
}

const sayAnswerText = (item) =>
  item.answers.map((a) => `${cell(a.variants)} (${cyr(cell(a.variants))})${item.answers.length > 1 && a.note ? ` — ${a.note}` : ''}`).join('; ')
const sayAnswerHtml = (item) =>
  item.answers.map((a) => `${inlineForm(a.variants)}${item.answers.length > 1 && a.note ? ` — ${esc(a.note)}` : ''}`).join('; ')

function similarVerbs(verb, verbs, max = 6) {
  const pool = verbs.filter((v) => v !== verb && v.lemma !== verb.model?.id)
  const near = (a, b) => Math.abs(a.rank - verb.rank) - Math.abs(b.rank - verb.rank)
  const sameAction = pool.filter((v) => v.title === verb.title)
  const sameReason = pool.filter((v) => v.reason === verb.reason && v.kind === verb.kind && !sameAction.includes(v)).sort(near)
  const sameKind = pool.filter((v) => v.kind === verb.kind && !sameAction.includes(v) && !sameReason.includes(v)).sort(near)
  return [...sameAction, ...sameReason, ...sameKind].slice(0, max)
}

const verbLink = (v) => `<a href="${v.path}">${esc(v.gloss)} — ${ka(v.lemma)}</a>`

function behaviour(verb, byLemma, verbs) {
  const parts = []
  const model = verb.model ? byLemma.get(verb.model.id) : null
  if (verb.kind === 'pattern') {
    parts.push(model ? `Спрягается по образцу: окончания те же, что у глагола <a href="${model.path}">${ka(model.lemma)} «${esc(model.ru)}»</a>.` : 'Спрягается по образцу: окончания обычные.')
  } else if (verb.kind === 'feature') {
    parts.push(model ? `Окончания как у <a href="${model.path}">${ka(model.lemma)} «${esc(model.ru)}»</a>, но с особенностью.` : 'Спрягается с особенностью.')
  } else {
    parts.push('Особый глагол: под общий образец не подходит.')
  }
  parts.push(esc(verb.reason).replace(/[ა-ჿ]+-?/g, (m) => `<span lang="ka">${m}</span>`))
  if (verb.root.length >= 2) parts.push(`Корень — ${ka(verb.root)} (${esc(cyr(verb.root))}).`)
  if (verb.oddTenses.length) parts.push(`Другой корень в этих временах: ${verb.oddTenses.map((t) => `«${esc(TENSES[t].name.toLowerCase())}»`).join(', ')}.`)
  const missing = MAIN_TENSES.filter((t) => !verb.tenses[t])
  if (missing.length) parts.push(`В источнике нет форм для времён ${missing.map((t) => `«${esc(TENSES[t].name.toLowerCase())}»`).join(', ')} — на странице только то, что есть.`)
  if (ALL_TENSES.some((t) => verb.tenses[t]?.some((c) => c.length > 1))) parts.push('Через косую черту — равноправные варианты одной формы.')
  const action = verb.title !== verb.lemma
    ? `<p>Название действия — ${ka(verb.title)} (${esc(cyr(verb.title))})${verb.masdarWithPreverb.length ? `, с приставкой — ${verb.masdarWithPreverb.map((m) => `${ka(m)} (${esc(cyr(m))})`).join(', ')}` : ''} <span class="term">в учебниках — масдар</span>.</p>`
    : ''
  const similar = similarVerbs(verb, verbs)
  return `<h2 id="how">Как ведёт себя этот глагол</h2>
<p>${parts.join(' ')}</p>
${action}
${similar.length ? `<p>Похожие глаголы:</p><ul class="vlist">${similar.map((v) => `<li>${verbLink(v)}</li>`).join('')}</ul>` : ''}`
}

/** Times of a parallel table that differ from the main one (the shared ones are not repeated). */
const differingTenses = (verb, table) => ALL_TENSES.filter((t) => table[t] && JSON.stringify(table[t]) !== JSON.stringify(verb.tenses[t]))

function altBlocks(verb) {
  return verb.alt
    .map((table) => {
      const keys = differingTenses(verb, table)
      const head = table.future?.[0] ?? table.aorist?.[0] ?? table[keys[0]]?.[0]
      if (!keys.length || !head?.length) return ''
      return `<details><summary>С другой приставкой: ${inlineForm(head)}</summary><div class="in">
<p>Тот же глагол с другой приставкой — оттенок значения другой. Отдельного перевода для этой таблицы в базе нет, поэтому формы без русских фраз. Времена, которые совпадают с основной таблицей, не повторяются.</p>
<div class="tenses">${keys.map((k) => tenseCard(verb, table, k, { level: 'h4', meanings: false })).join('')}</div></div></details>`
    })
    .join('')
}

export function verbPage(verb, { verbs, byLemma, config, updated }) {
  const main = MAIN_TENSES.filter((t) => verb.tenses[t])
  const rare = RARE_TENSES.filter((t) => verb.tenses[t])
  const say = sayItems(verb)
  const sentences = pickSentences(verb)
  const i1 = verb.tenses.present?.[0]
  const m = (t) => (verb.meanings?.[t]?.[0] && verb.tenses[t]?.[0]?.length ? `${verb.meanings[t][0]} — ${cell(verb.tenses[t][0])} (${cyr(cell(verb.tenses[t][0]))})` : '')
  const descForms = [m('present'), m('aorist') || m('imperfect'), m('future')].filter(Boolean).join(', ')

  const title = `Глагол «${verb.ru}» по-грузински: спряжение ${verb.lemma} (${verb.cyr}) по временам`
  const h1 = `Спряжение глагола «${verb.gloss}» по-грузински: ${verb.lemma}`
  const description = `Как спрягается грузинский глагол ${verb.lemma} (${verb.cyr}) — «${verb.ru}»: ${descForms}. Таблица по лицам и временам с переводом каждой формы и транскрипцией русскими буквами.`

  const he = verb.meanings?.present?.[2]
  const sub = `<p class="sub"><b>${ka(verb.lemma)}</b> (${esc(verb.cyr)}) — «${esc(verb.ru)}»${he ? `, дословно «${esc(he)}»` : ''}.</p>`
  const jump = `<ul class="jump">${main.map((t) => `<li><a href="#t-${t}">${esc(JUMP[t])}</a></li>`).join('')}${say.length ? '<li><a href="#say">Как сказать</a></li>' : ''}${sentences.length ? '<li><a href="#examples">Примеры</a></li>' : ''}</ul>`

  const body = `<article>
<div class="eyebrow">Грузинские глаголы</div>
<h1>${esc(h1)}</h1>
${sub}
${jump}
<div class="tenses">${main.map((t) => tenseCard(verb, verb.tenses, t, { id: `t-${t}` })).join('')}</div>
<p class="inline-cta">В мини-аппе TraleBot есть тренировка именно этого глагола: формы по лицам и временам в коротких играх. <a href="https://t.me/${config.botUsername}?start=seo_verbs_${verb.slug}" target="_blank" rel="noopener">Открыть в Telegram</a></p>
${say.length ? `<h2 id="say">Как сказать по-грузински</h2>
<dl class="say">${say.map((x) => `<dt>Как будет «${esc(x.phrase)}» по-грузински?</dt><dd>${sayAnswerHtml(x)}</dd>`).join('')}</dl>` : ''}
${behaviour(verb, byLemma, verbs)}
${sentences.length ? `<h2 id="examples">Примеры с переводом</h2>
${sentences.map((s) => `<div class="ex"><p class="k">${ka(s.ka)}</p><p class="tr">${esc(cyr(s.ka))}</p><p class="r">${esc(s.ru)}</p><p class="src">Форма ${ka(s.form, 'f')} · <a href="https://tatoeba.org/sentences/show/${s.id}" rel="noopener nofollow">Tatoeba №${s.id}</a></p></div>`).join('')}` : ''}
${rare.length ? `<h2 id="rare">Редкие времена</h2>
<details><summary>Показать ещё ${rare.length}: ${rare.map((t) => esc(TENSES[t].name.toLowerCase())).join(', ')}</summary><div class="in"><p>Эти формы нужны реже. Сначала хватит шести времён выше.</p><div class="tenses">${rare.map((t) => tenseCard(verb, verb.tenses, t, { level: 'h3', id: `t-${t}` })).join('')}</div></div></details>` : ''}
${verb.alt.length ? `<h2 id="alt">Этот же глагол с другими приставками</h2>${altBlocks(verb)}` : ''}
<p class="sources">Источники. Формы: <a href="${esc(verb.source)}" rel="noopener nofollow">Викисловарь, статья ${ka(verb.lemma)}</a> (CC BY-SA 4.0).${sentences.length ? ' Примеры: <a href="https://tatoeba.org" rel="noopener nofollow">Tatoeba</a> (CC BY 2.0 FR), ссылка у каждого предложения.' : ''} Русские фразы к формам — TraleBot. В транскрипции знак ’ после буквы — резкий звук без выдоха, подробнее в <a href="/grammar/alphabet/">алфавите</a>.</p>
</article>`

  const prev = verbs[verb.rank - 2]
  const next = verbs[verb.rank]
  const related = [prev, next].filter(Boolean).map((v) => ({ path: v.path, title: `${cap(v.ru)} — ${v.lemma}`, description: `Спряжение глагола ${v.lemma} (${v.cyr})` }))

  return {
    section: 'verbs',
    slug: verb.slug,
    path: verb.path,
    title,
    h1,
    description,
    body,
    crumbs: [{ title: 'Главная', path: '/' }, { title: 'Глаголы', path: '/verbs/' }, { title: `${cap(verb.gloss)} — ${verb.lemma}`, path: verb.path }],
    ctaTag: `seo_verbs_${verb.slug}`,
    cta: { heading: `Потренировать глагол «${verb.gloss}»`, text: 'В мини-аппе TraleBot этот глагол разобран по формам: сначала таблица, потом короткие игры на лица и времена.' },
    related,
    relatedHeading: 'Соседние глаголы',
    backLink: { path: '/verbs/', label: 'Все грузинские глаголы' },
    updated,
    ld: say.length
      ? [{ '@type': 'FAQPage', mainEntity: say.map((x) => ({ '@type': 'Question', name: `Как будет «${x.phrase}» по-грузински?`, acceptedAnswer: { '@type': 'Answer', text: sayAnswerText(x) } })) }]
      : [],
    sitemap: { changefreq: 'monthly', priority: verb.rank <= 30 ? '0.8' : '0.6' },
    i1
  }
}

/** Short labels for the row of jump links; the full names are the headings of the cards. */
const JUMP = { present: 'Сейчас', aorist: 'Сделал', imperfect: 'Делал', optative: 'Надо', conditional: 'Бы', future: 'Будущее' }

export function verbsIndex({ verbs, config, updated, extraLinks = [] }) {
  const tiers = []
  for (let i = 0; i < verbs.length; i += 30) tiers.push(verbs.slice(i, i + 30))
  const row = (v) => {
    const i1 = v.tenses.present?.[0] || []
    const phrase = v.meanings?.present?.[0]
    return `<tr><td><a href="${v.path}">${esc(v.ru)}</a><span class="tr">${ka(v.lemma)} · ${esc(v.cyr)}</span></td><td>${phrase ? `${esc(phrase)}<br>` : ''}${form(i1)}</td></tr>`
  }
  const tierId = (i) => `top-${i * 30 + 1}`
  const tierName = (t, i) => (i === 0 ? `Самые частые: 1–${t.length}` : `Глаголы ${i * 30 + 1}–${i * 30 + t.length}`)

  const letters = new Map()
  for (const v of [...verbs].sort((a, b) => a.ru.localeCompare(b.ru, 'ru'))) {
    const l = v.gloss[0].toUpperCase()
    if (!letters.has(l)) letters.set(l, [])
    letters.get(l).push(v)
  }

  const title = `Грузинские глаголы: список из ${verbs.length} глаголов с переводом и спряжением`
  const h1 = 'Грузинские глаголы: список с переводом и таблицами спряжения'
  const description = `${verbs.length} самых частых грузинских глаголов: перевод, форма «я» с транскрипцией русскими буквами и полная таблица спряжения по временам у каждого. От частых к редким и по алфавиту.`

  const body = `<article>
<div class="eyebrow">Справочник</div>
<h1>${esc(h1)}</h1>
<p class="lead">${verbs.length} глаголов от частых к редким. У каждого — перевод, форма «я» в настоящем времени и своя страница с таблицей по лицам и временам.</p>
<ul class="jump">${tiers.map((t, i) => `<li><a href="#${tierId(i)}">${i * 30 + 1}–${i * 30 + t.length}</a></li>`).join('')}<li><a href="#az">По алфавиту</a></li></ul>
${extraLinks.length ? `<p>Разборы по темам: ${extraLinks.map((l) => `<a href="${l.path}">${esc(l.label)}</a>`).join(', ')}.</p>` : ''}
${tiers.map((t, i) => `<h2 id="${tierId(i)}">${tierName(t, i)}</h2>
<div class="table-wrap"><table class="ref"><thead><tr><th>Глагол</th><th>Форма «я» сейчас</th></tr></thead><tbody>${t.map(row).join('')}</tbody></table></div>`).join('\n')}
<h2 id="az">По алфавиту</h2>
${[...letters].map(([l, list]) => `<p class="az"><b>${l}</b> ${list.map((v) => `<a href="${v.path}">${esc(v.ru)}</a>`).join(' · ')}</p>`).join('\n')}
<p class="sources">Источники. Формы — <a href="https://en.wiktionary.org/wiki/Category:Georgian_verbs" rel="noopener nofollow">Викисловарь</a> (CC BY-SA 4.0), примеры на страницах глаголов — <a href="https://tatoeba.org" rel="noopener nofollow">Tatoeba</a> (CC BY 2.0 FR). Порядок — по частоте в корпусах Leipzig Corpora Collection (CC BY 4.0).</p>
</article>`

  return {
    section: 'verbs',
    slug: 'index',
    path: '/verbs/',
    title,
    h1,
    description,
    body,
    crumbs: [{ title: 'Главная', path: '/' }, { title: 'Глаголы', path: '/verbs/' }],
    ctaTag: 'seo_verbs_index',
    cta: { heading: 'Учить глаголы в Telegram', text: 'В мини-аппе TraleBot эти же глаголы отрабатываются в коротких играх: от формы «я» до всех времён.' },
    related: [],
    updated,
    hub: true,
    hubParts: verbs.map((v) => ({ path: v.path, name: `${v.ru} — ${v.lemma}` })),
    ld: [],
    sitemap: { changefreq: 'weekly', priority: '0.9' }
  }
}
