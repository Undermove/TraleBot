import { describe, it, expect } from 'vitest'
import { findZone, scheduledText, wallToUtc } from './schedule'

describe('время отправки рассылки', () => {
  it.each([
    ['2026-11-28', '12:00', 'Asia/Tbilisi', '2026-11-28T08:00:00.000Z'],
    ['2026-11-28', '12:00', 'Europe/Moscow', '2026-11-28T09:00:00.000Z'],
    ['2026-11-28', '12:00', 'Europe/Berlin', '2026-11-28T11:00:00.000Z'],
    ['2026-07-01', '12:00', 'Europe/Berlin', '2026-07-01T10:00:00.000Z'],
    ['2026-12-01', '00:30', 'Asia/Tbilisi', '2026-11-30T20:30:00.000Z'],
    ['2026-11-28', '9:05', 'UTC', '2026-11-28T09:05:00.000Z']
  ])('%s %s by the clock of %s is %s', (date, time, zone, utc) => {
    expect(wallToUtc(date, time, zone)!.toISOString()).toBe(utc)
  })

  it.each([['2026-11-31', '12:00'], ['2026-11-28', '24:00'], ['', '12:00'], ['2026-11-28', '']])('there is no such day or time: %s %s', (date, time) => {
    expect(wallToUtc(date, time, 'Asia/Tbilisi')).toBeNull()
  })

  it('shows the moment back by the clock of the zone it was set in', () => {
    expect(scheduledText('2026-11-28T08:00:00Z', 'Asia/Tbilisi')).toBe('28.11.2026 12:00 (Тбилиси)')
    expect(scheduledText('2026-11-28T08:00:00Z', 'Europe/Berlin')).toBe('28.11.2026 09:00 (Берлин)')
    expect(scheduledText('2026-11-28T08:00:00Z', null)).toBe('28.11.2026 08:00 (UTC)')
  })

  it('finds a zone by its Russian name or its id', () => {
    expect(findZone('тбилиси')).toBe('Asia/Tbilisi')
    expect(findZone('Europe/Paris')).toBe('Europe/Paris')
    expect(findZone('Марс')).toBeNull()
  })
})
