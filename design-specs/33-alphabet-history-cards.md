# История грузинского письма — культурные карточки в Алфавите

**Задача:** ROADMAP.md → задача #33
**Статус:** ready

---

## Обучающий элемент

Пользователь учит алфавит — 33 чужих символа без культурного контекста. Это мотивационная
пустота: знаки есть, смысла нет. Четыре факт-карточки превращают алфавит из «набора
знаков» в живую историю с 15-вековой биографией.

**Структура обучения — 4 карточки:**

| № | Заголовок | Суть |
|---|-----------|------|
| 1 | Алфавит с нуля | V век н.э., один из 14 оригинальных алфавитов мира (не производный от финикийского) |
| 2 | Три стиля | ასომთავრული / ნუსხური / მხედრული — церковный, монастырский, светский |
| 3 | Один регистр | Грузинский не знает заглавных букв в европейском смысле — равновесие символов |
| 4 | Загрузчик — это ქ | Reveal: анимированный лоадер всего приложения — это буква ქ, первая буква ქართული (грузинский) |

**Reveal-момент — Card 4:** пользователь осознаёт, что лоадер `LoaderLetter`, который
он видел при каждом запуске мини-аппа — это буква ქ. Та самая, первая буква
слова «ქართული» (kartuli — грузинский язык). Реакция: «Это было у меня всё время!»

Аналог паттерна `RevealKaniOverlay` — только через текст, не через overlay.

---

## Экраны и состояния

### Вход: ModuleMap для alphabet-progressive (и alphabet)

**Изменение:** Между overview-карточкой (jewel-tile с KilimProgress) и `ModulePhraseBanner`
добавляется ghost-кнопка «История алфавита»:

```
[ jewel-tile: overview + KilimProgress ]
[ → История алфавита · ghost-btn ← ]    ← новое
[ ModulePhraseBanner ]
[ mn-eyebrow «уроки» ]
[ путь-уроков ]
```

**Кнопка «История алфавита»:**
```
┌─────────────────────────────────────────────────────────────┐
│   📜  История алфавита           ისტორია →                  │
│       15 веков грузинского письма                           │
└─────────────────────────────────────────────────────────────┘
```
- Стиль: `jewel-tile` (не jewel-btn — это «карточка-анонс», а не action-кнопка)
- Иконка: буква **ა** в золотом круге (24px), заменяет emoji 📜
- Текст справа: `ისტორია →` — navy, mn-eyebrow
- Субтайтл: «15 веков грузинского письма» — 13px, jewelInk-mid
- Видимость: всегда, начиная с модуля `alphabet-progressive` и `alphabet`
- Tap target: вся плитка, ≥ 56px высотой

---

### Новый экран: AlphabetHistoryScreen

**Маршрут в навигации:**
```typescript
| { kind: 'alphabet-history'; fromModuleId: string }
```
`fromModuleId` нужен для кнопки «назад» (возврат в правильный `module`-экран).

**Layout экрана:**
```
[ kilim strip 8px — top ]
[ Header: ← назад | eyebrow «ისტორია» | title «История алфавита» ]

[ Индикатор карточек: ● ○ ○ ○  (4 точки, текущая — gold) ]

[ Активная карточка — jewel-tile, full-width ]
  ┌──────────────────────────────────────────────────────────┐
  │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← gold hairline
  │                                                          │
  │  [ა] · КАРТОЧКА 1 / 4          [Mascot cheer, 64px]     │
  │                                                          │
  │  Алфавит с нуля                                          │  ← T2 22px extrabold
  │  ────────────────                                        │  ← 1px gold hairline
  │                                                          │
  │  Georgian script sample (большой):                       │
  │  მხედრული — 48px, navy                                   │  ← основной стиль
  │                                                          │
  │  Тело карточки — 14px jewelInk, leading-relaxed          │
  │                                                          │
  │  Культурная деталь — 12px jewelInk-mid, italic запрещён  │
  │  → особое форматирование: ruby·bullet                    │
  │                                                          │
  └──────────────────────────────────────────────────────────┘

[ Навигация:
    [ ← Назад ]   [ Далее → ]           (ghost-btns, 44px tap)
    На Card 4: [ Далее → ] → [ Закрыть ]
]

[ kilim strip 8px — bottom ]
```

**Переключение карточек:**
- Свайп влево/вправо (touch events)
- Кнопки «Назад» / «Далее»
- Анимация: горизонтальный slide `mn-slide-h` 220ms ease-out (входящая карточка slide-in, исходящая — fade-out)
- Точки-индикаторы анимируются: активная увеличивается 6px→9px, 180ms

---

### Контент карточек

**Card 1 — «Алфавит с нуля»**
```
Грузинский гляф (large sample): 
  ა ბ გ  — 40px, navy, буквы с интервалом

Заголовок: Алфавит с нуля
Тело:
  Грузинское письмо создано около 430 года н.э. — одно из
  14 оригинальных алфавитов мира, изобретённых независимо,
  без опоры на финикийский корень.

  Из 400+ письменностей истории — лишь единицы возникли
  с нуля. Грузинский алфавит — среди них.

Культурная деталь (ruby bullet):
  Создание приписывают царю Вахтангу I и учёному Месропу
  Маштоцу — тому же, кто придумал армянский алфавит.
```

**Card 2 — «Три стиля»**
```
Грузинские глифы:
  ასომთავრული   ნუსხური   მხედრული
  (large, разные начертания одной буквы ა)

Заголовок: Три стиля — один язык
Тело:
  ასომთავრული (asomtavruli) — «заглавное письмо».
  Старейшее, церковные тексты V–IX вв.

  ნუსხური (nuskhuri) — монастырский минускул.
  Компактный, для рукописных книг IX–XI вв.

  მხედრული (mkhedruli) — «всадническое». 
  Светское письмо, ставшее современным стандартом.

Культурная деталь (ruby bullet):
  В современном Georgian используют только მხედრული.
  Два других стиля — живая история в церкви и музеях.
```

**Card 3 — «Один регистр»**
```
Грузинские глифы:
  ა  А  α
  (Georgian / Латиница / Греческий — сравнение)

Заголовок: Без заглавных букв
Тело:
  Грузинский не различает строчные и прописные. Одна
  форма символа — в начале предложения, в имени
  собственном, в заголовке — везде одинаково.

  Предложение: «მარიამი ქართველია.»
  («Мариам — грузинка.»)
  — буква მ одна и та же в начале и внутри слова.

Культурная деталь (ruby bullet):
  ასომთავრული иногда называют «заглавным», но это стиль
  письма, не регистр — как готический шрифт в немецком.
```

**Card 4 — «Загрузчик — это ქ»**
```
Грузинский гляф (очень крупный):
  ქ  — 80px, navy, с золотым подчёркиванием (как LoaderLetter)

Заголовок: Загрузчик — это ქ
Тело:
  Анимированная буква на экране загрузки мини-аппа —
  не просто украшение. Это ქ — первая буква слова
  
  ქართული — [kartuli]
  «грузинский»
  
  Самоназвание языка начинается с ქ. Теперь ты знаешь
  её имя — и увидишь её в каждом слове «грузинский».

Культурная деталь (ruby bullet):
  ქართული → ქართველი (грузин) → ქართველობა (грузинство).
  Буква ქ — начало целого народа.

[Mascot mood=cheer, размер 80px, справа от текста или под]
```

---

### Состояния экрана

| Состояние | Описание |
|-----------|----------|
| Default (Card 1) | Первая карточка открыта, индикатор ● ○ ○ ○ |
| Transitioning | Slide animation между картами |
| Card 4 (последняя) | Кнопка «Далее» заменяется на «Закрыть» (jewel-btn-navy) |
| Completed | После «Закрыть» — возврат в ModuleMap |

Нет состояний Loading/Error — весь контент статичный, встроен в компонент.

**Persistency:** не сохраняем «прочитано» в localStorage. Карточки можно открывать снова — это культурный референс, не одноразовый туториал.

---

## Компоненты (новые)

### `AlphabetHistoryScreen`

**Файл:** `src/Trale/miniapp-src/src/screens/AlphabetHistoryScreen.tsx`

**Props:**
```typescript
interface Props {
  fromModuleId: string          // 'alphabet-progressive' | 'alphabet'
  progress: ProgressState
  navigate: (s: Screen) => void
}
```

**Внутреннее состояние:**
```typescript
const [cardIndex, setCardIndex] = useState(0)   // 0..3
const [dir, setDir] = useState<'fwd' | 'bwd'>('fwd')
```

**Зависимости:** `Header`, `Mascot`, компонент `HistoryCard` (внутренний, не экспортируется).

### `HistoryCard` (внутренний)

Не отдельный файл — sub-component внутри `AlphabetHistoryScreen.tsx`.

**Props:**
```typescript
interface HistoryCardProps {
  cardNumber: 1 | 2 | 3 | 4
  title: string
  glyphs: string              // строка с Georgian символами
  body: React.ReactNode       // параграфы
  culturalNote: string        // ruby-bullet строка
  showMascot?: boolean        // только Card 4
}
```

**Шаблон разметки:**
```jsx
<div className="jewel-tile px-5 py-6 mx-0">
  <div className="mn-eyebrow mb-3">карточка {cardNumber} / 4</div>
  
  <div className="font-georgian text-[48px] text-navy mb-4 tracking-widest">
    {glyphs}
  </div>
  
  <h2 className="font-sans text-[22px] font-extrabold text-jewelInk mb-1">
    {title}
  </h2>
  <div className="h-[1px] bg-gold mb-4" />   {/* gold hairline */}
  
  <div className="font-sans text-[14px] text-jewelInk leading-relaxed mb-4">
    {body}
  </div>
  
  <div className="flex gap-2 items-start">
    <span className="text-ruby font-bold text-[14px]">▪</span>
    <p className="font-sans text-[12px] text-jewelInk-mid leading-snug">
      {culturalNote}
    </p>
  </div>
  
  {showMascot && <Mascot mood="cheer" size={80} className="mt-4 mx-auto" />}
</div>
```

### Изменения в `ModuleMap.tsx`

Условный рендер кнопки «История алфавита» — только для alphabet-модулей:

```jsx
{/* Alphabet History entry — alphabet modules only */}
{(moduleId === 'alphabet-progressive' || moduleId === 'alphabet') && (
  <button
    className="jewel-tile px-5 py-4 mb-4 w-full text-left flex items-center gap-4"
    onClick={() => navigate({ kind: 'alphabet-history', fromModuleId: moduleId })}
  >
    <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center shrink-0">
      <span className="font-georgian text-[20px] text-jewelInk font-bold">ა</span>
    </div>
    <div className="flex-1 min-w-0">
      <div className="mn-eyebrow text-navy">ისტორია →</div>
      <div className="font-sans text-[14px] font-bold text-jewelInk leading-tight">
        История алфавита
      </div>
      <div className="font-sans text-[12px] text-jewelInk-mid mt-0.5">
        15 веков грузинского письма
      </div>
    </div>
  </button>
)}
```

**Позиция:** между overview-карточкой (`jewel-tile` с KilimProgress) и `ModulePhraseBanner`.

### Изменения в `types.ts`

Добавить в union `Screen`:
```typescript
| { kind: 'alphabet-history'; fromModuleId: string }
```

### Изменения в `App.tsx`

Добавить case в роутер:
```tsx
case 'alphabet-history':
  return (
    <AlphabetHistoryScreen
      fromModuleId={screen.fromModuleId}
      progress={progress}
      navigate={setScreen}
    />
  )
```

---

## Анимации

| Анимация | Описание | Timing |
|----------|----------|--------|
| Переход вперёд | Текущая карточка slide-out left → новая slide-in right | 220ms ease-out |
| Переход назад | Текущая slide-out right → новая slide-in left | 220ms ease-out |
| Dots indicator | Активная точка 6px→9px | 180ms ease |
| Mascot на Card 4 | `pb-breath` (уже есть в Mascot) | бесконечный |

CSS-класс для горизонтального слайда добавить в `index.css`:
```css
@keyframes mn-slide-in-right {
  from { opacity: 0; transform: translateX(20px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes mn-slide-in-left {
  from { opacity: 0; transform: translateX(-20px); }
  to   { opacity: 1; transform: translateX(0); }
}
.mn-slide-in-right { animation: mn-slide-in-right 220ms ease-out both; }
.mn-slide-in-left  { animation: mn-slide-in-left  220ms ease-out both; }
```

---

## Копирайтинг

| Элемент | Текст |
|---------|-------|
| Кнопка на ModuleMap — грузинский eyebrow | `ისტორია →` |
| Кнопка — заголовок | `История алфавита` |
| Кнопка — субтайтл | `15 веков грузинского письма` |
| Header eyebrow | `ისტორია` |
| Header title | `История алфавита` |
| Индикатор | `карточка 1 / 4` (eyebrow) |
| Кнопка навигации вперёд | `Далее →` |
| Кнопка навигации назад | `← Назад` |
| Финальная кнопка | `Закрыть` |
| Card 1 заголовок | `Алфавит с нуля` |
| Card 2 заголовок | `Три стиля — один язык` |
| Card 3 заголовок | `Без заглавных букв` |
| Card 4 заголовок | `Загрузчик — это ქ` |

**Правила:** нет этнических акцентов, нет курсива, грузинские слова всегда с транслитерацией или контекстом при первом появлении.

---

## Адаптивность (375px)

- Jewel-tile карточка занимает полную ширину `mx-0 px-5` — на 375px влезает без скролла
- Глифы Card 1: `ა ბ გ` — 40px, 3 буквы, ок
- Глифы Card 2: `ასომთავრული ნუსხური მხედრული` — 18px, перенос по словам — ок
- Глиф Card 4: `ქ` — 80px одиночный символ — ок
- Mascot на Card 4: `size=80`, помещается под текстом — ок
- Кнопки навигации: min-height 44px, grid `grid-cols-2 gap-3` — ок
- Entry-кнопка в ModuleMap: высота ≥ 56px за счёт трёх строк контента — ок

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру (cream, jewelInk, navy, ruby, gold)
- [x] Типографика в рамках шкалы T1-T6 (22px = T2, 14px = T4, 12px = T5)
- [x] Содержит обучающий элемент (история письма + культурный контекст)
- [x] Описан reveal-момент (Card 4: LoaderLetter = ქ = ქართული)
- [x] Все состояния описаны (4 карточки + transition + final)
- [x] Работает на 375px
- [x] Не нарушает продуктовую философию (нет жизней, нет gate-keeping, открыто всем)
- [x] Статичный контент — нет зависимости от бэкенда
- [x] Tap targets ≥ 44px везде
