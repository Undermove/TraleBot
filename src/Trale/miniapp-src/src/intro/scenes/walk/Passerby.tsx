import React from 'react'
import type { Who } from '../Walk.logic'

// Знакомый на улице, лицом к тебе. Свои единицы: ноги на y=0, рост взрослого ~170 (1 единица — сантиметр),
// масштаб на экран задаёт улица. Шаг — по фазе: колени поднимаются по очереди, тело качается и чуть
// подпрыгивает, руки ходят в противофазе. Рот двигается, пока человек говорит; машет — когда здоровается
// или прощается. Анимации лица и руки — в intro.css (zw-*), шаг — от фазы, чтобы шёл в ногу с улицей.

const INK = '#15100A'
const SW = 2.6

export type Face = 'smile' | 'huh' | 'wow' | 'calm'

export interface PasserbyProps {
  who: Who
  /** Фаза шага, радианы. */
  phase: number
  /** 0 — стоит, 1 — идёт. */
  stride: number
  face: Face
  talking: boolean
  wave: boolean
}

export default function Passerby({ who, phase, stride, face, talking, wave }: PasserbyProps) {
  const kid = who.kind === 'kid'
  const woman = who.kind === 'woman' || (kid && who.extra !== 'cap')
  const old = who.kind === 'old'
  const lift = (k: number) => Math.max(0, Math.sin(phase + k * Math.PI)) * 9 * stride
  const bob = -Math.abs(Math.sin(phase)) * 3 * stride
  const sway = Math.sin(phase) * 2.2 * stride
  const arm = Math.sin(phase) * 9 * stride
  const trousers = old ? '#5B5148' : '#2F3A4E'

  return (
    <g transform={kid ? 'scale(0.66)' : undefined}>
      {/* Тень: мягкая, под ногами. */}
      <ellipse cx="0" cy="0" rx="30" ry="6.5" fill="#15100A" opacity="0.18" />
      <g transform={`translate(${sway} ${bob})`}>
        {/* Ноги и ботинки: поднятое колено — короче нога и выше ботинок. */}
        {[-1, 1].map((sx, k) => {
          const up = lift(k)
          return (
            <g key={sx}>
              <rect x={sx * 9 - 6.5} y={-80} width="13" height={78 - up} rx="6" fill={trousers} stroke={INK} strokeWidth={SW} />
              <ellipse cx={sx * 10} cy={-3 - up} rx="9" ry="5" fill="#2A1F18" stroke={INK} strokeWidth={SW} />
            </g>
          )
        })}

        {/* Волосы сзади — длинные. */}
        {woman && !old && <path d="M-19 -160 Q-23 -128 -17 -110 L17 -110 Q23 -128 19 -160 Z" fill={who.hair} stroke={INK} strokeWidth={SW} />}

        {/* Руки за пальто: левая ходит, правая ходит или машет. */}
        <g transform={`rotate(${arm} -23 -124)`}>
          <rect x="-30" y="-126" width="11" height="52" rx="5.5" fill={who.coat} stroke={INK} strokeWidth={SW} />
          <circle cx="-24.5" cy="-72" r="6" fill={who.skin} stroke={INK} strokeWidth={SW} />
        </g>
        {wave ? (
          // Плечо — вверх и в сторону, предплечье с ладонью покачивается от локтя.
          <g transform="rotate(28 24 -124)">
            <rect x="19" y="-152" width="11" height="30" rx="5.5" fill={who.coat} stroke={INK} strokeWidth={SW} />
            <g className="zw-wave">
              <rect x="19.5" y="-178" width="10" height="30" rx="5" fill={who.coat} stroke={INK} strokeWidth={SW} />
              <circle cx="24.5" cy="-181" r="6.5" fill={who.skin} stroke={INK} strokeWidth={SW} />
            </g>
          </g>
        ) : (
          <g transform={`rotate(${-arm} 23 -124)`}>
            <rect x="19" y="-126" width="11" height="52" rx="5.5" fill={who.coat} stroke={INK} strokeWidth={SW} />
            <circle cx="24.5" cy="-72" r="6" fill={who.skin} stroke={INK} strokeWidth={SW} />
          </g>
        )}

        {/* Пальто: у женщин расклёшенное. */}
        <path
          d={woman ? 'M-22 -127 Q-26 -100 -27 -70 L27 -70 Q26 -100 22 -127 Q0 -133 -22 -127 Z' : 'M-22 -127 Q-24 -102 -20 -78 L20 -78 Q24 -102 22 -127 Q0 -133 -22 -127 Z'}
          fill={who.coat} stroke={INK} strokeWidth={SW} strokeLinejoin="round"
        />
        {/* Ворот и пуговицы. */}
        <path d="M-8 -129 L0 -116 L8 -129" fill="none" stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
        {[-108, -96].map(y => <circle key={y} cx="0" cy={y} r="1.6" fill={INK} />)}

        {/* Сумка через плечо. */}
        {who.extra === 'bag' && (
          <g>
            <path d="M-18 -126 L16 -88" stroke="#7A4E2D" strokeWidth="4" strokeLinecap="round" />
            <rect x="10" y="-92" width="22" height="18" rx="4" fill="#F5B820" stroke={INK} strokeWidth={SW} />
            <path d="M10 -86 h22" stroke={INK} strokeWidth="1.6" />
          </g>
        )}

        {/* Шея и голова. */}
        <rect x="-5" y="-138" width="10" height="10" fill={who.skin} stroke={INK} strokeWidth={SW} />
        <circle cx="0" cy="-152" r="17" fill={who.skin} stroke={INK} strokeWidth={SW} />
        {/* Уши. */}
        {[-1, 1].map(sx => <circle key={sx} cx={sx * 17} cy="-150" r="3.6" fill={who.skin} stroke={INK} strokeWidth="2" />)}

        {/* Волосы спереди. */}
        {old
          ? <path d="M-16 -158 Q-14 -171 0 -171 Q14 -171 16 -158 Q8 -163 0 -163 Q-8 -163 -16 -158 Z" fill={who.hair} stroke={INK} strokeWidth={SW} />
          : woman
            ? <path d="M-18 -152 Q-18 -172 0 -171 Q18 -172 18 -152 Q12 -162 2 -160 Q-8 -163 -18 -152 Z" fill={who.hair} stroke={INK} strokeWidth={SW} />
            : <path d="M-17 -154 Q-16 -173 0 -172 Q16 -173 17 -154 Q10 -163 0 -162 Q-10 -163 -17 -154 Z" fill={who.hair} stroke={INK} strokeWidth={SW} />}
        {kid && woman && [-1, 1].map(sx => <circle key={sx} cx={sx * 19} cy="-163" r="6" fill={who.hair} stroke={INK} strokeWidth={SW} />)}

        {/* Лицо. */}
        <g className="zw-blink">
          <ellipse cx="-6" cy="-152" rx="2.2" ry="2.6" fill={INK} />
          <ellipse cx="6" cy="-152" rx="2.2" ry="2.6" fill={INK} />
        </g>
        <path d={face === 'huh' ? 'M-10 -160 L-3 -158 M3 -161 L10 -163' : face === 'wow' ? 'M-10 -161 Q-6 -163 -3 -161 M3 -161 Q6 -163 10 -161' : 'M-10 -159 Q-6 -160 -3 -159 M3 -159 Q6 -160 10 -159'}
          stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {[-1, 1].map(sx => <circle key={sx} cx={sx * 10} cy="-145" r="3.5" fill="#E01A3C" opacity="0.16" />)}
        {talking
          ? <ellipse className="zw-talk" cx="0" cy="-142" rx="4" ry="3" fill="#7A2E2E" stroke={INK} strokeWidth="1.6" />
          : face === 'wow'
            ? <ellipse cx="0" cy="-142" rx="3.4" ry="4.2" fill="#7A2E2E" stroke={INK} strokeWidth="1.6" />
            : face === 'huh'
              ? <path d="M-4 -141 h8" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
              : <path d={face === 'smile' ? 'M-6 -143 Q0 -137 6 -143' : 'M-5 -142 Q0 -140 5 -142'} stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />}

        {/* Очки и кепка. */}
        {who.extra === 'glasses' && (
          <g fill="none" stroke={INK} strokeWidth="1.8">
            <circle cx="-6" cy="-152" r="5.2" /><circle cx="6" cy="-152" r="5.2" /><path d="M-0.8 -152 h1.6" />
          </g>
        )}
        {who.extra === 'cap' && (
          <g>
            <path d="M-16 -162 Q-15 -177 0 -177 Q15 -177 16 -162 Z" fill={who.coat} stroke={INK} strokeWidth={SW} />
            <path d="M-6 -163 Q6 -168 22 -162" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          </g>
        )}
      </g>
    </g>
  )
}
