import { useState } from 'react'
import Mascot from './Mascot'
import KilimProgress from './KilimProgress'
import { FEEDBACK_MAX_LENGTH, type SurveyAnswerDto, type SurveyQuestionDto } from '../api'

// Форма опроса: один вопрос на странице. Ответ сохраняется при переходе на следующую страницу —
// брошенная посередине форма всё равно даёт ответы. Вопрос можно пропустить: тогда ничего не пишется
// и ничего не стирается. Этот же компонент показывает владельцу предпросмотр в конструкторе —
// там save и finish ничего не отправляют.

interface Props {
  questions: SurveyQuestionDto[]
  /** Что человек уже ответил (например, первый вопрос — кнопкой в боте). */
  initial: Record<string, SurveyAnswerDto>
  /** Форма уже пройдена до конца: сначала «уже ответил», править — по желанию. */
  finished: boolean
  /** Подпись варианта «свой ответ». */
  otherLabel: string
  save: (questionId: string, answer: SurveyAnswerDto) => Promise<unknown>
  finish: () => Promise<unknown>
  onExit: () => void
  /** Предпросмотр владельца: ответы никуда не записываются. */
  preview?: boolean
}

const idOf = (q: SurveyQuestionDto, index: number) => q.id ?? `q${index + 1}`
const said = (a: SurveyAnswerDto | undefined) => Boolean(a && (a.option || a.other || a.text?.trim()))

/** С какой страницы начать: первый вопрос без ответа или «Другое», к которому ещё нет слов. */
export function firstOpenPage(questions: SurveyQuestionDto[], answers: Record<string, SurveyAnswerDto>): number {
  const index = questions.findIndex((q, i) => {
    const a = answers[idOf(q, i)]
    return !said(a) || (a.other && !a.text?.trim())
  })
  return index < 0 ? 0 : index
}

const choice = 'w-full text-left px-4 py-3 rounded-xl border-2 min-h-[52px] font-sans text-[16px] font-bold text-jewelInk break-words transition-all'
const area = 'w-full px-3 py-3 rounded-xl border-[1.5px] border-jewelInk bg-white font-sans text-[15px] text-jewelInk resize-none'
const quiet = 'font-sans text-[14px] text-jewelInk-mid text-center py-2 min-h-[44px] active:opacity-60'
const selectedStyle = (on: boolean) => ({
  borderColor: on ? '#15100A' : 'rgba(21,16,10,0.18)', background: on ? '#FBF6EC' : '#FFFEFA', boxShadow: on ? '0 2px 0 #15100A' : 'none'
})

export default function SurveyFormPages({ questions, initial, finished, otherLabel, save, finish, onExit, preview }: Props) {
  const [answers, setAnswers] = useState(initial)
  const [page, setPage] = useState(() => firstOpenPage(questions, initial))
  const [phase, setPhase] = useState<'already' | 'asking' | 'thanks'>(finished ? 'already' : 'asking')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  if (phase !== 'asking') {
    return (
      <div className="flex flex-col items-center gap-3 pt-6 text-center" data-testid={phase === 'thanks' ? 'survey-thanks' : 'survey-already'}>
        <Mascot mood="cheer" size={120} />
        <div className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight">Спасибо!</div>
        <div className="font-sans text-[14px] text-jewelInk-mid max-w-[290px]">
          {phase === 'thanks'
            ? 'Твои ответы у меня. Они помогут сделать TraleBot лучше.'
            : 'Твои ответы уже у меня. Если что-то изменилось — их можно поправить.'}
        </div>
        <button type="button" onClick={onExit} className="jewel-btn jewel-btn-gold w-full mt-3 font-sans text-[16px] font-extrabold">
          {preview ? 'Закрыть предпросмотр' : 'Вернуться'}
        </button>
        {phase === 'already' && (
          <button type="button" className={quiet} onClick={() => { setPage(0); setPhase('asking') }}>Поправить ответы</button>
        )}
      </div>
    )
  }

  const question = questions[page]
  const id = idOf(question, page)
  const answer = answers[id] ?? { option: null, other: false, text: null }
  const last = page === questions.length - 1
  const set = (next: SurveyAnswerDto) => { setAnswers({ ...answers, [id]: next }); setFailed(false) }
  const ready = question.kind === 'text' ? Boolean(answer.text?.trim()) : Boolean(answer.option) || answer.other

  async function move(saveFirst: boolean) {
    if (busy) return
    setBusy(true)
    setFailed(false)
    try {
      if (saveFirst) {
        await save(id, {
          option: answer.other ? null : answer.option,
          other: answer.other,
          text: question.kind === 'text' || answer.other ? answer.text?.trim() || null : null
        })
      }
      if (last) {
        await finish()
        setPhase('thanks')
      } else {
        setPage(page + 1)
      }
      window.scrollTo(0, 0)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3" data-testid="survey-page">
      <div className="flex items-center justify-between gap-3">
        <div className="mn-eyebrow text-navy" data-testid="survey-progress">Вопрос {page + 1} из {questions.length}</div>
        <KilimProgress done={page + 1} total={questions.length} size="sm" />
      </div>

      <div className="font-sans text-[20px] font-extrabold text-jewelInk leading-snug break-words" data-testid="survey-page-question">{question.text}</div>

      {question.kind === 'choice' ? (
        <div className="flex flex-col gap-2" role="radiogroup" aria-label={question.text}>
          {question.options.map(o => {
            const on = !answer.other && answer.option === o
            return (
              <button key={o} type="button" role="radio" aria-checked={on} className={choice} style={selectedStyle(on)} onClick={() => set({ option: o, other: false, text: answer.text })}>
                {o}
              </button>
            )
          })}
          {question.allowOther && (
            <button type="button" role="radio" aria-checked={answer.other} className={choice} style={selectedStyle(answer.other)} onClick={() => set({ option: null, other: true, text: answer.text })}>
              {otherLabel}
            </button>
          )}
          {answer.other && (
            <textarea
              className={area} rows={3} autoFocus maxLength={FEEDBACK_MAX_LENGTH} value={answer.text ?? ''} aria-label="Свой ответ"
              placeholder="Напиши свой ответ" onChange={e => set({ option: null, other: true, text: e.target.value })}
            />
          )}
        </div>
      ) : (
        <textarea
          className={area} rows={5} maxLength={FEEDBACK_MAX_LENGTH} value={answer.text ?? ''} aria-label="Твой ответ"
          placeholder="Пиши как есть" onChange={e => set({ option: null, other: false, text: e.target.value })}
        />
      )}

      {failed && <div className="font-sans text-[13px] text-ruby" data-testid="survey-page-error">Не получилось сохранить. Попробуй ещё раз.</div>}

      <button type="button" className="jewel-btn jewel-btn-gold w-full mt-1 font-sans text-[16px] font-extrabold" disabled={!ready || busy} onClick={() => move(true)} data-testid="survey-page-next">
        {last ? 'Готово' : 'Дальше'}
      </button>
      <div className="flex justify-between gap-3">
        {page > 0
          ? <button type="button" className={quiet} disabled={busy} onClick={() => { setPage(page - 1); setFailed(false) }}>Назад</button>
          : <span />}
        <button type="button" className={quiet} disabled={busy} onClick={() => move(false)}>Пропустить вопрос</button>
      </div>
    </div>
  )
}
