import { test, expect, type Page } from '@playwright/test'
import { LESSON_WORDS } from '../src/alphabet/games/data'
import { ALPHABET_LESSONS } from '../src/alphabet/lessons'

// Всё в алфавите помещается в экран телефона: на каждом размере каждая сцена (через стенд ?alphabet-lab=…)
// без горизонтальной и вертикальной прокрутки страницы, а каждая кнопка/плитка — в видимой области и сверху
// (по её центру document.elementFromPoint попадает в неё саму). На 320 px — все слова базового словаря
// в «Новом слове», «Собери слово» и «Превращении». SHOTS_DIR=… — снимки для описания PR.

const SHOTS = process.env.SHOTS_DIR
const VIEWPORTS = [
  { width: 320, height: 568 }, { width: 360, height: 640 }, { width: 375, height: 667 }, { width: 390, height: 844 },
  { width: 412, height: 915 }, { width: 430, height: 932 }, { width: 390, height: 600 }
]
const LONGEST = ['საქართველო', 'ნახვამდის', 'გამარჯობა', 'მეგობარი', 'რამდენი']
const ALL_WORDS = LESSON_WORDS.flat().map(([g]) => g)
const lessonOfWord = (g: string) => ALPHABET_LESSONS.find(l => l.kind === 'words' && l.words.some(w => w.geo === g))!.id

async function stub(page: Page) {
  await page.addInitScript(() => {
    ;(window as any).Telegram = { WebApp: { initData: '', HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {} }, BackButton: { show() {}, hide() {}, onClick() {}, offClick() {} } } }
  })
  await page.route('**/api/miniapp/modules/alphabet-lab-check/lessons/1/questions', r => r.fulfill({ json: [
    { id: 'c1', lemma: 'საქართველო', question: 'Где написано «Грузия»?', options: ['საქართველო', 'ნახვამდის', 'გამარჯობა'], answerIndex: 0, explanation: '' }
  ] }))
  await page.route('**/api/miniapp/vocabulary/alphabet-words', r => r.fulfill({ json: { words: [{ word: 'საქართველო', translation: 'Грузия', added: true }, { word: 'ნახვამდის', translation: 'до свидания', added: true }, { word: 'მეგობარი', translation: 'друг', added: true }, { word: 'ქალაქი', translation: 'город', added: true }], added: 4 } }))
}

/** Страница не прокручивается, все кнопки на экране и не перекрыты. Возвращает список проблем. */
async function problems(page: Page, where: string): Promise<string[]> {
  return page.evaluate((where) => {
    const out: string[] = []
    const W = window.innerWidth, H = window.innerHeight
    const se = document.scrollingElement!
    if (se.scrollWidth > W + 1) out.push(`${where}: horizontal overflow ${se.scrollWidth} > ${W}`)
    if (se.scrollHeight > H + 1) out.push(`${where}: vertical page scroll ${se.scrollHeight} > ${H}`)
    // Открыта панель поверх экрана — проверяем только её.
    const root: ParentNode = document.querySelector('[data-testid="opener-details"]') ?? document
    const els = [...root.querySelectorAll<HTMLElement>('button, [role="button"], [data-testid$="-tile"], [data-testid="assemble-slot"]')]
    for (const el of els) {
      const st = getComputedStyle(el)
      if ((el as HTMLButtonElement).disabled || st.visibility === 'hidden' || st.display === 'none' || st.pointerEvents === 'none' || +st.opacity < 0.05) continue
      if (el.closest('[aria-hidden="true"]')) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      // Текст не обрезан: содержимое кнопки не шире самой кнопки.
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible') out.push(`${where}: text clipped in ${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 16)}`)
      // Текст (не наклонённое украшение вроде карточки-рубашки) не вылезает за кнопку.
      const tilted = (t: HTMLElement) => { for (let n: HTMLElement | null = t; n && n !== el; n = n.parentElement) if (getComputedStyle(n).transform !== 'none') return true; return false }
      for (const t of [...el.querySelectorAll<HTMLElement>('span, div')]) { if (![...t.childNodes].some(c => c.nodeType === 3 && c.textContent!.trim()) || tilted(t)) continue; const tr = t.getBoundingClientRect(); if (tr.width > 0 && (tr.left < r.left - 2 || tr.right > r.right + 2)) { out.push(`${where}: text sticks out of ${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 16)}`); break } }
      const name = `${el.tagName.toLowerCase()}[${el.getAttribute('data-testid') ?? el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 16)}]`
      if (r.left < -1 || r.right > W + 1) out.push(`${where}: ${name} sticks out horizontally (${Math.round(r.left)}..${Math.round(r.right)})`)
      // Не обрезано снизу ни экраном, ни рамкой с overflow:hidden (стол «Собери слово», экран игры).
      let bottom = H
      for (let n = el.parentElement; n; n = n.parentElement) if (getComputedStyle(n).overflow !== 'visible') bottom = Math.min(bottom, n.getBoundingClientRect().bottom)
      if (r.bottom > bottom + 2 && el.getAttribute('data-testid') !== 'catch-bubble') out.push(`${where}: ${name} cut off at the bottom (${Math.round(r.bottom)} > ${Math.round(bottom)})`)
      // Одно грузинское слово не рвётся на две строки.
      for (const t of [...el.querySelectorAll<HTMLElement>('*'), el]) for (const c of t.childNodes) {
        if (c.nodeType !== 3 || !/^[\u10D0-\u10FF]+[?!.]?$/.test(c.textContent!.trim())) continue
        const range = document.createRange(); range.selectNodeContents(c)
        const lines = new Set([...range.getClientRects()].filter(q => q.width > 0).map(q => Math.round(q.top)))
        if (lines.size > 1) out.push(`${where}: word ${c.textContent!.trim()} broken across lines`)
      }
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2
      if (cx < 0 || cx > W || cy < 0 || cy > H) { out.push(`${where}: ${name} centre off screen`); continue }
      // Плавающие пузыри «Поймай букву» могут на миг перекрыть друг друга — для них проверяем только экран.
      if (el.getAttribute('data-testid') === 'catch-bubble') continue
      const hit = document.elementFromPoint(cx, cy)
      if (!hit || !(hit === el || el.contains(hit) || hit.closest('[data-testid="intro-touch"]') && el.closest('[data-testid="intro-stage"]'))) {
        out.push(`${where}: ${name} covered by ${hit?.tagName.toLowerCase()}.${(hit as HTMLElement)?.className?.toString().slice(0, 30)}`)
      }
    }
    // Надписи в зале кафе (вывеска и счётчик) не наезжают друг на друга.
    const sign = document.querySelector('[data-testid="cafe-sign"]')?.getBoundingClientRect()
    const served = document.querySelector('[data-testid="cafe-served"]')?.getBoundingClientRect()
    if (sign && served && sign.right > served.left && sign.left < served.right && sign.bottom > served.top && sign.top < served.bottom) out.push(`${where}: cafe sign overlaps the served counter`)
    return out
  }, where)
}

async function open(page: Page, q: string) {
  await page.goto(`/?playwright=1&alphabet-lab=${q}`)
  await page.waitForSelector('[data-testid], button', { timeout: 10_000 })
  await page.waitForTimeout(800)
}

const SCENES: { name: string; q: string; then?: (p: Page) => Promise<void> }[] = [
  { name: 'opener (letters)', q: 'opener&lesson=6' },
  { name: 'opener (4 words)', q: 'opener&lesson=22' },
  { name: '«подробнее» sheet', q: 'opener&lesson=22', then: p => p.getByTestId('opener-more').click() },
  { name: 'letter intro ბ (ბადრიჯანი)', q: 'intro&lesson=6&letter=ბ' },
  { name: 'letter intro caption ხ (ხაჭაპური)', q: 'intro&lesson=4&letter=ხ', then: async p => { await p.getByTestId('intro-skip').click(); await p.waitForTimeout(700) } },
  { name: 'catch', q: 'catch&lesson=10' },
  { name: 'sound → letter', q: 'sound&lesson=7' },
  { name: 'pairs (letters)', q: 'pairs&lesson=1' },
  { name: 'pairs (words)', q: 'pairs&lesson=22', then: async p => { const c = p.getByTestId('pair-card'); for (let i = 0; i < await c.count(); i++) await c.nth(i).click() ; await p.waitForTimeout(300) } },
  { name: 'dialogue', q: 'dialogue&lesson=22' },
  { name: 'dialogue with the longest options', q: 'dialogue&lesson=22&long=1' },
  { name: 'final check with the longest options', q: 'check' },
  { name: 'cafe', q: 'cafe&lesson=29' },
  // Знакомство с приложением (первая минута нового человека).
  ...['hello', 'letter', 'catch', 'word', 'win'].map(step => ({ name: `welcome ${step}`, q: `welcome&step=${step}` })),
  { name: 'welcome gift (opened)', q: 'welcome&step=gift', then: async (p: Page) => { await p.getByTestId('welcome-gift-card').click(); await p.waitForTimeout(700) } },
  ...[0, 1, 2].map(n => ({ name: `welcome tour card ${n + 1}`, q: 'welcome&step=tour', then: async (p: Page) => { for (let k = 0; k < n; k++) { await p.getByRole('button', { name: 'дальше →' }).click(); await p.waitForTimeout(150) } await p.waitForTimeout(600) } })),
  { name: 'finale (letters)', q: 'finale&lesson=6', then: p => p.waitForTimeout(3500) },
  { name: 'finale (words, dictionary)', q: 'finale&lesson=22', then: p => p.waitForTimeout(5000) },
  ...LONGEST.flatMap(w => [
    { name: `new word ${w}`, q: `words&lesson=${lessonOfWord(w)}&word=${encodeURIComponent(w)}` },
    { name: `new word ${w} (meaning)`, q: `words&lesson=${lessonOfWord(w)}&word=${encodeURIComponent(w)}`, then: async (p: Page) => { await p.getByTestId('word-skip').click(); await p.waitForTimeout(900) } },
    { name: `assemble ${w}`, q: `assemble&lesson=${lessonOfWord(w)}&word=${encodeURIComponent(w)}` },
    { name: `morph ${w}`, q: `morph&lesson=${lessonOfWord(w)}&word=${encodeURIComponent(w)}` }
  ])
]

for (const vp of VIEWPORTS) {
  test(`every alphabet screen fits ${vp.width}×${vp.height}`, async ({ page }) => {
    test.setTimeout(180_000)
    await page.setViewportSize(vp)
    await stub(page)
    const found: string[] = []
    for (const s of SCENES) {
      await open(page, s.q)
      if (s.then) await s.then(page)
      found.push(...await problems(page, s.name))
    }
    expect(found).toEqual([])
  })
}

test('every word of the base vocabulary fits at 320 px in «Новое слово», «Собери слово» and «Превращение»', async ({ page }) => {
  test.setTimeout(300_000)
  await page.setViewportSize({ width: 320, height: 568 })
  await stub(page)
  const found: string[] = []
  for (const w of ALL_WORDS) {
    for (const scene of ['words', 'assemble', 'morph']) {
      await open(page, `${scene}&lesson=${lessonOfWord(w)}&word=${encodeURIComponent(w)}`)
      found.push(...await problems(page, `${scene} ${w}`))
    }
  }
  expect(found).toEqual([])
})

test('the longest word is still tappable letter by letter at 320 px — the lesson can be passed', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await stub(page)
  await open(page, `words&lesson=${lessonOfWord('საქართველო')}&word=${encodeURIComponent('საქართველო')}`)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/40-320-new-word-sakartvelo.png` })
  const tiles = page.getByTestId('word-tile')
  expect(await tiles.count()).toBe(10)
  for (let i = 0; i < 10; i++) await tiles.nth(i).click()
  await expect(page.getByTestId('word-intro')).toHaveAttribute('data-phase', /read|meaning/)
  await open(page, `assemble&lesson=${lessonOfWord('საქართველო')}&word=${encodeURIComponent('საქართველო')}`)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/41-320-assemble-sakartvelo.png` })
  await open(page, 'cafe&lesson=29')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/42-320-cafe.png` })
  await open(page, 'dialogue&lesson=22&long=1')
  await expect(page.getByTestId('dialogue-choices').getByRole('button')).toHaveCount(3)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/43-320-dialogue-long-options.png` })
  await open(page, 'check')
  await expect(page.getByRole('button', { name: 'საქართველო' })).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/44-320-check-long-options.png` })
})
