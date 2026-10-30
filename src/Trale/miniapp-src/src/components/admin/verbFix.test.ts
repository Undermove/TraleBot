import { describe, it, expect } from 'vitest'
import { parseVerbFix } from './verbFix'

const fix = (text: string) => {
  const r = parseVerbFix(text)
  if ('error' in r) throw new Error(r.error)
  return r.fix
}
const error = (text: string) => {
  const r = parseVerbFix(text)
  return 'error' in r ? r.error : null
}

describe('parseVerbFix', () => {
  it('reads tenses by their names on the screen, what to confirm as is and the approval', () => {
    const f = fix(`глагол: ეკითხება
Будущее: ვკითხავ ჰკითხავ ჰკითხავს ვკითხავთ ჰკითხავთ ჰკითხავენ
Прошедшее: сделал: ვკითხე ჰკითხე ჰკითხა ვკითხეთ ჰკითხეთ ჰკითხეს
подтвердить: Сейчас, Прошедшее: делал
глагол проверен`)
    expect(f.lemma).toBe('ეკითხება')
    expect(f.edits).toEqual([
      { tense: 'future', cells: ['ვკითხავ', 'ჰკითხავ', 'ჰკითხავს', 'ვკითხავთ', 'ჰკითხავთ', 'ჰკითხავენ'] },
      { tense: 'aorist', cells: ['ვკითხე', 'ჰკითხე', 'ჰკითხა', 'ვკითხეთ', 'ჰკითხეთ', 'ჰკითხეს'] }
    ])
    expect(f.confirm).toEqual(['present', 'imperfect'])
    expect(f.approve).toBe(true)
  })

  it('takes tense keys too and a dash for an empty cell', () => {
    expect(fix('optative: ვკითხო — ჰკითხოს ვკითხოთ ჰკითხოთ ჰკითხონ').edits[0])
      .toEqual({ tense: 'optative', cells: ['ვკითხო', null, 'ჰკითხოს', 'ვკითხოთ', 'ჰკითხოთ', 'ჰკითხონ'] })
  })

  it('says what is wrong instead of guessing', () => {
    expect(error('Будущее: ვკითხავ ჰკითხავ')).toBe('Будущее: нужно шесть форм (я, ты, он, мы, вы, они), а их 2')
    expect(error('Будущее: ვკითხავ ჰკითხავ ჰკითხავს ვკითხავთ ჰკითხავთ vkitkhaven')).toBe('Будущее: «vkitkhaven» — не слово грузинскими буквами')
    expect(error('Потом: ვკითხავ ჰკითხავ ჰკითხავს ვკითხავთ ჰკითხავთ ჰკითხავენ')).toBe('нет такого времени: «Потом»')
    expect(error('подтвердить: future\nfuture: ვკითხავ ჰკითხავ ჰკითხავს ვკითხავთ ჰკითხავთ ჰკითხავენ')).toBe('Будущее: и исправить, и подтвердить как есть — выбери одно')
    expect(error('привет')).toBe('не понял строку «привет»')
    expect(error('\n\n')).toBe('в тексте нет ни одного исправления')
  })
})
