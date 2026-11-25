import { appEvents } from '../analytics/appEvents'
import type { Screen } from '../types'

// Нижняя панель приложения: четыре места, куда ходят чаще всего. «Сегодня» — одна кнопка «что делать сейчас»,
// «Курс» — все модули, «Глаголы» и «Словарь» — в один тап, а не в конце длинной ленты. Значки рисуем сами.

export const HOME_TAB_BAR_HEIGHT = 60

export type HomeTab = 'today' | 'course' | 'verbs' | 'vocab'

const INK = '#15100A'
const icon = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: INK, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const ICONS: Record<HomeTab, (fill: string) => JSX.Element> = {
  // Солнце над горизонтом: сегодняшний день.
  today: fill => (<svg {...icon}><path d="M6 16a6 6 0 0 1 12 0z" fill={fill} /><path d="M3 16h18M12 4.5v2.5M5.2 7.7l1.7 1.7M18.8 7.7l-1.7 1.7M3.5 20h17" /></svg>),
  // Раскрытая книга: модули курса.
  course: fill => (<svg {...icon}><path d="M12 6.5C10 5 7 4.5 3.5 5v13c3.500-.5 6.500 0 8.500 1.500z" fill={fill} /><path d="M12 6.5c2-1.500 5-2 8.500-1.500v13c-3.500-.5-6.500 0-8.500 1.500z" fill={fill} /></svg>),
  // Буква ზ в плашке — как плитка раздела «Глаголы».
  verbs: fill => (<svg {...icon}><rect x="3.5" y="3.500" width="17" height="17" rx="4" fill={fill} /><text x="12" y="16.600" textAnchor="middle" fontSize="12" fontWeight="800" fill={INK} stroke="none" fontFamily="Noto Sans Georgian, sans-serif">ზ</text></svg>),
  // Карточки слов стопкой.
  vocab: fill => (<svg {...icon}><rect x="7" y="3.500" width="12.500" height="15" rx="2" /><rect x="4.500" y="6" width="12.500" height="14.500" rx="2" fill={fill} /><path d="M8 11h5.500M8 14.500h4" /></svg>)
}
export const TABS: { id: HomeTab; name: string; screen: Screen }[] = [
  { id: 'today', name: 'Сегодня', screen: { kind: 'dashboard' } },
  { id: 'course', name: 'Курс', screen: { kind: 'course' } },
  { id: 'verbs', name: 'Глаголы', screen: { kind: 'verbs' } },
  { id: 'vocab', name: 'Словарь', screen: { kind: 'vocabulary-list' } }
]

/** Какой вкладке принадлежит экран; null — экран без панели (урок, игра, профиль…). */
export function homeTabOf(screen: Screen): HomeTab | null {
  switch (screen.kind) {
    case 'dashboard': return 'today'
    case 'course': return 'course'
    case 'verbs': return 'verbs'
    case 'vocabulary-list': return 'vocab'
    default: return null
  }
}

interface Props {
  active: HomeTab
  navigate: (s: Screen) => void
  /** Вкладки, закрытые без доступа (словарь — только по подписке): тап открывает экран покупки. */
  locked?: ReadonlySet<HomeTab>
  onLocked?: (s: Screen) => void
}

export default function HomeTabBar({ active, navigate, locked, onLocked }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 max-w-[480px] mx-auto bg-cream border-t-[1.5px] border-jewelInk" aria-label="Разделы" data-testid="home-tabs"
      style={{ paddingBottom: 'var(--safe-b)' }}>
      <div className="flex" role="tablist" style={{ height: HOME_TAB_BAR_HEIGHT }}>
        {TABS.map(t => {
          const on = t.id === active
          return (
            <button key={t.id} type="button" role="tab" aria-selected={on} data-testid={`home-tab-${t.id}`}
              onClick={() => {
                if (on) return
                appEvents.tap(`tab-${t.id}`)
                if (locked?.has(t.id) && onLocked) onLocked(t.screen)
                else navigate(t.screen)
              }}
              className="relative flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5">
              {ICONS[t.id](on ? '#F5B820' : '#FDFAEF')}
              <span className={`font-sans text-[11px] leading-none truncate max-w-full ${on ? 'font-extrabold text-jewelInk' : 'font-bold text-jewelInk-mid'}`}>{t.name}</span>
              {on && <span className="absolute top-0 left-3 right-3 h-[3px] rounded-b bg-jewelInk" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
