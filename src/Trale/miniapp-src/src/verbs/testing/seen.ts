import { seenKey } from '../ui/GameShell'
import { loadSeenHints, uiHintKey } from '../ui/hints'

// Только для тестов: отметки «правила уже показывали» и «первый ход уже сделан» —
// теми же ключами, что GameShell отправляет на сервер (ui/hints.ts).

/** Игра уже открывалась: шторка с правилами сама не выезжает. */
export const rulesSeen = (id: string) => loadSeenHints([uiHintKey(seenKey(id))])
/** Первый ход уже сделан: подсказок и подсветки нет. */
export const moveSeen = (id: string) => loadSeenHints([uiHintKey(seenKey(id + '_move'))])
