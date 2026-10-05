import type { TenseKey } from '../types'
import { STEP, SOLID_STEP, introOrder, type LadderItem, type Progress } from '../ladder/engine'
import { STOPS } from '../games/timeRounds'
import type { LearnerDto, PlannedScene, PlannedTask, SceneType, SessionPlan, VerbLevelKey, VerbMemoryDto } from './types'

// Постановщик сессии: чистая функция без React и сети. По тому, что человек уже знает про глагол и
// что вообще умеет, собирает 2–3 минуты игры из коротких сцен. Человек вид игры не выбирает.
//
// Кривая: новый глагол начинается с узнавания нескольких форм («я»: сейчас, сделал, сделаю), потом
// расширяется по лицам и временам, потом — фразы и сборка, в конце — печать и экзамен.
// Пора повторить — повторение идёт первым, короткой разминкой.

/** Жёсткие потолки: сессия не должна вырасти в «лесенку на 36 вопросов». */
export const CAPS = {
  scenes: 3,
  /** Новых форм за сессию. */
  newForms: 3,
  /** Раундов в сцене. */
  pick: 5, time: 5, builder: 3, phrases: 4, warmup: 4, exam: 8,
  /** Поле «Косточек»: строк и столбцов. */
  boneRows: 3, boneCols: 3,
  /** Сессия длится не дольше трёх минут. */
  seconds: 180
} as const

/** Экзамен короче не бывает (или все формы, если у глагола их меньше) — то же число на сервере: VerbLevelRules.ExamMinQuestions. */
export const EXAM_MIN = 6

/** Сколько начатых, но не окрепших форм можно держать в работе, прежде чем знакомить с новыми. */
const MAX_UNSOLID = 3

/** Примерная длительность одного шага сцены, секунды. */
const PACE = { intro: 5, choice: 5, time: 6, dig: 6, digTyped: 10, builder: 12, gap: 8, build: 12, type: 10, frame: 12 } as const

export interface StoryInfo {
  id: string
  frames: number
  /** Клетки (`время:лицо`) форм, которые звучат в комиксе. */
  forms: string[]
}

export interface PlanContext {
  /** Главные формы глагола (engine.buildItems). */
  items: LadderItem[]
  progress: Progress
  /** Уровень глагола — с сервера. */
  level: VerbLevelKey
  /** Что глагол поддерживает. */
  can: {
    time: boolean
    /** Времена, которые годятся в строки поля «Косточек» (есть все шесть лиц). */
    boneRows: TenseKey[]
    builder: boolean
    story: StoryInfo | null
  }
  learner: LearnerDto
  memory: VerbMemoryDto
}

const cell = (tense: TenseKey, person: number) => `${tense}:${person}`
const STOP_TENSES = STOPS.map(s => s.tense)

/** Прошлые сессии как списки сцен. */
export function pastSessions(memory: VerbMemoryDto): SceneType[][] {
  return memory.recentScenes.map(s => s.split('+').filter(Boolean) as SceneType[]).filter(s => s.length)
}

/** Предсказуемая «случайность»: одна и та же сессия планируется одинаково, разные — по-разному. */
function seeded(seed: number) {
  let a = (seed + 1) * 0x9e3779b1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function planSession(ctx: PlanContext): SessionPlan {
  const { items, can, learner, memory, level } = ctx
  const rng = seeded(memory.sessionsPlayed)
  // «Как будто уже познакомились»: формы, которые сессия введёт, для следующих сцен считаются начатыми.
  const steps = new Map(items.map(i => [i.key, ctx.progress[i.key]?.step ?? STEP.NEW]))
  const step = (i: LadderItem) => steps.get(i.key) ?? STEP.NEW

  const started = () => items.filter(i => step(i) > STEP.NEW)
  const inPlay = () => started().filter(i => step(i) < STEP.MASTERED)
  const fresh = () => introOrder(items).filter(i => step(i) === STEP.NEW)
  const unsolid = () => started().filter(i => step(i) < SOLID_STEP)
  const weakestFirst = (xs: LadderItem[]) => [...xs].sort((a, b) => step(a) - step(b))
  const due = items.filter(i => step(i) >= STEP.MASTERED && ctx.progress[i.key]?.due)

  const advanced = level === 'phrases' || level === 'examReady' || level === 'learned'
  const typing = learner.canType && advanced

  // ── Сцены ────────────────────────────────────────────────────────────────

  const quiz = (type: SceneType, tasks: PlannedTask[], reason: string, canType = false): PlannedScene => ({
    type, tasks, units: tasks.length, typing: canType, reason,
    seconds: tasks.reduce((n, t) => n + (t.kind === 'intro' ? PACE.intro : t.kind === 'gap' ? PACE.gap
      : t.kind === 'build' ? PACE.build : t.kind === 'type' ? PACE.type : PACE.choice), 0)
  })

  function meet(): PlannedScene | null {
    const forms = fresh().slice(0, CAPS.newForms)
    if (!forms.length) return null
    const [a, b, c] = forms.map(f => f.key)
    // Показать — и сразу спросить: сначала «что это значит», потом «как сказать».
    const order: [PlannedTask['kind'], string | undefined][] = [
      ['intro', a], ['intro', b], ['meaning', a], ['meaning', b], ['intro', c], ['meaning', c], ['form', a], ['form', b], ['form', c]
    ]
    forms.forEach(f => steps.set(f.key, STEP.MEANING))
    const first = !items.some(i => (ctx.progress[i.key]?.step ?? STEP.NEW) > STEP.NEW)
    return quiz('meet', order.filter(([, key]) => key).map(([kind, key]) => ({ kind, key: key! })),
      first ? 'new-verb:first-forms' : 'widen:new-forms')
  }

  function pick(): PlannedScene | null {
    const pool = inPlay().length ? weakestFirst(inPlay()) : shuffled(started(), rng)
    const forms = pool.slice(0, CAPS.pick)
    if (!forms.length) return null
    return quiz('pick', forms.map(f => ({
      key: f.key,
      kind: step(f) <= STEP.MEANING ? 'meaning' : typing && step(f) >= STEP.BUILD ? 'type' : 'form'
    })), inPlay().length ? 'consolidate:weakest-forms' : 'keep-fresh:known-forms', typing)
  }

  function time(): PlannedScene | null {
    if (!can.time) return null
    const pool = weakestFirst(started().filter(i => STOP_TENSES.includes(i.tense)))
    const forms = pool.slice(0, CAPS.time)
    if (forms.length < 2) return null
    // Мало форм — проходим их дважды, но не одну и ту же подряд.
    const rounds = forms.length >= 4 ? shuffled(forms, rng) : [...forms, ...forms].slice(0, 4)
    return {
      type: 'time', targets: rounds.map(f => f.key), units: rounds.length, seconds: rounds.length * PACE.time,
      typing: false, reason: `recognise:${new Set(forms.map(f => f.person)).size}-persons`
    }
  }

  function bones(): PlannedScene | null {
    if (level === 'new' || level === 'meeting') return null
    const windows = [[0, 1, 2], [3, 4, 5]].map(persons => {
      const tenses = [...can.boneRows]
        .sort((a, b) => known(b, persons) - known(a, persons))
        .slice(0, CAPS.boneRows)
      return { persons, tenses, known: tenses.reduce((n, t) => n + known(t, persons), 0) }
    })
    const field = windows[1].known > windows[0].known ? windows[1] : windows[0]
    // Поле — про знакомое: если на нём меньше половины начатых форм, это не игра, а угадайка.
    if (field.tenses.length < 2 || field.known * 2 < field.tenses.length * CAPS.boneCols) return null
    const cells = field.tenses.length * CAPS.boneCols
    return {
      type: 'bones', tenses: order(field.tenses), persons: field.persons, units: cells,
      seconds: Math.round(cells * 0.7) * (typing ? PACE.digTyped : PACE.dig), typing, reason: `produce:field-${field.tenses.length}x${CAPS.boneCols}`
    }
  }
  function known(tense: TenseKey, persons: number[]) {
    return persons.filter(p => (steps.get(cell(tense, p)) ?? STEP.NEW) > STEP.NEW).length
  }
  /** Строки поля — в привычном порядке карточки. */
  const order = (tenses: TenseKey[]) => can.boneRows.filter(t => tenses.includes(t))

  function builder(): PlannedScene | null {
    if (!can.builder || level === 'new' || level === 'meeting' || started().length < 3) return null
    const solvedBefore = level === 'recognising' ? 0 : level === 'phrases' ? 3 : 6
    return {
      type: 'builder', rounds: CAPS.builder, solvedBefore, units: CAPS.builder, seconds: CAPS.builder * PACE.builder,
      typing: false, reason: `assemble:stage-${solvedBefore / 3 + 1}`
    }
  }

  function phrases(): PlannedScene | null {
    const pool = weakestFirst(started().filter(i => step(i) >= STEP.FORM && i.sentences.length))
    const forms = pool.slice(0, CAPS.phrases)
    if (!forms.length) return null
    return quiz('phrases', forms.map((f, n) => ({
      key: f.key,
      // Собирать фразу — позже и через раз: это самое долгое задание.
      kind: advanced && f.buildable.length && step(f) >= SOLID_STEP && n % 2 === 1 ? 'build' : 'gap'
    })), 'real-sentences')
  }

  function story(): PlannedScene | null {
    if (!can.story || memory.storyCompleted) return null
    const first = !started().length
    can.story.forms.forEach(key => { if ((steps.get(key) ?? STEP.NEW) === STEP.NEW && steps.has(key)) steps.set(key, STEP.MEANING) })
    return {
      type: 'story', storyId: can.story.id, units: can.story.frames, seconds: can.story.frames * PACE.frame,
      typing: false, reason: first ? 'new-verb:story-first' : 'story:not-read-yet'
    }
  }

  function warmup(): PlannedScene {
    const forms = shuffled(due, rng).slice(0, CAPS.warmup)
    return quiz('warmup', forms.map(f => ({
      key: f.key,
      kind: learner.canType && (ctx.progress[f.key]?.reviews ?? 0) % 2 === 1 ? 'type' : f.sentences.length ? 'gap' : 'form'
    })), `due:${due.length}`, learner.canType)
  }

  function exam(): PlannedScene {
    // По одной форме из разных мест таблицы, а не шесть лиц одного времени.
    const pool = introOrder(items)
    const count = Math.min(CAPS.exam, Math.max(Math.min(EXAM_MIN, pool.length), Math.round(pool.length / 3)))
    const stride = pool.length / count
    const forms = Array.from({ length: count }, (_, n) => pool[Math.floor(n * stride)])
    return quiz('exam', forms.map(f => ({ key: f.key, kind: learner.canType ? 'type' : 'form' })), 'exam:most-forms-solid', learner.canType)
  }

  // ── Сборка ───────────────────────────────────────────────────────────────

  const past = pastSessions(memory)
  const lastSession = past[past.length - 1] ?? []
  const lastScene = lastSession[lastSession.length - 1] ?? null
  const lastOpening = lastSession[0] ?? null

  const scenes: PlannedScene[] = []
  const seconds = () => scenes.reduce((n, s) => n + s.seconds, 0)
  const previous = () => scenes[scenes.length - 1]?.type ?? lastScene
  const introducing = () => scenes.some(s => s.type === 'meet' || s.type === 'story')

  if (due.length) scenes.push(warmup())

  const examOffered = level === 'examReady' && !memory.examPassed
  const examScene = examOffered ? exam() : null
  const budget = CAPS.seconds - (examScene?.seconds ?? 0)
  // Перед экзаменом — одна сцена для разгона; выученный глагол — короткая сессия «не забыть».
  const firstContact = started().length === 0
  // Первая встреча — две сцены: познакомиться и сразу сыграть с тем же (третья была бы тем же по третьему разу).
  const slots = examOffered ? Math.min(CAPS.scenes - 1, scenes.length + 1) : level === 'learned' || firstContact ? 2 : CAPS.scenes

  const makers: Record<string, () => PlannedScene | null> = { meet, pick, time, bones, builder, phrases, story }
  let wanted: string[]
  if (firstContact) {
    // Новый глагол: комикс, если он есть, — естественное начало; иначе три первые формы и игра с ними.
    wanted = can.story && !memory.storyCompleted ? ['story', 'time', 'pick'] : ['meet', 'time', 'pick']
  } else {
    const byLevel: Record<VerbLevelKey, string[]> = {
      new: ['meet', 'time', 'pick', 'story', 'phrases'],
      meeting: ['meet', 'time', 'pick', 'story', 'phrases'],
      recognising: ['meet', 'time', 'bones', 'phrases', 'builder', 'story', 'pick'],
      phrases: ['phrases', 'builder', 'bones', 'meet', 'time', 'story', 'pick'],
      examReady: ['builder', 'phrases', 'bones', 'time', 'pick'],
      learned: ['time', 'bones', 'builder', 'phrases', 'pick']
    }
    const base = byLevel[level]
    // Каждую сессию начинаем с другого места списка — чтобы день не был похож на вчерашний.
    const turn = memory.sessionsPlayed % base.length
    wanted = [...base.slice(turn), ...base.slice(0, turn)]
    // Знакомить с новым — только когда начатое окрепло; но если крепить нечего, новое идёт первым.
    const canMeet = fresh().length > 0 && unsolid().length <= MAX_UNSOLID && level !== 'examReady' && level !== 'learned'
    wanted = wanted.filter(t => t !== 'meet' || canMeet)
    if (canMeet && unsolid().length <= 1) wanted = ['meet', ...wanted.filter(t => t !== 'meet')]
  }

  /** Один проход по списку желаемых сцен; strict — соблюдая «не как вчера». */
  function fill(strict: boolean) {
    const queue = [...wanted]
    // Сцена, которой вчера открывали сессию, сегодня идёт второй, а не теряется.
    const held: string[] = []
    while (queue.length && scenes.length < slots) {
      const type = queue.shift()!
      if (scenes.some(s => s.type === type)) continue
      if (strict && !scenes.length && type === lastOpening) { held.push(type); continue }
      if (type === previous()) { if (!scenes.length) held.push(type); continue }
      // За сессию — один источник новых форм: либо знакомство, либо комикс.
      if ((type === 'meet' || type === 'story') && introducing()) continue
      const before = new Map(steps)
      const scene = makers[type]()
      if (scene && seconds() + scene.seconds <= budget) {
        scenes.push(scene)
        queue.unshift(...held.splice(0))
      } else before.forEach((v, k) => steps.set(k, v))
    }
  }
  fill(true)
  if (scenes.length < slots) fill(false)
  // Совсем нечего предложить (всё выучено, игр у глагола нет) — короткий квиз по знакомому: тупика не бывает.
  if (!scenes.length) {
    const fallback = pick() ?? meet()
    if (fallback) scenes.push(fallback)
  }

  if (examScene) scenes.push(examScene)
  return { v: 1, scenes }
}

/** Сколько шагов в сессии — знаменатель полоски. */
export const totalUnits = (plan: SessionPlan) => plan.scenes.reduce((n, s) => n + s.units, 0)
