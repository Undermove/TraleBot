// Ссылка на урок из карточки глагола и из сцены: они открыты поверх любого экрана и о навигации
// App не знают. Публикуют просьбу — App подписан и открывает модуль (как с прогрессом в progress.ts).

type Listener = (moduleId: string) => void
const listeners = new Set<Listener>()

export function openLessonModule(moduleId: string) {
  listeners.forEach(listener => listener(moduleId))
}

export function onOpenLessonModule(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
