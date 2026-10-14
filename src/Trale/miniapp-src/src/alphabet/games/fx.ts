import { burst, floater } from '../../verbs/ui/juice'

// «Сочность» игр алфавита: вибрация через Telegram HapticFeedback (в браузере — navigator.vibrate),
// короткие звуки, собранные WebAudio на лету, записи букв через <audio> и уважение к prefers-reduced-motion.

export type Haptic = 'tap' | 'pop' | 'snap' | 'good' | 'bad' | 'soft'

export function haptic(kind: Haptic) {
  const tg = (window as any).Telegram?.WebApp?.HapticFeedback
  try {
    if (tg) {
      if (kind === 'tap') tg.impactOccurred('light')
      else if (kind === 'pop') tg.impactOccurred('medium')
      else if (kind === 'snap') tg.impactOccurred('rigid')
      else if (kind === 'soft') tg.impactOccurred('soft')
      else tg.notificationOccurred(kind === 'good' ? 'success' : 'error')
    } else {
      const pattern = { tap: 8, pop: 14, snap: 10, soft: 6, good: [12, 40, 18], bad: [30, 30, 30] }[kind]
      navigator.vibrate?.(pattern)
    }
  } catch { /* вибрации нет — играем без неё */ }
}

export function reducedMotion(): boolean {
  try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

// ───────────── Звук ─────────────

const MUTE_KEY = 'alphabet_games_muted'
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false } })()
const listeners = new Set<(m: boolean) => void>()

export const isMuted = () => muted
export function setMuted(m: boolean) {
  muted = m
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch { /* приватный режим */ }
  listeners.forEach(f => f(m))
}
export function onMuteChange(f: (m: boolean) => void) { listeners.add(f); return () => { listeners.delete(f) } }

// iPhone в Telegram: WebAudio по умолчанию — «фоновый» звук, его глушит переключатель «Без звука», а
// AudioContext в WKWebView остаётся suspended, пока его не разбудили внутри касания. Поэтому:
// 1) просим у браузера сессию «playback» (navigator.audioSession, Safari 17+) до создания контекста;
// 2) на первом касании будим контекст (await resume), играем тишину через WebAudio и через <audio> —
//    последнее переключает аудиосессию iOS на «медиа», и дальше звук идёт и при выключенном звонке.

let ctx: AudioContext | null = null

function playbackSession() {
  try {
    const s = (navigator as any).audioSession
    if (s && s.type !== 'playback') s.type = 'playback'
  } catch { /* нет API — не страшно */ }
}

function context(): AudioContext | null {
  try {
    if (ctx) return ctx
    const Ctor = (window as any).AudioContext ?? (window as any).webkitAudioContext
    if (!Ctor) return null
    playbackSession()
    ctx = new Ctor()
    return ctx
  } catch { return null }
}

/** Секунда тишины в WAV (8 кГц, 8 бит) — для разблокировки <audio> на iOS. */
const SILENT_WAV = (() => {
  const n = 800
  const bytes = new Uint8Array(44 + n)
  const v = new DataView(bytes.buffer)
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true)
  str(36, 'data'); v.setUint32(40, n, true)
  bytes.fill(128, 44)
  let bin = ''
  bytes.forEach(b => { bin += String.fromCharCode(b) })
  return `data:audio/wav;base64,${typeof btoa === 'function' ? btoa(bin) : ''}`
})()

/** play() может вернуть промис, undefined или бросить (старые браузеры, jsdom) — приводим к промису. */
function safePlay(el: HTMLAudioElement): Promise<void> {
  try {
    const p = el.play() as Promise<void> | undefined
    return p && typeof p.then === 'function' ? p : Promise.resolve()
  } catch (e) { return Promise.reject(e) }
}

let unlocked = false
/**
 * Разбудить звук внутри касания. Вызывается из обработчика жеста (pointerdown/touchend/click);
 * resume() ждём там же — iOS считает это частью жеста.
 */
export async function unlockAudio(): Promise<void> {
  if (unlocked) return
  playbackSession()
  const tag = (() => { try { const el = new Audio(SILENT_WAV); el.setAttribute('playsinline', ''); return safePlay(el).catch(() => {}) } catch { return Promise.resolve() } })()
  const a = context()
  if (a) {
    try {
      if (a.state !== 'running') await a.resume()
      const src = a.createBufferSource()
      src.buffer = a.createBuffer(1, 1, 22050)
      src.connect(a.destination)
      src.start(0)
    } catch { /* без звука */ }
  }
  await tag
  if (!a || a.state === 'running') unlocked = true
}

if (typeof window !== 'undefined') {
  const onGesture = () => {
    void unlockAudio().then(() => {
      if (!unlocked) return
      for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.removeEventListener(ev, onGesture, true)
    })
  }
  for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(ev, onGesture, true)
}

/** Контекст, готовый играть: если он ещё спит — пробуем разбудить и играем после. */
function withAudio(play: (a: AudioContext) => void) {
  if (muted) return
  const a = context()
  if (!a) return
  try {
    if (a.state === 'running') play(a)
    else void a.resume().then(() => { if (a.state === 'running') play(a) }).catch(() => {})
  } catch { /* браузер не дал звук */ }
}

// ───────────── Записи (буквы) ─────────────

const clips = new Map<string, HTMLAudioElement>()
function clip(url: string): HTMLAudioElement | null {
  try {
    let el = clips.get(url)
    if (!el) {
      el = new Audio(url)
      el.preload = 'auto'
      el.setAttribute('playsinline', '')
      clips.set(url, el)
    }
    return el
  } catch { return null }
}

/** Сыграть запись (уважает выключатель звука). */
export function playClip(url: string): Promise<void> {
  if (muted) return Promise.resolve()
  const el = clip(url)
  if (!el) return Promise.resolve()
  try { el.pause(); el.currentTime = 0; el.muted = false } catch { /* ещё не загрузилась */ }
  return safePlay(el).catch(() => {})
}

/** Один тон: частота от f0 к f1, громкость спадает. */
function tone(f0: number, f1: number, ms: number, type: OscillatorType = 'sine', gain = 0.16, delay = 0) {
  withAudio(a => {
    const t = a.currentTime + delay / 1000
    const o = a.createOscillator(), g = a.createGain()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + ms / 1000)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000)
    o.connect(g).connect(a.destination)
    o.start(t); o.stop(t + ms / 1000 + 0.02)
  })
}

let noiseBuf: AudioBuffer | null = null
/** Короткий шорох: белый шум через полосовой фильтр. */
function hiss(ms: number, freq: number, gain = 0.05) {
  withAudio(a => {
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, Math.floor(a.sampleRate * 0.3), a.sampleRate)
      const d = noiseBuf.getChannelData(0)
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    }
    const t = a.currentTime
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain()
    src.buffer = noiseBuf
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.4
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000)
    src.connect(f).connect(g).connect(a.destination)
    src.start(t, Math.random() * 0.2); src.stop(t + ms / 1000 + 0.02)
  })
}

/** Полутон вверх n раз: серия звучит всё выше. */
const up = (f: number, n: number) => f * Math.pow(2, Math.min(n, 14) / 12)

export const sound = {
  /** Лопнула буква / пузырь. step — номер в серии, каждый следующий выше. */
  pop: (step = 0) => tone(up(520, step), up(900, step), 110, 'triangle', 0.18),
  /** Плитка встала на место — сухой щелчок. */
  snap: (step = 0) => { tone(up(1400, step), up(700, step), 45, 'square', 0.06); tone(up(260, step), up(180, step), 70, 'sine', 0.14) },
  /** Буква перетекла. */
  morph: (step = 0) => { tone(up(330, step), up(660, step), 180, 'sine', 0.14); tone(up(495, step), up(990, step), 160, 'triangle', 0.06, 30) },
  /** Мимо — глухо и не обидно. */
  miss: () => tone(200, 120, 140, 'sine', 0.12),
  /** Получилось: короткое арпеджио. */
  win: () => [0, 4, 7, 12].forEach((s, i) => tone(up(523, s), up(523, s), 220, 'triangle', 0.13, i * 85)),
  /** Палец трёт поверхность. */
  scratch: () => hiss(70, 2200 + Math.random() * 1600, 0.045),
  /** Палец ведёт по букве — мягкий мелок. */
  chalk: () => hiss(60, 900 + Math.random() * 400, 0.035),
  /** Тик счётчика. */
  tick: (step = 0) => tone(up(880, step % 12), up(880, step % 12), 40, 'sine', 0.07)
}

// ───────────── Эффекты на экране ─────────────

export { burst, floater }

/**
 * Призрак буквы летит от одного элемента к другому (плитка → ячейка). Без Web Animations API
 * и при reduced-motion — ничего не делает: буква просто появится на месте.
 */
export function flyGhost(from: Element | null, to: Element | null, text: string, ms = 360, className = ''): Promise<void> {
  if (!from || !to || reducedMotion()) return Promise.resolve()
  const a = from.getBoundingClientRect(), b = to.getBoundingClientRect()
  const el = document.createElement('div')
  if (typeof el.animate !== 'function') return Promise.resolve()
  if (text.startsWith('<svg')) el.innerHTML = text; else el.textContent = text
  el.className = `ab-ghost font-geo ${className}`
  Object.assign(el.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` })
  document.body.appendChild(el)
  const dx = b.left + b.width / 2 - (a.left + a.width / 2)
  const dy = b.top + b.height / 2 - (a.top + a.height / 2)
  const s = b.width / Math.max(1, a.width)
  const anim = el.animate([
    { transform: 'translate(0,0) scale(1) rotate(0deg)' },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(${(1 + s) / 2 + 0.15}) rotate(-8deg)`, offset: 0.55 },
    { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(0deg)` }
  ], { duration: ms, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)', fill: 'forwards' })
  return new Promise(res => { anim.onfinish = () => { el.remove(); res() }; setTimeout(() => { el.remove(); res() }, ms + 200) })
}
