import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { setMuted } from '../../alphabet/games/fx'
import { seeded } from '../../verbs/testing/catalog'
import { geoName, introLesson, met } from '../story'
import Chat from './Chat'
import { SCRIPT_LESSON, bankAdd, chatScript, ending, onlyKnown, warmAfter, type ChatScript } from './chatScripts'

const SCRIPTS: ChatScript[] = ['act2', 'act3', 'act4', 'act6']
const me = geoName('Карлос')

describe('chat scripts', () => {
  it.each(SCRIPTS)('%s: 5–7 exchanges, 2–3 options each, at least one good, only known phrases', s => {
    const lessonId = SCRIPT_LESSON[s]
    for (let seed = 1; seed < 15; seed++) {
      const raw = chatScript(s, me, seeded(seed))
      const plan = onlyKnown(raw, lessonId)
      expect(plan).toHaveLength(raw.length)
      expect(plan.length).toBeGreaterThanOrEqual(5)
      expect(plan.length).toBeLessThanOrEqual(7)
      for (const e of plan) {
        expect(e.opts.length).toBeGreaterThanOrEqual(2)
        expect(e.opts.length).toBeLessThanOrEqual(3)
        expect(e.opts.some(o => o.good)).toBe(true)
        for (const o of e.opts) {
          for (const id of o.ids) expect(met(lessonId, id), `${s}: ${id}`).toBe(true)
          if (!o.good) expect(o.miss).toBeTruthy()
        }
        for (const h of e.her) if (h.kind === 'her') for (const id of h.ids) expect(met(lessonId, id), `${s}: ${id}`).toBe(true)
      }
    }
  })

  it('uses the learner name and the lesson phrases', () => {
    const act2 = chatScript('act2', me, seeded(3)).flatMap(e => e.opts.map(o => o.geo))
    expect(act2).toContain('მე მქვია კარლოსი')
    const act3 = chatScript('act3', me, seeded(3)).flatMap(e => e.opts.map(o => o.geo))
    expect(act3.some(g => /^მე ვარ (ესპანეთი|საფრანგეთი)$/.test(g))).toBe(true) // смешная ошибка без -დან
    const act4 = chatScript('act4', me, seeded(3)).flatMap(e => e.opts.map(o => o.geo))
    expect(act4).toContain('ვცხოვრობ ბათუმი')
    const act6 = chatScript('act6', me, seeded(3)).flatMap(e => e.opts.filter(o => o.good).map(o => o.ids[0]))
    expect(act6).toEqual(expect.arrayContaining(['miyvars_sakartvelo', 'ar_vici']))
  })

  it('drops what the learner has not met yet', () => {
    // act6 в 12-м уроке: семьи, «люблю Грузию» и «не знаю» ещё нет — эти обмены выпадают.
    const plan = onlyKnown(chatScript('act6', me, seeded(1)), 12)
    for (const e of plan) for (const o of e.opts) for (const id of o.ids) expect(met(12, id)).toBe(true)
    expect(plan.length).toBeLessThan(6)
  })

  it('warmth stays in 0..5, endings by warmth, bank has no repeats', () => {
    const good = chatScript('act2', me, seeded(1))[2].opts.find(o => o.good)!
    expect(warmAfter(5, good)).toBe(5)
    expect(warmAfter(0, { ...good, w: -1 })).toBe(0)
    expect([ending(5), ending(2), ending(0)]).toEqual(['warm', 'ok', 'cold'])
    expect(bankAdd(bankAdd([], good), good)).toHaveLength(1)
  })
})

describe('Chat scene', () => {
  // Без звука реплика держится столько, сколько её читать: в jsdom записи не играют.
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); setMuted(true) })
  afterEach(() => { vi.useRealTimers(); setMuted(false) })

  const play = async (script: ChatScript) => {
    const onDone = vi.fn()
    const lesson = introLesson(SCRIPT_LESSON[script])
    render(<Chat lesson={lesson} step={{ kind: 'chat', script }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(7)} />)
    if (script === 'act2') {
      fireEvent.change(screen.getByTestId('chat-name-input'), { target: { value: 'Карлос' } })
      expect(screen.getByTestId('chat-name-geo').textContent).toBe('კარლოსი')
      fireEvent.click(screen.getByText('Открыть чат'))
    } else fireEvent.click(screen.getByText('Начать'))
    let misses = 0
    for (let guard = 0; guard < 300 && !screen.queryByTestId('chat-finish'); guard++) {
      await act(async () => { await vi.advanceTimersByTimeAsync(700) })
      const miss = screen.queryAllByTestId('chat-reply-miss').find(b => !(b as HTMLButtonElement).disabled)
      const okBtn = screen.queryAllByTestId('chat-reply-ok')[0]
      // Один раз промахнуться, чтобы увидеть реакцию, дальше — верно.
      if (miss && misses === 0) { fireEvent.click(miss); misses++; continue }
      if (okBtn) fireEvent.click(okBtn)
    }
    expect(screen.getAllByTestId('chat-note').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByTestId('chat-finish'))
    expect(screen.getByTestId('chat-bank').textContent).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  }

  it.each(SCRIPTS)('%s: plays through to the end and calls onDone', async s => { await play(s) })

  it('act2 saves the confirmed name', async () => {
    render(<Chat lesson={introLesson(12)} step={{ kind: 'chat', script: 'act2' }} fraction={0.5} onExit={() => {}} onDone={() => {}} rng={seeded(1)} />)
    fireEvent.change(screen.getByTestId('chat-name-input'), { target: { value: 'Нино' } })
    fireEvent.click(screen.getByText('Открыть чат'))
    expect(localStorage.getItem('intro_name')).toBe('Нино')
    expect(screen.getByTestId('chat-scene')).toBeTruthy()
  })
})

describe('chat: время суток и длина разговора', () => {
  it('утро и вечер сказаны с первой же реплики', () => {
    const me = geoName('Карлос')
    const first = (s: ChatScript) => chatScript(s, me, seeded(1))[0].her.map(h => (h.kind === 'note' ? h.text : '')).join(' ')
    expect(first('act2')).toMatch(/^Утро/)
    expect(first('act4')).toMatch(/^Вечер/)
  })
})
