import React from 'react'

// Вещи Бомборы из подарка дня — поверх головы в системе координат Mascot (viewBox 0 0 200 200):
// голова — эллипс (100, 108) 66×60, верх на y≈48, глаза на (80, 100) и (122, 100), шарф — y 138…192.

export type WearSlot = 'head' | 'eyes' | 'neck'
export type Wear = Partial<Record<WearSlot, string>>

const INK = '#2A1F18'
const GOLD = '#F5B820'
const GOLD_L = '#FCD76D'
const RUBY = '#E01A3C'
const NAVY = '#1B5FB0'

/** Цвет шарфа: обычный — рубиновый. */
export function scarfFill(neck?: string): string {
  return neck === 'scarf-navy' ? NAVY : neck === 'scarf-gold' ? GOLD : RUBY
}

/** Узор по шарфу (килимный — золотой зигзаг). */
export function ScarfPattern({ neck }: { neck?: string }) {
  if (neck !== 'scarf-kilim') return null
  return (
    <path d="M40 176 L48 168 L56 176 L64 168 L72 176 L80 168 L88 176 L96 168 L104 176 L112 168 L120 176 L128 168 L136 176 L144 168 L152 176 L160 168"
      stroke={GOLD} strokeWidth="3.5" fill="none" strokeLinejoin="round" />
  )
}

/** Над шарфом: бабочка. */
export function NeckExtra({ neck }: { neck?: string }) {
  if (neck !== 'bow-tie') return null
  return (
    <g data-wear="bow-tie">
      <path d="M100 170 L80 158 Q74 170 80 182 Z" fill={NAVY} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M100 170 L120 158 Q126 170 120 182 Z" fill={NAVY} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <rect x="93" y="163" width="14" height="14" rx="4" fill={GOLD} stroke={INK} strokeWidth="3" />
    </g>
  )
}

/** Головной убор. */
export function Hat({ id }: { id?: string }) {
  switch (id) {
    case 'beret':
      return (
        <g data-wear="beret">
          <path d="M46 62 Q50 30 104 30 Q156 32 150 58 Q120 70 92 66 Q64 64 46 62 Z" fill={NAVY} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M54 58 Q100 70 146 56" stroke={INK} strokeWidth="2.5" fill="none" />
          <path d="M104 30 L108 20" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        </g>
      )
    case 'cap':
      return (
        <g data-wear="cap">
          <path d="M52 64 Q54 26 100 26 Q146 26 148 64 Z" fill={RUBY} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M100 26 L100 64" stroke={INK} strokeWidth="2" opacity=".5" />
          <path d="M44 66 Q100 54 160 64 Q172 70 160 76 Q100 66 44 76 Q36 70 44 66 Z" fill="#A61026" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          <circle cx="100" cy="27" r="5" fill={GOLD} stroke={INK} strokeWidth="2.5" />
        </g>
      )
    case 'wreath':
      return (
        <g data-wear="wreath">
          <path d="M44 74 Q60 44 100 42 Q140 44 156 74" stroke="#3E8E41" strokeWidth="6" fill="none" strokeLinecap="round" />
          {[[50, 64, RUBY], [66, 50, GOLD], [84, 43, NAVY], [100, 41, RUBY], [116, 43, GOLD], [134, 50, NAVY], [150, 64, RUBY]].map(([x, y, c], i) => (
            <g key={i}>
              {[0, 72, 144, 216, 288].map(a => (
                <circle key={a} cx={(x as number) + Math.cos((a * Math.PI) / 180) * 5} cy={(y as number) + Math.sin((a * Math.PI) / 180) * 5} r="4.200" fill={c as string} stroke={INK} strokeWidth="1.600" />
              ))}
              <circle cx={x as number} cy={y as number} r="3" fill={GOLD_L} stroke={INK} strokeWidth="1.500" />
            </g>
          ))}
        </g>
      )
    case 'crown':
      return (
        <g data-wear="crown">
          <path d="M60 62 L56 26 L78 44 L100 18 L122 44 L144 26 L140 62 Z" fill={GOLD} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          <path d="M60 62 L140 62 L140 54 L60 54 Z" fill={GOLD_L} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <circle cx="100" cy="40" r="6" fill={RUBY} stroke={INK} strokeWidth="2.500" />
          <circle cx="76" cy="50" r="4" fill={NAVY} stroke={INK} strokeWidth="2" />
          <circle cx="124" cy="50" r="4" fill={NAVY} stroke={INK} strokeWidth="2" />
          <circle cx="56" cy="24" r="4" fill={GOLD_L} stroke={INK} strokeWidth="2" />
          <circle cx="100" cy="16" r="4" fill={GOLD_L} stroke={INK} strokeWidth="2" />
          <circle cx="144" cy="24" r="4" fill={GOLD_L} stroke={INK} strokeWidth="2" />
        </g>
      )
    default:
      return null
  }
}

/** Очки. */
export function Glasses({ id }: { id?: string }) {
  switch (id) {
    case 'round-glasses':
      return (
        <g data-wear="round-glasses" fill="rgba(255,255,255,.18)" stroke={INK} strokeWidth="3">
          <circle cx="80" cy="100" r="13" />
          <circle cx="122" cy="100" r="13" />
          <path d="M93 98 Q101 93 109 98" fill="none" />
          <path d="M67 97 L52 92 M135 97 L150 92" fill="none" strokeLinecap="round" />
        </g>
      )
    case 'sunglasses':
      return (
        <g data-wear="sunglasses" stroke={INK} strokeWidth="3" strokeLinejoin="round">
          <path d="M64 92 L96 92 Q96 112 80 112 Q64 112 64 92 Z" fill="#1E1A16" />
          <path d="M106 92 L138 92 Q138 112 122 112 Q106 112 106 92 Z" fill="#1E1A16" />
          <path d="M96 95 L106 95" fill="none" />
          <path d="M64 93 L50 90 M138 93 L152 90" fill="none" strokeLinecap="round" />
          <path d="M70 96 L76 96" stroke="#fff" strokeWidth="2.500" strokeLinecap="round" opacity=".7" />
          <path d="M112 96 L118 96" stroke="#fff" strokeWidth="2.500" strokeLinecap="round" opacity=".7" />
        </g>
      )
    case 'star-glasses': {
      const star = (cx: number, cy: number, r: number) => {
        const pts = Array.from({ length: 10 }, (_, i) => {
          const a = -Math.PI / 2 + (i * Math.PI) / 5
          const rr = i % 2 ? r * 0.5 : r
          return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`
        })
        return `M${pts.join(' L')} Z`
      }
      return (
        <g data-wear="star-glasses" stroke={INK} strokeWidth="3" strokeLinejoin="round">
          <path d={star(80, 101, 18)} fill={GOLD} fillOpacity=".85" />
          <path d={star(122, 101, 18)} fill={GOLD} fillOpacity=".85" />
          <path d="M94 99 L108 99" fill="none" />
        </g>
      )
    }
    default:
      return null
  }
}
