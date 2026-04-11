import { ProgressState } from './types'
import { ProgressDto } from './api'

export const defaultProgress: ProgressState = {
  xp: 0,
  streak: 0,
  completedLessons: {},
  lastPlayedDate: null
}

export function progressFromDto(dto: ProgressDto): ProgressState {
  return {
    xp: dto.xp,
    streak: dto.streak,
    completedLessons: dto.completedLessons ?? {},
    lastPlayedDate: dto.lastPlayedAtUtc ? dto.lastPlayedAtUtc.slice(0, 10) : null
  }
}
