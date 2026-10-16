import { knows, phrase } from '../story'

// «Пинг-понг» — чистая логика. Разговор — розыгрыш: каждая реплика — удар по мячу. Сказал «კარგად,
// შენ?» — вернул мяч, разговор живёт; ответил «კარგად, მადლობა» и замолчал — мяч в сетке: собеседник
// остался без вопроса. Подача по очереди: то друг спрашивает тебя, то ты его. Экран — Pingpong.tsx.

export type PingMode = 'echo'

/** Удар: что говорит друг перед твоим ударом (нет — мяч у тебя, подаёшь ты), чем нужно ответить. */
export interface Shot {
  cue: string
  line?: string
  want: string
  /** Реплика, которая тоже по делу, но обрывает розыгрыш (мяч в сетку) — с объяснением. */
  net?: { id: string; why: string }[]
  /** Что друг отвечает на твой удар (если розыгрыш продолжается его репликой). */
  react?: string
}

export interface Rally { serve: 'friend' | 'you'; shots: Shot[] }

export const POINTS = 5

const g = (id: string) => phrase(id).geo

/** Розыгрыши партии: подача у друга, у тебя, снова у друга… */
export function match(): Rally[] {
  return Array.from({ length: POINTS }, (_, i) => (i % 2 === 0 ? friendServes() : youServe()))
}

/** Друг подаёт: здоровается, спрашивает, как дела, — верни вопрос, и он ответит. */
function friendServes(): Rally {
  return {
    serve: 'friend',
    shots: [
      { cue: 'Друг подаёт — поздоровайся.', line: 'gamarjoba', want: 'gamarjoba', react: 'rogor' },
      {
        cue: 'Тебя спросили, как дела. Ответь — и верни вопрос.',
        want: 'kargad_shen',
        net: [{ id: 'kargad_madloba', why: `Ответил, но не спросил в ответ — мяч в сетке. Скажи ${g('kargad_shen')} — «хорошо, а ты?»` }],
        react: 'kargad_madloba'
      },
      { cue: 'Друг ответил. Розыгрыш твой — попрощайся.', want: 'nakhvamdis', react: 'nakhvamdis' }
    ]
  }
}

/** Подаёшь ты: здороваешься и спрашиваешь сам; друг отвечает и возвращает вопрос тебе. */
function youServe(): Rally {
  return {
    serve: 'you',
    shots: [
      { cue: 'Твоя подача — поздоровайся.', want: 'gamarjoba', react: 'gamarjoba' },
      { cue: 'Спроси, как у друга дела.', want: 'rogor', react: 'kargad_shen' },
      {
        cue: 'Друг ответил и спросил тебя: «а ты?» Ответь.',
        want: 'kargad_madloba',
        net: [{ id: 'kargad_shen', why: 'Тебя уже спросили «а ты?» — просто ответь: хорошо, спасибо.' }]
      },
      { cue: 'Розыгрыш твой — попрощайся.', want: 'nakhvamdis', react: 'nakhvamdis' }
    ]
  }
}

export type Result = 'hit' | 'net' | 'miss'
export interface Verdict { res: Result; hint: string }

export function judge(s: Shot, id: string): Verdict {
  if (id === s.want) return { res: 'hit', hint: '' }
  const net = s.net?.find(n => n.id === id)
  if (net) return { res: 'net', hint: net.why }
  if (id === 'nakhvamdis') return { res: 'miss', hint: 'Рано прощаться — розыгрыш ещё идёт.' }
  if (s.want === 'nakhvamdis') return { res: 'miss', hint: `Разговор окончен — скажи ${g('nakhvamdis')}.` }
  if (s.want === 'gamarjoba') return { res: 'miss', hint: `Сначала поздоровайся: ${g('gamarjoba')}.` }
  if (s.want === 'rogor') return { res: 'miss', hint: `Спроси: ${g('rogor')} — как дела?` }
  return { res: 'miss', hint: `Тебя спросили, как дела. Ответь: ${g('kargad_shen')} или ${g('kargad_madloba')}.` }
}

export const replies = (lessonId: number) =>
  ['gamarjoba', 'rogor', 'kargad_madloba', 'kargad_shen', 'nakhvamdis'].filter(id => knows(lessonId, id))

export const HINTS_OFF_AFTER = 8
