import { describe, it, expect, vi, beforeEach } from 'vitest'
import { STEP, buildItems, type FormState } from '../ladder/engine'
import { readPending, toProgress } from '../ladder/progressStore'
import { newLearning } from '../testing/sheetApi'
import { verbRu } from '../testing/catalog'
import { createSessionSync, loadLearning } from './sync'
import type { SessionPlan, VerbSessionReportDto, VerbSessionSavedDto } from './types'
import * as mockedApi from '../../api'

// Доставка состояния сессии на сервер: ничего не теряется при обрыве сети, повтор безвреден,
// на устройстве остаётся только то, что ещё не доехало.

vi.mock('../../api', async () => (await import('../testing/sheetApi')).sheetApi())
const api = vi.mocked(mockedApi)

const verb = verbRu('писать')
const items = buildItems(verb)
const plan: SessionPlan = { v: 1, scenes: [{ type: 'meet', units: 3, seconds: 15, typing: false, reason: 'test' }] }
const ID = '7d0f6c1e-0000-4000-8000-00000000000a'
const state = (step: number): FormState => ({ step, best: step, reviews: 0, due: false })
const saved = (): VerbSessionSavedDto => ({ state: newLearning as never, xpEarned: 0, progress: null })
const sent = (n: number) => api.saveVerbSession.mock.calls[n][1] as VerbSessionReportDto
const settled = () => new Promise(resolve => setTimeout(resolve, 0))
function clock() {
  let n = 0
  return () => new Date(Date.UTC(2026, 9, 5, 18, 0, ++n))
}
const stored = () => localStorage.getItem(`verb_session_pending_v1:${verb.id}`)

describe('доставка сессии на сервер', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    api.saveVerbSession.mockResolvedValue(saved())
    api.fetchVerbLearning.mockResolvedValue(newLearning as never)
  })

  it('ответ уходит со следующим отчётом: клетка, ступень, время ответа; план — только пока сервер его не принял', async () => {
    const sync = createSessionSync(verb.id, ID, plan, clock())

    sync.record(items[0], state(STEP.FORM))
    sync.beat(0, 1)
    await settled()
    sync.beat(0, 2)
    await settled()

    expect(sent(0)).toMatchObject({ sessionId: ID, scene: 0, done: 1, finished: false, scenes: ['meet'], plan })
    expect(sent(0).forms).toEqual([{ tense: 'present', person: 0, step: STEP.FORM, reviews: 0, at: '2026-10-05T18:00:01.000Z' }])
    expect(sent(1).plan).toBeUndefined()
    expect(sent(1).forms).toEqual([])
    // Всё доехало — на устройстве ничего не осталось.
    expect(stored()).toBeNull()
    expect(readPending(verb.id)).toEqual({})
  })

  it('сеть упала — ответ и отчёт остаются на устройстве и уходят со следующим отчётом, вместе с планом', async () => {
    api.saveVerbSession.mockRejectedValueOnce(new Error('offline'))
    const sync = createSessionSync(verb.id, ID, plan, clock())

    sync.record(items[0], state(STEP.FORM))
    sync.beat(0, 1)
    await settled()
    expect(Object.keys(readPending(verb.id))).toEqual([items[0].key])
    expect(JSON.parse(stored()!).report).toMatchObject({ scene: 0, done: 1 })

    sync.record(items[1], state(STEP.MEANING))
    sync.beat(0, 2)
    await settled()

    expect(sent(1).plan).toEqual(plan)
    expect(sent(1).forms.map(f => `${f.tense}:${f.person}:${f.step}`)).toEqual([`present:0:${STEP.FORM}`, `aorist:0:${STEP.MEANING}`])
    expect(stored()).toBeNull()
  })

  it('ответ, данный пока шёл запрос, не выпадает из очереди и уходит следом', async () => {
    let release: (v: VerbSessionSavedDto) => void = () => {}
    api.saveVerbSession.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const sync = createSessionSync(verb.id, ID, plan, clock())

    sync.record(items[0], state(STEP.FORM))
    sync.beat(0, 1)
    await settled()
    sync.record(items[1], state(STEP.MEANING))
    sync.beat(0, 2)
    release(saved())
    await settled()

    expect(api.saveVerbSession).toHaveBeenCalledTimes(2)
    expect(sent(1)).toMatchObject({ done: 2 })
    expect(sent(1).forms.map(f => `${f.tense}:${f.person}`)).toEqual(['aorist:0'])
    expect(readPending(verb.id)).toEqual({})
  })

  it('финиш: отчёт с итогом экзамена и отметкой про комикс; без сети возвращает null и ждёт на устройстве', async () => {
    const sync = createSessionSync(verb.id, ID, plan, clock())
    sync.storyDone()
    const done = await sync.finish({ asked: 8, correct: 7 })
    expect(done).not.toBeNull()
    expect(sent(0)).toMatchObject({ finished: true, storyCompleted: true, examAsked: 8, examCorrect: 7 })

    api.saveVerbSession.mockRejectedValue(new Error('offline'))
    const offline = createSessionSync(verb.id, ID, plan, clock())
    expect(await offline.finish()).toBeNull()
    expect(JSON.parse(stored()!).report.finished).toBe(true)
  })

  it('при следующем открытии глагола недоехавший отчёт досылается первым, и состояние берётся из ответа', async () => {
    api.saveVerbSession.mockRejectedValueOnce(new Error('offline'))
    const sync = createSessionSync(verb.id, ID, plan, clock())
    sync.record(items[0], state(STEP.FORM))
    expect(await sync.finish()).toBeNull()

    const after = { ...newLearning, level: 'meeting' } as never
    api.saveVerbSession.mockResolvedValue({ state: after, xpEarned: 10, progress: null })
    const learning = await loadLearning(verb.id)

    expect(learning).toBe(after)
    expect(sent(1)).toMatchObject({ sessionId: ID, finished: true, plan })
    expect(sent(1).forms).toHaveLength(1)
    expect(api.fetchVerbLearning).not.toHaveBeenCalled()
    expect(stored()).toBeNull()
    expect(readPending(verb.id)).toEqual({})
  })

  it('нечего досылать — просто читает состояние; несохранённые ответы новее того, что знает сервер', async () => {
    expect(await loadLearning(verb.id)).toBe(newLearning)
    expect(api.saveVerbSession).not.toHaveBeenCalled()

    const forms = [{ tense: 'present' as const, person: 0, step: 2, bestStep: 3, reviews: 0, nextDueAtUtc: null, due: false }]
    const pending = { 'present:0': { tense: 'present' as const, person: 0, step: 4, reviews: 0, at: 'x' } }
    expect(toProgress(forms, pending)['present:0']).toEqual({ step: 4, best: 4, reviews: 0, due: false })
  })
})
