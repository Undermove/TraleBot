#!/usr/bin/env node
// Собирает парадигмы грузинских глаголов из английского Викисловаря (CC BY-SA 4.0).
// Формы берутся только из таблицы спряжения на странице; ничего не достраивается.
// Запуск: node scripts/verbs/fetch-wiktionary.mjs && node scripts/verbs/build-catalog.mjs
import { readFileSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const lemmas = JSON.parse(readFileSync(resolve(here, 'lemmas.json'), 'utf8'))
const ru = JSON.parse(readFileSync(resolve(here, 'ru.json'), 'utf8'))
// Сырой результат выгрузки. Каталог для приложения из него собирает build-catalog.mjs.
const outFile = resolve(here, 'verbs.raw.json')
const API = 'https://en.wiktionary.org/w/api.php'
const UA = 'TraleBotVerbs/0.1 (https://tralebot.com)'

// У глаголов движения на странице несколько таблиц (с разными приставками). Здесь — какая основная:
// «идти» берём с წა- в будущем и прошедшем, как это дают на уроках. Формы остальных таблиц
// сохраняются в alt, чтобы разбор формы находил и их.
const MAIN_TABLE = { 'მიდის': 1 }

const TENSES = {
  'present': 'present',
  'imperfect': 'imperfect',
  'present subjunctive': 'presentSubjunctive',
  'future': 'future',
  'conditional': 'conditional',
  'future subjunctive': 'futureSubjunctive',
  'aorist': 'aorist',
  'optative': 'optative',
  'perfect': 'perfect',
  'pluperfect': 'pluperfect',
  'perfect subjunctive': 'perfectSubjunctive'
}

const strip = s => s.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&#160;|&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`
  // Викисловарь режет частые запросы: ждём и повторяем, а не теряем глагол.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } })
    const text = await res.text()
    try { return JSON.parse(text) } catch {
      if (attempt >= 5) throw new Error(`лимит запросов: ${text.slice(0, 60)}`)
      await new Promise(r => setTimeout(r, 8000 * (attempt + 1)))
    }
  }
}

// Только грузинские написания из ячейки; варианты через «/» сохраняем списком.
function cellForms(td) {
  const forms = [...td.matchAll(/<span class="Geor" lang="ka">([\s\S]*?)<\/span>/g)].map(m => strip(m[1]))
  return forms.flatMap(f => f.split(/[,/]/)).map(f => f.trim()).filter(f => /^[ა-ჰ]+$/.test(f))
}

function parseTable(table) {
  const tenses = {}
  let masdar = null
  for (const tr of table.split(/<tr[^>]*>/).slice(1)) {
    const ths = [...tr.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map(m => strip(m[1]))
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1])
    if (ths.includes('verbal noun') || ths[0] === 'verbal noun') {
      const f = tds.flatMap(cellForms)
      if (f.length) masdar = f
      continue
    }
    const key = TENSES[ths[ths.length - 1]]
    if (!key || tds.length !== 6) continue
    const row = tds.map(cellForms)
    if (row.every(c => c.length === 0)) continue
    tenses[key] = row
  }
  return { masdar, tenses }
}

function glosses(wikitext) {
  const sec = wikitext.split(/^==Georgian==$/m)[1]?.split(/^==[^=]/m)[0] ?? ''
  const verb = sec.split(/^===+Verb===+$/m)[1]?.split(/^===/m)[0] ?? ''
  return verb.split('\n').filter(l => /^# /.test(l))
    .filter(l => !/\{\{(nonstandard|alternative|inflection|form of|ka-verbal)/.test(l))
    .map(l => l.slice(2)
      .replace(/\{\{(?:lb|lbl|label)\|ka\|([^}]*)\}\}/g, (_, a) => `(${a.split('|').join(', ')})`)
      .replace(/\{\{[^}]*\}\}/g, '')
      .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
      .replace(/'''?/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

const out = []
for (const lemma of lemmas) {
  try {
    const html = await api({ action: 'parse', page: lemma, prop: 'text|revid|wikitext' })
    const wt = html
    if (html.error) { console.error(`— ${lemma}: страницы нет`); continue }
    const text = html.parse.text
    const geo = text.split(/<h2 id="Georgian"/)[1]?.split(/<h2 /)[0] ?? ''
    const tables = [...geo.matchAll(/<table[^>]*roa-inflection-table[\s\S]*?<\/table>/g)].map(m => m[0])
    if (!tables.length) { console.error(`— ${lemma}: нет таблицы спряжения`); continue }
    const main = MAIN_TABLE[lemma] ?? 0
    const { masdar, tenses } = parseTable(tables[main])
    const alt = tables.filter((_, i) => i !== main).map(t => parseTable(t).tenses)
    if (!tenses.present && !tenses.future) { console.error(`— ${lemma}: таблица не разобрана`); continue }
    const vn = wt.parse.wikitext.match(/\{\{ka-verb[^}]*\|vn=([ა-ჰ]+)/)?.[1]
    out.push({
      lemma,
      masdar: masdar ?? (vn ? [vn] : null),
      ru: ru[lemma] ?? null,
      en: glosses(wt.parse.wikitext),
      tenses,
      ...(alt.length ? { alt } : {}),
      source: `https://en.wiktionary.org/wiki/${encodeURIComponent(lemma)}`,
      revid: html.parse.revid
    })
    console.error(`✓ ${lemma}: ${Object.keys(tenses).length} рядов, масдар ${masdar?.join('/') ?? '—'}`)
  } catch (e) {
    console.error(`— ${lemma}: ${e.message}`)
  }
  await new Promise(r => setTimeout(r, 2500))
}
// Не затираем базу неполным результатом, если часть страниц не скачалась.
const before = (() => { try { return JSON.parse(readFileSync(outFile, 'utf8')).length } catch { return 0 } })()
if (out.length < before && !process.argv.includes('--force')) {
  console.error(`\nСобрано ${out.length}, а в базе ${before}. Файл не тронут (--force, чтобы записать).`)
  process.exit(1)
}
writeFileSync(outFile, JSON.stringify(out, null, 1) + '\n')
console.error(`\nГотово: ${out.length} из ${lemmas.length} → ${outFile}`)
