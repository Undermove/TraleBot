import type { TenseKey } from '../types'

// Комикс «кадр под замком»: ответ GET /api/miniapp/verbs/{id}/stories.
// Грузинский текст реплик сервер подставляет из каталога по id предложения — в файле истории его нет.

export type StoryMode = 'choose' | 'type' | 'build'

/** Форма глагола и клетка таблицы, в которой она стоит: по ней объясняем, что форма значит. */
export interface StoryFormDto {
  form: string
  tense: TenseKey
  person: number
}

export interface StoryFrameDto {
  /** Имя кадра без размера и расширения: f1 → f1-800.webp, f1-480.webp, f1-ph.webp. */
  image: string
  who: string
  scene: string
  mode: StoryMode
  /** Id предложения в Tatoeba. */
  sentenceId: number
  ka: string
  /** Перевод, который видит ученик; если ruAdapted — подогнан под сюжет, оригинал в sourceRu. */
  ru: string
  sourceRu: string
  ruAdapted: boolean
  target: StoryFormDto
  /** Варианты для режима choose; в остальных режимах пусто. */
  options: StoryFormDto[]
}

export interface VerbStoryDto {
  id: string
  verbId: string
  title: string
  /** Папка кадров внутри /stories/ — с хешем содержимого, поэтому кэшируется навсегда. */
  images: string
  frames: StoryFrameDto[]
}
