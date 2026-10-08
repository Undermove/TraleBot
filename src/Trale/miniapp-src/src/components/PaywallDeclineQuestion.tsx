import { useState } from 'react'
import { feedback, FEEDBACK_MAX_LENGTH, PAYWALL_DECLINE_OPTIONS, type PaywallDeclineOption } from '../api'

interface Props {
  /** Номер вопроса, который сервер выдал при показе, — к нему приписывается ответ. */
  questionId: string
  onDone: () => void
}

/**
 * «Что остановило?» — один вопрос в той же шторке, когда экран покупки закрыли не купив.
 * Показывать его или нет, решает сервер (раз в 30 дней, не тем, кто платит) — см. ProPaywall.
 * Можно закрыть, не отвечая; ответ — один вариант и, по желанию, пара слов.
 */
export default function PaywallDeclineQuestion({ questionId, onDone }: Props) {
  const [option, setOption] = useState<PaywallDeclineOption | null>(null)
  const [text, setText] = useState('')
  const [state, setState] = useState<'asking' | 'sending' | 'thanks' | 'error'>('asking')

  async function send() {
    if (!option || state === 'sending') return
    setState('sending')
    try {
      await feedback.paywallAnswer(questionId, option, text.trim())
      setState('thanks')
      setTimeout(onDone, 1400)
    } catch {
      setState('error')
    }
  }

  if (state === 'thanks') {
    return (
      <div className="py-8 text-center" data-testid="paywall-question-thanks">
        <div className="font-sans text-[20px] font-extrabold text-jewelInk leading-tight">Спасибо!</div>
        <div className="font-sans text-[14px] text-jewelInk-mid mt-1">Это правда помогает.</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 pt-1" data-testid="paywall-question">
      <div className="text-center">
        <div className="font-sans text-[20px] font-extrabold text-jewelInk leading-tight">Что остановило?</div>
        <div className="font-sans text-[13px] text-jewelInk-mid mt-1">
          Один вопрос, чтобы сделать мини-апп лучше. Можно не отвечать.
        </div>
      </div>

      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Что остановило?">
        {PAYWALL_DECLINE_OPTIONS.map((o) => {
          const selected = o.id === option
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setOption(o.id)}
              className="text-left px-4 rounded-xl border-2 min-h-[48px] font-sans text-[15px] font-bold text-jewelInk transition-all"
              style={{
                borderColor: selected ? '#15100A' : 'rgba(21,16,10,0.18)',
                background: selected ? '#FBF6EC' : '#FFFEFA',
                boxShadow: selected ? '0 2px 0 #15100A' : 'none',
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={FEEDBACK_MAX_LENGTH}
        rows={2}
        placeholder="Своими словами — если хочешь"
        aria-label="Своими словами"
        className="w-full px-3 py-2 rounded-xl border-[1.5px] border-jewelInk/40 bg-white font-sans text-[14px] text-jewelInk resize-none"
      />

      {state === 'error' && (
        <div className="font-sans text-[13px] text-ruby text-center">Не получилось отправить. Попробуй ещё раз.</div>
      )}

      <button
        type="button"
        onClick={send}
        disabled={!option || state === 'sending'}
        className="jewel-btn w-full min-h-[52px] font-sans text-[16px] font-extrabold"
        style={{ background: '#F5B820', color: '#15100A', border: '2px solid #15100A', boxShadow: '0 3px 0 #15100A' }}
      >
        {state === 'sending' ? 'Отправляем…' : 'Отправить'}
      </button>

      <button
        type="button"
        onClick={onDone}
        className="font-sans text-[14px] text-jewelInk-mid text-center w-full py-2 active:opacity-60 transition-opacity min-h-[44px]"
      >
        Закрыть
      </button>
    </div>
  )
}
