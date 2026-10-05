import { seenKey } from '../ui/GameShell'

// Только для тестов: отметки «правила уже показывали» и «первый ход уже сделан» —
// теми же ключами, что пишет GameShell.

/** Игра уже открывалась: шторка с правилами сама не выезжает. */
export const rulesSeen = (id: string) => localStorage.setItem(seenKey(id), '1')
/** Первый ход уже сделан: подсказок и подсветки нет. */
export const moveSeen = (id: string) => localStorage.setItem(seenKey(id + '_move'), '1')
