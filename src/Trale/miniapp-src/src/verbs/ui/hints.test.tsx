import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HelpButton, seenKey, useFirstTime } from './GameShell'
import { hintSeen, loadSeenHints, markHintSeen, uiHintKey } from './hints'
import { markUiHintSeen } from '../../api'

// Одноразовые подсказки хранит сервер: на устройстве от них ничего не остаётся, а «второе
// устройство» (другой запуск с тем же списком из /me) подсказку уже не показывает.

vi.mock('../../api', async () => (await import('../testing/sheetApi')).sheetApi())

function FirstMove() {
  const [first, played] = useFirstTime('verb_time')
  return <button onClick={played}>{first ? 'первый ход' : 'обычный ход'}</button>
}

describe('одноразовые подсказки', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })

  it('правила игры: показаны один раз, отметка уходит на сервер, на устройстве ничего не остаётся', () => {
    const first = render(<HelpButton id="verb_time" help={['Правило']} />)
    expect(screen.getByText('Правило')).toBeTruthy()

    fireEvent.click(screen.getByText('Играть'))
    expect(markUiHintSeen).toHaveBeenCalledTimes(1)
    expect(markUiHintSeen).toHaveBeenCalledWith('ui:verb_game_seen_verb_time')
    expect(localStorage.length).toBe(0)
    first.unmount()

    render(<HelpButton id="verb_time" help={['Правило']} />)
    expect(screen.queryByText('Правило')).toBeNull()
  })

  it('другое устройство: список из /me — и подсказок, которые человек уже видел, нет', () => {
    loadSeenHints(['ui:verb_game_seen_verb_time', 'ui:verb_game_seen_verb_time_move', 'ui:verb_card_person'])

    render(<><HelpButton id="verb_time" help={['Правило']} /><FirstMove /></>)

    expect(screen.queryByText('Правило')).toBeNull()
    expect(screen.getByText('обычный ход')).toBeTruthy()
    expect(hintSeen('verb_card_person')).toBe(true)
    expect(hintSeen(seenKey('verb_bones'))).toBe(false)
  })

  it('первый ход отмечается один раз; сеть упала — ничего не ломается, подсказка покажется в другой раз', () => {
    vi.mocked(markUiHintSeen).mockRejectedValue(new Error('offline'))
    render(<FirstMove />)

    fireEvent.click(screen.getByText('первый ход'))
    fireEvent.click(screen.getByText('обычный ход'))

    expect(markUiHintSeen).toHaveBeenCalledTimes(1)
    expect(markUiHintSeen).toHaveBeenCalledWith(uiHintKey(seenKey('verb_time_move')))
    expect(() => markHintSeen('verb_lesson_chip')).not.toThrow()
  })

  it('ключи подходят под правило сервера: ui: и строчные латинские буквы, цифры, подчёркивание', () => {
    for (const id of ['verb_card_person', 'verb_lesson_chip', ...['ladder', 'session_exam', 'verb_time', 'verb_bones', 'verb_builder', 'story', 'story_choose', 'story_type', 'story_build'].flatMap(g => [seenKey(g), seenKey(g + '_move')])]) {
      expect(uiHintKey(id)).toMatch(/^ui:[a-z0-9_]+$/)
      expect(uiHintKey(id).length).toBeLessThanOrEqual(64)
    }
  })
})
