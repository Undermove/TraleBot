import { JOBS, NAME_LIST, knows, phrase, shuffle, type Rng, type Word } from '../story'
import { randomLook, type Look } from '../ui'

// «Вечеринка на крыше» — чистая логика: кто приходит, что говорит, какие реплики у тебя в ответ, какой бейдж
// чей, перемешивание гостей и итог. Экран — Party.tsx.

export type PartyMode = 'names' | 'full' | 'who' | 'jobs'

export interface Guest {
  id: number
  name: string
  look: Look
  job: Word
  /** Друг, с которым ты пришёл (режим «кто это?»). */
  friend?: boolean
  /** Гость сначала ждёт, что представишься ты. */
  asksFirst?: boolean
}

export interface PartyPlan {
  guests: Guest[]
  /** Кто приходит какими волнами (id гостей). Друг в режиме «кто это?» уже на крыше и в волны не входит. */
  waves: number[][]
  /** Режим «кто это?»: про кого по очереди спрашивает Нино. */
  questions: number[]
  /** Лишний бейдж в стопке — имя, которого на вечеринке нет. */
  spare: string | null
}

/** Хозяйка вечеринки в режиме «кто это?» — соседка Нино. */
export const HOST = 'ნინო'

export function planParty(lessonId: number, mode: PartyMode, me: string, rng: Rng = Math.random): PartyPlan {
  const pool = shuffle(NAME_LIST.filter(n => n !== me && (mode !== 'who' || n !== HOST)), rng)
  const size = mode === 'full' ? 4 : mode === 'who' ? 4 : 6
  const jobs = mode === 'jobs' ? shuffle([...JOBS, ...JOBS], rng) : []
  const guests: Guest[] = Array.from({ length: size }, (_, id) => ({
    id,
    name: pool[id % pool.length],
    look: randomLook(rng),
    job: mode === 'jobs' ? jobs[id] : JOBS[Math.floor(rng() * JOBS.length)],
    ...(mode === 'who' && id === 0 ? { friend: true } : {}),
    ...(mode === 'names' && (id === 1 || id === 4) ? { asksFirst: true } : {})
  }))
  const waves = mode === 'full' ? [[0, 1], [2, 3]] : mode === 'who' ? [[1, 2, 3]] : [[0, 1, 2], [3, 4, 5]]
  let questions: number[] = []
  if (mode === 'who') {
    // Каждого по разу и друга дважды; не подряд про одного и того же, первый вопрос — не про друга.
    for (let k = 0; k < 20; k++) {
      questions = shuffle([0, 0, 1, 2, 3], rng)
      if (questions[0] !== 0 && questions.every((q, i) => i === 0 || q !== questions[i - 1])) break
    }
    if (questions[0] === 0 || questions.some((q, i) => i > 0 && q === questions[i - 1])) questions = [1, 0, 2, 0, 3]
  }
  const spare = mode === 'names' ? pool[size % pool.length] ?? null : null
  return { guests, waves, questions, spare: spare && !guests.some(g => g.name === spare) ? spare : null }
}

export interface Option { geo: string; ok: boolean; why?: string }
export interface Beat {
  /** Что говорит гость (грузинский); null — молча ждёт. */
  says: string | null
  /** Ремарка по-русски: что происходит. */
  note?: string
  options: Option[]
  /** Что гость отвечает на верную реплику. */
  echo?: string
}

const hello = () => `${phrase('gamarjoba').geo}!`
const mkvia = (name: string) => `მე მქვია ${name}`

/** Сцена знакомства с гостем: по очереди реплики гостя и варианты твоего ответа. */
export function beats(g: Guest, mode: PartyMode, lessonId: number, me: string, others: string[], rng: Rng = Math.random): Beat[] {
  const bye = { geo: `${phrase('nakhvamdis').geo}!`, ok: false, why: 'Это «до свидания» — гость только пришёл!' }
  const other = others.find(n => n !== g.name) ?? NAME_LIST.find(n => n !== g.name && n !== me)!
  const greetBack: Beat = {
    says: `${hello()} ${mkvia(g.name)}.`,
    options: shuffle([
      { geo: `${phrase('gamarjoba').geo}, ${g.name}!`, ok: true },
      { geo: `${phrase('gamarjoba').geo}, ${other}!`, ok: false, why: 'Гостя зовут иначе. Послушай, что он сказал после მე მქვია.' },
      { geo: `${phrase('nakhvamdis').geo}, ${g.name}!`, ok: false, why: 'Это «до свидания» — гость только пришёл!' }
    ], rng)
  }
  const introduceMe = (says: string, note: string): Beat => ({
    says, note,
    options: shuffle([
      { geo: mkvia(me), ok: true },
      me !== 'კარლოსი' && knows(lessonId, 'me_mkvia_karlosi')
        ? { geo: phrase('me_mkvia_karlosi').geo, ok: false, why: 'Ты же не Карлос! Назови своё имя.' }
        : { geo: mkvia(g.name), ok: false, why: 'Это имя гостя, а не твоё.' },
      bye
    ], rng)
  })

  if (mode === 'names' || mode === 'who') {
    if (!g.asksFirst) return [greetBack]
    // Сначала спрашивают тебя. Если фраза «…შენ?» уже знакома и гостью зовут Нино — она так и говорит.
    if (g.name === 'ნინო' && knows(lessonId, 'me_mkvia_nino')) return [introduceMe(phrase('me_mkvia_nino').geo, 'Нино спрашивает, как зовут тебя')]
    return [introduceMe(hello(), 'Гость здоровается и смотрит на тебя: представься'), { ...greetBack, says: `${mkvia(g.name)}.` }]
  }

  if (mode === 'full') {
    const nice = knows(lessonId, 'sasiamovnoa')
    return [
      {
        says: hello(),
        options: shuffle([
          { geo: `${phrase('gagimarjos').geo}!`, ok: true },
          { geo: `${phrase('gamarjoba').geo}!`, ok: true },
          bye,
          { geo: phrase('kargad_madloba').geo, ok: false, why: 'Тебя ещё не спросили, как дела. Сначала поздоровайся.' }
        ], rng)
      },
      introduceMe(`${mkvia(g.name)}.`, 'Гость назвался — теперь ты'),
      ...(nice ? [{
        says: null,
        note: 'Гость улыбается и ждёт',
        echo: `${phrase('sasiamovnoa').geo}!`,
        options: shuffle([
          { geo: phrase('sasiamovnoa').geo, ok: true },
          { geo: phrase('rogor').geo, ok: false, why: 'Можно и так, но сначала скажи, что тебе приятно познакомиться.' },
          bye,
          { geo: phrase('madloba').geo, ok: false, why: '«Спасибо» — за что? Скажи, что приятно познакомиться.' }
        ], rng)
      }] : [])
    ]
  }

  // jobs
  return [{
    says: `${hello()} მე ვარ ${g.job.geo}.`,
    options: shuffle([
      { geo: `${phrase(knows(lessonId, 'gagimarjos') ? 'gagimarjos' : 'gamarjoba').geo}!`, ok: true },
      bye,
      { geo: phrase('kargad_madloba').geo, ok: false, why: 'Тебя не спросили, как дела. Просто поздоровайся.' }
    ], rng)
  }]
}

/** Что гость повторит, если переспросить. */
export const repeatLine = (g: Guest, mode: PartyMode) => (mode === 'jobs' ? `მე ვარ ${g.job.geo}.` : `${mkvia(g.name)}.`)

/** Бейдж к месту? */
export const badgeFits = (g: Guest, name: string) => g.name === name
/** Профессия к месту? */
export const jobFits = (g: Guest, job: Word) => g.job.geo === job.geo

/** «Кто это?» — верный ответ про гостя: имя или «это мой друг». */
export const whoAnswer = (g: Guest) => (g.friend ? phrase('es_chemi_megobaria').geo : g.name)

export function whoOptions(guests: Guest[], rng: Rng = Math.random): string[] {
  return shuffle([...guests.filter(g => !g.friend).map(g => g.name), phrase('es_chemi_megobaria').geo], rng)
}

/** Гости перемешались: новая раскладка по местам, никто не остаётся на своём (если гостей больше одного). */
export function mingle(ids: number[], slots: Record<number, number>, rng: Rng = Math.random): Record<number, number> {
  const places = ids.map(id => slots[id])
  if (ids.length < 2) return { ...slots }
  let perm = places
  for (let k = 0; k < 30; k++) {
    perm = shuffle(places, rng)
    if (perm.every((p, i) => p !== places[i])) break
  }
  if (perm.some((p, i) => p === places[i])) perm = [...places.slice(1), places[0]]
  const out = { ...slots }
  ids.forEach((id, i) => { out[id] = perm[i] })
  return out
}

/** Довольство гостей, 0..100: ошибка — минус 8, переспросил — минус 5. */
export const happiness = (misses: number, repeats: number) => Math.max(0, 100 - misses * 8 - repeats * 5)

/** Своя профессия в конце режима «профессии»: любая из трёх верна, «я из Грузии» — нет. */
export function myJobOptions(lessonId: number, rng: Rng = Math.random): Option[] {
  const wrong = knows(lessonId, 'sakartvelodan') ? [{ geo: phrase('sakartvelodan').geo, ok: false, why: 'Это «откуда ты», а спрашивают, кем ты работаешь.' }] : []
  return shuffle([...JOBS.map(j => ({ geo: `მე ვარ ${j.geo}`, ok: true })), ...wrong], rng)
}
