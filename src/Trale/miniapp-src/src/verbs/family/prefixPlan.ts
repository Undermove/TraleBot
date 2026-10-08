import type { TenseKey, VerbDto } from '../types'
import { shuffle, type Rng } from '../games/common'
import { STEP, type LadderItem, type Progress } from '../ladder/engine'
import { CAPS } from '../session/plan'
import type { PlannedScene, PlannedTask, SessionPlan, VerbLearningDto } from '../session/types'
import type { Direction, FamilyDto, FamilyMemberDto, FamilyMemberRef, Toward } from './types'

// Сессия про приставку — для глагола, который есть основной глагол семьи с приставкой направления.
// Окончания у него те же, что у основного (их человек уже сдал на экзамене), поэтому здесь не
// спрашивают окончания — спрашивают направление: по русской фразе выбрать слово с нужной приставкой
// и по слову сказать, куда идут. Чистая логика без React и сети; грузинских букв здесь нет.

/** Одноразовая отметка «вступление про приставки уже видел» (ui/hints.ts). */
export const PREFIX_INTRO_HINT = 'verb_prefix_intro'

/** Вопросов в игре и в проверке. Проверка — то же число, что на сервере: VerbLevelRules.PrefixCheckQuestions. */
export const PREFIX_ROUNDS = 6
export const PREFIX_CHECK_ROUNDS = 6
/** Вариантов ответа в раунде. */
const OPTIONS = 4
/** Секунд на раунд и на экран вступления — сессия должна уложиться в две минуты. */
const PACE = { round: 7, intro: 10 }

export interface PrefixRound {
  /** form — по русской фразе выбрать слово; direction — по слову выбрать направление. */
  kind: 'form' | 'direction'
  /** id глагола семьи, о котором спрашивают. */
  target: string
  /** Клетка таблицы: `время:лицо`. */
  cell: string
  /** id глаголов-вариантов, в порядке показа; target среди них. */
  options: string[]
}

/** Короткая сессия про приставку идёт, когда глагол — член семьи, а её основной глагол выучен. */
export const isPrefixSession = (learning: VerbLearningDto) =>
  learning.family?.role === 'member' && learning.family.baseLearned

const OPPOSITE: Partial<Record<Direction, Direction>> = { in: 'out', out: 'in', up: 'down', down: 'up' }
const otherWay = (t: Toward): Toward => (t === 'there' ? 'here' : 'there')

/** Тот же глагол «в другую сторону»: «наружу, туда» ↔ «наружу, сюда». */
export const twinOf = (m: FamilyMemberRef, all: FamilyMemberRef[]) =>
  all.find(o => o.id !== m.id && o.direction === m.direction && o.toward === otherWay(m.toward))

/** Противоположное направление: внутрь ↔ наружу, вверх ↔ вниз. */
export const oppositeOf = (m: FamilyMemberRef, all: FamilyMemberRef[]) =>
  all.find(o => o.direction === OPPOSITE[m.direction] && o.toward === m.toward)

/** С кем глагол легче всего спутать — сначала они, потом остальные. */
function rivals(m: FamilyMemberRef, all: FamilyMemberRef[], rng: Rng): FamilyMemberRef[] {
  const near = [twinOf(m, all), oppositeOf(m, all)].filter((x): x is FamilyMemberRef => !!x)
  const rest = shuffle(all.filter(o => o.id !== m.id && !near.includes(o)), rng)
  return [...near, ...rest]
}

/** Про кого вопрос (сам глагол или сосед по номеру: 0 — «в другую сторону», 1 — противоположное) и какого он вида. */
const ABOUT: ('me' | number)[] = ['me', 'me', 0, 'me', 1, 'me']
const KINDS: PrefixRound['kind'][] = ['form', 'direction', 'form', 'form', 'direction', 'form']

/** Времена, у которых русская фраза ни с чем не путается, и лица от частых к редким. */
const TENSES: TenseKey[] = ['present', 'aorist', 'future']
const PERSONS = [2, 0, 1, 5, 3, 4]

function cellsOf(verb: VerbDto): string[] {
  const out: string[] = []
  for (const person of PERSONS) for (const tense of TENSES) if (verb.tenses[tense]?.[person]?.length) out.push(`${tense}:${person}`)
  return out
}

function makeRounds(verb: VerbDto, count: number, skip: number, rng: Rng): PrefixRound[] {
  const all = verb.family!.members
  const me = all.find(m => m.id === verb.id)!
  const cells = cellsOf(verb)
  if (!cells.length || all.length < 2) return []
  const others = rivals(me, all, rng)
  // Четыре вопроса из шести — про сам глагол, два — про его соседей: иначе ответ всегда один и тот же.
  const targets = Array.from({ length: count }, (_, n) => (ABOUT[n % ABOUT.length] === 'me' ? me : others[(ABOUT[n % ABOUT.length] as number) % others.length]))
  return targets.map((target, n) => ({
    kind: KINDS[n % KINDS.length],
    target: target.id,
    cell: cells[(skip + n) % cells.length],
    options: shuffle([target, ...rivals(target, all, rng).slice(0, OPTIONS - 1)], rng).map(m => m.id)
  }))
}

/** Предсказуемая «случайность»: та же сессия планируется одинаково (как в session/plan.ts). */
function seeded(seed: number): Rng {
  let a = (seed + 1) * 0x9e3779b1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface PrefixPlanInput {
  verb: VerbDto
  learning: VerbLearningDto
  items: LadderItem[]
  progress: Progress
  /** Вступление уже показывали (отметка PREFIX_INTRO_HINT). */
  introSeen: boolean
}

/**
 * Сессия: повторение, если пора; вступление из урока о приставках — один раз и только тому, кто эти
 * уроки не прошёл; игра; проверка — пока глагол не выучен. Не дольше двух минут.
 */
export function planPrefixSession({ verb, learning, items, progress, introSeen }: PrefixPlanInput): SessionPlan {
  const family = verb.family!
  const rng = seeded(learning.memory.sessionsPlayed)
  const scenes: PlannedScene[] = []

  const due = items.filter(i => (progress[i.key]?.step ?? STEP.NEW) >= STEP.MASTERED && progress[i.key]?.due)
  if (due.length) {
    const tasks: PlannedTask[] = shuffle(due, rng).slice(0, CAPS.warmup).map(f => ({
      key: f.key,
      kind: learning.learner.canType && (progress[f.key]?.reviews ?? 0) % 2 === 1 ? 'type' : f.sentences.length ? 'gap' : 'form'
    }))
    scenes.push({ type: 'warmup', tasks, units: tasks.length, seconds: tasks.length * 8, typing: learning.learner.canType, reason: `due:${due.length}` })
  }

  if (!learning.family?.lessonDone && !introSeen) {
    // Число экранов знает сервер; на полоске вступление занимает один шаг.
    scenes.push({ type: 'prefixintro', familyId: family.id, units: 1, seconds: 3 * PACE.intro, typing: false, reason: 'prefix:intro-lesson-not-done' })
  }

  const played = learning.memory.sessionsPlayed * PREFIX_ROUNDS
  const play = makeRounds(verb, PREFIX_ROUNDS, played, rng)
  if (play.length) {
    scenes.push({ type: 'prefix', familyId: family.id, prefixRounds: play, units: play.length, seconds: play.length * PACE.round, typing: false, reason: 'prefix:play' })
  }
  if (learning.level !== 'learned') {
    const check = makeRounds(verb, PREFIX_CHECK_ROUNDS, played + PREFIX_ROUNDS, rng)
    if (check.length) {
      scenes.push({ type: 'prefixcheck', familyId: family.id, prefixRounds: check, units: check.length, seconds: check.length * PACE.round, typing: false, reason: 'prefix:check' })
    }
  }
  return { v: 1, scenes }
}

// ── Раунд на экране ──────────────────────────────────────────────────────────────────────────

export interface PrefixOption {
  member: FamilyMemberDto
  /** Слово этого глагола в клетке раунда. */
  form: string
  /** Что оно значит: «он выходит». */
  meaning: string
}

export interface ResolvedRound {
  kind: PrefixRound['kind']
  tense: TenseKey
  person: number
  target: PrefixOption
  options: PrefixOption[]
  /** То же лицо и время у основного глагола без направления: «он идёт» — к вопросу «куда?». */
  baseMeaning: string
}

/**
 * Раунд с формами из семьи. null — раунд сыграть нельзя (у глагола нет такой клетки или не из чего
 * выбирать): сцена его пропускает. Варианты, которые пишутся одинаково, сливаются в один.
 */
export function resolveRound(round: PrefixRound, family: FamilyDto): ResolvedRound | null {
  const [tense, personText] = round.cell.split(':') as [TenseKey, string]
  const person = Number(personText)
  const byId = new Map(family.members.map(m => [m.id, m]))
  const option = (id: string): PrefixOption | null => {
    const member = byId.get(id)
    const form = member?.tenses[tense]?.[person]?.[0]
    return member && form ? { member, form, meaning: member.meanings[tense]?.[person] ?? member.ru } : null
  }
  const target = option(round.target)
  if (!target) return null
  const seen = new Set<string>()
  const options: PrefixOption[] = []
  for (const id of round.options) {
    const o: PrefixOption | null = id === round.target ? target : option(id)
    if (!o || seen.has(o.form) || (o !== target && o.form === target.form)) continue
    seen.add(o.form)
    options.push(o)
  }
  if (!options.includes(target) || options.length < 2) return null
  return { kind: round.kind, tense, person, target, options, baseMeaning: option(family.baseId)?.meaning ?? family.baseName }
}

/** Строка вступления, разобранная на части; null — строка устроена иначе, показываем её как есть. */
export function parseIntroLine(line: string): { prefix: string; meaning: string; example: string; exampleRu: string } | null {
  const m = /^(\S+)- — (.+?): (\S+) \((.+)\)$/.exec(line)
  return m ? { prefix: m[1], meaning: m[2], example: m[3], exampleRu: m[4] } : null
}
