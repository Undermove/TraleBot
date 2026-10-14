import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
// @ts-ignore — тесты идут в Node, а типов Node в мини-аппе нет
import { existsSync } from 'node:fs'
import LetterIntro from './LetterIntro'
import { INTROS, introOf, letterAudio, transcriptionOf } from './letters'
import { Coverage } from './paint'
import { LESSON_LETTERS, SOUNDS } from '../games/data'
import { isGeorgian } from '../games/logic'
import { setMuted } from '../games/fx'

const LATIN = /[a-z]/i
const TERMS = /абруптив|аспир|придыхан|смычн|фрикатив|глухо|звонк/i

describe('letter intros', () => {
  it('has a Georgian word and a surface for each of the 33 letters', () => {
    expect(new Set(INTROS.map(i => i.letter))).toEqual(new Set(LESSON_LETTERS.flat()))
    expect(INTROS).toHaveLength(33)
    expect(new Set(INTROS.map(i => i.word)).size).toBe(33)
  })

  it('every word is Georgian, contains its letter (most start with it) and the sound matches the lesson theory', () => {
    for (const i of INTROS) {
      expect(i.sound, i.letter).toBe(SOUNDS[i.letter].plain)
      expect([...i.word].every(isGeorgian), i.word).toBe(true)
      expect(i.word.includes(i.letter), `${i.word} has ${i.letter}`).toBe(true)
    }
    // Слова не про русский звук: арбуз — это ს (საზამთრო), а не ა.
    expect(introOf('ს')!.word).toBe('საზამთრო')
    expect(INTROS.filter(i => i.word.startsWith(i.letter)).length).toBe(33)
  })

  it('every entry names the dictionary page where the word and its meaning were checked', () => {
    for (const i of INTROS) {
      expect(i.source, i.letter).toMatch(/^https:\/\/(en|ka)\.wiktionary\.org\/wiki\//)
      expect(decodeURIComponent(i.source).endsWith(`/${i.word}`), i.source).toBe(true)
    }
  })

  it('shows the sound in Cyrillic and the meaning in Russian — no Latin, no terms', () => {
    expect(transcriptionOf(introOf('ს')!)).toBe('сазамтро')
    for (const i of INTROS) {
      const text = [transcriptionOf(i), i.ru, i.action, i.hint ?? ''].join(' ')
      expect(LATIN.test(text), text).toBe(false)
      expect(TERMS.test(text), text).toBe(false)
      expect(i.ru.length, i.letter).toBeGreaterThan(1)
    }
    for (const l of ['ქ', 'კ', 'თ', 'ტ', 'ფ', 'პ', 'ჩ', 'ჭ', 'ც', 'წ', 'ღ', 'ყ', 'ჰ']) expect(introOf(l)!.hint, l).toBeTruthy()
  })

  it('has a recording for every letter in public/audio/alphabet', () => {
    const cwd = (globalThis as any).process.cwd()
    for (const i of INTROS) {
      const url = letterAudio(i.letter)
      expect(url, i.letter).toBeTruthy()
      expect(existsSync(`${cwd}/public${url}`), url!).toBe(true)
    }
    expect(new Set(INTROS.map(i => letterAudio(i.letter))).size).toBe(33)
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
  let played: string[]
  beforeEach(() => {
    played = []
    setMuted(false)
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      played.push(this.src); return Promise.resolve()
    })
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  })

  it('starts with the surface of the Georgian word and shows the word with the letter after it', () => {
    const onDone = vi.fn()
    render(<LetterIntro letter="ს" index={2} count={3} fraction={0} onExit={() => {}} onDone={onDone} />)
    expect(screen.getByText('Срежь корку арбуза')).toBeTruthy()
    expect(screen.getByText(/новая буква · 3 из 3/)).toBeTruthy()
    expect(screen.getByTestId('intro-stage').dataset.phase).toBe('reveal')

    fireEvent.click(screen.getByTestId('intro-skip'))
    expect(screen.getByTestId('intro-word').textContent).toBe('საზამთრო')
    expect([...screen.getByTestId('intro-word').querySelectorAll('[data-own="yes"]')].map(e => e.textContent)).toEqual(['ს'])
    expect(screen.getByTestId('intro-meaning').textContent).toBe('сазамтро — арбуз')
    expect(screen.getByTestId('intro-caption').textContent).toContain('ს — звук «с»')
    fireEvent.click(screen.getByText('дальше →'))
    expect(onDone).toHaveBeenCalled()
  })

  it('plays the recording of the letter when it appears and on «послушать», but not when the sound is off', () => {
    render(<LetterIntro letter="ა" index={0} count={3} fraction={0} onExit={() => {}} onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('intro-skip'))
    expect(played.some(u => u.endsWith('/audio/alphabet/a.m4a'))).toBe(true)
    const n = played.length
    fireEvent.click(screen.getByTestId('intro-listen'))
    expect(played.length).toBe(n + 1)
    setMuted(true)
    fireEvent.click(screen.getByTestId('intro-listen'))
    expect(played.length).toBe(n + 1)
    setMuted(false)
  })

  it('highlights every place of the letter in the word and shows the one-line hint for a look-alike letter', () => {
    render(<LetterIntro letter="ქ" index={2} count={3} fraction={0} onExit={() => {}} onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('intro-skip'))
    expect(screen.getByTestId('intro-word').textContent).toBe('ქვა')
    expect(screen.getByTestId('intro-caption').textContent).toContain('с выдохом')
  })
})
