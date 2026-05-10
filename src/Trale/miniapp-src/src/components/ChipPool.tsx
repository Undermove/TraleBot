import React from 'react'

interface Props {
  children: React.ReactNode
}

export default function ChipPool({ children }: Props) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="chip-pool">
      {children}
    </div>
  )
}
