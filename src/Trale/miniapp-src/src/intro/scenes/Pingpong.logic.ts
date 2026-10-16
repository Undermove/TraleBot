import { knows, met, phrase } from '../story'
import type { Who } from './Walk.logic'

// «Пинг-понг» — чистая логика. Разговор — розыгрыш: каждая реплика — удар по мячу. Сказал «კარგად,
// შენ?» — вернул мяч, разговор живёт; ответил «კარგად, მადლობა» и замолчал там, где ждали вопроса, — мяч
// в сетке. Партия — один вечер на Бульваре: поздоровались с другом, к столу подходит соседка, друг зовёт
// «კიდევ?» на ещё одну, темнеет — мимо идёт сосед, в конце прощаетесь. Ни один розыгрыш не повторяет
// другой. Слова сцены (ძალიან კარგად, მეც კარგად, კიდევ?) появляются по ходу. Экран — Pingpong.tsx.

export type PingMode = 'echo'

/** Кто говорит реплику не от тебя: друг за столом или тот, кто подошёл. */
export type Speaker = 'friend' | 'guest'

/** Удар: что говорят перед твоим ударом (нет — мяч у тебя, подаёшь ты), чем нужно ответить. */
export interface Shot {
  cue: string
  line?: string
  by?: Speaker
  want: string
  /** Тоже верно (ответов по делу бывает два). */
  ok?: string[]
  /** Реплика, которая тоже по делу, но обрывает розыгрыш (мяч в сетку) — с объяснением. */
  net?: { id: string; why: string }[]
  /** Что отвечают на твой удар. */
  react?: string
  reactBy?: Speaker
  /** Слово сцены, с которым этот удар знакомит: карточка «новое слово». */
  word?: string
}

export interface Rally {
  serve: 'friend' | 'you'
  shots: Shot[]
  /** Кто подошёл к столу в этом розыгрыше. */
  guest?: Who
  /** Стемнело — вечер на Бульваре. */
  evening?: boolean
}

export const POINTS = 5

const g = (id: string) => phrase(id).geo

export const NINO: Who = { ru: 'Соседка', kind: 'woman', coat: '#C2410C', skin: '#E8B48A', hair: '#5A3A22', extra: 'bag', voice: 'f' }
export const GRANDPA: Who = { ru: 'Сосед', kind: 'old', coat: '#6B7A4A', skin: '#D9A77E', hair: '#D8D2C4', extra: 'glasses', voice: 'm' }

/** Партия: пять разных розыгрышей одного вечера. */
export function match(): Rally[] {
  return [
    // 1. Друг подаёт: здоровается и спрашивает, как дела, — верни вопрос.
    {
      serve: 'friend',
      shots: [
        { cue: 'Друг подаёт — поздоровайся.', line: 'gamarjoba', want: 'gamarjoba', react: 'rogor' },
        {
          cue: 'Тебя спросили, как дела. Ответь — и верни вопрос.',
          want: 'kargad_shen',
          net: [{ id: 'kargad_madloba', why: `Ответил, но не спросил в ответ — мяч в сетке. Скажи ${g('kargad_shen')} — «хорошо, а ты?»` }],
          react: 'dzalian_kargad', word: 'dzalian_kargad'
        }
      ]
    },
    // 2. К столу подходит соседка — подаёшь ты: здороваешься и спрашиваешь сам, она возвращает вопрос.
    {
      serve: 'you', guest: NINO,
      shots: [
        { cue: 'К столу подошла соседка. Твоя подача — поздоровайся.', want: 'gamarjoba', react: 'gamarjoba', reactBy: 'guest' },
        { cue: 'Спроси, как у неё дела.', want: 'rogor', react: 'kargad_shen', reactBy: 'guest' },
        {
          cue: 'Она ответила и спросила тебя: «а ты?» Просто ответь.',
          want: 'kargad_madloba', ok: ['dzalian_kargad'],
          net: [{ id: 'kargad_shen', why: 'Тебя уже спросили «а ты?» — просто ответь: хорошо, спасибо.' }]
        }
      ]
    },
    // 3. Друг зовёт на ещё одну: «კიდევ?» — «კიდევ!» По ходу спрашивает, как ты, и сам «тоже хорошо».
    {
      serve: 'friend',
      shots: [
        { cue: 'Друг спрашивает: ещё? Ответь тем же словом — «ещё!»', line: 'kidev', want: 'kidev', word: 'kidev', react: 'rogor' },
        {
          cue: 'Друг на ходу: «ты как?» Ответь — и спроси в ответ.',
          want: 'kargad_shen',
          net: [{ id: 'kargad_madloba', why: `Он ждёт вопроса в ответ — скажи ${g('kargad_shen')}.` }],
          react: 'mets_kargad', word: 'mets_kargad'
        }
      ]
    },
    // 4. Стемнело. Мимо идёт сосед — вечернее приветствие; он спрашивает «а ты?» — «я тоже хорошо».
    {
      serve: 'you', guest: GRANDPA, evening: true,
      shots: [
        {
          cue: 'Стемнело. Мимо стола идёт сосед — поздоровайся по-вечернему.', want: 'saghamo', react: 'saghamo', reactBy: 'guest',
          net: [{ id: 'gamarjoba', why: `Можно и так, но уже вечер — скажи ${g('saghamo')}.` }]
        },
        { cue: 'Спроси, как у него дела.', want: 'rogor', react: 'kargad_shen', reactBy: 'guest' },
        {
          cue: 'Он ответил «хорошо, а ты?» Скажи: я тоже хорошо.',
          want: 'mets_kargad', ok: ['kargad_madloba', 'dzalian_kargad'],
          net: [{ id: 'kargad_shen', why: 'Тебя уже спросили «а ты?» — просто ответь.' }]
        }
      ]
    },
    // 5. Последний мяч — ты зовёшь «კიდევ?», друг отвечает «ძალიან კარგად!», потом прощаетесь.
    {
      serve: 'you', evening: true,
      shots: [
        { cue: 'Последний мяч? Позови друга ещё на одну.', want: 'kidev', react: 'dzalian_kargad' },
        { cue: 'Партия сыграна. Попрощайся.', want: 'nakhvamdis', react: 'nakhvamdis' }
      ]
    }
  ]
}

export type Result = 'hit' | 'net' | 'miss'
export interface Verdict { res: Result; hint: string }

export function judge(s: Shot, id: string): Verdict {
  if (id === s.want || s.ok?.includes(id)) return { res: 'hit', hint: '' }
  const net = s.net?.find(n => n.id === id)
  if (net) return { res: 'net', hint: net.why }
  if (id === 'nakhvamdis') return { res: 'miss', hint: 'Рано прощаться — розыгрыш ещё идёт.' }
  switch (s.want) {
    case 'nakhvamdis': return { res: 'miss', hint: `Партия окончена — скажи ${g('nakhvamdis')}.` }
    case 'gamarjoba': return { res: 'miss', hint: `Сначала поздоровайся: ${g('gamarjoba')}.` }
    case 'saghamo': return { res: 'miss', hint: `Вечер — поздоровайся: ${g('saghamo')}.` }
    case 'rogor': return { res: 'miss', hint: `Спроси: ${g('rogor')} — как дела?` }
    case 'kidev': return { res: 'miss', hint: `Ещё партию — ${g('kidev')}` }
    case 'mets_kargad': return { res: 'miss', hint: `Я тоже хорошо — ${g('mets_kargad')}.` }
  }
  return { res: 'miss', hint: `Тебя спросили, как дела. Ответь: ${g('kargad_shen')} или ${g('kargad_madloba')}.` }
}

/** Все кнопки ответа в порядке на панели. */
const PANEL = ['gamarjoba', 'saghamo', 'rogor', 'kargad_madloba', 'kargad_shen', 'dzalian_kargad', 'mets_kargad', 'kidev', 'nakhvamdis']

/**
 * Кнопки, которые есть сейчас: фразы, которые человек знает к этому уроку, и слова сцены — с того
 * момента, как они прозвучали (`heard`).
 */
export const replies = (lessonId: number, heard: readonly string[] = []) =>
  PANEL.filter(id => knows(lessonId, id) || (met(lessonId, id) && heard.includes(id)))

/** Слова сцены, которые прозвучат до этого удара включительно (кнопка появляется после первой встречи). */
export function heardBy(rallies: Rally[], ri: number, si: number): string[] {
  const out: string[] = []
  rallies.forEach((r, a) => r.shots.forEach((s, b) => {
    if (a < ri || (a === ri && b < si)) { for (const id of [s.line, s.want, s.react]) if (id) out.push(id) }
    if (a === ri && b === si && s.line) out.push(s.line)
    if (a === ri && b === si && s.word) out.push(s.word)
  }))
  return out
}

export const HINTS_OFF_AFTER = 8
