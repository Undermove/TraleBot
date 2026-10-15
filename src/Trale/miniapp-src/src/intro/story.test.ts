import { describe, expect, it } from 'vitest'
// @ts-ignore — тесты идут в Node, а типов Node в мини-аппе нет
import { readFileSync, readdirSync, statSync } from 'node:fs'
// @ts-ignore
import { join } from 'node:path'
import { ALIVE, CITIES, COUNTRIES, INTRO_LESSONS, JOBS, NAME_LIST, PEOPLE, PHRASES, SMALL, THINGS, geoName } from './story'

// Весь грузинский в «Знакомстве» — из story.json: фразы (phrases) и словарик (vocab), у каждой записи источник.
// Тест собирает все грузинские слова из кода сцен и требует, чтобы каждое было в story.json.

const GEO = /[Ⴀ-ჿ]+/g
const words = (s: string) => s.match(GEO) ?? []

const ALLOWED = new Set<string>([
  ...Object.values(PHRASES).flatMap(p => [...words(p.geo), ...(p.words ?? []).flatMap(([g]) => words(g))]),
  ...NAME_LIST,
  ...COUNTRIES.flatMap(c => [c.base, c.from]),
  ...CITIES.flatMap(c => [c.base, c.in]),
  ...[...JOBS, ...ALIVE, ...THINGS, ...PEOPLE, ...SMALL].flatMap(w => words(w.geo)),
  // Одиночные буквы и окончания, которые сцены показывают как часть правила.
  'ი', 'ში', 'დან'
])

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f: string) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|json)$/.test(f) && !/\.test\./.test(f) && f !== 'story.json' ? [p] : []
  })
}

describe('story.json', () => {
  it('у каждой фразы и слова есть источник', () => {
    for (const p of Object.values(PHRASES)) expect(p.src, p.id).toMatch(/\S{8,}/)
    for (const w of [...JOBS, ...ALIVE, ...THINGS, ...PEOPLE, ...SMALL, ...COUNTRIES, ...CITIES]) expect(w.src).toMatch(/\S{4,}/)
  })
  it('уроки идут подряд с 1, у каждого есть сцены, все новые фразы существуют', () => {
    INTRO_LESSONS.forEach((l, i) => {
      expect(l.id).toBe(i + 1)
      expect(l.steps.length).toBeGreaterThan(0)
      for (const id of l.new) expect(PHRASES[id], `${l.id}: ${id}`).toBeDefined()
    })
  })
  it('сцена «Новая фраза» есть только там, где есть новые фразы', () => {
    for (const l of INTRO_LESSONS) {
      const hasPhrase = l.steps.some(s => s.kind === 'phrase')
      expect(hasPhrase, `урок ${l.id}`).toBe(l.new.length > 0)
    }
  })
  it('разбор фразы по словам складывается в саму фразу', () => {
    for (const p of Object.values(PHRASES)) {
      if (!p.words) continue
      expect(words(p.geo).join(' '), p.id).toBe(p.words.flatMap(([g]) => words(g)).join(' '))
    }
  })
})

describe('грузинский в коде сцен', () => {
  const dir = `${(globalThis as any).process.cwd()}/src/intro`
  for (const f of files(dir)) {
    it(f.replace(dir, '.'), () => {
      const unknown = words(readFileSync(f, 'utf8')).filter(w => !ALLOWED.has(w))
      expect([...new Set(unknown)], 'грузинские слова без источника в story.json').toEqual([])
    })
  }
})

describe('имя по-грузински', () => {
  it('имя на согласную получает ი, на гласную — нет', () => {
    expect(geoName('Карлос')).toMatchObject({ geo: 'კარლოსი', added: true })
    expect(geoName('Нино')).toMatchObject({ geo: 'ნინო', added: false })
  })
})
