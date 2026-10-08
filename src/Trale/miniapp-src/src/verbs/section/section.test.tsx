import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { LADDER, ruOf, sectionFixture } from './fixture'
import { parseVerbsSectionLink } from './link'
import { resetSectionCache } from './store'
import { TOUR_HINT, nextTourStep } from './tour'
import { packDone, progressOf } from './types'
import VerbsTile, { tileLine } from './VerbsTile'
import { loadSeenHints, resetSeenHints, uiHintKey } from '../ui/hints'
import { SECTION_OPENED_HINT } from './tour'

const fetchVerbSection = vi.fn()
vi.mock('../../api', () => ({ fetchVerbSection: () => fetchVerbSection(), markUiHintSeen: vi.fn(() => Promise.resolve({ ok: true })) }))

const FIRST = LADDER[0]

beforeEach(() => { resetSeenHints(); resetSectionCache(); fetchVerbSection.mockReset() })

describe('verbs section link', () => {
  const link = (search: string, start?: string) => parseVerbsSectionLink(new URLSearchParams(search), start)

  it('a broadcast button opens the section and carries the campaign as the source', () => {
    expect(link('?screen=verbs&c=verbs-2026-10')).toEqual({ kind: 'verbs', source: 'verbs-2026-10' })
  })

  it('the button after /start verbs_<tag> carries the tag', () => {
    expect(link('?screen=verbs&src=Verbs_Oct')).toEqual({ kind: 'verbs', source: 'verbs_oct' })
    expect(link('?screen=verbs')).toEqual({ kind: 'verbs', source: 'link' })
    expect(link('?screen=verbs&src=%3Cscript%3E')).toEqual({ kind: 'verbs', source: 'link' })
  })

  it('a direct mini-app link works through start_param', () => {
    expect(link('', 'verbs_tg')).toEqual({ kind: 'verbs', source: 'verbs_tg' })
    expect(link('', 'verbs')).toEqual({ kind: 'verbs', source: 'verbs' })
  })

  it('other addresses are not ours', () => {
    expect(link('?screen=vocabulary&c=referral-2026-10')).toBeNull()
    expect(link('', 'seo_grammar_cases')).toBeNull()
    expect(link('', 'verbsx')).toBeNull()
    expect(link('')).toBeNull()
  })
})

describe('verbs section tour', () => {
  const seenNone = () => false
  const seen = (...steps: string[]) => (hint: string) => steps.includes(hint)

  it('a newcomer gets «start with this» until it was shown', () => {
    expect(nextTourStep(sectionFixture(), seenNone)).toBe('now')
    expect(nextTourStep(sectionFixture(), seen(TOUR_HINT.now))).toBeNull()
  })

  it('a saved word alone is not «played»: the first hint still waits', () => {
    expect(nextTourStep(sectionFixture({ saved: [LADDER[5]] }), seenNone)).toBe('now')
  })

  it('after the first game the steps go one by one and each only once', () => {
    const played = sectionFixture({ levels: { [FIRST]: 'meeting' } })
    // Как на экране сверху вниз: уровни, потом «Мои глаголы».
    expect(nextTourStep(played, seenNone)).toBe('level')
    expect(nextTourStep(played, seen(TOUR_HINT.level))).toBe('card')
    expect(nextTourStep(played, seen(TOUR_HINT.card, TOUR_HINT.level))).toBe('mine')
    expect(nextTourStep(played, seen(TOUR_HINT.card, TOUR_HINT.level, TOUR_HINT.mine))).toBeNull()
  })

  it('there is no tour without access', () => {
    expect(nextTourStep(sectionFixture({ hasAccess: false }), seenNone)).toBeNull()
  })
})

describe('verbs section progress', () => {
  it('counts learned verbs and moves the bar already for started ones', () => {
    const pack = sectionFixture({ levels: { [FIRST]: 'meeting' } }).levels[0].packs[0]
    const progress = progressOf(pack.verbs)
    expect(progress.learned).toBe(0)
    expect(progress.total).toBe(pack.verbs.length)
    expect(progress.fraction).toBeGreaterThan(0)
    expect(progress.fraction).toBeLessThan(0.1)
    expect(packDone(pack)).toBe(false)
  })

  it('a higher level of a verb never makes the bar shorter', () => {
    const at = (level: 'meeting' | 'recognising' | 'phrases' | 'examReady' | 'learned') =>
      progressOf(sectionFixture({ levels: { [FIRST]: level } }).levels[0].packs[0].verbs).fraction
    const steps = [at('meeting'), at('recognising'), at('phrases'), at('examReady'), at('learned')]
    expect([...steps].sort((a, b) => a - b)).toEqual(steps)
  })
})

describe('dashboard tile «Глаголы»', () => {
  it('says what fits the learner', () => {
    expect(tileLine(null)).toBe('игры по 2 минуты')
    expect(tileLine(sectionFixture())).toBe(`${LADDER.length} глаголов · игры по 2 минуты`)
    expect(tileLine(sectionFixture({ levels: { [FIRST]: 'phrases' } }))).toBe(`Продолжить: «${ruOf(FIRST)}»`)
    expect(tileLine(sectionFixture({ levels: { [FIRST]: 'learned' }, due: { [FIRST]: 2 } }))).toBe(`Пора повторить: «${ruOf(FIRST)}»`)
    expect(tileLine({ ...sectionFixture({ levels: { [FIRST]: 'learned' } }), next: null })).toBe(`Выучено 1 из ${LADDER.length}`)
  })

  it('is there for everyone, opens the section, and is marked «новое» until the section was opened', async () => {
    fetchVerbSection.mockResolvedValue(sectionFixture({ hasAccess: false }))
    const navigate = vi.fn()
    const view = render(<VerbsTile navigate={navigate} />)

    expect(screen.getByTestId('dashboard-verbs-new')).toBeTruthy()
    expect((await screen.findByText(`${LADDER.length} глаголов · игры по 2 минуты`))).toBeTruthy()
    fireEvent.click(screen.getByTestId('dashboard-verbs-tile'))
    expect(navigate).toHaveBeenCalledWith({ kind: 'verbs' })

    view.unmount()
    loadSeenHints([uiHintKey(SECTION_OPENED_HINT)])
    render(<VerbsTile navigate={navigate} />)
    expect(screen.queryByTestId('dashboard-verbs-new')).toBeNull()
  })

  it('stays in place when the section did not load', async () => {
    fetchVerbSection.mockRejectedValue(new Error('offline'))
    render(<VerbsTile navigate={vi.fn()} />)

    expect(screen.getByTestId('dashboard-verbs-line').textContent).toBe('игры по 2 минуты')
  })
})
