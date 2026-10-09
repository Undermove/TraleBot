import { useEffect, useState, useSyncExternalStore } from 'react'
import { adminSections, ApiError, type AdminOverviewDto } from '../../api'
import { currentTab, isFocused, selectTab, watchFocus, type AdminTab } from '../../admin/adminNav'
import { TAB_BAR_HEIGHT } from './AdminPage'
import type { Screen } from '../../types'

// Нижняя панель админки: пять вкладок верхнего уровня с подписанными значками, текущая выделена, на
// вкладке — счётчик того, что в ней ждёт владельца. Панель прячется в сфокусированном режиме (пошаговый
// сценарий) и когда открыта клавиатура, чтобы не закрывать поле ввода.

const INK = '#15100A'
const icon = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: INK, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const ICONS: Record<AdminTab, (fill: string) => JSX.Element> = {
  stats: fill => (<svg {...icon}><rect x="4" y="12" width="4" height="8" rx="1" fill={fill} /><rect x="10" y="7" width="4" height="13" rx="1" fill={fill} /><rect x="16" y="4" width="4" height="16" rx="1" fill={fill} /></svg>),
  people: fill => (<svg {...icon}><circle cx="9" cy="8.500" r="3.500" fill={fill} /><path d="M2.500 20a6.500 6.500 0 0 1 13 0z" fill={fill} /><path d="M16 5.500a3.500 3.500 0 0 1 0 6.500M18.500 14.500a6 6 0 0 1 3 5.500" /></svg>),
  feedback: fill => (<svg {...icon}><path d="M4 5.500h16v11h-9l-4.500 3.500v-3.500H4z" fill={fill} /><path d="M8 9.500h8M8 12.500h5" /></svg>),
  broadcasts: fill => (<svg {...icon}><path d="M4 10v4h3l8 4.500v-13L7 10z" fill={fill} /><path d="M18 9.500a4 4 0 0 1 0 5" /></svg>),
  more: fill => (<svg {...icon}><circle cx="5.500" cy="12" r="1.800" fill={fill} /><circle cx="12" cy="12" r="1.800" fill={fill} /><circle cx="18.500" cy="12" r="1.800" fill={fill} /></svg>)
}
const TABS: { id: AdminTab; name: string }[] = [
  { id: 'stats', name: 'Статистика' }, { id: 'people', name: 'Люди' }, { id: 'feedback', name: 'Связь' }, { id: 'broadcasts', name: 'Рассылки' }, { id: 'more', name: 'Ещё' }
]

/** Сколько ждёт владельца в каждой вкладке. */
export function waitsIn(o: AdminOverviewDto | null): Partial<Record<AdminTab, number>> {
  if (!o) return {}
  return { feedback: o.unansweredMessages + o.unfinishedSurveys, broadcasts: o.unfinishedBroadcasts, more: o.verbsToReview }
}

/** Открыта ли клавиатура: фокус в поле ввода или окно заметно ниже обычного. */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes((el as HTMLInputElement).type)))
    const onIn = (e: FocusEvent) => { if (typing(e.target)) setOpen(true) }
    const onOut = () => setTimeout(() => setOpen(typing(document.activeElement)), 0)
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => { document.removeEventListener('focusin', onIn); document.removeEventListener('focusout', onOut) }
  }, [])
  return open
}

interface Props {
  /** Экран, который сейчас открыт, — по его смене панель перечитывает счётчики. */
  screen: Screen
  navigate: (s: Screen) => void
}

export default function AdminTabBar({ screen, navigate }: Props) {
  const focused = useSyncExternalStore(watchFocus, isFocused)
  const keyboard = useKeyboardOpen()
  const [overview, setOverview] = useState<AdminOverviewDto | null>(null)
  const active = currentTab()

  /** Сервер ответил «не владелец» — разделов такому человеку не показываем. */
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    adminSections.overview().then(setOverview).catch(e => { if (e instanceof ApiError && e.status === 404) setDenied(true) })
  }, [screen.kind])

  if (focused || keyboard || denied) return null
  const waits = waitsIn(overview)
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 max-w-[480px] mx-auto bg-cream border-t-[1.5px] border-jewelInk" aria-label="Разделы админки" data-testid="admin-tabs"
      style={{ paddingBottom: 'var(--safe-b)' }}>
      <div className="flex" style={{ height: TAB_BAR_HEIGHT }}>
        {TABS.map(t => {
          const on = t.id === active
          return (
            <button key={t.id} type="button" role="tab" aria-selected={on} onClick={() => navigate(selectTab(t.id))} data-testid={`admin-tab-${t.id}`}
              className="relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5">
              <span className="relative">
                {ICONS[t.id](on ? '#F5B820' : '#FDFAEF')}
                {(waits[t.id] ?? 0) > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-ruby text-white font-sans text-[11px] font-extrabold tabular-nums flex items-center justify-center"
                    data-testid={`admin-tab-badge-${t.id}`}>{waits[t.id]}</span>
                )}
              </span>
              <span className={`font-sans text-[11px] leading-none truncate max-w-full ${on ? 'font-extrabold text-jewelInk' : 'font-bold text-jewelInk-mid'}`}>{t.name}</span>
              {on && <span className="absolute top-0 left-3 right-3 h-[3px] rounded-b bg-jewelInk" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
