import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BomboraSays from './BomboraSays'
import { DAILY_PHRASES, dayKey, phraseOfDay, resetSaysMemory } from '../bomboraSays'
import { transliterateToGeorgian } from '../utils/georgianizerName'
import { cyr } from '../verbs/types'

// Блок профиля, где говорит Бомбора: что она говорит при открытии, как листается по нажатию
// и что из прежних разделов «Фраза дня» и «Моё имя по-грузински» осталось на экране.
// Грузинское берётся из данных приложения, от руки здесь не пишется.

const CHEER = 'Открой первый урок — алфавит ждёт.'
const today = () => dayKey(new Date())
const heard = (memory: object) => localStorage.setItem('bombora_profile_says', JSON.stringify(memory))

function open(props: { firstName?: string; alphabetDone?: boolean } = { firstName: 'Нина' }) {
  return render(<BomboraSays encouragement={CHEER} cheerMood="happy" alphabetDone={false} {...props} />)
}
const said = () => screen.getByTestId('bombora-says').getAttribute('data-say')
const reply = (kind: string) => within(screen.getByTestId(`bombora-says-${kind}`))
const tap = () => userEvent.click(screen.getByTestId('bombora-says'))

beforeEach(() => {
  localStorage.clear()
  resetSaysMemory()
})
afterEach(() => vi.restoreAllMocks())

describe('BomboraSays', () => {
  it('в первый заход за день говорит фразу дня: по-грузински, кириллицей и по-русски', () => {
    heard({ nameDay: today() })
    open()
    const phrase = phraseOfDay(today())
    expect(said()).toBe('phrase')
    expect(reply('phrase').getByText('Фраза на сегодня:')).toBeInTheDocument()
    expect(reply('phrase').getByText(phrase.ge)).toBeInTheDocument()
    expect(reply('phrase').getByText(cyr(phrase.ge))).toBeInTheDocument()
    expect(reply('phrase').getByText(phrase.ru)).toBeInTheDocument()
    expect(screen.getByTestId('bombora-says-phrase')).not.toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByTestId('bombora-says-cheer')).toHaveAttribute('aria-hidden', 'true')
  })

  it('при повторном заходе в тот же день подбадривает', () => {
    heard({ nameDay: today() })
    open().unmount()
    resetSaysMemory()
    open()
    expect(said()).toBe('cheer')
    expect(reply('cheer').getByText(CHEER)).toBeInTheDocument()
  })

  it('в самый первый заход называет имя по-грузински с кириллицей, без латиницы', () => {
    open({ firstName: 'Нина' })
    const name = transliterateToGeorgian('Нина')!
    expect(said()).toBe('name')
    expect(reply('name').getByText('Кстати, по-грузински ты —')).toBeInTheDocument()
    expect(reply('name').getByText(name.geo)).toBeInTheDocument()
    expect(reply('name').getByText(cyr(name.geo))).toBeInTheDocument()
    expect(screen.getByTestId('bombora-says-name').textContent).not.toMatch(/[a-z]/i)
    expect(reply('name').getByText('Выучи алфавит — прочитаешь без подсказки.')).toBeInTheDocument()
  })

  it('тому, кто прошёл алфавит, говорит, что подсказка уже не нужна', () => {
    open({ firstName: 'Нина', alphabetDone: true })
    expect(reply('name').getByText('Ты уже читаешь это без подсказки.')).toBeInTheDocument()
  })

  it('нажатие листает по кругу: подбадривание → фраза дня → имя', async () => {
    heard({ nameDay: today(), phraseDay: today() })
    open()
    expect(said()).toBe('cheer')
    await tap()
    expect(said()).toBe('phrase')
    await tap()
    expect(said()).toBe('name')
    await tap()
    expect(said()).toBe('cheer')
    expect(screen.getByText('нажми — скажу ещё')).toBeInTheDocument()
  })

  it('перерисовка реплику не меняет', () => {
    const view = open()
    expect(said()).toBe('name')
    view.rerender(<BomboraSays encouragement="Третий день подряд — продолжай." cheerMood="cheer" alphabetDone={false} firstName="Нина" />)
    expect(said()).toBe('name')
  })

  it('без имени реплики про имя нет — ни при открытии, ни по нажатию', async () => {
    open({ firstName: undefined })
    expect(said()).toBe('phrase')
    expect(screen.queryByTestId('bombora-says-name')).toBeNull()
    await tap()
    expect(said()).toBe('cheer')
    await tap()
    expect(said()).toBe('phrase')
  })

  it('имя, которое нельзя записать по-грузински, тоже не показывается', () => {
    open({ firstName: '★★★' })
    expect(said()).toBe('phrase')
    expect(screen.queryByTestId('bombora-says-name')).toBeNull()
  })

  it('без хранилища не падает: начинает с фразы дня, имя — по нажатию', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    open()
    expect(said()).toBe('phrase')
    await tap()
    expect(said()).toBe('name')
  })

  it('грузинское слово в подсказке к фразе идёт с кириллицей', () => {
    const index = DAILY_PHRASES.findIndex((p) => /[ა-ჿ]/.test(p.hint ?? ''))
    const georgian = DAILY_PHRASES[index].hint!.match(/[ა-ჿ]+/)![0]
    // День, на который выпадает эта фраза.
    const day = new Date(2026, 0, 1)
    while (phraseOfDay(dayKey(day)) !== DAILY_PHRASES[index]) day.setDate(day.getDate() + 1)
    vi.useFakeTimers({ now: day, toFake: ['Date'] })
    try {
      heard({ nameDay: dayKey(day) })
      open()
      expect(screen.getByTestId('bombora-says-phrase').textContent).toContain(`${georgian} (${cyr(georgian)})`)
    } finally {
      vi.useRealTimers()
    }
  })
})
