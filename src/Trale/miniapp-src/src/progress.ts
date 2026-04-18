import { ProgressState } from './types'
import { ProgressDto } from './api'

export const defaultProgress: ProgressState = {
  xp: 0,
  streak: 0,
  completedLessons: {},
  lastPlayedDate: null,
  xpSpent: 0,
  totalTreatsGiven: 0,
  lastFedAtUtc: null,
  lastTreatIndex: null
}

export function progressFromDto(dto: ProgressDto): ProgressState {
  return {
    xp: dto.xp,
    streak: dto.streak,
    completedLessons: dto.completedLessons ?? {},
    lastPlayedDate: dto.lastPlayedAtUtc ? dto.lastPlayedAtUtc.slice(0, 10) : null,
    xpSpent: dto.xpSpent ?? 0,
    totalTreatsGiven: dto.totalTreatsGiven ?? 0,
    lastFedAtUtc: dto.lastFedAtUtc ?? null,
    lastTreatIndex: dto.lastTreatIndex ?? null
  }
}
