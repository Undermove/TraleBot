#!/usr/bin/env node
// Собирает каталог проверенных глаголов для приложения из сырой выгрузки Викисловаря:
// считает тип глагола, корень и глагол-образец и кладёт всё в src/Trale/Verbs/verbs.json.
// При старте сервер загружает этот файл в базу (SeedVerbCatalog).
// Запуск: node scripts/verbs/build-catalog.mjs
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { analyze } from './analyze.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const raw = JSON.parse(readFileSync(resolve(here, 'verbs.raw.json'), 'utf8'))
const outFile = resolve(here, '../../src/Trale/Verbs/verbs.json')

// Живые предложения с формами глаголов: Tatoeba (CC BY 2.0 FR), пары «грузинский — русский».
// sentences.raw.json — выборка из выгрузки Tatoeba: 2–6 слов, есть русский перевод, есть форма из каталога.
// Корпус пишут добровольцы, в нём бывают ошибки: id в sentences.skip.json исключаются после проверки.
const sentences = JSON.parse(readFileSync(resolve(here, 'sentences.raw.json'), 'utf8'))
const skip = new Set(JSON.parse(readFileSync(resolve(here, 'sentences.skip.json'), 'utf8')))
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

function sentencesFor(tenses, lemma) {
  const out = []
  const perForm = new Map()
  const own = new Set(Object.values(tenses).flat(2))
  const pins = pinned.get(lemma) ?? new Set()
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
    throw new Error(`Комикс про «${lemma}» ссылается на предложения, которых нет в выборке для этого глагола ` +
      `(нет в sentences.raw.json, исключены в sentences.skip.json или в них нет формы глагола): ${lost.join(', ')}`)
  }
  return out
}

// Из пары «с превербом / без» в заголовок идёт короткий масдар (без преверба).
const titleOf = v => (v.masdar ? [...v.masdar].sort((a, b) => a.length - b.length)[0] : v.lemma)

const analysed = raw.filter(v => v.ru).map(v => ({ v, a: analyze(v) }))
// Образец схемы — первый глагол «по образцу» с той же схемой, кроме самого глагола.
const modelFor = ({ v, a }) =>
  a.scheme ? analysed.find(o => o.v !== v && o.a.kind === 'pattern' && o.a.scheme === a.scheme) ?? null : null

const verbs = analysed.map(entry => {
  const { v, a } = entry
  const model = modelFor(entry)
  return {
    lemma: v.lemma,
    title: titleOf(v),
    ru: v.ru,
    kind: a.kind,
    reason: a.reason,
    root: a.root,
    oddTenses: a.oddTenses,
    model: model ? { id: model.v.lemma, title: titleOf(model.v), ru: model.v.ru } : null,
    masdarWithPreverb: (v.masdar ?? []).filter(m => m !== titleOf(v)),
    tenses: v.tenses,
    alt: v.alt ?? [],
    sentences: sentencesFor(v.tenses, v.lemma),
    source: v.source,
    revid: v.revid
  }
})

const orphans = [...pinned.keys()].filter(lemma => !verbs.some(v => v.lemma === lemma))
if (orphans.length) throw new Error(`Комиксы ссылаются на глаголы, которых нет в каталоге: ${orphans.join(', ')}`)

writeFileSync(outFile, JSON.stringify({ verbs }, null, 1) + '\n')
console.error(`Каталог: ${verbs.length} глаголов, ${verbs.reduce((n, v) => n + v.sentences.length, 0)} предложений → ${outFile}`)
console.error(Object.entries(verbs.reduce((n, v) => ({ ...n, [v.kind]: (n[v.kind] ?? 0) + 1 }), {})).map(([k, n]) => `${k}: ${n}`).join(', '))
