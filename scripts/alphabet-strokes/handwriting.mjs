// Рукописные буквы для «Как пишется»: из векторной таблицы письма мхедрули (Mkhedruli.svg, Wikimedia Commons,
// User:Jaqeli / User:Carnby, общественное достояние) получаем у каждой буквы плавные осевые линии штрихов
// в порядке и направлении письма — кубические кривые Безье в синтаксисе SVG path.
//
//   1) буквы таблицы — залитые контуры; каждую рисуем отдельно в боксе 0..100 (верх строчных y=30,
//      строка y=70, по центру по x, один масштаб для всех букв);
//   2) опорные точки порядка/направления — keypoints.py (через gen.py --emit-input: сглаженные, ещё
//      в координатах Helvetica) — переносим в рамку буквы таблицы и притягиваем к оси её штриха
//      (distance transform); для букв, где рукописная форма другая (ტ, ჭ, ზ, ჩ…), — ручные точки
//      прямо в боксе (MANUAL ниже);
//   3) прореживаем (Рамер — Дуглас — Пекер, точки разворота сохраняем) и проводим через точки
//      Катмулла — Рома, переведённые в кубические Безье: линия гладкая, без изломов;
//   4) пишем src/alphabet/intro/handwriting.ts и лист проверки handwriting-sheet.html.
//
// Запуск из src/Trale/miniapp-src:
//   python3 ../../../scripts/alphabet-strokes/gen.py --emit-input /tmp/strokes-raw.json
//   node ../../../scripts/alphabet-strokes/handwriting.mjs /tmp/strokes-raw.json
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MANUAL } from './manual.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const input = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const research = JSON.parse(readFileSync(resolve(here, 'strokes.json'), 'utf8'))
const meta = Object.fromEntries(research.letters.map(l => [l.letter, l]))
const svg = readFileSync(resolve(here, 'Mkhedruli.svg'), 'utf8')

// Буквы таблицы по рядам, слева направо (как на картинке).
const ROWS = ['აბგდევზთიკლ', 'მნოპჟრსტუფქ', 'ღყშჩცძწჭხჯჰ']

const browser = await chromium.launch()
const page = await browser.newPage()
await page.setContent(svg)

const result = await page.evaluate(({ INPUT, ROWS, MANUAL }) => {
  // ── буквы таблицы ──
  const glyphs = [...document.querySelectorAll('path')].filter(e => /fill:#000000/.test(e.getAttribute('style') || ''))
    .map(e => ({ d: e.getAttribute('d'), bb: e.getBBox() }))
  const rows = [[], [], []]
  for (const g of glyphs) rows[g.bb.y < 190 ? 0 : g.bb.y < 380 ? 1 : 2].push(g)
  rows.forEach(r => r.sort((a, b) => a.bb.x - b.bb.x))
  // Один масштаб: высота строчной ი первого ряда = 40 единиц бокса. Строка каждого ряда — по букве,
  // которая стоит на строке без выносных: ი (ряд 1), ო (ряд 2), ძ (низ овала, ряд 3).
  const at = (row, ch) => rows[row][ROWS[row].indexOf(ch)].bb
  const base = [at(0, 'ი').y + at(0, 'ი').height, at(1, 'ო').y + at(1, 'ო').height, at(2, 'ძ').y + at(2, 'ძ').height]
  const xh = at(0, 'ი').height
  // У рукописных букв длинные выносные элементы: масштаб — чтобы самый высокий верх и самый низкий низ
  // всех букв уместились в 6..94; строка у всех на одной высоте BASE.
  let up = 0, down = 0
  rows.forEach((r, i) => r.forEach(g => { up = Math.max(up, base[i] - g.bb.y); down = Math.max(down, g.bb.y + g.bb.height - base[i]) }))
  const S = 88 / (up + down)
  const BASE = 6 + up * S

  const K = 8, N = 100 * K + 1
  const cv = document.createElement('canvas'); cv.width = N; cv.height = N
  const c = cv.getContext('2d', { willReadFrequently: true })
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
  const ink = (img) => {
    let x0 = N, y0 = N, x1 = 0, y1 = 0
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (img[(y * N + x) * 4] < 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    return { x0: x0 / K, y0: y0 / K, x1: x1 / K, y1: y1 / K }
  }
  const hv = document.createElement('canvas'); hv.width = N; hv.height = N
  const h = hv.getContext('2d', { willReadFrequently: true })
  const helvBox = (ch, ox) => {
    h.fillStyle = '#fff'; h.fillRect(0, 0, N, N); h.fillStyle = '#000'
    h.font = (INPUT.fs * K) + 'px Helvetica'; h.fillText(ch, ox * K, 70 * K)
    return ink(h.getImageData(0, 0, N, N).data)
  }

  // ── сглаживание: RDP + Катмулл — Ром → кубические Безье ──
  const rdp = (pts, eps) => {
    if (pts.length < 3) return pts
    const [a, b] = [pts[0], pts[pts.length - 1]]
    let idx = -1, best = 0
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i]
      const dx = b[0] - a[0], dy = b[1] - a[1]
      const L = Math.hypot(dx, dy) || 1
      const d = Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / L
      if (d > best) { best = d; idx = i }
    }
    if (best <= eps) return [a, b]
    return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)]
  }
  const r1 = v => Math.round(v * 10) / 10
  /** Точки (с разбивкой по точкам разворота) → path: M … C …; на развороте касательная обнуляется (острый угол). */
  const bezier = (segs) => {
    let d = ''
    for (const s of segs) {
      if (!d) d = `M${r1(s[0][0])} ${r1(s[0][1])}`
      for (let i = 0; i < s.length - 1; i++) {
        const p0 = s[i - 1] ?? s[i], p1 = s[i], p2 = s[i + 1], p3 = s[i + 2] ?? s[i + 1]
        const t = 1 / 6
        const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t]
        const c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t]
        d += ` C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`
      }
    }
    return d
  }
  const isCusp = (a, b, c2) => {
    const v1 = [b[0] - a[0], b[1] - a[1]], v2 = [c2[0] - b[0], c2[1] - b[1]]
    const n = Math.hypot(...v1) * Math.hypot(...v2)
    return n > 0 && (v1[0] * v2[0] + v1[1] * v2[1]) / n < -0.5
  }

  const out = []
  for (let row = 0; row < 3; row++) for (let k = 0; k < 11; k++) {
    const ch = ROWS[row][k]
    const g = rows[row][k]
    const cx = g.bb.x + g.bb.width / 2
    c.setTransform(1, 0, 0, 1, 0, 0)
    c.fillStyle = '#fff'; c.fillRect(0, 0, N, N); c.fillStyle = '#000'
    c.setTransform(S * K, 0, 0, S * K, (50 - cx * S) * K, (BASE - base[row] * S) * K)
    c.fill(new Path2D(g.d))
    c.setTransform(1, 0, 0, 1, 0, 0)
    const img = c.getImageData(0, 0, N, N).data
    const D = dt(img)
    const box = ink(img)
    // Контур буквы таблицы для листа проверки (в координатах бокса).
    const outline = { d: g.d, t: [S, 0, 0, S, 50 - cx * S, BASE - base[row] * S] }

    let strokes
    if (MANUAL[ch]) strokes = MANUAL[ch].map(st => st.map(p => [...p]))
    else {
      const L = INPUT.letters.find(l => l.letter === ch)
      const hb = helvBox(ch, L.ox)
      const map = ([x, y]) => [box.x0 + (x - hb.x0) * (box.x1 - box.x0) / Math.max(1, hb.x1 - hb.x0), box.y0 + (y - hb.y0) * (box.y1 - box.y0) / Math.max(1, hb.y1 - hb.y0)]
      strokes = L.strokes.map(st => st.map(map))
    }
    // Притянуть к оси штриха.
    const R = (MANUAL[ch] ? 3 : 6) * K, LAMBDA = 0.35
    const snapped = strokes.map(st => st.map(([x, y]) => {
      const px = Math.round(x * K), py = Math.round(y * K)
      let best = -1e9, bx = px, by = py
      for (let dy = -R; dy <= R; dy += 2) for (let dx = -R; dx <= R; dx += 2) {
        const qx = px + dx, qy = py + dy; if (qx < 0 || qy < 0 || qx >= N || qy >= N) continue
        const dd = Math.hypot(dx, dy); if (dd > R) continue
        const s = D[qy * N + qx] / 3 - LAMBDA * dd
        if (s > best) { best = s; bx = qx; by = qy }
      }
      return [bx / K, by / K]
    }))
    // Лёгкое сглаживание соседями, потом прореживание; на разворотах — разрыв сегмента.
    const paths = snapped.map(st => {
      const sm = st.map((p, i) => (i === 0 || i === st.length - 1 || isCusp(st[i - 1], p, st[i + 1])) ? p : [(st[i - 1][0] + 2 * p[0] + st[i + 1][0]) / 4, (st[i - 1][1] + 2 * p[1] + st[i + 1][1]) / 4])
      const segs = [[sm[0]]]
      for (let i = 1; i < sm.length; i++) {
        segs[segs.length - 1].push(sm[i])
        if (i < sm.length - 1 && isCusp(sm[i - 1], sm[i], sm[i + 1])) segs.push([sm[i]])
      }
      return bezier(segs.map(s => rdp(s, 0.9)))
    })
    out.push({ letter: ch, paths, outline, xhTop: BASE - xh * S, base: BASE })
  }
  return out
}, { INPUT: input, ROWS, MANUAL })

await browser.close()

const ts = `// Рукописные буквы для «Как пишется»: у каждой буквы — штрихи в порядке письма, каждый — одна плавная линия
// (кубические Безье, SVG path) в боксе 0..100: верх строчных y=30, строка y=70. Буква на этом шаге рисуется
// только из этих линий (бледная подложка, перо, проверка пальца), поэтому перо всегда идёт ровно по букве.
// Форма и направление — по таблице письма мхедрули «მხედრულით წერის მიმართულება» (User:Jaqeli, 2013;
// вектор File:Mkhedruli.svg, User:Carnby; общественное достояние):
// https://commons.wikimedia.org/wiki/File:Mkhedruli.svg. Сгенерировано scripts/alphabet-strokes/handwriting.mjs,
// руками не править (ручные правки — scripts/alphabet-strokes/manual.mjs). confidence — насколько однозначен
// источник для буквы (high / medium / low); ученику не показываем.

export interface Handwriting { strokes: string[]; confidence: 'high' | 'medium' | 'low' }

export const HANDWRITING: Record<string, Handwriting> = {
${result.map(l => `  '${l.letter}': { confidence: '${meta[l.letter].confidence}', strokes: ${JSON.stringify(l.paths)} }`).join(',\n')}
}
`
writeFileSync(resolve(here, '../../src/Trale/miniapp-src/src/alphabet/intro/handwriting.ts'), ts)

const g0 = result[0]
writeFileSync(resolve(here, 'grid-sheet.html'), `<html><meta charset="utf-8"><style>body{margin:4px;font:11px sans-serif;width:1060px;background:#fff}.c{display:inline-block;margin:2px;text-align:center}</style><body>` + result.map(l => {
  const [a, b, c2, d2, e, f] = l.outline.t
  let grid = ''
  for (let v = 0; v <= 100; v += 5) grid += `<line x1="${v}" x2="${v}" y1="0" y2="100" stroke="${v % 10 ? '#eee' : '#bbb'}" stroke-width="${v % 10 ? .2 : .35}"/><line y1="${v}" y2="${v}" x1="0" x2="100" stroke="${v % 10 ? '#eee' : '#bbb'}" stroke-width="${v % 10 ? .2 : .35}"/>` + (v % 10 ? '' : `<text x="${v}" y="2.5" font-size="2.6" fill="#c00" text-anchor="middle">${v}</text><text x="0.5" y="${v + 1}" font-size="2.6" fill="#c00">${v}</text>`)
  return `<div class="c"><svg viewBox="0 0 100 100" width="340" height="340">${grid}<path d="${l.outline.d}" transform="matrix(${a} ${b} ${c2} ${d2} ${e} ${f})" fill="#000" fill-opacity="0.45"/></svg><div>${l.letter}</div></div>`
}).join('') + `</body></html>`)
console.log('xh', g0.xhTop, 'base', g0.base)
const arrow = (d) => `<path d="${d}" fill="none" stroke="url(#g)" stroke-width="0"/>`
const cells = result.map(l => {
  const [a, b, c2, d2, e, f] = l.outline.t
  const strokes = l.paths.map((d, i) => {
    const col = ['#E01A3C', '#1B5FB0', '#0A9D58'][i % 3]
    const m = d.match(/^M([\d.-]+) ([\d.-]+)/)
    return `<path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#ar${i % 3})"/>` +
      `<circle cx="${m[1]}" cy="${m[2]}" r="3.4" fill="${col}"/><text x="${m[1]}" y="${+m[2] + 1.5}" font-size="4.4" font-weight="bold" fill="#fff" text-anchor="middle" font-family="sans-serif">${i + 1}</text>`
  }).join('')
  return `<div class="c"><svg viewBox="0 0 100 100" width="170" height="170">
<line x1="0" x2="100" y1="30" y2="30" stroke="#f6a" stroke-width=".3" stroke-dasharray="1.5 1"/><line x1="0" x2="100" y1="70" y2="70" stroke="#f6a" stroke-width=".3" stroke-dasharray="1.5 1"/>
<path d="${l.outline.d}" transform="matrix(${a} ${b} ${c2} ${d2} ${e} ${f})" fill="#000" fill-opacity="0.12"/>
${l.paths.map(d => `<path d="${d}" fill="none" stroke="#15100A" stroke-opacity="0.12" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}
${strokes}</svg><div>${l.letter} · ${meta[l.letter].confidence}</div></div>`
}).join('')
const markers = ['#E01A3C', '#1B5FB0', '#0A9D58'].map((c, i) => `<marker id="ar${i}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="${c}"/></marker>`).join('')
writeFileSync(resolve(here, 'handwriting-sheet.html'), `<html><meta charset="utf-8"><style>body{margin:8px;font:12px sans-serif;width:1100px;background:#fff}.c{display:inline-block;margin:3px;text-align:center}</style><body><svg width="0" height="0"><defs>${markers}</defs></svg>${cells}</body></html>`)
console.log('ok', result.length, arrow ? '' : '')
