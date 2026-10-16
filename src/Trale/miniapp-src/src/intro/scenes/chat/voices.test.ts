import { describe, expect, it } from 'vitest'
// @ts-ignore — тесты идут в Node
import { existsSync } from 'node:fs'
import { lineClips } from './voices'
import { NAME_LIST, JOBS } from '../../story'

// Собранные из слов реплики звучат записанными кусками, и каждый кусок — настоящий файл.
const files = (geo: string, v: 'hero' | 'f' | 'm') => {
  const c = lineClips(geo, v)
  for (const u of c) expect(existsSync(`public${u}`), u).toBe(true)
  return c
}

describe('lineClips', () => {
  it('гость представляется: приветствие и имя — две записи', () => {
    for (const n of NAME_LIST) expect(files(`გამარჯობა! მე მქვია ${n}.`, 'f')).toHaveLength(2)
  })
  it('ты здороваешься с гостем по имени и называешь имена своим голосом', () => {
    for (const n of NAME_LIST) {
      expect(files(`გამარჯობა, ${n}!`, 'hero')).toHaveLength(1)
      expect(files(`${n}.`, 'hero')).toHaveLength(1)
    }
  })
  it('сосед говорит о другом: «<имя>? ის არის …» — имя вопросом и профессия', () => {
    for (const j of JOBS) expect(files(`ნინო? ის არის ${j.geo}.`, 'm')).toHaveLength(2)
  })
  it('своё имя ученика не записано — звучит «მე მქვია», имя читают', () => {
    expect(files('მე მქვია დიმიტრი', 'hero')).toHaveLength(1)
  })
})
