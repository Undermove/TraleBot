# Монетизация через Telegram Stars — MVP

**Задача:** ROADMAP.md → задача #22
**Статус:** ready

---

## Обучающий элемент

**Грузинское слово:** `ვარსკვლავი` (varskvlavi) — звезда.

Telegram Stars — звёзды. Это не случайное совпадение, а обучающий якорь.

На экране Paywall цена отображается как `150 ⭐ ვარსკვლავი`. Под ценой — маленькая пояснительная строка «ვარსკვლავი = звезда».

**Reveal-момент:** в модуле «Лексика» или «Мой словарь» пользователь встречает слово `ვარსკვლავი` — и узнаёт: «я это видел, это же «звезда», как в Telegram Stars». Двойной дофамин: полезная покупка + живой Georgian word в памяти.

**Паттерн:** привычный элемент (цена покупки) → грузинский контекст (`ვარსკვლავი`) → reveal в учебном контексте.

---

## Модель доступа

| Уровень | Содержимое |
|---------|------------|
| **Free** | Алфавит, Глаголы движения, Мой словарь (до 50 слов через бот) |
| **Pro** | Все модули + Мой словарь без лимита |

Pro-статус (`isPro`) возвращается в ответе `/api/miniapp/me`. Фронтенд полностью ориентируется на этот флаг.

---

## Экраны и состояния

### Экран: Dashboard — Pro-заблокированные модули (free user)

**Layout:**

Модули dashboard отображаются как обычно через `jewel-tile`. Pro-модули дополнены правым бейджем `★ Про`:

```
[ килим-полоса ]
[ стат-бар XP/стрик ]

[ ── основы  საფუძვლები ── ˅ ]
  [ jewel-tile: Алфавит  12/12  ✓    ]   ← free, пройден
  [ jewel-tile: Числительные  0/4    ]   ← free, доступен

[ ── грамматика  გრამატიკა ── ˅ ]
  [ jewel-tile: Местоимения ★ Про    ]   ← Pro-locked
  [ jewel-tile: Падежи ★ Про         ]   ← Pro-locked

[ ── продвинутое  გაღრმავება ── ˅ ]
  [ jewel-tile: Классы глаголов ★ Про ]  ← Pro-locked

[ ── мой словарь  ლექსიკონი ── ˅ ]
  [ jewel-tile: Мой словарь (50/50)  ]   ← free, лимит достигнут → Pro
```

**Бейдж `★ Про`:**
- Маленький pill в правом верхнем углу плитки: `[★ Про]`
- Цвет: `gold` (#F5B820) фон, `jewelInk` (#15100A) текст
- Размер: `text-[10px] font-bold px-1.5 py-0.5 rounded-sm`
- Border: `border border-jewelInk/30`
- Иконка ★ — 8px, inline перед текстом
- НЕ перекрывает Georgian-лейбл модуля

**Интерактивность:**
- Тап на Pro-locked плитку → открывает Paywall-шторку (снизу)
- Плитка остаётся кликабельной (не `pointer-events: none`) — пользователь должен знать, что получит за Pro
- Hover/tap-эффект: стандартный jewel-btn press (притапливание 3px)

**Состояние «словарь достиг лимита»:**
- Плитка Мой словарь (50/50) показывает бейдж `★ Про` справа
- Sub-текст под прогрессом: `50 слов — лимит Free`
- Тап → Paywall-шторка с акцентом на «словарь без лимита»

---

### Компонент: ProBadge (inline)

**Назначение:** маленький gold pill «★ Про» на jewel-tile.

**Props (концептуально):**
```typescript
// Всегда показывается рядом с названием модуля в правом верхнем углу
// Нет собственных пропов — всегда одинаковый
```

**Внешний вид:**
```
╔═══════════════════╗
║ ★ Про             ║  ← gold bg, jewelInk text, ink border
╚═══════════════════╝
```
- `bg-gold text-jewelInk border border-jewelInk/40`
- `text-[10px] font-extrabold px-1.5 py-[2px] rounded`
- `box-shadow: 1px 1px 0 rgba(21,16,10,0.25)`

---

### Экран: Paywall — Bottom Sheet (основной)

Появляется при тапе на Pro-locked модуль или при достижении лимита словаря.

**Layout:**
```
┌──────────────────────────────────────────┐ ← полупрозрачный backdrop
│             cream #FBF6EC                │
│      (затемнение backdrop 40%)           │
│                                          │
│  ╔════════════════════════════════════╗  │ ← bottom sheet, max-height 85dvh
│  ║   ── drag-handle (32×4px) ──      ║  │   кремовый bg, верхние rounded-2xl
│  ║                                   ║  │
│  ║  [ Бомбора guide 100px ]          ║  │   Бомбора в mood="guide"
│  ║        ★ (gold star 24px)         ║  │   + плавающая золотая звезда
│  ║                                   ║  │
│  ║  Открыть все модули               ║  │   T2, font-extrabold
│  ║  სრული წვდომა                     ║  │   12px, gold, Georgian
│  ║                                   ║  │
│  ║  ✓ Вся грамматика (A1–A2)         ║  │
│  ║  ✓ Вся лексика по темам           ║  │   T5, 14px, icon: ✓ navy
│  ║  ✓ Продвинутые уроки (A2–B2)      ║  │
│  ║  ✓ Мой словарь без ограничений    ║  │
│  ║                                   ║  │
│  ║  ┌──────────────────────────────┐ ║  │
│  ║  │  150  ⭐                     │ ║  │   jewel-tile, cream bg
│  ║  │  ვარსკვლავი = звезда         │ ║  │   ← обучающий элемент
│  ║  └──────────────────────────────┘ ║  │
│  ║                                   ║  │
│  ║  [ Купить за 150 ⭐ ]            ║  │   gold jewel-btn (variant="blue")
│  ║  [ Нет, пока нет ]              ║  │   ghost jewel-btn
│  ╚════════════════════════════════════╝  │
└──────────────────────────────────────────┘
```

**Детали компоновки:**
- Bottom sheet: `bg-cream rounded-t-2xl border-t-2 border-x-2 border-jewelInk`
- `box-shadow: 0 -4px 0 #15100A` (верхний offset shadow — характерный для Minankari)
- Slide-up анимация: `translateY(100%) → translateY(0)`, 280ms ease-out
- Backdrop: `rgba(21,16,10,0.4)` fade-in 200ms
- Тап на backdrop → закрывает (без покупки)
- Drag-handle: `w-8 h-1 bg-jewelInk/20 rounded-full mx-auto mt-3 mb-4`

**Цена-блок (`jewel-tile`):**
```
[ 150   ⭐                      ]
[ ვარსკვლავი = звезда            ]
```
- Число `150`: `T1` размер, `font-extrabold`, `text-jewelInk`
- Звезда: emoji ⭐ рядом с числом, `text-[28px]`
- Georgian строка: `font-geo text-[12px] text-gold font-bold`
- Перевод `= звезда`: `text-[11px] text-jewelInk/60 font-sans`
- Блок: `jewel-tile py-3 px-4 text-center`

**CTA «Купить за 150 ⭐»:**
- `variant="blue"` (gold fill, jewelInk text) — единственный золотой CTA в приложении, подчёркивает ценность момента
- Текст: `Купить за 150 ⭐` — 150 и звезда inline
- Полная ширина (`w-full`)

**Состояния Paywall:**

| Состояние | Описание |
|-----------|----------|
| Default | Описано выше |
| Loading | CTA заменяется на `LoaderLetter` (буква ქ) + текст «Открываем платёж…», кнопка `disabled` |
| Error | Бомбора mood="think", текст «Что-то пошло не так. Попробуй ещё раз», CTA снова активна |
| Cooldown | После успешного `sendInvoice` — Telegram нативно показывает invoice, наша шторка закрывается |

**Paywall — вариант для словаря (`trigger=vocabulary_limit`):**

Если открывается из словаря при достижении 50 слов — headline меняется:
- Headline: `Словарь заполнен`
- Sub-label: `ლექსიკონი · 50/50`
- Bullets: первая строка → `✓ Словарь без ограничений — добавляй сколько угодно`

---

### Экран: Paywall — состояние «покупка завершена»

После успешного `successful_payment` (Telegram закрыл нативный invoice, бэкенд поставил `isPro=true`) — пользователь возвращается в мини-апп.

Мини-апп перезапрашивает `/api/miniapp/me`, получает `isPro: true` → показывает Success-тост:

**Success тост:**
```
╔═══════════════════════════════╗
║  ★  Добро пожаловать в Pro!  ║   ← gold bg, jewelInk text, ink border
║     ყველა მოდული ღიაა         ║   ← «все модули открыты» по-грузински
╚═══════════════════════════════╝
```
- Slide-down из верхнего края экрана, высота ~52px
- `bg-gold border-b-2 border-jewelInk text-jewelInk`
- Georgian строка: `font-geo text-[11px] font-bold`
- Автоскрытие через 3.5 секунды (slide-up + fade-out)
- Бомбора меняет mood на `cheer` на 3 секунды

---

### Экран: Profile — Pro статус

**Free user — Upgrade CTA:**

В Passport card (jewel-tile) добавляется секция под статистикой:

```
[ ══ разделитель ══════════════════════════ ]
[ ★ Про-доступ                             ]   ← 13px, gold star + текст
[ Открыть все модули                        ]   ← 11px, hint-цвет
[ [ Купить за 150 ⭐ ]                     ]   ← gold jewel-btn, compact
```

- Блок размещается под `grid grid-cols-3` со статистикой
- `pt-4 border-t border-jewelInk/15`
- CTA: compact версия `jewel-btn`, высота 40px (вместо стандартной 52px)

**Pro user — Pro badge:**

Passport card получает угловой баннер:
```
╔═══════════════════════════════════════════╗
║  [ Бомбора ]  ученик           ┌──────┐  ║
║               ქართული         │★ PRO │  ║   ← gold fill, top-right
║                                └──────┘  ║
╚═══════════════════════════════════════════╝
```
- `position: absolute top-0 right-0`
- `bg-gold text-jewelInk text-[11px] font-extrabold px-2 py-1`
- `border-l-[1.5px] border-b-[1.5px] border-jewelInk`
- `rounded-bl-md rounded-tr-[14px]` (скруглён по карточке)
- Georgian под бейджем в passport section: `სრული` (полный) — 10px, gold

---

### Компонент: ProPaywall (bottom sheet)

**Назначение:** шторка покупки Pro, вызывается из любого места приложения.

**Props (концептуально):**
```typescript
trigger: 'module' | 'vocabulary_limit'
lockedModuleName?: string   // название модуля, из которого открыли
onClose: () => void
onPurchaseStart: () => void  // вызывает /api/miniapp/purchase → sendInvoice
```

**Variants:**
- `trigger="module"` → стандартный paywall (описан выше)
- `trigger="vocabulary_limit"` → headline «Словарь заполнен», первый bullet про лимит

**Привязка к Minankari-токенам:**
- Backdrop: `rgba(21,16,10,0.4)` — `jewelInk` с 40% opacity
- Sheet background: `cream` (#FBF6EC)
- Sheet border: `jewelInk` 2px top + sides
- Sheet shadow: `0 -4px 0 #15100A` (offset shadow вверх)
- CTA fill: `gold` (#F5B820) — единственный golde-CTA в приложении
- Check icons: `navy` (#1B5FB0) — смысл «подтверждение/акцент»

---

## Копирайтинг

| Элемент | Текст |
|---------|-------|
| Paywall headline | `Открыть все модули` |
| Paywall sub-label (Georgian) | `სრული წვდომა` |
| Paywall bullet 1 | `Вся грамматика — местоимения, падежи, глаголы` |
| Paywall bullet 2 | `Лексика по темам — кафе, такси, врач и ещё` |
| Paywall bullet 3 | `Продвинутые уроки A2–B2` |
| Paywall bullet 4 | `Мой словарь без ограничений` |
| Price label | `150 ⭐` |
| Georgian teaching element | `ვარსკვლავი = звезда` |
| CTA | `Купить за 150 ⭐` |
| Cancel | `Нет, пока нет` |
| Vocabulary limit headline | `Словарь заполнен` |
| Success toast | `★ Добро пожаловать в Pro!` |
| Success toast (Georgian) | `ყველა მოდული ღიაა` |
| Pro badge | `★ Pro` |
| Pro badge (Georgian) | `სრული` |
| Profile upgrade CTA headline | `★ Про-доступ` |
| Profile upgrade CTA sub | `Открыть все модули` |
| Profile upgrade button | `Купить за 150 ⭐` |
| Module badge | `★ Про` |

**Ограничения copy:**
- Не использовать «премиум», «подписка», «апгрейд» — только «Про» и «открыть»
- Не писать «заблокировано» — только показывать бейдж, модуль виден и красив
- Stars — через emoji ⭐, не через слово «звёзды» (кроме обучающей строки)
- Русский как основной; Georgian — только как обучающие вкрапления

---

## Анимации

| Элемент | Анимация |
|---------|----------|
| Bottom sheet появление | `translateY(100%) → translateY(0)`, 280ms ease-out |
| Backdrop появление | `opacity: 0 → 0.4`, 200ms ease |
| Bottom sheet закрытие | `translateY(0) → translateY(100%)`, 220ms ease-in, затем `onClose()` |
| Success тост появление | `translateY(-100%) → translateY(0)`, 250ms ease-out |
| Success тост исчезновение | 3.5s задержка → `translateY(-100%) opacity(0)`, 300ms ease-in |
| Gold star над Бомборой | `scale(0.6) opacity(0) → scale(1) opacity(1)`, 350ms ease-out, задержка 100ms |
| Pro badge на Profile (первое появление) | `scale(0.5) → scale(1)`, 350ms spring-bounce |

---

## Адаптивность (375px)

- Bottom sheet: `max-h-[85dvh] overflow-y-auto` — на очень маленьких экранах скроллится внутри
- Paywall bullets: `text-[14px]` — 4 строки × ~60px = ~240px, помещается
- Цена-блок: числа `150 ⭐` на одной строке без переноса
- Pro badge на плитке: 10px текст, не влияет на layout плитки
- Все tap targets ≥ 44px (кнопки в шторке — полная ширина, высота 52px)

---

## Технические заметки для Developer

**API:**
- `GET /api/miniapp/me` → добавить поле `isPro: boolean` в ответ
- `POST /api/miniapp/purchase` → запускает `sendInvoice` через Telegram Bot API (возвращает `ok: true`)

**Frontend логика:**
- `isPro` читается из `/api/miniapp/me` при инициализации, кешируется в state
- Pro-locked тайлы: `isLocked = !isPro && PRO_MODULE_IDS.includes(module.id)`
- `PRO_MODULE_IDS` — константа в `types.ts` (список id платных модулей)
- Paywall открывается через context/callback, не через навигацию (шторка поверх текущего экрана)

**Интеграция с Telegram:**
- После `POST /api/miniapp/purchase` Telegram нативно показывает Stars invoice
- После оплаты → `window.Telegram.WebApp.onEvent('invoice_closed', handler)` → перезапросить `/api/miniapp/me`

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру (cream, jewelInk, navy для чеков, gold для Pro/CTA)
- [x] Типографика: T1 для цены, T2 для headline, T5 для bullets, T6 для Georgian лейблов
- [x] Содержит обучающий элемент: `ვარსკვლავი = звезда` в price-блоке
- [x] Описан reveal-момент: слово ვარსკვლავი встретится в уроках лексики
- [x] Все состояния описаны: default / loading / error / success / pro-user
- [x] Работает на 375px (bottom sheet скроллится, tap targets ≥ 44px)
- [x] Не нарушает продуктовую философию (pay-once, не подписка; модули видны, не скрыты)
- [x] Один акцентный цвет на элемент: gold для Pro/CTA, navy для checkmarks
- [x] Georgian-строка сопровождает каждый ключевой Pro-момент (badge, paywall, success toast)
