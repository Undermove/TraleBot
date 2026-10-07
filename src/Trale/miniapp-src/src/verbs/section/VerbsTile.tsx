import React, { useEffect, useState } from 'react'
import type { Screen } from '../../types'
import { hintSeen } from '../ui/hints'
import { Bar } from './LevelGroup'
import { cachedSection, loadSection } from './store'
import { SECTION_OPENED_HINT } from './tour'
import { pluralVerbs, type VerbSectionDto } from './types'

/** Что сказать под названием: продолжить начатое, показать выученное или просто позвать. */
export function tileLine(section: VerbSectionDto | null): string {
  if (!section) return 'игры по 2 минуты'
  if (section.next?.kind === 'continue') return `Продолжить: «${section.next.ru}»`
  if (section.next?.kind === 'review') return `Пора повторить: «${section.next.ru}»`
  if (section.learned > 0) return `Выучено ${section.learned} из ${section.total}`
  return `${section.total} ${pluralVerbs(section.total)} · игры по 2 минуты`
}

/**
 * Плитка «Глаголы» на главной: видна всем с первого дня, без «скоро» и без условий.
 * Открывает раздел и тем, у кого доступ закончился: раздел для них — обзор, а не тупик.
 */
export default function VerbsTile({ navigate }: { navigate: (s: Screen) => void }) {
  const [section, setSection] = useState<VerbSectionDto | null>(cachedSection)

  useEffect(() => {
    let alive = true
    loadSection().then(s => { if (alive) setSection(s) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const fresh = !hintSeen(SECTION_OPENED_HINT)
  return (
    <button
      onClick={() => navigate({ kind: 'verbs' })}
      data-testid="dashboard-verbs-tile"
      className="jewel-tile jewel-pressable mt-3 w-full text-left px-4 py-4"
    >
      <div className="flex items-center gap-3.5 relative z-[1]">
        <div
          className="shrink-0 w-12 h-12 rounded-xl bg-navy border-[1.5px] border-jewelInk flex items-center justify-center"
          style={{ boxShadow: '2px 2px 0 #15100A' }}
        >
          <span className="font-geo text-[24px] font-extrabold text-cream leading-none">ზ</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-sans text-[17px] font-extrabold text-jewelInk leading-tight tracking-tight">Глаголы</h2>
            <span className="font-geo text-[10px] text-jewelInk-hint font-semibold shrink-0">ზმნები</span>
            {fresh && (
              <span className="ml-auto shrink-0 rounded-md bg-gold border border-jewelInk px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-jewelInk" data-testid="dashboard-verbs-new">
                новое
              </span>
            )}
          </div>
          <div className="mt-1 font-sans text-[12px] text-jewelInk-mid truncate" data-testid="dashboard-verbs-line">{tileLine(section)}</div>
          {section && section.learned > 0 && <div className="mt-1.5"><Bar fraction={section.learned / Math.max(1, section.total)} /></div>}
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 text-jewelInk-hint">
          <path d="M8 5 L16 12 L8 19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </button>
  )
}
