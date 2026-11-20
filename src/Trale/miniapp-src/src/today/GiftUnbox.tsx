import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Gift3DHandle, sparkFountain } from './Gift3D'
import LootBox from './LootBox'
import Padlock from './Padlock'
import './today.css'
import PrizeIcon from './PrizeIcon'
import { buzz, reducedMotion } from './sensors'
import { appEvents } from '../analytics/appEvents'
import { openDailyGift } from '../api'
import { shareReferral } from '../referralShare'
import { DailyGiftBox, DailyGiftDto, RARITY, days, ladder, prizeText, setGift } from './gift'

// Распаковка подарка дня на весь экран. Приз разыгрывает сервер сразу, как окно открылось; человек тапает
// три раза — и на каждом тапе подарок может превратиться в сундук получше (сундучок → эмалевый → золотой)
// до того, что выпал. Никаких надписей про редкость — всё видно по самой коробке. Потом — приз и что будет завтра: неделя до гарантированного эпического и вторая коробка
// за ещё один раунд.

interface Props {
  gift: DailyGiftDto
  /** Какую коробку открываем: 0 — за задание, 1 — за ещё один раунд. */
  box: number
  onClose: () => void
  /** Ещё один раунд — за второй коробкой. */
  onMore: () => void
  onCheer: () => void
}

const TAPS = 3

export default function GiftUnbox({ gift, box, onClose, onMore, onCheer }: Props) {
  const cube = useRef<Gift3DHandle>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [result, setResult] = useState<{ gift: DailyGiftDto; box: DailyGiftBox } | null>(null)
  const [failed, setFailed] = useState(false)
  const [taps, setTaps] = useState(0)
  const [shown, setShown] = useState(0)
  /** Последний тап поднял редкость. */
  const [up, setUp] = useState(false)
  const [phase, setPhase] = useState<'tap' | 'prize' | 'after'>('tap')
  const pending = useRef<Promise<void> | null>(null)

  // Начало: замок, который висел на подарке, отщёлкивается — ключ (занятие) подошёл.
  const [unlocked, setUnlocked] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => { setUnlocked(true); buzz.rigid() }, 650)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    buzz.soft()
    pending.current = openDailyGift(box)
      .then(r => { setResult(r); setGift(r.gift) })
      .catch(() => setFailed(true))
  }, [box])

  const final = result?.box.rarity ?? 0

  async function tap() {
    if (phase !== 'tap' || failed) return
    const n = taps + 1
    setTaps(n)
    if (n < TAPS) {
      // Редкость известна, только когда сервер ответил; пока нет — коробка просто подпрыгивает.
      const r = result ? ladder(final)[n] : 0
      setUp(r > shown)
      if (r > shown) {
        // Превратился: новая модель выпрыгивает сама — без подскока.
        setShown(r)
        buzz.success()
        sparkFountain(wrap.current, 16)
        onCheer()
        return
      }
      cube.current?.knock(n)
      return
    }
    await pending.current
    if (!result) return
    appEvents.tap(`today-gift-unbox-r${result.box.rarity}`)
    setShown(result.box.rarity ?? 0)
    onCheer()
    await cube.current?.open()
    setPhase('prize')
  }

  const title = phase !== 'tap'
    ? (final >= 2 ? 'Вот это да!' : 'Твоё!')
    : taps === 0 ? (unlocked ? 'Тапай по подарку!' : 'Ключ подошёл!') : up ? (shown === 1 ? 'Ого, сундучок!' : 'Ещё лучше!') : taps === 1 ? 'Ещё!' : 'Ещё разок!'

  const g = result?.gift ?? gift
  const prize = result?.box.prize ?? null
  const text = prize ? prizeText(prize, g, result?.box) : null
  const weekPos = (g.streak - 1) % 7 + 1
  const second = g.boxes.find(b => b.box === 1)
  const canMore = box === 0 && second && !second.opened

  function share() {
    if (!result) return
    appEvents.tap('today-gift-friend-share')
    buzz.light()
    shareReferral(g.invite.link, `Учу грузинский в TraleBot по паре минут в день. По моей ссылке у тебя будет ${days(g.invite.friendDays)} бесплатно — заходи!`)
  }

  return (
    <motion.div
      className="fixed inset-0 z-[85] flex flex-col items-center justify-center px-6"
      style={{ background: 'radial-gradient(circle at 50% 42%, rgba(253,250,239,.97), rgba(245,232,200,.97))', paddingTop: 'var(--safe-t)', paddingBottom: 'var(--safe-b)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      data-testid="gift-reveal"
      data-rarity={shown}
    >
      {phase !== 'after' ? (
        <>
          <div className="mn-eyebrow text-ruby">Подарок дня</div>
          <div className="mt-1 h-[30px] font-sans text-[22px] font-extrabold text-jewelInk text-center" data-testid="gift-title">{failed ? 'Не получилось открыть' : title}</div>
          <div className="mt-2 flex h-3 gap-2" aria-hidden="true" data-testid="gift-taps">
            {phase === 'tap' && Array.from({ length: TAPS }).map((_, i) => (
              <span key={i} className={`h-3 w-3 rounded-full border-[1.5px] border-jewelInk transition-colors ${i < taps ? 'bg-gold' : 'bg-cream-deep'}`} />
            ))}
          </div>

          <motion.button
            ref={wrap as any}
            type="button"
            onClick={tap}
            className={`relative ${phase === 'prize' && shown > 0 ? 'mt-12' : 'mt-2'}`}
            aria-label="Тапнуть по подарку"
            initial={reducedMotion() ? false : { y: 300, scale: 0.4, rotate: -30 }}
            animate={{ y: 0, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14 }}
            data-testid="gift-reveal-box"
          >
            {phase === 'tap' && box === 0 && taps === 0 && (
              <span className={`absolute left-1/2 top-[46%] z-[2] ${unlocked ? 'td-unlock' : ''}`} style={{ transform: 'translate(-50%, -50%)' }} data-testid="gift-unlock">
                <Padlock size={46} open={unlocked} />
              </span>
            )}
            <LootBox ref={cube} level={shown} pop size={phase === 'prize' ? 110 : 140} idle={phase === 'tap'} charge={Math.min(taps, 2)} opened={phase === 'prize'} ajar={phase === 'prize'} />
          </motion.button>

          <div className="mt-4 w-full max-w-[340px] flex flex-col items-center gap-3">
            {phase === 'prize' && prize && text ? (
              <>
                <motion.div
                  initial={{ y: 30, opacity: 0, scale: 0.8 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                  className="flex w-full items-center gap-3 rounded-2xl border-[2.500px] bg-cream-tile px-3 py-3"
                  style={{ borderColor: RARITY[final].color, boxShadow: '3px 3px 0 #15100A' }}
                  data-testid="gift-prize" data-prize={prize}
                >
                  <PrizeIcon prize={prize} days={result?.box.days ?? 1} />
                  <div className="min-w-0 flex-1">
                    <div className="font-sans text-[17px] font-extrabold leading-tight text-jewelInk">{text.title}</div>
                    <div className="mt-0.5 font-sans text-[12.500px] font-semibold leading-snug text-jewelInk-mid">{text.line}</div>
                  </div>
                </motion.div>
                {prize === 'friend' && (
                  <button type="button" onClick={share} className="jewel-btn bg-ruby text-cream w-full" data-testid="gift-friend-share">
                    <span className="relative z-[1]">Позвать друга</span>
                  </button>
                )}
                <button type="button" onClick={() => { buzz.light(); setPhase('after') }} className="jewel-btn bg-navy text-cream w-full" data-testid="gift-reveal-close">
                  <span className="relative z-[1]">Забрать</span>
                </button>
              </>
            ) : failed ? (
              <button type="button" onClick={onClose} className="jewel-btn bg-navy text-cream w-full" data-testid="gift-reveal-close">
                <span className="relative z-[1]">Закрыть</span>
              </button>
            ) : (
              <div className="h-[56px] flex items-center justify-center font-sans text-[13px] font-bold text-jewelInk-mid" data-testid="gift-reveal-hint">
                Тапай — вдруг внутри что-то получше
              </div>
            )}
          </div>
        </>
      ) : (
        <motion.div className="flex w-full max-w-[360px] flex-col gap-3" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} data-testid="gift-after">
          <div className="jewel-tile px-4 py-3">
            <div className="relative z-[1]">
              <div className="mn-eyebrow text-ruby">Завтра</div>
              <div className="mt-1 font-sans text-[17px] font-extrabold leading-tight text-jewelInk" data-testid="gift-week-line">
                {g.guaranteedIn === 1 ? 'Завтра — точно сундук!' : g.guaranteedIn === 0 ? 'Следующий сундук — через 7 дней' : `Ещё ${days(g.guaranteedIn)} — и точно сундук`}
              </div>
              <div className="mt-1 font-sans text-[12.500px] font-semibold leading-snug text-jewelInk-mid">
                Занимайся каждый день: на 7-й день подряд — точно сундук. Пропустишь день — счёт начнётся заново{g.freezes > 0 ? `, если не спасёт заморозка (у тебя ${g.freezes})` : ''}.
              </div>
              <div className="mt-3 flex justify-between gap-1" data-testid="gift-week">
                {[1, 2, 3, 4, 5, 6, 7].map(i => (
                  <span key={i} className={`flex h-9 flex-1 items-center justify-center rounded-lg border-[1.5px] border-jewelInk font-sans text-[13px] font-extrabold ${
                    i <= weekPos ? 'bg-navy text-cream' : i === 7 ? 'bg-ruby text-cream' : 'bg-cream text-jewelInk-mid'}`}>
                    {i === 7 ? '★' : i}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {canMore && (
            <div className="jewel-tile px-4 py-3">
              <div className="relative z-[1]">
                <div className="mn-eyebrow text-ruby">Бонус · только сегодня</div>
                <div className="mt-1 font-sans text-[17px] font-extrabold leading-tight text-jewelInk">Вторая коробка за ещё один раунд</div>
                <div className="mt-1 font-sans text-[12.500px] font-semibold leading-snug text-jewelInk-mid">Минута повторения — и открываешь ещё одну.</div>
              </div>
            </div>
          )}
          <div className="mt-2 flex flex-col gap-2">
            {canMore && (
              <button type="button" onClick={() => { appEvents.tap('today-gift-more'); buzz.light(); onMore() }} className="jewel-btn bg-ruby text-cream w-full today-nudge" data-testid="gift-more">
                <span className="relative z-[1]">Ещё раунд → вторая коробка</span>
              </button>
            )}
            <button type="button" onClick={() => { buzz.light(); onClose() }} className={`jewel-btn w-full ${canMore ? 'bg-cream-tile text-jewelInk' : 'bg-navy text-cream'}`} data-testid="gift-done">
              <span className="relative z-[1]">{canMore ? 'На сегодня хватит' : 'Готово'}</span>
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
