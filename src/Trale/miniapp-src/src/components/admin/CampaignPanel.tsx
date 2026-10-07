import { useEffect, useState } from 'react'
import { adminCampaigns, ApiError, type CampaignAudience, type CampaignPrepareDto, type CampaignStatusDto } from '../../api'

// Рассылка по частям: сначала выбрать получателей (пробную группу или всех остальных) — это
// ничего не отправляет; потом отправлять порциями. Каждый шаг — отдельная кнопка, сам сервер
// ничего не запускает. Один человек получает сообщение кампании не больше одного раза.

const AUDIENCES: { id: CampaignAudience; name: string }[] = [
  { id: 'accessEnded', name: 'доступ закончился' },
  { id: 'onTrial', name: 'пробный период идёт' },
  { id: 'paying', name: 'платят' },
  { id: 'proLapsed', name: 'подписка закончилась' },
  { id: 'owner', name: 'только я (посмотреть)' }
]

const BATCH = 25
const input = 'w-full px-2 py-1.5 rounded border-[1.5px] border-jewelInk/40 font-sans text-[13px]'
const label = 'font-sans text-[12px] text-jewelInk-mid'
const button = 'min-h-[44px] px-3 rounded border-[1.5px] border-jewelInk font-sans text-[13px] font-extrabold disabled:opacity-50'

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    try { return JSON.parse(e.body).error ?? `ошибка ${e.status}` } catch { return `ошибка ${e.status}` }
  }
  return 'не получилось'
}

export default function CampaignPanel() {
  const [counts, setCounts] = useState<Partial<Record<CampaignAudience, number>>>({})
  const [key, setKey] = useState('')
  const [audience, setAudience] = useState<CampaignAudience>('accessEnded')
  const [message, setMessage] = useState('')
  const [buttonText, setButtonText] = useState('')
  const [buttonQuery, setButtonQuery] = useState('')
  const [sampleSize, setSampleSize] = useState(100)
  const [giftDays, setGiftDays] = useState(0)
  const [status, setStatus] = useState<CampaignStatusDto | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { adminCampaigns.audiences().then(setCounts).catch(() => {}) }, [])

  async function run(action: () => Promise<string | null>) {
    setBusy(true)
    setNote(null)
    try { setNote(await action()) } catch (e) { setNote(errorText(e)) } finally { setBusy(false) }
  }

  const draft = (size: number | null, dryRun: boolean) => ({
    key: key.trim(), audience, message, buttonText: buttonText.trim() || null, buttonQuery: buttonQuery.trim() || null, sampleSize: size, dryRun, giftDays
  })

  const describe = (r: CampaignPrepareDto) =>
    `в аудитории ${r.audienceTotal}, уже в кампании ${r.alreadyInCampaign}, ${r.dryRun ? 'будет выбрано' : 'выбрано'} ${r.picked}, останется ${r.leftForLater}`

  const refresh = async () => {
    const s = await adminCampaigns.status(key.trim()).catch(() => null)
    setStatus(s)
    return s
  }

  const count = (size: number | null) => run(async () => `Подсчёт (ничего не изменено): ${describe(await adminCampaigns.prepare(draft(size, true)))}`)

  const pick = (size: number | null) => run(async () => {
    const plan = await adminCampaigns.prepare(draft(size, true))
    const who = size == null ? 'всех остальных' : 'пробную группу'
    if (!confirm(`Выбрать ${who}: ${plan.picked} чел. (${AUDIENCES.find(a => a.id === audience)?.name})?\nСообщения пока НЕ уйдут — только список получателей.`)) return null
    const done = await adminCampaigns.prepare(draft(size, false))
    await refresh()
    return `Получатели записаны: ${describe(done)}. Теперь отправляй порциями.`
  })

  const send = () => run(async () => {
    const current = await refresh()
    if (!current) return 'Такой кампании ещё нет — сначала выбери получателей.'
    if (current.pending === 0) return 'Отправлять некого: все выбранные уже обработаны.'
    const n = Math.min(BATCH, current.pending)
    if (!confirm(`ОТПРАВИТЬ ${n} сообщений кампании «${current.key}»?\n\n${current.message}\n\nЭто настоящая отправка через бота.`)) return null
    const r = await adminCampaigns.send(current.key, BATCH)
    setStatus(r.status)
    const wait = r.retryAfterSeconds > 0 ? ` Telegram просит подождать ${r.retryAfterSeconds} с.` : ''
    return `Отправлено ${r.sent}, заблокировали бота ${r.blocked}, отказ ${r.rejected}, без ответа ${r.unknown}. Осталось ${r.status.pending}.${wait}`
  })

  return (
    <div className="mb-5" data-testid="campaign-panel">
      <div className="mn-eyebrow mb-2">Рассылка по частям</div>
      <div className="jewel-tile px-4 py-4">
        <div className="relative z-[1] flex flex-col gap-3">
          <div>
            <div className={label}>имя кампании (латиница, цифры, дефис) — по нему считаются результаты</div>
            <input className={input} value={key} placeholder="referral-2026-10" onChange={e => { setKey(e.target.value); setStatus(null) }} />
          </div>
          <div>
            <div className={label}>кому</div>
            <select className={input} value={audience} onChange={e => setAudience(e.target.value as CampaignAudience)}>
              {AUDIENCES.map(a => (
                <option key={a.id} value={a.id}>{a.name}{counts[a.id] != null ? ` — ${counts[a.id]}` : ''}</option>
              ))}
            </select>
            <div className={`${label} mt-1`}>Без тех, кто заблокировал бота или выключил уведомления.</div>
          </div>
          <div>
            <div className={label}>текст сообщения</div>
            <textarea className={input} rows={5} value={message} onChange={e => setMessage(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <div className={label}>текст кнопки (пусто — без кнопки)</div>
              <input className={input} value={buttonText} onChange={e => setButtonText(e.target.value)} />
            </div>
            <div className="flex-1">
              <div className={label}>куда ведёт (пусто — главная)</div>
              <input className={input} value={buttonQuery} placeholder="screen=vocabulary" onChange={e => setButtonQuery(e.target.value)} />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={label}>подарок: дней полного доступа (0 — без подарка)</span>
              <input type="number" min={0} max={30} className="w-20 px-2 py-1.5 rounded border-[1.5px] border-jewelInk/40 font-sans text-[13px] tabular-nums"
                data-testid="campaign-gift-days" value={giftDays} onChange={e => setGiftDays(Math.min(30, Math.max(0, parseInt(e.target.value) || 0)))} />
            </div>
            {giftDays > 0 && (
              <div className={`${label} mt-1`}>
                Дни начинаются, когда человек откроет мини-апп кнопкой из сообщения — не раньше. Один раз на человека; получить можно
                14 дней с создания кампании. У кого доступа и так больше — ничего не меняется.
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className={label}>пробная группа, человек</span>
            <input type="number" min={1} max={1000} className="w-24 px-2 py-1.5 rounded border-[1.5px] border-jewelInk/40 font-sans text-[13px] tabular-nums"
              value={sampleSize} onChange={e => setSampleSize(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>

          <div className={label}>1. Выбрать получателей — сообщения не уходят</div>
          <div className="flex flex-wrap gap-2">
            <button className={button} disabled={busy} onClick={() => count(sampleSize)}>Посчитать</button>
            <button className={button} disabled={busy} onClick={() => pick(sampleSize)}>Выбрать пробную группу</button>
            <button className={button} disabled={busy} onClick={() => pick(null)}>Выбрать всех остальных</button>
          </div>

          <div className={label}>2. Отправить выбранным — по {BATCH} за нажатие</div>
          <div className="flex flex-wrap gap-2">
            <button className={button} style={{ background: '#F5B820' }} disabled={busy} onClick={send} data-testid="campaign-send">
              Отправить следующие {BATCH}
            </button>
            <button className={button} disabled={busy} onClick={() => run(async () => ((await refresh()) ? null : 'Такой кампании нет.'))}>Статус</button>
          </div>

          {note && <div className="font-sans text-[13px] text-jewelInk" data-testid="campaign-note">{note}</div>}
          {status && (
            <div className="font-sans text-[12px] text-jewelInk-mid tabular-nums" data-testid="campaign-status">
              «{status.key}»: выбрано {status.total} (пробная группа {status.sample}) · ждут {status.pending} · дошло {status.sent} ·
              заблокировали {status.blocked} · отказ {status.rejected} · без ответа {status.unknown} · открыли по кнопке {status.opened}
              {status.giftDays > 0 && <> · получили подарок ({status.giftDays} дн.) {status.gifted}</>}
              {' '}· из открывших: начали игру с глаголом {status.playedVerbSession}, доиграли {status.finishedVerbSession}, оплатили {status.paidAfterOpen}
              <div className="mt-1 break-all" data-testid="campaign-button-url">
                {status.buttonText
                  ? <>кнопка «{status.buttonText}» ведёт на: /?{status.buttonQuery ? `${status.buttonQuery}&` : ''}c={status.key}</>
                  : 'сообщение без кнопки'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
