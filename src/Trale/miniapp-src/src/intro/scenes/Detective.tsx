import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { cyr } from '../../verbs/types'
import Button from '../../components/Button'
import { JOBS, firstMet, met, phrase, plural } from '../story'
import { GameEnd, GameIntro, NewWord, RuleCard, WordTag } from '../ui'
import { hush, speak, speakUrl } from '../voice'
import type { SceneProps, StepOf } from './types'
import {
  PUZZLES, clueFor, clueGeo, clueRu, give, makeCase, speakerOf, wrongPeople,
  type Clue, type Option, type Puzzle
} from './Detective.logic'
import { voiceOf } from './Reception.logic'
import { Flag } from './icons'
import { JobIcon } from './Party'
import Passerby, { type Face } from './walk/Passerby'
import type { Who } from './Walk.logic'

/**
 * «Кто есть кто» — посылки в подъезде. Курьер оставил три коробки: на каждой флаг страны (или значок
 * профессии), а кому какая — не написано. Новые соседи тут же болтают: «მე ვარ ესპანეთიდან», на твой
 * вопрос — «არა», про другого — «ნინო? ის არის ექიმი». Всё подслушанное остаётся списком — помнить не
 * нужно, нужно понять. Раздай посылки: нажми коробку, потом соседа. Прямо сказано не всё — третье
 * узнаёшь методом исключения. Отдаёшь — спрашиваешь «ეს შენია?» (это твоё?), и каждый сосед отвечает
 * «კი!» или «არა». Три подъезда, каждый хитрее.
 */

const G = ({ children }: { children: string }) => <b className="font-geo">{children}</b>
const AUDIO = '/audio/intro-story/'

/** Запись реплики голосом говорящего: «მე ვარ …» — как на ресепшене, «არა» — отдельно; про другого — без записи. */
function clueAudio(c: Clue, p: Puzzle): string | undefined {
  const v = voiceOf(p.people[speakerOf(c)].name)
  if (c.kind === 'not') return `${AUDIO}detective/${v}-ara.m4a`
  if (c.kind !== 'me') return undefined
  const o = p.options[c.opt]
  if (o.flag) return `${AUDIO}rc/c-${o.flag}-${v}.m4a`
  const k = JOBS.findIndex(j => j.geo === o.key)
  return k >= 0 ? `${AUDIO}rc/j${k}-${v}.m4a` : undefined
}

const whoOf = (p: Puzzle['people'][number]): Who => {
  const v = voiceOf(p.name)
  return { ru: p.ru, kind: v === 'f' ? 'woman' : 'man', coat: p.look.coat, skin: p.look.skin, hair: p.look.hair, extra: p.look.bag ? 'bag' : 'none', voice: v }
}

export default function Detective({ lesson, step, fraction, onExit, onDone, rng = Math.random }: SceneProps<StepOf<'detective'>>) {
  const mode = step.mode
  const [round, setRound] = useState(0)
  const cases = useMemo(() => makeCase(mode, lesson.id, rng), [round]) // eslint-disable-line react-hooks/exhaustive-deps
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro')
  const [i, setI] = useState(0)
  const [clean, setClean] = useState(0)
  useEffect(() => () => hush(), [])

  const title = mode === 'from' ? 'Кто откуда' : 'Кто кем работает'
  const solved = (firstTry: boolean) => {
    if (firstTry) setClean(c => c + 1)
    if (i + 1 >= PUZZLES) setPhase('end')
    else setI(i + 1)
  }

  return (
    <GameFrame title={title} eyebrow={phase === 'play' ? `подъезд ${i + 1} из ${PUZZLES}` : 'посылки для соседей'} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col" data-testid="detective-scene">
        {phase === 'intro' && (
          <GameIntro
            mood="think"
            title="Посылки для соседей"
            text={mode === 'from'
              ? 'Курьер оставил в подъезде три посылки из разных стран — а кому какая, не написал. Послушай, что говорят соседи, и раздай: нажми коробку, потом соседа. Не всё скажут прямо.'
              : 'Три посылки: учебники, аптечка и школьная доска. Кто из соседей студент, кто врач, а кто учитель? Послушай и раздай. Иногда говорят и про других.'}
            chips={mode === 'from' ? [{ geo: 'მე ვარ', ru: 'я' }, { geo: '-დან', ru: 'из' }] : [{ geo: 'მე ვარ', ru: 'я' }, { geo: 'ის არის', ru: 'он/она' }]}
            onStart={() => setPhase('play')}
          />
        )}
        {phase === 'play' && <Hall key={`${round}-${i}`} puzzle={cases[i]} mode={mode} last={i + 1 >= PUZZLES} onSolved={solved} lessonId={lesson.id} first={i === 0 && round === 0} />}
        {phase === 'end' && (
          <GameEnd
            title="Все посылки у хозяев"
            text={`${clean} из ${PUZZLES} ${plural(clean, 'подъезда', 'подъездов', 'подъездов')} — с первой попытки.`}
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

// ── Подъезд ───────────────────────────────────────────────────────────────────────────────────────

/** Где стоят соседи (центр, проценты сцены). */
const SPOTS = [22, 50, 78]
const bubbleAt = (k: number): React.CSSProperties =>
  k === 0 ? { left: '2%' } : k === 2 ? { right: '2%' } : { left: '50%', transform: 'translateX(-50%)' }

/** Ответ соседа на «ეს შენია?»: «კი!» — его посылка, «არა.» — не его. */
const answerAudio = (p: Puzzle['people'][number], mine: boolean) => {
  const v = voiceOf(p.name)
  return mine ? `${AUDIO}det2/${v}-ki.m4a` : `${AUDIO}detective/${v}-ara.m4a`
}

function Hall({ puzzle, mode, last, onSolved, lessonId, first }: {
  puzzle: Puzzle; mode: 'from' | 'jobs'; last: boolean; onSolved: (firstTry: boolean) => void; lessonId: number; first: boolean
}) {
  // Слова сцены: ამანათი — посылка, ეს შენია? — это твоё? В первом подъезде урока, где они впервые, — карточкой.
  const parcelWord = met(lessonId, 'amanati') ? phrase('amanati') : null
  const askWord = met(lessonId, 'es_shenia') ? phrase('es_shenia') : null
  const [fresh, setFresh] = useState<'amanati' | 'es_shenia' | null>(null)
  // Соседи по очереди отвечают на «ეს შენია?»: кто сейчас и что.
  const [answer, setAnswer] = useState<{ who: number; mine: boolean } | null>(null)
  const [asking, setAsking] = useState(false)
  const n = puzzle.people.length
  const [assign, setAssign] = useState<number[]>(() => Array(n).fill(-1))
  const [sel, setSel] = useState<number | null>(null)
  const [heard, setHeard] = useState(0)
  const [speaking, setSpeaking] = useState<number | null>(null)
  const [open, setOpen] = useState<number[]>([])
  const [hot, setHot] = useState<number | null>(null)
  const [wrong, setWrong] = useState<number[]>([])
  const [checks, setChecks] = useState(0)
  const [done, setDone] = useState(false)
  const [faces, setFaces] = useState<Face[]>(() => Array(n).fill('calm'))
  const [tip, setTip] = useState('Сначала послушай, что говорят соседи.')
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false; hush() }, [])
  const hidden = puzzle.level >= 3

  // Подслушиваем: реплика за репликой, с голосом говорящего; всё сказанное остаётся в списке.
  useEffect(() => {
    let off = false
    ;(async () => {
      await new Promise(r => setTimeout(r, 500))
      for (let k = 0; k < puzzle.clues.length; k++) {
        if (off || !alive.current) return
        const c = puzzle.clues[k]
        setSpeaking(k); sound.pop(k)
        await speakUrl(clueAudio(c, puzzle), clueGeo(c, puzzle))
        if (off || !alive.current) return
        setHeard(k + 1); setSpeaking(null)
        await new Promise(r => setTimeout(r, 250))
      }
      if (!off && alive.current) {
        setTip(hidden ? 'Голоса доносились с лестницы — кто говорил, узнай по лицу в списке. Раздай посылки.' : 'Раздай посылки: нажми коробку, потом соседа.')
        if (first && parcelWord && firstMet(lessonId, 'amanati')) setFresh('amanati')
      }
    })()
    return () => { off = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const listening = heard < puzzle.clues.length

  const tapParcel = (opt: number) => {
    if (done || listening || asking) return
    haptic('tap'); sound.pop(2)
    setSel(s => (s === opt ? null : opt))
  }
  const tapPerson = (who: number, el: HTMLElement) => {
    if (done || listening || asking) return
    if (sel === null) {
      // Посылку у соседа можно забрать обратно на пол.
      if (assign[who] >= 0) { haptic('soft'); setAssign(a => a.map((x, k) => (k === who ? -1 : x))) }
      else setTip('Сначала нажми коробку, потом соседа.')
      return
    }
    haptic('snap'); sound.snap(who)
    burst(el, 'small')
    const next = give(assign, who, sel)
    if (first && askWord && firstMet(lessonId, 'es_shenia') && next.every(a => a >= 0) && fresh !== 'es_shenia') setFresh('es_shenia')
    else if (fresh === 'amanati') setFresh(null)
    setAssign(next)
    setWrong(w => w.filter(x => x !== who))
    setSel(null)
  }

  /** Отдать посылки: спросить «ეს შენია?» — соседи по очереди отвечают «კი!» / «არა.», потом итог. */
  const ask = async (el: HTMLElement) => {
    if (asking) return
    if (!askWord) { check(el); return }
    setAsking(true); setFresh(null); haptic('tap')
    await speak('es_shenia', 'hero')
    for (let k = 0; k < n; k++) {
      if (!alive.current) return
      const mine = assign[k] === puzzle.solution[k]
      setAnswer({ who: k, mine })
      setFaces(f => f.map((x, j) => (j === k ? (mine ? 'smile' : 'huh') : x)))
      if (mine) haptic('soft')
      await speakUrl(answerAudio(puzzle.people[k], mine), mine ? 'კი!' : 'არა.')
    }
    if (!alive.current) return
    setAnswer(null); setAsking(false)
    check(el)
  }

  const check = (el: HTMLElement) => {
    const bad = wrongPeople(assign, puzzle.solution)
    setChecks(c => c + 1)
    if (!bad.length) {
      haptic('good'); sound.win(); burst(el, 'big')
      setDone(true); setWrong([]); setHot(null); setFaces(Array(n).fill('wow'))
      setTip(last ? 'Все посылки у хозяев!' : 'Все довольны! В следующем подъезде будет хитрее.')
      return
    }
    haptic('bad'); sound.miss()
    // Чужие посылки соседи возвращают — коробки отлетают на пол.
    setWrong(bad)
    setFaces(f => f.map((x, k) => (bad.includes(k) ? 'huh' : x)))
    window.setTimeout(() => {
      if (!alive.current) return
      setAssign(a => a.map((x, k) => (bad.includes(k) ? -1 : x)))
      setFaces(Array(n).fill('calm'))
    }, 700)
    const row = bad[0]
    const k = clueFor(row, puzzle.clues)
    const who = puzzle.people[row].ru
    setHot(k); if (k !== null) window.setTimeout(() => alive.current && setHot(h => (h === k ? null : h)), 1800)
    setTip(k === null
      ? `${who}: «Это не моя!» Про ${who} прямо никто не сказал — исключи то, что уже занято.`
      : `${who}: «Это не моя!» Перечитай подсвеченную реплику.`)
  }

  const reveal = () => {
    haptic('pop')
    setAssign([...puzzle.solution]); setDone(true); setWrong([]); setFaces(Array(n).fill('smile'))
    setTip('Вот как было. Сравни с репликами — в следующем подъезде получится.')
  }

  const allGiven = assign.every(a => a >= 0)
  const onFloor = puzzle.options.map((_, o) => o).filter(o => !assign.includes(o))

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2" data-testid="detective-board">
      <div className="relative shrink-0 h-[262px] ab-short:h-[214px] rounded-2xl border-[1.5px] border-jewelInk overflow-hidden" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="detective-hall">
        <Entrance />
        {puzzle.people.map((p, k) => {
          const isSpeaker = speaking !== null && speakerOf(puzzle.clues[speaking]) === k
          return (
            <button key={p.name} type="button" data-testid={`person-${k}`} onClick={e => tapPerson(k, e.currentTarget)}
              className={`absolute bottom-[4%] -translate-x-1/2 flex flex-col items-center rounded-xl ${sel !== null && !done ? 'ring-2 ring-gold/80 ring-offset-1 ring-offset-transparent' : ''}`}
              style={{ left: `${SPOTS[k]}%` }} aria-label={p.ru}>
              <motion.div animate={wrong.includes(k) ? { x: [0, -6, 6, -4, 4, 0] } : done ? { y: [0, -8, 0] } : { x: 0, y: 0 }}
                transition={{ duration: 0.5, delay: done ? k * 0.08 : 0 }}>
                <svg width="96" height="152" viewBox="-60 -190 120 196" className="overflow-visible" aria-hidden>
                  <Passerby who={whoOf(p)} phase={0} stride={0} face={faces[k]} talking={isSpeaker && !hidden} wave={false} />
                </svg>
              </motion.div>
              {/* Посылка в руках. */}
              <AnimatePresence>
                {assign[k] >= 0 && (
                  <motion.div key={assign[k]} className="absolute bottom-[34px]" data-testid={`held-${k}`} data-opt={assign[k]}
                    initial={{ y: 70, scale: 0.6, opacity: 0, rotate: -12 }} animate={{ y: 0, scale: 1, opacity: 1, rotate: 0 }} exit={{ y: 60, opacity: 0, rotate: 20 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 16 }}>
                    <Parcel option={puzzle.options[assign[k]]} mode={mode} small />
                  </motion.div>
                )}
              </AnimatePresence>
              <span className="mt-0.5 rounded-md border-[1.5px] border-jewelInk bg-cream-tile px-1.5 leading-tight text-center" data-testid={`name-${k}`}>
                <span className="block font-geo font-extrabold text-[12px]">{p.name}</span>
                <span className="block text-[9.5px] font-semibold text-jewelInk-hint">{cyr(p.name)}</span>
              </span>
            </button>
          )
        })}
        {/* Реплика прямо сейчас — над говорящим (или с лестницы, если не видно кто). */}
        <AnimatePresence>
          {speaking !== null && (
            // Пузырь над говорящим, но не за краем сцены: у крайних соседей прижат к своему краю.
            <div key={`s${speaking}`} className="absolute z-20 top-[5%] pointer-events-none"
              style={bubbleAt(hidden ? 1 : speakerOf(puzzle.clues[speaking]))}>
              <motion.div initial={{ opacity: 0, scale: 0.6, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                className="rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-2.5 py-1 text-center whitespace-nowrap" style={{ boxShadow: '2px 3px 0 #15100A' }} data-testid="detective-speaking">
                {puzzle.clues[speaking].kind === 'not' && <span className="block text-[10.5px] font-semibold text-navy">— Ты {puzzle.options[puzzle.clues[speaking].opt].ask}?</span>}
                <span className="block font-geo font-bold text-[15px] leading-tight">{clueGeo(puzzle.clues[speaking], puzzle)}</span>
                <span className="block text-[10.5px] font-semibold text-jewelInk-hint leading-tight">{cyr(clueGeo(puzzle.clues[speaking], puzzle))}</span>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Ответ на «ეს შენია?» — над тем, кто отвечает. */}
        <AnimatePresence>
          {answer && (
            <div key={`a${answer.who}`} className="absolute z-20 top-[8%] pointer-events-none" style={bubbleAt(answer.who)}>
              <motion.div initial={{ opacity: 0, scale: 0.5, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 460, damping: 20 }} data-testid="detective-answer" data-mine={answer.mine ? 'yes' : 'no'}
                className={`rounded-2xl border-[1.5px] border-jewelInk px-3 py-1 text-center ${answer.mine ? 'bg-[#D6E9D9]' : 'bg-ruby-wash'}`} style={{ boxShadow: '2px 3px 0 #15100A' }}>
                <span className="block font-geo font-bold text-[16px] leading-tight">{answer.mine ? 'კი!' : 'არა.'}</span>
                <span className="block text-[10.5px] font-semibold text-jewelInk-hint leading-tight">{answer.mine ? 'ки · да!' : 'ара · нет'}</span>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Подслушанное — остаётся перед глазами. */}
      <div className="shrink-0 flex flex-col gap-1" data-testid="clues">
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-jewelInk-hint">{hidden ? 'Подслушано с лестницы' : 'Подслушано'} · {puzzle.clues.length} {plural(puzzle.clues.length, 'реплика', 'реплики', 'реплик')}</div>
        {puzzle.clues.slice(0, heard).map((c, k) => (
          <ClueLine key={k} clue={c} puzzle={puzzle} hot={hot === k} open={open.includes(k)} hidden={hidden}
            onToggle={() => setOpen(o => (o.includes(k) ? o.filter(x => x !== k) : [...o, k]))} />
        ))}
        {listening && <div className="zn-dots pl-10 py-1" aria-label="кто-то говорит"><i /><i /><i /></div>}
      </div>

      {/* Коробки на полу. */}
      <div className="relative shrink-0 flex justify-center gap-3 min-h-[74px] items-end" data-testid="parcels">
        <AnimatePresence>
          {onFloor.map(o => (
            <motion.button key={o} type="button" layout data-testid={`parcel-${o}`} onClick={() => tapParcel(o)} disabled={done || listening}
              initial={{ y: -40, opacity: 0, rotate: 10 }} animate={{ y: sel === o ? -10 : 0, opacity: listening ? 0.5 : 1, rotate: sel === o ? -4 : 0, scale: sel === o ? 1.08 : 1 }}
              exit={{ y: -60, opacity: 0, scale: 0.6 }} whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 380, damping: 20 }}>
              <Parcel option={puzzle.options[o]} mode={mode} lifted={sel === o} />
            </motion.button>
          ))}
        </AnimatePresence>
        {!onFloor.length && !done && <div className="text-[12px] font-bold text-jewelInk-hint pb-6">Все коробки розданы</div>}
      </div>

      {/* Подсказка; рядом — слово сцены: впервые — карточкой «новое слово», потом — подписью. */}
      <div className="shrink-0 flex items-stretch gap-2">
        {fresh
          ? <NewWord key={fresh} word={phrase(fresh)} className="shrink-0" />
          : parcelWord && <WordTag word={parcelWord} className="shrink-0 self-center" testId="amanati-tag" />}
        <div className="flex-1 min-h-[36px] rounded-xl border-[1.5px] border-dashed border-jewelInk-faint bg-gold-wash/70 px-3 py-1.5 text-[13px] leading-snug text-jewelInk-soft" aria-live="polite" data-testid="detective-tip">{tip}</div>
      </div>
      {done ? (
        <Button onClick={() => onSolved(checks === 1)}>{last ? 'Готово' : 'Следующий подъезд'}</Button>
      ) : (
        <div className="flex gap-2">
          {checks >= 3 && <div className="flex-1"><Button variant="ghost" onClick={reveal}>Показать</Button></div>}
          <div className="flex-[2]">
            <motion.button type="button" data-testid="detective-check" disabled={!allGiven || asking} onClick={e => void ask(e.currentTarget)}
              className="jewel-btn bg-navy text-cream w-full disabled:opacity-50" animate={{ scale: allGiven ? [1, 1.04, 1] : 1 }} transition={{ duration: 0.4 }}>
              <span className="relative z-[1]">{askWord ? <>Отдать: <span className="font-geo">{askWord.geo}</span></> : 'Отдать посылки'}</span>
            </motion.button>
          </div>
        </div>
      )}
    </div>
  )
}

function ClueLine({ clue, puzzle, hot, open, hidden, onToggle }: { clue: Clue; puzzle: Puzzle; hot: boolean; open: boolean; hidden: boolean; onToggle: () => void }) {
  const who = puzzle.people[speakerOf(clue)]
  const geo = clueGeo(clue, puzzle)
  return (
    <motion.button type="button" onClick={onToggle} data-testid="clue" data-hot={hot ? 'yes' : 'no'}
      initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: hot ? [0, -6, 6, -4, 4, 0] : 0, backgroundColor: hot ? '#F7DCDD' : '#FDFAEF' }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className="flex items-center gap-2 rounded-xl border-[1.5px] border-jewelInk px-2 py-1 text-left" style={{ boxShadow: '2px 2px 0 #15100A' }}>
      <span className="shrink-0 w-8 h-8 rounded-full border-[1.5px] border-jewelInk overflow-hidden bg-cream-deep flex items-start justify-center">
        <svg width="40" height="64" viewBox="-60 -190 120 196" style={{ marginTop: -2 }} aria-hidden>
          <g transform="translate(0 70) scale(1.6)"><Passerby who={whoOf(who)} phase={0} stride={0} face={clue.kind === 'not' ? 'huh' : 'smile'} talking={false} wave={false} /></g>
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10.5px] font-bold text-jewelInk-hint leading-tight">
          {hidden ? 'кто-то с лестницы' : <span className="font-geo">{who.name}</span>}
          {clue.kind === 'not' && <> · на вопрос «Ты {puzzle.options[clue.opt].ask}?»</>}
        </span>
        <span className="block font-geo font-bold text-[14px] leading-tight">{geo}</span>
        <span className="block text-[10.5px] font-semibold text-jewelInk-hint leading-tight">{open ? clueRu(clue, puzzle) : cyr(geo)}</span>
      </span>
    </motion.button>
  )
}

/** Коробка: перевязана бечёвкой, на наклейке — флаг страны или значок профессии. */
function Parcel({ option, mode, small, lifted }: { option: Option; mode: 'from' | 'jobs'; small?: boolean; lifted?: boolean }) {
  const w = small ? 46 : 68
  return (
    <div className="relative flex flex-col items-center" style={{ width: w }}>
      <div className="relative w-full rounded-lg border-[1.5px] border-jewelInk bg-[#D9A86A]" style={{ height: small ? 34 : 50, boxShadow: lifted ? '4px 8px 0 rgba(21,16,10,0.35)' : '2px 2px 0 #15100A' }}>
        <span className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-[#8A5A33]" />
        <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 bg-[#8A5A33]" />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border-[1.5px] border-jewelInk bg-cream px-0.5 py-0.5 flex items-center justify-center">
          {mode === 'from' && option.flag ? <Flag code={option.flag} size={small ? 18 : 26} /> : <JobIcon job={JOBS.find(j => j.geo === option.key)!} size={small ? 16 : 22} />}
        </span>
      </div>
      {!small && <span className="mt-0.5 text-[10.5px] font-bold text-jewelInk-soft leading-tight text-center">{option.ru}</span>}
    </div>
  )
}

/** Подъезд батумского дома: плитка, почтовые ящики, лестница, дверь с витражом, растение. */
function Entrance() {
  const INK = '#15100A'
  return (
    <svg viewBox="0 0 360 248" preserveAspectRatio="xMidYMax slice" width="100%" height="100%" className="absolute inset-0" aria-hidden>
      <rect width="360" height="248" fill="#E9DCC4" />
      <rect y="0" width="360" height="110" fill="#D7E4DA" />
      <path d="M0 110 H360" stroke={INK} strokeWidth="1.4" />
      {/* Почтовые ящики. */}
      <g>
        <rect x="14" y="26" width="96" height="62" rx="4" fill="#4E8A5B" stroke={INK} strokeWidth="2" />
        {[0, 1, 2].map(r => [0, 1, 2].map(c => (
          <g key={`${r}${c}`}>
            <rect x={20 + c * 30} y={32 + r * 18} width="26" height="14" rx="2" fill="#5E9C5F" stroke={INK} strokeWidth="1.2" />
            <path d={`M${24 + c * 30} ${36 + r * 18} h18`} stroke={INK} strokeWidth="1.4" />
          </g>
        )))}
      </g>
      {/* Лестница наверх. */}
      <g>
        {[0, 1, 2, 3, 4, 5].map(k => <rect key={k} x={250 + k * 14} y={90 - k * 12} width={110 - k * 14} height="12" fill="#C9B79A" stroke={INK} strokeWidth="1.2" />)}
        <path d="M244 104 L340 30" stroke="#7A4E2D" strokeWidth="4" />
        {[0, 1, 2, 3, 4].map(k => <path key={k} d={`M${250 + k * 20} ${100 - k * 15.5} v-16`} stroke="#7A4E2D" strokeWidth="2" />)}
      </g>
      {/* Дверь с витражом. */}
      <g>
        <rect x="140" y="18" width="70" height="92" rx="4" fill="#7A4E2D" stroke={INK} strokeWidth="2" />
        <path d="M148 60 V34 a27 22 0 0 1 54 0 V60 Z" fill="#9CC6EE" stroke={INK} strokeWidth="1.6" />
        <path d="M175 12 V60 M148 42 H202" stroke={INK} strokeWidth="1.2" />
        <path d="M152 50 l10 -10 l10 10 Z" fill="#F5B820" opacity="0.8" /><path d="M180 50 l10 -10 l10 10 Z" fill="#E01A3C" opacity="0.7" />
        <circle cx="200" cy="80" r="2.4" fill="#F5B820" stroke={INK} strokeWidth="1" />
      </g>
      {/* Плитка «шахматкой» в перспективе. */}
      {Array.from({ length: 5 }, (_, r) => Array.from({ length: 12 }, (_, c) => {
        const y0 = 110 + r * 28, h = 28
        const x0 = c * 30 - 6 * r, w = 30 + r * 1
        return (r + c) % 2 === 0 ? <rect key={`${r}-${c}`} x={x0} y={y0} width={w} height={h} fill="#D2C0A2" /> : null
      }))}
      {/* Растение в кадке у двери. */}
      <g>
        <rect x="222" y="84" width="18" height="26" rx="3" fill="#C2553A" stroke={INK} strokeWidth="1.6" />
        {[-40, -10, 20, 45].map((a, k) => { const r = ((a - 90) * Math.PI) / 180; return <path key={k} d={`M231 84 q${Math.cos(r) * 10} ${Math.sin(r) * 14} ${Math.cos(r) * 24} ${Math.sin(r) * 24}`} stroke="#4E8A5B" strokeWidth="5" fill="none" strokeLinecap="round" /> })}
      </g>
    </svg>
  )
}
