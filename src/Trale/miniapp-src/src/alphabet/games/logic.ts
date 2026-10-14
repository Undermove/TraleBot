import { LESSON_COUNT, LESSON_LETTERS, LESSON_WORDS, RU_TO_GEO, RU_WORDS, SOUNDS } from './data'

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

// ───────────── Смешанные слова: «мама» → «მამა» ─────────────

/** Кусок слова: русская буква и грузинская, в которую она превращается (если уже выучена). */
export interface Piece { ru: string; geo: string | null }

/** Разбить русское слово на буквы и пометить, какие к уроку уже пишутся по-грузински. */
export function mixPieces(word: string, lesson: number): Piece[] {
  const n = clampLesson(lesson)
  const rules = RU_TO_GEO.filter(r => r.lesson <= n)
  const out: Piece[] = []
  const w = word.toLowerCase()
  for (let i = 0; i < w.length;) {
    const rule = rules.find(r => w.startsWith(r.ru, i))
    if (rule) { out.push({ ru: word.slice(i, i + rule.ru.length), geo: rule.geo }); i += rule.ru.length }
    else { out.push({ ru: word[i], geo: null }); i += 1 }
  }
  return out
}

/** Смешанное слово целиком: «мაмა». */
export const mixed = (word: string, lesson: number) => mixPieces(word, lesson).map(p => p.geo ?? p.ru).join('')

// ───────────── «Превращение» ─────────────

/** Русские слова для урока: в каждом есть буква этого урока и хотя бы две буквы, которые станут грузинскими. */
export function morphWords(lesson: number, count = 2, rng: Rng = Math.random): string[] {
  const own = new Set(lessonLetters(lesson))
  const fits = RU_WORDS.filter(w => {
    const ps = mixPieces(w, lesson)
    return ps.some(p => p.geo && own.has(p.geo)) && ps.filter(p => p.geo).length >= 2 && ps.length <= 8
  })
  // Сначала — слова, которые станут грузинскими почти целиком: так красивее финал.
  const score = (w: string) => { const ps = mixPieces(w, lesson); return ps.filter(p => p.geo).length / ps.length }
  const ranked = shuffle(fits, rng).sort((a, b) => score(b) - score(a))
  const top = ranked.slice(0, Math.max(count, Math.min(ranked.length, count * 3)))
  return shuffle(top, rng).slice(0, count)
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
export function assembleRounds(lesson: number, count = 2, rng: Rng = Math.random): AssembleRound[] {
  const n = clampLesson(lesson)
  const ok = (w: Word) => { const len = [...w.geo].length; return len >= 2 && len <= 8 && !w.geo.includes(' ') }
  const own = shuffle(wordsUpTo(n).filter(w => w.lesson === n && ok(w)), rng)
  const older = shuffle(wordsUpTo(n).filter(w => w.lesson !== n && ok(w)), rng)
  // Короткое слово первым — разогрев, потом подлиннее.
  const chosen = [...own, ...older].slice(0, count).sort((a, b) => [...a.geo].length - [...b.geo].length)
  return chosen.map(word => {
    const letters = [...word.geo]
    const spare = shuffle(learnedLetters(n).filter(l => !letters.includes(l) && letters.every(x => distractorsFor(x, n).includes(l))), rng)
    const extra = spare.slice(0, letters.length <= 3 ? 1 : 2)
    return { word, letters, tiles: shuffle([...letters, ...extra], rng) }
  })
}

// ───────────── План урока ─────────────

export type GameKind = 'morph' | 'assemble'

export interface LessonGamePlan {
  /** После какого по счёту вопроса (1-based) играть «Превращение». */
  midAfter: number
  mid: GameKind
  end: GameKind
}

/**
 * Игры урока алфавита: «Превращение» в середине — когда все три буквы урока уже показаны внутри русских
 * слов (после 6-го вопроса), и «Собери слово» в конце — из настоящих грузинских слов.
 */
export function lessonGamePlan(lesson: number, total: number): LessonGamePlan | null {
  if (lesson < 1 || lesson > LESSON_COUNT || total < 2) return null
  const midAfter = total >= 8 ? 6 : Math.max(1, Math.floor(total / 2))
  return { midAfter, mid: 'morph', end: 'assemble' }
}
