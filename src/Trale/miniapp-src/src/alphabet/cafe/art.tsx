import React from 'react'

// Рисунки «Кафе Бомборы» в стиле мини-аппа: плоская заливка и толстый тёмный контур (как verbs/ui/icons).
// Подписей на товарах нет намеренно: прочитать надо заказ, а не витрину.

const INK = '#15100A'
const C = { cream: '#FDFAEF', navy: '#1B5FB0', navyL: '#3A7FCC', navyW: '#C9DBF0', ruby: '#E01A3C', rubyD: '#A61026', rubyW: '#F7D4DB', gold: '#F5B820', goldL: '#FCD76D', goldD: '#C68F10', goldW: '#F9EAC1', green: '#6F8454', greenL: '#9BAE7B', brown: '#B87B2F', brownL: '#D99844', white: '#FFFFFF' }

const S = (size: number, children: React.ReactNode, label?: string) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
    {children}
  </svg>
)

const cup = (fill: string, steam = true) => (
  <>
    {steam && <path d="M18 8c-2 3 2 4 0 7M25 8c-2 3 2 4 0 7" strokeWidth="1.6" />}
    <path d="M10 19h24v9a10 10 0 0 1-10 10h-4a10 10 0 0 1-10-10z" fill={C.cream} />
    <path d="M34 22h3a4 4 0 0 1 0 8h-3" />
    <path d="M12 21h20v6a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8z" fill={fill} stroke="none" />
    <path d="M8 41h30" />
  </>
)

const PRODUCT_ART: Record<string, React.ReactNode> = {
  water: (<><path d="M19 6h10v5l3 4v25a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3V15l3-4z" fill={C.navyW} /><path d="M18 5h12v4H18z" fill={C.navy} /><path d="M16 22h16v10H16z" fill={C.navyL} /><path d="M21 26c1-2 3-2 4 0" stroke={C.cream} /></>),
  porridge: (<><path d="M7 22h34a17 15 0 0 1-34 0z" fill={C.navy} /><path d="M9 22c3-4 27-4 30 0" fill={C.goldW} /><circle cx="20" cy="20" r="1.6" fill={C.ruby} /><circle cx="27" cy="19" r="1.6" fill={C.ruby} /><path d="M33 8l-5 13" strokeWidth="2.4" /><path d="M14 40h20" /></>),
  fish: (<><path d="M6 24c6-9 20-11 28-2l7-6v16l-7-6c-8 9-22 7-28-2z" fill={C.navyL} /><circle cx="14" cy="22" r="1.8" fill={INK} /><path d="M21 18c2 3 2 9 0 12" /><path d="M10 28c2 1 4 1 6 0" /></>),
  cheese: (<><path d="M6 30l26-16 10 10v12H6z" fill={C.gold} /><path d="M6 30h36" /><circle cx="15" cy="34" r="2" fill={C.goldD} /><circle cx="30" cy="32" r="2.6" fill={C.goldD} /><circle cx="35" cy="24" r="1.6" fill={C.goldD} /></>),
  banana: (<><path d="M9 14c0 15 12 25 28 21 3-1 3-4 0-4-11 2-19-6-21-17-1-3-7-3-7 0z" fill={C.goldL} /><path d="M7 12l3-4 3 4" fill={C.brown} /><path d="M14 20c3 7 9 11 17 12" stroke={C.goldD} /></>),
  mandarin: (<><circle cx="24" cy="27" r="14" fill="#F08A24" /><path d="M24 13c0-4 3-6 7-6-1 4-3 6-7 6z" fill={C.greenL} /><path d="M24 13v3" /><circle cx="19" cy="23" r="1" fill={INK} stroke="none" /><circle cx="28" cy="31" r="1" fill={INK} stroke="none" /><circle cx="30" cy="22" r="1" fill={INK} stroke="none" /></>),
  lemon: (<><path d="M8 26c0-9 8-15 16-15s16 6 16 15-8 13-16 13S8 35 8 26z" fill={C.goldL} /><path d="M5 26h4M39 26h4" /><path d="M16 22c2-3 6-4 9-4" stroke={C.cream} strokeWidth="2.2" /></>),
  tea: cup(C.goldD),
  bread: (<><path d="M6 30c0-10 8-16 18-16s18 6 18 16v4a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z" fill={C.brownL} /><path d="M15 21l3 7M23 19l2 8M31 21l1 7" /></>),
  milk: (<><path d="M16 14l4-7h8l4 7v26a2 2 0 0 1-2 2H18a2 2 0 0 1-2-2z" fill={C.cream} /><path d="M16 14h16" /><path d="M16 22h16v10H16z" fill={C.navyW} /><path d="M21 7h6" /><path d="M20 27c2-2 6-2 8 0" stroke={C.navy} /></>),
  coffee: cup('#6B3E1F'),
  soup: (<><path d="M6 22h36a18 14 0 0 1-36 0z" fill={C.ruby} /><path d="M8 22c3-3 29-3 32 0" fill="#F0506C" /><circle cx="18" cy="21" r="1.6" fill={C.greenL} /><circle cx="28" cy="20" r="1.6" fill={C.goldL} /><path d="M18 9c-2 3 2 5 0 8M28 9c-2 3 2 5 0 8" strokeWidth="1.6" /><path d="M14 40h20" /></>),
  cake: (<><path d="M8 24h32v14H8z" fill={C.rubyW} /><path d="M8 24c4 4 8-2 12 2s8-2 12 2 6-2 8-2" fill={C.cream} /><path d="M8 31h32" stroke={C.ruby} /><path d="M24 12v8" /><path d="M24 7c-2 2-2 4 0 5 2-1 2-3 0-5z" fill={C.gold} /><path d="M20 20h8v4h-8z" fill={C.navyW} /></>),
  wine: (<><path d="M14 6h20c0 12-4 18-10 18S14 18 14 6z" fill={C.cream} /><path d="M15 12h18c-1 7-4 10-9 10s-8-3-9-10z" fill={C.rubyD} stroke="none" /><path d="M24 24v12M16 40h16" /></>),
  khachapuri: (<><path d="M24 26L44 22A20 20 0 1 1 38 11.5z" fill={C.brownL} /><path d="M24 26L44 22A20 20 0 0 0 38 11.5z" fill={C.goldL} /><circle cx="24" cy="26" r="13" fill="none" stroke={C.brown} strokeDasharray="3 4" /><path d="M14 30c3 2 6 2 9 0M12 22c3-2 6-2 9 0" stroke={C.brown} /><path d="M40 6c-1 2 1 3 0 5" strokeWidth="1.5" /></>)
}

export function ProductArt({ id, size = 44 }: { id: string; size?: number }) {
  return S(size, PRODUCT_ART[id] ?? <circle cx="24" cy="24" r="14" fill={C.goldW} />)
}

/** Гости: четыре зверька разных цветов. Мимика — по настроению. */
const LOOKS = [
  { body: C.navyL, ear: 'cat' },
  { body: C.gold, ear: 'bear' },
  { body: '#9BAE7B', ear: 'bunny' },
  { body: C.rubyW, ear: 'bird' }
] as const

export function GuestArt({ look, mood, size = 64 }: { look: number; mood: 'wait' | 'happy' | 'sad' | 'angry'; size?: number }) {
  const l = LOOKS[look % LOOKS.length]
  const ears = l.ear === 'cat'
    ? <><path d="M12 18l2-12 9 7z" fill={l.body} /><path d="M36 18l-2-12-9 7z" fill={l.body} /></>
    : l.ear === 'bear'
      ? <><circle cx="13" cy="13" r="5" fill={l.body} /><circle cx="35" cy="13" r="5" fill={l.body} /></>
      : l.ear === 'bunny'
        ? <><path d="M17 15c-3-8-2-13 1-13s4 5 3 13z" fill={l.body} /><path d="M31 15c3-8 2-13-1-13s-4 5-3 13z" fill={l.body} /></>
        : <path d="M22 8c0-4 4-5 5-2" fill="none" />
  const eyes = mood === 'happy'
    ? <><path d="M16 24q2.5-3 5 0M27 24q2.5-3 5 0" /></>
    : mood === 'sad'
      ? <><path d="M16 23q2.5 2 5 0M27 23q2.5 2 5 0" /></>
      : <><circle cx="18.5" cy="23" r="1.9" fill={INK} stroke="none" /><circle cx="29.5" cy="23" r="1.9" fill={INK} stroke="none" /></>
  const mouth = mood === 'happy'
    ? <path d="M19 30q5 6 10 0z" fill={C.ruby} />
    : mood === 'sad'
      ? <path d="M19 33q5-4 10 0" />
      : <path d="M21 31q3 2 6 0" />
  return S(size, (
    <>
      {ears}
      <path d="M8 46c0-9 7-14 16-14s16 5 16 14" fill={l.body} />
      <circle cx="24" cy="24" r="13" fill={l.body} />
      {l.ear === 'bird' && <path d="M22 27l2 3 2-3z" fill={C.gold} />}
      <circle cx="15" cy="28" r="2.2" fill={C.ruby} opacity="0.35" stroke="none" />
      <circle cx="33" cy="28" r="2.2" fill={C.ruby} opacity="0.35" stroke="none" />
      {eyes}
      {l.ear !== 'bird' && mouth}
    </>
  ))
}

export function CoinIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.6" aria-hidden className="inline-block align-[-0.2em]">
      <circle cx="12" cy="12" r="9" fill={C.gold} />
      <circle cx="12" cy="12" r="5.6" fill={C.goldL} stroke={C.goldD} />
      <path d="M10 9.5c2-1 4 0 3 2s-3 1-3 3 2 2 4 1" stroke={C.goldD} strokeWidth="1.4" />
    </svg>
  )
}

export function CheckMark({ size = 14 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden className="inline-block"><path d="M3 9 L7 13 L15 4" stroke={C.navy} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

/** Окно кафе: небо и горы. */
export function WindowArt({ width = 120 }: { width?: number }) {
  return (
    <svg width={width} height={width * 0.62} viewBox="0 0 120 74" fill="none" stroke={INK} strokeWidth="1.8" aria-hidden>
      <rect x="2" y="2" width="116" height="70" rx="8" fill="#9CC7EE" />
      <path d="M2 56l26-26 18 16 22-26 26 24 24-14v28H2z" fill="#6F8454" />
      <path d="M62 26l6-6 6 6-6 3z" fill={C.cream} stroke="none" />
      <circle cx="96" cy="18" r="7" fill={C.gold} />
      <path d="M60 2v70M2 37h116" stroke={C.cream} strokeWidth="3" />
      <rect x="2" y="2" width="116" height="70" rx="8" />
    </svg>
  )
}
