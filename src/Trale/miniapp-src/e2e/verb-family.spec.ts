import { test, expect, type Page } from '@playwright/test'
import { byLemma, families, ladder, ru, setup, shot } from './verbs-section.setup'

// Семья глаголов глазами человека: карточка семьи в разделе, карточка глагола с приставкой,
// короткая сессия про приставку (вступление, игра, ошибка, проверка, финиш). 375 px.
// Грузинское здесь не пишется: семья, формы и строки урока берутся из файлов проекта.

test.use({ viewport: { width: 375, height: 812 } })

const TOUR_SEEN = ['ui:verbs_tour_now', 'ui:verbs_tour_card', 'ui:verbs_tour_level', 'ui:verbs_tour_mine']
const GO = families.find(f => f.id === 'go')
const BASE: string = GO.base
const CARD: string[] = ladder.levels.flatMap(l => l.families ?? []).find(f => f.id === 'go')!.verbs
const member = (lemma: string) => GO.members.find((m: any) => m.lemma === lemma)
const at = (direction: string, toward: string): string => GO.members.find((m: any) => m.direction === direction && m.toward === toward).lemma
const OUT = at('out', 'there')

async function noSideScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
}

async function openLevel2(page: Page) {
  const level = page.getByTestId('verbs-level-2')
  if ((await level.getAttribute('data-open')) !== 'true') await level.getByRole('button').first().click()
  await page.getByTestId('verbs-family-go').scrollIntoViewIfNeeded()
}

test('a newcomer sees the family as one card: a scheme of directions, a counter and one button that leads to the base verb', async ({ page }) => {
  await setup(page, { hints: TOUR_SEEN })
  await page.goto('/?playwright=1&screen=verbs')
  await openLevel2(page)

  const card = page.getByTestId('verbs-family-go')
  await expect(card).toContainText(GO.title)
  await expect(card.getByTestId('family-hint')).toBeVisible()
  await expect(card.locator('[data-testid^="family-pill-"]')).toHaveCount(GO.members.length)
  await expect(card.locator('[data-testid^="family-pill-"][data-state="new"]')).toHaveCount(GO.members.length)
  await expect(card.getByTestId('family-progress')).toHaveText('туда: 0 из 6 · сюда: 0 из 6')
  await expect(card.getByTestId('family-play')).toHaveText(`Сначала «${GO.baseName}» — 2 минуты`)
  for (const pill of await card.locator('[data-testid^="family-pill-"]').all()) {
    expect((await pill.boundingBox())!.height, 'a direction is comfortable to tap').toBeGreaterThanOrEqual(44)
  }
  // Десять глаголов семьи не разложены по наборам.
  await expect(page.getByTestId('verbs-pack-in-out')).toHaveCount(0)
  await expect(page.getByTestId('verbs-level-2-count')).toContainText(`из ${ladder.levels[1].packs.flatMap(p => p.verbs).length + CARD.length}`)
  await noSideScroll(page)
  await shot(page, '01-section-family-new')

  await card.getByTestId('family-play').click()
  await expect(page.getByTestId('verb-session')).toBeVisible()
  await expect(page.getByTestId('verb-session')).not.toHaveAttribute('data-scene', /prefix/)
})

test('mid-way: learned and started directions are told apart, and «что делать сейчас» offers the prefix session', async ({ page }) => {
  const levels = {
    [BASE]: 'learned', [at('none', 'here')]: 'learned', [at('in', 'there')]: 'learned', [at('out', 'here')]: 'learned',
    [OUT]: 'meeting'
  } as const
  await setup(page, { hints: [...TOUR_SEEN, 'ui:verbs_family_card'], levels })
  await page.goto('/?playwright=1&screen=verbs')

  await expect(page.getByTestId('verbs-now')).toHaveAttribute('data-kind', 'continue')
  await expect(page.getByTestId('verbs-now-ru')).toHaveText(ru(OUT))
  await expect(page.getByTestId('verbs-now-family')).toContainText(`это «${GO.baseName}» с приставкой`)
  await shot(page, '02-section-now-prefix')

  await openLevel2(page)
  const card = page.getByTestId('verbs-family-go')
  await expect(card).toHaveAttribute('data-current', 'true')
  await expect(card.getByTestId('family-progress')).toHaveText('туда: 2 из 6 · сюда: 2 из 6')
  await expect(card.getByTestId('family-pill-out-there')).toHaveAttribute('data-state', 'started')
  await expect(card.getByTestId('family-pill-in-there')).toHaveAttribute('data-state', 'learned')
  await expect(card.getByTestId('family-pill-up-there')).toHaveAttribute('data-state', 'new')
  await expect(card.getByTestId('family-play')).toHaveText('Продолжить — 2 минуты')
  await expect(card.getByTestId('family-hint')).toHaveCount(0)
  await noSideScroll(page)
  await shot(page, '03-section-family-mid')
})

test('the card of a direction says what it is, highlights the prefix in every form and links to the base verb', async ({ page }) => {
  await setup(page, { hints: [...TOUR_SEEN, 'ui:verbs_family_card', 'ui:verb_card_person'], levels: { [BASE]: 'learned' } })
  await page.goto('/?playwright=1&screen=verbs')
  await openLevel2(page)
  await page.getByTestId('family-pill-across-there').click()

  const sheet = page.getByTestId('verb-sheet')
  const across = member(at('across', 'there'))
  await expect(sheet.getByTestId('family-line')).toContainText(`Это «${GO.baseName}» с приставкой «${across.directionRu}»`)
  await expect(sheet.getByTestId('form-prefix')).toHaveCount(6)
  for (const part of await sheet.getByTestId('form-prefix').all()) await expect(part).toHaveText(across.prefixes[0])
  await expect(sheet.getByTestId('session-entry')).toHaveAttribute('data-mode', 'prefix')
  await expect(sheet.getByTestId('session-entry')).toContainText('Выучить приставку — 2 минуты')
  await noSideScroll(page)
  await shot(page, '04-member-card')

  // «Сюда»: приставка составная — выделена целиком.
  await sheet.getByTestId('family-base').click()
  await expect(sheet.getByTestId('family-note')).toHaveAttribute('data-role', 'base')
  await expect(sheet.getByTestId('family-member')).toHaveCount(GO.members.length - 1)
  await expect(sheet.getByTestId('session-entry')).toHaveAttribute('data-mode', 'full')
  await noSideScroll(page)
  await shot(page, '05-base-card')

  await sheet.getByTestId('family-member').filter({ hasText: 'наружу, сюда' }).click()
  const here = member(at('out', 'here'))
  await expect(sheet.getByTestId('family-line')).toContainText(`«${here.directionRu}» + «сюда»`)
  await expect(sheet.getByTestId('form-prefix').first()).toHaveText(here.prefixes[0])
  await shot(page, '06-member-card-here')
})

test('while the base verb is not learned, the card of a direction leads to the base verb first', async ({ page }) => {
  await setup(page, { hints: [...TOUR_SEEN, 'ui:verbs_family_card', 'ui:verb_card_person'] })
  await page.goto('/?playwright=1&screen=verbs')
  await openLevel2(page)
  await page.getByTestId('family-pill-up-there').click()

  const sheet = page.getByTestId('verb-sheet')
  await expect(sheet.getByTestId('session-entry')).toHaveAttribute('data-mode', 'base-first')
  await expect(sheet.getByTestId('session-entry-base')).toHaveText(`Сначала «${GO.baseName}»`)
  await expect(sheet.getByTestId('session-entry-alone')).toBeVisible()
  await shot(page, '07-member-card-base-first')

  await sheet.getByTestId('session-entry-base').click()
  await expect(sheet.getByTestId('family-note')).toHaveAttribute('data-role', 'base')
})

async function right(page: Page) {
  await page.locator('[data-testid="prefix-option"][data-right="true"]').click()
}

test('the prefix session: an intro from the lesson, questions about direction, a wrong answer explained, a check, and the verb is learned', async ({ page }) => {
  const state = await setup(page, { hints: [...TOUR_SEEN, 'ui:verbs_family_card'], levels: { [BASE]: 'learned' } })
  await page.goto('/?playwright=1&screen=verbs')
  await openLevel2(page)
  await page.getByTestId('family-play').click()

  // Вступление — три экрана из уроков о приставках.
  const intro = page.getByTestId('prefix-intro')
  await expect(intro).toBeVisible()
  await expect(intro.getByTestId('prefix-intro-line').first()).toBeVisible()
  await expect(intro.getByTestId('prefix-intro-lesson')).toContainText('Приставки направления')
  await noSideScroll(page)
  await shot(page, '10-intro-1')
  await page.getByRole('button', { name: 'Дальше', exact: true }).click()
  await shot(page, '11-intro-2')
  await page.getByRole('button', { name: 'Дальше', exact: true }).click()
  await shot(page, '12-intro-3')
  await page.getByRole('button', { name: 'Понятно, играть' }).click()

  // Правила при первом входе.
  await expect(page.getByText('Как играть · 1 из 3')).toBeVisible()
  await shot(page, '13-prefix-rules')
  await page.getByRole('button', { name: 'Дальше', exact: true }).click()
  await page.getByRole('button', { name: 'Дальше', exact: true }).click()
  await page.getByRole('button', { name: 'Играть', exact: true }).click()

  // «Как сказать?»: фраза, схема, четыре слова той же клетки с разными приставками.
  const scene = page.getByTestId('prefix-scene')
  await expect(scene).toHaveAttribute('data-kind', 'form')
  await expect(scene).toHaveAttribute('data-mode', 'play')
  // Первым идёт пара основного глагола — «приходить»: он стоит раньше всех в порядке раздела.
  const first = at('none', 'here')
  await expect(scene).toHaveAttribute('data-target', first)
  await expect(page.getByTestId('prefix-phrase')).toHaveText(byLemma.get(first).meanings.present[2])
  await expect(page.getByTestId('prefix-option')).toHaveCount(4)
  for (const option of await page.getByTestId('prefix-option').all()) {
    const box = (await option.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.x + box.width).toBeLessThanOrEqual(375)
    await expect(option).toContainText(/[а-яё]/i)
  }
  await noSideScroll(page)
  await shot(page, '14-prefix-form-first-move')

  // Ошибка: сказано, что значит выбранное; можно выбрать ещё раз.
  await page.locator('[data-testid="prefix-option"][data-right="false"]').first().click()
  await expect(page.getByTestId('prefix-note')).toContainText('Выбери другое')
  await expect(page.getByTestId('prefix-note')).toContainText('— это «')
  await shot(page, '15-prefix-form-wrong')
  await right(page)
  await expect(page.getByTestId('prefix-note')).toContainText('Верно')
  await shot(page, '16-prefix-form-right')

  // «Куда?»: слово, варианты — направления схемой.
  await expect(scene).toHaveAttribute('data-kind', 'direction')
  await expect(page.getByTestId('prefix-form').getByTestId('prefix-part')).toHaveText(member(first).prefixes[0])
  await noSideScroll(page)
  await shot(page, '17-prefix-direction')
  await page.locator('[data-testid="prefix-option"][data-right="false"]').first().click()
  await expect(page.getByTestId('prefix-note')).toContainText('это было бы')
  await shot(page, '18-prefix-direction-wrong')
  await right(page)

  // Третий вопрос — про соседа: ответ не всегда один и тот же.
  await expect(scene).not.toHaveAttribute('data-target', first)
  for (let i = 0; i < 4; i++) {
    await right(page)
    await page.waitForTimeout(1250)
  }

  // Проверка: одна попытка на вопрос.
  await expect(page.getByText('Как играть · 1 из 2')).toBeVisible()
  await shot(page, '19-check-rules')
  await page.getByRole('button', { name: 'Дальше', exact: true }).click()
  await page.getByRole('button', { name: 'Играть', exact: true }).click()
  await expect(scene).toHaveAttribute('data-mode', 'check')
  await expect(page.getByText('Проверка · 1 из 6')).toBeVisible()
  await shot(page, '20-check')
  await page.locator('[data-testid="prefix-option"][data-right="false"]').first().click()
  await expect(page.getByTestId('prefix-note')).toContainText('А здесь')
  await shot(page, '21-check-wrong')
  await page.getByRole('button', { name: 'Дальше', exact: true }).click()
  for (let i = 0; i < 5; i++) {
    await right(page)
    await page.waitForTimeout(1250)
  }

  // Одна ошибка прощается: глагол выучен.
  const finish = page.getByTestId('session-finish')
  await expect(finish).toHaveAttribute('data-exam', 'passed')
  await expect(finish).toContainText('Проверка пройдена!')
  await expect(finish).toContainText(`Глагол «${ru(first)}» выучен`)
  expect(state.levels[first]).toBe('learned')
  await shot(page, '22-finish')

  await page.getByRole('button', { name: 'Готово' }).click()
  await expect(page.getByTestId('family-progress')).toHaveText('туда: 1 из 6 · сюда: 1 из 6')
})

test('who has done the prefix lessons gets no intro', async ({ page }) => {
  await setup(page, {
    hints: [...TOUR_SEEN, 'ui:verbs_family_card', 'ui:verb_game_seen_verb_prefix', 'ui:verb_game_seen_verb_prefix_move'],
    levels: { [BASE]: 'learned' }, lessonDone: true
  })
  await page.goto('/?playwright=1&screen=verbs')
  await openLevel2(page)
  await page.getByTestId('family-play').click()

  await expect(page.getByTestId('prefix-scene')).toBeVisible()
  await expect(page.getByTestId('prefix-intro')).toHaveCount(0)
  await shot(page, '23-prefix-form-no-coach')
})

test('without access the family card is an overview and playing leads to the paywall', async ({ page }) => {
  await setup(page, { access: false })
  await page.goto('/?playwright=1&screen=verbs')
  await openLevel2(page)

  const card = page.getByTestId('verbs-family-go')
  await expect(card.locator('[data-testid^="family-pill-"]')).toHaveCount(GO.members.length)
  await expect(card.getByTestId('family-hint')).toHaveCount(0)
  expect(await card.innerText()).not.toMatch(/[ა-ჰ]/)
  await shot(page, '24-section-family-no-access')
  await card.getByTestId('family-pill-in-there').click()
  await expect(page.getByRole('dialog', { name: 'Про-доступ' })).toBeVisible()
})
