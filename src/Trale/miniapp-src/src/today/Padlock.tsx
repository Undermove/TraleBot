import React from 'react'

/** Замок на подарке: открывается занятием. open — дужка откинута. */
export default function Padlock({ size = 34, open = false }: { size?: number; open?: boolean }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 40 46" aria-hidden="true">
      <path d={open ? 'M11 20 V12 a9 9 0 0 1 17.500 -3' : 'M11 20 V13 a9 9 0 0 1 18 0 V20'} fill="none" stroke="#15100A" strokeWidth="7" strokeLinecap="round" />
      <path d={open ? 'M11 20 V12 a9 9 0 0 1 17.500 -3' : 'M11 20 V13 a9 9 0 0 1 18 0 V20'} fill="none" stroke="#9AA6AF" strokeWidth="3.500" strokeLinecap="round" />
      <rect x="4" y="19" width="32" height="24" rx="6" fill="#F5B820" stroke="#15100A" strokeWidth="3" />
      <rect x="8" y="22" width="24" height="5" rx="2.500" fill="#FCD76D" />
      <circle cx="20" cy="31" r="3.500" fill="#15100A" />
      <path d="M20 33 V38" stroke="#15100A" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
