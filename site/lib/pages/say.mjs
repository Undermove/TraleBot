// «Как сказать … по-грузински» (/kak-skazat/<slug>/): one everyday phrase per page. data/say.mjs names
// the phrase by its Russian; this file finds it in the lesson theory and lexicons and lays out the page:
// the phrase, its reading letter by letter, other ways to say it, the answer, and the lesson sentences
// that use it. Every Georgian string comes from the sources as is.

import { esc, ka } from '../template.mjs'
import { cyr } from '../data/verbs.mjs'

const norm = (s) => s.toLowerCase().replace(/\s*\([^()]+ — .*$/, '').replace(/^[—\s]+/, '').replace(/[\s.!?…]+$/, '').trim()
const plainRu = (s) => s.replace(/\s*\([^()]+ — .*$/, '').replace(/^[—\s]+/, '').trim()
const bare = (s) => s.replace(/[—.!?,…«»"]/g, ' ').replace(/\s+/g, ' ').trim()
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

/** Pairs that name a phrase: list items and lexicon entries (not example sentences). */
function findPair(pool, ru) {
  const want = norm(ru)
  return pool.find((x) => x.kind !== 'example' && norm(x.ru) === want) || pool.find((x) => norm(x.ru) === want)
}

function letters(text) {
  const seen = new Set()
  const out = []
  for (const c of text) if (/[Ⴀ-ჿ]/.test(c) && !seen.has(c)) { seen.add(c); out.push(c) }
  return out
}

export function sayPage(def, { pool, section, bySlug, updated }) {
  const main = findPair(pool, def.main[0])
  if (!main) throw new Error(`say: «${def.main[0]}» (${def.slug}) is not in the lessons`)
  const extra = (def.extra || []).map((ru) => findPair(pool, ru) || (() => { throw new Error(`say: «${ru}» (${def.slug}) is not in the lessons`) })())
  const shown = new Set([main.ka, ...extra.map((x) => x.ka)].map(bare))
  const pick = (list) => (list || []).map((ru) => findPair(pool, ru)).filter((x) => x && !shown.has(bare(x.ka)) && shown.add(bare(x.ka)))
  const also = pick(def.also)
  const reply = pick(def.reply)

  const head = [main, ...extra]
  // Lesson sentences that contain the phrase.
  const key = bare(main.ka)
  const examples = []
  const shownRu = new Set([...head, ...also, ...reply].map((x) => norm(x.ru)))
  for (const x of pool) {
    // a real sentence (not a grammar scheme with arrows, hyphenated morphemes or Russian notes) that has the phrase as whole words
    if (x.kind !== 'example' || /[→А-Яа-яA-Za-z]|[Ⴀ-ჿ]-[Ⴀ-ჿ]/.test(x.ka)) continue
    if (!` ${bare(x.ka)} `.includes(` ${key} `) || shown.has(bare(x.ka)) || shownRu.has(norm(x.ru))) continue
    shown.add(bare(x.ka))
    examples.push({ ka: x.ka, ru: plainRu(x.ru) })
    if (examples.length >= 6) break
  }

  const phrase = cap(def.phrase)
  const both = def.alt ? `${phrase} и ${def.alt}` : phrase
  const reading = head.map((x) => `${x.ka} (${cyr(x.ka)})`).join(', ')

  const hero = head
    .map((x) => `<div class="say-hero"><p class="say-ru">${esc(cap(plainRu(x.ru)))}</p><p class="say-ka">${ka(x.ka, 'f')}</p><p class="say-tr">${esc(cyr(x.ka))}</p></div>`)
    .join('')
  const letterRows = letters(head.map((x) => x.ka).join(' '))
    .map((c) => `<li>${ka(c)} <span class="tr">${esc(cyr(c))}</span></li>`)
    .join('')
  const table = (items) =>
    `<div class="table-wrap"><table class="ref"><thead><tr><th>По-русски</th><th>По-грузински</th></tr></thead><tbody>${items
      .map((i) => `<tr><td>${esc(cap(plainRu(i.ru)))}</td><td>${ka(i.ka, 'f')} <span class="tr">${esc(cyr(i.ka))}</span></td></tr>`)
      .join('')}</tbody></table></div>`
  const dialogue = (items) => items.map((i) => `<div class="ex"><p class="k">${ka(i.ka)}</p><p class="tr">${esc(cyr(i.ka))}</p><p class="r">${esc(i.ru)}</p></div>`).join('')

  const relatedLinks = def.related.map((s) => bySlug.get(s)).filter(Boolean)
  const parts = [
    hero,
    `<h2 id="letters">Как читать по буквам</h2><p>Грузинское письмо читается так, как пишется: каждая буква — один звук.</p><ul class="letters">${letterRows}</ul>`,
    also.length ? `<h2 id="more">Ещё варианты</h2>${table(also)}` : '',
    reply.length ? `<h2 id="reply">Что ответят</h2>${table(reply)}` : '',
    examples.length ? `<h2 id="examples">Как это звучит в разговоре</h2>${dialogue(examples)}` : '',
    `<h2 id="next">Похожие фразы</h2><p>${relatedLinks.map((r) => `<a href="${r.path}">${esc(cap(r.phrase))}</a>`).join(' · ')}. Все фразы этой темы — в разговорнике: <a href="${def.topic}">${esc(def.topicTitle)}</a>.</p>`
  ]

  const path = `/${section.name}/${def.slug}/`
  return {
    section: section.name,
    slug: def.slug,
    path,
    title: `${both} по-грузински: ${reading} — как сказать и прочитать`,
    h1: `Как сказать «${def.phrase}» по-грузински`,
    card: phrase,
    description: `Как по-грузински «${def.phrase}»: ${reading}. Чтение русскими буквами, разбор по буквам${also.length ? ', другие варианты' : ''}${examples.length ? ' и примеры из разговора' : ''}.`,
    body: `<article>
<div class="eyebrow">${esc(section.label)}</div>
<h1>Как сказать «${esc(def.phrase)}» по-грузински</h1>
<p class="lead">${esc(cap(def.phrase))} по-грузински — ${ka(main.ka)}, читается «${esc(cyr(main.ka))}».</p>
${parts.filter(Boolean).join('\n')}
<p class="sources">Фразы — из уроков TraleBot. Вторая строка — как читать русскими буквами; знак ’ после буквы — резкий звук без выдоха, подробнее в <a href="/grammar/alphabet/">алфавите</a>.</p>
</article>`,
    count: head.length + also.length + reply.length + examples.length,
    crumbs: [{ title: 'Главная', path: '/' }, { title: section.label, path: `/${section.name}/` }, { title: phrase, path }],
    ctaTag: `seo_say_${def.slug}`,
    cta: section.cta,
    relatedPaths: [def.topic, ...relatedLinks.map((r) => r.path)],
    backLink: { path: `/${section.name}/`, label: 'Все фразы' },
    updated,
    ld: [],
    sitemap: { changefreq: 'monthly', priority: '0.7' }
  }
}
