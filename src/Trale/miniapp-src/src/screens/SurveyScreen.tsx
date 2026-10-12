import { useEffect, useState } from 'react'
import Header from '../components/Header'
import LoaderLetter from '../components/LoaderLetter'
import SurveyFormPages from '../components/SurveyFormPages'
import { giftGiven } from '../components/SurveyGift'
import { ApiError, surveyApi, type SurveyAnswerDto, type SurveyFormDto, type SurveyGiftDto } from '../api'
import { ProgressState } from '../types'

// С чем мини-апп был запущен — запоминается при загрузке модуля, пока приложение не убрало параметры из адреса.
// В хэше Telegram передаёт данные запуска: без них перезапущенное приложение не узнало бы человека.
const launch = { search: window.location.search, hash: window.location.hash }

/** Запустить мини-апп заново так же, как он был запущен, только без ссылки на опрос. */
function restartApp() {
  const query = new URLSearchParams(launch.search)
  for (const key of ['screen', 's', 'c']) query.delete(key)
  const search = query.toString()
  window.history.replaceState({}, '', window.location.pathname + (search ? `?${search}` : '') + launch.hash)
  window.location.reload()
}

interface Props {
  progress: ProgressState
  /** Имя опроса из ссылки. */
  surveyKey: string
  onBack: () => void
  /** Запустить мини-апп заново — чтобы все экраны узнали о доступе, который только что дал подарок. */
  restart?: () => void
}

/**
 * Форма опроса для получателя рассылки. Сюда ведёт кнопка «Продолжить» под ответом на первый вопрос
 * в боте: тот ответ уже записан, форма открывается на следующем вопросе. Кому опрос не отправляли,
 * тот формы не увидит — сервер отвечает 404.
 *
 * У опроса с подарком сюда ведёт единственная кнопка под сообщением, и форма открывается сразу на
 * первом вопросе со строкой о подарке над ним. Подарок выдаётся после последнего вопроса — тому, кто
 * ответил хотя бы на один; последний экран говорит, что человек получил.
 */
export default function SurveyScreen({ progress, surveyKey, onBack, restart = restartApp }: Props) {
  const [form, setForm] = useState<{ survey: SurveyFormDto; finished: boolean; answers: Record<string, SurveyAnswerDto>; gift?: SurveyGiftDto | null } | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  /** Подарок выдан в этот заход: остальное приложение о новом доступе ещё не знает. */
  const [justGiven, setJustGiven] = useState(false)
  // Профиль загружен до подарка — после него приложение запускается заново, иначе экраны покупки остались бы на месте.
  const leave = () => (justGiven ? restart() : onBack())

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
      <Header progress={progress} onBack={leave} eyebrow="от автора TraleBot" title="Опрос" />
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
            gift={form.gift} onGift={g => { if (giftGiven(g) && !g.trial && !giftGiven(form.gift)) setJustGiven(true) }}
            save={(questionId, answer) => surveyApi.answer(surveyKey, questionId, answer)}
            finish={() => surveyApi.finish(surveyKey)}
            onExit={leave}
          />
        )}
      </div>
    </div>
  )
}
