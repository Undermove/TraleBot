import type { VerbDto } from '../types'
import { buildItems, type LadderItem, type Progress } from '../ladder/engine'
import { toProgress } from '../ladder/progressStore'
import { boneRows, canPlayBones } from '../games/boneField'
import { canPlayBuilder } from '../games/formParts'
import { canPlayTimeMachine } from '../games/timeRounds'
import type { VerbStoryDto } from '../story/types'
import type { PlanContext } from './plan'
import type { VerbLearningDto } from './types'

// Из ответов сервера — то, что нужно постановщику сессии (plan.ts).

/** Что глагол поддерживает: решается только по данным карточки и её комиксам. */
export function capabilities(verb: VerbDto, stories: VerbStoryDto[]): PlanContext['can'] {
  const story = stories[0]
  return {
    time: canPlayTimeMachine(verb),
    boneRows: canPlayBones(verb) ? boneRows(verb) : [],
    builder: canPlayBuilder(verb),
    story: story
      ? { id: story.id, frames: story.frames.length, forms: [...new Set(story.frames.map(f => `${f.target.tense}:${f.target.person}`))] }
      : null
  }
}

export function planContext(
  verb: VerbDto, learning: VerbLearningDto, stories: VerbStoryDto[],
  items: LadderItem[] = buildItems(verb), progress: Progress = toProgress(learning.progress.forms)
): PlanContext {
  return { items, progress, level: learning.level, can: capabilities(verb, stories), learner: learning.learner, memory: learning.memory }
}
