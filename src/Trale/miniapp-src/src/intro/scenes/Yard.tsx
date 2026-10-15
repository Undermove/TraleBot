import React, { useEffect, useMemo, useRef, useState } from 'react'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, floater, haptic, sound } from '../../alphabet/games/fx'
import { useLater } from '../../verbs/games/useLater'
import { knows, phrase, plural, shuffle } from '../story'
import { Bubble, GameEnd, GameIntro, Geo, INK, Meter, Person, Pill, Reply, RuleCard, Tip, say } from '../ui'
import type { SceneProps, StepOf } from './types'
import {
  GONE_MS, PART_RU, WALK_MS, canAnswer, moodVerdict, panelFor, partAt, yardAnswer, yardStart, yardTick,
  type Active, type Part, type YardMode, type YardState
} from './Yard.logic'

/**
 * «Дворик» — один день во дворе батумской многоэтажки за минуту. Небо идёт от утра к вечеру, соседи
 * выходят из подъезда и возвращаются с улицы; каждый останавливается и ждёт, полоска терпения тает.
 * Ответь нужной репликой — сосед улыбается, двор теплеет. Логика — в Yard.logic.ts.
 */

const G = ({ children }: { children: string }) => <b className="font-geo">{children}</b>

const INTRO: Record<YardMode, { title: string; text: string; ids: string[] }> = {
  hello: {
    title: 'Дворик',
    text: 'Ты только переехал в Батуми. Соседи выходят из подъезда и приходят с улицы. Пришедшему скажи «здравствуй», уходящему — «до свидания». Успей, пока не кончилось терпение.',
    ids: ['gamarjoba', 'nakhvamdis']
  },
  day: {
    title: 'Дворик: целый день',
    text: 'Один день во дворе за минуту. Смотри на небо: утром, днём и вечером здороваются по-разному. Тому, кто уходит, скажи «до свидания».',
    ids: ['dila', 'gamarjoba', 'saghamo', 'nakhvamdis']
  },
  full: {
    title: 'Дворик: соседи разговорились',
    text: 'Теперь соседи и сами здороваются первыми и спрашивают, как дела. Здоровайся по времени суток, отвечай на приветствие и на «как дела?».',
    ids: ['dila', 'saghamo', 'gagimarjos', 'kargad_shen']
  }
}

function recap(mode: YardMode) {
  if (mode === 'hello') {
    return <RuleCard title="Ты заметил"><G>გამარჯობა</G> — тому, кто пришёл. <G>ნახვამდის</G> — тому, кто уходит.</RuleCard>
  }
  if (mode === 'day') {
    return <RuleCard title="Ты заметил"><G>დილა</G> — утро, <G>საღამო</G> — вечер, вторая половина <G>მშვიდობისა</G> одна и та же. <G>გამარჯობა</G> годится в любое время.</RuleCard>
  }
  return (
    <RuleCard title="Ты заметил">
      На <G>გამარჯობა</G> отвечают <G>გაგიმარჯოს</G>. На <G>როგორ ხარ?</G> — <G>კარგად, მადლობა</G>, а ещё лучше <G>კარგად, შენ?</G>
    </RuleCard>
  )
}

// ── Двор: небо, дом, кот ─────────────────────────────────────────────────────────────────────────

const SKY: Record<Part, string> = {
  morning: 'linear-gradient(#FCD9B8, #FBEAD6 70%)',
  day: 'linear-gradient(#9CC6EE, #DCEBF8 70%)',
  evening: 'linear-gradient(#3B3A6E, #C9799A 75%)'
}

/** Окна дома: 4 этажа по 3 окна, вечером зажигаются по очереди. */
const WINDOWS = Array.from({ length: 12 }, (_, i) => ({ x: 14 + (i % 3) * 30, y: 10 + Math.floor(i / 3) * 24 }))

function House({ lit }: { lit: Set<number> }) {
  return (
    <svg viewBox="0 0 108 124" className="absolute left-1/2 -translate-x-1/2 bottom-[14%] h-[78%]" aria-hidden>
      <rect x="2" y="2" width="104" height="122" rx="3" fill="#EBDCC0" stroke={INK} strokeWidth="1.5" />
      {WINDOWS.map((w, i) => (
        <rect key={i} x={w.x} y={w.y} width="20" height="15" rx="2" fill={lit.has(i) ? '#FCD76D' : '#C9DBEE'} stroke={INK} strokeWidth="1.2"
          style={{ transition: 'fill 600ms' }} data-testid={lit.has(i) ? 'yard-window-lit' : undefined} />
      ))}
      {/* балкон с бельём */}
      <path d="M70 58 h30" stroke={INK} strokeWidth="1" />
      <rect x="76" y="58" width="6" height="7" fill="#E01A3C" stroke={INK} strokeWidth="0.8" />
      <rect x="86" y="58" width="6" height="9" fill="#F5B820" stroke={INK} strokeWidth="0.8" />
      {/* подъезд */}
      <rect x="40" y="100" width="28" height="24" rx="2" fill="#7A4E2D" stroke={INK} strokeWidth="1.5" />
      <path d="M36 100 h36" stroke={INK} strokeWidth="2" />
      <circle cx="62" cy="113" r="1.4" fill="#F5B820" />
      {/* виноград по стене */}
      <path d="M4 124 Q10 96 6 70 Q2 50 10 30" stroke="#4E8A5B" strokeWidth="2" fill="none" />
      {[[8, 96], [4, 78], [9, 56], [6, 38]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4" fill="#4E8A5B" stroke={INK} strokeWidth="0.8" />)}
    </svg>
  )
}

function BenchCat({ evening }: { evening: boolean }) {
  return (
    <svg viewBox="0 0 70 40" className="absolute left-[2%] bottom-[12%] w-[18%] max-w-[78px]" aria-hidden>
      <rect x="4" y="22" width="62" height="5" rx="2" fill="#B5793F" stroke={INK} strokeWidth="1.2" />
      <path d="M10 27 v10 M60 27 v10" stroke={INK} strokeWidth="2" />
      <rect x="4" y="12" width="62" height="4" rx="2" fill="#B5793F" stroke={INK} strokeWidth="1.2" />
      {/* кот: днём сидит, вечером спит клубком */}
      {evening
        ? <ellipse cx="40" cy="18" rx="10" ry="5" fill="#3A2B1F" stroke={INK} strokeWidth="1" />
        : <g className="zn-bob">
          <ellipse cx="40" cy="15" rx="7" ry="7" fill="#3A2B1F" stroke={INK} strokeWidth="1" />
          <circle cx="40" cy="6" r="5" fill="#3A2B1F" stroke={INK} strokeWidth="1" />
          <path d="M36 3 l1 -4 l2 3 M41 2 l2 -3 l1 4" fill="#3A2B1F" stroke={INK} strokeWidth="1" />
          <circle cx="38.3" cy="6" r="0.9" fill="#F5B820" /><circle cx="41.7" cy="6" r="0.9" fill="#F5B820" />
          <path d="M47 18 Q55 16 52 8" stroke={INK} strokeWidth="1.6" fill="none" />
        </g>}
    </svg>
  )
}

/** Где стоит сосед (в процентах ширины двора). Подъезд — посередине. */
function spot(a: Active, entered: boolean): { left: number; opacity: number; ms: number } {
  const inn = a.v.dir === 'in'
  if (a.stage === 'gone') return inn ? { left: 50, opacity: 0, ms: GONE_MS } : { left: 115, opacity: 1, ms: GONE_MS }
  if (a.stage === 'walk' && !entered) return inn ? { left: -12, opacity: 1, ms: 0 } : { left: 50, opacity: 0.2, ms: 0 }
  return { left: inn ? 30 : 70, opacity: 1, ms: WALK_MS }
}

function Neighbour({ a, t, elRef }: { a: Active; t: number; elRef: React.RefObject<HTMLDivElement> }) {
  const [entered, setEntered] = useState(false)
  useEffect(() => { const id = setTimeout(() => setEntered(true), 30); return () => clearTimeout(id) }, [])
  const s = spot(a, entered)
  const left = a.stage === 'wait' ? Math.max(0, 1 - (t - a.at) / a.waitMs) : 0
  return (
    <div ref={elRef} data-testid="yard-neighbour" data-dir={a.v.dir} data-part={a.v.part}
      className="zy-walk absolute bottom-[6%] flex flex-col items-center"
      style={{ left: `${s.left}%`, opacity: s.opacity, transform: 'translateX(-50%)', transition: `left ${s.ms}ms linear, opacity ${s.ms}ms` }}>
      {a.line && (
        <Bubble tone={a.stage === 'react' ? 'good' : 'plain'} className="mb-1 whitespace-nowrap">
          <Geo text={phrase(a.line).geo} size={15} />
        </Bubble>
      )}
      {a.stage === 'wait' && (
        <div className="w-14 mb-1 flex" data-testid="yard-patience">
          <Meter value={left} tone={left > 0.5 ? 'sage' : left > 0.25 ? 'gold' : 'ruby'} label="Терпение соседа" />
        </div>
      )}
      <div className={a.stage === 'react' && a.happy ? 'zn-jump' : a.mood === 'huh' ? 'zn-shake' : ''} key={`${a.stage}-${a.mood}`}>
        <Person look={a.v.look} mood={a.mood} height={84} />
      </div>
    </div>
  )
}

export default function Yard({ lesson, step, fraction, onExit, onDone, rng = Math.random, now = () => performance.now() }: SceneProps<StepOf<'yard'>>) {
  const mode = step.mode
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro')
  const [s, setS] = useState<YardState>(() => yardStart(lesson.id, mode))
  const ref = useRef(s)
  const [bad, setBad] = useState<string | null>(null)
  const personEl = useRef<HTMLDivElement>(null)
  const later = useLater()
  const windowOrder = useMemo(() => shuffle(WINDOWS.map((_, i) => i), rng), []) // eslint-disable-line react-hooks/exhaustive-deps

  const commit = (n: YardState) => { ref.current = n; setS(n) }

  // Часы дня: идут, пока экран виден (свернул Telegram — пауза).
  useEffect(() => {
    if (phase !== 'play') return
    let last = now()
    const id = setInterval(() => {
      const t = now()
      const dt = typeof document !== 'undefined' && document.visibilityState === 'hidden' ? 0 : Math.min(250, Math.max(0, t - last))
      last = t
      const prev = ref.current
      const n = yardTick(prev, prev.t + dt, rng)
      if (n.timeouts > prev.timeouts) { sound.miss(); haptic('soft') }
      if (n.active && !prev.active) haptic('soft')
      commit(n)
      if (n.over) {
        setPhase('end')
        if (n.mood >= 0.75) { sound.win(); haptic('good') }
      }
    }, 100)
    return () => clearInterval(id)
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => { commit(yardStart(lesson.id, mode)); setPhase('play') }

  const answer = (id: string) => {
    const prev = ref.current
    const { s: n, verdict } = yardAnswer(prev, id)
    if (!verdict) return
    commit(n)
    if (verdict.res === 'miss') {
      haptic('bad'); sound.miss()
      setBad(id); later(() => setBad(null), 420)
      return
    }
    say(id)
    haptic('good'); sound.pop(Math.min(n.combo, 12))
    floater(`+${n.smiles - prev.smiles}`, personEl.current, '#4E8A5B')
    if (verdict.res === 'bonus' || n.combo >= 3) burst(personEl.current, 'small')
    // Сосед отвечает той же фразой — запись уже прозвучала, второй раз не играем.
    if (verdict.react && verdict.react !== id) later(() => say(verdict.react!), 500)
  }

  const title = INTRO[mode].title

  if (phase === 'intro') {
    return (
      <GameFrame title={title} eyebrow="игра урока" fraction={fraction} onExit={onExit}>
        <div className="flex-1 min-h-0 flex flex-col" data-testid="yard-scene">
          <GameIntro title={title} text={INTRO[mode].text} onStart={start}
            chips={INTRO[mode].ids.filter(id => knows(lesson.id, id)).map(id => ({ geo: phrase(id).geo, ru: phrase(id).ru }))} />
        </div>
      </GameFrame>
    )
  }

  if (phase === 'end') {
    return (
      <GameFrame title={title} eyebrow="день закончился" fraction={fraction} onExit={onExit}>
        <div className="flex-1 min-h-0 flex flex-col" data-testid="yard-scene">
          <GameEnd
            title={`${s.smiles} ${plural(s.smiles, 'улыбка', 'улыбки', 'улыбок')} во дворе`}
            text={`${moodVerdict(s.mood)}${s.best >= 3 ? ` Лучшая серия — ${s.best}.` : ''}`}
            rule={recap(mode)}
            onNext={onDone}
            onAgain={start}
          />
        </div>
      </GameFrame>
    )
  }

  const p = Math.min(1, s.t / s.dayMs)
  const part = partAt(mode, p)
  const evening = part === 'evening'
  const litCount = evening ? Math.min(12, 2 + Math.floor(((p - 0.67) / 0.33) * 11)) : part === 'morning' && p < 0.1 ? 2 : 0
  const lit = new Set(windowOrder.slice(0, litCount))
  const a = s.active
  const need = a ? a.v.needs[a.stage === 'react' && a.then === 'next' ? a.need + 1 : a.need] : 'greet'
  const panel = panelFor(lesson.id, mode, need)
  const ready = canAnswer(s)
  const sunLeft = 6 + p * 80
  const sunTop = 58 - Math.sin(p * Math.PI) * 46

  return (
    <GameFrame title={title} eyebrow={`день во дворе · ${PART_RU[part]}`} fraction={fraction} onExit={onExit}>
      <style>{`@media (prefers-reduced-motion: reduce) { .zy-walk, .zy-sky, .zy-sun { transition: none !important } }`}</style>
      <div className="flex-1 min-h-0 flex flex-col gap-2" data-testid="yard-scene">
        <div className="shrink-0 flex items-center gap-2">
          <Pill testId="yard-clock">{PART_RU[part]}</Pill>
          <Meter value={s.mood} tone={s.mood >= 0.5 ? 'sage' : 'gold'} label="Настроение двора" />
          {s.combo >= 2 && <span className="zn-pop" key={s.combo}><Pill testId="yard-combo">серия {s.combo}</Pill></span>}
          <Pill testId="yard-smiles">{s.smiles} {plural(s.smiles, 'улыбка', 'улыбки', 'улыбок')}</Pill>
        </div>

        <div className="relative flex-1 min-h-[170px] rounded-2xl border-[1.5px] border-jewelInk overflow-hidden" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="yard-court" data-part={part}>
          {(['morning', 'day', 'evening'] as Part[]).map(k => (
            <div key={k} className="zy-sky absolute inset-0" style={{ background: SKY[k], opacity: k === part ? 1 : 0, transition: 'opacity 1.2s' }} />
          ))}
          <div className="zy-sun absolute w-8 h-8 rounded-full border-[1.5px] border-jewelInk"
            style={{ left: `${sunLeft}%`, top: `${sunTop}%`, background: evening ? '#F6E7B0' : '#F5B820', transition: 'left 120ms linear, top 120ms linear, background 1s' }}>
            {evening && <div className="absolute w-6 h-6 rounded-full" style={{ left: 9, top: -3, background: '#3B3A6E' }} />}
          </div>
          <House lit={lit} />
          <BenchCat evening={evening} />
          <div className="absolute inset-x-0 bottom-0 h-[14%] border-t-[1.5px] border-jewelInk" style={{ background: '#B9A27A' }} />
          {a && <Neighbour key={a.v.n} a={a} t={s.t} elRef={personEl} />}
        </div>

        <div className="shrink-0" data-testid="yard-tip"><Tip>{s.tip}</Tip></div>

        <div className="shrink-0 grid grid-cols-2 gap-2" data-testid="yard-replies">
          {panel.map(id => (
            <Reply key={id} testId={`reply-${id}`} geo={phrase(id).geo} hint={s.hints ? phrase(id).ru : ''} compact={panel.length > 2}
              state={bad === id ? 'bad' : ready ? 'idle' : 'dim'}
              onClick={() => answer(id)} />
          ))}
        </div>
      </div>
    </GameFrame>
  )
}
