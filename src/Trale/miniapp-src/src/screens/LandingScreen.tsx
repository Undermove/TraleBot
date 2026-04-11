import React from 'react'
import Mascot from '../components/Mascot'

interface Props {
  botUsername?: string
}

/**
 * Public landing page for TraleBot Kutya.
 * Shown when the site is opened outside of Telegram (no initData).
 */
export default function LandingScreen({ botUsername }: Props) {
  const tgLink = botUsername
    ? `https://t.me/${botUsername}`
    : 'https://t.me/traletest_bot'

  return (
    <div className="flex flex-col min-h-full anim-slide">
      {/* Hero */}
      <div
        className="px-6 flex flex-col items-center text-center"
        style={{
          paddingTop: 'calc(var(--safe-t) + 48px)',
          paddingBottom: 36
        }}
      >
        <Mascot mood="cheer" size={180} />
        <h1 className="mt-4 text-4xl font-black leading-tight text-dog-ink">
          Бомбора
        </h1>
        <div className="mt-1 text-dog-muted font-extrabold uppercase tracking-wider text-xs">
          Учит грузинский
        </div>
        <p className="mt-5 text-[15px] leading-relaxed text-dog-ink/80 max-w-[340px]">
          Маленький щенок-репетитор, который проведёт тебя от первой буквы
          <span className="whitespace-nowrap"> ქართული </span>
          до живого разговора. Без стрессов, без сердечек, без платных воскрешений.
        </p>
      </div>

      {/* Feature cards */}
      <div className="px-5 flex flex-col gap-3">
        <Feature
          emoji="🔤"
          title="Алфавит по урокам"
          text="33 буквы, разбитые на 7 коротких уроков. Теория с примерами и практика на распознавание."
        />
        <Feature
          emoji="🚶"
          title="Грамматика — глаголы движения"
          text="11 уроков про направления, времена и спряжения. Самый капризный кусок грузинского — шаг за шагом."
        />
        <Feature
          emoji="📘"
          title="Мой словарь"
          text="Слова, которые ты переводил через бота, прогоняются в квизах. Продуктивное направление: видишь русское — вспоминаешь грузинское."
        />
        <Feature
          emoji="🐾"
          title="По твоему темпу"
          text="Никакой потери жизней, никаких напоминаний-угроз. Купил — учишь. Знаешь алфавит — пропускаешь и идёшь сразу к словам."
        />
      </div>

      {/* CTA */}
      <div
        className="px-6 mt-8 flex flex-col items-center gap-3 text-center"
        style={{ paddingBottom: 'calc(var(--safe-b) + 40px)' }}
      >
        <a
          href={tgLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl bg-dog-accent text-white font-extrabold uppercase tracking-wide shadow-btn active:translate-y-1 transition text-base"
        >
          <TgIcon />
          Открыть в Telegram
        </a>
        <div className="text-dog-muted text-xs font-bold mt-1">
          Мини-аб работает внутри Telegram-бота
        </div>
      </div>
    </div>
  )
}

function Feature({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="bg-white rounded-3xl shadow-card p-4 flex gap-3">
      <div className="w-12 h-12 rounded-2xl bg-dog-accent/15 flex items-center justify-center text-2xl shrink-0">
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-extrabold text-dog-ink">{title}</div>
        <div className="text-dog-muted text-sm mt-0.5 leading-snug">{text}</div>
      </div>
    </div>
  )
}

function TgIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
    </svg>
  )
}
