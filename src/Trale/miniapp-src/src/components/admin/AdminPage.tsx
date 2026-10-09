import type { ReactNode } from 'react'
import Header from '../Header'
import LoaderLetter from '../LoaderLetter'
import { ApiError } from '../../api'

// Общая обвязка экранов админки: одна шапка с «Назад», одни и те же состояния — загрузка, нет доступа,
// ошибка с «Попробовать ещё раз», пусто. Экран отдаёт сюда содержимое и говорит, в каком он состоянии.

export type AdminPhase = 'loading' | 'ready' | 'denied' | 'error'

/** Чем закончилась загрузка: 404 от админского эндпоинта значит «ты не владелец». */
export const phaseOf = (e: unknown): AdminPhase => (e instanceof ApiError && e.status === 404 ? 'denied' : 'error')

interface Props {
  title: string
  /** Раздел, в котором экран: «админка», «админка · люди». */
  section?: string
  onBack: () => void
  phase?: AdminPhase
  onRetry?: () => void
  testId?: string
  children?: ReactNode
}

export default function AdminPage({ title, section = 'админка', onBack, phase = 'ready', onRetry, testId, children }: Props) {
  return (
    <div className="flex flex-col min-h-full bg-cream" data-testid={testId}>
      <Header onBack={onBack} eyebrow={section} title={title} />
      <div className="flex-1 px-5 pt-4" style={{ paddingBottom: 'calc(var(--safe-b) + 32px)' }}>
        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-2 py-12" data-testid="admin-loading">
            <LoaderLetter />
            <div className="font-sans text-[13px] text-jewelInk-mid">Загружаем…</div>
          </div>
        )}
        {phase === 'denied' && <div className="font-sans text-[14px] text-jewelInk" data-testid="admin-denied">Нет доступа.</div>}
        {phase === 'error' && (
          <div className="flex flex-col gap-3" data-testid="admin-error">
            <div className="font-sans text-[14px] text-jewelInk">Не получилось загрузить. Проверь связь.</div>
            {onRetry && (
              <button type="button" onClick={onRetry} className="min-h-[48px] px-4 rounded-xl border-[1.5px] border-jewelInk font-sans text-[15px] font-extrabold text-jewelInk">
                Попробовать ещё раз
              </button>
            )}
          </div>
        )}
        {phase === 'ready' && children}
      </div>
    </div>
  )
}

/** «Здесь пока пусто» — одной строкой, везде одинаково. */
export const Empty = ({ children }: { children: ReactNode }) => (
  <div className="font-sans text-[13px] text-jewelInk-mid py-4" data-testid="admin-empty">{children}</div>
)

/** Число с подписью — плитка обзора. */
export function Figure({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="jewel-tile px-3 py-3">
      <div className="relative z-[1]">
        <div className="font-sans text-[24px] font-extrabold text-jewelInk tabular-nums leading-none">{value}</div>
        <div className="font-sans text-[12px] text-jewelInk-mid mt-1 leading-snug">{label}</div>
        {note && <div className="font-sans text-[11px] text-jewelInk-hint tabular-nums">{note}</div>}
      </div>
    </div>
  )
}

/** Красная метка «ждёт внимания». */
export const Badge = ({ children, testId }: { children: ReactNode; testId?: string }) => (
  <span className="ml-2 px-2 py-0.5 rounded-lg bg-ruby text-white font-sans text-[12px] font-extrabold tabular-nums align-middle whitespace-nowrap" data-testid={testId}>
    {children}
  </span>
)

/** Плитка-переход: название, пояснение, справа стрелка. */
export function NavTile({ name, about, badge, onOpen, testId }: { name: string; about?: string; badge?: ReactNode; onOpen: () => void; testId?: string }) {
  return (
    <button type="button" onClick={onOpen} data-testid={testId} className="jewel-tile jewel-pressable w-full text-left px-4 py-3 min-h-[56px]">
      <div className="relative z-[1] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-sans text-[15px] font-extrabold text-jewelInk">{name}{badge}</div>
          {about && <div className="font-sans text-[12px] text-jewelInk-mid mt-0.5">{about}</div>}
        </div>
        <span aria-hidden className="text-jewelInk-hint text-[14px] shrink-0">→</span>
      </div>
    </button>
  )
}

/** «Показать ещё» под длинным списком. */
export function More({ shown, total, busy, onMore }: { shown: number; total: number; busy: boolean; onMore: () => void }) {
  if (shown >= total) return null
  return (
    <button type="button" onClick={onMore} disabled={busy} data-testid="admin-more"
      className="w-full min-h-[48px] mt-3 rounded-xl border-[1.5px] border-jewelInk/40 bg-white font-sans text-[14px] font-bold text-jewelInk disabled:opacity-50">
      {busy ? 'Загружаем…' : `Показать ещё · ${shown} из ${total}`}
    </button>
  )
}
