# «Мой алфавит» — виджет прогресса на Профиле

**Задача:** ROADMAP.md → задача #28
**Статус:** ready

---

## Обучающий элемент

**Что учит:** все 33 буквы грузинского алфавита в порядке ანბანი отображаются как сетка прогресса на экране Profile. Пользователь видит: какие буквы он уже знает (navy), какие ещё предстоит узнать (серые). Визуальный прогресс мотивирует дойти до 33/33.

**Паттерн:** сетка в виде ювелирной мозаики → каждая буква — «плитка» в коллекции → момент узнавания при тапе.

**Reveal-момент 1 (при тапе):** тап на любую букву → micro-flashcard с произношением и примером слова. Для уже изученных — всё открыто. Для неизученных — буква и транслитерация видны, но пример скрыт, есть подсказка «открывается в уроке Алфавит».

**Reveal-момент 2 (33/33):** при достижении всех 33 букв — одноразовая анимация «Ты знаешь весь алфавит» со штампом «მთელი ანბანი!» (весь алфавит!). Срабатывает один раз (localStorage-флаг `bombora_alphabet_complete_shown`).

**Дофамин:** счётчик «X / 33 букв» растёт с каждым пройденным уроком Алфавита. Сетка постепенно заполняется navy-плитками — ощущение собирания коллекции.

---

## Источник данных

**Какой модуль:** `alphabet-progressive` — модуль Алфавита.

**Как определить изученные буквы:**
```typescript
// Из catalog.modules найти модуль 'alphabet-progressive'
// Для каждого урока, чей id входит в completedLessons['alphabet-progressive']:
//   собрать все буквы из blocks типа 'letters' → block.letters[].letter
// Результат: Set<string> изученных букв
```

**Как получить данные для flashcard:**
```typescript
// Из тех же blocks: AlphabetLetterDto { letter, name, translit, exampleGe, exampleRu }
// Map<letter: string, AlphabetLetterDto & { lessonId: number }>
// Строится при монтировании Profile, не требует сетевого запроса (данные уже в catalog)
```

Catalog уже загружен в App.tsx и передаётся в Profile как `catalog: CatalogDto`. Данные букв доступны без дополнительных API-вызовов.

---

## Экраны и состояния

### Секция «Мой алфавит» на экране Profile

**Место в вёрстке Profile** (между Stats row и «Любимый раздел»):
```
[ kilim-strip ]
[ Header ]
[ Hero — mascot + greeting ]
[ Фраза дня ]
[ Активность 35 дней ]
[ Quick stats row ]
↓↓↓ ← НОВАЯ СЕКЦИЯ ↓↓↓
[ Мой алфавит — eyebrow + сетка + счётчик ]
↑↑↑ ← НОВАЯ СЕКЦИЯ ↑↑↑
[ Любимый раздел ]
[ Pro CTA ]
[ Настройки ]
...
```

**Layout секции:**
```
[ mn-eyebrow: «мой алфавит» ]            ← label, отступ mb-2
[ jewel-tile: px-4 py-4 mb-5 ]
│  [ счётчик: «X / 33 буквы» ]           ← T4, font-extrabold, text-navy, mb-3
│  [ KilimProgress-тонкий (X из 33) ]    ← 4px high, однострочный зигзаг, mb-3
│  [ AlphabetGrid — сетка 33 буквы ]     ← 7 букв в ряд, 5 строк
│  [ При 0 букв: hint-подсказка ]        ← «Начни Алфавит — буквы будут открываться здесь»
└──────────────────────────────────────
```

**Показывается всегда** — модуль Алфавит бесплатный, нет gate-keeping.

---

### Компонент: AlphabetGrid (новый)

**Назначение:** сетка 33 грузинских букв с визуальным статусом.

**Props:**
```typescript
interface AlphabetGridProps {
  learnedLetters: Set<string>        // из completedLessons + catalog
  letterData: Map<string, AlphabetLetterDto>  // из catalog theory blocks
  onLetterTap: (letter: string) => void
}
```

**Layout:**
```
flexbox wrap, gap-[6px]
```

**Ячейка буквы:**
```
w-[44px] h-[44px]
border-[1.5px] rounded-lg
font-geo text-[20px] font-extrabold
flex items-center justify-center
```

| Состояние | BG | Текст | Border | Shadow |
|-----------|-----|-------|--------|--------|
| Изучена (learned) | `navy` | `cream` | `jewelInk` | `2px 2px 0 #15100A` |
| Не изучена | `cream-tile` | `jewelInk/30` | `jewelInk/20` | `none` |
| Hover/Active (тап) | `navy/80` | `cream` | `jewelInk` | `none` (притаплена) |

Неизученные буквы **кликабельны** (не disabled) — тап показывает flashcard с locked-состоянием. Это важно: пользователь может заинтересоваться любой буквой до её урока.

**Порядок букв (стандартный ანბანი, 33 буквы):**
```
ა ბ გ დ ე ვ ზ თ ი კ ლ მ ნ ო პ ჟ რ ს ტ უ ფ ქ ღ ყ შ ჩ ც ძ წ ჭ ხ ჯ ჰ
```
(совпадает с `GEORGIAN_ALPHABET` из `AlphaIndex.tsx` — переиспользовать ту же константу)

**Счётчик:** `{learnedCount} / 33 буквы` — `font-sans text-[15px] font-extrabold text-navy`

**KilimProgress под счётчиком:**
- Существующий компонент `KilimProgress`, `completed={learnedCount}`, `total={33}`
- Высота: 8px (параметр height или минимальная реализация)
- Цвет заполненных треугольников: navy. Незаполненных: jewelInk/15

---

### Компонент: LetterPopover (новый)

**Назначение:** micro-flashcard при тапе на букву.

**Props:**
```typescript
interface LetterPopoverProps {
  letter: string
  data: AlphabetLetterDto | null   // null = данные ещё не загружены из каталога
  isLearned: boolean
  onClose: () => void
}
```

**Поведение:**
- Отображается как центральный overlay поверх Profile (fixed, z-50)
- Backdrop: `bg-jewelInk/40`, тап на backdrop = закрыть
- Сама карточка: `jewel-tile`, `bg-cream`, max-w-[280px], centered

**Layout карточки:**
```
┌─────────────────────────────┐
│  [ × ]  кнопка закрыть      │ ← top-right, 32×32px
│                             │
│  [  ა  ]                    │ ← font-geo, 64px, navy (если изучена) / jewelInk/40 (нет)
│                             │
│  «ани» (name)               │ ← font-sans 12px, mn-eyebrow стиль, center
│  [a] (translit)             │ ← font-sans 14px, font-bold, center
│                             │
│  — если изучена —           │
│  ანბანი                     │ ← font-geo 18px, jewelInk
│  алфавит                    │ ← font-sans 12px, jewelInk-mid
│                             │
│  — если НЕ изучена —        │
│  🔒 узнаешь в Алфавите     │ ← mn-eyebrow, jewelInk-hint, center
└─────────────────────────────┘
```

**Анимация появления:** `scale(0.85) → scale(1)`, 150ms ease-out. Backdrop: `opacity: 0 → 0.4`, 150ms.

**Закрытие:** тап на ×, тап на backdrop, или тап на ту же букву снова.

**Состояния:**
- **data = null:** показывает только букву + «данные недоступны» hint (крайний случай, когда буква не найдена в каталоге)
- **isLearned = true:** полная информация, буква navy
- **isLearned = false:** буква серая, пример скрыт, lock-подсказка

---

### Состояние при 0 изученных букв (пустой Алфавит)

Вместо сетки — мотивирующий hint:
```
[ Mascot mood=guide, размер 48px ] [ текст ]
Начни модуль «Алфавит» —
буквы будут открываться здесь по мере уроков.
```

Отображается в рамках того же `jewel-tile`, выравнивание по центру, `mn-eyebrow` стиль для подсказки.

**Счётчик:** `0 / 33 буквы` всё равно показывается.

---

### Reveal-анимация 33/33

**Триггер:** `learnedCount === 33` и `localStorage.getItem('bombora_alphabet_complete_shown') !== '1'`.

**Что происходит:**
1. Все 33 плитки в сетке одновременно мигают gold (CSS animation `goldFlash`, 600ms)
2. Поверх сетки на 2 секунды появляется центральный штамп (не overlay, а absolute внутри jewel-tile):
   - `მთელი ანბანი!` — font-geo, 22px, jewelInk
   - «Ты знаешь весь грузинский алфавит» — font-sans, 13px, jewelInk-mid
   - Фон штампа: gold, border 1.5px jewelInk, border-radius 8px, padding 8px 16px
3. Флаг `bombora_alphabet_complete_shown = '1'` записывается в localStorage
4. После 2 секунд штамп fade-out (opacity: 1 → 0, 300ms)

**Повторный показ:** в OwnerDebugPanel добавить «Сбросить алфавит 33/33» → `clearKeys(['bombora_alphabet_complete_shown'], 'alphabet complete')`.

---

### Анимации

| Событие | Анимация |
|---------|----------|
| Тап на букву (открытие popover) | scale 0.85→1, 150ms ease-out |
| Закрытие popover | scale 1→0.9 + opacity 1→0, 100ms ease-in |
| Новая изученная буква появляется | transition `bg-cream-tile → bg-navy`, 300ms ease-out |
| 33/33 достигнуто | `goldFlash` анимация на всех плитках + gold-штамп |
| Тап на плитку (pressable) | `translate(2px, 2px) + shadow: none`, 75ms |

`goldFlash` keyframes:
```css
@keyframes goldFlash {
  0%   { background-color: var(--navy); }
  40%  { background-color: #F5B820; }  /* gold */
  100% { background-color: var(--navy); }
}
```

---

## Копирайтинг

| Элемент | Текст |
|---------|-------|
| Eyebrow секции | `мой алфавит` |
| Счётчик | `{N} / 33 буквы` |
| Пустое состояние | `Начни модуль «Алфавит» — буквы откроются по мере уроков` |
| Locked hint в popover | `узнаешь в Алфавите` |
| 33/33 штамп (Georgian) | `მთელი ანბანი!` |
| 33/33 подпись | `Ты знаешь весь грузинский алфавит` |

---

## Адаптивность (375px)

**Сетка на 375px:**
- Контейнер с `px-4` (16px с каждой стороны) = 375 - 32 = 343px для сетки
- 7 колонок × 44px + 6 gap × 6px = 308 + 36 = 344px — влезает с запасом в 1px
- Итого: 5 строк (4 × 7 + 1 × 5 букв в последней) → ровный блок

**Буквы:** `font-geo text-[20px]` — крупнее требуемого минимума 20px из ROADMAP ✓

**Tap targets:** 44×44px = ровно минимальный стандарт iOS HIG ✓

**Popover:** `max-w-[280px]`, центрирован горизонтально. На 375px — боковые отступы 47.5px, комфортно.

**KilimProgress:** растягивается на всю ширину jewel-tile (`w-full`).

---

## Интеграция в Profile.tsx

**Что меняется в `Profile.tsx`:**

1. Добавить useMemo для вычисления `learnedLetters: Set<string>` и `letterData: Map<string, AlphabetLetterDto>` из `catalog` + `progress`.

2. Добавить state `selectedLetter: string | null = null` для управления popover.

3. Вставить секцию `<AlphabetSection>` между Stats row и «Любимый раздел».

4. Вставить `<LetterPopover>` условно при `selectedLetter !== null` (рендерить поверх всего, в конце JSX как ProPaywall).

**Новые файлы:**
- `src/Trale/miniapp-src/src/components/AlphabetGrid.tsx`
- `src/Trale/miniapp-src/src/components/LetterPopover.tsx`

**Используемые существующие компоненты:**
- `AlphaIndex.tsx` → `GEORGIAN_ALPHABET` — импортировать и переиспользовать массив букв
- `KilimProgress.tsx` — для прогресс-полосы под счётчиком
- `Mascot.tsx` — в пустом состоянии
- `Header.tsx` — без изменений

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру (cream-tile, jewelInk, navy для изученных, gold для 33/33)
- [x] Типографика: font-geo 20px для букв в сетке, font-sans 15px для счётчика, mn-eyebrow для label
- [x] Содержит обучающий элемент: 33 буквы алфавита в порядке ანბანი, видны при каждом визите в Profile
- [x] Описан reveal-момент: micro-flashcard по тапу + анимация 33/33 с грузинским штампом
- [x] Все состояния описаны: 0 букв / частичный прогресс / 33/33 / popover learned / popover locked
- [x] Работает на 375px (7 колонок × 44px, 343px в доступной зоне — влезает)
- [x] Не нарушает продуктовую философию (нет гейтинга, нет стрик-шейминга, всё открыто)
- [x] Один акцентный цвет на элемент: navy = изучено, gold = достижение 33/33
- [x] Данные берутся из уже загруженного catalog — нет дополнительных API-запросов
