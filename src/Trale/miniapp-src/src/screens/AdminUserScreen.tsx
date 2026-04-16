import React, { useEffect, useState } from 'react'
import Header from '../components/Header'
import LoaderLetter from '../components/LoaderLetter'
import { ProgressState, Screen } from '../types'
import { api, AdminUserDetail } from '../api'

interface Props {
  telegramId: number
  progress: ProgressState
  navigate: (s: Screen) => void
}

const PLANS = [
  { id: 'Month', label: '1 мес' },
  { id: 'Quarter', label: '3 мес' },
  { id: 'HalfYear', label: '6 мес' },
  { id: 'Year', label: '1 год' },
  { id: 'Lifetime', label: 'Навсегда' }
]

export default function AdminUserScreen({ telegramId, progress, navigate }: Props) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error' | 'forbidden'>('loading')
  const [user, setUser] = useState<AdminUserDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function load() {
    setPhase('loading')
    api
      .adminUserDetail(telegramId)
      .then((u) => {
        setUser(u)
        setPhase('ready')
      })
      .catch((e: any) => {
        if (e?.status === 404) setPhase('forbidden')
        else setPhase('error')
      })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telegramId])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 1800)
  }

  async function grant(plan: string) {
    if (!confirm(`Выдать ${plan}?`)) return
    setBusy(true)
    try {
      await api.adminGrantPro(telegramId, plan)
      showToast(`✓ Выдано: ${plan}`)
      load()
    } catch {
      showToast('✗ Ошибка')
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    if (!confirm('Отозвать Pro?')) return
    setBusy(true)
    try {
      await api.adminRevokePro(telegramId)
      showToast('✓ Pro отозван')
      load()
    } catch {
      showToast('✗ Ошибка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-cream">
      <Header
        progress={progress}
        onBack={() => navigate({ kind: 'admin' })}
        eyebrow="admin · user"
        title={`#${telegramId}`}
      />

      <div
        className="flex-1 px-5 pt-4"
        style={{ paddingBottom: 'calc(var(--safe-b) + 32px)' }}
      >
        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-2 py-12">
            <LoaderLetter />
            <div className="font-sans text-[13px] text-jewelInk-mid">Загружаем…</div>
          </div>
        )}

        {phase === 'forbidden' && (
          <div className="jewel-tile px-5 py-6 text-center">
            <div className="relative z-[1] font-sans text-[14px] text-jewelInk">
              Доступ только владельцу.
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="jewel-tile px-5 py-6 text-center">
            <div className="relative z-[1] font-sans text-[14px] text-jewelInk">
              Не получилось загрузить.
            </div>
          </div>
        )}

        {phase === 'ready' && user && (
          <>
            {/* Status card */}
            <div className="jewel-tile px-4 py-4 mb-5">
              <div className="relative z-[1]">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-sans text-[14px] font-bold text-jewelInk">
                    Статус: {user.isActive ? 'активен' : 'неактивен'}
                  </div>
                  {user.isPro ? (
                    <span className="px-2 py-0.5 rounded font-sans text-[11px] font-extrabold bg-gold text-jewelInk border border-jewelInk">
                      ⭐ {user.subscriptionPlan ?? 'Pro'}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded font-sans text-[11px] font-bold text-jewelInk-mid border border-jewelInk/25">
                      free
                    </span>
                  )}
                </div>
                <div className="font-sans text-[12px] text-jewelInk-mid leading-relaxed">
                  Регистрация: {fmtDate(user.registeredAtUtc)}
                  {user.proPurchasedAtUtc && <><br />Pro куплен: {fmtDate(user.proPurchasedAtUtc)}</>}
                  {user.subscribedUntilUtc && <><br />Действует до: {fmtDate(user.subscribedUntilUtc)}</>}
                  {user.subscriptionPlan === 'Lifetime' && <><br />Lifetime — без срока</>}
                  <br />Язык: {user.currentLanguage}
                  <br />Последняя активность: {user.lastActivityUtc ? fmtDate(user.lastActivityUtc) : '—'}
                </div>
              </div>
            </div>

            {/* Activity tiles */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              <Tile label="XP" value={fmt(user.xp)} accent="navy" />
              <Tile label="Стрик" value={`${user.streak}`} accent="ruby" />
              <Tile label="Слов" value={fmt(user.vocabularyCount)} accent="gold" />
              <Tile label="Уровень" value={user.level} />
            </div>

            {/* Grant Pro */}
            <div className="mn-eyebrow mb-2">Выдать Pro</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {PLANS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => grant(p.id)}
                  disabled={busy}
                  className="font-sans text-[12px] font-extrabold py-2 rounded border-[1.5px] border-jewelInk bg-cream active:opacity-70"
                  style={{ boxShadow: '0 2px 0 #15100A' }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Revoke */}
            {user.isPro && (
              <button
                onClick={revoke}
                disabled={busy}
                className="w-full font-sans text-[12px] font-bold text-ruby py-2 underline opacity-70 active:opacity-100 mb-5"
              >
                Отозвать Pro
              </button>
            )}

            {/* Payments */}
            {user.payments.length > 0 && (
              <>
                <div className="mn-eyebrow mb-2">Платежи ({user.payments.length})</div>
                <div className="flex flex-col gap-2">
                  {user.payments.map((p) => (
                    <div
                      key={p.chargeId}
                      className={`jewel-tile px-3 py-2 ${p.refundedAtUtc ? 'opacity-50' : ''}`}
                    >
                      <div className="relative z-[1] flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-sans text-[12px] font-bold text-jewelInk">
                            {p.plan} · {p.amount} {p.currency === 'XTR' ? '⭐' : p.currency}
                          </div>
                          <div className="font-sans text-[10px] text-jewelInk-mid">
                            {fmtDate(p.purchasedAtUtc)}
                            {p.refundedAtUtc && ` · возвращён ${fmtDate(p.refundedAtUtc)}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {toast && (
          <div
            className="fixed left-1/2 bottom-[80px] -translate-x-1/2 z-50 bg-jewelInk text-cream font-sans text-[13px] font-bold px-4 py-2 rounded-lg border-[1.5px] border-jewelInk"
            style={{ boxShadow: '2px 2px 0 #15100A' }}
          >
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}

function fmt(n: number): string {
  return n.toLocaleString('ru-RU')
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function Tile({
  label,
  value,
  accent
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
        <div
          className={`font-sans text-[20px] font-extrabold tabular-nums leading-none ${accentText}`}
        >
          {value}
        </div>
      </div>
    </div>
  )
}
