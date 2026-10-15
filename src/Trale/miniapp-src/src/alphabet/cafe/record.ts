// Рекорд смены в кафе — свой для каждого урока алфавита, на этом устройстве (localStorage).
// Хранилища может не быть (приватный режим, превью) — тогда рекорда просто нет, игра идёт как обычно.

const key = (lesson: number) => `alphabet_cafe_best_${lesson}`

export function loadRecord(lesson: number): number {
  try {
    const n = Number(localStorage.getItem(key(lesson)))
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch { return 0 }
}

/** Записать итог смены. Новый рекорд — если обслужено больше прежнего (и хоть один гость). */
export function saveRecord(lesson: number, served: number): { best: number; isNew: boolean } {
  const before = loadRecord(lesson)
  const isNew = served > before && served > 0
  if (isNew) { try { localStorage.setItem(key(lesson), String(served)) } catch { /* нет хранилища */ } }
  return { best: Math.max(before, served), isNew }
}
