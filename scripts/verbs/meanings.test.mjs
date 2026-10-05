// node --test scripts/verbs/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { MAIN_TENSES, meaningsOf, past } from './meanings.mjs'

const forms = JSON.parse(readFileSync(new URL('./ru-forms.json', import.meta.url), 'utf8'))
const byRu = ru => Object.values(forms).find(f => f.ru === ru)
const all = f => meaningsOf(f, MAIN_TENSES)

test('обычный глагол: шесть времён простыми словами', () => {
  const { meanings, chips, problems } = all(byRu('писать'))
  assert.deepEqual(problems, [])
  assert.deepEqual(meanings.present, ['я пишу', 'ты пишешь', 'он пишет', 'мы пишем', 'вы пишете', 'они пишут'])
  assert.deepEqual(meanings.imperfect, ['я писал(а)', 'ты писал(а)', 'он писал', 'мы писали', 'вы писали', 'они писали'])
  assert.deepEqual(meanings.aorist, meanings.imperfect)
  assert.deepEqual(meanings.future, ['я буду писать', 'ты будешь писать', 'он будет писать', 'мы будем писать', 'вы будете писать', 'они будут писать'])
  assert.deepEqual(meanings.optative, ['мне надо писать', 'тебе надо писать', 'ему надо писать', 'нам надо писать', 'вам надо писать', 'им надо писать'])
  assert.deepEqual(meanings.conditional.slice(0, 4), ['я бы писал(а)', 'ты бы писал(а)', 'он бы писал', 'мы бы писали'])
  // Аорист и имперфект по-русски звучат одинаково — их различает пометка, и только их.
  assert.deepEqual(chips, { aorist: 'один раз · сделано', imperfect: 'долго или часто' })
})

test('пометки нет, когда фраза и так однозначна: у «хотеть» только настоящее и имперфект', () => {
  const { meanings, chips, problems } = meaningsOf(byRu('хотеть'), ['present', 'imperfect', 'presentSubjunctive'])
  assert.deepEqual(problems, [])
  assert.deepEqual(Object.keys(meanings), ['present', 'imperfect'])
  assert.deepEqual(meanings.present, ['я хочу', 'ты хочешь', 'он хочет', 'мы хотим', 'вы хотите', 'они хотят'])
  assert.equal(meanings.imperfect[0], 'я хотел(а)')
  assert.deepEqual(chips, {})
})

test('род в прошедшем: «хотел(а)», но «шёл / шла» и «боялся / боялась»', () => {
  assert.equal(past(byRu('хотеть'), 0), 'хотел(а)')
  assert.equal(past(byRu('идти, уходить'), 0), 'шёл / шла')
  assert.equal(past(byRu('идти, уходить'), 2), 'шёл')
  assert.equal(past(byRu('идти, уходить'), 5), 'шли')
  assert.equal(past(byRu('бояться'), 1), 'боялся / боялась')
})

test('из перевода спрягается первый глагол, пояснение в скобках отбрасывается', () => {
  assert.equal(byRu('идти, уходить').inf, 'идти')
  assert.equal(byRu('снимать (одежду)').inf, 'снимать')
})

test('«быть»: «я есть» и простое будущее «я буду»', () => {
  const { meanings, problems } = meaningsOf(byRu('быть'), ['present', 'aorist', 'optative', 'conditional', 'future'])
  assert.deepEqual(problems, [])
  assert.equal(meanings.present[0], 'я есть')
  assert.deepEqual(meanings.future, ['я буду', 'ты будешь', 'он будет', 'мы будем', 'вы будете', 'они будут'])
  assert.equal(meanings.aorist[0], 'я был(а)')
  assert.equal(meanings.optative[3], 'нам надо быть')
})

test('глагол совершенного вида: вместо «буду + инфинитив» простое будущее, настоящего нет', () => {
  const perfective = {
    ru: 'сказать', inf: 'сказать', aspect: 'perf',
    future: ['скажу', 'скажешь', 'скажет', 'скажем', 'скажете', 'скажут'],
    past: { m: 'сказал', f: 'сказала', pl: 'сказали' }
  }
  assert.equal(meaningsOf(perfective, ['future', 'aorist']).meanings.future[0], 'я скажу')
  assert.deepEqual(meaningsOf(perfective, ['present']).problems, ['нет русской фразы для времени present'])
})

test('глаголы, где по-русски говорят иначе: «у меня есть», «у меня болит», «я хочу есть»', () => {
  assert.equal(meaningsOf(byRu('иметь'), ['present', 'imperfect', 'conditional', 'future']).meanings.present[2], 'у него есть')
  assert.equal(meaningsOf(byRu('болеть (у кого-то болит)'), ['present', 'imperfect']).meanings.imperfect[0], 'у меня болело')
  assert.deepEqual(meaningsOf(byRu('быть голодным'), ['present', 'imperfect']).meanings.present.slice(0, 2), ['я хочу есть', 'ты хочешь есть'])
  assert.equal(meaningsOf(byRu('следовать за'), ['present']).meanings.present[0], 'я следую за кем-то')
})

test('заданные руками фразы обязаны покрывать все времена глагола', () => {
  assert.deepEqual(meaningsOf(byRu('иметь'), ['present', 'aorist']).problems, ['нет русской фразы для времени aorist'])
})

test('у каждого перевода фраза с пометкой однозначно называет клетку', () => {
  for (const f of Object.values(forms)) {
    const tenses = f.phrases ? Object.keys(f.phrases) : MAIN_TENSES
    assert.deepEqual(meaningsOf(f, tenses).problems, [], f.ru)
  }
})
