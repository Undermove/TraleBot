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

function Paw({ seat, size = 28, className = '' }: { seat: Seat; size?: number; className?: string }) {
  const { fill, stroke } = SEAT_LOOK[seat]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      data-seat={seat}
      className={className}
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

const OPENED_KEY = 'bombora_referral_opened'

/** Карточку уже раскрывали на этом устройстве — привлекать к ней внимание больше не нужно. */
export function wasReferralOpened(): boolean {
  try {
    return localStorage.getItem(OPENED_KEY) === '1'
  } catch {
    return false
  }
}

function rememberReferralOpened() {
  try {
    localStorage.setItem(OPENED_KEY, '1')
  } catch {
    // Хранилища нет — подсветка вернётся при следующем открытии мини-аппа, это не страшно.
  }
}

const prefersReducedMotion = () => {
  try {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * «Позови друга» в профиле. Свёрнута в одну строку: название, мелкий ряд мест-лапок, награда и
 * шеврон; нажатие на строку раскрывает на месте крупный ряд, цифры, кнопку и «как это работает».
 * Пока карточку ни разу не раскрывали, она мягко зовёт: покачивается первое свободное место и по
 * награде пробегает блик (не при «уменьшить движение»). Лапка закрашивается, когда друг начал
 * заниматься; бледная — пришёл по ссылке, но ещё не начал. Что кому положено, решает сервер
 * (/api/miniapp/referral) — здесь только его слова и цифры.
 * Тем, кто исчерпал годовой лимит, карточка не показывается.
 */
export default function ReferralCard() {
  const [offer, setOffer] = useState<Offer | null>(null)
  const [open, setOpen] = useState(false)
  const [everOpened, setEverOpened] = useState(wasReferralOpened)
  const [calm] = useState(prefersReducedMotion)
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

  const attract = !everOpened && !calm

  function toggle() {
    try {
      ;(window as any).Telegram?.WebApp?.HapticFeedback?.impactOccurred?.('light')
    } catch {}
    if (!everOpened) {
      rememberReferralOpened()
      setEverOpened(true)
    }
    setOpen((v) => !v)
  }

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
    <div
      className="jewel-tile mb-5"
      data-testid="referral-card"
      data-state={offer.state}
      data-open={open}
      data-attract={attract}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="referral-body"
        data-testid="referral-toggle"
        className="relative z-[1] w-full min-h-[58px] px-3 py-2 flex items-center gap-2 text-left"
      >
        <span className="flex-1 min-w-0">
          <span className="block font-sans text-[15px] font-extrabold text-jewelInk leading-tight">Позови друга</span>
          {!open && (
            <span className="flex items-center gap-0.5 h-[16px] mt-0.5" data-testid="referral-mini-seats">
              {seats.map((seat, i) => (
                <Paw key={i} seat={seat} size={15} className={attract && i === nextSeat ? 'referral-paw-call' : ''} />
              ))}
              {row > 1 && <span className="ml-1 font-sans text-[10px] font-bold text-jewelInk-hint">ряд {row}</span>}
            </span>
          )}
        </span>
        <span
          data-testid="referral-reward"
          className={`relative overflow-hidden shrink-0 font-sans text-[11px] font-extrabold text-jewelInk bg-gold-wash border border-jewelInk rounded-full px-2 py-0.5 ${attract ? 'referral-shine' : ''}`}
        >
          {reward}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={INK}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="shrink-0"
          style={{ transform: open ? 'rotate(180deg)' : undefined, transition: calm ? undefined : 'transform 220ms ease' }}
        >
          <path d="M5 9l7 7 7-7" />
        </svg>
      </button>

      {/* Раскрытие на месте: строка сетки растёт от 0 до высоты содержимого. */}
      <div
        id="referral-body"
        data-testid="referral-body"
        aria-hidden={!open}
        className="relative z-[1] grid"
        style={{
          gridTemplateRows: open ? '1fr' : '0fr',
          // В раскрытом виде тело подтянуто к названию: место мелкого ряда в шапке не пустует.
          marginTop: open ? -12 : 0,
          visibility: open ? 'visible' : 'hidden',
          transition: calm ? undefined : `grid-template-rows 220ms ease, margin-top 220ms ease, visibility 0s linear ${open ? '0s' : '220ms'}`
        }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-3 pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-sans text-[12px] text-jewelInk-mid" data-testid="referral-friend-line">
                {offer.friendLine}
              </div>
              <button
                type="button"
                onClick={() => setRulesOpen((v) => !v)}
                aria-expanded={rulesOpen}
                tabIndex={open ? 0 : -1}
                className="shrink-0 -my-3 min-h-[44px] pl-3 font-sans text-[11px] text-jewelInk-mid underline underline-offset-2 decoration-jewelInk/30"
              >
                как это работает
              </button>
            </div>

            <div className="flex items-center mt-1">
              <div className="flex items-center gap-1.5" data-testid="referral-seats">
                {seats.map((seat, i) => (
                  <span key={i} data-testid="referral-seat" data-seat={seat} className={shared && !calm && i === nextSeat ? 'referral-paw-pulse' : ''}>
                    <Paw seat={seat} />
                  </span>
                ))}
                {row > 1 && (
                  <span className="ml-1 font-sans text-[11px] font-bold text-jewelInk-hint" data-testid="referral-row">
                    ряд {row}
                  </span>
                )}
              </div>
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
              tabIndex={open ? 0 : -1}
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
                  tabIndex={open ? 0 : -1}
                  className="mt-2 w-full font-sans text-[13px] font-bold text-jewelInk min-h-[44px] rounded border-[1.5px] border-jewelInk/40"
                >
                  {copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes referralPawPulse {
          0%, 100% { transform: scale(1) rotate(0deg); }
          30% { transform: scale(1.25) rotate(-10deg); }
          60% { transform: scale(1.1) rotate(8deg); }
        }
        .referral-paw-pulse { display: inline-flex; animation: referralPawPulse 900ms ease-in-out 2; transform-origin: center; }
        /* Зов: раз в несколько секунд свободное место покачивается, по награде пробегает блик. */
        @keyframes referralPawCall {
          0%, 78%, 100% { transform: scale(1) rotate(0deg); }
          84% { transform: scale(1.35) rotate(-14deg); }
          90% { transform: scale(1.2) rotate(10deg); }
          96% { transform: scale(1.1) rotate(-4deg); }
        }
        .referral-paw-call { animation: referralPawCall 4s ease-in-out infinite; transform-origin: center; }
        @keyframes referralShine {
          0%, 70% { transform: translateX(-140%) skewX(-20deg); }
          100% { transform: translateX(340%) skewX(-20deg); }
        }
        .referral-shine::after {
          content: '';
          position: absolute;
          top: 0; bottom: 0; left: 0;
          width: 40%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.85), transparent);
          animation: referralShine 4s ease-in-out infinite;
          pointer-events: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .referral-paw-pulse, .referral-paw-call, .referral-shine::after { animation: none; }
          .referral-shine::after { display: none; }
        }
      `}</style>
    </div>
  )
}
