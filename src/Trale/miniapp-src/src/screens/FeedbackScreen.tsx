import { useState } from 'react'
import Header from '../components/Header'
import Mascot from '../components/Mascot'
import { ApiError, feedback, FEEDBACK_MAX_LENGTH } from '../api'
import { ProgressState } from '../types'

interface Props {
  progress: ProgressState
  /** Имя опроса, из которого пришли кнопкой «Написать подробнее» — сообщение привяжется к нему. */
  campaign?: string
  onBack: () => void
}

/**
 * «Написать автору»: поле и кнопка. Сюда ведут плитка в профиле и кнопка «Написать подробнее»
 * под ответом на опрос. Текст уходит владельцу как есть; ответа здесь не будет — для разговора
 * есть чат поддержки.
 */
export default function FeedbackScreen({ progress, campaign, onBack }: Props) {
  const [text, setText] = useState('')
  const [state, setState] = useState<'writing' | 'sending' | 'sent'>('writing')
  const [error, setError] = useState<string | null>(null)

  async function send() {
    if (!text.trim() || state !== 'writing') return
    setState('sending')
    setError(null)
    try {
      await feedback.send(text.trim(), campaign)
      setState('sent')
    } catch (e) {
      setError(e instanceof ApiError && e.status === 429
        ? 'На сегодня хватит — напиши завтра, я всё прочитаю.'
        : 'Не получилось отправить. Попробуй ещё раз.')
      setState('writing')
    }
  }

  return (
    <div className="flex flex-col min-h-full bg-cream" data-testid="feedback-screen">
      <Header progress={progress} onBack={onBack} eyebrow="обратная связь" title="Написать автору" />

      <div className="flex-1 px-5 pt-4" style={{ paddingBottom: 'calc(var(--safe-b) + 32px)' }}>
        {state === 'sent' ? (
          <div className="flex flex-col items-center gap-3 pt-8 text-center" data-testid="feedback-sent">
            <Mascot mood="cheer" size={110} />
            <div className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight">Спасибо!</div>
            <div className="font-sans text-[14px] text-jewelInk-mid max-w-[280px]">
              Сообщение у меня. Читаю всё сам.
            </div>
            <button type="button" onClick={onBack} className="jewel-btn jewel-btn-gold w-full mt-3 font-sans text-[16px] font-extrabold">
              Вернуться
            </button>
          </div>
        ) : (
          <>
            <div className="font-sans text-[15px] text-jewelInk leading-snug mb-3">
              {campaign
                ? 'Расскажи подробнее — пары слов хватит.'
                : 'Что нравится, чего не хватает, что раздражает — пиши как есть.'}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={FEEDBACK_MAX_LENGTH}
              rows={7}
              autoFocus
              placeholder="Твоё сообщение"
              aria-label="Твоё сообщение"
              className="w-full px-3 py-3 rounded-xl border-[1.5px] border-jewelInk bg-white font-sans text-[15px] text-jewelInk resize-none"
              style={{ boxShadow: '3px 3px 0 #15100A' }}
            />
            <div className="mt-1.5 text-right font-sans text-[11px] text-jewelInk-mid tabular-nums" data-testid="feedback-counter">
              {text.length} / {FEEDBACK_MAX_LENGTH}
            </div>

            {error && <div className="font-sans text-[13px] text-ruby mt-2" data-testid="feedback-error">{error}</div>}

            <button
              type="button"
              onClick={send}
              disabled={!text.trim() || state === 'sending'}
              className="jewel-btn jewel-btn-gold w-full mt-3 font-sans text-[16px] font-extrabold"
            >
              {state === 'sending' ? 'Отправляем…' : 'Отправить'}
            </button>

            <div className="mt-4 font-sans text-[12px] text-jewelInk-mid text-center">
              Ответить отсюда не смогу. Нужен ответ — напиши в{' '}
              <a href="https://t.me/TraleBotSupport" target="_blank" rel="noopener" className="underline">чат поддержки</a>.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
