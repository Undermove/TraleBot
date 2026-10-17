import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import Family from './Family'
import { ROLES, albumCard, albumPages, albumScore, albumsLine, familyRounds, familyTree, missReaction, ownStatements, thisIs, treeRoles, type Role } from './Family.logic'
import { introLesson, met } from '../story'
import { seeded } from '../../verbs/testing/catalog'

afterEach(() => { vi.useRealTimers() })

const GEO_TO_ROLE = (geo: string) => (Object.keys(ROLES) as Role[]).find(r => thisIs(r) === geo)!

describe('Family logic', () => {
  it('grows the board with the mode and only shows words the learner has met', () => {
    // С урока 25 — и бабушка с дедушкой (слова сцены): ряд над родителями.
    expect(treeRoles(familyTree('parents', 25)).sort()).toEqual(['babua', 'bebia', 'deda', 'mama'])
    expect(treeRoles(familyTree('siblings', 26)).sort()).toEqual(['babua', 'bebia', 'da', 'deda', 'dzma', 'mama'])
    expect(treeRoles(familyTree('full', 29))).toHaveLength(8)
    expect(treeRoles(familyTree('album', 30))).toHaveLength(10)
    for (const [mode, id] of [['parents', 25], ['siblings', 26], ['full', 29], ['album', 30]] as const)
      for (const r of treeRoles(familyTree(mode, id))) expect(met(id, ROLES[r].pid)).toBe(true)
    // В 25-м уроке брата ещё не знают: рамки ძმა нет даже на полной доске.
    expect(treeRoles(familyTree('full', 25)).sort()).toEqual(['deda', 'mama'])
    // До 25-го бабушки с дедушкой нет.
    expect(treeRoles(familyTree('parents', 24)).length).toBe(0)
  })

  it('starts the parents album with მამა — the classic trap', () => {
    for (let seed = 1; seed < 20; seed++) {
      const rounds = familyRounds('parents', 25, seeded(seed))
      expect(rounds).toHaveLength(3)
      expect(rounds[0].order[0]).toBe('mama')
    }
    const sib = familyRounds('siblings', 26, seeded(2))
    expect(sib.every(r => r.order.includes('da'))).toBe(true)
    expect(familyRounds('full', 29, seeded(2))[0].looks.vazhi.age).toBe('kid')
    expect(familyRounds('full', 29, seeded(2))[0].looks.mama.age).toBe('adult')
    expect(familyRounds('parents', 25, seeded(2))[0].looks.bebia.age).toBe('old')
  })

  it('reacts to the trap and to და', () => {
    expect(missReaction('mama', 'deda')).toBe('მამა — это папа! Мама — დედა.')
    expect(missReaction('da', 'dzma')).toContain('сестра, а не «и»')
  })

  it('album: 8 pages, 3 options with the right word and its twin; streak bonus', () => {
    const pages = albumPages(30, seeded(4))
    expect(pages).toHaveLength(10)
    expect(pages.find(p => p.role === 'bebia')!.options).toContain('babua')
    for (const p of pages) {
      expect(p.options).toHaveLength(3)
      expect(new Set(p.options).size).toBe(3)
      expect(p.options).toContain(p.role)
    }
    expect(pages.find(p => p.role === 'mama')!.options).toContain('deda')
    expect(albumScore([true, true, true, false, true])).toEqual({ score: 1 + 1 + 2 + 1, best: 3 })
    const own = ownStatements(30)
    expect(own.map(s => s.id)).toEqual(expect.arrayContaining(['myavs_dzma_da', 'myavs_da', 'myavs_dzaghli']))
    expect(own.every(s => s.geo.startsWith('მე მყავს'))).toBe(true)
  })
})

describe('Family scene', () => {
  it.each([['parents', 25], ['siblings', 26], ['full', 29]] as const)('%s: places every photo, survives a miss, reaches GameEnd', (mode, id) => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<Family lesson={introLesson(id)} step={{ kind: 'family', mode }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(7)} />)
    fireEvent.click(screen.getByText('Начать'))
    expect(screen.getByTestId('family-scene')).toBeTruthy()
    let missed = false, cards = 0
    // В уроке 25 первое фото приходит с новым словом ფოტო.
    if (id === 25) expect(screen.getByTestId('new-word').getAttribute('data-word')).toBe('foto')
    for (let k = 0; k < 60 && !screen.queryByTestId('game-end'); k++) {
      const card = screen.queryByTestId('album-card-go')
      if (card) { cards++; fireEvent.click(card.querySelector('button')!); continue }
      const say = screen.queryByTestId('family-say')
      if (!say) { fireEvent.click(screen.getByRole('button', { name: /Дальше: альбом|Готово/ })); continue }
      const role = GEO_TO_ROLE(say.textContent!.replace(/[^ა-ჿ ]/g, '').trim())
      if (!missed) {
        const other = (Object.keys(ROLES) as Role[]).find(r => r !== role && screen.queryByTestId(`frame-${r}`)?.dataset.filled === 'no')
        if (other) {
          fireEvent.click(screen.getByTestId(`frame-${other}`))
          expect(screen.getByTestId('family-feedback').textContent).toContain('это')
          if (mode === 'parents') expect(screen.getByTestId('family-trap').textContent).toBe('ловушка!')
        }
        missed = true
      }
      fireEvent.click(screen.getByTestId(`frame-${role}`))
      act(() => { vi.advanceTimersByTime(700) })
    }
    expect(screen.getByTestId('game-end')).toBeTruthy()
    // Перед каждым альбомом — карточка: три у родителей, два у брата с сестрой, у «всей семьи» альбом один.
    expect(cards).toBe({ parents: 3, siblings: 2, full: 0 }[mode])
    expect(screen.getByTestId('rule-card')).toBeTruthy()
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  })

  it('intro and album cards say how many albums and whose', () => {
    expect(albumsLine('parents')).toBe('Ты посмотришь три альбома: Нино, Аны и Гиорги.')
    expect(albumsLine('siblings')).toBe('Ты посмотришь два альбома: Нино и Давити.')
    expect(albumCard('parents', 1)).toMatchObject({ count: 'Альбом 2 из 3', title: 'Семья Аны', text: expect.stringMatching(/другая семья/) })
  })

  it('album: answers pages, picks own statements, ends with the own page', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<Family lesson={introLesson(30)} step={{ kind: 'family', mode: 'album' }} fraction={0.5} onExit={() => {}} onDone={onDone} rng={seeded(9)} />)
    fireEvent.click(screen.getByText('Начать'))
    const wrong = screen.getAllByTestId(/album-wrong-/)[0]
    fireEvent.click(wrong)
    for (let k = 0; k < 10; k++) {
      fireEvent.click(screen.getByTestId('album-right'))
      act(() => { vi.advanceTimersByTime(1000) })
    }
    expect(screen.getByTestId('family-own')).toBeTruthy()
    fireEvent.click(screen.getByTestId('own-myavs_dzaghli'))
    fireEvent.click(screen.getByText('Вклеить в альбом'))
    expect(screen.getByTestId('family-own-page').textContent).toContain('მე მყავს ძაღლი')
    fireEvent.click(screen.getByText('Дальше'))
    expect(onDone).toHaveBeenCalled()
  })
})
