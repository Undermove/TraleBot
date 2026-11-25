import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import LootBox from './LootBox'
import PrizeIcon from './PrizeIcon'
import { days } from './gift'
import { buzz, reducedMotion } from './sensors'
import { appEvents } from '../analytics/appEvents'
import './today.css'

// «Что нового» — один раз, тем, кто уже учился до обновления. Посыл по порядку: теперь задания подбираются под
// твой уровень → за каждое выпадает ценный приз → приходи каждый день, призы становятся лучше. Без терминов.

const KEY = 'today-intro-v3'

/** Показывать ли: человек уже учился (есть опыт), ещё не видел, не тесты (там — только по ?intro=1). */
// Адрес читаем при загрузке: приложение потом переписывает его (диплинки), и флаг тестов пропал бы.
const startParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
const quietInTests = startParams.get('playwright') === '1' && startParams.get('intro') !== '1'

export function shouldShowTodayIntro(hasXp: boolean): boolean {
  if (!hasXp || quietInTests) return false
  try { return localStorage.getItem(KEY) !== '1' } catch { return false }
}

function markSeen() { try { localStorage.setItem(KEY, '1') } catch {} }
/** Только для стенда: показать «что нового» ещё раз. */
export function forgetTodayIntro() { try { localStorage.removeItem(KEY) } catch {} }

const INK = '#15100A'
const Token = ({ label, icon, delay, onLand }: { label: string; icon: React.ReactNode; delay: number; onLand: () => void }) => (
  <motion.div
    className="absolute left-1/2 top-0 flex items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-jewelInk bg-cream-tile px-3 py-1.5 font-sans text-[13px] font-extrabold text-jewelInk"
    style={{ boxShadow: '2px 2px 0 #15100A' }}
    initial={{ x: '-50%', y: -10, opacity: 0, scale: 0.8 }}
    animate={{ x: ['-50%', '-50%', '-50%'], y: [-10, 40, 150], opacity: [0, 1, 0], scale: [0.8, 1, 0.3] }}
    transition={{ delay, duration: 1.1, times: [0, 0.35, 1], ease: 'easeIn' }}
    onAnimationComplete={onLand}
  >
    {icon}{label}
  </motion.div>
)

const icons = {
  words: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={1.8}><rect x="7" y="3.500" width="12.500" height="15" rx="2" /><rect x="4.500" y="6" width="12.500" height="14.500" rx="2" fill="#F5B820" /></svg>,
  verbs: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={1.8}><rect x="3.500" y="3.500" width="17" height="17" rx="4" fill="#E01A3C" /><text x="12" y="16.600" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" stroke="none" fontFamily="Noto Sans Georgian, sans-serif">ზ</text></svg>,
  lessons: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth={1.8}><path d="M12 6.500C10 5 7 4.500 3.500 5v13c3.500-.5 6.500 0 8.500 1.500z" fill="#3A7FCC" /><path d="M12 6.500c2-1.500 5-2 8.500-1.500v13c-3.500-.5-6.500 0-8.500 1.500z" fill="#3A7FCC" /></svg>
}

interface Props {
  /** Есть задание дня — тогда рассказываем, как оно подбирается. */
  personal: boolean
  /** Сколько бесплатных дней лежит в первом подарке; 0 — не обещаем. */
  firstDays: number
  /** Могут ли вообще выпасть бесплатные дни. */
  canGetDays: boolean
  /** Подпись последней кнопки и куда она ведёт. */
  cta: string
  onStart: () => void
  onClose: () => void
}

const Title = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mt-2 font-sans text-[24px] font-extrabold leading-tight text-jewelInk" style={{ textWrap: 'balance' as any }}>{children}</h2>
)
const Text = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 font-sans text-[15px] leading-snug text-jewelInk-mid">{children}</p>
)

export default function TodayIntro({ personal, firstDays, canGetDays, cta, onStart, onClose }: Props) {
  const slides = personal ? ['task', 'prizes', 'go'] : ['prizes', 'go']
  const [i, setI] = useState(0)
  const [squish, setSquish] = useState(0)
  const slide = slides[i]
  const last = i === slides.length - 1

  useEffect(() => { appEvents.tap(`today-intro-${slide}`) }, [slide])

  function next() {
    buzz.light()
    if (last) { markSeen(); onClose(); onStart(); return }
    setI(i + 1)
  }

  const gulp = () => { buzz.soft(); setSquish(n => n + 1) }
  const prizes: { prize: string; name: string; days?: number; ka?: string }[] = [
    canGetDays ? { prize: 'days', name: 'Бесплатные дни подписки', days: firstDays || 1 } : { prize: 'friend', name: 'Подарки для друзей' },
    { prize: 'item:crown', name: 'Одежда для Бомборы' },
    { prize: 'furn:lamp', name: 'Мебель в его дом' },
    { prize: 'word', name: 'Редкие слова с озвучкой', ka: 'ს' },
    { prize: 'freeze', name: 'Заморозка серии' },
    { prize: 'boost', name: 'Двойной опыт' }
  ]

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex flex-col bg-cream"
      style={{ paddingTop: 'var(--safe-t)', paddingBottom: 'var(--safe-b)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      data-testid="today-intro" data-slide={slide}
    >
      <div className="mn-kilim" />
      <div className="flex justify-end px-4 pt-2">
        <button type="button" onClick={() => { markSeen(); onClose() }} className="min-h-[44px] px-2 font-sans text-[13px] font-bold text-jewelInk-mid" data-testid="today-intro-skip">
          пропустить
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6">
        {slide === 'prizes' ? (
          <div className="grid w-full max-w-[340px] grid-cols-3 gap-2" data-testid="today-intro-prizes">
            {prizes.map((p, k) => (
              <motion.div key={p.prize} className="flex flex-col items-center rounded-xl border-[1.5px] border-jewelInk bg-cream-tile px-1 py-1.5"
                initial={reducedMotion() ? false : { scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 16, delay: k * 0.07 }}>
                <div className="flex h-14 w-14 items-center justify-center"><PrizeIcon prize={p.prize} size={50} days={p.days} ka={p.ka} /></div>
                <div className="mt-0.5 flex min-h-[28px] items-center text-center font-sans text-[11px] font-bold leading-[1.2] text-jewelInk">{p.name}</div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="relative flex items-end justify-center" style={{ width: 240, height: 200 }}>
            {slide === 'task' ? (
              <>
                <motion.div key={squish} className="jewel-tile w-full px-4 py-3 text-left"
                  initial={squish ? { scaleY: 0.9, scaleX: 1.05 } : { opacity: 0, y: 20 }} animate={{ scaleY: 1, scaleX: 1, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 12 }}>
                  <div className="relative z-[1] flex items-center gap-3">
                    <div className="w-8 h-8 shrink-0 rounded-full border-[1.5px] border-jewelInk bg-gold flex items-center justify-center font-sans text-[14px] font-extrabold">1</div>
                    <div>
                      <div className="font-sans text-[11px] font-bold uppercase tracking-wider text-jewelInk-mid">Задание дня</div>
                      <div className="font-sans text-[15px] font-bold text-jewelInk">Подобрано под тебя</div>
                    </div>
                  </div>
                </motion.div>
                <Token label="твои слова" icon={icons.words} delay={0.2} onLand={gulp} />
                <Token label="твои глаголы" icon={icons.verbs} delay={0.9} onLand={gulp} />
                <Token label="пройденные уроки" icon={icons.lessons} delay={1.6} onLand={gulp} />
              </>
            ) : (
              <motion.div
                initial={reducedMotion() ? false : { y: -320, rotate: -20 }}
                animate={{ y: 0, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 240, damping: 13, mass: 1.1 }}
                onAnimationComplete={() => buzz.heavy()}
              >
                <LootBox level={3} size={130} idle />
              </motion.div>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={slide}
            className="mt-5 max-w-[330px] text-center"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28 }}
          >
            {slide === 'task' && (<>
              <div className="mn-eyebrow text-ruby">Новое в TraleBot</div>
              <Title>Теперь задания подбираются под твой уровень</Title>
              <Text>Каждый день Бомбора собирает задание на пару минут из твоих слов, глаголов и уроков. Забытое повторишь, знакомое закрепишь, а новое появится вовремя.</Text>
            </>)}
            {slide === 'prizes' && (<>
              <div className="mn-eyebrow text-ruby">{personal ? 'Приз за каждое задание' : 'Приз за урок'}</div>
              <Title>{personal ? 'Проходи задания каждый день и получай ценные призы' : 'Проходи уроки каждый день и получай ценные призы'}</Title>
              {firstDays > 0 && <Text>В первом подарке тебя ждут <b className="text-jewelInk">{days(firstDays)} подписки бесплатно</b>.</Text>}
            </>)}
            {slide === 'go' && (<>
              <div className="mn-eyebrow text-ruby">Чем дольше, тем ценнее</div>
              <Title>На седьмой день подряд тебе точно выпадет сундук</Title>
              <Text>Чем дольше занимаешься без пропусков, тем чаще выпадают редкие призы. А за новый урок в тот же день получишь второй подарок.</Text>
            </>)}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="px-6 pb-6 flex flex-col items-center gap-4">
        <div className="flex gap-2" aria-hidden="true">
          {slides.map((s, k) => (
            <span key={s} className={`h-2 rounded-full border border-jewelInk transition-all ${k === i ? 'w-6 bg-ruby' : 'w-2 bg-cream-deep'}`} />
          ))}
        </div>
        <button type="button" onClick={next} className="jewel-btn bg-navy text-cream w-full" data-testid="today-intro-next">
          <span className="relative z-[1]">{last ? cta : 'Дальше'}</span>
        </button>
      </div>
    </motion.div>
  )
}
