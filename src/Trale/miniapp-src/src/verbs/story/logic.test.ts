import { describe, it, expect } from 'vitest'
import { explainTyped, explainWrong, frameImages, gap, shuffled, usedForms, words } from './logic'
import { wordOrderVerdict } from '../wordOrder'
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

  it('explains a wrong form with plain Russian phrases — what it means and what is needed — without tense names', () => {
    const iGo = asked.options[1]

    expect(explainWrong(iGo, bus.target)).toBe('მივდივარ — это «я иду». А здесь нужно «я буду идти».')
    expect(explainWrong(iGo, home.target)).toBe('მივდივარ — это «я иду». А здесь нужно «он шёл» (один раз · сделано).')
  })

  it('explains a typed word from its parse: this verb, another verb, or not a known word', () => {
    const hit = (verbId: string, title: string, ru: string, meaning?: string): VerbFormHitDto =>
      ({ form: 'x', verbId, title, ru, tense: 'aorist', person: 0, meaning })

    expect(explainTyped('წავედი', [hit('მიდის', 'სვლა', 'идти, уходить', 'я шёл / шла')], story, bus.target))
      .toBe('წავედი — это «я шёл / шла». А здесь нужно «я буду идти».')
    expect(explainTyped('ვწერ', [hit('წერს', 'წერა', 'писать')], story, bus.target))
      .toBe('ვწერ — это слово другого глагола: წერა (писать). Здесь нужно «я буду идти».')
    expect(explainTyped('წავა', [], story, bus.target))
      .toBe('Слова წავა в базе глаголов нет — возможно, опечатка. Здесь нужно «я буду идти».')
  })

  it('falls back to the person and a plain name of the time when the base has no phrase', () => {
    expect(explainWrong({ form: 'მიდის', tense: 'present', person: 2 }, { form: 'წავალ', tense: 'future', person: 0 }))
      .toBe('მიდის — это «он · сейчас». А здесь нужно «я · будущее».')
  })

  it('never hands out the words already in the source order', () => {
    const keepsOrder = () => 0.999 // такой «случай» оставил бы порядок как есть
    expect(shuffled(3, keepsOrder)).toEqual([1, 2, 0])
    expect(shuffled(1, keepsOrder)).toEqual([0])
    for (let i = 0; i < 50; i++) expect([...shuffled(4)].sort()).toEqual([0, 1, 2, 3])
  })

  it('tells the source order from another order of the same words (shared rule with the ladder)', () => {
    const source = words(home.ka)

    expect(wordOrderVerdict(source, home.ka)).toBe('exact')
    expect(wordOrderVerdict([...source].reverse(), home.ka)).toBe('order')
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
