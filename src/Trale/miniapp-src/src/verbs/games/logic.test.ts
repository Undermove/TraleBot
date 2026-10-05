import { describe, it, expect } from 'vitest'
import { CARD_TENSES } from '../types'
import { availableGames } from './availability'
import { COLS, boneCount, boneRows, bonesNear, digOptions, digs, plantBones } from './boneField'
import { describeSlot, formOf, shuffle, slotMeaning, slotsOf } from './common'
import { assemble, builderCells, makePuzzle, schemeOf, splitForm, stageFor, wrongRows } from './formParts'
import { CATALOG, seeded, verbByLemma, verbRu } from '../testing/catalog'
import { STOPS, canPlayTimeMachine, locate, makeTimeRound, personsFor } from './timeRounds'

describe('which games a verb gets', () => {
  it('offers all three for a verified pattern verb that takes a preverb', () => {
    expect(availableGames(verbRu('писать'))).toEqual(['time', 'bones', 'builder'])
  })

  it('offers nothing for a verb that is not verified', () => {
    expect(availableGames(verbRu('писать', { status: 'generated' }))).toEqual([])
    expect(availableGames(verbRu('писать', { status: undefined }))).toEqual([])
  })

  it('offers nothing when there is no Russian translation to build the prompt from', () => {
    expect(availableGames(verbRu('писать', { ru: ' ' }))).toEqual([])
  })

  it('keeps the constructor away from verbs it cannot cut into parts', () => {
    // «идти» — разные корни; «говорить» — по образцу, но будущее строится не приставкой; «читать» — с особенностью.
    for (const ru of ['идти', 'говорить', 'читать']) expect(availableGames(verbRu(ru))).toEqual(['time', 'bones'])
  })

  it('drops the time machine when a form would lead to two stops at once', () => {
    const verb = verbRu('смотреть')
    expect(formOf(verb, 'future', 0)).toBe(formOf(verb, 'present', 0))
    expect(availableGames(verb)).toEqual(['bones'])
  })

  it('drops the time machine when a needed person has no form', () => {
    const verb = verbRu('писать')
    verb.tenses.aorist![4] = []
    expect(canPlayTimeMachine(verb)).toBe(false)
    expect(availableGames(verb)).toEqual(['bones', 'builder'])
  })

  it('drops the field when fewer than three tenses are complete', () => {
    const verb = verbRu('писать')
    verb.tenses = { present: verb.tenses.present, future: verb.tenses.future }
    // Двух времён хватает конструктору (приставка есть и нет), но не полю и не трём остановкам.
    expect(availableGames(verb)).toEqual(['builder'])
  })

  it('gives a game to every catalog verb that has at least three of the six main tenses', () => {
    for (const verb of CATALOG) {
      const mainTenses = CARD_TENSES.filter(t => verb.tenses[t]).length
      if (mainTenses >= 3) expect(availableGames(verb).length, verb.ru).toBeGreaterThan(0)
    }
  })

  it('offers no games for a verb with only two tenses — the row is simply absent on its card', () => {
    // «хотеть»: в источнике только настоящее и имперфект.
    const want = verbByLemma('უნდა')

    expect(CARD_TENSES.filter(t => want.tenses[t])).toEqual(['present', 'imperfect'])
    expect(availableGames(want)).toEqual([])
  })
})

describe('Russian prompts', () => {
  it('say what a cell means with the Russian phrase of this very verb, never with a tense name', () => {
    const write = verbRu('писать')

    expect(slotMeaning(write, { tense: 'future', person: 1 })).toEqual({ text: 'ты будешь писать', note: null })
    expect(describeSlot(write, { tense: 'aorist', person: 5 })).toBe('«они писали» (один раз · сделано)')
    expect(describeSlot(write, { tense: 'imperfect', person: 5 })).toBe('«они писали» (долго или часто)')
  })

  it('fall back to the person and a plain name of the time for a verb without phrases', () => {
    const bare = verbRu('писать', { meanings: null, meaningChips: null })

    expect(describeSlot(bare, { tense: 'aorist', person: 5 })).toBe('«они · прошедшее: сделал»')
  })
})

describe('time machine rounds', () => {
  const verb = verbRu('писать')

  it('starts with «я» and adds a person every four correct answers, up to six', () => {
    expect([0, 3, 4, 8, 19, 20, 99].map(personsFor)).toEqual([1, 1, 2, 3, 5, 6, 6])
  })

  it('finds the stop and person a form really belongs to', () => {
    expect(locate(verb, formOf(verb, 'aorist', 2))).toEqual({ stop: 0, person: 2 })
    expect(locate(verb, formOf(verb, 'future', 5))).toEqual({ stop: 2, person: 5 })
    expect(locate(verb, formOf(verb, 'imperfect', 0))).toBeNull()
  })

  it('offers four different forms, each leading to one of the stops, the answer among them', () => {
    const rng = seeded(7)
    for (let i = 0; i < 200; i++) {
      const persons = 1 + (i % 6)
      const round = makeTimeRound(verb, persons, rng)
      expect(round.person).toBeLessThan(persons)
      expect(round.answer).toBe(formOf(verb, STOPS[round.stop].tense, round.person))
      expect(new Set(round.options).size).toBe(4)
      expect(round.options).toContain(round.answer)
      for (const o of round.options) expect(locate(verb, o)).not.toBeNull()
    }
  })

  it('does not ask the same question twice in a row', () => {
    const rng = seeded(3)
    let prev = makeTimeRound(verb, 1, rng)
    for (let i = 0; i < 100; i++) {
      const next = makeTimeRound(verb, 1, rng, prev)
      expect(next.stop).not.toBe(prev.stop)
      prev = next
    }
  })

  it('works for every catalog verb it is offered for', () => {
    for (const v of CATALOG.filter(canPlayTimeMachine)) {
      const round = makeTimeRound(v, 6, seeded(11))
      expect(locate(v, round.answer), v.ru).toEqual({ stop: round.stop, person: round.person })
    }
  })
})

describe('bones field', () => {
  const verb = verbRu('писать')
  const rows = boneRows(verb)

  it('uses the main tenses that have all six persons', () => {
    expect(rows).toEqual(CARD_TENSES)
    // У «быть» в каталоге нет имперфекта — строки с дырами в поле не попадают.
    expect(boneRows(verbRu('быть'))).toEqual(CARD_TENSES.filter(t => t !== 'imperfect'))
  })

  it('buries one bone per five cells, all inside the field', () => {
    expect([18, 30, 36].map(boneCount)).toEqual([4, 6, 7])
    const bones = plantBones(36, seeded(5))
    expect(bones.size).toBe(7)
    for (const b of bones) expect(b).toBeGreaterThanOrEqual(0), expect(b).toBeLessThan(36)
  })

  it('counts bones in the eight neighbouring cells without wrapping around the edge', () => {
    //  . B . . . .
    //  B x . . . B
    //  . . . . . .
    const bones = new Set([1, COLS, COLS + 5])
    expect(bonesNear(bones, 3, COLS + 1)).toBe(2)
    expect(bonesNear(bones, 3, 0)).toBe(2)
    expect(bonesNear(bones, 3, 2 * COLS)).toBe(1)
    // Правый край второй строки не сосед левому краю третьей.
    expect(bonesNear(bones, 3, 2 * COLS + 1)).toBe(1)
    expect(bonesNear(new Set([COLS - 1]), 3, COLS)).toBe(0)
  })

  it('digs a cell only with its own form', () => {
    const cell = rows.indexOf('future') * COLS + 1
    expect(digs(verb, rows, cell, ` ${formOf(verb, 'future', 1)} `)).toBe(true)
    expect(digs(verb, rows, cell, formOf(verb, 'present', 1))).toBe(false)
    expect(digs(verb, rows, cell, '')).toBe(false)
  })

  it('accepts any variant when a cell has two', () => {
    const withVariants = CATALOG.find(v => boneRows(v).some(t => v.tenses[t]!.some(p => p.length > 1)))!
    const r = boneRows(withVariants)
    const tense = r.find(t => withVariants.tenses[t]!.some(p => p.length > 1))!
    const person = withVariants.tenses[tense]!.findIndex(p => p.length > 1)
    const cell = r.indexOf(tense) * COLS + person
    for (const variant of withVariants.tenses[tense]![person]) expect(digs(withVariants, r, cell, variant)).toBe(true)
    expect(digOptions(withVariants, r, cell, seeded(2)).filter(o => digs(withVariants, r, cell, o))).toHaveLength(1)
  })

  it('offers four different forms from the field, exactly one of which digs the cell', () => {
    const rng = seeded(9)
    for (let cell = 0; cell < rows.length * COLS; cell++) {
      const options = digOptions(verb, rows, cell, rng)
      expect(new Set(options).size).toBe(4)
      expect(options.filter(o => digs(verb, rows, cell, o))).toHaveLength(1)
    }
  })
})

describe('form parts', () => {
  const verb = verbRu('писать')
  const scheme = schemeOf(verb)!

  it('derives root, preverb and person marker from the table itself', () => {
    expect(scheme.root).toBe(verb.root)
    expect(scheme.preverb + formOf(verb, 'present', 0)).toBe(formOf(verb, 'future', 0))
    expect(scheme.marker + formOf(verb, 'present', 1)).toBe(formOf(verb, 'present', 0))
  })

  it('cuts every main form so that the parts add back up to the form', () => {
    for (const v of CATALOG) {
      const s = schemeOf(v)
      for (const cell of builderCells(v)) {
        expect(assemble(s!.root, cell.parts), `${v.ru}: ${cell.form}`).toBe(cell.form)
        expect(cell.parts.marker !== '', cell.form).toBe(cell.person === 0 || cell.person === 3)
        expect(['', s!.preverb]).toContain(cell.parts.preverb)
      }
    }
  })

  it('has the preverb in the future and aorist and not in the present', () => {
    expect(splitForm(scheme, formOf(verb, 'present', 2), 2)!.preverb).toBe('')
    expect(splitForm(scheme, formOf(verb, 'future', 2), 2)!.preverb).toBe(scheme.preverb)
    expect(splitForm(scheme, formOf(verb, 'aorist', 0), 0)).toMatchObject({ preverb: scheme.preverb, marker: scheme.marker })
  })

  it('rejects forms it cannot explain', () => {
    // Перфект: между приставкой и корнем стоит не показатель 1-го лица.
    expect(splitForm(scheme, formOf(verb, 'perfect', 0), 0)).toBeNull()
    // Форма «я» в клетке «ты»: показатель лица там не положен.
    expect(splitForm(scheme, formOf(verb, 'present', 0), 1)).toBeNull()
    expect(splitForm(scheme, formOf(verbRu('идти'), 'present', 0), 0)).toBeNull()
  })

  it('has no scheme for verbs that are not built as preverb + present', () => {
    for (const ru of ['идти', 'говорить', 'читать', 'смотреть']) expect(schemeOf(verbRu(ru)), ru).toBeNull()
    expect(builderCells(verbRu('говорить'))).toEqual([])
  })

  it('opens the rows one by one: ending, then person marker, then preverb', () => {
    expect([0, 2, 3, 5, 6, 40].map(stageFor)).toEqual([1, 1, 2, 2, 3, 3])
    const rng = seeded(4)
    for (let i = 0; i < 60; i++) {
      const one = makePuzzle(verb, 0, rng)
      expect(one.preverbs).toEqual([one.cell.parts.preverb])
      expect(one.markers).toEqual([one.cell.parts.marker])
      expect(one.cell.person).toBeLessThan(3)

      const two = makePuzzle(verb, 3, rng)
      expect(two.preverbs).toEqual([two.cell.parts.preverb])
      expect(two.markers).toEqual([scheme.marker, ''])

      const three = makePuzzle(verb, 6, rng)
      expect([...three.preverbs].sort()).toEqual(['', scheme.preverb].sort())

      for (const p of [one, two, three]) {
        expect(p.endings).toContain(p.cell.parts.ending)
        expect(new Set(p.endings).size).toBe(p.endings.length)
        expect(p.endings.length).toBeGreaterThan(1)
        expect(p.endings.length).toBeLessThanOrEqual(4)
      }
    }
  })

  it('adds another verb\'s preverb as a decoy on the last stage only', () => {
    const other = schemeOf(verbRu('делать'))!.preverb
    expect(other).not.toBe(scheme.preverb)
    expect(makePuzzle(verb, 6, seeded(1), [other, scheme.preverb]).preverbs.sort()).toEqual(['', scheme.preverb, other].sort())
    expect(makePuzzle(verb, 0, seeded(1), [other]).preverbs).toHaveLength(1)
  })

  it('does not repeat the previous form', () => {
    const rng = seeded(8)
    let prev = makePuzzle(verb, 0, rng)
    for (let i = 0; i < 100; i++) {
      const next = makePuzzle(verb, 0, rng, [], prev)
      expect(next.cell.form).not.toBe(prev.cell.form)
      prev = next
    }
  })

  it('names the rows that differ from the target', () => {
    const cell = builderCells(verb).find(c => c.tense === 'future' && c.person === 0)!
    expect(wrongRows(cell, cell.parts)).toEqual([])
    expect(wrongRows(cell, { ...cell.parts, preverb: '', marker: '' })).toEqual(['preverb', 'marker'])
  })
})

describe('shuffle', () => {
  it('keeps every element', () => {
    expect(shuffle([1, 2, 3, 4, 5], seeded(1)).sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('finds the slot of a form among the given tenses only', () => {
    const verb = verbRu('писать')
    expect(slotsOf(verb, formOf(verb, 'optative', 3), ['optative'])).toEqual([{ tense: 'optative', person: 3 }])
    expect(slotsOf(verb, formOf(verb, 'optative', 3), ['present', 'future'])).toEqual([])
  })
})
