# История грузинского письма — культурная карточка в Алфавите

**Задача:** ROADMAP.md → задача #33
**Статус:** ready

---

## Обучающий элемент

Пользователи видят 33 грузинские буквы, но не знают, что за ними стоит полторы тысячи лет
истории. Четыре карточки меняют отношение к алфавиту: он перестаёт быть «набором закорючек»
и становится живым артефактом культуры.

| Карточка | Тема | Что учит |
|----------|------|----------|
| 1 | V век — древность | Алфавиту ~1600 лет; это один из старейших действующих |
| 2 | Три письма | мხედრули / ასომთавრули / ნუসхури — три стиля одного языка |
| 3 | Уникальность | Никак не связано с другими системами письма — нужно учить с нуля |
| 4 | Буква ქ — reveal | Та самая буква из загрузчика = первая буква ქართული |

**Reveal-момент:** Карточка 4 напрямую соединяет `LoaderLetter` (ქ) с языком: «Ты видел
эту букву каждый раз при открытии». Пользователь осознаёт, что обучение началось с самого
первого запуска. Эффект «старый знакомый» усиливает мотивацию продолжать алфавит.

---

## Экраны и состояния

### Экран 1: ModuleMap (Алфавит) — добавление кнопки

Изменение минимально: добавить кнопку «История алфавита» в тело экрана ModuleMap для
модулей с `moduleId === 'alphabet-progressive'` или `moduleId === 'alphabet'`.

**Расположение:** между `ModulePhraseBanner` и разделом «уроки».

```
[ Header ]
[ Overview card (jewel-tile) ]
[ ModulePhraseBanner ]
──────────────────── НОВОЕ ────────────────────
[ AlphabetHistoryButton ]
────────────────────────────────────────────────
[ mn-eyebrow: "уроки" ]
[ Journey path map ]
```

**AlphabetHistoryButton — внешний вид:**

```
┌──────────────────────────────────────────────┐  ← jewel-tile (cream bg)
│  ✦ [GeoGlyph: ასომThumb]  История алфавита  ›│
│     [11px muted]: «V в. · 3 письма · UNESCO»  │
└──────────────────────────────────────────────┘
```

- `jewel-tile` с `px-4 py-3`
- Левый декор: `GeoGlyph` или крупная georgian буква «ა» (18px, navy) в `w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center`
- Заголовок: `font-sans text-[15px] font-bold text-jewelInk` — T4
- Субтитр: `font-sans text-[11px] text-jewelInk-mid` — T6
- Стрелка «›»: `text-jewelInk-hint text-[18px] ml-auto shrink-0`
- Tap target: не менее 52px высоты (нативный `jewel-tile` + padding достигает этого)
- `mb-4` между кнопкой и разделом «уроки»

---

### Экран 2: AlphabetHistoryCarousel — полноэкранный оверлей

Открывается поверх ModuleMap. Паттерн аналогичен `RevealKaniOverlay`: `fixed inset-0 z-50`
с тёмным бэкдропом.

**Структура оверлея:**

```
┌─────────────────────────────────────────────────────┐
│ [8px gold kilim stripe — top]                       │
│                                                     │
│  [←] отмена                  [ • • • • ]  страница  │  ← Header bar
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ jewel-tile card — активная карточка           │  │
│  │ (swipe / tap зоны)                            │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  [ jewel-btn full width ]                           │  ← CTA / Next
│                                                     │
│ [8px gold kilim stripe — bottom]                    │
└─────────────────────────────────────────────────────┘
```

**Бэкдроп:** `rgba(21,16,10,0.72)` — темнее чем у RevealKaniOverlay (0.65), чтобы подчеркнуть
культурную «глубину».

**Размер карточки:** `max-w-[340px] w-[calc(100%-32px)] mx-auto bg-cream` — то же что
RevealKaniOverlay. Внутри: килим-страйпы 8px top/bottom (navy, не gold — отличительный цвет
для исторических карточек).

**Навигация:**
- Свайп влево/вправо (через `onTouchStart` + `onTouchEnd`, delta > 50px)
- Тап на правую половину карточки = вперёд
- Тап на левую половину = назад
- Дот-индикатор: 4 dots `w-2 h-2 rounded-full`, активный — `bg-navy w-3`, неактивные — `bg-jewelInk/25`
- На последней карточке (4): кнопка «Понятно!» (jewel-btn primary) вместо «Далее»
- Кнопка × (top-right) закрывает в любой момент

---

### Карточки (4 шт.)

#### Карточка 1 — «Один из древнейших»

```
┌──────────────────────────────────────────────────┐
│ [8px navy stripe]                                │
│                                                  │
│          V                                       │ ← roman numeral 80px navy
│       საუkუნე                                   │ ← 13px navy/70
│                                                  │
│  ──────────────────────  (gold hairline)         │
│                                                  │
│  [Stamp: «~430 н.э.»  tilt=right  ink]           │
│                                                  │
│  Один из древнейших                              │ ← T2 22px extrabold
│                                                  │
│  Грузинское письмо создано в V веке              │ ← T4 14px leading-snug
│  (~430 г. н.э.) — на полторы тысячи              │
│  лет старше русского. Один из ~14                │
│  алфавитов, который не изменился                 │
│  до наших дней.                                  │
│                                                  │
│ [8px navy stripe]                                │
└──────────────────────────────────────────────────┘
```

**Цвета:** navy as primary accent. «V» — `text-[80px] font-extrabold text-navy leading-none`.
«საუკუნე» (век) — `font-geo text-[13px] text-navy/70 tracking-wide` — T6.
Заголовок: `font-sans text-[22px] font-extrabold text-jewelInk` — T2.
Body: `font-sans text-[14px] text-jewelInk leading-snug` — T4/T5.

---

#### Карточка 2 — «Три письма»

```
┌──────────────────────────────────────────────────┐
│ [8px navy stripe]                                │
│                                                  │
│  ┌──────────────────────────────────────────┐    │ ← inner row of 3 mini jewel-tiles
│  │  ანბანი  │  ႠႬႡႠႬႨ  │  ⴀⴌⴁⴀⴌⴈ  │    │    (мхедрули/Асомтаврули/нусхури)
│  │  11px    │  11px       │  11px      │    │
│  └──────────────────────────────────────────┘    │
│   [caption 10px muted]: мхедрули / Асомтаврули / нусхури
│                                                  │
│  Три письма одного языка                        │ ← T2 22px
│                                                  │
│  Грузинский — единственный язык                  │ ← T4 14px
│  с тремя параллельными письмен-                  │
│  ностями. Все три — в наследии                   │
│  ЮНЕСКО с 2016 года.                             │
│                                                  │
│ [8px navy stripe]                                │
└──────────────────────────────────────────────────┘
```

**Три мини-тайла:**

Горизонтальный ряд из трёх блоков (равные колонки `flex-1`):
- `border border-jewelInk/20 rounded px-2 py-2 text-center`
- Грузинский текст: T5 (12px), `font-geo font-bold text-jewelInk`
- Название скрипта: T6 (10px), `text-jewelInk-mid`

Текст для трёх скриптов:
- мхедрули: `ანბანი`
- ასომთავრული: `ႠႬႡႠႬႨ`
- ნუსხური: показать три буквы `ⴀⴌⴁ` (если шрифт не поддерживает — fallback пустая ячейка с «…»)

> **Примечание разработчику:** Noto Sans Georgian поддерживает все три скрипта.
> Проверить рендер на мобильных устройствах. Если ნუსხური не отображается — заменить
> на курсивное `nanuskhari` или убрать третий тайл.

---

#### Карточка 3 — «Ни на что не похоже»

```
┌──────────────────────────────────────────────────┐
│ [8px navy stripe]                                │
│                                                  │
│         [декоративная сетка 3×3 букв]            │
│    ა გ ე / მ ნ ო / რ ს ტ                         │ ← 28px navy/40, равномерно
│                                                  │
│  ──────────────────────  (gold hairline)         │
│                                                  │
│  Ни на что не похоже                             │ ← T2 22px extrabold
│                                                  │
│  В мире ~40 живых алфавитов.                     │ ← T4 14px
│  Грузинский не похож ни на один                  │
│  из них — не латиница, не кирилли-               │
│  ца, не арабский. Его нельзя                     │
│  «угадать» — нужно выучить.                      │
│                                                  │
│  [jewel-tile mini: «ქართული დამwерлობა» 13px]   │
│  [subtext 11px: грузинское письмо]               │
│                                                  │
│ [8px navy stripe]                                │
└──────────────────────────────────────────────────┘
```

**Декоративная сетка:** `grid grid-cols-3 gap-2 text-[28px] font-geo text-navy/40 text-center`.
9 букв — разные, красивые, показывают «непохожесть». Не кликабельны.

**Мини-тайл внизу:**
```tsx
<div className="jewel-tile px-3 py-2 text-center w-full">
  <div className="font-geo text-[13px] font-bold text-jewelInk relative z-[1]">
    ქართული დამwერლობა
  </div>
  <div className="font-sans text-[11px] text-jewelInk-mid mt-0.5 relative z-[1]">
    грузинское письмо
  </div>
</div>
```

---

#### Карточка 4 — «Старый знакомый» (Reveal)

Эта карточка намеренно эхом повторяет дизайн `RevealKaniOverlay` — пользователь «узнаёт»
знакомый паттерн. Усиливает эффект reveal.

```
┌──────────────────────────────────────────────────┐
│ [8px gold stripe — не navy, gold! особый момент] │
│                                                  │
│           ქ                                      │ ← 96px navy, mn-loader-letter
│      ─────────────                               │ ← gold underline w-14 h-1
│                                                  │
│  [Bombora mascot mood=cheer 56px]                │
│                                                  │
│  [Stamp: «ძველი მეგობარი» tilt=left ink]         │
│                                                  │
│  Старый знакомый!                                │ ← T2 22px extrabold
│                                                  │
│  Эта буква встречала тебя каждый                 │ ← T4 14px
│  раз при загрузке приложения.                    │
│  Теперь ты знаешь: это ქ —                       │
│  первая буква слова                              │
│                                                  │
│  ┌────────────────────────────────────────┐      │ ← jewel-tile
│  │  ქართული — грузинский язык             │      │
│  └────────────────────────────────────────┘      │
│                                                  │
│ [8px gold stripe]                                │
└──────────────────────────────────────────────────┘
```

**Отличия карточки 4 от остальных:**
- Килим-страйпы: `gold` (не navy) — единственная карточка с gold-страйпами
- Буква ქ: `mn-loader-letter` класс (та же CSS-анимация «дыхания» что у LoaderLetter)
- Gold underline под буквой: `w-14 h-1 bg-gold rounded-full mx-auto mt-2`
- Bombora mascot: `<Mascot mood="cheer" size={56} />` — над штампом
- Штамп: `<Stamp color="ink" tilt="left" animate>ძველი მეგობარი</Stamp>`
- `tile-appear` анимация для jewel-tile мини (как в RevealKaniOverlay)

**Кнопка на карточке 4:** «Понятно!» (вместо «Далее» у карточек 1–3)

---

## Компоненты (новые)

### AlphabetHistoryButton

**Файл:** `src/Trale/miniapp-src/src/components/AlphabetHistoryButton.tsx`

```typescript
interface AlphabetHistoryButtonProps {
  onClick: () => void
}
```

- Рендерит jewel-tile с иконкой-буквой, заголовком, субтитром и стрелкой
- Без внутреннего состояния — чистый presentation component

---

### AlphabetHistoryCarousel

**Файл:** `src/Trale/miniapp-src/src/components/AlphabetHistoryCarousel.tsx`

```typescript
interface AlphabetHistoryCarouselProps {
  onClose: () => void
}

// Внутреннее состояние
const [cardIndex, setCardIndex] = useState(0)   // 0..3
const [closing, setClosing] = useState(false)
const [touchStartX, setTouchStartX] = useState<number | null>(null)
```

**Жесты:**
```typescript
function handleTouchStart(e: React.TouchEvent) {
  setTouchStartX(e.touches[0].clientX)
}
function handleTouchEnd(e: React.TouchEvent) {
  if (touchStartX === null) return
  const delta = e.changedTouches[0].clientX - touchStartX
  if (delta < -50 && cardIndex < 3) setCardIndex(cardIndex + 1)
  if (delta > 50  && cardIndex > 0) setCardIndex(cardIndex - 1)
  setTouchStartX(null)
}
```

**Tap-зоны на карточке (дополнительно к свайпу):**
```typescript
function handleCardTap(e: React.MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const midX = rect.left + rect.width / 2
  if (e.clientX > midX && cardIndex < 3) setCardIndex(cardIndex + 1)
  if (e.clientX < midX && cardIndex > 0) setCardIndex(cardIndex - 1)
}
```

**Props карточек (статичный массив внутри файла):**
```typescript
const HISTORY_CARDS: HistoryCard[] = [
  {
    id: 'ancient',
    stripeColor: 'navy',
    ...
  },
  {
    id: 'three-scripts',
    stripeColor: 'navy',
    ...
  },
  {
    id: 'unique',
    stripeColor: 'navy',
    ...
  },
  {
    id: 'kani-reveal',
    stripeColor: 'gold',
    isReveal: true,
    ...
  },
]
```

**Варианты:**
- `stripeColor: 'navy' | 'gold'` — цвет килим-страйпов карточки

---

## Копирайтинг

### Карточка 1 — «Один из древнейших»

**Декор:** «V» + «საუkუნე»

**Заголовок:** Один из древнейших

**Тело:**
> Грузинское письмо создано в V веке (~430 г. н.э.) — на полторы тысячи лет старше русского. Один из ~14 алфавитов мира, который не изменился до наших дней.

---

### Карточка 2 — «Три письма одного языка»

**Декор:** три мини-тайла со скриптами

**Заголовок:** Три письма одного языка

**Тело:**
> Грузинский — единственный язык с тремя параллельными письменностями. Все три — в наследии ЮНЕСКО с 2016 года.

**Мини-подписи под тайлами:**
- мхедрули (светское, современное)
- ასომTавrули (церковные заглавные)
- ნუсхури (церковный курсив)

---

### Карточка 3 — «Ни на что не похоже»

**Декор:** сетка 3×3 букв (ა გ ე / მ ნ ო / რ ს ტ)

**Заголовок:** Ни на что не похоже

**Тело:**
> В мире ~40 живых алфавитов. Грузинский не связан ни с одним из них — не латиница, не кириллица, не арабский. Его нельзя «угадать» через другой язык — нужно выучить с нуля.

**Мини-тайл:** «ქართული დამwერლობა» / «грузинское письмо»

---

### Карточка 4 — «Старый знакомый»

**Декор:** буква ქ с дыханием + Bombora + штамп «ძველი მეგობარი»

**Заголовок:** Старый знакомый!

**Тело:**
> Эта буква встречала тебя каждый раз при загрузке приложения. Теперь ты знаешь: это ქ — первая буква слова

**Мини-тайл:** «ქართული — грузинский язык»

**Кнопка:** «Понятно!»

---

## Интеграция в ModuleMap.tsx

### Изменения в ModuleMap.tsx

1. Добавить состояние: `const [showHistory, setShowHistory] = useState(false)`

2. Условный рендер кнопки (только для alphabet-модулей):
```tsx
{(moduleId === 'alphabet-progressive' || moduleId === 'alphabet') && (
  <AlphabetHistoryButton
    onClick={() => setShowHistory(true)}
    className="mb-4"
  />
)}
```

3. Рендер оверлея вне основного потока (в конце return):
```tsx
{showHistory && (
  <AlphabetHistoryCarousel onClose={() => setShowHistory(false)} />
)}
```

4. Добавить импорты: `AlphabetHistoryButton`, `AlphabetHistoryCarousel`

---

## Анимации

| Элемент | Анимация | Параметры |
|---------|----------|-----------|
| Открытие бэкдропа | `reveal-backdrop-in` (уже в index.css) | 250ms ease |
| Закрытие бэкдропа | `reveal-backdrop-out` (уже в index.css) | 220ms ease |
| Появление карточки | `reveal-card-in` (уже в index.css) | 320ms ease-out |
| Закрытие карточки | `reveal-card-out` (уже в index.css) | 220ms ease-in |
| Смена карточки | горизонтальный слайд (новый, см. ниже) | 220ms ease |
| Буква ქ на карточке 4 | `mn-loader-letter` (уже в index.css) | breathing |
| Штамп на карточке 4 | `animate` prop существующего Stamp | 300ms pop |
| Мини-тайл на карточке 4 | `tile-appear` (уже в index.css, delay 350ms) | 250ms ease |

**Новая анимация смены карточки для index.css:**

```css
@keyframes mn-slide-out-left {
  from { transform: translateX(0); opacity: 1; }
  to   { transform: translateX(-32px); opacity: 0; }
}
@keyframes mn-slide-in-right {
  from { transform: translateX(32px); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}
@keyframes mn-slide-out-right {
  from { transform: translateX(0); opacity: 1; }
  to   { transform: translateX(32px); opacity: 0; }
}
@keyframes mn-slide-in-left {
  from { transform: translateX(-32px); opacity: 0; }
  to   { transform: translateX(0); opacity: 1; }
}
.mn-slide-out-left  { animation: mn-slide-out-left  220ms ease both; }
.mn-slide-in-right  { animation: mn-slide-in-right  220ms ease both; }
.mn-slide-out-right { animation: mn-slide-out-right 220ms ease both; }
.mn-slide-in-left   { animation: mn-slide-in-left   220ms ease both; }
```

Для смены карточки: старая уходит за 220ms, новая появляется с задержкой 200ms — минимальный
overlap для плавности.

---

## Адаптивность (375px)

- Карточка: `max-w-[340px] w-[calc(100%-32px)]` — на 375px → ширина 343px.
  С padding `px-5` контент: 343 - 40 = 303px. Достаточно для всех текстов.

- Карточка 1: буква «V» 80px — 80px width. Под ней «საუkუნე» 13px ~90px.
  Вертикальный стек, центрирован.

- Карточка 2: три мини-тайла `flex gap-2` → каждый ≈ (303-16)/3 = 96px.
  Текст «ანბანი» при 12px шрифте ≈ 45px — влезает. Подписи 10px ≈ 60px — влезают.

- Карточка 3: декоративная сетка 3×3 при 28px font-size: каждая ячейка `w-1/3`.
  На 303px → 101px на ячейку. Грузинская буква 28px — центрируется.

- Карточка 4: буква ქ 96px, mascot 56px, stamp, заголовок. Суммарная высота ≈ 380px.
  Карточка должна вписаться в экран 667px (iPhone SE). `overflow-y-auto` как safety.

- Кнопки: `jewel-btn` по умолчанию `h-[52px]` — >= 44px tap target выполнен.
- Дот-индикатор: tap target не нужен (декоративный).
- Кнопка × (закрыть): `w-10 h-10 -mr-2` — 40×40px.

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру: navy для акцентов карточек 1–3, gold для карточки 4 и подчёркиваний
- [x] Типографика в рамках шкалы T1-T6: T2 (22px) заголовки, T4 (14px) тело, T5 (13px) метки, T6 (10–11px) субтитры
- [x] Содержит обучающий элемент: история письма + three scripts + uniqueness + reveal ქ
- [x] Описан reveal-момент: карточка 4 соединяет LoaderLetter с языком ქართული
- [x] Все состояния описаны: default (карточки 1–3), reveal (карточка 4), закрытие
- [x] Работает на 375px: проверены размеры всех карточек
- [x] Не нарушает продуктовую философию: контент опциональный, не блокирует прохождение уроков
- [x] Один акцент на смысл: navy = история/информация, gold = reveal-момент (только карточка 4)
- [x] Без бэкенда: всё статично, никаких API-вызовов
- [x] Переиспользует существующие анимации (reveal-backdrop, reveal-card, tile-appear, mn-loader-letter)
- [x] Кнопка в ModuleMap условно рендерится только для alphabet-модулей
