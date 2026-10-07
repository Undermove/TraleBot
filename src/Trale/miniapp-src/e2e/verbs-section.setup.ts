import type { Page } from '@playwright/test'
import { readFileSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

// Раздел «Глаголы» глазами человека: плитка на главной, вход по ссылке из рассылки, «что делать
// сейчас», уровни и наборы, свои глаголы, знакомство по шагам, состояние без доступа.
// API подменяется; раздел и карточки собираются из настоящих данных (Verbs/levels.json, verbs.json) —
// грузинское здесь не пишется от руки.
// VERBS_SHOTS=<папка> — дополнительно сохранить снимки экранов (375 px) для проверки глазами.

const here = dirname(fileURLToPath(import.meta.url))
const read = (file: string) => JSON.parse(readFileSync(resolve(here, '../../Verbs', file), 'utf8'))
export const ladder: { levels: { id: number; title: string; packs: { id: string; title: string; verbs: string[] }[] }[] } = read('levels.json')
export const catalogVerbs: any[] = read('verbs.json').verbs
export const byLemma = new Map(catalogVerbs.map(v => [v.lemma, v]))
export const LADDER = ladder.levels.flatMap(l => l.packs.flatMap(p => p.verbs))
export const FIRST = LADDER[0]
export const ru = (lemma: string) => byLemma.get(lemma).ru as string
export const lemmaOf = (gloss: string) => catalogVerbs.find(v => v.ru === gloss).lemma as string

const shotsDir = process.env.VERBS_SHOTS
export async function shot(page: Page, name: string, fullPage = false) {
  if (!shotsDir) return
  mkdirSync(shotsDir, { recursive: true })
  await page.waitForTimeout(450) // плавная прокрутка и анимации
  await page.screenshot({ path: resolve(shotsDir, `${name}.png`), fullPage })
}

type Level = 'new' | 'meeting' | 'recognising' | 'phrases' | 'examReady' | 'learned'
export interface State {
  access: boolean
  levels: Record<string, Level>
  saved: Array<string | Record<string, unknown>>
  due: Record<string, number>
  alphabetHint: boolean
  hints: string[]
  opened: string[]
  campaignOpens: string[]
  gift: { days: number; accessUntilUtc: string } | null
  translate: (word: string) => object
  /** Начатая сессия с готовым планом — чтобы открыть нужную сцену сразу. */
  session?: object | null
}

function section(s: State) {
  const level = (lemma: string): Level => s.levels[lemma] ?? 'new'
  const place = new Map<string, { levelId: number; packId: string; packTitle: string }>()
  for (const l of ladder.levels) for (const p of l.packs) for (const lemma of p.verbs) place.set(lemma, { levelId: l.id, packId: p.id, packTitle: p.title })
  const verb = (lemma: string) => ({
    id: s.access ? lemma : null, title: s.access ? byLemma.get(lemma).title : null, ru: ru(lemma), level: level(lemma), due: s.due[lemma] ?? 0
  })
  const mine = (lemma: string) => ({ ...verb(lemma), generated: false, levelId: place.get(lemma)?.levelId ?? null, packId: place.get(lemma)?.packId ?? null })
  const started = Object.keys(s.levels)
  const next = (kind: string, lemma: string) => ({ kind, ...verb(lemma), ...place.get(lemma) })
  const inProgress = started.find(l => level(l) !== 'learned')
  const review = Object.keys(s.due)[0]
  const fresh = LADDER.find(l => !started.includes(l))
  const pick = inProgress ? next('continue', inProgress) : review ? next('review', review) : fresh ? next('new', fresh) : null
  return {
    hasAccess: s.access, total: LADDER.length, learned: LADDER.filter(l => level(l) === 'learned').length,
    currentLevel: (pick as any)?.levelId ?? 1, alphabetHint: s.alphabetHint, examples: ['готовить', 'играть', 'смеяться'],
    next: pick, myVerbs: [...started.map(mine), ...s.saved.map(x => (typeof x === 'string' ? mine(x) : x))],
    levels: ladder.levels.map(l => ({ id: l.id, title: l.title, packs: l.packs.map(p => ({ id: p.id, title: p.title, verbs: p.verbs.map(verb) })) }))
  }
}

const card = (lemma: string) => {
  const v = byLemma.get(lemma)
  return {
    id: v.lemma, title: v.title, ru: v.ru, kind: v.kind, present: v.tenses.present?.[0] ?? [], masdarWithPreverb: v.masdarWithPreverb ?? [],
    reason: v.reason ?? '', root: v.root ?? '', oddTenses: v.oddTenses ?? [], model: v.model ?? null, tenses: v.tenses, meanings: v.meanings,
    meaningChips: v.meaningChips, sentences: v.sentences ?? [], source: v.source ?? null, status: 'verified'
  }
}

const learning = (lemma: string) => ({
  progress: { verbId: lemma, canLearn: true, total: 36, forms: [] }, level: 'new', session: null,
  memory: { sessionsPlayed: 0, recentScenes: [], storyCompleted: false, examPassed: false },
  learner: { level: 'beginner', canType: false, dictionarySize: 0, dictionaryVerbs: 0, verbsLearned: 0 }
})

const appCatalog = {
  botUsername: 'TraleBot', miniAppEnabled: true,
  modules: [
    { id: 'alphabet-progressive', title: 'Алфавит', emoji: '', description: '', lessons: [{ id: 1, title: 'Первые буквы', short: 'а, и' }, { id: 2, title: 'Ещё буквы', short: 'м, с' }] },
    { id: 'intro', title: 'Знакомство', emoji: '', description: '', lessons: [{ id: 1, title: 'Привет', short: 'привет' }] },
    { id: 'my-vocabulary', title: 'Мой словарь', emoji: '', description: 'Личный словарь', lessons: [] }
  ]
}

export async function setup(page: Page, patch: Partial<State> = {}): Promise<State> {
  const state: State = {
    access: true, levels: {}, saved: [], due: {}, alphabetHint: false, hints: [], opened: [], campaignOpens: [], gift: null,
    translate: () => ({ status: 'failure' }), ...patch
  }
  await page.addInitScript(() => {
    ;(window as any).Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A123456%7D',
        BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
        MainButton: { show: () => {}, hide: () => {} },
        HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
        openTelegramLink: () => {}
      }
    }
  })
  const me = () => ({
    authenticated: true, isPro: false, isTrialActive: state.access, trialDaysLeft: state.access ? 3 : 0, hasAccess: state.access,
    shouldShowReferralExtensionCta: false, level: 'beginner', vocabularyCount: 0, uiHintsSeen: state.hints,
    progress: { xp: 40, streak: 2, lastPlayedAtUtc: null, completedLessons: { 'alphabet-progressive': [1] }, xpSpent: 0, totalTreatsGiven: 0, lastFedAtUtc: null, lastTreatIndex: null }
  })
  await page.route('**/api/miniapp/**', (route: any) => {
    const request = route.request()
    const path = decodeURIComponent(new URL(request.url()).pathname).replace('/api/miniapp/', '')
    const body = () => { try { return JSON.parse(request.postData() ?? '{}') } catch { return {} } }
    if (path === 'content') return route.fulfill({ json: appCatalog })
    if (path === 'me') return route.fulfill({ json: me() })
    if (path === 'plans') return route.fulfill({ json: { plans: [{ id: 'Month', payloadId: 'Stars_Pro_Month', stars: 100, durationDays: 30, title: '1 месяц', description: '30 дней' }] } })
    if (path.startsWith('activity-days')) return route.fulfill({ json: { dates: [] } })
    if (path === 'referral') return route.fulfill({ json: { link: '', text: '', invited: 0, activated: 0, state: 'trial', bonusShortLabel: '', inviteLine: '' } })
    if (path === 'vocabulary') return route.fulfill({ json: { language: 'Georgian', items: [], verbs: [], starterItems: [] } })
    if (path === 'onboarding/hint-seen') { state.hints.push(body().hintKey); return route.fulfill({ json: { ok: true } }) }
    if (path === 'campaign-open') {
      state.campaignOpens.push(body().key)
      const gift = state.gift
      if (gift) { state.gift = null; state.access = true }
      return route.fulfill({ json: { ok: true, gift } })
    }
    if (path === 'translate') return route.fulfill({ json: state.translate(body().word) })
    if (path === 'verbs/section') return route.fulfill({ json: section(state) })
    if (path === 'verbs/section/open') { state.opened.push(body().source); return route.fulfill({ json: { ok: true } }) }
    if (path.startsWith('verbs/')) {
      const [, lemma, tail] = path.split('/')
      if (!state.access) return route.fulfill({ status: 402, json: { error: 'subscription_required' } })
      if (tail === 'stories') return route.fulfill({ json: { stories: [] } })
      if (tail === 'learning') return route.fulfill({ json: { ...learning(lemma), session: state.session ?? null } })
      if (tail === 'session') return route.fulfill({ json: { state: learning(lemma), xpEarned: 10, progress: null } })
      if (tail === 'progress') return route.fulfill({ json: learning(lemma).progress })
      return route.fulfill({ json: card(lemma) })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  return state
}

