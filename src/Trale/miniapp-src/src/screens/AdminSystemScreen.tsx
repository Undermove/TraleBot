import React, { useEffect, useState } from 'react'
import AdminPage, { phaseOf, type AdminPhase } from '../components/admin/AdminPage'
import { api, adminSections, AdminStats, type AdminJobsDto } from '../api'
import type { Screen } from '../types'

// «Система» — всё служебное: подробные цифры, фоновые задачи, тестовые пуши самому себе и старая
// разовая рассылка по сегменту. Ничего здесь не уходит людям без отдельного подтверждения.

interface Props {
  navigate: (s: Screen) => void
}

const pushButton = 'px-3 min-h-[44px] rounded-xl font-sans text-[13px] font-bold border-[1.5px] bg-white text-jewelInk border-jewelInk/30 disabled:opacity-50'

export default function AdminSystemScreen({ navigate }: Props) {
  const [phase, setPhase] = useState<AdminPhase>('loading')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [jobs, setJobs] = useState<AdminJobsDto | null>(null)
  const [signups, setSignups] = useState<{ date: string; count: number }[]>([])
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushMsg, setPushMsg] = useState<string | null>(null)

  const load = () => {
    setPhase('loading')
    Promise.all([api.adminStats(), adminSections.jobs().catch(() => null)])
      .then(([s, j]) => { setStats(s); setJobs(j); setPhase('ready') })
      .catch(e => setPhase(phaseOf(e)))
  }
  useEffect(load, [])
  useEffect(() => { api.adminSignups(days).then(r => setSignups(r.points)).catch(() => {}) }, [days])

  async function push(send: () => Promise<{ ok: boolean }>, done: string) {
    setPushBusy(true)
    setPushMsg(null)
    try {
      const r = await send()
      setPushMsg(r.ok === false ? 'Уведомления выключены в профиле — пуш не отправлен (так же его пропустит и авторассылка).' : done)
    } catch (e) {
      setPushMsg('Ошибка: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <AdminPage title="Система" onBack={() => navigate({ kind: 'admin' })} phase={phase} onRetry={load} testId="admin-system">
      {stats && (
        <>
          <div className="mn-eyebrow mb-2">Фоновые задачи</div>
          <div className="jewel-tile px-4 py-3 mb-5" data-testid="system-jobs">
            <div className="relative z-[1] font-sans text-[13px] text-jewelInk tabular-nums leading-relaxed">
              {jobs ? (
                <>
                  Очередь: ждут {jobs.queue.enqueued} · по расписанию {jobs.queue.scheduled} · выполняются {jobs.queue.processing} · упали {jobs.queue.failed}
                  <br />Выполнено всего {fmt(jobs.queue.succeeded)} · серверов очереди {jobs.queue.servers}
                  <br />Переводы за сутки: ждут {jobs.translationsLast24h.pending} · готово {jobs.translationsLast24h.done} · не вышло {jobs.translationsLast24h.failed}
                </>
              ) : 'Не получилось прочитать очередь задач.'}
            </div>
          </div>

          <div className="mn-eyebrow mb-2">Люди — подробно</div>
          <div className="grid grid-cols-2 gap-2 mb-5">
            <Tile label="Всего" value={fmt(stats.totalUsers)} />
            <Tile label="Не блокировали бота" value={fmt(stats.activeUsers)} />
            <Tile label="Платили" value={fmt(stats.proUsers)} accent="ruby" />
            <Tile label="Первые 30 дней" value={fmt(stats.trialUsers)} accent="navy" />
            <Tile label="Не платили, 30 дней прошло" value={fmt(stats.freeUsers)} />
            <Tile label="Платят после 30 дней" value={`${stats.conversionPostTrialPct}%`} accent="gold" />
            <Tile label="Новых за сутки" value={fmt(stats.newUsersToday)} />
            <Tile label="Новых за неделю" value={fmt(stats.newUsersWeek)} />
          </div>

          <div className="mn-eyebrow mb-2">Выручка и словари</div>
          <div className="grid grid-cols-2 gap-2 mb-5">
            <Tile label="Звёзд всего" value={fmt(stats.totalRevenueStars)} accent="gold" />
            <Tile label="Звёзд за неделю" value={fmt(stats.revenueWeekStars)} accent="gold" />
            <Tile label="Покупок" value={fmt(stats.totalPurchases)} />
            <Tile label="Возвратов" value={fmt(stats.totalRefunds)} />
            <Tile label="Слов в словарях" value={fmt(stats.totalVocabularyEntries)} />
            <Tile label="Слов на человека" value={`${stats.averageVocabularyPerUser}`} />
          </div>

          <div className="flex items-center justify-between mb-2">
            <div className="mn-eyebrow">Новые люди по дням</div>
            <div className="flex gap-1">
              {([7, 30, 90] as const).map((d) => (
                <button
                  key={d} type="button" onClick={() => setDays(d)} aria-pressed={days === d}
                  className={`px-3 min-h-[44px] rounded-xl font-sans text-[12px] font-bold border-[1.5px] ${days === d ? 'bg-jewelInk text-cream border-jewelInk' : 'bg-white text-jewelInk-mid border-jewelInk/25'}`}
                >
                  {d} дн
                </button>
              ))}
            </div>
          </div>
          <div className="jewel-tile px-3 py-3 mb-5">
            <div className="relative z-[1]"><SignupsChart points={signups} /></div>
          </div>

          <div className="mn-eyebrow mb-2">Тестовые пуши — только себе</div>
          <div className="jewel-tile px-4 py-4 mb-5" data-testid="system-pushes">
            <div className="relative z-[1]">
              <div className="font-sans text-[12px] text-jewelInk-mid mb-3">
                Настоящие сообщения бота тебе самому — проверить текст и кнопку. «Вернись»-пуши — те же, что уходят людям утром;
                остальные идут мимо утреннего окна и пауз. «Все праздники» присылает весь календарь подряд.
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([['feed', 'Покормить Бомбору'], ['earn', 'Заработать опыт'], ['miss', 'Скучаю'], ['module', 'Продолжить модуль']] as const).map(([variant, label]) => (
                  <button key={variant} type="button" className={pushButton} disabled={pushBusy}
                    onClick={() => push(() => api.adminTestReturnPush({ variant }), `Отправил «${label}» — проверь чат с ботом.`)}>
                    {label}
                  </button>
                ))}
                <button type="button" className={pushButton} disabled={pushBusy} onClick={() => push(() => api.adminTestHolidayPush(), 'Отправил все праздники — проверь чат с ботом.')}>Все праздники</button>
                <button type="button" className={pushButton} disabled={pushBusy} onClick={() => push(() => api.adminTestCoinsPush(), 'Отправил «голодную Бомбору» — проверь чат с ботом.')}>Голодная Бомбора</button>
                {([7, 30, 100] as const).map(m => (
                  <button key={m} type="button" className={pushButton} disabled={pushBusy} onClick={() => push(() => api.adminTestStreakPush(m), `Отправил пуш про ${m} дней подряд — проверь чат с ботом.`)}>
                    {m} дней подряд
                  </button>
                ))}
              </div>
              {pushMsg && <div className="font-sans text-[13px] text-jewelInk mt-3" data-testid="system-push-note">{pushMsg}</div>}
            </div>
          </div>

          <BroadcastPanel />
        </>
      )}
    </AdminPage>
  )
}

function fmt(n: number): string {
  return n.toLocaleString('ru-RU')
}

function BroadcastPanel() {
  const [minVocab, setMinVocab] = useState(10)
  const [useActivity, setUseActivity] = useState(false)
  const [days, setDays] = useState(365)
  const [useRegisteredRange, setUseRegisteredRange] = useState(false)
  const [registeredAfterDate, setRegisteredAfterDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10) // YYYY-MM-DD
  })
  const [registeredBeforeDate, setRegisteredBeforeDate] = useState('') // empty = no upper bound
  const [proStatus, setProStatus] = useState<'any' | 'active' | 'free'>('any')
  // Default: no Pro grant — broadcast is just a message. Owner picks a plan explicitly.
  const [grantPlan, setGrantPlan] = useState<string>('')
  const [includeMiniAppButton, setIncludeMiniAppButton] = useState(true)
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<{ totalRecipients: number; sampleTelegramIds: number[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  // Build UTC midnight ISO strings for the registration range. Empty = no bound.
  const registeredAfterUtcIso = useRegisteredRange && registeredAfterDate
    ? new Date(registeredAfterDate + 'T00:00:00Z').toISOString()
    : null
  const registeredBeforeUtcIso = useRegisteredRange && registeredBeforeDate
    ? new Date(registeredBeforeDate + 'T00:00:00Z').toISOString()
    : null
  const proStatusParam: 'active' | 'free' | null = proStatus === 'any' ? null : proStatus

  function segmentSummary() {
    const parts: string[] = []
    if (minVocab > 0) parts.push(`словарь ≥ ${minVocab}`)
    if (useActivity) parts.push(`активные за ${days}д`)
    if (useRegisteredRange) {
      const a = registeredAfterDate || '…'
      const b = registeredBeforeDate || 'сейчас'
      parts.push(`зарегались ${a} → ${b}`)
    }
    if (proStatus === 'active') parts.push('только с активной подпиской')
    if (proStatus === 'free') parts.push('только без активной подписки')
    if (parts.length === 0) parts.push('все юзеры')
    return parts.join(' + ')
  }

  function buildBody(dryRun: boolean) {
    return {
      activeWithinDays: useActivity ? days : null,
      minVocabularyCount: minVocab,
      registeredAfterUtc: registeredAfterUtcIso,
      registeredBeforeUtc: registeredBeforeUtcIso,
      proStatus: proStatusParam,
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
        minVocab,
        registeredAfterUtc: registeredAfterUtcIso,
        registeredBeforeUtc: registeredBeforeUtcIso,
        proStatus: proStatusParam
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
      setResult(`Отправлено ${r.sent}/${r.totalRecipients}, выдано Pro: ${r.granted}, ошибок: ${r.failed}`)
    } catch (e: any) {
      setResult(`ошибка: ${e?.message ?? 'unknown'}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-5">
      <div className="mn-eyebrow mb-2">Старая разовая рассылка по сегменту</div>
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

          {/* Registration-date range — for cohort targeting (e.g. signups May 1-5). */}
          <div className="flex flex-col gap-1.5">
            <label className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={useRegisteredRange}
                onChange={(e) => setUseRegisteredRange(e.target.checked)}
              />
              <span className="font-sans text-[12px] text-jewelInk-mid">+ зарегались в интервал</span>
            </label>
            <div className="flex flex-wrap gap-2 items-center pl-6">
              <span className="font-sans text-[11px] text-jewelInk-mid">с</span>
              <input
                type="date"
                value={registeredAfterDate}
                disabled={!useRegisteredRange}
                onChange={(e) => setRegisteredAfterDate(e.target.value)}
                className="min-w-0 flex-1 px-2 py-1 rounded border-[1.5px] border-jewelInk/40 font-sans text-[13px] disabled:opacity-50"
              />
              <span className="font-sans text-[11px] text-jewelInk-mid">по</span>
              <input
                type="date"
                value={registeredBeforeDate}
                disabled={!useRegisteredRange}
                placeholder="сейчас"
                onChange={(e) => setRegisteredBeforeDate(e.target.value)}
                className="min-w-0 flex-1 px-2 py-1 rounded border-[1.5px] border-jewelInk/40 font-sans text-[13px] disabled:opacity-50"
              />
            </div>
          </div>

          {/* Pro entitlement filter */}
          <div className="flex gap-2 items-center">
            <span className="font-sans text-[12px] text-jewelInk-mid">подписка:</span>
            <select
              value={proStatus}
              onChange={(e) => setProStatus(e.target.value as 'any' | 'active' | 'free')}
              className="px-2 py-1.5 rounded border-[1.5px] border-jewelInk/40 font-sans text-[13px] bg-cream"
            >
              <option value="any">не важно</option>
              <option value="active">только с активной</option>
              <option value="free">только без активной</option>
            </select>
          </div>

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
            <span className="font-sans text-[12px] text-jewelInk-mid">кнопка «Открыть TraleBot» в сообщении</span>
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
