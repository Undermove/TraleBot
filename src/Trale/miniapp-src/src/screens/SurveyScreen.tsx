import { useEffect, useState } from 'react'
import Header from '../components/Header'
import LoaderLetter from '../components/LoaderLetter'
import SurveyFormPages from '../components/SurveyFormPages'
import { ApiError, surveyApi, type SurveyAnswerDto, type SurveyFormDto } from '../api'
import { ProgressState } from '../types'

interface Props {
  progress: ProgressState
  /** Имя опроса из ссылки. */
  surveyKey: string
  onBack: () => void
}

/**
 * Форма опроса для получателя рассылки. Сюда ведёт кнопка «Продолжить» под ответом на первый вопрос
 * в боте: тот ответ уже записан, форма открывается на следующем вопросе. Кому опрос не отправляли,
 * тот формы не увидит — сервер отвечает 404.
 */
export default function SurveyScreen({ progress, surveyKey, onBack }: Props) {
  const [form, setForm] = useState<{ survey: SurveyFormDto; finished: boolean; answers: Record<string, SurveyAnswerDto> } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    surveyApi.open(surveyKey)
      .then(r => { if (!cancelled) setForm(r) })
      .catch(e => {
        if (!cancelled) setProblem(e instanceof ApiError && e.status === 404 ? 'Этот опрос уже закрыт или был отправлен не тебе.' : 'Не получилось открыть опрос. Попробуй ещё раз.')
      })
    return () => { cancelled = true }
  }, [surveyKey])

  return (
    <div className="flex flex-col min-h-full bg-cream" data-testid="survey-screen">
      <Header progress={progress} onBack={onBack} eyebrow="от автора TraleBot" title="Опрос" />
      <div className="flex-1 px-5 pt-4" style={{ paddingBottom: 'calc(var(--safe-b) + 32px)' }}>
        {problem && (
          <div className="flex flex-col gap-3" data-testid="survey-problem">
            <div className="font-sans text-[15px] text-jewelInk">{problem}</div>
            <button type="button" onClick={onBack} className="jewel-btn jewel-btn-gold w-full font-sans text-[16px] font-extrabold">Вернуться</button>
          </div>
        )}
        {!form && !problem && <div className="flex justify-center py-12"><LoaderLetter /></div>}
        {form && (
          <SurveyFormPages
            questions={form.survey.questions} initial={form.answers} finished={form.finished} otherLabel="Другое"
            save={(questionId, answer) => surveyApi.answer(surveyKey, questionId, answer)}
            finish={() => surveyApi.finish(surveyKey)}
            onExit={onBack}
          />
        )}
      </div>
    </div>
  )
}
