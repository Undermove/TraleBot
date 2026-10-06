import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import LessonVerbsLine from './LessonVerbsLine'
import { uniqueVerbs } from './lessonVerbs'
import { goHit, hit, writeVerb } from './fixtures'

vi.mock('../../api', async () => (await import('../testing/sheetApi')).sheetApi({ fetchVerb: vi.fn(() => Promise.resolve(writeVerb)) }))

const played = [
  { verb: hit('წერდა', 'imperfect', 2) },
  { verb: null },
  { verb: hit('ვწერ', 'present', 0) },
  { verb: goHit }
]

describe('uniqueVerbs', () => {
  it('lists each verb once, in order of appearance, with the form met first', () => {
    expect(uniqueVerbs(played)).toEqual([hit('წერდა', 'imperfect', 2), goHit])
  })

  it('keeps the line short', () => {
    const many = ['a', 'b', 'c', 'd', 'e'].map(id => ({ verb: { ...goHit, verbId: id } }))

    expect(uniqueVerbs(many).map(v => v.verbId)).toEqual(['a', 'b', 'c'])
  })
})

describe('verbs line on the lesson result', () => {
  it('names the verbs of the lesson just played and opens the card on the form that was met', async () => {
    render(<LessonVerbsLine verbs={uniqueVerbs(played)} />)

    expect(screen.getByText('в этом уроке были глаголы')).toBeTruthy()
    const verbs = screen.getAllByTestId('lesson-verbs-line-verb')
    expect(verbs.map(v => v.textContent)).toEqual([
      expect.stringContaining('წერა'),
      expect.stringContaining('სვლა')
    ])

    fireEvent.click(verbs[0])

    const row = await screen.findByTestId('verb-tense-imperfect')
    expect(row.className).toContain('bg-gold-wash')
    expect(row.textContent).toContain('წერდა')
  })

  it('shows nothing when the lesson had no verbs', () => {
    const { container } = render(<LessonVerbsLine verbs={uniqueVerbs([{ verb: null }, {}])} />)

    expect(container.innerHTML).toBe('')
  })
})
