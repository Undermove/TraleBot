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
  /** Масдар с превербом, если он есть (დაწერა при წერა). */
  masdarWithPreverb: string[]
  reason: string
  /** Корень для подсветки; пусто у особых глаголов. */
  root: string
  oddTenses: TenseKey[]
  model: { id: string; title: string; ru: string } | null
  /** tense → шесть лиц → варианты формы. */
  tenses: Partial<Record<TenseKey, string[][]>>
  /** Живые предложения (Tatoeba), в которых встречается форма этого глагола. */
  sentences: VerbSentenceDto[]
  source: string
  /** verified — формы проверены по источнику; generated — сделаны моделью. Игры строятся только по проверенным. */
  status?: 'verified' | 'generated'
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
}

export const TENSES: Record<TenseKey, { name: string; gloss: string }> = {
  present: { name: 'Настоящее', gloss: 'делаю' },
  aorist: { name: 'Аорист', gloss: 'сделал — прошедшее с результатом' },
  imperfect: { name: 'Имперфект', gloss: 'делал — прошедшее как процесс' },
  optative: { name: 'Конъюнктив аориста', gloss: 'после უნდა: должен сделать' },
  conditional: { name: 'Условное', gloss: 'сделал бы' },
  future: { name: 'Будущее', gloss: 'сделаю' },
  presentSubjunctive: { name: 'Конъюнктив настоящего', gloss: 'чтобы делал' },
  futureSubjunctive: { name: 'Конъюнктив будущего', gloss: 'если бы сделал' },
  perfect: { name: 'Перфект', gloss: 'оказывается, сделал' },
  pluperfect: { name: 'Плюсквамперфект', gloss: 'должен был сделать' },
  perfectSubjunctive: { name: 'Конъюнктив перфекта', gloss: 'пожелания, тосты' }
}

/** Шесть строк карточки — главные формы, в порядке, в котором их удобно учить. */
export const CARD_TENSES: TenseKey[] = ['present', 'aorist', 'imperfect', 'optative', 'conditional', 'future']
export const RARE_TENSES: TenseKey[] = ['presentSubjunctive', 'futureSubjunctive', 'perfect', 'pluperfect', 'perfectSubjunctive']

export const PERSONS = ['я', 'ты', 'он', 'мы', 'вы', 'они']

export const KINDS: Record<VerbKind, { label: string; chip: string }> = {
  pattern: { label: 'По образцу', chip: 'bg-navy-wash' },
  feature: { label: 'С особенностью', chip: 'bg-gold-wash' },
  special: { label: 'Особый', chip: 'bg-ruby-wash' }
}
export const KIND_ORDER: VerbKind[] = ['pattern', 'feature', 'special']

const CYR: Record<string, string> = {
  ა: 'а', ბ: 'б', გ: 'г', დ: 'д', ე: 'э', ვ: 'в', ზ: 'з', თ: 'т', ი: 'и', კ: 'к’', ლ: 'л',
  მ: 'м', ნ: 'н', ო: 'о', პ: 'п’', ჟ: 'ж', რ: 'р', ს: 'с', ტ: 'т’', უ: 'у', ფ: 'п', ქ: 'к',
  ღ: 'гх', ყ: 'къ', შ: 'ш', ჩ: 'ч', ც: 'ц', ძ: 'дз', წ: 'ц’', ჭ: 'ч’', ხ: 'х', ჯ: 'дж', ჰ: 'х'
}
/** Кириллическая транскрипция грузинского слова. */
export const cyr = (s: string) => [...s].map(c => CYR[c] ?? c).join('')

export const isGeorgian = (s: string) => /[ა-ჰ]/.test(s)
