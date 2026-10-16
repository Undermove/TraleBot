import { knows, phrase } from '../story'

// «Маршрутка» — чистая логика поездки в университет. По дороге случается то, что случается в любой
// батумской маршрутке: передать за проезд и получить сдачу, налететь на соседа на повороте, ответить
// водителю, твоя ли остановка, поймать уроненную перчатку. Каждое событие ждёт твоего ответа — без
// таймеров. Экран — Minibus.tsx.

export type MinibusMode = 'polite'

/** Остановки по пути; твоя — университет. */
export const STOPS = ['sea', 'piazza', 'tower', 'uni'] as const
export type Stop = typeof STOPS[number]
export const MY_STOP: Stop = 'uni'
export const STOP_RU: Record<Stop, string> = { sea: 'Набережная', piazza: 'Пьяцца', tower: 'Алфавитная башня', uni: 'Университет' }

export type EventKind = 'change' | 'lurch' | 'stop' | 'glove' | 'brake' | 'exit'

export interface RideEvent {
  kind: EventKind
  cue: string
  want: string
  /** Для «остановки»: какая. */
  stop?: Stop
  /** Что скажет водитель или сосед в ответ (если скажет). */
  react?: string
}

const g = (id: string) => phrase(id).geo

/** Поездка: оплата, три остановки, поворот, перчатка, торможение, выход. */
export function ride(): RideEvent[] {
  return [
    { kind: 'change', cue: 'Ты передал деньги за проезд, сосед передал тебе сдачу.', want: 'madloba' },
    { kind: 'stop', stop: 'sea', cue: 'Водитель оборачивается: тебе здесь выходить? Посмотри на остановку и на свой билет.', want: 'ara' },
    { kind: 'lurch', cue: 'Резкий поворот! Ты налетел на соседа.', want: 'bodishi' },
    { kind: 'stop', stop: 'piazza', cue: 'Остановка. Водитель смотрит на тебя: здесь?', want: 'ara' },
    { kind: 'glove', cue: 'Ты уронил перчатку — женщина подняла и протягивает тебе.', want: 'madloba' },
    { kind: 'brake', cue: 'Водитель резко затормозил — ты наступил кому-то на ногу.', want: 'bodishi' },
    { kind: 'stop', stop: 'tower', cue: 'Ещё остановка. Тебе здесь?', want: 'ara' },
    { kind: 'stop', stop: 'uni', cue: 'Водитель оборачивается: здесь?', want: 'ki' },
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
    case 'exit':
      return { res: 'miss', hint: `Ты уходишь — попрощайся: ${g('nakhvamdis')}.` }
  }
}

export const replies = (lessonId: number) => ['madloba', 'bodishi', 'ki', 'ara', 'nakhvamdis'].filter(id => knows(lessonId, id))
export const HINTS_OFF_AFTER = 6
