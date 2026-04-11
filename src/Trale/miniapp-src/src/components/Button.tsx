import React from 'react'

interface Props {
  children: React.ReactNode
  onClick?: () => void
  variant?: 'primary' | 'green' | 'blue' | 'ghost'
  disabled?: boolean
  className?: string
}

export default function Button({ children, onClick, variant = 'primary', disabled, className = '' }: Props) {
  const base =
    'w-full rounded-2xl px-5 py-4 font-extrabold uppercase tracking-wide transition active:translate-y-1 disabled:opacity-50 disabled:active:translate-y-0'
  const styles: Record<string, string> = {
    primary: 'bg-dog-accent text-white shadow-btn',
    green: 'bg-dog-green text-white shadow-btngreen',
    blue: 'bg-dog-blue text-white shadow-btnblue',
    ghost: 'bg-white text-dog-ink shadow-card'
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  )
}
