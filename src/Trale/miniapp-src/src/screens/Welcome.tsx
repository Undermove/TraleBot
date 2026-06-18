import React, { useState } from 'react'
import Mascot from '../components/Mascot'
import Button from '../components/Button'
import AudioPlayer from '../components/AudioPlayer'

interface Props {
  /** Called when the user finishes the mini-lesson — App records the first XP and reveals the hub. */
  onFinish: () => void
}

type Step = 'meet' | 'listen' | 'name' | 'done'

// The welcome lesson teaches exactly ONE letter — ა — but with a few small,
// rewarding tasks (meet → listen → name) instead of a single trivial tap, so a
// brand-new user gets real value and a sense of accomplishment in ~30 seconds.
const LETTER = 'ა'
const LETTER_SOUND = 'а'
const LETTER_NAME = 'ани'
const LETTER_AUDIO = '/audio/alphabet/a.m4a'

// Distractors share the rhyming Georgian letter-name pattern (ани / бани / мани),
// which is real and makes the name task feel like a fun pattern, not a trick.
const LETTER_OPTIONS: ReadonlyArray<{ letter: string; sound: string }> = [
  { letter: 'ა', sound: 'а' },
  { letter: 'ბ', sound: 'б' },
  { letter: 'მ', sound: 'м' },
]
const NAME_OPTIONS: ReadonlyArray<string> = ['ани', 'бани', 'мани']

export default function Welcome({ onFinish }: Props) {
  const [step, setStep] = useState<Step>('meet')
  const [wrong, setWrong] = useState<string | null>(null)

  function answer(pick: string, correct: string, next: Step) {
    if (pick === correct) {
      setWrong(null)
      setStep(next)
    } else {
      setWrong(pick)
    }
  }

  return (
    <div
      className="flex flex-col items-center bg-cream"
      style={{ minHeight: '100dvh', paddingTop: 'calc(var(--safe-t) + 8px)' }}
      data-testid="welcome-screen"
    >
      <div className="mn-kilim" />

      <div
        className="flex-1 w-full max-w-[420px] flex flex-col items-center px-6 pt-6"
        style={{ paddingBottom: 'calc(var(--safe-b) + 24px)' }}
      >
        {/* ── Step 1 · meet the letter ───────────────────────────── */}
        {step === 'meet' && (
          <>
            <Mascot mood="cheer" size={116} />
            <div className="mn-eyebrow text-jewelInk-hint mt-4 mb-1">первый шаг · ნაბიჯი</div>
            <h1 className="font-sans text-[24px] font-extrabold text-jewelInk text-center leading-tight tracking-tight">
              Знакомься — твоя
              <br />
              первая грузинская буква
            </h1>

            <div className="mt-7 flex flex-col items-center">
              <div
                className="w-28 h-28 rounded-2xl bg-navy border-[1.5px] border-jewelInk flex items-center justify-center"
                style={{ boxShadow: '3px 3px 0 #15100A' }}
              >
                <span className="font-geo text-[64px] font-extrabold text-cream leading-none">{LETTER}</span>
              </div>
              <div className="mt-4 font-sans text-[17px] text-jewelInk text-center leading-snug">
                Её зовут <span className="font-extrabold">«{LETTER_NAME}»</span>, звучит как{' '}
                <span className="font-extrabold">«{LETTER_SOUND}»</span>
              </div>
              <div className="mt-4">
                <AudioPlayer url={LETTER_AUDIO} />
              </div>
              <div className="mt-1.5 font-sans text-[12px] text-jewelInk-hint">нажми, чтобы послушать</div>
            </div>

            <div className="mt-auto w-full pt-6">
              <Button variant="primary" onClick={() => setStep('listen')}>
                дальше →
              </Button>
            </div>
          </>
        )}

        {/* ── Step 2 · listening (аудирование) ───────────────────── */}
        {step === 'listen' && (
          <>
            <Mascot mood={wrong ? 'think' : 'guide'} size={100} />
            <div className="mn-eyebrow text-jewelInk-hint mt-4 mb-1">на слух</div>
            <h2 className="font-sans text-[22px] font-extrabold text-jewelInk text-center leading-tight">
              Послушай и выбери букву, которую слышишь
            </h2>

            <div className="mt-6">
              <AudioPlayer url={LETTER_AUDIO} />
            </div>

            <div className="mt-7 w-full grid grid-cols-3 gap-3">
              {LETTER_OPTIONS.map((opt) => {
                const isWrong = wrong === opt.letter
                return (
                  <button
                    key={opt.letter}
                    data-testid={`welcome-listen-${opt.sound}`}
                    onClick={() => answer(opt.letter, LETTER, 'name')}
                    className={`aspect-square rounded-2xl border-[1.5px] border-jewelInk flex items-center justify-center active:scale-95 transition-transform ${
                      isWrong ? 'bg-cream-deep opacity-50' : 'bg-cream-tile'
                    }`}
                    style={{ minHeight: '64px', boxShadow: isWrong ? 'none' : '2px 2px 0 #15100A' }}
                  >
                    <span className="font-geo text-[40px] font-extrabold text-jewelInk leading-none">
                      {opt.letter}
                    </span>
                  </button>
                )
              })}
            </div>

            {wrong && (
              <p className="mt-5 font-sans text-[14px] text-jewelInk-mid text-center leading-snug">
                Послушай ещё разок и выбери <span className="font-extrabold">«{LETTER_SOUND}»</span>.
              </p>
            )}
          </>
        )}

        {/* ── Step 3 · name of the letter ────────────────────────── */}
        {step === 'name' && (
          <>
            <Mascot mood={wrong ? 'think' : 'happy'} size={100} />
            <div className="mn-eyebrow text-jewelInk-hint mt-4 mb-1">а как её зовут?</div>
            <h2 className="font-sans text-[22px] font-extrabold text-jewelInk text-center leading-tight">
              Как называется буква <span className="font-geo">{LETTER}</span>?
            </h2>

            <div className="mt-8 w-full flex flex-col gap-3">
              {NAME_OPTIONS.map((name) => {
                const isWrong = wrong === name
                return (
                  <button
                    key={name}
                    data-testid={`welcome-name-${name}`}
                    onClick={() => answer(name, LETTER_NAME, 'done')}
                    className={`w-full rounded-2xl border-[1.5px] border-jewelInk py-4 active:scale-[0.98] transition-transform ${
                      isWrong ? 'bg-cream-deep opacity-50' : 'bg-cream-tile'
                    }`}
                    style={{ minHeight: '52px', boxShadow: isWrong ? 'none' : '2px 2px 0 #15100A' }}
                  >
                    <span className="font-sans text-[18px] font-extrabold text-jewelInk">{name}</span>
                  </button>
                )
              })}
            </div>

            {wrong && (
              <p className="mt-5 font-sans text-[14px] text-jewelInk-mid text-center leading-snug">
                Почти! Подсказка: буква на «а» — и имя на «а».
              </p>
            )}
          </>
        )}

        {/* ── Step 4 · win ───────────────────────────────────────── */}
        {step === 'done' && (
          <>
            <Mascot mood="cheer" size={130} />
            <div className="mn-eyebrow text-ruby mt-4 mb-1">первая победа 🎉</div>
            <h2 className="font-sans text-[24px] font-extrabold text-jewelInk text-center leading-tight tracking-tight">
              Готово! Буква <span className="font-geo">ა</span> «{LETTER_NAME}» — твоя
            </h2>
            <p className="font-sans text-[15px] text-jewelInk-mid text-center mt-3 max-w-[300px] leading-snug">
              Ты узнал имя, звук и услышал её. Заработал первый опыт ⭐ Дальше — твой блокнот с уроками.
            </p>

            <div className="mt-auto w-full pt-6">
              <Button variant="green" onClick={onFinish}>
                открыть приложение →
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
