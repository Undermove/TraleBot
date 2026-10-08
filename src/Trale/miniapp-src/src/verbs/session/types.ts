import type { ProgressDto } from '../../api'
import type { TenseKey } from '../types'
import type { TaskKind } from '../ladder/engine'
import type { VerbProgressDto } from '../ladder/types'

// Сессия — 2–3 минуты игры с одним глаголом: несколько коротких сцен, которые приложение подбирает само.

/** Виды сцен. Те же имена знает сервер (VerbLearningService.SceneTypes). */
export type SceneType = 'story' | 'meet' | 'pick' | 'time' | 'bones' | 'builder' | 'phrases' | 'warmup' | 'exam'
  // Сессия про приставку у глагола из семьи (family/prefixPlan.ts): вступление, игра, проверка.
  | 'prefixintro' | 'prefix' | 'prefixcheck'
export const QUIZ_SCENES: SceneType[] = ['meet', 'pick', 'phrases', 'warmup', 'exam']

/** Уровень знания глагола. Считает сервер (VerbLevelRules), здесь — только названия. */
export type VerbLevelKey = 'new' | 'meeting' | 'recognising' | 'phrases' | 'examReady' | 'learned'
export const LEVEL_ORDER: VerbLevelKey[] = ['new', 'meeting', 'recognising', 'phrases', 'examReady', 'learned']
export const LEVEL_NAMES: Record<VerbLevelKey, string> = {
  new: 'новый',
  meeting: 'знакомлюсь',
  recognising: 'узнаю',
  phrases: 'собираю фразы',
  examReady: 'готов к экзамену',
  learned: 'выучен'
}

export interface PlannedTask { kind: TaskKind; key: string }

export interface PlannedScene {
  type: SceneType
  /** Сколько шагов сцена занимает на полоске сессии. */
  units: number
  /** Оценка длительности в секундах — по ней держим сессию в 2–3 минутах. */
  seconds: number
  /** Сцены-квизы: задания по порядку. */
  tasks?: PlannedTask[]
  /** «Машина времени»: клетки (`время:лицо`) по раундам. */
  targets?: string[]
  /** «Косточки»: строки и столбцы маленького поля. */
  tenses?: TenseKey[]
  persons?: number[]
  /** «Конструктор»: сколько слов собрать и с какой ступени сложности начать (0, 3, 6 — см. formParts.stageFor). */
  rounds?: number
  solvedBefore?: number
  /** Комикс. */
  storyId?: string
  /** Сцены про приставку: семья и раунды (кого спросить, в какой клетке, из кого выбирать). */
  familyId?: string
  prefixRounds?: import('../family/prefixPlan').PrefixRound[]
  /** Можно ли в сцене просить печатать по-грузински. */
  typing: boolean
  /** Почему сцена попала в сессию — для тестов и отладки, человеку не показывается. */
  reason: string
}

export interface SessionPlan { v: 1; scenes: PlannedScene[] }

export interface LearnerDto {
  level: string | null
  canType: boolean
  dictionarySize: number
  dictionaryVerbs: number
  verbsLearned: number
}

export interface VerbMemoryDto {
  sessionsPlayed: number
  /** Прошлые сессии, от старых к новым: виды сцен через «+» («meet+time»). */
  recentScenes: string[]
  storyCompleted: boolean
  examPassed: boolean
}

/** GET /api/miniapp/verbs/{id}/learning */
export interface VerbLearningDto {
  progress: VerbProgressDto
  level: VerbLevelKey
  memory: VerbMemoryDto
  learner: LearnerDto
  /** Начатая и не доигранная сессия. */
  session: { id: string; plan: SessionPlan; scene: number; done: number } | null
  /** Глагол из семьи: кто он в ней и выучен ли основной. Нет — обычный глагол. */
  family?: import('../family/types').FamilyLearningDto | null
}

/** Ответ POST /api/miniapp/verbs/{id}/session */
export interface VerbSessionSavedDto {
  state: VerbLearningDto
  xpEarned: number
  /** Опыт и серия пользователя после начисления — тем же видом, что в /me. */
  progress: ProgressDto | null
}

/** Что уходит на сервер после каждого ответа. */
export interface VerbSessionReportDto {
  sessionId: string
  plan?: SessionPlan
  scene: number
  done: number
  forms: import('../ladder/types').VerbProgressStepDto[]
  finished: boolean
  scenes: SceneType[]
  storyCompleted: boolean
  examAsked: number
  examCorrect: number
}
