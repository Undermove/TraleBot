import React, { useEffect, useMemo, useState } from 'react'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { useLater } from '../../verbs/games/useLater'
import { cyr } from '../../verbs/types'
import Button from '../../components/Button'
import { plural } from '../story'
import { Bubble, Face, GameEnd, GameIntro, Pill, RuleCard, Tip } from '../ui'
import type { SceneProps, StepOf } from './types'
import {
  PUZZLES, clueFor, clueGeo, clueRu, cycle, emptyGrid, makeCase, speakerOf, wrongRows,
  type Clue, type DetectiveMode, type Mark, type Option, type Puzzle
} from './Detective.logic'

/**
 * «Кто есть кто» — логическая решётка во дворе. Три соседа, три варианта (страны или профессии). Ты
 * подслушиваешь реплики: «მე ვარ ესპანეთიდან», «<имя>? ის არის ექიმი», на вопрос — «არა». Прямо сказано
 * не всё: третье узнаёшь методом исключения. Клетки — ✓ / ✗ по нажатию, «Проверить» показывает, какая
 * строка не сходится и какую реплику перечитать. Три дела, каждое хитрее.
 */

const G = ({ children }: { children: string }) => <b className="font-geo">{children}</b>
const REVEAL_MS = 900

type Phase = 'intro' | 'play' | 'end'

export default function Detective({ lesson, step, fraction, onExit, onDone, rng = Math.random }: SceneProps<StepOf<'detective'>>) {
  const mode = step.mode
  const [round, setRound] = useState(0)
  const cases = useMemo(() => makeCase(mode, lesson.id, rng), [round]) // eslint-disable-line react-hooks/exhaustive-deps
  const [phase, setPhase] = useState<Phase>('intro')
  const [i, setI] = useState(0)
  const [clean, setClean] = useState(0)

  const title = mode === 'from' ? 'Кто откуда' : 'Кто кем работает'
  const solved = (firstTry: boolean) => {
    if (firstTry) setClean(c => c + 1)
    if (i + 1 >= PUZZLES) setPhase('end')
    else setI(i + 1)
  }

  return (
    <GameFrame title={title} eyebrow={phase === 'play' ? `дело ${i + 1} из ${PUZZLES}` : 'детектив двора'} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col" data-testid="detective-scene">
        {phase === 'intro' && (
          <GameIntro
            mood="think"
            title={title}
            text={mode === 'from'
              ? 'Во дворе новые соседи, и все откуда-то приехали. Подслушай, кто что говорит, и разложи по решётке: галочка — да, крестик — нет. Не всё скажут прямо.'
              : 'Кто из соседей врач, кто учитель, а кто студент? Подслушай разговоры и разложи по решётке. Иногда говорят и про других.'}
            chips={mode === 'from' ? [{ geo: 'მე ვარ', ru: 'я' }, { geo: '-დან', ru: 'из' }] : [{ geo: 'მე ვარ', ru: 'я' }, { geo: 'ის არის', ru: 'он/она' }]}
            onStart={() => setPhase('play')}
          />
        )}
        {phase === 'play' && <Board key={`${round}-${i}`} puzzle={cases[i]} last={i + 1 >= PUZZLES} onSolved={solved} />}
        {phase === 'end' && (
          <GameEnd
            title="Все дела раскрыты"
            text={`${clean} из ${PUZZLES} ${plural(clean, 'дело', 'дела', 'дел')} — с первой проверки.`}
            rule={<RuleCard title={mode === 'from' ? 'Откуда' : 'Я и он'}>{mode === 'from'
              ? <><G>-დან</G> — «из»: <G>მე ვარ ესპანეთიდან</G> — я из Испании. Слово страны остаётся целым.</>
              : <><G>მე ვარ</G> — про себя: <G>მე ვარ ექიმი</G> — я врач. <G>ის არის</G> — про другого: <G>ის არის მასწავლებელი</G> — он(а) учитель.</>}
            </RuleCard>}
            onNext={onDone}
            onAgain={() => { setRound(r => r + 1); setI(0); setClean(0); setPhase('play') }}
          />
        )}
      </div>
    </GameFrame>
  )
}

// ── Значки ────────────────────────────────────────────────────────────────────────────────────────

function MarkIcon({ m }: { m: Mark }) {
  if (m === 1) return <svg width="24" height="24" viewBox="0 0 24 24" aria-label="да"><path d="M4 13 L10 19 L20 5" fill="none" stroke="#1B5FB0" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
  if (m === 2) return <svg width="20" height="20" viewBox="0 0 20 20" aria-label="нет"><path d="M4 4 L16 16 M16 4 L4 16" stroke="#E01A3C" strokeWidth="3" strokeLinecap="round" /></svg>
  return null
}

function Flag({ flag }: { flag: Option['flag'] }) {
  const box = { width: 26, height: 17, viewBox: '0 0 30 20', 'aria-hidden': true } as const
  if (flag === 'ge') return (
    <svg {...box}><rect width="30" height="20" fill="#FDFAEF" /><path d="M15 0v20M0 10h30" stroke="#E01A3C" strokeWidth="4" />
      {[[7, 5], [23, 5], [7, 15], [23, 15]].map(([x, y]) => <path key={`${x}${y}`} d={`M${x} ${y - 2.5}v5M${x - 2.5} ${y}h5`} stroke="#E01A3C" strokeWidth="1.6" />)}
      <rect width="30" height="20" fill="none" stroke="#15100A" strokeWidth="1.5" /></svg>
  )
  if (flag === 'es') return <svg {...box}><rect width="30" height="20" fill="#E01A3C" /><rect y="5" width="30" height="10" fill="#F5B820" /><rect width="30" height="20" fill="none" stroke="#15100A" strokeWidth="1.5" /></svg>
  if (flag === 'fr') return <svg {...box}><rect width="10" height="20" fill="#1B5FB0" /><rect x="10" width="10" height="20" fill="#FDFAEF" /><rect x="20" width="10" height="20" fill="#E01A3C" /><rect width="30" height="20" fill="none" stroke="#15100A" strokeWidth="1.5" /></svg>
  return null
}

// ── Реплики ───────────────────────────────────────────────────────────────────────────────────────

function ClueLine({ clue, puzzle, hot, open, onToggle }: { clue: Clue; puzzle: Puzzle; hot: boolean; open: boolean; onToggle: () => void }) {
  const who = puzzle.people[speakerOf(clue)]
  const hidden = puzzle.level >= 3
  const geo = clueGeo(clue, puzzle)
  return (
    <div className={`zn-pop flex items-center gap-2 rounded-xl px-1 ${hot ? 'zn-shake ring-2 ring-ruby bg-ruby-wash/60' : ''}`} data-testid="clue" data-hot={hot ? 'yes' : 'no'}>
      <div className="flex flex-col items-center w-[52px] shrink-0">
        <Face look={who.look} size={34} mood={clue.kind === 'not' ? 'huh' : 'smile'} />
        <span className="font-geo text-[10px] font-bold leading-tight truncate max-w-[52px]">{hidden ? '?' : who.name}</span>
      </div>
      <button type="button" onClick={onToggle} className="min-h-[44px] flex-1 min-w-0 text-left" data-testid="clue-bubble">
        {clue.kind === 'not' && <div className="text-[11px] font-semibold text-jewelInk-hint">— Ты {puzzle.options[clue.opt].ask}?</div>}
        <Bubble className="inline-block !text-left !py-1">
          <span className="font-geo font-bold text-[15px] leading-tight">{geo}</span>
          <span className="block text-[11px] font-semibold text-jewelInk-hint leading-tight">{open ? clueRu(clue, puzzle) : cyr(geo)}</span>
        </Bubble>
      </button>
    </div>
  )
}

// ── Решётка ───────────────────────────────────────────────────────────────────────────────────────

function Board({ puzzle, last, onSolved }: { puzzle: Puzzle; last: boolean; onSolved: (firstTry: boolean) => void }) {
  const n = puzzle.people.length
  const [grid, setGrid] = useState<Mark[][]>(() => emptyGrid(n))
  const [shown, setShown] = useState(0)
  const [wrong, setWrong] = useState<number[]>([])
  const [hot, setHot] = useState<number | null>(null)
  const [open, setOpen] = useState<number[]>([])
  const [checks, setChecks] = useState(0)
  const [done, setDone] = useState(false)
  const [tip, setTip] = useState(puzzle.level >= 3 ? 'Подслушано из-за угла: кто говорит — узнай по лицу.' : 'Нажми на клетку: галочка — да, ещё раз — крестик, ещё раз — пусто.')
  const later = useLater()

  useEffect(() => {
    puzzle.clues.forEach((_, k) => later(() => { setShown(k + 1); sound.pop(k) }, 300 + k * REVEAL_MS))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const tapCell = (r: number, c: number) => {
    if (done) return
    haptic('tap'); sound.tick(grid[r][c])
    setGrid(g => g.map((row, i) => (i === r ? row.map((m, k) => (k === c ? cycle(m) : m)) : row)))
    setWrong(w => w.filter(x => x !== r))
  }

  const check = (el: HTMLElement) => {
    if (done) return
    const bad = wrongRows(grid, puzzle.solution)
    setChecks(c => c + 1)
    if (!bad.length) {
      haptic('good'); sound.win(); burst(el, 'big')
      setDone(true); setWrong([]); setHot(null)
      setTip(last ? 'Последнее дело раскрыто!' : 'Сошлось! Следующее дело будет хитрее.')
      return
    }
    haptic('bad'); sound.miss()
    setWrong(bad)
    const noTick = bad.find(r => !grid[r].includes(1))
    const row = noTick ?? bad[0]
    const k = clueFor(row, puzzle.clues)
    const who = puzzle.people[row].ru
    setHot(k); if (k !== null) later(() => setHot(h => (h === k ? null : h)), 1600)
    setTip(noTick !== undefined
      ? `Строка «${who}»: пока ни одной галочки. В каждой строке — ровно одна.`
      : k === null
        ? `Строка «${who}» не сходится. Про этого соседа прямо никто не сказал — исключи то, что уже занято.`
        : `Строка «${who}» не сходится. Перечитай подсвеченную реплику.`)
  }

  const reveal = () => {
    haptic('pop')
    setGrid(puzzle.solution.map(s => [...Array(n).keys()].map(k => (k === s ? 1 : 2) as Mark)))
    setDone(true); setWrong([])
    setTip('Вот как было. Сравни с репликами — следующее получится.')
  }

  const cell = 'w-[52px] h-[44px] ab-short:h-[40px]'
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2" data-testid="detective-board">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-bold text-jewelInk-soft">{puzzle.level >= 3 ? 'Подслушано из-за угла' : 'Подслушано во дворе'}</span>
        <div className="flex-1" />
        <Pill>{puzzle.clues.length} {plural(puzzle.clues.length, 'реплика', 'реплики', 'реплик')}</Pill>
      </div>

      <div className="flex flex-col gap-1.5 min-h-[100px]" data-testid="clues">
        {puzzle.clues.slice(0, shown).map((c, k) => (
          <ClueLine key={k} clue={c} puzzle={puzzle} hot={hot === k} open={open.includes(k)} onToggle={() => setOpen(o => (o.includes(k) ? o.filter(x => x !== k) : [...o, k]))} />
        ))}
        {shown < puzzle.clues.length && <div className="zn-dots pl-14 py-2" aria-label="кто-то говорит"><i /><i /><i /></div>}
      </div>

      <div className="rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile p-1.5 self-center" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="grid">
        <div className="flex items-end gap-1">
          <div className="w-[92px]" />
          {puzzle.options.map(o => (
            <div key={o.key} className="w-[52px] flex flex-col items-center leading-tight">
              {o.flag && <Flag flag={o.flag} />}
              <span className="mt-0.5 text-[11px] font-bold text-jewelInk-soft text-center">{o.ru}</span>
            </div>
          ))}
        </div>
        {puzzle.people.map((p, r) => (
          <div key={p.name} className={`mt-1 flex items-center gap-1 rounded-xl ${wrong.includes(r) ? 'zn-shake bg-ruby-wash' : done ? 'bg-[#D6E9D9]' : ''}`} data-testid={`row-${r}`} data-wrong={wrong.includes(r) ? 'yes' : 'no'}>
            <div className="w-[92px] flex items-center gap-1 min-w-0">
              <Face look={p.look} size={30} mood={done ? 'wow' : 'smile'} />
              <span className="min-w-0 leading-tight">
                <span className="block font-geo font-bold leading-tight [overflow-wrap:anywhere]" style={{ fontSize: p.name.length > 6 ? 10 : 12 }}>{p.name}</span>
                <span className="block text-[10px] font-semibold text-jewelInk-hint truncate">{p.ru}</span>
              </span>
            </div>
            {puzzle.options.map((o, c) => (
              <button key={o.key} type="button" data-testid={`cell-${r}-${c}`} data-mark={grid[r][c]} onClick={() => tapCell(r, c)}
                aria-label={`${p.ru} — ${o.ru}`}
                className={`${cell} rounded-lg border-[1.5px] border-jewelInk flex items-center justify-center ${grid[r][c] === 1 ? 'bg-navy-wash' : grid[r][c] === 2 ? 'bg-cream-deep' : 'bg-cream'}`}>
                <MarkIcon m={grid[r][c]} />
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="flex-1 min-h-0" />
      <Tip>{tip}</Tip>
      {done ? (
        <Button onClick={() => onSolved(checks === 1)}>{last ? 'Закрыть дела' : 'Следующее дело'}</Button>
      ) : (
        <div className="flex gap-2">
          {checks >= 3 && <div className="flex-1"><Button variant="ghost" onClick={reveal}>Показать</Button></div>}
          <div className="flex-[2]"><CheckButton onClick={check} /></div>
        </div>
      )}
    </div>
  )
}

function CheckButton({ onClick }: { onClick: (el: HTMLElement) => void }) {
  return (
    <button type="button" data-testid="detective-check" onClick={e => onClick(e.currentTarget)} className="jewel-btn bg-navy text-cream w-full">
      <span className="relative z-[1]">Проверить</span>
    </button>
  )
}
