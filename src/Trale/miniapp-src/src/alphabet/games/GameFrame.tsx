import React, { useEffect, useState } from 'react'
import './alphabet.css'
import { haptic, isMuted, onMuteChange, setMuted } from './fx'

// Рамка игры внутри урока: та же шапка, что у вопросов (назад, полоска урока), название игры
// и выключатель звука. Под шапкой — сама игра.

export function SoundIcon({ on, size = 20 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#15100A" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="#F5B820" />
      {on
        ? <><path d="M15.5 9a4 4 0 0 1 0 6" /><path d="M18 6.5a7.5 7.5 0 0 1 0 11" /></>
        : <path d="M16 9.5l5 5M21 9.5l-5 5" />}
    </svg>
  )
}

export function SoundToggle() {
  const [muted, set] = useState(isMuted())
  useEffect(() => onMuteChange(set), [])
  return (
    <button
      onClick={() => { haptic('tap'); setMuted(!muted) }}
      aria-label={muted ? 'Включить звук' : 'Выключить звук'}
      data-testid="sound-toggle"
      className="shrink-0 w-11 h-11 rounded-xl bg-cream-tile border-[1.5px] border-jewelInk flex items-center justify-center"
      style={{ boxShadow: '2px 2px 0 #15100A' }}
    >
      <SoundIcon on={!muted} />
    </button>
  )
}

export function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M10 3 L4 8 L10 13" stroke="#15100A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function GameFrame({ title, eyebrow, fraction, onExit, children }: {
  title: string
  eyebrow: string
  /** Сколько урока пройдено, 0..1 — полоска та же, что у вопросов. */
  fraction: number
  onExit: () => void
  children: React.ReactNode
}) {
  const pct = Math.round(Math.max(0, Math.min(1, fraction)) * 100)
  return (
    <div className="flex flex-col bg-cream" style={{ minHeight: '100dvh' }} data-testid="alphabet-game">
      <div className="sticky top-0 z-30 bg-cream/95 backdrop-blur-sm" style={{ paddingTop: 'var(--safe-t)' }}>
        <div className="mn-kilim" />
        <div className="px-5 py-3 flex items-center gap-3">
          <button
            onClick={onExit}
            aria-label="Назад"
            className="shrink-0 w-11 h-11 rounded-xl bg-cream-tile border-[1.5px] border-jewelInk flex items-center justify-center"
            style={{ boxShadow: '2px 2px 0 #15100A' }}
          ><BackIcon /></button>
          <div className="flex-1 h-3 bg-cream-deep border-[1.5px] border-jewelInk rounded-full overflow-hidden">
            <div className="h-full bg-navy transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <SoundToggle />
        </div>
      </div>
      <div className="px-5 pt-2 text-center">
        <div className="mn-eyebrow text-navy">{eyebrow}</div>
        <h2 className="mt-1 font-sans text-[22px] font-extrabold text-jewelInk leading-tight">{title}</h2>
      </div>
      <div className="flex-1 flex flex-col px-5 pt-4" style={{ paddingBottom: 'calc(var(--safe-b) + 24px)' }}>
        {children}
      </div>
    </div>
  )
}
