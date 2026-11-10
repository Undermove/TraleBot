import { PRO_MODULE_IDS, Screen } from './types'

// Платный модуль открывают не только плиткой на главной: ещё ссылкой из пуша или рассылки
// (?moduleId=…&lessonId=…), кнопкой «любимый модуль» в профиле, ссылкой на урок из карточки глагола.
// Замок на плитке всё это не закрывает, поэтому проверка одна — там, где App меняет экран.

/** Экраны, которыми входят в модуль или урок. Итога урока здесь нет: его показываем тому, кто урок уже прошёл. */
const ENTRY_KINDS: ReadonlySet<Screen['kind']> = new Set(['module', 'lesson-theory', 'practice', 'practice-mistakes'])

/** Экран ведёт в платный модуль, а доступа (подписки или бесплатного периода) нет — вместо него экран покупки. */
export function needsPurchase(screen: Screen, hasAccess: boolean): boolean {
  if (hasAccess || !ENTRY_KINDS.has(screen.kind)) return false
  return 'moduleId' in screen && PRO_MODULE_IDS.has(screen.moduleId)
}
