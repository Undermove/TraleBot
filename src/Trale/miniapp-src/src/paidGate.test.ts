import { describe, it, expect } from 'vitest'
import { needsPurchase } from './paidGate'
import { PRO_MODULE_IDS, Screen } from './types'

const entryScreens = (moduleId: string): Screen[] => [
  { kind: 'module', moduleId },
  { kind: 'lesson-theory', moduleId, lessonId: 1 },
  { kind: 'practice', moduleId, lessonId: 1 },
  { kind: 'practice-mistakes', moduleId, lessonId: 1, wrongQuestions: [] },
]

describe('needsPurchase', () => {
  it('closes every way into a paid module for a person without access', () => {
    for (const screen of entryScreens('cases')) {
      expect(needsPurchase(screen, false), screen.kind).toBe(true)
    }
  })

  it('covers every paid module, not just one', () => {
    for (const moduleId of PRO_MODULE_IDS) {
      expect(needsPurchase({ kind: 'practice', moduleId, lessonId: 1 }, false), moduleId).toBe(true)
    }
  })

  it('lets a person with a subscription or a free period through', () => {
    for (const screen of entryScreens('my-day')) {
      expect(needsPurchase(screen, true), screen.kind).toBe(false)
    }
  })

  it('leaves free modules open without access', () => {
    for (const moduleId of ['alphabet-progressive', 'verbs-of-movement', 'welcome']) {
      for (const screen of entryScreens(moduleId)) {
        expect(needsPurchase(screen, false), `${moduleId} ${screen.kind}`).toBe(false)
      }
    }
  })

  it('still shows the result of a lesson that is already done', () => {
    expect(needsPurchase({ kind: 'result', moduleId: 'cases', lessonId: 1, correct: 5, total: 5, xpEarned: 10 }, false)).toBe(false)
    expect(needsPurchase({ kind: 'mistakes-result', moduleId: 'cases', lessonId: 1, corrected: 1, total: 1, remainingWrong: [] }, false)).toBe(false)
  })

  it('does not touch screens outside modules', () => {
    const screens: Screen[] = [
      { kind: 'dashboard' }, { kind: 'welcome' }, { kind: 'onboarding' }, { kind: 'profile' },
      { kind: 'verbs' }, { kind: 'vocabulary-list' }, { kind: 'feedback' }, { kind: 'admin' },
    ]
    for (const screen of screens) {
      expect(needsPurchase(screen, false), screen.kind).toBe(false)
    }
  })
})
