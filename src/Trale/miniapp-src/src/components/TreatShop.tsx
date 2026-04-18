import React, { useState } from 'react'
import { api } from '../api'

interface Props {
  availableXp: number
  totalTreatsGiven: number
  onFed: (result: { treatIndex: number; xpSpent: number; totalTreatsGiven: number; lastFedAtUtc: string }) => void
  onClose: () => void
}

interface Treat {
  index: number
  emoji: string
  name: string
  geoName: string
  price: number
  description: string
}

const TREATS: Treat[] = [
  { index: 0, emoji: '🥐', name: 'Дзвали', geoName: 'ძვალი', price: 10, description: 'Хрустящая косточка' },
  { index: 1, emoji: '🥩', name: 'Хорци', geoName: 'ხორცი', price: 30, description: 'Кусочек мяса' },
  { index: 2, emoji: '🍢', name: 'Мцвади', geoName: 'მწვადი', price: 60, description: 'Грузинский шашлык' },
  { index: 3, emoji: '🍬', name: 'Чурчхела', geoName: 'ჩურჩხელა', price: 100, description: 'Любимое лакомство' },
  { index: 4, emoji: '🍽️', name: 'Супра', geoName: 'სუფრა', price: 200, description: 'Целое застолье!' },
]

export default function TreatShop({ availableXp, totalTreatsGiven, onFed, onClose }: Props) {
  const [feeding, setFeeding] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFeed(treat: Treat) {
    if (feeding !== null) return
    if (availableXp < treat.price) return
    setFeeding(treat.index)
    setError(null)
    try {
      const result = await api.feedTreat(treat.index)
      onFed({
        treatIndex: treat.index,
        xpSpent: result.xpSpent,
        totalTreatsGiven: result.totalTreatsGiven,
        lastFedAtUtc: result.lastFedAtUtc,
      })
    } catch (e) {
      setError('Не получилось покормить — попробуй ещё раз')
      setFeeding(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-jewelInk/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[520px] bg-cream rounded-t-3xl border-t-[2px] border-jewelInk overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 -4px 0 #15100A', paddingBottom: 'var(--safe-b)' }}
      >
        <div className="px-5 pt-4 pb-3 flex items-center justify-between">
          <div>
            <div className="mn-eyebrow text-ruby">ლაკომი</div>
            <div className="font-sans text-[20px] font-extrabold text-jewelInk leading-tight">
              Покорми Бомбору
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full border-[1.5px] border-jewelInk bg-cream-deep flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Закрыть"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6L18 18M6 18L18 6" stroke="#15100A" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="px-5 pb-2 flex items-center gap-3">
          <div className="flex-1 rounded-xl bg-cream-deep border-[1.5px] border-jewelInk px-3 py-2">
            <div className="mn-eyebrow text-jewelInk-mid">XP в кошельке</div>
            <div className="font-sans text-[18px] font-extrabold text-jewelInk">⭐ {availableXp}</div>
          </div>
          <div className="flex-1 rounded-xl bg-cream-deep border-[1.5px] border-jewelInk px-3 py-2">
            <div className="mn-eyebrow text-jewelInk-mid">всего съел</div>
            <div className="font-sans text-[18px] font-extrabold text-jewelInk">🍽 {totalTreatsGiven}</div>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-2 px-3 py-2 rounded-lg bg-ruby/10 border border-ruby/40 font-sans text-[12px] text-ruby">
            {error}
          </div>
        )}

        <div className="px-3 py-3 grid grid-cols-1 gap-2 max-h-[54vh] overflow-y-auto">
          {TREATS.map((t) => {
            const affordable = availableXp >= t.price
            const isLoading = feeding === t.index
            return (
              <button
                key={t.index}
                onClick={() => handleFeed(t)}
                disabled={!affordable || feeding !== null}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl border-[1.5px] transition-all text-left ${
                  affordable
                    ? 'bg-white border-jewelInk active:scale-[0.98]'
                    : 'bg-cream-deep border-jewelInk/30 opacity-60'
                }`}
                style={affordable ? { boxShadow: '2px 2px 0 #15100A' } : undefined}
              >
                <div className="w-12 h-12 rounded-xl bg-cream-deep border-[1.5px] border-jewelInk flex items-center justify-center shrink-0 text-[26px]">
                  {t.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-sans text-[15px] font-extrabold text-jewelInk leading-tight">
                    {t.name} <span className="text-jewelInk-mid font-bold text-[13px]">· {t.geoName}</span>
                  </div>
                  <div className="font-sans text-[12px] text-jewelInk-mid mt-0.5">{t.description}</div>
                </div>
                <div
                  className={`shrink-0 px-3 py-1.5 rounded-lg font-sans text-[13px] font-extrabold ${
                    affordable ? 'bg-gold text-jewelInk border-[1.5px] border-jewelInk' : 'bg-cream-deep text-jewelInk-mid border-[1.5px] border-jewelInk/30'
                  }`}
                >
                  {isLoading ? '…' : `⭐ ${t.price}`}
                </div>
              </button>
            )
          })}
        </div>

        <div className="px-5 pb-4 pt-1">
          <div className="font-sans text-[11px] text-jewelInk-mid text-center leading-snug">
            XP копится на уроках — трать на лакомства, чтобы порадовать Бомбору.
          </div>
        </div>
      </div>
    </div>
  )
}
