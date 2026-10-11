import type { ReactNode } from 'react'
import { ApiError } from '../../api'

// Общая обвязка экранов админки: одна шапка, одни и те же состояния — загрузка (скелетон на месте
// содержимого), нет доступа, ошибка с «Попробовать ещё раз», пусто. Снизу — место под панель вкладок;
// в сфокусированном режиме (пошаговый сценарий) вместо «Назад» — «Закрыть», а главная кнопка шага
// закреплена внизу экрана.

export type AdminPhase = 'loading' | 'ready' | 'denied' | 'error'

/** Чем закончилась загрузка: 404 от админского эндпоинта значит «ты не владелец». */
export const phaseOf = (e: unknown): AdminPhase => (e instanceof ApiError && e.status === 404 ? 'denied' : 'error')

/** Высота нижней панели вкладок — столько места под ней оставляет каждый экран. */
export const TAB_BAR_HEIGHT = 60

interface Props {
  title: string
  /** Строка над заголовком: раздел или «шаг 2 из 4». */
  section?: string
  onBack: () => void
  /** Сфокусированный режим: слева «Закрыть» вместо стрелки. */
  close?: boolean
  phase?: AdminPhase
  onRetry?: () => void
  /** Закреплено внизу экрана: главная кнопка шага. */
  footer?: ReactNode
  testId?: string
  children?: ReactNode
}

export function AdminHeader({ title, section, onBack, close }: Pick<Props, 'title' | 'section' | 'onBack' | 'close'>) {
  return (
    <div className="sticky top-0 z-30 bg-cream/95 backdrop-blur-sm" data-testid="admin-header">
      <div style={{ paddingTop: 'var(--safe-t)' }}><div className="mn-kilim" /></div>
      <div className="px-5 py-3 flex items-center gap-3">
        {close ? (
          <button type="button" onClick={onBack} data-testid="admin-close"
            className="shrink-0 min-w-[44px] h-11 px-2 font-sans text-[14px] font-bold text-navy underline">
            Закрыть
          </button>
        ) : (
          <button type="button" onClick={onBack} aria-label="Назад"
            className="shrink-0 w-11 h-11 rounded-xl bg-cream-tile border-[1.5px] border-jewelInk flex items-center justify-center active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-75"
            style={{ boxShadow: '2px 2px 0 #15100A' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M10 3 L4 8 L10 13" stroke="#15100A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div className="flex-1 text-center min-w-0">
          {section && <div className="mn-eyebrow text-navy mb-0.5 truncate" data-testid="admin-section">{section}</div>}
          <div className="font-sans text-[18px] font-extrabold text-jewelInk leading-tight truncate" data-testid="admin-title">{title}</div>
        </div>
        <div className={close ? 'shrink-0 min-w-[44px] px-2' : 'w-11 shrink-0'} />
      </div>
    </div>
  )
}

/** Серые плашки на месте будущего содержимого — экран не прыгает, когда оно загрузится. */
export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2 animate-pulse" data-testid="admin-loading" aria-label="Загружаем">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="h-[72px] rounded-[14px] bg-jewelInk/10" />)}
    </div>
  )
}

export default function AdminPage({ title, section = 'админка', onBack, close, phase = 'ready', onRetry, footer, testId, children }: Props) {
  return (
    <div className="flex-1 flex flex-col min-h-full bg-cream" data-testid={testId}>
      <AdminHeader title={title} section={section} onBack={onBack} close={close} />
      <div className="flex-1 px-5 pt-4" style={{ paddingBottom: `calc(var(--safe-b) + ${close ? 24 : TAB_BAR_HEIGHT + 24}px)` }}>
        {phase === 'loading' && <Skeleton />}
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
      {footer && phase === 'ready' && (
        <div className="sticky bottom-0 z-20 bg-cream/95 backdrop-blur-sm border-t border-jewelInk/15 px-5 pt-3" data-testid="admin-footer"
          style={{ paddingBottom: 'calc(var(--safe-b) + 12px)' }}>
          {footer}
        </div>
      )}
    </div>
  )
}

/** Переключатель подразделов под шапкой: один из нескольких. */
export function Segments<T extends string>({ items, value, onChange, label }: { items: { id: T; name: string; badge?: number }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div className="flex rounded-xl border-[1.5px] border-jewelInk bg-white p-0.5 mb-4" role="tablist" aria-label={label} data-testid="admin-segments">
      {items.map(i => (
        <button key={i.id} type="button" role="tab" aria-selected={value === i.id} onClick={() => onChange(i.id)}
          className={`flex-1 min-h-[44px] px-1 rounded-[10px] font-sans text-[13px] font-bold leading-tight ${value === i.id ? 'bg-jewelInk text-cream' : 'text-jewelInk'}`}>
          {i.name}
          {i.badge ? <span className={`ml-1 px-1.5 rounded-md text-[11px] font-extrabold tabular-nums ${value === i.id ? 'bg-cream text-jewelInk' : 'bg-ruby text-white'}`}>{i.badge}</span> : null}
        </button>
      ))}
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
