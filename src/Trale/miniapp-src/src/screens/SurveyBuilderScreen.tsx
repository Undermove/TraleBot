import { useEffect, useState } from 'react'
import Header from '../components/Header'
import LoaderLetter from '../components/LoaderLetter'
import { AUDIENCES } from '../components/admin/CampaignPanel'
import { CloseIcon } from '../verbs/ui/icons'
import {
  adminCampaigns, adminFeedback, adminSurveys, ApiError,
  type AdminSurveyDto, type CampaignAudience, type CampaignStatusDto, type SurveyPresetDto
} from '../api'
import type { ProgressState, Screen } from '../types'

// Конструктор опроса — подраздел админки. Четыре шага, каждый на своём экране: выбрать готовый опрос,
// проверить, как он выглядит (и поправить, если хочется), выбрать, кому, и отправить — сначала себе,
// потом людям порциями. Имя кампании владелец не придумывает: его даёт сервер, когда выбраны получатели.
// С этого момента вопрос и кнопки уже не меняются — они ушли бы разным людям разными.
// Отправку можно бросить посередине (в группе сотни людей, порция — 25): начатый опрос остаётся на
// первом шаге в блоке «Не дослано», «Продолжить» возвращает на его отправку с тем, что уже сделано.

interface Props {
  progress: ProgressState
  /** Имя начатого опроса — открыть сразу его отправку. */
  resume?: string
  navigate: (s: Screen) => void
}

const STEPS = ['Выбери опрос', 'Проверь, как это выглядит', 'Кому отправить', 'Отправка']
const CUSTOM = 'custom'
const BATCH = 25
const PEOPLE = AUDIENCES.filter(a => a.id !== 'owner')

const primary = 'jewel-btn jewel-btn-gold flex-1 font-sans text-[16px] font-extrabold'
const secondary = 'jewel-btn jewel-btn-cream font-sans text-[15px] font-extrabold'
const action = 'w-full min-h-[52px] px-4 rounded-xl border-[1.5px] border-jewelInk font-sans text-[15px] font-extrabold text-jewelInk disabled:opacity-40'
const small = 'font-sans text-[12px] text-jewelInk-mid'
const field = 'w-full px-3 py-2 rounded-xl border-[1.5px] border-jewelInk bg-white font-sans text-[15px] text-jewelInk'

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    try { return JSON.parse(e.body).error ?? `ошибка ${e.status}` } catch { return `ошибка ${e.status}` }
  }
  return 'не получилось — проверь связь и попробуй ещё раз'
}

/** Сообщение так, как его увидит человек в Telegram: текст и кнопки-ответы под ним. */
function TelegramPreview({ question, options }: { question: string; options: string[] }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: '#D5E0D0' }} data-testid="survey-preview">
      <div className="max-w-[92%]">
        <div className="rounded-2xl rounded-bl-md bg-white px-3 py-2 font-sans text-[15px] text-jewelInk whitespace-pre-wrap break-words shadow-sm">
          {question || <span className="text-jewelInk-hint">Здесь будет твой вопрос</span>}
        </div>
        <div className="flex flex-col gap-1 mt-1">
          {options.filter(Boolean).map((o, i) => (
            <div key={i} className="rounded-lg px-2 py-2 text-center font-sans text-[14px] font-bold text-white truncate" style={{ background: 'rgba(60,80,60,0.55)' }}>
              {o}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function SurveyBuilderScreen({ progress, resume, navigate }: Props) {
  const [step, setStep] = useState(1)
  /** Опросы, которым выбрали получателей, но отправили не всем. */
  const [unfinished, setUnfinished] = useState<AdminSurveyDto[]>([])
  const [resuming, setResuming] = useState(Boolean(resume))
  const [presets, setPresets] = useState<SurveyPresetDto[] | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [limits, setLimits] = useState({ maxOptions: 4, maxOptionLength: 64 })
  const [denied, setDenied] = useState<string | null>(null)

  const [presetId, setPresetId] = useState(CUSTOM)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<string[]>([])
  const [editing, setEditing] = useState<'question' | number | null>(null)

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
      .then(r => { setPresets(r.presets); setSuggestions(r.suggestions); setLimits({ maxOptions: r.maxOptions, maxOptionLength: r.maxOptionLength }) })
      .catch(e => setDenied(e instanceof ApiError && e.status === 404 ? 'Нет доступа.' : 'Не получилось загрузить. Попробуй ещё раз.'))
    adminCampaigns.audiences().then(setCounts).catch(() => {})
    adminFeedback.overview({ take: 1 }).then(r => setUnfinished(r.surveys.filter(s => s.pending > 0))).catch(() => {})
  }, [])

  // Вернуться к начатому опросу: всё, что нужно, чтобы дослать, сервер помнит сам — вопрос, кнопки, кому, сколько ждут.
  async function resumeSurvey(surveyKey: string) {
    setResuming(true)
    try {
      const current = await adminCampaigns.status(surveyKey)
      setKey(current.key)
      setStatus(current)
      setQuestion(current.message)
      setOptions((current.surveyAnswers ?? []).map(a => a.option))
      setAudience(current.audience)
      go(4)
    } catch (e) {
      setDenied(e instanceof ApiError && e.status === 404 ? 'Такого опроса нет.' : 'Не получилось загрузить. Попробуй ещё раз.')
    } finally {
      setResuming(false)
    }
  }
  useEffect(() => { if (resume) void resumeSurvey(resume) }, [resume]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (next: number) => { setStep(next); setNote(null); setEditing(null); window.scrollTo(0, 0) }

  function choose(preset: SurveyPresetDto | null) {
    setPresetId(preset?.id ?? CUSTOM)
    setQuestion(preset?.question ?? '')
    setOptions(preset ? [...preset.options] : [])
    go(2)
    if (!preset) setEditing('question')
  }

  const clean = options.map(o => o.trim()).filter(Boolean)
  const text = question.trim()
  // Почему пока нельзя дальше — одной фразой; null — всё в порядке.
  const problem =
    !text ? 'Напиши вопрос.'
      : clean.length < 2 ? 'Нужно хотя бы два варианта ответа.'
        : new Set(clean).size !== clean.length ? 'Два варианта совпадают.'
          : clean.some(o => o.length > limits.maxOptionLength) ? `Вариант длиннее ${limits.maxOptionLength} символов.`
            : null

  const setOption = (i: number, value: string) => setOptions(options.map((o, j) => (j === i ? value : o)))
  const removeOption = (i: number) => { setOptions(options.filter((_, j) => j !== i)); setEditing(null) }
  const canAdd = options.length < limits.maxOptions
  const addOption = (value = '') => {
    if (!canAdd) return
    setOptions([...options, value])
    setEditing(value ? null : options.length)
  }
  const offered = suggestions.filter(s => !clean.includes(s))

  const audienceTitle = PEOPLE.find(a => a.id === audience)?.name ?? audience
  const total = counts[audience]
  const frozen = key !== null
  const waiting = (status?.pending ?? 0) > 0
  const draft = (sample: number | null, dryRun: boolean, to: CampaignAudience = audience, test = false) => ({
    key: test ? '' : key ?? '', newSurveySlug: test ? `${presetId}-test` : presetId, audience: to, message: text,
    buttonText: null, buttonQuery: null, sampleSize: sample, dryRun, surveyOptions: clean
  })

  async function run(work: () => Promise<string | null>) {
    setBusy(true)
    setNote(null)
    try { setNote(await work()) } catch (e) { setNote(errorText(e)) } finally { setBusy(false) }
  }

  // Себе — каждый раз новым пробным опросом: его можно посмотреть сколько угодно раз, людям он не уходит и в отзывы не попадает.
  const sendToMe = () => run(async () => {
    const trial = await adminCampaigns.prepare(draft(null, false, 'owner', true))
    if (trial.picked === 0) return 'Себе отправить не вышло: у тебя выключены уведомления бота.'
    const sent = await adminCampaigns.send(trial.key, 1)
    return sent.sent === 1 ? 'Отправил тебе в чат с ботом — посмотри, как выглядит, и понажимай кнопки.' : 'Telegram не принял сообщение. Попробуй ещё раз.'
  })

  const sample = !frozen && sampleFirst ? sampleSize : null
  const pick = () => run(async () => {
    const plan = await adminCampaigns.prepare(draft(sample, true))
    if (plan.picked === 0) return 'Выбирать некого: в этой группе все уже получили опрос.'
    const who = sample == null ? (frozen ? 'всех остальных' : 'всех') : 'пробную группу'
    if (!confirm(`Выбрать ${who}: ${plan.picked} чел. (${audienceTitle})?\nСообщения пока НЕ уйдут — только список получателей. Вопрос и кнопки после этого уже не поменять.`)) return null
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

  const ready = presets !== null && !resuming && !denied
  const back = () => (step === 1 || frozen ? navigate({ kind: 'admin' }) : go(step - 1))
  const answers = status?.surveyAnswers?.reduce((sum, a) => sum + a.count, 0) ?? 0

  return (
    <div className="flex flex-col min-h-full bg-cream" data-testid="survey-builder">
      <Header progress={progress} onBack={back} eyebrow={`шаг ${step} из ${STEPS.length}`} title="Опрос" />

      <div className="flex-1 px-5 pt-4 flex flex-col gap-3" style={{ paddingBottom: 'calc(var(--safe-b) + 32px)' }}>
        {denied && <div className="font-sans text-[14px] text-jewelInk">{denied}</div>}
        {(!presets || resuming) && !denied && <div className="flex justify-center py-12"><LoaderLetter /></div>}

        {ready && (
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
                        <div className="font-sans text-[15px] font-extrabold text-jewelInk leading-snug line-clamp-2">{s.question}</div>
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
            <div className={small}>Вопрос и кнопки уже написаны — на следующем шаге их можно поправить.</div>
            {presets.map(p => (
              <button key={p.id} type="button" onClick={() => choose(p)} data-testid={`survey-preset-${p.id}`} className="jewel-tile jewel-pressable w-full text-left px-4 py-3">
                <div className="relative z-[1]">
                  <div className="mn-eyebrow text-navy mb-1">{p.title}</div>
                  <div className="font-sans text-[15px] font-extrabold text-jewelInk leading-snug">{p.question}</div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.options.map(o => (
                      <span key={o} className="px-2 py-1 rounded-lg border border-jewelInk/30 bg-white font-sans text-[12px] text-jewelInk">{o}</span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
            <button type="button" onClick={() => choose(null)} data-testid="survey-preset-custom" className={action}>Свой вопрос</button>
          </>
        )}

        {ready && step === 2 && (
          <>
            <TelegramPreview question={text} options={clean} />

            <div className="mn-eyebrow mt-2">Вопрос</div>
            {editing === 'question' ? (
              <textarea
                className={field} rows={3} autoFocus value={question} aria-label="Текст вопроса" maxLength={1000}
                onChange={e => setQuestion(e.target.value)} onBlur={() => setEditing(null)}
              />
            ) : (
              <button type="button" onClick={() => setEditing('question')} data-testid="survey-question" className={`${field} text-left min-h-[48px]`}>
                {text || <span className="text-jewelInk-hint">Нажми, чтобы написать вопрос</span>}
              </button>
            )}

            <div className="mn-eyebrow mt-2">Кнопки-ответы · {options.length} из {limits.maxOptions}</div>
            <div className="flex flex-col gap-2" data-testid="survey-options">
              {options.map((o, i) => (
                <div key={i} className="flex items-stretch gap-2">
                  {editing === i ? (
                    <input
                      className={`${field} flex-1 min-w-0 min-h-[48px]`} autoFocus value={o} aria-label={`Вариант ${i + 1}`} maxLength={limits.maxOptionLength}
                      onChange={e => setOption(i, e.target.value)} onBlur={() => setEditing(null)}
                      onKeyDown={e => { if (e.key === 'Enter') setEditing(null) }}
                    />
                  ) : (
                    <button type="button" onClick={() => setEditing(i)} data-testid={`survey-option-${i}`} className={`${field} flex-1 min-w-0 text-left min-h-[48px] font-bold truncate`}>
                      {o.trim() || <span className="text-jewelInk-hint font-normal">Нажми, чтобы назвать</span>}
                    </button>
                  )}
                  <button
                    type="button" onClick={() => removeOption(i)} aria-label={`Убрать вариант ${o.trim() || i + 1}`}
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
            {problem && <div className="font-sans text-[13px] text-ruby" data-testid="survey-problem">{problem}</div>}
          </>
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
                    className="flex items-center justify-between gap-3 text-left px-4 rounded-xl border-2 min-h-[52px] font-sans text-[15px] font-bold text-jewelInk"
                    style={{ borderColor: selected ? '#15100A' : 'rgba(21,16,10,0.18)', background: selected ? '#FBF6EC' : '#FFFEFA', boxShadow: selected ? '0 2px 0 #15100A' : 'none' }}
                  >
                    <span className="first-letter:uppercase">{a.name}</span>
                    <span className="tabular-nums font-extrabold shrink-0">{counts[a.id] ?? '…'}</span>
                  </button>
                )
              })}
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
            <TelegramPreview question={text} options={clean} />
            <div className={small} data-testid="survey-summary">
              Кому: {audienceTitle}{total != null ? ` — ${total} чел.` : ''}
              {!frozen && sampleFirst ? `, сначала пробной группе из ${Math.min(sampleSize, total ?? sampleSize)}` : ''}
            </div>

            <div className="mn-eyebrow mt-2">1. Посмотри сам</div>
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

        {ready && step > 1 && (
          <div className="flex gap-3 mt-3">
            {!frozen && <button type="button" className={secondary} onClick={() => go(step - 1)} data-testid="survey-back">Назад</button>}
            {step < STEPS.length && (
              <button type="button" className={primary} disabled={step === 2 && problem !== null} onClick={() => go(step + 1)} data-testid="survey-next">Дальше</button>
            )}
          </div>
        )}
        {frozen && <div className={small}>Получатели выбраны — вопрос и кнопки уже не поменять. Нужен другой опрос — собери новый.</div>}
      </div>
    </div>
  )
}
