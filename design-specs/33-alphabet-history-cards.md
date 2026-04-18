# История грузинского письма — культурная карточка в Алфавите

**Задача:** ROADMAP.md → задача #33
**Статус:** ready

---

## Обучающий элемент

**Что учит:** 4 факт-карточки показывают контекст грузинского алфавита — возраст, три стиля письма, мировую уникальность, связь с буквой ქ из загрузчика. Культурный контекст превращает набор символов в живую историю — мотивирует учить не «по обязанности», а из любопытства.

**Паттерн:** Пользователь открывает модуль Алфавит и видит необычную кнопку «История письма» → входит в карусель → 4 карточки по тапу → выходит обратно в модуль. Весь путь занимает 60–90 секунд.

**Что показываем на грузинском:**
1. Слово «ანბანი» (алфавит) крупно на первой карточке
2. Букву ბ в трёх стилях письма — ასომთავრული / ნუსხური / მხედრული
3. Слово «მხედრული» (современное письмо) на карточке уникальности
4. Букву ქ с анимацией лоадера на последней карточке

**Reveal-момент:** Карточка 4 явно связывает лоадер-букву ქ с грузинским словом ქართული. Это дополнительный контекстуальный якорь — параллельный, но более мягкий, чем RevealKaniOverlay (который срабатывает прямо в уроке). Здесь пользователь сам выбирает момент знакомства.

**Дофамин:** прокрутка карточек создаёт ощущение «подглядывания в историю». Финальная кнопка «Начну учить» — мотивационный call-to-action с грузинским словом.

---

## Точка входа

**Где:** ModuleMap.tsx — только для модуля `alphabet-progressive`.

**Layout в ModuleMap:**
```
[ kilim-strip ]
[ Header ]
[ Overview jewel-tile: прогресс + KilimProgress ]
↓↓↓ НОВЫЙ ЭЛЕМЕНТ ↓↓↓
[ AlphabetHistoryTile — compact jewel-tile ]
↑↑↑ НОВЫЙ ЭЛЕМЕНТ ↑↑↑
[ ModulePhraseBanner ]
[ mn-eyebrow: «уроки» ]
[ Journey path map ]
```

**AlphabetHistoryTile (compact):**
```
┌─────────────────────────────────────────────┐
│  [ ასომთავრული ]                 [ → ]      │  ← font-geo 14px, jewelInk/50 + arrow
│  История грузинского письма                  │  ← font-sans 15px font-extrabold jewelInk
│  4 карточки · 1 минута                      │  ← mn-eyebrow, jewelInk-hint
└─────────────────────────────────────────────┘
```

- Стиль: `jewel-tile` (1.5px border + 3px shadow)
- Padding: `px-4 py-3`
- Стрелка справа: `→`, font-sans 18px, font-bold, navy
- Margin bottom: `mb-5`
- При тапе: открывает `AlphabetHistoryOverlay`
- Притапливание: `translate(2px, 2px)`, shadow убирается на 75ms

**Условие показа:** только если `moduleId === 'alphabet-progressive'`. Показывается всегда (не зависит от прогресса).

---

## Экраны и состояния

### Оверлей: AlphabetHistoryOverlay

**Тип:** full-screen overlay поверх ModuleMap. Реализация аналогична RevealKaniOverlay (fixed inset-0 z-50).

**Backdrop:** `bg-jewelInk/70`, без тапа-закрытия (пользователь должен пройти карточки или нажать ×).

**Структура оверлея:**
```
fixed inset-0 z-50 flex flex-col bg-cream
├── [ kilim-strip top — 8px gold ]
├── [ top-bar ]
│    ├── [ × кнопка ] ← left, 44×44px, tap → закрыть
│    ├── [ dots indicator ] ← center, 4 точки
│    └── [ N / 4 ] ← right, mn-eyebrow
├── [ Carousel area — flex-1, overflow-hidden ]
│    └── [ 4 HistoryCard, translateX-анимация ]
├── [ bottom-bar ]
│    ├── [ Назад ] ← secondary btn (карточки 2-4)
│    └── [ Далее → / Начну учить ] ← primary btn
└── [ kilim-strip bottom — 8px gold ]
```

**Навигация:** только кнопки «Назад» / «Далее», без свайпа (для надёжности на всех устройствах). Swipe-поддержку можно добавить позже.

---

### Карточка 1: «Рождение алфавита»

**Контент:**

```
[ mn-eyebrow: «карточка 1 из 4» ]

[ БОЛЬШАЯ БУКВА ]
  ა
  [ gold underline 48px wide ]

[ Headline T2 ]
  V век нашей эры

[ Body T4 ]
  Грузинский алфавит создан около 430 года н.э. —
  один из старейших в мире. С первых дней использовался
  для записи молитв, законов и поэзии.

[ jewel-tile mini: обучающий факт ]
  [ mn-eyebrow: «по-грузински» ]
  ანბანი
  [ mn-eyebrow: «алфавит» ]

[ Bombora mood=cheer, size=80 ] ← справа внизу, absolute
```

**Layout:**
- BG: cream
- Буква ა: `font-geo text-[96px] font-extrabold text-navy leading-none`
- Gold underline: `w-12 h-1 bg-gold rounded-full mx-auto mt-2 mb-4`
- Headline: `font-sans text-[22px] font-extrabold text-jewelInk`
- Body: `font-sans text-[15px] text-jewelInk-soft leading-[1.65]`
- Mini-tile: `jewel-tile px-4 py-3`, буква `font-geo text-[20px] font-bold text-navy`
- Бомбора: `absolute bottom-0 right-0`, без блокировки текста (right-0 = за пределами контентного потока)

---

### Карточка 2: «Три стиля письма»

**Контент:**

```
[ mn-eyebrow: «карточка 2 из 4» ]

[ Headline T2 ]
  Три облика одной буквы

[ Body T4 ]
  За 16 веков грузинское письмо развило три стиля.
  Сегодня используется мхедрули — «воинское письмо».

[ Таблица трёх стилей — 3 jewel-tile в ряд ]
  ┌──────┐  ┌──────┐  ┌──────┐
  │  Ⴁ  │  │  ბ  │  │  ბ  │
  │ ასომ │  │ ნუს  │  │ მხედ │
  └──────┘  └──────┘  └──────┘
  асомтав-   нусхури   мхедру-
  рули                  ли
  (V в.)    (IX в.)   (XI в.)

[ mn-eyebrow-hint под таблицей ]
  мхедрули — то, что ты учишь сейчас

[ Bombora mood=think, size=64 ] ← под hint, centered
```

**Layout таблицы:**
- 3 колонки `flex gap-3`, каждый `flex-1`
- Каждая ячейка: `jewel-tile px-2 py-3 flex flex-col items-center`
- Буква в ячейке: `font-geo text-[28px] font-extrabold text-jewelInk leading-none`
- Название стиля: `font-geo text-[10px] text-jewelInk/70 mt-1 text-center leading-tight`
- Дата: `mn-eyebrow text-jewelInk-hint mt-0.5`

**Примечание по асомтаврули:** буква ასომთავრული (`Ⴁ`, Unicode U+10D1 в регистре Mkhedruli заглавное или U+10C1 в Asomtavruli) — нужно использовать `font-family: 'Noto Sans Georgian'` и Unicode `Ⴁ` (U+10C1). Если рендеринг недоступен — заменить на описание «[ასომ]». Developer должен проверить шрифтовую поддержку.

**Адаптив 375px:** три ячейки шириной ~(343-24)/3 ≈ 106px — буква 28px помещается.

---

### Карточка 3: «Один из 14 в мире»

**Контент:**

```
[ mn-eyebrow: «карточка 3 из 4» ]

[ Headline T2 ]
  Один из 14 в мире

[ Body T4 ]
  В мире существует только 14 алфавитов с полностью
  оригинальными буквами. Ни одна из 33 грузинских букв
  не заимствована у других систем письма.

[ jewel-tile: визуальный акцент ]
  [ gold-badge центр ]
    14
    [ mn-eyebrow: «оригинальных алфавитов» ]

[ Body T4 mt-3 ]
  Кириллица и латиница возникли на основе греческого.
  Грузинский — создан независимо.

[ jewel-tile mini: обучающий факт ]
  [ mn-eyebrow: «по-грузински» ]
  მხედრული
  [ mn-eyebrow: «воинское письмо» ]

[ Bombora mood=happy, size=64 ] ← inline, center
```

**Layout gold-badge:**
- `w-20 h-20 rounded-full bg-gold border-[1.5px] border-jewelInk flex flex-col items-center justify-center mx-auto mb-3`
- Число «14»: `font-sans text-[32px] font-extrabold text-jewelInk leading-none`
- Подпись: `mn-eyebrow text-jewelInk/70 text-center px-2 leading-tight`

---

### Карточка 4: «Буква, которую ты уже видел»

**Контент:**

```
[ mn-eyebrow: «карточка 4 из 4» ]

[ Animated ქ letter — same as LoaderLetter, size=96px, navy ]
[ gold underline ]

[ Headline T2 ]
  Ты её уже знаешь

[ Body T4 ]
  Буква ქ («кани») — первая буква слова
  ქართული — «грузинский язык».

[ jewel-tile ]
  ქართული
  [ mn-eyebrow: грузинский язык ]

[ Body T5 text-jewelInk-mid mt-2 ]
  Именно её ты видел при каждой загрузке.

[ Stamp (animate) ]
  ძველი მეგობარი

[ CTA Button primary: «Начну учить!» ]
  [ mn-eyebrow под кнопкой ]
  ვისწავლი  ← (я буду учить)

[ Bombora mood=cheer, size=72 ] ← под Stamp, centered
```

**Анимация буквы ქ:** применить класс `mn-loader-letter` (как в RevealKaniOverlay) — то же дыхание. Это визуально связывает карточку с лоадером без повторного объяснения.

**CTA «Начну учить!»:** нажатие закрывает оверлей (не пишет в localStorage — карусель можно открывать повторно).

**Грузинская подпись под кнопкой:** `font-geo text-[11px] text-jewelInk/50 text-center mt-1`

---

### Компоненты (новые)

#### `AlphabetHistoryOverlay`

**Назначение:** full-screen carousel с 4 историческими карточками.

**Props:**
```typescript
interface AlphabetHistoryOverlayProps {
  onClose: () => void
}
```

**State:**
```typescript
const [cardIndex, setCardIndex] = useState(0)   // 0..3
const [closing, setClosing] = useState(false)
```

**Переходы между карточками:**
- `translateX` с `transition: transform 250ms ease-out`
- Карточки рендерятся в одном flex-контейнере, который сдвигается
- Нет swipe-жестов в MVP (только кнопки)

**Файл:** `src/Trale/miniapp-src/src/components/AlphabetHistoryOverlay.tsx`

**Анимации:**
| Событие | Анимация |
|---------|----------|
| Открытие | backdrop-in 250ms (аналог RevealKaniOverlay) |
| Закрытие | backdrop-out 200ms |
| Переход к следующей карточке | translateX(-100%) 250ms ease-out |
| Переход к предыдущей | translateX(+100%) 250ms ease-out |

#### `AlphabetHistoryTile` (или inline в ModuleMap)

**Назначение:** compact entry-point плитка в ModuleMap.

**Props:**
```typescript
interface AlphabetHistoryTileProps {
  onOpen: () => void
}
```

Альтернатива: реализовать inline прямо в ModuleMap без выделения в компонент (так как используется единожды). Решение за Developer.

---

## Dots-индикатор

4 точки горизонтально, centered:
- Активная: `w-3 h-3 rounded-full bg-navy`
- Неактивная: `w-2 h-2 rounded-full bg-jewelInk/20`
- Gap: `gap-2`
- Transition active: `w 150ms ease, bg 150ms ease`

---

## Кнопки навигации

**Bottom bar:**

| Карточка | Кнопка «слева» | Кнопка «справа» |
|----------|----------------|-----------------|
| 0 (первая) | — (скрыта) | `Далее →` primary |
| 1, 2 | `← Назад` secondary | `Далее →` primary |
| 3 (последняя) | `← Назад` secondary | `Начну учить!` primary |

- Primary btn: `jewel-btn`, full fill, navy фон
- Secondary btn: `jewel-btn` variant=secondary, cream фон, ink border
- Высота кнопок: 52px (стандарт jewel-btn)

**«× Закрыть»** — top-left, всегда виден:
- `44×44px`, icon `×` font-sans text-[20px], tap → close overlay

---

## Копирайтинг

| Элемент | Текст |
|---------|-------|
| Плитка entry-point: eyebrow | `ასომთავრული` |
| Плитка entry-point: headline | `История грузинского письма` |
| Плитка entry-point: hint | `4 карточки · 1 минута` |
| Карточка 1: headline | `V век нашей эры` |
| Карточка 1: грузинское слово | `ანბანი` |
| Карточка 1: перевод | `алфавит` |
| Карточка 2: headline | `Три облика одной буквы` |
| Карточка 2: hint | `мхедрули — то, что ты учишь сейчас` |
| Карточка 3: headline | `Один из 14 в мире` |
| Карточка 3: badge | `14` |
| Карточка 3: badge sub | `оригинальных алфавитов` |
| Карточка 3: грузинское слово | `მხედრული` |
| Карточка 3: перевод | `воинское письмо` |
| Карточка 4: headline | `Ты её уже знаешь` |
| Карточка 4: грузинское слово | `ქართული` |
| Карточка 4: перевод | `грузинский язык` |
| Карточка 4: stamp | `ძველი მეგობარი` |
| CTA кнопка | `Начну учить!` |
| CTA sub (georgian) | `ვისწავლი` |

---

## Адаптивность (375px)

**Оверлей:** `fixed inset-0` — занимает весь экран. Нет горизонтального overflow.

**Контентная область карточек:** `px-5` = 15px отступы. Доступная ширина: 375-30 = 345px.

**Таблица трёх стилей на 375px:**
- 3 ячейки × (345-16)/3 ≈ 110px, gap 8px → реально ≈ 107px на ячейку
- Буква 28px в ячейке 107px — помещается с запасом

**Крупные буквы:** ა на 96px — укладывается в 345px горизонтально (однострочно).

**Bottom bar кнопки:** на 375px при двух кнопках — `gap-3`, каждая кнопка `flex-1`. При одной кнопке — `w-full`. Tap targets: 52px высота.

**Bombora:** размеры 64-80px, `absolute` или inline, не перекрывает читаемый текст.

---

## Интеграция в ModuleMap.tsx

**Что меняется:**

1. Добавить `import AlphabetHistoryOverlay from '../components/AlphabetHistoryOverlay'`

2. Добавить state: `const [showHistory, setShowHistory] = useState(false)`

3. В JSX после `{/* Overview card */}` блока и перед `<ModulePhraseBanner>`, условно для `alphabet-progressive`:

```tsx
{moduleId === 'alphabet-progressive' && (
  <button
    className="jewel-tile px-4 py-3 mb-5 w-full text-left active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all duration-75"
    onClick={() => setShowHistory(true)}
  >
    <div className="relative z-[1] flex items-center justify-between">
      <div>
        <div className="font-geo text-[14px] text-jewelInk/50 mb-0.5">ასომთავრული</div>
        <div className="font-sans text-[15px] font-extrabold text-jewelInk">
          История грузинского письма
        </div>
        <div className="mn-eyebrow mt-0.5">4 карточки · 1 минута</div>
      </div>
      <span className="font-sans text-[18px] font-bold text-navy ml-3">→</span>
    </div>
  </button>
)}
```

4. В конце JSX (перед закрывающим тегом главного div):

```tsx
{showHistory && (
  <AlphabetHistoryOverlay onClose={() => setShowHistory(false)} />
)}
```

**Новые файлы:**
- `src/Trale/miniapp-src/src/components/AlphabetHistoryOverlay.tsx`

**Существующие компоненты для переиспользования:**
- `Mascot.tsx` — в карточках (moods: cheer, think, happy)
- `Stamp.tsx` — финальный штамп ძველი მეგობარი
- `Button.tsx` — навигационные кнопки
- Класс `mn-loader-letter` из index.css — анимированная буква ქ на карточке 4
- Класс `jewel-tile` — карточки entry-point и мини-тайлы внутри

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру: cream фон, jewelInk текст, navy акцент, gold подчёркивания и badge
- [x] Типографика в рамках T2-T5: headline 22px, body 15px, secondary 13px, eyebrow 11px
- [x] Содержит обучающий элемент: ანბანი, три стиля ბ, მხედრული, буква ქ как ვისწავლი-момент
- [x] Описан reveal-момент: карточка 4 соединяет лоадер-букву ქ с ქართული (менее интенсивно, чем RevealKaniOverlay, — без single-fire флага)
- [x] Все состояния описаны: entry-tile, carousel (4 карточки), открытие/закрытие
- [x] Работает на 375px: fixed overlay занимает весь экран, таблица стилей укладывается
- [x] Tap targets ≥ 44px: nav-кнопки 52px, close ×44px, entry-tile минимум 56px высотой
- [x] Не нарушает продуктовую философию: нет гейтинга, нет принудительного показа, пользователь сам открывает карусель
- [x] Один акцент на элемент: navy для активных интерактивов, gold для highlights
- [x] Без бэкенда: весь контент статичный, карусель можно открывать повторно
- [x] Bombora появляется в уместных местах с правильными moods (cheer/think/happy)
