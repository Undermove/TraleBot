import React, { useEffect, useRef, useState } from 'react'
import Mascot from '../components/Mascot'
import Button from '../components/Button'
import { bad, good, haptic } from '../verbs/ui/juice'
import { allMatched, clock, newPairs, pairsHint, plural, tapPair, timeOut, type PairsState, type Side } from './logic'
import { DailyHeader, Dots, Geo, LinkButton, Page, Rich, Say, Sheet, StepTitle } from './ui'
import { cyr } from '../verbs/types'
import type { DailyBackRound, DailyItem, DailyTaskDto, DailyWarmRound } from './types'

// Шаги занятия: вступление, разминка, игра «Собери пары», обратный путь и проверка. Каждый шаг — один экран без прокрутки.

interface StepProps { steps: number; at: number; onExit: () => void; gift?: boolean }

// ── Вступление ───────────────────────────────────────────────────────────────

export function Intro({ task, onStart, onExit }: { task: DailyTaskDto; onStart: () => void; onExit: () => void }) {
  const [why, setWhy] = useState(false)
  return (
    <Page testId="daily-intro">
      <DailyHeader label={`Задание дня · ${task.title}`} onExit={onExit} />
      <div className="flex-1 px-5 flex flex-col justify-center gap-2.5 py-2">
        <div className="flex justify-center"><Mascot mood={task.mode === 'comeback' ? 'cheer' : 'guide'} size={128} /></div>
        {task.chat.map((line, i) => (
          <div
            key={i} data-testid="daily-chat"
            className="j-rise rounded-2xl rounded-tl-md bg-cream-tile border-[1.5px] border-jewelInk px-4 py-2.5 text-[15px] font-semibold leading-snug"
            style={{ animationDelay: `${i * 120}ms` }}
          >
            {line}
          </div>
        ))}
      </div>
      <div className="px-5 pt-2 flex flex-col gap-1">
        <Button onClick={onStart}>{task.button}</Button>
        {task.why.length > 0 && <LinkButton onClick={() => setWhy(true)} testId="daily-why-link">Почему так</LinkButton>}
      </div>
      {why && (
        <Sheet title="Почему так" onClose={() => setWhy(false)} testId="daily-why">
          <ul className="mt-1 flex flex-col gap-2">
            {task.why.map((line, i) => (
              <li key={i} className="flex gap-2 text-[14px] leading-snug text-jewelInk-mid">
                <span className="mt-[7px] w-1.5 h-1.5 shrink-0 rounded-full bg-navy" />
                <span><Rich line={line} /></span>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </Page>
  )
}

// ── Разминка ─────────────────────────────────────────────────────────────────

/** По одному раунду: грузинская форма и варианты перевода. Ошибся — показываем верный и идём дальше. */
export function Warm({ rounds, onDone, ...head }: StepProps & { rounds: DailyWarmRound[]; onDone: (wrong: string[]) => void }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const wrong = useRef<string[]>([])
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])

  const round = rounds[i]
  const right = round.options.find(o => o.ok)
  const pickedOk = picked !== null && round.options[picked].ok

  function pick(at: number, el: Element) {
    if (picked !== null) return
    const ok = round.options[at].ok
    setPicked(at)
    if (ok) good(el)
    else { bad(); wrong.current = [...wrong.current, round.item.key] }
    timer.current = setTimeout(() => {
      if (i === rounds.length - 1) return onDone(wrong.current)
      setI(i + 1); setPicked(null)
    }, ok ? 700 : 1500)
  }

  return (
    <Page testId="daily-warm">
      <DailyHeader {...head} />
      <StepTitle eyebrow="Разминка">Выбери перевод</StepTitle>
      <div className="flex-1 px-5 flex flex-col justify-center gap-4 py-3">
        <div key={i} className="jewel-tile j-pop px-4 py-6 text-center" data-testid="daily-warm-word" data-key={round.item.key}>
          <Geo ka={round.item.ka} className={round.item.ka.length > 12 ? 'text-[26px]' : 'text-[34px]'} cyrClassName="mt-1 text-[14px]" />
        </div>
        <Dots count={rounds.length} at={i} />
        <div className="min-h-[20px] text-center text-[13px] font-bold" data-testid="daily-warm-note" aria-live="polite">
          {picked !== null && (pickedOk
            ? <span className="text-navy">Верно</span>
            : <span className="text-ruby-deep">Правильно: «{right?.ru}»</span>)}
        </div>
      </div>
      <div className="px-5 flex flex-col gap-2.5">
        {round.options.map((o, at) => {
          const tone = picked === null ? 'bg-cream-tile'
            : o.ok ? 'bg-navy-wash'
            : at === picked ? 'bg-ruby-wash anim-shake' : 'bg-cream-tile opacity-50'
          return (
            <button
              key={`${i}-${at}`} onClick={e => pick(at, e.currentTarget)} disabled={picked !== null}
              data-testid="daily-warm-option" data-ok={o.ok ? 'yes' : 'no'}
              className={`min-h-[54px] rounded-xl border-[1.5px] border-jewelInk px-4 py-2 text-[16px] font-bold leading-tight ${tone}`}
              style={{ boxShadow: '2px 2px 0 #15100A' }}
            >
              {o.ru}
            </button>
          )
        })}
      </div>
    </Page>
  )
}

// ── С русского на грузинский ─────────────────────────────────────────────────

/** Обратный путь: значение по-русски, выбрать грузинскую форму. Ошибся — показываем верную и идём дальше. */
export function Back({ rounds, onDone, ...head }: StepProps & { rounds: DailyBackRound[]; onDone: (wrong: string[]) => void }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const wrong = useRef<string[]>([])
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])

  const round = rounds[i]
  const right = round.options.find(o => o.ok)!.item
  const pickedOk = picked !== null && round.options[picked].ok

  function pick(at: number, el: Element) {
    if (picked !== null) return
    const ok = round.options[at].ok
    setPicked(at)
    if (ok) good(el)
    else { bad(); wrong.current = [...wrong.current, round.item.key] }
    timer.current = setTimeout(() => {
      if (i === rounds.length - 1) return onDone(wrong.current)
      setI(i + 1); setPicked(null)
    }, ok ? 700 : 1800)
  }

  return (
    <Page testId="daily-back">
      <DailyHeader {...head} />
      <StepTitle eyebrow="С русского на грузинский">Как сказать по-грузински</StepTitle>
      <div className="flex-1 px-5 flex flex-col justify-center gap-4 py-3">
        <div key={i} className="jewel-tile j-pop px-4 py-6 text-center" data-testid="daily-back-word" data-key={round.item.key}>
          <div className={`font-extrabold leading-tight ${round.item.ru.length > 16 ? 'text-[24px]' : 'text-[30px]'}`}>{round.item.ru}</div>
        </div>
        <Dots count={rounds.length} at={i} />
        <div className="min-h-[20px] text-center text-[13px] font-bold" data-testid="daily-back-note" aria-live="polite">
          {picked !== null && (pickedOk
            ? <span className="text-navy">Верно</span>
            : <span className="text-ruby-deep">Правильно: {right.ka} ({cyr(right.ka)})</span>)}
        </div>
      </div>
      <div className="px-5 flex flex-col gap-2.5">
        {round.options.map((o, at) => {
          const tone = picked === null ? 'bg-cream-tile'
            : o.ok ? 'bg-navy-wash'
            : at === picked ? 'bg-ruby-wash anim-shake' : 'bg-cream-tile opacity-50'
          return (
            <button
              key={`${i}-${at}`} onClick={e => pick(at, e.currentTarget)} disabled={picked !== null}
              data-testid="daily-back-option" data-ok={o.ok ? 'yes' : 'no'}
              className={`min-h-[58px] rounded-xl border-[1.5px] border-jewelInk px-4 py-2 text-center ${tone}`}
              style={{ boxShadow: '2px 2px 0 #15100A' }}
            >
              <Geo ka={o.item.ka} className={o.item.ka.length > 12 ? 'text-[18px]' : 'text-[21px]'} cyrClassName="text-[12px]" />
            </button>
          )
        })}
      </div>
    </Page>
  )
}

// ── Игра «Собери пары» ───────────────────────────────────────────────────────

export interface PairsResult { errors: number; wrong: string[]; seconds: number }

/** После скольких «время вышло» можно идти дальше без игры: тупика быть не должно. */
const SKIP_AFTER = 2

/**
 * Слева грузинские формы, справа переводы: нажми форму, потом её перевод. Время идёт с первого нажатия.
 * Вышло время — несобранное считается ошибкой, партия начинается заново; в итог идут ошибки всех партий.
 */
export function PairsGame({ pairs, seconds, onDone, ...head }: StepProps & { pairs: DailyItem[]; seconds: number; onDone: (r: PairsResult) => void }) {
  const total = seconds * 1000
  const [game, setGame] = useState<PairsState>(() => newPairs(pairs.length))
  const [left, setLeft] = useState(total)
  const [timeouts, setTimeouts] = useState(0)
  const latest = useRef(game)
  latest.current = game
  const t0 = useRef(0)
  /** Ошибки прошлых партий, в которых вышло время. */
  const before = useRef<{ errors: number; wrong: string[] }>({ errors: 0, wrong: [] })
  const pending = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => pending.current.forEach(clearTimeout), [])

  const done = allMatched(game, pairs)
  const running = game.started && !game.over && !done

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      const rest = Math.max(0, total - (Date.now() - t0.current))
      setLeft(rest)
      if (rest > 0) return
      clearInterval(id)
      const over = timeOut(latest.current, pairs)
      before.current = { errors: before.current.errors + over.errors, wrong: [...new Set([...before.current.wrong, ...over.wrong])] }
      setGame(over); setTimeouts(n => n + 1); bad()
    }, 100)
    return () => clearInterval(id)
  }, [running]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (last: PairsState | null, spent: number) => onDone({
    errors: before.current.errors + (last?.errors ?? 0),
    wrong: [...new Set([...before.current.wrong, ...(last?.wrong ?? [])])],
    seconds: spent
  })

  function tap(side: Side, i: number, el: Element) {
    if (!game.started) t0.current = Date.now()
    const { state, event } = tapPair(game, side, i, pairs)
    if (!event) return
    setGame(state)
    if (event === 'select') haptic('tap')
    if (event === 'miss') {
      bad()
      pending.current.push(setTimeout(() => setGame(g => (g.bad === state.bad ? { ...g, bad: null } : g)), 420))
    }
    if (event === 'match') good(el)
    if (event === 'done') {
      const spent = Math.max(1, Math.round((Date.now() - t0.current) / 1000))
      good(el, 'big')
      pending.current.push(setTimeout(() => finish(state, spent), 900))
    }
  }

  function again() {
    setGame(newPairs(pairs.length)); setLeft(total)
  }

  const tile = (side: Side, i: number) => {
    const p = pairs[i]
    const matched = (side === 'l' ? game.matchedL : game.matchedR).includes(i)
    const selected = game.sel?.side === side && game.sel.i === i
    const wrong = game.bad !== null && (side === 'l' ? game.bad.l === i : game.bad.r === i)
    const tone = matched ? 'bg-navy-wash opacity-30' : wrong ? 'bg-ruby-wash anim-shake' : selected ? 'bg-gold-wash ring-4 ring-gold' : 'bg-cream-tile'
    return (
      <button
        key={`${side}${i}`} onClick={e => tap(side, i, e.currentTarget)} disabled={matched || game.over}
        data-testid={`daily-tile-${side}`} data-key={p.key} data-matched={matched ? 'yes' : 'no'}
        aria-pressed={selected}
        className={`min-w-0 min-h-[52px] rounded-xl border-[1.5px] border-jewelInk px-2 py-1 text-center transition-opacity duration-300 ${tone} ${game.over && !matched ? 'opacity-60' : ''}`}
        style={{ boxShadow: matched ? 'none' : '2px 2px 0 #15100A' }}
      >
        {side === 'l'
          ? <Geo ka={p.ka} className={p.ka.length > 14 ? 'text-[13px]' : p.ka.length > 9 ? 'text-[15px]' : 'text-[18px]'} />
          : <span className={`block font-bold leading-tight break-words ${p.ru.length > 22 ? 'text-[12px]' : p.ru.length > 13 ? 'text-[13px]' : 'text-[15px]'}`}>{p.ru}</span>}
      </button>
    )
  }

  const count = pairs.length
  return (
    <Page testId="daily-game">
      <DailyHeader {...head} />
      <StepTitle
        right={<div className="shrink-0 text-[22px] font-extrabold tabular-nums" data-testid="daily-score">{game.matchedL.length}<span className="text-[13px] font-bold text-jewelInk-hint"> из {count}</span></div>}
      >
        {game.over ? 'Время вышло' : 'Собери пары'}
      </StepTitle>
      <div className="px-5 mt-0.5 text-[13px] text-jewelInk-mid">
        {count} {plural(count, 'пара', 'пары', 'пар')} за {seconds} {plural(seconds, 'секунду', 'секунды', 'секунд')}
      </div>
      <div className="px-5 mt-2 flex items-center gap-3">
        <div className="flex-1 h-3 rounded-full bg-cream-deep border border-jewelInk/30 overflow-hidden">
          <div className={`h-full transition-[width] duration-100 ease-linear ${left / total < 0.25 ? 'bg-ruby' : 'bg-gold'}`} style={{ width: `${(left / total) * 100}%` }} data-testid="daily-timer-bar" />
        </div>
        <div className="shrink-0 w-10 text-right text-[14px] font-extrabold tabular-nums" data-testid="daily-timer" data-running={running ? 'yes' : 'no'}>{clock(left)}</div>
      </div>
      <div className="px-5 mt-3 grid grid-cols-2 gap-x-3 gap-y-2" style={{ gridAutoRows: 'minmax(52px, auto)' }} data-testid="daily-pairs">
        {Array.from({ length: count }, (_, row) => [tile('l', game.left[row]), tile('r', game.right[row])])}
      </div>
      <div className="flex-1 min-h-[8px]" />
      {game.over ? (
        <>
          <Say mood="think" size={64} testId="daily-game-say">
            Время вышло. Собрано {game.matchedL.length} из {count} — сыграй ещё раз, получится быстрее.
          </Say>
          <div className="px-5 mt-3 flex flex-col gap-1">
            <Button onClick={again}>Сыграть ещё раз</Button>
            {timeouts >= SKIP_AFTER && <LinkButton onClick={() => finish(null, seconds)} testId="daily-game-skip">Идти дальше без игры</LinkButton>}
          </div>
        </>
      ) : (
        <Say mood={done ? 'cheer' : 'happy'} size={64} testId="daily-game-say">{pairsHint(game, pairs)}</Say>
      )}
    </Page>
  )
}

// ── Проверка ─────────────────────────────────────────────────────────────────

/** Одна форма из игры среди похожих. Ошибся — Бомбора объясняет, выбираешь снова. */
export function Check({ check, onDone, ...head }: StepProps & { check: DailyTaskDto['check']; onDone: (errors: number) => void }) {
  const [wrong, setWrong] = useState<number[]>([])
  const [last, setLast] = useState<number | null>(null)
  const [ok, setOk] = useState(false)
  const said = last !== null ? check.picks[last].message : check.intro

  function pick(i: number, el: Element) {
    if (ok || wrong.includes(i)) return
    setLast(i)
    if (check.picks[i].ok) { setOk(true); good(el, 'big') }
    else { setWrong([...wrong, i]); bad() }
  }

  const cols = check.picks.length > 3 ? 'grid-cols-2' : 'grid-cols-1'
  return (
    <Page testId="daily-check">
      <DailyHeader {...head} />
      <StepTitle eyebrow="Проверка">{check.prompt}</StepTitle>
      <div className={`px-5 mt-4 grid ${cols} gap-2.5`}>
        {check.picks.map((p, i) => {
          const tone = ok && p.ok ? 'bg-navy-wash' : wrong.includes(i) ? `bg-ruby-wash opacity-60 ${last === i ? 'anim-shake' : ''}` : ok ? 'bg-cream-tile opacity-50' : 'bg-cream-tile'
          return (
            <button
              key={i} onClick={e => pick(i, e.currentTarget)} disabled={ok || wrong.includes(i)}
              data-testid="daily-pick" data-ok={p.ok ? 'yes' : 'no'}
              className={`min-w-0 min-h-[60px] rounded-xl border-[1.5px] border-jewelInk px-3 py-2 text-center ${tone}`}
              style={{ boxShadow: '2px 2px 0 #15100A' }}
            >
              <Geo ka={p.item.ka} className={p.item.ka.length > 14 ? 'text-[17px]' : 'text-[21px]'} cyrClassName="text-[12px]" />
            </button>
          )
        })}
      </div>
      <div className="flex-1 min-h-[12px]" />
      <Say mood={ok ? 'cheer' : 'think'} size={72} testId="daily-check-say">{said}</Say>
      <div className={`px-5 mt-3 ${ok ? '' : 'invisible'}`} aria-hidden={!ok}>
        <Button onClick={() => onDone(wrong.length)} disabled={!ok}>Готово</Button>
      </div>
    </Page>
  )
}
