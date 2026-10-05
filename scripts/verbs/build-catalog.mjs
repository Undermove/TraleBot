#!/usr/bin/env node
// Собирает каталог проверенных глаголов для приложения из сырой выгрузки Викисловаря:
// считает тип глагола, корень и глагол-образец и кладёт всё в src/Trale/Verbs/verbs.json.
// При старте сервер загружает этот файл в базу (SeedVerbCatalog).
// Запуск: node scripts/verbs/build-catalog.mjs
import { readFileSync, writeFileSync } from 'fs'
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

function sentencesFor(tenses) {
  const out = []
  const perForm = new Map()
  const own = new Set(Object.values(tenses).flat(2))
  for (const s of sentences) {
    if (skip.has(s.id)) continue
    const form = wordsOf(s.ka).find(w => own.has(w))
    if (!form || (perForm.get(form) ?? 0) >= MAX_SENTENCES_PER_FORM) continue
    perForm.set(form, (perForm.get(form) ?? 0) + 1)
    out.push({ id: s.id, ka: s.ka, ru: s.ru, form })
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
    sentences: sentencesFor(v.tenses),
    source: v.source,
    revid: v.revid
  }
})

writeFileSync(outFile, JSON.stringify({ verbs }, null, 1) + '\n')
console.error(`Каталог: ${verbs.length} глаголов, ${verbs.reduce((n, v) => n + v.sentences.length, 0)} предложений → ${outFile}`)
console.error(Object.entries(verbs.reduce((n, v) => ({ ...n, [v.kind]: (n[v.kind] ?? 0) + 1 }), {})).map(([k, n]) => `${k}: ${n}`).join(', '))
