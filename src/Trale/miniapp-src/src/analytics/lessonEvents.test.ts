import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { __setLessonEventSender, flushLessonEvents, lessonFlow, trackLessonEvent, trackingEnabled, type LessonEventDto } from './lessonEvents'

describe('lesson events tracker', () => {
  let batches: LessonEventDto[][] = []
  beforeEach(() => { batches = []; vi.useFakeTimers(); __setLessonEventSender(b => { batches.push(b) }) })
  afterEach(() => { __setLessonEventSender(null); vi.useRealTimers() })

  it('is off in tests and outside Telegram unless a sender is set', () => {
    __setLessonEventSender(null)
    expect(trackingEnabled()).toBe(false)
  })

  it('buffers events and sends them a few seconds later in one batch', () => {
    lessonFlow.open('alphabet-progressive', 3)
    lessonFlow.done()
    lessonFlow.step('alphabet-progressive', 3, 1, 'letter-intro')
    expect(batches).toHaveLength(0)
    vi.advanceTimersByTime(4100)
    expect(batches).toHaveLength(1)
    expect(batches[0].map(e => `${e.step}:${e.stepKind}:${e.event}`)).toEqual(['0:opener:lesson_open', '0:opener:step_done', '1:letter-intro:step_start'])
  })

  it('splits into batches of at most 50', () => {
    for (let i = 0; i < 120; i++) trackLessonEvent({ moduleId: 'm', lessonId: 1, step: 1, stepKind: 'catch', event: 'step_start' })
    flushLessonEvents()
    expect(batches.map(b => b.length)).toEqual([50, 50, 20])
  })

  it('exit is recorded once, only mid-lesson, and sent when the app is hidden', () => {
    lessonFlow.step('alphabet-progressive', 12, 2, 'morph')
    lessonFlow.exit(); lessonFlow.exit()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(batches.flat().map(e => e.event)).toEqual(['step_start', 'lesson_exit'])
    lessonFlow.step('alphabet-progressive', 12, 3, 'check')
    lessonFlow.end('lesson_complete', 4)
    lessonFlow.exit()
    flushLessonEvents()
    expect(batches.flat().map(e => e.event)).toEqual(['step_start', 'lesson_exit', 'step_start', 'lesson_complete'])
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })
})
