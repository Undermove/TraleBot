// Медианы письма для «Как пишется» (hanzi-writer): буква — глиф Noto Sans Georgian 800 (glyphs.ts), а штрихи
// пера — медианы (осевые линии) в порядке и направлении письма. Демо открывает глиф через маску из толстой
// линии вдоль медианы. Этот скрипт проверяет, что маска шириной MASK (в единицах бокса) по всем медианам
// открывает глиф целиком: считает пиксели глифа, не задетые маской, и рисует лист проверки
// (coverage-sheet.html: глиф, медианы с номерами, непокрытое — красным).
//
// Данные: medians-noto.json — медианы по букве (порядок/направление: таблица Commons, для ნ წ ხ ჩ ჟ — решения по
// прописям Чаганавы, см. manual.mjs и README). Пишет src/alphabet/intro/medians.ts.
// Запуск из src/Trale/miniapp-src: node ../../../scripts/alphabet-strokes/medians.mjs
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MASK = 15

const here = dirname(fileURLToPath(import.meta.url))
const glyphSrc = readFileSync(resolve(here, '../../src/Trale/miniapp-src/src/alphabet/intro/glyphs.ts'), 'utf8')
const GLYPHS = Object.fromEntries([...glyphSrc.matchAll(/'(.)': "([^"]*)"/g)].map(m => [m[1], m[2]]))
const RAW = JSON.parse(readFileSync(resolve(here, 'medians-noto.json'), 'utf8'))
// Концы штрихов продлеваем по касательной на EXT — маска дотягивается до закруглённых окончаний глифа.
const EXT = 2.5
const ext = st => {
  if (st.length < 2) return st
  const go = (a, b) => { const dx = a[0] - b[0], dy = a[1] - b[1], L = Math.hypot(dx, dy) || 1; return [Math.round((a[0] + (dx / L) * EXT) * 10) / 10, Math.round((a[1] + (dy / L) * EXT) * 10) / 10] }
  return [go(st[0], st[Math.min(2, st.length - 1)]), ...st, go(st[st.length - 1], st[Math.max(0, st.length - 3)])]
}
const MED = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, { ...v, strokes: v.strokes.map(ext) }]))

const browser = await chromium.launch()
const page = await browser.newPage()
const res = await page.evaluate(({ GLYPHS, MED, MASK }) => {
  const K = 6, N = 100 * K
  const c = document.createElement('canvas'); c.width = N; c.height = N
  const x = c.getContext('2d', { willReadFrequently: true })
  const out = {}
  for (const [ch, d] of Object.entries(GLYPHS)) {
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, N, N)
    x.setTransform(K, 0, 0, K, 0, 0)
    x.fillStyle = '#000'; x.fill(new Path2D(d))
    const g = x.getImageData(0, 0, N, N).data
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, N, N)
    x.setTransform(K, 0, 0, K, 0, 0)
    x.strokeStyle = '#000'; x.lineWidth = MASK; x.lineCap = 'round'; x.lineJoin = 'round'
    for (const st of MED[ch].strokes) { x.beginPath(); st.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke() }
    const m = x.getImageData(0, 0, N, N).data
    let ink = 0, miss = 0
    const missPts = []
    for (let i = 0; i < N * N; i++) if (g[i * 4 + 3] > 128) { ink++; if (m[i * 4 + 3] < 128) { miss++; if (missPts.length < 4000) missPts.push([(i % N) / K, Math.floor(i / N) / K]) } }
    out[ch] = { ink, miss, missPts }
  }
  return out
}, { GLYPHS, MED, MASK })
await browser.close()

const cells = Object.keys(GLYPHS).map(ch => {
  const r = res[ch]
  const strokes = MED[ch].strokes.map((st, i) => {
    const col = ['#E01A3C', '#1B5FB0', '#0A9D58'][i % 3]
    return `<path d="M${st.map(p => p.join(' ')).join(' L')}" fill="none" stroke="${col}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="${st[0][0]}" cy="${st[0][1]}" r="3" fill="${col}"/><text x="${st[0][0]}" y="${st[0][1] + 1.3}" font-size="4" font-weight="bold" fill="#fff" text-anchor="middle" font-family="sans-serif">${i + 1}</text>`
  }).join('')
  const miss = r.missPts.filter((_, i) => i % 3 === 0).map(([a, b]) => `<rect x="${a}" y="${b}" width=".5" height=".5" fill="#f00"/>`).join('')
  return `<div class="c"><svg viewBox="0 0 100 100" width="170" height="170"><path d="${GLYPHS[ch]}" fill="#000" fill-opacity=".18"/>${strokes}${miss}</svg><div>${ch} · ${MED[ch].confidence} · непокрыто ${(100 * r.miss / r.ink).toFixed(2)}%</div></div>`
}).join('')
writeFileSync(resolve(here, 'coverage-sheet.html'), `<html><meta charset="utf-8"><style>body{margin:8px;font:12px sans-serif;width:1100px;background:#fff}.c{display:inline-block;margin:3px;text-align:center}</style><body>${cells}</body></html>`)

const ts = `// Медианы письма (осевые линии штрихов) для «Как пишется»: штрихи по порядку, точки в порядке письма, бокс 0..100 —
// те же координаты, что у контуров glyphs.ts. Буква всегда рисуется глифом; перо и маска, которая открывает глиф, идут по
// этим линиям (маска шириной MEDIAN_MASK открывает глиф целиком — проверяет scripts/alphabet-strokes/medians.mjs).
// Порядок и направление — таблица письма мхедрули «მხედრულით წერის მიმართულება» (User:Jaqeli, вектор File:Mkhedruli.svg,
// User:Carnby; общественное достояние) https://commons.wikimedia.org/wiki/File:Mkhedruli.svg ; для ნ წ ხ ჩ ჟ — по прописям
// Левана Чаганавы https://chaganava.com/georgian-calligraphy-workbook-ka (см. scripts/alphabet-strokes/README.md).
// confidence — насколько однозначен источник; ученику не показываем. Сгенерировано medians.mjs из medians-noto.json.

export const MEDIAN_MASK = ${MASK}

export interface Medians { strokes: [number, number][][]; confidence: 'high' | 'medium' | 'low' }

export const MEDIANS: Record<string, Medians> = {
${Object.keys(GLYPHS).map(ch => `  '${ch}': { confidence: '${MED[ch].confidence}', strokes: ${JSON.stringify(MED[ch].strokes)} }`).join(',\n')}
}
`
writeFileSync(resolve(here, '../../src/Trale/miniapp-src/src/alphabet/intro/medians.ts'), ts)
console.log(Object.keys(GLYPHS).map(ch => `${ch} ${(100 * res[ch].miss / res[ch].ink).toFixed(2)}%`).join('  '))
for (const ch of Object.keys(GLYPHS)) {
  const m = res[ch].missPts
  if (m.length < 30) continue
  const xs = m.map(p => p[0]), ys = m.map(p => p[1])
  console.log(`  ${ch}: непокрыто в x ${Math.min(...xs).toFixed(1)}..${Math.max(...xs).toFixed(1)}, y ${Math.min(...ys).toFixed(1)}..${Math.max(...ys).toFixed(1)}`)
}
