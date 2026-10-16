import { voicedAudio } from '../../audio'
import { NAME_LIST, PHRASES } from '../../story'

// Чей голос у реплики в разговорах «Знакомства» (чат с Нино, «Обо мне», супра). Ключ — грузинский текст
// без знаков препинания. Свои записи (public/audio/intro-story/supra, ElevenLabs eleven_v4 ka: герой — Will,
// мужчины — George, женщины — Alice) — для реплик, которых нет нужным голосом в audio.ts; остальное — по
// фразам story.json. Если записи нужным голосом нет — реплика молчит (её читают), а не звучит чужим голосом.

export type Voice = 'hero' | 'm' | 'f'

export const bare = (s: string) => s.replace(/[.!?…,]/g, '').replace(/\s+/g, ' ').trim()

const OWN: Record<Voice, Record<string, string>> = {
  hero: {
  'სასიამოვნოა': '/audio/intro-story/supra/h01.m4a',
  'მე მყავს და': '/audio/intro-story/supra/h02.m4a',
  'მე მყავს ძაღლი': '/audio/intro-story/supra/h03.m4a',
  'მე მყავს ერთი ძმა და ერთი და': '/audio/intro-story/supra/h04.m4a',
  'მიყვარს საქართველო': '/audio/intro-story/supra/h05.m4a',
  'საქართველო ძალიან ლამაზია': '/audio/intro-story/supra/h06.m4a',
  'გაუმარჯოს': '/audio/intro-story/supra/h07.m4a',
  'გაუმარჯოს საქართველოს': '/audio/intro-story/supra/h08.m4a',
  'ეს ჩემი მეგობარია': '/audio/intro-story/supra/h09.m4a',
  'არ ვიცი': '/audio/intro-story/supra/h10.m4a',
  'ვცხოვრობ ბათუმში': '/audio/intro-story/supra/h11.m4a',
  'მე ვარ სტუდენტი': '/audio/intro-story/supra/h12.m4a',
  'მე ვარ ესპანეთიდან': '/audio/intro-story/supra/h13.m4a',
  'მე ვარ საფრანგეთიდან': '/audio/intro-story/supra/h14.m4a',
  'მე ვარ საქართველოდან': '/audio/intro-story/supra/h15.m4a',
  'ვმუშაობ': '/audio/intro-story/supra/h16.m4a',
  'ვცხოვრობ თბილისში': '/audio/intro-story/supra/h17.m4a',
  'ვცხოვრობ ქუთაისში': '/audio/intro-story/supra/h18.m4a',
  'მე ვარ ექიმი': '/audio/intro-story/supra/h19.m4a',
  'მე ვარ მასწავლებელი': '/audio/intro-story/supra/h20.m4a',
  },
  m: {
  'რა გქვია': '/audio/intro-story/supra/m01.m4a',
  'საიდან ხარ': '/audio/intro-story/supra/m02.m4a',
  'მე ვცხოვრობ თბილისში': '/audio/intro-story/supra/m03.m4a',
  'შენ რა პროფესია გაქვს': '/audio/intro-story/supra/m04.m4a',
  'მე მყავს ერთი ძმა და ერთი და': '/audio/intro-story/supra/m05.m4a',
  'სასიამოვნოა საქართველო მოგწონს': '/audio/intro-story/supra/m06.m4a',
  'გაუმარჯოს': '/audio/intro-story/supra/m07.m4a',
  'გაუმარჯოს საქართველოს': '/audio/intro-story/supra/m08.m4a',
  'შენ': '/audio/intro-story/supra/m09.m4a',
  },
  f: {
  'შენ': '/audio/intro-story/supra/f01.m4a',
  }
}

const BY_GEO: Record<string, string> = Object.fromEntries(Object.values(PHRASES).map(p => [bare(p.geo), p.id]))

/** Запись реплики нужным голосом или undefined. «მე მქვია <имя>» гостя — запись ресепшна с этим именем. */
export function lineUrl(geo: string, voice: Voice): string | undefined {
  const k = bare(geo)
  const own = OWN[voice][k]
  if (own) return own
  const name = /^მე მქვია (\S+)$/.exec(k)?.[1]
  if (name && voice !== 'hero') {
    const n = NAME_LIST.indexOf(name)
    if (n >= 0) return `/audio/intro-story/rc/n${n}.m4a`
  }
  const id = BY_GEO[k]
  if (!id) return undefined
  const url = voicedAudio(id, voice)
  // voicedAudio падает на голос Alice, если записи нужным голосом нет, — герою и мужчинам он чужой.
  if (voice === 'hero' && !url?.includes('/hero/')) return undefined
  if (voice === 'm' && !url?.includes('/m/')) return undefined
  return url
}
