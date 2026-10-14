import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import LetterIntro from './LetterIntro'
import { INTROS, introOf, wordWithLetter } from './letters'
import { Coverage } from './paint'
import { LESSON_LETTERS, SOUNDS } from '../games/data'

const LATIN = /[a-z]/i
const TERMS = /абруптив|аспир|придыхан|смычн|фрикатив|глухо|звонк/i

describe('letter intros', () => {
  it('has a word and a surface for each of the 33 letters', () => {
    expect(new Set(INTROS.map(i => i.letter))).toEqual(new Set(LESSON_LETTERS.flat()))
    expect(INTROS).toHaveLength(33)
  })

  it('matches the sound of the lesson theory and starts the word with that sound', () => {
    for (const i of INTROS) {
      expect(i.sound, i.letter).toBe(SOUNDS[i.letter].plain)
      expect(i.word.startsWith(i.sound), i.word).toBe(true)
    }
    expect(wordWithLetter(introOf('ა')!)).toBe('აрбуз')
    expect(wordWithLetter(introOf('ძ')!)).toBe('ძюдо')
  })

  it('explains every look-alike sound in one line, without terms or Latin', () => {
    for (const l of ['ქ', 'კ', 'თ', 'ტ', 'ფ', 'პ', 'ჩ', 'ჭ', 'ც', 'წ', 'ღ', 'ყ', 'ჰ']) expect(introOf(l)!.hint, l).toBeTruthy()
    for (const i of INTROS) {
      const text = [i.word, i.action, i.hint ?? ''].join(' ')
      expect(LATIN.test(text), text).toBe(false)
      expect(TERMS.test(text), text).toBe(false)
    }
  })
})

describe('Coverage', () => {
  it('counts the letter points under the finger, filling gaps along a fast stroke', () => {
    const pts = Array.from({ length: 10 }, (_, i) => ({ x: i * 10, y: 0 }))
    const c = new Coverage(pts)
    c.mark(0, 0, 5)
    expect(c.fraction).toBeCloseTo(0.1)
    c.stroke({ x: 0, y: 0 }, { x: 90, y: 0 }, 6)
    expect(c.fraction).toBe(1)
  })

  it('does not count points far from the finger', () => {
    const c = new Coverage([{ x: 0, y: 0 }, { x: 100, y: 100 }])
    c.stroke({ x: 0, y: 0 }, { x: 10, y: 0 }, 8)
    expect(c.fraction).toBe(0.5)
  })
})

describe('LetterIntro', () => {
  it('starts with the surface to wipe and can be skipped to the caption', () => {
    const onDone = vi.fn()
    render(<LetterIntro letter="ა" index={0} count={3} fraction={0} onExit={() => {}} onDone={onDone} />)
    expect(screen.getByText('Срежь корку арбуза')).toBeTruthy()
    expect(screen.getByText(/новая буква · 1 из 3/)).toBeTruthy()
    expect(screen.getByTestId('intro-stage').dataset.phase).toBe('reveal')

    fireEvent.click(screen.getByTestId('intro-skip'))
    expect(screen.getByTestId('intro-caption').textContent).toContain('звук «а»')
    expect(screen.getByTestId('intro-caption').textContent).toContain('აрбуз')
    fireEvent.click(screen.getByText('дальше →'))
    expect(onDone).toHaveBeenCalled()
  })

  it('shows the one-line hint for a look-alike letter', () => {
    render(<LetterIntro letter="ქ" index={2} count={3} fraction={0} onExit={() => {}} onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('intro-skip'))
    expect(screen.getByTestId('intro-caption').textContent).toContain('с выдохом')
  })
})
