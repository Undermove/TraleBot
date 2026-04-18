# История грузинского письма — культурная карусель в Алфавите

**Задача:** ROADMAP.md → задача #33
**Статус:** ready

---

## Обучающий элемент

Пользователь учит буквы, но не знает, что за ними стоит 1500-летняя история. Четыре карточки превращают технический навык (выучить символы) в эмоциональный опыт: «я изучаю одну из древнейших письменностей мира».

**Что именно учит грузинскому:**
- Карточка 1: V век — дата и контекст создания (`V საუკუნე` — «пятый век»)
- Карточка 2: Три стиля — пользователь видит *ту же букву* в трёх исторических системах, понимает что учит **მხედრული** (mkhedruli — «всадническое письмо»)
- Карточка 3: Уникальность — алфавит не заимствован, создан специально для грузинского языка
- Карточка 4: Reveal — буква ქ из лоадера = первая буква ქართული («грузинский»)

**Reveal-момент:** Карточка 4 замыкает петлю с компонентом `LoaderLetter`: пользователь вдруг понимает, что эту букву видел сотни раз при загрузке, и что она означает «грузинский язык». Тот же момент, что в задаче #24, но здесь — в контексте истории, не одиночного урока. Двойной инсайт усиливается.

**Дофамин:** Удивление («алфавиту 1500 лет!») + узнавание («эта буква была перед глазами всё время!»).

---

## Экраны и состояния

### Точка входа: ModuleMap (изменение)

В экране `ModuleMap.tsx`, **только когда `moduleId === 'alphabet-progressive'` или `moduleId === 'alphabet'`**, добавляется кнопка-плашка после overview-карточки и до `<ModulePhraseBanner />`.

**Новый layout в ModuleMap (только для Алфавита):**
```
[ Overview card (jewel-tile, существующая) ]
[ ── mt-4 ── ]
[ AlphabetHistoryButton  ← НОВЫЙ элемент ]
[ ── mt-2 ── ]
[ ModulePhraseBanner ]
[ ── mt-4 ── ]
[ уроки ... ]
```

**Компонент AlphabetHistoryButton — внешний вид:**

```
╔═══════════════════════════════════════════════╗
║  📜  История алфавита                     ›  ║   ← jewel-tile, pressable
║      V саукуне — три стиля — ქართული         ║
╚═══════════════════════════════════════════════╝
```

- `jewel-tile jewel-pressable` — cream фон, ink border 1.5px, 3px offset shadow
- `px-4 py-3` с `flex items-center gap-3`
- Иконка слева: Georgian буква **ა** в `w-10 h-10` круге navy-filled — navbar icon style
  - `rounded-full bg-navy flex items-center justify-center shrink-0`
  - Буква: `font-geo text-[20px] font-bold text-cream`
- Текст блок:
  - Заголовок: `font-sans text-[15px] font-bold text-jewelInk` — «История алфавита»
  - Subtitle: `font-sans text-[11px] text-jewelInk-mid mt-0.5` — «V в. · три стиля · ქართული»
- Стрелка справа: `›` `text-jewelInk/40 text-[18px] ml-auto shrink-0`
- При нажатии: `navigate({ kind: 'alphabet-history' })`
- tap target: вся плашка, `min-h-[56px]`

---

### Новый экран: AlphabetHistoryScreen

**Навигация:** добавить `{ kind: 'alphabet-history' }` в `types.ts` и обработчик в `App.tsx`.

**Layout всего экрана:**

```
┌──────────────────────────────────────────┐
│  [ Килим-страйп 8px top ]                │  ← стандарт для всех экранов
│                                          │
│  [ ← Назад ]   «История алфавита»        │  ← Header (back → module/dashboard)
│                                          │
│  ┌────────────────────────────────────┐  │
│  │   КАРТОЧКА (jewel-tile)            │  │  ← flex-1, центрирована вертикально
│  │   (меняется при свайпе/тапе)       │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [ ● ○ ○ ○ ]   dots indicator           │  ← 4 точки, текущая gold
│                                          │
│  [ ← Предыдущая ]  [ Следующая / Готово → ]  ← jewel-btn
│                                          │
│  [ Килим-страйп 8px bottom ]             │
└──────────────────────────────────────────┘
```

**Параметры экрана:**
- Фон: `bg-cream`
- Карточка: `jewel-tile`, `mx-5`, `flex-1 flex flex-col`
- Переход между карточками: горизонтальный slide `translateX` 240ms ease-out (влево при Next, вправо при Back)
- Карточка занимает максимум доступного пространства между Header и controls, с `max-h-[520px]`

---

### Карточка 1: «V საუკუნე» — Рождение

```
┌──────────────────────────────────────────┐
│  [ kilim gold stripe 8px top ]           │
│                                          │
│  [ Бомбора mood=cheer, 64px ]            │
│                                          │
│  V საუკუნე                               │  ← T2, 24px, font-geo+sans, navy
│  Пятый век                               │  ← T6, 11px, jewelInk/60
│                                          │
│  ─────────── (gold hairline) ───────── │
│                                          │
│  Грузинский алфавит создан              │  ← T5, 14px, jewelInk
│  в V веке нашей эры.                    │
│  Это один из двадцати шести             │
│  письменностей мира, признанных         │
│  ЮНЕСКО объектом нематериального        │
│  культурного наследия.                  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  1 из 4  ·  «С чего всё началось» │  │  ← T6, 10px, jewelInk/40, centered
│  └────────────────────────────────────┘  │
│  [ kilim gold stripe 8px bottom ]        │
└──────────────────────────────────────────┘
```

**Детали:**
- Цифра «V» — крупный акцент: `font-sans text-[60px] font-extrabold text-navy leading-none`
- Под «V»: `font-geo text-[18px] font-bold text-navy mt-0` — «საუკუნე»
- Под заголовком: `font-sans text-[11px] text-jewelInk/60` — «Пятый век»
- Бомбора: `<Mascot mood="cheer" size={64} />`
- Разделитель: `h-px bg-gold/60 my-3 mx-4`
- Body: `font-sans text-[14px] text-jewelInk leading-relaxed px-4`

---

### Карточка 2: «სამი სახე» — Три стиля

```
┌──────────────────────────────────────────┐
│  [ kilim gold stripe 8px top ]           │
│                                          │
│  [ Бомбора mood=guide, 64px ]            │
│                                          │
│  სამი სახე                               │  ← T2, 24px, navy
│  Три лица алфавита                       │  ← T6, 11px, jewelInk/60
│                                          │
│  ─────────────────────────────────────   │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │  მხედრული    — «всадническое»       │ │  ← стиль, который ты учишь
│  │  [ა ბ გ]   modern · стандарт сегодня│ │    navy accent
│  ├─────────────────────────────────────┤ │
│  │  Ⴀ Ⴁ Ⴂ  ასომთავრული — «заглавное» │ │  ← церковные капители
│  │            средневековье · декор    │ │    gold accent
│  ├─────────────────────────────────────┤ │
│  │  ა ბ გ  ნუსხური — «рукописное»     │ │  ← средневековый курсив церкви
│  │            XII–XIX вв. · рукописи   │ │    jewelInk/60
│  └─────────────────────────────────────┘ │
│                                          │
│  Ты учишь მხედრული —                    │  ← T5, 13px, jewleInk
│  именно им написаны все                 │
│  грузинские тексты сегодня.             │
│                                          │
│  [ kilim gold stripe 8px bottom ]        │
└──────────────────────────────────────────┘
```

**Детали таблицы стилей:**
- Wrapper: `jewel-tile mx-4 overflow-hidden` (без своего padding — делим на строки)
- Каждая строка: `px-4 py-2.5 border-b border-jewelInk/10 last:border-0`
- Первая строка (მხედრული): `bg-navy/5` — лёгкий highlight (это тот стиль, что учат)
- Грузинские буквы в таблице: `font-geo text-[18px] font-bold`
- Название стиля: `font-sans text-[11px] font-bold uppercase tracking-wide`
- Описание: `font-sans text-[10px] text-jewelInk/60`
- Акцент первой строки: `text-navy`
- Второй строки: `text-gold-deep` (нет, не gold-deep — используем `text-jewelInk`)
- Третьей строки: `text-jewelInk/60`

---

### Карточка 3: «Уникальность» — Отдельный мир

```
┌──────────────────────────────────────────┐
│  [ kilim gold stripe 8px top ]           │
│                                          │
│  [ Бомбора mood=think, 64px ]            │
│                                          │
│  ✦ Отдельный мир ✦                      │  ← gold star как декор (svg-звёздочки)
│                                          │
│  ─────────────────────────────────────   │
│                                          │
│  В мире около 40 активно               │  ← T5, 14px
│  используемых письменностей.            │
│  Грузинская — среди немногих,           │
│  у которых нет общего предка            │
│  с другими алфавитами.                  │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  ქართული                        │    │  ← jewel-tile mini, navy bg
│  │  Грузинский — единственный       │    │     cream text
│  │  официальный язык с              │    │
│  │  собственной уникальной          │    │
│  │  письменностью в регионе.        │    │
│  └──────────────────────────────────┘    │
│                                          │
│  [ kilim gold stripe 8px bottom ]        │
└──────────────────────────────────────────┘
```

**Детали:**
- «Отдельный мир»: `font-sans text-[20px] font-extrabold text-jewelInk leading-tight text-center`
- Gold звёздочки (`✦`): SVG или unicode, `text-gold text-[16px]`, по одной слева и справа
- Мини-плитка (navy): аналог мини-плитки из RevealKaniOverlay
  - `jewel-tile px-4 py-3 mx-4 text-center` со стилем `background: '#1B5FB0'` (navy)
  - Georgian: `font-geo text-[16px] font-bold text-cream`
  - Text: `font-sans text-[12px] text-cream/90 mt-1 leading-snug`

---

### Карточка 4: «Старый знакомый» — Reveal ქ

```
┌──────────────────────────────────────────┐
│  [ kilim gold stripe 8px top ]           │
│                                          │
│  [ Бомбора mood=happy, 64px ]            │
│                                          │
│  Ты уже знал её!                        │  ← T2, 22px, jewelInk
│                                          │
│  ─────────────────────────────────────   │
│                                          │
│   [ ქ  —  анимированная, navy, 80px ]   │  ← mn-loader-letter (та же анимация)
│   [ ─── gold underline 48px ─── ]       │  ← bg-gold h-1 rounded-full
│                                          │
│  Эта буква встречала тебя               │  ← T5, 13px, jewelInk
│  при каждом открытии.                   │
│  Теперь ты знаешь: ქ — «кани»,         │
│  первая буква слова                     │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  ქართული                          │  │  ← jewel-tile mini, cream bg
│  │  грузинский язык                   │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [ Stamp: ძველი მეგობარი, rotate-sm ]   │  ← существующий Stamp компонент
│                                          │
│  [ kilim gold stripe 8px bottom ]        │
└──────────────────────────────────────────┘
```

**Детали:**
- Заголовок «Ты уже знал её!»: `font-sans text-[22px] font-extrabold text-jewelInk text-center`
- Буква ქ: `font-geo text-[80px] font-bold text-navy leading-none`, класс `mn-loader-letter` (из `LoaderLetter.tsx`) — та же дышащая анимация пульсации
- Gold underline: `w-12 h-1 bg-gold rounded-full mx-auto mt-2 mb-4`
- Мини-плитка: `jewel-tile px-4 py-3 text-center mx-4`
  - Georgian: `font-geo text-[20px] font-bold text-jewelInk`
  - Перевод: `font-sans text-[11px] text-jewelInk/60 mt-1`
- Stamp: `<Stamp text="ძველი მეგობარი" tilt="left" animate />` — появляется с delay 300ms

---

### Компонент: Dots Indicator

Четыре точки под карточкой, над кнопками.

```
[ ●  ○  ○  ○ ]   ← для карточки 1
[ ○  ●  ○  ○ ]   ← для карточки 2
```

- Активная точка: `w-3 h-3 rounded-full bg-gold`
- Неактивная: `w-2 h-2 rounded-full bg-jewelInk/20`
- Gap: `gap-2 flex items-center justify-center mt-4`
- Переход цвета: `transition-all duration-200`

---

### Навигационные кнопки

Под dots, выше kilim-stripe.

**Для карточки 1–3:**
```
[ ← Назад ]   [ Дальше → ]
```
- На карточке 1: кнопка «← Назад» скрыта (или `opacity-0 pointer-events-none`)
- `← Назад`: `jewel-btn jewel-btn-cream text-[14px] flex-1`
- `Дальше →`: `jewel-btn jewel-btn-navy text-[14px] flex-1`

**Для карточки 4:**
```
[ ← Назад ]   [ Готово ✓ ]
```
- `Готово ✓`: `jewel-btn jewel-btn-navy` с текстом «Готово» — возвращает на module screen

**Layout кнопок:**
- `flex gap-3 px-5 pb-4` (где pb-4 + safe-area)
- Обе кнопки `flex-1`

---

### Анимация переходов между карточками

| Действие | Анимация уходящей | Анимация входящей |
|----------|-------------------|-------------------|
| Дальше → | `translateX(-100%) opacity(0)` | `translateX(100%) → translateX(0) opacity(1)` |
| ← Назад | `translateX(100%) opacity(0)` | `translateX(-100%) → translateX(0) opacity(1)` |
| Timing | 220ms ease-in | 220ms ease-out |

Реализация: один контейнер `overflow-hidden`, два `absolute` div с ключами; transition через CSS class swap.

```css
@keyframes card-slide-from-right {
  from { transform: translateX(100%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
@keyframes card-slide-from-left {
  from { transform: translateX(-100%); opacity: 0; }
  to   { transform: translateX(0);     opacity: 1; }
}
.card-enter-right { animation: card-slide-from-right 220ms ease-out both; }
.card-enter-left  { animation: card-slide-from-left  220ms ease-out both; }
```

---

### Состояния всего экрана

| Состояние | Описание |
|-----------|----------|
| **Default (card 1)** | Карточка 1 видна, Back-кнопка скрыта, dots: ● ○ ○ ○ |
| **Card 2** | slide-in from right, Back-кнопка появляется, dots: ○ ● ○ ○ |
| **Card 3** | slide-in from right, dots: ○ ○ ● ○ |
| **Card 4 (reveal)** | slide-in from right, stamp появляется 300ms после входа, кнопка «Готово» |
| **Back navigation** | slide-in from left на предыдущую карточку |
| **Exit (Готово)** | `navigate({ kind: 'module', moduleId })` |

---

## Новые компоненты и изменения в файлах

### Новый компонент: AlphabetHistoryButton

**Файл:** `src/Trale/miniapp-src/src/components/AlphabetHistoryButton.tsx`

```typescript
interface AlphabetHistoryButtonProps {
  onPress: () => void
}
```

Используется только в `ModuleMap.tsx` при `moduleId === 'alphabet-progressive' || moduleId === 'alphabet'`.

### Новый экран: AlphabetHistoryScreen

**Файл:** `src/Trale/miniapp-src/src/screens/AlphabetHistoryScreen.tsx`

```typescript
interface AlphabetHistoryScreenProps {
  moduleId: string   // для возврата назад
  navigate: (s: Screen) => void
}
```

Внутренний state: `const [card, setCard] = useState(0)` (0–3).

Данные карточек — статичный массив `HISTORY_CARDS` внутри файла, без внешних зависимостей.

### Изменения в существующих файлах

| Файл | Изменение |
|------|-----------|
| `src/types.ts` | Добавить `\| { kind: 'alphabet-history'; moduleId: string }` |
| `src/App.tsx` | Добавить case для `screen.kind === 'alphabet-history'` |
| `src/screens/ModuleMap.tsx` | Вставить `<AlphabetHistoryButton>` при alphabet-moduleId |
| `src/index.css` | Добавить `@keyframes card-slide-from-right/left` + классы |

---

## Статичный контент карточек

```typescript
// В AlphabetHistoryScreen.tsx
const HISTORY_CARDS = [
  {
    id: 1,
    label: 'V საუკუნე',
    labelRu: 'Пятый век',
    bombora: 'cheer',
    headline: null,           // заголовок — большое «V საუკუნე»
    body: 'Грузинский алфавит создан в V веке нашей эры. Это один из немногих алфавитов мира, признанных ЮНЕСКО частью нематериального культурного наследия.',
  },
  {
    id: 2,
    label: 'სამი სახე',
    labelRu: 'Три лица',
    bombora: 'guide',
    headline: null,
    body: 'Ты учишь მხედრული — именно им написаны все современные тексты.',
    styles: [
      { letters: 'ა ბ გ', name: 'მხედრული', desc: 'всадническое · стандарт', accent: 'navy' },
      { letters: 'Ⴀ Ⴁ Ⴂ', name: 'ასომთავრული', desc: 'заглавное · церковный декор', accent: 'neutral' },
      { letters: 'ⴀ ⴁ ⴂ', name: 'ნუსხური', desc: 'рукописное · XII–XIX вв.', accent: 'muted' },
    ],
  },
  {
    id: 3,
    label: 'Отдельный мир',
    labelRu: null,
    bombora: 'think',
    headline: 'Отдельный мир',
    body: 'В мире около 40 активно используемых письменностей. Грузинская — среди немногих, у которых нет общего предка с другими алфавитами.',
    navyTile: {
      geo: 'ქართული',
      text: 'Грузинский — единственный официальный язык в регионе с полностью самобытной письменностью.',
    },
  },
  {
    id: 4,
    label: 'ძველი მეგობარი',
    labelRu: 'Старый знакомый',
    bombora: 'happy',
    headline: 'Ты уже знал её!',
    body: 'Эта буква встречала тебя при каждом открытии. Теперь ты знаешь: ქ — «кани», первая буква слова',
    reveal: { letter: 'ქ', word: 'ქართული', translation: 'грузинский язык' },
    stamp: 'ძველი მეგობარი',
  },
]
```

---

## Копирайтинг

| Элемент | Текст |
|---------|-------|
| Кнопка входа (заголовок) | «История алфавита» |
| Кнопка входа (subtitle) | «V в. · три стиля · ქართული» |
| Header экрана | «История алфавита» |
| Карточка 1 — большой акцент | «V» |
| Карточка 1 — Georgian | «საუკუნე» |
| Карточка 1 — перевод | «Пятый век» |
| Карточка 1 — body | «Грузинский алфавит создан в V веке нашей эры. Это один из немногих алфавитов мира, признанных ЮНЕСКО частью нематериального культурного наследия.» |
| Карточка 2 — Georgian | «სამი სახე» |
| Карточка 2 — перевод | «Три лица алфавита» |
| Карточка 2 — body | «Ты учишь მხედრули — именно им написаны все современные тексты.» |
| Карточка 3 — заголовок | «Отдельный мир» |
| Карточка 3 — body | «В мире около 40 активно используемых письменностей. Грузинская — среди немногих, у которых нет общего предка с другими алфавитами.» |
| Карточка 3 — navy tile Georgian | «ქართული» |
| Карточка 3 — navy tile text | «Грузинский — единственный официальный язык в регионе с полностью самобытной письменностью.» |
| Карточка 4 — заголовок | «Ты уже знал её!» |
| Карточка 4 — body | «Эта буква встречала тебя при каждом открытии. Теперь ты знаешь: ქ — «кани», первая буква слова» |
| Карточка 4 — mini-tile Georgian | «ქართული» |
| Карточка 4 — mini-tile перевод | «грузинский язык» |
| Карточка 4 — Stamp | «ძველი მეგობარი» |
| Кнопка Дальше | «Дальше» |
| Кнопка Назад | «Назад» |
| Кнопка Готово | «Готово» |

**Запрещено:**
- Не писать «поздравляем» или «ты молодец» — это не достижение, это культурный контекст
- Не добавлять «!» к историческим фактам — тон уважительный, не восторженный
- Не упрощать «ЮНЕСКО» — пользователи понимают этот акроним

---

## Адаптивность (375px)

- **Карточка**: `mx-5` → ширина 335px. Высота `flex-1` с `max-h-[520px]`.
- **Буква V на карточке 1**: `text-[60px]` → ~60px высота. Рядом «საუკუნე» `text-[18px]`. Суммарно ~90px. Умещается.
- **Таблица стилей (карточка 2)**: `mx-4` → 327px. Три строки по ~44px = 132px. Умещается без скролла внутри карточки.
- **Буква ქ на карточке 4**: `text-[80px]` → ~80px высота. Под ней underline 4px + body + mini-tile. Общая высота карточки ~380px при max-h-[520px] — умещается.
- **Кнопки навигации**: `flex gap-3 px-5` → каждая кнопка ~155px на 375px. `min-h-[52px]` (≥44px).
- **Stamp**: rotated, не увеличивает ширину — `overflow-hidden` на родителе.

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру: cream, jewelInk, navy, gold. Нет wine/moss/saffron.
- [x] Типографика в рамках T1-T6: V (60px=T1), заголовки (22-24px=T2), body (14px=T4-T5), мелкий текст (10-11px=T6)
- [x] Содержит обучающий элемент: история алфавита с Georgian терминами на каждой карточке
- [x] Описан reveal-момент: карточка 4 — буква ქ из лоадера = ქართული (грузинский)
- [x] Все состояния описаны: 4 карточки × transitions + exit
- [x] Работает на 375px: все элементы вписаны, tap targets ≥44px
- [x] Не нарушает продуктовую философию: нет геймификации, нет принудительности (кнопка входа опциональна)
- [x] Один акцент на смысл: navy = Алфавит/main, gold = highlight/progress, stamp = jewelInk
- [x] Бэкенд не нужен: полностью статичный контент, нет API-зависимостей
- [x] Не дублирует RevealKaniOverlay (#24): та — оверлей внутри урока, эта — отдельный экран истории
