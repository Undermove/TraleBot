import { ALIVE, NAMES, knows, met, phrase, shuffle, type Rng } from '../story'
import { randomLook, type Look } from '../ui'

// «Семейный альбом» — чистая логика: кто есть на доске в каждом режиме, где стоят рамки, в каком порядке
// приходят фото, что Нино говорит на промах, вопросы альбома и фразы «у меня есть …» для своей страницы.
// С урока 25 на доске есть и бабушка с дедушкой (ბებია, ბაბუა — слова сцены): ряд над родителями.

export type FamilyMode = 'parents' | 'siblings' | 'full' | 'album'
export type Role = 'mama' | 'deda' | 'dzma' | 'da' | 'coli' | 'kmari' | 'vazhi' | 'kalishvili' | 'bebia' | 'babua'
export type SlotRole = Role | 'ego'

export interface RoleInfo {
  /** id фразы-слова в story.json — оттуда грузинское и запись. */
  pid: string
  /** Перевод слова. */
  ru: string
  /** Подпись рамки на доске (кем приходится хозяину альбома). */
  label: string
  female: boolean
  age: 'old' | 'adult' | 'kid'
}

export const ROLES: Record<Role, RoleInfo> = {
  bebia: { pid: 'bebia', ru: 'бабушка', label: 'бабушка', female: true, age: 'old' },
  babua: { pid: 'babua', ru: 'дедушка', label: 'дедушка', female: false, age: 'old' },
  mama: { pid: 'mama', ru: 'папа', label: 'папа', female: false, age: 'adult' },
  deda: { pid: 'deda', ru: 'мама', label: 'мама', female: true, age: 'adult' },
  dzma: { pid: 'dzma', ru: 'брат', label: 'брат', female: false, age: 'adult' },
  da: { pid: 'da', ru: 'сестра', label: 'сестра', female: true, age: 'adult' },
  coli: { pid: 'coli', ru: 'жена', label: 'жена брата', female: true, age: 'adult' },
  kmari: { pid: 'kmari', ru: 'муж', label: 'муж сестры', female: false, age: 'adult' },
  vazhi: { pid: 'vazhi', ru: 'сын', label: 'сын брата', female: false, age: 'kid' },
  kalishvili: { pid: 'kalishvili', ru: 'дочь', label: 'дочь брата', female: true, age: 'kid' }
}

export const geoOf = (r: Role) => phrase(ROLES[r].pid).geo
/** «ეს არის <слово>» — так хозяин альбома показывает фото. */
export const thisIs = (r: Role) => `ეს არის ${geoOf(r)}`

// ── Доска ────────────────────────────────────────────────────────────────────────────────────────

export interface Slot { role: SlotRole; x: number; row: number }
export interface Tree {
  rows: number
  slots: Slot[]
  couples: [SlotRole, SlotRole][]
  kids: { parents: [SlotRole, SlotRole]; kids: SlotRole[] }[]
}

const TREES: Record<FamilyMode, Tree> = {
  parents: {
    rows: 3,
    slots: [
      { role: 'babua', x: 0.2, row: 0 }, { role: 'bebia', x: 0.44, row: 0 },
      { role: 'mama', x: 0.32, row: 1 }, { role: 'deda', x: 0.68, row: 1 }, { role: 'ego', x: 0.5, row: 2 }
    ],
    couples: [['babua', 'bebia'], ['mama', 'deda']],
    kids: [{ parents: ['babua', 'bebia'], kids: ['mama'] }, { parents: ['mama', 'deda'], kids: ['ego'] }]
  },
  siblings: {
    rows: 3,
    slots: [
      { role: 'babua', x: 0.24, row: 0 }, { role: 'bebia', x: 0.48, row: 0 },
      { role: 'mama', x: 0.36, row: 1 }, { role: 'deda', x: 0.64, row: 1 },
      { role: 'dzma', x: 0.2, row: 2 }, { role: 'ego', x: 0.5, row: 2 }, { role: 'da', x: 0.8, row: 2 }
    ],
    couples: [['babua', 'bebia'], ['mama', 'deda']],
    kids: [{ parents: ['babua', 'bebia'], kids: ['mama'] }, { parents: ['mama', 'deda'], kids: ['dzma', 'ego', 'da'] }]
  },
  full: {
    rows: 3,
    slots: [
      { role: 'mama', x: 0.4, row: 0 }, { role: 'deda', x: 0.6, row: 0 },
      { role: 'coli', x: 0.1, row: 1 }, { role: 'dzma', x: 0.3, row: 1 }, { role: 'ego', x: 0.5, row: 1 },
      { role: 'da', x: 0.7, row: 1 }, { role: 'kmari', x: 0.9, row: 1 },
      { role: 'vazhi', x: 0.1, row: 2 }, { role: 'kalishvili', x: 0.3, row: 2 }
    ],
    couples: [['mama', 'deda'], ['coli', 'dzma'], ['da', 'kmari']],
    kids: [{ parents: ['mama', 'deda'], kids: ['dzma', 'ego', 'da'] }, { parents: ['coli', 'dzma'], kids: ['vazhi', 'kalishvili'] }]
  },
  // Альбом-повторение (урок 30): вся семья и сверху — бабушка с дедушкой.
  album: {
    rows: 4,
    slots: [
      { role: 'babua', x: 0.3, row: 0 }, { role: 'bebia', x: 0.5, row: 0 },
      { role: 'mama', x: 0.4, row: 1 }, { role: 'deda', x: 0.6, row: 1 },
      { role: 'coli', x: 0.1, row: 2 }, { role: 'dzma', x: 0.3, row: 2 }, { role: 'ego', x: 0.5, row: 2 },
      { role: 'da', x: 0.7, row: 2 }, { role: 'kmari', x: 0.9, row: 2 },
      { role: 'vazhi', x: 0.1, row: 3 }, { role: 'kalishvili', x: 0.3, row: 3 }
    ],
    couples: [['babua', 'bebia'], ['mama', 'deda'], ['coli', 'dzma'], ['da', 'kmari']],
    kids: [{ parents: ['babua', 'bebia'], kids: ['mama'] }, { parents: ['mama', 'deda'], kids: ['dzma', 'ego', 'da'] }, { parents: ['coli', 'dzma'], kids: ['vazhi', 'kalishvili'] }]
  }
}

/** Доска режима; рамки слов, которых человек ещё не встречал к этому уроку, убираем. */
export function familyTree(mode: FamilyMode, lessonId: number): Tree {
  const t = TREES[mode]
  // Слова семьи — новые фразы уроков, бабушка с дедушкой — слова сцены: годится всё, что уже встречалось.
  const ok = (r: SlotRole) => r === 'ego' || met(lessonId, ROLES[r].pid)
  return {
    rows: t.rows,
    slots: t.slots.filter(s => ok(s.role)),
    couples: t.couples.filter(([a, b]) => ok(a) && ok(b)),
    kids: t.kids.filter(k => ok(k.parents[0]) && ok(k.parents[1])).map(k => ({ ...k, kids: k.kids.filter(ok) })).filter(k => k.kids.length > 0)
  }
}

export const treeRoles = (t: Tree): Role[] => t.slots.map(s => s.role).filter((r): r is Role => r !== 'ego')

// ── Раунды ───────────────────────────────────────────────────────────────────────────────────────

export interface Round {
  /** Чей альбом: имя по-грузински и по-русски. */
  owner: string
  ownerRu: string
  ownerLook: Look
  looks: Record<Role, Look>
  /** В каком порядке приходят фото. */
  order: Role[]
}

const OWNERS: Record<Exclude<FamilyMode, 'album'>, string[]> = {
  parents: ['ნინო', 'ანა', 'გიორგი'],
  siblings: ['ნინო', 'დავითი'],
  full: ['ნინო']
}
const FEMALE_OWNERS = new Set(['ნინო', 'ანა', 'მარიამი', 'თამარი'])

export function familyLooks(rng: Rng): Record<Role, Look> {
  const out = {} as Record<Role, Look>
  for (const r of Object.keys(ROLES) as Role[]) {
    const i = ROLES[r]
    out[r] = randomLook(rng, { long: i.female, age: i.age })
  }
  return out
}

export function familyRounds(mode: Exclude<FamilyMode, 'album'>, lessonId: number, rng: Rng = Math.random): Round[] {
  const roles = treeRoles(familyTree(mode, lessonId))
  return OWNERS[mode].map((owner, k) => {
    let order = shuffle(roles, rng)
    // Главная ловушка урока: первым в первом альбоме приходит მამა — звучит как «мама», а это папа.
    if (mode === 'parents' && k === 0 && order.includes('mama')) order = ['mama', ...order.filter(r => r !== 'mama')]
    return {
      owner, ownerRu: NAMES[owner] ?? owner,
      ownerLook: randomLook(rng, { long: FEMALE_OWNERS.has(owner) }),
      looks: familyLooks(rng),
      order
    }
  })
}

// ── Промах ───────────────────────────────────────────────────────────────────────────────────────

/** Что говорит хозяин альбома, если фото положили не в ту рамку. */
export function missReaction(photo: Role, frame: Role): string {
  if (photo === 'mama' && frame === 'deda') return 'მამა — это папа! Мама — დედა.'
  if (photo === 'deda' && frame === 'mama') return 'დედა — это мама! А папа — მამა.'
  if (photo === 'da') return `და — это сестра, а не «и»! ${cap(ROLES[frame].label)} — ${geoOf(frame)}.`
  return `${geoOf(photo)} — это ${ROLES[photo].ru}! А ${ROLES[frame].label} — ${geoOf(frame)}.`
}
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** После стольких промахов на одном фото нужная рамка подсвечивается: застрять нельзя. */
export const SHOW_AFTER = 2

// ── Альбом (повторение) ──────────────────────────────────────────────────────────────────────────

export interface AlbumPage { role: Role; options: Role[] }

/** Пары-ловушки: в вариантах рядом с верным словом стоит его «близнец». */
const TWIN: Record<Role, Role> = {
  mama: 'deda', deda: 'mama', dzma: 'da', da: 'dzma', coli: 'kmari', kmari: 'coli', vazhi: 'kalishvili', kalishvili: 'vazhi', bebia: 'babua', babua: 'bebia'
}

export function albumPages(lessonId: number, rng: Rng = Math.random): AlbumPage[] {
  const roles = treeRoles(familyTree('album', lessonId))
  return shuffle(roles, rng).map(role => {
    const twin = roles.includes(TWIN[role]) ? [TWIN[role]] : []
    const rest = shuffle(roles.filter(r => r !== role && !twin.includes(r)), rng)
    return { role, options: shuffle([role, ...twin, ...rest].slice(0, 3), rng) }
  })
}

/** Очки альбома: за верный с первого раза 1, с серии от трёх — ещё 1 сверху. */
export function albumScore(firstTry: boolean[]): { score: number; best: number } {
  let streak = 0, best = 0, score = 0
  for (const ok of firstTry) {
    streak = ok ? streak + 1 : 0
    best = Math.max(best, streak)
    if (ok) score += streak >= 3 ? 2 : 1
  }
  return { score, best }
}

// ── Своя страница: «у меня есть …» ──────────────────────────────────────────────────────────────

export interface Statement { id: string; geo: string; ru: string }

const OWN_WORDS = ['დედა', 'მამა', 'ძმა', 'ქმარი', 'ცოლი', 'ვაჟი', 'ქალიშვილი', 'კატა', 'მეგობარი']

export function ownStatements(lessonId: number): Statement[] {
  const out: Statement[] = []
  for (const id of ['myavs_dzma_da', 'myavs_da', 'myavs_dzaghli']) {
    if (knows(lessonId, id)) { const p = phrase(id); out.push({ id, geo: p.geo, ru: p.ru }) }
  }
  for (const w of ALIVE.filter(a => OWN_WORDS.includes(a.geo))) {
    const geo = `მე მყავს ${w.geo}`
    if (!out.some(s => s.geo === geo)) out.push({ id: `own-${w.ru}`, geo, ru: `у меня есть ${w.ru}` })
  }
  return out
}

