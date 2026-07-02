# Первый-урок UX фикс — конверсия picked_level → started_lesson

**Задача:** GitHub epic #936  
**Статус:** ready

## Обучающий элемент

**Hero-CTA:** первое грузинское слово, которое видит новый пользователь — «გამარჯობა!» (Гамарджоба!) в подписи CTA. Reveal-момент: когда юзер пройдёт урок «Знакомство» и встретит это приветствие в теории, он почувствует узнавание — «я уже видел это слово на экране входа».

**ModuleMap pulse:** первый кружок сохраняет georgian numeral «ა» (ა = 1) — тот же символ, что на badge модуля. Пульсирующая анимация делает очевидным: «путь начинается здесь». Reveal-момент: после первого урока ა превращается в зелёную галочку — число стало достижением.

---

## Экраны и состояния

### Экран: Dashboard — Hero-CTA для нового пользователя

**Условие активации:** `Object.keys(progress.completedLessons).length === 0`

**Layout (375px, верхняя часть — всё видно без скролла):**

```
┌──────────────────────────────────────────┐
│ [DashboardTopBar: XP · streak]           │ ~48px
├──────────────────────────────────────────┤
│                                          │
│     [Mascot — compact, 80px]             │
│      Привет!  ·  готова к знакомству     │
│                                          │ ~120px
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐  │
│  │ 🎯    первый урок          ▼ →    │  │
│  │       [Название урока]             │  │ min 100px
│  │       გამარჯობა! · Алфавит, урок 1│  │
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤
│ [секция «основы» и модули ниже]          │
└──────────────────────────────────────────┘
```

Сумма до скролла: 48 + 120 + 100 = ~268px из 667px — всё входит в viewport.

#### Компонент `FirstLessonHeroCta`

**Props:**
```tsx
interface FirstLessonHeroCtaProps {
  firstLesson: {
    moduleId: string
    lessonId: number
    title: string
    moduleTitle: string
  }
  onStart: () => void
}
```

**Стиль карточки:**
- Класс: `jewel-tile jewel-pressable` (1.5px ink border + 3px offset shadow)
- Фон: `bg-navy` — контрастный navy, чтобы выделяться среди cream-фоновых тайлов
- Padding: `px-5 py-5`
- Минимальная высота: `min-h-[100px]`
- Ширина: `w-full`

**Внутренняя структура (flex row, items-center, gap-4):**

1. **Иконка-кружок:**
   - `w-12 h-12 rounded-xl bg-cream border-[1.5px] border-jewelInk`
   - `style={{ boxShadow: '2px 2px 0 #15100A' }}`
   - Внутри: `🎯` — font-size 22px

2. **Текстовый блок (flex-1):**
   - Eyebrow: `mn-eyebrow text-cream/70` → «первый урок»
   - Title: `font-sans text-[18px] font-extrabold text-cream leading-tight` → `firstLesson.title`
   - Subtitle: `font-geo text-[11px] text-cream/60 mt-0.5` → «გამარჯობა! · {firstLesson.moduleTitle}, урок {firstLesson.lessonId}»

3. **Chevron:**
   - SVG стрелка → (18×18), `text-cream/70`

**On tap:**
1. `window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium')`
2. `onStart()` → navigate к `{ kind: 'lesson-theory', moduleId, lessonId }`

**Анимация:** `jewel-pressable` обеспечивает scale-95 при нажатии — дополнительных анимаций нет.

---

#### Mascot в режиме нового пользователя

- **Размер:** `size={80}` (вместо 120)
- **Mood:** `cheer` (как сейчас для `totalDone === 0`)
- **Bowl-indicator:** скрыт (три точки не показываем при 0 прогрессе — нечего показывать)
- Greeting строки без изменений: «Привет!» / «готова к знакомству»

---

#### Состояния Dashboard по прогрессу

| Состояние | Условие | Hero | Mascot | Покормить |
|---|---|---|---|---|
| Новый пользователь | `completedLessons = {}` + `availableXp = 0` | `FirstLessonHeroCta` (navy) | 80px, cheer | Хинт (нет кнопки) |
| Новый пользователь с XP | `completedLessons = {}` + `availableXp > 0` | `FirstLessonHeroCta` (navy) | 80px, cheer | Кнопка (edge case: мало вероятен, но XP может быть от реферала) |
| Вернувшийся | `completedLessons != {}` | Обычный suggestion-tile | 120px, contextual | Кнопка если XP > 0 |
| Вернувшийся, 0 XP | `completedLessons != {}` + `availableXp = 0` | Обычный suggestion-tile | 120px, contextual | Хинт (нет кнопки) |

---

### Экран: Dashboard — кнопка «Покормить» (Scenario 1)

**Условие скрытия:** `availableXp === 0` (независимо от hero-состояния).

**Состояние default (availableXp > 0):** без изменений — кнопка с «🍖 Покормить · ⭐ N».

**Состояние hidden (availableXp === 0):**

Вместо кнопки рендерится однострочный текст-подсказка:

```tsx
<div className="mt-3 flex justify-center">
  <p className="font-sans text-[12px] text-center text-jewelInk-hint leading-snug px-6">
    Заработай XP первым уроком — получишь угощения для Бомборы
  </p>
</div>
```

- Цвет: `text-jewelInk-hint` (самый тихий тон, не конкурирует с hero-CTA)
- Анимации нет — просто conditional render

---

### Экран: ModuleMap — пульсирующий кружок (Scenario 3)

**Условие активации:**
```
completedLessons[moduleId]?.length === 0
  && !localStorage.getItem(`bombora_module_started_${moduleId}`)
```

Проверяется на mount через useState + useEffect.

#### Пульсирующая обводка

CSS animation `pulse-ring` добавляется к первому кружку (idx === 0):

```css
@keyframes pulse-ring {
  0%   { box-shadow: 0 0 0 0 {accentHex}66, 2px 2px 0 #15100A; }
  70%  { box-shadow: 0 0 0 8px {accentHex}00, 2px 2px 0 #15100A; }
  100% { box-shadow: 0 0 0 0 {accentHex}00, 2px 2px 0 #15100A; }
}
```

- Длительность: 1.5s ease-out infinite
- `accentHex` = цвет акцента модуля (navy/ruby/gold)
- Поверх существующего box-shadow (2px 2px offset), не вместо

Реализация: первый кружок получает prop `isPulsing: boolean` → инлайн-стиль с animation и особым box-shadow.

#### Badge «Начни здесь»

Вставляется в label-блок рядом с первым кружком (под subtitle урока):

```tsx
{idx === 0 && isPristine && (
  <span className="inline-flex items-center gap-1 font-sans text-[10px] font-extrabold
    text-accent bg-accent/10 rounded-md px-1.5 py-0.5 mt-1 border border-accent/30">
    ▶ Начни здесь
  </span>
)}
```

- `accent` = moduleAccent (navy/ruby/gold)
- Для `text-navy`: `text-navy bg-navy/10 border-navy/30`
- Для `text-ruby`: `text-ruby bg-ruby/10 border-ruby/30`
- Для `text-gold-deep`: `text-gold-deep bg-gold/10 border-gold/30`

#### Снятие пульсации

При клике на **любой** кружок/label-кнопку в этом модуле:

```tsx
localStorage.setItem(`bombora_module_started_${moduleId}`, '1')
```

Затем useState обновляется → пульсация и badge исчезают немедленно (без задержки).

#### Состояния ModuleMap

| Состояние | Условие | Кружок 1 |
|---|---|---|
| Pristine | 0 completed + не кликали | pulse-ring animation + badge «Начни здесь» |
| Started | любой клик в этой сессии | без пульсации, без badge |
| In progress | есть completed | галочки на done, accentBg на current — как сейчас |

---

### Экран: LessonTheory — свёрнутая теория (Scenario 4, не-алфавит)

**Условие свёртывания:**
- `!(moduleId === 'alphabet-progressive' && lessonId === module.lessons[0]?.id)`  
- AND `!progress.completedLessons[moduleId]?.includes(lessonId)` (урок не пройден)

**Layout (collapsed):**

```
[Header: урок N из M]
[kilim strip]

┌─────────────────────────────────────────┐
│  урок № N                               │ jewel-tile
│  [Название урока]                       │
│  ─────────────────────────────────────  │
│  цель                                   │
│  [Текст цели урока]                     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  📖 Объяснение                      ▼  │ accordion trigger
└─────────────────────────────────────────┘
   (закрыт по умолчанию)

[kilim strip opacity-70]

──────────────────────────────── fixed bar
[         Поехали →              ]  jewel-btn primary
```

#### Компонент `TheoryAccordion`

```tsx
interface TheoryAccordionProps {
  label: string        // «Объяснение» | «Остальные буквы»
  defaultOpen?: boolean  // false (default) = свёрнут
  icon?: string        // «📖» (default)
  children: React.ReactNode
}
```

**Trigger-кнопка:**
- `w-full flex items-center justify-between px-5 py-4`
- Фон: `bg-cream` + border: `border-[1px] border-jewelInk/20 rounded-xl`
- Shadow: `1px 1px 0 rgba(21,16,10,0.1)` (мягкий, вторичный)
- Текст: `font-sans text-[15px] font-bold text-jewelInk`
- Chevron: SVG 16×16, поворот 0° (закрыт) → 180° (открыт), transition 200ms

**Body:**
- При закрытом: `max-height: 0; overflow: hidden; opacity: 0`
- При открытом: `max-height: none; opacity: 1`
- Transition: `max-height 300ms ease, opacity 200ms ease`
- Внутри: `flex flex-col gap-4 pt-4`

**CTA в bottom bar (при первом визите):**
- Текст: «Поехали →» (вместо «к практике →»)
- Стиль: `variant="primary"` — без изменений

---

### Экран: LessonTheory — alphabet-progressive урок 1 (Scenario 4, исключение)

**Условие:** `moduleId === 'alphabet-progressive' && lessonId === module.lessons[0]?.id`

Теория НЕ сворачивается в accordion. Показывается preview: первые 3 буквы из блока `type=letters`, остальное — за accordion.

**Layout (preview):**

```
[Header]
[kilim strip]

[Title card: jewel-tile — название + цель]

[grid 2-col: первые 3 letter-card из letters-блока]
(если letters-блок не первый — показываем первый блок целиком)

┌─────────────────────────────────────────┐
│  📖 Остальные буквы                 ▼  │ accordion (закрыт)
└─────────────────────────────────────────┘
   (все буквы 4+ и остальные блоки)

[kilim strip opacity-70]

──────────────────────────────── fixed bar
[          Поехали →             ]
```

**Логика preview-сплита:**

```
lettersBlock = theory.blocks.find(b => b.type === 'letters')
previewLetters = lettersBlock?.letters?.slice(0, 3) ?? []
restLetters    = lettersBlock?.letters?.slice(3) ?? []
restBlocks     = theory.blocks.filter(b => b !== lettersBlock)
```

Accordion `«📖 Остальные буквы»` содержит:
- `letters`-блок с `restLetters` (если `restLetters.length > 0`)
- все `restBlocks`

---

#### Состояния LessonTheory по условиям

| Условие | Theory layout | CTA |
|---|---|---|
| Первый визит, не алфавит L1 | Title card + accordion (закрыт) | «Поехали →» |
| Первый визит, алфавит L1 | Title card + preview 3 букв + accordion (закрыт) | «Поехали →» |
| Урок уже пройден (любой модуль) | Полная теория раскрыта — как сейчас | «к практике →» |

---

## Копирайтинг

| Место | Текст |
|---|---|
| Hero-CTA eyebrow | «первый урок» |
| Hero-CTA title | `{firstLesson.title}` (из API) |
| Hero-CTA subtitle | «გამარჯობა! · {moduleTitle}, урок {lessonId}» |
| Хинт вместо «Покормить» | «Заработай XP первым уроком — получишь угощения для Бомборы» |
| ModuleMap badge | «▶ Начни здесь» |
| Accordion trigger (не-алфавит) | «📖 Объяснение» |
| Accordion trigger (алфавит L1) | «📖 Остальные буквы» |
| LessonTheory CTA (первый визит) | «Поехали →» |
| LessonTheory CTA (возврат) | «к практике →» — без изменений |

**Запрещено:** «маладэц», «поехали!» с восклицанием в духе имитации акцента. «Поехали →» со стрелкой — нейтральный и современный тон.

---

## Адаптивность (375px)

- TopBar ~48px + Mascot 80px + greeting ~40px + Hero-CTA 100px = ~268px < 667px ✓ (всё без скролла)
- Hero-CTA: `w-full min-h-[100px]` — без фиксированной высоты, растягивается под текст
- Accordion trigger: `py-4` → ~56px tap-target ✓ (≥ 44px)
- Hero-CTA: `py-5` → ~66px tap-target ✓
- ModuleMap badge «Начни здесь»: не интерактивен (декоративный), малый шрифт допустим
- Пульсирующий кружок: CIRCLE_SIZE 48–56px — tap-target в норме ✓

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру (navy, cream, jewelInk, gold, ruby)
- [x] Типографика: eyebrow mn-eyebrow, T1=26px, T2=22px, T3=18px, T4=15-17px, T5=13px, T6=10-12px — в шкале
- [x] Обучающий элемент: «გამარჯობა!» в CTA, «ა» нумерал в пульсирующем кружке
- [x] Reveal-момент: greeting → lesson recognition; pulse-badge → checkmark progression
- [x] Все состояния описаны: new/returning, xp=0/xp>0, pristine/started module, first-visit theory/returning
- [x] Работает на 375px — верхняя часть без скролла проверена
- [x] Не нарушает продуктовую философию — контент теории не удаляется, только сворачивается
