import React from 'react'
import { phrase } from '../../story'

// Угощения на вечеринке и в гестхаусе: напитки и еда — слова сцены (story.json → lessons[].scene). Гость
// просит «მე მინდა ყავა» — подай чашку; угощает «ხაჭაპური?» — ответь «კი, გთხოვთ» и попробуй. Картинки —
// значение слова, подпись — грузинское, так слово запоминается по ситуации, а не по переводу.

export type Treat = 'chai' | 'qava' | 'tskali' | 'khachapuri' | 'ghvino' | 'puri'
export const DRINKS: readonly Treat[] = ['chai', 'qava', 'tskali']

const A = '/audio/intro-story/party2/'
/** «მე მინდა …» голосом гостя. */
export const wantLine = (t: Treat) => `მე მინდა ${phrase(t).geo}`
export const wantAudio = (t: Treat, voice: 'f' | 'm') => (DRINKS.includes(t) ? `${A}want-${t}-${voice}.m4a` : undefined)
/** «ხაჭაპური?» — гость угощает. */
export const offerLine = (t: Treat) => `${phrase(t).geo}?`
export const offerAudio = (t: Treat, voice: 'f' | 'm') => (['khachapuri', 'ghvino', 'puri'].includes(t) ? `${A}offer-${t}-${voice}.m4a` : undefined)
/** «ყავა, გთხოვთ» — твой ответ, голосом героя. */
export const pleaseLine = (id: Treat | 'ki' | 'pasporti') => `${phrase(id).geo}, ${phrase('gtkhovt').geo}`
export const pleaseAudio = (id: Treat | 'ki' | 'pasporti') => `${A}pl-${id}.m4a`
/** «ჩაი? ყავა? წყალი?» — предложить напитки. */
export const drinksLine = () => DRINKS.map(d => `${phrase(d).geo}?`).join(' ')
export const drinksAudio = (voice: 'f' | 'm' | 'hero') => `${A}drinks-${voice}.m4a`

const INK = '#15100A'

/** Пиктограмма угощения: чашка чая, кофе, стакан воды, хачапури-лодочка, бокал вина, буханка. */
export function TreatIcon({ t, size = 34 }: { t: Treat; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      {t === 'chai' && <>
        {/* Чай — в прозрачном стакане-армуди, янтарный, с долькой лимона. */}
        <path d="M12 7h16 q-4 7 -1 13 q3 6 -3 12 h-8 q-6 -6 -3 -12 q3 -6 -1 -13z" fill="#FDFAEF" />
        <path d="M13.6 14h12.8 q-1 3 .4 6 q2.6 5.4 -2.8 10 h-8 q-5.4 -4.6 -2.8 -10 q1.4 -3 .4 -6z" fill="#D9862E" stroke="none" />
        <circle cx="27" cy="9" r="4" fill="#F5E27A" />
        <path d="M27 5 v8 M23 9 h8" stroke="#C9A93A" strokeWidth="1" />
        <path d="M9 34h22" />
      </>}
      {t === 'qava' && <>
        {/* Кофе — маленькая чашка на блюдце, тёмный, с паром. */}
        <path d="M11 18h16v6a7 7 0 0 1-7 7h-2a7 7 0 0 1-7-7z" fill="#FDFAEF" />
        <ellipse cx="19" cy="18" rx="8" ry="2.4" fill="#3B2414" />
        <path d="M27 20h2a3 3 0 0 1 0 6h-2" />
        <path d="M15 13 q2 -3 0 -6 M21 13 q2 -3 0 -6" stroke="#9A6A3A" />
        <ellipse cx="19" cy="33" rx="13" ry="2.6" fill="#E8D2AE" />
      </>}
      {t === 'tskali' && <>
        <path d="M11 7h18l-2.5 26h-13z" fill="#FDFAEF" />
        <path d="M12.4 17h15.2l-1.6 15h-12z" fill="#9CC6EE" stroke="none" />
        <path d="M14 20 q2 -1.5 4 0 t4 0 t4 0" stroke="#FDFAEF" strokeWidth="1.4" />
      </>}
      {t === 'khachapuri' && <>
        <path d="M3 22 Q20 4 37 22 Q20 34 3 22z" fill="#E9A84C" />
        <ellipse cx="20" cy="21" rx="9" ry="5" fill="#FFF4B8" />
        <circle cx="20" cy="21" r="3.2" fill="#F5B820" />
      </>}
      {t === 'ghvino' && <>
        <path d="M12 5h16v6a8 8 0 0 1-16 0z" fill="#FDFAEF" />
        <path d="M12.5 10h15a7.5 7 0 0 1-15 0z" fill="#9B1B3A" stroke="none" />
        <path d="M20 19v12 M14 34h12" />
      </>}
      {t === 'puri' && <>
        <path d="M4 22 Q4 12 20 12 Q36 12 36 22 Q36 29 20 29 Q4 29 4 22z" fill="#D9A15A" />
        <path d="M12 16 l3 6 M19 15 l3 6 M26 16 l3 6" stroke="#9A6A3A" />
      </>}
    </svg>
  )
}
