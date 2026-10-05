import { describe, it, expect, vi, beforeEach } from 'vitest'
import { STEP, buildItems, type FormState } from './engine'
import { createSaver, loadProgress } from './progressStore'
import { verbByLemma } from '../testing/catalog'
import type { VerbProgressDto, VerbProgressStepDto } from './types'

const verb = verbByLemma('წერს')
const items = buildItems(verb)
const empty: VerbProgressDto = { verbId: verb.id, canLearn: true, total: 36, forms: [] }

const api = vi.hoisted(() => ({ fetchVerbProgress: vi.fn(), saveVerbProgress: vi.fn() }))
vi.mock('../../api', () => api)

const state = (step: number, reviews = 0): FormState => ({ step, best: step, reviews, due: false })
const sent = (call: number) => api.saveVerbProgress.mock.calls[call][1] as VerbProgressStepDto[]
const settled = () => new Promise(resolve => setTimeout(resolve, 0))

/** Часы, которые идут на секунду за каждый ответ. */
function clock() {
  let t = Date.parse('2026-10-05T18:00:00Z')
  return () => new Date((t += 1000))
}

describe('сохранение прогресса лесенки', () => {
  beforeEach(() => {
    localStorage.clear()
    api.fetchVerbProgress.mockReset().mockResolvedValue(empty)
    api.saveVerbProgress.mockReset().mockResolvedValue(empty)
  })

  it('каждый ответ уходит на сервер с клеткой, ступенью и временем ответа', async () => {
    const saver = createSaver(verb.id, clock())

    saver.record(items[0], state(STEP.FORM))
    await settled()

    expect(api.saveVerbProgress).toHaveBeenCalledTimes(1)
    expect(sent(0)).toEqual([{ tense: 'present', person: 0, step: STEP.FORM, reviews: 0, at: '2026-10-05T18:00:01.000Z' }])
  })

  it('если сохранение не прошло, ответ не теряется и уходит со следующим', async () => {
    api.saveVerbProgress.mockRejectedValueOnce(new Error('offline'))
    const saver = createSaver(verb.id, clock())

    saver.record(items[0], state(STEP.FORM))
    await settled()
    saver.record(items[1], state(STEP.MEANING))
    await settled()

    expect(sent(1).map(s => `${s.tense}:${s.person}:${s.step}`)).toEqual([`present:0:${STEP.FORM}`, `aorist:0:${STEP.MEANING}`])
    await saver.flush()
    expect(api.saveVerbProgress).toHaveBeenCalledTimes(2)
  })

  it('ответ, данный пока шёл запрос, досылается следом и из очереди не выпадает', async () => {
    let release: (v: VerbProgressDto) => void = () => {}
    api.saveVerbProgress.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    const saver = createSaver(verb.id, clock())

    saver.record(items[0], state(STEP.FORM))
    saver.record(items[0], state(STEP.GAP))
    release(empty)
    await settled()
    await settled()

    expect(api.saveVerbProgress).toHaveBeenCalledTimes(2)
    expect(sent(0)[0].step).toBe(STEP.FORM)
    expect(sent(1)).toHaveLength(1)
    expect(sent(1)[0].step).toBe(STEP.GAP)
  })

  it('несохранённое с прошлого раза при открытии глагола сначала отправляется, и берётся ответ сервера', async () => {
    api.saveVerbProgress.mockRejectedValueOnce(new Error('offline'))
    createSaver(verb.id, clock()).record(items[0], state(STEP.BUILD))
    await settled()
    api.saveVerbProgress.mockResolvedValueOnce({
      ...empty, forms: [{ tense: 'present', person: 0, step: STEP.BUILD, bestStep: STEP.TYPE, reviews: 0, nextDueAtUtc: null, due: false }]
    })

    const loaded = await loadProgress(verb.id)

    expect(api.fetchVerbProgress).not.toHaveBeenCalled()
    expect(loaded.progress['present:0']).toEqual({ step: STEP.BUILD, best: STEP.TYPE, reviews: 0, due: false })
    await createSaver(verb.id).flush()
    expect(api.saveVerbProgress).toHaveBeenCalledTimes(2)
  })

  it('если несохранённое так и не уходит, оно накладывается поверх того, что знает сервер', async () => {
    api.saveVerbProgress.mockRejectedValue(new Error('offline'))
    createSaver(verb.id, clock()).record(items[0], state(STEP.BUILD))
    await settled()
    api.fetchVerbProgress.mockResolvedValue({
      ...empty,
      forms: [
        { tense: 'present', person: 0, step: STEP.FORM, bestStep: STEP.FORM, reviews: 0, nextDueAtUtc: null, due: false },
        { tense: 'aorist', person: 0, step: STEP.MASTERED, bestStep: STEP.MASTERED, reviews: 2, nextDueAtUtc: '2026-10-04T18:00:00Z', due: true }
      ]
    })

    const loaded = await loadProgress(verb.id)

    expect(loaded.progress['present:0'].step).toBe(STEP.BUILD)
    expect(loaded.progress['aorist:0']).toEqual({ step: STEP.MASTERED, best: STEP.MASTERED, reviews: 2, due: true })
  })

  it('без несохранённых ответов просто читает прогресс с сервера', async () => {
    api.fetchVerbProgress.mockResolvedValue({ ...empty, canLearn: false })

    const loaded = await loadProgress(verb.id)

    expect(api.saveVerbProgress).not.toHaveBeenCalled()
    expect(loaded).toEqual({ canLearn: false, progress: {} })
  })

  it('очереди разных глаголов не смешиваются', async () => {
    api.saveVerbProgress.mockRejectedValue(new Error('offline'))
    createSaver(verb.id, clock()).record(items[0], state(STEP.FORM))
    await settled()
    const other = verbByLemma('მიდის')

    const loaded = await loadProgress(other.id)

    expect(loaded.progress).toEqual({})
  })
})
