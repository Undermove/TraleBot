import React from 'react'

// Комната Бомборы: стена, пол и места под мебель из подарков дня. Нет вещи — на её месте ничего
// (пустая комната ждёт, её хочется обставить). Бомбора стоит в середине (children).

const INK = '#2A1F18'
const GOLD = '#F5B820'
const RUBY = '#E01A3C'
const NAVY = '#1B5FB0'
const WOOD = '#A5612F'

export function Furniture({ id }: { id: string }) {
  switch (id) {
    case 'rug':
      return (
        <g data-furn="rug">
          <ellipse cx="180" cy="214" rx="120" ry="20" fill={RUBY} stroke={INK} strokeWidth="3" />
          <ellipse cx="180" cy="214" rx="98" ry="14" fill="none" stroke={GOLD} strokeWidth="3" strokeDasharray="8 6" />
          <ellipse cx="180" cy="214" rx="60" ry="8" fill={NAVY} stroke={INK} strokeWidth="2" />
        </g>
      )
    case 'bowl':
      return (
        <g data-furn="bowl">
          <path d="M248 206 L292 206 Q290 224 270 224 Q250 224 248 206 Z" fill={NAVY} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx="270" cy="206" rx="22" ry="5" fill="#C98B4A" stroke={INK} strokeWidth="2.500" />
          <text x="270" y="219" textAnchor="middle" fontSize="11" fontWeight="800" fill="#FDFAEF" fontFamily="Noto Sans Georgian, sans-serif">ბ</text>
        </g>
      )
    case 'pillow':
      return (
        <g data-furn="pillow" transform="translate(70 4)">
          <path d="M72 200 Q70 184 92 182 L128 182 Q150 184 148 200 Q150 214 128 216 L92 216 Q70 214 72 200 Z" fill={GOLD} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M84 199 L136 199" stroke={RUBY} strokeWidth="3" strokeDasharray="6 5" />
        </g>
      )
    case 'lamp':
      return (
        <g data-furn="lamp">
          <path d="M318 214 L318 120" stroke={INK} strokeWidth="4" />
          <ellipse cx="318" cy="216" rx="16" ry="5" fill={WOOD} stroke={INK} strokeWidth="3" />
          <path d="M298 122 L338 122 L330 92 L306 92 Z" fill="#FCD76D" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx="318" cy="150" rx="40" ry="36" fill="#FFF4C2" opacity=".35" />
        </g>
      )
    case 'plant':
      return (
        <g data-furn="plant">
          <path d="M26 190 L54 190 L50 222 L30 222 Z" fill={RUBY} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M40 190 Q20 160 30 140 Q44 162 40 190 M40 190 Q58 158 52 136 Q36 160 40 190 M40 190 Q34 170 18 168" fill="#3E8E41" stroke={INK} strokeWidth="2.500" strokeLinejoin="round" />
        </g>
      )
    case 'shelf':
      return (
        <g data-furn="shelf">
          <rect x="232" y="64" width="92" height="8" rx="2" fill={WOOD} stroke={INK} strokeWidth="2.500" />
          {[[238, NAVY, 30], [250, RUBY, 26], [262, GOLD, 32], [276, '#3E8E41', 24], [288, NAVY, 28]].map(([x, c, h], i) => (
            <rect key={i} x={x as number} y={64 - (h as number)} width="11" height={h as number} rx="1.500" fill={c as string} stroke={INK} strokeWidth="2" />
          ))}
          <text x="312" y="60" textAnchor="middle" fontSize="16" fontWeight="800" fill={INK} fontFamily="Noto Sans Georgian, sans-serif">ა</text>
        </g>
      )
    case 'picture':
      return (
        <g data-furn="picture">
          <rect x="132" y="22" width="96" height="62" rx="3" fill={GOLD} stroke={INK} strokeWidth="3" />
          <rect x="140" y="30" width="80" height="46" fill="#BFE0F5" stroke={INK} strokeWidth="2" />
          <path d="M140 76 L162 50 L176 64 L192 44 L220 76 Z" fill="#3E8E41" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path d="M184 52 L192 44 L200 52" fill="#FDFAEF" stroke={INK} strokeWidth="1.500" />
          <circle cx="206" cy="40" r="6" fill={GOLD} stroke={INK} strokeWidth="1.500" />
        </g>
      )
    case 'clock':
      return (
        <g data-furn="clock">
          <circle cx="64" cy="58" r="22" fill="#FDFAEF" stroke={INK} strokeWidth="3.500" />
          <circle cx="64" cy="58" r="17" fill="none" stroke={NAVY} strokeWidth="2" />
          <path d="M64 58 L64 46 M64 58 L73 62" stroke={INK} strokeWidth="3" strokeLinecap="round" />
          <circle cx="64" cy="58" r="2.500" fill={RUBY} />
        </g>
      )
    default:
      return null
  }
}

/** Порядок слоёв: сначала стена (полка, картина, часы), потом пол (коврик), потом остальное. */
const ORDER = ['shelf', 'picture', 'clock', 'rug', 'pillow', 'plant', 'lamp', 'bowl']

export default function BomboraRoom({ furniture, children }: { furniture: string[]; children: React.ReactNode }) {
  const owned = ORDER.filter(id => furniture.includes(id))
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border-[2px] border-jewelInk" style={{ aspectRatio: '360 / 240', boxShadow: '3px 3px 0 #15100A' }} data-testid="bombora-room">
      <svg viewBox="0 0 360 240" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {/* Стена с килимным бордюром и пол. */}
        <rect x="0" y="0" width="360" height="180" fill="#F7E7C6" />
        <path d="M0 150 L360 150" stroke={NAVY} strokeWidth="6" />
        <path d="M0 158 L12 146 L24 158 L36 146 L48 158 L60 146 L72 158 L84 146 L96 158 L108 146 L120 158 L132 146 L144 158 L156 146 L168 158 L180 146 L192 158 L204 146 L216 158 L228 146 L240 158 L252 146 L264 158 L276 146 L288 158 L300 146 L312 158 L324 146 L336 158 L348 146 L360 158" stroke={GOLD} strokeWidth="2.500" fill="none" />
        <rect x="0" y="180" width="360" height="60" fill="#D9A46A" />
        <path d="M0 180 L360 180" stroke={INK} strokeWidth="3" />
        {[0, 1, 2, 3].map(i => <path key={i} d={`M0 ${194 + i * 13} L360 ${194 + i * 13}`} stroke="#B9824B" strokeWidth="2" />)}
        {owned.filter(id => ['shelf', 'picture', 'clock', 'rug', 'pillow'].includes(id)).map(id => <Furniture key={id} id={id} />)}
      </svg>
      {/* Бомбора — по центру, на полу. */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: '6%', width: '38%' }}>{children}</div>
      <svg viewBox="0 0 360 240" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        {owned.filter(id => ['plant', 'lamp', 'bowl'].includes(id)).map(id => <Furniture key={id} id={id} />)}
      </svg>
    </div>
  )
}
