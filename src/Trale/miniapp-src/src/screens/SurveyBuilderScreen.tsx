import { useEffect, useState } from 'react'
import Header from '../components/Header'
import LoaderLetter from '../components/LoaderLetter'
import SurveyFormPages from '../components/SurveyFormPages'
import SurveyQuestionEditor from '../components/admin/SurveyQuestionEditor'
import { AUDIENCES } from '../components/admin/CampaignPanel'
import { CloseIcon } from '../verbs/ui/icons'
import {
  adminCampaigns, adminFeedback, adminSurveys, ApiError,
  type AdminSurveyDto, type CampaignAudience, type CampaignStatusDto, type SurveyBuilderKitDto, type SurveyFormDto,
  type SurveyPresetDto, type SurveyQuestionDto
} from '../api'
import type { ProgressState, Screen } from '../types'

// Конструктор опроса — подраздел админки. Опрос — форма из нескольких вопросов: первый приходит человеку
// в бот кнопками (один тап — уже ответ), остальные он проходит в мини-аппе, по вопросу на странице.
// Четыре шага, каждый на своём экране: выбрать готовую форму, собрать вопросы (каждый вопрос правится
// на отдельном экране), выбрать, кому, и отправить — сначала себе, потом людям порциями.
// Имя кампании владелец не придумывает: его даёт сервер, когда выбраны получатели. С этого момента
// вопросы уже не меняются — они ушли бы разным людям разными.
// Отправку можно бросить посередине (в группе сотни людей, порция — 25): начатый опрос остаётся на
// первом шаге в блоке «Не дослано», «Продолжить» возвращает на его отправку с тем, что уже сделано.

interface Props {
  progress: ProgressState
  /** Имя начатого опроса — открыть сразу его отправку. */
  resume?: string
  navigate: (s: Screen) => void
}

const STEPS = ['Выбери опрос', 'Вопросы', 'Кому отправить', 'Отправка']
const CUSTOM = 'custom'
const BATCH = 25
const PEOPLE = AUDIENCES.filter(a => a.id !== 'owner')

const primary = 'jewel-btn jewel-btn-gold flex-1 font-sans text-[16px] font-extrabold'
const secondary = 'jewel-btn jewel-btn-cream font-sans text-[15px] font-extrabold'
const action = 'w-full min-h-[52px] px-4 rounded-xl border-[1.5px] border-jewelInk font-sans text-[15px] font-extrabold text-jewelInk disabled:opacity-40'
const small = 'font-sans text-[12px] text-jewelInk-mid'
const field = 'w-full px-3 py-2 rounded-xl border-[1.5px] border-jewelInk bg-white font-sans text-[15px] text-jewelInk'
const iconButton = 'shrink-0 w-11 h-11 rounded-xl border-[1.5px] border-jewelInk/40 bg-white flex items-center justify-center disabled:opacity-30'

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    try { return JSON.parse(e.body).error ?? `ошибка ${e.status}` } catch { return `ошибка ${e.status}` }
  }
  return 'не получилось — проверь связь и попробуй ещё раз'
}

const Arrow = ({ up }: { up: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
    <path d={up ? 'M3 10 L8 5 L13 10' : 'M3 6 L8 11 L13 6'} stroke="#15100A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/** Почему вопрос в таком виде не отправить; null — всё в порядке. Те же правила проверяет сервер. */
export function questionProblem(q: SurveyQuestionDto, first: boolean, kit: Pick<SurveyBuilderKitDto, 'limits' | 'otherLabel'>): string | null {
  const options = q.options.map(o => o.trim()).filter(Boolean)
  if (!q.text.trim()) return 'Напиши текст вопроса.'
  if (q.text.trim().length > kit.limits.questionLength) return `Текст длиннее ${kit.limits.questionLength} символов.`
  if (first && q.kind === 'text') return 'Первый вопрос приходит в бот кнопками — ему нужны варианты ответа. Поставь свободный вопрос вторым или дальше.'
  if (q.kind === 'text') return null
  if (options.length < 2) return 'Нужно хотя бы два варианта ответа.'
  if (first && options.length > kit.limits.botOptions) return `Первый вопрос приходит в бот кнопками — у него не больше ${kit.limits.botOptions} вариантов. Убери лишние или поставь первым другой вопрос.`
  if (options.length > kit.limits.options) return `Не больше ${kit.limits.options} вариантов ответа.`
  if (new Set(options).size !== options.length) return 'Два варианта совпадают.'
  if (options.some(o => o.length > kit.limits.optionLength)) return `Вариант длиннее ${kit.limits.optionLength} символов.`
  if (q.allowOther && options.includes(kit.otherLabel)) return `«${kit.otherLabel}» уже добавляет переключатель — убери такой вариант из списка.`
  return null
}

const clean = (q: SurveyQuestionDto): SurveyQuestionDto => ({
  ...q, text: q.text.trim(), options: q.kind === 'choice' ? q.options.map(o => o.trim()).filter(Boolean) : [], allowOther: q.kind === 'choice' && q.allowOther
})

/** Сообщение так, как его увидит человек в Telegram: вступление, первый вопрос и кнопки-ответы под ним. */
function TelegramPreview({ intro, first, otherLabel }: { intro: string; first?: SurveyQuestionDto; otherLabel: string }) {
  const buttons = first ? [...first.options.filter(o => o.trim()), ...(first.kind === 'choice' && first.allowOther ? [otherLabel] : [])] : []
  return (
    <div className="rounded-2xl p-3" style={{ background: '#D5E0D0' }} data-testid="survey-preview">
      <div className="max-w-[92%]">
        <div className="rounded-2xl rounded-bl-md bg-white px-3 py-2 font-sans text-[15px] text-jewelInk whitespace-pre-wrap break-words shadow-sm">
          {intro.trim() && <>{intro.trim()}{'\n\n'}</>}
          {first?.text.trim() || <span className="text-jewelInk-hint">Здесь будет первый вопрос</span>}
        </div>
        <div className="flex flex-col gap-1 mt-1">
          {buttons.map((o, i) => (
            <div key={i} className="rounded-lg px-2 py-2 text-center font-sans text-[14px] font-bold text-white truncate" style={{ background: 'rgba(60,80,60,0.55)' }}>
              {o}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const summary = (q: SurveyQuestionDto, otherLabel: string) =>
  q.kind === 'text' ? 'свободный ответ' : [...q.options.filter(o => o.trim()), ...(q.allowOther ? [otherLabel] : [])].join(' · ')

export default function SurveyBuilderScreen({ progress, resume, navigate }: Props) {
  const [step, setStep] = useState(1)
  const [kit, setKit] = useState<SurveyBuilderKitDto | null>(null)
  /** Опросы, которым выбрали получателей, но отправили не всем. */
  const [unfinished, setUnfinished] = useState<AdminSurveyDto[]>([])
  const [resuming, setResuming] = useState(Boolean(resume))
  const [denied, setDenied] = useState<string | null>(null)

  const [presetId, setPresetId] = useState(CUSTOM)
  const [intro, setIntro] = useState('')
  const [questions, setQuestions] = useState<SurveyQuestionDto[]>([])
  /** Что открыто поверх списка вопросов: один вопрос, выбор готового вопроса или прогон формы. */
  const [view, setView] = useState<{ edit: number } | 'add' | 'preview' | 'intro' | null>(null)

  const [counts, setCounts] = useState<Partial<Record<CampaignAudience, number>>>({})
  const [audience, setAudience] = useState<CampaignAudience>('accessEnded')
  const [sampleFirst, setSampleFirst] = useState(true)
  const [sampleSize, setSampleSize] = useState(100)

  /** Имя кампании на сервере; появляется, когда выбраны получатели. */
  const [key, setKey] = useState<string | null>(null)
  const [status, setStatus] = useState<CampaignStatusDto | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    adminSurveys.presets()
      .then(setKit)
      .catch(e => setDenied(e instanceof ApiError && e.status === 404 ? 'Нет доступа.' : 'Не получилось загрузить. Попробуй ещё раз.'))
    adminCampaigns.audiences().then(setCounts).catch(() => {})
    adminFeedback.overview({ take: 1 }).then(r => setUnfinished(r.surveys.filter(s => s.pending > 0))).catch(() => {})
  }, [])

  const go = (next: number) => { setStep(next); setNote(null); setView(null); window.scrollTo(0, 0) }
  const show = (next: typeof view) => { setView(next); window.scrollTo(0, 0) }

  // Вернуться к начатому опросу: всё, что нужно, чтобы дослать, сервер помнит сам — вопросы, кому, сколько ждут.
  async function resumeSurvey(surveyKey: string) {
    setResuming(true)
    try {
      const current = await adminCampaigns.status(surveyKey)
      setKey(current.key)
      setStatus(current)
      setIntro(current.survey?.intro ?? '')
      setQuestions(current.survey?.questions ?? [])
      setAudience(current.audience)
      go(4)
    } catch (e) {
      setDenied(e instanceof ApiError && e.status === 404 ? 'Такого опроса нет.' : 'Не получилось загрузить. Попробуй ещё раз.')
    } finally {
      setResuming(false)
    }
  }
  useEffect(() => { if (resume) void resumeSurvey(resume) }, [resume]) // eslint-disable-line react-hooks/exhaustive-deps

  function choose(preset: SurveyPresetDto | null) {
    setPresetId(preset?.id ?? CUSTOM)
    setIntro(preset?.form.intro ?? kit!.intro)
    setQuestions(preset ? preset.form.questions.map(q => ({ ...q, options: [...q.options] })) : [])
    go(2)
    if (!preset) setView('add')
  }

  const ready = kit !== null && !resuming && !denied
  const problems = kit ? questions.map((q, i) => questionProblem(q, i === 0, kit)) : []
  // Почему пока нельзя дальше — одной фразой; null — всё в порядке.
  const problem = questions.length === 0 ? 'Добавь хотя бы один вопрос.'
    : problems.some(Boolean) ? `Поправь вопрос ${problems.findIndex(Boolean) + 1}: он отмечен красным.`
      : null
  const canAdd = kit !== null && questions.length < kit.limits.questions
  const form: SurveyFormDto = { intro: intro.trim() || null, questions: questions.map(clean) }

  const setQuestion = (i: number, q: SurveyQuestionDto) => setQuestions(questions.map((x, j) => (j === i ? q : x)))
  const move = (i: number, by: number) => {
    const next = [...questions]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    setQuestions(next)
  }
  const add = (q: SurveyQuestionDto, open: boolean) => {
    setQuestions([...questions, { ...q, id: undefined, options: [...q.options] }])
    show(open ? { edit: questions.length } : null)
  }

  const audienceTitle = PEOPLE.find(a => a.id === audience)?.name ?? audience
  const total = counts[audience]
  const frozen = key !== null
  const waiting = (status?.pending ?? 0) > 0
  const draft = (sample: number | null, dryRun: boolean, to: CampaignAudience = audience, test = false) => ({
    key: test ? '' : key ?? '', newSurveySlug: test ? `${presetId}-test` : presetId, audience: to,
    buttonText: null, buttonQuery: null, sampleSize: sample, dryRun, survey: form
  })

  async function run(work: () => Promise<string | null>) {
    setBusy(true)
    setNote(null)
    try { setNote(await work()) } catch (e) { setNote(errorText(e)) } finally { setBusy(false) }
  }

  // Себе — каждый раз новым пробным опросом: его можно пройти сколько угодно раз, людям он не уходит и в отзывы не попадает.
  const sendToMe = () => run(async () => {
    const trial = await adminCampaigns.prepare(draft(null, false, 'owner', true))
    if (trial.picked === 0) return 'Себе отправить не вышло: у тебя выключены уведомления бота.'
    const sent = await adminCampaigns.send(trial.key, 1)
    return sent.sent === 1
      ? 'Отправил тебе в чат с ботом. Ответь на первый вопрос кнопкой и пройди форму до конца — так её увидят люди.'
      : 'Telegram не принял сообщение. Попробуй ещё раз.'
  })

  const sample = !frozen && sampleFirst ? sampleSize : null
  const pick = () => run(async () => {
    const plan = await adminCampaigns.prepare(draft(sample, true))
    if (plan.picked === 0) return 'Выбирать некого: в этой группе все уже получили опрос.'
    const who = sample == null ? (frozen ? 'всех остальных' : 'всех') : 'пробную группу'
    if (!confirm(`Выбрать ${who}: ${plan.picked} чел. (${audienceTitle})?\nСообщения пока НЕ уйдут — только список получателей. Вопросы после этого уже не поменять.`)) return null
    const done = await adminCampaigns.prepare(draft(sample, false))
    setKey(done.key)
    setStatus(await adminCampaigns.status(done.key))
    return `Получатели записаны: ${done.picked} чел. Теперь отправляй порциями.`
  })

  const sendBatch = () => run(async () => {
    if (!key) return null
    const current = await adminCampaigns.status(key)
    setStatus(current)
    if (current.pending === 0) return 'Отправлять некого: все выбранные уже получили опрос.'
    const n = Math.min(BATCH, current.pending)
    if (!confirm(`ОТПРАВИТЬ опрос ${n} людям?\n\n${current.message}\n\nЭто настоящая отправка через бота.`)) return null
    const r = await adminCampaigns.send(key, BATCH)
    setStatus(r.status)
    const wait = r.retryAfterSeconds > 0 ? ` Telegram просит подождать ${r.retryAfterSeconds} с.` : ''
    return `Отправлено ${r.sent}, заблокировали бота ${r.blocked}, отказ ${r.rejected}, без ответа ${r.unknown}. Осталось ${r.status.pending}.${wait}`
  })

  const back = () => {
    if (view) return show(null)
    return step === 1 || frozen ? navigate({ kind: 'admin' }) : go(step - 1)
  }
  const answers = status?.surveyAnswers?.reduce((sum, a) => sum + a.count, 0) ?? 0
  const editing = typeof view === 'object' && view ? view.edit : null
  const offered = kit?.bank.filter(b => !questions.some(q => q.text.trim() === b.text)) ?? []

  return (
    <div className="flex flex-col min-h-full bg-cream" data-testid="survey-builder">
      <Header progress={progress} onBack={back} eyebrow={`шаг ${step} из ${STEPS.length}`} title="Опрос" />

      <div className="flex-1 px-5 pt-4 flex flex-col gap-3" style={{ paddingBottom: 'calc(var(--safe-b) + 32px)' }}>
        {denied && <div className="font-sans text-[14px] text-jewelInk">{denied}</div>}
        {(!kit || resuming) && !denied && <div className="flex justify-center py-12"><LoaderLetter /></div>}

        {ready && !view && (
          <div className="font-sans text-[20px] font-extrabold text-jewelInk leading-tight" data-testid="survey-step-title">{STEPS[step - 1]}</div>
        )}

        {ready && step === 1 && (
          <>
            {unfinished.length > 0 && (
              <div data-testid="survey-unfinished">
                <div className="mn-eyebrow text-ruby mb-2">Не дослано</div>
                <div className="flex flex-col gap-2">
                  {unfinished.map(s => (
                    <div key={s.key} className="jewel-tile px-4 py-3">
                      <div className="relative z-[1]">
                        <div className="font-sans text-[15px] font-extrabold text-jewelInk leading-snug line-clamp-2">{s.title}</div>
                        <div className={`${small} tabular-nums mt-0.5`}>отправлено {s.picked - s.pending} из {s.picked}</div>
                        <button type="button" className={`${action} mt-2`} style={{ background: '#F5B820' }} onClick={() => resumeSurvey(s.key)} data-testid={`survey-resume-${s.key}`}>
                          Продолжить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mn-eyebrow mt-5">Новый опрос</div>
              </div>
            )}
            <div className={small}>Вопросы уже написаны — на следующем шаге их можно поправить, убрать или добавить свои.</div>
            {kit!.presets.map(p => (
              <button key={p.id} type="button" onClick={() => choose(p)} data-testid={`survey-preset-${p.id}`} className="jewel-tile jewel-pressable w-full text-left px-4 py-3">
                <div className="relative z-[1]">
                  <div className="font-sans text-[17px] font-extrabold text-jewelInk leading-snug">{p.title}</div>
                  <div className={`${small} mb-2`}>{p.about} · вопросов: {p.form.questions.length}</div>
                  <ol className="flex flex-col gap-1">
                    {p.form.questions.map((q, i) => (
                      <li key={i} className="font-sans text-[13px] text-jewelInk leading-snug flex gap-1.5">
                        <span className="tabular-nums text-jewelInk-mid shrink-0">{i + 1}.</span><span className="min-w-0 break-words">{q.text}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </button>
            ))}
            <button type="button" onClick={() => choose(null)} data-testid="survey-preset-custom" className={action}>Собрать свой</button>
          </>
        )}

        {ready && step === 2 && !view && (
          <>
            <div className={small}>Первый вопрос придёт в бот кнопками — так, как на картинке. Остальные человек пройдёт в мини-аппе, по одному на странице.</div>
            <TelegramPreview intro={intro} first={questions[0]} otherLabel={kit!.otherLabel} />
            <button type="button" onClick={() => show('intro')} data-testid="survey-intro" className="font-sans text-[13px] font-bold text-navy underline min-h-[44px] text-left">
              Поменять вступление
            </button>

            <div className="flex flex-col gap-2" data-testid="survey-questions">
              {questions.map((q, i) => (
                <div key={i} className="jewel-tile px-3 py-3" data-testid={`survey-question-${i}`}>
                  <div className="relative z-[1]">
                    <button type="button" onClick={() => show({ edit: i })} className="w-full text-left min-h-[44px]" data-testid={`survey-question-open-${i}`}>
                      <div className="mn-eyebrow text-navy">Вопрос {i + 1}{i === 0 ? ' · в боте' : ''}</div>
                      <div className="font-sans text-[15px] font-extrabold text-jewelInk leading-snug break-words">
                        {q.text.trim() || <span className="text-jewelInk-hint font-normal">Без текста</span>}
                      </div>
                      <div className={`${small} break-words mt-0.5`}>{summary(q, kit!.otherLabel)}</div>
                    </button>
                    {problems[i] && <div className="font-sans text-[12px] font-bold text-ruby mt-1" data-testid={`survey-question-problem-${i}`}>{problems[i]}</div>}
                    <div className="flex items-center gap-2 mt-2">
                      <button type="button" className={`${action} !min-h-[44px] flex-1`} onClick={() => show({ edit: i })}>Изменить</button>
                      <button type="button" className={iconButton} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Поднять вопрос ${i + 1}`}><Arrow up /></button>
                      <button type="button" className={iconButton} disabled={i === questions.length - 1} onClick={() => move(i, 1)} aria-label={`Опустить вопрос ${i + 1}`}><Arrow up={false} /></button>
                      <button type="button" className={iconButton} onClick={() => setQuestions(questions.filter((_, j) => j !== i))} aria-label={`Убрать вопрос ${i + 1}`}><CloseIcon size={18} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {canAdd
              ? <button type="button" className={action} onClick={() => show('add')} data-testid="survey-add-question">Добавить вопрос</button>
              : <div className={small}>В опросе не больше {kit!.limits.questions} вопросов.</div>}
            <button type="button" className={action} disabled={problem !== null} onClick={() => show('preview')} data-testid="survey-try">Посмотреть как пользователь</button>
            {problem && <div className="font-sans text-[13px] text-ruby" data-testid="survey-problem">{problem}</div>}
          </>
        )}

        {ready && step === 2 && view === 'intro' && (
          <>
            <div className="font-sans text-[20px] font-extrabold text-jewelInk leading-tight">Вступление</div>
            <div className={small}>Строка перед первым вопросом в сообщении бота. Можно оставить пустой.</div>
            <textarea className={field} rows={4} autoFocus maxLength={500} value={intro} aria-label="Вступление" onChange={e => setIntro(e.target.value)} />
            <button type="button" className={primary} onClick={() => show(null)}>Готово</button>
          </>
        )}

        {ready && step === 2 && editing !== null && questions[editing] && (
          <SurveyQuestionEditor
            question={questions[editing]} number={editing + 1} total={questions.length} kit={kit!}
            problem={problems[editing]} onChange={q => setQuestion(editing, q)} onDone={() => show(null)}
          />
        )}

        {ready && step === 2 && view === 'add' && (
          <div className="flex flex-col gap-2" data-testid="survey-bank">
            <div className="font-sans text-[20px] font-extrabold text-jewelInk leading-tight">Добавить вопрос</div>
            <button type="button" className={action} onClick={() => add({ text: '', kind: 'choice', options: [], allowOther: true }, true)} data-testid="survey-new-choice">Свой вопрос с вариантами</button>
            <button type="button" className={action} onClick={() => add({ text: '', kind: 'text', options: [], allowOther: false }, true)} data-testid="survey-new-text">Свой вопрос — свободный ответ</button>
            {offered.length > 0 && <div className="mn-eyebrow mt-3">Готовые вопросы</div>}
            {offered.map(q => (
              <button key={q.text} type="button" onClick={() => add(q, false)} className="jewel-tile jewel-pressable w-full text-left px-4 py-3 min-h-[56px]">
                <div className="relative z-[1]">
                  <div className="font-sans text-[15px] font-extrabold text-jewelInk leading-snug break-words">{q.text}</div>
                  <div className={`${small} break-words mt-0.5`}>{summary(q, kit!.otherLabel)}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {ready && step === 2 && view === 'preview' && (
          <div data-testid="survey-try-form">
            <div className="rounded-xl border-[1.5px] border-jewelInk/30 bg-white px-3 py-2 mb-4 font-sans text-[12px] text-jewelInk-mid">
              Предпросмотр: так форму увидит человек. Ответы никуда не записываются.
            </div>
            <SurveyFormPages
              questions={form.questions} initial={{}} finished={false} otherLabel={kit!.otherLabel} preview
              save={async () => {}} finish={async () => {}} onExit={() => show(null)}
            />
          </div>
        )}

        {ready && step === 3 && (
          <>
            <div className={small}>Без тех, кто заблокировал бота или выключил уведомления.</div>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Кому отправить">
              {PEOPLE.map(a => {
                const selected = a.id === audience
                return (
                  <button
                    key={a.id} type="button" role="radio" aria-checked={selected} onClick={() => setAudience(a.id)} data-testid={`survey-audience-${a.id}`}
                    className="flex items-center justify-between gap-3 text-left px-4 py-2 rounded-xl border-2 min-h-[52px] font-sans text-[15px] font-bold text-jewelInk"
                    style={{ borderColor: selected ? '#15100A' : 'rgba(21,16,10,0.18)', background: selected ? '#FBF6EC' : '#FFFEFA', boxShadow: selected ? '0 2px 0 #15100A' : 'none' }}
                  >
                    <span className="first-letter:uppercase min-w-0">{a.name}</span>
                    <span className="tabular-nums font-extrabold shrink-0">{counts[a.id] ?? '…'}</span>
                  </button>
                )
              })}
            </div>
            <div className={small}>
              «Занимались» — отвечали в уроке, добавляли слово, начинали квиз или игру с глаголом; у новичков без занятий считается день регистрации.
            </div>

            <div className="mn-eyebrow mt-2">С кого начать</div>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="С кого начать">
              {[true, false].map(first => {
                const selected = first === sampleFirst
                return (
                  <button
                    key={String(first)} type="button" role="radio" aria-checked={selected} onClick={() => setSampleFirst(first)}
                    className="text-left px-4 py-2 rounded-xl border-2 min-h-[52px] font-sans text-[15px] font-bold text-jewelInk"
                    style={{ borderColor: selected ? '#15100A' : 'rgba(21,16,10,0.18)', background: selected ? '#FBF6EC' : '#FFFEFA', boxShadow: selected ? '0 2px 0 #15100A' : 'none' }}
                  >
                    {first ? 'Сначала пробной группе' : 'Сразу всем'}
                    <div className={`${small} font-normal`}>
                      {first ? 'Случайные люди из группы; остальным — потом, когда посмотришь ответы' : 'Всей группе, порциями по 25'}
                    </div>
                  </button>
                )
              })}
            </div>
            {sampleFirst && (
              <label className="flex items-center gap-2">
                <span className={small}>в пробной группе, человек</span>
                <input
                  type="number" min={1} max={1000} value={sampleSize} aria-label="Размер пробной группы"
                  onChange={e => setSampleSize(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 px-2 min-h-[44px] rounded-xl border-[1.5px] border-jewelInk/40 bg-white font-sans text-[15px] tabular-nums"
                />
              </label>
            )}
          </>
        )}

        {ready && step === 4 && (
          <>
            <TelegramPreview intro={intro} first={questions[0]} otherLabel={kit!.otherLabel} />
            <div className={small} data-testid="survey-summary">
              Вопросов: {questions.length}{questions.length > 1 ? ' — первый в боте, остальные в мини-аппе' : ''}. Кому: {audienceTitle}{total != null ? ` — ${total} чел.` : ''}
              {!frozen && sampleFirst ? `, сначала пробной группе из ${Math.min(sampleSize, total ?? sampleSize)}` : ''}
            </div>

            <div className="mn-eyebrow mt-2">1. Пройди сам</div>
            <button type="button" className={action} disabled={busy} onClick={sendToMe} data-testid="survey-send-me">Отправить себе</button>

            <div className="mn-eyebrow mt-2">2. Выбери получателей — сообщения не уходят</div>
            <button type="button" className={action} disabled={busy || waiting} onClick={pick} data-testid="survey-pick">
              {frozen ? 'Выбрать всех остальных' : sampleFirst ? 'Выбрать пробную группу' : `Выбрать всех (${audienceTitle})`}
            </button>

            <div className="mn-eyebrow mt-2">3. Отправь — по {BATCH} за нажатие</div>
            <button
              type="button" className={action} style={{ background: '#F5B820' }} disabled={busy || !waiting} onClick={sendBatch} data-testid="survey-send"
            >
              Отправить следующие {BATCH}
            </button>
            {!waiting && (
              <div className={small} data-testid="survey-send-hint">
                {frozen ? 'Все выбранные уже получили опрос. Можно выбрать остальных.' : 'Отправка откроется, когда выберешь получателей.'}
              </div>
            )}

            {note && <div className="font-sans text-[14px] text-jewelInk" data-testid="survey-note">{note}</div>}
            {status && (
              <div className={`${small} tabular-nums`} data-testid="survey-status">
                Выбрано {status.total} · ждут {status.pending} · дошло {status.sent} · заблокировали {status.blocked} · отказ {status.rejected} · без
                ответа Telegram {status.unknown} · ответили {answers}
              </div>
            )}
            {frozen && (
              <button type="button" className={secondary} onClick={() => navigate({ kind: 'admin-feedback', view: { survey: key! } })} data-testid="survey-open-results">
                Смотреть ответы
              </button>
            )}
          </>
        )}

        {ready && step > 1 && !view && (
          <div className="flex gap-3 mt-3">
            {!frozen && <button type="button" className={secondary} onClick={() => go(step - 1)} data-testid="survey-back">Назад</button>}
            {step < STEPS.length && (
              <button type="button" className={primary} disabled={step === 2 && problem !== null} onClick={() => go(step + 1)} data-testid="survey-next">Дальше</button>
            )}
          </div>
        )}
        {frozen && <div className={small}>Получатели выбраны — вопросы уже не поменять. Нужен другой опрос — собери новый.</div>}
      </div>
    </div>
  )
}
