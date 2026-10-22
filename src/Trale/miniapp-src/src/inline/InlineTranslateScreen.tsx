import { useEffect, useState } from 'react'
import Mascot from '../components/Mascot'
import { inlineTranslation, InlineOption } from '../api'

/** Как часто экран спрашивает сервер, пока перевод не готов, и сколько всего ждёт. */
const POLL_MS = 1500
const GIVE_UP_MS = 60_000

/** Что Бомбора делает, пока ждём: строки сменяют друг друга. */
const STEPS = ['Читаю сообщение', 'Перевожу', 'Проверяю, чтобы звучало по-человечески']

/** Буквы, которые летают вокруг Бомборы, пока он работает. */
const LETTERS = ['ა', 'ბ', 'გ', 'დ', 'ე', 'ვ', 'ზ', 'თ']

/**
 * Экран поверх чата: его открывает кнопка над вариантами инлайна («Бомбора листает словарь…»),
 * когда перевод не успел за те секунды, что ждёт Telegram. Пока перевод ищется — Бомбора и буквы,
 * потом варианты: «Вставить в чат» возвращает в чат с «@бот текст», и готовый вариант уже в списке.
 * Уроки и прогресс здесь не грузятся — экран открывают и те, кто бота ни разу не запускал.
 */
export default function InlineTranslateScreen() {
  const text = new URLSearchParams(window.location.search).get('q')?.trim() ?? ''
  const [options, setOptions] = useState<InlineOption[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [step, setStep] = useState(0)
  const [copied, setCopied] = useState<string | null>(null)
  const tg = (window as any).Telegram?.WebApp
  const canInsert = typeof tg?.switchInlineQuery === 'function'

  useEffect(() => {
    if (!text) return
    let stopped = false
    const deadline = Date.now() + GIVE_UP_MS
    ;(async () => {
      while (!stopped) {
        try {
          const r = await inlineTranslation(text)
          if (r.status === 'done') {
            if (r.options.length === 0) setFailed(true)
            else setOptions(r.options)
            return
          }
        } catch {
          // Сеть моргнула — спросим ещё раз.
        }
        if (Date.now() >= deadline) {
          setFailed(true)
          return
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS))
      }
    })()
    return () => { stopped = true }
  }, [text])

  useEffect(() => {
    if (options || failed) return
    const timer = setInterval(() => setStep((s) => (s + 1) % STEPS.length), 1400)
    return () => clearInterval(timer)
  }, [options, failed])

  function insert() {
    try {
      tg.switchInlineQuery(text + ' ')
    } catch {}
  }

  async function copy(option: InlineOption) {
    try {
      await navigator.clipboard.writeText(option.text)
      setCopied(option.id)
      setTimeout(() => setCopied(null), 1500)
    } catch {}
  }

  const working = !options && !failed

  return (
    <div
      className="flex flex-col min-h-full bg-cream px-5"
      style={{ paddingTop: 'calc(var(--safe-t) + 24px)', paddingBottom: 'calc(var(--safe-b) + 32px)' }}
      data-testid="inline-translate-screen"
    >
      <div className="mn-eyebrow mb-2">перевод</div>
      <div
        className="rounded-2xl border-[1.5px] border-jewelInk/30 bg-cream-tile px-3 py-2 font-sans text-[15px] text-jewelInk whitespace-pre-wrap break-words"
        data-testid="inline-source"
      >
        {text}
      </div>

      {working && (
        <div className="flex flex-col items-center pt-8" data-testid="inline-working">
          <div className="relative" style={{ width: 220, height: 200 }}>
            {LETTERS.map((letter, i) => (
              <span
                key={letter}
                className="inline-letter absolute font-sans font-extrabold text-ruby"
                style={{
                  left: `${10 + ((i * 37) % 80)}%`,
                  top: `${(i * 53) % 70}%`,
                  animationDelay: `${i * 0.35}s`,
                  fontSize: 18 + (i % 3) * 6
                }}
              >
                {letter}
              </span>
            ))}
            <div className="absolute inset-0 flex items-end justify-center">
              <div className="anim-wag">
                <Mascot mood="think" size={150} />
              </div>
            </div>
          </div>
          <div className="mt-4 font-sans text-[17px] font-extrabold text-jewelInk" data-testid="inline-step" key={step}>
            <span className="anim-page inline-block">{STEPS[step]}…</span>
          </div>
        </div>
      )}

      {failed && (
        <div className="flex flex-col items-center gap-3 pt-10 text-center" data-testid="inline-failed">
          <Mascot mood="sleep" size={110} />
          <div className="font-sans text-[15px] text-jewelInk-mid max-w-[280px]">
            Не получилось перевести. Это точно русский или грузинский? Попробуй ещё раз чуть позже.
          </div>
        </div>
      )}

      {options && (
        <div className="flex flex-col gap-3 pt-6" data-testid="inline-options">
          <div className="flex justify-center">
            <Mascot mood="cheer" size={90} />
          </div>
          {options.map((option) => (
            <div
              key={option.id}
              className="rounded-2xl border-[1.5px] border-jewelInk bg-white px-4 py-3"
              style={{ boxShadow: '3px 3px 0 #15100A' }}
              data-testid={`inline-option-${option.id}`}
            >
              <div className="mn-eyebrow mb-1">{option.title}</div>
              <div className="font-sans text-[17px] text-jewelInk leading-snug whitespace-pre-wrap break-words">{option.text}</div>
              <button
                type="button"
                onClick={() => copy(option)}
                className="mt-2 font-sans text-[13px] font-extrabold text-navy"
              >
                {copied === option.id ? 'Скопировано' : 'Скопировать'}
              </button>
            </div>
          ))}
          {canInsert && (
            <button
              type="button"
              onClick={insert}
              className="jewel-btn jewel-btn-gold w-full mt-2 font-sans text-[16px] font-extrabold"
              data-testid="inline-insert"
            >
              Вставить в чат
            </button>
          )}
        </div>
      )}
    </div>
  )
}
