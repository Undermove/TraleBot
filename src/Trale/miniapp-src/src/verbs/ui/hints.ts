import { markUiHintSeen } from '../../api'

// Одноразовые подсказки интерфейса: правила игры при первом входе, подсветка первого хода,
// «нажми „ты“ — таблица переключится». Что уже показано — хранит сервер (тот же список, что у
// подсказок онбординга: MiniAppUserProgress.OnboardingHintsJson), поэтому после перезагрузки и на
// другом устройстве подсказка не возвращается. Здесь — копия этого списка на время работы мини-аппа.

const seen = new Set<string>()

/** Ключ подсказки на сервере. */
export const uiHintKey = (id: string) => `ui:${id}`

/** Список с сервера (ответ /me) — при запуске мини-аппа. */
export function loadSeenHints(keys: readonly string[] | null | undefined) {
  for (const key of keys ?? []) seen.add(key)
}

export const hintSeen = (id: string) => seen.has(uiHintKey(id))

/** Подсказку показали. Не дошло до сервера — она просто покажется ещё раз в следующий запуск. */
export function markHintSeen(id: string) {
  const key = uiHintKey(id)
  if (seen.has(key)) return
  seen.add(key)
  try { void markUiHintSeen(key).catch(() => {}) } catch { /* нет сети или api подменён в тесте */ }
}

/** Только для тестов: начать с чистого листа. */
export function resetSeenHints() {
  seen.clear()
}
