import { describe, it, expect } from 'vitest'
import { CARD_TENSES } from '../types'
import {
  BUILD_WORDS, MAX_IN_PLAY, PERSON_ORDER, SESSION_NEW, SOLID_STEP, STEP,
  afterTask, buildItems, checkBuild, distractors, findForm, introduce, nextTask, remaining, settle, startSession,
  taskStep, tokens, withGap,
  type FormState, type LadderItem, type Progress, type Session, type Task
} from './engine'
import { catalogVerb, catalogVerbs, seeded } from './testCatalog'

// Формы и фразы — из настоящего каталога (src/Trale/Verbs/verbs.json).
const write = buildItems(catalogVerb(0))
const withoutSentences = catalogVerbs.map(buildItems).find(items => items.every(i => !i.sentences.length))!
const withTwins = catalogVerbs.map(buildItems).find(items => new Set(items.map(i => i.form)).size < items.length)!

const state = (step: number, extra: Partial<FormState> = {}): FormState => ({ step, best: step, reviews: 0, due: false, ...extra })
const active = (items: LadderItem[], p: Progress) => items.filter(i => p[i.key] && p[i.key].step < STEP.MASTERED)

/** Проходит один заход: answer решает, верно ли ответили на задание. Возвращает прогресс и все показанные задания. */
function playSession(
  items: LadderItem[], start: Progress, rng: () => number, answer: (task: Task) => boolean = () => true,
  watch: (task: Task, progress: Progress, session: Session) => void = () => {}
) {
  let progress = { ...start }
  let session = startSession(items, progress)
  const seen: Task[] = []
  for (let guard = 0; guard < 5000; guard++) {
    const task = nextTask(items, progress, session, rng)
    watch(task, progress, session)
    seen.push(task)
    if (task.type === 'done') return { progress, seen, session }
    progress = {
      ...progress,
      [task.item.key]: task.type === 'intro' ? introduce() : settle(task.item, progress[task.item.key], answer(task))
    }
    session = afterTask(session, task)
  }
  throw new Error('заход не закончился')
}

describe('порядок форм', () => {
  it('сначала шесть главных времён для «я», потом для остальных лиц', () => {
    expect(write.slice(0, 6).map(i => i.key)).toEqual(CARD_TENSES.map(t => `${t}:0`))
    expect(write.slice(6, 12).every(i => i.person === PERSON_ORDER[1])).toBe(true)
    expect(write).toHaveLength(36)
  })

  it('пустые клетки таблицы в лесенку не попадают', () => {
    for (const verb of catalogVerbs) {
      const cells = CARD_TENSES.flatMap(t => (verb.tenses[t] ?? []).filter(v => v.length))
      expect(buildItems(verb)).toHaveLength(cells.length)
    }
    expect(catalogVerbs.some(v => buildItems(v).length < 36)).toBe(true)
  })

  it('фраза привязана к форме, только если форма стоит в ней отдельным словом', () => {
    for (const item of catalogVerbs.flatMap(buildItems)) {
      for (const s of item.sentences) {
        expect(item.variants).toContain(s.form)
        expect(tokens(s.ka)).toContain(s.form)
      }
      for (const s of item.buildable) {
        expect(tokens(s.ka).length).toBeGreaterThanOrEqual(BUILD_WORDS.min)
        expect(tokens(s.ka).length).toBeLessThanOrEqual(BUILD_WORDS.max)
      }
    }
  })
})

describe('ступени', () => {
  const full = write.find(i => i.buildable.length)!
  const bare = withoutSentences[0]

  it('форма с живой фразой проходит все пять заданий', () => {
    const path: number[] = [STEP.MEANING]
    let s = introduce()
    while (s.step < STEP.MASTERED) { s = settle(full, s, true); path.push(s.step) }
    expect(path).toEqual([STEP.MEANING, STEP.FORM, STEP.GAP, STEP.BUILD, STEP.TYPE, STEP.MASTERED])
  })

  it('у формы без фраз задания с фразой пропускаются', () => {
    const path: number[] = [STEP.MEANING]
    let s = introduce()
    while (s.step < STEP.MASTERED) { s = settle(bare, s, true); path.push(s.step) }
    expect(path).toEqual([STEP.MEANING, STEP.FORM, STEP.TYPE, STEP.MASTERED])
  })

  it('ошибка опускает на одну доступную ступень и не трогает лучший результат', () => {
    expect(settle(full, state(STEP.BUILD), false)).toMatchObject({ step: STEP.GAP, best: STEP.BUILD })
    expect(settle(bare, state(STEP.TYPE), false)).toMatchObject({ step: STEP.FORM, best: STEP.TYPE })
  })

  it('ниже первой ступени форма не падает', () => {
    expect(settle(full, state(STEP.MEANING), false).step).toBe(STEP.MEANING)
  })

  it('сохранённая ступень, для которой фраз больше нет, спрашивается следующей доступной', () => {
    expect(taskStep(bare, STEP.GAP)).toBe(STEP.TYPE)
    expect(settle(bare, state(STEP.GAP), true).step).toBe(STEP.MASTERED)
  })

  it('верное повторение выученной формы считается, неверное возвращает её в работу', () => {
    const mastered = state(STEP.MASTERED, { due: true, reviews: 1 })

    expect(settle(full, mastered, true)).toEqual({ step: STEP.MASTERED, best: STEP.MASTERED, reviews: 2, due: false })
    expect(settle(full, mastered, false)).toEqual({ step: STEP.TYPE, best: STEP.MASTERED, reviews: 1, due: false })
  })
})

describe('какое задание следующее', () => {
  it('новичку сначала показывают первую форму, потом спрашивают её же', () => {
    const session = startSession(write, {})
    const intro = nextTask(write, {}, session, seeded(1))
    expect(intro).toMatchObject({ type: 'intro', item: { key: 'present:0' } })

    const progress = { 'present:0': introduce() }
    const next = nextTask(write, progress, afterTask(session, intro), seeded(1))
    expect(next).toMatchObject({ type: 'meaning', item: { key: 'present:0' }, review: false })
  })

  it('новая форма появляется, только когда формы в работе окрепли, и в работе их не больше трёх', () => {
    for (const seed of [1, 2, 3]) {
      const mistakes = seeded(seed * 7)
      playSession(write, {}, seeded(seed), () => mistakes() > 0.2, (task, progress) => {
        const inPlay = active(write, progress)
        expect(inPlay.length).toBeLessThanOrEqual(MAX_IN_PLAY)
        if (task.type === 'intro') {
          expect(inPlay.length).toBeLessThan(MAX_IN_PLAY)
          expect(inPlay.every(i => progress[i.key].step >= SOLID_STEP)).toBe(true)
        }
      })
    }
  })

  it('формы вводятся в порядке лесенки', () => {
    const { seen } = playSession(write, {}, seeded(5))
    const intros = seen.filter(t => t.type === 'intro').map(t => (t as { item: LadderItem }).item.key)
    expect(intros).toEqual(write.slice(0, SESSION_NEW).map(i => i.key))
  })

  it('одну и ту же форму не спрашивают два раза подряд, если в работе есть другая', () => {
    const progress = { [write[0].key]: state(STEP.FORM), [write[1].key]: state(STEP.FORM) }
    const session = { ...startSession(write, progress), last: write[0].key }
    for (let seed = 0; seed < 20; seed++) {
      const task = nextTask(write, progress, session, seeded(seed))
      expect(task).toMatchObject({ item: { key: write[1].key } })
    }
  })

  it('после ошибки форму спрашивают снова не позже чем через одно задание', () => {
    const progress: Progress = { [write[0].key]: state(STEP.GAP), [write[1].key]: state(STEP.GAP), [write[2].key]: state(STEP.TYPE) }
    let session: Session = { ...startSession(write, progress), introduced: SESSION_NEW }
    const failed = nextTask(write, progress, session, seeded(3)) as Extract<Task, { type: 'gap' }>
    const after = { ...progress, [failed.item.key]: settle(failed.item, progress[failed.item.key], false) }
    session = afterTask(session, failed)

    const one = nextTask(write, after, session, seeded(3)) as Extract<Task, { type: 'gap' }>
    const two = nextTask(write, { ...after, [one.item.key]: settle(one.item, after[one.item.key], true) }, afterTask(session, one), seeded(3))

    expect(one.item.key).not.toBe(failed.item.key)
    expect(two).toMatchObject({ type: 'form', item: { key: failed.item.key } })
  })

  it('заход заканчивается, когда введённые в нём формы выучены, а новые оставляет на потом', () => {
    const { progress, seen } = playSession(write, {}, seeded(9))
    const learned = write.filter(i => progress[i.key]?.step === STEP.MASTERED)

    expect(seen[seen.length - 1]).toEqual({ type: 'done', reason: 'session' })
    expect(learned.map(i => i.key)).toEqual(write.slice(0, SESSION_NEW).map(i => i.key))
  })

  it('когда выучено всё и повторять нечего, игра говорит об этом', () => {
    const progress = Object.fromEntries(write.map(i => [i.key, state(STEP.MASTERED)]))

    expect(nextTask(write, progress, startSession(write, progress))).toEqual({ type: 'done', reason: 'all' })
  })

  it('за несколько заходов с ошибками выучивается любой глагол каталога', () => {
    for (const [index, verb] of catalogVerbs.entries()) {
      const items = buildItems(verb)
      const mistakes = seeded(index + 100)
      let progress: Progress = {}
      let sessions = 0
      for (; sessions < 30 && !items.every(i => progress[i.key]?.step === STEP.MASTERED); sessions++) {
        progress = playSession(items, progress, seeded(index), () => mistakes() > 0.25).progress
      }
      expect(items.every(i => progress[i.key]?.step === STEP.MASTERED)).toBe(true)
      expect(sessions).toBe(Math.ceil(items.length / SESSION_NEW))
    }
  })
})

describe('задания собраны корректно', () => {
  it('в каждом задании любого глагола верный ответ один, а варианты не совпадают по написанию', () => {
    for (const [index, verb] of catalogVerbs.entries()) {
      const items = buildItems(verb)
      const mistakes = seeded(index + 1)
      let progress: Progress = {}
      for (let s = 0; s < 3; s++) {
        progress = playSession(items, progress, seeded(index), () => mistakes() > 0.2, task => {
          if (task.type === 'meaning' || task.type === 'form' || task.type === 'gap') {
            const spellings = task.options.flatMap(o => o.variants)
            expect(task.options.filter(o => o.key === task.item.key)).toHaveLength(1)
            expect(new Set(spellings).size).toBe(spellings.length)
            expect(task.options.length).toBe(task.type === 'meaning' ? 3 : 4)
          }
          if (task.type === 'gap') expect(tokens(task.sentence.ka)).toContain(task.sentence.form)
          if (task.type === 'build') {
            expect(task.answer).toEqual(tokens(task.sentence.ka))
            expect(task.chips.filter(c => !c.decoy).map(c => c.text).sort()).toEqual([...task.answer].sort())
            const decoys = task.chips.filter(c => c.decoy)
            expect(decoys.length).toBeGreaterThan(0)
            expect(decoys.every(c => !task.answer.includes(c.text))).toBe(true)
          }
        }).progress
      }
    }
  })

  it('неверные варианты берутся сначала из уже встреченных форм', () => {
    const progress = { [write[0].key]: state(STEP.FORM), [write[7].key]: state(STEP.FORM), [write[20].key]: state(STEP.GAP), [write[30].key]: state(STEP.GAP) }
    for (let seed = 0; seed < 10; seed++) {
      const picked = distractors(write[0], write, progress, 3, seeded(seed)).map(i => i.key).sort()
      expect(picked).toEqual([write[7].key, write[20].key, write[30].key].sort())
    }
  })

  it('форма, которая пишется так же, как верная, в варианты не попадает', () => {
    const twin = withTwins.find(i => withTwins.some(o => o.key !== i.key && o.form === i.form))!
    const everythingMet = Object.fromEntries(withTwins.map(i => [i.key, state(STEP.FORM)]))
    for (let seed = 0; seed < 10; seed++) {
      const picked = distractors(twin, withTwins, everythingMet, 3, seeded(seed))
      expect(picked.some(p => p.form === twin.form)).toBe(false)
    }
  })

  it('при знакомстве с формой-двойником называет уже знакомую форму с тем же написанием', () => {
    const second = withTwins.find((i, n) => withTwins.slice(0, n).some(o => o.form === i.form))!
    const firstTwin = withTwins.find(i => i.form === second.form)!
    const progress = Object.fromEntries(withTwins.slice(0, withTwins.indexOf(second)).map(i => [i.key, state(STEP.MASTERED)]))

    const task = nextTask(withTwins, progress, startSession(withTwins, progress), seeded(1))

    expect(task).toMatchObject({ type: 'intro', item: { key: second.key }, twin: { key: firstTwin.key } })
  })
})

describe('повторение', () => {
  const mastered = (n: number, due: boolean) =>
    Object.fromEntries(write.slice(0, n).map(i => [i.key, state(STEP.MASTERED, { due })])) as Progress

  it('формы, которым пора на повторение, спрашивают раньше новых', () => {
    const progress = mastered(4, true)
    const { seen } = playSession(write, progress, seeded(2))
    const firstIntro = seen.findIndex(t => t.type === 'intro')

    expect(firstIntro).toBe(4)
    expect(seen.slice(0, 4).every(t => t.type !== 'intro' && t.type !== 'done' && t.review)).toBe(true)
    expect(new Set(seen.slice(0, 4).map(t => (t as { item: LadderItem }).item.key)).size).toBe(4)
  })

  it('выученные формы, которым ещё не пора, не спрашивают', () => {
    const { seen } = playSession(write, mastered(4, false), seeded(2))

    expect(seen[0].type).toBe('intro')
    expect(seen.some(t => t.type !== 'intro' && t.type !== 'done' && t.review)).toBe(false)
  })

  it('со второго захода времена чередуются: следующее повторение берётся из другого времени', () => {
    const progress = mastered(3, true)
    const session = startSession(write, progress)
    expect(session.mix).toBe(true)
    for (let seed = 0; seed < 20; seed++) {
      const task = nextTask(write, progress, { ...session, lastTense: write[0].tense, lastReview: false }, seeded(seed))
      expect(task.type).not.toBe('done')
      expect((task as { item: LadderItem }).item.tense).not.toBe(write[0].tense)
    }
  })

  it('в первом заходе чередование не включается', () => {
    expect(startSession(write, {}).mix).toBe(false)
    expect(startSession(write, { [write[0].key]: state(STEP.FORM) }).mix).toBe(false)
  })

  it('проваленное повторение возвращается в том же заходе, вперемешку с остальными', () => {
    const progress = mastered(3, true)
    let failedOnce = false
    const { progress: after, seen } = playSession(write, progress, seeded(4), task => {
      if (!failedOnce && task.type !== 'intro' && task.type !== 'done' && task.review) { failedOnce = true; return false }
      return true
    })
    const failedKey = (seen[0] as { item: LadderItem }).item.key

    expect(seen[1]).toMatchObject({ review: true })
    expect((seen[1] as { item: LadderItem }).item.key).not.toBe(failedKey)
    expect(seen[2]).toMatchObject({ type: 'type', review: false, item: { key: failedKey } })
    expect(after[failedKey]).toMatchObject({ step: STEP.MASTERED, reviews: 0 })
  })

  it('повторение то проще, то труднее: сначала узнать, в следующий раз написать', () => {
    const one = { [write[0].key]: state(STEP.MASTERED, { due: true, reviews: 0 }) }
    const two = { [write[0].key]: state(STEP.MASTERED, { due: true, reviews: 1 }) }
    const limit = (p: Progress) => ({ ...startSession(write, p), introduced: SESSION_NEW })

    expect(['gap', 'form']).toContain(nextTask(write, one, limit(one), seeded(1)).type)
    expect(nextTask(write, two, limit(two), seeded(1)).type).toBe('type')
  })
})

describe('полоска захода', () => {
  it('каждый верный шаг убавляет остаток ровно на один, и к концу захода он равен нулю', () => {
    let before = remaining(write, {}, { introduced: 0, newLimit: SESSION_NEW })
    const planned = before
    const { session } = playSession(write, {}, seeded(11), () => true, (task, progress, s) => {
      const now = remaining(write, progress, s)
      expect(s.planned).toBe(planned)
      if (progress !== undefined && Object.keys(progress).length) expect(before - now).toBe(1)
      before = now
    })

    expect(before).toBe(0)
    expect(session.introduced).toBe(SESSION_NEW)
  })

  it('ошибка увеличивает остаток — поэтому экран показывает лучший достигнутый результат', () => {
    const progress = { [write[0].key]: state(STEP.BUILD) }
    const session = { introduced: SESSION_NEW, newLimit: SESSION_NEW }
    const after = { [write[0].key]: settle(write[0], progress[write[0].key], false) }

    expect(remaining(write, after, session)).toBe(remaining(write, progress, session) + 1)
  })
})

describe('сборка фразы', () => {
  const item = write.find(i => i.buildable.length)!
  const progress = { [item.key]: state(STEP.BUILD) }
  const task = nextTask(write, progress, { ...startSession(write, progress), introduced: SESSION_NEW }, seeded(1)) as Extract<Task, { type: 'build' }>
  const words = task.answer.map(text => task.chips.find(c => c.text === text && !c.decoy)!)

  it('слово в слово как в источнике', () => {
    expect(checkBuild(task, words)).toEqual({ kind: 'exact' })
  })

  it('другой порядок слов ошибкой не считается', () => {
    expect(checkBuild(task, [...words].reverse())).toEqual({ kind: 'order' })
  })

  it('ошибка — только если в фразу попала не та форма глагола', () => {
    const decoy = task.chips.find(c => c.decoy)!
    const withDecoy = words.map(c => (c.text === task.sentence.form ? decoy : c))

    expect(checkBuild(task, withDecoy)).toEqual({ kind: 'decoy', chip: decoy })
  })
})

describe('мелочи', () => {
  const sentence = write.flatMap(i => i.sentences)[0]

  it('слова предложения — без знаков препинания', () => {
    expect(tokens(sentence.ka).every(w => /^[ა-ჰ-]+$/.test(w))).toBe(true)
    expect(tokens(sentence.ka).join(' ')).not.toBe(sentence.ka)
  })

  it('пропуск ставится на место формы, а знаки препинания остаются', () => {
    const gapped = withGap(sentence.ka, sentence.form, false)

    expect(gapped).toBe(sentence.ka.replace(sentence.form, '_____'))
    expect(withGap(sentence.ka, sentence.form, true)).toBe(sentence.ka)
  })

  it('по написанию находит, какая это форма', () => {
    expect(findForm(write, write[8].form)?.key).toBe(write[8].key)
    expect(findForm(write, 'нет такой')).toBeUndefined()
  })
})
