import React from 'react'

interface Props {
  children: React.ReactNode
}

export default function SentenceSlotRow({ children }: Props) {
  return (
    <div
      data-testid="sentence-slot-row"
      className="flex flex-row gap-2 overflow-x-auto pb-1"
      style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
    >
      {children}
    </div>
  )
}
