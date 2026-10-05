import React, { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../../components/Button'
import GeorgianKeyboard from '../../components/GeorgianKeyboard'
import Mascot from '../../components/Mascot'
import { cyr, type VerbDto, type VerbSentenceDto } from '../types'
import { Coach, HelpButton, PULSE, useFirstTime } from '../ui/GameShell'
import { CloseIcon } from '../ui/icons'
import { bad, good } from '../ui/juice'
import {
  STEP, afterTask, buildItems, checkBuild, findForm, introduce, nextTask, remaining, settle, startSession, withGap,
  type LadderItem, type Progress, type Session, type Task
} from './engine'
import { createSaver } from './progressStore'
import { cellLabel, cellLike } from './types'

// Игра «лесенка»: один глагол, по одной форме, одно задание на экране.
// Что спросить следующим, решает engine.ts; здесь только экран и отклик.

const FIRST_SENTENCE_KEY = 'verb_ladder_first_sentence'
const HELP = [
  'Учим глагол по одной форме. Сначала я показываю новую форму и что она значит.',
  'Потом спрашиваю её всё труднее: узнать, выбрать, вставить в живую фразу, собрать фразу, написать самому.',
  'Ошибся — ничего страшного: форма спустится на ступеньку и я спрошу её ещё раз. Выученные формы вернутся на повторение через день-другой.'
]

interface Game { progress: Progress; session: Session; task: Task }

interface Props {
  verb: VerbDto
  /** Прогресс, с которого начинаем. */
  initial: Progress
  /** Выход: отдаём прогресс, чтобы карточка глагола сразу показала новый счёт. */
  onExit: (progress: Progress) => void
}

export default function Ladder({ verb, initial, onExit }: Props) {
  const items = useMemo(() => buildItems(verb), [verb])
  const saver = useMemo(() => createSaver(verb.id), [verb.id])
  const [game, setGame] = useState<Game>(() => {
    const session = startSession(items, initial)
    return { progress: initial, session, task: nextTask(items, initial, session) }
  })
  const { progress, session, task } = game

  // Что произошло в текущем задании.
  const [missed, setMissed] = useState(false)
  const [solved, setSolved] = useState(false)
  const [wrong, setWrong] = useState<string[]>([])
  const [note, setNote] = useState<React.ReactNode>(null)
  const [waitNext, setWaitNext] = useState(false)
  const [built, setBuilt] = useState<number[]>([])
  const [typed, setTyped] = useState('')
  const [cheer, setCheer] = useState(false)

  const [first, firstDone] = useFirstTime('ladder')
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => { clearTimeout(timer.current); void saver.flush() }, [saver])

  // Полоска показывает пройденную часть захода и назад не откатывается:
  // ошибка возвращает форму на ступень ниже, но пройденное остаётся пройденным.
  const left = remaining(items, progress, session)
  const fraction = session.planned > 0 ? 1 - Math.min(left, session.planned) / session.planned : 1
  const [peak, setPeak] = useState(0)
  useEffect(() => { if (fraction > peak) setPeak(fraction) }, [fraction, peak])
  const learned = items.filter(i => (progress[i.key]?.best ?? 0) >= STEP.MASTERED).length

  function advance() {
    setMissed(false); setSolved(false); setWrong([]); setNote(null); setWaitNext(false); setBuilt([]); setTyped(''); setCheer(false)
    setGame(g => {
      const next = afterTask(g.session, g.task)
      return { ...g, session: next, task: nextTask(items, g.progress, next) }
    })
  }
  const later = (ms: number) => { timer.current = setTimeout(advance, ms) }

  /** Засчитать ответ: сдвинуть форму по ступеням и сохранить. */
  function commit(item: LadderItem, ok: boolean) {
    const state = settle(item, progress[item.key], ok)
    setGame(g => ({ ...g, progress: { ...g.progress, [item.key]: state } }))
    saver.record(item, state)
    return state
  }

  /** Верный ответ. Если до этого в задании ошиблись, ступень уже опустили — второй раз не двигаем. */
  function right(item: LadderItem, big = false) {
    const state = missed ? progress[item.key] : commit(item, true)
    setSolved(true)
    good(null, big || (!missed && state.step >= STEP.MASTERED) ? 'big' : 'small')
  }

  function miss(item: LadderItem) {
    if (!missed) commit(item, false)
    setMissed(true)
    bad()
  }

  function understood() {
    if (task.type !== 'intro') return
    const state = introduce()
    setGame(g => ({ ...g, progress: { ...g.progress, [task.item.key]: state } }))
    saver.record(task.item, state)
    if (first) firstDone()
    advance()
  }

  function choose(option: LadderItem) {
    if (solved || (task.type !== 'meaning' && task.type !== 'form' && task.type !== 'gap')) return
    if (option.key === task.item.key) {
      right(task.item)
      setNote(null)
      later(missed ? 1100 : 700)
      return
    }
    miss(task.item)
    setWrong(w => [...w, option.key])
    setNote(task.type === 'meaning'
      ? <>«{cellLabel(option)}» — это <Geo>{option.form}</Geo>. Попробуй ещё раз.</>
      : <><Geo>{option.form}</Geo> — это «{cellLabel(option)}», как «{cellLike(option)}». Попробуй ещё раз.</>)
  }

  function checkBuilt() {
    if (task.type !== 'build') return
    const verdict = checkBuild(task, built.map(i => task.chips[i]))
    if (verdict.kind === 'decoy') {
      const decoy = verdict.chip.decoy!
      miss(task.item)
      setNote(<><Geo>{decoy.form}</Geo> — это «{cellLabel(decoy)}», как «{cellLike(decoy)}». Здесь нужна другая форма — замени её.</>)
      setBuilt(built.filter(i => !task.chips[i].decoy))
      return
    }
    if (verdict.kind === 'order') {
      // Порядок слов в грузинском гибкий: за него ступень не снимаем и «неправильно» не говорим,
      // но и не утверждаем, что так тоже говорят, — показываем, как в источнике.
      right(task.item)
      setNote(<>Форма глагола верная. Порядок слов в грузинском гибкий, но не любой — в источнике фраза такая: <Geo>{task.sentence.ka}</Geo></>)
      setWaitNext(true)
      return
    }
    right(task.item, true)
    setNote(null)
    let firstSentence = false
    try {
      firstSentence = !localStorage.getItem(FIRST_SENTENCE_KEY)
      localStorage.setItem(FIRST_SENTENCE_KEY, '1')
    } catch {}
    // После первой собранной фразы не перелистываем сами — даём порадоваться.
    if (firstSentence) { setCheer(true); setWaitNext(true) } else later(1600)
  }

  function checkTyped() {
    if (task.type !== 'type') return
    const value = typed.trim()
    if (task.item.variants.includes(value)) {
      right(task.item)
      later(900)
      return
    }
    miss(task.item)
    const other = findForm(items, value)
    setNote(
      <>
        {other && <><Geo>{value}</Geo> — это «{cellLabel(other)}». </>}
        Правильно так: <Geo>{task.item.form}</Geo> <span className="text-jewelInk-hint">({cyr(task.item.form)})</span>
      </>
    )
    setWaitNext(true)
  }

  function more() {
    setPeak(0)
    setGame(g => {
      const next = startSession(items, g.progress)
      return { ...g, session: next, task: nextTask(items, g.progress, next) }
    })
  }

  const exit = () => onExit(progress)
  /** Во фразе верный вариант — та запись формы, что стоит в самой фразе. */
  const shown = (o: LadderItem) => (task.type === 'gap' && o.key === task.item.key ? task.sentence.form : o.form)
  const typing = task.type === 'type' && !solved && !waitNext

  return (
    <div className="fixed inset-0 z-[60] bg-cream overflow-y-auto" data-testid="verb-ladder">
      <div className="j-root flex flex-col min-h-[100dvh] w-full max-w-[480px] mx-auto">
        <div className="px-5 pt-4 flex items-center gap-3">
          <button onClick={exit} aria-label="Закрыть" className="w-9 h-9 flex items-center justify-center"><CloseIcon size={20} /></button>
          <div className="flex-1 h-3 rounded-full bg-cream-deep border border-jewelInk/30 overflow-hidden">
            <div
              data-testid="ladder-bar"
              className="h-full bg-navy transition-all duration-500 ease-out"
              style={{ width: `${Math.round(Math.max(peak, fraction) * 100)}%` }}
            />
          </div>
          <div key={learned} className="text-[12px] font-bold text-jewelInk-mid tabular-nums j-bump" title="Выучено форм">
            {learned}/{items.length}
          </div>
          <HelpButton id="ladder" help={HELP} />
        </div>
        <div className="px-5 pt-1 text-center text-[12px] text-jewelInk-hint">
          <span className="font-geo font-bold">{verb.title}</span> · {verb.ru}
        </div>

        <div className="px-5 flex-1 flex flex-col justify-center gap-5 py-5">
          {task.type === 'done' && (
            <div className="text-center flex flex-col items-center gap-3 j-rise" data-testid="ladder-done">
              <Mascot mood="cheer" size={120} />
              {task.reason === 'session' ? (
                <>
                  <div className="text-[20px] font-extrabold">На этот раз хватит</div>
                  <div className="text-[14px] text-jewelInk-mid">
                    Выучено форм: {learned} из {items.length}. Я верну их на повторение через день-другой, а новые подождут.
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[20px] font-extrabold">Все формы выучены</div>
                  <div className="text-[14px] text-jewelInk-mid">
                    Все {items.length} на месте. Заглядывай через день-другой — спрошу их вперемешку.
                  </div>
                </>
              )}
            </div>
          )}

          {task.type === 'intro' && (
            <div key={task.item.key} className="text-center j-rise" data-testid="ladder-intro">
              <div className="mn-eyebrow text-navy">Новая форма</div>
              <div className="mt-3 font-geo text-[44px] font-extrabold leading-none">{task.item.form}</div>
              <div className="mt-1 text-[14px] text-jewelInk-hint">{cyr(task.item.form)}</div>
              <div className="mt-4 text-[22px] font-extrabold text-navy">{cellLabel(task.item)}</div>
              <div className="mt-1 text-[13px] text-jewelInk-mid">как «{cellLike(task.item)}», только про «{verb.ru}»</div>
              {task.twin && (
                <div className="mt-2 text-[12px] text-jewelInk-hint">Пишется так же, как «{cellLabel(task.twin)}».</div>
              )}
              {task.sentence && <SentenceBox sentence={task.sentence} />}
            </div>
          )}

          {task.type === 'meaning' && (
            <Prompt eyebrow="Что это за форма?" review={task.review}>
              <div className="font-geo text-[36px] font-extrabold leading-tight">{task.item.form}</div>
              <div className="mt-1 text-[14px] text-jewelInk-hint">{cyr(task.item.form)}</div>
            </Prompt>
          )}

          {(task.type === 'form' || task.type === 'type') && (
            <Prompt eyebrow={task.type === 'form' ? 'Как сказать?' : 'Напиши сам'} review={task.review}>
              <div className="text-[28px] font-extrabold leading-tight">{cellLabel(task.item)}</div>
              <div className="mt-1 text-[14px] text-jewelInk-mid">как «{cellLike(task.item)}», только про «{verb.ru}»</div>
            </Prompt>
          )}

          {task.type === 'gap' && (
            <Prompt eyebrow="Вставь слово" review={task.review}>
              <div className="font-geo text-[24px] font-extrabold leading-tight" data-testid="ladder-gap">
                {withGap(task.sentence.ka, task.sentence.form, solved)}
              </div>
              <div className="mt-2 text-[14px] text-jewelInk-mid">{task.sentence.ru}</div>
            </Prompt>
          )}

          {task.type === 'build' && (
            <Prompt eyebrow="Собери фразу" review={task.review}>
              <div className="text-[20px] font-extrabold">{task.sentence.ru}</div>
              <div
                data-testid="ladder-built"
                className={`mt-4 min-h-[56px] rounded-xl border-[1.5px] border-dashed border-jewelInk/50 p-2 flex flex-wrap gap-2 justify-center ${solved ? 'bg-navy-wash' : ''}`}
              >
                {built.map(i => (
                  <ChipButton key={i} onClick={() => !solved && setBuilt(built.filter(x => x !== i))}>{task.chips[i].text}</ChipButton>
                ))}
              </div>
            </Prompt>
          )}

          {(task.type === 'meaning' || task.type === 'form' || task.type === 'gap') && (
            <div className="flex flex-col gap-2">
              {task.options.map(o => {
                const isRight = o.key === task.item.key
                const off = wrong.includes(o.key) || (solved && !isRight)
                return (
                  <button
                    key={o.key}
                    data-testid={`ladder-option-${o.key}`}
                    disabled={off || solved}
                    onClick={() => choose(o)}
                    className={`rounded-xl border-[1.5px] border-jewelInk px-4 py-3 text-[17px] font-bold
                      ${solved && isRight ? 'bg-navy-wash j-pop' : 'bg-cream-tile'} ${off ? 'opacity-40' : ''}`}
                    style={{ boxShadow: '2px 2px 0 #15100A' }}
                  >
                    {task.type === 'meaning' ? (
                      <>
                        <span className="block">{cellLabel(o)}</span>
                        <span className="block text-[12px] font-semibold text-jewelInk-hint">как «{cellLike(o)}»</span>
                      </>
                    ) : (
                      <>
                        <span className="block font-geo">{shown(o)}</span>
                        <span className="block text-[12px] font-semibold text-jewelInk-hint">{cyr(shown(o))}</span>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {task.type === 'build' && !solved && (
            <div className="flex flex-wrap gap-2 justify-center" data-testid="ladder-chips">
              {task.chips.map((c, i) => !built.includes(i) && (
                <ChipButton key={i} onClick={() => setBuilt([...built, i])}>{c.text}</ChipButton>
              ))}
            </div>
          )}

          {task.type === 'type' && (
            <div
              data-testid="ladder-typed"
              className={`h-14 rounded-xl border-[1.5px] border-jewelInk flex items-center justify-center font-geo text-[22px] font-bold
                ${solved ? 'bg-navy-wash j-pop' : waitNext ? 'bg-gold-wash' : 'bg-cream-tile'}`}
            >
              {typed}
            </div>
          )}

          {note && (
            <div data-testid="ladder-note" className="rounded-xl bg-gold-wash border border-jewelInk/40 px-3 py-2 text-[14px] text-jewelInk-soft text-center j-rise">
              {note}
            </div>
          )}
          {cheer && (
            <div className="flex items-center gap-3 j-pop" data-testid="ladder-cheer">
              <Mascot mood="cheer" size={72} className="shrink-0" />
              <div className="text-[16px] font-extrabold text-navy">Ты только что сам собрал фразу на грузинском.</div>
            </div>
          )}
          {first && task.type === 'intro' && (
            <Coach>Посмотри на форму и нажми «Понятно» — дальше я буду её спрашивать.</Coach>
          )}
        </div>

        <div className="px-5 pb-5 flex flex-col gap-2" style={{ paddingBottom: typing ? 12 : 'calc(var(--safe-b, 0px) + 20px)' }}>
          {task.type === 'intro' && <Button onClick={understood} className={first ? PULSE : ''}>Понятно</Button>}
          {task.type === 'build' && !solved && (
            <Button disabled={built.length !== task.answer.length} onClick={checkBuilt}>Проверить</Button>
          )}
          {typing && <Button disabled={!typed.trim()} onClick={checkTyped}>Проверить</Button>}
          {waitNext && <Button onClick={advance}>Дальше</Button>}
          {task.type === 'done' && (
            <>
              {task.reason === 'session' && <Button onClick={more}>Ещё немного</Button>}
              <Button variant={task.reason === 'session' ? 'ghost' : 'primary'} onClick={exit}>Готово</Button>
            </>
          )}
        </div>
        {typing && <GeorgianKeyboard value={typed} onChange={setTyped} />}
      </div>
    </div>
  )
}

const Geo = ({ children }: { children: React.ReactNode }) => <span className="font-geo font-bold text-jewelInk">{children}</span>

function Prompt({ eyebrow, review, children }: { eyebrow: string; review: boolean; children: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="mn-eyebrow text-navy">{review ? `Повторение · ${eyebrow.toLowerCase()}` : eyebrow}</div>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function SentenceBox({ sentence }: { sentence: VerbSentenceDto }) {
  return (
    <div className="mt-6 rounded-xl bg-cream-tile border border-jewelInk/30 p-3">
      <div className="text-[11px] text-jewelInk-hint">живая фраза · Tatoeba</div>
      <div className="mt-1 font-geo text-[17px] font-bold">{sentence.ka}</div>
      <div className="text-[13px] text-jewelInk-mid">{sentence.ru}</div>
    </div>
  )
}

function ChipButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 rounded-lg bg-cream-tile border-[1.5px] border-jewelInk font-geo text-[17px] font-bold"
      style={{ boxShadow: '2px 2px 0 #15100A' }}
    >
      {children}
    </button>
  )
}
