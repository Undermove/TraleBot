import React from 'react'

interface Props {
  children: React.ReactNode
  useGrid?: boolean
}

export default function ChipPool({ children, useGrid }: Props) {
  return (
    <div
      className={useGrid ? 'grid gap-2' : 'flex flex-wrap gap-2'}
      style={useGrid ? { gridTemplateColumns: 'repeat(3, 1fr)' } : undefined}
      data-testid="chip-pool"
    >
      {children}
    </div>
  )
}
