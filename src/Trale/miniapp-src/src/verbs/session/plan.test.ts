import levelCases from '../../../../../../tests/Fixtures/verb-level-cases.json'
import { describe, expect, it } from 'vitest'
import { STEP, SOLID_STEP, KIND_CEILING, buildItems, settleCapped, introduce, type LadderItem, type Progress } from '../ladder/engine'
import { storyFixture } from '../story/fixture'
import { verbByLemma, verbRu } from '../testing/catalog'
import type { VerbDto } from '../types'
import { capabilities } from './context'
import { CAPS, EXAM_MIN, pastSessions, planSession, totalUnits, type PlanContext } from './plan'
import type { LearnerDto, PlannedScene, SceneType, VerbLevelKey, VerbMemoryDto } from './types'

// Постановщик сессии: таблица «ситуация ученика → сессия» и прогон многих сессий подряд.
// Глаголы — из настоящего каталога.

const WRITE = verbRu('писать')           // по образцу, полная таблица: все игры
const GO = verbByLemma('მიდის')           // особый, с комиксом
const WANT = verbRu('хотеть')            // неполный: части времён нет

const BEGINNER: LearnerDto = { level: 'beginner', canType: false, dictionarySize: 3, dictionaryVerbs: 1, verbsLearned: 0 }
const TYPIST: LearnerDto = { level: 'intermediate', canType: true, dictionarySize: 120, dictionaryVerbs: 14, verbsLearned: 3 }
const NO_MEMORY: VerbMemoryDto = { sessionsPlayed: 0, recentScenes: [], storyCompleted: false, examPassed: false }

// Копия правила уровня только для прогона: настоящее правило — на сервере (VerbLevelRules).
// Обе стороны проверяются одним набором случаев: tests/Fixtures/verb-level-cases.json.
function levelOf(cells: number, bestSteps: number[], exam: boolean): VerbLevelKey {
  if (exam) return 'learned'
  if (!cells || !bestSteps.length) return 'new'
  const solid = bestSteps.filter(s => s >= SOLID_STEP).length
  if (solid * 3 >= cells * 2) return 'examReady'
  if (solid * 3 >= cells) return 'phrases'
  return solid >= Math.min(2, cells) ? 'recognising' : 'meeting'
}

function context(verb: VerbDto, progress: Progress, patch: Partial<PlanContext> = {}): PlanContext {
  const items = buildItems(verb)
  const best = items.map(i => progress[i.key]?.best ?? 0).filter(Boolean)
  return {
    items, progress,
    level: levelOf(items.length, best, patch.memory?.examPassed ?? false),
    can: capabilities(verb, verb.id === GO.id ? [{ ...storyFixture, verbId: GO.id }] : []),
    learner: BEGINNER, memory: NO_MEMORY, ...patch
  }
}

/** Прогресс: первые n форм (в порядке знакомства) на ступени step. */
function known(verb: VerbDto, n: number, step: number, due = false): Progress {
  const progress: Progress = {}
  const items = buildItems(verb)
  // тот же порядок, в каком формы вводит постановщик
  const ordered = [...items].sort((a, b) => order(a) - order(b))
  for (const i of ordered.slice(0, n)) progress[i.key] = { step, best: step, reviews: 0, due }
  return progress
}
const FIRST = ['present', 'aorist', 'future']
const PERSON_RANK = [0, 2, 1, 3, 5, 4]
function order(i: LadderItem) {
  const person = PERSON_RANK.indexOf(i.person), first = FIRST.includes(i.tense)
  return (first ? (person < 3 ? 0 : 2) : person === 0 ? 1 : 3) * 1000 + person * 10
}

const last = <T,>(xs: T[]): T => xs[xs.length - 1]
const types = (scenes: PlannedScene[]) => scenes.map(s => s.type)
const seconds = (scenes: PlannedScene[]) => scenes.reduce((n, s) => n + s.seconds, 0)

describe('уровень: копия правила для прогона совпадает с серверной', () => {
  it.each(levelCases.cases)('$cells форм, начато $started на ступени $bestStep, экзамен $exam → $level', c => {
    expect(levelOf(c.cells, Array(c.started).fill(c.bestStep), c.exam)).toBe(c.level)
  })
})

describe('planSession: ситуация → сессия', () => {
  it('новый глагол без комикса: три формы «я» (сейчас, сделал, сделаю) и сразу игра с ними', () => {
    const plan = planSession(context(WRITE, {}))
    expect(types(plan.scenes)).toEqual(['meet', 'time'])
    const meet = plan.scenes[0]
    expect(meet.tasks!.filter(t => t.kind === 'intro').map(t => t.key)).toEqual(['present:0', 'aorist:0', 'future:0'])
    expect(meet.reason).toBe('new-verb:first-forms')
    expect(new Set(plan.scenes[1].targets)).toEqual(new Set(['present:0', 'aorist:0', 'future:0']))
  })

  it('новый глагол с комиксом: первая сессия начинается с комикса, знакомства отдельной сценой нет', () => {
    const plan = planSession(context(GO, {}))
    expect(plan.scenes[0]).toMatchObject({ type: 'story', storyId: storyFixture.id, units: storyFixture.frames.length, reason: 'new-verb:story-first' })
    expect(types(plan.scenes)).not.toContain('meet')
    expect(plan.scenes).toHaveLength(2)
  })

  it('комикс уже прочитан — его не предлагают снова', () => {
    const plan = planSession(context(GO, {}, { memory: { ...NO_MEMORY, storyCompleted: true } }))
    expect(types(plan.scenes)).not.toContain('story')
    expect(plan.scenes[0].type).toBe('meet')
  })

  it('неполный глагол без игр: знакомство и короткий выбор, без тупика', () => {
    const plan = planSession(context(WANT, {}))
    expect(plan.scenes[0].type).toBe('meet')
    expect(plan.scenes.length).toBeGreaterThan(0)
    for (const s of plan.scenes) expect(['meet', 'pick', 'phrases']).toContain(s.type)
  })

  it('пора повторить — повторение первым, короткой разминкой, а не стеной', () => {
    const progress = known(WRITE, 9, STEP.MASTERED, true)
    const plan = planSession(context(WRITE, progress, { learner: TYPIST }))
    expect(plan.scenes[0].type).toBe('warmup')
    expect(plan.scenes[0].units).toBeLessThanOrEqual(CAPS.warmup)
    expect(plan.scenes[0].reason).toBe('due:9')
    expect(plan.scenes.length).toBeGreaterThan(1)
  })

  it('начатые формы ещё не окрепли — новых не вводим, крепим начатое', () => {
    const plan = planSession(context(WRITE, known(WRITE, 6, STEP.MEANING)))
    expect(types(plan.scenes)).not.toContain('meet')
    expect(plan.scenes.length).toBeGreaterThan(0)
  })

  it('начатое окрепло — расширяемся: новые формы для «он», не больше трёх', () => {
    const plan = planSession(context(WRITE, known(WRITE, 3, SOLID_STEP), { memory: { ...NO_MEMORY, sessionsPlayed: 1, recentScenes: ['meet+time'] } }))
    const meet = plan.scenes.find(s => s.type === 'meet')!
    const intros = meet.tasks!.filter(t => t.kind === 'intro').map(t => t.key)
    expect(intros).toEqual(['present:2', 'aorist:2', 'future:2'])
    expect(meet.reason).toBe('widen:new-forms')
  })

  it('новичок без алфавита: ни в одной сцене не просят печатать', () => {
    for (const n of [0, 3, 12, 24, 36]) {
      const plan = planSession(context(WRITE, known(WRITE, n, SOLID_STEP)))
      for (const s of plan.scenes) {
        expect(s.typing, `${n} форм, сцена ${s.type}`).toBe(false)
        expect(s.tasks?.some(t => t.kind === 'type') ?? false).toBe(false)
      }
    }
  })

  it('печать появляется поздно: у того, кто умеет печатать, — только с уровня «собираю фразы»', () => {
    const early = planSession(context(WRITE, known(WRITE, 6, SOLID_STEP), { learner: TYPIST }))
    expect(early.scenes.every(s => !s.typing)).toBe(true)
    const late = [0, 1, 2, 3, 4].flatMap(played =>
      planSession(context(WRITE, known(WRITE, 14, STEP.TYPE), { learner: TYPIST, memory: { ...NO_MEMORY, sessionsPlayed: played } })).scenes)
    expect(late.some(s => s.typing)).toBe(true)
  })

  it('экзамен: только когда большинство форм окрепло, последней сценой, коротко', () => {
    expect(types(planSession(context(WRITE, known(WRITE, 23, SOLID_STEP))).scenes)).not.toContain('exam')

    const plan = planSession(context(WRITE, known(WRITE, 24, SOLID_STEP)))
    const exam = plan.scenes[plan.scenes.length - 1]
    expect(exam.type).toBe('exam')
    expect(exam.units).toBeGreaterThanOrEqual(EXAM_MIN)
    expect(exam.units).toBeLessThanOrEqual(CAPS.exam)
    expect(exam.tasks!.every(t => t.kind === 'form')).toBe(true)
    expect(new Set(exam.tasks!.map(t => t.key.split(':')[0])).size).toBeGreaterThan(2)
    expect(plan.scenes).toHaveLength(2)

    const typed = planSession(context(WRITE, known(WRITE, 24, SOLID_STEP), { learner: TYPIST }))
    expect(last(typed.scenes).tasks!.every(t => t.kind === 'type')).toBe(true)
  })

  it('экзамен сдан — его больше не предлагают, сессия короткая', () => {
    const plan = planSession(context(WRITE, known(WRITE, 36, STEP.MASTERED), { memory: { ...NO_MEMORY, examPassed: true, sessionsPlayed: 12 } }))
    expect(types(plan.scenes)).not.toContain('exam')
    expect(plan.scenes.length).toBeLessThanOrEqual(2)
    expect(plan.scenes.length).toBeGreaterThan(0)
  })

  it('конструктор — только у глаголов по образцу', () => {
    const memory = { ...NO_MEMORY, sessionsPlayed: 3 }
    for (let played = 0; played < 7; played++) {
      const plan = planSession(context(GO, known(GO, 12, SOLID_STEP), { memory: { ...memory, sessionsPlayed: played, storyCompleted: true } }))
      expect(types(plan.scenes)).not.toContain('builder')
    }
    const seen = new Set<SceneType>()
    for (let played = 0; played < 7; played++) {
      planSession(context(WRITE, known(WRITE, 12, SOLID_STEP), { memory: { ...memory, sessionsPlayed: played } })).scenes.forEach(s => seen.add(s.type))
    }
    expect(seen).toContain('builder')
  })

  it('не открывает сессию тем же, чем вчера, и не ставит один вид сцены дважды подряд', () => {
    const progress = known(WRITE, 12, SOLID_STEP)
    for (let played = 1; played < 8; played++) {
      const yesterday = planSession(context(WRITE, progress, { memory: { ...NO_MEMORY, sessionsPlayed: played - 1 } }))
      const memory = { ...NO_MEMORY, sessionsPlayed: played, recentScenes: [types(yesterday.scenes).join('+')] }
      const today = planSession(context(WRITE, progress, { memory }))
      expect(today.scenes[0].type, `сессия ${played}`).not.toBe(yesterday.scenes[0].type)
      expect(today.scenes[0].type).not.toBe(last(yesterday.scenes).type)
      types(today.scenes).forEach((t, i, all) => { if (i) expect(t).not.toBe(all[i - 1]) })
    }
  })

  it('у каждой сцены есть причина, а шаги полоски сходятся с заданиями', () => {
    const plan = planSession(context(WRITE, known(WRITE, 12, SOLID_STEP), { learner: TYPIST, memory: { ...NO_MEMORY, sessionsPlayed: 2 } }))
    for (const s of plan.scenes) {
      expect(s.reason).toMatch(/^[a-z-]+(:[a-z0-9-]+)?$/)
      if (s.tasks) expect(s.units).toBe(s.tasks.length)
      expect(s.units).toBeGreaterThan(0)
    }
    expect(totalUnits(plan)).toBe(plan.scenes.reduce((n, s) => n + s.units, 0))
  })
})

// ── Прогон: ученик проходит сессию за сессией ────────────────────────────────

interface Sim { progress: Progress; memory: VerbMemoryDto; sessions: PlannedScene[][] }

/** Сыграть сцену так, как её засчитает приложение, когда на всё отвечают верно. */
function play(scene: PlannedScene, items: LadderItem[], progress: Progress) {
  const byKey = new Map(items.map(i => [i.key, i]))
  const apply = (key: string, ceiling: number, introduceNew = false) => {
    const item = byKey.get(key)!
    const next = settleCapped(item, progress[key], true, ceiling, introduceNew)
    if (next) progress[key] = next
  }
  for (const t of scene.tasks ?? []) {
    if (t.kind === 'intro') { if (!progress[t.key]) progress[t.key] = introduce() } else apply(t.key, KIND_CEILING[t.kind])
  }
  for (const key of scene.targets ?? []) apply(key, SOLID_STEP)
  if (scene.type === 'story') storyFixture.frames.forEach(f => apply(`${f.target.tense}:${f.target.person}`, SOLID_STEP, true))
}

function simulate(verb: VerbDto, learner: LearnerDto, max: number): Sim {
  const items = buildItems(verb)
  const sim: Sim = { progress: {}, memory: { ...NO_MEMORY }, sessions: [] }
  for (let n = 0; n < max; n++) {
    const ctx = context(verb, sim.progress, { learner, memory: sim.memory })
    const plan = planSession(ctx)
    sim.sessions.push(plan.scenes)
    const startedBefore = Object.keys(sim.progress).length
    plan.scenes.forEach(s => play(s, items, sim.progress))

    // Инварианты каждой сессии.
    expect(plan.scenes.length, `сессия ${n}: пустая`).toBeGreaterThan(0)
    expect(plan.scenes.length).toBeLessThanOrEqual(CAPS.scenes)
    expect(seconds(plan.scenes), `сессия ${n}: ${types(plan.scenes)}`).toBeLessThanOrEqual(CAPS.seconds)
    types(plan.scenes).forEach((t, i, all) => { if (i) expect(t, `сессия ${n}: подряд`).not.toBe(all[i - 1]) })
    const introduced = Object.keys(sim.progress).length - startedBefore
    if (!types(plan.scenes).includes('story')) expect(introduced, `сессия ${n}: новых форм`).toBeLessThanOrEqual(CAPS.newForms)
    if (types(plan.scenes).includes('exam')) {
      expect(ctx.level).toBe('examReady')
      expect(last(plan.scenes).type).toBe('exam')
    }
    if (!learner.canType) expect(plan.scenes.some(s => s.typing)).toBe(false)

    const passed = types(plan.scenes).includes('exam')
    sim.memory = {
      sessionsPlayed: n + 1,
      recentScenes: [...sim.memory.recentScenes, types(plan.scenes).join('+')].slice(-6),
      storyCompleted: sim.memory.storyCompleted || types(plan.scenes).includes('story'),
      examPassed: sim.memory.examPassed || passed
    }
    if (passed) break
  }
  return sim
}

describe('planSession: прогон от нового глагола до экзамена', () => {
  it.each([
    ['писать, новичок', WRITE, BEGINNER],
    ['писать, умеет печатать', WRITE, TYPIST],
    ['идти (с комиксом), новичок', GO, BEGINNER],
    ['хотеть (неполный), новичок', WANT, BEGINNER]
  ] as const)('%s: доходит до экзамена, не нарушая потолков', (_name, verb, learner) => {
    const sim = simulate(verb, learner, 40)
    const all = sim.sessions.map(types)
    expect(sim.memory.examPassed, `сессий сыграно: ${all.length}`).toBe(true)
    // Экзамен — поздно: сначала несколько обычных сессий.
    expect(all.findIndex(s => s.includes('exam'))).toBeGreaterThanOrEqual(Math.min(3, Math.ceil(buildItems(verb).length / 6)))
    // Первая сессия — узнавание, без печати и экзамена.
    expect(['meet', 'story']).toContain(all[0][0])
  })

  it('полный глагол по образцу: за прогон встречаются все его игры и фразы', () => {
    const seen = new Set(simulate(WRITE, TYPIST, 40).sessions.flatMap(types))
    for (const t of ['meet', 'time', 'bones', 'builder', 'phrases', 'exam'] as SceneType[]) expect(seen, t).toContain(t)
  })

  it('память о прошлых сессиях читается как списки сцен', () => {
    expect(pastSessions({ ...NO_MEMORY, recentScenes: ['meet+time', 'pick', ''] })).toEqual([['meet', 'time'], ['pick']])
  })
})

// Глагол, который составила модель и одобрила вторая: таблица и русские фразы есть, живых
// предложений нет, одна клетка пустая («не уверена — оставь пустой»). Формы — каталожного «писать».
describe('planSession: a model-made verb', () => {
  const tenses = { ...WRITE.tenses, optative: WRITE.tenses.optative!.map((cell, person) => (person === 4 ? [] : cell)) }
  const MADE = verbRu('писать', { status: 'generated', source: null, sentences: [], tenses })

  it('is learned like any other: every filled cell is an item with its plain meaning', () => {
    const items = buildItems(MADE)
    expect(items).toHaveLength(35)
    expect(items.some(i => i.key === 'optative:4')).toBe(false)
    expect(items.every(i => i.meaning.text)).toBe(true)
  })

  it('gets sessions at every stage, and never a task that needs a real sentence', () => {
    for (const [n, step] of [[0, STEP.NEW], [6, STEP.MEANING], [18, SOLID_STEP], [35, STEP.MASTERED]] as const) {
      for (const learner of [BEGINNER, TYPIST]) {
        const plan = planSession(context(MADE, known(MADE, n, step), { learner }))
        expect(plan.scenes.length).toBeGreaterThan(0)
        const kinds = plan.scenes.flatMap(s => s.tasks ?? []).map(t => t.kind)
        expect(kinds).not.toContain('gap')
        expect(kinds).not.toContain('build')
        expect(plan.scenes.map(s => s.type)).not.toContain('story')
      }
    }
  })

  it('skips the bone field row that has an empty cell, as for a partial verb', () => {
    expect(capabilities(MADE, []).boneRows).not.toContain('optative')
    expect(capabilities(MADE, []).boneRows.length).toBeGreaterThan(0)
  })
})
