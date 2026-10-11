import React, { useEffect, useState } from 'react'
import Mascot from './Mascot'
import { api } from '../api'
import { shareReferral } from '../referralShare'

type Offer = Awaited<ReturnType<typeof api.referral>>

/** Сколько мест для друзей в одном ряду. Ряд заполнился — открывается следующий. */
export const ROW_SIZE = 6

export type Seat = 'started' | 'waiting' | 'free'

/**
 * Ряд мест: друзья, которые начали заниматься, потом те, кто пришёл по ссылке, но ещё не начал,
 * остальные места свободны. Полные ряды уходят «за кадр» — показан текущий.
 */
export function seatRow(invited: number, activated: number): { row: number; seats: Seat[] } {
  const started = Math.max(0, activated)
  const inRow = started % ROW_SIZE
  const waiting = Math.min(Math.max(0, invited - started), ROW_SIZE - inRow)
  const seats: Seat[] = Array.from({ length: ROW_SIZE }, (_, i) =>
    i < inRow ? 'started' : i < inRow + waiting ? 'waiting' : 'free'
  )
  return { row: Math.floor(started / ROW_SIZE) + 1, seats }
}

function plural(n: number, one: string, two: string, many: string): string {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return two
  return many
}

/** Подпись под рядом — только цифры из ответа сервера. */
export function seatCaption(offer: Pick<Offer, 'invitedCount' | 'activatedCount' | 'earnedDays'>): string {
  const { invitedCount, activatedCount } = offer
  const earned = offer.earnedDays ?? 0
  if (invitedCount <= 0) return 'Пока никого — первое место ждёт друга'
  const parts = [`Пришли: ${invitedCount}`, `начали: ${activatedCount}`]
  if (earned > 0) parts.push(`тебе +${earned} ${plural(earned, 'день', 'дня', 'дней')}`)
  return parts.join(' · ')
}

const INK = '#15100A'
const SEAT_LOOK: Record<Seat, { fill: string; stroke: string }> = {
  started: { fill: '#F5B820', stroke: INK },
  waiting: { fill: '#F9EAC1', stroke: INK },
  free: { fill: 'none', stroke: '#B5A68B' }
}

function Paw({ seat, pulse }: { seat: Seat; pulse: boolean }) {
  const { fill, stroke } = SEAT_LOOK[seat]
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      data-testid="referral-seat"
      data-seat={seat}
      className={pulse ? 'referral-paw-pulse' : ''}
      fill={fill}
      stroke={stroke}
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="5.6" cy="10" r="2.1" />
      <circle cx="9.8" cy="6" r="2.2" />
      <circle cx="14.2" cy="6" r="2.2" />
      <circle cx="18.4" cy="10" r="2.1" />
      <path d="M12 11.4c-3.1 0-5.6 2.9-5.6 5.5 0 1.900 1.400 2.800 2.900 2.800 1.200 0 1.800-.6 2.700-.6s1.500.6 2.700.6c1.500 0 2.900-.9 2.900-2.800 0-2.600-2.500-5.500-5.600-5.500z" />
    </svg>
  )
}

/**
 * «Позови друга» в профиле: ряд мест-лапок вместо списка правил. Лапка закрашивается, когда друг
 * начал заниматься; бледная — пришёл по ссылке, но ещё не начал. Что кому положено, решает сервер
 * (/api/miniapp/referral) — здесь только его слова и цифры. Правила — по нажатию «как это работает».
 * Тем, кто исчерпал годовой лимит, карточка не показывается.
 */
export default function ReferralCard() {
  const [offer, setOffer] = useState<Offer | null>(null)
  const [shared, setShared] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .referral()
      .then((r) => { if (!cancelled) setOffer(r) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!offer || offer.capReached) return null

  const { row, seats } = seatRow(offer.invitedCount, offer.activatedCount)
  // Место, которое займёт следующий друг, — оно и оживает после «Позвать друга».
  const nextSeat = seats.findIndex((s) => s !== 'started')
  // Навсегда-подписчику бонус не положен — ему честно: это подарок другу.
  const reward = offer.bonusShortLabel ? `тебе ${offer.bonusShortLabel}` : 'подарок другу'

  function invite() {
    try {
      ;(window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light')
    } catch {}
    shareReferral(offer!.link, offer!.shareText)
    setShared(true)
  }

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(offer!.link)
      } else {
        const ta = document.createElement('textarea')
        ta.value = offer!.link
        ta.style.position = 'fixed'
        ta.style.left = '-9999px'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className="jewel-tile px-4 py-3 mb-5" data-testid="referral-card" data-state={offer.state}>
      <div className="relative z-[1]">
        <div className="flex items-center justify-between gap-2">
          <div className="font-sans text-[15px] font-extrabold text-jewelInk leading-tight">Позови друга</div>
          <div
            data-testid="referral-reward"
            className="shrink-0 font-sans text-[11px] font-extrabold text-jewelInk bg-gold-wash border border-jewelInk rounded-full px-2 py-0.5"
          >
            {reward}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="font-sans text-[12px] text-jewelInk-mid" data-testid="referral-friend-line">
            {offer.friendLine}
          </div>
          <button
            type="button"
            onClick={() => setRulesOpen((v) => !v)}
            aria-expanded={rulesOpen}
            className="shrink-0 -my-1 min-h-[44px] pl-3 font-sans text-[11px] text-jewelInk-mid underline underline-offset-2 decoration-jewelInk/30"
          >
            как это работает
          </button>
        </div>

        <div className="flex items-center gap-1.5" data-testid="referral-seats">
          {seats.map((seat, i) => (
            <Paw key={i} seat={seat} pulse={shared && i === nextSeat} />
          ))}
          {row > 1 && (
            <span className="ml-1 font-sans text-[11px] font-bold text-jewelInk-hint" data-testid="referral-row">
              ряд {row}
            </span>
          )}
        </div>

        <div
          aria-live="polite"
          data-testid="referral-caption"
          className="flex items-center gap-1.5 min-h-[22px] mt-1 font-sans text-[11px] text-jewelInk-mid leading-tight"
        >
          {shared ? (
            <>
              <span className="shrink-0 -my-1"><Mascot mood="cheer" size={22} /></span>
              <span className="anim-fade">Спасибо! Жду друга — тут появится его лапка.</span>
            </>
          ) : (
            seatCaption(offer)
          )}
        </div>

        <button
          type="button"
          onClick={invite}
          className="mt-2 w-full font-sans text-[14px] font-extrabold text-jewelInk min-h-[44px] rounded border-[1.5px] border-jewelInk"
          style={{ background: '#F5B820', boxShadow: '0 2px 0 #15100A' }}
        >
          {shared ? 'Позвать ещё' : 'Позвать друга'}
        </button>

        {rulesOpen && (
          <div className="mt-3 anim-fade" data-testid="referral-rules">
            <ul className="font-sans text-[12px] text-jewelInk-mid leading-snug list-disc pl-5 space-y-1">
              <li>Закрашенная лапка — друг начал заниматься, бледная — пришёл по ссылке, но ещё не начал.</li>
              {offer.rules.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
            <button
              type="button"
              onClick={copy}
              className="mt-2 w-full font-sans text-[13px] font-bold text-jewelInk min-h-[44px] rounded border-[1.5px] border-jewelInk/40"
            >
              {copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes referralPawPulse {
          0%, 100% { transform: scale(1) rotate(0deg); }
          30% { transform: scale(1.25) rotate(-10deg); }
          60% { transform: scale(1.1) rotate(8deg); }
        }
        .referral-paw-pulse { animation: referralPawPulse 900ms ease-in-out 2; transform-origin: center; }
      `}</style>
    </div>
  )
}
