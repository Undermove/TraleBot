import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api, TRANSLATE_PEEK_MS, TRANSLATE_POLL_LIMIT_MS, TRANSLATE_POLL_MS } from './api'

// Медленный перевод (глагол, который составляют модели): сервер отвечает pending, ответ забирается опросом.

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as Response

describe('api.translateWord', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns a ready answer from the first request, without status requests or onPending', async () => {
    fetchMock.mockResolvedValueOnce(json({ status: 'success', word: 'стол', definition: 'перевод' }))
    const onPending = vi.fn()

    const r = await api.translateWord('стол', onPending)

    expect(r.status).toBe('success')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/miniapp/translate')
    expect(onPending).not.toHaveBeenCalled()
  })

  it('polls translate/status while the answer is pending and returns it when it is ready', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'pending', verbLookup: false, stage: 'recognizing' }))
      .mockResolvedValueOnce(json({ status: 'pending', verbLookup: true, stage: 'verb-forms' }))
      // Другой экземпляр сервера про работу не знает: ни флага, ни шага — остаётся то, что знали.
      .mockResolvedValueOnce(json({ status: 'pending', verbLookup: false, stage: null }))
      .mockResolvedValueOnce(json({ status: 'success', word: 'слово', definition: 'перевод' }))
    const onPending = vi.fn()

    const result = api.translateWord('слово', onPending)
    await vi.advanceTimersByTimeAsync(TRANSLATE_POLL_MS * 3)
    const r = await result

    expect(r).toMatchObject({ status: 'success', definition: 'перевод' })
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/api/miniapp/translate',
      '/api/miniapp/translate/status',
      '/api/miniapp/translate/status',
      '/api/miniapp/translate/status'
    ])
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ word: 'слово' })
    expect(onPending.mock.calls.map((c) => c[0])).toEqual([
      { stage: 'recognizing', verbLookup: false, slow: true },
      { stage: 'verb-forms', verbLookup: true, slow: true },
      { stage: 'verb-forms', verbLookup: true, slow: true }
    ])
  })

  it('never reports an earlier step after a later one', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'pending', verbLookup: true, stage: 'verb-review' }))
      .mockResolvedValueOnce(json({ status: 'pending', verbLookup: true, stage: 'verb-forms' }))
      .mockResolvedValueOnce(json({ status: 'pending', verbLookup: true, stage: 'что-то новое' }))
      .mockResolvedValueOnce(json({ status: 'success', word: 'слово', definition: 'перевод' }))
    const onProgress = vi.fn()

    const result = api.translateWord('слово', onProgress)
    await vi.advanceTimersByTimeAsync(TRANSLATE_POLL_MS * 3)
    await result

    expect(onProgress.mock.calls.map((c) => c[0].stage)).toEqual(['verb-review', 'verb-review', 'verb-review'])
  })

  it('learns the step from translate/status while the first request is still held by the server', async () => {
    let answer!: (r: Response) => void
    fetchMock.mockImplementation((path: string) =>
      path === '/api/miniapp/translate'
        ? new Promise<Response>((resolve) => { answer = resolve })
        : Promise.resolve(json({ status: 'pending', verbLookup: false, stage: 'recognizing' })))
    const onProgress = vi.fn()

    const result = api.translateWord('стол', onProgress)
    await vi.advanceTimersByTimeAsync(TRANSLATE_PEEK_MS)

    expect(onProgress).toHaveBeenLastCalledWith({ stage: 'recognizing', verbLookup: false, slow: false })

    answer(json({ status: 'success', word: 'стол', definition: 'перевод' }))
    expect((await result).status).toBe('success')
    const calls = fetchMock.mock.calls.length
    await vi.advanceTimersByTimeAsync(TRANSLATE_POLL_MS * 3)
    expect(fetchMock).toHaveBeenCalledTimes(calls)
  })

  it('takes only the step from a status asked meanwhile, never the answer: that comes with the request itself', async () => {
    let answer!: (r: Response) => void
    fetchMock.mockImplementation((path: string) =>
      path === '/api/miniapp/translate'
        ? new Promise<Response>((resolve) => { answer = resolve })
        // Слово с таким написанием уже было в словаре: другой экземпляр ответил бы им.
        : Promise.resolve(json({ status: 'success', word: 'стол', definition: 'старый перевод' })))
    const onProgress = vi.fn()

    const result = api.translateWord('стол', onProgress)
    await vi.advanceTimersByTimeAsync(TRANSLATE_PEEK_MS + TRANSLATE_POLL_MS)
    expect(onProgress).not.toHaveBeenCalled()

    answer(json({ status: 'exists', word: 'стол', definition: 'перевод' }))
    expect(await result).toMatchObject({ status: 'exists', definition: 'перевод' })
  })

  it('does not ask for the step when nobody listens (words added in a batch)', async () => {
    let answer!: (r: Response) => void
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => { answer = resolve }))

    const result = api.translateWord('стол')
    await vi.advanceTimersByTimeAsync(TRANSLATE_PEEK_MS + TRANSLATE_POLL_MS)
    answer(json({ status: 'success', word: 'стол', definition: 'перевод' }))
    await result

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps asking after a failed status request (the server is restarting)', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'pending', verbLookup: true }))
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(json({}, 502))
      .mockResolvedValueOnce(json({ status: 'exists', word: 'слово', definition: 'перевод' }))

    const result = api.translateWord('слово')
    await vi.advanceTimersByTimeAsync(TRANSLATE_POLL_MS * 3)

    expect((await result).status).toBe('exists')
  })

  it('stops with a refusal instead of polling to the end', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ status: 'pending' }))
      .mockResolvedValueOnce(json({ error: 'not_authenticated' }, 401))

    const result = api.translateWord('слово').catch((e) => e)
    await vi.advanceTimersByTimeAsync(TRANSLATE_POLL_MS)

    expect((await result).status).toBe(401)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up with status timeout when the answer never comes', async () => {
    fetchMock.mockResolvedValue(json({ status: 'pending', verbLookup: true }))

    const result = api.translateWord('слово')
    await vi.advanceTimersByTimeAsync(TRANSLATE_POLL_LIMIT_MS + TRANSLATE_POLL_MS)

    expect((await result).status).toBe('timeout')
  })
})
