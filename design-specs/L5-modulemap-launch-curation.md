# L5 — Курировать ModuleMap: launch-набор + Coming Soon

**Задача:** ROADMAP.md → L5, GitHub issue #235  
**Статус:** ready

---

## Обучающий элемент

**Что учит грузинскому:** модули «Coming Soon» показывают заголовок **только по-грузински** (კაფე, ტაქსი, ეკიმი, ...) — без русского перевода. Пользователь видит грузинские слова десятки раз при каждом открытии дашборда, не понимая их значения.

**Reveal-момент:** когда пользователь наконец открывает модуль «Кафе» после запуска, он видит слово «კაფე» снова — и узнаёт: «Это то самое слово, которое я видел в серой плитке всё это время!» Пассивное накопление переходит в активное узнавание.

**Дополнительный момент:** числительные-буквы ა→ბ→გ→დ→ე→ვ как путь запуска — reveal в модуле «Числа», когда пользователь понимает, что числа — это буквы, которыми он пронумерованы его уроки.

---

## Экраны и состояния

### Экран: Dashboard (изменения)

Текущий Dashboard имеет 5 разделов (основы, грамматика, лексика, продвинутое, мой словарь) с 22 модулями. После изменения:

**Структура страницы:**

```
┌─────────────────────────────┐
│  mn-kilim strip (top)       │
│  DashboardTopBar (XP, ...)  │
├─────────────────────────────┤
│  Hero: Бомбора + приветствие│
│  DayOfWeekChip              │
│  [Suggestion tile, если есть]│
├─────────────────────────────┤
│  ─── SECTION: "старт" ───   │  ← 6 launch-модулей (активные)
│  [ा] Алфавит         ┄┄┄   │
│  [ბ] Числа           ┄┄┄   │
│  [გ] Знакомство      ┄┄┄   │
│  [დ] Местоимения     ┄┄┄   │
│  [ე] Настоящее время ┄┄┄   │
│  LaunchPathBar              │  ← новый компонент
├─────────────────────────────┤
│  [ვ] Мой словарь            │  ← всегда отдельно, внизу
├─────────────────────────────┤
│  ─── SECTION: "скоро ↓" ── │  ← 16 модулей, свёрнутые, Georgian-only
│  (collapsed by default)     │
│  Grid 2×N: კაფე │ ტაქსი   │
│            ეკიმი │ მაღაზია │
│            ...              │
├─────────────────────────────┤
│  Profile tile               │
│  mn-kilim strip (bottom)    │
└─────────────────────────────┘
```

---

### Раздел «старт» (launch section)

**Layout:**
- Заголовок раздела: стандартный `mn-eyebrow` «старт» + Georgian «დასაწყისი» (начало) рядом
- Подзаголовок отсутствует — tiles говорят сами за себя
- 6 модулей в полном `jewel-tile`-формате (без изменений в дизайне тайлов)
- Порядок строго зафиксирован: алфавит-прогрессивный → числа → intro → pronouns → present-tense
- Ниже 5 модулей — `LaunchPathBar` (путь ა→ბ→გ→დ→ე→ვ)
- «Мой словарь» рендерится отдельно после `LaunchPathBar` (уже существует — без изменений)

**Нумерация в launch-секции:**
- Заменяет текущий глобальный счётчик `globalIdx` для launch-модулей
- Launch-модули получают фиксированные Georgian-числа: ა, ბ, გ, დ, ე, ვ
- Medallion position на тайле: `-top-1 -right-1` (без изменений)
- «Мой словарь» получает ვ (6-я позиция)

**Состояния launch-тайлов:**
- Default: jewel-tile, interactive (без изменений)
- Completed (done === total): золотая ✓ метка (без изменений)
- In Progress: KilimProgress показывает прогресс (без изменений)
- Pro-locked: ProBadge (без изменений, если модуль Pro)

---

### Компонент: `LaunchPathBar` (новый)

**Назначение:** показывает рекомендуемый маршрут через launch-набор как горизонтальную цепочку числовых меток. Информационный, не блокирующий.

**Layout (375px):**

```
mn-eyebrow: "рекомендуемый маршрут"

ა ─── ბ ─── გ ─── დ ─── ე ─── ვ
│     │     │     │     │     │
Алф   Числа Знак  Мест  Наст  Слов
```

- Горизонтальная полоса с 6 узлами
- Узел = круг 28px, Georgian буква внутри (Manrope или Noto Sans Georgian, 12px bold)
- Выполненный узел: bg-navy, текст cream, полная непрозрачность
- Текущий (первый невыполненный): bg-gold, текст jewelInk
- Будущий: bg-cream-deep, текст jewelInk/40, border-jewelInk/20
- Горизонтальная линия 1.5px между узлами: цвет jewelInk/20, выполненный сегмент = navy/50
- Подпись под каждым узлом: 9px, jewelInk-hint, сокращение (3–5 символов): «Алф», «Числа», «Знак», «Мест», «Наст», «Слов»

**Props:**
```typescript
interface LaunchPathBarProps {
  completedModules: string[]  // module ids, из progress.completedLessons
  launchModuleIds: string[]   // ordered list of launch module ids
}
```

**Важно:** Компонент не блокирует навигацию — это визуальная рекомендация. Пользователь может начать с любого модуля.

**Размещение:** `px-5 py-4` внутри launch-секции, после последнего launch-тайла, до «Мой словарь».

---

### Раздел «скоро» (coming-soon section)

**Layout:**
- Заголовок-кнопка (expand/collapse): `mn-eyebrow` «скоро» + Georgian «მალე» + количество `(16)` + chevron
- По умолчанию: свёрнут (`collapsed by default` для всех пользователей, не только beginner)
- При раскрытии: 2-колоночная сетка CompingSoonTile-тайлов

**Структура заголовка:**

```
[скоро]  [მალე]  ────────────────  (16)  ›
```

- `mn-eyebrow` «скоро»
- Georgian «მალე» (font-geo, 10px, jeweled-hint)
- Flex-1 тонкая линия (h-px bg-jewelInk/15)
- Счётчик (font-sans 11px bold, jewelInk-hint) — число Coming Soon модулей
- Chevron (rotates on expand, -rotate-90 when collapsed)
- Вся строка кликабельна (48px min height для tap target)

**Сетка Coming Soon:**
- `grid grid-cols-2 gap-3 px-5 pb-2`
- Каждая ячейка — `ComingSoonTile`

---

### Компонент: `ComingSoonTile` (новый)

**Назначение:** компактная плитка для модуля, который ещё не в launch-наборе. Показывает только Georgian-название, не является интерактивным навигатором.

**Layout (одна ячейка, ~160px × ~72px при 375px):**

```
┌────────────────────────────┐
│ [geo-icon]   კაფე          │
│              Скоро         │
└────────────────────────────┘
```

- Background: `bg-cream-deep` (#E8DCCA approximate — вычисляется из Tailwind `cream-deep`)
- Border: `1.5px solid rgba(21, 16, 10, 0.25)` (jewelInk @ 25% opacity)
- No offset shadow (в отличие от jewel-tile — это «неактивная» плитка)
- Border-radius: 10px (как jewel-tile)
- Padding: `px-3 py-3`
- Icon: 32×32 medallion, bg-jewelInk/10, с Georgian буквой модуля (16px, jewelInk/40)
- Заголовок: Georgian name модуля (font-geo, 14px, 600, jewelInk @ 50% opacity)
- Подзаголовок: «скоро» (font-sans, 10px, normal, jewelInk-hint @ 60%)
- No chevron, no KilimProgress

**Состояние при тапе (fallback, если pointer-events включены):**
- Вместо навигации — короткий inline toast/snackbar внизу экрана:
  «Этот модуль появится в следующем обновлении»
- Toast живёт 2.5 секунды, bottom-safe-area, fade in/out 200ms

**Доступность:**
- `role="article"` или `<div>` (не `<button>` если non-interactive, либо button с `aria-disabled`)
- `aria-label={`Модуль ${geoTitle}, скоро`}`

**Props:**
```typescript
interface ComingSoonTileProps {
  geoTitle: string    // Georgian title, e.g. "კაფე"
  geoIcon: string     // Georgian letter icon, e.g. "ყ"
  onTap?: () => void  // показывает toast
}
```

---

### Копирайтинг

| Элемент | Текст |
|---------|-------|
| Launch section header (RU) | старт |
| Launch section header (GEO) | დასაწყისი |
| LaunchPathBar eyebrow | рекомендуемый маршрут |
| Coming Soon header (RU) | скоро |
| Coming Soon header (GEO) | მალე |
| Coming Soon tile sub-label | скоро |
| Toast при тапе на Coming Soon | Этот модуль появится после запуска |

**Запрещено:**
- Слово «Coming Soon» (используем «Скоро» / «скоро»)
- «мини-аб» (только «мини-апп»)
- Русские названия в Coming Soon тайлах (только Georgian)
- Любая фраза намекающая на временную недоступность из-за пользователя (no gate-keeping tone)

---

### Маппинг Coming Soon модулей → Georgian title + icon

| Module ID | geoTitle | geoIcon |
|-----------|----------|---------|
| cases | ბრუნვები | ბ |
| postpositions | თანდებულები | შ |
| adjectives | ზედსართავები | ლ |
| cafe | კაფე | ყ |
| shopping | მაღაზია | ხ |
| taxi | ტაქსი | ტ |
| doctor | ექიმი | ე |
| emergency | დახმარება | ს |
| verb-classes | ზმნის კლასები | ზ |
| version-vowels | ვერსია | უ |
| preverbs | პრევერბები | და |
| imperfect | უწყვეტელი | დ |
| aorist | წყვეტილი | მ |
| pronoun-declension | ბრუნვა | ი |
| conditionals | პირობითი | თ |
| verbs-of-movement | ზმნები | ზ |

*(Верба MotionId при этом сценарии оба verb-типа попадают в Coming Soon — это соответствует L1)*

---

## Адаптивность

**375px (iPhone SE):**
- 6 launch-тайлов: полная ширина минус `px-5`, высота ~72px каждый → всего ~450px scroll zone
- `LaunchPathBar`: горизонтальный, 6 узлов × 28px + линии → умещается при `gap-3`, подписи 9px
  - На 375px суммарная ширина: 6 × 28px + 5 × (gap ~24px) + подписи → ~290px. Умещается.
- Coming Soon сетка: 2 колонки, каждая ~155px wide (375 - 2×20 padding - 12 gap) / 2

**Tap targets:**
- Launch-тайлы: min 72px высота — ОК (> 44px)
- LaunchPathBar узлы: 28px кружок — НЕ тапабельный (декоративный), поэтому допустимо
- Coming Soon заголовок-toggle: min 48px (`pt-4 pb-3`) — ОК
- ComingSoonTile: 72px высота — ОК

---

## Изменения в Dashboard.tsx

> Это секция для Developer-агента — краткий список изменений в логике:

1. **Убрать** разделы grammarIds, vocabIds, advancedIds — заменить на два концептуальных слоя: launch + coming-soon.
2. **Добавить** константу `LAUNCH_MODULE_IDS` (ordered array): `['alphabet-progressive', 'numbers', 'intro', 'pronouns', 'present-tense']`
3. **Добавить** константу `COMING_SOON_MODULE_IDS` — все модули кроме launch + my-vocabulary.
4. **Рендерить** launch-секцию с фиксированным numbered (ა-ვ) через `LaunchPathBar`.
5. **Рендерить** coming-soon секцию как 2-col `ComingSoonTile` grid, collapsed by default.
6. **«Мой словарь»** остаётся отдельной плиткой между launch и coming-soon (или под LaunchPathBar).
7. **Persist** collapsed state coming-soon в localStorage как `bombora_comingsoon_collapsed`.

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру (cream, jewelInk, navy, ruby, gold)
- [x] Типографика в рамках шкалы (14px, 10px, 9px — стандартные размеры T3-T6)
- [x] Содержит обучающий элемент (Coming Soon = Georgian только, LaunchPathBar = ა→ბ→...)
- [x] Описан reveal-момент (Кафе: «я видел კაფე в серой плитке»; Числа: числа = буквы в path)
- [x] Все состояния описаны (launch active/progress/done, coming-soon default/tapped)
- [x] Работает на 375px (LaunchPathBar и 2-col grid расписаны)
- [x] Не нарушает продуктовую философию (нет блокировки, пользователь выбирает сам)
