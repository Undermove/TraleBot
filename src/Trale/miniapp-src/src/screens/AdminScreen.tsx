import React, { useEffect, useState } from 'react'
import Header from '../components/Header'
import LoaderLetter from '../components/LoaderLetter'
import { ProgressState, Screen } from '../types'
import { api, AdminStats, AdminRecentUser } from '../api'

interface Props {
  progress: ProgressState
  navigate: (s: Screen) => void
}

type Phase = 'loading' | 'ready' | 'forbidden' | 'error'

export default function AdminScreen({ progress, navigate }: Props) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [signups, setSignups] = useState<{ date: string; count: number }[]>([])
  const [users, setUsers] = useState<AdminRecentUser[]>([])
  const [days, setDays] = useState<7 | 30 | 90>(30)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.adminStats(), api.adminSignups(days), api.adminRecentUsers(20)])
      .then(([s, sig, rec]) => {
        if (cancelled) return
        setStats(s)
        setSignups(sig.points)
        setUsers(rec.users)
        setPhase('ready')
      })
      .catch((e: any) => {
        if (cancelled) return
        if (e?.status === 404) setPhase('forbidden')
        else setPhase('error')
      })
    return () => {
      cancelled = true
    }
  }, [days])

  return (
    <div className="flex flex-col min-h-full bg-cream">
      <Header
        progress={progress}
        onBack={() => navigate({ kind: 'profile' })}
        eyebrow="owner"
        title="Admin"
      />

      <div
        className="flex-1 px-5 pt-4"
        style={{ paddingBottom: 'calc(var(--safe-b) + 32px)' }}
      >
        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-2 py-12">
            <LoaderLetter />
            <div className="font-sans text-[13px] text-jewelInk-mid">Загружаем статистику…</div>
          </div>
        )}

        {phase === 'forbidden' && (
          <div className="jewel-tile px-5 py-6 text-center">
            <div className="relative z-[1] font-sans text-[14px] text-jewelInk">
              Эта страница доступна только владельцу.
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="jewel-tile px-5 py-6 text-center">
            <div className="relative z-[1] font-sans text-[14px] text-jewelInk">
              Не получилось загрузить. Попробуй обновить страницу.
            </div>
          </div>
        )}

        {phase === 'ready' && stats && (
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
            </div>

            {/* KPIs row 3: engagement */}
            <div className="mn-eyebrow mb-2">Активность</div>
            <div className="grid grid-cols-2 gap-2 mb-5">
              <Tile label="Слов в словарях" value={fmt(stats.totalVocabularyEntries)} />
              <Tile label="Слов на юзера" value={`${stats.averageVocabularyPerUser}`} />
              <Tile label="Новых сегодня" value={fmt(stats.newUsersToday)} />
              <Tile label="За неделю" value={fmt(stats.newUsersWeek)} />
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

            {/* Recent users */}
            <div className="mn-eyebrow mb-2">Последние юзеры ({users.length})</div>
            <div className="flex flex-col gap-2">
              {users.map((u) => (
                <UserRow key={u.telegramId} u={u} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function fmt(n: number): string {
  return n.toLocaleString('ru-RU')
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: 'navy' | 'ruby' | 'gold'
}) {
  const accentText =
    accent === 'navy'
      ? 'text-navy'
      : accent === 'ruby'
        ? 'text-ruby'
        : accent === 'gold'
          ? 'text-gold-deep'
          : 'text-jewelInk'
  return (
    <div className="jewel-tile px-3 py-3">
      <div className="relative z-[1]">
        <div className="mn-eyebrow text-jewelInk-mid mb-1">{label}</div>
        <div className={`font-sans text-[20px] font-extrabold tabular-nums leading-none ${accentText}`}>
          {value}
        </div>
      </div>
    </div>
  )
}

function SignupsChart({ points }: { points: { date: string; count: number }[] }) {
  if (points.length === 0) return <div className="text-center text-jewelInk-mid font-sans text-[12px]">нет данных</div>
  const w = 320
  const h = 120
  const max = Math.max(1, ...points.map((p) => p.count))
  const barW = w / points.length
  const total = points.reduce((sum, p) => sum + p.count, 0)
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
        {points.map((p, i) => {
          const barH = (p.count / max) * (h - 16)
          const x = i * barW + barW * 0.15
          const bw = barW * 0.7
          return (
            <rect
              key={p.date}
              x={x}
              y={h - barH}
              width={bw}
              height={barH}
              fill="#0d4a6e"
              rx="1.5"
            />
          )
        })}
      </svg>
      <div className="mt-1 flex justify-between font-sans text-[10px] text-jewelInk-mid">
        <span>{points[0]?.date}</span>
        <span className="font-bold">всего: {fmt(total)}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  )
}

function UserRow({ u }: { u: AdminRecentUser }) {
  const reg = new Date(u.registeredAtUtc)
  const regStr = reg.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
  return (
    <div className="jewel-tile px-3 py-2 flex items-center gap-3">
      <div className="relative z-[1] flex-1 min-w-0">
        <div className="font-sans text-[12px] font-extrabold text-jewelInk tabular-nums">
          {u.telegramId}
        </div>
        <div className="font-sans text-[10px] text-jewelInk-mid">
          рег: {regStr} · 📖 {u.vocabularyCount}
        </div>
      </div>
      {u.isPro ? (
        <span
          className="relative z-[1] shrink-0 px-2 py-0.5 rounded font-sans text-[10px] font-extrabold bg-gold text-jewelInk border border-jewelInk"
        >
          ⭐ {u.plan ?? 'Pro'}
        </span>
      ) : (
        <span className="relative z-[1] shrink-0 px-2 py-0.5 rounded font-sans text-[10px] font-bold text-jewelInk-mid border border-jewelInk/25">
          free
        </span>
      )}
    </div>
  )
}
