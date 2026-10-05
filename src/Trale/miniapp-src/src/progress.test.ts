import { describe, it, expect, vi } from 'vitest'
import { onProgressPublished, publishProgress } from './progress'
import type { ProgressDto } from './api'

const dto: ProgressDto = { xp: 130, streak: 2, lastPlayedAtUtc: null, completedLessons: {} }

describe('published progress', () => {
  it('reaches every subscriber and stops after unsubscribing', () => {
    const app = vi.fn()
    const off = onProgressPublished(app)

    publishProgress(dto)
    off()
    publishProgress({ ...dto, xp: 140 })

    expect(app).toHaveBeenCalledTimes(1)
    expect(app).toHaveBeenCalledWith(dto)
  })
})
