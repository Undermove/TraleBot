import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { DictIcon } from '../alphabet/words/WordIntro'
import Button from '../components/Button'
import Mascot from '../components/Mascot'
import { cyr } from '../verbs/types'
import { haptic, isMuted, playClip } from '../alphabet/games/fx'
import { INTRO_AUDIO, INTRO_WORD_AUDIO } from './audio'
import { WORD_AUDIO } from '../alphabet/games/data'
import { HERO, myName, replyRu, type Phrase, type Rng } from './story'
import './intro.css'

// Общие детали сцен «Знакомства»: человечки, реплики, кнопки-реплики, карточка правила, экран итога сцены.
// Цвета — палитра мини-аппа (Minankari), обводка и тень — как у остальных игр.

export const INK = '#15100A'

// ── Человечки ─────────────────────────────────────────────────────────────────────────────────────

export interface Look { coat: string; skin: string; hair: string; bag?: boolean; long?: boolean; age?: 'kid' | 'adult' | 'old' }
const COATS = ['#1B5FB0', '#E01A3C', '#4E8A5B', '#C68F10', '#7A4E9A', '#D4563B', '#2F7F86', '#3A2B1F']
const SKIN = ['#F2C9A0', '#E0AC7E', '#C68A5E', '#F6D7BC']
const HAIR = ['#2A1F18', '#5A3A22', '#9A6A3A', '#15100A', '#B5A68B']

export function randomLook(rng: Rng = Math.random, extra: Partial<Look> = {}): Look {
  const p = <T,>(a: T[]) => a[Math.floor(rng() * a.length)]
  return { coat: p(COATS), skin: p(SKIN), hair: p(HAIR), long: rng() < 0.5, ...extra }
}

export type Mood = 'smile' | 'sad' | 'huh' | 'wow'

/** Человечек в полный рост (46×92 в своих единицах; размер задаёт height). */
export function Person({ look, mood = 'smile', height = 92, className = '', style }: {
  look: Look; mood?: Mood; height?: number; className?: string; style?: React.CSSProperties
}) {
  const old = look.age === 'old', kid = look.age === 'kid'
  const hair = old ? '#E8DEC5' : look.hair
  return (
    <svg viewBox="0 0 46 92" height={height} width={height / 2} className={className} style={style} aria-hidden>
      <g transform={kid ? 'translate(5 22) scale(0.78)' : undefined}>
        {look.long && <path d="M8 20 Q6 40 11 46 L35 46 Q40 40 38 20Z" fill={hair} stroke={INK} strokeWidth="1.5" />}
        <rect x="9" y="38" width="28" height="40" rx="12" fill={look.coat} stroke={INK} strokeWidth="1.5" />
        <rect x="13" y="74" width="7" height="16" rx="3" fill="#3A2B1F" stroke={INK} strokeWidth="1.5" />
        <rect x="26" y="74" width="7" height="16" rx="3" fill="#3A2B1F" stroke={INK} strokeWidth="1.5" />
        <circle cx="23" cy="22" r="14" fill={look.skin} stroke={INK} strokeWidth="1.5" />
        <path d="M9 20 Q11 6 23 7 Q35 6 37 20 Q31 13 23 14 Q15 13 9 20Z" fill={hair} stroke={INK} strokeWidth="1.5" />
        {old && <path d="M14 24 h8 M24 24 h8" stroke={INK} strokeWidth="1.2" />}
        <circle cx="18" cy="23" r="1.7" fill={INK} /><circle cx="28" cy="23" r="1.7" fill={INK} />
        {mood === 'sad' && <path d="M18 31 Q23 27 28 31" stroke={INK} strokeWidth="1.5" fill="none" />}
        {mood === 'huh' && <circle cx="23" cy="30" r="2" fill={INK} />}
        {mood === 'wow' && <ellipse cx="23" cy="30.5" rx="2.6" ry="3.2" fill={INK} />}
        {mood === 'smile' && <path d="M17 29 Q23 34 29 29" stroke={INK} strokeWidth="1.5" fill="none" />}
        {look.bag && <rect x="33" y="58" width="12" height="13" rx="2" fill="#F5B820" stroke={INK} strokeWidth="1.5" />}
      </g>
    </svg>
  )
}

/** Лицо человечка в кружке — для чатов и бейджей. */
export function Face({ look, size = 40, mood = 'smile' }: { look: Look; size?: number; mood?: Mood }) {
  return (
    <div className="shrink-0 rounded-full border-[1.5px] border-jewelInk overflow-hidden bg-cream-deep flex items-start justify-center" style={{ width: size, height: size }}>
      <Person look={look} mood={mood} height={size * 2.1} style={{ marginTop: -size * 0.06 }} />
    </div>
  )
}

// ── Грузинский текст ──────────────────────────────────────────────────────────────────────────────

/** Грузинская строка и под ней — как звучит, кириллицей. */
export function Geo({ text, size = 18, sub = true, className = '' }: { text: string; size?: number; sub?: boolean; className?: string }) {
  return (
    <span className={`inline-flex flex-col items-center leading-tight ${className}`}>
      <span className="font-geo font-bold" style={{ fontSize: size }}>{text}</span>
      {sub && <span className="text-[11px] font-semibold text-jewelInk-hint">{cyr(text)}</span>}
    </span>
  )
}

/**
 * Играет запись, если она есть: фразу (объект или id из story.json) или отдельное слово по грузинскому
 * тексту — формы словарика «Знакомства» и слова алфавита.
 */
export function say(p: Phrase | string) {
  const key = typeof p === 'string' ? p : p.id
  const url = INTRO_AUDIO[key] ?? INTRO_WORD_AUDIO[key] ?? WORD_AUDIO[key]
  if (url && !isMuted()) playClip(url).catch(() => {})
}

/** Пузырь реплики над героем. */
export function Bubble({ children, tone = 'plain', className = '', style }: {
  children: React.ReactNode; tone?: 'plain' | 'good' | 'bad' | 'think'; className?: string; style?: React.CSSProperties
}) {
  const bg = tone === 'good' ? 'bg-[#D6E9D9]' : tone === 'bad' ? 'bg-ruby-wash' : tone === 'think' ? 'bg-gold-wash' : 'bg-cream-tile'
  return (
    <div className={`zn-pop rounded-2xl border-[1.5px] border-jewelInk px-3 py-1.5 text-center ${bg} ${className}`} style={{ boxShadow: '2px 2px 0 #15100A', ...style }}>
      {children}
    </div>
  )
}

/** Размер шрифта реплики по длине: короткие — крупно, длинные фразы — мельче, чтобы влезли в кнопку. */
export function replySize(geo: string, compact?: boolean): number {
  const n = geo.length
  const base = n > 26 ? 13 : n > 18 ? 15 : 17
  return compact ? base - 2 : base
}

/** Какой урок «Знакомства» идёт — кнопки-реплики решают по нему, показывать ли перевод. */
export const IntroLessonId = React.createContext(0)

/** Кнопка-реплика: грузинская фраза крупно, под ней перевод (второй акт) или кириллица. */
export function Reply({ geo, hint, onClick, state = 'idle', disabled, testId, compact }: {
  geo: string; hint?: string; onClick: () => void; state?: 'idle' | 'good' | 'bad' | 'dim'; disabled?: boolean; testId?: string; compact?: boolean
}) {
  const lessonId = React.useContext(IntroLessonId)
  hint = hint ?? replyRu(lessonId, geo)
  const bg = state === 'good' ? 'bg-[#D6E9D9]' : state === 'bad' ? 'bg-ruby-wash zn-shake' : 'bg-cream-tile'
  return (
    <button
      data-testid={testId}
      disabled={disabled}
      onClick={() => { haptic('tap'); onClick() }}
      className={`min-h-[44px] w-full min-w-0 rounded-2xl border-[1.5px] border-jewelInk ${compact ? 'px-2 py-1.5' : 'px-3 py-2'} text-center transition-transform active:translate-x-[2px] active:translate-y-[2px] ${bg} ${state === 'dim' ? 'opacity-40' : ''}`}
      style={{ boxShadow: '3px 3px 0 #15100A' }}
    >
      {/* Длинная реплика — мельче и переносится по словам, но никогда не вылезает за кнопку. */}
      <span className="block font-geo font-bold leading-tight break-words [overflow-wrap:anywhere]" style={{ fontSize: replySize(geo, compact) }}>{geo}</span>
      {(hint ?? cyr(geo)) !== '' && <span className="block text-[11px] font-semibold text-jewelInk-hint leading-tight break-words [overflow-wrap:anywhere]">{hint ?? cyr(geo)}</span>}
    </button>
  )
}

/** Подсказка Бомборы под игрой. */
export function Tip({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-[40px] rounded-xl border-[1.5px] border-dashed border-jewelInk-faint bg-gold-wash/70 px-3 py-2 text-[13px] leading-snug text-jewelInk-soft" aria-live="polite">
      {children}
    </div>
  )
}

/** Карточка правила — то, что человек «нашёл» и что ложится в коллекцию. */
export function RuleCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="zn-pop text-left rounded-2xl border-[1.5px] border-jewelInk bg-navy-wash px-4 py-3" style={{ boxShadow: '3px 3px 0 #15100A' }} data-testid="rule-card">
      <div className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-navy">{title}</div>
      <div className="mt-1 text-[15px] leading-snug text-jewelInk">{children}</div>
    </div>
  )
}

/** Карточка «Ты»: кто ты в истории — чтобы ответы о себе были известны заранее. */
export function HeroCard() {
  const me = myName()
  return (
    <div className="w-full max-w-[320px] flex items-center gap-2.5 rounded-2xl border-[1.5px] border-jewelInk bg-gold-wash px-3 py-2 text-left" style={{ boxShadow: '2px 2px 0 #15100A' }} data-testid="hero-card">
      <Face look={{ coat: '#1B5FB0', skin: '#F2C9A0', hair: '#5A3A22' }} size={40} />
      <div className="min-w-0 text-[13px] leading-snug">
        <div className="font-extrabold">Ты — {me.ru} (<span className="font-geo">{me.geo}</span>)</div>
        <div className="text-jewelInk-soft">{HERO.job.ru} (<span className="font-geo font-bold">{HERO.job.geo}</span>), живёшь в Батуми (<span className="font-geo font-bold">{HERO.city.in}</span>). Откуда ты — выбери сам.</div>
      </div>
    </div>
  )
}

/** Экран начала игры: что за игра и как в неё играть. hero — показать карточку «Ты». */
export function GameIntro({ title, text, chips, onStart, mood = 'guide', hero, plan }: {
  title: string; text: string; chips?: { geo: string; ru: string }[]; onStart: () => void; mood?: 'guide' | 'cheer' | 'happy' | 'think'; hero?: boolean
  /** Из чего состоит сцена по времени — например, три визита: утро, день, вечер. */
  plan?: React.ReactNode
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center gap-3" data-testid="game-intro">
      <div className="ab-short:hidden"><Mascot mood={mood} size={84} /></div>
      <div className="text-[21px] font-extrabold leading-tight">{title}</div>
      <p className="text-[14px] leading-snug text-jewelInk-soft max-w-[32ch]">{text}</p>
      {plan}
      {hero && <HeroCard />}
      {chips && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {chips.map(c => (
            <span key={c.geo} className="rounded-lg border-[1.5px] border-jewelInk bg-cream-tile px-2 py-0.5 text-[12px]">
              <b className="font-geo">{c.geo}</b> — {c.ru}
            </span>
          ))}
        </div>
      )}
      <div className="w-full max-w-[280px] mt-1"><Button onClick={() => { haptic('pop'); onStart() }}>Начать</Button></div>
    </div>
  )
}

/** Итог игры: короткая фраза, что получилось, необязательная карточка правила и «дальше». */
export function GameEnd({ title, text, rule, onNext, onAgain, testId = 'game-end' }: {
  title: string; text?: string; rule?: React.ReactNode; onNext: () => void; onAgain?: () => void; testId?: string
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center gap-3 zn-pop" data-testid={testId}>
      <div className="ab-short:hidden"><Mascot mood="cheer" size={80} /></div>
      <div className="text-[22px] font-extrabold leading-tight">{title}</div>
      {text && <p className="text-[14px] leading-snug text-jewelInk-soft max-w-[32ch]">{text}</p>}
      {rule}
      <div className="w-full max-w-[280px] flex flex-col gap-2 mt-1">
        <Button onClick={() => { haptic('pop'); onNext() }}>Дальше</Button>
        {onAgain && <Button variant="ghost" onClick={onAgain}>Ещё раз</Button>}
      </div>
    </div>
  )
}

/** Полоска «терпения» или таймера. */
export function Meter({ value, tone = 'gold', label }: { value: number; tone?: 'gold' | 'sage' | 'ruby' | 'navy'; label?: string }) {
  const color = { gold: '#F5B820', sage: '#4E8A5B', ruby: '#E01A3C', navy: '#1B5FB0' }[tone]
  return (
    <div className="flex-1 h-2.5 rounded-full border-[1.5px] border-jewelInk bg-cream-tile overflow-hidden" aria-label={label} role="meter" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full transition-[width] duration-200" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </div>
  )
}

/** Счётчик-плашка в углу игры. */
export function Pill({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <span data-testid={testId} className="shrink-0 rounded-full border-[1.5px] border-jewelInk bg-cream-tile px-2.5 py-0.5 text-[12px] font-extrabold tabular-nums whitespace-nowrap">
      {children}
    </span>
  )
}

// ── Слова сцены ───────────────────────────────────────────────────────────────────────────────────
// Слово ситуации (story.json → lessons[].scene) появляется там, где оно в жизни: на ценнике, табличке,
// в реплике. Впервые — карточкой «новое слово» с переводом и записью; потом — просто словом в разговоре.

/**
 * Карточка нового слова: грузинское, как звучит, перевод. Появляется пружиной и сразу звучит; нажми —
 * прозвучит ещё раз. Слово из алфавита подписано «знаешь по алфавиту». Где стоять — решает сцена (className).
 */
export function NewWord({ word, className = '', style, onTap, testId = 'new-word' }: {
  word: Phrase; className?: string; style?: React.CSSProperties; onTap?: () => void; testId?: string
}) {
  React.useEffect(() => { say(word) }, [word.id])
  return (
    <button type="button" data-testid={testId} data-word={word.id}
      onClick={() => { haptic('tap'); say(word); onTap?.() }}
      className={`zn-pop rounded-2xl border-[1.5px] border-jewelInk bg-gold-wash px-3 py-1.5 text-left leading-tight ${className}`}
      style={{ boxShadow: '3px 3px 0 #15100A', ...style }}>
      <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-jewelInk-mid">
        {word.alphabet ? 'знаешь по алфавиту' : 'новое слово'}
        {/* После урока слово ляжет в личный словарь — видно сразу, на карточке. */}
        <span className="inline-flex items-center gap-0.5 normal-case tracking-normal font-bold text-jewelInk-hint" data-testid="new-word-dict"><DictIcon size={11} />в словарь</span>
      </span>
      <span className="block font-geo text-[19px] font-bold">{word.geo}</span>
      <span className="block text-[11px] font-semibold text-jewelInk-hint">{cyr(word.geo)} — {word.ru}</span>
    </button>
  )
}

/** Маленькая подпись-слово на предмете (ценник, табличка, кнопка): грузинское и перевод, нажми — прозвучит. */
export function WordTag({ word, className = '', testId }: { word: Phrase; className?: string; testId?: string }) {
  return (
    <button type="button" data-testid={testId} onClick={() => { haptic('tap'); say(word) }}
      className={`inline-flex flex-col items-center rounded-lg border-[1.5px] border-jewelInk bg-cream-tile px-1.5 py-0.5 leading-none ${className}`}>
      <span className="font-geo text-[13px] font-bold">{word.geo}</span>
      <span className="text-[9px] font-semibold text-jewelInk-hint mt-0.5">{word.ru}</span>
    </button>
  )
}

// ── Время суток: значок, план сцены, переход между визитами ───────────────────────────────────────

export type DayPart = 'morning' | 'day' | 'evening'
export const DAY_PART_RU: Record<DayPart, string> = { morning: 'утро', day: 'день', evening: 'вечер' }

export function TimeIcon({ part, size = 14 }: { part: DayPart; size?: number }) {
  if (part === 'evening') {
    return <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden><path d="M11 2.5a6 6 0 1 0 2.5 8.2A5 5 0 0 1 11 2.5Z" fill="#F5B820" stroke={INK} strokeWidth="1.3" /></svg>
  }
  const cy = part === 'morning' ? 10 : 8
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <circle cx="8" cy={cy} r="3.4" fill={part === 'morning' ? '#FF9F5A' : '#F5B820'} stroke={INK} strokeWidth="1.3" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(a => (
        <path key={a} d="M8 1.8v1.6" stroke={INK} strokeWidth="1.3" strokeLinecap="round" transform={`rotate(${a} 8 ${cy})`} />
      ))}
    </svg>
  )
}

/** План сцены по времени: «пн, утро → вт, день → ср, вечер». Пройденное — зелёное, текущее — золотое. */
export function TimeLine({ steps, current, compact, testId = 'time-line' }: { steps: { part: DayPart; label: string }[]; current?: number; compact?: boolean; testId?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center ${compact ? 'gap-0.5' : 'gap-1'}`} data-testid={testId}>
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className={`text-jewelInk-hint font-bold ${compact ? 'text-[10px]' : 'text-[12px]'}`} aria-hidden>→</span>}
          <span className={`flex items-center gap-1 rounded-full border-[1.5px] border-jewelInk ${compact ? 'px-1.5 text-[11px]' : 'px-2 text-[12px]'} py-0.5 font-bold whitespace-nowrap ${current === undefined ? 'bg-cream-tile' : i < current ? 'bg-[#DDEBDD]' : i === current ? 'bg-gold' : 'bg-cream-tile opacity-60'}`}>
            <TimeIcon part={s.part} /> {s.label}
          </span>
        </React.Fragment>
      ))}
    </div>
  )
}

/** Между раундами: какой по счёту, что изменилось, дальше — по кнопке. Пока карточка открыта, сцена ждёт. */
export function RoundCard({ count, title, text, icon, children, go, onGo, testId = 'round-card' }: {
  count: string; title: string; text: string; icon?: React.ReactNode; children?: React.ReactNode; go: string; onGo: () => void; testId?: string
}) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-jewelInk/45" data-testid={testId}>
      <div className="w-full max-w-[320px] rounded-2xl border-[1.5px] border-jewelInk bg-cream px-3 py-4 flex flex-col items-center gap-2.5 text-center zn-pop" style={{ boxShadow: '4px 4px 0 #15100A' }}>
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-jewelInk-mid" data-testid={`${testId}-count`}>{count}</div>
        {icon}
        <div className="text-[20px] font-extrabold leading-tight">{title}</div>
        <p className="text-[13.5px] leading-snug text-jewelInk-soft">{text}</p>
        {children}
        <div className="w-full mt-1" data-testid={`${testId}-go`}><Button onClick={() => { haptic('pop'); onGo() }}>{go}</Button></div>
      </div>
    </div>
  )
}

/** Перед каждым заходом: какой по счёту, какой день и время, что было между заходами. */
export function TimeSkip({ count, title, text, steps, current, go, onGo }: {
  count: string; title: string; text: string; steps: { part: DayPart; label: string }[]; current: number; go: string; onGo: () => void
}) {
  return (
    <RoundCard count={count} title={title} text={text} go={go} onGo={onGo} testId="time-skip" icon={<TimeIcon part={steps[current].part} size={40} />}>
      <TimeLine steps={steps} current={current} compact />
    </RoundCard>
  )
}

/** Короткая плашка поверх сцены («наступил вечер», «дальше без перевода») — не останавливает игру. */
export function Banner({ icon, text, testId = 'banner' }: { icon?: React.ReactNode; text: string; testId?: string }) {
  return (
    <div className="absolute z-40 left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 pointer-events-none" data-testid={testId}>
      <div className="zn-pop flex items-center gap-2 rounded-2xl border-[1.5px] border-jewelInk bg-cream/95 px-3.5 py-2 text-[15px] font-extrabold text-center max-w-[300px]" style={{ boxShadow: '3px 3px 0 #15100A' }}>
        {icon}{text}
      </div>
    </div>
  )
}

/** Плашка «наступил вечер». */
export function TimeBanner({ part, text }: { part: DayPart; text: string }) {
  return <Banner icon={<TimeIcon part={part} size={22} />} text={text} testId="time-banner" />
}

// ── Показ механики: рука тащит предмет к цели ─────────────────────────────────────────────────────

type Box = { x: number; y: number; w: number; h: number }
const boxOf = (el: Element | null | undefined): Box | null => {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height } : null
}

export function FingerIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
      <path d="M8 2.5a1.6 1.6 0 0 1 3.2 0V9l3.6 0.9a2 2 0 0 1 1.5 2.3l-0.8 4.2A2.4 2.4 0 0 1 13.1 18.5H9.4a2.4 2.4 0 0 1-2-1.1L4.2 12.6a1.4 1.4 0 0 1 2.2-1.7L8 12.4Z"
        fill="#FDFAEF" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Первый раз в игре «перетаскивания»: призрачная рука берёт предмет и тащит к цели — по кругу,
 * пока человек сам не коснётся экрана. Целей несколько — по очереди (фото, потом чемодан).
 * Рисуется поверх всего (портал), координаты — по экрану, поэтому сцене ничего не нужно знать.
 */
export function DragDemo({ from, to, label, testId = 'drag-demo' }: {
  from: () => Element | null
  /** Куда тащить: элементы (по очереди) или сдвиг от предмета (бокал — вверх). */
  to: Array<() => Element | null> | { dx: number; dy: number }
  label: string
  testId?: string
}) {
  const [gone, setGone] = useState(false)
  const [loop, setLoop] = useState(0)
  const [pts, setPts] = useState<{ a: Box; b: Box } | null>(null)
  // Первое касание — человек понял, рука уходит.
  useEffect(() => {
    const off = () => setGone(true)
    window.addEventListener('pointerdown', off, { once: true, capture: true })
    return () => window.removeEventListener('pointerdown', off, { capture: true })
  }, [])
  // Где предмет и цель — пересчитываем на каждом круге: сцена могла сдвинуться.
  useEffect(() => {
    if (gone) return
    const measure = () => {
      const a = boxOf(from())
      let b: Box | null = null
      if (Array.isArray(to)) b = boxOf(to[loop % to.length]())
      else if (a) b = { ...a, x: a.x + to.dx, y: a.y + to.dy }
      setPts(a && b ? { a, b } : null)
    }
    const t = window.setTimeout(measure, 60)
    return () => window.clearTimeout(t)
  }, [loop, gone]) // eslint-disable-line react-hooks/exhaustive-deps
  if (gone || typeof document === 'undefined') return null
  const ghost = pts && { w: Math.min(pts.a.w, 120), h: Math.min(pts.a.h, 120) }
  return createPortal(
    <div className="fixed inset-0 z-[60] pointer-events-none" data-testid={testId} aria-hidden>
      {pts && ghost && (
        <motion.div key={loop} className="absolute left-0 top-0"
          initial={{ x: pts.a.x, y: pts.a.y, opacity: 0 }}
          animate={{ x: [pts.a.x, pts.a.x, pts.b.x, pts.b.x, pts.b.x], y: [pts.a.y, pts.a.y, pts.b.y, pts.b.y, pts.b.y], opacity: [0, 1, 1, 1, 0] }}
          transition={{ duration: 2.6, times: [0, 0.18, 0.66, 0.8, 1], ease: 'easeInOut', delay: loop ? 0.5 : 1 }}
          onAnimationComplete={() => setLoop(l => l + 1)}>
          {/* Призрак предмета — едет под пальцем. */}
          <div className="absolute rounded-lg border-2 border-dashed border-jewelInk bg-cream/55"
            style={{ width: ghost.w, height: ghost.h, left: -ghost.w / 2, top: -ghost.h / 2, transform: 'rotate(-4deg)' }} />
          <motion.div className="absolute" style={{ left: -2, top: 0 }}
            animate={{ scale: [1, 0.82, 0.82, 1, 1] }} transition={{ duration: 2.6, times: [0, 0.18, 0.66, 0.8, 1], delay: loop ? 0.5 : 1 }}>
            <span className="block drop-shadow-[2px_3px_0_rgba(21,16,10,0.35)]"><FingerIcon size={40} /></span>
          </motion.div>
        </motion.div>
      )}
      {pts && (
        <div className="absolute inset-x-0 flex justify-center px-4"
          style={{ top: Math.max(8, Math.min(pts.a.y, pts.b.y) - Math.max(pts.a.h, 40) / 2 - 40) }}>
          <div className="rounded-full bg-jewelInk/80 text-cream px-3 py-1 text-[13px] font-extrabold text-center zn-pop" data-testid={`${testId}-label`}>{label}</div>
        </div>
      )}
    </div>,
    document.body
  )
}
