import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import FamilyCard from '../FamilyCard'
import { FAMILY_CARD_HINT, familyAction, towardProgress } from '../cardLogic'
import { GO, at, sectionFamily } from '../../testing/family'
import { hintSeen, markHintSeen } from '../../ui/hints'
import LevelGroup from '../../section/LevelGroup'
import { levelVerbs, progressOf } from '../../section/types'

// Карточка семьи в разделе: схема направлений с состояниями, счёт «туда / сюда» и одна кнопка.

vi.mock('../../../api', () => ({ markUiHintSeen: vi.fn(() => Promise.resolve({ ok: true })) }))

const BASE = GO.base
const OUT = at('out', 'there')

function show(family = sectionFamily(), props: Partial<React.ComponentProps<typeof FamilyCard>> = {}) {
  const onVerb = vi.fn(), onPlay = vi.fn()
  render(<FamilyCard family={family} hasAccess onVerb={onVerb} onPlay={onPlay} {...props} />)
  return { onVerb, onPlay }
}

describe('карточка семьи', () => {
  it('показывает каждое направление в обе стороны и состояние каждого глагола', () => {
    show(sectionFamily({ [BASE]: 'learned', [OUT]: 'meeting', [at('in', 'here')]: 'learned' }))

    for (const direction of ['none', 'up', 'down', 'in', 'out', 'across']) {
      for (const toward of ['there', 'here']) expect(screen.getByTestId(`family-pill-${direction}-${toward}`)).toBeInTheDocument()
    }
    expect(screen.getByTestId('family-pill-none-there').getAttribute('data-state')).toBe('learned')
    expect(screen.getByTestId('family-pill-out-there').getAttribute('data-state')).toBe('started')
    expect(screen.getByTestId('family-pill-in-here').getAttribute('data-state')).toBe('learned')
    expect(screen.getByTestId('family-pill-up-here').getAttribute('data-state')).toBe('new')
    expect(screen.getByTestId('family-pill-out-there').getAttribute('aria-label')).toContain('наружу · туда — начат')
    expect(screen.getByTestId('family-progress').textContent).toBe('туда: 1 из 6 · сюда: 1 из 6')
    // Схема — рисунки, а не эмодзи.
    expect(screen.getAllByTestId('direction-glyph').length).toBeGreaterThanOrEqual(6)
  })

  it('нажатие на направление открывает этот глагол', () => {
    const { onVerb } = show()
    fireEvent.click(screen.getByTestId('family-pill-across-here'))
    expect(onVerb).toHaveBeenCalledWith(expect.objectContaining({ id: at('across', 'here') }))
  })

  it('кнопка ведёт к основному глаголу, пока он не выучен, потом — к начатому, к новому, к повторению', () => {
    const fresh = sectionFamily()
    expect(familyAction(fresh)).toMatchObject({ label: `Сначала «${GO.baseName}» — 2 минуты`, member: { id: BASE } })

    const started = sectionFamily({ [BASE]: 'learned', [OUT]: 'meeting' })
    expect(familyAction(started)).toMatchObject({ label: 'Продолжить — 2 минуты', member: { id: OUT } })

    const baseOnly = sectionFamily({ [BASE]: 'learned' })
    expect(familyAction(baseOnly)).toMatchObject({ label: 'Выучить направление — 2 минуты', member: { id: at('none', 'here') } })

    const all = Object.fromEntries(GO.members.map(m => [m.lemma, 'learned' as const]))
    expect(familyAction(sectionFamily(all, { [OUT]: 3 }))).toMatchObject({ label: 'Повторить за минуту', member: { id: OUT } })
    expect(familyAction(sectionFamily(all))).toMatchObject({ label: 'Сыграть ещё', quiet: true })
    expect(towardProgress(sectionFamily(all))).toEqual({ there: { learned: 6, total: 6 }, here: { learned: 6, total: 6 } })

    const { onPlay } = show(started)
    fireEvent.click(screen.getByTestId('family-play'))
    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: OUT }))
  })

  it('подсказка про семью показывается один раз и уходит по крестику', () => {
    const first = show()
    expect(screen.getByTestId('family-hint').textContent).toContain(`«${GO.baseName}» с разными приставками`)
    fireEvent.click(screen.getByLabelText('Понятно'))
    expect(screen.queryByTestId('family-hint')).toBeNull()
    expect(hintSeen(FAMILY_CARD_HINT)).toBe(true)
    expect(first.onPlay).not.toHaveBeenCalled()
  })

  it('без доступа — обзор без грузинского и без подсказки; кнопка с пометкой «Про»', () => {
    const family = sectionFamily()
    family.members = family.members.map(m => ({ ...m, id: null, title: null }))
    const { container } = render(<FamilyCard family={family} hasAccess={false} onVerb={vi.fn()} onPlay={vi.fn()} />)
    expect(container.textContent).not.toMatch(/[ა-ჰ]/)
    expect(screen.queryByTestId('family-hint')).toBeNull()
    expect(screen.getByLabelText('Про-доступ')).toBeInTheDocument()
  })

  it('в уровне карточка стоит перед наборами, а счёт уровня считает только её собственные глаголы', () => {
    markHintSeen(FAMILY_CARD_HINT)
    const family = sectionFamily({ [BASE]: 'learned', [OUT]: 'learned' })
    const level = { id: 2, title: 'Каждый день', families: [family], packs: [{ id: 'p', title: 'Набор', verbs: [{ id: 'x', title: 'x', ru: 'делать', level: 'new' as const, due: 0 }] }] }
    const own = family.members.filter(m => m.inCard)

    // Пара основного глагола стоит в своём наборе уровня 1 — здесь она только показана.
    expect(own).toHaveLength(GO.members.length - 2)
    expect(levelVerbs(level)).toHaveLength(own.length + 1)
    expect(progressOf(levelVerbs(level)).learned).toBe(1)

    const onPlay = vi.fn()
    render(<LevelGroup level={level} open onToggle={vi.fn()} openPack={null} onTogglePack={vi.fn()} onVerb={vi.fn()} currentPack={family.id} onPlay={onPlay} />)
    expect(screen.getByTestId('verbs-level-2-count').textContent).toBe(`1 из ${own.length + 1}`)
    const card = screen.getByTestId('verbs-family-go')
    expect(card.getAttribute('data-current')).toBe('true')
    expect(card.compareDocumentPosition(screen.getByTestId('verbs-pack-p')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    fireEvent.click(screen.getByTestId('family-play'))
    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: at('none', 'here') }))
  })
})
