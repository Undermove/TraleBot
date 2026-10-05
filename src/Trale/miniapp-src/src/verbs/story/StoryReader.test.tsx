import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import StoryReader from './StoryReader'
import { storyFixture as story } from './fixture'
import { parseVerbForm } from '../../api'
import { bad, good } from '../ui/juice'
import { seenKey } from '../ui/GameShell'
import { hintSeen, resetSeenHints } from '../ui/hints'
import { rulesSeen } from '../testing/seen'

vi.mock('../../api', async () => (await import('../testing/sheetApi')).sheetApi())
vi.mock('../ui/juice', () => ({ good: vi.fn(), bad: vi.fn(), haptic: vi.fn() }))

const scrolled = vi.fn()

function open() {
  const onExit = vi.fn()
  render(<StoryReader story={story} onExit={onExit} />)
  return onExit
}

const frame = (i: number) => screen.getByTestId(`story-frame-${i}`)
const pictures = (i: number) => [...frame(i).querySelectorAll('img')].map(img => img.getAttribute('src'))
const progress = () => screen.getByTestId('story-progress').textContent
const press = (letters: string) => {
  const keyboard = within(screen.getByTestId('story-keyboard'))
  for (const letter of letters) fireEvent.pointerDown(keyboard.getByText(letter))
}
const say = () => fireEvent.click(screen.getByText('Сказать'))
const chip = (word: string) => fireEvent.click(within(screen.getByTestId('story-chips')).getByText(word))

/** Проходит кадр с выбором и кадр с набором — остаётся кадр, где фразу собирают. */
function reachBuildFrame() {
  fireEvent.click(within(frame(0)).getByText('მიდიხარ'))
  fireEvent.click(screen.getByTestId('story-type-field'))
  press('წავალ')
  say()
}

describe('StoryReader', () => {
  beforeEach(() => {
    localStorage.clear()
    // Правила при первом входе проверяются отдельным тестом.
    rulesSeen('story')
    vi.clearAllMocks()
    scrolled.mockClear()
    Element.prototype.scrollIntoView = function (this: Element, arg?: boolean | ScrollIntoViewOptions) {
      scrolled((this as HTMLElement).dataset.testid ?? 'talk', arg)
    }
  })

  it('shows the rules on the first entry only', () => {
    resetSeenHints()
    const first = render(<StoryReader story={story} onExit={() => {}} />)
    expect(screen.getByText(/Это комикс/)).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    fireEvent.click(screen.getByText('Дальше'))
    fireEvent.click(screen.getByText('Играть'))
    first.unmount()

    open()

    expect(screen.queryByText(/Это комикс/)).toBeNull()
  })

  it('opens the first frame, keeps the next one locked on its placeholder and hides the rest', () => {
    open()

    expect(frame(0).dataset.state).toBe('current')
    expect(pictures(0)).toContain('/stories/go-fishing/d404709ff4/f1-480.webp')
    expect(frame(0).querySelector('[data-testid=story-frame-picture]')!.getAttribute('srcset'))
      .toBe('/stories/go-fishing/d404709ff4/f1-480.webp 480w, /stories/go-fishing/d404709ff4/f1-800.webp 800w')
    expect(frame(1).dataset.state).toBe('locked')
    expect(pictures(1)).toEqual(['/stories/go-fishing/d404709ff4/f4-ph.webp'])
    expect(frame(1).textContent).not.toContain('წავალ')
    expect(screen.queryByTestId('story-frame-2')).toBeNull()
    expect(progress()).toBe('0/3')
  })

  it('does not show the missing form in the line until it is said', () => {
    open()

    expect(screen.getByTestId('story-line-0').textContent).toBe('შენ სად  ახლა?')
    expect(screen.getByTestId('story-gap')).toBeTruthy()
  })

  it('answers a wrong form with what that form means and lets the learner try again', () => {
    open()

    fireEvent.click(within(frame(0)).getByText('მივდივარ'))

    expect(screen.getByTestId('story-note').textContent)
      .toBe('მივდივარ — это «я иду». А здесь нужно «ты идёшь».')
    expect(bad).toHaveBeenCalledTimes(1)
    expect(frame(0).dataset.state).toBe('current')
    expect(frame(1).dataset.state).toBe('locked')
    expect(progress()).toBe('0/3')

    fireEvent.click(within(frame(0)).getByText('მიდიხარ'))

    expect(good).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('story-note')).toBeNull()
    expect(progress()).toBe('1/3')
  })

  it('unlocks the next frame on the right form and scrolls its picture to the top', () => {
    open()

    fireEvent.click(within(frame(0)).getByText('მიდიხარ'))

    expect(frame(0).dataset.state).toBe('open')
    expect(screen.getByTestId('story-line-0').textContent).toBe('შენ სად მიდიხარ ახლა?')
    expect(frame(1).dataset.state).toBe('current')
    expect(pictures(1)).toContain('/stories/go-fishing/d404709ff4/f4-480.webp')
    expect(frame(2).dataset.state).toBe('locked')
    expect(scrolled).toHaveBeenLastCalledWith('story-frame-1', { behavior: 'smooth', block: 'start' })
  })

  it('opens the keyboard only when the field is tapped and pulls the line and the button above it', () => {
    open()
    fireEvent.click(within(frame(0)).getByText('მიდიხარ'))
    expect(screen.queryByTestId('story-keyboard')).toBeNull()

    fireEvent.click(screen.getByTestId('story-type-field'))

    expect(screen.getByTestId('story-keyboard')).toBeTruthy()
    // Реплика, поле и кнопка лежат в одном блоке — его низ и прижимается к клавиатуре.
    const talk = screen.getByTestId('story-line-1').parentElement!.parentElement!
    expect(talk.contains(screen.getByTestId('story-type-field'))).toBe(true)
    expect(talk.contains(screen.getByText('Сказать'))).toBe(true)
    expect(scrolled).toHaveBeenLastCalledWith('talk', { behavior: 'smooth', block: 'end' })
  })

  it('explains a typed form through its parse and unlocks on the right one', async () => {
    vi.mocked(parseVerbForm).mockResolvedValue({
      hits: [{ form: 'წავედი', verbId: 'მიდის', title: 'სვლა', ru: 'идти, уходить', tense: 'aorist', person: 0, meaning: 'я шёл / шла', meaningNote: 'один раз · сделано' }]
    })
    open()
    fireEvent.click(within(frame(0)).getByText('მიდიხარ'))
    fireEvent.click(screen.getByTestId('story-type-field'))

    press('წავედი')
    say()

    await waitFor(() => expect(screen.getByTestId('story-note').textContent)
      .toBe('წავედი — это «я шёл / шла» (один раз · сделано). А здесь нужно «я буду идти».'))
    expect(parseVerbForm).toHaveBeenCalledWith('წავედი')
    expect(frame(1).dataset.state).toBe('current')

    press('წავალ')
    say()

    expect(frame(1).dataset.state).toBe('open')
    expect(screen.queryByTestId('story-keyboard')).toBeNull()
    expect(progress()).toBe('2/3')
  })

  it('still answers when the parse request fails', async () => {
    vi.mocked(parseVerbForm).mockRejectedValue(new Error('offline'))
    open()
    fireEvent.click(within(frame(0)).getByText('მიდიხარ'))
    fireEvent.click(screen.getByTestId('story-type-field'))

    press('წავა')
    say()

    await waitFor(() => expect(screen.getByTestId('story-note').textContent).toBe('Пока не то. Здесь нужно «я буду идти».'))
  })

  it('finishes when the phrase is built in the source order', () => {
    const onExit = open()
    reachBuildFrame()

    for (const word of ['ის', 'წავიდა', 'სახლში']) chip(word)
    say()

    expect(screen.getByTestId('story-end').textContent).toContain('Конец истории')
    expect(progress()).toBe('3/3')
    expect(good).toHaveBeenLastCalledWith(null, 'big')
    expect(scrolled).toHaveBeenLastCalledWith('story-end', { behavior: 'smooth', block: 'start' })

    fireEvent.click(screen.getByText('Готово'))
    expect(onExit).toHaveBeenCalled()
  })

  it('counts another word order as said: shows the source phrase and waits for «Дальше»', () => {
    open()
    reachBuildFrame()
    vi.mocked(bad).mockClear()

    for (const word of ['სახლში', 'ის', 'წავიდა']) chip(word)
    say()

    const note = screen.getByTestId('story-note').textContent!
    expect(note).toContain('Засчитано')
    expect(note).toContain('Порядок слов в грузинском гибкий, но не любой')
    expect(note).toContain('ის წავიდა სახლში.')
    expect(screen.getByTestId('story-line-2').textContent).toBe('ის წავიდა სახლში.')
    expect(screen.queryByTestId('story-chips')).toBeNull()
    expect(bad).not.toHaveBeenCalled()
    expect(screen.queryByTestId('story-end')).toBeNull()

    fireEvent.click(screen.getByText('Дальше'))

    expect(screen.getByTestId('story-end')).toBeTruthy()
  })

  it('sums up the forms the learner used, with tense and person, and says the translation was adapted', () => {
    open()
    reachBuildFrame()
    for (const word of ['ის', 'წავიდა', 'სახლში']) chip(word)
    say()

    const end = screen.getByTestId('story-end').textContent!
    expect(end).toContain('მიდიხარ')
    expect(end).toContain('«ты идёшь»')
    expect(end).toContain('«я буду идти»')
    expect(end).toContain('«он шёл» (один раз · сделано)')
    expect(end).toContain('Tatoeba')
    expect(end).toContain('подогнан под сюжет')
  })

  it('hints the first move of each kind once, and not after it was made', () => {
    open()
    expect(screen.getByText('Нажми слово, которое стоит на месте пропуска.')).toBeTruthy()
    expect(screen.getByTestId('story-gap').className).toContain('animate-pulse')

    fireEvent.click(within(frame(0)).getByText('მიდიხარ'))

    expect(screen.queryByText('Нажми слово, которое стоит на месте пропуска.')).toBeNull()
    expect(screen.getByText(/Нажми на поле, набери пропущенное слово/)).toBeTruthy()
    expect(hintSeen(seenKey('story_choose_move'))).toBe(true)
    expect(hintSeen(seenKey('story_type_move'))).toBe(false)
  })
})
