import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import GameFrame from '../../alphabet/games/GameFrame'
import { burst, haptic, sound } from '../../alphabet/games/fx'
import { useLater } from '../../verbs/games/useLater'
import Button from '../../components/Button'
import { phrase } from '../story'
import { GameEnd, GameIntro, Pill, Reply, RuleCard, Tip, type Look, type Mood } from '../ui'
import { cyr } from '../../verbs/types'
import { hush, speak, speakUrl } from '../voice'
import Passerby from './walk/Passerby'
import Portrait, { whoOf } from './family/Portrait'
import DragPhoto from './family/DragPhoto'
import type { SceneProps, StepOf } from './types'
import {
  ROLES, SHOW_AFTER, albumPages, albumScore, familyLooks, familyRounds, familyTree, geoOf, missReaction, ownStatements, thisIs, treeRoles,
  type FamilyMode, type Role, type SlotRole, type Tree
} from './Family.logic'

/**
 * «Семейный альбом». Соседка Нино показывает семью: на доске — дерево из пустых рамок (силуэты и линии
 * родства, без подписей), фото приходят по одному, хозяин альбома говорит «ეს არის …», а ты кладёшь фото
 * в нужную рамку (перетащить или нажать на рамку). Подпись рамки открывается только после верного хода.
 * Промах — смешная реакция и подсказка; после двух промахов нужная рамка подсвечивается.
 * Режим album (повторение): страницы альбома, «ვინ არის ეს?» — выбрать слово из трёх; в конце — своя страница.
 */

const SHADOW = { boxShadow: '3px 3px 0 #15100A' }

/** Слово семьи голосом хозяина альбома: Нино и Ана — женским, Гиорги и Давити — мужским. */
function sayWord(r: Role, female: boolean) {
  if (female) void speak(ROLES[r].pid, 'f')
  else void speakUrl(`/audio/intro-story/family/m-${ROLES[r].pid}.m4a`, geoOf(r))
}

const MOOD_FACE: Record<Mood, 'smile' | 'huh' | 'wow' | 'calm'> = { smile: 'smile', sad: 'calm', huh: 'huh', wow: 'wow' }

// ── Доска ────────────────────────────────────────────────────────────────────────────────────────

function Silhouette({ female, age, h = 46 }: { female: boolean; age: 'old' | 'adult' | 'kid'; h?: number }) {
  const kid = age === 'kid'
  return (
    <svg viewBox="0 0 40 48" height={h} width={h * 40 / 48} aria-hidden>
      <g transform={kid ? 'translate(7 12) scale(0.66)' : undefined} fill="#D8CBB0" stroke="#7A6B52" strokeWidth="1.4" strokeDasharray="3 2">
        {female && <path d="M9 18 Q8 34 12 38 L28 38 Q32 34 31 18 Q30 6 20 6 Q10 6 9 18Z" fill="#BFAE8C" strokeDasharray="none" />}
        <path d="M5 48 Q5 32 20 31 Q35 32 35 48Z" />
        <circle cx="20" cy="18" r="10" />
        {age === 'old' && <path d="M14 20 h5 M21 20 h5" strokeDasharray="none" />}
      </g>
    </svg>
  )
}

interface BoardProps {
  tree: Tree
  filled: Partial<Record<Role, boolean>>
  looks: Record<Role, Look>
  ownerLook: Look
  ownerRu: string
  onFrame?: (r: Role, el: HTMLElement) => void
  glow?: Role | null
  bad?: Role | null
  focus?: Role | null
  /** Рамка, к которой сейчас тянут фото. */
  near?: string | null
  labels?: boolean
  className?: string
  boardRef?: React.RefObject<HTMLDivElement>
}

function Board({ tree, filled, looks, ownerLook, ownerRu, onFrame, glow, bad, focus, near, labels = true, className = 'flex-1 min-h-[180px]', boardRef }: BoardProps) {
  const rowH = 100 / tree.rows
  const pos = (r: SlotRole) => tree.slots.find(s => s.role === r)
  const y = (row: number) => (row + 0.5) * rowH
  const lines: React.ReactNode[] = []
  const ln = (key: string, x1: number, y1: number, x2: number, y2: number) =>
    lines.push(<line key={key} x1={x1} y1={y1} x2={x2} y2={y2} vectorEffect="non-scaling-stroke" />)
  tree.couples.forEach(([a, b], k) => {
    const pa = pos(a), pb = pos(b)
    if (pa && pb) ln(`c${k}`, pa.x * 100, y(pa.row), pb.x * 100, y(pb.row))
  })
  tree.kids.forEach((g, k) => {
    const pa = pos(g.parents[0]), pb = pos(g.parents[1])
    if (!pa || !pb) return
    const mx = (pa.x + pb.x) / 2 * 100, py = y(pa.row), bus = py + rowH / 2
    const xs = g.kids.map(c => pos(c)!.x * 100)
    ln(`d${k}`, mx, py, mx, bus)
    ln(`b${k}`, Math.min(mx, ...xs), bus, Math.max(mx, ...xs), bus)
    g.kids.forEach((c, j) => ln(`k${k}-${j}`, pos(c)!.x * 100, bus, pos(c)!.x * 100, y(pos(c)!.row)))
  })
  return (
    // Стена с обоями: рамки висят на гвоздиках, родство — красной ниткой между ними.
    <div ref={boardRef} className={`relative w-full rounded-2xl border-[1.5px] border-jewelInk overflow-hidden ${className}`} data-testid="family-board"
      style={{ boxShadow: '3px 3px 0 #15100A', background: 'repeating-linear-gradient(90deg, #F4E3C8 0 22px, #EFDCBD 22px 24px)' }}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <g stroke="#C2553A" strokeWidth="2" fill="none" strokeLinecap="round">{lines}</g>
      </svg>
      {tree.slots.map(s => {
        const style: React.CSSProperties = { left: `${s.x * 100}%`, top: `${y(s.row)}%`, transform: 'translate(-50%, -50%)' }
        if (s.role === 'ego') {
          return (
            <div key="ego" style={style} className="absolute w-[60px] ab-short:w-[52px] rounded-lg border-[3px] border-[#C68F10] bg-gold-wash flex flex-col items-center pt-0.5 overflow-hidden" data-testid="frame-ego">
              <Portrait look={ownerLook} size={50} />
              <div className="w-full bg-cream-tile border-t-[1.5px] border-jewelInk text-[10px] font-extrabold leading-[14px] text-center truncate">{ownerRu}</div>
            </div>
          )
        }
        const r = s.role, info = ROLES[r], done = !!filled[r]
        return (
          // Снаружи — место на стене (translate), внутри — пружина: transform анимации не сбивает центровку.
          <div key={r} style={style} className="absolute">
          <motion.div animate={{ scale: near === r ? 1.14 : 1 }} transition={{ type: 'spring', stiffness: 420, damping: 18 }}>
          <button data-frame={r} data-testid={`frame-${r}`} data-filled={done ? 'yes' : 'no'}
            disabled={done || !onFrame}
            onClick={e => onFrame?.(r, e.currentTarget)}
            className={`relative w-[60px] ab-short:w-[52px] min-h-[46px] rounded-lg flex flex-col items-center pt-0.5 overflow-hidden transition-colors
              ${done ? 'border-[3px] border-[#8A5A33] bg-[#FDFAEF] zn-pop' : near === r ? 'border-[3px] border-[#4E8A5B] bg-[#D6E9D9]' : 'border-[2px] border-dashed border-[#8A5A33]/60 bg-[#F6EEDC]/80'}
              ${glow === r ? 'ring-4 ring-gold' : ''} ${focus === r ? 'ring-4 ring-navy' : ''} ${bad === r ? 'zn-shake bg-ruby-wash' : ''}`}>
            {done ? <Portrait look={looks[r]} female={info.female} size={50} face={focus === r ? 'wow' : 'smile'} /> : <Silhouette female={info.female} age={info.age} />}
            <div className={`w-full border-t-[1.5px] text-[9px] font-extrabold leading-[11px] py-[1px] text-center whitespace-normal ${done ? 'border-jewelInk bg-[#D6E9D9]' : 'border-transparent text-transparent'}`}>
              {done && labels ? info.label : '\u00A0'}
            </div>
          </button>
          </motion.div>
          </div>
        )
      })}
    </div>
  )
}

// ── Раскладка фото по рамкам ─────────────────────────────────────────────────────────────────────

interface Feedback { tone: 'good' | 'bad' | 'trap' | 'dodged'; text: string }

function Placing({ mode, lessonId, rng, onEnd }: {
  mode: Exclude<FamilyMode, 'album'>; lessonId: number; rng: () => number; onEnd: (r: { first: number; total: number; trap: boolean | null }) => void
}) {
  const tree = useMemo(() => familyTree(mode, lessonId), [mode, lessonId])
  const rounds = useMemo(() => familyRounds(mode, lessonId, rng), [mode, lessonId]) // eslint-disable-line react-hooks/exhaustive-deps
  const [ri, setRi] = useState(0)
  const [ci, setCi] = useState(0)
  const [filled, setFilled] = useState<Partial<Record<Role, boolean>>>({})
  const [misses, setMisses] = useState(0)
  const [bad, setBad] = useState<Role | null>(null)
  const [fb, setFb] = useState<Feedback | null>(null)
  const [busy, setBusy] = useState(false)
  const [roundDone, setRoundDone] = useState(false)
  const first = useRef(0)
  const trap = useRef<boolean | null>(null)
  const later = useLater()
  const round = rounds[ri]
  const photo: Role | undefined = round.order[ci]
  const total = rounds.reduce((n, r) => n + r.order.length, 0)
  const female = (k: number) => !!rounds[k].ownerLook.long
  const [talking, setTalking] = useState(false)
  const [near, setNear] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const boardRef = useRef<HTMLDivElement>(null)
  const voice = (r: Role, k: number) => { setTalking(true); sayWord(r, female(k)); later(() => setTalking(false), 900) }
  useEffect(() => { if (rounds[0].order[0]) voice(rounds[0].order[0], 0) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => hush(), [])

  /** true — фото легло в рамку. */
  const place = (frame: Role, el?: HTMLElement | null): boolean => {
    if (!photo || busy || roundDone) return false
    const isTrap = mode === 'parents' && ri === 0 && photo === 'mama'
    if (frame === photo) {
      haptic('good'); sound.snap(ci)
      if (el) burst(el, 'small')
      if (misses === 0) first.current++
      if (isTrap && trap.current === null) trap.current = misses === 0
      setFilled(f => ({ ...f, [frame]: true }))
      setFb(isTrap
        ? { tone: misses === 0 ? 'dodged' : 'good', text: misses === 0 ? 'Ловушку обошёл! მამა звучит как «мама», а значит «папа».' : 'Вот так: მამა — папа. Запомни, это главная ловушка.' }
        : { tone: 'good', text: `${geoOf(photo)} — ${ROLES[photo].ru}. ${misses === 0 ? 'С первого раза!' : 'Есть!'}` })
      setMisses(0); setBusy(true)
      later(() => {
        setBusy(false)
        if (ci + 1 < round.order.length) { setCi(ci + 1); voice(round.order[ci + 1], ri) }
        else { setRoundDone(true); sound.win() }
      }, 650)
      return true
    } else {
      haptic('bad'); sound.miss()
      if (isTrap) trap.current = false
      setMisses(m => m + 1)
      setBad(frame); later(() => setBad(null), 420)
      setFb({ tone: isTrap ? 'trap' : 'bad', text: missReaction(photo, frame) })
      setShake(k => k + 1)
      return false
    }
  }

  const nextRound = () => {
    haptic('pop')
    if (ri + 1 < rounds.length) {
      setRi(ri + 1); setCi(0); setFilled({}); setRoundDone(false); setFb(null)
      voice(rounds[ri + 1].order[0], ri + 1)
    } else onEnd({ first: first.current, total, trap: trap.current })
  }

  const mood: Mood = fb?.tone === 'bad' || (fb?.tone === 'trap' && misses > 0) ? 'wow' : 'smile'
  const glow = photo && misses >= SHOW_AFTER ? photo : null

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2" data-testid="family-play">
      <div className="flex items-center gap-2">
        <Pill testId="family-round">{rounds.length > 1 ? `альбом ${ri + 1} из ${rounds.length}` : 'альбом Нино'}</Pill>
        <div className="flex-1" />
        <Pill testId="family-score">★ {first.current}</Pill>
      </div>

      <div className="flex items-end gap-2 min-h-[84px]">
        <svg width="62" height="96" viewBox="-50 -196 100 202" className="shrink-0 overflow-visible" aria-hidden>
          <Passerby who={whoOf(round.ownerLook)} phase={0} stride={0} face={MOOD_FACE[mood]} talking={talking} wave={roundDone} />
        </svg>
        <motion.div key={`${ri}-${ci}-${roundDone}`} className={`mb-6 rounded-2xl border-[1.5px] border-jewelInk px-3 py-1.5 ${roundDone ? 'bg-[#D6E9D9]' : 'bg-cream-tile'}`}
          style={{ boxShadow: '2px 3px 0 #15100A', transformOrigin: '0% 100%' }}
          initial={{ opacity: 0, scale: 0.6, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 24 }}>
          {roundDone
            ? <span className="text-[13px] font-bold">Вся семья на месте!</span>
            : photo && <span data-testid="family-say" className="block">
              <span className="block font-geo font-extrabold text-[18px] leading-tight">{thisIs(photo)}</span>
              <span className="block text-[11px] font-semibold text-jewelInk-hint">{cyr(thisIs(photo))}</span>
            </span>}
        </motion.div>
        {(fb?.tone === 'trap' || fb?.tone === 'dodged') && (
          <span key={fb.text} data-testid="family-trap"
            className={`zn-stamp ml-auto mb-3 shrink-0 rounded-lg border-2 bg-cream-tile px-2 py-0.5 text-[12px] font-extrabold uppercase tracking-wide ${fb.tone === 'trap' ? 'border-ruby text-ruby' : 'border-navy text-navy'}`}>
            {fb.tone === 'trap' ? 'ловушка!' : 'обошёл'}
          </span>
        )}
      </div>

      <Board tree={tree} filled={filled} looks={round.looks} ownerLook={round.ownerLook} ownerRu={round.ownerRu} boardRef={boardRef} near={near}
        onFrame={roundDone ? undefined : (r, el) => { place(r, el) }} glow={glow} bad={bad} />

      <div className="shrink-0 min-h-[92px] ab-short:min-h-[80px] flex items-center gap-3">
        {roundDone ? (
          <div className="w-full zn-pop">
            <Button onClick={nextRound}>{ri + 1 < rounds.length ? `Альбом: ${rounds[ri + 1].ownerRu}` : 'Готово'}</Button>
          </div>
        ) : photo && (
          <>
            <DragPhoto key={`${ri}-${ci}`} board={boardRef} disabled={busy} shake={shake} onNear={setNear}
              onDrop={(r, el) => place(r as Role, el)}>
              <div className="w-[64px] h-[64px] rounded bg-gold-wash flex items-end justify-center overflow-hidden"><Portrait look={round.looks[photo]} female={ROLES[photo].female} size={64} /></div>
            </DragPhoto>
            <div className="text-[13px] leading-snug text-jewelInk-soft">
              Кого показывают? Тащи фото в рамку — или просто нажми на рамку.
            </div>
          </>
        )}
      </div>

      <Tip>
        {fb
          ? <span className={fb.tone === 'trap' ? 'font-extrabold text-ruby' : fb.tone === 'dodged' ? 'font-extrabold text-navy' : fb.tone === 'bad' ? 'font-bold' : ''} data-testid="family-feedback">{fb.text}</span>
          : mode === 'parents' ? 'Осторожно: одно слово тут звучит не так, как кажется.' : mode === 'siblings' ? 'Помни: და бывает не только «и».' : 'Смотри на линии: кто чей муж, жена и дети.'}
      </Tip>
    </div>
  )
}

// ── Альбом-повторение ─────────────────────────────────────────────────────────────────────────────

function Album({ lessonId, rng, onEnd }: { lessonId: number; rng: () => number; onEnd: (r: { score: number; best: number; right: number; total: number; own: string[] }) => void }) {
  const tree = useMemo(() => familyTree('album', lessonId), [lessonId])
  const pages = useMemo(() => albumPages(lessonId, rng), [lessonId]) // eslint-disable-line react-hooks/exhaustive-deps
  const looks = useMemo(() => familyLooks(rng), []) // eslint-disable-line react-hooks/exhaustive-deps
  const ninoLook = useMemo<Look>(() => ({ coat: '#E01A3C', skin: '#F2C9A0', hair: '#2A1F18', long: true }), [])
  const statements = useMemo(() => ownStatements(lessonId), [lessonId])
  const [pi, setPi] = useState(0)
  const [wrong, setWrong] = useState<Role[]>([])
  const [ok, setOk] = useState(false)
  const [results, setResults] = useState<boolean[]>([])
  const [fb, setFb] = useState('')
  const [own, setOwn] = useState<string[] | null>(null)
  const later = useLater()
  const page = pages[pi]
  useEffect(() => { if (page) void speak('vin_aris', 'f') }, [pi]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => hush(), [])
  const { score, best } = albumScore(results)
  let streak = 0
  for (let k = results.length - 1; k >= 0 && results[k]; k--) streak++

  const filled = useMemo(() => {
    const f: Partial<Record<Role, boolean>> = {}
    for (const r of treeRoles(tree)) f[r] = true
    return f
  }, [tree])

  if (!page) {
    // Последняя страница — твоя семья.
    const chosen = own ?? []
    const toggle = (id: string) => { haptic('tap'); sound.snap(chosen.length); setOwn(chosen.includes(id) ? chosen.filter(x => x !== id) : [...chosen, id]) }
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-2" data-testid="family-own">
        <div className="flex items-end gap-2">
          <svg width="52" height="80" viewBox="-50 -196 100 202" className="shrink-0 overflow-visible" aria-hidden>
            <Passerby who={whoOf(ninoLook)} phase={0} stride={0} face="smile" talking={false} wave />
          </svg>
          <div className="mb-5 rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-3 py-1.5 text-[13px]" style={{ boxShadow: '2px 3px 0 #15100A' }}>Последняя страница — твоя. Кто есть у тебя? Выбери, что про тебя правда.</div>
        </div>
        <div className="flex-1 min-h-0 grid grid-cols-2 gap-1.5 content-start overflow-hidden">
          {statements.map(s => (
            <Reply key={s.id} geo={s.geo} hint={s.ru} compact onClick={() => toggle(s.id)} state={chosen.includes(s.id) ? 'good' : 'idle'} testId={`own-${s.id}`} />
          ))}
        </div>
        <Button onClick={() => { haptic('pop'); onEnd({ score, best, right: results.filter(Boolean).length, total: pages.length, own: chosen }) }}>
          {chosen.length ? 'Вклеить в альбом' : 'Пропустить страницу'}
        </Button>
      </div>
    )
  }

  const choose = (r: Role) => {
    if (ok) return
    if (r === page.role) {
      haptic('good'); sound.snap(streak); void speak(ROLES[r].pid, 'hero')
      const first = wrong.length === 0
      setResults(x => [...x, first])
      setOk(true)
      setFb(first && streak + 1 >= 3 ? `Серия ${streak + 1}! Очки удваиваются.` : `Да, ეს არის ${geoOf(r)} — ${ROLES[r].label}.`)
      later(() => { setPi(pi + 1); setWrong([]); setOk(false); setFb('') }, 900)
    } else {
      haptic('bad'); sound.miss()
      setWrong(w => [...w, r])
      setFb(missReaction(r, page.role))
    }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2" data-testid="family-album">
      <div className="flex items-center gap-2">
        <Pill>страница {pi + 1} из {pages.length + 1}</Pill>
        <div className="flex-1" />
        <Pill testId="album-streak">серия {streak}</Pill>
        <Pill testId="album-score">★ {score}</Pill>
      </div>
      <div className="flex items-end gap-2">
        <svg width="56" height="88" viewBox="-50 -196 100 202" className="shrink-0 overflow-visible" aria-hidden>
          <Passerby who={whoOf(ninoLook)} phase={0} stride={0} face={wrong.length && !ok ? 'huh' : 'smile'} talking={false} wave={ok} />
        </svg>
        <motion.div key={pi} className="mb-6 rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-3 py-1.5" style={{ boxShadow: '2px 3px 0 #15100A', transformOrigin: '0% 100%' }}
          initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 24 }}>
          <span className="block font-geo font-extrabold text-[18px] leading-tight">{phrase('vin_aris').geo}</span>
          <span className="block text-[11px] font-semibold text-jewelInk-hint">{cyr(phrase('vin_aris').geo)}</span>
        </motion.div>
      </div>
      <Board tree={tree} filled={filled} looks={looks} ownerLook={ninoLook} ownerRu="Нино" focus={page.role} labels={false} />
      <div className="grid grid-cols-3 gap-2" data-testid="album-options">
        {page.options.map(r => {
          const state = ok && r === page.role ? 'good' : wrong.includes(r) ? 'bad' : 'idle'
          return (
            <motion.button key={`${pi}-${r}`} data-testid={r === page.role ? 'album-right' : `album-wrong-${r}`} disabled={wrong.includes(r) || ok}
              onClick={() => { haptic('tap'); choose(r) }}
              className="min-h-[52px] rounded-2xl border-[1.5px] border-jewelInk px-1 py-1 text-center"
              style={{ boxShadow: '3px 3px 0 #15100A' }}
              animate={{ backgroundColor: state === 'good' ? '#D6E9D9' : state === 'bad' ? '#F7DCDD' : '#FDFAEF', opacity: state === 'bad' ? 0.6 : 1, x: state === 'bad' ? [0, -6, 6, -3, 0] : 0 }}
              whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
              <span className="block font-geo font-bold leading-tight" style={{ fontSize: geoOf(r).length > 6 ? 13.5 : 17 }}>{geoOf(r)}</span>
              <span className="block text-[10.5px] font-semibold text-jewelInk-hint leading-tight">{cyr(geoOf(r))}</span>
            </motion.button>
          )
        })}
      </div>
      <Tip>{fb || 'Нино показывает на фото в синей рамке. Кто это ей?'}</Tip>
    </div>
  )
}

// ── Сцена ─────────────────────────────────────────────────────────────────────────────────────────

const MODE_TEXT: Record<FamilyMode, { title: string; text: string }> = {
  parents: { title: 'Семейный альбом', text: 'Нино показывает родителей. Слушай, кого она называет, и клади фото в нужную рамку. Осторожно: одно слово — ловушка.' },
  siblings: { title: 'Брат и сестра', text: 'В альбоме прибавилось людей: брат и сестра. Слушай, кого называют, и раскладывай фото по рамкам.' },
  full: { title: 'Вся семья', text: 'У брата Нино своя семья, у сестры — муж. Девять рамок: смотри на линии родства и слушай Нино.' },
  album: { title: 'Семейный альбом', text: 'Листаем альбом Нино: она показывает на фото и спрашивает «кто это?». Отвечай по-грузински, серия даёт бонус.' }
}

type Result = { title: string; text: string }

export default function Family({ lesson, step, fraction, onExit, onDone, rng = Math.random }: SceneProps<StepOf<'family'>>) {
  const mode = step.mode
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro')
  const [result, setResult] = useState<Result | null>(null)
  const [own, setOwn] = useState<string[]>([])
  const [run, setRun] = useState(0)
  const tree = useMemo(() => familyTree(mode, lesson.id), [mode, lesson.id])
  const roles = treeRoles(tree)
  const endLooks = useMemo(() => familyLooks(rng), [run]) // eslint-disable-line react-hooks/exhaustive-deps
  const t = MODE_TEXT[mode]

  const ruleCard = (
    <RuleCard title={`${phrase('ojakhi').geo} — семья`}>
      <span className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[14px]">
        {roles.map(r => <span key={r}><b className="font-geo">{geoOf(r)}</b> — {ROLES[r].ru}{r === 'mama' ? ' (не мама!)' : r === 'da' ? ' (и «и»)' : ''}</span>)}
      </span>
    </RuleCard>
  )

  return (
    <GameFrame title={t.title} eyebrow={phase === 'end' ? 'альбом собран' : 'игра урока'} fraction={fraction} onExit={onExit}>
      <div className="flex-1 min-h-0 flex flex-col" data-testid="family-scene">
        {phase === 'intro' && (
          <GameIntro title={t.title} text={t.text} chips={roles.map(r => ({ geo: geoOf(r), ru: ROLES[r].ru }))}
            onStart={() => setPhase('play')} />
        )}
        {phase === 'play' && mode !== 'album' && (
          <Placing key={run} mode={mode} lessonId={lesson.id} rng={rng} onEnd={r => {
            setResult({
              title: 'Семья в сборе!',
              text: `${r.first} из ${r.total} фото с первого раза.${r.trap === true ? ' И ловушку с მამა ты обошёл.' : r.trap === false ? ' მამა — это папа, а мама — დედა. Теперь не попадёшься.' : ''}`
            })
            setPhase('end')
          }} />
        )}
        {phase === 'play' && mode === 'album' && (
          <Album key={run} lessonId={lesson.id} rng={rng} onEnd={r => {
            setOwn(r.own)
            setResult({ title: 'Альбом пролистан', text: `${r.right} из ${r.total} с первого раза, лучшая серия — ${r.best}. ★ ${r.score}.` })
            setPhase('end')
          }} />
        )}
        {phase === 'end' && result && (
          <GameEnd title={result.title} text={result.text} onNext={onDone} onAgain={() => { setRun(n => n + 1); setPhase('play') }}
            rule={
              <div className="w-full flex flex-col gap-2">
                {mode === 'album' && own.length > 0 ? (
                  <div className="rounded-2xl border-[1.5px] border-jewelInk bg-cream-tile px-3 py-2 text-left" style={SHADOW} data-testid="family-own-page">
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-navy">твоя страница</div>
                    {ownStatements(lesson.id).filter(s => own.includes(s.id)).map(s => (
                      <div key={s.id} className="text-[13px]"><b className="font-geo">{s.geo}</b> — {s.ru}</div>
                    ))}
                  </div>
                ) : (
                  <div className="ab-short:hidden" data-testid="family-final-tree">
                    <Board className="h-[150px]" tree={tree} filled={Object.fromEntries(roles.map(r => [r, true]))} looks={endLooks}
                      ownerLook={{ coat: '#E01A3C', skin: '#F2C9A0', hair: '#2A1F18', long: true }} ownerRu="Нино" />
                  </div>
                )}
                {ruleCard}
              </div>
            } />
        )}
      </div>
    </GameFrame>
  )
}
