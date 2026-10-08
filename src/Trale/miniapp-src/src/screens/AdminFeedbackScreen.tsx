import { useEffect, useState } from 'react'
import Header from '../components/Header'
import LoaderLetter from '../components/LoaderLetter'
import { Answers, Counts, answered, audienceName, day, paywallLabel } from '../components/admin/feedbackView'
import { adminFeedback, ApiError, type AdminFeedbackDto, type AdminFeedbackItem, type AdminSurveyDto, type AdminSurveyResultsDto } from '../api'
import type { ProgressState, Screen } from '../types'

// «Отзывы» — подраздел админки, только чтение. Список: экран покупки («Что остановило?»), «Написали
// автору» и опросы по одному; по тапу — свой экран. У опроса: воронка (получили → ответили на первый
// вопрос → открыли форму → дошли до конца), потом каждый вопрос со счётчиками и текстами; ответы можно
// сузить до тех, кто выбрал определённый вариант первого вопроса.
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

/** Какие ответы нужны экрану: у списка и опроса — только счётчики, у остальных — свои тексты. */
function only(view: View): { kind?: AdminFeedbackItem['kind']; take?: number } {
  if (view === 'paywall') return { kind: 'paywall' }
  if (view === 'messages') return { kind: 'message' }
  return { take: 1 }
}

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((100 * part) / whole)}%` : '—')

/** Как далеко дошли люди: каждая ступень — число и доля от получивших. */
function Funnel({ survey }: { survey: AdminSurveyDto }) {
  const f = survey.funnel
  const steps: [string, number][] = [['получили', f.sent], ['ответили на первый вопрос', f.answeredFirst]]
  if (survey.questions > 1) steps.push(['открыли форму в мини-аппе', f.openedForm], ['дошли до конца', f.finished])
  return (
    <div className="flex flex-col gap-2" data-testid="feedback-funnel">
      {steps.map(([name, count], i) => (
        <div key={name}>
          <div className="flex justify-between gap-3 font-sans text-[14px] text-jewelInk">
            <span>{name}</span>
            <span className="tabular-nums font-extrabold shrink-0">
              {count}{i > 0 && <span className="font-normal text-jewelInk-mid"> · {pct(count, f.sent)}</span>}
            </span>
          </div>
          <div className="h-1.5 rounded bg-jewelInk/10 mt-0.5">
            <div className="h-1.5 rounded bg-gold" style={{ width: f.sent ? `${Math.min(100, (100 * count) / f.sent)}%` : 0 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AdminFeedbackScreen({ progress, view, navigate }: Props) {
  const [data, setData] = useState<AdminFeedbackDto | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const surveyKey = typeof view === 'object' ? view.survey : null
  const [results, setResults] = useState<AdminSurveyResultsDto | null>(null)
  /** Вариант первого вопроса, по которому сужены ответы на остальные; null — все. */
  const [segment, setSegment] = useState<string | null>(null)

  useEffect(() => { setSegment(null); setResults(null) }, [surveyKey])
  useEffect(() => {
    if (!surveyKey) return
    let cancelled = false
    adminFeedback.survey(surveyKey, segment)
      .then(r => { if (!cancelled) setResults(r) })
      .catch(e => { if (!cancelled) setProblem(e instanceof ApiError && e.status === 404 ? 'Такого опроса нет.' : 'Не получилось загрузить. Попробуй ещё раз.') })
    return () => { cancelled = true }
  }, [surveyKey, segment])

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
  const survey = results?.summary
  const question = (key: string | null) => data?.surveys.find(s => s.key === key)?.title

  return (
    <div className="flex flex-col min-h-full bg-cream" data-testid="admin-feedback-screen">
      <Header progress={progress} onBack={back} eyebrow="админка" title="Отзывы" />
      <div className="flex-1 px-5 pt-4" style={{ paddingBottom: 'calc(var(--safe-b) + 32px)' }}>
        {problem && <div className="font-sans text-[14px] text-jewelInk" data-testid="feedback-problem">{problem}</div>}
        {(!data || (surveyKey && !results)) && !problem && <div className="flex justify-center py-12"><LoaderLetter /></div>}

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
                  <div className="font-sans text-[15px] font-extrabold text-jewelInk line-clamp-2 break-words">{s.title}</div>
                  <div className={`${small} tabular-nums mt-0.5`}>
                    {day(s.createdAtUtc)} · {audienceName(s.audience)} · вопросов: {s.questions}
                  </div>
                  <div className={`${small} tabular-nums`}>
                    получили {s.funnel.sent} · ответили {s.funnel.answeredFirst}{s.questions > 1 ? ` · дошли до конца ${s.funnel.finished}` : ''}
                  </div>
                  {s.pending > 0 && (
                    <div className="font-sans text-[12px] font-bold text-ruby tabular-nums">не дослано: отправлено {s.picked - s.pending} из {s.picked}</div>
                  )}
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

        {data && surveyKey && results && survey && (
          <div data-testid="feedback-survey">
            <div className={`${heading} break-words`}>{survey.title}</div>
            <div className={`${small} tabular-nums mb-3`}>
              {day(survey.createdAtUtc)} · {audienceName(survey.audience)} · вопросов: {survey.questions}
            </div>
            {survey.pending > 0 ? (
              <div className="mb-4" data-testid="feedback-survey-unfinished">
                <div className="font-sans text-[13px] font-bold text-ruby tabular-nums mb-1.5">
                  Не дослано: отправлено {survey.picked - survey.pending} из {survey.picked}
                </div>
                <button
                  type="button" onClick={() => navigate({ kind: 'admin-survey', resume: survey.key })} data-testid="feedback-survey-resume"
                  className="w-full min-h-[52px] px-4 rounded-xl border-[1.5px] border-jewelInk font-sans text-[15px] font-extrabold text-jewelInk"
                  style={{ background: '#F5B820' }}
                >
                  Продолжить отправку
                </button>
              </div>
            ) : (
              <button
                type="button" onClick={() => navigate({ kind: 'admin-survey', resume: survey.key })} data-testid="feedback-survey-more"
                className="font-sans text-[13px] font-bold text-navy underline min-h-[44px] mb-2 text-left"
              >
                Отправить остальным из этой группы
              </button>
            )}

            <div className="mn-eyebrow mb-2">Как далеко дошли</div>
            <Funnel survey={survey} />

            {survey.questions > 1 && (
              <div className="mt-5" data-testid="feedback-segments">
                <div className="mn-eyebrow mb-1">Чьи ответы показать</div>
                <div className={`${small} mb-2`}>Все — или только те, кто на первый вопрос ответил так:</div>
                <div className="flex flex-wrap gap-2">
                  {[null, ...results.questions[0].options.map(o => o.option)].map(o => (
                    <button
                      key={o ?? ''} type="button" aria-pressed={segment === o} onClick={() => setSegment(o)}
                      className="px-3 min-h-[44px] rounded-xl border-2 font-sans text-[13px] font-bold text-jewelInk"
                      style={{ borderColor: segment === o ? '#15100A' : 'rgba(21,16,10,0.18)', background: segment === o ? '#FBF6EC' : '#FFFEFA' }}
                    >
                      {o ?? 'Все'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {results.questions.map((q, i) => (
              <div key={q.id} className="mt-6" data-testid={`feedback-question-${q.id}`}>
                <div className="mn-eyebrow text-navy">Вопрос {i + 1}{i === 0 && survey.questions > 1 ? ' · в боте' : ''}</div>
                <div className="font-sans text-[16px] font-extrabold text-jewelInk leading-snug break-words">{q.text}</div>
                <div className={`${small} tabular-nums mb-2`}>ответили {q.answered}</div>
                {q.headline && (
                  <div className="rounded-xl border-[1.5px] border-jewelInk bg-white px-3 py-2 mb-3" data-testid="feedback-headline">
                    <div className="font-sans text-[22px] font-extrabold text-jewelInk tabular-nums leading-none">{pct(q.headline.chose, q.headline.of)}</div>
                    <div className={`${small} mt-1`}>
                      «{q.headline.option}» — {q.headline.chose} из {q.headline.of}
                      {q.headline.without ? ` (без тех, кто ответил «${q.headline.without}»)` : ''}
                    </div>
                  </div>
                )}
                {q.kind === 'choice' && <Counts options={q.options} />}
                {(q.texts.length > 0 || q.kind === 'text') && (
                  <div className="mt-2">
                    <Answers items={q.texts} empty="Пока никто ничего не написал." onOpenUser={openUser} />
                  </div>
                )}
              </div>
            ))}

            {results.written.length > 0 && (
              <>
                <div className="mn-eyebrow mt-6 mb-1">Написали подробнее</div>
                <Answers items={results.written} empty="" onOpenUser={openUser} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
