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
  level?: string | null
  progress?: ProgressDto
  isPro?: boolean
}

export interface LessonCompleteResponse {
  xpEarned: number
  progress: ProgressDto
}

export interface VocabularyItem {
  id: string
  word: string
  definition: string
  additionalInfo?: string
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

  translateWord: (word: string) =>
    request<{
      status: 'success' | 'exists' | 'failure'
      word?: string
      definition?: string
      additionalInfo?: string
      example?: string
      vocabularyEntryId?: string
    }>('/api/miniapp/translate', {
      method: 'POST',
      body: JSON.stringify({ word })
    }),

  setLevel: (level: string) =>
    request<{ level: string }>('/api/miniapp/level', {
      method: 'POST',
      body: JSON.stringify({ level })
    }),

  plans: () =>
    request<{ plans: Array<{
      id: string
      payloadId: string
      stars: number
      durationDays: number | null
      title: string
      description: string
    }> }>('/api/miniapp/plans'),

  purchase: (plan: string) =>
    request<{ ok: boolean; alreadyPro?: boolean; invoiceLink?: string }>('/api/miniapp/purchase', {
      method: 'POST',
      body: JSON.stringify({ plan })
    }),

  refund: (chargeId?: string) =>
    request<{ ok: boolean }>('/api/miniapp/refund', {
      method: 'POST',
      body: JSON.stringify({ chargeId: chargeId ?? null })
    }),

  activityDays: (days = 35) =>
    request<{ dates: string[] }>(`/api/miniapp/activity-days?days=${days}`),

  referral: () =>
    request<{
      link: string
      shareText: string
      invitedCount: number
      activatedCount: number
      bonusLabel: string
      todayActivated: number
      dailyLimit: number
      yearActivated: number
      yearlyLimit: number
    }>('/api/miniapp/referral'),

  adminStats: () => request<AdminStats>('/api/admin/stats'),
  adminSignups: (days = 30) =>
    request<{ days: number; points: Array<{ date: string; count: number }> }>(
      `/api/admin/signups?days=${days}`
    ),
  adminRecentUsers: (
    opts: { limit?: number; search?: string; sort?: 'recent_signup' | 'recent_activity' } = {}
  ) => {
    const params = new URLSearchParams()
    params.set('limit', String(opts.limit ?? 50))
    if (opts.search) params.set('search', opts.search)
    if (opts.sort) params.set('sort', opts.sort)
    return request<{ users: AdminRecentUser[] }>(`/api/admin/recent-users?${params}`)
  },
  adminUserDetail: (telegramId: number) =>
    request<AdminUserDetail>(`/api/admin/users/${telegramId}`),
  adminGrantPro: (telegramId: number, plan: string) =>
    request<{ ok: boolean }>(`/api/admin/users/${telegramId}/grant-pro`, {
      method: 'POST',
      body: JSON.stringify({ plan })
    }),
  adminRevokePro: (telegramId: number) =>
    request<{ ok: boolean }>(`/api/admin/users/${telegramId}/revoke-pro`, {
      method: 'POST'
    }),

  adminBroadcastPreview: (opts: { activeWithinDays?: number | null; minVocab?: number }) => {
    const params = new URLSearchParams()
    if (opts.activeWithinDays != null) params.set('activeWithinDays', String(opts.activeWithinDays))
    if (opts.minVocab) params.set('minVocab', String(opts.minVocab))
    return request<{ totalRecipients: number; sampleTelegramIds: number[] }>(
      `/api/admin/broadcast/preview?${params}`
    )
  },
  adminBroadcast: (body: {
    activeWithinDays?: number | null
    minVocabularyCount?: number
    message: string
    grantPlan: string | null
    dryRun: boolean
    includeMiniAppButton: boolean
  }) =>
    request<{ totalRecipients: number; sent: number; failed: number; granted: number; error?: string }>(
      `/api/admin/broadcast`,
      {
        method: 'POST',
        body: JSON.stringify(body)
      }
    ),

  lessonQuestions: (moduleId: string, lessonId: number) =>
    request<Array<{
      id: string
      lemma?: string
      question: string
      options: string[]
      answerIndex: number
      explanation: string
    }>>(`/api/miniapp/modules/${moduleId}/lessons/${lessonId}/questions`),

  deleteVocabularyEntry: async (id: string): Promise<void> => {
    const headers: Record<string, string> = {
      'X-Telegram-Init-Data': getInitData(),
      'Content-Type': 'application/json'
    }
    const resp = await fetch(`/api/miniapp/vocabulary/${id}`, { method: 'DELETE', headers })
    if (!resp.ok) {
      throw new ApiError(resp.status, await resp.text().catch(() => ''))
    }
  }
}

export interface AdminStats {
  totalUsers: number
  activeUsers: number
  proUsers: number
  trialUsers: number
  freeUsers: number
  newUsersToday: number
  newUsersWeek: number
  newUsersMonth: number
  totalRevenueStars: number
  revenueWeekStars: number
  totalPurchases: number
  totalRefunds: number
  totalVocabularyEntries: number
  averageVocabularyPerUser: number
  conversionPostTrialPct: number
}

export interface AdminRecentUser {
  telegramId: number
  isPro: boolean
  plan: string | null
  subscribedUntilUtc: string | null
  registeredAtUtc: string
  proPurchasedAtUtc: string | null
  vocabularyCount: number
  lastActivityUtc: string | null
}

export interface AdminUserDetail {
  telegramId: number
  userId: string
  isPro: boolean
  isActive: boolean
  subscriptionPlan: string | null
  subscribedUntilUtc: string | null
  proPurchasedAtUtc: string | null
  registeredAtUtc: string
  currentLanguage: string
  vocabularyCount: number
  xp: number
  streak: number
  level: string
  lastActivityUtc: string | null
  payments: Array<{
    chargeId: string
    plan: string
    amount: number
    currency: string
    purchasedAtUtc: string
    refundedAtUtc: string | null
  }>
}
