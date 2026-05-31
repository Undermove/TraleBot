export type Screen =
  | { kind: 'loading' }
  | { kind: 'onboarding' }
  | { kind: 'dashboard' }
  | { kind: 'module'; moduleId: string }
  | { kind: 'lesson-theory'; moduleId: string; lessonId: number; fromDeepLink?: boolean }
  | { kind: 'practice'; moduleId: string; lessonId: number }
  | {
      kind: 'result'
      moduleId: string
      lessonId: number
      correct: number
      total: number
      xpEarned: number
      wrongQuestions?: QuizQuestion[]
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
  | { kind: 'profile' }
  | { kind: 'admin' }
  | { kind: 'admin-user'; telegramId: number }
  | { kind: 'vocabulary-list' }
  | { kind: 'vocabulary-quiz'; mode: 'all' | 'new' | 'weak' | 'custom' | 'starter'; wordIds?: string[] }

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
  alternativeAnswers?: string[][]
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

export interface VerbalAspectTableCellDto {
  ge?: string
  translit?: string
  ru?: string
  disabled?: boolean
  placeholderText?: string
}

export interface TheoryBlockDto {
  type: 'paragraph' | 'list' | 'example' | 'letters' | 'verbal-aspect-table'
  text?: string
  items?: string[]
  ge?: string
  ru?: string
  letters?: AlphabetLetterDto[]
  rowHeaders?: string[]
  colHeaders?: string[]
  cells?: VerbalAspectTableCellDto[]
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
