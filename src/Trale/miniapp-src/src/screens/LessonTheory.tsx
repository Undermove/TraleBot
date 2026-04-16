import React, { useEffect, useState } from 'react'
import Header from '../components/Header'
import Button from '../components/Button'
import RevealKaniOverlay from '../components/RevealKaniOverlay'
import { CatalogDto, ProgressState, Screen, TheoryBlockDto } from '../types'

interface Props {
  catalog: CatalogDto
  moduleId: string
  lessonId: number
  progress: ProgressState
  navigate: (s: Screen) => void
}

export default function LessonTheory({
  catalog,
  moduleId,
  lessonId,
  progress,
  navigate
}: Props) {
  const module = catalog.modules.find((m) => m.id === moduleId)
  const lesson = module?.lessons.find((l) => l.id === lessonId)
  const theory = lesson?.theory

  const [showReveal, setShowReveal] = useState(false)

  useEffect(() => {
    if (!theory) return
    const hasQani = theory.blocks.some(
      (b) => b.type === 'letters' && b.letters?.some((l) => l.letter === 'ქ')
    )
    const alreadyShown = localStorage.getItem('bombora_kani_reveal_shown')
    if (hasQani && !alreadyShown) {
      const timer = setTimeout(() => setShowReveal(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [theory])

  if (!module || !lesson || !theory) {
    return (
      <div className="flex flex-col min-h-full bg-cream">
        <Header
          progress={progress}
          onBack={() => navigate({ kind: 'module', moduleId })}
          title={`Урок ${lessonId}`}
        />
        <div className="p-5 text-jewelInk-mid">Урок не найден.</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full bg-cream">
      <Header
        progress={progress}
        onBack={() => navigate({ kind: 'module', moduleId })}
        eyebrow={`урок ${lessonId} из ${module.lessons.length}`}
        title={module.title}
      />

      <article
        className="flex-1 px-5 pt-6 pb-in"
        style={{ paddingBottom: 'calc(var(--safe-b) + 110px)' }}
      >
        {/* Title card */}
        <div className="jewel-tile px-5 py-5 mb-5">
          <div className="relative z-[1]">
            <div className="mn-eyebrow mb-2">
              урок № <span className="font-bold tabular-nums">{lessonId}</span>
            </div>
            <h1 className="font-sans text-[26px] font-extrabold text-jewelInk leading-tight">
              {theory.title}
            </h1>
            <div className="mt-3 pt-3 border-t border-jewelInk/10">
              <div className="mn-eyebrow mb-1">цель</div>
              <p className="font-sans text-[14px] text-jewelInk-soft leading-snug">
                {theory.goal}
              </p>
            </div>
          </div>
        </div>

        {/* Theory blocks */}
        <div className="flex flex-col gap-4">
          {theory.blocks.map((b, i) => (
            <TheoryBlock key={i} block={b} />
          ))}
        </div>
      </article>

      {/* Action bar */}
      <div
        className="fixed bottom-0 left-0 right-0 max-w-[480px] mx-auto px-5 pt-4 bg-cream/95 backdrop-blur-sm border-t border-jewelInk/15 z-20"
        style={{ paddingBottom: 'calc(var(--safe-b) + 16px)' }}
      >
        <Button
          variant="primary"
          onClick={() => navigate({ kind: 'practice', moduleId, lessonId })}
        >
          к практике →
        </Button>
      </div>

      {/* Reveal moment: letter ქ connection to ქართული (Georgian) */}
      {showReveal && (
        <RevealKaniOverlay onClose={() => setShowReveal(false)} />
      )}
    </div>
  )
}

function TheoryBlock({ block }: { block: TheoryBlockDto }) {
  if (block.type === 'paragraph') {
    return (
      <div className="px-2">
        <p className="font-sans text-[15px] text-jewelInk leading-[1.6]">
          {block.text}
        </p>
      </div>
    )
  }

  if (block.type === 'list' && block.items) {
    return (
      <div className="jewel-tile px-4 py-4">
        <div className="relative z-[1]">
          <div className="mn-eyebrow mb-2.5">запомним</div>
          <ul className="flex flex-col gap-2">
            {block.items.map((item, j) => (
              <li key={j} className="flex items-start gap-3">
                <span className="shrink-0 w-6 h-6 rounded-md bg-navy text-cream font-sans text-[11px] font-bold flex items-center justify-center tabular-nums mt-0.5">
                  {j + 1}
                </span>
                <span className="flex-1 font-sans text-[14px] text-jewelInk leading-[1.5]">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  if (block.type === 'example') {
    return (
      <div className="jewel-tile px-4 py-4 relative">
        <div
          className="absolute -top-2 left-4 bg-cream px-2 py-0.5 border-[1.5px] border-jewelInk rounded-md"
          style={{ boxShadow: '1px 1px 0 #15100A' }}
        >
          <span className="font-sans text-[9px] font-extrabold uppercase tracking-wider text-ruby">
            пример
          </span>
        </div>
        <div className="relative z-[1] pt-2">
          <div className="font-geo text-[22px] font-bold text-jewelInk leading-tight">
            {block.ge}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-4 h-px bg-jewelInk/30" />
            <div className="font-sans text-[13px] text-jewelInk-soft">
              {block.ru}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (block.type === 'letters' && block.letters) {
    return (
      <div>
        <div className="mn-eyebrow mb-3 px-2">карточки букв</div>
        <div className="grid grid-cols-2 gap-3">
          {block.letters.map((l) => (
            <div key={l.letter} className="jewel-tile p-4 flex flex-col items-center">
              <div className="relative z-[1] flex flex-col items-center w-full">
                <div className="font-geo text-[52px] font-extrabold text-navy leading-none">
                  {l.letter}
                </div>
                <div className="mt-1 px-2 py-0.5 bg-ruby text-cream rounded-md">
                  <span className="font-sans text-[10px] font-bold uppercase tracking-wider">
                    {l.translit}
                  </span>
                </div>
                <div className="mt-1 font-sans text-[10px] text-jewelInk-mid uppercase tracking-wide">
                  {l.name}
                </div>
                <div className="mt-3 w-full pt-3 border-t border-dashed border-jewelInk/20 text-center">
                  <div className="font-geo text-[14px] font-bold text-jewelInk leading-tight">
                    {l.exampleGe}
                  </div>
                  <div className="font-sans text-[11px] text-jewelInk-mid mt-0.5">
                    {l.exampleRu}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}
