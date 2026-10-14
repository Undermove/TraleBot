import { cyr } from '../../verbs/types'
import { LESSON_COUNT, LESSON_LETTERS, LESSON_WORDS, RU_TO_GEO, SOUNDS } from './data'

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

/**
 * Смешанное слово как мост — пока в нём остаётся хоть одна русская буква. Русское слово целиком
 * грузинскими буквами («სახარ») не показываем: тогда null, и место занимает настоящее грузинское слово.
 */
export function mixedBridge(word: string, lesson: number): string | null {
  const m = mixed(word, lesson)
  return [...m].every(isGeorgian) ? null : m
}

// ───────────── Лестница слов ─────────────

/** Слова, которые ученик может прочитать к концу урока: настоящие грузинские, только из открытых букв. */
export const ladder = (lesson: number): Word[] => wordsUpTo(lesson).filter(w => readable(w.geo, lesson))

/** Есть ли в слове новая буква этого урока. */
export const hasOwnLetter = (geo: string, lesson: number) => lessonLetters(lesson).some(l => geo.includes(l))

// ───────────── «Превращение» ─────────────

/** Слово по буквам: как звучит каждая (кириллицей, как в транскрипции) и сама грузинская буква. */
export function morphPieces(geo: string): Piece[] {
  return [...geo].map(ch => ({ ru: cyr(ch), geo: ch }))
}

/**
 * Настоящие грузинские слова для «Превращения»: из открытых к уроку букв, 2–7 букв, сначала свои слова
 * урока и с новой буквой урока. На экране слово сначала написано кириллицей («дэда») — буквы по одной
 * становятся грузинскими (დედა), в конце — что оно значит.
 */
export function morphWords(lesson: number, count = 2, rng: Rng = Math.random): Word[] {
  const n = clampLesson(lesson)
  const ok = (w: Word) => { const len = [...w.geo].length; return len >= 2 && len <= 7 && !w.geo.includes(' ') }
  const score = (w: Word) => (w.lesson === n ? 2 : 0) + (hasOwnLetter(w.geo, n) ? 1 : 0)
  return shuffle(ladder(n).filter(ok), rng).sort((a, b) => score(b) - score(a)).slice(0, count)
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
  const own = shuffle(ladder(n).filter(w => w.lesson === n && ok(w)), rng).sort((a, b) => Number(hasOwnLetter(b.geo, n)) - Number(hasOwnLetter(a.geo, n)))
  const older = shuffle(ladder(n).filter(w => w.lesson !== n && ok(w)), rng)
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

export type MidGame = 'morph' | 'assemble'

export interface LessonGamePlan {
  /** После какого по счёту вопроса (1-based) играть игру в середине. */
  midAfter: number
  mid: MidGame
  end: 'cafe'
}

/**
 * Игры урока алфавита — ровно две, чтобы урок не стал длиннее: в середине (после 6-го вопроса, когда все
 * три буквы урока уже показаны) — «Превращение» в нечётных уроках и «Собери слово» в чётных; в конце
 * всегда «Кафе Бомборы».
 */
export function lessonGamePlan(lesson: number, total: number): LessonGamePlan | null {
  if (lesson < 1 || lesson > LESSON_COUNT || total < 2) return null
  const midAfter = total >= 8 ? 6 : Math.max(1, Math.floor(total / 2))
  return { midAfter, mid: lesson % 2 === 1 ? 'morph' : 'assemble', end: 'cafe' }
}

// ───────────── «Новое слово» ─────────────

export interface WordIntroPlan {
  /** Перед каким вопросом (0-based) показать знакомство со словами урока. */
  before: number
  /** Слова, с которыми знакомим отдельной сценой (2–3): сначала те, о которых спросят в уроке. */
  featured: Word[]
  /** Остальные слова урока — коротким списком «ещё слова, которые ты теперь можешь прочитать». */
  rest: Word[]
}

/**
 * Когда и с какими словами урока знакомить. Слово урока читается, только когда открыты все его буквы,
 * поэтому сцена идёт после знакомства со всеми буквами урока, но до первого вопроса о слове урока
 * и до игры в середине урока (игры тоже берут слова урока).
 */
export function wordIntroPlan(lesson: number, lemmas: readonly string[], midAfter: number | null, maxFeatured = 3): WordIntroPlan | null {
  const n = clampLesson(lesson)
  const own = wordsUpTo(n).filter(w => w.lesson === n)
  if (own.length === 0) return null
  const ownGeo = new Set(own.map(w => w.geo))
  const letters = lessonLetters(n)
  const lastLetter = Math.max(-1, ...letters.map(l => lemmas.indexOf(l)))
  const firstAsked = lemmas.findIndex(l => ownGeo.has(l))
  const limits = [firstAsked >= 0 ? firstAsked : lemmas.length, midAfter ?? lemmas.length]
  const before = Math.max(lastLetter + 1, Math.min(...limits))
  const asked = [...new Set(lemmas.filter(l => ownGeo.has(l)))].map(g => own.find(w => w.geo === g)!)
  const others = own.filter(w => !asked.includes(w)).sort((a, b) => Number(hasOwnLetter(b.geo, n)) - Number(hasOwnLetter(a.geo, n)))
  const featured = [...asked, ...others].slice(0, maxFeatured)
  return { before, featured, rest: own.filter(w => !featured.includes(w)) }
}
