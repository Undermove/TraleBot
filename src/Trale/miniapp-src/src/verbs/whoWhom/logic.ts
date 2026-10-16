import type { ObjectCase, TenseKey, VerbDto } from '../types'

// «Кто кого»: у глагола со вторым человеком («вижу тебя», «он видит меня») грузинский ставит в начало
// не только «кто», но и «кого». Таблица карточки — это «кого» = его/её (метки нет). Остальные стороны
// выводим по одному правилу из этой таблицы: на место ვ- (я/мы) встаёт метка «кого» — მ- меня,
// გ- тебя/вас, გვ- нас; «вас» ещё добавляет -თ в конце. Чистая логика, экран — WhoWhomSheet.tsx.

/**
 * У кого «кто кого» — поле objectPerson карточки: каталог (scripts/verbs/object-person.json) и глаголы,
 * которые собирает агент. Здесь — только глаголы, собранные агентом до того, как он стал его ставить.
 */
const BEFORE_THE_AGENT: Record<string, ObjectCase> = { 'ეძებს': 'acc', 'ხვდება': 'with' }

export const objectCaseOf = (verb: Pick<VerbDto, 'id' | 'objectPerson'>): ObjectCase | null =>
  verb.objectPerson ?? BEFORE_THE_AGENT[verb.id] ?? null

/** Формы, найденные в реальных предложениях (Tatoeba, №8493346 и №8482909, с их переводом), — остальные выведены по правилу. */
export const ATTESTED: Record<string, string> = {
  'გხედავთ': 'მე თქვენ ვერ გხედავთ. — Я не вижу вас.',
  'დამინახა': 'ბიჭი გაიქცა, როდესაც მე დამინახა. — Мальчик убежал, когда увидел меня.'
}

/** Только времена, где «кто» и «кого» стоят так, как в настоящем; в «оказывается, сделал» всё иначе. */
export const WHO_WHOM_TENSES: TenseKey[] = ['present', 'aorist', 'future']

export type Whom = 'him' | 'me' | 'you' | 'us' | 'youpl' | 'them'

export const WHOMS: { key: Whom; ru: Record<ObjectCase, string>; mark: string }[] = [
  { key: 'me', ru: { acc: 'меня', dat: 'мне', with: 'со мной' }, mark: 'მ' },
  { key: 'you', ru: { acc: 'тебя', dat: 'тебе', with: 'с тобой' }, mark: 'გ' },
  { key: 'him', ru: { acc: 'его', dat: 'ему', with: 'с ним' }, mark: '' },
  { key: 'us', ru: { acc: 'нас', dat: 'нам', with: 'с нами' }, mark: 'გვ' },
  { key: 'youpl', ru: { acc: 'вас', dat: 'вам', with: 'с вами' }, mark: 'გ' },
  { key: 'them', ru: { acc: 'их', dat: 'им', with: 'с ними' }, mark: '' }
]

/** Как называется второй переключатель: «кого», «кому», «с кем». */
export const WHOM_LABEL: Record<ObjectCase, string> = { acc: 'кого', dat: 'кому', with: 'с кем' }

/** «Кто» в том же порядке, что лица таблицы: я, ты, он, мы, вы, они. */
export const WHOS = ['я', 'ты', 'он', 'мы', 'вы', 'они']

/** «Кого» как лицо таблицы: меня — я, тебя — ты, … Для переворота сторон. */
const WHOM_AS_PERSON: Record<Whom, number> = { me: 0, you: 1, him: 2, us: 3, youpl: 4, them: 5 }
const PERSON_AS_WHOM: Whom[] = ['me', 'you', 'him', 'us', 'youpl', 'them']

export const whomOf = (k: Whom) => WHOMS.find(w => w.key === k)!

/** Нельзя «я — меня», «мы — тебя и меня»: сам себя — это другой глагол. */
export function possible(who: number, whom: Whom): boolean {
  if ((who === 0 || who === 3) && (whom === 'me' || whom === 'us')) return false
  if ((who === 1 || who === 4) && (whom === 'you' || whom === 'youpl')) return false
  return true
}

/** Где в формах времени стоит ვ- «я»: после приставки (და-ვ-ინახე), иначе — в начале. */
function slotOf(table: string[][]): number | null {
  const i1 = table[0]?.[0]
  const you = table[1]?.[0]
  if (!i1 || !you) return null
  for (let i = 0; i < i1.length; i++) if (i1[i] === 'ვ' && i1.slice(0, i) + i1.slice(i + 1) === you) return i
  return null
}

export interface Cell {
  form: string
  /** Где метка «кого» в слове — для подсветки; null — метки нет (его/их). */
  mark: { at: number; len: number } | null
  /** -თ «вас» в конце, когда её добавила именно «вас» (у «мы/вы» она своя). */
  tail?: boolean
}

/** Форма «кто → кого» времени tense, или null, если так нельзя / правило не подходит. */
export function formFor(verb: Pick<VerbDto, 'tenses'>, tense: TenseKey, who: number, whom: Whom): Cell | null {
  const table = verb.tenses[tense]
  const base = table?.[who]?.[0]
  if (!table || !base || !possible(who, whom)) return null
  const w = whomOf(whom)
  if (!w.mark) return { form: base, mark: null }
  const at = slotOf(table)
  if (at === null) return null
  // Метка «кого» встаёт на место ვ- «я/мы»; у остальных лиц ვ- нет, метка просто встаёт в то же место.
  let form = who === 0 || who === 3 ? base.slice(0, at) + base.slice(at + 1) : base
  form = form.slice(0, at) + w.mark + form.slice(at)
  // «Вас»: -თ в конце (-ს «он» уступает ей место). «Они» её не берут — у них своё окончание.
  const tail = whom === 'youpl' && who !== 5 && !form.endsWith('თ')
  if (tail) form = form.endsWith('ს') ? form.slice(0, -1) + 'თ' : form + 'თ'
  return { form, mark: { at, len: w.mark.length }, tail }
}

/** Перевернуть стороны: «я → его» становится «он → меня». */
export function flip(who: number, whom: Whom): { who: number; whom: Whom } {
  return { who: WHOM_AS_PERSON[whom], whom: PERSON_AS_WHOM[who] }
}

/** Другие «кто → кого», которые пишутся так же (გხედავთ: я → вас, мы → тебя, мы → вас, он → вас). */
export function sameSpelling(verb: Pick<VerbDto, 'tenses'>, tense: TenseKey, who: number, whom: Whom, kase: ObjectCase = 'acc'): string[] {
  const mine = formFor(verb, tense, who, whom)?.form
  if (!mine) return []
  const out: string[] = []
  for (let p = 0; p < 6; p++) for (const w of WHOMS) {
    if (p === who && w.key === whom) continue
    if (formFor(verb, tense, p, w.key)?.form === mine) out.push(`${WHOS[p]} → ${w.ru[kase]}`)
  }
  return out
}

export const hasWhoWhom = (verb: Pick<VerbDto, 'id' | 'objectPerson'>) => objectCaseOf(verb) !== null
