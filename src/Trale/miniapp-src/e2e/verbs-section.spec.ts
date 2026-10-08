import { test, expect } from '@playwright/test'
import { FIRST, LADDER, byLemma, catalogVerbs, ladder, lemmaOf, ru, setup, shot } from './verbs-section.setup'

test.use({ viewport: { width: 375, height: 812 } })

const TOUR_SEEN = ['ui:verbs_tour_now', 'ui:verbs_tour_card', 'ui:verbs_tour_level', 'ui:verbs_tour_mine']

test('the dashboard has a «Глаголы» tile for everyone and it opens the section', async ({ page }) => {
  const state = await setup(page)
  await page.goto('/?playwright=1')

  const tile = page.getByTestId('dashboard-verbs-tile')
  await expect(tile).toBeVisible()
  await expect(tile).toContainText('Глаголы')
  await expect(tile).toContainText(`${LADDER.length} глаголов`)
  await expect(page.getByTestId('dashboard-verbs-new')).toBeVisible()
  await tile.scrollIntoViewIfNeeded()
  await shot(page, '01-dashboard-tile')

  await tile.click()
  await expect(page.getByTestId('verbs-section')).toBeVisible()
  await expect.poll(() => state.opened).toEqual(['home'])
})

test('a broadcast link lands on the section: the open is reported first, the gift is said once, the first step is pointed at', async ({ page }) => {
  const state = await setup(page, { access: false, gift: { days: 3, accessUntilUtc: '2026-10-10T12:00:00Z' } })
  await page.goto('/?playwright=1&screen=verbs&c=verbs-2026-10')

  await expect(page.getByTestId('verbs-section')).toHaveAttribute('data-access', 'true')
  expect(state.campaignOpens).toEqual(['verbs-2026-10'])
  await expect.poll(() => state.opened).toEqual(['verbs-2026-10'])
  await expect(page.getByTestId('verbs-gift')).toContainText('Подарок: 3 дня полного доступа — до')
  await expect(page.getByTestId('verbs-learned')).toHaveText(`Выучено 0 из ${LADDER.length}`)
  await expect(page.getByTestId('verbs-now-ru')).toHaveText(ru(FIRST))
  await expect(page.getByTestId('verbs-tour-text')).toHaveText('Начни с этого: 2 минуты — и первый глагол знаком.')
  expect(new URL(page.url()).search).toBe('')
  await shot(page, '02-newcomer-tour-a')

  await page.getByTestId('verbs-tour-action').click()
  await expect(page.getByTestId('verbs-tour-text')).toHaveCount(0)
  await shot(page, '03-newcomer-with-gift')
  await shot(page, '03-newcomer-with-gift-full', true)

  // Второй, обычный заход — с главной; подарок и подсказка больше не показываются.
  await page.goto('/?playwright=1')
  await page.getByTestId('dashboard-verbs-tile').click()
  await expect(page.getByTestId('verbs-section')).toBeVisible()
  await expect(page.getByTestId('verbs-gift')).toHaveCount(0)
  await expect(page.getByTestId('verbs-tour-text')).toHaveCount(0)
  await expect(page.getByTestId('dashboard-verbs-new')).toHaveCount(0)
})

test('«Играть 2 минуты» starts the session at once, and its first task can be read without Georgian letters', async ({ page }) => {
  await setup(page, { hints: [...TOUR_SEEN] })
  await page.goto('/?playwright=1&screen=verbs')

  await page.getByTestId('verbs-now-play').click()

  const session = page.getByTestId('verb-session')
  await expect(session).toBeVisible()
  await shot(page, '10-first-session-start')
  // Правила при первом входе закрываются; дальше — само задание.
  for (let i = 0; i < 4 && await page.getByRole('button', { name: /^(Дальше|Играть)$/ }).count(); i++) {
    await page.getByRole('button', { name: /^(Дальше|Играть)$/ }).first().click()
  }
  await shot(page, '11-first-session-task')
  await expect(session).toContainText(/[а-яё]{3,}/i)
})

test('levels and packs: the current level is open, any pack and verb can be opened, nothing is locked', async ({ page }) => {
  await setup(page, {
    hints: [...TOUR_SEEN],
    levels: { [LADDER[0]]: 'learned', [LADDER[1]]: 'learned', [LADDER[2]]: 'phrases', [LADDER[3]]: 'meeting', [LADDER[21]]: 'recognising' },
    saved: [lemmaOf('петь')]
  })
  await page.goto('/?playwright=1&screen=verbs')

  await expect(page.getByTestId('verbs-learned')).toHaveText(`Выучено 2 из ${LADDER.length}`)
  await expect(page.getByTestId('verbs-now')).toHaveAttribute('data-kind', 'continue')
  await expect(page.getByTestId('verbs-level-1')).toHaveAttribute('data-open', 'true')
  await expect(page.getByTestId('verbs-level-2')).toHaveAttribute('data-open', 'false')
  await shot(page, '04-mid-progress')
  await shot(page, '04-mid-progress-full', true)

  await page.getByTestId('verbs-level-1').scrollIntoViewIfNeeded()
  await shot(page, '05-level-expanded')

  const pack = ladder.levels[0].packs[0]
  await page.getByTestId(`verbs-pack-${pack.id}`).getByRole('button').first().click()
  const rows = page.getByTestId(`verbs-pack-${pack.id}`).getByTestId('verbs-verb-row')
  await expect(rows).toHaveCount(pack.verbs.length)
  await expect(rows.first()).toContainText(ru(pack.verbs[0]))
  await page.getByTestId(`verbs-pack-${pack.id}`).scrollIntoViewIfNeeded()
  await shot(page, '06-pack-open')

  // Дальний уровень открывается так же, как текущий.
  await page.getByTestId('verbs-level-5').getByRole('button').first().click()
  const far = ladder.levels[4].packs[0]
  await page.getByTestId(`verbs-pack-${far.id}`).getByRole('button').first().click()
  await page.getByTestId(`verbs-pack-${far.id}`).getByTestId('verbs-verb-row').first().click()
  await expect(page.getByTestId('verb-sheet')).toBeVisible()
  await expect(page.getByTestId('verb-sheet')).toContainText(ru(far.verbs[0]))
  await shot(page, '06b-verb-card-from-pack')
})

test('«Мои глаголы»: empty with examples, then a tapped example becomes a verb of mine and is celebrated once', async ({ page }) => {
  const cook = lemmaOf('готовить')
  const state = await setup(page, { hints: [...TOUR_SEEN] })
  state.translate = () => {
    state.saved.push(cook)
    const v = byLemma.get(cook)
    return { status: 'success', word: 'готовить', definition: v.tenses.present[2][0], verb: { form: v.tenses.present[2][0], verbId: cook, title: v.title, ru: v.ru, tense: 'present', person: 2 } }
  }
  await page.goto('/?playwright=1&screen=verbs')

  await expect(page.getByTestId('verbs-mine-empty')).toBeVisible()
  await expect(page.getByTestId('verbs-example')).toHaveText(['готовить', 'играть', 'смеяться'])
  await page.getByTestId('verbs-mine').scrollIntoViewIfNeeded()
  await shot(page, '07-mine-empty')

  await page.getByTestId('verbs-example').first().click()
  await expect(page.getByTestId('own-verb-unlocked')).toContainText('Глагол «готовить» открыт!')
  await expect(page.getByTestId('verbs-mine').getByTestId('verbs-verb-row')).toHaveCount(1)
  await page.getByTestId('own-verb-unlocked').scrollIntoViewIfNeeded()
  await shot(page, '09-tour-d-own-verb-unlocked')
  expect(state.hints).toContain('ui:verbs_own_unlocked')
})

test('«Мои глаголы» filled: started, saved and a model-made verb with its quiet mark', async ({ page }) => {
  const sing = byLemma.get(lemmaOf('петь'))
  await setup(page, {
    hints: [...TOUR_SEEN],
    levels: { [LADDER[2]]: 'phrases' },
    saved: [
      { id: sing.lemma, title: sing.title, ru: 'напевать', level: 'new', due: 0, generated: true, levelId: null, packId: null },
      lemmaOf('готовить'), lemmaOf('играть'), lemmaOf('смеяться')
    ]
  })
  await page.goto('/?playwright=1&screen=verbs')

  const mine = page.getByTestId('verbs-mine')
  await expect(mine.getByTestId('verbs-verb-row')).toHaveCount(3)
  await expect(mine.getByTestId('verbs-mine-generated')).toHaveText('составлено нейросетью')
  await mine.scrollIntoViewIfNeeded()
  await shot(page, '08-mine-filled')
  await mine.getByTestId('verbs-mine-all').click()
  await expect(mine.getByTestId('verbs-verb-row')).toHaveCount(5)
})

test('after the first game the section leads through the level, the card and «Мои глаголы» — once', async ({ page }) => {
  const state = await setup(page, { hints: ['ui:verbs_tour_now'], levels: { [FIRST]: 'meeting' } })
  await page.goto('/?playwright=1&screen=verbs')

  const text = page.getByTestId('verbs-tour-text')
  await expect(text).toHaveText('Это твой путь по уровню. Ничего не заперто: открывай любой набор.')
  await shot(page, '09-tour-b1-level')
  await page.getByTestId('verbs-tour-action').click()
  await expect(text).toHaveText('А здесь все формы этого глагола. Нажми — откроется его карточка.')
  await shot(page, '09-tour-b2-verb-card')
  await page.getByTestId('verbs-tour-action').click()
  await expect(text).toHaveText('Любой глагол, который ты переведёшь в боте или в словаре, появится здесь. Попробуй — нажми на пример.')
  await expect(page.getByTestId('verbs-example')).toHaveCount(3)
  // «Мои глаголы» внизу экрана: фонарик докручивает до поля с примерами.
  await expect(page.getByTestId('verbs-mine-add')).toBeInViewport()
  await shot(page, '09-tour-c-my-verbs')
  await page.getByTestId('verbs-tour-action').click()
  await expect(text).toHaveCount(0)
  expect(state.hints).toEqual(expect.arrayContaining(TOUR_SEEN))

  await page.goto('/?playwright=1&screen=verbs')
  await expect(page.getByTestId('verbs-section')).toBeVisible()
  await expect(page.getByTestId('verbs-now')).toBeVisible()
  await expect(text).toHaveCount(0)
})

test('without access the section is an overview, and playing leads to the usual paywall', async ({ page }) => {
  await setup(page, { access: false, levels: { [FIRST]: 'recognising' } })
  await page.goto('/?playwright=1&screen=verbs&src=verbs_oct')

  await expect(page.getByTestId('verbs-section')).toHaveAttribute('data-access', 'false')
  await expect(page.getByTestId('verbs-tour-text')).toHaveCount(0)
  await expect(page.getByTestId('verbs-levels')).not.toContainText(/[ა-ჰ]/)
  await shot(page, '12-no-access')
  await shot(page, '12-no-access-full', true)

  await page.getByTestId('verbs-now-play').click()
  await expect(page.getByRole('dialog', { name: 'Про-доступ' })).toBeVisible()
  await shot(page, '13-no-access-paywall')
})

test('who has not finished the alphabet sees one quiet line', async ({ page }) => {
  await setup(page, { hints: [...TOUR_SEEN], alphabetHint: true })
  await page.goto('/?playwright=1&screen=verbs')

  await expect(page.getByTestId('verbs-alphabet-line')).toContainText('Ещё не знаешь буквы? Начни с алфавита — так будет легче.')
  await shot(page, '14-alphabet-line')
})

// Кто ещё не читает буквы, должен суметь сыграть: под каждым грузинским вариантом ответа — кириллица.
// Берём глагол каталога с самыми длинными формами: варианты не должны обрезаться на 375 px.
const full = (v: any) => ['present', 'aorist', 'future'].every(t => v.tenses[t]?.length === 6 && v.tenses[t].every((c: string[]) => c.length > 0))
const longest = (v: any) => Math.max(...['present', 'aorist', 'future'].flatMap(t => v.tenses[t].map((c: string[]) => c[0].length)))
const LONG = catalogVerbs.filter(full).sort((a, b) => longest(b) - longest(a))[0]

async function openScene(page: any, scene: object) {
  const game = ['verb_time', 'verb_bones'].flatMap(id => [`ui:verb_game_seen_${id}`, `ui:verb_game_seen_${id}_move`])
  await setup(page, {
    hints: [...TOUR_SEEN, ...game], levels: { [LONG.lemma]: 'recognising' },
    session: { id: '11111111-1111-4111-8111-111111111111', plan: { v: 1, scenes: [scene] }, scene: 0, done: 0 }
  })
  await page.goto('/?playwright=1&screen=verbs')
  await page.getByTestId('verbs-now-play').click()
  await expect(page.getByTestId('verb-session')).toBeVisible()
}

async function expectOptionsReadable(page: any, buttons: any) {
  await expect(buttons).toHaveCount(4)
  for (const button of await buttons.all()) {
    const word = (await button.getAttribute('aria-label'))!
    await expect(button.getByTestId('option-cyr')).toHaveText(/^[а-яё’' ]+$/i)
    const box = (await button.boundingBox())!
    expect(box.height, `«${word}» is comfortable to tap`).toBeGreaterThanOrEqual(44)
    expect(box.x + box.width, `«${word}» fits the screen`).toBeLessThanOrEqual(375)
    // Ничего не обрезано: содержимое не шире кнопки.
    expect(await button.evaluate((el: HTMLElement) => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  }
}

test('«Машина времени»: every answer option has its Cyrillic transcription and fits at 375 px', async ({ page }) => {
  await openScene(page, { type: 'time', units: 3, seconds: 30, targets: ['present:3', 'aorist:4', 'future:5'], typing: false, reason: 'shot' })

  await expect(page.getByTestId('time-ask')).toBeVisible()
  await expectOptionsReadable(page, page.locator('.grid.grid-cols-2 > button'))
  await shot(page, '30-time-machine-options')
})

test('«Косточки»: every answer option has its Cyrillic transcription and fits at 375 px', async ({ page }) => {
  await openScene(page, { type: 'bones', units: 2, seconds: 40, tenses: ['present', 'aorist', 'future'], persons: [3, 4, 5], typing: false, reason: 'shot' })

  await page.getByTestId('bones-cell-4').click()
  await expect(page.getByTestId('bones-ask')).toBeVisible()
  await expectOptionsReadable(page, page.getByTestId('bones-dig').locator('.grid > button'))
  await shot(page, '30-bones-options')
})

test('«Новое слово»: the example sentence comes with its transcription', async ({ page }) => {
  await setup(page, { hints: [...TOUR_SEEN] })
  await page.goto('/?playwright=1&screen=verbs')
  await page.getByTestId('verbs-now-play').click()
  for (let i = 0; i < 4 && await page.getByRole('button', { name: /^(Дальше|Играть)$/ }).count(); i++) {
    await page.getByRole('button', { name: /^(Дальше|Играть)$/ }).first().click()
  }

  await expect(page.getByTestId('sentence-cyr')).toHaveText(/[а-яё]{2,}/i)
  await shot(page, '30-new-word-example')
})
