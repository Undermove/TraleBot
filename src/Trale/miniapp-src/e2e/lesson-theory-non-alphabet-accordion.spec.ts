import { test, expect } from '@playwright/test'

// #1004: on the first visit to any non-(alphabet L1) lesson, LessonTheory
// hides theory blocks behind a «📖 Объяснение» accordion and the CTA
// reads «Поехали →». Verifies the alphabet L2 flow named in the AC —
// user has already completed L1, taps the dashboard suggestion (L2),
// sees the collapsed accordion, opens it, and hits «Поехали →» to land
// in the Practice screen.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as any).Telegram = {
      WebApp: {
        initData: 'user=%7B%22id%22%3A123456%7D',
        BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
        MainButton: { show: () => {}, hide: () => {} },
        HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} },
        openTelegramLink: () => {},
      },
    }
    // Suppress the one-time reveal overlay so it can't cover the action bar.
    try { localStorage.setItem('bombora_kani_reveal_shown', '1') } catch {}
  })
})

const catalog = {
  botUsername: 'TraleBot',
  miniAppEnabled: true,
  modules: [
    {
      id: 'alphabet-progressive',
      title: 'Алфавит',
      emoji: '🔤',
      description: 'Грузинский алфавит',
      lessons: [
        {
          id: 1,
          title: 'Первые буквы',
          short: 'L1',
          theory: { title: 'Первые буквы', goal: 'g', blocks: [] },
        },
        {
          id: 2,
          title: 'Ещё буквы',
          short: 'L2',
          theory: {
            title: 'Ещё буквы',
            goal: 'Запомнить следующие буквы алфавита',
            blocks: [
              { type: 'paragraph', text: 'Второй набор букв — вот что нас ждёт.' },
              { type: 'example', ge: 'დედა', ru: 'мама' },
            ],
          },
        },
      ],
    },
  ],
}

const l1DoneMe = {
  authenticated: true,
  level: 'beginner',
  isPro: false,
  isTrialActive: false,
  trialDaysLeft: 0,
  vocabularyCount: 0,
  onboardingHint: null,
  progress: {
    xp: 60,
    streak: 1,
    lastPlayedAtUtc: null,
    completedLessons: { 'alphabet-progressive': [1] },
    xpSpent: 0,
    totalTreatsGiven: 0,
    lastFedAtUtc: null,
    lastTreatIndex: null,
  },
}

async function setupApi(page: any) {
  await page.route('**/api/miniapp/content', (route: any) => route.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/me', (route: any) => route.fulfill({ json: l1DoneMe }))
  await page.route('**/api/miniapp/activity-days*', (route: any) =>
    route.fulfill({ json: { dates: [] } })
  )
  // Practice screen loads questions — stub with a single item so the screen renders.
  await page.route('**/api/miniapp/modules/alphabet-progressive/lessons/2/questions', (route: any) =>
    route.fulfill({
      json: [
        {
          id: 'q1',
          lemma: 'დედა',
          question: 'Что означает «დედა»?',
          options: ['мама', 'папа', 'сестра', 'брат'],
          answerIndex: 0,
          explanation: '',
          questionType: 'multiple-choice',
        },
      ],
    })
  )
}

test('first-visit alphabet L2 hides theory behind «📖 Объяснение»; tapping «Поехали →» opens Practice', async ({ page }) => {
  await setupApi(page)
  await page.goto('/?playwright=1')

  // Dashboard suggests the next lesson (L2) since L1 is already done.
  await page.getByTestId('dashboard-suggestion').click()

  // LessonTheory rendered. Title card shows the lesson goal.
  await expect(page.getByText(/Запомнить следующие буквы алфавита/)).toBeVisible()

  // Theory content is hidden inside the closed accordion.
  await expect(page.getByText(/Второй набор букв — вот что нас ждёт\./)).toHaveCount(0)
  await expect(page.getByText('დედა', { exact: true })).toHaveCount(0)

  // Accordion trigger is «📖 Объяснение» and closed.
  const trigger = page.getByRole('button', { name: /Объяснение/ })
  await expect(trigger).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  // CTA is «Поехали →», not «к практике →».
  const cta = page.getByRole('button', { name: /Поехали/ })
  await expect(cta).toBeVisible()
  await expect(page.getByRole('button', { name: /к практике/ })).toHaveCount(0)

  // Open the accordion → theory blocks appear.
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText(/Второй набор букв — вот что нас ждёт\./)).toBeVisible()
  await expect(page.getByText('დედა', { exact: true })).toBeVisible()

  // Tapping «Поехали →» takes the user to Practice — the mocked question renders.
  await cta.click()
  await expect(page.getByText(/Что означает «დედა»\?/)).toBeVisible()
})
