import { useEffect, useState } from 'react'
import { adminFeedback, PAYWALL_DECLINE_OPTIONS, type AdminFeedbackDto, type AdminFeedbackItem, type FeedbackOptionCount } from '../../api'

// Что говорят пользователи: счётчики по вариантам («Что остановило?» на экране покупки и опросы-рассылки)
// и последние ответы с текстом. Только чтение; то же самое с фильтром по датам — scripts/sql/feedback-report.sql.

const KIND: Record<AdminFeedbackItem['kind'], string> = { paywall: 'не купил', survey: 'опрос', message: 'написал' }

const paywallLabel = (code: string) => PAYWALL_DECLINE_OPTIONS.find(o => o.id === code)?.label ?? code

function when(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function Counts({ options, label }: { options: FeedbackOptionCount[]; label: (option: string) => string }) {
  const total = options.reduce((sum, o) => sum + o.count, 0)
  return (
    <div className="flex flex-col gap-1.5">
      {options.map(o => (
        <div key={o.option}>
          <div className="flex justify-between gap-2 font-sans text-[13px] text-jewelInk">
            <span>{label(o.option)}</span>
            <span className="tabular-nums font-extrabold">{o.count}</span>
          </div>
          <div className="h-1.5 rounded bg-jewelInk/10">
            <div className="h-1.5 rounded bg-navy" style={{ width: total ? `${(100 * o.count) / total}%` : 0 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function FeedbackPanel({ onOpenUser }: { onOpenUser: (telegramId: number) => void }) {
  const [data, setData] = useState<AdminFeedbackDto | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => { adminFeedback.overview().then(setData).catch(() => setFailed(true)) }, [])

  const answered = data?.paywall.options.reduce((sum, o) => sum + o.count, 0) ?? 0

  return (
    <div className="mb-5" data-testid="feedback-panel">
      <div className="mn-eyebrow mb-2">Отзывы</div>
      <div className="jewel-tile px-4 py-4">
        <div className="relative z-[1] flex flex-col gap-4">
          {failed && <div className="font-sans text-[13px] text-jewelInk">Не получилось загрузить.</div>}
          {!data && !failed && <div className="font-sans text-[13px] text-jewelInk-mid">Загружаем…</div>}
          {data && (
            <>
              <div data-testid="feedback-paywall">
                <div className="font-sans text-[13px] font-extrabold text-jewelInk">Что остановило? — экран покупки</div>
                <div className="font-sans text-[12px] text-jewelInk-mid mb-2 tabular-nums">
                  спросили {data.paywall.shown} · ответили {answered}
                </div>
                <Counts options={data.paywall.options} label={paywallLabel} />
              </div>

              {data.surveys.map(s => (
                <div key={s.key} data-testid={`feedback-survey-${s.key}`}>
                  <div className="font-sans text-[13px] font-extrabold text-jewelInk">Опрос «{s.key}»</div>
                  <div className="font-sans text-[12px] text-jewelInk-mid mb-2 line-clamp-2">{s.question}</div>
                  <Counts options={s.options} label={o => o} />
                </div>
              ))}

              <div>
                <div className="font-sans text-[13px] font-extrabold text-jewelInk mb-1">Последние ответы</div>
                {data.recent.length === 0 && <div className="font-sans text-[13px] text-jewelInk-mid">Пока никто ничего не написал.</div>}
                <div className="flex flex-col divide-y divide-jewelInk/10" data-testid="feedback-recent">
                  {data.recent.map((r, i) => (
                    <div key={i} className="py-2">
                      <div className="flex flex-wrap items-baseline gap-x-2 font-sans text-[11px] text-jewelInk-mid">
                        <span className="font-extrabold uppercase tracking-wider text-navy">{KIND[r.kind]}</span>
                        {r.campaignKey && <span>«{r.campaignKey}»</span>}
                        <span className="tabular-nums">{when(r.atUtc)}</span>
                        <button type="button" className="underline tabular-nums min-h-[44px] -my-3" onClick={() => onOpenUser(r.telegramId)}>
                          {r.telegramId}
                        </button>
                      </div>
                      {r.option && (
                        <div className="font-sans text-[13px] font-bold text-jewelInk">
                          {r.kind === 'paywall' ? paywallLabel(r.option) : r.option}
                        </div>
                      )}
                      {r.text && <div className="font-sans text-[13px] text-jewelInk whitespace-pre-wrap break-words">{r.text}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
