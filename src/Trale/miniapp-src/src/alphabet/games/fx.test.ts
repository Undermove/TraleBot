import { describe, it, expect, vi, beforeEach } from 'vitest'
import { playClip, registerAudioContext } from './fx'

// iPhone держит плеер «TraleBot» на экране блокировки, пока у страницы есть <audio> с файлом.
describe('звук не числится играющим после записи и в свёрнутом мини-аппе', () => {
  const made: HTMLAudioElement[] = []
  beforeEach(() => {
    made.length = 0
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
      made.push(this as HTMLAudioElement)
      return Promise.resolve()
    })
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {})
  })

  const hide = () => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  }

  it('lets go of the file once the clip has played, and takes it again for the next play', async () => {
    await playClip('/audio/a.m4a')
    const el = made[made.length - 1]!
    expect(el.getAttribute('src')).toBe('/audio/a.m4a')
    el.dispatchEvent(new Event('ended'))
    expect(el.getAttribute('src')).toBeNull()

    await playClip('/audio/a.m4a')
    expect(made[made.length - 1]).toBe(el)
    expect(el.getAttribute('src')).toBe('/audio/a.m4a')
  })

  it('silences clips, sound contexts and the now-playing card when the mini-app is hidden', async () => {
    await playClip('/audio/b.m4a')
    const el = made[made.length - 1]!
    const ctx = { state: 'running', suspend: vi.fn(async () => {}) } as unknown as AudioContext
    registerAudioContext(ctx)
    const mediaSession = { metadata: {}, playbackState: 'playing' }
    Object.defineProperty(navigator, 'mediaSession', { value: mediaSession, configurable: true })

    hide()

    expect(el.getAttribute('src')).toBeNull()
    expect(ctx.suspend).toHaveBeenCalled()
    expect(mediaSession).toEqual({ metadata: null, playbackState: 'none' })
  })
})
