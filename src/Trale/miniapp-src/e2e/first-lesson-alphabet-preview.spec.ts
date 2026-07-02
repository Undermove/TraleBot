import { test, expect } from '@playwright/test'

// Verifies the alphabet-progressive L1 "preview split" theory layout:
// a first-visit user sees only 3 letter cards up front, the rest hidden
// behind an «📖 Остальные буквы» accordion. Reveals full content on tap.

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
    // Kill the one-time "reveal kani" overlay — irrelevant here.
    try { localStorage.setItem('bombora_kani_reveal_shown', '1') } catch {}
  })
})

const letters = [
  { letter: 'ა', name: 'ани', translit: 'a', exampleGe: 'აი', exampleRu: 'вот' },
  { letter: 'ბ', name: 'бани', translit: 'b', exampleGe: 'ბაბუა', exampleRu: 'дедушка' },
  { letter: 'გ', name: 'гани', translit: 'g', exampleGe: 'გამარჯობა', exampleRu: 'здравствуй' },
  { letter: 'დ', name: 'дони', translit: 'd', exampleGe: 'დედა', exampleRu: 'мама' },
  { letter: 'ე', name: 'ени', translit: 'e', exampleGe: 'ერთი', exampleRu: 'один' },
]

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
          theory: {
            title: 'Первые буквы',
            goal: 'Запомнить первые буквы алфавита',
            blocks: [
              { type: 'letters', letters },
              { type: 'paragraph', text: 'Грузинский алфавит красив и логичен.' },
            ],
          },
        },
        {
          id: 2,
          title: 'Ещё буквы',
          short: 'L2',
          theory: { title: 'Ещё буквы', goal: 'g', blocks: [] },
        },
      ],
    },
  ],
}

// Post-welcome user: level chosen, welcome completed (some XP), no alphabet progress yet.
// This is exactly the state where the alphabet-L1 preview should fire on first visit.
const postWelcomeMe = {
  authenticated: true,
  level: 'beginner',
  isPro: false,
  isTrialActive: false,
  trialDaysLeft: 0,
  vocabularyCount: 0,
  onboardingHint: null,
  progress: {
    xp: 20,
    streak: 0,
    lastPlayedAtUtc: null,
    completedLessons: { welcome: [1] },
    xpSpent: 0,
    totalTreatsGiven: 0,
    lastFedAtUtc: null,
    lastTreatIndex: null,
  },
}

async function setupApi(page: any) {
  await page.route('**/api/miniapp/content', (route: any) => route.fulfill({ json: catalog }))
  await page.route('**/api/miniapp/me', (route: any) => route.fulfill({ json: postWelcomeMe }))
  await page.route('**/api/miniapp/activity-days*', (route: any) =>
    route.fulfill({ json: { dates: [] } })
  )
}

test('first-visit alphabet L1 shows 3 preview letters + accordion; tapping accordion reveals the rest', async ({ page }) => {
  await setupApi(page)
  await page.goto('/?playwright=1')

  // Dashboard first — click the suggestion (next lesson = alphabet L1).
  await page.getByTestId('dashboard-suggestion').click()

  // LessonTheory rendered. Three letter cards up front...
  await expect(page.getByText('ა', { exact: true })).toBeVisible()
  await expect(page.getByText('ბ', { exact: true })).toBeVisible()
  await expect(page.getByText('გ', { exact: true })).toBeVisible()

  // ...but not the rest, nor the paragraph — those live inside the closed accordion.
  await expect(page.getByText('დ', { exact: true })).toHaveCount(0)
  await expect(page.getByText('ე', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/Грузинский алфавит красив/)).toHaveCount(0)

  // Accordion trigger is present and closed.
  const trigger = page.getByRole('button', { name: /Остальные буквы/ })
  await expect(trigger).toBeVisible()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')

  // CTA is «Поехали →», not «к практике →».
  await expect(page.getByRole('button', { name: /Поехали/ })).toBeVisible()

  // Open the accordion → the rest of the letters and the paragraph appear.
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('დ', { exact: true })).toBeVisible()
  await expect(page.getByText('ე', { exact: true })).toBeVisible()
  await expect(page.getByText(/Грузинский алфавит красив/)).toBeVisible()
})
