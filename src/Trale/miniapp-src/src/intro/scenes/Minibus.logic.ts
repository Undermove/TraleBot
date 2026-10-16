import { knows, met, phrase } from '../story'

// «Маршрутка» — чистая логика поездки в университет. По дороге случается то, что случается в любой
// батумской маршрутке: передать за проезд и получить сдачу, налететь на соседа на повороте, ответить
// водителю, твоя ли остановка, поймать уроненную перчатку. Каждое событие ждёт твоего ответа — без
// таймеров. На табличках остановок — გაჩერება, водитель спрашивает «აქ?» — здесь?, кто-то сзади кричит
// «გამიჩერეთ!», а у университета водитель проезжает мимо — тут уже кричишь ты. Экран — Minibus.tsx.

export type MinibusMode = 'polite'

/** Остановки по пути; твоя — университет. */
export const STOPS = ['sea', 'piazza', 'tower', 'uni'] as const
export type Stop = typeof STOPS[number]
export const MY_STOP: Stop = 'uni'
export const STOP_RU: Record<Stop, string> = { sea: 'Набережная', piazza: 'Пьяцца', tower: 'Алфавитная башня', uni: 'Университет' }

export type EventKind = 'change' | 'lurch' | 'stop' | 'glove' | 'brake' | 'call' | 'exit'

/** Кто говорит: водитель, сосед, женщина напротив, пассажир сзади (его не видно). */
export type Speaker = 'd' | 'n' | 'l' | 'back'

export interface RideEvent {
  kind: EventKind
  cue: string
  /** Что звучит до твоего ответа. */
  lines?: { id: string; by: Speaker }[]
  want: string
  /** Для «остановки»: какая. */
  stop?: Stop
  /** Что скажет водитель или сосед в ответ (если скажет). */
  react?: string
}

const g = (id: string) => phrase(id).geo

/** Поездка: оплата, остановки, поворот, перчатка, торможение, «остановите!», выход. */
export function ride(): RideEvent[] {
  return [
    { kind: 'change', cue: 'Ты передал деньги за проезд, сосед передал тебе сдачу.', want: 'madloba' },
    { kind: 'stop', stop: 'sea', lines: [{ id: 'aq', by: 'd' }], cue: 'Остановка — на табличке გაჩერება. Водитель оборачивается: «აქ?» — здесь? Посмотри на значок и на свой билет.', want: 'ara' },
    { kind: 'lurch', cue: 'Резкий поворот! Ты налетел на соседа.', want: 'bodishi' },
    { kind: 'stop', stop: 'piazza', lines: [{ id: 'gamicheret', by: 'back' }, { id: 'aq', by: 'd' }], cue: 'Кто-то сзади крикнул водителю «გამიჩერეთ!» — остановите! Маршрутка встала. Водитель смотрит и на тебя: здесь?', want: 'ara' },
    { kind: 'glove', cue: 'Ты уронил перчатку — женщина подняла и протягивает тебе.', want: 'madloba' },
    { kind: 'brake', cue: 'Водитель резко затормозил — ты наступил соседу на ногу.', want: 'bodishi' },
    { kind: 'call', stop: 'uni', cue: 'Впереди университет — твоя остановка! А водитель не тормозит. Крикни ему: остановите!', want: 'gamicheret', react: 'aq' },
    { kind: 'stop', stop: 'uni', cue: 'Водитель переспросил: «აქ?» Ответь: да.', want: 'ki' },
    { kind: 'exit', cue: 'Ты выходишь у университета. Попрощайся с водителем.', want: 'nakhvamdis', react: 'nakhvamdis' }
  ]
}

export type Result = 'right' | 'miss'
export interface Verdict { res: Result; hint: string }

export function judge(e: RideEvent, id: string): Verdict {
  if (id === e.want) return { res: 'right', hint: '' }
  switch (e.kind) {
    case 'change':
    case 'glove':
      return { res: 'miss', hint: id === 'bodishi' ? 'Ты ничего плохого не сделал — тебе помогли. Скажи спасибо.' : `Тебе помогли — скажи ${g('madloba')}.` }
    case 'lurch':
    case 'brake':
      return { res: 'miss', hint: id === 'madloba' ? 'За такое не благодарят. Тут нужно «извините».' : `Ты задел человека — извинись: ${g('bodishi')}.` }
    case 'stop':
      return e.want === 'ki'
        ? { res: 'miss', hint: `Это твоя остановка — на билете тот же значок. Скажи ${g('ki')} — да.` }
        : { res: 'miss', hint: `Это не твоя остановка — на билете другой значок. Скажи ${g('ara')} — нет.` }
    case 'call':
      return { res: 'miss', hint: `Водитель проедет мимо! Крикни ${g('gamicheret')} — остановите!` }
    case 'exit':
      return { res: 'miss', hint: `Ты уходишь — попрощайся: ${g('nakhvamdis')}.` }
  }
}

/** Кнопки: фразы урока и «остановите!» — с того момента, как его крикнули сзади (`heard`). */
export const replies = (lessonId: number, heard: readonly string[] = []) =>
  ['madloba', 'bodishi', 'ki', 'ara', 'gamicheret', 'nakhvamdis'].filter(id => knows(lessonId, id) || (met(lessonId, id) && heard.includes(id)))

/** Что уже прозвучало к событию ei (включая его реплики). */
export const heardBy = (events: RideEvent[], ei: number) =>
  events.slice(0, ei + 1).flatMap(e => [...(e.lines ?? []).map(l => l.id), e.react ?? ''])
export const HINTS_OFF_AFTER = 6
