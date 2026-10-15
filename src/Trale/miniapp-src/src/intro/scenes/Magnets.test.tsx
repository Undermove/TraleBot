import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { seeded } from '../../verbs/testing/catalog'
import { CITIES, COUNTRIES, introLesson } from '../story'
import Magnets from './Magnets'
import {
  FOREIGN_NAMES, activeOrder, cityItems, countryItems, finished, nameItem, startBelt, tap, tick, transform, xOf, type Belt, type MagnetSet
} from './Magnets.logic'

beforeEach(() => localStorage.clear())

/** Крутим ленту, пока нужная плитка не въедет. */
function waitFor(b: Belt, at: number, rng: () => number, key: string): { belt: Belt; at: number; id: number } {
  let belt = b
  for (let k = 0; k < 400; k++) {
    const tile = belt.tiles.find(t => t.item.key === key && xOf(t, belt, at) < 0.9)
    if (tile) return { belt, at, id: tile.id }
    at += 100
    belt = tick(belt, at, rng).belt
  }
  throw new Error(`tile ${key} never came`)
}

describe('magnets: words', () => {
  it('-დან keeps the word whole, -ში drops the final ი — and both match story.json', () => {
    for (const c of countryItems()) {
      const t = transform(c)
      expect(t.keep + t.add).toBe(c.result)
      expect(t.keep).toBe(c.base)
    }
    for (const c of cityItems()) {
      const t = transform(c)
      expect(t.drop).toBe('ი')
      expect(t.keep + t.add).toBe(c.result)
    }
    expect(countryItems().map(c => c.result)).toEqual(COUNTRIES.map(c => c.from))
    expect(cityItems().map(c => c.result)).toEqual(CITIES.map(c => c.in))
  })

  it('foreign names: consonant gets ი, vowel stays; both kinds exist', () => {
    expect(nameItem('Карлос')).toMatchObject({ result: 'კარლოსი', tool: 'ი' })
    expect(nameItem('Лука').tool).toBe('none')
    const tools = FOREIGN_NAMES.map(n => nameItem(n).tool)
    expect(tools.filter(t => t === 'ი').length).toBeGreaterThanOrEqual(4)
    expect(tools.filter(t => t === 'none').length).toBeGreaterThanOrEqual(4)
  })
})

describe('magnets: belt engine', () => {
  it.each<MagnetSet>(['from', 'in', 'both'])('%s: orders use only the right words, never twice in a row', set => {
    const b = startBelt(set, seeded(3), 0)
    expect(b.queue.length).toBe(b.total)
    b.queue.forEach((o, i) => {
      if (set === 'from') expect(o.tool).toBe('დან')
      if (set === 'in') expect(o.tool).toBe('ში')
      if (i) expect(o.key).not.toBe(b.queue[i - 1].key)
    })
    if (set === 'both') expect(new Set(b.queue.map(o => o.tool)).size).toBe(2)
  })

  it('wrong magnet and wrong tile are misses with a combo reset; right one scores and speeds up', () => {
    const rng = seeded(5)
    let { belt, at, id } = waitFor(startBelt('both', rng, 0), 0, rng, startBelt('both', seeded(5), 0).queue[0].key)
    const want = activeOrder(belt)!
    const wrongTool = want.tool === 'ში' ? 'დან' : 'ში'
    let r = tap(belt, id, wrongTool, at)
    expect(r.result).toBe('wrongMag')
    expect(r.belt.misses).toBe(1)
    r = tap(r.belt, id, null, at)
    expect(r.result).toBe('nomag')
    r = tap(r.belt, id, want.tool, at)
    expect(r.result).toBe('ok')
    expect(r.belt.done).toBe(1)
    expect(r.belt.score).toBe(10)
    expect(r.belt.travel).toBeLessThan(belt.travel)
    expect(r.belt.tiles.find(t => t.id === id)).toBeUndefined()
  })

  it('a missed target tile leaves the belt and comes back later', () => {
    const rng = seeded(9)
    let belt = startBelt('from', rng, 0)
    const want = activeOrder(belt)!
    const got = waitFor(belt, 0, rng, want.key)
    belt = got.belt
    let at = got.at, missed = 0
    for (let k = 0; k < 200 && !missed; k++) { at += 100; const r = tick(belt, at, rng); belt = r.belt; missed += r.missed.length }
    expect(missed).toBe(1)
    expect(belt.combo).toBe(0)
    expect(() => waitFor(belt, at, rng, want.key)).not.toThrow()
  })

  it.each<MagnetSet>(['name', 'from', 'in', 'both'])('%s: a perfect run finishes with combo = total', set => {
    const rng = seeded(11)
    let belt = startBelt(set, rng, 0), at = 0
    while (!finished(belt)) {
      // В свободном режиме берём первую же въехавшую плитку — ждать конкретную значит упустить остальные.
      let w: { belt: Belt; at: number; id: number }
      if (belt.mode === 'order') w = waitFor(belt, at, rng, activeOrder(belt)!.key)
      else {
        while (!belt.tiles.length) { at += 100; belt = tick(belt, at, rng).belt }
        w = { belt, at, id: belt.tiles[0].id }
      }
      const tile = w.belt.tiles.find(t => t.id === w.id)!
      const r = tap(w.belt, w.id, tile.item.tool, w.at)
      expect(r.result).toBe('ok')
      belt = r.belt; at = w.at
    }
    expect(belt.done).toBe(belt.total)
    expect(belt.best).toBe(belt.total)
    expect(tick(belt, at + 99999, rng).belt).toBe(belt)
  })
})

describe('Magnets scene (автомат с краном)', () => {
  afterEach(() => vi.useRealTimers())

  /** Тыкаем капсулу нужного окончания: кран сам подъедет, схватит и бросит в ответ. */
  async function answerRound() {
    const want = screen.getByTestId('endings-answer').dataset.tool!
    const cap = screen.getAllByTestId(`capsule-${want}`)[0]
    fireEvent.click(cap)
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
  }

  async function play(set: MagnetSet) {
    vi.useFakeTimers()
    const onDone = vi.fn()
    const lesson = introLesson(set === 'from' ? 14 : set === 'in' ? 18 : 24)
    render(<Magnets lesson={lesson} step={{ kind: 'magnets', set }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(2)} now={() => Date.now()} />)
    fireEvent.click(screen.getByText('Начать'))
    for (let k = 0; k < 20 && !screen.queryByTestId('game-end'); k++) await answerRound()
    expect(screen.getByTestId('game-end')).toBeInTheDocument()
    expect(screen.getByTestId('rule-card')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  }

  it('from: plays every round to the end', () => play('from'))
  it('both: plays every round to the end', () => play('both'))

  it('a wrong capsule bounces back and the round stays', async () => {
    vi.useFakeTimers()
    render(<Magnets lesson={introLesson(18)} step={{ kind: 'magnets', set: 'in' }} fraction={0.5} onExit={() => {}} onDone={() => {}} rng={seeded(3)} now={() => Date.now()} />)
    fireEvent.click(screen.getByText('Начать'))
    expect(screen.getByTestId('endings-round').textContent).toContain('1 /')
    fireEvent.click(screen.getAllByTestId('capsule-დან')[0])
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    expect(screen.getByTestId('endings-round').textContent).toContain('1 /')
    expect(screen.getByText(/-დან — это «из»/)).toBeInTheDocument()
    await answerRound()
    expect(screen.getByTestId('endings-round').textContent).toContain('2 /')
  })

  it('name: prints the name, applies ი, saves it, then foreign names to the end', async () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<Magnets lesson={introLesson(8)} step={{ kind: 'magnets', set: 'name' }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(4)} now={() => Date.now()} />)
    fireEvent.click(screen.getByText('Начать'))
    fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Карлос' } })
    fireEvent.click(screen.getByTestId('name-print'))
    await act(async () => { await vi.advanceTimersByTimeAsync(2000) })
    fireEvent.click(screen.getByTestId('magnet-none'))
    fireEvent.click(screen.getByTestId('name-tile'))
    expect(screen.queryByTestId('my-line')).toBeNull()
    fireEvent.click(screen.getByTestId('magnet-ი'))
    fireEvent.click(screen.getByTestId('name-tile'))
    expect(screen.getByTestId('my-line').textContent).toContain('მე მქვია კარლოსი')
    expect(localStorage.getItem('intro_name')).toBe('Карлос')
    fireEvent.click(screen.getByText('Дальше: чужие имена'))
    for (let k = 0; k < 20 && !screen.queryByTestId('game-end'); k++) await answerRound()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  })
})
