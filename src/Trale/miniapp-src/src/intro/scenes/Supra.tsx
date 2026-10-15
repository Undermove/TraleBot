import React, { useEffect, useMemo, useRef, useState } from 'react'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { useLater } from '../../verbs/games/useLater'
import { cyr } from '../../verbs/types'
import Button from '../../components/Button'
import { myName } from '../story'
import { Bubble, Face, GameEnd, GameIntro, Meter, Pill, Reply, randomLook, say, type Look, type Mood } from '../ui'
import type { Opt, Say } from './chatScripts'
import {
  BEATS, GUEST_MS, RAISE_MISS, THEME_RU, TOASTS, TOAST_TRIES, TOAST_ZONE, guestWarmth, guests, needle, raiseAt, toastOpts
} from './supra.logic'
import type { SceneProps, StepOf } from './types'

/**
 * «Супра» — финал «Знакомства». Длинный стол, шесть гостей и тамада. Гости по очереди поворачиваются к тебе:
 * у каждого своя тема модуля и короткий таймер. Между гостями тамада поднимает тост — поймай момент,
 * подними бокал и ответь на тост. В конце — общее фото стола.
 */

const NINO_LOOK: Look = { coat: '#E01A3C', skin: '#F2C9A0', hair: '#2A1F18', long: true }
const TAMADA_LOOK: Look = { coat: '#3A2B1F', skin: '#E0AC7E', hair: '#15100A', age: 'old' }
const ME_LOOK: Look = { coat: '#1B5FB0', skin: '#F6D7BC', hair: '#5A3A22' }
const TICK_MS = 100
const SPEECH_MS = 1600

type ToastStage = 'speech' | 'raise' | 'answer'

function Glass({ full = true }: { full?: boolean }) {
  return (
    <svg width="22" height="28" viewBox="0 0 22 28" aria-hidden>
      <path d="M3 2 H19 L16 17 Q11 21 6 17 Z" fill="#FDFAEF" stroke="#15100A" strokeWidth="1.5" />
      {full && <path d="M4.4 7 H17.6 L15.6 16 Q11 19.5 6.4 16 Z" fill="#A61026" />}
      <path d="M11 20 V25 M6 26 H16" stroke="#15100A" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function Table({ looks, moods, active, warm, toast }: { looks: Look[]; moods: Mood[]; active: number | null; warm: (number | null)[]; toast: boolean }) {
  const seat = (i: number) => {
    const col = Math.floor(i / 2), top = i % 2 === 0
    return { left: `${25 + col * 25}%`, top: top ? '4%' : undefined, bottom: top ? undefined : '4%' }
  }
  return (
    <div className="relative w-full h-[168px] ab-short:h-[128px] shrink-0" data-testid="supra-table">
      <div className="absolute left-[13%] right-[13%] top-[28%] bottom-[28%] rounded-[18px] border-[1.5px] border-jewelInk bg-cream-tile" style={{ boxShadow: '3px 3px 0 #15100A' }}>
        <svg viewBox="0 0 200 50" preserveAspectRatio="none" className="w-full h-full" aria-hidden>
          <path d="M4 25 H196" stroke="#E8DEC5" strokeWidth="14" />
          {[22, 58, 100, 142, 178].map((x, k) => (
            <g key={x}>
              <ellipse cx={x} cy={25} rx="11" ry="8" fill={['#F5B820', '#4E8A5B', '#E8DEC5', '#D4563B', '#F5B820'][k]} stroke="#15100A" strokeWidth="1.2" />
              {k === 2 && <ellipse cx={x} cy={25} rx="5" ry="3.5" fill="#F9EAC1" stroke="#15100A" strokeWidth="1" />}
            </g>
          ))}
          {[40, 80, 120, 160].map(x => <circle key={x} cx={x} cy={k2(x)} r="2.8" fill="#A61026" stroke="#15100A" strokeWidth="0.8" />)}
        </svg>
      </div>
      {looks.map((l, i) => (
        <div key={i} className={`absolute -translate-x-1/2 flex flex-col items-center ${active === i ? 'zn-bob' : ''}`} style={seat(i)} data-testid="supra-guest" data-warm={warm[i] ?? ''}>
          <div className={`rounded-full ${active === i ? 'ring-[3px] ring-navy' : warm[i] ? 'ring-[3px] ring-gold' : ''}`}>
            <Face look={l} size={40} mood={moods[i]} />
          </div>
        </div>
      ))}
      <div className={`absolute left-0 top-1/2 -translate-y-1/2 flex flex-col items-center ${toast ? 'zn-bob' : ''}`}>
        <div className={`rounded-full ${toast ? 'ring-[3px] ring-ruby' : ''}`}><Face look={TAMADA_LOOK} size={44} mood={toast ? 'wow' : 'smile'} /></div>
        <span className="text-[10px] font-extrabold text-jewelInk-soft">тамада</span>
      </div>
      <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col items-center">
        <Face look={ME_LOOK} size={40} />
        <span className="text-[10px] font-extrabold text-jewelInk-soft">ты</span>
      </div>
    </div>
  )
}
const k2 = (x: number) => (x / 40) % 2 ? 9 : 41

function Lines({ lines }: { lines: Say[] }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      {lines.map((l, i) => l.kind === 'her' ? (
        <Bubble key={`${l.geo}${i}`} className="self-start text-left">
          <button type="button" onClick={() => l.ids.length === 1 && say(l.ids[0])} className="text-left">
            <span className="block font-geo font-bold text-[16px] leading-tight">{l.geo}</span>
            <span className="block text-[11px] font-semibold text-jewelInk-hint">{cyr(l.geo)} · {l.ru}</span>
          </button>
        </Bubble>
      ) : l.kind === 'note' ? <div key={i} className="text-[12px] font-semibold text-jewelInk-soft">{l.text}</div> : null)}
    </div>
  )
}

export default function Supra({ lesson, fraction, onExit, onDone, rng = Math.random, now = Date.now }: SceneProps<StepOf<'supra'>>) {
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro')
  const [round, setRound] = useState(0)
  const me = useMemo(() => myName(), [round]) // eslint-disable-line react-hooks/exhaustive-deps
  const table = useMemo(() => guests(me, rng), [me]) // eslint-disable-line react-hooks/exhaustive-deps
  const looks = useMemo(() => table.map((g, i) => (i === 0 ? NINO_LOOK : randomLook(rng, { age: g.theme === 'family' ? 'old' : 'adult' }))), [table]) // eslint-disable-line react-hooks/exhaustive-deps
  const toastLists = useMemo(() => TOASTS.map(t => toastOpts(!!t.georgia, rng)), [table]) // eslint-disable-line react-hooks/exhaustive-deps

  const [b, setB] = useState(0)
  const [e, setE] = useState(0)
  const [tried, setTried] = useState<number[]>([])
  const [missed, setMissed] = useState(0)
  const [extra, setExtra] = useState<Say[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [warm, setWarm] = useState<(number | null)[]>(() => table.map(() => null))
  const [note, setNote] = useState<string | null>(null)
  const [clock, setClock] = useState(() => now())
  const [since, setSince] = useState(() => now())
  const [stage, setStage] = useState<ToastStage>('speech')
  const [raiseTries, setRaiseTries] = useState(0)
  const [toasts, setToasts] = useState(0)
  const [perfect, setPerfect] = useState(0)
  const later = useLater()
  const glassRef = useRef<HTMLDivElement>(null)

  const beat = BEATS[b]

  useEffect(() => {
    if (phase !== 'play') return
    const id = setInterval(() => setClock(now()), TICK_MS)
    return () => clearInterval(id)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const resetTurn = () => { setTried([]); setExtra(null); setBusy(false); setSince(now()); setClock(now()) }

  const nextBeat = () => {
    const nb = b + 1
    setNote(null); setE(0); setMissed(0); setStage('speech'); setRaiseTries(0)
    resetTurn()
    if (nb >= BEATS.length) { sound.win(); haptic('good'); burst(null, 'big'); setPhase('end'); return }
    setB(nb)
  }

  // Тост: тамада говорит, потом можно поднимать бокал.
  useEffect(() => {
    if (phase === 'play' && beat?.kind === 'toast' && stage === 'speech') {
      sound.pop()
      later(() => { setStage('raise'); setSince(now()) }, SPEECH_MS)
    }
  }, [phase, b, stage]) // eslint-disable-line react-hooks/exhaustive-deps

  // Гость не дождался ответа.
  const guestLeft = phase === 'play' && beat?.kind === 'guest' && !busy && clock - since >= GUEST_MS
  useEffect(() => {
    if (!guestLeft || beat?.kind !== 'guest') return
    setBusy(true)
    setWarm(w => { const n = [...w]; n[beat.g] = guestWarmth(missed, true); return n })
    setNote(`${table[beat.g].ru} не дождался и повернулся к соседу. Ничего, бывает!`)
    sound.miss()
    later(nextBeat, 1400)
  }, [guestLeft]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    setB(0); setE(0); setMissed(0); setWarm(table.map(() => null)); setToasts(0); setPerfect(0); setNote(null); setStage('speech'); setRaiseTries(0)
    resetTurn()
    setPhase('play')
  }

  const chooseGuest = (o: Opt, k: number) => {
    if (beat.kind !== 'guest' || busy) return
    const g = table[beat.g]
    if (!o.good) {
      setTried(t => [...t, k]); setMissed(m => m + 1); setNote(o.miss ?? null)
      haptic('bad'); sound.miss()
      return
    }
    setBusy(true); setNote(null)
    if (o.ids.length === 1) say(o.ids[0])
    haptic('good'); sound.snap(b + e)
    if (o.then?.length) setExtra(o.then)
    later(() => {
      if (e + 1 < g.talk.length) { setE(e + 1); resetTurn(); return }
      setWarm(w => { const n = [...w]; n[beat.g] = guestWarmth(missed, false); return n })
      burst(document.querySelectorAll('[data-testid="supra-guest"]')[beat.g] ?? null, 'small')
      nextBeat()
    }, o.then?.length ? 1300 : 700)
  }

  const raise = () => {
    if (beat.kind !== 'toast' || stage !== 'raise') return
    const r = raiseAt(now() - since)
    if (r === 'ok') {
      setPerfect(p => p + 1); setNote('Точно в тост! Бокалы звенят.')
      haptic('good'); sound.win(); burst(glassRef.current, 'small')
      setStage('answer'); resetTurn()
      return
    }
    const t = raiseTries + 1
    setRaiseTries(t)
    haptic('bad'); sound.miss()
    if (t >= TOAST_TRIES) { setNote('Тамада сам поднял твой бокал. Теперь ответь на тост!'); setStage('answer'); resetTurn(); return }
    setNote(RAISE_MISS[r])
  }

  const chooseToast = (o: Opt, k: number) => {
    if (busy) return
    if (!o.good) { setTried(t => [...t, k]); setNote(o.miss ?? null); haptic('bad'); sound.miss(); return }
    setBusy(true); setNote(null)
    say(o.ids[0])
    setToasts(n => n + 1)
    haptic('good'); sound.snap(b)
    burst(glassRef.current, 'small')
    later(nextBeat, 900)
  }

  const warmCount = warm.filter(w => (w ?? 0) > 0).length

  if (phase === 'intro') return (
    <GameFrame title="Супра" eyebrow={`финал · урок ${lesson.id}`} fraction={fraction} onExit={onExit}>
      <GameIntro title="Большой вечер у соседей" hero
        text="Длинный стол, шесть гостей и тамада. Гости по очереди заговорят с тобой — отвечай, пока они ждут. Тамада поднимает тосты: поймай момент и подними бокал."
        chips={[{ geo: 'გაუმარჯოს!', ru: 'за здоровье!' }, { geo: 'გაუმარჯოს საქართველოს!', ru: 'да здравствует Грузия!' }]}
        mood="cheer" onStart={start} />
    </GameFrame>
  )

  if (phase === 'end') return (
    <GameFrame title="Супра" eyebrow="финал «Знакомства»" fraction={fraction} onExit={onExit}>
      <GameEnd
        title="Супра удалась!"
        text="Ты прошёл всё «Знакомство»."
        rule={<div className="w-full max-w-[320px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile p-2 zn-stamp" style={{ boxShadow: '3px 3px 0 #15100A', transform: 'rotate(-2deg)' }} data-testid="supra-photo">
          <div className="rounded-xl border-[1.5px] border-jewelInk bg-gold-wash px-2 pt-2 pb-1 flex flex-wrap justify-center gap-1">
            {[TAMADA_LOOK, ...looks, ME_LOOK].map((l, i) => <Face key={i} look={l} size={36} mood="smile" />)}
          </div>
          <div className="mt-1.5 flex justify-center gap-3 text-[13px] font-bold tabular-nums">
            <span data-testid="supra-toasts">тостов: {toasts} из {TOASTS.length}</span>
            <span data-testid="supra-warm">тёплых гостей: {warmCount} из {table.length}</span>
          </div>
          {perfect > 0 && <div className="text-center text-[11px] text-jewelInk-hint">бокал вовремя: {perfect} из {TOASTS.length}</div>}
        </div>}
        onNext={onDone}
        onAgain={() => { setRound(r => r + 1); setPhase('intro') }}
      />
    </GameFrame>
  )

  const activeGuest = beat.kind === 'guest' ? beat.g : null
  const moods: Mood[] = table.map((_, i) => (i === activeGuest ? (tried.length ? 'huh' : 'smile') : warm[i] === null ? 'smile' : warm[i]! > 0 ? 'smile' : 'sad'))
  const g = beat.kind === 'guest' ? table[beat.g] : null
  const ex = g?.talk[e]
  const opts = beat.kind === 'guest' ? ex?.opts ?? [] : stage === 'answer' ? toastLists[beat.t] : []
  const hint = tried.length >= 2
  const left = Math.max(0, 1 - (clock - since) / GUEST_MS)
  const p = needle(clock - since)
  const zone = p < TOAST_ZONE[0] ? 'early' : p > TOAST_ZONE[1] ? 'late' : 'ok'

  return (
    <GameFrame title="Супра" eyebrow={beat.kind === 'guest' ? `гость ${beat.g + 1} из ${table.length} · ${THEME_RU[table[beat.g].theme]}` : `тост ${beat.t + 1} из ${TOASTS.length}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-2" data-testid="supra-scene">
        <div className="shrink-0 flex justify-between gap-2 ab-short:hidden">
          <Pill testId="supra-toast-count">тосты {toasts}/{TOASTS.length}</Pill>
          <Pill>тёплые гости {warmCount}/{table.length}</Pill>
        </div>
        <Table looks={looks} moods={moods} active={activeGuest} warm={warm} toast={beat.kind === 'toast'} />

        {g && ex && (
          <div className="shrink-0 flex flex-col gap-1.5" key={`${b}-${e}`}>
            <div className="flex items-center gap-2 text-[11px] font-bold text-jewelInk-hint">
              <span className="whitespace-nowrap">{g.ru} ждёт</span>
              <Meter value={busy ? 0 : left} tone={left < 0.3 ? 'ruby' : 'gold'} label="сколько гость ждёт" />
            </div>
            <div className="flex items-start gap-2 zn-pop">
              <Face look={looks[beat.kind === 'guest' ? beat.g : 0]} size={40} mood={moods[activeGuest ?? 0]} />
              <Lines lines={extra ?? ex.her} />
            </div>
          </div>
        )}

        {beat.kind === 'toast' && (
          <div className="shrink-0 flex flex-col gap-2 items-stretch" key={`t${b}`}>
            <div className="flex items-start gap-2 zn-pop">
              <Face look={TAMADA_LOOK} size={40} mood="wow" />
              <Bubble tone="think" className="self-start text-left"><span className="text-[14px] font-bold">Тамада: «{TOASTS[beat.t].ru}»</span></Bubble>
            </div>
            {stage === 'raise' && (
              <div className="flex flex-col gap-2" data-testid="supra-gauge" data-zone={zone}>
                <div className="relative h-4 rounded-full border-[1.5px] border-jewelInk bg-cream-tile overflow-hidden">
                  <div className="absolute inset-y-0 bg-[#D6E9D9]" style={{ left: `${TOAST_ZONE[0] * 100}%`, width: `${(TOAST_ZONE[1] - TOAST_ZONE[0]) * 100}%` }} />
                  <div className="absolute inset-y-0 w-[3px] bg-ruby" style={{ left: `calc(${p * 100}% - 1px)` }} />
                </div>
                <div ref={glassRef}>
                  <Button variant="green" onClick={raise}><span className="inline-flex items-center gap-2" data-testid="supra-raise"><Glass /> Поднять бокал</span></Button>
                </div>
              </div>
            )}
            {stage === 'speech' && <div className="text-center text-[12px] text-jewelInk-hint" ref={glassRef}>Тамада говорит… приготовь бокал</div>}
          </div>
        )}

        {note && <div className="shrink-0 zn-pop rounded-xl border-[1.5px] border-dashed border-jewelInk-hint px-3 py-1 text-center text-[12px] font-semibold text-jewelInk-soft" data-testid="supra-note">{note}</div>}
        <div className="flex-1 min-h-0" />
        <div className="shrink-0 flex flex-col gap-2" data-testid="supra-options">
          {!busy && opts.map((o, k) => (
            <div key={`${b}-${e}-${k}`} className={`rounded-2xl ${hint && o.good ? 'ring-2 ring-gold ring-offset-2 ring-offset-cream' : ''}`}>
              <Reply geo={o.geo} compact disabled={tried.includes(k)} state={tried.includes(k) ? 'dim' : 'idle'}
                testId={o.good ? 'supra-reply-ok' : 'supra-reply-miss'}
                onClick={() => (beat.kind === 'guest' ? chooseGuest(o, k) : chooseToast(o, k))} />
            </div>
          ))}
        </div>
      </div>
    </GameFrame>
  )
}
