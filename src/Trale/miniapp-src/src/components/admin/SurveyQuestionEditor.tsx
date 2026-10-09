import { useState } from 'react'
import { CloseIcon } from '../../verbs/ui/icons'
import type { SurveyBuilderKitDto, SurveyQuestionDto } from '../../api'
import { headlineOf, keysOf, withOptions } from './surveyHeadline'

// Один вопрос опроса на своём экране: текст, тип, варианты ответа и переключатель «Другое — свой ответ».
// Варианты правятся тапами: назвать, убрать крестиком, добавить свой или готовый.

interface Props {
  question: SurveyQuestionDto
  number: number
  total: number
  kit: Pick<SurveyBuilderKitDto, 'suggestions' | 'limits' | 'otherLabel'>
  /** Почему вопрос в таком виде не отправить (см. questionProblem в конструкторе). */
  problem: string | null
  onChange: (q: SurveyQuestionDto) => void
  onDone: () => void
}

const field = 'w-full px-3 py-2 rounded-xl border-[1.5px] border-jewelInk bg-white font-sans text-[15px] text-jewelInk'
const action = 'w-full min-h-[52px] px-4 rounded-xl border-[1.5px] border-jewelInk font-sans text-[15px] font-extrabold text-jewelInk disabled:opacity-40'
const small = 'font-sans text-[12px] text-jewelInk-mid'
const pick = (on: boolean) => ({
  borderColor: on ? '#15100A' : 'rgba(21,16,10,0.18)', background: on ? '#FBF6EC' : '#FFFEFA', boxShadow: on ? '0 2px 0 #15100A' : 'none'
})

export default function SurveyQuestionEditor({ question, number, total, kit, problem, onChange, onDone }: Props) {
  const [renaming, setRenaming] = useState<number | null>(null)
  const first = number === 1
  const { options } = question
  const max = first ? kit.limits.botOptions : kit.limits.options
  const canAdd = options.length < max
  const offered = kit.suggestions.filter(s => !options.map(o => o.trim()).includes(s))

  // Имена вариантов (optionKeys) ходят вместе с вариантами: переименование их не трогает, удаление убирает вместе с вариантом.
  const keys = keysOf(question)
  const rename = (i: number, value: string) => onChange(withOptions(question, options.map((x, j) => (j === i ? value : x)), keys))
  const remove = (i: number) => onChange(withOptions(question, options.filter((_, j) => j !== i), keys.filter((_, j) => j !== i)))
  const addOption = (value = '') => {
    if (!canAdd) return
    onChange(withOptions(question, [...options, value], [...keys, '']))
    setRenaming(value ? null : options.length)
  }
  const headline = headlineOf(question)
  const setKind = (kind: SurveyQuestionDto['kind']) => onChange({ ...question, kind, allowOther: kind === 'choice' ? question.allowOther : false })

  return (
    <div className="flex flex-col gap-3" data-testid="survey-question-editor">
      <div>
        <div className="mn-eyebrow text-navy">Вопрос {number} из {total}{first ? ' · придёт в бот' : ''}</div>
        {first && <div className={`${small} mt-1`}>Первый вопрос человек видит прямо в сообщении бота и отвечает кнопкой, поэтому он с вариантами и их не больше {kit.limits.botOptions}.</div>}
      </div>

      <div className="mn-eyebrow">Текст вопроса</div>
      <textarea
        className={field} rows={3} value={question.text} aria-label="Текст вопроса" maxLength={kit.limits.questionLength}
        placeholder="О чём спросить" onChange={e => onChange({ ...question, text: e.target.value })}
      />

      <div className="mn-eyebrow mt-1">Как отвечать</div>
      <div className="flex gap-2" role="radiogroup" aria-label="Как отвечать">
        {([['choice', 'Выбор варианта'], ['text', 'Свободный ответ']] as const).map(([kind, name]) => (
          <button
            key={kind} type="button" role="radio" aria-checked={question.kind === kind} disabled={first && kind === 'text'} onClick={() => setKind(kind)}
            className="flex-1 px-2 rounded-xl border-2 min-h-[48px] font-sans text-[14px] font-bold text-jewelInk disabled:opacity-40" style={pick(question.kind === kind)}
          >
            {name}
          </button>
        ))}
      </div>

      {question.kind === 'choice' ? (
        <>
          <div className="mn-eyebrow mt-1">Варианты · {options.length} из {max}</div>
          <div className="flex flex-col gap-2" data-testid="survey-options">
            {options.map((o, i) => (
              <div key={i} className="flex items-stretch gap-2">
                {renaming === i ? (
                  <input
                    className={`${field} flex-1 min-w-0 min-h-[48px]`} autoFocus value={o} aria-label={`Вариант ${i + 1}`} maxLength={kit.limits.optionLength}
                    onChange={e => rename(i, e.target.value)} onBlur={() => setRenaming(null)}
                    onKeyDown={e => { if (e.key === 'Enter') setRenaming(null) }}
                  />
                ) : (
                  <button type="button" onClick={() => setRenaming(i)} data-testid={`survey-option-${i}`} className={`${field} flex-1 min-w-0 text-left min-h-[48px] font-bold break-words`}>
                    {o.trim() || <span className="text-jewelInk-hint font-normal">Нажми, чтобы назвать</span>}
                  </button>
                )}
                <button
                  type="button" onClick={() => { remove(i); setRenaming(null) }} aria-label={`Убрать вариант ${o.trim() || i + 1}`}
                  className="shrink-0 w-12 min-h-[48px] rounded-xl border-[1.5px] border-jewelInk/40 flex items-center justify-center"
                >
                  <CloseIcon size={18} />
                </button>
              </div>
            ))}
          </div>
          {canAdd && <button type="button" onClick={() => addOption()} data-testid="survey-add-option" className={action}>Добавить вариант</button>}
          {canAdd && offered.length > 0 && (
            <div>
              <div className={`${small} mb-1.5`}>или возьми готовый:</div>
              <div className="flex flex-wrap gap-2" data-testid="survey-suggestions">
                {offered.map(s => (
                  <button key={s} type="button" onClick={() => addOption(s)} className="px-3 min-h-[44px] rounded-xl border-[1.5px] border-jewelInk/40 bg-white font-sans text-[14px] text-jewelInk">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="button" role="switch" aria-checked={question.allowOther} onClick={() => onChange({ ...question, allowOther: !question.allowOther })} data-testid="survey-other"
            className="flex items-center justify-between gap-3 text-left px-4 py-2 rounded-xl border-2 min-h-[56px]" style={pick(question.allowOther)}
          >
            <span>
              <span className="block font-sans text-[15px] font-bold text-jewelInk">«{kit.otherLabel}» — свой ответ</span>
              <span className={`block ${small}`}>Ещё одна кнопка; выбрав её, человек может написать своими словами</span>
            </span>
            <span className="shrink-0 font-sans text-[13px] font-extrabold text-jewelInk">{question.allowOther ? 'вкл' : 'выкл'}</span>
          </button>
        </>
      ) : (
        <div className={small}>Человек увидит вопрос и поле, куда можно написать что угодно.</div>
      )}

      {headline.kind === 'ok' && (
        <div className={small} data-testid="survey-headline-ok">
          В результатах по этому вопросу будет главная цифра: доля «{headline.option}» среди ответивших
          {headline.without ? `, не считая тех, кто выбрал «${headline.without}»` : ''}. Кнопки можно переименовать — цифра останется; убрать любую из этих двух — пропадёт.
        </div>
      )}
      {headline.kind === 'lost' && (
        <div className="font-sans text-[13px] font-bold text-ruby" data-testid="survey-headline-lost">
          Главной цифры по этому вопросу в результатах не будет: {headline.why}. Чтобы вернуть её, добавь вопрос из готовых заново.
        </div>
      )}

      {problem && <div className="font-sans text-[13px] text-ruby" data-testid="survey-editor-problem">{problem}</div>}
      <button type="button" className="jewel-btn jewel-btn-gold w-full mt-2 font-sans text-[16px] font-extrabold" onClick={onDone} data-testid="survey-question-done">Готово</button>
    </div>
  )
}
