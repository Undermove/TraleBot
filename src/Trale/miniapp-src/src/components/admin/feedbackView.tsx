import { PAYWALL_DECLINE_OPTIONS, type AdminFeedbackItem, type CampaignAudience, type FeedbackOptionCount } from '../../api'
import { AUDIENCES } from './CampaignPanel'

// Общие куски экранов «Опрос» и «Отзывы»: полоски-счётчики, список ответов, подписи.

export const paywallLabel = (code: string) => PAYWALL_DECLINE_OPTIONS.find(o => o.id === code)?.label ?? code

export const audienceName = (id: CampaignAudience) => AUDIENCES.find(a => a.id === id)?.name ?? id

export function day(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export const answered = (options: FeedbackOptionCount[]) => options.reduce((sum, o) => sum + o.count, 0)

/** Варианты ответа: сколько человек выбрали каждый и какая это доля ответивших. */
export function Counts({ options, label = o => o }: { options: FeedbackOptionCount[]; label?: (option: string) => string }) {
  const total = answered(options)
  return (
    <div className="flex flex-col gap-2" data-testid="feedback-counts">
      {options.map(o => (
        <div key={o.option}>
          <div className="flex justify-between gap-3 font-sans text-[14px] text-jewelInk">
            <span className="min-w-0 break-words">{label(o.option)}</span>
            <span className="tabular-nums font-extrabold shrink-0">
              {o.count}{total > 0 && <span className="font-normal text-jewelInk-mid"> · {Math.round((100 * o.count) / total)}%</span>}
            </span>
          </div>
          <div className="h-1.5 rounded bg-jewelInk/10 mt-0.5">
            <div className="h-1.5 rounded bg-navy" style={{ width: total ? `${(100 * o.count) / total}%` : 0 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Ответы по одному: когда, кто (по тапу — карточка пользователя), выбранный вариант и текст. */
export function Answers({ items, empty, tag, onOpenUser }: {
  items: AdminFeedbackItem[]
  empty: string
  /** Пометка над ответом — например, из какого он опроса. */
  tag?: (item: AdminFeedbackItem) => string | null
  onOpenUser: (telegramId: number) => void
}) {
  if (items.length === 0) return <div className="font-sans text-[13px] text-jewelInk-mid">{empty}</div>
  return (
    <div className="flex flex-col divide-y divide-jewelInk/10" data-testid="feedback-answers">
      {items.map((r, i) => (
        <div key={i} className="py-2.5">
          <div className="flex flex-wrap items-baseline gap-x-2 font-sans text-[11px] text-jewelInk-mid">
            <span className="tabular-nums">{when(r.atUtc)}</span>
            <button type="button" className="underline tabular-nums min-h-[44px] -my-3" onClick={() => onOpenUser(r.telegramId)}>
              {r.telegramId}
            </button>
          </div>
          {tag?.(r) && <div className="font-sans text-[11px] text-navy font-bold">{tag(r)}</div>}
          {r.option && (
            <div className="font-sans text-[13px] font-bold text-jewelInk">{r.kind === 'paywall' ? paywallLabel(r.option) : r.option}</div>
          )}
          {r.text && <div className="font-sans text-[14px] text-jewelInk whitespace-pre-wrap break-words">{r.text}</div>}
        </div>
      ))}
    </div>
  )
}
