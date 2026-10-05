/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MeaningText, VerbHint } from './parts'
import { meaningOf, meaningOfHit, quoted, sameMeaning } from './meaning'
import { buildItems } from './ladder/engine'
import { CATALOG, verbByLemma } from './testing/catalog'
import { CARD_TENSES, TENSES, TITLE_TERM, type VerbFormHitDto } from './types'

// Упражнения и карточка говорят простыми словами: вместо названия времени — русская фраза самой формы.

// Исходники src/verbs (без тестов) — чтобы учебные термины не вернулись в интерфейс.
const sources = import.meta.glob('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const TERMS = /аорист|имперфект|оптатив|конъюнктив|перфект|плюсквамперфект|масдар|инфинитив|показател[ья] лица/i
const withoutComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('no textbook terms in what the learner reads', () => {
  it('keeps grammar terms out of the catalog explanation of every verb («что это значит?»)', () => {
    // Первая фраза свёрнутого пояснения приходит из каталога (scripts/verbs/analyze.mjs, поле reason).
    const found = CATALOG.filter(v => TERMS.test(v.reason)).map(v => `${v.ru}: ${v.reason}`)
    expect(found).toEqual([])
    expect(CATALOG.every(v => v.reason.trim().length > 0)).toBe(true)
  })

  it('keeps grammar terms out of every string of src/verbs', () => {
    const found: string[] = []
    for (const [file, code] of Object.entries(sources)) {
      if (/\.test\.|\/testing\/|fixture/.test(file)) continue
      withoutComments(code).split('\n').forEach((line, n) => {
        // Единственное место, где термин записан, — справочник в types.ts (поле term и TITLE_TERM):
        // оттуда его берёт только свёрнутое пояснение карточки.
        const allowed = file === './types.ts' && /\bterm:|TITLE_TERM/.test(line)
        if (!allowed && TERMS.test(line)) found.push(`${file}:${n + 1}: ${line.trim()}`)
      })
    }
    expect(found).toEqual([])
  })

  it('names every time by what it says, and keeps the textbook term as separate data', () => {
    for (const { name, term } of Object.values(TENSES)) {
      expect(name).not.toMatch(TERMS)
      expect(term).not.toBe('')
    }
    expect(TENSES.aorist.name).toBe('Прошедшее: сделал')
    expect(TENSES.imperfect.name).toBe('Прошедшее: делал')
    expect(TITLE_TERM).toBe('масдар')
  })

  it('reads the textbook terms only through the reference in types.ts', () => {
    const users = Object.entries(sources)
      .filter(([file, code]) => !/\.test\./.test(file) && file !== './types.ts' && /\.term\b|TITLE_TERM/.test(withoutComments(code)))
      .map(([file]) => file)
    expect(users).toEqual(['./VerbSheet.tsx'])
  })
})

describe('what a form means, in plain Russian', () => {
  const write = verbByLemma('წერს')
  const want = verbByLemma('უნდა')

  it('is the phrase conjugated for this verb', () => {
    expect(meaningOf(want, 'present', 0)).toEqual({ text: 'я хочу', note: null })
    expect(meaningOf(want, 'imperfect', 1)).toEqual({ text: 'ты хотел(а)', note: null })
    expect(meaningOf(write, 'future', 3)).toEqual({ text: 'мы будем писать', note: null })
    expect(meaningOf(write, 'optative', 2)).toEqual({ text: 'ему надо писать', note: null })
    expect(meaningOf(write, 'conditional', 0)).toEqual({ text: 'я бы писал(а)', note: null })
  })

  it('carries a note only where two times read the same in Russian', () => {
    expect(quoted(meaningOf(write, 'aorist', 0))).toBe('«я писал(а)» (один раз · сделано)')
    expect(quoted(meaningOf(write, 'imperfect', 0))).toBe('«я писал(а)» (долго или часто)')
    expect(sameMeaning(meaningOf(write, 'aorist', 0), meaningOf(write, 'imperfect', 0))).toBe(false)
    expect(meaningOf(write, 'present', 0).note).toBeNull()
  })

  it('handles the verbs that Russian says differently: «быть», «иметь», gendered past', () => {
    expect(meaningOf(verbByLemma('არის'), 'present', 0).text).toBe('я есть')
    expect(meaningOf(verbByLemma('არის'), 'future', 0).text).toBe('я буду')
    expect(meaningOf(verbByLemma('აქვს'), 'present', 0).text).toBe('у меня есть')
    expect(meaningOf(verbByLemma('მიდის'), 'imperfect', 0).text).toBe('я шёл / шла')
    expect(meaningOf(verbByLemma('მიდის'), 'imperfect', 2).text).toBe('он шёл')
  })

  it('exists for every main-tense cell of every catalog verb, and never twice within a verb', () => {
    for (const verb of CATALOG) {
      const seen = new Set<string>()
      for (const tense of CARD_TENSES) {
        (verb.tenses[tense] ?? []).forEach((variants, person) => {
          if (!variants.length) return
          expect(verb.meanings?.[tense]?.[person], `${verb.ru} ${tense}:${person}`).toBeTruthy()
          const text = quoted(meaningOf(verb, tense, person))
          expect(seen.has(text), `${verb.ru}: ${text}`).toBe(false)
          seen.add(text)
        })
      }
    }
  })

  it('falls back to the person and a plain name of the time when the base has no phrase', () => {
    expect(meaningOf({ meanings: null }, 'aorist', 2)).toEqual({ text: 'он · прошедшее: сделал', note: null })
    expect(meaningOfHit({ tense: 'perfect', person: 0 }).text).toBe('я · оказывается, сделал')
  })

  it('gives every ladder form its phrase', () => {
    const items = buildItems(want)
    expect(items.slice(0, 2).map(i => i.meaning.text)).toEqual(['я хочу', 'я хотел(а)'])
  })
})

describe('where the phrase is shown', () => {
  const hit: VerbFormHitDto = {
    form: verbByLemma('წერს').tenses.imperfect![0][0], verbId: 'წერს', title: verbByLemma('წერს').title, ru: 'писать',
    tense: 'imperfect', person: 0, meaning: 'я писал(а)', meaningNote: 'долго или часто'
  }

  it('the dictionary hint says the form in plain words, with the note that tells it from its twin', () => {
    render(<VerbHint hit={hit} onOpen={() => {}} />)

    const text = screen.getByTestId('verb-hint').textContent!
    expect(text).toContain(`${hit.form} — я писал(а)`)
    expect(screen.getByTestId('meaning-note').textContent).toBe('долго или часто')
    expect(text).not.toMatch(TERMS)
  })

  it('shows no note when the phrase alone is enough', () => {
    render(<div data-testid="m"><MeaningText meaning={{ text: 'я хочу', note: null }} /></div>)

    expect(screen.getByTestId('m').textContent).toBe('я хочу')
    expect(screen.queryByTestId('meaning-note')).toBeNull()
  })
})
