import React, { useState } from 'react'

interface Props {
  label: string
  defaultOpen?: boolean
  icon?: string
  children: React.ReactNode
}

// Collapsible section used on LessonTheory for the first-visit UX:
// hides secondary theory (rest letters / explanation) behind a tap.
// Trigger is a full-width jewel-tile button; body slides open with a fade.
export default function TheoryAccordion({
  label,
  defaultOpen = false,
  icon = '📖',
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-5 py-4 bg-cream border-[1px] border-jewelInk/20 rounded-xl font-sans text-[15px] font-bold text-jewelInk"
        style={{ boxShadow: '1px 1px 0 rgba(21,16,10,0.1)' }}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true">{icon}</span>
          <span>{label}</span>
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease',
          }}
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="#15100A"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div className="flex flex-col gap-4 pt-4">
          {children}
        </div>
      )}
    </div>
  )
}
