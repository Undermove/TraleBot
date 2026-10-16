import React from 'react'
import Passerby from '../walk/Passerby'
import type { Who } from '../Walk.logic'

// Картинки к словам «Фото и чемодана»: родные и друг — человечками нужного пола и возраста, звери и вещи —
// рисунками в стиле мини-аппа. Слово ищем по грузинскому тексту из story.json (ALIVE / THINGS).

const INK = '#15100A'

const PEOPLE: Record<string, Who> = {
  'დედა': { ru: 'мама', kind: 'old', coat: '#7A4E9A', skin: '#F2C9A0', hair: '#E8DEC5', extra: 'none', voice: 'f' },
  'მამა': { ru: 'папа', kind: 'old', coat: '#2F7F86', skin: '#E0AC7E', hair: '#E8DEC5', extra: 'glasses', voice: 'm' },
  'ძმა': { ru: 'брат', kind: 'man', coat: '#1B5FB0', skin: '#E0AC7E', hair: '#2A1F18', extra: 'none', voice: 'm' },
  'და': { ru: 'сестра', kind: 'woman', coat: '#E01A3C', skin: '#F2C9A0', hair: '#5A3A22', extra: 'none', voice: 'f' },
  'ქმარი': { ru: 'муж', kind: 'man', coat: '#4E8A5B', skin: '#C68A5E', hair: '#15100A', extra: 'none', voice: 'm' },
  'ცოლი': { ru: 'жена', kind: 'woman', coat: '#C68F10', skin: '#E0AC7E', hair: '#2A1F18', extra: 'bag', voice: 'f' },
  'ვაჟი': { ru: 'сын', kind: 'kid', coat: '#D4563B', skin: '#F2C9A0', hair: '#5A3A22', extra: 'cap', voice: 'm' },
  'ქალიშვილი': { ru: 'дочь', kind: 'kid', coat: '#7A4E9A', skin: '#F6D7BC', hair: '#9A6A3A', extra: 'none', voice: 'f' },
  'მეგობარი': { ru: 'друг', kind: 'man', coat: '#2F7F86', skin: '#C68A5E', hair: '#15100A', extra: 'cap', voice: 'm' },
  'ბავშვი': { ru: 'ребёнок', kind: 'kid', coat: '#4E8A5B', skin: '#E0AC7E', hair: '#2A1F18', extra: 'cap', voice: 'm' },
  // Бабушка и дедушка — слова сцены (урок 25); родители рядом с ними моложе.
  'ბებია': { ru: 'бабушка', kind: 'old', coat: '#C2553A', skin: '#F2C9A0', hair: '#F4F0E6', extra: 'none', voice: 'f' },
  'ბაბუა': { ru: 'дедушка', kind: 'old', coat: '#5B4A3A', skin: '#E0AC7E', hair: '#F4F0E6', extra: 'cap', voice: 'm' }
}

/** Картинка слова в квадрате size×size. */
export function Picture({ geo, size = 76 }: { geo: string; size?: number }) {
  const who = PEOPLE[geo]
  if (who) {
    const kid = who.kind === 'kid'
    return (
      // По пояс: на карточке и на фото важнее лицо, чем ботинки.
      <svg width={size} height={size} viewBox={kid ? '-46 -142 92 100' : '-50 -200 100 124'} aria-hidden>
        <Passerby who={who} phase={0} stride={0} face="smile" talking={false} wave={false} />
      </svg>
    )
  }
  return <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden>{THING[geo] ?? <circle cx="40" cy="40" r="20" fill="#E8D2AE" stroke={INK} strokeWidth="2" />}</svg>
}

const THING: Record<string, React.ReactNode> = {
  // Собака: сидит, ухо висит, хвост виляет.
  'ძაღლი': (
    <g strokeLinejoin="round">
      <path d="M58 52 q12 -6 10 -18" fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round" className="zn-bob" />
      <path d="M22 70 Q18 42 34 38 Q52 34 58 52 Q62 70 52 72 H26 Z" fill="#B5793F" stroke={INK} strokeWidth="2.4" />
      <circle cx="30" cy="28" r="15" fill="#B5793F" stroke={INK} strokeWidth="2.4" />
      <path d="M18 20 q-6 10 2 18 q4 -8 2 -16 Z" fill="#7A4E2D" stroke={INK} strokeWidth="2" />
      <ellipse cx="20" cy="33" rx="7" ry="5" fill="#E8D2AE" stroke={INK} strokeWidth="2" />
      <circle cx="15" cy="31" r="2.2" fill={INK} /><circle cx="29" cy="25" r="2" fill={INK} />
      <path d="M17 37 q3 3 6 0" fill="none" stroke={INK} strokeWidth="1.6" />
    </g>
  ),
  // Кошка: клубком, хвост вокруг.
  'კატა': (
    <g strokeLinejoin="round">
      <path d="M14 66 Q10 42 36 40 Q62 40 64 62 Q60 72 40 72 Q20 72 14 66 Z" fill="#3A2B1F" stroke={INK} strokeWidth="2.4" />
      <path d="M62 64 q12 -4 8 -16" fill="none" stroke="#3A2B1F" strokeWidth="5" strokeLinecap="round" />
      <circle cx="30" cy="34" r="13" fill="#3A2B1F" stroke={INK} strokeWidth="2.4" />
      <path d="M20 26 l2 -12 l8 8 M32 22 l8 -8 l2 12" fill="#3A2B1F" stroke={INK} strokeWidth="2.2" />
      <ellipse cx="25" cy="34" rx="2.4" ry="3" fill="#F5B820" /><ellipse cx="35" cy="34" rx="2.4" ry="3" fill="#F5B820" />
      <path d="M28 40 l2 2 l2 -2" fill="none" stroke="#E8D2AE" strokeWidth="1.4" />
    </g>
  ),
  'მანქანა': (
    <g strokeLinejoin="round">
      <path d="M8 52 L14 36 Q18 28 28 28 H50 Q60 28 64 36 L72 52 V60 H8 Z" fill="#E01A3C" stroke={INK} strokeWidth="2.4" />
      <path d="M22 36 Q24 32 30 32 H40 V44 H18 Z M44 32 H50 Q56 32 58 36 L62 44 H44 Z" fill="#C9DBEE" stroke={INK} strokeWidth="1.8" />
      <circle cx="22" cy="60" r="8" fill="#2F3A4E" stroke={INK} strokeWidth="2.2" /><circle cx="22" cy="60" r="3" fill="#E6EEF2" />
      <circle cx="58" cy="60" r="8" fill="#2F3A4E" stroke={INK} strokeWidth="2.2" /><circle cx="58" cy="60" r="3" fill="#E6EEF2" />
      <rect x="66" y="48" width="6" height="4" rx="1" fill="#F5B820" />
    </g>
  ),
  'წიგნი': (
    <g strokeLinejoin="round">
      <path d="M10 22 Q24 16 40 24 V66 Q24 58 10 64 Z" fill="#1B5FB0" stroke={INK} strokeWidth="2.4" />
      <path d="M70 22 Q56 16 40 24 V66 Q56 58 70 64 Z" fill="#2F7F86" stroke={INK} strokeWidth="2.4" />
      <path d="M16 32 q10 -3 18 2 M16 40 q10 -3 18 2 M46 34 q8 -5 18 -2 M46 42 q8 -5 18 -2" stroke="#FDFAEF" strokeWidth="1.8" fill="none" />
    </g>
  ),
  'სახლი': (
    <g strokeLinejoin="round">
      <path d="M12 38 L40 14 L68 38 Z" fill="#C2553A" stroke={INK} strokeWidth="2.4" />
      <rect x="18" y="36" width="44" height="34" fill="#F1D9B5" stroke={INK} strokeWidth="2.4" />
      <rect x="34" y="50" width="12" height="20" fill="#7A4E2D" stroke={INK} strokeWidth="2" />
      <rect x="22" y="42" width="9" height="9" fill="#C9DBEE" stroke={INK} strokeWidth="1.6" /><rect x="50" y="42" width="9" height="9" fill="#C9DBEE" stroke={INK} strokeWidth="1.6" />
    </g>
  ),
  // Аджарский хачапури: лодочка с яйцом и маслом.
  'ხაჭაპური': (
    <g strokeLinejoin="round">
      <path d="M4 44 Q24 18 40 28 Q56 18 76 44 Q56 62 40 58 Q24 62 4 44 Z" fill="#E0A55A" stroke={INK} strokeWidth="2.4" />
      <ellipse cx="40" cy="44" rx="20" ry="9" fill="#F6E7A8" stroke={INK} strokeWidth="1.6" />
      <circle cx="40" cy="43" r="6" fill="#F5B820" stroke={INK} strokeWidth="1.6" />
      <rect x="47" y="38" width="6" height="5" rx="1" fill="#FFF4B8" stroke={INK} strokeWidth="1" />
    </g>
  ),
  'ფული': (
    <g strokeLinejoin="round">
      <rect x="10" y="26" width="52" height="30" rx="4" fill="#9DC89E" stroke={INK} strokeWidth="2.2" transform="rotate(-8 36 41)" />
      <rect x="18" y="30" width="52" height="30" rx="4" fill="#B9DDB5" stroke={INK} strokeWidth="2.2" />
      <circle cx="44" cy="45" r="8" fill="none" stroke={INK} strokeWidth="1.8" />
      <circle cx="18" cy="66" r="8" fill="#F5B820" stroke={INK} strokeWidth="2" />
    </g>
  ),
  'ყავა': (
    <g strokeLinejoin="round">
      <path d="M18 32 H58 L54 66 Q52 70 46 70 H30 Q24 70 22 66 Z" fill="#FDFAEF" stroke={INK} strokeWidth="2.4" />
      <path d="M58 40 q10 0 10 9 q0 9 -12 9" fill="none" stroke={INK} strokeWidth="2.4" />
      <ellipse cx="38" cy="33" rx="19" ry="4" fill="#5A3A22" stroke={INK} strokeWidth="1.6" />
      <path d="M30 22 q-4 -6 0 -12 M40 22 q-4 -6 0 -12" fill="none" stroke="#B5A68B" strokeWidth="2" strokeLinecap="round" className="zn-bob" />
    </g>
  ),
  // Телефон: экран с видеозвонком.
  'ტელეფონი': (
    <g strokeLinejoin="round">
      <rect x="24" y="8" width="32" height="62" rx="7" fill="#2A2F3A" stroke={INK} strokeWidth="2.4" />
      <rect x="28" y="15" width="24" height="45" rx="3" fill="#9CC6EE" />
      <circle cx="40" cy="32" r="6" fill="#F2C9A0" stroke={INK} strokeWidth="1.4" />
      <path d="M31 48 q9 -9 18 0 v4 h-18 Z" fill="#E01A3C" stroke={INK} strokeWidth="1.4" />
      <circle cx="40" cy="65" r="2" fill="#FDFAEF" />
    </g>
  ),
  // Паспорт: бордовая книжечка с гербом.
  'პასპორტი': (
    <g strokeLinejoin="round">
      <rect x="20" y="12" width="40" height="56" rx="4" fill="#7A1E2C" stroke={INK} strokeWidth="2.4" />
      <circle cx="40" cy="36" r="9" fill="none" stroke="#F5B820" strokeWidth="2" />
      <path d="M40 27 V45 M31 36 H49" stroke="#F5B820" strokeWidth="1.6" />
      <path d="M28 54 h24 M31 60 h18" stroke="#F5B820" strokeWidth="1.8" />
    </g>
  ),
  // Фото: карточка с белыми полями, на ней море и солнце.
  'ფოტო': (
    <g strokeLinejoin="round">
      <rect x="12" y="16" width="56" height="50" rx="3" fill="#FDFAEF" stroke={INK} strokeWidth="2.4" transform="rotate(-6 40 41)" />
      <rect x="18" y="21" width="44" height="32" fill="#9CC6EE" transform="rotate(-6 40 41)" />
      <path d="M18 44 q11 -6 22 0 t22 0 V53 H18 Z" fill="#1B5FB0" transform="rotate(-6 40 41)" />
      <circle cx="52" cy="30" r="5" fill="#F5B820" transform="rotate(-6 40 41)" />
    </g>
  ),
  // Чай в стаканчике-армуди.
  'ჩაი': (
    <g strokeLinejoin="round">
      <path d="M26 24 H54 Q50 34 46 42 Q52 54 52 66 H28 Q28 54 34 42 Q30 34 26 24 Z" fill="#D4563B" fillOpacity="0.85" stroke={INK} strokeWidth="2.4" />
      <rect x="20" y="66" width="40" height="5" rx="2" fill="#B5793F" stroke={INK} strokeWidth="1.8" />
      <path d="M32 30 h16" stroke="#FDFAEF" strokeWidth="2" opacity="0.6" />
    </g>
  )
}
