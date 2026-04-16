import { useState, useEffect, useRef } from 'react'
import { getTodayGeorgian } from '../utils/georgianDays'

export default function DayOfWeekChip() {
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const day = getTodayGeorgian()

  function handleTap() {
    if (open) {
      setOpen(false)
      if (timerRef.current) clearTimeout(timerRef.current)
    } else {
      setOpen(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setOpen(false), 5000)
    }
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleTap}
        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-full border border-jewelInk/30
          transition-colors duration-150 active:bg-navy/10
          ${open ? 'opacity-80' : ''}`}
        aria-label={`«${day.geo}» — тап чтобы узнать перевод`}
        aria-expanded={open}
      >
        <span className="font-geo text-[14px] font-semibold text-navy leading-none">
          {day.geo}
        </span>
        <span className="text-[10px] text-jewelInk/40 leading-none">›</span>
      </button>

      {open && (
        <div
          className="day-tooltip-in jewel-tile px-4 py-3 w-full max-w-[240px] text-center"
          style={{ background: '#1B5FB0' }}
          role="tooltip"
        >
          <div className="font-geo text-[20px] font-extrabold text-cream leading-none">
            {day.geo}
          </div>
          <div className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-cream/70 mt-1">
            {day.translit}
          </div>
          <div className="font-sans text-[13px] font-semibold text-cream mt-1">
            {day.ru}
          </div>
          {day.numberHint && (
            <>
              <div className="my-2 h-px bg-cream/20" />
              <div className="font-sans text-[11px] text-cream/80">
                {day.numberHint}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
