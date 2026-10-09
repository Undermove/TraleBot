import { describe, it, expect, afterEach } from 'vitest'
import { adminLink, adminParent, goInnerBack, isAdminScreen, parseAdminLink, setInnerBack } from './adminNav'
import type { Screen } from '../types'

const parse = (search: string) => parseAdminLink(new URLSearchParams(search))

/** Каждый экран админки: адрес, сам экран и экран уровнем выше. */
const SCREENS: [string, Screen, Screen][] = [
  ['?screen=admin', { kind: 'admin' }, { kind: 'profile' }],
  ['?screen=admin-users', { kind: 'admin-users' }, { kind: 'admin' }],
  ['?screen=admin-user&id=5000000101', { kind: 'admin-user', telegramId: 5000000101 }, { kind: 'admin-users' }],
  ['?screen=admin-feedback', { kind: 'admin-feedback' }, { kind: 'admin' }],
  ['?screen=admin-messages', { kind: 'admin-feedback', view: 'threads' }, { kind: 'admin-feedback' }],
  ['?screen=admin-messages&id=5000000101', { kind: 'admin-feedback', view: { thread: 5000000101 } }, { kind: 'admin-feedback', view: 'threads' }],
  ['?screen=admin-surveys', { kind: 'admin-feedback', view: 'surveys' }, { kind: 'admin-feedback' }],
  ['?screen=admin-surveys&key=survey-2026-10-users', { kind: 'admin-feedback', view: { survey: 'survey-2026-10-users' } }, { kind: 'admin-feedback', view: 'surveys' }],
  ['?screen=admin-paywall', { kind: 'admin-feedback', view: 'paywall' }, { kind: 'admin-feedback' }],
  ['?screen=admin-survey', { kind: 'admin-survey', resume: undefined }, { kind: 'admin-feedback', view: 'surveys' }],
  ['?screen=admin-survey&key=survey-2026-10-users', { kind: 'admin-survey', resume: 'survey-2026-10-users' }, { kind: 'admin-feedback', view: 'surveys' }],
  ['?screen=admin-broadcasts', { kind: 'admin-broadcasts' }, { kind: 'admin' }],
  ['?screen=admin-broadcast', { kind: 'admin-broadcast', key: undefined }, { kind: 'admin-broadcasts' }],
  ['?screen=admin-broadcast&key=broadcast-2026-10', { kind: 'admin-broadcast', key: 'broadcast-2026-10' }, { kind: 'admin-broadcasts' }],
  ['?screen=admin-verbs', { kind: 'verb-review' }, { kind: 'admin' }],
  ['?screen=admin-payments', { kind: 'admin-payments' }, { kind: 'admin' }],
  ['?screen=admin-system', { kind: 'admin-system' }, { kind: 'admin' }]
]

afterEach(() => setInnerBack(null))

describe('adminNav', () => {
  it.each(SCREENS)('%s opens its screen, gives the same address back and goes one level up', (address, screen, parent) => {
    expect(parse(address)).toEqual(screen)
    expect(isAdminScreen(screen)).toBe(true)
    expect(adminLink(screen as never)).toBe(address)
    expect(adminParent(screen as never)).toEqual(parent)
  })

  it('a conversation opened from a survey goes back to that survey', () => {
    expect(adminParent({ kind: 'admin-feedback', view: { thread: 111, quote: 'a1', back: { survey: 'survey-x' } } }))
      .toEqual({ kind: 'admin-feedback', view: { survey: 'survey-x' } })
  })

  it('leaves other addresses alone and does not trust what is in them', () => {
    expect(parse('?screen=verbs')).toBeNull()
    expect(parse('')).toBeNull()
    expect(isAdminScreen({ kind: 'profile' })).toBe(false)
    expect(parse('?screen=admin-user&id=abc')).toEqual({ kind: 'admin-users' })
    expect(parse('?screen=admin-user')).toEqual({ kind: 'admin-users' })
    expect(parse('?screen=admin-broadcast&key=../../etc')).toEqual({ kind: 'admin-broadcast', key: undefined })
    expect(parse('?screen=admin-surveys&key=Bad Key')).toEqual({ kind: 'admin-feedback', view: 'surveys' })
  })

  it('a step back inside a screen comes before the level up, and only while the screen asks for it', () => {
    expect(goInnerBack()).toBe(false)
    let steps = 0
    setInnerBack(() => { steps += 1; return true })
    expect(goInnerBack()).toBe(true)
    expect(steps).toBe(1)
    setInnerBack(null)
    expect(goInnerBack()).toBe(false)
  })
})
