import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StreakHeatmap, mondayFirstColumn, activeDaysInWindow } from '../Profile'

// Mirror of Profile's localDateKey (not exported) — yyyy-MM-dd in local time.
function key(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

describe('mondayFirstColumn', () => {
  it('maps Monday to column 0 and Sunday to column 6', () => {
    expect(mondayFirstColumn(new Date(2026, 5, 15))).toBe(0) // Mon 2026-06-15
    expect(mondayFirstColumn(new Date(2026, 5, 18))).toBe(3) // Thu
    expect(mondayFirstColumn(new Date(2026, 5, 21))).toBe(6) // Sun
  })
})

describe('activeDaysInWindow', () => {
  it('counts only distinct local days inside the window', () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const threeAgo = new Date(today)
    threeAgo.setDate(today.getDate() - 3)
    const wayBack = new Date(today)
    wayBack.setDate(today.getDate() - 100)

    const set = new Set([key(today), key(threeAgo), key(wayBack)])
    expect(activeDaysInWindow(set, 35)).toBe(2) // wayBack is outside the 35-day window
  })

  it('returns 0 for an empty set', () => {
    expect(activeDaysInWindow(new Set<string>(), 35)).toBe(0)
  })
})

describe('StreakHeatmap weekday alignment', () => {
  it("places today's cell under the column matching its real weekday", () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayKey = key(today)

    const { container } = render(
      <StreakHeatmap activityDates={new Set([todayKey])} days={35} />
    )

    const todayCell = container.querySelector(`[title="${todayKey}"]`)
    expect(todayCell).not.toBeNull()

    const row = todayCell!.parentElement!
    const columnIndex = Array.from(row.children).indexOf(todayCell as Element)

    // The bug was today always landing in the last (Sunday) column regardless of
    // the real weekday. Now it must sit under its actual weekday column.
    expect(columnIndex).toBe(mondayFirstColumn(today))
  })

  it('renders a 7-column header and 7-wide rows', () => {
    const { container } = render(
      <StreakHeatmap activityDates={new Set<string>()} days={35} />
    )
    const flexRows = container.querySelectorAll(':scope > div > div.flex')
    // header + at least 5 week rows, each exactly 7 cells wide
    expect(flexRows.length).toBeGreaterThanOrEqual(6)
    flexRows.forEach((r) => expect(r.children.length).toBe(7))
  })
})
