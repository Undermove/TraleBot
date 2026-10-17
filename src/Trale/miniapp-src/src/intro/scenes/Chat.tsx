import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { useLater } from '../../verbs/games/useLater'
import { cyr } from '../../verbs/types'
import Button from '../../components/Button'
import Mascot from '../../components/Mascot'
import { geoName, myName, savedName, saveName, type GeoName } from '../story'
import { Face, GameEnd, GameIntro, Reply, type Look } from '../ui'
import { hush, speakLine } from '../voice'
import Passerby from './walk/Passerby'
import {
  ENDINGS, MAX_WARMTH, answersRu, bankAdd, chatScript, ending, onlyKnown, warmAfter,
  type ChatScript, type Exchange, type Line, type Opt, type Say
} from './chatScripts'
import type { SceneProps, StepOf } from './types'

/**
 * «Нино пишет» — мессенджер с соседкой. Нино пишет, ты отвечаешь, выбирая одну из реплик. Хороший ответ
 * греет разговор (5 точек «теплоты»), смешной промах — её реакция пунктиром, и можно выбрать ещё раз.
 * Конец разговора зависит от теплоты; сказанные фразы ложатся в копилку.
 */

const NINO_LOOK: Look = { coat: '#E01A3C', skin: '#F2C9A0', hair: '#2A1F18', long: true }
/** Сколько Нино «печатает» реплику: длиннее текст — дольше. */
const typeMs = (geo: string) => Math.min(1600, 500 + geo.length * 28)
const GAP_MS = 350

type Msg =
  | { kind: 'her'; geo: string; ru: string }
  | { kind: 'me'; geo: string; ru: string; bad?: boolean }
  | { kind: 'note'; text: string }
  | { kind: 'photo'; caption: string; seed: number }

const TITLES: Record<ChatScript, string> = {
  act2: 'Знакомство в чате',
  act3: 'Соседка Нино',
  act4: 'Нино пишет снова',
  act6: 'Нино и Грузия'
}

export function Warmth({ value }: { value: number }) {
  return (
    <div className="flex flex-col items-end gap-0.5 shrink-0" role="meter" aria-label="теплота разговора" aria-valuenow={value} aria-valuemin={0} aria-valuemax={MAX_WARMTH} data-testid="chat-warmth" data-value={value}>
      <span className="text-[10px] font-extrabold uppercase tracking-wide text-jewelInk-mid leading-none" aria-hidden>теплота</span>
      <svg width={MAX_WARMTH * 15} height="14" viewBox={`0 0 ${MAX_WARMTH * 15} 14`} aria-hidden>
        {Array.from({ length: MAX_WARMTH }, (_, i) => (
          <circle key={i} cx={7 + i * 15} cy="7" r="5.5" fill={i < value ? '#E01A3C' : '#FDFAEF'} stroke="#15100A" strokeWidth="1.5" style={{ transition: 'fill 300ms' }} />
        ))}
      </svg>
    </div>
  )
}

function Photo({ caption, seed }: { caption: string; seed: number }) {
  const pair = useMemo(() => {
    let s = seed + 1
    const r = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
    const COATS = ['#1B5FB0', '#E01A3C', '#4E8A5B', '#C68F10', '#7A4E9A', '#2F7F86']
    const SKIN = ['#F2C9A0', '#E0AC7E', '#C68A5E', '#F6D7BC']
    const p = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
    return [0, 1].map(k => ({ ru: '', kind: (k ? 'woman' : 'man') as 'man' | 'woman', coat: p(COATS), skin: p(SKIN), hair: '#2A1F18', extra: (k ? 'bag' : 'cap') as 'bag' | 'cap', voice: 'f' as const }))
  }, [seed])
  return (
    <div className="self-start max-w-[78%] rounded-2xl rounded-bl-md border-[1.5px] border-jewelInk bg-cream-tile p-1.5" data-testid="chat-photo" style={{ boxShadow: '2px 2px 0 #15100A' }}>
      <div className="relative rounded-xl border-[1.5px] border-jewelInk flex items-end justify-center gap-0 px-3 pt-2 h-[96px] ab-short:h-[72px] overflow-hidden" style={{ background: 'linear-gradient(#9CC6EE, #E6F0F6 60%, #E3D6BE 60%)' }}>
        {pair.map((w, i) => (
          <svg key={i} width="58" height="96" viewBox="-50 -190 100 200" className="overflow-visible -mb-6" aria-hidden>
            <Passerby who={w} phase={0} stride={0} face="smile" talking={false} wave={i === 0} />
          </svg>
        ))}
      </div>
      <div className="mt-1 px-1 text-[11px] leading-snug text-jewelInk-soft">{caption}</div>
    </div>
  )
}

function Bubbles({ msgs, typing }: { msgs: Msg[]; typing: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  // Чат держится за низ, как мессенджер: не только когда пришло сообщение, но и когда снизу выехали
  // кнопки ответа (окно чата стало ниже) или пузырь дорос в анимации. Если человек сам пролистал вверх
  // — не дёргаем; новое сообщение всё равно возвращает вниз.
  const stick = useRef(true)
  const toBottom = () => { const el = ref.current; if (el && stick.current) el.scrollTop = el.scrollHeight }
  useEffect(() => { stick.current = true; toBottom() }, [msgs.length, typing])
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(toBottom)
    if (ref.current) ro.observe(ref.current)
    if (inner.current) ro.observe(inner.current)
    return () => ro.disconnect()
  }, [])
  const onScroll = () => { const el = ref.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48 }
  return (
    <div ref={ref} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto p-3" data-testid="chat-log"
      style={{ background: '#EAF0E4', backgroundImage: 'radial-gradient(#D5DFCB 1.2px, transparent 1.2px)', backgroundSize: '18px 18px' }}>
      <div ref={inner} className="flex flex-col gap-2">
      {msgs.map((m, k) => {
        const mine = m.kind === 'me'
        const last = mine && msgs.slice(k + 1).every(x => x.kind !== 'me')
        return (
          <motion.div key={k} layout className={`flex flex-col max-w-[84%] ${m.kind === 'note' ? 'self-center' : mine ? 'self-end items-end' : 'self-start items-start'}`}
            style={{ transformOrigin: mine ? '100% 100%' : m.kind === 'note' ? '50% 50%' : '0% 100%' }}
            initial={{ opacity: 0, scale: 0.7, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0, x: mine && m.bad ? [0, -6, 6, -3, 3, 0] : 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}>
            {m.kind === 'note' ? (
              <div className="rounded-xl border-[1.5px] border-dashed border-jewelInk-hint bg-cream/70 px-3 py-1 text-center text-[12px] font-semibold text-jewelInk-soft" data-testid="chat-note">{m.text}</div>
            ) : m.kind === 'photo' ? <Photo caption={m.caption} seed={m.seed} /> : (
              <>
                <button type="button" onClick={() => { void speakLine(m.geo, mine ? 'hero' : 'f') }}
                  className={`text-left rounded-2xl border-[1.5px] border-jewelInk px-3 py-1.5 ${mine ? `rounded-br-md ${m.bad ? 'bg-ruby-wash' : 'bg-gold-wash'}` : 'rounded-bl-md bg-cream-tile'}`}
                  style={{ boxShadow: '2px 2px 0 #15100A' }}
                  data-testid={mine ? 'chat-mine' : 'chat-hers'}>
                  <span className="block font-geo font-bold text-[16px] leading-tight">{m.geo}</span>
                  <span className="block text-[11px] font-semibold text-jewelInk-hint">{cyr(m.geo)}</span>
                  <span className="block text-[11px] text-jewelInk-soft">{m.ru}</span>
                </button>
                {/* Галочки: отправлено — серые, Нино ответила — синие. */}
                {mine && !m.bad && last && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-0.5 mr-1 text-[10px] font-bold" style={{ color: msgs.slice(k + 1).some(x => x.kind === 'her') ? '#1B5FB0' : '#9A8F7E' }} aria-label="доставлено">✓✓</motion.span>
                )}
              </>
            )}
          </motion.div>
        )
      })}
      <AnimatePresence>
        {typing && (
          <motion.div key="typing" className="self-start rounded-2xl rounded-bl-md border-[1.5px] border-jewelInk bg-cream-tile px-3 py-2.5 flex gap-1" data-testid="chat-typing" aria-label="Нино печатает"
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} style={{ transformOrigin: '0% 100%' }}>
            {[0, 1, 2].map(i => <motion.span key={i} className="block w-2 h-2 rounded-full bg-jewelInk-hint" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }} />)}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  )
}

/** Подтвердить имя (в первом чате): по-русски → как по-грузински, с правилом ი. */
function NameStart({ onStart, answers }: { onStart: (name: GeoName) => void; answers: number }) {
  const [raw, setRaw] = useState(savedName())
  const g = geoName(raw)
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center gap-2.5" data-testid="chat-name-start">
      <div className="ab-short:hidden"><Mascot mood="guide" size={72} /></div>
      <div className="text-[20px] font-extrabold leading-tight">Нино пишет тебе</div>
      <p className="text-[14px] leading-snug text-jewelInk-soft max-w-[32ch]">Соседка сверху нашла тебя в мессенджере. Сначала проверь, как тебя зовут по-грузински, — так она тебя и запомнит. Потом ответь ей: в разговоре {answersRu(answers)}, чем теплее — тем лучше конец.</p>
      <label htmlFor="chat-name" className="text-[13px] font-bold">Твоё имя по-русски</label>
      <input id="chat-name" data-testid="chat-name-input" value={raw} onChange={e => setRaw(e.target.value)} placeholder="Например, Карлос"
        className="w-full max-w-[260px] min-h-[44px] rounded-xl border-[1.5px] border-jewelInk bg-cream-tile px-3 text-center text-[17px] font-bold outline-none" style={{ boxShadow: '2px 2px 0 #15100A' }} />
      <div className="font-geo text-[26px] font-extrabold leading-none" data-testid="chat-name-geo">{g.geo}</div>
      <div className="text-[12px] font-semibold text-jewelInk-hint">{cyr(g.geo)}</div>
      <p className="text-[12px] leading-snug text-jewelInk-soft max-w-[34ch]">
        {g.added ? <>Имя кончается на согласную — грузины добавят <b className="font-geo">ი</b> (и): <b className="font-geo">{g.base}</b> → <b className="font-geo">{g.geo}</b>. Как Карлос → <b className="font-geo">კარლოსი</b>.</> : 'Имя кончается на гласную — его так и говорят.'}
      </p>
      <div className="w-full max-w-[280px]"><Button onClick={() => { haptic('pop'); if (raw.trim()) saveName(raw.trim()); onStart(g) }}>Открыть чат</Button></div>
    </div>
  )
}

export default function Chat({ lesson, step, fraction, onExit, onDone, rng = Math.random }: SceneProps<StepOf<'chat'>>) {
  const script = step.script
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro')
  const [me, setMe] = useState<GeoName>(() => myName())
  const [round, setRound] = useState(0)
  const plan: Exchange[] = useMemo(() => onlyKnown(chatScript(script, me, rng), lesson.id), [script, me, lesson.id, round]) // eslint-disable-line react-hooks/exhaustive-deps
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [typing, setTyping] = useState(false)
  const [i, setI] = useState(0)
  const [open, setOpen] = useState(false)
  const [tried, setTried] = useState<number[]>([])
  const [warmth, setWarmth] = useState(1)
  const [bank, setBank] = useState<Line[]>([])
  const [over, setOver] = useState(false)
  const later = useLater()

  const alive = useRef(true)
  useEffect(() => () => { alive.current = false; hush() }, [])
  const push = (m: Msg) => setMsgs(ms => [...ms, m])
  const toMsg = (s: Say): Msg => s.kind === 'her' ? { kind: 'her', geo: s.geo, ru: s.ru } : s

  /**
   * Нино «печатает» и выкладывает реплики по одной; каждую произносит своим голосом — следующая
   * начинается, когда договорила предыдущая. Потом — что дальше.
   */
  const herSays = (list: Say[], then: () => void) => {
    if (!list.length) { then(); return }
    const [head, ...rest] = list
    if (head.kind !== 'her') { push(toMsg(head)); later(() => herSays(rest, then), GAP_MS); return }
    setTyping(true)
    later(() => {
      setTyping(false)
      push(toMsg(head))
      sound.pop(); haptic('soft')
      void speakLine(head.geo, 'f').then(() => { if (alive.current) later(() => herSays(rest, then), GAP_MS) })
    }, typeMs(head.geo))
  }

  const runExchange = (k: number) => {
    if (k >= plan.length) { finish(); return }
    setI(k); setTried([]); setOpen(false)
    herSays(plan[k].her, () => setOpen(true))
  }

  const start = (name?: GeoName) => {
    if (name) setMe(name)
    setMsgs([]); setWarmth(1); setBank([]); setOver(false); setI(0)
    setPhase('play')
  }
  // Новый план (имя, «ещё раз») — новый разговор.
  useEffect(() => { if (phase === 'play') runExchange(0) }, [phase, plan]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = () => {
    setOpen(false)
    later(() => { push({ kind: 'note', text: ENDINGS[script][ending(warmthRef.current)] }); sound.win(); haptic('good'); setOver(true) }, 600)
  }
  const warmthRef = useRef(warmth)
  warmthRef.current = warmth

  const choose = (o: Opt, k: number, el: HTMLElement) => {
    const w = warmAfter(warmth, o)
    setWarmth(w); warmthRef.current = w
    if (!o.good) {
      push({ kind: 'me', geo: o.geo, ru: o.ru, bad: true })
      setTried(t => [...t, k])
      haptic('bad'); sound.miss()
      later(() => push({ kind: 'note', text: o.miss ?? 'Нино не поняла. Попробуй другой ответ.' }), 500)
      return
    }
    setOpen(false)
    push({ kind: 'me', geo: o.geo, ru: o.ru })
    haptic('pop'); sound.snap(w)
    if (o.w >= 2) burst(el, 'small')
    setBank(b => bankAdd(b, o))
    // Сказал — дослушали — Нино отвечает.
    void speakLine(o.geo, 'hero').then(() => { if (alive.current) later(() => herSays(o.then ?? [], () => runExchange(i + 1)), 300) })
  }

  const intro = script === 'act2'
    ? <NameStart onStart={n => start(n)} answers={plan.length} />
    : <GameIntro title="Нино пишет" text={`Соседка Нино пишет тебе в мессенджер. В разговоре ${answersRu(plan.length)} — отвечай репликами, которые знаешь. Кружки «теплота» сверху: чем теплее разговор, тем интереснее конец.`} hero onStart={() => start()} />

  if (phase === 'end') {
    const e = ending(warmth)
    return (
      <GameFrame title={TITLES[script]} eyebrow="нино пишет" fraction={fraction} onExit={onExit}>
        <GameEnd
          title={e === 'warm' ? 'Тёплый разговор!' : e === 'ok' ? 'Хорошо поболтали' : 'Разговор окончен'}
          text={ENDINGS[script][e]}
          rule={<div className="flex flex-col items-center gap-1.5" data-testid="chat-bank">
            <div className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-navy">в копилку</div>
            <div className="flex flex-wrap justify-center gap-1.5">{bank.map(b => (
              <span key={b.geo} className="rounded-lg border-[1.5px] border-jewelInk bg-cream-tile px-2 py-0.5 text-[12px]"><b className="font-geo">{b.geo}</b> — {b.ru}</span>
            ))}</div>
          </div>}
          onNext={onDone}
          onAgain={() => { setRound(r => r + 1); start() }}
        />
      </GameFrame>
    )
  }

  const ex = plan[i]
  const hint = tried.length >= 2
  return (
    <GameFrame title={TITLES[script]} eyebrow={`нино пишет · урок ${lesson.id}`} fraction={fraction} onExit={onExit}>
      {phase === 'intro' ? intro : (
        <div className="flex-1 min-h-0 flex flex-col gap-2" data-testid="chat-scene">
          <div className="overflow-hidden flex-1 min-h-0 flex flex-col rounded-2xl border-[1.5px] border-jewelInk" style={{ boxShadow: '3px 3px 0 #15100A' }}>
            <div className="shrink-0 flex items-center gap-2.5 px-3 py-2 border-b-[1.5px] border-jewelInk bg-cream-deep">
              <div className="relative">
                <Face look={NINO_LOOK} size={40} mood={warmth >= 3 ? 'smile' : 'huh'} />
                <span className="absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-[1.5px] border-cream bg-[#4E8A5B]" />
              </div>
              <div className="flex-1 min-w-0 leading-tight">
                <div className="text-[14px] font-extrabold">Нино · <span className="font-geo">ნინო</span></div>
                <div className="text-[12px] text-jewelInk-hint" data-testid="chat-status">{typing ? 'печатает…' : 'в сети'} · <span data-testid="chat-progress">ответ {Math.min(i + 1, plan.length)} из {plan.length}</span></div>
              </div>
              <Warmth value={warmth} />
            </div>
            <Bubbles msgs={msgs} typing={typing} />
          </div>
          <div className="shrink-0 flex flex-col gap-2 min-h-[52px]" data-testid="chat-options">
            {over ? (
              <Button onClick={() => { haptic('pop'); setPhase('end') }}><span data-testid="chat-finish">Итоги разговора</span></Button>
            ) : open && ex ? ex.opts.map((o, k) => (
              <motion.div key={`${i}-${k}`} className={`rounded-2xl ${hint && o.good ? 'ring-2 ring-gold ring-offset-2 ring-offset-cream' : ''}`}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 26, delay: k * 0.06 }}>
                <Reply geo={o.geo} compact disabled={tried.includes(k)} state={tried.includes(k) ? 'dim' : 'idle'}
                  testId={o.good ? 'chat-reply-ok' : 'chat-reply-miss'}
                  onClick={() => choose(o, k, document.querySelector('[data-testid="chat-warmth"]') as HTMLElement)} />
              </motion.div>
            )) : (
              <div className="text-center text-[12px] text-jewelInk-hint py-3">{typing ? 'Нино печатает…' : ''}</div>
            )}
          </div>
        </div>
      )}
    </GameFrame>
  )
}
