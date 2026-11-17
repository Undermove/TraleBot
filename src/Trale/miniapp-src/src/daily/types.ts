// «Задание дня»: сервер собирает занятие на сегодня из того, что человек уже учил
// (GET /api/miniapp/daily-task), мини-апп его проводит и сообщает итог.
// Все тексты приходят с сервера готовыми; транскрипцию грузинского (cyr) мини-апп ставит сам.

/** Форма глагола или слово из словаря. */
export interface DailyItem {
  /** Глагол: «v:<лемма>:<время>:<лицо>», слово словаря: «w:<id записи>». */
  key: string
  kind: 'verb' | 'word'
  ka: string
  ru: string
  /** Только у форм глагола. */
  lemma?: string
  verbRu?: string
  tense?: string
  person?: number
}

/** Раунд разминки: грузинская форма и варианты перевода. */
export interface DailyWarmRound {
  item: DailyItem
  options: { ru: string; ok: boolean }[]
}

/** Вариант проверки: одна форма из игры среди похожих. */
export interface DailyPick {
  item: DailyItem
  ok: boolean
  /** Что сказать после нажатия: «Верно: …» или «… — это «…». Нажми другую форму.» */
  message: string
}

/** Новое в конце: формы глагола, урок курса или минутная проверка модуля. */
export interface DailyNew {
  kind: 'forms' | 'lesson' | 'check'
  /** «Новые формы глагола «иметь»» · «Падежи» · «Знакомство». */
  title: string
  /** «урок 8 из 10 · Итоговое повторение» · «проверка на минуту» · «прошедшее: сделал». */
  line: string
  /** Реплика Бомборы: почему именно это. */
  say: string
  /** Подпись кнопки: «Открыть новые формы» · «Пройти урок» · «Пройти проверку». */
  button: string
  /** forms: лемма глагола — открыть его сессию. */
  verbId?: string
  /** lesson и check: модуль; lesson: урок. */
  moduleId?: string
  lessonId?: number
  /** check: уроки, из которых брать вопросы (по одному вопросу из урока, всего шесть). */
  checkLessons?: number[]
}

export interface DailyResult {
  errors: number
  xpEarned: number
  streak: number
}

export interface DailyTaskDto {
  /** false — собирать не из чего (нет ни форм, ни слов): карточку не показываем. */
  available: boolean
  /** День задания, «2026-11-16» (UTC, как серия). */
  day: string
  done: boolean
  mode: 'comeback' | 'review' | 'mix'
  level: 1 | 2 | 3
  /** «Обычный день» · «Закрепляем» · «Возвращение». */
  title: string
  /** Реплики Бомборы перед началом (те же, что в сообщении бота) и подпись кнопки. */
  chat: string[]
  button: string
  /** Почему задание собрано так — для шторки «Почему так». */
  why: string[]
  /** Секунд на игру в пары. */
  seconds: number
  /** Разминка; пустой список — разминки нет. */
  warm: DailyWarmRound[]
  /** Пары для игры: грузинское — русское. */
  pairs: DailyItem[]
  check: { prompt: string; intro: string; picks: DailyPick[] }
  /** Что будет предложено в конце, если игра пройдёт чисто (не больше одной ошибки). */
  next: DailyNew | null
  /** После итога: что предложено на самом деле; null — нового сегодня нет. */
  offer: DailyNew | null
  /** Предложение уже открывали или проверку уже прошли — повторно не зовём. */
  offerTaken: boolean
  result: DailyResult | null
  /** Только на стенде: показать кнопки «следующий день». */
  dev: boolean
}

/** POST /api/miniapp/daily-task/result */
export interface DailyReportDto {
  day: string
  /** Ключи форм разминки, на которых была ошибка. */
  warmWrong: string[]
  /** Ключи пар, на которых была хотя бы одна ошибка. */
  pairWrong: string[]
  /** Сколько всего неверных попыток в игре в пары (включая несобранные из-за времени). */
  errors: number
  checkErrors: number
  seconds: number
}

export interface DailySavedDto {
  task: DailyTaskDto
  xpEarned: number
  /** Прогресс мини-аппа после зачёта (опыт, серия) — как после урока. */
  progress: import('../types').ProgressState | null
}

/** POST /api/miniapp/daily-task/offer: предложение открыли, либо итог минутной проверки. */
export interface DailyOfferReportDto {
  day: string
  outcome: 'opened' | 'passed' | 'failed'
}
