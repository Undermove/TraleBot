// Phrasebook (/phrases/) and word lists (/words/): pages assembled from the lesson theory and
// lesson lexicons. data/reference.mjs says WHICH lists go on which page; every Georgian string is
// taken from the sources as is. This file only lays them out.

import { esc, ka } from '../template.mjs'
import { cyr } from '../data/verbs.mjs'

/** Lesson authors sometimes add a Latin reading in brackets — «არ მესმის (ar mes-mis)». The site shows Cyrillic only. */
const cleanKa = (s) => s.replace(/\s*\([^)Ⴀ-ჿ]*[A-Za-z][^)Ⴀ-ჿ]*\)/g, '').trim()
const cleanDialogue = (s) => s.replace(/^—\s*/, '').trim()

/** Selectors used by data/reference.mjs. Each returns [{ ka, ru }] straight from a source. */
export function makeSelectors({ theory, lexicons }) {
  const lesson = (mod, n) => {
    const l = theory[mod]?.lessons.find((x) => x.n === n)
    if (!l) throw new Error(`reference: no lesson ${mod}/${n} in the theory`)
    return l
  }
  return {
    /** Pairs from the lists of a theory lesson (`listIndex` picks one list). */
    list(mod, n, listIndex) {
      const lists = lesson(mod, n).blocks.filter((b) => b.type === 'list')
      const picked = listIndex === undefined ? lists : [lists[listIndex]]
      return picked.flatMap((b) => b.items.filter((i) => i.ka).map((i) => ({ ka: cleanKa(i.ka), ru: i.ru })))
    },
    /** Example sentences of a theory lesson. */
    examples(mod, n) {
      return lesson(mod, n).blocks.filter((b) => b.type === 'example').map((b) => ({ ka: cleanDialogue(b.ka), ru: cleanDialogue(b.ru) }))
    },
    /** Lexicon of a lesson JSON by lesson_id. */
    lexicon(lessonId) {
      const items = lexicons.get(lessonId)
      if (!items?.length) throw new Error(`reference: lesson lexicon "${lessonId}" is empty or missing`)
      return items.map((i) => ({ ka: cleanKa(i.ka), ru: i.ru }))
    }
  }
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

function pairTable(items, { head = ['По-русски', 'По-грузински'] } = {}) {
  return `<div class="table-wrap"><table class="ref"><thead><tr><th>${head[0]}</th><th>${head[1]}</th></tr></thead><tbody>${items
    .map((i) => `<tr><td>${esc(cap(i.ru))}</td><td>${ka(i.ka, 'f')} <span class="tr">${esc(cyr(i.ka))}</span></td></tr>`)
    .join('')}</tbody></table></div>`
}

function dialogue(items) {
  return items.map((i) => `<div class="ex"><p class="k">${ka(i.ka)}</p><p class="tr">${esc(cyr(i.ka))}</p><p class="r">${esc(i.ru)}</p></div>`).join('')
}

/**
 * Applies a block's `where` filter and `ru` rewording (both keyed by the Russian side, so the
 * page definitions never spell a Georgian word themselves) and drops items already shown higher
 * on the page: a word that several lessons repeat appears once.
 */
function prepare(block, seen) {
  const out = []
  for (const item of block.items) {
    if (block.where && !block.where(item.ru)) continue
    const key = item.ka.replace(/[?!.…]+$/, '')
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ ka: item.ka, ru: block.ru?.[item.ru] ?? item.ru })
  }
  return out
}

export function referencePage(def, { sectionTitle, updated }) {
  const seen = new Set()
  const seenDialogue = new Set()
  const parts = []
  let count = 0
  for (const block of def.blocks) {
    if (block.html) { parts.push(block.html); continue }
    const items = prepare(block, block.dialogue ? seenDialogue : seen)
    if (!items.length) throw new Error(`reference: block "${block.h2}" on ${def.section}/${def.slug} is empty`)
    count += items.length
    parts.push(`${block.h2 ? `<h2 id="${block.id}">${esc(block.h2)}</h2>` : ''}${block.note ? `<p>${block.note}</p>` : ''}${block.dialogue ? dialogue(items) : pairTable(items, { head: block.head })}`)
  }
  const jumps = def.blocks.filter((b) => b.h2 && b.id)
  const body = `<article>
<div class="eyebrow">${esc(sectionTitle)}</div>
<h1>${esc(def.h1)}</h1>
<p class="lead">${esc(def.lead)}</p>
${jumps.length > 2 ? `<ul class="jump">${jumps.map((b) => `<li><a href="#${b.id}">${esc(b.short || b.h2)}</a></li>`).join('')}</ul>` : ''}
${parts.join('\n')}
<p class="sources">Слова и фразы — из уроков TraleBot. Вторая строка в каждой ячейке — как читать русскими буквами; знак ’ после буквы — резкий звук без выдоха, подробнее в <a href="/grammar/alphabet/">алфавите</a>.</p>
</article>`
  return {
    section: def.section,
    slug: def.slug,
    path: `/${def.section}/${def.slug}/`,
    title: def.title,
    h1: def.h1,
    card: def.card || def.h1,
    description: def.description,
    body,
    count,
    crumbs: [{ title: 'Главная', path: '/' }, { title: sectionTitle, path: `/${def.section}/` }, { title: def.card || def.h1, path: `/${def.section}/${def.slug}/` }],
    ctaTag: `seo_${def.section}_${def.slug}`,
    cta: def.cta,
    relatedPaths: def.related || [],
    backLink: { path: `/${def.section}/`, label: sectionTitle },
    updated,
    ld: [],
    sitemap: { changefreq: 'monthly', priority: '0.7' }
  }
}
