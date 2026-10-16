import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { setMuted } from '../../alphabet/games/fx'
import { CITIES, COUNTRIES, JOBS, geoName, introLesson } from '../story'
import AboutMe from './AboutMe'
import { LOVES, STORY_KEY, choose, complete, emptyCard, filled, loadStory, magnet, needsMagnet, nextEmpty, saveStory, storyLines } from './AboutMe.logic'

beforeEach(() => localStorage.clear())

describe('about me: card', () => {
  it('country and city need the right magnet; the wrong one leaves the slot as it was', () => {
    let c = choose(emptyCard(), 'country', COUNTRIES[1])
    expect(needsMagnet(c)).toBe(true)
    let r = magnet(c, 'ში')
    expect(r.ok).toBe(false)
    expect(r.card).toBe(c)
    r = magnet(c, 'დან')
    expect(r.ok).toBe(true)
    expect(r.card.active).toBe('city')
    c = choose(r.card, 'city', CITIES[1])
    expect(magnet(c, 'დან').ok).toBe(false)
    c = magnet(c, 'ში').card
    expect(c.active).toBe('job')
    c = choose(c, 'job', JOBS[0])
    expect(c.active).toBe('love')
    expect(complete(c)).toBe(false)
    c = choose(c, 'love', LOVES[0])
    expect(nextEmpty(c)).toBeNull()
    expect(filled(c)).toBe(5)
  })

  it('the story uses only sourced patterns and links lines to recorded phrases where they exist', () => {
    let c = choose(emptyCard(), 'country', COUNTRIES[0])
    c = magnet(c, 'დან').card
    c = choose(c, 'city', CITIES.find(x => x.ru === 'Батуми')!)
    c = magnet(c, 'ში').card
    c = choose(choose(c, 'job', JOBS[0]), 'love', LOVES[0])
    const lines = storyLines(c, geoName('Карлос'))
    expect(lines.map(l => l.geo)).toEqual(['მე მქვია კარლოსი.', 'მე ვარ საქართველოდან.', 'ვცხოვრობ ბათუმში.', 'მე ვარ სტუდენტი.', 'მიყვარს საქართველო.'])
    expect(lines.map(l => l.phrase)).toEqual(['me_mkvia_karlosi', 'sakartvelodan', 'batumshi', 'studenti', 'miyvars_sakartvelo'])
    expect(lines[1].ru).toBe('Я из Грузии.')
    saveStory(lines, 5)
    expect(loadStory()).toEqual({ geo: lines.map(l => l.geo), ru: lines.map(l => l.ru), savedAt: 5 })
  })
})

describe('AboutMe scene', () => {
  beforeEach(() => setMuted(true))
  afterEach(() => { vi.useRealTimers(); setMuted(false) })

  it('an interview: answers built word + ending, the newspaper note is read, saved and leads to «Дальше»', async () => {
    vi.useFakeTimers()
    localStorage.setItem('intro_name', 'Анна')
    const onDone = vi.fn()
    const step = async (ms = 6000) => { for (let t = 0; t < ms; t += 100) await act(async () => { await vi.advanceTimersByTimeAsync(100) }) }
    render(<AboutMe lesson={introLesson(32)} step={{ kind: 'aboutme' }} fraction={0.5} onExit={() => {}} onDone={onDone} />)
    fireEvent.click(screen.getByText('Начать'))
    await step()
    expect(screen.getByTestId('aboutme-question').textContent).toContain('რა გქვია?')
    fireEvent.click(screen.getByTestId('aboutme-name'))
    await step()
    fireEvent.click(screen.getByTestId(`opt-${COUNTRIES[2].base}`))
    expect(screen.getByTestId('slot-country').dataset.state).toBe('needs')
    fireEvent.click(screen.getByTestId('magnet-ში'))
    expect(screen.getByTestId('slot-country').dataset.state).toBe('needs')
    fireEvent.click(screen.getByTestId('magnet-დან'))
    expect(screen.getByTestId('slot-country').dataset.state).toBe('filled')
    await step()
    fireEvent.click(screen.getByTestId(`opt-${CITIES[0].base}`))
    fireEvent.click(screen.getByTestId('magnet-ში'))
    await step()
    fireEvent.click(screen.getByTestId(`opt-${JOBS[1].geo}`))
    await step()
    fireEvent.click(screen.getByTestId(`opt-${LOVES[2].geo}`))
    await step()
    expect(screen.getByTestId('aboutme-filled').textContent).toBe('5 / 5')
    fireEvent.click(screen.getByText('Готово, прочитать рассказ'))
    const lines = screen.getAllByTestId('story-line')
    expect(lines).toHaveLength(5)
    expect(lines[0].textContent).toContain('მე მქვია ანა.')
    expect(lines[1].textContent).toContain('მე ვარ საფრანგეთიდან.')
    await act(async () => { await vi.advanceTimersByTimeAsync(600) })
    expect(screen.getAllByTestId('story-line')[0].dataset.reading).toBe('yes')
    fireEvent.click(screen.getByTestId('story-save'))
    expect(screen.getByTestId('story-stamp')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(STORY_KEY)!).geo[2]).toBe('ვცხოვრობ თბილისში.')
    fireEvent.click(screen.getByText('Дальше'))
    expect(screen.getByTestId('game-end')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  }, 30_000)
})
