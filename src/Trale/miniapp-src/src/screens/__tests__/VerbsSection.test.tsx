import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import VerbsSection from '../VerbsSection'
import type { ProgressState } from '../../types'
import { LADDER, lemmaOf, ruOf, sectionFixture } from '../../verbs/section/fixture'
import { resetSectionCache } from '../../verbs/section/store'
import { TOUR_HINT, TOUR_TEXT } from '../../verbs/section/tour'
import type { VerbSectionDto } from '../../verbs/section/types'
import { loadSeenHints, resetSeenHints, uiHintKey } from '../../verbs/ui/hints'
import { cyr } from '../../verbs/types'
import { CATALOG } from '../../verbs/testing/catalog'

// Раздел «Глаголы»: первый экран новичка, «что делать сейчас», свои глаголы, уровни и наборы,
// знакомство по шагам (каждый шаг один раз), состояние без доступа.

const fetchVerbSection = vi.fn<() => Promise<VerbSectionDto>>()
const reportVerbSectionOpen = vi.fn((_source: string) => Promise.resolve({ ok: true }))
const markUiHintSeen = vi.fn((_key: string) => Promise.resolve({ ok: true }))
const translateWord = vi.fn()

vi.mock('../../api', async () => {
  const actual = await vi.importActual<typeof import('../../api')>('../../api')
  return {
    ...actual,
    fetchVerbSection: () => fetchVerbSection(),
    reportVerbSectionOpen: (s: string) => reportVerbSectionOpen(s),
    markUiHintSeen: (k: string) => markUiHintSeen(k),
    api: { ...actual.api, translateWord: (w: string, p?: unknown) => translateWord(w, p) }
  }
})
// Карточка, сессия и экран оплаты проверены своими тестами; здесь важно только, что и с чем открылось.
vi.mock('../../verbs/VerbSheet', () => ({ default: ({ verbId, onClose }: { verbId: string; onClose: () => void }) => <button data-testid="sheet" onClick={onClose}>{verbId}</button> }))
vi.mock('../../verbs/section/PlaySession', () => ({
  default: ({ verbId, onExit }: { verbId: string; onExit: (finished: boolean) => void }) => <button data-testid="play" onClick={() => onExit(true)}>{verbId}</button>
}))
vi.mock('../../components/ProPaywall', () => ({ default: ({ onClose }: { onClose: () => void }) => <button data-testid="paywall" onClick={onClose}>paywall</button> }))
vi.mock('../../verbs/ui/juice', () => ({ good: vi.fn(), bad: vi.fn(), burst: vi.fn(), haptic: vi.fn(), floater: vi.fn() }))

const FIRST = LADDER[0]
const navigate = vi.fn()

async function open(section: VerbSectionDto, source?: string) {
  fetchVerbSection.mockResolvedValue(section)
  const view = render(<VerbsSection progress={{} as ProgressState} navigate={navigate} source={source} onPurchaseSuccess={vi.fn()} />)
  await screen.findByTestId('verbs-section')
  return view
}

/** Знакомство уже пройдено — чтобы оно не мешало тестам про остальное. */
const tourSeen = () => loadSeenHints(Object.values(TOUR_HINT).map(uiHintKey))

beforeEach(() => {
  [fetchVerbSection, reportVerbSectionOpen, markUiHintSeen, translateWord, navigate].forEach(f => f.mockClear())
  resetSeenHints()
  resetSectionCache()
  // jsdom не считает размеры: даём «фонарику» прямоугольник цели.
  Element.prototype.getBoundingClientRect = () => ({ top: 100, left: 20, width: 300, height: 120, bottom: 220, right: 320, x: 20, y: 100, toJSON: () => ({}) })
})

describe('VerbsSection: a newcomer', () => {
  it('sees how much is learned and one obvious thing to do', async () => {
    await open(sectionFixture())

    expect(screen.getByTestId('verbs-learned').textContent).toBe(`Выучено 0 из ${LADDER.length}`)
    const now = screen.getByTestId('verbs-now')
    expect(now.dataset.kind).toBe('new')
    expect(within(now).getByTestId('verbs-now-ru').textContent).toBe(ruOf(FIRST))
    expect(within(now).getByTestId('verbs-now-play').textContent).toBe('Играть 2 минуты')
    const title = CATALOG.find(v => v.id === FIRST)!.title
    expect(now.textContent).toContain(title)
    expect(now.textContent).toContain(cyr(title))
  })

  it('the play button starts a session of the offered verb straight away', async () => {
    tourSeen()
    await open(sectionFixture())

    fireEvent.click(screen.getByTestId('verbs-now-play'))

    expect(screen.getByTestId('play').textContent).toBe(FIRST)
    expect(screen.queryByTestId('sheet')).toBeNull()
  })

  it('gets the «start with this» hint once: it is remembered on the server and does not come back', async () => {
    const first = await open(sectionFixture())

    expect((await screen.findByTestId('verbs-tour-text')).textContent).toBe(TOUR_TEXT.now)
    expect(markUiHintSeen).toHaveBeenCalledWith(uiHintKey(TOUR_HINT.now))
    expect(screen.queryByTestId('verbs-tour-skip')).toBeNull()
    fireEvent.click(screen.getByTestId('verbs-tour-action'))
    expect(screen.queryByTestId('verbs-tour-text')).toBeNull()

    first.unmount()
    await open(sectionFixture())
    expect(screen.queryByTestId('verbs-tour-text')).toBeNull()
  })

  it('the hint never blocks: its layer does not catch taps, and tapping the card closes it', async () => {
    await open(sectionFixture())

    expect((await screen.findByTestId('verbs-tour-now')).style.pointerEvents).toBe('none')
    fireEvent.click(screen.getByTestId('verbs-now-play'))

    expect(screen.getByTestId('play')).toBeTruthy()
    expect(screen.queryByTestId('verbs-tour-text')).toBeNull()
  })

  it('has an empty «Мои глаголы» with one line, an input and three examples to tap', async () => {
    tourSeen()
    await open(sectionFixture())

    expect(screen.getByTestId('verbs-mine-empty').textContent).toContain('в боте или в словаре')
    expect(screen.getByPlaceholderText('Введи любой глагол по-русски')).toBeTruthy()
    expect(screen.getAllByTestId('verbs-example').map(b => b.textContent)).toEqual(['готовить', 'играть', 'смеяться'])
  })

  it('sees five levels: the current one open with its packs, the rest collapsed, nothing locked', async () => {
    tourSeen()
    const section = sectionFixture()
    await open(section)

    expect(section.levels.map(l => screen.getByTestId(`verbs-level-${l.id}`).dataset.open)).toEqual(['true', 'false', 'false', 'false', 'false'])
    expect(screen.getByTestId('verbs-level-1-count').textContent).toBe('0 из 20')
    expect(screen.getByTestId(`verbs-pack-${section.levels[0].packs[0].id}`).textContent).toContain('ты здесь')
    expect(screen.queryAllByTestId('verbs-verb-row')).toHaveLength(0)

    fireEvent.click(within(screen.getByTestId('verbs-level-3')).getAllByRole('button')[0])
    expect(screen.getByTestId('verbs-level-3').dataset.open).toBe('true')
    expect(screen.getByTestId('verbs-level-1').dataset.open).toBe('false')
  })

  it('a pack opens to its verbs — Russian first, Georgian with Cyrillic — and a verb opens its card', async () => {
    tourSeen()
    const section = sectionFixture()
    await open(section)
    const pack = section.levels[0].packs[1]

    fireEvent.click(within(screen.getByTestId(`verbs-pack-${pack.id}`)).getAllByRole('button')[0])

    const rows = screen.getAllByTestId('verbs-verb-row')
    expect(rows).toHaveLength(pack.verbs.length)
    expect(rows[0].textContent).toContain(pack.verbs[0].ru)
    expect(rows[0].textContent).toContain(cyr(pack.verbs[0].title!))
    expect(rows[0].textContent!.indexOf(pack.verbs[0].ru)).toBeLessThan(rows[0].textContent!.indexOf(pack.verbs[0].title!))
    expect(rows[0].textContent).not.toMatch(/[a-z]{3,}/i)

    fireEvent.click(rows[2])
    expect(screen.getByTestId('sheet').textContent).toBe(pack.verbs[2].id)
  })

  it('who has not finished the alphabet gets one quiet line that leads to it and can be dismissed for good', async () => {
    tourSeen()
    const first = await open(sectionFixture({ alphabetHint: true }))

    fireEvent.click(within(screen.getByTestId('verbs-alphabet-line')).getByText(/Начни с алфавита/))
    expect(navigate).toHaveBeenCalledWith({ kind: 'module', moduleId: 'alphabet-progressive' })

    fireEvent.click(within(screen.getByTestId('verbs-alphabet-line')).getByLabelText('Скрыть'))
    expect(screen.queryByTestId('verbs-alphabet-line')).toBeNull()
    first.unmount()
    await open(sectionFixture({ alphabetHint: true }))
    expect(screen.queryByTestId('verbs-alphabet-line')).toBeNull()
  })

  it('reports how the section was opened: by the dashboard tile or by a link with its tag', async () => {
    tourSeen()
    const first = await open(sectionFixture())
    expect(reportVerbSectionOpen).toHaveBeenCalledWith('home')

    first.unmount()
    await open(sectionFixture(), 'verbs-2026-10')
    expect(reportVerbSectionOpen).toHaveBeenLastCalledWith('verbs-2026-10')
  })
})

describe('VerbsSection: «Мои глаголы»', () => {
  const hit = (ru: string) => {
    const verb = CATALOG.find(v => v.ru === ru)!
    return { form: verb.present[0], verbId: verb.id, title: verb.title, ru: verb.ru, tense: 'present', person: 0 }
  }

  it('tapping an example translates it the usual way, the verb appears here and the first one is celebrated once', async () => {
    tourSeen()
    translateWord.mockResolvedValue({ status: 'success', word: 'готовить', definition: 'перевод', verb: hit('готовить') })
    await open(sectionFixture())
    fetchVerbSection.mockResolvedValue(sectionFixture({ saved: [lemmaOf('готовить')] }))

    fireEvent.click(screen.getAllByTestId('verbs-example')[0])

    expect(translateWord.mock.calls[0][0]).toBe('готовить')
    const news = await screen.findByTestId('own-verb-unlocked')
    expect(news.textContent).toContain('Глагол «готовить» открыт!')
    expect(news.textContent).toContain('В него можно играть')
    expect(markUiHintSeen).toHaveBeenCalledWith(uiHintKey('verbs_own_unlocked'))
    await waitFor(() => expect(within(screen.getByTestId('verbs-mine')).getAllByTestId('verbs-verb-row')).toHaveLength(1))

    fireEvent.click(screen.getByTestId('own-verb-action'))
    expect(screen.getByTestId('play').textContent).toBe(lemmaOf('готовить'))
    fireEvent.click(screen.getByTestId('play'))

    // Второй свой глагол — уже без праздника.
    translateWord.mockResolvedValue({ status: 'success', word: 'играть', definition: 'перевод', verb: hit('играть') })
    fireEvent.click(await screen.findByTestId('verbs-mine-add-open'))
    fireEvent.click(screen.getAllByTestId('verbs-example')[1])
    await waitFor(() => expect(translateWord).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(fetchVerbSection.mock.calls.length).toBeGreaterThanOrEqual(4))
    expect(screen.queryByTestId('own-verb-unlocked')).toBeNull()
  })

  it('says so calmly when the word is not a verb or the lookup takes long', async () => {
    tourSeen()
    let finish!: (r: unknown) => void
    translateWord.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    await open(sectionFixture())

    fireEvent.change(screen.getByPlaceholderText('Введи любой глагол по-русски'), { target: { value: 'стол' } })
    fireEvent.click(screen.getByLabelText('Перевести'))
    expect((await screen.findByTestId('verbs-mine-busy')).textContent).toBe('Перевожу…')
    act(() => (translateWord.mock.calls[0][1] as (v: boolean) => void)(true))
    expect(screen.getByTestId('verbs-mine-busy').textContent).toContain('до минуты')

    await act(async () => finish({ status: 'success', word: 'стол', definition: 'перевод', verb: null }))
    expect(screen.getByTestId('verbs-mine-note').textContent).toContain('не глагол')
    expect(screen.queryByTestId('own-verb-unlocked')).toBeNull()
  })

  it('lists started and saved verbs, marks a model-made one quietly and says which level a verb also sits in', async () => {
    tourSeen()
    const modelMade = { id: lemmaOf('петь'), title: CATALOG.find(v => v.ru === 'петь')!.title, ru: 'придуманный', level: 'new' as const, generated: true, levelId: null, packId: null }
    await open(sectionFixture({ levels: { [FIRST]: 'recognising' }, saved: [modelMade, lemmaOf('готовить'), lemmaOf('играть')] }))

    const mine = within(screen.getByTestId('verbs-mine'))
    const rows = mine.getAllByTestId('verbs-verb-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].textContent).toContain(ruOf(FIRST))
    expect(rows[0].textContent).toContain('уровень 1')
    expect(rows[0].textContent).toContain('узнаю')
    expect(rows[1].textContent).toContain('составлено нейросетью')
    expect(mine.getAllByTestId('verbs-mine-generated')).toHaveLength(1)
    expect(mine.queryByTestId('verbs-mine-empty')).toBeNull()

    fireEvent.click(mine.getByTestId('verbs-mine-all'))
    expect(mine.getAllByTestId('verbs-verb-row')).toHaveLength(4)
    fireEvent.click(mine.getAllByTestId('verbs-verb-row')[1])
    expect(screen.getByTestId('sheet').textContent).toBe(modelMade.id)
  })
})

describe('VerbsSection: in progress', () => {
  it('offers to continue the verb in play and shows it as started in its level, not as a second verb', async () => {
    tourSeen()
    await open(sectionFixture({ levels: { [FIRST]: 'phrases', [LADDER[1]]: 'learned' } }))

    expect(screen.getByTestId('verbs-learned').textContent).toBe(`Выучено 1 из ${LADDER.length}`)
    expect(screen.getByTestId('verbs-now').dataset.kind).toBe('continue')
    expect(screen.getByTestId('verbs-now-play').textContent).toBe('Продолжить — 2 минуты')
    expect(screen.getByTestId('verbs-level-1-count').textContent).toBe('1 из 20')
    expect(Number(screen.getByTestId('verbs-level-1-bar').dataset.percent)).toBeGreaterThan(5)
    expect(Number(screen.getByTestId('verbs-level-2-bar').dataset.percent)).toBe(0)
  })

  it('offers a review when a learned verb has forms due', async () => {
    tourSeen()
    await open(sectionFixture({ levels: { [FIRST]: 'learned' }, due: { [FIRST]: 3 } }))

    expect(screen.getByTestId('verbs-now').dataset.kind).toBe('review')
    expect(screen.getByTestId('verbs-now-due').textContent).toBe('3 формы ждут повторения')
    expect(screen.getByTestId('verbs-now-play').textContent).toBe('Повторить за минуту')
  })

  it('a pack is «пройден» only when every verb in it is learned', async () => {
    tourSeen()
    const pack = sectionFixture().levels[0].packs[0]
    const learned = Object.fromEntries(pack.verbs.map(v => [v.id!, 'learned' as const]))
    const view = await open(sectionFixture({ levels: learned }))
    expect(screen.getByTestId(`verbs-pack-${pack.id}`).dataset.done).toBe('true')
    expect(screen.getByTestId(`verbs-pack-${pack.id}`).textContent).toContain('пройден')

    view.unmount()
    resetSectionCache()
    await open(sectionFixture({ levels: { ...learned, [pack.verbs[0].id!]: 'examReady' } }))
    expect(screen.getByTestId(`verbs-pack-${pack.id}`).dataset.done).toBe('false')
  })

  it('after the first finished session leads through the level, the card and «Мои глаголы» — top to bottom, each step once, skippable', async () => {
    loadSeenHints([uiHintKey(TOUR_HINT.now)])
    // «Мои глаголы» теперь внизу экрана: фонарик сам докручивает до того, что подсвечивает.
    const scrolled: (string | null)[] = []
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) { scrolled.push(this.getAttribute('data-tour')) }
    await open(sectionFixture())
    fetchVerbSection.mockResolvedValue(sectionFixture({ levels: { [FIRST]: 'meeting' } }))

    fireEvent.click(screen.getByTestId('verbs-now-play'))
    expect(screen.queryByTestId('verbs-tour-text')).toBeNull()
    fireEvent.click(screen.getByTestId('play'))

    expect((await screen.findByTestId('verbs-tour-text')).textContent).toBe(TOUR_TEXT.level)
    expect(document.querySelector('[data-tour="level"]')).toBeTruthy()
    expect(screen.getByText('1 из 3')).toBeTruthy()
    fireEvent.click(screen.getByTestId('verbs-tour-action'))

    expect(screen.getByTestId('verbs-tour-text').textContent).toBe(TOUR_TEXT.card)
    expect(screen.getByTestId('verbs-tour-verb-row')).toBeTruthy()
    fireEvent.click(screen.getByTestId('verbs-tour-action'))

    expect(screen.getByTestId('verbs-tour-text').textContent).toBe(TOUR_TEXT.mine)
    expect(screen.getByTestId('verbs-tour-mine-add')).toBeTruthy()
    expect(screen.getAllByTestId('verbs-example')).toHaveLength(3)
    expect(screen.getByTestId('verbs-tour-action').textContent).toBe('Понятно')
    expect(scrolled).toEqual(['level', 'verb-row', 'mine-add'])
    fireEvent.click(screen.getByTestId('verbs-tour-action'))

    expect(screen.queryByTestId('verbs-tour-text')).toBeNull()
    expect(markUiHintSeen.mock.calls.map(c => c[0])).toEqual(
      expect.arrayContaining([TOUR_HINT.card, TOUR_HINT.level, TOUR_HINT.mine].map(uiHintKey)))
    delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
  })

  it('puts the levels first and the learner’s own verbs after them', async () => {
    loadSeenHints([TOUR_HINT.now, TOUR_HINT.card, TOUR_HINT.level, TOUR_HINT.mine].map(uiHintKey))
    await open(sectionFixture({ levels: { [FIRST]: 'meeting' } }))
    const now = screen.getByTestId('verbs-now-play')
    const levels = screen.getByTestId('verbs-levels')
    const mine = screen.getByTestId('verbs-mine')
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING
    expect(now.compareDocumentPosition(levels) & FOLLOWING).toBeTruthy()
    expect(levels.compareDocumentPosition(mine) & FOLLOWING).toBeTruthy()
    expect(levels.contains(mine)).toBe(false)
  })

  it('«Пропустить» ends the tour for good', async () => {
    loadSeenHints([uiHintKey(TOUR_HINT.now)])
    const first = await open(sectionFixture({ levels: { [FIRST]: 'meeting' } }))

    fireEvent.click(await screen.findByTestId('verbs-tour-skip'))
    expect(screen.queryByTestId('verbs-tour-text')).toBeNull()

    first.unmount()
    await open(sectionFixture({ levels: { [FIRST]: 'meeting' } }))
    expect(screen.queryByTestId('verbs-tour-text')).toBeNull()
  })
})

describe('VerbsSection: without access', () => {
  it('shows the overview — levels, packs, Russian names — and no Georgian, no hints', async () => {
    const section = sectionFixture({ hasAccess: false })
    await open(section)

    expect(screen.getByTestId('verbs-section').dataset.access).toBe('false')
    expect(screen.getByTestId('verbs-learned').textContent).toContain(`из ${LADDER.length}`)
    expect(screen.getByTestId('verbs-now-ru').textContent).toBe(ruOf(FIRST))
    expect(screen.queryByTestId('verbs-tour-text')).toBeNull()
    fireEvent.click(within(screen.getByTestId(`verbs-pack-${section.levels[0].packs[0].id}`)).getAllByRole('button')[0])
    expect(screen.getAllByTestId('verbs-verb-row')[0].textContent).toBe(section.levels[0].packs[0].verbs[0].ru)
    expect(screen.getByTestId('verbs-levels').textContent).not.toMatch(/[ა-ჰ]/)
  })

  it('playing, opening a verb and adding one lead to the usual paywall, not to an error', async () => {
    const section = sectionFixture({ hasAccess: false })
    await open(section)

    fireEvent.click(screen.getByTestId('verbs-now-play'))
    expect(screen.getByTestId('paywall')).toBeTruthy()
    expect(screen.queryByTestId('play')).toBeNull()
    fireEvent.click(screen.getByTestId('paywall'))

    fireEvent.click(within(screen.getByTestId(`verbs-pack-${section.levels[0].packs[0].id}`)).getAllByRole('button')[0])
    fireEvent.click(screen.getAllByTestId('verbs-verb-row')[0])
    expect(screen.getByTestId('paywall')).toBeTruthy()
    expect(screen.queryByTestId('sheet')).toBeNull()
    fireEvent.click(screen.getByTestId('paywall'))

    fireEvent.click(screen.getAllByTestId('verbs-example')[0])
    expect(screen.getByTestId('paywall')).toBeTruthy()
    expect(translateWord).not.toHaveBeenCalled()
  })
})

describe('VerbsSection: when it cannot load', () => {
  it('says so instead of an empty screen', async () => {
    fetchVerbSection.mockRejectedValue(new Error('offline'))
    render(<VerbsSection progress={{} as ProgressState} navigate={navigate} onPurchaseSuccess={vi.fn()} />)

    expect((await screen.findByTestId('verbs-section-failed')).textContent).toContain('Не получилось загрузить')
  })
})
