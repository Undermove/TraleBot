// Подгонка путей письма к шрифту мини-аппа.
//
// keypoints.py — порядок и направление штрихов по таблице Wikimedia Commons (см. README.md), опорные точки
// уложены по глифам Helvetica. В мини-аппе буква рисуется шрифтом Noto Sans Georgian 800 (LetterIntro →
// paint.glyphPoints: кегль 0.62 от стороны сцены, по центру, textBaseline = middle). Этот скрипт:
//   1) берёт сырые штрихи из gen.py (`--emit-input`, сглаженные и равномерно выбранные, ещё в координатах Helvetica);
//   2) в headless Chromium рисует ту же букву Helvetica (как в gen.py) и Noto Sans Georgian 800 (как в приложении);
//   3) переносит точки из рамки чернил Helvetica в рамку чернил Noto (по x и y отдельно);
//   4) притягивает каждую точку к оси штриха глифа Noto (distance transform, как snap.html), сохраняя порядок,
//      направление и точки разворота; слегка сглаживает;
//   5) пишет src/alphabet/intro/strokes.ts и лист-проверку contact-sheet.html (буква + путь + номера штрихов).
//
// Запуск из src/Trale/miniapp-src (нужен интернет — шрифт с Google Fonts):
//   python3 ../../../scripts/alphabet-strokes/gen.py --emit-input /tmp/strokes-raw.json
//   node ../../../scripts/alphabet-strokes/refit.mjs /tmp/strokes-raw.json
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const input = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const research = JSON.parse(readFileSync(resolve(here, 'strokes.json'), 'utf8'))
const meta = Object.fromEntries(research.letters.map(l => [l.letter, l]))

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@400..900&display=swap" rel="stylesheet"></head><body></body></html>`)
await page.evaluate(async () => { await document.fonts.load('800 100px "Noto Sans Georgian"', 'აბგ'); await document.fonts.ready })

const out = await page.evaluate((INPUT) => {
  const K = 8, N = 100 * K + 1
  const cv = document.createElement('canvas'); cv.width = N; cv.height = N
  const c = cv.getContext('2d', { willReadFrequently: true })
  const draw = (ch, font) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, N, N); c.fillStyle = '#000'
    if (font === 'helvetica') { c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.font = (INPUT.fs * K) + 'px Helvetica'; c.fillText(ch, INPUT.ox[ch] * K, 70 * K) }
    else { c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${62 * K}px "Noto Sans Georgian", sans-serif`; c.fillText(ch, 50 * K, 50 * K) }
    return c.getImageData(0, 0, N, N).data
  }
  const bbox = img => {
    let x0 = N, y0 = N, x1 = 0, y1 = 0
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (img[(y * N + x) * 4] < 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    return { x0: x0 / K, y0: y0 / K, x1: x1 / K, y1: y1 / K }
  }
  const dt = img => {
    const D = new Float32Array(N * N)
    for (let i = 0; i < N * N; i++) D[i] = img[i * 4] < 128 ? 1e9 : 0
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x; if (!D[i]) continue; let v = D[i]
      if (x > 0) v = Math.min(v, D[i - 1] + 3)
      if (y > 0) { v = Math.min(v, D[i - N] + 3); if (x > 0) v = Math.min(v, D[i - N - 1] + 4); if (x < N - 1) v = Math.min(v, D[i - N + 1] + 4) }
      D[i] = v
    }
    for (let y = N - 1; y >= 0; y--) for (let x = N - 1; x >= 0; x--) {
      const i = y * N + x; if (!D[i]) continue; let v = D[i]
      if (x < N - 1) v = Math.min(v, D[i + 1] + 3)
      if (y < N - 1) { v = Math.min(v, D[i + N] + 3); if (x < N - 1) v = Math.min(v, D[i + N + 1] + 4); if (x > 0) v = Math.min(v, D[i + N - 1] + 4) }
      D[i] = v
    }
    return D
  }
  const R = 5 * K, LAMBDA = 0.3
  const res = []
  for (const L of INPUT.letters) {
    const hb = bbox(draw(L.letter, 'helvetica'))
    const noto = draw(L.letter, 'noto')
    const nb = bbox(noto)
    const D = dt(noto)
    const map = ([x, y]) => [nb.x0 + (x - hb.x0) * (nb.x1 - nb.x0) / Math.max(1, hb.x1 - hb.x0), nb.y0 + (y - hb.y0) * (nb.y1 - nb.y0) / Math.max(1, hb.y1 - hb.y0)]
    let off = 0, total = 0
    const strokes = L.strokes.map((st, si) => {
      const cus = new Set(L.cusps[si])
      // Притягиваем каждую точку к оси штриха глифа Noto (ближайший «гребень» distance transform).
      const all = st.map(p => {
        const [x, y] = map(p)
        const px = Math.round(x * K), py = Math.round(y * K)
        let best = -1e9, bx = px, by = py
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
          const qx = px + dx, qy = py + dy; if (qx < 0 || qy < 0 || qx >= N || qy >= N) continue
          const d = Math.hypot(dx, dy); if (d > R) continue
          const s = D[qy * N + qx] / 3 - LAMBDA * d
          if (s > best) { best = s; bx = qx; by = qy }
        }
        return { p: [bx / K, by / K], moved: Math.hypot(bx - px, by - py) / K, on: D[by * N + bx] > 0, pre: px >= 0 && py >= 0 && px < N && py < N && D[py * N + px] > 0 }
      })
      // Начало и конец штриха, которых в Noto нет (у Helvetica там хвостик или черта: ჟ, რ, ხ), отрезаем —
      // точка и после притягивания вне буквы. Перо не пишет по пустому месту.
      let from = 0, to = all.length - 1
      const bad = q => !q.on
      while (from < to - 2 && bad(all[from])) from++
      while (to > from + 2 && bad(all[to])) to--
      const shift = from
      const snapped = all.slice(from, to + 1).map(q => { total++; if (!q.on) off++; return q.p })
      return snapped.map((p, i) => {
        if (i === 0 || i === snapped.length - 1 || cus.has(i + shift)) return p
        const a = snapped[i - 1], b = snapped[i + 1]
        return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4]
      }).map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10])
    })
    res.push({ letter: L.letter, strokes, off, total, trimmed: L.strokes.reduce((n, st, i) => n + st.length - strokes[i].length, 0) })
  }
  return res
}, { ...input, ox: Object.fromEntries(input.letters.map(l => [l.letter, l.ox])) })

await browser.close()

const ts = `// Как пишутся буквы: штрихи по порядку, точки в порядке письма, бокс 0..100 (как сцена знакомства с буквой:
// буква Noto Sans Georgian 800, кегль 62, по центру, textBaseline = middle). Порядок и направление — по таблице
// «მხედრულით წერის მიმართულება» (User:Jaqeli, 2013, общественное достояние; вектор File:Mkhedruli.svg,
// User:Carnby): https://commons.wikimedia.org/wiki/File:Mkhedruli.svg. Опорные точки — scripts/alphabet-strokes/
// keypoints.py, подгонка к шрифту приложения — scripts/alphabet-strokes/refit.mjs (файл сгенерирован, руками не править).
// confidence — насколько таблица однозначна для этой буквы (high / medium / low), ученику не показываем.

export interface LetterStrokes { strokes: [number, number][][]; confidence: 'high' | 'medium' | 'low' }

export const STROKES: Record<string, LetterStrokes> = {
${out.map(l => `  '${l.letter}': { confidence: '${meta[l.letter].confidence}', strokes: ${JSON.stringify(l.strokes)} }`).join(',\n')}
}
`
writeFileSync(resolve(here, '../../src/Trale/miniapp-src/src/alphabet/intro/strokes.ts'), ts)

const cells = out.map(l => {
  const paths = l.strokes.map((st, i) => {
    const col = ['#E01A3C', '#1B5FB0', '#0A9D58'][i % 3]
    const [sx, sy] = st[0]
    return `<path d="M${st.map(p => p.join(',')).join(' L')}" fill="none" stroke="${col}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="${sx}" cy="${sy}" r="3.2" fill="${col}"/><text x="${sx}" y="${sy + 1.4}" font-size="4.2" font-weight="bold" fill="#fff" text-anchor="middle" font-family="sans-serif">${i + 1}</text>`
  }).join('')
  return `<div class="c"><svg viewBox="0 0 100 100" width="180" height="180"><text x="50" y="50" text-anchor="middle" dominant-baseline="middle" font-family="Noto Sans Georgian" font-weight="800" font-size="62" fill="#000" fill-opacity="0.18">${l.letter}</text>${paths}</svg><div>${l.letter} · ${meta[l.letter].confidence} · вне буквы ${l.off}/${l.total}</div></div>`
}).join('')
writeFileSync(resolve(here, 'contact-sheet.html'), `<html><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@400..900&display=swap" rel="stylesheet"><style>body{margin:8px;font:12px sans-serif;width:1150px}.c{display:inline-block;margin:4px;text-align:center}</style><body>${cells}</body></html>`)
console.log(out.map(l => `${l.letter} ${l.off}/${l.total}${l.trimmed ? ' -' + l.trimmed : ''}`).join('  '))
