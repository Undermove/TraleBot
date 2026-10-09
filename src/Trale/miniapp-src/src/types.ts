export type Screen =
  | { kind: 'loading' }
  | { kind: 'onboarding' }
  | { kind: 'welcome' }
  | { kind: 'dashboard' }
  | { kind: 'module'; moduleId: string }
  | { kind: 'lesson-theory'; moduleId: string; lessonId: number }
  | { kind: 'practice'; moduleId: string; lessonId: number }
  | {
      kind: 'result'
      moduleId: string
      lessonId: number
      correct: number
      total: number
      xpEarned: number
      wrongQuestions?: QuizQuestion[]
      /** Глаголы, которые встретились в уроке, — для строки на итоге (verbs/lesson/LessonVerbsLine). */
      verbs?: import('./verbs/types').VerbFormHitDto[]
    }
  | { kind: 'practice-mistakes'; moduleId: string; lessonId: number; wrongQuestions: QuizQuestion[] }
  | {
      kind: 'mistakes-result'
      moduleId: string
      lessonId: number
      corrected: number
      total: number
      remainingWrong: QuizQuestion[]
    }
  /** Раздел «Глаголы». source — метка, с которой пришли (кампания рассылки, ссылка); без неё — плитка на главной. */
  | { kind: 'verbs'; source?: string }
  | { kind: 'profile' }
  /** Форма опроса-рассылки: вопросы по одному на странице. key — имя опроса из ссылки ?screen=survey&s=… */
  | { kind: 'survey'; key: string }
  /** «Написать автору». campaign — имя опроса, из которого пришли кнопкой «Написать подробнее»; from — куда вернуться. */
  | { kind: 'feedback'; campaign?: string; from?: 'profile' }
  | { kind: 'admin' }
  /** Подразделы админки (только владелец): рассылка, конструктор опроса, отзывы. */
  | { kind: 'admin-broadcast' }
  /** resume — имя начатого опроса: открыть сразу его отправку (шаг 4), чтобы дослать. */
  | { kind: 'admin-survey'; resume?: string }
  /** view — что открыто: список (по умолчанию), один опрос, ответы с экрана покупки, все, кто что-то написал, или переписка с одним человеком. */
  | { kind: 'admin-feedback'; view?: FeedbackView | FeedbackThreadView }
  | { kind: 'admin-user'; telegramId: number }
  /** Проверка глаголов от нейросети (только владелец). lemma — сразу открыть этот глагол. */
  | { kind: 'verb-review'; lemma?: string }
  | { kind: 'vocabulary-list'; filter?: 'verbs'; verb?: import('./verbs/deepLink').VerbLink }
  | { kind: 'vocabulary-quiz'; mode: 'all' | 'new' | 'weak' | 'custom' | 'starter'; wordIds?: string[] }

export type FeedbackView = { survey: string } | 'paywall' | 'threads'
/** Переписка с человеком. quote — текст, на который отвечают; back — откуда пришли, туда и «Назад». */
export interface FeedbackThreadView { thread: number; quote?: string; back?: FeedbackView }

export interface QuizQuestion {
  id: string
  lemma: string
  question: string
  options: string[]
  answerIndex: number
  explanation: string
  questionType?: 'choice' | 'type' | 'audio-choice' | 'sentence-builder'
  audioUrl?: string | null
  transcript?: string | null
  // sentence-builder specific
  targetSentence?: { ru: string }
  level?: number
  correctOrder?: string[]
  chipPool?: string[]
  presetPositions?: Array<{ position: number; token: string }>
  hints?: Record<string, string>
  /** Глагол из каталога, о котором вопрос (сервер размечает только при триале/Pro). */
  verb?: import('./verbs/types').VerbFormHitDto | null
}

export interface ProgressState {
  xp: number
  streak: number
  completedLessons: Record<string, number[]>
  lastPlayedDate: string | null
  xpSpent: number
  totalTreatsGiven: number
  lastFedAtUtc: string | null
  lastTreatIndex: number | null
}

// Catalog — comes from /api/miniapp/content
export interface CatalogDto {
  botUsername: string
  miniAppEnabled: boolean
  modules: ModuleDto[]
}

export interface ModuleDto {
  id: string
  title: string
  emoji: string
  description: string
  lessons: LessonDto[]
}

export interface LessonDto {
  id: number
  title: string
  short: string
  theory: LessonTheoryDto
}

export interface LessonTheoryDto {
  title: string
  goal: string
  blocks: TheoryBlockDto[]
}

export interface TheoryBlockDto {
  type: 'paragraph' | 'list' | 'example' | 'letters'
  text?: string
  items?: string[]
  ge?: string
  ru?: string
  letters?: AlphabetLetterDto[]
}

export interface AlphabetLetterDto {
  letter: string
  name: string
  translit: string
  exampleGe: string
  exampleRu: string
}

// Modules that require Pro access. Free modules: alphabet-progressive, verbs-of-movement, my-vocabulary.
export const PRO_MODULE_IDS: ReadonlySet<string> = new Set([
  'intro', 'numbers',
  'pronouns', 'present-tense', 'cases', 'postpositions', 'adjectives',
  'cafe', 'shopping', 'taxi', 'doctor', 'emergency',
  'verb-classes', 'version-vowels', 'preverbs', 'imperfect', 'aorist',
  'pronoun-declension', 'conditionals', 'imperative',
])
