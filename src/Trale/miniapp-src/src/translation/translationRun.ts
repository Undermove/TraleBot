import { useSyncExternalStore } from 'react'
import { api, type TranslateProgress } from '../api'
import type { VerbFormHitDto } from '../verbs/types'

// Перевод, который идёт прямо сейчас. Живёт вне экрана словаря: человек может уйти на другой экран
// и вернуться — ход работы и ответ никуда не денутся (слово в любом случае окажется в словаре).

export interface TranslationRun {
  word: string
  state: 'translating' | 'success' | 'error' | 'not-a-word' | 'timeout'
  progress: TranslateProgress
  startedAt: number
  finishedAt?: number
  /** Слово новое в словаре (а не было там раньше). */
  added?: boolean
  result?: { word: string; definition: string; additionalInfo: string; example: string; verb?: VerbFormHitDto | null }
}

/** Сколько готовый ответ ждёт человека, который ушёл с экрана. */
const KEEP_FINISHED_MS = 5 * 60_000

let run: TranslationRun | null = null
const listeners = new Set<() => void>()

function set(next: TranslationRun | null) {
  run = next
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function currentTranslation(): TranslationRun | null {
  if (run && run.finishedAt && Date.now() - run.finishedAt > KEEP_FINISHED_MS) run = null
  return run
}

export function useTranslationRun(): TranslationRun | null {
  return useSyncExternalStore(subscribe, currentTranslation)
}

/** Убрать готовый ответ с экрана. Идущий перевод не трогает. */
export function dismissTranslation() {
  if (run && run.state !== 'translating') set(null)
}

/** Только для тестов. */
export function resetTranslationRun() {
  set(null)
}

export async function startTranslation(text: string): Promise<void> {
  const word = text.trim()
  if (!word || run?.state === 'translating') return
  const mine: TranslationRun = {
    word,
    state: 'translating',
    progress: { stage: null, verbLookup: false, slow: false },
    startedAt: Date.now()
  }
  set(mine)
  const finish = (patch: Partial<TranslationRun>) => {
    if (run?.startedAt === mine.startedAt && run.word === word) set({ ...run, ...patch, finishedAt: Date.now() })
  }
  try {
    const r = await api.translateWord(word, (progress) => {
      if (run?.startedAt === mine.startedAt && run.state === 'translating') set({ ...run, progress })
    })
    if (r.status === 'success' || r.status === 'exists') {
      finish({
        state: 'success',
        added: r.status === 'success',
        result: {
          word: r.word ?? word,
          definition: r.definition ?? '',
          additionalInfo: r.additionalInfo ?? '',
          example: r.example ?? '',
          verb: r.verb
        }
      })
    } else if (r.status === 'not_a_word') {
      finish({ state: 'not-a-word' })
    } else if (r.status === 'timeout') {
      finish({ state: 'timeout' })
    } else {
      finish({ state: 'error' })
    }
  } catch {
    finish({ state: 'error' })
  }
}
