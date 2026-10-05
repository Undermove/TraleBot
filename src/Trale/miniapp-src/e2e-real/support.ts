import { execFileSync } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type BrowserContext, type Page } from '@playwright/test'

// Общее для настоящего сквозного прогона: свой пользователь на тест (прямо в базе), вход по
// подписанному initData, заглушка Telegram WebApp и «игрок», который проходит сцены сессии,
// беря верные ответы из того, что страница получила от API. Грузинских слов здесь нет.

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:1411'
const DB = process.env.E2E_DB_CONTAINER ?? 'tralebot-e2e-db'
/** Тот же выдуманный токен, с которым scripts/dev/run-local-backend.sh запускает сервер. */
const TOKEN = 'local-dev-token'
const SHOTS = process.env.SHOTS ?? join(__dirname, 'shots')

export function sql(query: string): string {
  return execFileSync('docker', ['exec', DB, 'psql', '-U', 'dev', '-d', 'tralebot', '-qtAc', query], { encoding: 'utf8' }).trim()
}

function signedInitData(telegramId: number) {
  const fields: Record<string, string> = {
    auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'e2e',
    user: JSON.stringify({ id: telegramId, first_name: 'E2E' })
  }
  const check = Object.keys(fields).sort().map(k => `${k}=${fields[k]}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest()
  fields.hash = createHmac('sha256', secret).update(check).digest('hex')
  return new URLSearchParams(fields).toString()
}

export interface Learner { id: string; telegramId: number; initData: string; url: string }

let counter = 0

/** Новый человек с пробным периодом; выбранный уровень и немного опыта — чтобы открывалась главная. */
export async function createLearner(options: { alphabetDone?: boolean } = {}): Promise<Learner> {
  const id = randomUUID(), settings = randomUUID()
  const telegramId = 5_000_000 + Math.floor(Math.random() * 900_000_000) + counter++
  sql(`insert into "Users" ("Id","TelegramId","AccountType","RegisteredAtUtc","UserSettingsId","InitialLanguageSet","IsActive","IsPro","TrialBonusDays","NotificationsEnabled")
       values ('${id}',${telegramId},0,now(),'${settings}',true,true,false,0,true);
       insert into "UsersSettings" ("Id","UserId","CurrentLanguage") values ('${settings}','${id}',1);`)
  const initData = signedInitData(telegramId)
  // Первый вызов /me создаёт строку прогресса.
  const me = await fetch(`${BASE}/api/miniapp/me`, { headers: { 'X-Telegram-Init-Data': initData } })
  expect(me.ok, 'вход по подписанному initData').toBe(true)
  const lessons = options.alphabetDone ? '{"alphabet-progressive":[1,2,3,4,5,6,7,8,9,10,11]}' : '{"alphabet-progressive":[1]}'
  sql(`update "MiniAppUserProgresses" set "Level"='beginner', "Xp"=120, "CompletedLessonsJson"='${lessons}' where "UserId"='${id}'`)
  return { id, telegramId, initData, url: `${BASE}/#tgWebAppData=${encodeURIComponent(initData)}` }
}

/** Вызов API от имени человека — чтобы узнать у сервера то, что тест не должен знать сам. */
export async function api<T = any>(learner: Learner, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${BASE}/api/miniapp/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'X-Telegram-Init-Data': learner.initData, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  expect(r.ok, `${path} → ${r.status}`).toBe(true)
  return r.json() as Promise<T>
}

/** Слово в словарь — прямо в базу, как его сохранил бы перевод. */
export function addWord(learner: Learner, word: string, definition: string) {
  const q = (s: string) => s.replace(/'/g, "''")
  sql(`insert into "VocabularyEntries" ("Id","Word","Definition","AdditionalInfo","Example","DateAddedUtc","UpdatedAtUtc","UserId","Language","SuccessAnswersCount","SuccessAnswersCountInReverseDirection","FailedAnswersCount")
       values ('${randomUUID()}','${q(word)}','${q(definition)}','','',now(),now(),'${learner.id}',1,0,0,0)`)
}

/**
 * Telegram WebApp вне Telegram: вместо скрипта с telegram.org — заглушка, которая читает initData
 * из адреса так же, как настоящий, и даёт нажать «Назад» (window.__pressBack).
 */
export async function installTelegram(context: BrowserContext) {
  await context.route('https://telegram.org/**', route => route.fulfill({ contentType: 'text/javascript', body: '' }))
  await context.addInitScript(() => {
    const match = location.hash.match(/tgWebAppData=([^&]+)/)
    const handlers = new Set<() => void>()
    ;(window as any).__pressBack = () => [...handlers].forEach(h => h())
    ;(window as any).Telegram = {
      WebApp: {
        initData: match ? decodeURIComponent(match[1]) : '',
        initDataUnsafe: { user: { first_name: 'E2E' } },
        ready() {}, expand() {}, onEvent() {}, offEvent() {},
        BackButton: {
          isVisible: false,
          show() { this.isVisible = true }, hide() { this.isVisible = false },
          onClick(h: () => void) { handlers.add(h) }, offClick(h: () => void) { handlers.delete(h) }
        },
        HapticFeedback: { impactOccurred() {}, notificationOccurred() {} }
      }
    }
  })
}

export const pressBack = (page: Page) => page.evaluate(() => (window as any).__pressBack())

// ── Что страница получила от API ─────────────────────────────────────────────

interface Card { id: string; tenses: Record<string, string[][]>; sentences: { ka: string; ru: string; form: string }[] }
interface Scene { type: string; units: number; tenses?: string[]; persons?: number[]; tasks?: { kind: string; key: string }[] }

export class Seen {
  cards = new Map<string, Card>()
  stories: any[] = []
  /** План сессии, которую страница завела или продолжила. */
  plan: { scenes: Scene[] } | null = null
  reports: any[] = []
  saved: any[] = []
  errors: string[] = []
  private verbId: string | null = null

  constructor(page: Page) {
    page.on('pageerror', e => this.errors.push(String(e)))
    page.on('request', request => {
      if (request.method() !== 'POST' || !/\/verbs\/[^/]+\/session$/.test(new URL(request.url()).pathname)) return
      const body = request.postDataJSON()
      this.reports.push(body)
      if (body.plan) this.plan = body.plan
    })
    page.on('response', async response => {
      const path = decodeURIComponent(new URL(response.url()).pathname)
      if (!path.startsWith('/api/miniapp/verbs/') || !response.ok()) return
      const body = await response.json().catch(() => null)
      if (!body) return
      if (path.endsWith('/stories')) this.stories = body.stories
      else if (path.endsWith('/learning')) { this.verbId = path.split('/')[4]; if (body.session) this.plan = body.session.plan }
      else if (path.endsWith('/session')) { this.saved.push(body); if (body.state?.session) this.plan = body.state.session.plan }
      else if (body.tenses) this.cards.set(body.id, body)
    })
  }

  /** Карточка глагола, с которым идёт игра (а не глагола-образца, которого сессия догружает для конструктора). */
  card(): Card {
    const card = (this.verbId && this.cards.get(this.verbId)) || [...this.cards.values()].pop()
    if (!card) throw new Error('страница ещё не получила карточку глагола')
    return card
  }
}

export async function shot(page: Page, name: string) {
  mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: join(SHOTS, `${name}.png`) })
}

// ── Игрок ────────────────────────────────────────────────────────────────────

const STOPS = ['aorist', 'present', 'future']
const words = (ka: string) => ka.match(/[ა-ჰ]+/g) ?? []
const TERMS = /аорист|имперфект|оптатив|конъюнктив|масдар|перфект/i

export const session = (page: Page) => page.getByTestId('verb-session')
const percent = async (page: Page) => Number(await page.getByTestId('session-bar').first().getAttribute('data-percent'))

/** Набрать слово на экранной грузинской клавиатуре. */
async function typeGeorgian(page: Page, text: string) {
  for (const ch of text) await page.getByRole('button', { name: ch, exact: true }).last().click()
}

/** Закрыть правила игры, если они выехали сами (первый вход). */
async function dismissRules(page: Page) {
  const rules = page.getByText(/Как играть · \d из \d/)
  if (!(await rules.isVisible().catch(() => false))) return
  for (let n = 0; n < 6 && (await rules.isVisible().catch(() => false)); n++) {
    const play = page.getByRole('button', { name: 'Играть', exact: true })
    if (await play.isVisible().catch(() => false)) await play.click()
    else await page.getByRole('button', { name: 'Дальше', exact: true }).last().click()
  }
}

export interface PlayOptions {
  /** В заданиях с выбором сначала нажать неверный вариант. */
  mistakes?: boolean
  /** Остановиться после стольких пройденных заданий (сессия остаётся недоигранной). */
  stopAfter?: number
  /** Снимки экрана: префикс имени файла. */
  shots?: string
  /** В кадрах комикса с набором сначала подсмотреть слово в таблице. */
  peek?: boolean
}

export interface Played { scenes: string[]; tasks: number; bar: number[]; notes: string[] }

/**
 * Пройти открытую сессию до финиша (или до stopAfter заданий). После каждого задания полоска
 * должна стать длиннее — это проверяется здесь же, для каждой сцены.
 */
export async function playSession(page: Page, seen: Seen, options: PlayOptions = {}): Promise<Played> {
  const played: Played = { scenes: [], tasks: 0, bar: [], notes: [] }
  const root = session(page)
  await expect(root).toBeVisible()
  let last = -1

  /** Задание пройдено: ждём, пока полоска вырастет (или сессия кончится). */
  const stepped = async () => {
    played.tasks++
    await expect.poll(async () => {
      if ((await root.getAttribute('data-scene')) === 'finish') return 101
      return percent(page).catch(() => last)
    }, { message: `после задания ${played.tasks} полоска не выросла (было ${last}%)`, timeout: 8000 }).toBeGreaterThan(last)
    last = (await root.getAttribute('data-scene')) === 'finish' ? 100 : await percent(page)
    played.bar.push(last)
  }
  const mistake = async (wrong: () => Promise<void>, note: string) => {
    if (!options.mistakes) return
    const before = await percent(page)
    await wrong()
    const text = (await page.getByTestId(note).textContent()) ?? ''
    played.notes.push(text)
    expect(text, 'объяснение ошибки без названий времён').not.toMatch(TERMS)
    expect(await percent(page), 'ошибка не двигает полоску назад').toBeGreaterThanOrEqual(before)
  }

  for (let guard = 0; guard < 200; guard++) {
    if (options.stopAfter !== undefined && played.tasks >= options.stopAfter) return played
    const scene = await root.getAttribute('data-scene')
    if (scene === 'finish') return played
    if (await page.getByTestId('session-saving').isVisible().catch(() => false)) { await page.waitForTimeout(150); continue }
    if (scene && played.scenes[played.scenes.length - 1] !== scene) {
      played.scenes.push(scene)
      if (options.shots) { await dismissRules(page); await shot(page, `${options.shots}-${played.scenes.length}-${scene}`) }
    }
    await dismissRules(page)
    const card = seen.card()
    const formAt = (tense: string, person: number) => card.tenses[tense][person][0]

    if (scene === 'time') {
      const ask = page.getByTestId('time-ask')
      const stop = Number(await ask.getAttribute('data-stop')), person = Number(await ask.getAttribute('data-person'))
      const right = formAt(STOPS[stop], person)
      const options_ = page.locator('.grid.grid-cols-2 button')
      await mistake(async () => {
        const texts = await options_.allTextContents()
        await options_.nth(texts.findIndex(t => t !== right)).click()
      }, 'time-said')
      await options_.getByText(right, { exact: true }).click()
      await stepped()
      // Бомбора доезжает до флажка и ставится следующий раунд.
      await expect.poll(async () => {
        if ((await root.getAttribute('data-scene')) !== 'time') return 'next'
        const now = page.getByTestId('time-ask')
        return `${await now.getAttribute('data-stop')}:${await now.getAttribute('data-person')}:${await page.getByTestId('time-said').textContent()}`
      }).not.toBe(`${stop}:${person}:Он на месте!`)
      continue
    }

    if (scene === 'bones') {
      const plan = seen.plan!.scenes[Number(await root.getAttribute('data-scene-index'))]
      const cols = plan.persons!.length
      const closed = page.locator('[data-testid^="bones-cell-"][data-state="closed"]').first()
      // Все косточки найдены — сцена сама уйдёт дальше через секунду.
      if (!(await closed.count()) || (await page.getByTestId('bones-won').isVisible().catch(() => false))) { await page.waitForTimeout(200); continue }
      const cell = Number(await closed.getAttribute('data-cell'))
      const right = formAt(plan.tenses![Math.floor(cell / cols)], plan.persons![cell % cols])
      await closed.click()
      const dig = page.getByTestId('bones-dig')
      if (await dig.getByText('Копать').isVisible().catch(() => false)) {
        await typeGeorgian(page, right)
        await dig.getByText('Копать').click()
      } else {
        await mistake(async () => {
          const texts = await dig.locator('.grid button').allTextContents()
          await dig.locator('.grid button').nth(texts.findIndex(t => t !== right)).click()
        }, 'bones-note')
        await dig.locator('.grid button').getByText(right, { exact: true }).click()
      }
      await expect(page.getByTestId(`bones-cell-${cell}`)).not.toHaveAttribute('data-state', 'closed')
      await stepped()
      continue
    }

    if (scene === 'builder') {
      const ask = page.getByTestId('builder-ask')
      const right = formAt((await ask.getAttribute('data-tense'))!, Number(await ask.getAttribute('data-person')))
      const frame = page.getByTestId('builder-frame').locator('> div').first()
      // Ряды, где есть выбор, перебираем, пока слово в рамке не совпадёт с нужным.
      const rows = ['preverb', 'marker', 'ending'].map(id => page.getByTestId(`builder-row-${id}`).locator('button:not([disabled])'))
      const counts = await Promise.all(rows.map(r => r.count()))
      const tryAll = async (row: number): Promise<boolean> => {
        if (row === rows.length) return (await frame.textContent()) === right
        if (!counts[row]) return tryAll(row + 1)
        for (let i = 0; i < counts[row]; i++) {
          await rows[row].nth(i).click()
          if (await tryAll(row + 1)) return true
        }
        return false
      }
      expect(await tryAll(0), `конструктор: собрать ${right}`).toBe(true)
      await page.getByRole('button', { name: 'Собрать' }).click()
      await stepped()
      await page.getByRole('button', { name: 'Дальше', exact: true }).click()
      continue
    }

    if (scene === 'story') {
      const story = seen.stories[0]
      if (await page.getByTestId('story-end').isVisible().catch(() => false)) {
        await page.getByTestId('story-end').getByRole('button', { name: 'Дальше' }).click()
        continue
      }
      // Текущий кадр — последний, у которого открыта реплика.
      const lines = await page.locator('[data-testid^="story-line-"]').evaluateAll(els => els.map(e => Number(e.getAttribute('data-testid')!.replace('story-line-', ''))))
      const frame = story.frames[Math.max(...lines)]
      // На кнопке — слово и его транскрипция: ищем кнопку, текст которой начинается ровно с этого слова.
      const option = (form: string) => page.locator('button').filter({ hasText: new RegExp(`^${form}(?![ა-ჰ])`) }).last()
      if (frame.mode === 'choose') {
        await mistake(async () => {
          const other = frame.options.find((o: any) => o.form !== frame.target.form)
          await option(other.form).click()
        }, 'story-note')
        await option(frame.target.form).click()
      } else if (frame.mode === 'type') {
        await page.getByTestId('story-type-field').click()
        if (options.peek) {
          // Не помню слово: подсматриваем в таблице и возвращаемся — кадр и набранное должны остаться на месте.
          const half = [...frame.target.form].slice(0, 2).join('')
          await typeGeorgian(page, half)
          await page.getByTestId('table-peek').click()
          const sheet = page.getByTestId('table-peek-sheet')
          await expect(sheet.getByText(frame.target.form, { exact: true }).first()).toBeVisible()
          await page.waitForTimeout(600) // шторка выезжает с анимацией
          if (options.shots) await shot(page, `${options.shots}-peek`)
          await sheet.getByRole('button', { name: 'Вернуться к заданию' }).click()
          await expect(sheet).toHaveCount(0)
          await expect(page.getByTestId('story-type-field')).toHaveText(half)
          await typeGeorgian(page, [...frame.target.form].slice(2).join(''))
        } else await typeGeorgian(page, frame.target.form)
        await page.getByRole('button', { name: 'Сказать' }).click()
      } else {
        for (const word of words(frame.ka)) await page.getByTestId('story-chips').getByRole('button', { name: word, exact: true }).first().click()
        await page.getByRole('button', { name: 'Сказать' }).click()
      }
      await stepped()
      continue
    }

    // Сцена-квиз: знакомство, выбор, фразы, разминка, экзамен.
    const quiz = page.getByTestId('quiz-scene')
    if (!(await quiz.isVisible().catch(() => false))) { await page.waitForTimeout(150); continue }
    const kind = await quiz.getAttribute('data-task'), key = (await quiz.getAttribute('data-key'))!
    const [tense, person] = key.split(':')
    if (kind === 'intro') {
      await page.getByRole('button', { name: 'Понятно' }).click()
    } else if (kind === 'type') {
      await typeGeorgian(page, formAt(tense, Number(person)))
      await page.getByRole('button', { name: 'Проверить' }).click()
    } else if (kind === 'build') {
      const ru = (await quiz.locator('.text-\\[20px\\]').first().textContent())!.trim()
      const sentence = card.sentences.find(s => s.ru === ru && card.tenses[tense][Number(person)].includes(s.form))
      expect(sentence, `фраза для сборки: ${ru}`).toBeTruthy()
      for (const word of words(sentence!.ka)) await page.getByTestId('ladder-chips').getByRole('button', { name: word, exact: true }).first().click()
      await page.getByRole('button', { name: 'Проверить' }).click()
    } else {
      // На экзамене попытка одна — там не ошибаемся нарочно.
      if (scene !== 'exam') {
        await mistake(async () => {
          await quiz.locator(`[data-testid^="ladder-option-"]:not([data-testid="ladder-option-${key}"])`).first().click()
        }, 'ladder-note')
      }
      await page.getByTestId(`ladder-option-${key}`).click()
    }
    await stepped()
    // Квиз сам листает дальше; ждём следующее задание (или «Дальше» после другого порядка слов).
    const next = page.getByRole('button', { name: 'Дальше', exact: true })
    await expect.poll(async () => {
      if (await next.isVisible().catch(() => false)) { await next.click().catch(() => {}); return 'moved' }
      if ((await root.getAttribute('data-scene')) !== scene) return 'moved'
      const now = page.getByTestId('quiz-scene')
      if (!(await now.isVisible().catch(() => false))) return 'moved'
      return `${await now.getAttribute('data-task')}:${await now.getAttribute('data-key')}` === `${kind}:${key}` ? 'same' : 'moved'
    }, { timeout: 8000 }).toBe('moved')
  }
  throw new Error('сессия не кончается')
}

/** Открыть мини-апп сразу на словаре (вход — по подписанному initData в адресе). */
export async function openDictionary(page: Page, learner: Learner) {
  await page.goto(learner.url.replace('/#', '/?screen=vocabulary#'))
  await expect(page.getByPlaceholder('поиск по слову')).toBeVisible({ timeout: 20_000 })
}

export interface VerbRef { id: string; ru: string; card: Card }

/** Глагол каталога по русскому переводу — как его отдаёт сервер. */
export async function verbByRu(learner: Learner, ru: string): Promise<VerbRef> {
  const list = await api<{ verbs: { id: string; ru: string }[] }>(learner, 'verbs')
  const verb = list.verbs.find(v => v.ru === ru || v.ru.split(', ').includes(ru))
  if (!verb) throw new Error(`в каталоге нет глагола «${ru}»`)
  return { id: verb.id, ru: verb.ru, card: await api<Card>(learner, `verbs/${encodeURIComponent(verb.id)}`) }
}

/** Сохранить в словарь форму «я, сейчас» этого глагола и открыть её вид из словаря. */
export async function openVerbFromDictionary(page: Page, learner: Learner, verb: VerbRef, translation: string) {
  const form = verb.card.tenses.present[0][0]
  addWord(learner, form, translation)
  await openDictionary(page, learner)
  await page.getByRole('listitem').filter({ hasText: translation }).getByRole('button').last().click()
  await expect(page.getByTestId('verb-entry')).toContainText(form)
  await expect(page.getByTestId('session-entry')).toBeVisible()
  return form
}

export const playButton = (page: Page) => page.getByTestId('session-entry').getByRole('button')
export const learning = (learner: Learner, verb: VerbRef) => api(learner, `verbs/${encodeURIComponent(verb.id)}/learning`)
