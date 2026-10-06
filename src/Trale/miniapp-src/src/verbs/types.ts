// Раздел «Глаголы»: типы ответов API и справочники для отображения.

export type TenseKey =
  | 'present' | 'imperfect' | 'presentSubjunctive'
  | 'future' | 'conditional' | 'futureSubjunctive'
  | 'aorist' | 'optative'
  | 'perfect' | 'pluperfect' | 'perfectSubjunctive'

/** pattern — спрягается по образцу; feature — тот же корень, но схема ломается; special — разные корни. */
export type VerbKind = 'pattern' | 'feature' | 'special'

export interface VerbSummaryDto {
  id: string
  title: string
  ru: string
  kind: VerbKind
  /** Форма «я» в настоящем — показывается в строке списка. */
  present: string[]
}

export interface VerbDto extends VerbSummaryDto {
  /** Название действия с приставкой, если оно есть (დაწერა при წერა). */
  masdarWithPreverb: string[]
  reason: string
  /** Корень для подсветки; пусто у особых глаголов. */
  root: string
  oddTenses: TenseKey[]
  model: { id: string; title: string; ru: string } | null
  /** tense → шесть лиц → варианты формы. */
  tenses: Partial<Record<TenseKey, string[][]>>
  /** Что значит каждая форма простыми словами: время → шесть фраз («я хочу», «ты хочешь», …). Только главные времена. */
  meanings?: Partial<Record<TenseKey, string[]>> | null
  /** Пометки для времён, у которых русская фраза совпала с другим временем («один раз · сделано»). */
  meaningChips?: Partial<Record<TenseKey, string>> | null
  /** Живые предложения (Tatoeba), в которых встречается форма этого глагола. */
  sentences: VerbSentenceDto[]
  /** Нет у глагола, формы которого составила модель. */
  source: string | null
  /** generated — таблицы в источнике нет: запись составила одна модель и одобрила вторая; учится и играется как любой глагол. Нет поля — verified. */
  status?: 'verified' | 'generated'
  /** У глагола, добавленного по запросу: на чём держатся формы и перевод (что сверено с источниками). */
  verification?: string | null
}

export interface VerbSentenceDto {
  id: number
  ka: string
  ru: string
  /** Какая форма глагола стоит в предложении. */
  form: string
}

export interface VerbFormHitDto {
  form: string
  verbId: string
  title: string
  ru: string
  tense: TenseKey
  person: number
  /** Форма простыми словами: «я хотел(а)». Нет — у редких времён и глаголов, добавленных на лету. */
  meaning?: string | null
  /** Пометка, когда у двух времён фраза одна: «один раз · сделано». Обычно нет. */
  meaningNote?: string | null
  /** Только в словаре: запись — это сама форма глагола, а не фраза, в которой она есть. Такая запись открывает вид глагола. */
  single?: boolean
  /** Только в словаре: уровень знания этого глагола. */
  level?: import('./session/types').VerbLevelKey
}

/** Один из «моих глаголов»: его формы сохранены в словаре, или с ним уже играли, или и то и другое. */
export interface MyVerbDto {
  id: string
  title: string
  ru: string
  level: import('./session/types').VerbLevelKey
  started: boolean
  /** Формы этого глагола, сохранённые в словаре; пусто у глагола, начатого из урока или перевода. */
  saved: VerbFormHitDto[]
}

/**
 * Как время называется в интерфейсе — простыми словами, по тому, что оно говорит (name), — и как оно
 * называется в учебниках (term). Учебный термин показывается только внутри свёрнутого пояснения
 * карточки («что это значит?»); в заданиях, таблице и подсказках его нет. Примером времени служит
 * русская фраза самой формы («я писал(а)», см. meaning.ts), поэтому отдельного образца здесь нет.
 */
export const TENSES: Record<TenseKey, { name: string; term: string }> = {
  present: { name: 'Сейчас', term: 'настоящее время' },
  aorist: { name: 'Прошедшее: сделал', term: 'аорист' },
  imperfect: { name: 'Прошедшее: делал', term: 'имперфект' },
  optative: { name: 'Надо сделать', term: 'оптатив, или конъюнктив аориста' },
  conditional: { name: 'Сделал бы', term: 'условное наклонение' },
  future: { name: 'Будущее', term: 'будущее время' },
  presentSubjunctive: { name: 'Чтобы делал', term: 'конъюнктив настоящего' },
  futureSubjunctive: { name: 'Если бы сделал', term: 'конъюнктив будущего' },
  perfect: { name: 'Оказывается, сделал', term: 'перфект' },
  pluperfect: { name: 'Должен был сделать', term: 'плюсквамперфект' },
  perfectSubjunctive: { name: 'Пожелание, тост', term: 'конъюнктив перфекта' }
}

/** Как в учебниках называется форма-заголовок карточки (название действия). Тоже только для пояснения. */
export const TITLE_TERM = 'масдар'

/** Шесть строк карточки — главные формы, в порядке, в котором их удобно учить. */
export const CARD_TENSES: TenseKey[] = ['present', 'aorist', 'imperfect', 'optative', 'conditional', 'future']
export const RARE_TENSES: TenseKey[] = ['presentSubjunctive', 'futureSubjunctive', 'perfect', 'pluperfect', 'perfectSubjunctive']

export const PERSONS = ['я', 'ты', 'он', 'мы', 'вы', 'они']

export const KINDS: Record<VerbKind, { label: string; chip: string }> = {
  pattern: { label: 'По образцу', chip: 'bg-navy-wash' },
  feature: { label: 'С особенностью', chip: 'bg-gold-wash' },
  special: { label: 'Особый', chip: 'bg-ruby-wash' }
}

const CYR: Record<string, string> = {
  ა: 'а', ბ: 'б', გ: 'г', დ: 'д', ე: 'э', ვ: 'в', ზ: 'з', თ: 'т', ი: 'и', კ: 'к’', ლ: 'л',
  მ: 'м', ნ: 'н', ო: 'о', პ: 'п’', ჟ: 'ж', რ: 'р', ს: 'с', ტ: 'т’', უ: 'у', ფ: 'п', ქ: 'к',
  ღ: 'гх', ყ: 'къ', შ: 'ш', ჩ: 'ч', ც: 'ц', ძ: 'дз', წ: 'ц’', ჭ: 'ч’', ხ: 'х', ჯ: 'дж', ჰ: 'х'
}
/** Кириллическая транскрипция грузинского слова. */
export const cyr = (s: string) => [...s].map(c => CYR[c] ?? c).join('')

