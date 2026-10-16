import { voicedAudio } from '../../audio'
import { CITIES, COUNTRIES, JOBS, NAME_LIST, PHRASES } from '../../story'

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
  'ყავა გთხოვთ': '/audio/intro-story/chat/h-qava-gtkhovt.m4a',
  'ჩაი გთხოვთ': '/audio/intro-story/chat/h-chai-gtkhovt.m4a',
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
  'ყავა ჩაი': '/audio/intro-story/chat/f-qava-chai.m4a',
  'ზღვა': '/audio/intro-story/chat/f-zghva.m4a',
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

// ── Реплика, собранная из слов ─────────────────────────────────────────────────────────────────────
// «გამარჯობა! მე მქვია ლუკა.», «ნინო? ის არის ექიმი.», «გამარჯობა, თამარი!» целиком не записаны: их
// собирают сцены. Раскладываем такую реплику на записанные куски (public/audio/intro-story/lines и rc)
// и играем подряд. Имя самого ученика записать нельзя — его реплика звучит без имени («მე მქვია…»).

const L = '/audio/intro-story/lines/'
const greetUrl = (voice: Voice) => voicedAudio('gamarjoba', voice)

function piece(k: string, voice: Voice): string[] | null {
  const whole = lineUrl(k, voice)
  if (whole) return [whole]
  const n = NAME_LIST.indexOf(k)
  if (n >= 0) return voice === 'hero' ? [`${L}name-${n}.m4a`] : [`/audio/intro-story/rc/n${n}.m4a`]
  let m = /^გამარჯობა (\S+)$/.exec(k)
  if (m) {
    const i = NAME_LIST.indexOf(m[1])
    if (i >= 0 && voice === 'hero') return [`${L}hello-${i}.m4a`]
    const g = greetUrl(voice)
    return g ? [g] : null
  }
  m = /^მე მქვია (\S+)$/.exec(k)
  if (m) return voice === 'hero' ? [`${L}mkvia.m4a`] : null
  m = /^მიყვარს (\S+)$/.exec(k)
  if (m && voice === 'hero') { const i = CITIES.findIndex(c => c.base === m![1]); return i >= 0 ? [`${L}love-${i}.m4a`] : null }
  if (voice === 'hero') return null
  m = /^მე ვარ (\S+)$/.exec(k)
  if (m) {
    const c = COUNTRIES.find(x => x.from === m![1]); if (c) return [`/audio/intro-story/rc/c-${c.flag}-${voice}.m4a`]
    const j = JOBS.findIndex(x => x.geo === m![1]); if (j >= 0) return [`/audio/intro-story/rc/j${j}-${voice}.m4a`]
    return null
  }
  m = /^ის არის (\S+)$/.exec(k)
  if (m) {
    const c = COUNTRIES.find(x => x.from === m![1]); if (c) return [`${L}${voice}-is-${c.flag}.m4a`]
    const j = JOBS.findIndex(x => x.geo === m![1]); if (j >= 0) return [`${L}${voice}-is-j${j}.m4a`]
  }
  return null
}

/**
 * Записи, из которых звучит реплика, по порядку: целиком, если есть; иначе — по предложениям
 * («გამარჯობა! მე მქვია ლუკა.») и по образцам: приветствие с именем, «მე მქვია …», «… ? ის არის …».
 * Кусок без записи пропускается (его читают в пузыре).
 */
export function lineClips(geo: string, voice: Voice): string[] {
  const whole = lineUrl(geo, voice)
  if (whole) return [whole]
  const parts = geo.split(/(?<=[.!?])\s+/).map(bare).filter(Boolean)
  const out: string[] = []
  for (const p of parts) {
    const q = /^(\S+) ის არის (\S+)$/.exec(p)
    if (q && voice !== 'hero' && NAME_LIST.includes(q[1])) {
      out.push(`${L}${voice}-nameq-${NAME_LIST.indexOf(q[1])}.m4a`, ...(piece(`ის არის ${q[2]}`, voice) ?? []))
      continue
    }
    out.push(...(piece(p, voice) ?? []))
  }
  return out
}
