import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { seeded } from '../../verbs/testing/catalog'
import { geoName, introLesson, knows } from '../story'
import Supra from './Supra'
import { BEATS, SUPRA_LESSON, TOASTS, TOAST_LOOP_MS, guestWarmth, guests, needle, raiseAt, toastOpts } from './supra.logic'

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

  it('the raise needle loops and the zone is near the end of the speech', () => {
    expect(needle(0)).toBe(0)
    expect(needle(TOAST_LOOP_MS)).toBe(0)
    expect(raiseAt(TOAST_LOOP_MS * 0.1)).toBe('early')
    expect(raiseAt(TOAST_LOOP_MS * 0.75)).toBe('ok')
    expect(raiseAt(TOAST_LOOP_MS * 0.95)).toBe('late')
    expect([guestWarmth(0, false), guestWarmth(2, false), guestWarmth(0, true)]).toEqual([2, 1, 0])
  })
})

describe('Supra scene', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear() })
  afterEach(() => vi.useRealTimers())

  it('goes through all guests and toasts to the group photo and calls onDone', async () => {
    const onDone = vi.fn()
    render(<Supra lesson={introLesson(33)} step={{ kind: 'supra' }} fraction={0.9} onExit={() => {}} onDone={onDone} rng={seeded(5)} />)
    fireEvent.click(screen.getByText('Начать'))
    let early = false, missed = false
    for (let guard = 0; guard < 400 && !screen.queryByTestId('supra-photo'); guard++) {
      await act(async () => { vi.advanceTimersByTime(100) })
      const gauge = screen.queryByTestId('supra-gauge')
      if (gauge) {
        // Один раз поднять бокал рано, потом — ровно в зоне.
        if (!early) { fireEvent.click(screen.getByTestId('supra-raise')); early = true; continue }
        if (gauge.getAttribute('data-zone') === 'ok') fireEvent.click(screen.getByTestId('supra-raise'))
        continue
      }
      const miss = screen.queryAllByTestId('supra-reply-miss').find(b => !(b as HTMLButtonElement).disabled)
      if (miss && !missed) { fireEvent.click(miss); missed = true; expect(screen.getByTestId('supra-note')).toBeTruthy(); continue }
      const ok = screen.queryAllByTestId('supra-reply-ok')[0]
      if (ok) fireEvent.click(ok)
    }
    expect(screen.getByTestId('supra-photo')).toBeTruthy()
    expect(screen.getByTestId('supra-toasts').textContent).toBe('тостов: 3 из 3')
    expect(screen.getByText('Ты прошёл всё «Знакомство».')).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  })

  it('finishes even if the player never answers', async () => {
    render(<Supra lesson={introLesson(33)} step={{ kind: 'supra' }} fraction={0.9} onExit={() => {}} onDone={() => {}} rng={seeded(2)} />)
    fireEvent.click(screen.getByText('Начать'))
    for (let guard = 0; guard < 600 && !screen.queryByTestId('supra-photo'); guard++) {
      await act(async () => { vi.advanceTimersByTime(250) })
      // Тосты без ответа не идут дальше — жмём бокал как попало, а на тост отвечаем верно.
      const raise = screen.queryByTestId('supra-raise')
      if (raise) fireEvent.click(raise)
      if (screen.queryByTestId('supra-gauge') === null && screen.queryAllByTestId('supra-reply-ok').length && screen.getByTestId('supra-scene').textContent?.includes('Тамада')) fireEvent.click(screen.getAllByTestId('supra-reply-ok')[0])
    }
    expect(screen.getByTestId('supra-warm').textContent).toBe('тёплых гостей: 0 из 6')
  })
})
