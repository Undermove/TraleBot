import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { OptionButton } from './GameShell'
import { SentenceBox } from '../session/quizParts'
import { CATALOG } from '../testing/catalog'
import { cyr } from '../types'

// Варианты ответа в играх («Машина времени», «Косточки», фраза в комиксе): под грузинским словом —
// кириллическая транскрипция, чтобы играть мог и тот, кто ещё не читает буквы.

const verb = CATALOG[0]
const form = verb.tenses.present![0][0]

describe('OptionButton', () => {
  it('shows the Cyrillic transcription under a Georgian word and still answers a tap', () => {
    const onClick = vi.fn()
    render(<OptionButton onClick={onClick}>{form}</OptionButton>)

    const button = screen.getByRole('button')
    expect(button.textContent).toBe(form + cyr(form))
    expect(screen.getByTestId('option-cyr').textContent).toBe(cyr(form))
    expect(screen.getByTestId('option-cyr').textContent).not.toMatch(/[a-zა-ჰ]/i)
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('adds nothing to an option that is not a Georgian word or brings its own content', () => {
    render(<><OptionButton onClick={vi.fn()} geo={false}>я есть</OptionButton><OptionButton onClick={vi.fn()}><b>{form}</b></OptionButton></>)

    expect(screen.queryByTestId('option-cyr')).toBeNull()
  })
})

describe('SentenceBox', () => {
  it('gives the example sentence with its transcription and translation', () => {
    const sentence = verb.sentences[0]
    render(<SentenceBox sentence={sentence} />)

    expect(screen.getByTestId('sentence-cyr').textContent).toBe(cyr(sentence.ka))
    expect(screen.getByText(sentence.ru)).toBeTruthy()
  })
})
