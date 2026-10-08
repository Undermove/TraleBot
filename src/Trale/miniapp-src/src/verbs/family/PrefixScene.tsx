import React, { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../../components/Button'
import LoaderLetter from '../../components/LoaderLetter'
import { cyr } from '../types'
import { SOLID_STEP } from '../ladder/engine'
import { Coach, GameShell, PULSE, useFirstTime, type SceneHooks } from '../ui/GameShell'
import { bad, good } from '../ui/juice'
import DirectionGlyph, { SpeakerDot } from './DirectionGlyph'
import { resolveRound, type PrefixOption, type PrefixRound, type ResolvedRound } from './prefixPlan'
import { loadFamily } from './store'
import { placeLabel, prefixOf, type FamilyDto } from './types'

// Сцена про приставку: спрашиваем не окончания, а направление. Два вида вопроса:
//   «Как сказать?» — русская фраза и схема направления, выбрать слово с нужной приставкой;
//   «Куда?»        — слово, выбрать направление по схеме.
// Варианты — та же клетка таблицы (то же лицо и время) у других глаголов семьи.
// Проверка — те же вопросы, но с одной попыткой; её счёт решает, выучен ли глагол.

export const HELP = [
  'Это один и тот же глагол. В начале слова — приставка: она говорит, куда идут. Окончания ты уже знаешь.',
  'Жёлтая точка на схеме — это ты. «Сюда» — стрелка идёт к тебе, «туда» — от тебя.',
  'Ошибся — не страшно: скажу, что значит выбранное, и можно попробовать ещё раз.'
]
export const CHECK_HELP = [
  'Это проверка: шесть вопросов про приставку. На каждый — одна попытка, одну ошибку прощаю.',
  'Пройдёшь — глагол выучен. Не пройдёшь — ничего страшного: сыграем ещё раз.'
]

export interface PrefixCheckResult { asked: number; correct: number; missed: { tense: string; person: number }[] }

/** Сцена сообщает сессии ещё одно: слово знакомо целиком — пусть уходит на повторение. */
export type PrefixSceneHooks = SceneHooks & { onKnown: (cell: { tense: string; person: number }) => void }

interface Props {
  /** id глагола сессии: его клетки двигаются по ступеням, чужие — нет. */
  verbId: string
  familyId: string
  rounds: PrefixRound[]
  scene: PrefixSceneHooks
  onExit: () => void
  /** Проверка: одна попытка на вопрос, итог уходит сюда. */
  onCheck?: (result: PrefixCheckResult) => void
}

/** Слово с выделенной приставкой: приставка синим, остальное — как было. */
export function PrefixedWord({ form, prefixes }: { form: string; prefixes: readonly string[] }) {
  const prefix = prefixOf(form, prefixes)
  return <>{prefix && <span className="text-navy" data-testid="prefix-part">{prefix}</span>}{form.slice(prefix.length)}</>
}

export default function PrefixScene({ verbId, familyId, rounds, scene, onExit, onCheck }: Props) {
  const check = !!onCheck
  const [family, setFamily] = useState<FamilyDto | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    loadFamily(familyId).then(f => { if (alive) setFamily(f) }).catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [familyId])

  // Проверка после перезагрузки начинается заново: половина проверки — не проверка.
  const [index, setIndex] = useState(check ? 0 : Math.min(scene.startAt, Math.max(0, rounds.length - 1)))
  const round: ResolvedRound | null = useMemo(
    () => (family && rounds[index] ? resolveRound(rounds[index], family) : null), [family, rounds, index])

  const [wrong, setWrong] = useState<string[]>([])
  const [solved, setSolved] = useState(false)
  const [waitNext, setWaitNext] = useState(false)
  const [note, setNote] = useState<React.ReactNode>(null)
  const missed = useRef(false)
  const tally = useRef<PrefixCheckResult>({ asked: 0, correct: 0, missed: [] })
  const [first, firstDone] = useFirstTime('verb_prefix')
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])

  function advance() {
    if (index + 1 >= rounds.length) {
      onCheck?.(tally.current)
      scene.onDone()
      return
    }
    missed.current = false
    setWrong([]); setSolved(false); setWaitNext(false); setNote(null)
    setIndex(index + 1)
  }

  // Раунд, который не из чего собрать (в данных нет клетки), молча пропускаем: тупика быть не должно.
  const skip = !!family && !round
  useEffect(() => {
    if (!skip) return
    scene.onStep()
    advance()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, index])

  if (failed) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 px-8 text-center" data-testid="prefix-failed">
        <div className="text-[15px] text-jewelInk-mid">Не получилось открыть игру. Проверь связь и попробуй ещё раз.</div>
        <Button variant="ghost" onClick={onExit}>Назад</Button>
      </div>
    )
  }
  if (!family || !round) {
    return <div className="min-h-[100dvh] flex items-center justify-center" data-testid="prefix-loading"><LoaderLetter size={96} /></div>
  }

  const cell = { tense: round.tense, person: round.person }
  const own = round.target.member.id === verbId
  const base = family.baseName

  /** Ответ засчитывается один раз, по первой попытке; двигаются только клетки глагола этой сессии. */
  function settle(ok: boolean) {
    if (own && !missed.current) {
      scene.onResult(cell, ok, SOLID_STEP, true)
      // В проверке верный ответ с первой попытки: слово знакомо целиком и дальше живёт в повторении.
      if (ok && check) scene.onKnown(cell)
    }
    if (check) {
      tally.current.asked++
      if (ok && !missed.current) tally.current.correct++
      else if (own) tally.current.missed.push(cell)
    }
    scene.onStep()
  }

  const about = (o: PrefixOption) => (
    <><span className="font-geo font-bold text-jewelInk"><PrefixedWord form={o.form} prefixes={o.member.prefixes} /></span> — это «{o.meaning}»: {placeLabel(o.member)}</>
  )

  function choose(option: PrefixOption) {
    if (solved || waitNext) return
    if (option === round!.target) {
      settle(true)
      setSolved(true)
      good()
      if (first) firstDone()
      setNote(<>Верно: {about(option)}.</>)
      timer.current = setTimeout(advance, missed.current ? 1500 : 1100)
      return
    }
    bad()
    const explain = round!.kind === 'form'
      ? about(option)
      : <>«{placeLabel(option.member)}» — это было бы <span className="font-geo font-bold text-jewelInk"><PrefixedWord form={option.form} prefixes={option.member.prefixes} /></span> («{option.meaning}»)</>
    if (check) {
      // Одна попытка: показываем верное и идём дальше.
      settle(false)
      setWrong([option.member.id]); setSolved(true); setWaitNext(true)
      setNote(<>{explain}. А здесь — {about(round!.target)}.</>)
      return
    }
    if (!missed.current) {
      if (own) scene.onResult(cell, false, SOLID_STEP, true)
      missed.current = true
    }
    setWrong(w => [...w, option.member.id])
    setNote(<>{explain}. Выбери другое.</>)
  }

  return (
    <GameShell id={check ? 'verb_prefix_check' : 'verb_prefix'} title={check ? `Проверка · ${index + 1} из ${rounds.length}` : `«${base}» + приставка`} onExit={onExit} help={check ? CHECK_HELP : HELP}>
      <div
        className="px-5 flex-1 flex flex-col justify-center gap-5 py-4" data-testid="prefix-scene"
        data-kind={round.kind} data-mode={check ? 'check' : 'play'} data-target={round.target.member.id} data-cell={`${round.tense}:${round.person}`}
      >
        {round.kind === 'form' ? (
          <div className="text-center" key={index}>
            <div className="mn-eyebrow text-navy">Как сказать?</div>
            <div className="mt-3 text-[30px] font-extrabold leading-tight" data-testid="prefix-phrase">{round.target.meaning}</div>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-jewelInk/40 bg-cream-tile pl-1.5 pr-3 py-0.5" data-testid="prefix-where">
              <DirectionGlyph direction={round.target.member.direction} toward={round.target.member.toward} size={34} />
              <span className="text-[14px] font-bold text-jewelInk">{placeLabel(round.target.member)}</span>
            </div>
          </div>
        ) : (
          <div className="text-center" key={index}>
            <div className="mn-eyebrow text-navy">Куда?</div>
            <div className="mt-3 font-geo text-[36px] font-extrabold leading-tight" data-testid="prefix-form">
              <PrefixedWord form={round.target.form} prefixes={round.target.member.prefixes} />
            </div>
            <div className="mt-1 text-[14px] text-jewelInk-hint">{cyr(round.target.form)}</div>
            <div className="mt-2 text-[14px] text-jewelInk-mid">«{round.baseMeaning}» — но куда?</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {round.options.map(o => {
            const isRight = o === round.target
            const off = wrong.includes(o.member.id) || (solved && !isRight)
            return (
              <button
                key={o.member.id} data-testid="prefix-option" data-id={o.member.id} data-right={isRight}
                disabled={off || solved} onClick={() => choose(o)}
                aria-label={round.kind === 'form' ? o.form : placeLabel(o.member)}
                className={`min-w-0 min-h-[64px] rounded-xl border-[1.5px] border-jewelInk px-2 py-2 font-bold leading-tight
                  ${solved && isRight ? 'bg-navy-wash j-pop' : 'bg-cream-tile'} ${off ? 'opacity-40' : ''}
                  ${first && !solved && !wrong.length && isRight ? PULSE : ''}`}
                style={{ boxShadow: '2px 2px 0 #15100A' }}
              >
                {round.kind === 'form' ? (
                  <>
                    <span className={`block font-geo break-words ${o.form.length > 12 ? 'text-[13px]' : o.form.length > 9 ? 'text-[15px]' : 'text-[17px]'}`}>
                      <PrefixedWord form={o.form} prefixes={o.member.prefixes} />
                    </span>
                    <span className="block text-[12px] font-semibold text-jewelInk-hint break-words">{cyr(o.form)}</span>
                  </>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    <DirectionGlyph direction={o.member.direction} toward={o.member.toward} size={36} />
                    <span className="text-left text-[13px] leading-tight">
                      {o.member.directionRu && <span className="block">{o.member.directionRu}</span>}
                      <span className={`block ${o.member.directionRu ? 'text-[12px] font-semibold text-jewelInk-mid' : ''}`}>{o.member.toward === 'here' ? 'сюда' : 'туда'}</span>
                    </span>
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {note && (
          <div data-testid="prefix-note" className="rounded-xl bg-gold-wash border border-jewelInk/40 px-3 py-2 text-[14px] text-jewelInk-soft text-center j-rise">
            {note}
          </div>
        )}
        {first && !note && (
          <Coach>
            {round.kind === 'form'
              ? <>Смотри на начало слова — синим выделена приставка. Для первого раза я подсветил нужное.</>
              : <>Приставка в начале слова говорит, куда идут. <SpeakerDot /> — это ты. Для первого раза я подсветил нужное.</>}
          </Coach>
        )}
      </div>

      <div className="px-5 flex flex-col gap-2" style={{ paddingBottom: 'calc(var(--safe-b, 0px) + 20px)' }}>
        {waitNext && <Button onClick={advance}>Дальше</Button>}
      </div>
    </GameShell>
  )
}
