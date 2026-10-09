import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { adminVerbs as mocked, ApiError } from '../../api'
import catalog from '../../../../Verbs/verbs.json'
import { cyr } from '../../verbs/types'
import VerbReviewScreen from '../VerbReviewScreen'

vi.mock('../../api', () => ({
  ApiError: class ApiError extends Error { constructor(public status: number, public body: string) { super('api') } },
  adminVerbs: {
    modelMade: vi.fn(), regenerate: vi.fn(), confirmTense: vi.fn(), editTense: vi.fn(), removeTense: vi.fn(), approve: vi.fn(), unapprove: vi.fn()
  }
}))
const api = vi.mocked(mocked)

// Грузинское — только из каталога.
type Entry = { lemma: string; title: string; ru: string; tenses: Record<string, string[][]>; meanings: Record<string, string[]> }
const all = (catalog as { verbs: Entry[] }).verbs
const by = (ru: string) => all.find(v => v.ru === ru)!
const [dance, live, write] = [by('танцевать'), by('жить'), by('писать')]

function verb(v: Entry, unverified: string[], approved = false, tenses = ['present', 'imperfect', 'future', 'aorist']) {
  const row = (tense: string) => ({
    tense, cells: v.tenses[tense].map(c => c[0] ?? null), inTexts: v.tenses[tense].map((_, i) => i < 2),
    phrases: v.meanings[tense], unverified: unverified.includes(tense), completed: false
  })
  return {
    lemma: v.lemma, title: v.title, translation: v.ru, askedText: `${v.ru} спросили`, approvedAtUtc: '2026-10-07T10:00:00Z', learners: 2,
    mainTenses: tenses.length, verifiedMainTenses: tenses.length - unverified.length, completedTenses: [],
    missingTenses: [{ tense: 'optative', why: 'not-sure' as const, note: 'the reviewer rejected the row', reviewerDisagrees: false }],
    reviewerReasons: ['Настоящее время подтверждено.'], generatorModel: 'gen-model', reviewerModel: 'rev-model',
    unverifiedTenses: unverified.map(t => ({ ...row(t), removedBefore: false })),
    tenses: tenses.map(row), ownerApprovedAtUtc: approved ? '2026-10-08T09:00:00Z' : null
  }
}

// Сервер отдаёт по дате; экран сам ставит вперёд то, что требует внимания.
const list = () => [verb(live, [], true), verb(write, []), verb(dance, ['future', 'aorist'])]

const navigate = vi.fn()
beforeEach(() => {
  Object.values(api).forEach(f => f.mockReset())
  navigate.mockReset()
  api.modelMade.mockResolvedValue({ count: 3, verbs: list() })
})

const rows = () => screen.getAllByTestId(/^verb-review-row-/).map(r => r.getAttribute('data-testid')!.replace('verb-review-row-', ''))

async function openVerb(lemma = dance.lemma) {
  render(<VerbReviewScreen navigate={navigate} />)
  await userEvent.click(await screen.findByTestId(`verb-review-row-${lemma}`))
  return screen.getByTestId('verb-review-verb')
}

describe('VerbReviewScreen: очередь', () => {
  it('shows nothing but «Нет доступа» to someone the server refuses', async () => {
    api.modelMade.mockRejectedValue(new ApiError(404, ''))
    render(<VerbReviewScreen navigate={navigate} />)
    expect(await screen.findByTestId('verb-review-denied')).toBeTruthy()
    expect(screen.queryByTestId('verb-review-queue')).toBeNull()
  })

  it('opens on what waits: unverified tenses first, then verbs not yet approved; approved ones are behind a filter', async () => {
    render(<VerbReviewScreen navigate={navigate} />)
    await screen.findByTestId('verb-review-queue')
    expect(rows()).toEqual([dance.lemma, write.lemma])
    expect(screen.getByText('Всего 3 · ждут 2 · проверены 1')).toBeTruthy()
    const first = within(screen.getByTestId(`verb-review-row-${dance.lemma}`))
    expect(first.getByText('танцевать')).toBeTruthy()
    expect(first.getByText(cyr(dance.lemma))).toBeTruthy()
    expect(first.getByText('непроверенных времён: 2')).toBeTruthy()
    expect(within(screen.getByTestId(`verb-review-row-${write.lemma}`)).getByText('времена проверены, ждёт отметки')).toBeTruthy()

    await userEvent.click(screen.getByRole('button', { name: 'все · 3' }))
    expect(rows()).toEqual([dance.lemma, write.lemma, live.lemma])
    await userEvent.click(screen.getByRole('button', { name: 'проверены · 1' }))
    expect(rows()).toEqual([live.lemma])
    await userEvent.click(screen.getByRole('button', { name: 'непроверенные времена · 1' }))
    expect(rows()).toEqual([dance.lemma])
  })

  it('searches by Russian and by Georgian', async () => {
    render(<VerbReviewScreen navigate={navigate} />)
    await screen.findByTestId('verb-review-queue')
    await userEvent.click(screen.getByRole('button', { name: 'все · 3' }))
    await userEvent.type(screen.getByLabelText('Поиск'), 'жит')
    expect(rows()).toEqual([live.lemma])
    await userEvent.clear(screen.getByLabelText('Поиск'))
    await userEvent.type(screen.getByLabelText('Поиск'), write.lemma)
    expect(rows()).toEqual([write.lemma])
  })
})

describe('VerbReviewScreen: один глагол', () => {
  it('shows the verb with who asked for it, verified tenses folded into a line and unverified ones open', async () => {
    const view = within(await openVerb())
    expect(view.getByText('танцевать')).toBeTruthy()
    expect(view.getByText(cyr(dance.lemma))).toBeTruthy()
    expect(view.getByText(/спросили «танцевать спросили» · 07\.10\.2026 · учат: 2/)).toBeTruthy()
    expect(view.getByTestId('verb-review-status').textContent).toBe('4 из 6 времён · непроверенных времён: 2')
    expect(view.getByText('нет: Надо сделать — модель не уверена')).toBeTruthy()

    const present = within(view.getByTestId('tense-block-present'))
    expect(present.getByText('проверено')).toBeTruthy()
    expect(present.queryByText(dance.tenses.present[5][0])).toBeNull()
    const future = within(view.getByTestId('tense-block-future'))
    expect(future.getByText('не проверено')).toBeTruthy()
    for (const [person, cell] of dance.tenses.future.entries()) {
      expect(future.getByText(cell[0])).toBeTruthy()
      expect(future.getByText(cyr(cell[0]))).toBeTruthy()
      expect(future.getByText(new RegExp(dance.meanings.future[person].replace(/[()]/g, '\\$&')))).toBeTruthy()
    }
    expect(future.getAllByText(/есть в текстах/)).toHaveLength(2)
    expect(future.getAllByText(/нет в текстах/)).toHaveLength(4)

    // Заметки моделей свёрнуты; проверенное время раскрывается по нажатию.
    expect(view.queryByTestId('verb-review-notes')).toBeNull()
    await userEvent.click(view.getByRole('button', { name: 'Заметки моделей' }))
    expect(view.getByTestId('verb-review-notes').textContent).toContain('Составила gen-model, проверила rev-model.')
    expect(view.getByTestId('verb-review-notes').textContent).toContain('the reviewer rejected the row')
    await userEvent.click(present.getByRole('button', { name: /Сейчас/ }))
    expect(present.getByText(dance.tenses.present[5][0])).toBeTruthy()
    expect(present.queryByRole('button', { name: 'Убрать время' })).toBeNull()
  })

  it('«Подтвердить» updates the block in place: it folds, the rest of the screen stays', async () => {
    api.confirmTense.mockResolvedValue({ ok: true, progressReset: 0 })
    const view = await openVerb()
    api.modelMade.mockResolvedValue({ count: 3, verbs: [verb(live, [], true), verb(write, []), verb(dance, ['aorist'])] })
    await userEvent.click(within(within(view).getByTestId('tense-block-future')).getByRole('button', { name: 'Подтвердить' }))

    expect(api.confirmTense).toHaveBeenCalledWith(dance.lemma, 'future')
    await waitFor(() => expect(screen.getByTestId('verb-review-note').textContent).toBe('Будущее: подтверждено, теперь есть в играх'))
    expect(screen.getByTestId('verb-review-verb')).toBe(view)
    expect(within(screen.getByTestId('tense-block-future')).getByText('проверено')).toBeTruthy()
    expect(within(screen.getByTestId('tense-block-aorist')).getByText('не проверено')).toBeTruthy()
    expect(screen.getByTestId('verb-review-status').textContent).toBe('4 из 6 времён · непроверенных времён: 1')
  })

  it('«Исправить» edits the six cells inline, «Убрать время» asks first', async () => {
    api.editTense.mockResolvedValue({ ok: true, progressReset: 3 })
    api.removeTense.mockResolvedValue({ ok: true, progressReset: 0 })
    const future = within(within(await openVerb()).getByTestId('tense-block-future'))
    await userEvent.click(future.getByRole('button', { name: 'Исправить' }))
    const first = future.getByLabelText('Будущее, я') as HTMLInputElement
    expect(first.value).toBe(dance.tenses.future[0][0])
    await userEvent.clear(first)
    await userEvent.type(first, write.tenses.future[0][0])
    await userEvent.clear(future.getByLabelText('Будущее, вы'))
    await userEvent.click(future.getByRole('button', { name: 'Сохранить' }))
    const cells = dance.tenses.future.map(c => c[0] as string | null)
    cells[0] = write.tenses.future[0][0]
    cells[4] = null
    expect(api.editTense).toHaveBeenCalledWith(dance.lemma, 'future', cells)
    await waitFor(() => expect(screen.getByTestId('verb-review-note').textContent)
      .toBe('Будущее: исправлено и проверено; у учеников сброшен прогресс по изменённым формам: 3'))

    const aorist = within(screen.getByTestId('tense-block-aorist'))
    await userEvent.click(aorist.getByRole('button', { name: 'Убрать время' }))
    expect(api.removeTense).not.toHaveBeenCalled()
    await userEvent.click(aorist.getByRole('button', { name: 'Убрать' }))
    expect(api.removeTense).toHaveBeenCalledWith(dance.lemma, 'aorist')

    api.editTense.mockRejectedValue(new ApiError(400, '{}'))
    await userEvent.click(within(screen.getByTestId('tense-block-future')).getByRole('button', { name: 'Исправить' }))
    await userEvent.click(within(screen.getByTestId('tense-block-future')).getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(screen.getByTestId('verb-review-note').textContent).toBe('в каждой клетке — одно слово грузинскими буквами'))
  })

  it('«Следующий глагол» and «Предыдущий» walk the batch in the order of the queue, with «N из M»', async () => {
    await openVerb()
    const top = within(screen.getByTestId('verb-review-nav-top'))
    expect(top.getByText('1 из 2')).toBeTruthy()
    expect((top.getByRole('button', { name: /Предыдущий/ }) as HTMLButtonElement).disabled).toBe(true)
    await userEvent.click(top.getByRole('button', { name: /Следующий глагол/ }))
    expect(within(screen.getByTestId('verb-review-verb')).getByText('писать')).toBeTruthy()
    const bottom = within(screen.getByTestId('verb-review-nav-bottom'))
    expect(bottom.getByText('2 из 2')).toBeTruthy()
    expect((bottom.getByRole('button', { name: /Следующий глагол/ }) as HTMLButtonElement).disabled).toBe(true)
    await userEvent.click(bottom.getByRole('button', { name: /Предыдущий/ }))
    expect(within(screen.getByTestId('verb-review-verb')).getByText('танцевать')).toBeTruthy()
  })

  it('a verb with unverified tenses is approved only after «Да, подтвердить всё»; a clean one — by «Глагол проверен»', async () => {
    api.approve.mockResolvedValue({ ok: true })
    await openVerb()
    expect(screen.queryByRole('button', { name: 'Глагол проверен' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Подтвердить всё и отметить проверенным' }))
    expect(api.approve).not.toHaveBeenCalled()
    expect(screen.getByText(/Непроверенные времена \(будущее, прошедшее: сделал\) станут проверенными и попадут в игры/)).toBeTruthy()
    api.modelMade.mockResolvedValue({ count: 3, verbs: [verb(live, [], true), verb(write, []), verb(dance, [], true)] })
    await userEvent.click(screen.getByRole('button', { name: 'Да, подтвердить всё' }))
    expect(api.approve).toHaveBeenCalledWith(dance.lemma, true)
    await waitFor(() => expect(screen.getByTestId('verb-review-note').textContent).toBe('Глагол проверен: пометка «составлено нейросетью» убрана'))
    expect(screen.getByTestId('verb-review-status').textContent).toBe('4 из 6 времён · проверен 08.10.2026')
    // Пачка не пересобирается: глагол остаётся на своём месте, можно идти дальше.
    expect(within(screen.getByTestId('verb-review-nav-top')).getByText('1 из 2')).toBeTruthy()

    await userEvent.click(within(screen.getByTestId('verb-review-nav-top')).getByRole('button', { name: /Следующий глагол/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Глагол проверен' }))
    expect(api.approve).toHaveBeenLastCalledWith(write.lemma)
  })

  it('«Снять отметку» undoes the approval, and rebuilding an approved verb asks first', async () => {
    api.unapprove.mockResolvedValue({ ok: true })
    api.regenerate.mockResolvedValue({ outcome: 'replaced', mainTensesBefore: 4, mainTensesAfter: 6, changedForms: ['x'] })
    render(<VerbReviewScreen navigate={navigate} lemma={live.lemma} />)
    await screen.findByTestId('verb-review-verb')
    expect(screen.getByTestId('verb-review-status').textContent).toContain('проверен 08.10.2026')

    await userEvent.click(screen.getByRole('button', { name: 'Пересобрать' }))
    expect(api.regenerate).not.toHaveBeenCalled()
    expect(screen.getByText('Глагол отмечен проверенным. Если модели составят новую запись, отметка снимется. Пересобрать?')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Да, пересобрать' }))
    expect(api.regenerate).toHaveBeenCalledWith(live.lemma, true)
    await waitFor(() => expect(screen.getByTestId('verb-review-note').textContent)
      .toBe('Пересобрано: было 4 из 6 времён, стало 6 из 6; изменилось форм: 1'))

    await userEvent.click(screen.getByRole('button', { name: 'Снять отметку' }))
    expect(api.unapprove).toHaveBeenCalledWith(live.lemma)
    await waitFor(() => expect(screen.getByTestId('verb-review-note').textContent).toBe('Отметка снята: у учеников снова «составлено нейросетью»'))
  })

  it('rebuilding a verb that is not approved needs no question and says when the old record was kept', async () => {
    api.regenerate.mockResolvedValueOnce({ outcome: 'kept', reason: 'fewer-tenses', mainTensesBefore: 4, mainTensesAfter: 1 })
    await openVerb()
    await userEvent.click(screen.getByRole('button', { name: 'Пересобрать' }))
    expect(api.regenerate).toHaveBeenCalledWith(dance.lemma)
    await waitFor(() => expect(screen.getByTestId('verb-review-note').textContent).toBe('Оставлена прежняя запись: новая запись вышла беднее'))
    api.regenerate.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await userEvent.click(screen.getByRole('button', { name: 'Пересобрать' }))
    await waitFor(() => expect(screen.getByTestId('verb-review-note').textContent)
      .toBe('связь оборвалась; если шла пересборка, она продолжается — обнови через минуту'))
  })

  it('Back goes from the verb to the queue and from the queue to the admin screen', async () => {
    await openVerb()
    await userEvent.click(screen.getByRole('button', { name: /назад|back/i }))
    expect(screen.getByTestId('verb-review-queue')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /назад|back/i }))
    expect(navigate).toHaveBeenCalledWith({ kind: 'admin' })
  })
})
