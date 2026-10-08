import type { VerbDto, VerbFormHitDto } from './verbs/types'
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

export interface TranslateWordResponse {
  // pending приходит с сервера, пока перевод не готов; timeout — мини-апп перестал ждать.
  status: 'success' | 'exists' | 'failure' | 'not_a_word' | 'pending' | 'timeout'
  verbLookup?: boolean
  word?: string
  definition?: string
  additionalInfo?: string
  example?: string
  vocabularyEntryId?: string
  verb?: VerbFormHitDto | null
}

export const TRANSLATE_POLL_MS = 2000
// Худший случай по таймаутам моделей — 175 секунд: классификатор 10, аналитик 25 и не больше 140
// на составление глагола со всеми кругами (TranslationAgent:GenerationTotalSeconds).
export const TRANSLATE_POLL_LIMIT_MS = 180_000

export interface ProgressDto {
  xp: number
  streak: number
  lastPlayedAtUtc: string | null
  completedLessons: Record<string, number[]>
  xpSpent?: number
  totalTreatsGiven?: number
  lastFedAtUtc?: string | null
  lastTreatIndex?: number | null
}

export interface MeResponse {
  authenticated: boolean
  language?: string
  vocabularyCount?: number
  level?: string | null
  progress?: ProgressDto
  isPro?: boolean
  isTrialActive?: boolean
  trialDaysLeft?: number
  shouldShowReferralExtensionCta?: boolean
  isOwner?: boolean
  telegramId?: number
  hasAccess?: boolean
  subscriptionPlan?: string | null
  subscribedUntil?: string | null
  notificationsEnabled?: boolean
  /** Active contextual-onboarding hint key (or null/absent). See OnboardingNudge. */
  onboardingHint?: string | null
  /** Одноразовые подсказки интерфейса, которые человек уже видел (см. verbs/ui/hints.ts). */
  uiHintsSeen?: string[]
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
  audioUrl?: string
  /** Разбор глагольной формы, если слово или фраза её содержит. */
  verb?: VerbFormHitDto | null
}

export interface VocabularyListResponse {
  language: string
  items: VocabularyItem[]
  starterItems: VocabularyItem[]
  /** «Мои глаголы»: по одному на глагол — из словаря и начатые в игре. */
  verbs?: import('./verbs/types').MyVerbDto[]
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

  setNotifications: (enabled: boolean) =>
    request<{ notificationsEnabled: boolean }>('/api/miniapp/notifications', {
      method: 'POST',
      body: JSON.stringify({ enabled })
    }),


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

  recordAnswer: (payload: { correct: boolean }) =>
    request<LessonCompleteResponse>('/api/miniapp/progress/answer', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  markOnboardingHintSeen: (hintKey: string) =>
    request<{ ok: boolean }>('/api/miniapp/onboarding/hint-seen', {
      method: 'POST',
      body: JSON.stringify({ hintKey })
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

  // Глагол, которого нет ни в базе, ни в источнике, модели составляют до минуты. Сервер не держит
  // запрос (прокси оборвёт его): отвечает pending, и ответ забирается опросом translate/status.
  // onPending вызывается, пока ответа нет; true — ищется именно глагол.
  translateWord: async (word: string, onPending?: (verbLookup: boolean) => void): Promise<TranslateWordResponse> => {
    const init = { method: 'POST', body: JSON.stringify({ word }) }
    let r = await request<TranslateWordResponse>('/api/miniapp/translate', init)
    const deadline = Date.now() + TRANSLATE_POLL_LIMIT_MS
    let verbLookup = false
    while (r.status === 'pending') {
      verbLookup = verbLookup || !!r.verbLookup
      onPending?.(verbLookup)
      if (Date.now() >= deadline) return { status: 'timeout' }
      await new Promise((resolve) => setTimeout(resolve, TRANSLATE_POLL_MS))
      try {
        r = await request<TranslateWordResponse>('/api/miniapp/translate/status', init)
      } catch (e) {
        // Сеть моргнула или сервер перезапускается — спросим ещё раз; отказ (401, 400) ждать незачем.
        if (e instanceof ApiError && e.status < 500) throw e
      }
    }
    return r
  },

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

  feedTreat: (treatIndex: number) =>
    request<{
      ok: boolean
      xpSpent: number
      totalTreatsGiven: number
      lastFedAtUtc: string
      lastTreatIndex: number
    }>('/api/miniapp/treat', {
      method: 'POST',
      body: JSON.stringify({ treatIndex })
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
      rules: string[]
      /** Какая награда положена сейчас. */
      state?: 'trial' | 'accessEnded' | 'pro' | 'lifetime'
      bonusShortLabel: string
      /** Готовая фраза-приглашение под текущее состояние; пусто — бонус не положен. */
      inviteLine?: string
      capReached: boolean
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

  adminTestReturnPush: (body?: {
    moduleName?: string
    moduleId?: string
    lessonId?: number
    variant?: 'miss' | 'module' | 'feed' | 'earn'
  }) =>
    request<{ ok: boolean; reason?: string; sentTo?: number; variant?: string; availableXp?: number }>(
      `/api/admin/notifications/test-return-push`,
      {
        method: 'POST',
        body: JSON.stringify(body ?? {})
      }
    ),

  adminTestHolidayPush: () =>
    request<{ ok: boolean; reason?: string; sentTo?: number; count?: number; holidays?: string[] }>(
      `/api/admin/notifications/test-holiday-push`,
      { method: 'POST' }
    ),

  adminTestCoinsPush: () =>
    request<{ ok: boolean; reason?: string; sentTo?: number; availableXp?: number }>(
      `/api/admin/notifications/test-coins-push`,
      { method: 'POST' }
    ),

  adminTestStreakPush: (milestone: 7 | 30 | 100) =>
    request<{ ok: boolean; reason?: string; sentTo?: number; milestone?: number }>(
      `/api/admin/notifications/test-streak-push`,
      { method: 'POST', body: JSON.stringify({ milestone }) }
    ),

  adminBroadcastPreview: (opts: {
    activeWithinDays?: number | null
    minVocab?: number
    registeredAfterUtc?: string | null
    registeredBeforeUtc?: string | null
    proStatus?: 'active' | 'free' | null
  }) => {
    const params = new URLSearchParams()
    if (opts.activeWithinDays != null) params.set('activeWithinDays', String(opts.activeWithinDays))
    if (opts.minVocab) params.set('minVocab', String(opts.minVocab))
    if (opts.registeredAfterUtc) params.set('registeredAfterUtc', opts.registeredAfterUtc)
    if (opts.registeredBeforeUtc) params.set('registeredBeforeUtc', opts.registeredBeforeUtc)
    if (opts.proStatus) params.set('proStatus', opts.proStatus)
    return request<{ totalRecipients: number; sampleTelegramIds: number[] }>(
      `/api/admin/broadcast/preview?${params}`
    )
  },
  adminBroadcast: (body: {
    activeWithinDays?: number | null
    minVocabularyCount?: number
    registeredAfterUtc?: string | null
    registeredBeforeUtc?: string | null
    proStatus?: 'active' | 'free' | null
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

// ── Глаголы ──────────────────────────────────────────────────────────────────

export function fetchVerb(id: string) {
  return request<VerbDto>(`/api/miniapp/verbs/${encodeURIComponent(id)}`)
}

export function parseVerbForm(form: string) {
  return request<{ hits: VerbFormHitDto[] }>(`/api/miniapp/verbs/parse?form=${encodeURIComponent(form)}`)
}

// ── Глаголы: прогресс форм ───────────────────────────────────────────────────
import type { VerbProgressDto, VerbProgressStepDto } from './verbs/ladder/types'

/**
 * Сохранить ступени форм без сессии — только чтобы дослать ответы, застрявшие на устройстве
 * (session/sync.ts). В сессии ответы уходят вместе с её отчётом. Повторная отправка ничего не ломает.
 */
export function saveVerbProgress(id: string, forms: VerbProgressStepDto[]) {
  return request<VerbProgressDto>(`/api/miniapp/verbs/${encodeURIComponent(id)}/progress`, {
    method: 'POST',
    body: JSON.stringify({ forms }),
    keepalive: true
  })
}

/** Комиксы глагола: реплики уже подставлены сервером из каталога. Пустой список, если историй нет. */
export function fetchVerbStories(id: string) {
  return request<{ stories: import('./verbs/story/types').VerbStoryDto[] }>(`/api/miniapp/verbs/${encodeURIComponent(id)}/stories`)
}

// ── Сессии по глаголу: уровень, память постановщика, начатая сессия ──
import type { VerbLearningDto, VerbSessionReportDto, VerbSessionSavedDto } from './verbs/session/types'

/** Всё, что нужно виду глагола и постановщику сессии: прогресс форм, уровень, что уже играли. */
/** Раздел «Глаголы» одним запросом: уровни, наборы, свои глаголы и «что делать сейчас». Доступен и без триала/Pro — как обзор. */
export function fetchVerbSection() {
  return request<import('./verbs/section/types').VerbSectionDto>('/api/miniapp/verbs/section')
}

/** Раздел открыли: плиткой с главной (home), кнопкой рассылки (имя кампании) или по ссылке с меткой. */
export function reportVerbSectionOpen(source: string) {
  return request<{ ok: boolean }>('/api/miniapp/verbs/section/open', { method: 'POST', body: JSON.stringify({ source }) })
}

/** Семья глаголов с формами всех её членов и вступлением из урока о приставках. */
export function fetchVerbFamily(id: string) {
  return request<import('./verbs/family/types').FamilyDto>(`/api/miniapp/verbs/families/${encodeURIComponent(id)}`)
}

export function fetchVerbLearning(id: string) {
  return request<VerbLearningDto>(`/api/miniapp/verbs/${encodeURIComponent(id)}/learning`)
}

/** Где сейчас сессия (после каждого ответа) и — один раз — что она закончена. Повторная отправка безвредна. */
export function saveVerbSession(id: string, report: VerbSessionReportDto) {
  return request<VerbSessionSavedDto>(`/api/miniapp/verbs/${encodeURIComponent(id)}/session`, {
    method: 'POST',
    body: JSON.stringify(report),
    keepalive: true
  })
}

/** Одноразовая подсказка интерфейса показана (ключ `ui:…`) — тем же запросом, что и подсказки онбординга. */
export function markUiHintSeen(hintKey: string) {
  return request<{ ok: boolean }>('/api/miniapp/onboarding/hint-seen', {
    method: 'POST',
    body: JSON.stringify({ hintKey })
  })
}

// ── Рассылка-кампания (админка владельца) и отметка «открыл по кнопке из рассылки» ──

export interface FeedbackOptionCount {
  option: string
  count: number
}

export type CampaignAudience = 'accessEnded' | 'onTrial' | 'paying' | 'proLapsed' | 'owner' | 'activeLately' | 'inactiveLong'

export interface CampaignStatusDto {
  key: string
  audience: CampaignAudience
  message: string
  buttonText: string | null
  buttonQuery: string | null
  total: number
  sample: number
  pending: number
  sent: number
  blocked: number
  rejected: number
  unknown: number
  opened: number
  /** Опрос: кнопки первого вопроса (он приходит в бот) и сколько человек выбрали каждую. У обычной кампании пусто. */
  surveyAnswers?: FeedbackOptionCount[]
  /** Опрос: его форма целиком — по ней конструктор возвращается к начатому опросу. */
  survey?: SurveyFormDto | null
  /** Подарок кампании: сколько дней доступа получает открывший кнопку; 0 — подарка нет. */
  giftDays: number
  /** До какого момента открытие ещё даёт подарок. */
  giftOfferEndsAtUtc: string | null
  gifted: number
  playedVerbSession: number
  finishedVerbSession: number
  paidAfterOpen: number
}

export interface CampaignPrepareDto {
  key: string
  dryRun: boolean
  audienceTotal: number
  alreadyInCampaign: number
  picked: number
  leftForLater: number
}

export const adminCampaigns = {
  audiences: () => request<Record<CampaignAudience, number>>('/api/admin/campaigns/audiences'),
  /** Выбрать получателей (или только посчитать, если dryRun). Ничего не отправляет. */
  prepare: (body: {
    key: string
    audience: CampaignAudience
    message?: string
    buttonText: string | null
    buttonQuery: string | null
    sampleSize: number | null
    dryRun: boolean
    giftDays?: number
    giftOfferDays?: number | null
    /** Опрос: форма из вопросов (первый уходит кнопками под сообщением, остальные — в мини-аппе). Пусто — обычная кампания. */
    survey?: SurveyFormDto | null
    /** Конструктор начинает новый опрос: при пустом key сервер сам называет кампанию и возвращает имя в ответе. */
    newSurveySlug?: string | null
  }) => request<CampaignPrepareDto>('/api/admin/campaigns/prepare', { method: 'POST', body: JSON.stringify(body) }),
  /** Отправить следующую порцию уже выбранных получателей. */
  send: (key: string, limit: number) =>
    request<{ sent: number; blocked: number; rejected: number; unknown: number; retryAfterSeconds: number; status: CampaignStatusDto }>(
      `/api/admin/campaigns/${encodeURIComponent(key)}/send`,
      { method: 'POST', body: JSON.stringify({ limit }) }
    ),
  status: (key: string) => request<CampaignStatusDto>(`/api/admin/campaigns/${encodeURIComponent(key)}`)
}

/** Основное время, которого нет в таблице глагола от нейросети, и почему. */
export interface MissingTenseDto {
  tense: string
  /** verb-lacks-it — модель сказала, что у глагола такого времени нет; not-sure — модель не дала формы. */
  why: 'verb-lacks-it' | 'not-sure' | 'removed-by-owner'
  note?: string | null
  /** Проверяющая модель уверена, что время у глагола есть. */
  reviewerDisagrees: boolean
}

export interface ModelMadeVerbDto {
  lemma: string
  title: string
  translation: string
  askedText: string
  approvedAtUtc: string
  learners: number
  /** Сколько из шести основных времён есть в таблице. */
  mainTenses: number
  missingTenses: MissingTenseDto[]
  completedTenses: string[]
  /** Сколько основных времён проверено — столько и учат ученики. */
  verifiedMainTenses: number
  unverifiedTenses: UnverifiedTenseDto[]
  /** Доводы проверяющей модели, когда она одобряла запись. */
  reviewerReasons: string[]
  generatorModel: string
  reviewerModel: string
  /** Все строки таблицы глагола по порядку карточки. */
  tenses: VerbTenseRowDto[]
  /** Когда владелец отметил глагол проверенным целиком; null — не отмечен. */
  ownerApprovedAtUtc?: string | null
}

/** Строка таблицы глагола от нейросети, как её видит владелец. */
export interface VerbTenseRowDto {
  tense: string
  cells: (string | null)[]
  inTexts: (boolean | null)[]
  phrases?: string[] | null
  unverified: boolean
  completed: boolean
}

/** Время глагола от нейросети, которое ничем, кроме самой модели, не подтверждено. */
export interface UnverifiedTenseDto {
  tense: string
  /** Шесть клеток: я, ты, он, мы, вы, они; null — клетка пустая. */
  cells: (string | null)[]
  /** По клеткам: встречается ли форма в настоящих текстах; null — клетка пустая или данных нет. */
  inTexts: (boolean | null)[]
  phrases?: string[] | null
  /** Время дописано вторым кругом. */
  completed: boolean
  /** Владелец уже убирал это время, пересборка вернула его. */
  removedBefore: boolean
}

export interface RegenerateVerbDto {
  outcome: 'replaced' | 'kept'
  reason?: string | null
  mainTensesBefore: number
  mainTensesAfter: number
  missing?: MissingTenseDto[] | null
  changedForms?: string[] | null
}

const reviewTense = (action: 'confirm' | 'edit' | 'remove', body: object) =>
  request<{ ok: boolean; progressReset: number }>(`/api/admin/verbs/tense/${action}`, { method: 'POST', body: JSON.stringify(body) })

export const adminVerbs = {
  /** Глаголы, которые составила нейросеть. */
  modelMade: (onlyUnverified = false) =>
    request<{ count: number; verbs: ModelMadeVerbDto[] }>(`/api/admin/verbs/model-made${onlyUnverified ? '?unverified=true' : ''}`),
  /** Проверка одного времени владельцем: подтвердить, записать клетки руками или убрать время. */
  confirmTense: (lemma: string, tense: string) => reviewTense('confirm', { lemma, tense }),
  editTense: (lemma: string, tense: string, cells: (string | null)[]) => reviewTense('edit', { lemma, tense, cells }),
  removeTense: (lemma: string, tense: string) => reviewTense('remove', { lemma, tense }),
  /** Составить глагол заново; запись заменяется, только если новая одобрена и не беднее прежней. До пары минут. */
  /** evenIfApproved — явное слово владельца для глагола, отмеченного проверенным: отметка при замене снимется. */
  regenerate: (lemma: string, evenIfApproved = false) =>
    request<RegenerateVerbDto>('/api/admin/verbs/regenerate', { method: 'POST', body: JSON.stringify({ lemma, evenIfApproved }) }),
  /** «Глагол проверен»: для учеников он становится обычным проверенным глаголом. confirmAll — вместе с непроверенными временами. */
  approve: (lemma: string, confirmAll = false) =>
    request<{ ok: boolean; progressReset?: number }>('/api/admin/verbs/approve', { method: 'POST', body: JSON.stringify({ lemma, confirmAll }) }),
  unapprove: (lemma: string) =>
    request<{ ok: boolean; progressReset?: number }>('/api/admin/verbs/unapprove', { method: 'POST', body: JSON.stringify({ lemma }) })
}

/** Подарок рассылки: дни полного доступа, отсчёт с момента открытия. Приходит один раз — в ответе на то открытие, которое его выдало. */
export interface CampaignGiftDto {
  days: number
  accessUntilUtc: string
}

export function reportCampaignOpen(key: string) {
  return request<{ ok: boolean; gift?: CampaignGiftDto | null }>('/api/miniapp/campaign-open', { method: 'POST', body: JSON.stringify({ key }) })
}

// ── Обратная связь: «Что остановило?» на экране покупки, «Написать автору», ответы для владельца ──

export const FEEDBACK_MAX_LENGTH = 2000

/** Варианты ответа на «Что остановило?» — на сервер уходит код, человеку показываем подпись. */
export const PAYWALL_DECLINE_OPTIONS = [
  { id: 'expensive', label: 'Дорого' },
  { id: 'not_now', label: 'Пока не нужно' },
  { id: 'unclear', label: 'Не понял, что получу' },
  { id: 'other', label: 'Другое' }
] as const

export type PaywallDeclineOption = (typeof PAYWALL_DECLINE_OPTIONS)[number]['id']

export const feedback = {
  /** Экран покупки открылся: есть ли вопрос, который стоит задать, если его закроют не купив. Ничего не записывает. */
  paywallQuestionDue: () => request<{ due: boolean }>('/api/miniapp/feedback/paywall-question'),
  /** Экран покупки закрыли не купив. Сервер решает, показывать ли вопрос (раз в 30 дней), и запоминает показ. */
  paywallQuestion: () => request<{ show: boolean; id: string | null }>('/api/miniapp/feedback/paywall-question', { method: 'POST' }),
  paywallAnswer: (id: string, option: PaywallDeclineOption, text: string) =>
    request<{ ok: boolean }>('/api/miniapp/feedback/paywall-answer', { method: 'POST', body: JSON.stringify({ id, option, text }) }),
  /** «Написать автору». campaign — имя опроса, из которого пришли кнопкой «Написать подробнее». */
  send: (text: string, campaign?: string | null) =>
    request<{ ok: boolean }>('/api/miniapp/feedback', { method: 'POST', body: JSON.stringify({ text, campaign: campaign ?? null }) })
}

export interface AdminFeedbackItem {
  kind: 'paywall' | 'survey' | 'message'
  campaignKey: string | null
  questionId?: string | null
  option: string | null
  text: string | null
  atUtc: string
  telegramId: number
}

/** Вопрос опроса. id даёт сервер («q1», «q2»… по порядку), когда опрос заведён. */
export interface SurveyQuestionDto {
  id?: string
  text: string
  /** choice — выбор одного варианта, text — свободный ответ. */
  kind: 'choice' | 'text'
  options: string[]
  /** У вопроса с вариантами есть ещё «Другое» с полем для своего ответа. */
  allowOther: boolean
  /** Главная цифра вопроса: доля этого варианта среди ответивших, не считая выбравших headlineWithout. */
  headlineOption?: string | null
  headlineWithout?: string | null
}

export interface SurveyFormDto {
  /** Короткая строка перед первым вопросом в сообщении бота. */
  intro: string | null
  questions: SurveyQuestionDto[]
}

/** Ответ на один вопрос: вариант, либо «Другое» со своими словами, либо просто текст. */
export interface SurveyAnswerDto {
  option: string | null
  other: boolean
  text: string | null
}

/** Форма опроса глазами получателя (мини-апп): вопросы и то, что человек уже ответил. */
export const surveyApi = {
  open: (key: string) =>
    request<{ key: string; survey: SurveyFormDto; finished: boolean; answers: Record<string, SurveyAnswerDto> }>(
      `/api/miniapp/surveys/${encodeURIComponent(key)}/open`, { method: 'POST' }),
  answer: (key: string, questionId: string, answer: SurveyAnswerDto) =>
    request<{ ok: boolean }>(`/api/miniapp/surveys/${encodeURIComponent(key)}/answer`, { method: 'POST', body: JSON.stringify({ questionId, ...answer }) }),
  finish: (key: string) => request<{ ok: boolean }>(`/api/miniapp/surveys/${encodeURIComponent(key)}/finish`, { method: 'POST' })
}

/** Воронка опроса: получили → ответили на первый вопрос → открыли форму в мини-аппе → дошли до конца. */
export interface SurveyFunnelDto {
  sent: number
  answeredFirst: number
  openedForm: number
  finished: number
}

export interface AdminSurveyDto {
  key: string
  /** Первый вопрос — по нему владелец узнаёт опрос. */
  title: string
  /** Сколько в опросе вопросов. */
  questions: number
  createdAtUtc: string
  audience: CampaignAudience
  /** Сколько получателей выбрано на сегодня. */
  picked: number
  /** Из них ещё ждут отправки: больше нуля — отправку бросили посередине, к опросу можно вернуться. */
  pending: number
  funnel: SurveyFunnelDto
}

export interface AdminSurveyQuestionDto {
  id: string
  text: string
  kind: 'choice' | 'text'
  /** Сколько человек ответили на вопрос (в выбранном разрезе). */
  answered: number
  options: FeedbackOptionCount[]
  headline: { option: string; without: string | null; chose: number; of: number } | null
  /** Что написали: «Другое» со словами и ответы на вопрос без вариантов. */
  texts: AdminFeedbackItem[]
}

export interface AdminSurveyResultsDto {
  summary: AdminSurveyDto
  /** Вариант первого вопроса, по которому сужены вопросы; null — все. */
  segment: string | null
  questions: AdminSurveyQuestionDto[]
  /** Сообщения по кнопке «Написать подробнее» из этого опроса. */
  written: AdminFeedbackItem[]
}

export interface AdminFeedbackDto {
  recent: AdminFeedbackItem[]
  /** shown — сколько раз вопрос показали, с ответом или без. */
  paywall: { shown: number; options: FeedbackOptionCount[] }
  /** Сколько всего сообщений написали автору. */
  messages: number
  /** Опросы, отправленные людям, новые сверху (пробные «только себе» сюда не попадают). */
  surveys: AdminSurveyDto[]
}

/** Готовая форма для конструктора: вопросы и варианты уже написаны. */
export interface SurveyPresetDto {
  id: string
  title: string
  about: string
  form: SurveyFormDto
}

export interface SurveyLimitsDto {
  questions: number
  options: number
  /** Первый вопрос приходит в бот кнопками — вариантов у него меньше. */
  botOptions: number
  optionLength: number
  questionLength: number
}

export interface SurveyBuilderKitDto {
  presets: SurveyPresetDto[]
  /** Готовые вопросы, которые можно добавить в свою форму. */
  bank: SurveyQuestionDto[]
  suggestions: string[]
  intro: string
  otherLabel: string
  limits: SurveyLimitsDto
}

export const adminSurveys = {
  presets: () => request<SurveyBuilderKitDto>('/api/admin/surveys/presets')
}

export const adminFeedback = {
  /** recent можно сузить до одного вида ответов и/или одного опроса; счётчики всегда целиком. */
  overview: (only: { kind?: AdminFeedbackItem['kind']; campaign?: string; take?: number } = {}) => {
    const params = new URLSearchParams({ take: String(only.take ?? 100) })
    if (only.kind) params.set('kind', only.kind)
    if (only.campaign) params.set('campaign', only.campaign)
    return request<AdminFeedbackDto>(`/api/admin/feedback?${params}`)
  },
  /** Один опрос: воронка и ответы по вопросам. segment — вариант первого вопроса: остальные вопросы считаются только у выбравших его. */
  survey: (key: string, segment?: string | null) =>
    request<AdminSurveyResultsDto>(`/api/admin/feedback/surveys/${encodeURIComponent(key)}${segment ? `?segment=${encodeURIComponent(segment)}` : ''}`)
}
