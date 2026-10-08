import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import PrefixIntro from '../PrefixIntro'
import PrefixScene, { type PrefixSceneHooks } from '../PrefixScene'
import { PREFIX_INTRO_HINT, type PrefixRound } from '../prefixPlan'
import { onOpenLessonModule } from '../nav'
import { resetFamilyCache } from '../store'
import { SOLID_STEP } from '../../ladder/engine'
import { GO, at, familyDto, familyVerb } from '../../testing/family'
import { moveSeen, rulesSeen } from '../../testing/seen'
import { SessionChrome } from '../../ui/GameShell'
import { hintSeen } from '../../ui/hints'
import { bad, good } from '../../ui/juice'

// Сцена про приставку: вопросы про направление, отклик на ошибку, проверка с одной попыткой, вступление.

const family = familyDto()
vi.mock('../../../api', () => ({
  fetchVerbFamily: vi.fn(() => Promise.resolve(family)),
  markUiHintSeen: vi.fn(() => Promise.resolve({ ok: true }))
}))
vi.mock('../../ui/juice', () => ({ good: vi.fn(), bad: vi.fn(), haptic: vi.fn(), floater: vi.fn(), burst: vi.fn() }))

const OUT = at('out', 'there'), OUT_HERE = at('out', 'here'), IN = at('in', 'there')
const out = familyVerb(OUT)
const ROUNDS: PrefixRound[] = [
  { kind: 'form', target: OUT, cell: 'present:2', options: [IN, OUT, OUT_HERE, GO.base] },
  { kind: 'direction', target: OUT, cell: 'aorist:2', options: [OUT_HERE, IN, OUT, at('down', 'there')] },
  { kind: 'form', target: IN, cell: 'future:0', options: [IN, OUT, at('in', 'here'), at('up', 'there')] }
]

function hooks(): PrefixSceneHooks {
  return { startAt: 0, onResult: vi.fn(), onStep: vi.fn(), onDone: vi.fn(), onKnown: vi.fn() }
}
const inSession = (node: React.ReactNode) =>
  render(<SessionChrome.Provider value={{ fraction: 0.3, onExit: vi.fn() }}>{node}</SessionChrome.Provider>)
const tick = (ms = 2000) => act(async () => { vi.advanceTimersByTime(ms) })
const option = (id: string) => screen.getAllByTestId('prefix-option').find(b => b.getAttribute('data-id') === id)!
const scene = () => screen.getByTestId('prefix-scene')

describe('сцена про приставку', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetFamilyCache()
    vi.mocked(good).mockClear(); vi.mocked(bad).mockClear()
    rulesSeen('verb_prefix'); rulesSeen('verb_prefix_check'); moveSeen('verb_prefix')
  })
  afterEach(() => { vi.useRealTimers() })

  it('«Как сказать?»: фраза и направление, варианты — та же клетка с разными приставками, приставка выделена', async () => {
    const h = hooks()
    inSession(<PrefixScene verbId={OUT} familyId="go" rounds={ROUNDS} scene={h} onExit={vi.fn()} />)
    await tick(0)

    expect(scene().getAttribute('data-kind')).toBe('form')
    expect(screen.getByTestId('prefix-phrase').textContent).toBe(out.meanings!.present![2])
    expect(screen.getByTestId('prefix-where').textContent).toBe('наружу · туда')
    const options = screen.getAllByTestId('prefix-option')
    expect(options.map(o => o.getAttribute('data-id'))).toEqual(ROUNDS[0].options)
    for (const id of ROUNDS[0].options) {
      const verb = familyVerb(id)
      expect(option(id).getAttribute('aria-label')).toBe(verb.tenses.present![2][0])
      expect(option(id).querySelector('[data-testid="prefix-part"]')!.textContent).toBe(verb.family!.prefixes[0])
      // Под словом — кириллица: играть можно, не зная букв.
      expect(option(id).textContent).toMatch(/[а-яё]/i)
    }

    // Ошибка: сказано, что значит выбранное; можно выбрать ещё раз; засчитана один раз.
    fireEvent.click(option(IN))
    expect(bad).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('prefix-note').textContent).toContain(`${familyVerb(IN).tenses.present![2][0]} — это «${familyVerb(IN).meanings!.present![2]}»: внутрь · туда. Выбери другое.`)
    expect(option(IN)).toBeDisabled()
    fireEvent.click(option(OUT_HERE))
    expect(h.onResult).toHaveBeenCalledTimes(1)
    expect(h.onResult).toHaveBeenCalledWith({ tense: 'present', person: 2 }, false, SOLID_STEP, true)

    fireEvent.click(option(OUT))
    expect(good).toHaveBeenCalledTimes(1)
    expect(h.onResult).toHaveBeenCalledTimes(1)
    expect(h.onStep).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('prefix-note').textContent).toContain('Верно')
  })

  it('«Куда?»: слово, варианты — направления; чужая клетка прогресс этого глагола не двигает; в конце — конец сцены', async () => {
    const h = hooks()
    inSession(<PrefixScene verbId={OUT} familyId="go" rounds={ROUNDS} scene={h} onExit={vi.fn()} />)
    await tick(0)
    fireEvent.click(option(OUT))
    await tick()

    expect(scene().getAttribute('data-kind')).toBe('direction')
    expect(screen.getByTestId('prefix-form').textContent).toBe(out.tenses.aorist![2][0])
    expect(screen.getByText(`«${familyVerb(GO.base).meanings!.aorist![2]}» — но куда?`)).toBeInTheDocument()
    expect(option(OUT).getAttribute('aria-label')).toBe('наружу · туда')
    expect(option(OUT_HERE).getAttribute('aria-label')).toBe('наружу · сюда')
    expect(screen.getAllByTestId('direction-glyph').length).toBeGreaterThanOrEqual(4)

    fireEvent.click(option(OUT_HERE))
    expect(screen.getByTestId('prefix-note').textContent).toContain(`«наружу · сюда» — это было бы ${familyVerb(OUT_HERE).tenses.aorist![2][0]}`)
    fireEvent.click(option(OUT))
    await tick()

    // Третий вопрос — про соседа: его ответ в прогресс этого глагола не идёт.
    expect(scene().getAttribute('data-target')).toBe(IN)
    const before = vi.mocked(h.onResult).mock.calls.length
    fireEvent.click(option(IN))
    expect(h.onResult).toHaveBeenCalledTimes(before)
    expect(h.onKnown).not.toHaveBeenCalled()
    await tick()
    expect(h.onStep).toHaveBeenCalledTimes(3)
    expect(h.onDone).toHaveBeenCalledTimes(1)
  })

  it('проверка: одна попытка, верное показано, счёт уходит в итог; верно выбранное слово уходит на повторение', async () => {
    const h = hooks()
    const onCheck = vi.fn()
    inSession(<PrefixScene verbId={OUT} familyId="go" rounds={ROUNDS} scene={h} onExit={vi.fn()} onCheck={onCheck} />)
    await tick(0)

    expect(scene().getAttribute('data-mode')).toBe('check')
    expect(screen.getByText('Проверка · 1 из 3')).toBeInTheDocument()
    fireEvent.click(option(IN))
    expect(screen.getByTestId('prefix-note').textContent).toContain('А здесь — ' + out.tenses.present![2][0])
    expect(option(OUT)).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }))

    fireEvent.click(option(OUT))
    expect(h.onKnown).toHaveBeenCalledWith({ tense: 'aorist', person: 2 })
    await tick()
    fireEvent.click(option(IN))
    await tick()

    expect(onCheck).toHaveBeenCalledWith({ asked: 3, correct: 2, missed: [{ tense: 'present', person: 2 }] })
    expect(h.onKnown).toHaveBeenCalledTimes(1)
    expect(h.onDone).toHaveBeenCalledTimes(1)
  })

  it('в первый раз: правила, подсказка и подсветка нужного варианта', async () => {
    const { resetSeenHints } = await import('../../ui/hints')
    resetSeenHints()
    inSession(<PrefixScene verbId={OUT} familyId="go" rounds={ROUNDS} scene={hooks()} onExit={vi.fn()} />)
    await tick(0)

    expect(screen.getByText('Как играть · 1 из 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }))
    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }))
    fireEvent.click(screen.getByRole('button', { name: 'Играть' }))
    expect(screen.getByText(/Смотри на начало слова/)).toBeInTheDocument()
    expect(option(OUT).className).toContain('animate-pulse')
    expect(option(IN).className).not.toContain('animate-pulse')

    fireEvent.click(option(OUT))
    await tick()
    expect(screen.queryByText(/Для первого раза/)).toBeNull()
  })

  it('вступление: экраны из урока по порядку, «Понятно, играть» — один раз и навсегда', async () => {
    const h = hooks()
    inSession(<PrefixIntro familyId="go" scene={h} onExit={vi.fn()} />)
    await tick(0)

    expect(screen.getByText('Из урока «Первый урок»')).toBeInTheDocument()
    expect(screen.getAllByTestId('prefix-intro-line')).toHaveLength(2)
    expect(screen.getAllByTestId('prefix-intro-line')[0].textContent).toContain('внутрь')
    expect(screen.getByText(new RegExp(`тот же глагол «${GO.baseName}»`))).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Дальше' }))
    expect(screen.getByText('Из урока «Второй урок»')).toBeInTheDocument()
    expect(hintSeen(PREFIX_INTRO_HINT)).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Понятно, играть' }))
    expect(hintSeen(PREFIX_INTRO_HINT)).toBe(true)
    expect(h.onDone).toHaveBeenCalledTimes(1)
  })

  it('вступление предлагает уроки о приставках ссылкой', async () => {
    const opened = vi.fn(), onExit = vi.fn()
    const off = onOpenLessonModule(opened)
    inSession(<PrefixIntro familyId="go" scene={hooks()} onExit={onExit} />)
    await tick(0)

    fireEvent.click(screen.getByTestId('prefix-intro-lesson'))
    expect(opened).toHaveBeenCalledWith('preverbs')
    expect(onExit).toHaveBeenCalled()
    off()
  })
})
