import React, { useEffect, useState } from 'react'
import { fetchVerbsSummary } from '../api'
import type { CatalogDto, ProgressState, Screen } from '../types'
import { pickVerbsLine, type VerbsSummaryDto } from './dashboardLine'

interface Props {
  catalog: CatalogDto
  progress: ProgressState
  /** Триал или Pro: без него глаголы закрыты, строку не показываем и сводку не запрашиваем. */
  hasAccess: boolean
  onboardingActive: boolean
  navigate: (s: Screen) => void
}

/** Тихая строка про глаголы под блоком «что дальше» на главной. Логика выбора — в dashboardLine.ts. */
export default function VerbsDashboardLine({ catalog, progress, hasAccess, onboardingActive, navigate }: Props) {
  const [summary, setSummary] = useState<VerbsSummaryDto | null>(null)

  useEffect(() => {
    if (!hasAccess) return
    let cancelled = false
    fetchVerbsSummary().then(s => { if (!cancelled) setSummary(s) }).catch(() => {})
    return () => { cancelled = true }
  }, [hasAccess])

  const newcomer = !catalog.modules.some(m => (progress.completedLessons[m.id] ?? []).length > 0)
  const line = pickVerbsLine({ summary: hasAccess ? summary : null, newcomer, onboardingActive })
  if (!line) return null

  return (
    <button
      onClick={() => navigate(line.screen)}
      data-testid="dashboard-verbs-line"
      className="mt-3 w-full px-1 flex items-center justify-center gap-1.5 text-[13px] text-jewelInk-mid active:opacity-70"
    >
      <span className="min-w-0">{line.text}</span>
      <span className="shrink-0 font-bold text-navy">→</span>
    </button>
  )
}
