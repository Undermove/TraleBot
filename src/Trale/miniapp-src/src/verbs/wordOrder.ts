// Сборка фразы из слов — одно правило для лесенки и для комикса.
// Порядок слов в грузинском гибкий, а проверить чужой порядок нам нечем: в базе есть только фраза
// из источника. Поэтому другой порядок тех же слов не называем ошибкой и засчитываем, но и не говорим
// «так тоже правильно» — показываем, как фраза стоит в источнике.

/** Слова фразы без знаков препинания по краям — из них фраза собирается. */
export const sentenceWords = (ka: string) =>
  ka.split(/\s+/).map(w => w.replace(/^[^ა-ჰ]+|[^ა-ჰ]+$/g, '')).filter(Boolean)

/** exact — слово в слово как в источнике; order — те же слова в другом порядке. */
export type OrderVerdict = 'exact' | 'order'

/** Сверяет собранное с источником. Ждёт, что собраны все слова фразы и только они. */
export function wordOrderVerdict(built: string[], sourceKa: string): OrderVerdict {
  const source = sentenceWords(sourceKa)
  return built.length === source.length && built.every((w, i) => w === source[i]) ? 'exact' : 'order'
}

/** Что сказать, когда слова те, а порядок другой. */
export const orderNote = (sourceKa: string) =>
  `Засчитано: слова те. Порядок слов в грузинском гибкий, но не любой — в источнике фраза такая: ${sourceKa}`
