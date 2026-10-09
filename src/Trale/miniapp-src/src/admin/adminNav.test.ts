import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  adminBack, adminLink, currentTab, enterAdmin, goInnerBack, homeTab, isAdminScreen, isFocused, keep, keptValue, leaveAdmin, parseAdminLink,
  rememberScroll, scrollOf, selectTab, setFocused, setInnerBack, TAB_ROOT, type AdminTab
} from './adminNav'
import type { Screen } from '../types'

const parse = (search: string) => parseAdminLink(new URLSearchParams(search))
type Admin = Parameters<typeof enterAdmin>[0]
const go = (s: Screen) => enterAdmin(s as Admin)

/** Каждый экран админки: адрес, сам экран и вкладка, в которой он открывается по прямой ссылке. */
const SCREENS: [string, Screen, AdminTab][] = [
  ['?screen=admin', { kind: 'admin' }, 'stats'],
  ['?screen=admin-users', { kind: 'admin-users' }, 'people'],
  ['?screen=admin-user&id=5000000101', { kind: 'admin-user', telegramId: 5000000101 }, 'people'],
  ['?screen=admin-messages', { kind: 'admin-feedback', view: 'threads' }, 'feedback'],
  ['?screen=admin-messages&id=5000000101', { kind: 'admin-feedback', view: { thread: 5000000101 } }, 'feedback'],
  ['?screen=admin-surveys', { kind: 'admin-feedback', view: 'surveys' }, 'feedback'],
  ['?screen=admin-surveys&key=survey-2026-10-users', { kind: 'admin-feedback', view: { survey: 'survey-2026-10-users' } }, 'feedback'],
  ['?screen=admin-paywall', { kind: 'admin-feedback', view: 'paywall' }, 'feedback'],
  ['?screen=admin-survey', { kind: 'admin-survey', resume: undefined }, 'feedback'],
  ['?screen=admin-survey&key=survey-2026-10-users', { kind: 'admin-survey', resume: 'survey-2026-10-users' }, 'feedback'],
  ['?screen=admin-broadcasts', { kind: 'admin-broadcasts' }, 'broadcasts'],
  ['?screen=admin-broadcast', { kind: 'admin-broadcast', key: undefined }, 'broadcasts'],
  ['?screen=admin-broadcast&key=broadcast-2026-10', { kind: 'admin-broadcast', key: 'broadcast-2026-10' }, 'broadcasts'],
  ['?screen=admin-more', { kind: 'admin-more' }, 'more'],
  ['?screen=admin-verbs', { kind: 'verb-review' }, 'more'],
  ['?screen=admin-payments', { kind: 'admin-payments' }, 'more'],
  ['?screen=admin-system', { kind: 'admin-system' }, 'more']
]

beforeEach(leaveAdmin)
afterEach(() => { setInnerBack(null); setFocused(false) })

describe('адреса', () => {
  it.each(SCREENS)('%s opens its screen in its tab, gives the same address back, and «Назад» leads to the root of the tab', (address, screen, tab) => {
    expect(parse(address)).toEqual(screen)
    expect(adminLink(screen as Admin)).toBe(address)
    expect(homeTab(screen as Admin)).toBe(tab)

    go(screen)
    expect(currentTab()).toBe(tab)
    const isRoot = adminLink(TAB_ROOT[tab] as Admin) === address || ['?screen=admin-surveys', '?screen=admin-paywall'].includes(address)
    expect(adminBack()).toEqual(isRoot ? { kind: 'profile' } : TAB_ROOT[tab])
  })

  it('the old address of the feedback hub opens «Сообщения»', () => {
    expect(parse('?screen=admin-feedback')).toEqual({ kind: 'admin-feedback', view: 'threads' })
  })

  it('leaves other addresses alone and does not trust what is in them', () => {
    expect(parse('?screen=verbs')).toBeNull()
    expect(isAdminScreen({ kind: 'profile' })).toBe(false)
    expect(parse('?screen=admin-user&id=abc')).toEqual({ kind: 'admin-users' })
    expect(parse('?screen=admin-broadcast&key=../../etc')).toEqual({ kind: 'admin-broadcast', key: undefined })
    expect(parse('?screen=admin-surveys&key=Bad Key')).toEqual({ kind: 'admin-feedback', view: 'surveys' })
  })
})

describe('вкладки', () => {
  const user: Screen = { kind: 'admin-user', telegramId: 1 }
  const thread: Screen = { kind: 'admin-feedback', view: { thread: 1 } }

  it('list → details → back stays inside the tab and says which way it went', () => {
    expect(go({ kind: 'admin' })).toBe('push')
    expect(go(selectTab('people'))).toBe('switch')
    expect(go(user)).toBe('push')
    expect(go(thread)).toBe('push')
    expect(currentTab()).toBe('people')

    expect(adminBack()).toEqual(user)
    expect(go(user)).toBe('pop')
    expect(adminBack()).toEqual({ kind: 'admin-users' })
    expect(go({ kind: 'admin-users' })).toBe('pop')
    expect(adminBack()).toEqual({ kind: 'profile' })
    expect(currentTab()).toBeNull()
  })

  it('a tab reopens where it was left; a second tap on the active tab returns to its root', () => {
    go({ kind: 'admin-users' })
    go(user)
    expect(go(selectTab('broadcasts'))).toBe('switch')
    expect(selectTab('people')).toEqual(user)
    expect(go(user)).toBe('switch')

    expect(selectTab('people')).toEqual({ kind: 'admin-users' })
    expect(go({ kind: 'admin-users' })).toBe('push')
    expect(adminBack()).toEqual({ kind: 'profile' })
  })

  it('the sections of «Связь» replace each other at the root and are remembered', () => {
    go({ kind: 'admin-feedback', view: 'threads' })
    go({ kind: 'admin-feedback', view: 'surveys' })
    go({ kind: 'admin-feedback', view: { survey: 'survey-x' } })
    expect(adminBack()).toEqual({ kind: 'admin-feedback', view: 'surveys' })
    go({ kind: 'admin-feedback', view: 'surveys' })
    go(selectTab('stats'))
    expect(selectTab('feedback')).toEqual({ kind: 'admin-feedback', view: 'surveys' })
    go({ kind: 'admin-feedback', view: 'surveys' })
    expect(adminBack()).toEqual({ kind: 'profile' })
  })

  it('what a tab keeps — filters, lists, scroll — lives until the second tap on it or leaving the admin', () => {
    go({ kind: 'admin-users' })
    keep('people/filter', 'paying')
    keep('feedback/waitingOnly', false)
    rememberScroll({ kind: 'admin-users' }, 840)
    expect(keptValue('people/filter', 'all')).toBe('paying')
    expect(scrollOf({ kind: 'admin-users' })).toBe(840)

    selectTab('people')
    expect(keptValue('people/filter', 'all')).toBe('all')
    expect(keptValue('feedback/waitingOnly', true)).toBe(false)
    expect(scrollOf({ kind: 'admin-users' })).toBe(0)

    leaveAdmin()
    expect(keptValue('feedback/waitingOnly', true)).toBe(true)
  })
})

describe('внутри экрана', () => {
  it('a step back inside a screen comes before leaving it, and only while the screen asks for it', () => {
    expect(goInnerBack()).toBe(false)
    let steps = 0
    setInnerBack(() => { steps += 1; return true })
    expect(goInnerBack()).toBe(true)
    expect(steps).toBe(1)
    setInnerBack(null)
    expect(goInnerBack()).toBe(false)
  })

  it('the focused mode is on only while a screen holds it', () => {
    expect(isFocused()).toBe(false)
    setFocused(true)
    expect(isFocused()).toBe(true)
    setFocused(false)
    expect(isFocused()).toBe(false)
  })
})
