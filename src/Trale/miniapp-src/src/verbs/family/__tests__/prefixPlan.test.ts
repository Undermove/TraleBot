import { describe, it, expect } from 'vitest'
import { buildItems, STEP } from '../../ladder/engine'
import { newLearning } from '../../testing/sheetApi'
import { GO, at, familyDto, familyVerb } from '../../testing/family'
import type { VerbLearningDto } from '../../session/types'
import {
  PREFIX_CHECK_ROUNDS, PREFIX_ROUNDS, isPrefixSession, oppositeOf, parseIntroLine, planPrefixSession, resolveRound, twinOf
} from '../prefixPlan'
import { prefixName, prefixOf } from '../types'

// Сессия про приставку: когда она идёт, из чего состоит и как раунд превращается в слова.

const OUT = at('out', 'there')
const verb = familyVerb(OUT)
const items = buildItems(verb)
const member = (patch: Partial<VerbLearningDto> = {}, family: Partial<NonNullable<VerbLearningDto['family']>> = {}): VerbLearningDto => ({
  ...newLearning, ...patch,
  family: { id: 'go', role: 'member', baseId: GO.base, baseName: GO.baseName, baseLearned: true, lessonDone: false, ...family }
})
const plan = (learning: VerbLearningDto, introSeen = false, progress = {}) => planPrefixSession({ verb, learning, items, progress, introSeen })

describe('сессия про приставку', () => {
  it('идёт только у глагола с приставкой и только когда основной глагол выучен', () => {
    expect(isPrefixSession(member())).toBe(true)
    expect(isPrefixSession(member({}, { baseLearned: false }))).toBe(false)
    expect(isPrefixSession(member({}, { role: 'base' }))).toBe(false)
    expect(isPrefixSession({ ...newLearning })).toBe(false)
  })

  it('первая сессия: вступление, игра и проверка — и всё это не дольше двух минут', () => {
    const scenes = plan(member()).scenes
    expect(scenes.map(s => s.type)).toEqual(['prefixintro', 'prefix', 'prefixcheck'])
    expect(scenes[1].prefixRounds).toHaveLength(PREFIX_ROUNDS)
    expect(scenes[2].prefixRounds).toHaveLength(PREFIX_CHECK_ROUNDS)
    expect(scenes.reduce((n, s) => n + s.seconds, 0)).toBeLessThanOrEqual(120)
    expect(scenes.every(s => s.familyId === 'go')).toBe(true)
  })

  it('вступления нет у того, кто прошёл уроки о приставках, и у того, кто его уже видел', () => {
    expect(plan(member({}, { lessonDone: true })).scenes.map(s => s.type)).toEqual(['prefix', 'prefixcheck'])
    expect(plan(member(), true).scenes.map(s => s.type)).toEqual(['prefix', 'prefixcheck'])
  })

  it('выученному глаголу проверка не нужна, а формы, которым пора, идут разминкой первыми', () => {
    const due = items[0]
    const progress = { [due.key]: { step: STEP.MASTERED, best: STEP.MASTERED, reviews: 0, due: true } }
    const scenes = plan(member({ level: 'learned' }, { lessonDone: true }), true, progress).scenes
    expect(scenes.map(s => s.type)).toEqual(['warmup', 'prefix'])
    expect(scenes[0].tasks).toEqual([{ key: due.key, kind: due.sentences.length ? 'gap' : 'form' }])
  })

  it('спрашивает не только сам глагол: два вопроса из шести — про соседей, с которыми его легко спутать', () => {
    const rounds = plan(member(), true).scenes[0].prefixRounds!
    const refs = verb.family!.members
    const me = refs.find(m => m.id === OUT)!
    expect(rounds.filter(r => r.target === OUT)).toHaveLength(4)
    expect(rounds.filter(r => r.target !== OUT).map(r => r.target)).toEqual([twinOf(me, refs)!.id, oppositeOf(me, refs)!.id])
    expect(new Set(rounds.map(r => r.kind))).toEqual(new Set(['form', 'direction']))
    for (const round of rounds) {
      expect(round.options).toHaveLength(4)
      expect(new Set(round.options).size).toBe(4)
      expect(round.options).toContain(round.target)
    }
    // Проверка идёт по другим клеткам, чем игра.
    const [play, check] = plan(member(), true).scenes
    expect(check.prefixRounds!.map(r => r.cell)).not.toEqual(play.prefixRounds!.map(r => r.cell))
  })

  it('пары на схеме: «туда / сюда» и противоположное направление', () => {
    const refs = verb.family!.members
    const of = (id: string) => refs.find(m => m.id === id)!
    expect(twinOf(of(OUT), refs)!.id).toBe(at('out', 'here'))
    expect(oppositeOf(of(OUT), refs)!.id).toBe(at('in', 'there'))
    expect(oppositeOf(of(at('up', 'here')), refs)!.id).toBe(at('down', 'here'))
    expect(oppositeOf(of(at('across', 'there')), refs)).toBeUndefined()
    expect(twinOf(of(GO.base), refs)!.id).toBe(at('none', 'here'))
  })

  it('раунд превращается в слова семьи: та же клетка у каждого варианта, фраза — из каталога', () => {
    const family = familyDto()
    const round = resolveRound({ kind: 'form', target: OUT, cell: 'present:2', options: [at('in', 'there'), OUT, at('out', 'here'), GO.base] }, family)!
    expect(round.target.form).toBe(verb.tenses.present![2][0])
    expect(round.target.meaning).toBe(verb.meanings!.present![2])
    expect(round.options.map(o => o.member.id)).toEqual([at('in', 'there'), OUT, at('out', 'here'), GO.base])
    expect(round.options.every(o => o.form.startsWith(o.member.prefixes[0]))).toBe(true)
    expect(round.baseMeaning).toBe(familyVerb(GO.base).meanings!.present![2])
    // Нет такой клетки или не из кого выбирать — раунда нет.
    expect(resolveRound({ kind: 'form', target: OUT, cell: 'perfect:2', options: [OUT, GO.base] }, family)).toBeNull()
    expect(resolveRound({ kind: 'form', target: OUT, cell: 'present:2', options: [OUT] }, family)).toBeNull()
  })

  it('приставка в слове и её название', () => {
    const here = verb.family!.members.find(m => m.id === at('out', 'here'))!
    const hereVerb = familyVerb(here.id)
    // У «наружу, сюда» приставка длиннее, чем у «наружу»: выделяется целиком.
    expect(prefixOf(hereVerb.tenses.present![0][0], [...verb.family!.prefixes, ...hereVerb.family!.prefixes])).toBe(hereVerb.family!.prefixes[0])
    expect(prefixOf('слово', verb.family!.prefixes)).toBe('')
    expect(prefixName(verb.family!)).toBe('«наружу»')
    expect(prefixName(here)).toBe('«наружу» + «сюда»')
    expect(prefixName(verb.family!.members.find(m => m.id === at('none', 'here'))!)).toBe('«сюда»')
  })

  it('строка урока разбирается на приставку, значение и пример; непохожая строка остаётся как есть', () => {
    const line = familyDto().intro.screens[0].lines[0]
    const parsed = parseIntroLine(line)!
    expect(line.startsWith(`${parsed.prefix}- — ${parsed.meaning}: ${parsed.example} (`)).toBe(true)
    expect(parsed.meaning).toBe('внутрь')
    expect(parseIntroLine('просто строка')).toBeNull()
  })
})
