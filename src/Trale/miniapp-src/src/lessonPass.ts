// Когда урок засчитан. В «Алфавите» — первых уроках новичка — прощается одна ошибка: один неверный ответ
// из четырёх был местом, где новички бросали. В остальных модулях нужно ответить верно на все.
// То же правило на сервере: LearningConstants.Modules.MistakesAllowed.

export const mistakesAllowed = (moduleId: string) => (moduleId === 'alphabet-progressive' ? 1 : 0)

export const lessonPassed = (moduleId: string, correct: number, total: number) =>
  total > 0 && correct <= total && correct >= total - mistakesAllowed(moduleId)
