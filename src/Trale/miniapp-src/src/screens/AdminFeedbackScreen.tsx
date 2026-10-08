import { useEffect, useState } from 'react'
import Header from '../components/Header'
import LoaderLetter from '../components/LoaderLetter'
import { Answers, Counts, answered, audienceName, day, paywallLabel } from '../components/admin/feedbackView'
import { adminFeedback, ApiError, type AdminFeedbackDto, type AdminFeedbackItem } from '../api'
import type { ProgressState, Screen } from '../types'

// «Отзывы» — подраздел админки, только чтение. Список: экран покупки («Что остановило?»), «Написали
// автору» и опросы по одному; по тапу — свой экран со счётчиками и текстами.
// То же самое за любой срок — scripts/sql/feedback-report.sql.

type View = Extract<Screen, { kind: 'admin-feedback' }>['view']

interface Props {
  progress: ProgressState
  view?: View
  navigate: (s: Screen) => void
}

const tile = 'jewel-tile jewel-pressable w-full text-left px-4 py-3 min-h-[56px]'
const small = 'font-sans text-[12px] text-jewelInk-mid'
const heading = 'font-sans text-[17px] font-extrabold text-jewelInk leading-snug'

/** Какие ответы нужны экрану: у списка — только счётчики, у остальных — свои тексты. */
function only(view: View): { kind?: AdminFeedbackItem['kind']; campaign?: string; take?: number } {
  if (view === 'paywall') return { kind: 'paywall' }
  if (view === 'messages') return { kind: 'message' }
  return view ? { kind: 'message', campaign: view.survey } : { take: 1 }
}

export default function AdminFeedbackScreen({ progress, view, navigate }: Props) {
  const [data, setData] = useState<AdminFeedbackDto | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const surveyKey = typeof view === 'object' ? view.survey : null

  useEffect(() => {
    let cancelled = false
    setData(null)
    adminFeedback.overview(only(view))
      .then(d => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setProblem(e instanceof ApiError && e.status === 404 ? 'Нет доступа.' : 'Не получилось загрузить. Попробуй ещё раз.') })
    return () => { cancelled = true }
  }, [view === undefined ? '' : typeof view === 'string' ? view : view.survey]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = (next: View) => navigate({ kind: 'admin-feedback', view: next })
  const openUser = (telegramId: number) => navigate({ kind: 'admin-user', telegramId })
  const back = () => navigate(view ? { kind: 'admin-feedback' } : { kind: 'admin' })
  const survey = data?.surveys.find(s => s.key === surveyKey)
  const question = (key: string | null) => data?.surveys.find(s => s.key === key)?.question

  return (
    <div className="flex flex-col min-h-full bg-cream" data-testid="admin-feedback-screen">
      <Header progress={progress} onBack={back} eyebrow="админка" title="Отзывы" />
      <div className="flex-1 px-5 pt-4" style={{ paddingBottom: 'calc(var(--safe-b) + 32px)' }}>
        {problem && <div className="font-sans text-[14px] text-jewelInk" data-testid="feedback-problem">{problem}</div>}
        {!data && !problem && <div className="flex justify-center py-12"><LoaderLetter /></div>}

        {data && !view && (
          <div className="flex flex-col gap-2" data-testid="feedback-list">
            <button type="button" className={tile} onClick={() => open('paywall')} data-testid="feedback-open-paywall">
              <div className="relative z-[1]">
                <div className="font-sans text-[15px] font-extrabold text-jewelInk">Что остановило? — экран покупки</div>
                <div className={`${small} tabular-nums mt-0.5`}>спросили {data.paywall.shown} · ответили {answered(data.paywall.options)}</div>
              </div>
            </button>
            <button type="button" className={tile} onClick={() => open('messages')} data-testid="feedback-open-messages">
              <div className="relative z-[1]">
                <div className="font-sans text-[15px] font-extrabold text-jewelInk">Написали автору</div>
                <div className={`${small} tabular-nums mt-0.5`}>сообщений: {data.messages}</div>
              </div>
            </button>

            <div className="mn-eyebrow mt-4 mb-1">Опросы</div>
            {data.surveys.length === 0 && (
              <div className="font-sans text-[13px] text-jewelInk-mid">
                Опросов пока не было.{' '}
                <button type="button" className="underline text-navy font-bold min-h-[44px]" onClick={() => navigate({ kind: 'admin-survey' })}>
                  Собрать первый
                </button>
              </div>
            )}
            {data.surveys.map(s => (
              <button key={s.key} type="button" className={tile} onClick={() => open({ survey: s.key })} data-testid={`feedback-open-survey-${s.key}`}>
                <div className="relative z-[1]">
                  <div className="font-sans text-[15px] font-extrabold text-jewelInk line-clamp-2">{s.question}</div>
                  <div className={`${small} tabular-nums mt-0.5`}>
                    {day(s.createdAtUtc)} · {audienceName(s.audience)} · дошло {s.sent} · ответили {answered(s.options)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {data && view === 'paywall' && (
          <div data-testid="feedback-paywall">
            <div className={heading}>Что остановило? — экран покупки</div>
            <div className={`${small} tabular-nums mb-3`}>
              Вопрос после закрытого без оплаты экрана покупки. Спросили {data.paywall.shown} · ответили {answered(data.paywall.options)}
            </div>
            <Counts options={data.paywall.options} label={paywallLabel} />
            <div className="mn-eyebrow mt-5 mb-1">Ответы</div>
            <Answers items={data.recent} empty="Пока никто не ответил." onOpenUser={openUser} />
          </div>
        )}

        {data && view === 'messages' && (
          <div data-testid="feedback-messages">
            <div className={heading}>Написали автору</div>
            <div className={`${small} tabular-nums mb-3`}>Сообщения с экрана «Написать автору» и по кнопке «Написать подробнее» из опросов. Всего: {data.messages}</div>
            <Answers
              items={data.recent} empty="Пока никто ничего не написал." onOpenUser={openUser}
              tag={r => (question(r.campaignKey) ? `из опроса: ${question(r.campaignKey)}` : null)}
            />
          </div>
        )}

        {data && surveyKey && (survey ? (
          <div data-testid="feedback-survey">
            <div className={heading}>{survey.question}</div>
            <div className={`${small} tabular-nums mb-3`}>
              {day(survey.createdAtUtc)} · {audienceName(survey.audience)} · дошло {survey.sent} · ответили {answered(survey.options)}
            </div>
            <Counts options={survey.options} />
            <div className="mn-eyebrow mt-5 mb-1">Написали подробнее</div>
            <Answers items={data.recent} empty="Подробнее пока никто не написал." onOpenUser={openUser} />
          </div>
        ) : <div className="font-sans text-[14px] text-jewelInk">Такого опроса нет.</div>)}
      </div>
    </div>
  )
}
