import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LessonTheory from '../LessonTheory'
import type {
  AlphabetLetterDto,
  CatalogDto,
  ProgressState,
  TheoryBlockDto,
} from '../../types'

// Suppress the alphabet reveal overlay across tests — it fires on setTimeout for
// lesson 1 letters block and would race with our render assertions.
try {
  localStorage.setItem('bombora_kani_reveal_shown', '1')
} catch {}

function letter(l: string): AlphabetLetterDto {
  return {
    letter: l,
    name: `name-${l}`,
    translit: `t-${l}`,
    exampleGe: `ex-${l}`,
    exampleRu: `пример-${l}`,
  }
}

function makeCatalog(opts: {
  moduleId?: string
  lessonId?: number
  blocks: TheoryBlockDto[]
  extraLessons?: number
}): CatalogDto {
  const moduleId = opts.moduleId ?? 'alphabet-progressive'
  const lessonId = opts.lessonId ?? 1
  const lessons = [
    {
      id: lessonId,
      title: 'Первые буквы',
      short: 'L1',
      theory: {
        title: 'Первые буквы',
        goal: 'Запомнить первые буквы алфавита',
        blocks: opts.blocks,
      },
    },
  ]
  if (opts.extraLessons) {
    for (let i = 0; i < opts.extraLessons; i++) {
      lessons.push({
        id: lessonId + i + 1,
        title: `Урок ${lessonId + i + 1}`,
        short: `L${lessonId + i + 1}`,
        theory: { title: 't', goal: 'g', blocks: [] },
      })
    }
  }
  return {
    botUsername: 'TraleBot',
    miniAppEnabled: true,
    modules: [
      {
        id: moduleId,
        title: 'Алфавит',
        emoji: '🔤',
        description: 'Грузинский алфавит',
        lessons,
      },
    ],
  }
}

function makeProgress(overrides: Partial<ProgressState> = {}): ProgressState {
  return {
    xp: 0,
    streak: 0,
    completedLessons: {},
    lastPlayedDate: null,
    xpSpent: 0,
    totalTreatsGiven: 0,
    lastFedAtUtc: null,
    lastTreatIndex: null,
    ...overrides,
  }
}

describe('LessonTheory — alphabet-progressive L1 preview split', () => {
  it('shows first 3 letters up front and hides rest + other blocks in the "Остальные буквы" accordion', async () => {
    const user = userEvent.setup()
    const letters = ['ა', 'ბ', 'გ', 'დ', 'ე'].map(letter)
    const paragraph: TheoryBlockDto = {
      type: 'paragraph',
      text: 'Грузинский алфавит красив.',
    }
    const catalog = makeCatalog({
      blocks: [
        { type: 'letters', letters },
        paragraph,
      ],
      extraLessons: 1,
    })

    render(
      <LessonTheory
        catalog={catalog}
        moduleId="alphabet-progressive"
        lessonId={1}
        progress={makeProgress()}
        navigate={vi.fn()}
      />
    )

    // First 3 letters visible immediately.
    expect(screen.getByText('ა')).toBeInTheDocument()
    expect(screen.getByText('ბ')).toBeInTheDocument()
    expect(screen.getByText('გ')).toBeInTheDocument()

    // Rest is inside the closed accordion and not initially visible.
    expect(screen.queryByText('დ')).not.toBeInTheDocument()
    expect(screen.queryByText('ე')).not.toBeInTheDocument()
    expect(screen.queryByText(/Грузинский алфавит красив\./)).not.toBeInTheDocument()

    // Accordion labelled «📖 Остальные буквы» exists and is closed.
    const trigger = screen.getByRole('button', { name: /Остальные буквы/ })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    // Open the accordion.
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('დ')).toBeInTheDocument()
    expect(screen.getByText('ე')).toBeInTheDocument()
    expect(screen.getByText(/Грузинский алфавит красив\./)).toBeInTheDocument()
  })

  it('does not render the accordion when there is nothing to hide (letters ≤ 3 and no other blocks)', () => {
    const catalog = makeCatalog({
      blocks: [{ type: 'letters', letters: ['ა', 'ბ', 'გ'].map(letter) }],
    })

    render(
      <LessonTheory
        catalog={catalog}
        moduleId="alphabet-progressive"
        lessonId={1}
        progress={makeProgress()}
        navigate={vi.fn()}
      />
    )

    expect(screen.getByText('ა')).toBeInTheDocument()
    expect(screen.getByText('ბ')).toBeInTheDocument()
    expect(screen.getByText('გ')).toBeInTheDocument()
    // Neither accordion label should appear.
    expect(screen.queryByRole('button', { name: /Остальные буквы/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Объяснение/ })).not.toBeInTheDocument()
  })

  it('falls back to «📖 Объяснение» accordion when there is no letters block', async () => {
    const user = userEvent.setup()
    const paragraph: TheoryBlockDto = { type: 'paragraph', text: 'Только текст.' }
    const catalog = makeCatalog({
      blocks: [paragraph],
    })

    render(
      <LessonTheory
        catalog={catalog}
        moduleId="alphabet-progressive"
        lessonId={1}
        progress={makeProgress()}
        navigate={vi.fn()}
      />
    )

    // No preview letters → the paragraph is hidden inside «📖 Объяснение».
    expect(screen.queryByText(/Только текст\./)).not.toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: /Объяснение/ })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    expect(screen.getByText(/Только текст\./)).toBeInTheDocument()
  })

  it('alphabet-progressive lesson 2 first visit uses the «📖 Объяснение» accordion (preview split is L1-only)', () => {
    const letters = ['ვ', 'ზ', 'თ', 'ი'].map(letter)
    const paragraph: TheoryBlockDto = { type: 'paragraph', text: 'Продолжаем алфавит.' }
    // Lesson 2 is the target — put L1 as a stub with empty theory so module.lessons[0].id === 1.
    const catalog: CatalogDto = {
      botUsername: 'TraleBot',
      miniAppEnabled: true,
      modules: [
        {
          id: 'alphabet-progressive',
          title: 'Алфавит',
          emoji: '🔤',
          description: '',
          lessons: [
            { id: 1, title: 'L1', short: 'L1', theory: { title: 't', goal: 'g', blocks: [] } },
            {
              id: 2,
              title: 'Ещё буквы',
              short: 'L2',
              theory: {
                title: 'Ещё буквы',
                goal: 'g',
                blocks: [{ type: 'letters', letters }, paragraph],
              },
            },
          ],
        },
      ],
    }

    render(
      <LessonTheory
        catalog={catalog}
        moduleId="alphabet-progressive"
        lessonId={2}
        progress={makeProgress()}
        navigate={vi.fn()}
      />
    )

    // Preview split does NOT fire (that's L1-only) — everything is folded under
    // the plain «📖 Объяснение» accordion instead.
    letters.forEach((l) => expect(screen.queryByText(l.letter)).not.toBeInTheDocument())
    expect(screen.queryByText(/Продолжаем алфавит\./)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Остальные буквы/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Объяснение/ })).toBeInTheDocument()
  })

  it('renders the full layout when alphabet L1 is already completed (no first-visit gate)', () => {
    const letters = ['ა', 'ბ', 'გ', 'დ', 'ე'].map(letter)
    const paragraph: TheoryBlockDto = { type: 'paragraph', text: 'Уже пройдено.' }
    const catalog = makeCatalog({
      blocks: [{ type: 'letters', letters }, paragraph],
    })

    render(
      <LessonTheory
        catalog={catalog}
        moduleId="alphabet-progressive"
        lessonId={1}
        progress={makeProgress({ completedLessons: { 'alphabet-progressive': [1] } })}
        navigate={vi.fn()}
      />
    )

    letters.forEach((l) => expect(screen.getByText(l.letter)).toBeInTheDocument())
    expect(screen.getByText(/Уже пройдено\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Остальные буквы/ })).not.toBeInTheDocument()
  })

  it('shows «Поехали →» CTA on first visit and «к практике →» when lesson is completed', () => {
    const letters = ['ა', 'ბ', 'გ', 'დ', 'ე'].map(letter)
    const catalog = makeCatalog({
      blocks: [{ type: 'letters', letters }],
    })

    const { rerender } = render(
      <LessonTheory
        catalog={catalog}
        moduleId="alphabet-progressive"
        lessonId={1}
        progress={makeProgress()}
        navigate={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Поехали/i })).toBeInTheDocument()

    rerender(
      <LessonTheory
        catalog={catalog}
        moduleId="alphabet-progressive"
        lessonId={1}
        progress={makeProgress({ completedLessons: { 'alphabet-progressive': [1] } })}
        navigate={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /к практике/i })).toBeInTheDocument()
  })

  it('accordion body wires the letters block and other blocks together', async () => {
    const user = userEvent.setup()
    const letters = ['ა', 'ბ', 'გ', 'დ'].map(letter)
    const example: TheoryBlockDto = { type: 'example', ge: 'გამარჯობა', ru: 'здравствуйте' }
    const catalog = makeCatalog({
      blocks: [{ type: 'letters', letters }, example],
    })

    render(
      <LessonTheory
        catalog={catalog}
        moduleId="alphabet-progressive"
        lessonId={1}
        progress={makeProgress()}
        navigate={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: /Остальные буквы/ }))

    // Both restLetter and the example block are inside the opened accordion.
    expect(screen.getByText('დ')).toBeInTheDocument()
    expect(screen.getByText('გამარჯობა')).toBeInTheDocument()
  })
})

describe('LessonTheory — non-alphabet first-visit accordion', () => {
  it('hides theory blocks behind «📖 Объяснение» on first visit to a non-alphabet module', async () => {
    const user = userEvent.setup()
    const paragraph: TheoryBlockDto = { type: 'paragraph', text: 'Падеж — это форма слова.' }
    const example: TheoryBlockDto = { type: 'example', ge: 'წიგნი', ru: 'книга' }
    const catalog = makeCatalog({
      moduleId: 'cases-nominative',
      lessonId: 1,
      blocks: [paragraph, example],
    })

    render(
      <LessonTheory
        catalog={catalog}
        moduleId="cases-nominative"
        lessonId={1}
        progress={makeProgress()}
        navigate={vi.fn()}
      />
    )

    // Title card is shown (goal is part of it).
    expect(screen.getByText(/Запомнить первые буквы алфавита/)).toBeInTheDocument()

    // Theory content is hidden inside the closed accordion.
    expect(screen.queryByText(/Падеж — это форма слова\./)).not.toBeInTheDocument()
    expect(screen.queryByText('წიგნი')).not.toBeInTheDocument()

    const trigger = screen.getByRole('button', { name: /Объяснение/ })
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    // Tapping the trigger reveals the theory blocks.
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/Падеж — это форма слова\./)).toBeInTheDocument()
    expect(screen.getByText('წიგნი')).toBeInTheDocument()

    // CTA is «Поехали →» on first visit.
    expect(screen.getByRole('button', { name: /Поехали/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /к практике/i })).not.toBeInTheDocument()
  })

  it('renders the full expanded layout for a non-alphabet lesson that is already completed', () => {
    const paragraph: TheoryBlockDto = { type: 'paragraph', text: 'Повторение — мать учения.' }
    const catalog = makeCatalog({
      moduleId: 'cases-nominative',
      lessonId: 1,
      blocks: [paragraph],
    })

    render(
      <LessonTheory
        catalog={catalog}
        moduleId="cases-nominative"
        lessonId={1}
        progress={makeProgress({ completedLessons: { 'cases-nominative': [1] } })}
        navigate={vi.fn()}
      />
    )

    // Theory is expanded — no accordion trigger.
    expect(screen.getByText(/Повторение — мать учения\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Объяснение/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /к практике/i })).toBeInTheDocument()
  })

  it('non-alphabet first visit uses «Объяснение» accordion even when a letters block is present', async () => {
    const user = userEvent.setup()
    const letters = ['ა', 'ბ'].map(letter)
    const paragraph: TheoryBlockDto = { type: 'paragraph', text: 'Смешанный урок.' }
    // Non-alphabet module that happens to include a letters block in theory —
    // the alphabet preview split must NOT be applied here.
    const catalog = makeCatalog({
      moduleId: 'intro',
      lessonId: 1,
      blocks: [{ type: 'letters', letters }, paragraph],
    })

    render(
      <LessonTheory
        catalog={catalog}
        moduleId="intro"
        lessonId={1}
        progress={makeProgress()}
        navigate={vi.fn()}
      />
    )

    // No preview letters up front — everything is hidden behind «📖 Объяснение».
    expect(screen.queryByText('ა')).not.toBeInTheDocument()
    expect(screen.queryByText(/Смешанный урок\./)).not.toBeInTheDocument()

    const trigger = screen.getByRole('button', { name: /Объяснение/ })
    expect(trigger).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Остальные буквы/ })).not.toBeInTheDocument()

    await user.click(trigger)
    expect(screen.getByText('ა')).toBeInTheDocument()
    expect(screen.getByText(/Смешанный урок\./)).toBeInTheDocument()
  })
})
