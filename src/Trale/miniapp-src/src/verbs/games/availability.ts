import type { VerbDto } from '../types'
import { canPlayBones } from './boneField'
import { canPlayBuilder } from './formParts'
import { canPlayTimeMachine } from './timeRounds'

export type GameId = 'time' | 'bones' | 'builder'

const RULES: [GameId, (verb: VerbDto) => boolean][] = [
  ['time', canPlayTimeMachine],
  ['bones', canPlayBones],
  ['builder', canPlayBuilder]
]

/**
 * Какие игры можно предложить для глагола. Решается только по данным карточки:
 * проверенный статус, русский перевод и формы, из которых игра собирается без догадок.
 */
export const availableGames = (verb: VerbDto): GameId[] => RULES.filter(([, can]) => can(verb)).map(([id]) => id)
