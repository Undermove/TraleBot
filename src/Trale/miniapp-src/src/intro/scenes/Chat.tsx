import React, { useEffect, useMemo, useRef, useState } from 'react'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { useLater } from '../../verbs/games/useLater'
import { cyr } from '../../verbs/types'
import Button from '../../components/Button'
import Mascot from '../../components/Mascot'
import { geoName, myName, savedName, saveName, type GeoName } from '../story'
import { Face, GameEnd, GameIntro, Person, Reply, randomLook, say, type Look } from '../ui'
import {
  ENDINGS, MAX_WARMTH, bankAdd, chatScript, ending, onlyKnown, warmAfter,
  type ChatScript, type Exchange, type Line, type Opt, type Say
} from './chatScripts'
import type { SceneProps, StepOf } from './types'

/**
 * «Нино пишет» — мессенджер с соседкой. Нино пишет, ты отвечаешь, выбирая одну из реплик. Хороший ответ
 * греет разговор (5 точек «теплоты»), смешной промах — её реакция пунктиром, и можно выбрать ещё раз.
 * Конец разговора зависит от теплоты; сказанные фразы ложатся в копилку.
 */

const NINO_LOOK: Look = { coat: '#E01A3C', skin: '#F2C9A0', hair: '#2A1F18', long: true }
const TYPE_MS = 900
const GAP_MS = 450

type Msg =
  | { kind: 'her'; geo: string; ru: string; id?: string }
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
    <div className="flex gap-[3px] shrink-0" role="meter" aria-label="теплота разговора" aria-valuenow={value} aria-valuemin={0} aria-valuemax={MAX_WARMTH} data-testid="chat-warmth" data-value={value}>
      <svg width={MAX_WARMTH * 15} height="14" viewBox={`0 0 ${MAX_WARMTH * 15} 14`} aria-hidden>
        {Array.from({ length: MAX_WARMTH }, (_, i) => (
          <circle key={i} cx={7 + i * 15} cy="7" r="5.5" fill={i < value ? '#E01A3C' : '#FDFAEF'} stroke="#15100A" strokeWidth="1.5" style={{ transition: 'fill 300ms' }} />
        ))}
      </svg>
    </div>
  )
}

function Photo({ caption, seed }: { caption: string; seed: number }) {
  const looks = useMemo(() => {
    let s = seed + 1
    const r = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
    return [randomLook(r), randomLook(r, { bag: true })]
  }, [seed])
  return (
    <div className="self-start zn-in-left max-w-[78%] rounded-2xl rounded-bl-md border-[1.5px] border-jewelInk bg-cream-tile p-1.5" data-testid="chat-photo">
      <div className="rounded-xl border-[1.5px] border-jewelInk bg-navy-wash flex items-end justify-center gap-1 px-4 pt-2 h-[86px] ab-short:h-[66px] overflow-hidden">
        {looks.map((l, i) => <Person key={i} look={l} height={78} />)}
      </div>
      <div className="mt-1 px-1 text-[11px] leading-snug text-jewelInk-soft">{caption}</div>
    </div>
  )
}

function Bubbles({ msgs, typing }: { msgs: Msg[]; typing: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight }, [msgs.length, typing])
  return (
    <div ref={ref} className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 p-3 bg-[#EAF0E4]" data-testid="chat-log">
      {msgs.map((m, k) => {
        if (m.kind === 'note') return (
          <div key={k} className="zn-pop self-center max-w-[92%] rounded-xl border-[1.5px] border-dashed border-jewelInk-hint px-3 py-1 text-center text-[12px] font-semibold text-jewelInk-soft" data-testid="chat-note">{m.text}</div>
        )
        if (m.kind === 'photo') return <Photo key={k} caption={m.caption} seed={m.seed} />
        const mine = m.kind === 'me'
        return (
          <button key={k} type="button" onClick={() => m.kind === 'her' && m.id && say(m.id)}
            className={`max-w-[82%] text-left rounded-2xl border-[1.5px] border-jewelInk px-3 py-1.5 ${mine ? `self-end zn-in-right rounded-br-md ${m.bad ? 'bg-ruby-wash' : 'bg-gold-wash'}` : 'self-start zn-in-left rounded-bl-md bg-cream-tile'}`}
            data-testid={mine ? 'chat-mine' : 'chat-hers'}>
            <span className="block font-geo font-bold text-[16px] leading-tight">{m.geo}</span>
            <span className="block text-[11px] font-semibold text-jewelInk-hint">{cyr(m.geo)}</span>
            <span className="block text-[11px] text-jewelInk-soft">{m.ru}</span>
          </button>
        )
      })}
      {typing && <div className="self-start rounded-2xl rounded-bl-md border-[1.5px] border-jewelInk bg-cream-tile px-3 py-2 zn-dots" data-testid="chat-typing" aria-label="Нино печатает"><i /><i /><i /></div>}
    </div>
  )
}

/** Подтвердить имя (в первом чате): по-русски → как по-грузински, с правилом ი. */
function NameStart({ onStart }: { onStart: (name: GeoName) => void }) {
  const [raw, setRaw] = useState(savedName())
  const g = geoName(raw)
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center gap-2.5" data-testid="chat-name-start">
      <div className="ab-short:hidden"><Mascot mood="guide" size={72} /></div>
      <div className="text-[20px] font-extrabold leading-tight">Нино пишет тебе</div>
      <p className="text-[14px] leading-snug text-jewelInk-soft max-w-[32ch]">Соседка сверху нашла тебя в мессенджере. Сначала проверь, как тебя зовут по-грузински, — так она тебя и запомнит.</p>
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

  const push = (m: Msg) => setMsgs(ms => [...ms, m])
  const toMsg = (s: Say): Msg => s.kind === 'her' ? { kind: 'her', geo: s.geo, ru: s.ru, id: s.ids.length === 1 ? s.ids[0] : undefined } : s

  /** Нино «печатает» и выкладывает реплики по одной, потом — что дальше. */
  const herSays = (list: Say[], then: () => void) => {
    if (!list.length) { then(); return }
    const [head, ...rest] = list
    if (head.kind !== 'her') { push(toMsg(head)); later(() => herSays(rest, then), GAP_MS); return }
    setTyping(true)
    later(() => {
      setTyping(false)
      push(toMsg(head))
      sound.pop()
      if (head.ids.length === 1) say(head.ids[0])
      later(() => herSays(rest, then), GAP_MS)
    }, TYPE_MS)
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
    if (o.ids.length === 1) say(o.ids[0])
    haptic('good'); sound.snap(w)
    if (o.w >= 2) burst(el, 'small')
    setBank(b => bankAdd(b, o))
    later(() => herSays(o.then ?? [], () => runExchange(i + 1)), 500)
  }

  const intro = script === 'act2'
    ? <NameStart onStart={n => start(n)} />
    : <GameIntro title="Нино пишет" text="Соседка Нино пишет тебе в мессенджер. Отвечай репликами, которые знаешь: чем теплее разговор, тем интереснее конец." onStart={() => start()} />

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
              <Face look={NINO_LOOK} size={38} mood={warmth >= 3 ? 'smile' : 'huh'} />
              <div className="flex-1 min-w-0 leading-tight">
                <div className="text-[14px] font-extrabold">Нино · <span className="font-geo">ნინო</span></div>
                <div className="text-[12px] text-jewelInk-hint" data-testid="chat-status">{typing ? 'печатает…' : 'в сети'}</div>
              </div>
              <Warmth value={warmth} />
            </div>
            <Bubbles msgs={msgs} typing={typing} />
          </div>
          <div className="shrink-0 flex flex-col gap-2 min-h-[52px]" data-testid="chat-options">
            {over ? (
              <Button onClick={() => { haptic('pop'); setPhase('end') }}><span data-testid="chat-finish">Итоги разговора</span></Button>
            ) : open && ex ? ex.opts.map((o, k) => (
              <div key={`${i}-${k}`} className={`zn-pop rounded-2xl ${hint && o.good ? 'ring-2 ring-gold ring-offset-2 ring-offset-cream' : ''}`}>
                <Reply geo={o.geo} compact disabled={tried.includes(k)} state={tried.includes(k) ? 'dim' : 'idle'}
                  testId={o.good ? 'chat-reply-ok' : 'chat-reply-miss'}
                  onClick={() => choose(o, k, document.querySelector('[data-testid="chat-warmth"]') as HTMLElement)} />
              </div>
            )) : (
              <div className="text-center text-[12px] text-jewelInk-hint py-3">{typing ? 'Нино печатает…' : ''}</div>
            )}
          </div>
        </div>
      )}
    </GameFrame>
  )
}
