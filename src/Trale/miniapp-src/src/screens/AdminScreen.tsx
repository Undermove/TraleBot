import { useEffect, useState } from 'react'
import AdminPage, { phaseOf, type AdminPhase } from '../components/admin/AdminPage'
import { SignupsChart, Tile, fmt } from '../components/admin/statTiles'
import { api, adminSections, type AdminOverviewDto, type AdminStats } from '../api'
import { adminBack } from '../admin/adminNav'
import type { Screen } from '../types'

// «Статистика» — первый экран админки, в том виде, в каком он был всегда: плитки «Пользователи»,
// «Выручка», «Активность» и график новых людей по дням. В те же сетки добавлены четыре цифры, которых
// раньше не было: оплаты за 30 дней, действующие подписки, сколько человек занимались за неделю и за сутки.

export default function AdminScreen({ navigate }: { navigate: (s: Screen) => void }) {
  const [phase, setPhase] = useState<AdminPhase>('loading')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [more, setMore] = useState<AdminOverviewDto | null>(null)
  const [signups, setSignups] = useState<{ date: string; count: number }[]>([])
  const [days, setDays] = useState<7 | 30 | 90>(30)

  const load = () => {
    setPhase('loading')
    Promise.all([api.adminStats(), api.adminSignups(days), adminSections.overview().catch(() => null)])
      .then(([s, sig, o]) => { setStats(s); setSignups(sig.points); setMore(o); setPhase('ready') })
      .catch(e => setPhase(phaseOf(e)))
  }
  useEffect(load, [days]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AdminPage title="Статистика" onBack={() => navigate(adminBack())} phase={phase} onRetry={load} testId="admin-stats">
      {stats && (
        <>
          {/* KPIs row 1: users */}
          <div className="mn-eyebrow mb-2">Пользователи</div>
          <div className="grid grid-cols-2 gap-2 mb-5">
            <Tile label="Всего" value={fmt(stats.totalUsers)} />
            <Tile label="Активных" value={fmt(stats.activeUsers)} />
            <Tile label="Pro" value={fmt(stats.proUsers)} accent="ruby" />
            <Tile label="На триале" value={fmt(stats.trialUsers)} accent="navy" />
            <Tile label="Free" value={fmt(stats.freeUsers)} />
            <Tile label="Конверсия" value={`${stats.conversionPostTrialPct}%`} accent="gold" />
          </div>

          {/* KPIs row 2: revenue */}
          <div className="mn-eyebrow mb-2">Выручка</div>
          <div className="grid grid-cols-2 gap-2 mb-5">
            <Tile label="Всего ⭐" value={fmt(stats.totalRevenueStars)} accent="gold" />
            <Tile label="За неделю ⭐" value={fmt(stats.revenueWeekStars)} accent="gold" />
            <Tile label="Покупок" value={fmt(stats.totalPurchases)} />
            <Tile label="Возвратов" value={fmt(stats.totalRefunds)} />
            {more && <Tile label="Оплат за 30 дней" value={fmt(more.payments30d)} />}
            {more && <Tile label="Подписок действует" value={fmt(more.activeSubscriptions)} accent="ruby" />}
          </div>

          {/* KPIs row 3: engagement */}
          <div className="mn-eyebrow mb-2">Активность</div>
          <div className="grid grid-cols-2 gap-2 mb-5">
            <Tile label="Слов в словарях" value={fmt(stats.totalVocabularyEntries)} />
            <Tile label="Слов на юзера" value={`${stats.averageVocabularyPerUser}`} />
            <Tile label="Новых сегодня" value={fmt(stats.newUsersToday)} />
            <Tile label="За неделю" value={fmt(stats.newUsersWeek)} />
            {more && <Tile label="Занимались сегодня" value={fmt(more.studiedToday)} accent="navy" />}
            {more && <Tile label="Занимались за неделю" value={fmt(more.studied7d)} accent="navy" />}
          </div>

          {/* Signups chart */}
          <div className="flex items-center justify-between mb-2">
            <div className="mn-eyebrow">Новые юзеры</div>
            <div className="flex gap-1">
              {([7, 30, 90] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-2 py-1 rounded font-sans text-[11px] font-bold border-[1.5px] ${
                    days === d
                      ? 'bg-jewelInk text-cream border-jewelInk'
                      : 'bg-cream text-jewelInk-mid border-jewelInk/25'
                  }`}
                >
                  {d}д
                </button>
              ))}
            </div>
          </div>
          <div className="jewel-tile px-3 py-3 mb-5">
            <div className="relative z-[1]">
              <SignupsChart points={signups} />
            </div>
          </div>
        </>
      )}
    </AdminPage>
  )
}
