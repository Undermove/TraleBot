import React from 'react'
import Mascot from '../components/Mascot'

interface Props {
  botUsername?: string
}

/**
 * Public landing page — rendered when the SPA is opened outside of Telegram.
 * Same Minanka system as the app, with a marketing tone.
 */
export default function LandingScreen({ botUsername }: Props) {
  const tgLink = `https://t.me/${botUsername ?? 'trale_bot'}`

  return (
    <div className="flex flex-col min-h-full bg-cream">
      {/* Kilim top strip */}
      <div style={{ paddingTop: 'var(--safe-t)' }}>
        <div className="mn-kilim" />
      </div>

      {/* ══ Hero ══ */}
      <section className="px-6 pt-10 pb-8 text-center">
        <div className="mn-eyebrow text-navy mb-3">ბომბორა · bombora</div>

        <h1 className="font-sans text-[44px] font-extrabold text-jewelInk leading-[0.95] tracking-tight">
          Блокнот для
          <br />
          <span className="text-ruby">грузинского</span>
        </h1>

        <div className="mt-8 flex justify-center">
          <Mascot mood="cheer" size={190} />
        </div>

        <p className="mt-5 font-sans text-[15px] text-jewelInk-soft leading-snug max-w-[340px] mx-auto">
          Маленький щенок-гид проведёт тебя от первой буквы{' '}
          <span className="font-geo font-bold text-jewelInk">ქართული</span> до
          живого разговора в тбилисском дворе.
        </p>
      </section>

      {/* ══ Feature tiles ══ */}
      <section className="px-5 flex flex-col gap-4 pb-8">
        <div className="mn-eyebrow text-center">что внутри</div>

        <FeatureTile
          num="ა"
          numLabel="1"
          accent="navy"
          geo="ანბანი"
          title="Алфавит"
          body="33 буквы, разложенные по семи страницам. Теория и практика на узнавание."
        />
        <FeatureTile
          num="ბ"
          numLabel="2"
          accent="ruby"
          geo="ზმნები"
          title="Глаголы движения"
          body="Одиннадцать уроков про направления, времена и приставки — капризный кусок языка, разобранный шаг за шагом."
        />
        <FeatureTile
          num="გ"
          numLabel="3"
          accent="gold"
          geo="ლექსიკონი"
          title="Твой словарь"
          body="Слова, которые ты переводил через бота, приходят на экран как персональная колода."
        />
        <FeatureTile
          num="დ"
          numLabel="4"
          accent="navy"
          geo="თავისუფლად"
          title="По твоему темпу"
          body="Никаких потерянных жизней и напоминаний-угроз. Купил — учишь. Знаешь алфавит — пропускаешь."
        />
      </section>

      {/* ══ Philosophy ══ */}
      <section className="px-6 mb-10">
        <div className="jewel-tile px-5 py-6 text-center">
          <div className="relative z-[1]">
            <div className="mn-eyebrow mb-3">философия</div>
            <p className="font-sans text-[16px] text-jewelInk leading-[1.5]">
              Блокнот путешественника, в который Бомбора складывает страницы
              по одной. Ни стыда, ни штрафов. Только буквы, слова и тёплый
              тбилисский двор.
            </p>
          </div>
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section
        className="px-6 text-center flex flex-col items-center gap-4"
        style={{ paddingBottom: 'calc(var(--safe-b) + 48px)' }}
      >
        <div className="mn-eyebrow">начать путь</div>

        <a
          href={tgLink}
          target="_blank"
          rel="noopener noreferrer"
          className="jewel-btn bg-navy text-cream w-full max-w-[320px]"
        >
          <TgIcon />
          <span className="relative z-[1]">открыть в telegram</span>
        </a>

        <div className="font-sans text-[12px] text-jewelInk-mid mt-1 max-w-[300px] leading-snug">
          Блокнот работает внутри телеграм-бота.
          <br />
          Поставь · листай · повторяй.
        </div>

        <div className="mt-8 font-sans text-[10px] font-bold text-jewelInk-hint uppercase tracking-widest">
          ბომბორა · 2026
        </div>
      </section>

      <div className="mn-kilim opacity-70" />
      <div style={{ height: 'var(--safe-b)' }} />
    </div>
  )
}

function FeatureTile({
  num,
  numLabel,
  accent,
  geo,
  title,
  body
}: {
  num: string
  numLabel: string
  accent: 'navy' | 'ruby' | 'gold'
  geo: string
  title: string
  body: string
}) {
  const accentBg =
    accent === 'navy' ? 'bg-navy' : accent === 'ruby' ? 'bg-ruby' : 'bg-gold'
  const numColor = accent === 'gold' ? 'text-jewelInk' : 'text-cream'

  return (
    <div className="jewel-tile px-5 py-4 flex items-start gap-4">
      <div className="shrink-0 relative z-[1]">
        <div
          className={`w-14 h-14 rounded-xl ${accentBg} border-[1.5px] border-jewelInk flex items-center justify-center`}
          style={{ boxShadow: '2px 2px 0 #15100A' }}
        >
          <span className={`font-geo text-[28px] font-extrabold leading-none ${numColor}`}>
            {num}
          </span>
        </div>
        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-cream border-[1.5px] border-jewelInk flex items-center justify-center">
          <span className="font-sans text-[9px] font-extrabold text-jewelInk leading-none tabular-nums">
            {numLabel}
          </span>
        </div>
      </div>
      <div className="flex-1 min-w-0 relative z-[1] pt-1">
        <div className="font-geo text-[11px] text-jewelInk-mid font-semibold uppercase tracking-wide">
          {geo}
        </div>
        <h3 className="font-sans text-[18px] font-extrabold text-jewelInk leading-tight mt-0.5">
          {title}
        </h3>
        <p className="font-sans text-[13px] text-jewelInk-soft mt-1 leading-snug">
          {body}
        </p>
      </div>
    </div>
  )
}

function TgIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="relative z-[1] shrink-0"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
    </svg>
  )
}
