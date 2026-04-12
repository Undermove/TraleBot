import React from 'react'
import Mascot from '../components/Mascot'
import { Screen } from '../types'

export type UserLevel = 'beginner' | 'intermediate'

interface Props {
  onSelect: (level: UserLevel) => void
}

export default function Onboarding({ onSelect }: Props) {
  return (
    <div
      className="flex flex-col bg-cream"
      style={{ minHeight: '100dvh', paddingTop: 'var(--safe-t)' }}
    >
      <div className="mn-kilim" />

      <div
        className="flex-1 flex flex-col items-center px-6 pt-8"
        style={{ paddingBottom: 'calc(var(--safe-b) + 24px)' }}
      >
        <Mascot mood="cheer" size={120} />

        <div className="font-geo text-[14px] text-jewelInk-mid font-semibold mt-4">
          გამარჯობა!
        </div>
        <h1 className="font-sans text-[28px] font-extrabold text-jewelInk text-center leading-tight mt-2 tracking-tight">
          Привет!
          <br />
          <span className="text-ruby">Я Бомбора</span>
        </h1>
        <p className="font-sans text-[15px] text-jewelInk-mid text-center mt-3 max-w-[300px] leading-snug">
          Буду помогать тебе учить грузинский. Расскажи немного о себе:
        </p>

        <div className="w-full max-w-[340px] mt-8 flex flex-col gap-4">
          {/* Beginner */}
          <button
            onClick={() => onSelect('beginner')}
            className="jewel-tile jewel-pressable text-left px-5 py-5"
          >
            <div className="flex items-center gap-4 relative z-[1]">
              <div
                className="shrink-0 w-14 h-14 rounded-xl bg-navy border-[1.5px] border-jewelInk flex items-center justify-center"
                style={{ boxShadow: '2px 2px 0 #15100A' }}
              >
                <span className="font-geo text-[28px] font-extrabold text-cream leading-none">ა</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-sans text-[18px] font-extrabold text-jewelInk leading-tight">
                  Начинаю с нуля
                </div>
                <div className="font-sans text-[13px] text-jewelInk-mid mt-1 leading-snug">
                  Не знаю алфавит, хочу начать с основ
                </div>
              </div>
            </div>
          </button>

          {/* Intermediate */}
          <button
            onClick={() => onSelect('intermediate')}
            className="jewel-tile jewel-pressable text-left px-5 py-5"
          >
            <div className="flex items-center gap-4 relative z-[1]">
              <div
                className="shrink-0 w-14 h-14 rounded-xl bg-ruby border-[1.5px] border-jewelInk flex items-center justify-center"
                style={{ boxShadow: '2px 2px 0 #15100A' }}
              >
                <span className="font-geo text-[28px] font-extrabold text-cream leading-none">ქ</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-sans text-[18px] font-extrabold text-jewelInk leading-tight">
                  Уже что-то знаю
                </div>
                <div className="font-sans text-[13px] text-jewelInk-mid mt-1 leading-snug">
                  Читаю буквы, хочу грамматику и лексику
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="mt-6 font-sans text-[12px] text-jewelInk-hint text-center max-w-[280px]">
          Все уроки будут доступны — это только поможет Бомборе подсказать, с чего начать
        </div>
      </div>

      <div className="mn-kilim opacity-70" />
      <div style={{ height: 'calc(var(--safe-b) + 4px)' }} />
    </div>
  )
}
