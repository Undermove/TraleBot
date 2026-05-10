import React from 'react'

interface Props {
  children: React.ReactNode
}

export default function ChipPool({ children }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2" data-testid="chip-pool">
      {children}
    </div>
  )
}
