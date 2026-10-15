import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
// @ts-ignore — тесты идут в Node, а типов Node в мини-аппе нет
import { existsSync } from 'node:fs'
import LetterIntro from './LetterIntro'
import { INTROS, introOf, transcriptionOf } from './letters'
import { WORD_AUDIO } from '../games/data'
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

  it('has a recording of every intro word (not of the letter name) in public/audio', () => {
    const cwd = (globalThis as any).process.cwd()
    for (const i of INTROS) {
      const url = WORD_AUDIO[i.word]
      expect(url, i.word).toBeTruthy()
      expect(url.startsWith('/audio/alphabet/'), url).toBe(false)
      expect(existsSync(`${cwd}/public${url}`), url).toBe(true)
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
  let played: string[]
  beforeEach(() => {
    played = []
    setMuted(false)
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      played.push(this.src); return Promise.resolve()
    })
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  })
  afterEach(() => vi.useRealTimers())

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

  it('plays the word once when the letter appears — not again while writing it — and again only on «послушать»', async () => {
    vi.useFakeTimers()
    render(<LetterIntro letter="ს" index={0} count={3} fraction={0} onExit={() => {}} onDone={() => {}} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(50) })
    const touch = () => screen.getByTestId('intro-touch')
    // Без холста буква «проявляется» с первого касания (покрывать нечего).
    fireEvent.pointerDown(touch(), { pointerId: 1, clientX: 10, clientY: 10, buttons: 1 })
    expect(played).toHaveLength(0)
    await act(async () => { await vi.advanceTimersByTimeAsync(800) })
    expect(played.filter(u => u.endsWith('/audio/alphabet-words/sazamtro.m4a'))).toHaveLength(1)
    expect(screen.getByTestId('intro-stage').dataset.phase).toBe('demo')
    expect(screen.getByText('Как пишется')).toBeTruthy()
    await act(async () => { await vi.advanceTimersByTimeAsync(800) })
    expect(screen.getByTestId('intro-stage').dataset.phase).toBe('trace')
    expect(screen.getByText('Теперь ты')).toBeTruthy()
    // «ещё раз показать» — снова перо, без звука.
    fireEvent.click(screen.getByTestId('intro-replay'))
    await act(async () => { await vi.advanceTimersByTimeAsync(800) })
    fireEvent.pointerDown(touch(), { pointerId: 2, clientX: 20, clientY: 20, buttons: 1 })
    await act(async () => { await vi.advanceTimersByTimeAsync(800) })
    expect(screen.getByTestId('intro-caption')).toBeTruthy()
    expect(played).toHaveLength(1)
    fireEvent.click(screen.getByTestId('intro-listen'))
    expect(played).toHaveLength(2)
    setMuted(true)
    fireEvent.click(screen.getByTestId('intro-listen'))
    expect(played).toHaveLength(2)
    setMuted(false)
  })

  it('skipping plays the word once too', () => {
    render(<LetterIntro letter="ქ" index={0} count={3} fraction={0} onExit={() => {}} onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('intro-skip'))
    expect(played).toHaveLength(1)
    expect(played[0].endsWith('/audio/alphabet-words/kva.m4a')).toBe(true)
  })

  it('highlights every place of the letter in the word and shows the one-line hint for a look-alike letter', () => {
    render(<LetterIntro letter="ქ" index={2} count={3} fraction={0} onExit={() => {}} onDone={() => {}} />)
    fireEvent.click(screen.getByTestId('intro-skip'))
    expect(screen.getByTestId('intro-word').textContent).toBe('ქვა')
    expect(screen.getByTestId('intro-caption').textContent).toContain('с выдохом')
  })
})

describe('how a letter is written', () => {
  it('has a vector glyph and writing medians for all 33 letters; the medians sit on the glyph, in the scene box', async () => {
    const { GLYPHS } = await import('./glyphs')
    const { MEDIANS, MEDIAN_MASK } = await import('./medians')
    const letters = new Set(INTROS.map(i => i.letter))
    expect(new Set(Object.keys(GLYPHS))).toEqual(letters)
    expect(new Set(Object.keys(MEDIANS))).toEqual(letters)
    expect(MEDIAN_MASK).toBeGreaterThanOrEqual(12)
    for (const [l, m] of Object.entries(MEDIANS)) {
      expect(['high', 'medium', 'low']).toContain(m.confidence)
      expect(GLYPHS[l].startsWith('M'), l).toBe(true)
      for (const st of m.strokes) {
        expect(st.length, l).toBeGreaterThanOrEqual(5)
        for (const [x, y] of st) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(100); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(100) }
      }
    }
    // Порядок по таблице письма: დ, ლ, ღ — хвост, потом горбы; რ, ქ, ყ, ჭ, ჯ — по два штриха; ჟ — один (прописи Чаганавы).
    for (const l of ['დ', 'ლ', 'ღ', 'რ', 'ქ', 'ყ', 'ჭ', 'ჯ']) expect(MEDIANS[l].strokes.length, l).toBe(2)
    expect(MEDIANS['ჟ'].strokes.length).toBe(1)
    expect(MEDIANS['ა'].strokes.length).toBe(1)
  })

  it('counts the finger only along the pen path, in order and direction, and forgives small misses', async () => {
    const { PathTrace } = await import('./paint')
    const line = (x0: number, x1: number, y: number) => Array.from({ length: 11 }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / 10, y }))
    // Против направления — не засчитывается.
    const back = new PathTrace([line(0, 100, 0)])
    back.advance({ x: 100, y: 0 }, { x: 0, y: 0 }, 8)
    expect(back.fraction).toBeLessThan(0.2)
    // По направлению, чуть мимо — засчитывается.
    const fwd = new PathTrace([line(0, 100, 0)])
    fwd.advance({ x: 0, y: 4 }, { x: 100, y: 5 }, 8)
    expect(fwd.fraction).toBe(1)
    // Второй штрих — только после первого и от своего начала.
    const two = new PathTrace([line(0, 100, 0), line(0, 100, 50)])
    two.advance({ x: 0, y: 50 }, { x: 100, y: 50 }, 8)
    expect(two.fraction).toBe(0)
    two.advance({ x: 0, y: 0 }, { x: 100, y: 0 }, 8)
    expect(two.stroke).toBe(1)
    two.advance({ x: 0, y: 50 }, { x: 100, y: 50 }, 8)
    expect(two.fraction).toBe(1)
  })
})
