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
type Unit = { id: string; title: string; verbs: string[] }
export const ladder: { levels: { id: number; title: string; packs: Unit[]; families?: Unit[] }[] } = read('levels.json')
export const catalogVerbs: any[] = read('verbs.json').verbs
export const byLemma = new Map(catalogVerbs.map(v => [v.lemma, v]))
/** Семьи глаголов (один глагол с приставками направления) — из того же файла, что читает сервер. */
export const families: any[] = read('families.json').families.filter((f: any) => f.enabled)
export const familyOf = (lemma: string) => families.find(f => f.members.some((m: any) => m.lemma === lemma))
const cardId = (familyId: string) => `family-${familyId}`
/** Уровень ведёт сначала по карточкам семей, потом по наборам — как на сервере. */
const units = (l: (typeof ladder.levels)[number]): Unit[] => [...(l.families ?? []).map(f => ({ ...f, id: cardId(f.id) })), ...l.packs]
export const LADDER = ladder.levels.flatMap(l => units(l).flatMap(p => p.verbs))

/** Строки теории уроков о приставках — из исходника сервера, слово в слово (как их отдаёт API). */
function introScreens(family: any) {
  const source = readFileSync(resolve(here, '../../MiniApp/MiniAppContentProvider.cs'), 'utf8')
  const module = source.slice(source.indexOf('BuildPreverbsModule()\n'))
  const prefixes: string[] = family.members.flatMap((m: any) => m.prefixes)
  return (family.introLessons as number[]).map(id => {
    const lesson = module.slice(module.indexOf(`Lesson(${id}, `), module.indexOf(`Lesson(${id + 1}, `))
    const strings = [...lesson.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => m[1])
    return { lessonId: id, title: strings[2], lines: strings.filter(line => prefixes.some(p => line.startsWith(`${p}- `))) }
  }).filter(screen => screen.lines.length)
}
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
  /** Уроки о приставках направления пройдены. */
  lessonDone?: boolean
}

function section(s: State) {
  const level = (lemma: string): Level => s.levels[lemma] ?? 'new'
  const place = new Map<string, { levelId: number; packId: string; packTitle: string }>()
  for (const l of ladder.levels) for (const p of units(l)) for (const lemma of p.verbs) place.set(lemma, { levelId: l.id, packId: p.id, packTitle: p.title })
  const learned = (lemma: string) => level(lemma) === 'learned'
  const card = (unit: Unit) => {
    const family = families.find(f => f.id === unit.id)
    return {
      id: cardId(family.id), title: family.title, baseName: family.baseName, baseLearned: learned(family.base),
      members: family.members.map((m: any) => ({
        ...verb(m.lemma), role: m.role, direction: m.direction, toward: m.toward, directionRu: m.directionRu, inCard: unit.verbs.includes(m.lemma)
      }))
    }
  }
  /** Как на сервере: глагол семьи при невыученном основном уступает место основному, при выученном — играется короткой сессией. */
  const offer = (kind: string, lemma: string) => {
    const family = familyOf(lemma)
    const member = family && family.base !== lemma
    if (member && !learned(family.base) && !learned(lemma)) return next(level(family.base) === 'new' ? 'new' : 'continue', family.base)
    return { ...next(kind, lemma), familyBase: member && !learned(lemma) ? family.baseName : null }
  }
  const verb = (lemma: string) => ({
    id: s.access ? lemma : null, title: s.access ? byLemma.get(lemma).title : null, ru: ru(lemma), level: level(lemma), due: s.due[lemma] ?? 0
  })
  const mine = (lemma: string) => ({ ...verb(lemma), generated: false, levelId: place.get(lemma)?.levelId ?? null, packId: place.get(lemma)?.packId ?? null })
  const started = Object.keys(s.levels)
  const next = (kind: string, lemma: string) => ({ kind, ...verb(lemma), ...place.get(lemma) })
  const inProgress = started.find(l => level(l) !== 'learned')
  const review = Object.keys(s.due)[0]
  const fresh = LADDER.find(l => !started.includes(l))
  const pick = inProgress ? offer('continue', inProgress) : review ? next('review', review) : fresh ? offer('new', fresh) : null
  return {
    hasAccess: s.access, total: LADDER.length, learned: LADDER.filter(l => level(l) === 'learned').length,
    currentLevel: (pick as any)?.levelId ?? 1, alphabetHint: s.alphabetHint, examples: ['готовить', 'играть', 'смеяться'],
    next: pick, myVerbs: [...started.map(mine), ...s.saved.map(x => (typeof x === 'string' ? mine(x) : x))],
    levels: ladder.levels.map(l => ({
      id: l.id, title: l.title, families: (l.families ?? []).map(card),
      packs: l.packs.map(p => ({ id: p.id, title: p.title, verbs: p.verbs.map(verb) }))
    }))
  }
}

const card = (lemma: string) => {
  const v = byLemma.get(lemma)
  return {
    id: v.lemma, title: v.title, ru: v.ru, kind: v.kind, present: v.tenses.present?.[0] ?? [], masdarWithPreverb: v.masdarWithPreverb ?? [],
    reason: v.reason ?? '', root: v.root ?? '', oddTenses: v.oddTenses ?? [], model: v.model ?? null, tenses: v.tenses, meanings: v.meanings,
    meaningChips: v.meaningChips, sentences: v.sentences ?? [], source: v.source ?? null, status: 'verified',
    family: familyNote(lemma)
  }
}

const memberRef = (m: any) => ({
  id: m.lemma, title: byLemma.get(m.lemma).title, ru: ru(m.lemma), role: m.role, direction: m.direction, toward: m.toward, directionRu: m.directionRu
})

function familyNote(lemma: string) {
  const family = familyOf(lemma)
  if (!family) return undefined
  const me = family.members.find((m: any) => m.lemma === lemma)
  return {
    id: family.id, title: family.title, baseName: family.baseName, role: me.role, prefixes: me.prefixes, direction: me.direction,
    toward: me.toward, directionRu: me.directionRu, lessonModule: family.lessonModule, members: family.members.map(memberRef)
  }
}

const MAIN_TENSES = ['present', 'aorist', 'imperfect', 'optative', 'conditional', 'future']
const only = (table: Record<string, unknown> | undefined) => Object.fromEntries(MAIN_TENSES.filter(t => table?.[t]).map(t => [t, table![t]]))

function familyDto(family: any, s: State) {
  return {
    id: family.id, title: family.title, baseName: family.baseName, baseId: family.base, baseLearned: s.levels[family.base] === 'learned',
    members: family.members.map((m: any) => ({
      ...memberRef(m), prefixes: m.prefixes, level: s.levels[m.lemma] ?? 'new',
      tenses: only(byLemma.get(m.lemma).tenses), meanings: only(byLemma.get(m.lemma).meanings)
    })),
    intro: { lessonDone: !!s.lessonDone, moduleId: family.lessonModule, moduleTitle: 'Приставки направления', screens: introScreens(family) }
  }
}

const learning = (lemma: string, s?: State) => {
  const family = familyOf(lemma)
  const level = s?.levels[lemma] ?? 'new'
  return {
    progress: { verbId: lemma, canLearn: true, total: 36, forms: [] }, level, session: null,
    memory: { sessionsPlayed: 0, recentScenes: [], storyCompleted: false, examPassed: level === 'learned' },
    learner: { level: 'beginner', canType: false, dictionarySize: 0, dictionaryVerbs: 0, verbsLearned: 0 },
    family: family ? {
      id: family.id, role: family.base === lemma ? 'base' : 'member', baseId: family.base, baseName: family.baseName,
      baseLearned: s?.levels[family.base] === 'learned', lessonDone: !!s?.lessonDone
    } : null
  }
}

const appCatalog = {
  botUsername: 'TraleBot', miniAppEnabled: true,
  modules: [
    { id: 'alphabet-progressive', title: 'Алфавит', emoji: '', description: '', lessons: [{ id: 1, title: 'Первые буквы', short: 'а, и' }, { id: 2, title: 'Ещё буквы', short: 'м, с' }] },
    { id: 'intro', title: 'Знакомство', emoji: '', description: '', lessons: [{ id: 1, title: 'Привет', short: 'привет' }] },
    { id: 'preverbs', title: 'Приставки направления', emoji: '', description: '', lessons: [{ id: 1, title: 'Первые приставки', short: 'внутрь, наружу' }] },
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
      if (lemma === 'families') {
        const family = families.find(f => f.id === tail)
        return family ? route.fulfill({ json: familyDto(family, state) }) : route.fulfill({ status: 404, json: {} })
      }
      if (tail === 'learning') return route.fulfill({ json: { ...learning(lemma, state), session: state.session ?? null } })
      if (tail === 'session') {
        // Как на сервере: сданная проверка приставки (или экзамен) делает глагол выученным.
        const report = body()
        const check = (report.scenes ?? []).includes('prefixcheck') || (report.scenes ?? []).includes('exam')
        if (report.finished && check && report.examAsked >= 6 && report.examCorrect >= report.examAsked - 1) state.levels[lemma] = 'learned'
        else if (report.finished && !state.levels[lemma]) state.levels[lemma] = 'meeting'
        return route.fulfill({ json: { state: learning(lemma, state), xpEarned: 10, progress: null } })
      }
      if (tail === 'progress') return route.fulfill({ json: learning(lemma).progress })
      return route.fulfill({ json: card(lemma) })
    }
    return route.fulfill({ status: 404, json: {} })
  })
  return state
}

