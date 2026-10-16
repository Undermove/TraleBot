import { HERO, JOBS, NAME_LIST, knows, met, phrase, shuffle, type Rng, type Word } from '../story'
import { DRINKS, drinksLine, offerLine, pleaseLine, wantLine, type Treat } from './party/Treats'
import { randomLook, type Look } from '../ui'
import { voiceOf } from './Reception.logic'

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
  // Немного гостей: игра учит понимать на слух, как человек представился, а не тренирует память.
  const size = mode === 'full' ? 4 : mode === 'who' ? 3 : mode === 'jobs' ? 3 : 4
  const jobs = mode === 'jobs' ? shuffle([...JOBS], rng) : []
  const guests: Guest[] = Array.from({ length: size }, (_, id) => ({
    id,
    name: pool[id % pool.length],
    // Внешность — по имени: Нино и Мариам с длинными волосами, Гиорги и Лука — без.
    look: randomLook(rng, { long: voiceOf(pool[id % pool.length]) === 'f' }),
    job: mode === 'jobs' ? jobs[id] : JOBS[Math.floor(rng() * JOBS.length)],
    ...(mode === 'who' && id === 0 ? { friend: true } : {}),
    ...(mode === 'names' && (id === 1 || id === 3) ? { asksFirst: true } : {})
  }))
  const waves = mode === 'who' ? [[1, 2]] : mode === 'jobs' ? [[0, 1, 2]] : [[0, 1], [2, 3]]
  let questions: number[] = []
  if (mode === 'who') {
    // Каждого по разу и друга дважды; не подряд про одного и того же, первый вопрос — не про друга.
    for (let k = 0; k < 20; k++) {
      questions = shuffle([0, 0, 1, 2], rng)
      if (questions[0] !== 0 && questions.every((q, i) => i === 0 || q !== questions[i - 1])) break
    }
    if (questions[0] === 0 || questions.some((q, i) => i > 0 && q === questions[i - 1])) questions = [1, 0, 2, 0]
  }
  const spare = mode === 'names' ? pool[size % pool.length] ?? null : null
  return { guests, waves, questions, spare: spare && !guests.some(g => g.name === spare) ? spare : null }
}

export interface Option { geo: string; ok: boolean; why?: string; /** Плитка угощения вместо реплики: подать чашку. */ treat?: Treat; /** Перевод — пока слово новое. */ ru?: string }
export interface Beat {
  /** Что говорит гость (грузинский); null — молча ждёт. */
  says: string | null
  /** Ремарка по-русски: что происходит. */
  note?: string
  options: Option[]
  /** Что гость отвечает на верную реплику. */
  echo?: string
  /** Запись реплики гостя (если она собрана из слов и записана отдельно). */
  audio?: string
  /** Слово сцены, с которым этот момент знакомит (карточка «новое слово»). */
  word?: string
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
  // Ты в истории — студент (HERO, карточка «Ты» на старте игры).
  const others = JOBS.filter(j => j.geo !== HERO.job.geo).slice(0, wrong.length ? 1 : 2)
  return shuffle([
    { geo: `მე ვარ ${HERO.job.geo}`, ok: true },
    ...others.map(j => ({ geo: `მე ვარ ${j.geo}`, ok: false, why: `Ты же ${HERO.job.ru}, приехал учиться в Батуми.` })),
    ...wrong
  ], rng)
}

// ── Угощения: у каждого урока свой поворот вечеринки ──────────────────────────────────────────────
// Вечеринка повторяется в четырёх уроках, поэтому в каждом что-то своё: в уроке 7 хозяйка встречает
// напитками и гости просят чай или кофе, в уроке 10 гости угощают хачапури и вином, в 11 друг хочет
// пить, в 20 врач приносит вино, а учитель просит кофе. Слова — из слов сцены (story.json → scene).

export type Errand =
  /** Гость просит напиток: «მე მინდა ყავა» — подай чашку. */
  | { kind: 'serve'; treat: Treat }
  /** Гость угощает: «ხაჭაპური?» → «კი, გთხოვთ» → попробуй: «გემრიელია!». */
  | { kind: 'offer'; treat: Treat }

export interface PartyTwist {
  /** Хозяйка встречает у входа: «ჩაი? ყავა? წყალი?» — выбери себе напиток. */
  welcome: boolean
  /** Поручения по номеру гостя (после знакомства). */
  errands: Record<number, Errand>
  /** Строчка к описанию игры на стартовом экране. */
  intro: string
}

export function partyTwist(lessonId: number, mode: PartyMode, rng: Rng = Math.random): PartyTwist {
  const drinks = shuffle([...DRINKS], rng)
  if (mode === 'names') return {
    welcome: met(lessonId, 'chai'),
    errands: met(lessonId, 'minda') ? { 0: { kind: 'serve', treat: drinks[0] }, 2: { kind: 'serve', treat: drinks[1] } } : {},
    intro: 'Нино встречает у входа с чаем и кофе, а гости будут просить напитки — подай каждому то, что он хочет.'
  }
  if (mode === 'full') return {
    welcome: false,
    errands: met(lessonId, 'gemrielia') ? { 1: { kind: 'offer', treat: 'khachapuri' }, 3: { kind: 'offer', treat: 'ghvino' } } : {},
    intro: 'Гости пришли не с пустыми руками: угощают хачапури и вином. Попробуй и похвали.'
  }
  if (mode === 'who') return {
    welcome: false,
    errands: { 1: { kind: 'serve', treat: 'tskali' }, 2: { kind: 'offer', treat: 'puri' } },
    intro: 'На крыше жарко: кто-то попросит воды, кто-то угостит свежим хлебом.'
  }
  return {
    welcome: false,
    errands: { 0: { kind: 'offer', treat: 'ghvino' }, 2: { kind: 'serve', treat: 'qava' } },
    intro: 'Один гость принёс вино, другой с работы — и хочет кофе.'
  }
}

/** Хозяйка у входа: выбери себе напиток — верен любой, «до свидания» — нет. */
export function welcomeBeat(rng: Rng = Math.random): Beat {
  return {
    says: drinksLine(),
    note: 'Нино встречает тебя у входа',
    word: 'chai',
    options: shuffle([
      ...DRINKS.map(d => ({ geo: pleaseLine(d), ok: true, ru: `${phrase(d).ru}, пожалуйста` })),
      { geo: `${phrase('nakhvamdis').geo}!`, ok: false, why: 'Ты только пришёл! Выбери, что будешь пить.' }
    ], rng)
  }
}

/** Поручение гостя — реплики и твои ответы. */
export function errandBeats(e: Errand, rng: Rng = Math.random): Beat[] {
  if (e.kind === 'serve') {
    return [{
      says: wantLine(e.treat),
      note: 'Гость просит напиток — подай ему',
      word: 'minda',
      echo: `${phrase('madloba').geo}!`,
      options: shuffle(DRINKS.map(d => ({
        geo: phrase(d).geo, treat: d, ok: d === e.treat,
        why: d === e.treat ? undefined : `Это ${phrase(d).ru}. Послушай: гость сказал «${wantLine(e.treat)}».`
      })), rng)
    }]
  }
  const nice = { geo: phrase('gemrielia').geo, ok: true, ru: phrase('gemrielia').ru }
  return [
    {
      says: offerLine(e.treat),
      note: 'Гость угощает',
      word: e.treat,
      options: shuffle([
        { geo: pleaseLine('ki'), ok: true, ru: 'да, пожалуйста' },
        { geo: `${phrase('nakhvamdis').geo}!`, ok: false, why: 'Гость угощает, а ты прощаешься? Скажи «да, пожалуйста».' },
        { geo: phrase('bodishi').geo, ok: false, why: 'Извиняться не за что — тебя угощают. Скажи «да, пожалуйста».' }
      ], rng)
    },
    {
      says: null,
      note: 'Ты пробуешь… Похвали!',
      word: 'gemrielia',
      echo: `${phrase('madloba').geo}!`,
      options: shuffle([
        nice,
        { geo: phrase('bodishi').geo, ok: false, why: 'Вкусно же! Скажи «вкусно!».' },
        { geo: phrase('ara').geo, ok: false, why: 'Нет? Гость старался! Похвали угощение.' }
      ], rng)
    }
  ]
}
