import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  DAILY_PHRASES,
  NAME_EVERY_DAYS,
  SaysMemory,
  dayKey,
  loadSaysMemory,
  markSaid,
  nextSay,
  phraseOfDay,
  pickOpening,
  resetSaysMemory,
  saveSaysMemory,
} from './bomboraSays'

const TODAY = '2026-10-11'
const plusDays = (n: number) => dayKey(new Date(2026, 9, 11 + n))

/** Профиль открыли: что сказала Бомбора и что она после этого помнит. */
function open(memory: SaysMemory, today: string, hasName = true) {
  const said = pickOpening(memory, today, hasName)
  return { said, memory: markSaid(memory, said, today) }
}

describe('с чего Бомбора начинает', () => {
  it('в первый заход за день говорит фразу дня', () => {
    expect(pickOpening({ nameDay: TODAY }, plusDays(1), true)).toBe('phrase')
  })

  it('при повторном заходе в тот же день подбадривает', () => {
    const first = open({ nameDay: TODAY }, plusDays(1))
    expect(first.said).toBe('phrase')
    expect(open(first.memory, plusDays(1)).said).toBe('cheer')
    expect(open(first.memory, plusDays(1)).said).toBe('cheer')
  })

  it('в самый первый заход называет имя, а фразу дня оставляет на следующий', () => {
    const first = open({}, TODAY)
    expect(first.said).toBe('name')
    const second = open(first.memory, TODAY)
    expect(second.said).toBe('phrase')
    expect(open(second.memory, TODAY).said).toBe('cheer')
  })

  it(`про имя вспоминает не чаще, чем раз в ${NAME_EVERY_DAYS} дня`, () => {
    let memory: SaysMemory = { nameDay: TODAY, phraseDay: TODAY }
    for (let day = 1; day < NAME_EVERY_DAYS; day++) {
      const first = open(memory, plusDays(day))
      const second = open(first.memory, plusDays(day))
      expect([first.said, second.said]).toEqual(['phrase', 'cheer'])
      memory = second.memory
    }
    // Срок подошёл: сначала всё равно фраза дня, имя — в следующий заход, и снова пауза.
    const due = plusDays(NAME_EVERY_DAYS)
    const first = open(memory, due)
    const second = open(first.memory, due)
    const third = open(second.memory, due)
    expect([first.said, second.said, third.said]).toEqual(['phrase', 'name', 'cheer'])
    expect(open(third.memory, plusDays(NAME_EVERY_DAYS + 1)).said).toBe('phrase')
    expect(open(markSaid(third.memory, 'phrase', plusDays(NAME_EVERY_DAYS + 1)), plusDays(NAME_EVERY_DAYS + 1)).said).toBe('cheer')
  })

  it('человеку без имени про имя не говорит никогда', () => {
    const first = open({}, TODAY, false)
    expect(first.said).toBe('phrase')
    expect(open(first.memory, TODAY, false).said).toBe('cheer')
    expect(open({ phraseDay: plusDays(30), nameDay: TODAY }, plusDays(30), false).said).toBe('cheer')
  })

  it('без памяти начинает с фразы дня, а не с имени', () => {
    expect(pickOpening({}, TODAY, true, false)).toBe('phrase')
  })
})

describe('нажатие листает реплики по кругу', () => {
  it('подбадривание → фраза дня → имя → подбадривание', () => {
    expect(nextSay('cheer', true)).toBe('phrase')
    expect(nextSay('phrase', true)).toBe('name')
    expect(nextSay('name', true)).toBe('cheer')
  })

  it('без имени — подбадривание ↔ фраза дня', () => {
    expect(nextSay('cheer', false)).toBe('phrase')
    expect(nextSay('phrase', false)).toBe('cheer')
  })
})

describe('фраза дня', () => {
  it('одна на весь день и меняется на следующий', () => {
    expect(phraseOfDay(TODAY)).toBe(phraseOfDay(TODAY))
    expect(phraseOfDay(plusDays(1))).not.toBe(phraseOfDay(TODAY))
  })

  it('за круг показывает все фразы', () => {
    const seen = new Set(DAILY_PHRASES.map((_, i) => phraseOfDay(plusDays(i))))
    expect(seen.size).toBe(DAILY_PHRASES.length)
  })

  it('день считается по часам устройства', () => {
    expect(dayKey(new Date(2026, 0, 5, 0, 30))).toBe('2026-01-05')
    expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})

describe('память о сказанном', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSaysMemory()
  })
  afterEach(() => vi.restoreAllMocks())

  it('переживает перезапуск мини-аппа', () => {
    saveSaysMemory({ phraseDay: TODAY, nameDay: TODAY })
    resetSaysMemory()
    expect(loadSaysMemory()).toEqual({ memory: { phraseDay: TODAY, nameDay: TODAY }, remembered: true })
  })

  it('мусор в хранилище читается как «ничего не слышал»', () => {
    localStorage.setItem('bombora_profile_says', '{"phraseDay": 5, "nameDay": null}')
    expect(loadSaysMemory()).toEqual({ memory: {}, remembered: true })
    localStorage.setItem('bombora_profile_says', 'not json')
    expect(loadSaysMemory()).toEqual({ memory: {}, remembered: false })
  })

  it('без хранилища не падает и не повторяется, пока мини-апп открыт', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })

    const said: string[] = []
    for (let i = 0; i < 3; i++) {
      const { memory, remembered } = loadSaysMemory()
      const kind = pickOpening(memory, TODAY, true, remembered)
      said.push(kind)
      saveSaysMemory(markSaid(memory, kind, TODAY))
    }
    expect(said).toEqual(['phrase', 'name', 'cheer'])
  })
})
