import React from 'react'

interface Props {
  children: React.ReactNode
}

export default function SentenceSlotRow({ children }: Props) {
  return (
    <div
      data-testid="sentence-slot-row"
      className="flex flex-wrap gap-2 pb-1"
    >
      {children}
    </div>
  )
}
