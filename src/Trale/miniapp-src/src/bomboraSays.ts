/**
 * Что Бомбора говорит в первом блоке профиля: подбадривает, называет фразу дня или имя человека
 * по-грузински. Здесь — правило «когда что», фразы и память о сказанном на устройстве.
 */

export type SayKind = 'cheer' | 'phrase' | 'name'

export interface DailyPhrase {
  ge: string
  ru: string
  hint?: string
}

// Фразы дня — те же, что раньше жили отдельным разделом профиля.
export const DAILY_PHRASES: DailyPhrase[] = [
  { ge: 'როგორ ხარ?', ru: 'Как дела?', hint: 'Самый частый вопрос на улице' },
  { ge: 'მადლობა', ru: 'Спасибо', hint: 'Можно сократить до მადლი' },
  { ge: 'არაფერი', ru: 'Не за что', hint: 'Дословно — «ничего»' },
  { ge: 'ყავა, თუ შეიძლება', ru: 'Кофе, если можно', hint: 'Вежливая просьба' },
  { ge: 'ნახვამდის', ru: 'До свидания', hint: 'Дословно — «до встречи»' },
  { ge: 'ბოდიში', ru: 'Извини / простите', hint: 'Универсальное' },
  { ge: 'რამდენი ღირს?', ru: 'Сколько стоит?', hint: 'На рынке и в такси' },
  { ge: 'მე მიყვარს', ru: 'Я люблю', hint: 'Дословно — «мне любится»' },
  { ge: 'სუპერ!', ru: 'Супер!', hint: 'Заимствование, но звучит по-грузински' },
  { ge: 'წადი', ru: 'Иди / поехали' },
  { ge: 'რა გქვია?', ru: 'Как тебя зовут?', hint: 'Дословно — «как тебе называется»' },
  { ge: 'აქ', ru: 'Здесь', hint: 'Минимум — два звука' },
  { ge: 'იქ', ru: 'Там', hint: 'И тоже два звука' },
  { ge: 'კარგია', ru: 'Хорошо', hint: 'Дословно — «есть хорошее»' },
]

/** Об имени Бомбора сама вспоминает не чаще, чем раз в столько дней. */
export const NAME_EVERY_DAYS = 4

const STORAGE_KEY = 'bombora_profile_says'

/** Когда Бомбора в последний раз говорила фразу дня и имя: дни вида «2026-10-11». */
export interface SaysMemory {
  phraseDay?: string
  nameDay?: string
}

/** «гггг-мм-дд» по часам устройства: день меняется в полночь у человека, а не по Гринвичу. */
export function dayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const dayNumber = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/** Фраза дня: одна на весь день, по кругу. */
export function phraseOfDay(today: string): DailyPhrase {
  return DAILY_PHRASES[dayNumber(today) % DAILY_PHRASES.length]
}

/**
 * С чего Бомбора начинает, когда профиль открыли.
 * Имя — в самый первый раз и потом изредка; фраза дня — в первый заход за день; иначе подбадривание.
 * Имя и фраза в один заход не попадают: если обе на очереди, имя ждёт следующего захода.
 * remembered = false — память недоступна; тогда про «самый первый раз» ничего не известно,
 * и Бомбора начинает с фразы дня, а имя остаётся по нажатию.
 */
export function pickOpening(memory: SaysMemory, today: string, hasName: boolean, remembered = true): SayKind {
  if (hasName && remembered && !memory.nameDay) return 'name'
  if (memory.phraseDay !== today) return 'phrase'
  if (hasName && memory.nameDay && dayNumber(today) - dayNumber(memory.nameDay) >= NAME_EVERY_DAYS) return 'name'
  return 'cheer'
}

/** Круг реплик по нажатию. Без имени реплики про имя в круге нет. */
export function sayCycle(hasName: boolean): SayKind[] {
  return hasName ? ['cheer', 'phrase', 'name'] : ['cheer', 'phrase']
}

export function nextSay(current: SayKind, hasName: boolean): SayKind {
  const cycle = sayCycle(hasName)
  return cycle[(cycle.indexOf(current) + 1) % cycle.length]
}

export function markSaid(memory: SaysMemory, kind: SayKind, today: string): SaysMemory {
  if (kind === 'phrase') return { ...memory, phraseDay: today }
  if (kind === 'name') return { ...memory, nameDay: today }
  return memory
}

// Копия в памяти вкладки: без хранилища Бомбора хотя бы не повторяется, пока мини-апп открыт.
let inMemory: SaysMemory | null = null

/** Забыть копию в памяти — для тестов и кнопки сброса в панели владельца. */
export function resetSaysMemory() {
  inMemory = null
}

export function loadSaysMemory(): { memory: SaysMemory; remembered: boolean } {
  if (inMemory) return { memory: inMemory, remembered: true }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    const memory: SaysMemory = {}
    if (typeof parsed?.phraseDay === 'string') memory.phraseDay = parsed.phraseDay
    if (typeof parsed?.nameDay === 'string') memory.nameDay = parsed.nameDay
    return { memory, remembered: true }
  } catch {
    return { memory: {}, remembered: false }
  }
}

export function saveSaysMemory(memory: SaysMemory) {
  inMemory = memory
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory))
  } catch {
    // Хранилища нет — остаётся копия в памяти.
  }
}
