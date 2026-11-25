import type { ProgressState } from '../types'
import type { DailyItem, DailyReportDto, DailyTaskDto } from './types'

// Правила «Задания дня» без экрана: порядок шагов, игра в пары, итог для сервера, вопросы минутной проверки.
// Что именно повторять и насколько сложно — решает сервер; здесь только то, как это проводится.

export function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100
  const mod10 = n % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

export const days = (n: number) => `${n} ${plural(n, 'день', 'дня', 'дней')}`

/** «4 формы и 1 слово» — из чего собрана игра. */
export function formsAndWords(items: DailyItem[]): string {
  const forms = items.filter(i => i.kind === 'verb').length
  const words = items.length - forms
  const parts: string[] = []
  if (forms) parts.push(`${forms} ${plural(forms, 'форма', 'формы', 'форм')}`)
  if (words) parts.push(`${words} ${plural(words, 'слово', 'слова', 'слов')}`)
  return parts.join(' и ')
}

/** Строка карточки на главной: последняя реплика тренера, а без неё — из чего собрана игра. */
export function cardLine(task: DailyTaskDto): string {
  const said = [...task.chat].reverse().find(line => line.trim())
  if (said) return said.trim()
  return `${formsAndWords(task.pairs)} · ${task.mode === 'comeback' ? 'одна минута' : 'две минуты'}`
}

export type DailyStep = 'warm' | 'game' | 'back' | 'check'

/** Шаги занятия по порядку; разминки и обратного пути может не быть. */
export const flowOf = (task: DailyTaskDto): DailyStep[] => [
  ...(task.warm.length ? ['warm' as const] : []), 'game', ...(task.back?.length ? ['back' as const] : []), 'check'
]

/** Строка с выделением: «<b>важное</b> и обычное» → куски для отрисовки без вставки разметки. */
export function boldParts(line: string): { text: string; bold: boolean }[] {
  const parts: { text: string; bold: boolean }[] = []
  const tag = /<b>(.*?)<\/b>/gs
  let at = 0
  for (const m of line.matchAll(tag)) {
    if (m.index! > at) parts.push({ text: line.slice(at, m.index), bold: false })
    if (m[1]) parts.push({ text: m[1], bold: true })
    at = m.index! + m[0].length
  }
  if (at < line.length) parts.push({ text: line.slice(at), bold: false })
  // Любую другую разметку показываем как текст без угловых скобок тегов.
  return parts.map(p => ({ ...p, text: p.text.replace(/<\/?[a-z][^>]*>/gi, '') })).filter(p => p.text)
}

export function clock(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${s % 60 < 10 ? '0' : ''}${s % 60}`
}

export function shuffle<T>(xs: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Есть ли в строке грузинские буквы — такой вариант показываем с транскрипцией. */
export const hasGeorgian = (s: string) => /[ა-ჿ]/.test(s)

/** Грузинские слова строки — чтобы подписать под вопросом, как они читаются. */
export const georgianWords = (s: string) => s.match(/[ა-ჿ]+(?:[ -][ა-ჿ]+)*/g) ?? []

// ── Игра «Собери пары» ───────────────────────────────────────────────────────

export type Side = 'l' | 'r'

export interface PairsState {
  /** Порядок плиток в столбцах: слева грузинское, справа перевод. В ячейках — номера пар. */
  left: number[]
  right: number[]
  sel: { side: Side; i: number } | null
  /** Только что нажатая неверная пара — трясётся. */
  bad: { l: number; r: number } | null
  matchedL: number[]
  matchedR: number[]
  /** Время идёт с первого нажатия. */
  started: boolean
  /** Время вышло. */
  over: boolean
  /** Неверные попытки этой партии. */
  errors: number
  /** Ключи форм, на которых ошиблись. */
  wrong: string[]
}

export type PairsEvent = 'select' | 'match' | 'miss' | 'done' | null

export function newPairs(count: number, rng: () => number = Math.random): PairsState {
  const idx = Array.from({ length: count }, (_, i) => i)
  return { left: shuffle(idx, rng), right: shuffle(idx, rng), sel: null, bad: null, matchedL: [], matchedR: [], started: false, over: false, errors: 0, wrong: [] }
}

/** Одинаковый перевод у двух форм — обе плитки верные: человека не наказываем за то, чего не различить. */
const fits = (pairs: DailyItem[], l: number, r: number) => l === r || pairs[l].ru === pairs[r].ru

export const allMatched = (s: PairsState, pairs: DailyItem[]) => s.matchedL.length === pairs.length

/** Нажатие на плитку: сначала выбор, потом пара к выбранному. */
export function tapPair(s: PairsState, side: Side, i: number, pairs: DailyItem[]): { state: PairsState; event: PairsEvent } {
  const taken = side === 'l' ? s.matchedL : s.matchedR
  if (s.over || taken.includes(i) || allMatched(s, pairs)) return { state: s, event: null }
  const base = { ...s, started: true, bad: null }
  if (!s.sel || s.sel.side === side) {
    const same = s.sel?.side === side && s.sel.i === i
    return { state: { ...base, sel: same ? null : { side, i } }, event: 'select' }
  }
  const l = side === 'l' ? i : s.sel.i
  const r = side === 'r' ? i : s.sel.i
  if (fits(pairs, l, r)) {
    const next = { ...base, sel: null, matchedL: [...s.matchedL, l], matchedR: [...s.matchedR, r] }
    return { state: next, event: allMatched(next, pairs) ? 'done' : 'match' }
  }
  const wrong = [...new Set([...s.wrong, pairs[l].key, pairs[r].key])]
  return { state: { ...base, sel: null, bad: { l, r }, errors: s.errors + 1, wrong }, event: 'miss' }
}

/** Время вышло: несобранные пары считаются ошибками — сервер иначе решит, что эти формы получились. */
export function timeOut(s: PairsState, pairs: DailyItem[]): PairsState {
  if (s.over || allMatched(s, pairs)) return s
  const missed = pairs.filter((_, i) => !s.matchedL.includes(i)).map(p => p.key)
  return { ...s, over: true, sel: null, bad: null, errors: s.errors + missed.length, wrong: [...new Set([...s.wrong, ...missed])] }
}

/** Что сказать под игрой прямо сейчас. */
export function pairsHint(s: PairsState, pairs: DailyItem[]): string {
  if (allMatched(s, pairs)) return 'Все пары собраны.'
  if (!s.started) return 'Нажми форму, потом её перевод. Время пойдёт с первого нажатия.'
  if (s.sel?.side === 'l') return 'Теперь нажми её перевод.'
  if (s.sel) return `Теперь нажми грузинскую форму для «${pairs[s.sel.i].ru}».`
  return 'Нажми форму, потом её перевод.'
}

// ── Итог ─────────────────────────────────────────────────────────────────────

/** Что накопилось за занятие. */
export interface DailyRun {
  warmWrong: string[]
  backWrong: string[]
  pairWrong: string[]
  /** Все неверные попытки в парах, включая несобранные из-за времени, по всем партиям. */
  errors: number
  checkErrors: number
  /** За сколько секунд собрана игра (последняя партия). */
  seconds: number
}

export const emptyRun = (): DailyRun => ({ warmWrong: [], backWrong: [], pairWrong: [], errors: 0, checkErrors: 0, seconds: 0 })

/** Партия закончилась (собрана или вышло время) — её ошибки добавляются к занятию. */
export function addGame(run: DailyRun, game: PairsState, seconds: number): DailyRun {
  return { ...run, errors: run.errors + game.errors, pairWrong: [...new Set([...run.pairWrong, ...game.wrong])], seconds }
}

export const buildReport = (task: DailyTaskDto, run: DailyRun): DailyReportDto => ({
  day: task.day, warmWrong: run.warmWrong, pairWrong: run.pairWrong, errors: run.errors, checkErrors: run.checkErrors, seconds: run.seconds, backWrong: run.backWrong
})

/** Все ошибки занятия — для строки итога. */
export const totalErrors = (run: DailyRun) => run.errors + run.checkErrors + run.warmWrong.length + run.backWrong.length

/** «4 пары за 31 секунду, без ошибок». */
export function statLine(pairs: number, run: DailyRun): string {
  const errors = totalErrors(run)
  const time = run.seconds > 0 ? ` за ${run.seconds} ${plural(run.seconds, 'секунду', 'секунды', 'секунд')}` : ''
  return `${pairs} ${plural(pairs, 'пара', 'пары', 'пар')}${time}, ${errors === 0 ? 'без ошибок' : `${errors} ${plural(errors, 'ошибка', 'ошибки', 'ошибок')}`}`
}

/** Заголовок итога — по тому, какой был день и как он прошёл. */
export function finaleTitle(mode: DailyTaskDto['mode'], errors: number): string {
  if (mode === 'review') return errors <= 1 ? 'Знакомое помнишь' : 'День закрыт'
  if (mode === 'comeback') return 'С возвращением'
  return errors === 0 ? 'Всё помнишь' : 'Готово, день закрыт'
}

export const streakLine = (streak: number) => (streak <= 1 ? 'Серия началась' : `${days(streak)} подряд`)

/** Прогресс в ответе сервера: в виде мини-аппа или в виде API (lastPlayedAtUtc) — принимаем оба. */
export function progressPatch(progress: unknown): Partial<ProgressState> | null {
  if (!progress || typeof progress !== 'object') return null
  const p = progress as Record<string, any>
  const patch: Partial<ProgressState> = {}
  if (typeof p.xp === 'number') patch.xp = p.xp
  if (typeof p.streak === 'number') patch.streak = p.streak
  if (p.completedLessons && typeof p.completedLessons === 'object') patch.completedLessons = p.completedLessons
  if (typeof p.lastPlayedDate === 'string') patch.lastPlayedDate = p.lastPlayedDate
  else if (typeof p.lastPlayedAtUtc === 'string') patch.lastPlayedDate = p.lastPlayedAtUtc.slice(0, 10)
  if (typeof p.xpSpent === 'number') patch.xpSpent = p.xpSpent
  if (typeof p.totalTreatsGiven === 'number') patch.totalTreatsGiven = p.totalTreatsGiven
  if ('lastFedAtUtc' in p) patch.lastFedAtUtc = p.lastFedAtUtc ?? null
  if ('lastTreatIndex' in p) patch.lastTreatIndex = p.lastTreatIndex ?? null
  return patch
}

// ── Минутная проверка ────────────────────────────────────────────────────────

export const MINUTE_MAX = 6

export interface LessonQuestion {
  id: string
  question: string
  options: string[]
  answerIndex: number
  questionType?: string
}

export interface MinuteQuestion extends LessonQuestion { lessonId: number }

/** Какие уроки спросить: не больше шести, равномерно по списку пропущенных. */
export function minuteLessons(lessons: number[], max = MINUTE_MAX): number[] {
  if (lessons.length <= max) return [...lessons]
  return Array.from({ length: max }, (_, i) => lessons[Math.round((i * (lessons.length - 1)) / (max - 1))])
}

const isChoice = (q: LessonQuestion) =>
  (!q.questionType || q.questionType === 'choice') && Array.isArray(q.options) && q.options.length >= 2 &&
  Number.isInteger(q.answerIndex) && q.answerIndex >= 0 && q.answerIndex < q.options.length

/** По одному вопросу с выбором ответа из каждого урока; какой именно — зависит от дня, а не от случая. */
export function minuteQuestions(byLesson: { lessonId: number; questions: LessonQuestion[] }[], day: string, max = MINUTE_MAX): MinuteQuestion[] {
  const out: MinuteQuestion[] = []
  for (const { lessonId, questions } of byLesson) {
    const fit = questions.filter(isChoice)
    if (!fit.length) continue
    let seed = lessonId
    for (const c of day) seed = (seed * 31 + c.charCodeAt(0)) >>> 0
    out.push({ ...fit[seed % fit.length], lessonId })
    if (out.length === max) break
  }
  return out
}
