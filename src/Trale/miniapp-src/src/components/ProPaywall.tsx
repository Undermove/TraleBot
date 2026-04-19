import React, { useEffect, useRef, useState } from 'react'
import Mascot from './Mascot'
import LoaderLetter from './LoaderLetter'
import { api } from '../api'

export type PaywallTrigger = 'module' | 'vocabulary_limit'

interface Props {
  trigger: PaywallTrigger
  onClose: () => void
  onPurchaseSuccess: () => void
}

interface Plan {
  id: string
  payloadId: string
  stars: number
  durationDays: number | null
  title: string
  description: string
}

type State = 'default' | 'loading-plans' | 'loading-invoice' | 'waiting-payment' | 'success' | 'error'

// Default/recommended plan highlighted first by the UI.
const RECOMMENDED_PLAN = 'Year'

/**
 * Pro paywall bottom sheet with tier selection.
 * Opens Telegram Stars invoice natively inside the mini-app via
 * Telegram.WebApp.openInvoice(url) — no context switch to chat.
 */
export default function ProPaywall({ trigger, onClose, onPurchaseSuccess }: Props) {
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<State>('loading-plans')
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<string>(RECOMMENDED_PLAN)

  // Slide-up on mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  // Load plans once
  useEffect(() => {
    api
      .plans()
      .then((r) => {
        setPlans(r.plans)
        setState('default')
        if (!r.plans.some((p) => p.id === RECOMMENDED_PLAN) && r.plans.length > 0) {
          setSelectedPlan(r.plans[0].id)
        }
      })
      .catch(() => setState('error'))
  }, [])

  // Polling handle to cancel if the component unmounts or success is reached
  // via another path (invoice_closed event). Telegram's invoice_closed isn't
  // 100% reliable across clients, so we poll /me as a safety net.
  const pollRef = useRef<{ cancelled: boolean }>({ cancelled: false })

  // Listen for Telegram invoice_closed event (only fires for openInvoice flow)
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp
    if (!tg) return
    const handler = (data: { url: string; status: string }) => {
      if (data.status === 'paid') {
        confirmPayment()
      } else if (data.status === 'failed') {
        stopPolling()
        setState('error')
      } else {
        // cancelled / pending — return to default so user can retry
        stopPolling()
        setState('default')
      }
    }
    tg.onEvent('invoice_closed', handler)
    return () => {
      try { tg.offEvent('invoice_closed', handler) } catch {}
      stopPolling()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function stopPolling() {
    pollRef.current.cancelled = true
  }

  function confirmPayment() {
    // Guarded so repeated calls (invoice_closed + polling both firing) are idempotent.
    stopPolling()
    setState((prev) => (prev === 'success' ? prev : 'success'))
    onPurchaseSuccess()
  }

  function handleClose() {
    stopPolling()
    setVisible(false)
    setTimeout(onClose, 220)
  }

  async function handlePurchase() {
    setState('loading-invoice')
    try {
      const res = await api.purchase(selectedPlan)
      if (res.alreadyPro) {
        confirmPayment()
        return
      }
      const tg = (window as any).Telegram?.WebApp
      if (res.invoiceLink && tg?.openInvoice) {
        // Native in-app invoice shim
        tg.openInvoice(res.invoiceLink)
        setState('waiting-payment')
        // Polling fallback: some Telegram clients don't deliver `invoice_closed`
        // reliably. Poll /me until isPro flips or we give up (~60s).
        startPaymentPolling()
      } else if (res.invoiceLink) {
        // Fallback: open in new tab (for browsers without Telegram WebApp)
        window.open(res.invoiceLink, '_blank')
        setState('default')
      } else {
        setState('error')
      }
    } catch {
      setState('error')
    }
  }

  function startPaymentPolling() {
    const token = { cancelled: false }
    pollRef.current = token
    const maxAttempts = 20 // 20 × 3s = 60s
    let attempt = 0
    const tick = async () => {
      if (token.cancelled) return
      attempt += 1
      try {
        const me = await api.me()
        if (token.cancelled) return
        if (me.isPro) {
          confirmPayment()
          return
        }
      } catch {
        // network hiccup — keep trying
      }
      if (attempt >= maxAttempts || token.cancelled) return
      setTimeout(tick, 3000)
    }
    setTimeout(tick, 3000)
  }

  const isVocabLimit = trigger === 'vocabulary_limit'
  const headline = isVocabLimit ? 'Словарь заполнен' : 'Открыть все модули'
  const subLabel = isVocabLimit ? 'ლექსიკონი · 50/50' : 'სრული წვდომა'
  const bullet1 = isVocabLimit
    ? '✓ Словарь без ограничений — добавляй сколько угодно'
    : '✓ Вся грамматика — местоимения, падежи, глаголы'

  const activePlan = plans.find((p) => p.id === selectedPlan)

  function perMonthLabel(plan: Plan): string {
    if (!plan.durationDays) return 'разовая оплата'
    const months = Math.max(1, Math.round(plan.durationDays / 30))
    const perMonth = Math.round(plan.stars / months)
    return months === 1 ? `${plan.stars} ⭐/мес` : `${perMonth} ⭐/мес`
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{
          background: 'rgba(21,16,10,0.4)',
          opacity: visible ? 1 : 0,
        }}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto bg-cream rounded-t-2xl border-t-2 border-x-2 border-jewelInk max-h-[90dvh] overflow-y-auto"
        style={{
          boxShadow: '0 -4px 0 #15100A',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
          transition: visible
            ? 'transform 280ms ease-out'
            : 'transform 220ms ease-in',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Про-доступ"
      >
        {/* Drag handle */}
        <div className="w-8 h-1 bg-jewelInk/20 rounded-full mx-auto mt-3 mb-4" />

        <div className="px-5 pb-6 flex flex-col gap-4">
          {/* Success state — celebratory thank-you replacing plan list */}
          {state === 'success' ? (
            <div className="flex flex-col items-center gap-3 pt-2 pb-1">
              <div className="relative">
                <Mascot mood="cheer" size={96} />
                <span
                  className="absolute -top-2 -right-2 text-[28px] leading-none"
                  style={{ animation: 'starAppear 350ms ease-out 100ms both' }}
                  aria-hidden="true"
                >
                  ★
                </span>
              </div>
              <div className="text-center">
                <div className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight">
                  Оплата прошла
                </div>
                <div className="font-geo text-[14px] text-gold font-bold mt-1">
                  მადლობა! — Добро пожаловать в Pro
                </div>
              </div>
              <div className="flex flex-col gap-1.5 w-full mt-1">
                {[
                  '✓ Все модули грамматики и лексики открыты',
                  '✓ Словарь без ограничений',
                  '✓ Продвинутые уроки A2–B2',
                ].map((b) => (
                  <div key={b} className="font-sans text-[13px] text-jewelInk flex items-start gap-2">
                    <span className="text-navy font-bold shrink-0">{b.slice(0, 1)}</span>
                    <span>{b.slice(2)}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleClose}
                className="jewel-btn w-full min-h-[52px] font-sans text-[16px] font-extrabold mt-2"
                style={{
                  background: '#F5B820',
                  color: '#15100A',
                  border: '2px solid #15100A',
                  boxShadow: '0 3px 0 #15100A',
                }}
              >
                Начать учиться
              </button>
            </div>
          ) : (
          <>
          {/* Mascot + gold star */}
          <div className="flex flex-col items-center gap-2 pt-2">
            {state === 'error' ? (
              <Mascot mood="think" size={84} />
            ) : (
              <div className="relative">
                <Mascot mood="guide" size={84} />
                <span
                  className="absolute -top-2 -right-2 text-[24px] leading-none"
                  style={{
                    animation: 'starAppear 350ms ease-out 100ms both',
                  }}
                  aria-hidden="true"
                >
                  ★
                </span>
              </div>
            )}
          </div>

          {/* Headline */}
          <div className="text-center">
            <div className="font-sans text-[20px] font-extrabold text-jewelInk leading-tight">
              {state === 'error' ? 'Что-то пошло не так' : headline}
            </div>
            {state !== 'error' && (
              <div className="font-geo text-[12px] text-gold font-bold mt-1">
                {subLabel}
              </div>
            )}
          </div>

          {state === 'error' ? (
            <div className="text-center font-sans text-[14px] text-jewelInk-mid">
              Попробуй ещё раз
            </div>
          ) : state === 'loading-plans' ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <LoaderLetter />
              <div className="font-sans text-[13px] text-jewelInk-mid">Загружаем тарифы…</div>
            </div>
          ) : (
            <>
              {/* Bullet list */}
              <div className="flex flex-col gap-1.5">
                {[
                  bullet1,
                  '✓ Лексика по темам — кафе, такси, врач и ещё',
                  '✓ Продвинутые уроки A2–B2',
                  '✓ Мой словарь без ограничений',
                ].map((b) => (
                  <div key={b} className="font-sans text-[13px] text-jewelInk flex items-start gap-2">
                    <span className="text-navy font-bold shrink-0">{b.slice(0, 1)}</span>
                    <span>{b.slice(2)}</span>
                  </div>
                ))}
              </div>

              {/* Plans */}
              <div className="flex flex-col gap-2">
                {plans.map((p) => {
                  const isSelected = p.id === selectedPlan
                  const isRecommended = p.id === RECOMMENDED_PLAN
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPlan(p.id)}
                      className="text-left relative px-4 py-3 rounded-xl border-2 transition-all min-h-[56px] flex items-center justify-between gap-3"
                      style={{
                        borderColor: isSelected ? '#15100A' : 'rgba(21,16,10,0.18)',
                        background: isSelected ? '#FBF6EC' : '#FFFEFA',
                        boxShadow: isSelected ? '0 2px 0 #15100A' : 'none',
                      }}
                    >
                      {isRecommended && (
                        <span
                          className="absolute -top-2 right-3 px-2 py-0.5 rounded-full font-sans text-[10px] font-extrabold uppercase tracking-wider"
                          style={{ background: '#F5B820', color: '#15100A', border: '1.5px solid #15100A' }}
                        >
                          лучший выбор
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-sans text-[15px] font-extrabold text-jewelInk">{p.title}</div>
                        <div className="font-sans text-[11px] text-jewelInk-mid mt-0.5">
                          {perMonthLabel(p)}
                        </div>
                      </div>
                      <div className="font-sans text-[18px] font-extrabold text-jewelInk whitespace-nowrap">
                        {p.stars} <span className="text-[15px]">⭐</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* CTA */}
          {state === 'loading-invoice' ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <LoaderLetter />
              <div className="font-sans text-[13px] text-jewelInk-mid">Открываем платёж…</div>
            </div>
          ) : state === 'waiting-payment' ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <LoaderLetter />
              <div className="font-sans text-[13px] text-jewelInk-mid">
                Ждём подтверждение оплаты…
              </div>
            </div>
          ) : state === 'loading-plans' ? null : (
            <button
              onClick={handlePurchase}
              className="jewel-btn w-full min-h-[52px] font-sans text-[16px] font-extrabold"
              style={{
                background: '#F5B820',
                color: '#15100A',
                border: '2px solid #15100A',
                boxShadow: '0 3px 0 #15100A',
              }}
            >
              {state === 'error'
                ? 'Попробовать снова'
                : activePlan
                  ? `Купить за ${activePlan.stars} ⭐`
                  : 'Купить'}
            </button>
          )}

          <button
            onClick={handleClose}
            className="font-sans text-[14px] text-jewelInk-mid text-center w-full py-2 active:opacity-60 transition-opacity min-h-[44px]"
          >
            {state === 'waiting-payment' ? 'Закрыть' : 'Нет, пока нет'}
          </button>
          </>
          )}
        </div>

        <div style={{ height: 'calc(var(--safe-b) + 8px)' }} />
      </div>

      <style>{`
        @keyframes starAppear {
          from { transform: scale(0.6); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </>
  )
}
