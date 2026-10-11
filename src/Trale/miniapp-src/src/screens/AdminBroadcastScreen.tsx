import { useEffect, useState } from 'react'
import AdminPage, { phaseOf, type AdminPhase } from '../components/admin/AdminPage'
import { AUDIENCES, audienceName } from '../admin/words'
import { adminBack, setInnerBack } from '../admin/adminNav'
import { draft as drafts, useDraft, useFocusMode } from '../admin/useKept'
import { adminCampaigns, ApiError, type CampaignAudience, type CampaignStatusDto } from '../api'
import type { Screen } from '../types'

// Одна рассылка. Новая собирается по шагам, каждый на своём экране: текст → кнопка и куда она ведёт →
// подарок → кому → отправка (сначала себе, потом людям порциями по 25). Имя кампании даёт сервер;
// своё можно задать на шаге «Кому». Открытая по имени — сразу на отправке: дослать выбранным, выбрать
// остальных или ещё одну группу. Группа добавляется в ту же кампанию, поэтому сообщение и подарок
// человек получает один раз, в какой бы группе он ни оказался.

interface Props {
  /** Имя существующей кампании — открыть её отправку. */
  campaignKey?: string
  /** Открыть с черновиком, сохранённым на этом устройстве. */
  useDraft?: boolean
  navigate: (s: Screen) => void
}

const STEPS = ['Текст', 'Кнопка', 'Подарок', 'Кому', 'Отправка']
const BATCH = 25
const PEOPLE = AUDIENCES.filter(a => a.id !== 'owner')
/** Куда может вести кнопка — экраны мини-аппа по именам; адрес подставляется сам. */
const DESTINATIONS = [
  { id: 'home', name: 'Главная', query: '' },
  { id: 'verbs', name: 'Раздел «Глаголы»', query: 'screen=verbs' },
  { id: 'vocabulary', name: 'Мой словарь', query: 'screen=vocabulary' },
  { id: 'paywall', name: 'Экран покупки', query: 'paywall=1' },
  { id: 'feedback', name: '«Написать автору»', query: 'screen=feedback' },
  { id: 'feed', name: 'Покормить Бомбору', query: 'screen=feed' },
  { id: 'custom', name: 'Свой адрес', query: '' }
]
const GIFTS = [0, 3, 7, 14]

const primary = 'jewel-btn jewel-btn-gold flex-1 font-sans text-[16px] font-extrabold'
const secondary = 'jewel-btn jewel-btn-cream font-sans text-[15px] font-extrabold'
const action = 'w-full min-h-[52px] px-4 rounded-xl border-[1.5px] border-jewelInk font-sans text-[15px] font-extrabold text-jewelInk disabled:opacity-40'
const small = 'font-sans text-[12px] text-jewelInk-mid'
const field = 'w-full px-3 py-2 rounded-xl border-[1.5px] border-jewelInk bg-white font-sans text-[15px] text-jewelInk'
const pick = (on: boolean) => ({ borderColor: on ? '#15100A' : 'rgba(21,16,10,0.18)', background: on ? '#FBF6EC' : '#FFFEFA', boxShadow: on ? '0 2px 0 #15100A' : 'none' })
const option = 'text-left px-4 py-2 rounded-xl border-2 min-h-[52px] font-sans text-[15px] font-bold text-jewelInk'

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    try { return JSON.parse(e.body).error ?? `ошибка ${e.status}` } catch { return `ошибка ${e.status}` }
  }
  return 'не получилось — проверь связь и попробуй ещё раз'
}

/** Сообщение так, как его увидит человек в Telegram. */
function Preview({ message, buttonText }: { message: string; buttonText: string | null }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: '#D5E0D0' }} data-testid="broadcast-preview">
      <div className="max-w-[92%]">
        <div className="rounded-2xl rounded-bl-md bg-white px-3 py-2 font-sans text-[15px] text-jewelInk whitespace-pre-wrap break-words shadow-sm">
          {message.trim() || <span className="text-jewelInk-hint">Здесь будет текст сообщения</span>}
        </div>
        {buttonText && (
          <div className="rounded-lg px-2 py-2 mt-1 text-center font-sans text-[14px] font-bold text-white truncate" style={{ background: 'rgba(60,80,60,0.55)' }}>{buttonText}</div>
        )}
      </div>
    </div>
  )
}

interface Draft { step: number; message: string; hasButton: boolean; buttonText: string; destination: string; customQuery: string; giftDays: number; audience: CampaignAudience; sampleFirst: boolean; sampleSize: number; ownName: string }

export default function AdminBroadcastScreen({ campaignKey, useDraft: withDraft, navigate }: Props) {
  const [saved] = useState(() => (withDraft && !campaignKey ? drafts.read<Draft>('broadcast') : null))
  const [phase, setPhase] = useState<AdminPhase>(campaignKey ? 'loading' : 'ready')
  const [step, setStep] = useState(campaignKey ? 5 : saved?.step ?? 1)

  const [message, setMessage] = useState(saved?.message ?? '')
  const [hasButton, setHasButton] = useState(saved?.hasButton ?? true)
  const [buttonText, setButtonText] = useState(saved?.buttonText ?? 'Открыть TraleBot')
  const [destination, setDestination] = useState(saved?.destination ?? 'home')
  const [customQuery, setCustomQuery] = useState(saved?.customQuery ?? '')
  const [giftDays, setGiftDays] = useState(saved?.giftDays ?? 0)
  const [counts, setCounts] = useState<Partial<Record<CampaignAudience, number>>>({})
  const [audience, setAudience] = useState<CampaignAudience>(saved?.audience ?? 'accessEnded')
  const [sampleFirst, setSampleFirst] = useState(saved?.sampleFirst ?? true)
  const [sampleSize, setSampleSize] = useState(saved?.sampleSize ?? 100)
  const [ownName, setOwnName] = useState(saved?.ownName ?? '')

  /** Имя кампании на сервере; появляется, когда выбраны получатели. */
  const [key, setKey] = useState<string | null>(campaignKey ?? null)
  const [status, setStatus] = useState<CampaignStatusDto | null>(null)
  /** Ещё одна группа для той же кампании. */
  const [another, setAnother] = useState<CampaignAudience | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const frozen = key !== null
  // Пошаговый сценарий занимает весь экран — панель вкладок на это время спрятана.
  useFocusMode(true)
  // Незаконченная рассылка сохраняется на устройстве, пока получатели не выбраны: случайное закрытие её не сотрёт.
  const unsaved = !frozen && message.trim().length > 0
  useDraft('broadcast', unsaved ? { step, message, hasButton, buttonText, destination, customQuery, giftDays, audience, sampleFirst, sampleSize, ownName } satisfies Draft : null)
  const go = (next: number) => { setStep(next); setNote(null); window.scrollTo(0, 0) }

  useEffect(() => { adminCampaigns.audiences().then(setCounts).catch(() => {}) }, [])
  const open = (name: string) => adminCampaigns.status(name).then(s => {
    setStatus(s)
    setMessage(s.message)
    setHasButton(Boolean(s.buttonText))
    setButtonText(s.buttonText ?? '')
    const known = DESTINATIONS.find(d => d.id !== 'custom' && d.query === (s.buttonQuery ?? ''))
    setDestination(known?.id ?? 'custom')
    setCustomQuery(known ? '' : s.buttonQuery ?? '')
    setGiftDays(s.giftDays)
    setAudience(s.audience)
    setPhase('ready')
  })
  useEffect(() => { if (campaignKey) open(campaignKey).catch(e => setPhase(phaseOf(e))) }, [campaignKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // «Назад» внутри рассылки: на шаг раньше, пока получатели не выбраны.
  useEffect(() => {
    setInnerBack(() => { if (!frozen && step > 1) go(step - 1); else close(); return true })
    return () => setInnerBack(null)
  }, [step, frozen]) // eslint-disable-line react-hooks/exhaustive-deps

  const text = message.trim()
  const button = hasButton ? buttonText.trim() : ''
  const query = destination === 'custom' ? customQuery.trim().replace(/^\?/, '') : DESTINATIONS.find(d => d.id === destination)!.query
  const name = ownName.trim()
  // Почему пока нельзя дальше — одной фразой; null — всё в порядке. Сервер проверяет то же.
  const problem =
    step === 1 ? (!text ? 'Напиши текст сообщения.' : text.length > 4000 ? 'Сообщение длиннее 4000 символов.' : null)
      : step === 2 ? (hasButton && !button ? 'Напиши текст кнопки или выбери «Без кнопки».' : button.length > 64 ? 'Текст кнопки длиннее 64 символов.'
        : hasButton && destination === 'custom' && !/^[A-Za-z0-9_.~%=&-]{0,256}$/.test(query) ? 'Адрес — только параметры вида screen=verbs, без пробелов.' : null)
        : step === 4 ? (name && !/^[a-z0-9][a-z0-9_-]{2,47}$/.test(name) ? 'Имя кампании: 3–48 символов, латиница в нижнем регистре, цифры, «-» и «_».' : null)
          : null

  const waiting = (status?.pending ?? 0) > 0
  const draft = (to: CampaignAudience, sample: number | null, dryRun: boolean, extra: object = {}) => ({
    key: key ?? name, newBroadcast: !key && !name, audience: to, message: text,
    buttonText: button || null, buttonQuery: button ? query || null : null, giftDays: button ? giftDays : 0,
    sampleSize: sample, dryRun, ...extra
  })

  async function run(work: () => Promise<string | null>) {
    setBusy(true)
    setNote(null)
    try { setNote(await work()) } catch (e) { setNote(errorText(e)) } finally { setBusy(false) }
  }

  // Себе — каждый раз новой пробной кампанией: людям она не уходит и в списке рассылок не появляется.
  const sendToMe = () => run(async () => {
    const trial = await adminCampaigns.prepare({ ...draft('owner', null, false), key: '', newBroadcast: true, newBroadcastSuffix: 'test' })
    if (trial.picked === 0) return 'Себе отправить не вышло: у тебя выключены уведомления бота.'
    const sent = await adminCampaigns.send(trial.key, 1)
    return sent.sent === 1 ? 'Отправил тебе в чат с ботом — посмотри, как выглядит, и нажми кнопку.' : 'Telegram не принял сообщение. Попробуй ещё раз.'
  })

  const choose = (to: CampaignAudience, sample: number | null, who: string, extra: object = {}) => run(async () => {
    const plan = await adminCampaigns.prepare(draft(to, sample, true, extra))
    if (plan.picked === 0) return `Выбирать некого: в группе «${audienceName(to)}» все уже в этой рассылке.`
    const already = plan.alreadyInCampaign > 0 ? ` Ещё ${plan.alreadyInCampaign} из этой группы уже в рассылке — второй раз они её не получат.` : ''
    if (!confirm(`Выбрать ${who}: ${plan.picked} чел. (${audienceName(to)})?${already}\nСообщения пока НЕ уйдут — только список получателей.`)) return null
    const done = await adminCampaigns.prepare(draft(to, sample, false, extra))
    setKey(done.key)
    drafts.clear('broadcast')
    setStatus(await adminCampaigns.status(done.key))
    setAnother(null)
    return `Получатели записаны: ${done.picked} чел. Теперь отправляй порциями.`
  })

  const sendBatch = () => run(async () => {
    if (!key) return null
    const current = await adminCampaigns.status(key)
    setStatus(current)
    if (current.pending === 0) return 'Отправлять некого: все выбранные уже получили сообщение.'
    const n = Math.min(BATCH, current.pending)
    const gift = current.giftDays > 0 ? `\n\nС подарком: ${current.giftDays} дн. доступа тому, кто откроет кнопку.` : ''
    if (!confirm(`ОТПРАВИТЬ ${n} сообщений?\n\n${current.message}${gift}\n\nЭто настоящая отправка через бота.`)) return null
    const r = await adminCampaigns.send(key, BATCH)
    setStatus(r.status)
    const wait = r.retryAfterSeconds > 0 ? ` Telegram просит подождать ${r.retryAfterSeconds} с.` : ''
    return `Отправлено ${r.sent}, заблокировали бота ${r.blocked}, отказ ${r.rejected}, без ответа ${r.unknown}. Осталось ${r.status.pending}.${wait}`
  })

  const close = () => {
    if (unsaved && !confirm('Закрыть рассылку? Черновик останется на этом устройстве — к нему можно вернуться из списка рассылок.')) return
    navigate(adminBack())
  }
  const total = counts[audience]
  // Главная кнопка шага закреплена внизу экрана.
  const footer = !frozen && (step > 1 || step < STEPS.length) ? (
    <div className="flex gap-3">
      {step > 1 && <button type="button" className={secondary} onClick={() => go(step - 1)} data-testid="broadcast-back">Назад</button>}
      {step < STEPS.length && <button type="button" className={primary} disabled={problem !== null} onClick={() => go(step + 1)} data-testid="broadcast-next">Дальше</button>}
    </div>
  ) : undefined

  return (
    <AdminPage title={frozen ? 'Рассылка' : 'Новая рассылка'} section={frozen ? 'рассылки' : `шаг ${step} из ${STEPS.length}`} close
      onBack={close} phase={phase} footer={footer} onRetry={() => { if (campaignKey) { setPhase('loading'); open(campaignKey).catch(e => setPhase(phaseOf(e))) } }} testId="admin-broadcast">
      <div className="flex flex-col gap-3">
        <div className="font-sans text-[20px] font-extrabold text-jewelInk leading-tight" data-testid="broadcast-step-title">{STEPS[step - 1]}</div>

        {step === 1 && (
          <>
            <div className={small}>Что напишет бот. Можно несколько абзацев.</div>
            <textarea className={field} rows={8} autoFocus value={message} maxLength={4000} aria-label="Текст сообщения" placeholder="Текст сообщения" onChange={e => setMessage(e.target.value)} />
            <div className={`${small} text-right tabular-nums`}>{text.length} / 4000</div>
          </>
        )}

        {step === 2 && (
          <>
            <Preview message={text} buttonText={button || null} />
            <div className="flex gap-2" role="radiogroup" aria-label="Кнопка">
              {[true, false].map(on => (
                <button key={String(on)} type="button" role="radio" aria-checked={hasButton === on} onClick={() => setHasButton(on)}
                  className="flex-1 px-2 rounded-xl border-2 min-h-[48px] font-sans text-[14px] font-bold text-jewelInk" style={pick(hasButton === on)}>
                  {on ? 'С кнопкой' : 'Без кнопки'}
                </button>
              ))}
            </div>
            {hasButton && (
              <>
                <div className="mn-eyebrow mt-1">Текст кнопки</div>
                <input className={`${field} min-h-[48px]`} value={buttonText} maxLength={64} aria-label="Текст кнопки" onChange={e => setButtonText(e.target.value)} />
                <div className="mn-eyebrow mt-1">Куда ведёт</div>
                <div className="flex flex-col gap-2" role="radiogroup" aria-label="Куда ведёт кнопка" data-testid="broadcast-destinations">
                  {DESTINATIONS.map(d => (
                    <button key={d.id} type="button" role="radio" aria-checked={destination === d.id} onClick={() => setDestination(d.id)} className={option} style={pick(destination === d.id)}>
                      {d.name}
                    </button>
                  ))}
                </div>
                {destination === 'custom' && (
                  <>
                    <input className={`${field} min-h-[48px]`} value={customQuery} aria-label="Свой адрес" placeholder="moduleId=cases&lessonId=1" onChange={e => setCustomQuery(e.target.value)} />
                    <div className={small}>Параметры, с которыми откроется мини-апп, — как в ссылках на уроки.</div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div className={small}>
              Дни полного доступа тому, кто откроет мини-апп кнопкой из сообщения. Дни начинаются с открытия, а не с отправки; один раз на человека;
              получить можно 14 дней с создания рассылки. У кого доступа и так больше — ничего не меняется.
            </div>
            {!button && <div className="font-sans text-[13px] font-bold text-ruby" data-testid="broadcast-gift-needs-button">Подарок получают по кнопке — у этого сообщения кнопки нет. Вернись на шаг назад и добавь её.</div>}
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Подарок">
              {GIFTS.map(days => (
                <button key={days} type="button" role="radio" aria-checked={giftDays === days} disabled={!button && days > 0} onClick={() => setGiftDays(days)}
                  className={`${option} disabled:opacity-40`} style={pick(giftDays === days)}>
                  {days === 0 ? 'Без подарка' : `${days} дн. полного доступа`}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <span className={small}>своё число дней (до 30)</span>
              <input type="number" min={0} max={30} value={giftDays} disabled={!button} aria-label="Дней доступа в подарок"
                onChange={e => setGiftDays(Math.min(30, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-24 px-2 min-h-[44px] rounded-xl border-[1.5px] border-jewelInk/40 bg-white font-sans text-[15px] tabular-nums disabled:opacity-40" />
            </label>
          </>
        )}

        {step === 4 && (
          <>
            <div className={small}>Без тех, кто заблокировал бота или выключил уведомления.</div>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Кому отправить">
              {PEOPLE.map(a => (
                <button key={a.id} type="button" role="radio" aria-checked={a.id === audience} onClick={() => setAudience(a.id)} data-testid={`broadcast-audience-${a.id}`}
                  className={`${option} flex items-center justify-between gap-3`} style={pick(a.id === audience)}>
                  <span className="first-letter:uppercase min-w-0">{a.name}</span>
                  <span className="tabular-nums font-extrabold shrink-0">{counts[a.id] ?? '…'}</span>
                </button>
              ))}
            </div>
            <div className={small}>Потом в эту же рассылку можно добавить ещё группу — кто уже получил сообщение, второй раз его не получит.</div>

            <div className="mn-eyebrow mt-2">С кого начать</div>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="С кого начать">
              {[true, false].map(first => (
                <button key={String(first)} type="button" role="radio" aria-checked={first === sampleFirst} onClick={() => setSampleFirst(first)} className={option} style={pick(first === sampleFirst)}>
                  {first ? 'Сначала пробной группе' : 'Сразу всем'}
                  <div className={`${small} font-normal`}>{first ? 'Случайные люди из группы; остальным — потом' : 'Всей группе, порциями по 25'}</div>
                </button>
              ))}
            </div>
            {sampleFirst && (
              <label className="flex items-center gap-2">
                <span className={small}>в пробной группе, человек</span>
                <input type="number" min={1} max={1000} value={sampleSize} aria-label="Размер пробной группы" onChange={e => setSampleSize(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 px-2 min-h-[44px] rounded-xl border-[1.5px] border-jewelInk/40 bg-white font-sans text-[15px] tabular-nums" />
              </label>
            )}

            <div className="mn-eyebrow mt-2">Имя кампании</div>
            <input className={`${field} min-h-[48px]`} value={ownName} aria-label="Имя кампании" placeholder="само: broadcast-год-месяц" onChange={e => setOwnName(e.target.value)} />
            <div className={small}>Можно не трогать — имя появится само. Своё пригодится, чтобы потом найти рассылку в отчётах. Если такое имя уже есть, получатели добавятся в ту рассылку.</div>
          </>
        )}

        {step === 5 && (
          <>
            <Preview message={text} buttonText={button || null} />
            <div className={small} data-testid="broadcast-summary">
              {button ? `Кнопка ведёт: ${destination === 'custom' ? `/?${query}` : DESTINATIONS.find(d => d.id === destination)!.name}. ` : 'Без кнопки. '}
              {giftDays > 0 && button ? `Подарок: ${giftDays} дн. доступа. ` : ''}
              Кому: {audienceName(audience)}{total != null ? ` — ${total} чел.` : ''}{!frozen && sampleFirst ? `, сначала пробной группе из ${Math.min(sampleSize, total ?? sampleSize)}` : ''}
            </div>

            <div className="mn-eyebrow mt-2">1. Посмотри сам</div>
            <button type="button" className={action} disabled={busy} onClick={sendToMe} data-testid="broadcast-send-me">Отправить себе</button>

            <div className="mn-eyebrow mt-2">2. Выбери получателей — сообщения не уходят</div>
            <button type="button" className={action} disabled={busy || waiting} data-testid="broadcast-pick"
              onClick={() => choose(audience, !frozen && sampleFirst ? sampleSize : null, frozen ? 'всех остальных' : sampleFirst ? 'пробную группу' : 'всех')}>
              {frozen ? `Выбрать всех остальных (${audienceName(audience)})` : sampleFirst ? 'Выбрать пробную группу' : `Выбрать всех (${audienceName(audience)})`}
            </button>

            <div className="mn-eyebrow mt-2">3. Отправь — по {BATCH} за нажатие</div>
            <button type="button" className={action} style={{ background: '#F5B820' }} disabled={busy || !waiting} onClick={sendBatch} data-testid="broadcast-send">
              Отправить следующие {BATCH}
            </button>
            {!waiting && (
              <div className={small} data-testid="broadcast-send-hint">
                {frozen ? 'Все выбранные уже получили сообщение. Можно выбрать остальных или ещё одну группу.' : 'Отправка откроется, когда выберешь получателей.'}
              </div>
            )}

            {note && <div className="font-sans text-[14px] text-jewelInk" data-testid="broadcast-note">{note}</div>}
            {status && (
              <div className={`${small} tabular-nums`} data-testid="broadcast-status">
                Выбрано {status.total} · ждут {status.pending} · дошло {status.sent} · заблокировали {status.blocked} · отказ {status.rejected} · без
                ответа Telegram {status.unknown}{status.buttonText ? ` · открыли по кнопке ${status.opened}` : ''}
                {status.giftDays > 0 ? ` · подарков выдано ${status.gifted}` : ''}
              </div>
            )}

            {frozen && (
              <div className="jewel-tile px-4 py-3 mt-2" data-testid="broadcast-another">
                <div className="relative z-[1] flex flex-col gap-2">
                  <div className="font-sans text-[15px] font-extrabold text-jewelInk">Дослать ещё одной группе</div>
                  <div className={small}>
                    Это будет та же рассылка: кто уже получил сообщение, второй раз его не получит{status && status.giftDays > 0 ? ', и подарок достаётся человеку один раз' : ''} —
                    даже если он попадает в обе группы.
                  </div>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Ещё одна группа">
                    {PEOPLE.filter(a => a.id !== audience).map(a => (
                      <button key={a.id} type="button" role="radio" aria-checked={another === a.id} onClick={() => setAnother(a.id)}
                        className="px-3 min-h-[44px] rounded-xl border-2 font-sans text-[13px] font-bold text-jewelInk tabular-nums" style={pick(another === a.id)}>
                        {a.name}{counts[a.id] != null ? ` · ${counts[a.id]}` : ''}
                      </button>
                    ))}
                  </div>
                  {another && (
                    <button type="button" className={action} disabled={busy || waiting} data-testid="broadcast-pick-another"
                      onClick={() => choose(another, null, 'ещё одну группу', { anotherAudience: true })}>
                      Выбрать группу «{audienceName(another)}»
                    </button>
                  )}
                  {another && waiting && <div className={small}>Сначала отправь тем, кто уже выбран.</div>}
                </div>
              </div>
            )}
            {frozen && <div className={small}>Получатели выбраны — текст, кнопку и подарок уже не поменять. Имя рассылки: {key}.</div>}
          </>
        )}

        {problem && <div className="font-sans text-[13px] text-ruby" data-testid="broadcast-problem">{problem}</div>}
      </div>
    </AdminPage>
  )
}
