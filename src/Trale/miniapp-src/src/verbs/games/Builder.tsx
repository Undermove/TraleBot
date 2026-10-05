import React, { useMemo, useRef, useState } from 'react'
import Button from '../../components/Button'
import { cyr, type TenseKey, type VerbDto } from '../types'
import { MeaningText } from '../parts'
import { Coach, GameShell, PULSE, useFirstTime, type SceneHooks } from '../ui/GameShell'
import { STEP } from '../ladder/engine'
import { LockIcon } from '../ui/icons'
import { bad, good, haptic } from '../ui/juice'
import { STAGE_STEP, assemble, makePuzzle, schemeOf, wrongRows, type Choice, type Puzzle } from './formParts'
import { describeSlot, slotMeaning, slotsOf, type Rng } from './common'

/** Прочерк на плашке: «в этом месте ничего нет». */
const NONE = '—'
type RowKey = keyof Choice
type Picked = Record<RowKey, string | null>

const ROWS: { key: RowKey; label: string; miss: string }[] = [
  { key: 'preverb', label: 'Приставка', miss: 'приставку' },
  { key: 'marker', label: 'Буква для «я» и «мы»', miss: 'букву для «я» и «мы»' },
  { key: 'ending', label: 'Окончание', miss: 'окончание' }
]

/** Ряды с единственным вариантом уже поставлены за игрока. */
const prefill = (p: Puzzle): Picked => ({
  preverb: p.preverbs.length === 1 ? p.preverbs[0] : null,
  marker: p.markers.length === 1 ? p.markers[0] : null,
  ending: p.endings.length === 1 ? p.endings[0] : null
})

/**
 * «Конструктор»: форма собирается из частей — приставка, показатель лица, корень, окончание.
 * Сложность растёт сама: сначала выбираешь только окончание, потом показатель лица, потом приставку.
 */
export default function Builder({ verb, onExit, rng = Math.random, extraPreverbs = [], scene }: {
  verb: VerbDto; onExit: () => void; rng?: Rng
  /** Приставки других глаголов — ложные варианты в ряду приставок. */
  extraPreverbs?: string[]
  /** В сессии: сколько слов собрать, с какой ступени сложности (solvedBefore) и куда сообщать ответы. */
  scene?: SceneHooks & { rounds: number; solvedBefore: number }
}) {
  const scheme = useMemo(() => schemeOf(verb)!, [verb])
  const [solved, setSolved] = useState(scene?.startAt ?? 0)
  /** В сессии ступень сложности задаёт постановщик и внутри сцены она не растёт. */
  const level = (n: number) => (scene ? scene.solvedBefore : n)
  const missed = useRef(false)
  const [puzzle, setPuzzle] = useState(() => makePuzzle(verb, level(0), rng, extraPreverbs))
  const [picked, setPicked] = useState<Picked>(() => prefill(puzzle))
  const [result, setResult] = useState<{ ok: boolean; text?: string } | null>(null)
  /** Ступень выросла на этом задании — один раз говорим, что изменилось. */
  const [grew, setGrew] = useState(false)
  const [first, played] = useFirstTime('verb_builder')
  const frame = useRef<HTMLDivElement>(null)

  const options: Record<RowKey, string[]> = { preverb: puzzle.preverbs, marker: puzzle.markers, ending: puzzle.endings }
  const nextRow = ROWS.find(r => picked[r.key] === null)?.key ?? null
  const ready = nextRow === null
  const pick: Choice = { preverb: picked.preverb ?? '', marker: picked.marker ?? '', ending: picked.ending ?? '' }
  const assembled = assemble(scheme.root, pick)
  const slot = { tense: puzzle.cell.tense, person: puzzle.cell.person }

  function choose(key: RowKey, value: string) {
    if (result?.ok) return
    haptic('tap')
    setPicked({ ...picked, [key]: value })
    setResult(null)
  }

  function check() {
    if (assembled === puzzle.cell.form) {
      const n = solved + 1
      setSolved(n); setResult({ ok: true }); played()
      good(frame.current, !scene && n % STAGE_STEP === 0 ? 'big' : 'small')
      if (scene) {
        if (!missed.current) scene.onResult(slot, true, STEP.TYPE)
        scene.onStep()
      }
      return
    }
    bad()
    if (scene && !missed.current) scene.onResult(slot, false, STEP.TYPE)
    missed.current = true
    // Не «неправильно», а что получилось: если это другая форма того же глагола — называем её.
    const other = slotsOf(verb, assembled, Object.keys(verb.tenses) as TenseKey[])[0]
    const miss = wrongRows(puzzle.cell, pick).map(k => ROWS.find(r => r.key === k)!.miss).join(' и ')
    setResult({ ok: false, text: `${other ? `Это ${describeSlot(verb, other)}. ` : ''}Поменяй ${miss} — и собери ещё раз.` })
  }

  function next() {
    if (scene && solved >= scene.rounds) return scene.onDone()
    missed.current = false
    const p = makePuzzle(verb, level(solved), rng, extraPreverbs, puzzle)
    setGrew(p.stage > puzzle.stage)
    setPuzzle(p); setPicked(prefill(p)); setResult(null)
  }

  const marker = <span className="font-geo">{scheme.marker}</span>
  const coach: Record<RowKey, React.ReactNode> = {
    preverb: 'Выбери приставку. Прочерк — без приставки.',
    marker: <>Если действует «я» или «мы», нужен {marker}, иначе прочерк.</>,
    ending: 'Выбери окончание. Слово в рамке меняется сразу.'
  }

  return (
    <GameShell
      id="verb_builder" title="Конструктор" onExit={onExit}
      right={<span key={solved} className="inline-block j-bump">собрано {solved}</span>}
      help={[
        'Сверху по-русски написано, что нужно сказать. Собери это слово из частей.',
        'Корень уже стоит в рамке. Что уже поставлено за тебя — помечено замком.',
        'Прочерк «—» значит, что в этом месте ничего нет.',
        'Слово в рамке меняется сразу, как ты нажимаешь. Когда всё выбрано — жми «Собрать».'
      ]}
    >
      <div className="px-5 flex-1 flex flex-col gap-3 justify-center">
        <div className="text-center" data-testid="builder-ask" data-tense={slot.tense} data-person={slot.person}>
          <div className="text-[13px] text-jewelInk-mid"><span className="font-geo font-bold text-jewelInk">{verb.title}</span> · {verb.ru}</div>
          <div className="mt-1 text-[24px] font-extrabold leading-tight"><MeaningText meaning={slotMeaning(verb, slot)} /></div>
        </div>

        <div
          ref={frame} data-testid="builder-frame"
          className={`rounded-xl border-[1.5px] border-jewelInk p-3 text-center ${!result ? 'bg-cream-tile' : result.ok ? 'bg-navy-wash j-glow' : 'bg-gold-wash'}`}
          style={{ boxShadow: '3px 3px 0 #15100A' }}
        >
          <div key={result ? String(result.ok) : 'idle'} className={`font-geo text-[30px] font-extrabold leading-none ${result ? (result.ok ? 'j-hop' : 'j-wiggle') : ''}`}>
            <span key={'a' + pick.preverb + pick.marker} className="inline-block text-navy j-pop">{pick.preverb}{pick.marker}</span>
            {scheme.root}
            <span key={'b' + pick.ending} className="inline-block text-ruby j-pop">{pick.ending}</span>
          </div>
          <div className="mt-1 text-[12px] text-jewelInk-hint">{cyr(assembled)}</div>
          {result?.text && <div className="mt-1.5 text-[13px] font-bold" data-testid="builder-note">{result.text}</div>}
        </div>

        {!result && (first && nextRow
          ? <Coach>{coach[nextRow]}</Coach>
          : grew && <Coach>{puzzle.stage === 2 ? 'Теперь букву для «я» и «мы» выбираешь ты.' : 'Теперь и приставку выбираешь ты.'}</Coach>)}

        {ROWS.map(r => (
          <Row
            key={r.key} id={r.key} label={r.label} options={options[r.key]} value={picked[r.key]}
            pulse={first && !result && nextRow === r.key}
            onPick={v => choose(r.key, v)}
          />
        ))}

        {result?.ok
          ? <Button onClick={next}>Дальше</Button>
          : <Button disabled={!ready} onClick={check}>Собрать</Button>}
      </div>
      <div className="h-5" />
    </GameShell>
  )
}

function Row({ id, label, options, value, pulse, onPick }: {
  id: string; label: string; options: string[]; value: string | null; pulse: boolean; onPick: (v: string) => void
}) {
  const locked = options.length === 1
  return (
    <div className={`rounded-xl p-1 -m-1 ${pulse ? PULSE : ''}`} data-testid={`builder-row-${id}`}>
      <div className="text-[11px] font-bold uppercase tracking-wider text-jewelInk-mid mb-1">
        {label}{locked && <span className="normal-case tracking-normal font-normal text-jewelInk-hint"> · <LockIcon size={12} /> уже стоит</span>}
      </div>
      <div className="flex gap-2">
        {options.map(o => (
          <button
            key={o}
            disabled={locked}
            data-value={o}
            aria-pressed={value === o}
            onClick={() => onPick(o)}
            className={`flex-1 min-w-0 h-10 rounded-lg border-[1.5px] border-jewelInk font-geo text-[16px] font-bold ${value === o ? 'bg-gold' : 'bg-cream-tile'} ${locked ? 'opacity-60' : ''}`}
            style={{ boxShadow: value === o ? undefined : '2px 2px 0 #15100A' }}
          >
            {o || NONE}
          </button>
        ))}
      </div>
    </div>
  )
}
