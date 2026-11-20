import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Gift3D, { Gift3DHandle } from './Gift3D'
import { buzz, reducedMotion } from './sensors'
import { appEvents } from '../analytics/appEvents'
import './today.css'

// «Что нового» — один раз, тем, кто уже учился до обновления главной. Три коротких экрана: подарок дня,
// из чего он собран (слова, глаголы, уроки влетают в коробку), сколько это занимает. Без терминов.

const KEY = 'today-intro-v2'

/** Показывать ли: человек уже учился (есть опыт), ещё не видел, не тесты (там — только по ?intro=1). */
// Адрес читаем при загрузке: приложение потом переписывает его (диплинки), и флаг тестов пропал бы.
const startParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
const quietInTests = startParams.get('playwright') === '1' && startParams.get('intro') !== '1'

export function shouldShowTodayIntro(hasXp: boolean): boolean {
  if (!hasXp || quietInTests) return false
  try { return localStorage.getItem(KEY) !== '1' } catch { return false }
}

function markSeen() { try { localStorage.setItem(KEY, '1') } catch {} }

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
  /** Есть задание дня — тогда рассказываем, из чего оно собрано. */
  personal: boolean
  onClose: () => void
}

export default function TodayIntro({ personal, onClose }: Props) {
  const slides = personal ? ['gift', 'inside', 'go'] : ['gift', 'go']
  const [i, setI] = useState(0)
  const box = useRef<Gift3DHandle>(null)
  const [squish, setSquish] = useState(0)
  const slide = slides[i]
  const last = i === slides.length - 1

  useEffect(() => { appEvents.tap(`today-intro-${slide}`) }, [slide])

  function next() {
    buzz.light()
    if (last) { markSeen(); onClose(); return }
    setI(i + 1)
  }

  const gulp = () => { buzz.soft(); setSquish(n => n + 1) }
  // Последний экран: подарок раскрывается сам — так видно, что будет в конце дня.
  useEffect(() => {
    if (slide !== 'go') return
    const id = setTimeout(() => box.current?.open(), 500)
    return () => clearTimeout(id)
  }, [slide])

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex flex-col bg-cream"
      style={{ paddingTop: 'var(--safe-t)', paddingBottom: 'var(--safe-b)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      data-testid="today-intro"
    >
      <div className="mn-kilim" />
      <div className="flex justify-end px-4 pt-2">
        <button type="button" onClick={() => { markSeen(); onClose() }} className="min-h-[44px] px-2 font-sans text-[13px] font-bold text-jewelInk-mid" data-testid="today-intro-skip">
          пропустить
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="relative flex items-end justify-center" style={{ width: 240, height: 240 }}>
          {slide === 'inside' ? (
            <>
              <motion.div key={squish} className="jewel-tile w-full px-4 py-3 text-left"
                initial={squish ? { scaleY: 0.9, scaleX: 1.05 } : { opacity: 0, y: 20 }} animate={{ scaleY: 1, scaleX: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 12 }}>
                <div className="relative z-[1] flex items-center gap-3">
                  <div className="w-8 h-8 shrink-0 rounded-full border-[1.5px] border-jewelInk bg-gold flex items-center justify-center font-sans text-[14px] font-extrabold">1</div>
                  <div>
                    <div className="font-sans text-[11px] font-bold uppercase tracking-wider text-jewelInk-mid">Повторение</div>
                    <div className="font-sans text-[15px] font-bold text-jewelInk">Собрано под тебя</div>
                  </div>
                </div>
              </motion.div>
              <Token label="твои слова" icon={icons.words} delay={0.2} onLand={gulp} />
              <Token label="твои глаголы" icon={icons.verbs} delay={0.9} onLand={gulp} />
              <Token label="пройденные уроки" icon={icons.lessons} delay={1.6} onLand={gulp} />
            </>
          ) : (
            <motion.div
              key={slide}
              initial={reducedMotion() ? false : { y: -320, rotate: -20 }}
              animate={{ y: 0, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 13, mass: 1.1 }}
              onAnimationComplete={() => buzz.heavy()}
            >
              <Gift3D ref={box} size={130} idle={slide === 'gift'}>
                <div className="rounded-2xl border-[2px] border-jewelInk bg-cream-tile px-4 py-2 text-center font-sans text-[20px] font-extrabold text-jewelInk whitespace-nowrap" style={{ boxShadow: '3px 3px 0 #15100A' }}>+20 <span className="text-[13px]">опыта</span></div>
              </Gift3D>
            </motion.div>
          )}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={slide}
            className="mt-6 max-w-[330px] text-center"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28 }}
          >
            {slide === 'gift' && (<>
              <div className="mn-eyebrow text-ruby">Новая главная</div>
              <h2 className="mt-2 font-sans text-[24px] font-extrabold leading-tight text-jewelInk" style={{ textWrap: 'balance' as any }}>Каждый день — подарок от Бомборы</h2>
              <p className="mt-3 font-sans text-[15px] leading-snug text-jewelInk-mid">{personal ? 'Он ждёт в конце дня: пройди два коротких шага — повторение и новое — и открывай.' : 'Он ждёт в конце дня: пройди урок — и открывай.'}</p>
            </>)}
            {slide === 'inside' && (<>
              <div className="mn-eyebrow text-ruby">Собран под тебя</div>
              <h2 className="mt-2 font-sans text-[24px] font-extrabold leading-tight text-jewelInk" style={{ textWrap: 'balance' as any }}>Повторение — из того, что ты уже учил</h2>
              <p className="mt-3 font-sans text-[15px] leading-snug text-jewelInk-mid">Слова из твоего словаря, глаголы и пройденные уроки. Что начал забывать — повторим, что знаешь — закрепим. Второй шаг — новое: Бомбора подскажет, что пройти дальше.</p>
            </>)}
            {slide === 'go' && (<>
              <div className="mn-eyebrow text-ruby">Пара минут в день</div>
              <h2 className="mt-2 font-sans text-[24px] font-extrabold leading-tight text-jewelInk" style={{ textWrap: 'balance' as any }}>Открыл подарок — серия растёт</h2>
              <p className="mt-3 font-sans text-[15px] leading-snug text-jewelInk-mid">Увлёкся — бери ещё раунд. Курс, глаголы и словарь — во вкладках внизу, между ними можно листать свайпом.</p>
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
          <span className="relative z-[1]">{last ? 'К подарку' : 'Дальше'}</span>
        </button>
      </div>
    </motion.div>
  )
}
