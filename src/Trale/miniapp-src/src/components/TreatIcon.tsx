import React, { useId } from 'react'

// Еда Бомборы: объёмные рисунки с мягким светом и тенью вместо эмодзи.
// 0 — косточка, 1 — мясо, 2 — мцвади на шампуре, 3 — чурчхела, 4 — супра.

const Shadow = ({ cx = 32, cy = 58, rx = 22 }: { cx?: number; cy?: number; rx?: number }) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry="3.500" fill="#3A2412" opacity=".22" />
)

export default function TreatIcon({ index, size = 40 }: { index: number; size?: number }) {
  const id = useId().replace(/:/g, '')
  const u = (n: string) => `url(#${id}${n})`
  const g = (n: string) => `${id}${n}`
  const stops = (c: [string, string][]) => c.map(([o, col]) => <stop key={o} offset={o} stopColor={col} />)
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" data-testid={`treat-icon-${index}`}>
      <defs>
        <linearGradient id={g('bone')} x1="0" y1="0" x2="0" y2="1">{stops([['0', '#FFFDF4'], ['.55', '#F0E2C4'], ['1', '#BFA478']])}</linearGradient>
        <radialGradient id={g('meat')} cx=".38" cy=".3" r=".85">{stops([['0', '#F0766A'], ['.5', '#C5352F'], ['1', '#74161A']])}</radialGradient>
        <linearGradient id={g('fat')} x1="0" y1="0" x2="1" y2="1">{stops([['0', '#FFF6E6'], ['1', '#E9C9A4']])}</linearGradient>
        <radialGradient id={g('grill')} cx=".36" cy=".28" r=".85">{stops([['0', '#D98A45'], ['.55', '#9A4C20'], ['1', '#4B210E']])}</radialGradient>
        <linearGradient id={g('steel')} x1="0" y1="0" x2="1" y2="0">{stops([['0', '#8C9299'], ['.5', '#EEF1F4'], ['1', '#7A8087']])}</linearGradient>
        <radialGradient id={g('church')} cx=".35" cy=".3" r=".8">{stops([['0', '#B5553A'], ['.55', '#7A2B22'], ['1', '#3F1212']])}</radialGradient>
        <radialGradient id={g('plate')} cx=".5" cy=".42" r=".6">{stops([['0', '#FFFFFF'], ['.75', '#F3EDE0'], ['1', '#C9BDA6']])}</radialGradient>
        <linearGradient id={g('wood')} x1="0" y1="0" x2="0" y2="1">{stops([['0', '#B97A45'], ['1', '#6E4122']])}</linearGradient>
        <radialGradient id={g('cheese')} cx=".4" cy=".3" r=".8">{stops([['0', '#FFE9A0'], ['.65', '#F1B63C'], ['1', '#B86F18']])}</radialGradient>
        <radialGradient id={g('wine')} cx=".35" cy=".25" r=".85">{stops([['0', '#C43A63'], ['1', '#4E0D28']])}</radialGradient>
      </defs>

      {index === 0 && (<>
        <Shadow />
        <g transform="rotate(-28 32 32)">
          <path d="M18 25 a8 8 0 1 0 -6 13 a8 8 0 1 0 12 5 h16 a8 8 0 1 0 12 -5 a8 8 0 1 0 -6 -13 a8 8 0 0 0 -6 5 h-16 a8 8 0 0 0 -6 -5 Z" transform="translate(0 -2)" fill={u('bone')} stroke="#8A7350" strokeWidth="1.200" />
          <path d="M23 31 h18" stroke="#fff" strokeWidth="2.500" strokeLinecap="round" opacity=".85" />
          <circle cx="13" cy="28" r="2.200" fill="#fff" opacity=".9" />
          <circle cx="49" cy="27" r="2.200" fill="#fff" opacity=".9" />
        </g>
      </>)}

      {index === 1 && (<>
        <Shadow rx={24} />
        <path d="M10 30 C10 15 27 8 41 11 C55 14 59 28 53 40 C47 52 30 56 19 50 C12 46 10 38 10 30 Z" fill={u('fat')} stroke="#9C7A58" strokeWidth="1.200" />
        <path d="M15 30 C15 19 29 13 41 16 C51 19 54 29 49 38 C44 47 30 50 21 46 C16 43 15 36 15 30 Z" fill={u('meat')} />
        <path d="M21 25 C28 22 33 27 40 24 M20 35 C27 31 34 37 45 32 M27 43 C32 41 36 43 41 40" stroke="#F4B5A6" strokeWidth="1.600" fill="none" strokeLinecap="round" opacity=".75" />
        <circle cx="32" cy="30" r="4.500" fill={u('fat')} />
        <circle cx="32" cy="30" r="2" fill="#D9B48C" />
        <path d="M21 21 C25 18 30 17 34 17" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".55" fill="none" />
      </>)}

      {index === 2 && (<>
        <Shadow cx={33} rx={23} />
        <g transform="rotate(-38 32 32)">
          <rect x="1" y="30.500" width="62" height="3" rx="1.500" fill={u('steel')} />
          <rect x="-1" y="28" width="7" height="8" rx="2" fill={u('wood')} />
          {[14, 26, 38, 50].map((x, i) => (
            <g key={x}>
              <rect x={x - 6.500} y={21 + (i % 2)} width="13" height={21 - (i % 2) * 2} rx="5.500" fill={u('grill')} stroke="#35170A" strokeWidth=".8" />
              <path d={`M${x - 3.500} ${24 + (i % 2)} l5 15 M${x + 1} ${24 + (i % 2)} l4 11`} stroke="#2B1208" strokeWidth="1.300" opacity=".65" strokeLinecap="round" />
              <path d={`M${x - 3} ${23.500 + (i % 2)} h4`} stroke="#F7C48A" strokeWidth="1.500" strokeLinecap="round" opacity=".9" />
            </g>
          ))}
          <path d="M20 21 q0 -2 3 -2 M44 42 q2 1 3 -1" stroke="#7DA63D" strokeWidth="1.800" fill="none" strokeLinecap="round" />
        </g>
      </>)}

      {index === 3 && (<>
        <Shadow cy={60} rx={12} />
        <path d="M32 1 V9" stroke="#B59B72" strokeWidth="1.500" />
        <path d="M29 7 q3 3 6 0" stroke="#B59B72" strokeWidth="1.500" fill="none" />
        <path d="M24 13 C24 8 40 8 40 13 C43 17 40 20 41 24 C43 28 40 31 41 35 C43 39 40 42 41 46 C42 53 36 59 32 59 C28 59 22 53 23 46 C24 42 21 39 23 35 C24 31 21 28 23 24 C24 20 21 17 24 13 Z" fill={u('church')} stroke="#2E0D0D" strokeWidth="1" />
        <path d="M27 14 C25 19 28 22 27 26 C26 30 28 33 27 37 C26 41 28 44 27 48" stroke="#E9A58A" strokeWidth="2.200" fill="none" strokeLinecap="round" opacity=".65" />
        <path d="M24.500 24.500 q7.500 3 15.500 0 M24 35.500 q8 3 16 0 M24 46.500 q8 3 16 0" stroke="#2E0D0D" strokeWidth="1" fill="none" opacity=".55" />
      </>)}

      {index === 4 && (<>
        <path d="M2 41 H62 L58 56 H6 Z" fill={u('wood')} stroke="#472813" strokeWidth="1.200" />
        <path d="M2 41 H62" stroke="#E0A871" strokeWidth="1.500" />
        <ellipse cx="25" cy="39" rx="21" ry="9" fill={u('plate')} stroke="#9D8F76" strokeWidth="1" />
        {/* Хачапури: лодочка с сыром и желтком. */}
        <path d="M8 38 C14 28 36 28 42 38 C36 45 14 45 8 38 Z" fill="#C9833C" stroke="#7A4719" strokeWidth="1" />
        <path d="M14 37.500 C19 32.500 31 32.500 36 37.500 C31 41.500 19 41.500 14 37.500 Z" fill={u('cheese')} />
        <circle cx="25" cy="37" r="3.200" fill="#F58A12" />
        <circle cx="24" cy="36" r="1" fill="#FFE1A8" />
        {/* Бокал вина и виноград. */}
        <path d="M45 12 H59 C59 22 56 27 52 27 C48 27 45 22 45 12 Z" fill="#FFFFFF" opacity=".5" stroke="#8D8D8D" strokeWidth="1" />
        <path d="M46 17 H58 C57 23 55 26 52 26 C49 26 47 23 46 17 Z" fill={u('wine')} />
        <path d="M52 27 V39 M46.500 40 H57.500" stroke="#9A9A9A" strokeWidth="1.800" strokeLinecap="round" />
        {[[46, 45], [51, 45], [56, 45], [48.500, 49], [53.500, 49], [51, 53]].map(([x, y]) => (
          <g key={`${x}-${y}`}><circle cx={x} cy={y} r="3" fill={u('wine')} /><circle cx={x - 1} cy={y - 1} r=".8" fill="#fff" opacity=".7" /></g>
        ))}
      </>)}
    </svg>
  )
}
