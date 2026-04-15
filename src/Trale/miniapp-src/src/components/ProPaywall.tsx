import React, { useEffect, useState } from 'react'
import Mascot from './Mascot'
import LoaderLetter from './LoaderLetter'
import { api } from '../api'

export type PaywallTrigger = 'module' | 'vocabulary_limit'

interface Props {
  trigger: PaywallTrigger
  onClose: () => void
  onPurchaseSuccess: () => void
}

type State = 'default' | 'loading' | 'error'

/**
 * Pro paywall bottom sheet.
 * Design spec: 22-monetization-stars-mvp.md → "Экран: Paywall — Bottom Sheet"
 */
export default function ProPaywall({ trigger, onClose, onPurchaseSuccess }: Props) {
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<State>('default')

  // Slide-up on mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  // Listen for Telegram invoice_closed event
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp
    if (!tg) return
    const handler = (data: { url: string; status: string }) => {
      if (data.status === 'paid') {
        onPurchaseSuccess()
        handleClose()
      }
    }
    tg.onEvent('invoice_closed', handler)
    return () => {
      try { tg.offEvent('invoice_closed', handler) } catch {}
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 220)
  }

  async function handlePurchase() {
    setState('loading')
    try {
      await api.purchase()
      // Telegram will natively show the Stars invoice; we wait for invoice_closed event
    } catch {
      setState('error')
    }
  }

  const isVocabLimit = trigger === 'vocabulary_limit'
  const headline = isVocabLimit ? 'Словарь заполнен' : 'Открыть все модули'
  const subLabel = isVocabLimit ? 'ლექსიკონი · 50/50' : 'სრული წვდომა'
  const bullet1 = isVocabLimit
    ? '✓ Словарь без ограничений — добавляй сколько угодно'
    : '✓ Вся грамматика — местоимения, падежи, глаголы'

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
        className="fixed bottom-0 left-0 right-0 z-50 max-w-[480px] mx-auto bg-cream rounded-t-2xl border-t-2 border-x-2 border-jewelInk max-h-[85dvh] overflow-y-auto"
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
          {/* Mascot + gold star */}
          <div className="flex flex-col items-center gap-2 pt-2">
            {state === 'error' ? (
              <Mascot mood="think" size={100} />
            ) : (
              <div className="relative">
                <Mascot mood="guide" size={100} />
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
            <div className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight">
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
          ) : (
            <>
              {/* Bullet list */}
              <div className="flex flex-col gap-2">
                {[
                  bullet1,
                  '✓ Лексика по темам — кафе, такси, врач и ещё',
                  '✓ Продвинутые уроки A2–B2',
                  '✓ Мой словарь без ограничений',
                ].map((b) => (
                  <div key={b} className="font-sans text-[14px] text-jewelInk flex items-start gap-2">
                    <span className="text-navy font-bold shrink-0">{b.slice(0, 1)}</span>
                    <span>{b.slice(2)}</span>
                  </div>
                ))}
              </div>

              {/* Price block */}
              <div
                className="jewel-tile py-3 px-4 text-center"
                style={{ background: '#FBF6EC' }}
              >
                <div className="font-sans text-[32px] font-extrabold text-jewelInk leading-none">
                  150 <span className="text-[28px]">⭐</span>
                </div>
                <div className="mt-1">
                  <span className="font-geo text-[12px] text-gold font-bold">ვარსკვლავი</span>
                  <span className="font-sans text-[11px] text-jewelInk/60"> = звезда</span>
                </div>
              </div>
            </>
          )}

          {/* CTA */}
          {state === 'loading' ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <LoaderLetter />
              <div className="font-sans text-[13px] text-jewelInk-mid">Открываем платёж…</div>
            </div>
          ) : (
            <button
              onClick={state === 'error' ? handlePurchase : handlePurchase}
              disabled={state === 'loading'}
              className="jewel-btn w-full min-h-[52px] font-sans text-[16px] font-extrabold"
              style={{
                background: '#F5B820',
                color: '#15100A',
                border: '2px solid #15100A',
                boxShadow: '0 3px 0 #15100A',
              }}
            >
              {state === 'error' ? 'Попробовать снова' : 'Купить за 150 ⭐'}
            </button>
          )}

          <button
            onClick={handleClose}
            className="font-sans text-[14px] text-jewelInk-mid text-center w-full py-2 active:opacity-60 transition-opacity min-h-[44px]"
          >
            Нет, пока нет
          </button>
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
