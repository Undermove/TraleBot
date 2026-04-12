function getInitData(): string {
  const tg = (window as any).Telegram?.WebApp
  return tg?.initData ?? ''
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'X-Telegram-Init-Data': getInitData(),
    'Content-Type': 'application/json'
  }
  if (init?.headers) {
    Object.assign(headers, init.headers as Record<string, string>)
  }
  const resp = await fetch(path, { ...init, headers })
  if (!resp.ok) {
    throw new ApiError(resp.status, await resp.text().catch(() => ''))
  }
  return (await resp.json()) as T
}

export class ApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`API ${status}`)
  }
}

export interface ProgressDto {
  xp: number
  streak: number
  lastPlayedAtUtc: string | null
  completedLessons: Record<string, number[]>
}

export interface MeResponse {
  authenticated: boolean
  language?: string
  vocabularyCount?: number
  progress?: ProgressDto
}

export interface LessonCompleteResponse {
  xpEarned: number
  progress: ProgressDto
}

export interface VocabularyItem {
  id: string
  word: string
  definition: string
  example: string
  dateAddedUtc: string | null
  successCount: number
  successReverseCount: number
  failedCount: number
  mastery: 'NotMastered' | 'MasteredInForwardDirection' | 'MasteredInBothDirections'
  isStarter: boolean
}

export interface VocabularyListResponse {
  language: string
  items: VocabularyItem[]
  starterItems: VocabularyItem[]
}

export interface VocabularyQuizQuestion {
  id: string
  wordId: string | null
  lemma: string
  question: string
  options: string[]
  answerIndex: number
  explanation: string
  direction: 'ge-to-ru' | 'ru-to-ge'
  isStarter: boolean
}

export interface VocabularyWordPair {
  wordId: string
  georgian: string
  russian: string
}

export interface VocabularyQuizResponse {
  questions: VocabularyQuizQuestion[]
  wordPairs?: VocabularyWordPair[]
  allGeorgian?: string[]
  allRussian?: string[]
}

export type VocabularyQuizMode = 'all' | 'new' | 'weak' | 'custom' | 'starter'

import { CatalogDto } from './types'

export const api = {
  content: () => request<CatalogDto>('/api/miniapp/content'),

  me: () => request<MeResponse>('/api/miniapp/me'),

  completeLesson: (payload: {
    moduleId: string
    lessonId: number
    correct: number
    total: number
  }) =>
    request<LessonCompleteResponse>('/api/miniapp/progress/lesson-complete', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  vocabulary: () => request<VocabularyListResponse>('/api/miniapp/vocabulary'),

  startVocabularyQuiz: (payload: { mode: VocabularyQuizMode; wordIds?: string[]; count?: number }) =>
    request<VocabularyQuizResponse>('/api/miniapp/vocabulary/quiz', {
      method: 'POST',
      body: JSON.stringify({
        mode: payload.mode,
        wordIds: payload.wordIds ?? [],
        count: payload.count ?? 10
      })
    }),

  recordVocabularyAnswer: (payload: { wordId: string | null; correct: boolean; direction: string }) =>
    request<{
      id: string
      successCount: number
      failedCount: number
      mastery: string
    }>('/api/miniapp/vocabulary/answer', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  lessonQuestions: (moduleId: string, lessonId: number) =>
    request<Array<{
      id: string
      lemma?: string
      question: string
      options: string[]
      answerIndex: number
      explanation: string
    }>>(`/api/miniapp/modules/${moduleId}/lessons/${lessonId}/questions`)
}
