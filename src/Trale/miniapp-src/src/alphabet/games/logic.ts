import { cyr } from '../../verbs/types'
import { LESSON_COUNT, LESSON_LETTERS, LESSON_WORDS, SOUNDS } from './data'

// Чистая логика игр алфавита: что можно показывать к уроку N, как собрать поле, раунды, варианты.
// Никакого React здесь нет — всё проверяется в logic.test.ts.

export type Rng = () => number

export const pick = <T,>(xs: readonly T[], rng: Rng = Math.random): T => xs[Math.floor(rng() * xs.length)]

export function shuffle<T>(xs: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...xs]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const clampLesson = (lesson: number) => Math.max(1, Math.min(LESSON_COUNT, Math.floor(lesson)))

/** Новые буквы урока. */
export const lessonLetters = (lesson: number): string[] => [...LESSON_LETTERS[clampLesson(lesson) - 1]]

/** Все буквы, выученные к концу урока (включая его собственные). */
export function learnedLetters(lesson: number): string[] {
  return LESSON_LETTERS.slice(0, clampLesson(lesson)).flat()
}

export const isGeorgian = (ch: string) => ch >= 'ა' && ch <= 'ჿ'

/** Слово составлено только из выученных букв. */
export function readable(word: string, lesson: number): boolean {
  const known = new Set(learnedLetters(lesson))
  return [...word].every(ch => !isGeorgian(ch) || known.has(ch))
}

export interface Word { geo: string; ru: string; lesson: number }

/** Грузинские слова, которые ученик уже видел к концу урока (свои — первыми). */
export function wordsUpTo(lesson: number): Word[] {
  const n = clampLesson(lesson)
  const out: Word[] = []
  for (let l = n; l >= 1; l--) for (const [geo, ru] of LESSON_WORDS[l - 1]) out.push({ geo, ru, lesson: l })
  return out
}

/** Сколько грузинских слов ученик знает после урока. */
export const wordCount = (lesson: number) => LESSON_WORDS.slice(0, clampLesson(lesson)).reduce((s, w) => s + w.length, 0)

/** «3 грузинских слова», «9 грузинских слов». */
export function wordsLabel(n: number): string {
  const d = n % 10, dd = n % 100
  if (d === 1 && dd !== 11) return `${n} грузинское слово`
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return `${n} грузинских слова`
  return `${n} грузинских слов`
}

/** Как сказать звук буквы: уточняем «с выдохом / коротко», только если похожая буква уже выучена. */
export function soundOf(letter: string, lesson: number): string {
  const s = SOUNDS[letter]
  if (!s) return letter
  const twin = s.group && learnedLetters(lesson).some(l => l !== letter && SOUNDS[l]?.group === s.group)
  return twin && s.exact ? s.exact : `«${s.plain}»`
}

/** Буквы, которые можно предложить как неверный вариант к letter: выученные и не похожие на неё по звуку. */
export function distractorsFor(letter: string, lesson: number, exclude: readonly string[] = []): string[] {
  const g = SOUNDS[letter]?.group
  return learnedLetters(lesson).filter(l => l !== letter && !exclude.includes(l) && (!g || SOUNDS[l]?.group !== g))
}

// ───────────── Лестница слов ─────────────

/** Слова, которые ученик может прочитать к концу урока: настоящие грузинские, только из открытых букв. */
export const ladder = (lesson: number): Word[] => wordsUpTo(lesson).filter(w => readable(w.geo, lesson))

/** Есть ли в слове новая буква этого урока. */
export const hasOwnLetter = (geo: string, lesson: number) => lessonLetters(lesson).some(l => geo.includes(l))

// ───────────── «Превращение» ─────────────

/** Кусок слова: как звучит (кириллицей) и грузинская буква. */
export interface Piece { ru: string; geo: string | null }

/** Слово по буквам: как звучит каждая (кириллицей, как в транскрипции) и сама грузинская буква. */
export function morphPieces(geo: string): Piece[] {
  return [...geo].map(ch => ({ ru: cyr(ch), geo: ch }))
}

/**
 * Настоящие грузинские слова для «Превращения»: из открытых к уроку букв, 2–7 букв, сначала свои слова
 * урока и с новой буквой урока. На экране слово сначала написано кириллицей («дэда») — буквы по одной
 * становятся грузинскими (დედა), в конце — что оно значит.
 */
/**
 * Какие слова может взять игра урока слов: own — слова этого урока (первыми), known — все слова, с которыми
 * уже познакомили к этому уроку. Без pool — все слова, читаемые к стадии lesson (для тестов и старых вызовов).
 */
export interface WordPool { own: Word[]; known: Word[] }

const poolOf = (lesson: number, pool?: WordPool): WordPool => pool ?? { own: ladder(lesson).filter(w => w.lesson === clampLesson(lesson)), known: ladder(lesson) }

export function morphWords(lesson: number, count = 2, rng: Rng = Math.random, pool?: WordPool): Word[] {
  const n = clampLesson(lesson)
  const { own, known } = poolOf(n, pool)
  const ok = (w: Word) => { const len = [...w.geo].length; return len >= 2 && len <= 7 && !w.geo.includes(' ') }
  const isOwn = (w: Word) => own.some(o => o.geo === w.geo)
  const score = (w: Word) => (isOwn(w) ? 2 : 0) + (hasOwnLetter(w.geo, n) ? 1 : 0)
  const all = [...own, ...known.filter(w => !isOwn(w))]
  return shuffle(all.filter(ok), rng).sort((a, b) => score(b) - score(a)).slice(0, count)
}

/** Варианты для одной буквы: верная и до трёх других выученных, непохожих по звуку; свои буквы урока — первыми. */
export function letterChoices(answer: string, lesson: number, rng: Rng = Math.random, size = 4): string[] {
  const own = lessonLetters(lesson)
  const others = distractorsFor(answer, lesson)
  const preferred = shuffle(others.filter(l => own.includes(l)), rng)
  const rest = shuffle(others.filter(l => !own.includes(l)), rng)
  return shuffle([answer, ...[...preferred, ...rest].slice(0, size - 1)], rng)
}

// ───────────── «Собери слово» ─────────────

export interface AssembleRound { word: Word; letters: string[]; tiles: string[] }

/** Слова для сборки: свои слова урока (2–8 букв), если их мало — из прошлых уроков. */
export function assembleRounds(lesson: number, count = 2, rng: Rng = Math.random, pool?: WordPool): AssembleRound[] {
  const n = clampLesson(lesson)
  const p = poolOf(n, pool)
  const ok = (w: Word) => { const len = [...w.geo].length; return len >= 2 && len <= 8 && !w.geo.includes(' ') }
  const own = shuffle(p.own.filter(ok), rng).sort((a, b) => Number(hasOwnLetter(b.geo, n)) - Number(hasOwnLetter(a.geo, n)))
  const older = shuffle(p.known.filter(w => !p.own.some(o => o.geo === w.geo) && ok(w)), rng)
  // Короткое слово первым — разогрев, потом подлиннее.
  const chosen = [...own, ...older].slice(0, count).sort((a, b) => [...a.geo].length - [...b.geo].length)
  return chosen.map(word => {
    const letters = [...word.geo]
    const spare = shuffle(learnedLetters(n).filter(l => !letters.includes(l) && letters.every(x => distractorsFor(x, n).includes(l))), rng)
    const extra = spare.slice(0, letters.length <= 3 ? 1 : 2)
    return { word, letters, tiles: shuffle([...letters, ...extra], rng) }
  })
}

// ───────────── Новые игры: «Поймай букву», «Звук → буква», «Пары» ─────────────

export interface CatchRound { target: string; bubbles: string[] }

/**
 * «Поймай букву»: в каждом раунде 3 пузыря с нужной буквой среди 8. Остальные — только уже показанные буквы
 * (прошлые уроки и letters) и непохожие по звуку: буквы, с которыми ещё не знакомили, не всплывают.
 */
export function catchRounds(letters: readonly string[], lesson: number, rng: Rng = Math.random): CatchRound[] {
  const shown = new Set([...(lesson > 1 ? learnedLetters(lesson - 1) : []), ...letters])
  return letters.map(target => {
    const others = distractorsFor(target, lesson).filter(l => shown.has(l))
    const pool = others.length ? others : [...shown].filter(l => l !== target)
    const fill = Array.from({ length: 5 }, (_, i) => pool[Math.floor(rng() * pool.length)] ?? pool[i % pool.length])
    return { target, bubbles: shuffle([target, target, target, ...fill], rng) }
  })
}

export interface SoundRound { letter: string; choices: string[] }

/** «Звук → буква»: звучит слово на букву — какая буква первая. Буквы урока, варианты — непохожие по звуку. */
export function soundRounds(lesson: number, rng: Rng = Math.random): SoundRound[] {
  return shuffle(lessonLetters(lesson), rng).map(letter => ({ letter, choices: letterChoices(letter, lesson, rng, 3) }))
}

export interface PairCard { id: string; pair: string; face: string; kind: 'geo' | 'ru' }

/** «Пары»: карточки буква ↔ её звук (или слово ↔ значение). Три пары, перемешаны. */
export function pairsDeck(kind: 'letters' | 'words', lesson: number, rng: Rng = Math.random, pool?: WordPool): PairCard[] {
  const p = poolOf(lesson, pool)
  const items: [string, string][] = kind === 'letters'
    ? lessonLetters(lesson).map(l => [l, `«${SOUNDS[l]?.plain ?? l}»`])
    : [...shuffle(p.own, rng), ...shuffle(p.known.filter(w => !p.own.some(o => o.geo === w.geo)), rng)]
      .filter((w, i, a) => a.findIndex(x => x.ru === w.ru) === i).slice(0, 3).map(w => [w.geo, w.ru])
  return shuffle(items.flatMap(([geo, ru], i) => [
    { id: `g${i}`, pair: `p${i}`, face: geo, kind: 'geo' as const },
    { id: `r${i}`, pair: `p${i}`, face: ru, kind: 'ru' as const }
  ]), rng)
}

// ───────────── Урок как цепочка игр ─────────────

export type LessonStep =
  | { kind: 'intro'; letter: string; index: number }
  | { kind: 'catch'; letters: string[] }
  | { kind: 'sound' }
  | { kind: 'pairs'; deck: 'letters' | 'words' }
  | { kind: 'words' }
  | { kind: 'morph' }
  | { kind: 'assemble' }
  | { kind: 'dialogue' }
  | { kind: 'cafe' }

/** Сколько вопросов-проверок в конце урока слов (короткий экзамен); в уроке букв — по вопросу на букву. */
export const EXAM_SIZE = 4

export type WordGame = 'morph' | 'assemble' | 'pairs' | 'dialogue' | 'cafe'

/**
 * Урок — цепочка коротких игр, в конце — короткая проверка.
 * Урок букв: знакомство с буквой, ещё одна, «Поймай букву», третья буква, «Пары» буква — звук (первый урок)
 * или «Звук → буква» (дальше).
 * Урок слов: каждое новое слово — своя сцена «Новое слово», потом 2–3 игры со словами; набор меняется от урока
 * к уроку (index — номер урока слов по порядку), берутся только игры, которым хватает слов (available).
 */
export function lessonSteps(lesson: { kind: 'letters' | 'words'; stage: number }, index: number, available: (g: WordGame) => boolean): LessonStep[] {
  const n = clampLesson(lesson.stage)
  if (lesson.kind === 'letters') {
    const ls = lessonLetters(n)
    return [
      { kind: 'intro', letter: ls[0], index: 0 },
      { kind: 'intro', letter: ls[1], index: 1 },
      { kind: 'catch', letters: ls.slice(0, 2) },
      { kind: 'intro', letter: ls[2], index: 2 },
      n === 1 ? { kind: 'pairs', deck: 'letters' } : { kind: 'sound' }
    ]
  }
  const ROTATION: WordGame[][] = [
    ['pairs', 'morph', 'dialogue'],
    ['assemble', 'dialogue', 'cafe'],
    ['morph', 'cafe', 'pairs'],
    ['dialogue', 'assemble', 'pairs'],
    ['cafe', 'morph', 'dialogue']
  ]
  const order = [...ROTATION[index % ROTATION.length], 'pairs', 'assemble', 'morph', 'dialogue'] as WordGame[]
  const games = [...new Set(order)].filter(available).slice(0, 3)
  const steps: LessonStep[] = [{ kind: 'words' }]
  for (const g of games) steps.push(g === 'pairs' ? { kind: 'pairs', deck: 'words' } : { kind: g })
  return steps
}
