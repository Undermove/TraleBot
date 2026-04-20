import React, { useState, useEffect } from 'react'
import { DIALOGS } from '../data/dialogs'

export default function DialogOfDayCard() {
  const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) % DIALOGS.length
  const dialog = DIALOGS[dayIndex]

  const [revealed, setRevealedLines] = useState<Set<number>>(new Set())
  const [hintSeen, setHintSeen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [allDoneShown, setAllDone] = useState(false)

  function toggleLine(i: number) {
    setRevealedLines((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
    if (!hintSeen) setHintSeen(true)
  }

  useEffect(() => {
    if (revealed.size === dialog.lines.length && revealed.size > 0 && !allDoneShown) {
      setAllDone(true)
      setTimeout(() => setAllDone(false), 2000)
    }
  }, [revealed]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="jewel-tile mx-5 mb-4 px-5 py-4 jewel-tile-navy">
      {/* Eyebrow row */}
      <div className="flex items-center justify-between mb-3">
        <span className="mn-eyebrow text-navy">{dialog.topic.toUpperCase()}</span>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-5 h-5 flex items-center justify-center text-jewelInk/40 active:text-jewelInk transition-colors p-3 -m-3"
          aria-label={collapsed ? 'Развернуть' : 'Свернуть'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d={collapsed ? 'M2 4 L6 8 L10 4' : 'M2 8 L6 4 L10 8'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Collapsible body */}
      <div
        className="overflow-hidden transition-all duration-[250ms] ease-out"
        style={collapsed ? { maxHeight: 0, opacity: 0 } : { maxHeight: 600, opacity: 1 }}
      >
        {/* Dialog lines */}
        <div className="flex flex-col">
          {dialog.lines.map((line, i) => {
            const isRevealed = revealed.has(i)
            return (
              <React.Fragment key={i}>
                {i > 0 && <div className="h-px bg-jewelInk/10 my-1" />}
                <button
                  onClick={() => toggleLine(i)}
                  className="w-full text-left py-2 px-0 flex items-center justify-between gap-2 active:opacity-70 transition-opacity"
                  aria-label={isRevealed ? `Скрыть перевод: ${line.ru}` : `Показать перевод: ${line.ru}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-geo text-[16px] font-bold text-jewelInk leading-snug whitespace-pre-wrap">
                      — {line.geo}
                    </div>
                    {isRevealed && (
                      <>
                        <div className="h-px bg-gold/30 my-1" />
                        <div className="font-sans text-[13px] text-jewelInk-mid leading-snug mt-1 anim-fade">
                          {line.ru}
                        </div>
                      </>
                    )}
                  </div>
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-gold border border-jewelInk/20 shrink-0 transition-opacity duration-150"
                    style={{ opacity: isRevealed ? 0 : 1 }}
                    aria-hidden="true"
                  />
                </button>
              </React.Fragment>
            )
          })}
        </div>

        {/* Hint */}
        <div
          className="font-sans text-[11px] text-jewelInk/40 mt-3 text-center transition-opacity duration-200"
          style={{ opacity: hintSeen ? 0 : 1 }}
        >
          Тапни на фразу, чтобы увидеть перевод
        </div>

        {/* All-done badge */}
        {allDoneShown && (
          <div className="mt-3 py-1 px-3 rounded-full bg-navy text-cream font-sans text-[12px] font-semibold mx-auto w-fit anim-fade">
            ✓ Диалог прочитан
          </div>
        )}
      </div>
    </div>
  )
}
