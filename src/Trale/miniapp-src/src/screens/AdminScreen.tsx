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
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'recent_signup' | 'recent_activity' | 'vocab_count'>('recent_activity')
  const [usersLoading, setUsersLoading] = useState(false)

  // Initial load: stats + chart + first batch of users
  useEffect(() => {
    let cancelled = false
    Promise.all([api.adminStats(), api.adminSignups(days)])
      .then(([s, sig]) => {
        if (cancelled) return
        setStats(s)
        setSignups(sig.points)
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

  // Users list: reload when search or sort changes (debounced search)
  useEffect(() => {
    let cancelled = false
    setUsersLoading(true)
    const timer = setTimeout(() => {
      api
        .adminRecentUsers({ limit: 50, search: search || undefined, sort })
        .then((rec) => {
          if (cancelled) return
          setUsers(rec.users)
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setUsersLoading(false)
        })
    }, search ? 250 : 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [search, sort])

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

            {/* Broadcast & Grant — owner only one-off campaign tool */}
            <BroadcastPanel />

            {/* Users with search + sort */}
            <div className="flex items-center justify-between mb-2">
              <div className="mn-eyebrow">Юзеры ({users.length})</div>
              <div className="flex gap-1">
                <button
                  onClick={() => setSort('recent_activity')}
                  className={`px-2 py-1 rounded font-sans text-[10px] font-bold border-[1.5px] ${
                    sort === 'recent_activity'
                      ? 'bg-jewelInk text-cream border-jewelInk'
                      : 'bg-cream text-jewelInk-mid border-jewelInk/25'
                  }`}
                >
                  активность
                </button>
                <button
                  onClick={() => setSort('recent_signup')}
                  className={`px-2 py-1 rounded font-sans text-[10px] font-bold border-[1.5px] ${
                    sort === 'recent_signup'
                      ? 'bg-jewelInk text-cream border-jewelInk'
                      : 'bg-cream text-jewelInk-mid border-jewelInk/25'
                  }`}
                >
                  регистрация
                </button>
                <button
                  onClick={() => setSort('vocab_count')}
                  className={`px-2 py-1 rounded font-sans text-[10px] font-bold border-[1.5px] ${
                    sort === 'vocab_count'
                      ? 'bg-jewelInk text-cream border-jewelInk'
                      : 'bg-cream text-jewelInk-mid border-jewelInk/25'
                  }`}
                >
                  слова
                </button>
              </div>
            </div>
            <input
              type="search"
              inputMode="numeric"
              placeholder="Поиск по Telegram ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full mb-3 px-3 py-2 rounded border-[1.5px] border-jewelInk/40 bg-cream font-sans text-[13px] text-jewelInk placeholder:text-jewelInk-hint focus:outline-none focus:border-jewelInk"
            />
            {usersLoading && (
              <div className="text-center font-sans text-[11px] text-jewelInk-mid mb-2">
                Загружаем…
              </div>
            )}
            <div className="flex flex-col gap-2">
              {users.map((u) => (
                <UserRow
                  key={u.telegramId}
                  u={u}
                  onClick={() => navigate({ kind: 'admin-user', telegramId: u.telegramId })}
                />
              ))}
              {!usersLoading && users.length === 0 && (
                <div className="text-center font-sans text-[12px] text-jewelInk-mid py-6">
                  ничего не найдено
                </div>
              )}
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

function BroadcastPanel() {
  const [minVocab, setMinVocab] = useState(10)
  const [useActivity, setUseActivity] = useState(false)
  const [days, setDays] = useState(365)
  const [grantPlan, setGrantPlan] = useState<string>('Lifetime')
  const [includeMiniAppButton, setIncludeMiniAppButton] = useState(true)
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<{ totalRecipients: number; sampleTelegramIds: number[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  function segmentSummary() {
    const parts: string[] = []
    if (minVocab > 0) parts.push(`словарь ≥ ${minVocab}`)
    if (useActivity) parts.push(`активные за ${days}д`)
    if (parts.length === 0) parts.push('все юзеры')
    return parts.join(' + ')
  }

  function buildBody(dryRun: boolean) {
    return {
      activeWithinDays: useActivity ? days : null,
      minVocabularyCount: minVocab,
      message,
      grantPlan: grantPlan || null,
      dryRun,
      includeMiniAppButton
    }
  }

  async function doPreview() {
    setBusy(true)
    setResult(null)
    try {
      const p = await api.adminBroadcastPreview({
        activeWithinDays: useActivity ? days : null,
        minVocab
      })
      setPreview(p)
    } catch {
      setResult('preview failed')
    } finally {
      setBusy(false)
    }
  }

  async function doDryRun() {
    if (!message.trim()) {
      setResult('пустое сообщение')
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const r = await api.adminBroadcast(buildBody(true))
      setResult(`dry-run: получателей ${r.totalRecipients} (никому не отправлено)`)
    } catch (e: any) {
      setResult(`ошибка: ${e?.message ?? 'unknown'}`)
    } finally {
      setBusy(false)
    }
  }

  async function doSend() {
    if (!message.trim()) {
      setResult('пустое сообщение')
      return
    }
    if (!confirm(
      `ОТПРАВИТЬ?\nСегмент: ${segmentSummary()}\n` +
      (grantPlan ? `+ выдать Pro план: ${grantPlan}\n` : '') +
      (includeMiniAppButton ? '+ кнопка «Открыть TraleBot» в сообщении\n' : '') +
      `Сообщение длиной ${message.length} символов.\n\n` +
      'Это РЕАЛЬНАЯ отправка через бота.'
    )) return

    setBusy(true)
    setResult(null)
    try {
      const r = await api.adminBroadcast(buildBody(false))
      setResult(`✓ отправлено ${r.sent}/${r.totalRecipients}, выдано Pro: ${r.granted}, ошибок: ${r.failed}`)
    } catch (e: any) {
      setResult(`ошибка: ${e?.message ?? 'unknown'}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-5">
      <div className="mn-eyebrow mb-2">📢 Broadcast (one-off)</div>
      <div className="jewel-tile px-4 py-4">
        <div className="relative z-[1] flex flex-col gap-3">
          {/* Min vocabulary filter — primary "wake dormant users" knob */}
          <div className="flex gap-2 items-center">
            <label className="font-sans text-[12px] text-jewelInk-mid">слов в словаре ≥</label>
            <input
              type="number"
              min={0}
              max={1000}
              value={minVocab}
              onChange={(e) => setMinVocab(parseInt(e.target.value) || 0)}
              className="w-20 px-2 py-1 rounded border-[1.5px] border-jewelInk/40 font-sans text-[13px] tabular-nums"
            />
          </div>

          {/* Optional activity filter */}
          <label className="flex gap-2 items-center">
            <input
              type="checkbox"
              checked={useActivity}
              onChange={(e) => setUseActivity(e.target.checked)}
            />
            <span className="font-sans text-[12px] text-jewelInk-mid">+ активные за</span>
            <input
              type="number"
              min={1}
              max={365}
              value={days}
              disabled={!useActivity}
              onChange={(e) => setDays(parseInt(e.target.value) || 30)}
              className="w-16 px-2 py-1 rounded border-[1.5px] border-jewelInk/40 font-sans text-[13px] tabular-nums disabled:opacity-50"
            />
            <span className="font-sans text-[12px] text-jewelInk-mid">дней</span>
          </label>

          <div className="flex justify-between items-center">
            <span className="font-sans text-[11px] text-jewelInk-mid">
              сегмент: <strong className="text-jewelInk">{segmentSummary()}</strong>
            </span>
            <button
              onClick={doPreview}
              disabled={busy}
              className="px-3 py-1 rounded font-sans text-[11px] font-bold border-[1.5px] border-jewelInk/40 active:opacity-70"
            >
              preview
            </button>
          </div>

          {preview && (
            <div className="font-sans text-[11px] text-jewelInk-mid">
              получателей: <strong className="text-jewelInk">{preview.totalRecipients}</strong>
              {preview.sampleTelegramIds.length > 0 && (
                <div className="mt-1 truncate">
                  пример: {preview.sampleTelegramIds.slice(0, 5).join(', ')}
                  {preview.totalRecipients > 5 && ' …'}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="font-sans text-[12px] text-jewelInk-mid">выдать Pro план (опц.)</label>
            <select
              value={grantPlan}
              onChange={(e) => setGrantPlan(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 rounded border-[1.5px] border-jewelInk/40 font-sans text-[13px] bg-cream"
            >
              <option value="">— без granta —</option>
              <option value="Month">1 месяц</option>
              <option value="Quarter">3 месяца</option>
              <option value="HalfYear">6 месяцев</option>
              <option value="Year">1 год</option>
              <option value="Lifetime">Навсегда</option>
            </select>
          </div>

          <label className="flex gap-2 items-center">
            <input
              type="checkbox"
              checked={includeMiniAppButton}
              onChange={(e) => setIncludeMiniAppButton(e.target.checked)}
            />
            <span className="font-sans text-[12px] text-jewelInk-mid">кнопка «🚀 Открыть TraleBot» в сообщении</span>
          </label>

          <div>
            <label className="font-sans text-[12px] text-jewelInk-mid">сообщение</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={4000}
              placeholder="Текст сообщения для рассылки…"
              className="w-full mt-1 px-2 py-2 rounded border-[1.5px] border-jewelInk/40 font-sans text-[13px] bg-cream text-jewelInk"
            />
            <div className="font-sans text-[10px] text-jewelInk-hint text-right mt-0.5">
              {message.length} / 4000
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={doDryRun}
              disabled={busy}
              className="flex-1 font-sans text-[13px] font-bold py-2 rounded border-[1.5px] border-jewelInk/40 active:opacity-70"
            >
              dry-run
            </button>
            <button
              onClick={doSend}
              disabled={busy}
              className="flex-1 font-sans text-[13px] font-extrabold text-cream py-2 rounded border-[1.5px] border-jewelInk active:opacity-70"
              style={{ background: '#b54e5e', boxShadow: '0 2px 0 #15100A' }}
            >
              {busy ? '…' : 'РЕАЛЬНО ОТПРАВИТЬ'}
            </button>
          </div>

          {result && (
            <div className="font-sans text-[11px] text-jewelInk text-center">
              {result}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime()
  const diff = Date.now() - d
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'только что'
  if (min < 60) return `${min}м назад`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}ч назад`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}д назад`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}н назад`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}мес назад`
  return `${Math.floor(days / 365)}г назад`
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

function UserRow({ u, onClick }: { u: AdminRecentUser; onClick: () => void }) {
  const reg = new Date(u.registeredAtUtc)
  const regStr = reg.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
  const activeStr = u.lastActivityUtc ? relativeTime(u.lastActivityUtc) : '—'
  return (
    <button
      onClick={onClick}
      className="jewel-tile jewel-pressable text-left px-3 py-2 flex items-center gap-3 w-full"
    >
      <div className="relative z-[1] flex-1 min-w-0">
        <div className="font-sans text-[12px] font-extrabold text-jewelInk tabular-nums">
          {u.telegramId}
        </div>
        <div className="font-sans text-[10px] text-jewelInk-mid">
          активн: {activeStr} · рег: {regStr} · 📖 {u.vocabularyCount}
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
      <span className="relative z-[1] text-jewelInk-hint text-[12px] shrink-0">→</span>
    </button>
  )
}
