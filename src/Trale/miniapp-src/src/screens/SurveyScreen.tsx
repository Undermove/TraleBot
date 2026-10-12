import { useEffect, useState } from 'react'
import Header from '../components/Header'
import LoaderLetter from '../components/LoaderLetter'
import SurveyFormPages from '../components/SurveyFormPages'
import SurveyGiftIntro from '../components/SurveyGiftIntro'
import { ApiError, surveyApi, type SurveyAnswerDto, type SurveyFormDto, type SurveyGiftDto } from '../api'
import { takeCampaignGift } from '../campaignOpen'
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
 *
 * У опроса с подарком сюда ведёт единственная кнопка под сообщением: подарок выдан самим открытием,
 * и первый экран говорит, что человек получил, — вопросы начинаются только по его желанию.
 */
export default function SurveyScreen({ progress, surveyKey, onBack }: Props) {
  const [form, setForm] = useState<{ survey: SurveyFormDto; finished: boolean; answers: Record<string, SurveyAnswerDto>; gift?: SurveyGiftDto | null } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  /** Человек нажал «Ответить на вопросы» на экране подарка. */
  const [started, setStarted] = useState(false)

  useEffect(() => {
    let cancelled = false
    // О подарке говорит этот экран — строка о нём в других разделах уже не нужна.
    takeCampaignGift()
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
        {form && form.gift && !started && !form.finished && (
          <SurveyGiftIntro gift={form.gift} questions={form.survey.questions.length} onStart={() => { setStarted(true); window.scrollTo(0, 0) }} onClose={onBack} />
        )}
        {form && (!form.gift || started || form.finished) && (
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
