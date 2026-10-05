import { describe, it, expect } from 'vitest'
import { CARD_TENSES } from '../types'
import {
  BUILD_WORDS, KIND_CEILING, PERSON_ORDER, SOLID_STEP, STEP,
  buildItems, checkBuild, distractors, findForm, introOrder, introduce, settle, settleCapped, taskOfKind, taskStep, tokens, withGap,
  type FormState, type LadderItem, type Progress, type Task, type TaskKind
} from './engine'
import { CATALOG as catalogVerbs, seeded, verbByLemma } from '../testing/catalog'

// Формы и фразы — из настоящего каталога (src/Trale/Verbs/verbs.json).
const writeVerb = verbByLemma('წერს')
const write = buildItems(writeVerb)
// «хотеть»: у глагола только настоящее и имперфект.
const want = buildItems(verbByLemma('უნდა'))
const withoutSentences = catalogVerbs.map(buildItems).find(items => items.every(i => !i.sentences.length))!
const withTwins = catalogVerbs.map(buildItems).find(items => new Set(items.map(i => i.form)).size < items.length)!

const state = (step: number, extra: Partial<FormState> = {}): FormState => ({ step, best: step, reviews: 0, due: false, ...extra })

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

  it('у неполного глагола в лесенке только те времена, что у него есть, в том же порядке', () => {
    expect(want).toHaveLength(12)
    expect(want.slice(0, 4).map(i => i.key)).toEqual(['present:0', 'imperfect:0', 'present:2', 'imperfect:2'])
  })

  it('фраза с формой «ты» / «вы» во времени, которое служит и повелением, к клетке не привязывается', () => {
    // В каталоге у «писать» есть фраза с формой «ты · настоящее» — запрет («Не пиши…»):
    // написание то же, а значит она не то, что обещает подпись клетки.
    const you = write.find(i => i.key === 'present:1')!
    expect(writeVerb.sentences.some(s => s.form === you.form)).toBe(true)
    expect(you.sentences).toEqual([])

    for (const item of catalogVerbs.flatMap(buildItems)) {
      if ([1, 4].includes(item.person) && ['present', 'aorist', 'optative'].includes(item.tense)) expect(item.sentences).toEqual([])
    }
  })

  it('фраза не привязывается к форме, которая пишется так же, как другая клетка этого глагола', () => {
    for (const verb of catalogVerbs) {
      const spellings = Object.values(verb.tenses).flatMap(persons => persons!.flatMap(variants => [...new Set(variants)]))
      for (const item of buildItems(verb)) {
        for (const s of item.sentences) expect(spellings.filter(f => f === s.form), `${verb.ru}: ${s.form}`).toHaveLength(1)
      }
    }
  })

  it('после отсева у частых глаголов фразы всё ещё есть', () => {
    const withSentences = (lemma: string) => buildItems(verbByLemma(lemma)).filter(i => i.sentences.length).length
    expect(withSentences('წერს')).toBeGreaterThanOrEqual(3)
    expect(withSentences('მიდის')).toBeGreaterThanOrEqual(6)
    expect(write[0].buildable.length).toBeGreaterThan(0)
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

describe('задания собраны корректно', () => {
  it('в каждом задании любого глагола верный ответ один, а варианты не совпадают по написанию', () => {
    const kinds: TaskKind[] = ['meaning', 'form', 'gap', 'build', 'type']
    for (const [index, verb] of catalogVerbs.entries()) {
      const items = buildItems(verb)
      const rng = seeded(index + 1)
      // Половина форм уже встречалась — как посреди обучения.
      const progress: Progress = Object.fromEntries(items.filter((_, n) => n % 2 === 0).map(i => [i.key, state(STEP.FORM)]))
      for (const item of items) for (const kind of kinds) {
        const task = taskOfKind(kind, item, items, progress, rng)
        if (task.type === 'intro') throw new Error('знакомство здесь не просили')
        expect(task.item.key).toBe(item.key)
        if (task.type === 'meaning' || task.type === 'form' || task.type === 'gap') {
          const spellings = task.options.flatMap(o => o.variants)
          expect(task.options.filter(o => o.key === task.item.key)).toHaveLength(1)
          expect(new Set(spellings).size).toBe(spellings.length)
          // У совсем короткого глагола вариантов может не хватить — но выбор есть всегда.
          expect(task.options.length).toBeGreaterThan(1)
          expect(task.options.length).toBeLessThanOrEqual(task.type === 'meaning' ? 3 : 4)
        }
        if (task.type === 'gap') expect(tokens(task.sentence.ka)).toContain(task.sentence.form)
        if (task.type === 'build') {
          expect(task.answer).toEqual(tokens(task.sentence.ka))
          expect(task.chips.filter(c => !c.decoy).map(c => c.text).sort()).toEqual([...task.answer].sort())
          const decoys = task.chips.filter(c => c.decoy)
          expect(decoys.length).toBeGreaterThan(0)
          expect(decoys.every(c => !task.answer.includes(c.text))).toBe(true)
        }
      }
    }
  })

  it('задание без материала заменяется ближайшим попроще: собрать → вставить → выбрать', () => {
    const plain = withoutSentences[0]
    expect(taskOfKind('build', plain, withoutSentences, {}, seeded(1)).type).toBe('form')
    expect(taskOfKind('gap', plain, withoutSentences, {}, seeded(1)).type).toBe('form')
    const gapOnly = write.find(i => i.sentences.length && !i.buildable.length)
    if (gapOnly) expect(taskOfKind('build', gapOnly, write, {}, seeded(1)).type).toBe('gap')
    expect(taskOfKind('type', plain, withoutSentences, {}, seeded(1)).type).toBe('type')
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

    const task = taskOfKind('intro', second, withTwins, progress, seeded(1))

    expect(task).toMatchObject({ type: 'intro', item: { key: second.key }, twin: { key: firstTwin.key } })
  })
})

describe('сборка фразы', () => {
  const item = write.find(i => i.buildable.length)!
  const progress = { [item.key]: state(STEP.BUILD) }
  const task = taskOfKind('build', item, write, progress, seeded(1)) as Extract<Task, { type: 'build' }>
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

describe('ответ в сцене сессии', () => {
  const item = write[0]

  it('сцена поднимает форму не выше своего потолка', () => {
    expect(settleCapped(item, state(STEP.FORM), true, SOLID_STEP)!.step).toBe(SOLID_STEP)
    expect(settleCapped(item, state(SOLID_STEP), true, SOLID_STEP)).toBeNull()
    expect(settleCapped(item, state(STEP.TYPE), true, SOLID_STEP)).toBeNull()
    expect(settleCapped(item, state(STEP.TYPE), true, KIND_CEILING.type)!.step).toBe(STEP.MASTERED)
  })

  it('выученной форму делает только задание «написать самому»', () => {
    const ceilings = Object.entries(KIND_CEILING).filter(([kind]) => kind !== 'type').map(([, step]) => step)
    expect(Math.max(...ceilings)).toBeLessThan(STEP.MASTERED)
    expect(KIND_CEILING.form).toBe(SOLID_STEP)
  })

  it('незнакомую форму засчитывают только сцены, которые её показывают', () => {
    expect(settleCapped(item, undefined, true, SOLID_STEP)).toBeNull()
    expect(settleCapped(item, undefined, false, SOLID_STEP)).toBeNull()
    expect(settleCapped(item, undefined, true, STEP.MEANING, true)).toEqual(introduce())
    expect(settleCapped(item, undefined, true, SOLID_STEP, true)!.step).toBe(STEP.FORM)
    expect(settleCapped(item, undefined, false, SOLID_STEP, true)).toEqual(introduce())
  })

  it('ошибка опускает на ступень, но не ниже первой; лучший результат остаётся', () => {
    expect(settleCapped(item, state(SOLID_STEP), false, SOLID_STEP)).toMatchObject({ step: STEP.FORM, best: SOLID_STEP })
    expect(settleCapped(item, state(STEP.MEANING), false, SOLID_STEP)).toBeNull()
  })

  it('выученная форма: верный ответ на повторении считается, без повторения ничего не меняет, ошибка возвращает в игру', () => {
    expect(settleCapped(item, state(STEP.MASTERED, { due: true }), true, SOLID_STEP)).toMatchObject({ step: STEP.MASTERED, reviews: 1, due: false })
    expect(settleCapped(item, state(STEP.MASTERED), true, KIND_CEILING.type)).toBeNull()
    expect(settleCapped(item, state(STEP.MASTERED), false, SOLID_STEP)!.step).toBe(taskStep(item, STEP.TYPE))
  })
})

describe('порядок знакомства в сессиях', () => {
  it('сначала «я» — сейчас, сделал, сделаю; потом те же времена для «он» и «ты»; потом остальные времена для «я»', () => {
    const order = introOrder(write).map(i => i.key)
    expect(order.slice(0, 3)).toEqual(['present:0', 'aorist:0', 'future:0'])
    expect(order.slice(3, 9)).toEqual(['present:2', 'aorist:2', 'future:2', 'present:1', 'aorist:1', 'future:1'])
    expect(order.slice(9, 12).every(k => k.endsWith(':0'))).toBe(true)
    expect([...order].sort()).toEqual(write.map(i => i.key).sort())
  })

  it('у неполного глагола — те формы, что есть, без дыр', () => {
    expect(introOrder(want).map(i => i.key).slice(0, 2)).toEqual(['present:0', 'present:2'])
    expect(introOrder(want)).toHaveLength(want.length)
  })
})
