import { useEffect, useRef, useState } from 'react'
import AdminPage, { Empty, More, phaseOf, type AdminPhase } from '../components/admin/AdminPage'
import { adminSections, type AdminUserFilter, type AdminUserRowDto, type AdminUserSort, type AdminUsersPageDto } from '../api'
import { ACCESS, ago, dayYear, sourceName } from '../admin/words'
import type { Screen } from '../types'

// Пользователи: поиск по Telegram id (имён и юзернеймов бот не хранит), фильтр по доступу, порядок,
// список страницами. Тап по строке — карточка человека.

const FILTERS: { id: AdminUserFilter; name: string }[] = [
  { id: 'all', name: 'все' },
  { id: 'paying', name: 'платят' },
  { id: 'trial', name: 'пробный период' },
  { id: 'accessEnded', name: 'доступ закончился' },
  { id: 'blocked', name: 'заблокировали бота' }
]
const SORTS: { id: AdminUserSort; name: string }[] = [
  { id: 'activity', name: 'недавно занимались' },
  { id: 'registered', name: 'недавно пришли' },
  { id: 'words', name: 'больше слов' }
]
const PAGE = 30
const chip = (on: boolean) => `px-3 min-h-[44px] rounded-xl border-2 font-sans text-[13px] font-bold tabular-nums whitespace-nowrap ${on ? 'border-jewelInk bg-cream-tile text-jewelInk' : 'border-jewelInk/20 bg-white text-jewelInk-mid'}`

interface Props {
  filter?: AdminUserFilter
  navigate: (s: Screen) => void
}

export default function AdminUsersScreen({ filter: initial = 'all', navigate }: Props) {
  const [phase, setPhase] = useState<AdminPhase>('loading')
  const [filter, setFilter] = useState<AdminUserFilter>(initial)
  const [sort, setSort] = useState<AdminUserSort>('activity')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState<AdminUsersPageDto | null>(null)
  const [users, setUsers] = useState<AdminUserRowDto[]>([])
  const [busy, setBusy] = useState(false)
  /** Ответ на устаревший запрос (человек уже набрал дальше) не должен перезаписать свежий. */
  const asked = useRef(0)

  const load = (skip: number) => {
    const mine = ++asked.current
    setBusy(true)
    adminSections.users({ search: search.trim() || undefined, filter, sort, skip, take: PAGE })
      .then(r => {
        if (mine !== asked.current) return
        setPage(r)
        setUsers(skip === 0 ? r.users : [...users, ...r.users])
        setPhase('ready')
      })
      .catch(e => { if (mine === asked.current) setPhase(phaseOf(e)) })
      .finally(() => { if (mine === asked.current) setBusy(false) })
  }
  useEffect(() => {
    const timer = setTimeout(() => load(0), search ? 250 : 0)
    return () => clearTimeout(timer)
  }, [filter, sort, search]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AdminPage title="Пользователи" onBack={() => navigate({ kind: 'admin' })} phase={phase} onRetry={() => { setPhase('loading'); load(0) }} testId="admin-users">
      <input
        type="search" inputMode="numeric" value={search} onChange={e => setSearch(e.target.value)} aria-label="Поиск по Telegram id"
        placeholder="Поиск по Telegram id"
        className="w-full mb-1 px-3 min-h-[48px] rounded-xl border-[1.5px] border-jewelInk bg-white font-sans text-[15px] text-jewelInk tabular-nums"
      />
      <div className="font-sans text-[11px] text-jewelInk-hint mb-3">Имён и юзернеймов бот не хранит — искать можно только по номеру.</div>

      <div className="flex flex-wrap gap-2 pb-2" role="radiogroup" aria-label="Кого показать" data-testid="users-filters">
        {FILTERS.map(f => (
          <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className={chip(filter === f.id)} onClick={() => setFilter(f.id)}>
            {f.name}{page ? ` · ${page.counts[f.id]}` : ''}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 pb-3" role="radiogroup" aria-label="Порядок">
        {SORTS.map(s => (
          <button key={s.id} type="button" role="radio" aria-checked={sort === s.id} className={chip(sort === s.id)} onClick={() => setSort(s.id)}>{s.name}</button>
        ))}
      </div>

      {page && <div className="font-sans text-[12px] text-jewelInk-mid tabular-nums mb-2" data-testid="users-total">Найдено: {page.total}</div>}
      {page && users.length === 0 && <Empty>Никого не нашлось. Попробуй другой фильтр или номер.</Empty>}
      <div className="flex flex-col gap-2" data-testid="users-list">
        {users.map(u => (
          <button key={u.telegramId} type="button" onClick={() => navigate({ kind: 'admin-user', telegramId: u.telegramId })}
            className="jewel-tile jewel-pressable w-full text-left px-4 py-3 min-h-[56px]" data-testid={`user-${u.telegramId}`}>
            <div className="relative z-[1]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-sans text-[15px] font-extrabold text-jewelInk tabular-nums">{u.telegramId}</span>
                <span className={`shrink-0 px-2 py-0.5 rounded-lg font-sans text-[12px] font-extrabold ${u.access === 'paying' ? 'bg-gold text-jewelInk' : 'bg-jewelInk/10 text-jewelInk'}`}>{ACCESS[u.access]}</span>
              </div>
              <div className="font-sans text-[12px] text-jewelInk-mid tabular-nums mt-0.5">
                занятия: {ago(u.lastActivityUtc)} · с {dayYear(u.registeredAtUtc)} · слов: {u.vocabularyCount}
              </div>
              <div className="font-sans text-[12px] text-jewelInk-mid break-words">
                откуда: {sourceName(u.acquisitionSource)}{!u.isActive && <span className="text-ruby font-bold"> · заблокировал бота</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
      {page && <More shown={users.length} total={page.total} busy={busy} onMore={() => load(users.length)} />}
    </AdminPage>
  )
}
