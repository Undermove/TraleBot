import React, { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DailyGiftDto, RARITY, TICKER, burnsIn } from './gift'

// Под коробкой на главной: что может выпасть (бегущая строка), шансы по редкостям от серии и сколько
// осталось до полуночи — подарок сгорит. Всё, чтобы нажать «Забрать подарок» сейчас.

export default function GiftStrip({ gift, burning }: { gift: DailyGiftDto; burning: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  const [k, setK] = useState(0)
  const names = TICKER(gift.friendDays)
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    const s = setInterval(() => setK(i => i + 1), 1600)
    return () => { clearInterval(t); clearInterval(s) }
  }, [])
  const weekly = gift.guaranteedIn === 0

  return (
    <div className="mt-1 flex w-full flex-col items-center gap-1" data-testid="gift-strip">
      <div className="w-full truncate px-1 text-center font-sans text-[12.500px] font-bold text-jewelInk-mid">
        {weekly ? <b className="text-ruby" data-testid="gift-weekly">Недельный: минимум эпический</b> : (
          <>может выпасть:{' '}
            <AnimatePresence mode="wait" initial={false}>
              <motion.b key={k} className="inline-block text-jewelInk" data-testid="gift-ticker"
                initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.18 }}>
                {names[k % names.length]}
              </motion.b>
            </AnimatePresence>
          </>
        )}
      </div>
      <div className="flex w-full items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2.5" data-testid="gift-odds" aria-label="Шансы по редкостям">
          {RARITY.map((r, i) => (
            <span key={r.name} title={r.name} className="flex items-center gap-1 font-sans text-[12px] font-extrabold tabular-nums text-jewelInk">
              <i className="inline-block h-2.5 w-2.5 rounded-full border border-jewelInk" style={{ background: r.color }} />
              {Math.round(gift.odds[i] * 100)}%
            </span>
          ))}
        </div>
        {burning && (
          <span className="shrink-0 rounded-full bg-ruby px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-cream" data-testid="gift-timer">
            сгорит через {burnsIn(gift.burnsAtUtc, now)}
          </span>
        )}
      </div>
    </div>
  )
}
