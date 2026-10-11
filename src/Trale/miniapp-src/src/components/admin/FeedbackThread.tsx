import { useEffect, useRef, useState } from 'react'
import { adminThreads, ApiError, type FeedbackThreadDto, type FeedbackThreadItemDto, type ReplyDelivery } from '../../api'
import { paywallLabel, STATUS, when } from './feedbackView'

// Переписка с одним человеком: его тексты (письмо автору, свой ответ в опросе, комментарий с экрана покупки)
// с подписью, откуда они, и ответы владельца — в том порядке, как было. Ответ уходит человеку сообщением
// бота: его слова цитатой и ответ от имени автора; под сообщением кнопка «Ответить», которая открывает
// «Написать автору» в мини-аппе. Один написанный ответ уходит один раз, сколько бы ни нажимали.
// Компонент ничего не знает об экране, на котором стоит, — его можно перенести в любой раздел админки.

interface Props {
  telegramId: number
  /** Текст, на который нажали «Ответить» — он и будет процитирован. */
  quoteId?: string
  onOpenUser: (telegramId: number) => void
}

/** Что случилось с ответом, словами. */
const DELIVERY: Record<ReplyDelivery, string | null> = {
  sent: null,
  sending: 'отправляется…',
  blocked: 'человек заблокировал бота — ответ не доставлен',
  rejected: 'Telegram не принял сообщение — ответ не доставлен',
  unknown: 'Telegram не ответил — неизвестно, дошёл ли ответ'
}

const newToken = () => {
  try { return crypto.randomUUID() } catch { return `${Date.now()}-${Math.random().toString(36).slice(2)}` }
}

function source(item: FeedbackThreadItemDto): string {
  if (item.kind === 'paywall') return `экран покупки${item.option ? ` · ${paywallLabel(item.option)}` : ''}`
  if (item.kind === 'survey') return `опрос: ${item.question ?? 'вопрос'}${item.option ? ` · ${item.option}` : ''}`
  return item.question ? `письмо автору после опроса: ${item.question}` : 'письмо автору'
}

const oneLine = (text: string) => text.split(/\s+/).filter(Boolean).join(' ')
const shorten = (text: string) => (oneLine(text).length <= 200 ? oneLine(text) : `${oneLine(text).slice(0, 199).trimEnd()}…`)

export default function FeedbackThread({ telegramId, quoteId, onOpenUser }: Props) {
  const [thread, setThread] = useState<FeedbackThreadDto | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  /** Один на написанный ответ: пока он не ушёл, все нажатия «Отправить» несут его же. */
  const token = useRef(newToken())

  const load = () => adminThreads.get(telegramId).then(setThread)
  useEffect(() => {
    load().catch(e => setProblem(e instanceof ApiError && e.status === 404 ? 'Нет доступа или такого человека нет.' : 'Не получилось загрузить. Попробуй ещё раз.'))
  }, [telegramId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (problem) return <div className="font-sans text-[14px] text-jewelInk" data-testid="thread-problem">{problem}</div>
  if (!thread) return <div className="font-sans text-[13px] text-jewelInk-mid">Загружаем…</div>

  const theirs = thread.items.filter(i => !i.fromOwner)
  const quoted = theirs.find(i => i.id === quoteId) ?? theirs[theirs.length - 1]
  const tooLong = text.trim().length > thread.maxReplyLength

  async function send() {
    if (!text.trim() || tooLong || busy) return
    setBusy(true)
    setNote(null)
    try {
      const r = await adminThreads.reply(telegramId, text.trim(), token.current, quoted?.id)
      token.current = newToken()
      setText('')
      setNote(DELIVERY[r.delivery] ? `Ответ записан, но ${DELIVERY[r.delivery]}.` : 'Ответ отправлен.')
      await load()
    } catch (e) {
      // Токен остаётся прежним: если ответ на самом деле ушёл, повторное нажатие его не продублирует.
      let reason = 'не получилось — проверь связь и нажми ещё раз'
      if (e instanceof ApiError) { try { reason = JSON.parse(e.body).error ?? reason } catch {} }
      setNote(reason)
    } finally {
      setBusy(false)
    }
  }

  async function dismiss() {
    setBusy(true)
    setNote(null)
    try {
      await adminThreads.dismiss(telegramId)
      setNote('Убрано из неотвеченных. Человеку ничего не ушло.')
      await load()
    } catch {
      setNote('не получилось — попробуй ещё раз')
    } finally {
      setBusy(false)
    }
  }

  const waiting = thread.status === 'new' || thread.status === 'repliedBack'

  return (
    <div className="flex flex-col gap-3" data-testid="feedback-thread">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => onOpenUser(telegramId)} className="font-sans text-[15px] font-extrabold text-navy underline tabular-nums min-h-[44px] text-left" data-testid="thread-user">
          Пользователь {telegramId}
        </button>
        <span className={`shrink-0 px-2 py-1 rounded-lg font-sans text-[12px] font-extrabold ${waiting ? 'bg-ruby text-white' : 'bg-jewelInk/10 text-jewelInk'}`} data-testid="thread-status">
          {STATUS[thread.status]}
        </span>
      </div>
      {!thread.reachable && (
        <div className="font-sans text-[13px] font-bold text-ruby" data-testid="thread-unreachable">Человек заблокировал бота — ответ до него не дойдёт.</div>
      )}

      <div className="flex flex-col gap-2" data-testid="thread-items">
        {thread.items.map(item => (
          <div
            key={item.id} data-testid={item.fromOwner ? 'thread-owner' : 'thread-theirs'}
            className={`max-w-[90%] rounded-2xl px-3 py-2 border-[1.5px] ${item.fromOwner ? 'self-end bg-cream-tile border-jewelInk/30 rounded-br-md' : 'self-start bg-white border-jewelInk rounded-bl-md'}`}
          >
            <div className="font-sans text-[11px] text-jewelInk-mid break-words">
              {item.fromOwner ? 'ты' : source(item)} · <span className="tabular-nums">{when(item.atUtc)}</span>
            </div>
            <div className="font-sans text-[14px] text-jewelInk whitespace-pre-wrap break-words">{item.text}</div>
            {item.delivery && DELIVERY[item.delivery] && (
              <div className="font-sans text-[12px] font-bold text-ruby mt-1" data-testid="thread-delivery">{DELIVERY[item.delivery]}</div>
            )}
          </div>
        ))}
      </div>

      {quoted ? (
        <>
          <div className="mn-eyebrow mt-2">Твой ответ</div>
          <textarea
            value={text} onChange={e => setText(e.target.value)} rows={4} aria-label="Твой ответ" placeholder="Напиши ответ"
            className="w-full px-3 py-2 rounded-xl border-[1.5px] border-jewelInk bg-white font-sans text-[15px] text-jewelInk resize-none"
          />
          {tooLong && <div className="font-sans text-[13px] text-ruby">Ответ длиннее {thread.maxReplyLength} символов — сократи.</div>}

          {text.trim() && (
            <div data-testid="thread-preview">
              <div className="font-sans text-[12px] text-jewelInk-mid mb-1">Так придёт человеку в бот:</div>
              <div className="rounded-2xl p-3" style={{ background: '#D5E0D0' }}>
                <div className="max-w-[92%]">
                  <div className="rounded-2xl rounded-bl-md bg-white px-3 py-2 font-sans text-[14px] text-jewelInk whitespace-pre-wrap break-words shadow-sm">
                    Твоё сообщение: «{shorten(quoted.text)}»{'\n\n'}{thread.signature}: {text.trim()}
                  </div>
                  <div className="rounded-lg px-2 py-2 mt-1 text-center font-sans text-[14px] font-bold text-white" style={{ background: 'rgba(60,80,60,0.55)' }}>Ответить</div>
                </div>
              </div>
            </div>
          )}

          <button type="button" onClick={send} disabled={!text.trim() || tooLong || busy} className="jewel-btn jewel-btn-gold w-full font-sans text-[16px] font-extrabold" data-testid="thread-send">
            {busy ? 'Отправляем…' : 'Отправить'}
          </button>
          {waiting && (
            <button type="button" onClick={dismiss} disabled={busy} className="font-sans text-[14px] font-bold text-navy underline min-h-[44px] disabled:opacity-50" data-testid="thread-dismiss">
              Не требует ответа
            </button>
          )}
        </>
      ) : (
        <div className="font-sans text-[13px] text-jewelInk-mid">Этот человек пока ничего не писал — отвечать не на что.</div>
      )}
      {note && <div className="font-sans text-[14px] text-jewelInk" data-testid="thread-note">{note}</div>}
    </div>
  )
}
