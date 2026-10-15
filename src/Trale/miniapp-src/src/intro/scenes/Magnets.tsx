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
import Endings, { type EndingsResult } from './Endings'
import {
  MAGNET_RU, activeOrder, finished, hint, praise, startBelt, tap, tick, toolsOf, transform, xOf,
  type Belt, type Item, type MagnetSet, type Tool
} from './Magnets.logic'

/**
 * «Магниты» — окончания как капсулы в автомате с краном (Endings.tsx): Нино спрашивает, в твоём ответе
 * у слова нет окончания, краном достаёшь нужную капсулу и бросаешь в ответ — слово меняется на глазах
 * (у -ში отваливается ი, у -დან слово остаётся целым). В наборе name сначала печатаем имя самого
 * человека и цепляем ему ი, потом чужие имена: ი или «без ი»?
 */

const G = ({ children }: { children: string }) => <b className="font-geo">{children}</b>
const TICK_MS = 50

type Phase = 'intro' | 'me' | 'belt' | 'end'

const TITLE: Record<MagnetSet, string> = { name: 'Имя по-грузински', from: 'Магниты: откуда', in: 'Магниты: где', both: 'Магниты: большая смена' }

export default function Magnets({ step, fraction, onExit, onDone, rng = Math.random, now = Date.now }: SceneProps<StepOf<'magnets'>>) {
  const set = step.set
  const [phase, setPhase] = useState<Phase>('intro')
  const [round, setRound] = useState(0)
  const [result, setResult] = useState<EndingsResult | null>(null)
  const title = TITLE[set]

  const end = (b: EndingsResult) => { setResult(b); setPhase('end'); sound.win() }

  return (
    <GameFrame title={title} eyebrow="мастерская" fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col" data-testid="magnets-scene">
        {phase === 'intro' && (
          <GameIntro
            title={title}
            text={set === 'name'
              ? 'Сначала напечатаем твоё имя грузинскими буквами. Потом чужие имена: краном достань капсулу ი или «без ი» и брось в ответ.'
              : 'Нино спрашивает, а в твоём ответе у слова нет окончания. Краном достань нужную капсулу и брось её в ответ: -დან — «из», -ში — «в».'}
            chips={set === 'name' ? [{ geo: 'ი', ru: 'на согласную' }] : toolsOf(set).map(t => ({ geo: `-${t}`, ru: MAGNET_RU[t] }))}
            onStart={() => setPhase(set === 'name' ? 'me' : 'belt')}
          />
        )}
        {phase === 'me' && <MyName onNext={() => setPhase('belt')} />}
        {phase === 'belt' && <Endings key={round} set={set} rng={rng} onEnd={end} />}
        {phase === 'end' && result && (
          <GameEnd
            title="Автомат пуст"
            text={`${result.done} ${plural(result.done, 'ответ', 'ответа', 'ответов')} · ${result.score} ${plural(result.score, 'очко', 'очка', 'очков')} · лучшая серия ×${result.best}`}
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
