import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import VerbTranslationCard from './VerbTranslationCard'
import { verbRu } from '../testing/catalog'
import { formCard, infinitiveCard } from '../testing/translationCard'
import { cyr } from '../types'

// Карточка глагола в ответе перевода: русский инфинитив — название действия и главные формы,
// грузинская форма — что она значит и от какого глагола. Формы — из каталога.

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}]/u
const TERMS = ['масдар', 'аорист', 'имперфект', 'оптатив', 'конъюнктив', 'перфект']

function show(card: Parameters<typeof VerbTranslationCard>[0]['card'], definition: string, alreadySaved = false) {
  const onOpen = vi.fn()
  render(<VerbTranslationCard card={card} word={card.text} definition={definition} alreadySaved={alreadySaved} onOpen={onOpen} />)
  return onOpen
}

function plainWordsOnly() {
  const text = screen.getByTestId('verb-translation-card').textContent!
  expect(text).not.toMatch(/[A-Za-z]/)
  expect(text).not.toMatch(EMOJI)
  TERMS.forEach(term => expect(text.toLowerCase()).not.toContain(term))
}

describe('VerbTranslationCard', () => {
  it('a Russian infinitive shows the name of the action and the key forms, each with Cyrillic and its Russian phrase', () => {
    const walk = verbRu('ходить')
    const onOpen = show(infinitiveCard('ходить'), walk.title)

    expect(screen.getByTestId('verb-card-head').textContent).toContain('«ходить»')
    const name = screen.getByTestId('verb-card-action-name')
    expect(name.textContent).toContain('название действия')
    expect(name.textContent).toContain(walk.title)
    expect(name.textContent).toContain(cyr(walk.title))

    const lines = screen.getAllByTestId('verb-card-line').map(l => l.textContent!)
    expect(lines).toHaveLength(3) // у «ходить» в каталоге нет будущего
    expect(lines[0]).toContain('я хожу')
    expect(lines[0]).toContain(walk.tenses.present![0][0])
    expect(lines[0]).toContain(cyr(walk.tenses.present![0][0]))
    expect(lines[1]).toContain('он ходит')
    expect(lines[1]).toContain(walk.id)
    expect(lines[2]).toContain('я ходил(а)')

    expect(screen.getByTestId('verb-card-saved').textContent).toContain(`В словарь записано: ходить — ${walk.title}`)
    plainWordsOnly()

    const open = screen.getByTestId('verb-card-open')
    expect(open.textContent).toContain('Открыть в глаголах')
    expect(open.className).toContain('min-h-[44px]')
    fireEvent.click(open)
    expect(onOpen).toHaveBeenCalledWith(walk.id, undefined)
  })

  it('«быть» shows the name of its action, and the dictionary keeps it', () => {
    const be = verbRu('быть')
    expect(be.title).not.toBe(be.id)
    show(infinitiveCard('быть'), be.title, true)

    const name = screen.getByTestId('verb-card-action-name').textContent!
    expect(name).toContain(be.title)
    expect(name).toContain(cyr(be.title))
    const lines = screen.getAllByTestId('verb-card-line').map(l => l.textContent!)
    expect(lines.map(l => l.replace(/[ა-ჰ].*$/, ''))).toEqual(['я есть', 'он есть', 'я буду', 'я был(а)'])
    expect(screen.getByTestId('verb-card-saved').textContent).toContain(`Уже в словаре: быть — ${be.title}`)
    plainWordsOnly()
  })

  it('a verb without a name of the action in the base shows its forms and no made-up name', () => {
    // В каталоге таких больше нет; у глагола, добавленного на лету, заголовок может повторять словарную форму.
    const dance = verbRu('танцевать')
    show(infinitiveCard('танцевать', [{ ...dance, title: dance.id }]), dance.id)

    expect(screen.queryByTestId('verb-card-action-name')).toBeNull()
    expect(screen.getAllByTestId('verb-card-line')[0].textContent).toContain('я танцую')
    expect(screen.getByTestId('verb-card-saved').textContent).toContain(`В словарь записано: танцевать — ${dance.id}`)
    plainWordsOnly()
  })

  it('an infinitive with several verbs lists each with its own button', () => {
    const card = infinitiveCard('открывать')
    expect(card.verbs).toHaveLength(2)
    const onOpen = show(card, card.verbs[0].actionName!)

    const sections = screen.getAllByTestId('verb-card-section')
    expect(sections).toHaveLength(2)
    sections.forEach((section, n) => {
      expect(within(section).getByTestId('verb-card-verb').textContent).toContain(card.verbs[n].actionName!)
      expect(within(section).getAllByTestId('verb-card-line')[0].textContent).toContain('я открываю')
    })
    fireEvent.click(within(sections[1]).getByTestId('verb-card-open'))
    expect(onOpen).toHaveBeenCalledWith(card.verbs[1].verbId, undefined)
    plainWordsOnly()
  })

  it('a Georgian form says what it means, what form it is in plain words, and whose it is', () => {
    const find = verbRu('находить')
    const form = find.tenses.present![0][0]
    const onOpen = show(formCard(find, [['present', 0]]), 'я нахожу')

    const head = screen.getByTestId('verb-card-head').textContent!
    expect(head).toContain(form)
    expect(head).toContain(cyr(form))
    const reading = screen.getByTestId('verb-card-reading').textContent!
    expect(reading).toContain('«я нахожу»')
    expect(reading).toContain('я, настоящее время')
    const verb = screen.getByTestId('verb-card-verb').textContent!
    expect(verb).toContain('«находить»')
    expect(verb).toContain(find.title)
    plainWordsOnly()

    fireEvent.click(screen.getByTestId('verb-card-open'))
    expect(onOpen).toHaveBeenCalledWith(find.id, { tense: 'present', person: 0 })
  })

  it('a form with two readings shows both; the form after «надо» is named by what it says', () => {
    const be = verbRu('быть')
    expect(be.tenses.aorist![2][0]).toBe(be.tenses.optative![1][0])
    show(formCard(be, [['aorist', 2], ['optative', 1]]), 'он был')

    expect(screen.getByTestId('verb-card-head').textContent).toContain('у этого слова несколько значений')
    const readings = screen.getAllByTestId('verb-card-reading').map(r => r.textContent!)
    expect(readings[0]).toContain('«он был»')
    expect(readings[0]).toContain('он/она, прошедшее время: сделал один раз')
    expect(readings[1]).toContain('«тебе надо быть»')
    expect(readings[1]).toContain('«чтобы ты…» — так говорят после «надо», «хочу»')
    const verb = screen.getByTestId('verb-card-verb').textContent!
    expect(verb).toContain('название действия')
    expect(verb).toContain(be.title)
    plainWordsOnly()
  })
})
