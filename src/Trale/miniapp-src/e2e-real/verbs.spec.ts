import { expect, test } from '@playwright/test'
import {
  Seen, addWord, api, createLearner, installTelegram, learning, openDictionary, openVerbFromDictionary,
  playButton, playSession, pressBack, session, shot, sql, verbByRu
} from './support'

// Глаголы, сыгранные по-настоящему: браузер, настоящий сервер, настоящая база.
// Верные ответы берутся из того, что страница получила от API; грузинских слов в тестах нет.

test.beforeEach(async ({ context }) => { await installTelegram(context) })

const growsEveryTask = (bar: number[]) => bar.every((p, i) => i === 0 || p > bar[i - 1])

test('словарь → слово-глагол → вид глагола → первая сессия: полоска растёт, прогресс и опыт сохранены один раз', async ({ page }) => {
  const learner = await createLearner()
  const seen = new Seen(page)
  const verb = await verbByRu(learner, 'писать')
  await openVerbFromDictionary(page, learner, verb, 'пишу')
  await expect(playButton(page)).toHaveText('Выучить играя')
  await expect(page.getByTestId('verb-level')).toHaveAttribute('data-level', 'new')
  await shot(page, '01-verb-view-new')

  const before = await api(learner, 'me')
  await playButton(page).click()
  const played = await playSession(page, seen, { shots: '02-first-session' })

  // Короткая: две сцены, с десяток заданий, по оценке постановщика — не дольше трёх минут.
  expect(played.scenes).toEqual(['meet', 'time'])
  expect(played.tasks).toBeLessThanOrEqual(16)
  expect(seen.plan!.scenes.reduce((n: number, s: any) => n + s.seconds, 0)).toBeLessThanOrEqual(180)
  expect(growsEveryTask(played.bar), `полоска: ${played.bar}`).toBe(true)

  const finish = page.getByTestId('session-finish')
  await expect(finish).toBeVisible()
  await expect(page.getByTestId('session-xp')).toHaveText('+10 XP')
  await expect(finish.getByTestId('verb-level')).toHaveAttribute('data-level', 'recognising')
  for (const tense of ['present', 'aorist', 'future']) await expect(page.getByTestId('session-words')).toContainText(verb.card.tenses[tense][0][0])
  await shot(page, '03-finish')

  // Сервер: опыт и активный день — один раз, даже если отчёт о финише придёт повторно.
  const after = await api(learner, 'me')
  expect(after.progress.xp).toBe(before.progress.xp + 10)
  expect(after.progress.streak).toBeGreaterThanOrEqual(1)
  expect(after.progress.lastPlayedAtUtc).toBeTruthy()
  const final = seen.reports[seen.reports.length - 1]
  expect(final.finished).toBe(true)
  const replay = await api(learner, `verbs/${encodeURIComponent(verb.id)}/session`, { ...final, plan: seen.plan })
  expect(replay.xpEarned).toBe(0)
  expect((await api(learner, 'me')).progress.xp).toBe(before.progress.xp + 10)
  expect(sql(`select count(*), sum("XpEarned") from "VerbSessions" where "UserId"='${learner.id}' and "FinishedAtUtc" is not null`)).toBe('1|10')

  await page.getByRole('button', { name: 'Готово' }).click()
  // Опыт в шапке приложения вырос сразу, без перезагрузки: человек видит, что игра засчитана.
  await expect(page.locator('div.sticky.top-0').first()).toContainText(String(before.progress.xp + 10))
  await expect(playButton(page)).toHaveText('Играть дальше')
  await expect(page.getByTestId('session-entry-known')).toContainText('знакомо слов: 3')

  // Перезагрузка: всё на месте — уровень в строке словаря и в виде глагола.
  await openDictionary(page, learner)
  await expect(page.getByTestId('verb-row-level').getByTestId('verb-level')).toHaveAttribute('data-level', 'recognising')
  await page.getByRole('listitem').filter({ hasText: 'пишу' }).getByRole('button').last().click()
  await expect(page.getByTestId('session-entry').getByTestId('verb-level')).toHaveAttribute('data-level', 'recognising')
  await expect(playButton(page)).toHaveText('Играть дальше')
  await shot(page, '04-verb-view-after-session')
  expect(seen.errors).toEqual([])
})

test('сессия с ошибками: тупика нет, полоска не идёт назад, объяснения есть и без терминов', async ({ page }) => {
  const learner = await createLearner()
  const seen = new Seen(page)
  const verb = await verbByRu(learner, 'писать')
  await openVerbFromDictionary(page, learner, verb, 'пишу')
  await playButton(page).click()

  const played = await playSession(page, seen, { mistakes: true })

  await expect(page.getByTestId('session-finish')).toBeVisible()
  expect(played.notes.length).toBeGreaterThanOrEqual(6)
  // Не «неправильно», а что выбранное значит: русская фраза в кавычках.
  for (const note of played.notes) expect(note).toMatch(/«.+»/)
  expect(played.bar.every((p, i) => i === 0 || p >= played.bar[i - 1])).toBe(true)
  // Ошибки не дали формам окрепнуть — уровень честно ниже, чем после сессии без ошибок.
  expect((await learning(learner, verb)).level).toBe('meeting')
  await shot(page, '05-finish-after-mistakes')
  expect(seen.errors).toEqual([])
})

test('полсессии → перезагрузка → продолжение с того же места; второе устройство видит то же', async ({ page, browser }) => {
  const learner = await createLearner()
  const seen = new Seen(page)
  const verb = await verbByRu(learner, 'писать')
  await openVerbFromDictionary(page, learner, verb, 'пишу')
  await playButton(page).click()
  const half = await playSession(page, seen, { stopAfter: 10 })
  const barBefore = half.bar[half.bar.length - 1]
  await expect.poll(async () => (await learning(learner, verb)).session?.done, { message: 'место в сессии дошло до сервера' }).toBeGreaterThan(0)
  const stored = (await learning(learner, verb)).session

  // Жёсткая перезагрузка посреди сессии.
  await openDictionary(page, learner)
  await page.getByRole('listitem').filter({ hasText: 'пишу' }).getByRole('button').last().click()
  await expect(playButton(page)).toHaveText('Продолжить игру')
  await shot(page, '06-resume-button')

  // Второе устройство: тот же человек, чистый браузер — та же начатая сессия, те же отметки подсказок.
  const other = await browser.newContext({ viewport: { width: 390, height: 844 } })
  await installTelegram(other)
  const second = await other.newPage()
  const seenSecond = new Seen(second)
  await openDictionary(second, learner)
  await second.getByRole('listitem').filter({ hasText: 'пишу' }).getByRole('button').last().click()
  await expect(playButton(second)).toHaveText('Продолжить игру')
  await expect(second.getByTestId('session-entry-known')).toContainText('знакомо слов: 3')
  expect((await api(learner, 'me')).uiHintsSeen).toContain('ui:verb_game_seen_ladder')
  await playButton(second).click()
  await expect(session(second)).toHaveAttribute('data-scene-index', String(stored.scene))
  // Правила этой игры человек уже видел на первом устройстве — здесь они сами не выезжают.
  await expect(second.getByText(/Как играть · 1 из/)).toHaveCount(0)
  expect(seenSecond.plan).toEqual(stored.plan)
  await other.close()

  // Продолжаем на первом: та же сцена, полоска не короче, ничего не потеряно.
  await playButton(page).click()
  await expect(session(page)).toHaveAttribute('data-scene-index', String(stored.scene))
  const resumedAt = Number(await page.getByTestId('session-bar').first().getAttribute('data-percent'))
  expect(resumedAt).toBeGreaterThanOrEqual(barBefore - 1)
  const rest = await playSession(page, seen)
  await expect(page.getByTestId('session-finish')).toBeVisible()
  expect(half.tasks + rest.tasks).toBe(seen.plan!.scenes.reduce((n: number, s: any) => n + s.units, 0))
  expect(new Set(seen.reports.map(r => r.sessionId)).size).toBe(1)
  expect((await learning(learner, verb)).level).toBe('recognising')
  expect(seen.errors).toEqual([])
})

test('короткий глагол: сессии до экзамена, экзамен сдан → «выучен»', async ({ page }) => {
  const learner = await createLearner()
  const seen = new Seen(page)
  const verb = await verbByRu(learner, 'хотеть')
  await openVerbFromDictionary(page, learner, verb, 'хочу')
  await playButton(page).click()

  const sessions: string[][] = []
  for (let n = 0; n < 10; n++) {
    const played = await playSession(page, seen, { shots: n === 0 ? undefined : undefined })
    sessions.push(played.scenes)
    await expect(page.getByTestId('session-finish')).toBeVisible()
    if (played.scenes.includes('exam')) break
    await page.getByRole('button', { name: 'Ещё одну' }).click()
  }

  const exam = sessions.findIndex(s => s.includes('exam'))
  expect(exam, `экзамен — не в первых сессиях: ${JSON.stringify(sessions)}`).toBeGreaterThanOrEqual(2)
  expect(sessions[exam][sessions[exam].length - 1]).toBe('exam')
  await expect(page.getByTestId('session-finish')).toHaveAttribute('data-exam', 'passed')
  await expect(page.getByTestId('session-finish').getByTestId('verb-level')).toHaveAttribute('data-level', 'learned')
  await shot(page, '07-exam-passed')
  const state = await learning(learner, verb)
  expect(state.level).toBe('learned')
  expect(state.memory.examPassed).toBe(true)

  await page.getByRole('button', { name: 'Готово' }).click()
  await expect(playButton(page)).toHaveText('Сыграть ещё')
  expect(seen.errors).toEqual([])
})

test('каждая сцена сыграна по-настоящему: знакомство, машина времени, косточки, конструктор, фразы', async ({ page }) => {
  const learner = await createLearner()
  const seen = new Seen(page)
  const verb = await verbByRu(learner, 'писать')
  await openVerbFromDictionary(page, learner, verb, 'пишу')
  await playButton(page).click()

  const wanted = ['meet', 'time', 'bones', 'builder', 'phrases']
  const scenes = new Set<string>()
  const sessions: string[][] = []
  for (let n = 0; n < 9 && wanted.some(w => !scenes.has(w)); n++) {
    const played = await playSession(page, seen, { shots: `08-session${n + 1}` })
    sessions.push(played.scenes)
    played.scenes.forEach(s => scenes.add(s))
    expect(growsEveryTask(played.bar), `сессия ${n + 1} (${played.scenes}): полоска ${played.bar}`).toBe(true)
    expect(played.scenes.length).toBeLessThanOrEqual(3)
    // «Было — стало» на финише — про эту сессию, а не про самую первую.
    if (n > 0 && (await page.getByTestId('session-level-up').count())) await expect(page.getByTestId('session-level-up')).not.toContainText('новый')
    await page.getByRole('button', { name: 'Ещё одну' }).click()
  }

  for (const scene of wanted) expect(scenes, `сцены по сессиям: ${JSON.stringify(sessions)}`).toContain(scene)
  // Фразы — и вставить слово, и собрать фразу из слов.
  const kinds = new Set(seen.reports.flatMap(r => r.plan?.scenes ?? []).flatMap((s: any) => s.tasks ?? []).map((t: any) => t.kind))
  expect(kinds).toContain('gap')
  expect(seen.errors).toEqual([])
})

test('комикс — первая сессия глагола с историей; подсмотреть в таблице и вернуться; дочитан один раз', async ({ page }) => {
  const learner = await createLearner()
  const seen = new Seen(page)
  const verb = await verbByRu(learner, 'идти')
  await openVerbFromDictionary(page, learner, verb, 'иду')
  await playButton(page).click()

  const played = await playSession(page, seen, { shots: '09-comic', peek: true })

  expect(played.scenes[0]).toBe('story')
  expect(growsEveryTask(played.bar), `полоска: ${played.bar}`).toBe(true)
  const state = await learning(learner, verb)
  expect(state.memory.storyCompleted).toBe(true)
  expect(state.progress.forms.length).toBeGreaterThan(0)

  await page.getByRole('button', { name: 'Ещё одну' }).click()
  const next = await playSession(page, seen)
  expect(next.scenes).not.toContain('story')
  expect(seen.errors).toEqual([])
})

test('подсказка в словаре открывает вид глагола на нужном лице; «глаголы» — одна строка на глагол', async ({ page }) => {
  const learner = await createLearner()
  const verb = await verbByRu(learner, 'писать')
  // Фраза из каталога, в которой есть форма глагола, и две формы этого глагола отдельными словами.
  const sentence = verb.card.sentences[0]
  addWord(learner, sentence.ka, sentence.ru)
  addWord(learner, verb.card.tenses.present[0][0], 'пишу')
  addWord(learner, verb.card.tenses.present[2][0], 'пишет')
  const entries = (await api(learner, 'vocabulary')).items
  const phrase = entries.find((i: any) => i.word === sentence.ka).verb
  expect(phrase.single).toBe(false)

  await openDictionary(page, learner)
  // Фраза с глаголом — карточка слова с подсказкой, а не вид глагола.
  await page.getByRole('listitem').filter({ hasText: sentence.ru }).getByRole('button').last().click()
  await page.getByTestId('verb-hint').click()
  await expect(page.getByTestId('verb-sheet')).toBeVisible()
  await expect(page.getByTestId('verb-entry')).toHaveCount(0)
  await expect(page.getByTestId(`verb-person-${phrase.person}`)).toHaveClass(/bg-cream/)
  await expect(page.getByTestId(`verb-tense-${phrase.tense}`)).toHaveClass(/bg-gold-wash/)
  await expect(page.getByTestId(`verb-tense-${phrase.tense}`)).toContainText(phrase.form)
  await shot(page, '10-hint-opens-on-person')

  // Слово «пишет» — сразу вид глагола на лице «он».
  await openDictionary(page, learner)
  await page.getByRole('listitem').filter({ hasText: 'пишет' }).getByRole('button').last().click()
  await expect(page.getByTestId('verb-entry')).toContainText(verb.card.tenses.present[2][0])
  await expect(page.getByTestId('verb-person-2')).toHaveClass(/bg-cream/)

  // Под фильтром «глаголы» три записи — один глагол.
  await openDictionary(page, learner)
  await page.getByRole('button', { name: 'глаголы' }).click()
  await expect(page.locator('[data-testid^="my-verb-"]')).toHaveCount(1)
  await expect(page.getByTestId('saved-forms')).toContainText(verb.card.tenses.present[0][0])
  await shot(page, '11-my-verbs')
})

test('«Назад» в Telegram закрывает верхний слой, а не экран под ним', async ({ page }) => {
  const learner = await createLearner()
  const verb = await verbByRu(learner, 'писать')
  await openVerbFromDictionary(page, learner, verb, 'пишу')
  await playButton(page).click()
  // Первый вход: поверх сессии выехали правила.
  await expect(page.getByText(/Как играть · 1 из/)).toBeVisible()

  await pressBack(page)
  await expect(page.getByText(/Как играть · 1 из/)).toHaveCount(0)
  await expect(session(page)).toBeVisible()

  await pressBack(page)
  await expect(session(page)).toHaveCount(0)
  await expect(page.getByTestId('verb-sheet')).toBeVisible()

  await pressBack(page)
  await expect(page.getByTestId('verb-sheet')).toHaveCount(0)
  // Словарь под шторкой остался на месте.
  await expect(page.getByPlaceholder('поиск по слову')).toBeVisible()
})
