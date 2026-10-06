import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import Session from './Session'
import { entryLabel } from './SessionEntry'
import { planSession } from './plan'
import { planContext } from './context'
import { formOf } from '../games/common'
import { STOPS } from '../games/timeRounds'
import { SOLID_STEP } from '../ladder/engine'
import { newLearning } from '../testing/sheetApi'
import { verbRu } from '../testing/catalog'
import { moveSeen, rulesSeen } from '../testing/seen'
import type { VerbLearningDto, VerbSessionReportDto } from './types'
import type { TenseKey } from '../types'
import * as mockedApi from '../../api'

// Сессия целиком: полоска растёт после каждого задания, ответы и место уходят на сервер,
// финиш — один раз, начатая сессия продолжается с того же места. Глагол — из каталога.

vi.mock('../../api', async () => (await import('../testing/sheetApi')).sheetApi())
vi.mock('../ui/juice', () => ({ good: vi.fn(), bad: vi.fn(), haptic: vi.fn(), floater: vi.fn(), burst: vi.fn() }))
const api = vi.mocked(mockedApi)

const WRITE = verbRu('писать')
const learning = (patch: Partial<VerbLearningDto> = {}): VerbLearningDto => ({ ...structuredClone(newLearning), ...patch } as VerbLearningDto)
const reports = () => api.saveVerbSession.mock.calls.map(c => c[1] as VerbSessionReportDto)
const percent = () => Number(screen.getByTestId('session-bar').getAttribute('data-percent'))
const tick = (ms = 2000) => act(async () => { vi.advanceTimersByTime(ms) })
const quiz = () => screen.getByTestId('quiz-scene')

function open(state: VerbLearningDto = learning()) {
  const onExit = vi.fn()
  render(<Session verb={WRITE} stories={[]} learning={state} onExit={onExit} />)
  return onExit
}

/** Ответить на задание-квиз верно; wrongFirst — сначала нажать неверный вариант. */
async function answerQuiz(wrongFirst = false) {
  const kind = quiz().getAttribute('data-task')
  const key = quiz().getAttribute('data-key')!
  if (kind === 'intro') { fireEvent.click(screen.getByText('Понятно')); return tick(0) }
  if (wrongFirst) {
    const wrong = [...quiz().querySelectorAll('[data-testid^="ladder-option-"]')].find(b => b.getAttribute('data-testid') !== `ladder-option-${key}`)!
    fireEvent.click(wrong)
  }
  fireEvent.click(screen.getByTestId(`ladder-option-${key}`))
  return tick()
}

async function answerTime() {
  const ask = screen.getByTestId('time-ask')
  const form = formOf(WRITE, STOPS[Number(ask.getAttribute('data-stop'))].tense, Number(ask.getAttribute('data-person')))
  fireEvent.click(screen.getByText(form))
  return tick()
}

describe('Session', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    vi.clearAllMocks()
    for (const id of ['ladder', 'verb_time']) { rulesSeen(id); moveSeen(id) }
    api.saveVerbSession.mockImplementation(async (_id, report) => ({
      state: learning({ level: report.finished ? 'recognising' : 'meeting' }), xpEarned: report.finished ? 10 : 0, progress: null
    }))
  })
  afterEach(() => { vi.useRealTimers() })

  it('first session of a new verb: the bar grows after every task, never goes back, and the session ends in a win', async () => {
    open()
    await tick(0)
    expect(screen.getByTestId('verb-session').getAttribute('data-scene')).toBe('meet')
    expect(reports()[0]).toMatchObject({ scene: 0, done: 0, finished: false, scenes: ['meet', 'time'] })
    expect(reports()[0].plan?.scenes).toHaveLength(2)

    const seen = [percent()]
    const step = async (answer: () => Promise<void>) => {
      await answer()
      if (!screen.queryByTestId('session-bar')) return
      seen.push(percent())
    }
    while (screen.queryByTestId('quiz-scene')) await step(() => answerQuiz())
    expect(screen.getByTestId('verb-session').getAttribute('data-scene')).toBe('time')
    while (screen.queryByTestId('time-ask')) await step(answerTime)

    // 9 заданий знакомства + 4 раунда игры: после каждого полоска длиннее.
    expect(seen.length).toBeGreaterThanOrEqual(13)
    seen.forEach((p, i) => { if (i) expect(p, `шаг ${i}: ${seen.join(',')}`).toBeGreaterThan(seen[i - 1]) })

    const finish = screen.getByTestId('session-finish')
    expect(finish.textContent).toContain('Новый уровень!')
    expect(screen.getByTestId('session-xp').textContent).toBe('+10 XP')
    expect(screen.getByTestId('verb-level').getAttribute('data-level')).toBe('recognising')
    // Что было в игре — фразами с грузинскими словами из каталога.
    const words = screen.getByTestId('session-words').textContent!
    for (const tense of ['present', 'aorist', 'future'] as TenseKey[]) expect(words).toContain(formOf(WRITE, tense, 0))
    expect(words).toContain(WRITE.meanings!.present![0])
    expect(screen.getByTestId('session-comeback').textContent).toContain('Загляни завтра')
    expect(finish.textContent).not.toMatch(/аорист|имперфект|оптатив/i)

    // На сервер: место в сессии только вперёд, формы дошли, финиш — один раз.
    const all = reports()
    const position = all.map(r => r.scene * 100 + r.done)
    position.forEach((p, i) => { if (i) expect(p).toBeGreaterThanOrEqual(position[i - 1]) })
    expect(all.filter(r => r.finished)).toHaveLength(1)
    const steps = new Map(all.flatMap(r => r.forms).map(f => [`${f.tense}:${f.person}`, f.step]))
    expect([...steps.keys()].sort()).toEqual(['aorist:0', 'future:0', 'present:0'])
    expect([...steps.values()]).toEqual([SOLID_STEP, SOLID_STEP, SOLID_STEP])
    expect(localStorage.getItem(`verb_session_pending_v1:${WRITE.id}`)).toBeNull()
  })

  it('a mistake is not a dead end: says what the chosen word means, the bar waits, the right answer moves on', async () => {
    open()
    await tick(0)
    await answerQuiz(); await answerQuiz()          // два знакомства
    const before = percent()
    const key = quiz().getAttribute('data-key')!
    const wrong = [...quiz().querySelectorAll('[data-testid^="ladder-option-"]')].find(b => b.getAttribute('data-testid') !== `ladder-option-${key}`)!
    fireEvent.click(wrong)

    expect(screen.getByTestId('ladder-note').textContent).toMatch(/— это .*Выбери другое/)
    expect(screen.getByTestId('ladder-note').textContent).not.toMatch(/аорист|имперфект|оптатив|неправильно/i)
    expect(percent()).toBe(before)

    fireEvent.click(screen.getByTestId(`ladder-option-${key}`))
    await tick()
    expect(percent()).toBeGreaterThan(before)
    expect(quiz().getAttribute('data-key')).not.toBe(key)
  })

  it('«Ещё одну» starts a fresh session from the state the server returned; «Готово» hands that state back', async () => {
    const onExit = open()
    await tick(0)
    while (screen.queryByTestId('quiz-scene')) await answerQuiz()
    while (screen.queryByTestId('time-ask')) await answerTime()
    const first = reports()[0].sessionId

    fireEvent.click(screen.getByText('Ещё одну'))
    await tick(0)
    expect(screen.queryByTestId('session-finish')).toBeNull()
    expect(percent()).toBe(0)
    // Вторая сессия заканчивается на том же уровне — «Новый уровень!» второй раз не объявляют.
    while (screen.queryByTestId('quiz-scene')) await answerQuiz()
    while (screen.queryByTestId('time-ask')) await answerTime()
    expect(screen.getByTestId('session-finish').textContent).not.toContain('Новый уровень')
    expect(screen.queryByTestId('session-level-up')).toBeNull()
    fireEvent.click(screen.getByText('Ещё одну'))
    await tick(0)
    expect(reports()[reports().length - 1].sessionId).not.toBe(first)

    fireEvent.click(screen.getByLabelText('Закрыть'))
    expect(onExit).toHaveBeenCalledWith(null)
  })

  it('continues an unfinished session where it stopped: same plan, same scene, the bar already filled', async () => {
    const fresh = learning()
    const plan = planSession(planContext(WRITE, fresh, []))
    open(learning({ session: { id: '7d0f6c1e-0000-4000-8000-000000000001', plan, scene: 1, done: 2 } }))
    await tick(0)

    expect(screen.getByTestId('verb-session').getAttribute('data-scene')).toBe('time')
    expect(percent()).toBe(Math.round(((9 + 2) / 13) * 100))
    // Продолженная сессия не заводится на сервере заново.
    expect(reports()).toHaveLength(0)

    await answerTime(); await answerTime()
    expect(screen.getByTestId('session-finish')).toBeTruthy()
    expect(reports().every(r => r.sessionId === '7d0f6c1e-0000-4000-8000-000000000001')).toBe(true)
    expect(reports()[reports().length - 1]).toMatchObject({ finished: true, scene: 1, done: 4 })
  })

  it('no connection at the end: the win is still shown, the report waits on the device and is not lost', async () => {
    api.saveVerbSession.mockRejectedValue(new Error('offline'))
    open()
    await tick(0)
    while (screen.queryByTestId('quiz-scene')) await answerQuiz()
    while (screen.queryByTestId('time-ask')) await answerTime()

    expect(screen.getByTestId('session-finish')).toBeTruthy()
    expect(screen.getByTestId('session-offline')).toBeTruthy()
    expect(screen.queryByText('Ещё одну')).toBeNull()
    const stored = JSON.parse(localStorage.getItem(`verb_session_pending_v1:${WRITE.id}`)!)
    expect(stored.report.finished).toBe(true)
    expect(stored.plan.scenes).toHaveLength(2)
  })

  it('exam: one attempt per question, the tally goes to the server, a failed exam names the words that return to play', async () => {
    const items = planContext(WRITE, learning(), []).items
    const forms = items.slice(0, 24).map(i => ({ tense: i.tense, person: i.person, step: SOLID_STEP, bestStep: SOLID_STEP, reviews: 0, nextDueAtUtc: null, due: false }))
    const ready = learning({ level: 'examReady', progress: { verbId: WRITE.id, canLearn: true, total: 36, forms }, memory: { ...newLearning.memory, sessionsPlayed: 3 } })
    api.saveVerbSession.mockImplementation(async () => ({ state: ready, xpEarned: 10, progress: null }))
    const plan = planSession(planContext(WRITE, ready, []))
    const exam = plan.scenes[plan.scenes.length - 1]
    rulesSeen('session_exam')
    // Сразу на экзамен: сцену-разгон считаем пройденной.
    open({ ...ready, session: { id: '7d0f6c1e-0000-4000-8000-000000000002', plan, scene: plan.scenes.length - 1, done: 0 } })
    await tick(0)

    expect(screen.getByTestId('exam-count').textContent).toBe(`Экзамен · 1 из ${exam.units}`)
    // Первые два вопроса — неверно: вторую попытку не дают, показывают верное и «Дальше».
    for (let n = 0; n < 2; n++) {
      const key = quiz().getAttribute('data-key')!
      const wrong = [...quiz().querySelectorAll('[data-testid^="ladder-option-"]')].find(b => b.getAttribute('data-testid') !== `ladder-option-${key}`)!
      fireEvent.click(wrong)
      expect((screen.getByTestId(`ladder-option-${key}`) as HTMLButtonElement).disabled).toBe(true)
      fireEvent.click(screen.getByText('Дальше'))
      await tick(0)
    }
    while (screen.queryByTestId('quiz-scene')) await answerQuiz()

    expect(reports()[reports().length - 1]).toMatchObject({ finished: true, examAsked: exam.units, examCorrect: exam.units - 2 })
    const finish = screen.getByTestId('session-finish')
    expect(finish.getAttribute('data-exam')).toBe('failed')
    expect(finish.textContent).toContain('вернулись в игру')
    expect(screen.getByTestId('session-words').children).toHaveLength(2)
  })
})

describe('entryLabel', () => {
  const due = { tense: 'present' as TenseKey, person: 0, step: 6, bestStep: 6, reviews: 0, nextDueAtUtc: null, due: true }
  it.each([
    [learning(), 'Выучить играя', false],
    [learning({ level: 'meeting' }), 'Играть дальше', false],
    [learning({ level: 'recognising', progress: { ...newLearning.progress, forms: [due] } }), 'Повторить и играть дальше', false],
    [learning({ level: 'examReady' }), 'Сыграть и сдать экзамен', false],
    [learning({ level: 'learned' }), 'Сыграть ещё', true],
    [learning({ level: 'learned', progress: { ...newLearning.progress, forms: [due] } }), 'Повторить играя', false],
    [learning({ level: 'phrases', session: { id: 'x', plan: { v: 1, scenes: [] }, scene: 0, done: 0 } }), 'Продолжить игру', false]
  ])('%#: %s', (state, text, quiet) => {
    expect(entryLabel(state as VerbLearningDto)).toEqual({ text, quiet })
  })
})
