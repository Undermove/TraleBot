// Глаголы, которых в verbs.raw.json нет вовсе: статья Викисловаря есть, а таблицы спряжения в ней нет
// (у იცნობს «знать кого-то» — помета rfinfl). Запись в supplements.json с полем verb даёт такому глаголу
// то, что остальным даёт выгрузка, — масдар, толкование, ссылку на статью; формы — её же tenses.
// Читают collect-evidence.mjs (частотность и предложения) и build-catalog.mjs (каталог).
//
//   withForms — сразу с формами из tenses (collect-evidence); без него tenses пустые, их вписывает
//               и проверяет блок «дополнения» в build-catalog.mjs, как у любого дополненного глагола.
export const handWritten = (supplements, { withForms = false } = {}) =>
  Object.entries(supplements).filter(([, s]) => s.verb).map(([lemma, s]) => ({
    lemma,
    lemmaFrom: 'supplements',
    masdar: { imperfective: [], perfective: [], head: s.verb.masdar },
    en: s.verb.en,
    tenses: withForms ? structuredClone(s.tenses ?? {}) : {},
    alt: [],
    source: s.verb.source,
    homographs: [],
    homographForms: [],
    pages: [{ word: lemma, url: s.verb.source, en: s.verb.en }],
    notes: []
  }))
