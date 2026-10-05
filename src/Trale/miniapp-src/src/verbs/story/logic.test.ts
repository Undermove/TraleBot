import { describe, it, expect } from 'vitest'
import { explainTyped, explainWrong, frameImages, gap, sameAsSource, shuffled, usedForms, words } from './logic'
import { storyFixture as story } from './fixture'
import type { VerbFormHitDto } from '../types'

const [asked, bus, home] = story.frames

describe('story logic', () => {
  it('splits a line into Georgian words without punctuation', () => {
    expect(words(bus.ka)).toEqual(['არა', 'მე', 'ავტობუსით', 'წავალ'])
  })

  it('cuts the line around the target form, keeping the punctuation', () => {
    expect(gap(asked.ka, 'მიდიხარ')).toEqual({ before: 'შენ სად ', after: ' ახლა?' })
    expect(gap(bus.ka, 'წავალ')).toEqual({ before: 'არა, მე ავტობუსით ', after: '.' })
  })

  it('explains a wrong form by its tense and person, and names only what differs', () => {
    const samePerson = explainWrong({ form: 'მივდივარ', tense: 'present', person: 0 }, bus.target)
    const sameTense = explainWrong({ form: 'მივდივარ', tense: 'present', person: 0 }, asked.target)
    const bothDiffer = explainWrong({ form: 'მიდის', tense: 'present', person: 2 }, bus.target)

    expect(samePerson).toBe('მივდივარ — это настоящее (делаю), «я». Лицо то самое, а время здесь — будущее (сделаю).')
    expect(sameTense).toBe('მივდივარ — это настоящее (делаю), «я». Время то самое, а лицо здесь — «ты».')
    expect(bothDiffer).toBe('მიდის — это настоящее (делаю), «он». А здесь нужно: будущее (сделаю), «я».')
  })

  it('explains a typed word from its parse: this verb, another verb, or not a known form', () => {
    const hit = (verbId: string, title: string, ru: string): VerbFormHitDto =>
      ({ form: 'x', verbId, title, ru, tense: 'aorist', person: 0 })

    expect(explainTyped('წავედი', [hit('მიდის', 'სვლა', 'идти, уходить')], story, bus.target))
      .toBe('წავედი — это аорист (сделал — прошедшее с результатом), «я». Лицо то самое, а время здесь — будущее (сделаю).')
    expect(explainTyped('ვწერ', [hit('წერს', 'წერა', 'писать')], story, bus.target))
      .toBe('ვწერ — это форма другого глагола: წერა (писать). Здесь нужно: будущее, «я».')
    expect(explainTyped('წავა', [], story, bus.target))
      .toBe('Слова წავა в базе глаголов нет — возможно, опечатка. Здесь нужно: будущее, «я».')
  })

  it('never hands out the words already in the source order', () => {
    const keepsOrder = () => 0.999 // такой «случай» оставил бы порядок как есть
    expect(shuffled(3, keepsOrder)).toEqual([1, 2, 0])
    expect(shuffled(1, keepsOrder)).toEqual([0])
    for (let i = 0; i < 50; i++) expect([...shuffled(4)].sort()).toEqual([0, 1, 2, 3])
  })

  it('accepts a built phrase only when it matches the source word for word', () => {
    expect(sameAsSource(['ის', 'წავიდა', 'სახლში'], home.ka)).toBe(true)
    expect(sameAsSource(['სახლში', 'ის', 'წავიდა'], home.ka)).toBe(false)
  })

  it('lists each form used in the story once', () => {
    const twice = [asked, bus, { ...home, target: bus.target }]
    expect(usedForms(twice).map(t => t.form)).toEqual(['მიდიხარ', 'წავალ'])
  })

  it('builds frame urls under the hashed folder', () => {
    expect(frameImages(story, asked)).toEqual({
      placeholder: '/stories/go-fishing/d404709ff4/f1-ph.webp',
      small: '/stories/go-fishing/d404709ff4/f1-480.webp',
      large: '/stories/go-fishing/d404709ff4/f1-800.webp'
    })
  })
})
