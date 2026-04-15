export type Screen =
  | { kind: 'loading' }
  | { kind: 'onboarding' }
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
    }
  | { kind: 'profile' }
  | { kind: 'vocabulary-list' }
  | { kind: 'vocabulary-quiz'; mode: 'all' | 'new' | 'weak' | 'custom' | 'starter'; wordIds?: string[] }

export interface QuizQuestion {
  id: string
  lemma: string
  question: string
  options: string[]
  answerIndex: number
  explanation: string
}

export interface ProgressState {
  xp: number
  streak: number
  completedLessons: Record<string, number[]>
  lastPlayedDate: string | null
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
  'pronoun-declension', 'conditionals',
])
