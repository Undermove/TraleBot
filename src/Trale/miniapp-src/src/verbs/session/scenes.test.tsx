import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import Bones from '../games/Bones'
import Builder from '../games/Builder'
import TimeMachine from '../games/TimeMachine'
import { cellSlot } from '../games/boneField'
import { formOf } from '../games/common'
import { SOLID_STEP, STEP } from '../ladder/engine'
import StoryReader from '../story/StoryReader'
import { storyFixture } from '../story/fixture'
import { seeded, verbRu } from '../testing/catalog'
import { moveSeen, rulesSeen } from '../testing/seen'
import { SessionChrome, type SceneHooks } from '../ui/GameShell'
import type { TenseKey } from '../types'

// Игры и комикс как сцены сессии: играют ровно то, что задал постановщик, сообщают ответ по каждой
// форме в общую модель прогресса и шаг — в полоску сессии. Шапка в сессии — её полоска, а не счёт игры.

vi.mock('../../api', async () => (await import('../testing/sheetApi')).sheetApi())
vi.mock('../ui/juice', () => ({ good: vi.fn(), bad: vi.fn(), haptic: vi.fn(), floater: vi.fn(), burst: vi.fn() }))

const WRITE = verbRu('писать')
const tick = (ms = 2000) => act(async () => { vi.advanceTimersByTime(ms) })

function hooks(startAt = 0) {
  return { startAt, onResult: vi.fn(), onStep: vi.fn(), onDone: vi.fn() } satisfies SceneHooks
}
const inSession = (node: React.ReactNode) =>
  render(<SessionChrome.Provider value={{ fraction: 0.5, onExit: vi.fn() }}>{node}</SessionChrome.Provider>)

describe('сцены сессии', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    for (const id of ['verb_time', 'verb_bones', 'verb_builder', 'story']) { rulesSeen(id); moveSeen(id) }
    for (const id of ['story_choose', 'story_type', 'story_build']) moveSeen(id)
  })
  afterEach(() => { vi.useRealTimers() })

  it('«Машина времени»: спрашивает заданные клетки по порядку, ошибка засчитывается один раз, после последней — конец сцены', async () => {
    const scene = hooks()
    const targets = [{ tense: 'future' as TenseKey, person: 0 }, { tense: 'aorist' as TenseKey, person: 2 }]
    inSession(<TimeMachine verb={WRITE} onExit={vi.fn()} rng={seeded(3)} scene={{ ...scene, targets }} />)

    // В сессии шапка — полоска сессии.
    expect(screen.getByTestId('session-bar').getAttribute('data-percent')).toBe('50')
    expect(screen.getByTestId('time-ask').textContent).toContain(WRITE.meanings!.future![0])

    const wrong = [...document.querySelectorAll('.grid button')].find(b => b.textContent !== formOf(WRITE, 'future', 0))!
    fireEvent.click(wrong); fireEvent.click(wrong)
    expect(scene.onResult).toHaveBeenCalledTimes(1)
    expect(scene.onResult).toHaveBeenLastCalledWith({ tense: 'future', person: 0 }, false, SOLID_STEP)
    expect(scene.onStep).not.toHaveBeenCalled()

    fireEvent.click(screen.getByText(formOf(WRITE, 'future', 0)))
    expect(scene.onStep).toHaveBeenCalledTimes(1)
    await tick()
    expect(screen.getByTestId('time-ask').textContent).toContain(WRITE.meanings!.aorist![2])

    fireEvent.click(screen.getByText(formOf(WRITE, 'aorist', 2)))
    expect(scene.onResult).toHaveBeenLastCalledWith({ tense: 'aorist', person: 2 }, true, SOLID_STEP)
    await tick()
    expect(scene.onDone).toHaveBeenCalledTimes(1)
  })

  it('«Машина времени» продолжает с раунда, на котором сессию прервали', () => {
    const targets = [{ tense: 'future' as TenseKey, person: 0 }, { tense: 'present' as TenseKey, person: 0 }]
    inSession(<TimeMachine verb={WRITE} onExit={vi.fn()} scene={{ ...hooks(1), targets }} />)
    expect(screen.getByTestId('time-ask').textContent).toContain(WRITE.meanings!.present![0])
  })

  it('«Косточки» без печати: маленькое поле, клетка раскапывается выбором, сцена кончается с последней косточкой', async () => {
    const scene = hooks()
    const tenses: TenseKey[] = ['present', 'aorist', 'future'], persons = [0, 1, 2]
    inSession(<Bones verb={WRITE} onExit={vi.fn()} rng={seeded(4)} scene={{ ...scene, tenses, persons, typing: false }} />)

    const cells = [...document.querySelectorAll('[data-testid^="bones-cell-"]')]
    expect(cells).toHaveLength(9)
    let found = 0
    for (let i = 0; i < cells.length && !scene.onDone.mock.calls.length; i++) {
      fireEvent.click(cells[i])
      // Клавиатуры нет — сразу четыре варианта.
      expect(screen.queryByText('Копать')).toBeNull()
      const at = cellSlot(tenses, i, persons)
      fireEvent.click(screen.getByTestId('bones-dig').querySelectorAll('.grid button')[0].parentElement!.querySelector('button:not([disabled])')!)
      if (cells[i].getAttribute('data-state') === 'closed') {
        // Первый вариант оказался не тем — выбираем верный.
        const right = [...screen.getByTestId('bones-dig').querySelectorAll('.grid button')].find(b => b.textContent === formOf(WRITE, at.tense, at.person))!
        fireEvent.click(right)
      }
      expect(cells[i].getAttribute('data-state')).not.toBe('closed')
      if (cells[i].getAttribute('data-state') === 'bone') found++
      await tick()
    }
    expect(found).toBe(2)
    expect(scene.onDone).toHaveBeenCalledTimes(1)
    expect(scene.onStep.mock.calls.length).toBeGreaterThanOrEqual(2)
    // Выбор из вариантов — узнавание: форму не поднимает выше «окрепла».
    for (const call of scene.onResult.mock.calls) expect(call[2]).toBe(SOLID_STEP)
  })

  it('«Конструктор»: заданное число слов на заданной ступени, потом конец сцены', () => {
    const scene = hooks()
    inSession(<Builder verb={WRITE} onExit={vi.fn()} rng={seeded(5)} scene={{ ...scene, rounds: 2, solvedBefore: 0 }} />)

    for (let round = 0; round < 2; round++) {
      const ask = screen.getByTestId('builder-ask')
      const form = formOf(WRITE, ask.getAttribute('data-tense') as TenseKey, Number(ask.getAttribute('data-person')))
      // Первая ступень: выбирается только окончание — перебираем, пока слово в рамке не совпадёт.
      for (const option of screen.getByTestId('builder-row-ending').querySelectorAll('button')) {
        fireEvent.click(option)
        if (screen.getByTestId('builder-frame').firstElementChild!.textContent === form) break
      }
      fireEvent.click(screen.getByText('Собрать'))
      expect(scene.onStep).toHaveBeenCalledTimes(round + 1)
      expect(scene.onResult.mock.calls[round].slice(1)).toEqual([true, STEP.TYPE])
      // Приставка и буква лица на первой ступени стоят сами — и так до конца сцены.
      expect(screen.getByTestId('builder-row-preverb').textContent).toContain('уже стоит')
      fireEvent.click(screen.getByText('Дальше'))
    }
    expect(scene.onDone).toHaveBeenCalledTimes(1)
  })

  it('комикс: каждый кадр знакомит с формой, дочитал — «Дальше» ведёт в следующую сцену', () => {
    const scene = hooks()
    inSession(<StoryReader story={storyFixture} onExit={vi.fn()} scene={scene} />)

    const first = storyFixture.frames[0]
    fireEvent.click(screen.getByText(first.target.form))
    expect(scene.onResult).toHaveBeenLastCalledWith(first.target, true, SOLID_STEP, true)
    expect(scene.onStep).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(`verb_story_done_${storyFixture.id}`)).toBeNull()
  })

  it('комикс продолжает с кадра, на котором сессию прервали, а не с начала', () => {
    const scene = hooks(storyFixture.frames.length - 1)
    inSession(<StoryReader story={storyFixture} onExit={vi.fn()} scene={scene} />)
    expect(screen.getByTestId(`story-frame-${storyFixture.frames.length - 1}`)).toBeTruthy()
    expect(screen.queryByTestId('story-end')).toBeNull()
  })
})
