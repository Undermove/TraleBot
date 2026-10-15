import React, { useEffect, useMemo, useRef, useState } from 'react'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, floater, haptic, sound } from '../../alphabet/games/fx'
import { useLater } from '../../verbs/games/useLater'
import { cyr } from '../../verbs/types'
import Mascot from '../../components/Mascot'
import Button from '../../components/Button'
import { geoName, plural, saveName, savedName, type Rng } from '../story'
import { GameEnd, GameIntro, Pill, RuleCard, Tip } from '../ui'
import type { SceneProps, StepOf } from './types'
import {
  MAGNET_RU, activeOrder, finished, hint, praise, startBelt, tap, tick, toolsOf, transform, xOf,
  type Belt, type Item, type MagnetSet, type Tool
} from './Magnets.logic'

/**
 * «Магниты» — мастерская окончаний. По ленте едут плитки-слова, сверху заказ по-русски («из Испании»).
 * Берёшь нужный магнит, жмёшь на плитку, пока она не уехала, — и слово меняется на глазах: у -ში последняя ი
 * отваливается, у -დან слово остаётся целым. Лента ускоряется, за серию — комбо. В наборе name сначала
 * печатаем имя самого человека и цепляем ему ი, потом по ленте едут чужие имена: нужна ли ი?
 */

const G = ({ children }: { children: string }) => <b className="font-geo">{children}</b>
const TICK_MS = 50

type Phase = 'intro' | 'me' | 'belt' | 'end'

const TITLE: Record<MagnetSet, string> = { name: 'Имя по-грузински', from: 'Магниты: откуда', in: 'Магниты: где', both: 'Магниты: большая смена' }

export default function Magnets({ step, fraction, onExit, onDone, rng = Math.random, now = Date.now }: SceneProps<StepOf<'magnets'>>) {
  const set = step.set
  const [phase, setPhase] = useState<Phase>('intro')
  const [round, setRound] = useState(0)
  const [result, setResult] = useState<Belt | null>(null)
  const title = TITLE[set]

  const end = (b: Belt) => { setResult(b); setPhase('end'); sound.win() }

  return (
    <GameFrame title={title} eyebrow="мастерская" fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col" data-testid="magnets-scene">
        {phase === 'intro' && (
          <GameIntro
            title={title}
            text={set === 'name'
              ? 'Сначала напечатаем твоё имя грузинскими буквами. Потом по ленте поедут чужие имена: решай, нужна ли им ი на конце.'
              : 'По ленте едут слова. Сверху — заказ. Возьми нужный магнит и нажми на слово, пока оно не уехало.'}
            chips={set === 'name' ? [{ geo: 'ი', ru: 'на согласную' }] : toolsOf(set).map(t => ({ geo: `-${t}`, ru: MAGNET_RU[t] }))}
            onStart={() => setPhase(set === 'name' ? 'me' : 'belt')}
          />
        )}
        {phase === 'me' && <MyName onNext={() => setPhase('belt')} />}
        {phase === 'belt' && <Workshop key={round} set={set} rng={rng} now={now} onEnd={end} />}
        {phase === 'end' && result && (
          <GameEnd
            title={result.done >= result.total ? 'Смена закрыта' : 'На сегодня хватит'}
            text={`${result.done} ${plural(result.done, 'плитка', 'плитки', 'плиток')} · ${result.score} ${plural(result.score, 'очко', 'очка', 'очков')} · лучшая серия ×${result.best}`}
            rule={<RuleCard title={set === 'name' ? 'Имя по-грузински' : 'Где и откуда'}><Recap set={set} /></RuleCard>}
            onNext={onDone}
            onAgain={() => { setRound(r => r + 1); setPhase('belt') }}
          />
        )}
      </div>
    </GameFrame>
  )
}

function Recap({ set }: { set: MagnetSet }) {
  if (set === 'name') {
    const me = geoName(savedName())
    return <>Имя на согласную договаривают <G>ი</G>: Карлос → <G>კარლოსი</G>. На гласную — оставляют как есть. Ты — <G>{me.geo}</G>.</>
  }
  const from = <><G>-დან</G> — «из». Слово остаётся целым: <G>ესპანეთი</G> → <G>ესპანეთიდან</G>.</>
  const inn = <><G>-ში</G> — «в». Последняя <G>ი</G> уходит: <G>ბათუმი</G> → <G>ბათუმში</G>.</>
  if (set === 'from') return from
  if (set === 'in') return inn
  return <>{from}<br />{inn}</>
}

// ── Плитка с превращением ─────────────────────────────────────────────────────────────────────────

/** Слово, к которому прилип магнит: у -ში сначала отваливается ი, потом прилипает ში. */
export function Transformed({ item, size = 28 }: { item: Item; size?: number }) {
  const t = transform(item)
  const [stage, setStage] = useState(t.drop ? 0 : 1)
  const later = useLater()
  useEffect(() => {
    if (!t.drop) { sound.snap(3); return }
    later(() => { setStage(1); sound.snap(4) }, 600)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <span className="relative inline-flex items-baseline font-geo font-extrabold" style={{ fontSize: size }} data-testid="press-word" data-stage={stage}>
      {t.keep}
      {stage === 0 && <span className="zn-fall text-ruby">{t.drop}</span>}
      {stage === 1 && t.add && <span className="zn-pop inline-block text-navy">{t.add}</span>}
      {item.tool === 'none' && (
        <span className="zn-stamp absolute -right-8 -top-3 rounded-md border-2 border-navy px-1 text-[11px] font-sans font-extrabold uppercase text-navy bg-cream-tile">без ი</span>
      )}
    </span>
  )
}

function WordTile({ children, className = '', onClick, testId, style, data }: {
  children: React.ReactNode; className?: string; onClick?: (el: HTMLElement) => void; testId?: string; style?: React.CSSProperties; data?: Record<string, string>
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      {...Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [`data-${k}`, v]))}
      onClick={e => onClick?.(e.currentTarget)}
      className={`min-h-[56px] rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-3 py-1.5 leading-tight ${className}`}
      style={{ boxShadow: '3px 3px 0 #15100A', ...style }}
    >
      {children}
    </button>
  )
}

function MagnetButton({ tool, armed, glow, onClick }: { tool: Tool; armed: boolean; glow: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid={`magnet-${tool === 'none' ? 'none' : tool}`}
      aria-pressed={armed}
      onClick={() => { haptic('tap'); sound.pop(armed ? 0 : 3); onClick() }}
      className={`min-h-[56px] min-w-[96px] rounded-2xl border-[1.5px] border-jewelInk px-4 py-1.5 transition-transform ${armed ? 'bg-gold -translate-y-1' : 'bg-navy-wash'} ${glow && !armed ? 'zn-bob ring-2 ring-gold ring-offset-2' : ''}`}
      style={{ boxShadow: armed ? '3px 5px 0 #15100A' : '3px 3px 0 #15100A' }}
    >
      <MagnetIcon />
      <span className="block font-geo font-extrabold text-[22px] leading-none">{tool === 'none' ? 'без ი' : tool === 'ი' ? 'ი' : `-${tool}`}</span>
      <span className="block text-[11px] font-semibold text-jewelInk-soft">{tool === 'none' ? 'оставить' : MAGNET_RU[tool]}</span>
    </button>
  )
}

function MagnetIcon() {
  return (
    <svg width="18" height="12" viewBox="0 0 18 12" className="mx-auto mb-0.5" aria-hidden>
      <path d="M2 1 v5 a7 5 0 0 0 14 0 V1 h-4 v5 a3 2 0 0 1 -6 0 V1Z" fill="#E01A3C" stroke="#15100A" strokeWidth="1.2" />
      <rect x="2" y="1" width="4" height="2.5" fill="#FDFAEF" stroke="#15100A" strokeWidth="1.2" />
      <rect x="12" y="1" width="4" height="2.5" fill="#FDFAEF" stroke="#15100A" strokeWidth="1.2" />
    </svg>
  )
}

// ── Своё имя ──────────────────────────────────────────────────────────────────────────────────────

function MyName({ onNext }: { onNext: () => void }) {
  const [ru, setRu] = useState(() => savedName())
  const [printed, setPrinted] = useState(-1) // -1 — ещё не печатали
  const [armed, setArmed] = useState<Tool | null>(null)
  const [applied, setApplied] = useState(false)
  const [shake, setShake] = useState(false)
  const [tip, setTip] = useState('Напиши имя по-русски — как тебя зовут друзья.')
  const later = useLater()
  const g = useMemo(() => geoName(ru), [ru])
  const letters = useMemo(() => [...g.base], [g])
  const run = useRef(0)

  const print = () => {
    if (!ru.trim()) { setTip('Сначала напиши имя.'); return }
    haptic('pop')
    const id = ++run.current
    setApplied(false); setArmed(null); setPrinted(0)
    setTip('Печатаем…')
    letters.forEach((_, k) => later(() => {
      if (run.current !== id) return
      setPrinted(k + 1); sound.tick(k)
      if (k === letters.length - 1) setTip(g.added
        ? 'Имя кончается на согласную. Возьми магнит ი и прилепи к имени.'
        : 'Имя кончается на гласную. Нужна ли ი? Выбери и нажми на имя.')
    }, 160 * (k + 1)))
  }
  const ready = printed >= letters.length
  const tapName = (el: HTMLElement) => {
    if (!ready || applied) return
    const want: Tool = g.added ? 'ი' : 'none'
    if (!armed) { setTip('Сначала возьми магнит снизу.'); return }
    if (armed !== want) {
      haptic('bad'); sound.miss(); setShake(true); later(() => setShake(false), 400)
      setTip(g.added ? 'На согласную грузины договаривают ი: Карлос → კარლოსი.' : 'Имя уже кончается на гласную — ი не нужна: ნინო так и остаётся.')
      return
    }
    haptic('good'); burst(el, 'small')
    setApplied(true)
    saveName(ru.trim())
    setTip(g.added ? `${g.base} → ${g.geo}. Так тебя и будут звать.` : `${g.geo} — без изменений. Так тебя и будут звать.`)
  }
  const item: Item = { key: 'me', ru: g.ru, base: g.base, result: g.geo, tool: g.added ? 'ი' : 'none', order: '' }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3" data-testid="magnets-me">
      <label className="flex flex-col gap-1 text-[13px] font-bold text-jewelInk-soft">
        Как тебя зовут?
        <div className="flex gap-2">
          <input
            data-testid="name-input"
            value={ru}
            maxLength={20}
            onChange={e => { setRu(e.target.value); setPrinted(-1); setApplied(false); run.current++ }}
            className="flex-1 min-w-0 min-h-[44px] rounded-xl border-[1.5px] border-jewelInk bg-cream-tile px-3 text-[17px] font-bold text-jewelInk"
            placeholder="Имя"
          />
          <button type="button" data-testid="name-print" onClick={print}
            className="shrink-0 min-h-[44px] rounded-xl border-[1.5px] border-jewelInk bg-gold px-3 text-[14px] font-extrabold" style={{ boxShadow: '2px 2px 0 #15100A' }}>
            Напечатать
          </button>
        </div>
      </label>

      <div className="flex-1 min-h-[110px] flex flex-col items-center justify-center gap-2">
        {printed < 0 ? (
          <div className="ab-short:hidden"><Mascot mood="think" size={72} /></div>
        ) : (
          <WordTile testId="name-tile" onClick={tapName} className={`${shake ? 'zn-shake bg-ruby-wash' : ''} ${ready && !applied ? 'ring-2 ring-navy ring-offset-2' : ''}`}>
            {applied ? <Transformed item={item} size={32} /> : (
              <span className="font-geo font-extrabold text-[32px]">
                {letters.slice(0, printed).map((l, k) => <span key={k} className="zn-pop inline-block">{l}</span>)}
                {!ready && <span className="inline-block w-[2px] h-[28px] bg-jewelInk align-middle animate-pulse" />}
              </span>
            )}
            <span className="block text-[11px] font-semibold text-jewelInk-hint">{g.ru}</span>
          </WordTile>
        )}
        {applied && (
          <div className="zn-pop text-center" data-testid="my-line">
            <div className="font-geo font-bold text-[19px]">მე მქვია {g.geo}.</div>
            <div className="text-[11px] font-semibold text-jewelInk-hint">{cyr(`მე მქვია ${g.geo}`)}</div>
            <div className="text-[13px] font-bold text-navy">меня зовут {g.ru}</div>
          </div>
        )}
      </div>

      {ready && !applied && (
        <div className="flex justify-center gap-3 zn-pop">
          {(['ი', 'none'] as Tool[]).map(t => <MagnetButton key={t} tool={t} armed={armed === t} glow={false} onClick={() => setArmed(a => (a === t ? null : t))} />)}
        </div>
      )}
      {applied && <Button onClick={onNext}>Дальше: чужие имена</Button>}
      <Tip>{tip}</Tip>
    </div>
  )
}

// ── Лента ─────────────────────────────────────────────────────────────────────────────────────────

function Workshop({ set, rng, now, onEnd }: { set: MagnetSet; rng: Rng; now: () => number; onEnd: (b: Belt) => void }) {
  const beltRef = useRef<Belt>(startBelt(set, rng, now()))
  const [belt, setBelt] = useState<Belt>(beltRef.current)
  const [t, setT] = useState(now())
  const [armed, setArmed] = useState<Tool | null>(null)
  const [press, setPress] = useState<{ id: number; item: Item } | null>(null)
  const [shakeId, setShakeId] = useState<number | null>(null)
  const [tip, setTip] = useState(() => firstTip(beltRef.current))
  const later = useLater()
  const ended = useRef(false)
  const tools = toolsOf(set)

  useEffect(() => {
    const iv = setInterval(() => {
      const at = now()
      const r = tick(beltRef.current, at, rng)
      if (r.belt !== beltRef.current) { beltRef.current = r.belt; setBelt(r.belt) }
      setT(at)
      if (r.missed.length) { sound.miss(); setTip(r.belt.mode === 'free' ? 'Уехало! Ничего, оно ещё вернётся.' : 'Нужное слово уехало. Сейчас приедет снова.') }
    }, TICK_MS)
    return () => clearInterval(iv)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (b: Belt) => {
    if (ended.current) return
    ended.current = true
    later(() => onEnd(b), 1300)
  }

  const onTile = (id: number, el: HTMLElement) => {
    if (ended.current) return
    const before = beltRef.current
    const want = activeOrder(before)
    const r = tap(before, id, armed, now())
    if (r.result === 'gone') return
    beltRef.current = r.belt; setBelt(r.belt)
    if (r.result === 'ok' && r.item) {
      haptic('snap'); sound.snap(Math.min(r.belt.combo, 10))
      floater(`+${r.points}`, el, '#1B5FB0')
      if (r.belt.combo >= 3) burst(el, 'small')
      setPress({ id, item: r.item })
      setTip(praise(r.item) + (r.belt.combo >= 3 ? ` Серия ×${r.belt.combo}!` : ''))
      if (finished(r.belt)) finish(r.belt)
      return
    }
    haptic('bad'); sound.miss()
    setShakeId(id); later(() => setShakeId(s => (s === id ? null : s)), 400)
    setTip(hint(r.result, armed, r.belt.mode === 'order' ? want : r.item ?? null, r.item))
  }

  const order = activeOrder(belt)
  const assist = belt.missHere >= 2
  const assistTool: Tool | null = order ? order.tool : null

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2.5" data-testid="magnets-belt">
      <div className="flex items-center gap-2">
        <Pill testId="magnets-progress">{Math.min(belt.done + 1, belt.total)} / {belt.total}</Pill>
        <div className="flex-1" />
        {belt.combo >= 2 && <Pill testId="magnets-combo"><span className="text-ruby">×{belt.combo}</span></Pill>}
        <Pill testId="magnets-score">{belt.score}</Pill>
      </div>

      <div className="rounded-2xl border-[1.5px] border-jewelInk bg-navy-wash px-3 py-2 text-center" style={{ boxShadow: '3px 3px 0 #15100A' }}
        data-testid="magnets-order" data-key={order?.key ?? ''}>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-navy">{belt.mode === 'order' ? 'заказ' : 'по ленте едут имена'}</div>
        <div key={belt.done} className="zn-pop text-[22px] ab-short:text-[19px] font-extrabold leading-tight">
          {finished(belt) ? 'Смена закрыта!' : order ? `«${order.order}»` : <>Нужна ли <G>ი</G>?</>}
        </div>
      </div>

      <div className="flex-1 min-h-[76px] flex items-center justify-center" data-testid="magnets-press">
        {press ? (
          <div key={press.id} className="zn-pop flex flex-col items-center rounded-2xl border-[1.5px] border-dashed border-jewelInk-faint bg-cream-deep px-5 py-2">
            <Transformed item={press.item} size={34} />
            <span className="text-[12px] font-semibold text-jewelInk-hint">{cyr(press.item.result)}</span>
            {press.item.order && <span className="text-[13px] font-bold text-navy">{press.item.order}</span>}
          </div>
        ) : <Mascot mood="guide" size={64} />}
      </div>

      <Conveyor belt={belt} t={t} shakeId={shakeId} assistKey={assist && order ? order.key : null} onTile={onTile} />

      <div className="flex justify-center gap-3">
        {tools.map(tool => (
          <MagnetButton key={tool} tool={tool} armed={armed === tool} glow={assist && assistTool === tool}
            onClick={() => { setArmed(a => (a === tool ? null : tool)); if (!belt.done && !belt.misses) setTip('Теперь нажми на нужное слово на ленте.') }} />
        ))}
      </div>

      <Tip>{tip}</Tip>
      {belt.misses >= 5 && !ended.current && (
        <button type="button" data-testid="magnets-finish" onClick={() => { ended.current = true; onEnd(beltRef.current) }}
          className="min-h-[44px] text-[13px] font-bold text-jewelInk-hint underline underline-offset-4">
          Закончить смену
        </button>
      )}
    </div>
  )
}

function firstTip(b: Belt): string {
  const o = activeOrder(b)
  if (!o) return 'Возьми магнит ი или «без ი» и нажми на имя, пока оно едет.'
  return `Возьми магнит -${o.tool} и нажми на ${o.base} (${cyr(o.base)}), пока не уехало.`
}

function Conveyor({ belt, t, shakeId, assistKey, onTile }: {
  belt: Belt; t: number; shakeId: number | null; assistKey: string | null; onTile: (id: number, el: HTMLElement) => void
}) {
  const free = belt.mode === 'free'
  return (
    <div className="relative h-[116px] ab-short:h-[104px] rounded-2xl border-[1.5px] border-jewelInk overflow-hidden bg-cream-deep" data-testid="conveyor"
      style={{ boxShadow: '3px 3px 0 #15100A' }}>
      {/* лента: полосы бегут вместе с плитками */}
      <div className="absolute inset-x-0 bottom-0 h-[22px] border-t-[1.5px] border-jewelInk"
        style={{ background: 'repeating-linear-gradient(90deg, #3A2B1F 0 10px, #5A4735 10px 22px)', backgroundPositionX: `${(t / 40) % 22}px` }} />
      <div className="absolute inset-x-0 bottom-[6px] flex justify-around pointer-events-none">
        {Array.from({ length: 8 }, (_, k) => <span key={k} className="w-[10px] h-[10px] rounded-full border-[1.5px] border-jewelInk bg-jewelInk-faint" />)}
      </div>
      {belt.tiles.map(tile => {
        const x = xOf(tile, belt, t)
        const late = x > 0.78
        return (
          <div key={tile.id} className="absolute top-[10px]" style={{ left: `${-24 + x * 124}%` }}>
            <WordTile
              testId="belt-tile"
              data={{ key: tile.item.key }}
              onClick={el => onTile(tile.id, el)}
              className={`${shakeId === tile.id ? 'zn-shake bg-ruby-wash' : late ? 'bg-gold-wash' : ''} ${assistKey === tile.item.key ? 'ring-2 ring-gold ring-offset-1' : ''}`}
            >
              {free ? (
                <>
                  <span className="block text-[16px] font-extrabold whitespace-nowrap">{tile.item.ru}</span>
                  <span className="block font-geo font-bold text-[18px] whitespace-nowrap">{tile.item.base}</span>
                </>
              ) : (
                <>
                  <span className="block font-geo font-extrabold text-[19px] whitespace-nowrap">{tile.item.base}</span>
                  <span className="block text-[11px] font-semibold text-jewelInk-hint whitespace-nowrap">{cyr(tile.item.base)}</span>
                </>
              )}
            </WordTile>
          </div>
        )
      })}
    </div>
  )
}
