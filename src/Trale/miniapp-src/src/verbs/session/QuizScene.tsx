import React, { useEffect, useMemo, useRef, useState } from 'react'
import Button from '../../components/Button'
import GeorgianKeyboard from '../../components/GeorgianKeyboard'
import Mascot from '../../components/Mascot'
import { cyr, type VerbDto } from '../types'
import { Coach, PULSE, SessionHeader, useFirstTime, type SceneHooks } from '../ui/GameShell'
import { bad, good } from '../ui/juice'
import { orderNote } from '../wordOrder'
import {
  KIND_CEILING, STEP, checkBuild, findForm, taskOfKind, withGap,
  type LadderItem, type Progress, type Task
} from '../ladder/engine'
import { MeaningText } from '../parts'
import { quoted } from '../meaning'
import { ChipButton, EXAM_HELP, Geo, HELP, Prompt, SentenceBox } from './quizParts'
import type { PlannedTask } from './types'
import TablePeek from '../TablePeek'

// Сцена-квиз: несколько заданий подряд, одно на экране. Что и в каком порядке спросить, решил
// постановщик сессии (plan.ts); здесь — экран задания и отклик. Названий времён нет: форма
// объясняется русской фразой («я хочу»). Этой же сценой идут знакомство, разминка, фразы и экзамен.

export interface ExamResult { asked: number; correct: number; missed: LadderItem[] }


interface Props {
  verb: VerbDto
  items: LadderItem[]
  tasks: PlannedTask[]
  /** Прогресс на сейчас — по нему подбираются неверные варианты (сначала знакомые формы). */
  progress: () => Progress
  scene: SceneHooks
  /** Экзамен: одна попытка на вопрос, итог уходит в onExam. */
  onExam?: (result: ExamResult) => void
}

export default function QuizScene({ verb, items, tasks, progress, scene, onExam }: Props) {
  const exam = !!onExam
  const byKey = useMemo(() => new Map(items.map(i => [i.key, i])), [items])
  // Экзамен после перезагрузки начинается заново: половина экзамена — не экзамен.
  const [index, setIndex] = useState(exam ? 0 : Math.min(scene.startAt, tasks.length - 1))
  const task: Task = useMemo(() => {
    const planned = tasks[index]
    return taskOfKind(planned.kind, byKey.get(planned.key)!, items, progress())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, tasks, items])

  // Что произошло в текущем задании.
  const [missed, setMissed] = useState(false)
  const [solved, setSolved] = useState(false)
  const [wrong, setWrong] = useState<string[]>([])
  const [note, setNote] = useState<React.ReactNode>(null)
  const [waitNext, setWaitNext] = useState(false)
  const [built, setBuilt] = useState<number[]>([])
  const [typed, setTyped] = useState('')
  const tally = useRef<ExamResult>({ asked: 0, correct: 0, missed: [] })

  const [first, firstDone] = useFirstTime('ladder')
  const timer = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(timer.current), [])

  function advance() {
    if (index + 1 >= tasks.length) {
      onExam?.(tally.current)
      scene.onDone()
      return
    }
    setMissed(false); setSolved(false); setWrong([]); setNote(null); setWaitNext(false); setBuilt([]); setTyped('')
    setIndex(index + 1)
  }
  const later = (ms: number) => { timer.current = setTimeout(advance, ms) }

  /** Задание пройдено: ответ засчитан (один раз — по первой попытке), полоска сессии растёт. */
  function finish(item: LadderItem, ok: boolean, kind: Exclude<Task['type'], 'intro'>) {
    if (!missed) scene.onResult(item, ok, KIND_CEILING[kind])
    if (exam) {
      tally.current.asked++
      if (ok && !missed) tally.current.correct++
      else tally.current.missed.push(item)
    }
    scene.onStep()
  }

  function right(item: LadderItem, kind: Exclude<Task['type'], 'intro'>, big = false) {
    finish(item, true, kind)
    setSolved(true)
    good(null, big ? 'big' : 'small')
  }

  /** Первая ошибка в задании: форма отступает на ступень, дальше можно пробовать без последствий. */
  function miss(item: LadderItem, kind: Exclude<Task['type'], 'intro'>) {
    if (!missed) scene.onResult(item, false, KIND_CEILING[kind])
    setMissed(true)
    bad()
  }

  function understood() {
    if (task.type !== 'intro') return
    scene.onResult(task.item, true, STEP.MEANING, true)
    scene.onStep()
    if (first) firstDone()
    advance()
  }

  function choose(option: LadderItem) {
    if (solved || waitNext || (task.type !== 'meaning' && task.type !== 'form' && task.type !== 'gap')) return
    if (option.key === task.item.key) {
      right(task.item, task.type)
      setNote(null)
      later(missed ? 1100 : 700)
      return
    }
    const explain = task.type === 'meaning'
      ? <>{quoted(option.meaning)} — это <Geo>{option.form}</Geo>.</>
      : <><Geo>{option.form}</Geo> — это {quoted(option.meaning)}.</>
    if (exam) {
      // На экзамене попытка одна: показываем верное и идём дальше.
      finish(task.item, false, task.type)
      bad()
      setWrong([option.key]); setSolved(true); setWaitNext(true)
      setNote(explain)
      return
    }
    miss(task.item, task.type)
    setWrong(w => [...w, option.key])
    setNote(<>{explain} Выбери другое.</>)
  }

  function checkBuilt() {
    if (task.type !== 'build') return
    const verdict = checkBuild(task, built.map(i => task.chips[i]))
    if (verdict.kind === 'decoy') {
      const decoy = verdict.chip.decoy!
      miss(task.item, 'build')
      setNote(<><Geo>{decoy.form}</Geo> — это {quoted(decoy.meaning)}. Замени это слово.</>)
      setBuilt(built.filter(i => !task.chips[i].decoy))
      return
    }
    if (verdict.kind === 'order') {
      // Порядок слов в грузинском гибкий: за него ступень не снимаем и «неправильно» не говорим,
      // но и не утверждаем, что так тоже говорят, — показываем, как в источнике (общее правило с комиксом: wordOrder.ts).
      right(task.item, 'build')
      setNote(orderNote(task.sentence.ka))
      setWaitNext(true)
      return
    }
    right(task.item, 'build', true)
    setNote(null)
    later(1500)
  }

  function checkTyped() {
    if (task.type !== 'type') return
    const value = typed.trim()
    if (task.item.variants.includes(value)) {
      right(task.item, 'type')
      later(900)
      return
    }
    finish(task.item, false, 'type')
    bad()
    setMissed(true)
    const other = findForm(items, value)
    setNote(
      <>
        {other && <><Geo>{value}</Geo> — это {quoted(other.meaning)}. </>}
        Правильно: <Geo>{task.item.form}</Geo> <span className="text-jewelInk-hint">({cyr(task.item.form)})</span>
      </>
    )
    setWaitNext(true)
  }

  /** Во фразе верный вариант — та запись формы, что стоит в самой фразе. */
  const shown = (o: LadderItem) => (task.type === 'gap' && o.key === task.item.key ? task.sentence.form : o.form)
  const typing = task.type === 'type' && !solved && !waitNext

  return (
    <div className="j-root flex flex-col min-h-[100dvh]" data-testid="quiz-scene" data-task={task.type} data-key={task.item.key}>
      <SessionHeader id={exam ? 'session_exam' : 'ladder'} help={exam ? EXAM_HELP : HELP} />
      <div className="px-5 pt-1 text-center text-[12px] text-jewelInk-hint">
        {exam
          ? <span className="font-bold text-navy" data-testid="exam-count">Экзамен · {index + 1} из {tasks.length}</span>
          : <><span className="font-geo font-bold">{verb.title}</span> · {verb.ru}</>}
      </div>

      <div className="px-5 flex-1 flex flex-col justify-center gap-5 py-5">
        {task.type === 'intro' && (
          <div key={task.item.key} className="text-center j-rise" data-testid="ladder-intro">
            <div className="mn-eyebrow text-navy">Новое слово</div>
            <div className="mt-3 font-geo text-[44px] font-extrabold leading-none">{task.item.form}</div>
            <div className="mt-1 text-[14px] text-jewelInk-hint">{cyr(task.item.form)}</div>
            <div className="mt-4 text-[24px] font-extrabold text-navy" data-testid="ladder-meaning"><MeaningText meaning={task.item.meaning} /></div>
            {task.twin && (
              <div className="mt-2 text-[12px] text-jewelInk-hint">Пишется так же, как {quoted(task.twin.meaning)}.</div>
            )}
            {task.sentence && <SentenceBox sentence={task.sentence} />}
          </div>
        )}

        {task.type === 'meaning' && (
          <Prompt eyebrow="Что это значит?">
            <div className="font-geo text-[36px] font-extrabold leading-tight" data-testid="quiz-form">{task.item.form}</div>
            <div className="mt-1 text-[14px] text-jewelInk-hint">{cyr(task.item.form)}</div>
          </Prompt>
        )}

        {(task.type === 'form' || task.type === 'type') && (
          <Prompt eyebrow={task.type === 'form' ? 'Как сказать?' : 'Напиши сам'}>
            <div className="text-[30px] font-extrabold leading-tight" data-testid="ladder-meaning"><MeaningText meaning={task.item.meaning} /></div>
          </Prompt>
        )}

        {task.type === 'gap' && (
          <Prompt eyebrow="Вставь слово">
            <div className="font-geo text-[24px] font-extrabold leading-tight" data-testid="ladder-gap">
              {withGap(task.sentence.ka, task.sentence.form, solved)}
            </div>
            <div className="mt-2 text-[14px] text-jewelInk-mid">{task.sentence.ru}</div>
          </Prompt>
        )}

        {task.type === 'build' && (
          <Prompt eyebrow="Собери фразу">
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
                    <span className="block"><MeaningText meaning={o.meaning} /></span>
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
        {first && task.type === 'intro' && (
          <Coach>Запомни слово и нажми «Понятно» — дальше я буду его спрашивать.</Coach>
        )}
      </div>

      <div className="px-5 pb-5 flex flex-col gap-2" style={{ paddingBottom: typing ? 12 : 'calc(var(--safe-b, 0px) + 20px)' }}>
        {task.type === 'intro' && <Button onClick={understood} className={first ? PULSE : ''}>Понятно</Button>}
        {task.type === 'build' && !solved && (
          <Button disabled={built.length !== task.answer.length} onClick={checkBuilt}>Проверить</Button>
        )}
        {typing && <Button disabled={!typed.trim()} onClick={checkTyped}>Проверить</Button>}
        {/* На экзамене не подсматривают; в обычной игре — можно: задание под таблицей остаётся как было. */}
        {typing && !exam && <TablePeek verbId={verb.id} verb={verb} person={task.item.person} />}
        {waitNext && <Button onClick={advance}>Дальше</Button>}
      </div>
      {typing && <GeorgianKeyboard value={typed} onChange={setTyped} />}
    </div>
  )
}
