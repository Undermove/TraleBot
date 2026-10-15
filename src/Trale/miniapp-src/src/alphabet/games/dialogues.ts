import { readable, shuffle, type Rng, type Word } from './logic'

// «Разговор»: короткий чат с Бомборой или гостем. Реплика собеседника — грузинская фраза, которая уже есть
// в проверенном содержании уроков (источник рядом), или одно слово базового словаря; ситуация описана по-русски.
// Ученик отвечает одним грузинским словом из выученных. Своих грузинских фраз здесь нет.

export interface DialogueFrame {
  /** Что говорит собеседник (может не быть — тогда только ситуация). */
  line?: string
  /** Перевод реплики — мелко под ней. */
  lineRu?: string
  /** Где эта фраза уже есть в проверенном содержании. */
  source?: string
  /** Ситуация по-русски. */
  context: string
  /** Верный ответ — слово базового словаря. */
  answer: string
}

const WHO = { line: 'ვინ არის ეს?', lineRu: 'Кто это?', source: 'src/Trale/Lessons/GeorgianPronouns/questions4.json (pron4: «ვინ არის ეს?» — Кто это?)' }
const WHAT = { line: 'რა არის ეს?', lineRu: 'Что это?', source: 'src/Trale/Lessons/GeorgianPronouns/questions4.json (pron4_q09: «რა არის ეს?» — Что это?)' }
const HELLO = { line: 'გამარჯობა!', lineRu: 'Здравствуй!', source: 'src/Trale/MiniApp/MiniAppContentProvider.cs, алфавит, урок 11: Example("გამარჯობა!", "здравствуй!")' }

export const DIALOGUES: readonly DialogueFrame[] = [
  { ...WHO, context: 'Бомбора показывает фото мамы', answer: 'დედა' },
  { ...WHO, context: 'Бомбора показывает фото папы', answer: 'მამა' },
  { ...WHO, context: 'В кафе заходит незнакомая женщина', answer: 'ქალი' },
  { ...WHO, context: 'В кафе заходит незнакомый мужчина', answer: 'კაცი' },
  { ...WHO, context: 'Во дворе играет ребёнок', answer: 'ბავშვი' },
  { ...WHO, context: 'Рядом с тобой — твой друг', answer: 'მეგობარი' },
  { ...WHO, context: 'Это брат Бомборы', answer: 'ძმა' },
  { ...WHO, context: 'Человек в белом халате, со стетоскопом', answer: 'ექიმი' },
  { ...WHAT, context: 'Бомбора держит чашку чая', answer: 'ჩაი' },
  { ...WHAT, context: 'На столе лежит свежий хлеб', answer: 'პური' },
  { ...WHAT, context: 'Бомбора варит кофе', answer: 'ყავა' },
  { ...WHAT, context: 'Бомбора наливает воду', answer: 'წყალი' },
  { ...WHAT, context: 'На тарелке — кусок сыра', answer: 'ყველი' },
  { ...WHAT, context: 'В бокале — красное вино', answer: 'ღვინო' },
  { ...WHAT, context: 'На столе лежит книга', answer: 'წიგნი' },
  { ...WHAT, context: 'За окном — дом', answer: 'სახლი' },
  { ...WHAT, context: 'За окном проезжает машина', answer: 'მანქანა' },
  { ...WHAT, context: 'На окне сидит кошка', answer: 'კატა' },
  { ...WHAT, context: 'У двери сидит собака', answer: 'ძაღლი' },
  { ...WHAT, context: 'Бомбора ставит на стол стакан', answer: 'ჭიქა' },
  { ...WHAT, context: 'Гость кладёт на стол деньги', answer: 'ფული' },
  { ...WHAT, context: 'На полке играет радио', answer: 'რადიო' },
  { ...HELLO, context: 'Гость входит в кафе и здоровается. Поздоровайся в ответ', answer: 'გამარჯობა' },
  { line: 'ნახვამდის!', lineRu: 'До свидания!', context: 'Гость уходит и прощается. Попрощайся в ответ', answer: 'ნახვამდის' },
  { context: 'Бомбора приносит тебе чай. Поблагодари', answer: 'მადლობა' },
  { line: 'ჩაი?', lineRu: 'Чай?', context: 'Бомбора предлагает чай. Ты хочешь', answer: 'კი' },
  { line: 'ყავა?', lineRu: 'Кофе?', context: 'Бомбора предлагает кофе. Ты не хочешь', answer: 'არა' }
]

/** Слова, которые значат почти одно и то же: не ставим их вместе в варианты. */
const SAME = [['კი', 'ჰო']]
const clash = (a: string, b: string) => SAME.some(g => g.includes(a) && g.includes(b))

export interface DialogueRound { frame: DialogueFrame; choices: string[]; answer: Word }

/**
 * Реплики для урока слов: ответ — уже знакомое слово (свои слова урока — первыми), реплика читается
 * открытыми буквами. Варианты — другие знакомые слова с другим значением.
 */
export function dialogueRounds(stage: number, own: Word[], known: Word[], rng: Rng = Math.random, count = 3): DialogueRound[] {
  const byGeo = new Map(known.map(w => [w.geo, w]))
  const usable = DIALOGUES.filter(f => byGeo.has(f.answer) && (!f.line || readable(f.line, stage)))
  const isOwn = (f: DialogueFrame) => own.some(w => w.geo === f.answer)
  const picked = [...shuffle(usable.filter(isOwn), rng), ...shuffle(usable.filter(f => !isOwn(f)), rng)]
    .filter((f, i, a) => a.findIndex(x => x.answer === f.answer) === i)
    .slice(0, count)
  return picked.map(frame => {
    const answer = byGeo.get(frame.answer)!
    const others = shuffle(known.filter(w => w.geo !== answer.geo && w.ru !== answer.ru && !clash(w.geo, answer.geo)), rng).slice(0, 2)
    return { frame, answer, choices: shuffle([answer.geo, ...others.map(w => w.geo)], rng) }
  })
}

/** Игре «Разговор» хватает материала: хотя бы две реплики и хотя бы одна — со словом этого урока. */
export function dialogueReady(stage: number, own: Word[], known: Word[]): boolean {
  const rounds = dialogueRounds(stage, own, known, () => 0.5)
  return rounds.length >= 2 && rounds.some(r => own.some(w => w.geo === r.answer.geo)) && rounds.every(r => r.choices.length === 3)
}
