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

export default function SentenceBuilderCard({ question, onAnswer }: Props) {
  const correctOrder = question.correctOrder ?? []
  const chipPoolTokens = question.chipPool ?? []
  const presetPositions = question.presetPositions ?? []
  const hints = question.hints ?? {}
  const targetRu = question.targetSentence?.ru ?? question.question

  const presetMap = new Map(presetPositions.map((p) => [p.position, p.token]))
  const presetSet = new Set(presetPositions.map((p) => p.position))

  // slots[i] = token placed in slot i (preset or user-placed), null if empty
  const [slots, setSlots] = useState<(string | null)[]>(() =>
    correctOrder.map((_, i) => presetMap.get(i) ?? null)
  )

  // chips: each entry tracks a chip from the pool
  const [chips, setChips] = useState<{ token: string; inSlot: boolean }[]>(() =>
    chipPoolTokens.map((token) => ({ token, inSlot: false }))
  )

  // Index into chips[] of currently selected chip (null = none selected)
  const [selectedChipIdx, setSelectedChipIdx] = useState<number | null>(null)

  const [phase, setPhase] = useState<'answering' | 'checked'>('answering')
  const [isAllCorrect, setIsAllCorrect] = useState(false)

  const allSlotsFilled = slots.every(
    (token, i) => presetSet.has(i) || token !== null
  )

  function handleChipTap(chipIdx: number) {
    if (phase === 'checked') return
    if (chips[chipIdx].inSlot) return
    setSelectedChipIdx((prev) => (prev === chipIdx ? null : chipIdx))
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
      setSelectedChipIdx(null)
    } else if (selectedChipIdx !== null && !chips[selectedChipIdx].inSlot) {
      // Place selected chip into empty slot
      const token = chips[selectedChipIdx].token
      setChips((prev) =>
        prev.map((c, i) => (i === selectedChipIdx ? { ...c, inSlot: true } : c))
      )
      setSlots((prev) => prev.map((t, i) => (i === slotIdx ? token : t)))
      setSelectedChipIdx(null)
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
        <div className="font-sans text-[22px] font-extrabold text-jewelInk leading-tight relative z-[1]">
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
          } else if (phase === 'answering' && selectedChipIdx !== null) {
            state = 'active'
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
      <ChipPool>
        {chips.map((chip, i) => {
          if (chip.inSlot) return null
          const chipState =
            i === selectedChipIdx
              ? 'selected'
              : phase === 'checked'
              ? 'disabled'
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
            isAllCorrect
              ? 'Отличная работа!'
              : 'Посмотри правильный порядок слов выше'
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
