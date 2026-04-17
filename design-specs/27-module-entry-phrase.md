# Тематическая грузинская фраза при входе в модуль

**Задача:** ROADMAP.md → задача #27
**Статус:** ready

---

## Обучающий элемент

**Паттерн:** тематическая фраза на грузинском появляется при первом входе в модуль за сессию — в момент максимальной мотивации. Пользователь видит незнакомые слова, но связанные с темой, которую сейчас откроет. Спустя уроки он встречает эти слова в контексте — и узнаёт их.

**Вопросы дизайна:**

1. **Что тут можно показать на грузинском?** Короткую (5–10 слов) фразу, напрямую связанную с темой модуля. Фраза содержит хотя бы одно слово, которое студент выучит в этом модуле.
2. **Когда наступит reveal-момент?** В уроке, где встречается слово из фразы: пользователь вспоминает «я это видел при входе» — момент «старого знакомого».
3. **Как это создаёт дофамин?** Тёплый preview («сейчас выучу, что это значит») + последующее узнавание в уроке + эффект форшадоуинга — интрига до начала.

**Reveal-примеры по модулям:**
- В модуле «Алфавит» фраза `ყველაფრის საწყისი` (начало всего) → слово `ყველა` (всё/все) встречается в уроке «Прилагательные» в Фазе 3 → «я видел это слово ещё до алфавита».
- В «Кафе» фраза `ერთი ყავა, გთხოვთ!` → `გთხოვთ` (пожалуйста) учится в первом же уроке модуля → моментальный reveal.
- В «Глаголах движения» фраза `ვიდი, ვდივარ — ვმოძრაობ` → форма `ვდივარ` (я хожу) — ключевой глагол урока 1.

---

## Экраны и состояния

### Экран: ModuleMap — плашка `ModulePhraseBanner`

Плашка вставляется **между блоком overview card и заголовком «уроки»** — она органично часть экрана, а не оверлей. Это намеренно: пользователь видит её на фоне карты уроков — двойной контекст «вот что буду учить + вот фраза из этого».

**Условие отображения:**
```
ModuleMap mounted
  → проверка: sessionStorage.getItem('bombora_phrase_shown_' + moduleId) === null
  → проверка: PHRASE_MAP[moduleId] !== undefined
  → показываем ModulePhraseBanner
  → sessionStorage.setItem('bombora_phrase_shown_' + moduleId, '1')
```

**Layout (375px):**

```
┌────────────────────────────────────────────┐
│ [═══ Kilim overview card ════════════════] │  ← overview card (существующий)
│                                            │
│ ╔══════════════════════════════════════╗   │ ← ModulePhraseBanner (jewel-tile)
│ ║  [Бомбора 48px]                     ║   │   slide-down from top, 320ms
│ ║                                     ║   │
│ ║  ანბანი —                           ║   │   Georgian phrase T3, bold, navy
│ ║  ყველაფრის საწყისი                  ║   │
│ ║                                     ║   │
│ ║  ── тап, чтобы узнать ──            ║   │   T6, jewelInk/50, centered
│ ║                                     ║   │   (исчезает после тапа)
│ ║  [░░░░░░░░░░░░░░░░░░░░░░░]          ║   │   countdown bar 3px, gold → убывает
│ ╚══════════════════════════════════════╝   │
│                                            │
│  ── уроки ──                               │  ← заголовок (существующий)
│  ... карта уроков ...                      │
└────────────────────────────────────────────┘
```

**После тапа — с переводом:**

```
│ ╔══════════════════════════════════════╗   │
│ ║  [Бомбора 48px]                     ║   │
│ ║                                     ║   │
│ ║  ანბანი —                           ║   │   Georgian phrase T3, navy
│ ║  ყველაფრის საწყისი                  ║   │
│ ║                                     ║   │
│ ║  Алфавит — начало всего             ║   │   перевод T5, jewelInk/70, fade-in
│ ║                                     ║   │
│ ║  [░░░░░░░░░░░░░░░░░░░░░░░]          ║   │   countdown bar (продолжает убывать)
│ ╚══════════════════════════════════════╝   │
```

**Детали компонента:**

- Фон карточки: `cream` (#FBF6EC) — `jewel-tile`
- Border: `1.5px solid jewelInk` (через `.jewel-tile`)
- Shadow: `3px 3px 0 #15100A` (через `.jewel-tile`)
- Border radius: `rounded-2xl`
- Padding: `px-4 py-3`
- Margin: `mb-4` (между overview card и секцией уроков)
- Бомбора (Mascot): `size=48`, `mood="guide"`, выровнен влево в строку с текстом
- Грузинская фраза: `font-sans text-[18px] font-extrabold text-navy leading-snug mt-2`
  - (18px = T3 по шкале — крупный заголовочный)
- Хинт «тап, чтобы узнать»: `font-sans text-[11px] text-jewelInk/50 text-center mt-1`
  - Исчезает fade-out (200ms) при тапе
- Перевод: `font-sans text-[14px] text-jewelInk/70 mt-2 leading-snug` — появляется fade-in 250ms
- Countdown bar: тонкая полоска 3px, gold (`#F5B820`), убывает за 3 секунды

**Countdown bar:**
```
╔═══════════════════════════════════════╗
║  [░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] ║  ← 100% → 0% за 3 секунды
╚═══════════════════════════════════════╝
```
- Контейнер: `h-[3px] w-full bg-jewelInk/10 rounded-full overflow-hidden mt-3`
- Заполнение: `h-full bg-gold transition-none` с CSS-анимацией `@keyframes countdown` за 3000ms linear
- При первом тапе (reveal перевода): countdown **продолжает** идти (пользователь видит перевод + секунды уходят)
- При повторном тапе (пока виден перевод) или по окончании countdown: `slideUp` и `sessionStorage`-флаг

**Анимации:**

| Момент | Анимация |
|--------|----------|
| Появление | `translateY(-100%) → translateY(0)`, `opacity: 0→1`, 320ms ease-out |
| Тап → reveal перевода | Хинт fade-out (150ms), перевод fade-in (250ms, задержка 100ms) |
| Исчезновение (авто или тап) | `translateY(0) → translateY(-100%)`, `opacity: 1→0`, 250ms ease-in |
| После исчезновения | `display:none`, место освобождается — карта уроков плавно поднимается (CSS transition gap/margin) |

---

### Состояния компонента

| Состояние | Описание |
|-----------|----------|
| **hidden** | sessionStorage-флаг уже стоит — компонент не рендерится вовсе |
| **visible:phrase** | Плашка видна, показана Georgian фраза + хинт «тап, чтобы узнать» + countdown |
| **visible:translated** | После тапа: показана фраза + перевод, хинт исчез, countdown продолжает |
| **dismissing** | slide-up анимация исчезновения (250ms), триггер: countdown=0 ИЛИ тап по плашке с переводом |
| **dismissed** | `display:none`, компонент вышел из потока, sessionStorage записан |

---

### Компонент: ModulePhraseBanner (новый)

**Имя:** `ModulePhraseBanner`

**Props:**
```typescript
interface ModulePhraseBannerProps {
  moduleId: string
  accent: 'navy' | 'ruby' | 'gold'   // берётся из accentMap в ModuleMap
}
```

**Внутреннее состояние:**
```typescript
const [phase, setPhase] = useState<'phrase' | 'translated' | 'dismissing' | 'dismissed'>('phrase')
const [countdown, setCountdown] = useState(100) // 100→0 за 3000ms
```

**Логика:**
```typescript
// Данные фразы
const entry = PHRASE_MAP[moduleId]
if (!entry) return null

// Проверка sessionStorage
const storageKey = `bombora_phrase_shown_${moduleId}`
if (sessionStorage.getItem(storageKey)) return null

// Записываем сразу при показе
useEffect(() => {
  sessionStorage.setItem(storageKey, '1')
}, [])

// Countdown
useEffect(() => {
  const start = performance.now()
  const DURATION = 3000
  let raf: number
  const tick = (now: number) => {
    const elapsed = now - start
    const pct = Math.max(0, 100 - (elapsed / DURATION) * 100)
    setCountdown(pct)
    if (elapsed >= DURATION) {
      setPhase('dismissing')
    } else {
      raf = requestAnimationFrame(tick)
    }
  }
  raf = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(raf)
}, [])

const handleTap = () => {
  if (phase === 'phrase') {
    setPhase('translated')
  } else if (phase === 'translated') {
    setPhase('dismissing')
  }
}

// dismissing → dismissed (after animation)
useEffect(() => {
  if (phase === 'dismissing') {
    const t = setTimeout(() => setPhase('dismissed'), 280)
    return () => clearTimeout(t)
  }
}, [phase])

if (phase === 'dismissed') return null
```

**Привязка к Minankari-токенам:**
- Фон: cream — стандартный `jewel-tile`
- Грузинская фраза: navy (#1B5FB0) — primary accent
- Countdown bar: gold (#F5B820) — tertiary/highlight
- Перевод: jewelInk/70 (#15100A с 70% opacity)
- Бомбора: `mood="guide"` (существующий вариант)

---

### Конфиг фраз: `PHRASE_MAP`

Статичный объект во фронтенде (в `ModulePhraseBanner.tsx` или отдельный файл `modulePhrases.ts`):

```typescript
interface ModulePhrase {
  georgian: string      // фраза на грузинском
  translation: string   // дословный перевод на русском
}

const PHRASE_MAP: Record<string, ModulePhrase> = {
  // Фаза 1: Алфавит
  'alphabet-progressive': {
    georgian: 'ანბანი — ყველაფრის საწყისი',
    translation: 'Алфавит — начало всего',
  },
  'alphabet': {
    georgian: 'ანბანი — ყველაფრის საწყისი',
    translation: 'Алфавит — начало всего',
  },

  // Фаза 2: Выживание
  'intro': {
    georgian: 'გამარჯობა! მე მქვია...',
    translation: 'Привет! Меня зовут...',
  },
  'emergency': {
    georgian: 'არ მესმის — ეს ნორმალურია!',
    translation: 'Я не понимаю — это нормально!',
  },

  // Фаза 2.5: Числительные
  'numbers': {
    georgian: 'ათი, ოცი, ასი — ვითვლით!',
    translation: 'Десять, двадцать, сто — считаем!',
  },

  // Фаза 3: Грамматика
  'pronouns': {
    georgian: 'მე, შენ, ის — ჩვენ',
    translation: 'Я, ты, он — мы',
  },
  'present-tense': {
    georgian: 'ახლა ვლაპარაკობ ქართულად!',
    translation: 'Сейчас я говорю по-грузински!',
  },
  'cases': {
    georgian: 'ვინ? ვის? ვისთვის? ვისგან?',
    translation: 'Кто? Кому? Для кого? От кого?',
  },
  'postpositions': {
    georgian: 'სად? საით? საიდან?',
    translation: 'Где? Куда? Откуда?',
  },
  'adjectives': {
    georgian: 'ლამაზი, კარგი, ძლიერი',
    translation: 'Красивый, хороший, сильный',
  },

  // Фаза 5: Глаголы
  'verb-classes': {
    georgian: 'ზმნა — ქართული ენის გული',
    translation: 'Глагол — сердце грузинского языка',
  },
  'version-vowels': {
    georgian: 'ვისთვის? ვის? სად?',
    translation: 'Для кого? Кому? Куда?',
  },
  'preverbs': {
    georgian: 'მი-მო-გა-შე-ა — მოძრაობა!',
    translation: 'Ми-мо-га-ше-а — направление движения!',
  },
  'verbs-of-movement': {
    georgian: 'ვიდი, ვდივარ — ვმოძრაობ!',
    translation: 'Я шёл, я хожу — я двигаюсь!',
  },
  'imperfect': {
    georgian: 'ვიყავი, ვწერდი, ვლაპარაკობდი...',
    translation: 'Я был, я писал, я говорил...',
  },
  'aorist': {
    georgian: 'ვთქვი, ვნახე, ვიყიდე',
    translation: 'Я сказал, увидел, купил',
  },
  'pronoun-declension': {
    georgian: 'მე → მე, მე-ს, ჩე-მ-ი',
    translation: 'Я → мне, меня, мой',
  },
  'conditionals': {
    georgian: 'თუ მოხვალ — ვიქნები!',
    translation: 'Если придёшь — я буду здесь!',
  },

  // Фаза 4: Тематическая лексика
  'cafe': {
    georgian: 'ერთი ყავა, გთხოვთ!',
    translation: 'Один кофе, пожалуйста!',
  },
  'taxi': {
    georgian: 'გამიჩერეთ! — остановите!',
    translation: 'Остановите!',
  },
  'doctor': {
    georgian: 'ყველა კარგადაა?',
    translation: 'Все хорошо?',
  },
  'shopping': {
    georgian: 'რამდენი ღირს?',
    translation: 'Сколько стоит?',
  },
}
```

---

## Копирайтинг

| Элемент | Текст |
|---------|-------|
| Хинт под фразой (до тапа) | `тап — узнай перевод` |
| Хинт исчезает | — (fade-out при тапе) |
| Перевод (после тапа) | текст из `PHRASE_MAP[moduleId].translation` |

**Ограничения copy:**
- Хинт — строчными, без лишних слов; не «нажмите сюда» — просто «тап — узнай перевод»
- Фразы — короткие (≤ 8 слов), ритмичные, легко читаемые. Не ставим точку — это не предложение-инструкция, это приглашение
- Переводы — дословные, без пояснений в скобках
- Грузинские фразы — никаких транслитераций в плашке (транслит убирает учебный элемент)

---

## Интеграция в ModuleMap.tsx

Компонент добавляется после блока `{/* Overview card */}` и до `{/* Journey path map */}`:

```tsx
{/* Module entry phrase — shown once per session */}
<ModulePhraseBanner moduleId={moduleId} accent={accent} />

{/* Journey path map */}
<div className="mn-eyebrow mb-3">уроки</div>
...
```

`ModulePhraseBanner` сам управляет своей видимостью (проверяет sessionStorage и рендерит `null` если флаг стоит).

---

## Адаптивность (375px)

- Плашка: полная ширина минус `px-0` (уже в контейнере с `px-5` от ModuleMap) → `w-full`
- Бомбора 48px + грузинская фраза 18px — не конкурируют за место, Бомбора сверху строки
- Фраза длиной до 30 символов — помещается в 2 строки на 375px, хинт — 1 строка ✓
- Перевод до 40 символов — 1–2 строки, никаких overflow ✓
- Tap target: вся плашка `min-h-[88px]`, безопасно ≥ 44px ✓

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру (cream для фона jewel-tile, navy для грузинской фразы, gold для countdown, jewelInk для перевода)
- [x] Типографика: T3 (18px) для Georgian фразы, T5 (14px) для перевода, T6 (11px) для хинта
- [x] Содержит обучающий элемент: фраза с ключевыми словами модуля — пресэкспозиция до урока
- [x] Описан reveal-момент: в конкретных уроках пользователь встречает слова из фразы и узнаёт «старых знакомых»
- [x] Все состояния описаны: hidden / visible:phrase / visible:translated / dismissing / dismissed
- [x] Работает на 375px: плашка полной ширины, tap target ≥ 44px, текст без переполнения
- [x] Не нарушает продуктовую философию: плашка не блокирует уроки, не gate-keeping, авто-исчезает
- [x] Один акцент на элемент: navy для грузинской фразы, gold для countdown bar
- [x] sessionStorage-флаг (не localStorage) — сбрасывается при закрытии вкладки, при повторном открытии приложения фраза появится снова (это хорошо — welcome-back)
- [x] Компонент не рендерится если phraseMap не содержит данного moduleId — безопасный fallback
