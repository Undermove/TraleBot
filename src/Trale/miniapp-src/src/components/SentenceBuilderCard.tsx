import React, { useState } from 'react'
import { QuizQuestion } from '../types'
import WordChip from './WordChip'
import SentenceSlot, { SlotState } from './SentenceSlot'
import SentenceSlotRow from './SentenceSlotRow'
import ChipPool from './ChipPool'
import FeedbackBanner from './FeedbackBanner'

interface Props {
  question: QuizQuestion
  onAnswer: (isCorrect: boolean) => void
}

const LONG_SENTENCE_THRESHOLD = 7

export default function SentenceBuilderCard({ question, onAnswer }: Props) {
  const correctOrder = question.correctOrder ?? []
  const chipPoolTokens = question.chipPool ?? []
  const presetPositions = question.presetPositions ?? []
  const hints = question.hints ?? {}
  const targetRu = question.targetSentence?.ru ?? question.question

  const presetMap = new Map(presetPositions.map((p) => [p.position, p.token]))
  const presetSet = new Set(presetPositions.map((p) => p.position))

  // Detect broken question: any non-preset slot whose correct token isn't in chipPool
  const nonPresetTokensNeeded = correctOrder.filter((_, i) => !presetSet.has(i))
  const hasError = nonPresetTokensNeeded.some((token) => !chipPoolTokens.includes(token))

  // slots[i] = token placed in slot i (preset or user-placed), null if empty
  const [slots, setSlots] = useState<(string | null)[]>(() =>
    correctOrder.map((_, i) => presetMap.get(i) ?? null)
  )

  // chips: each entry tracks a chip from the pool
  const [chips, setChips] = useState<{ token: string; inSlot: boolean }[]>(() =>
    chipPoolTokens.map((token) => ({ token, inSlot: false }))
  )

  // Index of chip currently playing the shake animation (all slots full)
  const [shakingChipIdx, setShakingChipIdx] = useState<number | null>(null)

  const [phase, setPhase] = useState<'answering' | 'checked'>('answering')
  const [isAllCorrect, setIsAllCorrect] = useState(false)

  const allSlotsFilled = slots.every(
    (token, i) => presetSet.has(i) || token !== null
  )

  if (hasError) {
    return (
      <div data-testid="sentence-builder-card">
        <div
          className="jewel-tile px-4 py-[14px] mb-4 flex flex-col gap-2"
          style={{ background: '#FBF6EC', border: '1.5px solid #15100A', boxShadow: '3px 3px 0 #15100A' }}
        >
          <div className="mn-eyebrow">Упражнение не загрузилось</div>
          <div className="font-sans text-[14px] text-jewelInk/70 leading-snug">
            В упражнении отсутствуют нужные слова. Пропустим его.
          </div>
        </div>
        <button
          onClick={() => onAnswer(false)}
          className="w-full min-h-[52px] rounded-xl border-[1.5px] border-jewelInk bg-navy text-cream font-sans text-[16px] font-extrabold"
          style={{ boxShadow: '2px 2px 0 #15100A' }}
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  function handleChipTap(chipIdx: number) {
    if (phase === 'checked') return
    if (chips[chipIdx].inSlot) return

    // Find first empty non-preset slot in order
    const firstEmptySlotIdx = slots.findIndex((token, i) => !presetSet.has(i) && token === null)

    if (firstEmptySlotIdx === -1) {
      // All slots already filled — trigger shake animation
      setShakingChipIdx(chipIdx)
      setTimeout(() => setShakingChipIdx(null), 150)
      return
    }

    // Place chip into first empty slot
    const token = chips[chipIdx].token
    setChips((prev) =>
      prev.map((c, i) => (i === chipIdx ? { ...c, inSlot: true } : c))
    )
    setSlots((prev) => prev.map((t, i) => (i === firstEmptySlotIdx ? token : t)))
  }

  function handleSlotTap(slotIdx: number) {
    if (phase === 'checked') return
    if (presetSet.has(slotIdx)) return

    if (slots[slotIdx] !== null) {
      // Return chip to pool: find first inSlot chip with matching token
      const token = slots[slotIdx]!
      setChips((prev) => {
        const idx = prev.findIndex((c) => c.token === token && c.inSlot)
        if (idx === -1) return prev
        const next = [...prev]
        next[idx] = { ...next[idx], inSlot: false }
        return next
      })
      setSlots((prev) => prev.map((t, i) => (i === slotIdx ? null : t)))
    }
  }

  function handleVerify() {
    if (!allSlotsFilled) return
    const allCorrect = slots.every((token, i) => token === correctOrder[i])
    setIsAllCorrect(allCorrect)
    setPhase('checked')
  }

  function handleNext() {
    onAnswer(isAllCorrect)
  }

  return (
    <div data-testid="sentence-builder-card">
      {/* Target sentence reference tile */}
      <div
        className="jewel-tile px-4 py-[14px] mb-4"
        style={{ background: '#FBF6EC', border: '1.5px solid #15100A', boxShadow: '3px 3px 0 #15100A' }}
      >
        <div className="mn-eyebrow mb-2 relative z-[1]">Собери предложение</div>
        <div className="h-px bg-jewelInk/15 mb-2 relative z-[1]" />
        <div
          data-testid="question-text"
          className={`font-sans font-extrabold text-jewelInk leading-tight relative z-[1] ${correctOrder.length >= LONG_SENTENCE_THRESHOLD ? 'text-[18px]' : 'text-[22px]'}`}
        >
          {targetRu}
        </div>
      </div>

      {/* Slot zone label */}
      <div className="mn-eyebrow mb-2">
        <span className="font-geo">წინადადება</span>
      </div>

      {/* Sentence slots */}
      <SentenceSlotRow>
        {slots.map((token, i) => {
          const isPreset = presetSet.has(i)
          let state: SlotState = 'empty'
          if (isPreset) {
            state = 'preset'
          } else if (token !== null) {
            if (phase === 'checked') {
              state = token === correctOrder[i] ? 'correct' : 'incorrect'
            } else {
              state = 'filled'
            }
          }

          return (
            <SentenceSlot
              key={i}
              state={state}
              chip={token ? { text: token } : undefined}
              hint={
                phase === 'checked' && state === 'incorrect'
                  ? hints[String(i)]
                  : undefined
              }
              onTap={() => handleSlotTap(i)}
              data-testid={`slot-${i}`}
            />
          )
        })}
      </SentenceSlotRow>

      {/* Divider */}
      <div className="h-px bg-jewelInk/15 my-4" />

      {/* Chip pool label */}
      <div className="mn-eyebrow mb-2">
        <span className="font-geo">სიტყვები</span>
      </div>

      {/* Chip pool */}
      <ChipPool useGrid={correctOrder.length >= LONG_SENTENCE_THRESHOLD}>
        {chips.map((chip, i) => {
          if (chip.inSlot) return null
          const chipState =
            phase === 'checked'
              ? 'disabled'
              : i === shakingChipIdx
              ? 'shaking'
              : 'default'
          return (
            <WordChip
              key={`${chip.token}-${i}`}
              text={chip.token}
              state={chipState}
              onTap={() => handleChipTap(i)}
            />
          )
        })}
      </ChipPool>

      {/* Feedback banner */}
      {phase === 'checked' && (
        <FeedbackBanner
          isCorrect={isAllCorrect}
          body={
            isAllCorrect ? (
              'Отличная работа!'
            ) : (
              <div>
                <div className="text-[13px] uppercase tracking-widest font-extrabold opacity-75 mb-1">
                  Должно было быть
                </div>
                <div
                  data-testid="sentence-builder-correct-answer"
                  className="font-geo text-[18px] font-semibold leading-snug whitespace-normal break-words"
                >
                  {correctOrder.join(' ')}
                </div>
              </div>
            )
          }
          topMargin="mt-4"
        />
      )}

      {/* Action button */}
      <div className="mt-4">
        {phase === 'answering' ? (
          <button
            onClick={handleVerify}
            disabled={!allSlotsFilled}
            aria-disabled={!allSlotsFilled}
            className={`w-full min-h-[52px] rounded-xl border-[1.5px] font-sans text-[16px] font-extrabold transition-all duration-75 ${
              allSlotsFilled
                ? 'bg-navy text-cream border-jewelInk'
                : 'bg-cream text-jewelInk/40 border-jewelInk/30 opacity-40'
            }`}
            style={
              allSlotsFilled ? { boxShadow: '2px 2px 0 #15100A' } : {}
            }
          >
            Проверить
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="w-full min-h-[52px] rounded-xl border-[1.5px] border-jewelInk bg-navy text-cream font-sans text-[16px] font-extrabold"
            style={{ boxShadow: '2px 2px 0 #15100A' }}
          >
            Далее
          </button>
        )}
      </div>
    </div>
  )
}
