// Что значит форма — простыми русскими словами, без названий времён: «я хочу», «ты хотел(а)»,
// «мы будем писать». Фразы собираются из русских форм перевода (ru-forms.json, см. ru-forms.py)
// и попадают в verbs.json как meanings: время → шесть фраз по лицам. Только для шести главных
// времён карточки: редкие времена в упражнениях не участвуют.

export const MAIN_TENSES = ['present', 'aorist', 'imperfect', 'optative', 'conditional', 'future']

const WHO = ['я', 'ты', 'он', 'мы', 'вы', 'они']
const WHOM = ['мне', 'тебе', 'ему', 'нам', 'вам', 'им']
const WILL = ['буду', 'будешь', 'будет', 'будем', 'будете', 'будут']

/**
 * Пометка, которая различает два времени с одинаковой русской фразой: «я писал(а)» — это и
 * имперфект, и аорист. Показывается только у глаголов, где фразы действительно совпали.
 */
export const CHIPS = { present: 'сейчас', future: 'потом', imperfect: 'долго или часто', aorist: 'один раз · сделано' }

/** Прошедшее для лица: у «я» и «ты» род неизвестен — «хотел(а)», «шёл / шла». */
export function past(forms, person) {
  const { m, f, pl } = forms.past
  if (person >= 3) return pl
  if (person === 2) return m
  return f === m + 'а' ? `${m}(а)` : `${m} / ${f}`
}

function phrase(forms, tense, person) {
  const who = WHO[person]
  switch (tense) {
    case 'present':
      // У глагола совершенного вида настоящего нет: его личные формы — уже будущее.
      return forms.present ? `${who} ${forms.present[person]}` : null
    case 'aorist':
    case 'imperfect':
      return `${who} ${past(forms, person)}`
    case 'future':
      return forms.future ? `${who} ${forms.future[person]}` : `${who} ${WILL[person]} ${forms.inf}`
    case 'optative':
      return `${WHOM[person]} надо ${forms.inf}`
    case 'conditional':
      return `${who} бы ${past(forms, person)}`
    default:
      return null
  }
}

/**
 * Фразы для времён, которые есть у глагола. Возвращает { meanings, chips, problems }:
 * chips — пометки для времён, чьи фразы совпали с другим временем; problems — почему собрать не вышло.
 */
export function meaningsOf(forms, tenses) {
  const meanings = {}, problems = []
  for (const tense of MAIN_TENSES.filter(t => tenses.includes(t))) {
    const row = forms.phrases
      ? forms.phrases[tense]
      : WHO.map((_, person) => {
          const text = phrase(forms, tense, person)
          return text && forms.tail ? `${text} ${forms.tail}` : text
        })
    if (!row || row.length !== 6 || row.some(text => !text)) { problems.push(`нет русской фразы для времени ${tense}`); continue }
    meanings[tense] = row
  }

  const chips = {}
  const built = Object.keys(meanings)
  for (const tense of built) {
    if (built.some(other => other !== tense && meanings[other].some((text, person) => text === meanings[tense][person]))) {
      if (CHIPS[tense]) chips[tense] = CHIPS[tense]
    }
  }
  // Фраза вместе с пометкой должна однозначно называть клетку: иначе в упражнении два одинаковых варианта.
  for (let person = 0; person < 6; person++) {
    const seen = new Map()
    for (const tense of built) {
      const key = `${meanings[tense][person]}|${chips[tense] ?? ''}`
      if (seen.has(key)) problems.push(`«${meanings[tense][person]}» — одинаково для ${seen.get(key)} и ${tense}`)
      seen.set(key, tense)
    }
  }
  return { meanings, chips, problems }
}
