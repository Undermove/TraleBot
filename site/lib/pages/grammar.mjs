// Cross-verb pages in /grammar/, generated from the verb catalog: the tables people search for
// («прошедшее время в грузинском», «будущее время», «глаголы движения», «у меня есть»).
// Forms come from verbs.json; the explanations reuse the catalog's own wording (reason,
// meaningChips) and the lesson theory. Nothing here states a rule the data does not show.

import { esc, ka } from '../template.mjs'
import { MAIN_TENSES, ALL_TENSES, TENSES, cyr, cell } from '../data/verbs.mjs'
import { tenseCard, form, inlineForm, pickSentences } from './verbs.mjs'

const term = (t) => `<span class="term">в учебниках — ${esc(t)}</span>`
const vlink = (v) => `<a href="${v.path}">${esc(v.ru)}</a>`
const dash = '—'
const cellOrDash = (variants) => (variants?.length ? form(variants) : dash)
const table = (head, rows, cls = 'ref wide') =>
  `<div class="table-wrap"><table class="${cls}"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
const sources = '<p class="sources">Формы — <a href="https://en.wiktionary.org/wiki/Category:Georgian_verbs" rel="noopener nofollow">Викисловарь</a> (CC BY-SA 4.0), ссылка на статью — на странице каждого глагола. Вторая строка в ячейке — как читать русскими буквами.</p>'

function page(def, updated) {
  return {
    section: 'grammar',
    path: `/grammar/${def.slug}/`,
    crumbs: [{ title: 'Главная', path: '/' }, { title: 'Грамматика', path: '/grammar/' }, { title: def.card, path: `/grammar/${def.slug}/` }],
    ctaTag: `seo_grammar_${def.slug}`,
    cta: { heading: 'Потренировать в TraleBot', text: 'В мини-аппе эти формы отрабатываются на глаголах из таблиц: короткие игры на лица и времена.' },
    backLink: { path: '/grammar/', label: 'Грамматика' },
    updated,
    ld: [],
    sitemap: { changefreq: 'monthly', priority: '0.8' },
    ...def,
    body: `<article>\n<div class="eyebrow">Грамматика</div>\n<h1>${esc(def.h1)}</h1>\n${def.body}\n</article>`
  }
}

export function grammarPages({ verbs, byLemma, theory, lexicons, updated }) {
  const byRu = (ru) => {
    const v = verbs.find((x) => x.ru === ru)
    if (!v) throw new Error(`grammar pages: no verb «${ru}» in the catalog`)
    return v
  }
  const pages = []

  // ---- all times on one verb -------------------------------------------------------------
  {
    const v = byRu('писать')
    const rows = ALL_TENSES.filter((t) => v.tenses[t]).map((t) => [
      `<b>${esc(TENSES[t].name)}</b>${v.meaningChips?.[t] ? ` <span class="chip">${esc(v.meaningChips[t])}</span>` : ''}<br>${term(TENSES[t].term)}`,
      `${v.meanings?.[t]?.[0] ? `${esc(v.meanings[t][0])}<br>` : ''}${form(v.tenses[t][0])}`,
      `${v.meanings?.[t]?.[2] ? `${esc(v.meanings[t][2])}<br>` : ''}${form(v.tenses[t][2])}`
    ])
    pages.push(page({
      slug: 'verb-tenses', order: 40, card: 'Времена глаголов',
      title: 'Времена глаголов в грузинском языке: таблица всех времён с примерами',
      h1: 'Времена в грузинском языке: все формы на одном глаголе',
      description: `Все времена грузинского глагола на примере ${v.lemma} (${v.cyr}) «${v.ru}»: что говорит каждое время, форма «я» и «он» с транскрипцией. Названия простыми словами и как они называются в учебниках.`,
      relatedPaths: ['/grammar/past-tense/', '/grammar/future-tense/', '/verbs/'],
      body: `<p class="lead">У грузинского глагола до одиннадцати наборов форм. Шесть нужны каждый день, остальные встречаются реже. Здесь все они на глаголе ${ka(v.lemma)} (${esc(v.cyr)}) «${esc(v.ru)}».</p>
<p>Времена названы по тому, что они говорят. Мелким шрифтом — как это называется в учебниках.</p>
${table(['Время', 'Я', 'Он'], rows)}
<p>Полная таблица по всем лицам — на странице глагола <a href="${v.path}">«${esc(v.ru)}»</a>. Два прошедших разобраны <a href="/grammar/past-tense/">отдельно</a>, будущее — <a href="/grammar/future-tense/">здесь</a>. Остальные глаголы — в <a href="/verbs/">списке</a>.</p>
${sources}`
    }, updated))
  }

  // ---- two pasts ---------------------------------------------------------------------------
  {
    const both = verbs.filter((v) => v.tenses.aorist && v.tenses.imperfect).slice(0, 20)
    const onePast = verbs.filter((v) => !!v.tenses.aorist !== !!v.tenses.imperfect).slice(0, 12)
    const sample = byRu('писать')
    const chips = sample.meaningChips || {}
    pages.push(page({
      slug: 'past-tense', order: 50, card: 'Прошедшее время',
      title: 'Прошедшее время в грузинском языке: «сделал» и «делал» — таблица на 20 глаголах',
      h1: 'Прошедшее время в грузинском: «сделал» и «делал»',
      description: `Два прошедших времени грузинского глагола на ${both.length} частых глаголах: форма «сделал» и форма «делал» с транскрипцией русскими буквами. Полный разбор по лицам на глаголе ${sample.lemma} «${sample.ru}».`,
      relatedPaths: ['/grammar/future-tense/', '/grammar/verb-tenses/', '/verbs/'],
      body: `<p class="lead">Прошедших времён в грузинском два основных. Первое говорит «сделал»${chips.aorist ? ` — ${esc(chips.aorist)}` : ''} ${term(TENSES.aorist.term)}. Второе говорит «делал»${chips.imperfect ? ` — ${esc(chips.imperfect)}` : ''} ${term(TENSES.imperfect.term)}.</p>
<h2 id="table">Форма «я» в двух прошедших</h2>
${table(['Глагол', 'Сделал', 'Делал'], both.map((v) => [`${vlink(v)}<br>${ka(v.lemma)}`, cellOrDash(v.tenses.aorist[0]), cellOrDash(v.tenses.imperfect[0])]))}
<h2 id="persons">По лицам: ${ka(sample.lemma)} «${esc(sample.ru)}»</h2>
<div class="tenses">${tenseCard(sample, sample.tenses, 'aorist')}${tenseCard(sample, sample.tenses, 'imperfect')}</div>
<p>По-русски обе формы здесь переведены одинаково, разница — в пометке у названия времени.</p>
${onePast.length ? `<h2 id="one">Глаголы, у которых в источнике одно прошедшее</h2>
<p>У этих глаголов в таблице источника есть только одна из двух форм:</p>
<ul class="vlist">${onePast.map((v) => `<li><a href="${v.path}">${esc(v.gloss)} — ${ka(v.lemma)}</a></li>`).join('')}</ul>` : ''}
<p>Таблица любого глагола — в <a href="/verbs/">списке глаголов</a>.</p>
${sources}`
    }, updated))
  }

  // ---- future: grouped by how the catalog says it is built --------------------------------------
  {
    const withFuture = verbs.filter((v) => v.tenses.future && v.tenses.present)
    const groups = new Map()
    for (const v of withFuture) {
      const key = v.kind === 'special' ? 'special' : v.reason
      if (!/Будущее/.test(v.reason) && key !== 'special') continue
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(v)
    }
    const ordered = [...groups].sort((a, b) => (a[0] === 'special') - (b[0] === 'special') || b[1].length - a[1].length)
    const total = ordered.reduce((n, [, list]) => n + Math.min(list.length, 6), 0)
    const section = ([key, list], i) => {
      const heading = key === 'special' ? 'Особые глаголы: будущее надо запомнить' : key.replace(/\.$/, '')
      return `<h2 id="g${i + 1}">${markKa(heading)}</h2>
<p>${list.length === 1 ? 'В каталоге такой глагол один.' : `В каталоге таких глаголов ${list.length}${list.length > 6 ? ', ниже первые шесть по частоте' : ''}.`}</p>
${table(['Глагол', 'Сейчас: я', 'Будущее: я'], list.slice(0, 6).map((v) => [`${vlink(v)}<br>${ka(v.lemma)}`, cellOrDash(v.tenses.present[0]), cellOrDash(v.tenses.future[0])]))}`
    }
    pages.push(page({
      slug: 'future-tense', order: 60, card: 'Будущее время',
      title: 'Будущее время в грузинском языке: как образуется — таблица с примерами',
      h1: 'Будущее время в грузинском: как оно образуется',
      description: `Как образуется будущее время грузинского глагола: с какой приставкой, когда совпадает с настоящим и у каких глаголов его надо запомнить. ${total} глаголов: форма «я» сейчас и в будущем, с транскрипцией.`,
      relatedPaths: ['/grammar/past-tense/', '/grammar/verb-tenses/', '/grammar/verbs-of-motion/'],
      body: `<p class="lead">Чаще всего будущее — это форма настоящего с приставкой, и у каждого глагола приставка своя: её запоминают вместе с глаголом. Ниже глаголы каталога по способу, которым строится будущее.</p>
${ordered.map(section).join('\n')}
<p>Будущее любого глагола по всем лицам — на его странице в <a href="/verbs/">списке глаголов</a>.</p>
${sources}`
    }, updated))
  }

  // ---- motion verbs ------------------------------------------------------------------------------
  {
    const go = byRu('идти, уходить')
    const motion = verbs.filter((v) => v.title.endsWith(go.title))
    const preverbs = (lexicons.get('preverbs-5') || []).filter((p) => !/заверш/.test(p.ru))
    pages.push(page({
      slug: 'verbs-of-motion', order: 70, card: 'Глаголы движения',
      title: 'Глаголы движения в грузинском языке: идти, приходить, входить — таблица',
      h1: 'Глаголы движения в грузинском языке',
      description: `${motion.length} грузинских глаголов движения в одной таблице: идти, приходить, входить, выходить, подниматься, спускаться. Формы «я» сейчас, в прошедшем и будущем с транскрипцией, приставки направления.`,
      relatedPaths: ['/grammar/future-tense/', '/grammar/postpositions/', '/phrases/taxi/'],
      body: `<p class="lead">«Идти», «приходить», «входить», «выходить» по-грузински — один и тот же глагол с разными приставками: приставка показывает, куда направлено движение. В прошедшем и будущем у него другой корень, поэтому формы учат целиком.</p>
<h2 id="table">Форма «я» в трёх временах</h2>
${table(['Глагол', 'Сейчас', 'Прошедшее: сделал', 'Будущее'], motion.map((v) => [`${vlink(v)}<br>${ka(v.lemma)}`, cellOrDash(v.tenses.present?.[0]), cellOrDash(v.tenses.aorist?.[0]), cellOrDash(v.tenses.future?.[0])]), 'ref wide c4')}
<p>Прочерк — в источнике такой формы у глагола нет.</p>
${preverbs.length ? `<h2 id="preverbs">Приставки направления</h2>
${table(['Приставка', 'Куда'], preverbs.map((p) => [`${ka(p.ka, 'f')} <span class="tr">${esc(cyr(p.ka))}</span>`, esc(p.ru)]), 'ref')}` : ''}
<h2 id="persons">По лицам: ${ka(go.lemma)} «${esc(go.ru)}»</h2>
<div class="tenses">${tenseCard(go, go.tenses, 'present')}${tenseCard(go, go.tenses, 'future')}</div>
<p>Все времена — на странице глагола <a href="${go.path}">«${esc(go.ru)}»</a>.</p>
${sources}`
    }, updated))
  }

  // ---- «у меня есть» -----------------------------------------------------------------------------
  {
    const thing = byRu('иметь')
    const being = byRu('иметь (кого-то)')
    const examples = theory.intro.lessons.find((l) => l.n === 3).blocks.filter((b) => b.type === 'example')
    const tatoeba = [...pickSentences(thing, 2), ...pickSentences(being, 2)]
    const pair = (t) => (thing.tenses[t] && being.tenses[t] ? `<div class="tenses">${tenseCard(thing, thing.tenses, t)}${tenseCard(being, being.tenses, t)}</div>` : '')
    const f1 = (v) => inlineForm(v.tenses.present[0])
    pages.push(page({
      slug: 'have', order: 80, card: '«У меня есть»',
      title: `«У меня есть» по-грузински: ${cell(thing.tenses.present[0])} и ${cell(being.tenses.present[0])} — в чём разница`,
      h1: '«У меня есть» по-грузински: два глагола',
      description: `Как сказать «у меня есть» по-грузински: ${cell(thing.tenses.present[0])} (${cyr(cell(thing.tenses.present[0]))}) — о вещах, ${cell(being.tenses.present[0])} (${cyr(cell(being.tenses.present[0]))}) — о людях и животных. Все лица, «у меня было» и «у меня будет», примеры с переводом.`,
      relatedPaths: ['/words/family/', '/words/pronouns/', '/grammar/cases/'],
      body: `<p class="lead">«Иметь» в грузинском — два разных глагола. О вещах говорят ${f1(thing)}, о людях и животных — ${f1(being)}.</p>
${examples.map((e) => `<div class="ex"><p class="k">${ka(e.ka)}</p><p class="tr">${esc(cyr(e.ka))}</p><p class="r">${esc(e.ru)}</p></div>`).join('')}
<h2 id="now">У меня есть, у тебя есть: все лица</h2>
<p>Слева — о вещах, справа — о людях и животных.</p>
${pair('present')}
<h2 id="past">У меня было и у меня будет</h2>
${pair('imperfect')}${pair('future')}
${tatoeba.length ? `<h2 id="examples">Ещё примеры</h2>
${tatoeba.map((s) => `<div class="ex"><p class="k">${ka(s.ka)}</p><p class="tr">${esc(cyr(s.ka))}</p><p class="r">${esc(s.ru)}</p><p class="src"><a href="https://tatoeba.org/sentences/show/${s.id}" rel="noopener nofollow">Tatoeba №${s.id}</a></p></div>`).join('')}` : ''}
<p>Полные таблицы: <a href="${thing.path}">${ka(thing.lemma)} «${esc(thing.ru)}»</a> и <a href="${being.path}">${ka(being.lemma)} «${esc(being.ru)}»</a>.</p>
<p class="sources">Формы — Викисловарь (CC BY-SA 4.0), ссылки на статьи — на страницах глаголов. Примеры со ссылкой — <a href="https://tatoeba.org" rel="noopener nofollow">Tatoeba</a> (CC BY 2.0 FR), остальные — из уроков TraleBot.</p>`
    }, updated))
  }

  return pages
}

/** Wraps Georgian fragments of a Russian sentence taken from the catalog («приставка გა- + основа»). */
export function markKa(text) {
  return esc(text).replace(/[ა-ჿ]+-?/g, (m) => `<span lang="ka">${m}</span>`)
}
