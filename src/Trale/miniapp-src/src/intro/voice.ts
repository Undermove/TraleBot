import { isMuted, playClipToEnd, stopClips } from '../alphabet/games/fx'
import { WORD_AUDIO } from '../alphabet/games/data'
import { INTRO_AUDIO, INTRO_WORD_AUDIO, voicedAudio, type Voice } from './audio'
import { phrase } from './story'

// Один голос на всю сцену: новая реплика останавливает предыдущую, а говорящий знает, когда договорил.
// Так в разговорах звук не накладывается, и следующий ход ждёт конца реплики, а не таймера.

const urlOf = (key: string) => INTRO_AUDIO[key] ?? INTRO_WORD_AUDIO[key] ?? WORD_AUDIO[key]

/** Сколько читать реплику глазами, если записи нет или звук выключен. */
export const readingMs = (geo: string) => 700 + geo.length * 45

let turn = 0

/** Сказать фразу (id из story.json) и дождаться конца. Звук выключен — ждём столько, сколько её читать. */
export async function speak(id: string, voice?: Voice): Promise<void> {
  const mine = ++turn
  stopClips()
  const url = (voice && voicedAudio(id, voice)) || urlOf(id)
  const geo = (() => { try { return phrase(id).geo } catch { return id } })()
  const started = Date.now()
  if (url && !isMuted()) await playClipToEnd(url)
  // Даже короткую запись даём дочитать: пузырь не исчезает раньше, чем его можно прочесть.
  const rest = readingMs(geo) - (Date.now() - started)
  if (rest > 0 && mine === turn) await new Promise(r => setTimeout(r, rest))
}

/** Замолчать (сцена закрылась, человек ушёл). */
export function hush() { turn++; stopClips() }
