// Что можно собрать из подарков дня (ids — как в GiftCatalog на сервере). Слова и открытки — в treasures.json.

export type Slot = 'head' | 'eyes' | 'neck'

export interface ItemInfo { id: string; slot: Slot; name: string; golden?: boolean }

export const ITEMS: ItemInfo[] = [
  { id: 'beret', slot: 'head', name: 'Берет' },
  { id: 'cap', slot: 'head', name: 'Кепка' },
  { id: 'wreath', slot: 'head', name: 'Венок' },
  { id: 'crown', slot: 'head', name: 'Корона', golden: true },
  { id: 'round-glasses', slot: 'eyes', name: 'Круглые очки' },
  { id: 'sunglasses', slot: 'eyes', name: 'Тёмные очки' },
  { id: 'star-glasses', slot: 'eyes', name: 'Очки-звёзды', golden: true },
  { id: 'scarf-navy', slot: 'neck', name: 'Синий шарф' },
  { id: 'scarf-gold', slot: 'neck', name: 'Золотой шарф' },
  { id: 'scarf-kilim', slot: 'neck', name: 'Шарф с узором', golden: true },
  { id: 'bow-tie', slot: 'neck', name: 'Бабочка' }
]

export const FURNITURE: { id: string; name: string }[] = [
  { id: 'bowl', name: 'Миска' },
  { id: 'rug', name: 'Коврик' },
  { id: 'pillow', name: 'Подушка' },
  { id: 'lamp', name: 'Лампа' },
  { id: 'plant', name: 'Цветок' },
  { id: 'shelf', name: 'Полка с книгами' },
  { id: 'picture', name: 'Картина' },
  { id: 'clock', name: 'Часы' }
]

export interface Stash {
  hints: number
  words: string[]
  cards: string[]
  items: string[]
  furniture: string[]
  wear: Partial<Record<Slot, string>>
}

export interface TreasureWord { id: string; ka: string; tr: string; ru: string; story: string }
export interface TreasureCard { id: string; ka: string; tr: string; ru: string; when: string }

/** Что пришло с сервера: собранное + сами слова и открытки + сколько их всего. */
export interface Collection { stash: Stash; words: TreasureWord[]; cards: TreasureCard[]; wordsTotal: number; cardsTotal: number }

export const EMPTY_STASH: Stash = { hints: 0, words: [], cards: [], items: [], furniture: [], wear: {} }
