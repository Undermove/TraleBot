import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { seeded } from '../../verbs/testing/catalog'
import { geoName, introLesson, knows } from '../story'
import Supra from './Supra'
import { BEATS, SUPRA_LESSON, TOASTS, guestWarmth, guests, toastOpts } from './supra.logic'
import { setMuted } from '../../alphabet/games/fx'
import { voiceOf } from './Reception.logic'

const me = geoName('Карлос')

describe('supra logic', () => {
  it('six guests with different themes, Nino first, no repeated names, the learner is not a guest', () => {
    for (let seed = 1; seed < 10; seed++) {
      const g = guests(me, seeded(seed))
      expect(g).toHaveLength(6)
      expect(g[0].name).toBe('ნინო')
      expect(new Set(g.map(x => x.name)).size).toBe(6)
      expect(new Set(g.map(x => x.theme)).size).toBe(6)
      expect(g.map(x => x.name)).not.toContain('კარლოსი')
      for (const x of g) {
        expect(x.talk.length).toBeGreaterThanOrEqual(1)
        expect(x.talk.length).toBeLessThanOrEqual(2)
        for (const e of x.talk) {
          expect(e.opts.some(o => o.good)).toBe(true)
          for (const o of e.opts) for (const id of o.ids) expect(knows(SUPRA_LESSON, id)).toBe(true)
        }
      }
    }
  })

  it('family guest drills მყავს / მაქვს and love for Georgia', () => {
    const fam = guests(me, seeded(2)).find(x => x.theme === 'family')!
    const ids = fam.talk.flatMap(e => e.opts.map(o => [o.ids[0], o.good] as const))
    expect(ids).toEqual(expect.arrayContaining([['myavs_da', true], ['makvs_manqana', false], ['miyvars_sakartvelo', true]]))
  })

  it('toasts are answered with this lesson phrases; the Georgia toast with გაუმარჯოს საქართველოს', () => {
    const g = toastOpts(true, seeded(1))
    expect(g.find(o => o.ids[0] === 'gaumarjos_sakartvelos')?.w).toBe(2)
    const plain = toastOpts(false, seeded(1))
    expect(plain.filter(o => o.good).map(o => o.ids[0])).toEqual(['gaumarjos'])
    expect(BEATS.filter(b => b.kind === 'toast')).toHaveLength(TOASTS.length)
  })

  it('warmth: right the first time — 2, after misses — 1; the grandmother of the family theme is a woman', () => {
    expect([guestWarmth(0), guestWarmth(2)]).toEqual([2, 1])
    for (let seed = 1; seed < 10; seed++) expect(voiceOf(guests(me, seeded(seed)).find(x => x.theme === 'family')!.name)).toBe('f')
  })
})

describe('Supra scene', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); setMuted(true) })
  afterEach(() => { vi.useRealTimers(); setMuted(false) })

  it('guests talk in turn, toasts are raised and answered, the group photo, onDone — nobody hurries you', async () => {
    const onDone = vi.fn()
    render(<Supra lesson={introLesson(33)} step={{ kind: 'supra' }} fraction={0.9} onExit={() => {}} onDone={onDone} rng={seeded(5)} />)
    fireEvent.click(screen.getByText('Начать'))
    // Подождать долго, ничего не нажимая: гость никуда не уходит.
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(screen.getAllByTestId('supra-reply-ok').length).toBeGreaterThan(0)
    let missed = false
    for (let guard = 0; guard < 1500 && !screen.queryByTestId('supra-photo'); guard++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(100) })
      const raise = screen.queryByTestId('supra-raise')
      if (raise && screen.queryByTestId('supra-note')?.textContent?.includes('Подними')) { fireEvent.click(raise); continue }
      const miss = screen.queryAllByTestId('supra-reply-miss').find(b => !(b as HTMLButtonElement).disabled)
      if (miss && !missed) { await act(async () => { fireEvent.click(miss) }); missed = true; expect(screen.getByTestId('supra-note')).toBeTruthy(); continue }
      const ok = screen.queryAllByTestId('supra-reply-ok')[0]
      if (ok) await act(async () => { fireEvent.click(ok) })
    }
    expect(screen.getByTestId('supra-photo')).toBeTruthy()
    expect(screen.getByTestId('supra-toasts').textContent).toBe(`тостов: ${TOASTS.length} из ${TOASTS.length}`)
    expect(screen.getByTestId('supra-warm').textContent).toBe('тёплых гостей: 6 из 6')
    expect(screen.getByText('Ты прошёл всё «Знакомство».')).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  }, 60_000)
})
