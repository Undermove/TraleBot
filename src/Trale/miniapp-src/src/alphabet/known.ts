/**
 * Буквы, которые человек уже открыл в знакомстве с приложением (экран Welcome): там он стирает картинку
 * и пишет ა. Первый урок алфавита тогда не повторяет это целиком: на стартовом экране у ა — «уже знаешь»,
 * а её знакомство — короткое «вспомним» (слово, звук, запись). Хранится на устройстве; без него урок обычный.
 */
const KEY = 'bombora_welcome_letters'

export function welcomeLetters(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[] } catch { return [] }
}

export function markWelcomeLetter(letter: string) {
  try {
    const now = welcomeLetters()
    if (!now.includes(letter)) localStorage.setItem(KEY, JSON.stringify([...now, letter]))
  } catch { /* приватный режим — урок просто будет обычным */ }
}

/** Знакомство с буквой в уроке можно сократить до «вспомним». Только первый урок и только ა. */
export const recapLetter = (lessonId: number, letter: string) => lessonId === 1 && letter === 'ა' && welcomeLetters().includes(letter)
