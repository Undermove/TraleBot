import { knows, phrase, type Rng } from '../story'

// «Прогулка» — чистая логика. Ты идёшь по батумской улице к морю; навстречу — знакомые.
// Встреча — короткий разговор по шагам: кто говорит, что ты должен ответить, что ответят тебе. Никаких
// таймеров: следующий шаг начинается, когда договорили предыдущий. Время суток — это место на маршруте:
// в начале улицы утро, в конце вечер (в режиме «день»), — его видно по небу.
// Экран (Walk.tsx) рисует улицу и ходит по шагам; тут — что за шаги и что засчитано.

export type WalkMode = 'hello' | 'day' | 'full'
export type Part = 'morning' | 'day' | 'evening'

/**
 * Шаг встречи. you — ход за тобой: нужно сказать want (годятся и soft — «можно, но лучше …»).
 * line — что знакомый говорит перед твоим ходом (нет — начинаешь ты), react — что отвечает после.
 */
export interface Beat {
  /** Что происходит, по-русски — строка под улицей. */
  cue: string
  line?: string
  want: string
  soft?: string[]
  /** Сказал в ответ «а у тебя?» — бонус. */
  bonus?: string
  react?: string
  /** После этого шага знакомый уходит. */
  parting?: boolean
}

export interface Meeting {
  /** Где на маршруте (метры от дома). */
  at: number
  part: Part
  who: Who
  beats: Beat[]
}

export interface Who {
  /** Как его называет строка под улицей: «соседка», «однокурсник». */
  ru: string
  /** Женщина/мужчина/ребёнок/пожилой — для рисунка. */
  kind: 'woman' | 'man' | 'kid' | 'old'
  coat: string
  skin: string
  hair: string
  /** Сумка, очки, кепка — чтобы знакомые не были на одно лицо. */
  extra: 'bag' | 'glasses' | 'cap' | 'none' | 'baker'
  /** Каким голосом говорит. */
  voice: 'f' | 'm'
}

/** Между встречами — пара десятков шагов: успеваешь пройтись, но не заскучать. */
export const SPACING = 18
const FIRST_AT = 12
/** После последнего знакомого улица выходит на набережную: дома кончаются, впереди перила и море. */
export const PROMENADE = 20
/** На каком расстоянии знакомый останавливается перед тобой. */
export const MEET_GAP = 2.7

export const PART_RU: Record<Part, string> = { morning: 'утро', day: 'день', evening: 'вечер' }
const PART_WHEN: Record<Part, string> = { morning: 'утром', day: 'днём', evening: 'вечером' }

/** Сколько встреч в прогулке. */
export const MEETINGS: Record<WalkMode, number> = { hello: 4, day: 6, full: 6 }

/** Длина улицы — до начала набережной. */
export const routeLength = (mode: WalkMode) => FIRST_AT + (MEETINGS[mode] - 1) * SPACING + 14
/** Где перила набережной: тут прогулка и кончается. */
export const railAt = (mode: WalkMode) => routeLength(mode) + PROMENADE

/** Время суток в точке маршрута. В первом уроке весь день — день: про время там ещё не говорили. */
export function partAt(mode: WalkMode, m: number): Part {
  if (mode === 'hello') return 'day'
  const p = m / routeLength(mode)
  return p < 0.36 ? 'morning' : p < 0.66 ? 'day' : 'evening'
}

/** 0..1 — сколько дня прошло: от него небо, солнце и фонари (плавно, а не скачком). */
export function dayClock(mode: WalkMode, m: number): number {
  if (mode === 'hello') return 0.5
  return Math.max(0, Math.min(1, m / routeLength(mode)))
}

/** Как здороваются в это время суток — из того, что человек уже знает. */
export function greetFor(lessonId: number, part: Part): string {
  if (part === 'morning' && knows(lessonId, 'dila')) return 'dila'
  if (part === 'evening' && knows(lessonId, 'saghamo')) return 'saghamo'
  return 'gamarjoba'
}

/** На приветствие отвечают тем же; на გამარჯობა — გაგიმარჯოს, если его уже проходили. */
const echoOf = (lessonId: number, id: string) => (id === 'gamarjoba' && knows(lessonId, 'gagimarjos') ? 'gagimarjos' : id)

const COATS = ['#1B5FB0', '#E01A3C', '#4E8A5B', '#C68F10', '#7A4E9A', '#D4563B', '#2F7F86']
const SKIN = ['#F2C9A0', '#E0AC7E', '#C68A5E', '#F6D7BC']
const HAIR = ['#2A1F18', '#5A3A22', '#9A6A3A', '#15100A']
const WHO: { ru: string; kind: Who['kind']; voice: Who['voice'] }[] = [
  { ru: 'Соседка', kind: 'woman', voice: 'f' }, { ru: 'Однокурсник', kind: 'man', voice: 'm' }, { ru: 'Сосед с пятого этажа', kind: 'old', voice: 'm' },
  { ru: 'Девочка из твоего подъезда', kind: 'kid', voice: 'f' }, { ru: 'Продавщица из пекарни', kind: 'woman', voice: 'f' }, { ru: 'Преподаватель', kind: 'man', voice: 'm' },
  { ru: 'Бабушка с балкона напротив', kind: 'old', voice: 'f' }, { ru: 'Однокурсница', kind: 'woman', voice: 'f' }
]

function who(i: number, rng: Rng): Who {
  const p = <T,>(a: T[]) => a[Math.floor(rng() * a.length)]
  const w = WHO[i % WHO.length]
  const extras: Who['extra'][] = ['bag', 'glasses', 'cap', 'none']
  return { ...w, coat: p(COATS), skin: p(SKIN), hair: w.kind === 'old' ? '#E8DEC5' : p(HAIR), extra: p(extras) }
}

/** Разговор одной встречи — по режиму и тому, что уже пройдено. */
export function beatsFor(lessonId: number, mode: WalkMode, part: Part, n: number, rng: Rng): Beat[] {
  const greet = greetFor(lessonId, part)
  const beats: Beat[] = []
  const theyFirst = mode === 'full' && rng() < 0.4
  if (theyFirst) {
    beats.push({ cue: 'Тебя заметили и поздоровались первыми. Ответь.', line: greet, want: echoOf(lessonId, greet), soft: ['gamarjoba'] })
  } else {
    beats.push({
      cue: n === 0 ? 'Навстречу идёт знакомый. Поздоровайся.' : 'Знакомое лицо. Поздоровайся.',
      want: greet,
      soft: greet !== 'gamarjoba' ? ['gamarjoba'] : undefined,
      react: echoOf(lessonId, greet)
    })
  }
  if (mode === 'full' && knows(lessonId, 'rogor') && rng() < 0.6) {
    beats.push({
      cue: 'Спрашивают, как дела.',
      line: 'rogor',
      want: 'kargad_madloba',
      bonus: knows(lessonId, 'kargad_shen') ? 'kargad_shen' : undefined,
      react: undefined
    })
  }
  beats.push({ cue: 'Пора бежать дальше. Попрощайся.', want: 'nakhvamdis', react: 'nakhvamdis', parting: true })
  return beats
}

/** Маршрут: встречи по улице, поровну на утро, день и вечер. */
export function route(lessonId: number, mode: WalkMode, rng: Rng = Math.random): Meeting[] {
  const n = MEETINGS[mode]
  return Array.from({ length: n }, (_, i) => {
    const at = FIRST_AT + i * SPACING
    const part = partAt(mode, at)
    return { at, part, who: who(i, rng), beats: beatsFor(lessonId, mode, part, i, rng) }
  })
}

export type Result = 'right' | 'bonus' | 'soft' | 'miss'
export interface Verdict { res: Result; hint: string }

const g = (id: string) => phrase(id).geo

/** Засчитать ответ на шаге встречи. */
export function judge(lessonId: number, meeting: Meeting, beat: Beat, id: string): Verdict {
  if (id === beat.bonus) return { res: 'bonus', hint: 'Ещё и спросил в ответ — так и поддерживают разговор.' }
  if (id === beat.want) return { res: 'right', hint: '' }
  if (beat.soft?.includes(id)) {
    if (beat.line === 'gamarjoba') return { res: 'soft', hint: `Годится. Но на ${g('gamarjoba')} отвечают ${g('gagimarjos')} — «и тебе».` }
    if (beat.line) return { res: 'soft', hint: `Годится. Но тебе сказали ${g(beat.line)} — ответь тем же.` }
    return { res: 'soft', hint: `${g('gamarjoba')} годится всегда. Но ${PART_WHEN[meeting.part]} говорят ${g(beat.want)}.` }
  }
  if (beat.parting) return { res: 'miss', hint: `Вы прощаетесь — говорят ${g('nakhvamdis')}.` }
  if (id === 'nakhvamdis') return { res: 'miss', hint: 'Вы только встретились, а ты уже прощаешься.' }
  if (beat.line === 'rogor') return { res: 'miss', hint: `Спросили, как дела. Ответь ${g('kargad_madloba')}.` }
  if (beat.line) return { res: 'miss', hint: `Тебе сказали ${g(beat.line)} — ответь на приветствие.` }
  return { res: 'miss', hint: lessonId >= 2 ? `Посмотри на небо: сейчас ${PART_RU[meeting.part]}.` : 'Сначала поздоровайся.' }
}

/** Кнопки-реплики: всегда одни и те же и в одном порядке — рука запоминает. */
export function replies(lessonId: number, mode: WalkMode): string[] {
  const all = mode === 'hello'
    ? ['gamarjoba', 'nakhvamdis']
    : mode === 'day' ? ['dila', 'gamarjoba', 'saghamo', 'nakhvamdis']
      : ['dila', 'gamarjoba', 'saghamo', 'gagimarjos', 'kargad_madloba', 'kargad_shen', 'nakhvamdis']
  return all.filter(id => knows(lessonId, id))
}

/** Сколько верных ответов до того, как убрать русские подсказки под кнопками. */
export const HINTS_OFF_AFTER = 6

export interface Score { right: number; soft: number; miss: number; bonus: number }
export const emptyScore = (): Score => ({ right: 0, soft: 0, miss: 0, bonus: 0 })
export function addScore(s: Score, r: Result): Score {
  return { ...s, right: s.right + (r === 'right' || r === 'bonus' ? 1 : 0), soft: s.soft + (r === 'soft' ? 1 : 0), miss: s.miss + (r === 'miss' ? 1 : 0), bonus: s.bonus + (r === 'bonus' ? 1 : 0) }
}

export function verdictText(s: Score, mode: WalkMode): string {
  if (s.miss === 0) return mode === 'hello' ? 'Ни разу не перепутал «привет» и «пока». Батуми к тебе уже привыкает.' : 'Ни одной ошибки — и всё по времени суток. Тебя тут явно запомнят.'
  if (s.miss <= 2) return 'Пару раз запнулся, но все ушли с улыбкой.'
  return 'Пока путаешься, и это нормально. Завтра по этой улице пойдёшь увереннее.'
}
