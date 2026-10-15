import React, { useEffect, useMemo, useRef, useState } from 'react'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, floater, haptic, sound } from '../../alphabet/games/fx'
import { useLater } from '../../verbs/games/useLater'
import { knows, phrase, plural } from '../story'
import { Bubble, GameEnd, GameIntro, Geo, INK, Meter, Person, Pill, Reply, RuleCard, Tip, say, type Look } from '../ui'
import type { SceneProps, StepOf } from './types'
import {
  FLOORS, MY_FLOOR, currentEx, currentFloor, currentRide, elevAnswer, elevStart, elevTick, elevatorVerdict, planRides,
  type ElevMode, type ElevState
} from './Elevator.logic'

/**
 * «Лифт» — двенадцатиэтажка в разрезе. Ты живёшь на последнем этаже и каждый раз едешь с одним соседом.
 * Счётчик этажей щёлкает, на этаже соседа откроются двери — за это время надо договорить. Договорил —
 * сосед тебя запомнил, и в конце видно, какие этажи теперь с тобой здороваются. Логика — Elevator.logic.ts.
 */

const G = ({ children }: { children: string }) => <b className="font-geo">{children}</b>
const ME: Look = { coat: '#1B5FB0', skin: '#F2C9A0', hair: '#5A3A22', long: false }

const INTRO: Record<ElevMode, { title: string; text: string; ids: string[] }> = {
  howareyou: {
    title: 'Лифт',
    text: 'Ты живёшь на 12-м этаже, а лифт ходит медленно. Сосед здоровается и спрашивает, как дела. Ответь, пока не открылись двери на его этаже.',
    ids: ['gamarjoba', 'rogor', 'kargad_madloba']
  },
  echo: {
    title: 'Лифт: а у тебя?',
    text: 'Сосед спрашивает, как дела. Можно просто ответить, но вежливее — ответить и спросить в ответ. Успей до его этажа.',
    ids: ['rogor', 'kargad_madloba', 'kargad_shen']
  },
  polite: {
    title: 'Лифт: вежливость',
    text: 'В лифте тесно: то дверь придержат, то на ногу наступишь, то предложат нажать кнопку. Смотри на панель — горит ли твоя 12.',
    ids: ['madloba', 'bodishi', 'ki', 'ara']
  },
  mix: {
    title: 'Лифт: весь подъезд',
    text: 'Всё вместе: приветствия, «как дела?», спасибо и извините. Семь поездок — посмотрим, сколько этажей тебя запомнят.',
    ids: ['gagimarjos', 'kargad_shen', 'madloba', 'bodishi']
  }
}

function recap(mode: ElevMode) {
  switch (mode) {
    case 'howareyou': return <RuleCard title="Ты заметил"><G>როგორ ხარ?</G> — «как дела?». Отвечают <G>კარგად, მადლობა</G> — «хорошо, спасибо».</RuleCard>
    case 'echo': return <RuleCard title="Ты заметил"><G>კარგად, შენ?</G> — ответить и сразу спросить в ответ. Тогда и сосед расскажет: <G>კარგად, მადლობა</G>.</RuleCard>
    case 'polite': return <RuleCard title="Ты заметил"><G>მადლობა</G> — спасибо, <G>ბოდიში</G> — извините, <G>კი</G> — да, <G>არა</G> — нет.</RuleCard>
    case 'mix': return <RuleCard title="Ты заметил">На <G>გამარჯობა</G> отвечают <G>გაგიმარჯოს</G>, на <G>როგორ ხარ?</G> — <G>კარგად, შენ?</G> А в тесноте выручают <G>მადლობა</G> и <G>ბოდიში</G>.</RuleCard>
  }
}

/** Дом в разрезе: 12 этажей, лифт, этажи, где тебя запомнили, — с тёплыми окнами. */
function Tower({ floor, target, remembered, big = false }: { floor?: number; target?: number; remembered: number[]; big?: boolean }) {
  const row = big ? 12 : 100 / FLOORS
  const floors = Array.from({ length: FLOORS }, (_, i) => FLOORS - i)
  if (big) {
    return (
      <div className="w-[190px] rounded-lg border-[1.5px] border-jewelInk bg-[#EBDCC0] overflow-hidden" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="elevator-tower">
        {floors.map(f => {
          const warm = remembered.includes(f)
          return (
            <div key={f} className="flex items-center gap-1 px-1.5 border-b border-jewelInk/30 last:border-b-0" style={{ height: row }} data-testid={warm ? 'tower-warm' : undefined}>
              <span className="w-4 text-[8px] font-extrabold tabular-nums text-jewelInk-hint">{f}</span>
              {[0, 1, 2].map(k => <span key={k} className="h-[7px] w-[14px] rounded-[2px] border border-jewelInk" style={{ background: warm || f === MY_FLOOR ? '#FCD76D' : '#C9DBEE' }} />)}
              <span className="flex-1 text-right text-[8px] font-bold leading-none text-jewelInk-soft">{f === MY_FLOOR ? 'ты' : warm ? 'здоровается' : ''}</span>
            </div>
          )
        })}
      </div>
    )
  }
  return (
    <div className="relative w-[46px] shrink-0 rounded-lg border-[1.5px] border-jewelInk bg-[#EBDCC0] overflow-hidden" aria-hidden>
      {floors.map((f, i) => (
        <div key={f} className="absolute inset-x-0 flex items-center gap-[3px] px-[3px] border-b border-jewelInk/25" style={{ top: `${i * row}%`, height: `${row}%` }}>
          <span className="w-[13px] text-[7px] font-extrabold tabular-nums text-jewelInk-hint">{f}</span>
          <span className="h-[55%] w-[8px] rounded-[1px] border border-jewelInk/60" style={{ background: remembered.includes(f) || f === MY_FLOOR ? '#FCD76D' : '#C9DBEE' }} />
          {f === target && <span className="ml-auto h-[6px] w-[6px] rounded-full bg-ruby border border-jewelInk" />}
        </div>
      ))}
      {floor !== undefined && (
        <div className="absolute right-[2px] w-[12px] rounded-[2px] bg-navy border border-jewelInk" data-testid="elevator-cabin-marker"
          style={{ top: `${(FLOORS - floor) * row + row * 0.12}%`, height: `${row * 0.76}%`, transition: 'top 250ms linear' }} />
      )}
    </div>
  )
}

/** Панель кнопок лифта на стене кабины. */
function Panel({ lit }: { lit: number[] }) {
  return (
    <div className="grid grid-cols-2 gap-[3px] rounded-md border-[1.5px] border-jewelInk bg-cream-deep p-[3px]" data-testid="elevator-panel">
      {Array.from({ length: FLOORS }, (_, i) => FLOORS - i).map(f => (
        <span key={f} data-testid={lit.includes(f) ? `panel-lit-${f}` : undefined}
          className="flex h-[14px] w-[14px] items-center justify-center rounded-full border border-jewelInk text-[7px] font-extrabold tabular-nums"
          style={{ background: lit.includes(f) ? '#F5B820' : '#FBF5E8' }}>{f}</span>
      ))}
    </div>
  )
}

function Arrow() {
  return <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M5 1 L9 7 H1 Z" fill="#F5B820" stroke={INK} strokeWidth="1" /></svg>
}

export default function Elevator({ lesson, step, fraction, onExit, onDone, rng = Math.random, now = () => performance.now() }: SceneProps<StepOf<'elevator'>>) {
  const mode = step.mode
  const rides = useMemo(() => planRides(lesson.id, mode, rng), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro')
  const [s, setS] = useState<ElevState>(() => elevStart(lesson.id, mode, rides))
  const ref = useRef(s)
  const [bad, setBad] = useState<string | null>(null)
  const npc = useRef<HTMLDivElement>(null)
  const later = useLater()
  const commit = (n: ElevState) => { ref.current = n; setS(n) }

  useEffect(() => {
    if (phase !== 'play') return
    let last = now()
    const id = setInterval(() => {
      const t = now()
      const dt = typeof document !== 'undefined' && document.visibilityState === 'hidden' ? 0 : Math.min(250, Math.max(0, t - last))
      last = t
      const prev = ref.current
      const n = elevTick(prev, prev.t + dt)
      const f0 = currentFloor(prev), f1 = currentFloor(n)
      if (n.stage === 'ride' && f1 > f0) sound.tick(f1)
      if (n.stage === 'doors' && prev.stage !== 'doors') {
        if (n.remembered.length > prev.remembered.length) { sound.win(); haptic('good'); burst(npc.current, 'small'); later(() => say('nakhvamdis'), 300) } else { sound.miss(); haptic('soft') }
      }
      commit(n)
      if (n.over) setPhase('end')
    }, 100)
    return () => clearInterval(id)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => { commit(elevStart(lesson.id, mode, rides)); setPhase('play') }

  const answer = (id: string) => {
    const prev = ref.current
    const { s: n, verdict } = elevAnswer(prev, id)
    if (!verdict) return
    commit(n)
    if (verdict.res === 'miss') {
      haptic('bad'); sound.miss()
      setBad(id); later(() => setBad(null), 420)
      return
    }
    say(id)
    haptic('good'); sound.pop(n.correct)
    floater(verdict.res === 'bonus' ? '+2' : '+1', npc.current, '#4E8A5B')
    if (verdict.react) later(() => say(verdict.react!), 450)
  }

  const title = INTRO[mode].title

  if (phase === 'intro') {
    return (
      <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
        <div className="flex-1 min-h-0 flex flex-col" data-testid="elevator-scene">
          <GameIntro title={title} text={INTRO[mode].text} onStart={start}
            chips={INTRO[mode].ids.filter(id => knows(lesson.id, id)).map(id => ({ geo: phrase(id).geo, ru: phrase(id).ru }))} />
        </div>
      </GameFrame>
    )
  }

  if (phase === 'end') {
    const k = s.remembered.length
    return (
      <GameFrame title={title} eyebrow="поездки закончились" fraction={fraction} onExit={onExit}>
        <div className="flex-1 min-h-0 flex flex-col" data-testid="elevator-scene">
          <GameEnd
            title={`${k} ${plural(k, 'сосед запомнил', 'соседа запомнили', 'соседей запомнили')} тебя`}
            text={elevatorVerdict(k, s.rides.length)}
            rule={<div className="flex flex-col items-center gap-2"><Tower big remembered={s.remembered} />{recap(mode)}</div>}
            onNext={onDone}
            onAgain={start}
          />
        </div>
      </GameFrame>
    )
  }

  const r = currentRide(s)
  const floor = currentFloor(s)
  const ex = currentEx(s)
  // Пока сосед реагирует или двери открыты — показываем следующую (или последнюю) реплику приглушённой.
  const shown = ex ?? r.ex[Math.min(s.exI, r.ex.length - 1)]
  const btnIdx = r.ex.findIndex(e => e.kind === 'button')
  const pressed12 = btnIdx >= 0 && (r.ex[btnIdx].pressed || s.exI > btnIdx)
  const lit = [r.floor, ...(pressed12 ? [MY_FLOOR] : [])]
  const doors = s.stage === 'doors'
  const npcLine = s.react?.line ?? (doors && s.remembered.includes(r.floor) ? 'nakhvamdis' : ex?.line)
  const situation = ex?.say

  return (
    <GameFrame title={title} eyebrow={`поездка ${s.ri + 1} из ${s.rides.length}`} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col gap-2" data-testid="elevator-scene">
        <div className="shrink-0 flex items-center gap-2">
          <Pill testId="elevator-ride">{s.ri + 1}/{s.rides.length}</Pill>
          <Meter value={s.max ? s.likes / s.max : 0} tone="sage" label="Соседи тебя любят" />
          <Pill testId="elevator-likes">симпатия {s.likes}</Pill>
        </div>

        <div className="relative flex-1 min-h-[180px] ab-short:min-h-[150px] flex gap-2">
          <Tower floor={floor} target={r.floor} remembered={s.remembered} />
          <div className="relative flex-1 rounded-2xl border-[1.5px] border-jewelInk overflow-hidden" style={{ background: 'linear-gradient(#D9C9A8, #EADCC0)', boxShadow: '3px 3px 0 #15100A' }} data-testid="elevator-cabin">
            <div className="absolute left-1/2 top-1.5 -translate-x-1/2 flex items-center gap-1 rounded-md border-[1.5px] border-jewelInk bg-jewelInk px-2 py-0.5 text-[13px] font-extrabold tabular-nums text-gold" data-testid="elevator-floor">
              <Arrow /> <span>{floor}</span> <span className="text-[10px] text-cream/70">→ {r.floor}</span>
            </div>
            <div className="absolute right-1.5 top-9"><Panel lit={lit} /></div>
            {situation && (
              <div className="absolute inset-x-2 top-9 mr-[44px] zn-pop" key={`${s.ri}-${s.exI}`}>
                <Bubble tone="think" className="text-[12px] leading-snug"><span data-testid="elevator-situation">{situation}</span></Bubble>
              </div>
            )}
            {r.crowd && (
              <div className="absolute bottom-1 left-[38%] opacity-50" aria-hidden>
                <Person look={{ ...r.look, coat: '#7A4E9A' }} height={70} />
              </div>
            )}
            <div className="absolute bottom-1 left-[8%]">
              <Person look={ME} mood={s.mood === 'huh' && !s.react ? 'huh' : 'smile'} height={80} />
            </div>
            <div ref={npc} className={`absolute bottom-1 right-[22%] flex flex-col items-center ${doors ? 'zn-out-right' : 'zn-in-right'}`} key={`npc-${s.ri}-${doors}`} data-testid="elevator-neighbour">
              {npcLine && (
                <Bubble tone={s.react || doors ? 'good' : 'plain'} className="mb-1 whitespace-nowrap" key={npcLine + s.exI}>
                  <Geo text={phrase(npcLine).geo} size={14} />
                </Bubble>
              )}
              <div className={s.react ? 'zn-jump' : ''} key={`m-${s.exI}`}>
                <Person look={r.look} mood={s.mood} height={80} />
              </div>
            </div>
            {doors && <div className="absolute inset-y-0 right-0 w-2 bg-gold border-l-[1.5px] border-jewelInk" aria-hidden />}
          </div>
        </div>

        <div className="shrink-0" data-testid="elevator-tip"><Tip>{s.tip}</Tip></div>

        <div className="shrink-0 flex flex-col gap-1.5" data-testid="elevator-replies">
          {shown.options.map(id => (
            <Reply key={`${s.ri}-${s.exI}-${id}`} testId={`reply-${id}`} compact geo={phrase(id).geo} hint={s.hints ? phrase(id).ru : undefined}
              state={bad === id ? 'bad' : ex ? 'idle' : 'dim'} onClick={() => answer(id)} />
          ))}
        </div>
      </div>
    </GameFrame>
  )
}
