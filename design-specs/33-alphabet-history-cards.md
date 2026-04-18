# История грузинского письма — культурные карточки в Алфавите

**Задача:** ROADMAP.md → задача #33
**Статус:** ready

---

## Обучающий элемент

**Что показываем на грузинском:**
- Карточка 1: **ანბანი** — само слово «алфавит» (ა + ბ + ნ → «ане-бане»)
- Карточка 2: три варианта письма глазами пользователя — მხედრული / ასომთავრული / ნუსხური
- Карточка 3: **ქართული** — «грузинский» — ключевое слово, которое встречается повсюду
- Карточка 4 (reveal): **ქ** — буква, которую пользователь видел на каждом загрузочном экране

**Когда наступит reveal-момент:**
Карточка 4 показывает: «Каждый раз, открывая Бомбору, ты видел букву **ქ** в загрузочном экране. Это первая буква слова **ქართული** (грузинский). Загрузчик Бомборы был уроком с первого дня.» Пользователь осознаёт — он уже знал эту букву, не зная об этом.

**Как создаёт дофамин:**
1. Любопытство: «у них три разных письма?!»
2. Гордость: «в ЮНЕСКО включили!»
3. Узнавание (reveal): «ах вот что это за буква была!» — самый сильный момент, потому что пользователь вспоминает десятки загрузок.

---

## Экраны и состояния

### Экран: ModuleMap — точка входа

**Условие отображения:** только когда `moduleId === 'alphabet' || moduleId === 'alphabet-progressive'`.

**Размещение:** внутри Overview-карточки (`jewel-tile`), сразу после блока KilimProgress — как inline-ссылка через `ink-dash` разделитель.

**Layout (фрагмент Overview card):**

```
┌────────────────────────────────────────────────┐  ← jewel-tile
│  маршрут                            3 / 12     │
│  [══╤══╤══╤══╤══╤══╤══╤══╤══╤══╤══╤══]        │  ← KilimProgress
│                                                │
│ · · · · · · · · · · · · · · · · · · · · · ·   │  ← ink-dash divider
│                                                │
│  История алфавита  →                           │  ← entry link
└────────────────────────────────────────────────┘
```

**Стили entry link:**
- `font-sans text-[14px] font-bold text-navy leading-none`
- Стрелка: символ `→` (U+2192), того же цвета, `ml-1`
- Tap area: `py-3 w-full flex items-center` — полная ширина карточки (tap target ≥ 44px)
- `active:opacity-70 transition-opacity`
- Разделитель перед ссылкой: `ink-dash my-3` (существующий CSS-класс)

**Действие по тапу:** `navigate({ kind: 'alphabet-history', moduleId })`

---

### Экран: AlphabetHistoryScreen (новый)

**Файл:** `src/Trale/miniapp-src/src/screens/AlphabetHistoryScreen.tsx`

**Props:**
```typescript
interface Props {
  moduleId: string
  navigate: (s: Screen) => void
}
```

**Общий layout (375px):**

```
╔═══╤═══╤═══╤═══╤═══╤═══╤═══╤═══╤═══╗  ← kilim stripe 8px (via Header)
║  [← Алфавит]    История алфавита   ║  ← Header: onBack → { kind: 'module', moduleId }
╠═══╧═══╧═══╧═══╧═══╧═══╧═══╧═══╧═══╣
║                                    ║
║  ┌──────────────────────────────┐  ║
║  │  [Card content — jewel-tile] │  ║  ← карточка занимает ~75% высоты экрана
║  └──────────────────────────────┘  ║
║                                    ║
║       ● ○ ○ ○                      ║  ← progress dots (Georgian letters)
║                                    ║
║  ┌──────────────────────────────┐  ║
║  │         Далее  →             │  ║  ← jewel-btn
║  └──────────────────────────────┘  ║
╚═══╤═══╤═══╤═══╤═══╤═══╤═══╤═══╤═══╝  ← kilim stripe 8px (via layout)
```

**Состояния:**
- `cardIndex: 0..3` — текущая карточка
- `animDir: 'left' | 'right' | null` — направление текущей анимации
- `revealed: boolean` — только для карточки 4; false пока не анимировалась ქ

---

### Компонент HistoryCard — карусельная карточка

Каждая из 4 карточек — `jewel-tile`, полная ширина контентной зоны, фиксированная высота `min-h-[420px]`, `px-5 py-6`.

**Карточка 1 — «ა: Рождение алфавита»**

```
┌────────────────────────────────────────────┐  ← jewel-tile
│  ა                                         │  ← T6, gold, mn-eyebrow
│                                            │
│  V век — рождение                          │  ← T2, 24px, extraBold, jewelInk
│                                            │
│       ანბანი                               │  ← T1, 40px, extraBold, navy, centered
│                                            │
│  Грузинский алфавит появился в V веке     │  ← T5, 13px, jewelInk/80, leading-snug
│  н.э. Старейшие известные надписи (~430   │
│  г.) найдены в Палестине. Один из         │
│  немногих алфавитов с точной датой        │
│  рождения.                                │
│                                            │
│                   [Бомбора 64px curious]   │  ← Mascot align-right, mood=curious
└────────────────────────────────────────────┘
```

- Eyebrow: `mn-eyebrow` (существующий класс) + текст `«ა — начало»`
- Заголовок: `font-sans text-[24px] font-extrabold text-jewelInk leading-tight mt-1`
- Georgian headline: `font-sans text-[40px] font-extrabold text-navy text-center my-4`
- Body: `font-sans text-[13px] text-jewelInk/80 leading-relaxed`
- Mascot: `size=64`, `mood="curious"`, `className="ml-auto mt-4"`

---

**Карточка 2 — «ბ: Три стиля одного письма»**

```
┌────────────────────────────────────────────┐
│  ბ                                         │  ← mn-eyebrow gold
│                                            │
│  Три стиля одного письма                  │  ← T2
│                                            │
│  ┌──────┐ ┌──────┐ ┌──────┐               │  ← три плашки рядом
│  │  მ   │ │  Ⴋ   │ │  ⴋ  │               │  ← буква «м» в 3 стилях
│  │      │ │      │ │      │               │
│  │მხედ- │ │ასომ- │ │ნუსხ- │               │  ← подпись T6
│  │რული  │ │თავ-  │ │ური   │               │
│  └──────┘ └──────┘ └──────┘               │
│  современный  церковный  рукописный       │  ← T6 перевод, jewelInk/60
│                                            │
│  Мы учим მხედრული — современное          │  ← T5, body
│  светское письмо. Остальные два            │
│  встречаются в церковных текстах.          │
│                                            │
│  [Бомбора 64px guide]                      │
└────────────────────────────────────────────┘
```

**Три плашки-стиля:**
- Обёртка: `flex gap-2 my-4`
- Каждая: `flex-1 flex flex-col items-center rounded-xl border border-jewelInk/20 bg-cream-tile px-2 py-3`
- Буква в стиле: `font-sans text-[28px] font-extrabold text-navy` (мхедрули) или `text-jewelInk` (остальные)
- Подпись: `font-sans text-[10px] text-jewelInk/60 text-center mt-1 leading-tight`

> **Примечание для Developer:** Ასომთავრული (Unicode: Ⴋ, блок Georgian Asomtavruli) и ნუსხური (⴬, блок Georgian Nuskhuri) отображаются через Noto Sans Georgian fallback. Если glyphs не рендерятся — использовать просто «A» с подписью «ასომთავრული».

---

**Карточка 3 — «გ: Наследие ЮНЕСКО»**

```
┌────────────────────────────────────────────┐
│  გ                                         │  ← mn-eyebrow gold
│                                            │
│  Наследие ЮНЕСКО                           │  ← T2
│                                            │
│       ქართული                              │  ← T1, 36px, navy, centered, bold
│       грузинский                           │  ← T6, jewelInk/60, centered, italics-free
│                                            │
│  В 2016 году три грузинских письма        │  ← T5, body
│  включены в Реестр документального         │
│  наследия ЮНЕСКО. Из ~7 000 языков        │
│  лишь ~100 имеют собственный алфавит.      │
│  Грузинский — один из старейших            │
│  непрерывно используемых.                  │
│                                            │
│                   [Бомбора 64px happy]     │
└────────────────────────────────────────────┘
```

- Georgian headline: `font-sans text-[36px] font-extrabold text-navy text-center`
- Русский перевод под: `font-sans text-[12px] text-jewelInk/60 text-center font-semibold tracking-wide mt-0.5`

---

**Карточка 4 — «დ: Ты уже знал эту букву» (Reveal)**

```
┌────────────────────────────────────────────┐  ← jewel-tile + gold inner hairline pulse
│  დ — финал                                 │  ← mn-eyebrow, ruby (единственная красная метка)
│                                            │
│  Ты уже знал эту букву                    │  ← T2, jewelInk
│                                            │
│                                            │
│                   ქ                        │  ← display-xl (64px), navy, centered
│                                            │    анимация появления: scale 0.3→1, 500ms
│                                            │
│  Каждый раз, открывая Бомбору, ты         │  ← T5, body
│  видел эту букву. Это ქ — первая буква    │
│  слова ქართული (грузинский). Загрузчик   │
│  был уроком с первого дня.                │
│                                            │
│  [Бомбора 72px cheer]    ← wag-анимация  │
└────────────────────────────────────────────┘
```

**Специальные стили карточки 4:**
- `jewel-tile` стандартный + добавить `gold-reveal-glow` (см. ниже)
- Eyebrow: `mn-eyebrow` + `text-ruby` (единственное исключение для финального момента — ruby = достижение)
- Буква ქ: `display-xl text-navy text-center` — `clamp(64px, 18vw, 80px)`
- Анимация ქ: `scale-reveal` (новый keyframe): `transform: scale(0.3) → scale(1.08) → scale(1)`, 500ms ease-out

**Новая CSS-анимация `gold-reveal-glow`:**
```css
@keyframes gold-glow-pulse {
  0%, 100% { box-shadow: 3px 3px 0 #15100A, inset 0 0 0 1px rgba(245,184,32,0.3); }
  50%       { box-shadow: 3px 3px 0 #15100A, inset 0 0 0 1px rgba(245,184,32,0.8); }
}
.gold-reveal-glow {
  animation: gold-glow-pulse 1.6s ease-in-out 0.4s 3;
}
```

**Новая CSS-анимация `scale-reveal`:**
```css
@keyframes scale-reveal {
  0%   { transform: scale(0.3); opacity: 0; }
  70%  { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1);    opacity: 1; }
}
.anim-scale-reveal {
  animation: scale-reveal 500ms cubic-bezier(0.2, 1.3, 0.4, 1) both;
}
```

---

### Progress Dots — грузинские числительные

```
    ა  ბ  გ  დ
    ●  ○  ○  ○    ← текущая (●) залита navy, inactive (○) — borderOnly
```

**Реализация:**
```
Контейнер: flex gap-4 justify-center items-center py-3
Активная точка: w-9 h-9 rounded-full bg-navy flex items-center justify-center
  - текст: font-sans text-[16px] font-extrabold text-cream
Неактивная точка: w-9 h-9 rounded-full border-2 border-jewelInk/30 flex items-center justify-center
  - текст: font-sans text-[14px] font-bold text-jewelInk/30
Tap: весь dot тапабелен, переходит к карточке (skip navigation)
```

Буквы по порядку: `['ა', 'ბ', 'გ', 'დ']`

---

### Кнопка навигации

**Не последняя карточка (0–2):**
```
[jewel-btn] ширина 100%  →  «Далее» + стрелка →
```

**Последняя карточка (3):**
```
[jewel-btn] ширина 100%  →  «Начать алфавит»   (closes history, returns to ModuleMap)
```

`jewel-btn` — существующий CSS-класс. CTA текст выровнен по центру.

---

### Анимация переходов между карточками

| Действие | Анимация |
|----------|----------|
| «Далее» (→) | текущая карточка: `translateX(0 → -110%)` 280ms; новая: `translateX(110% → 0)` 280ms |
| «Назад» (←) через dot | текущая: `translateX(0 → +110%)`; новая: `translateX(-110% → 0)` |
| Вход на 4-ю карточку | дополнительно: буква ქ анимируется `anim-scale-reveal` с delay 150ms |

**Технически:** `overflow-hidden` на контейнере карточки + абсолютное позиционирование двух карточек в момент анимации → после завершения: только текущая, `position: relative`.

---

## Новые элементы типов и роутинга

### types.ts — добавить к Screen union:
```typescript
| { kind: 'alphabet-history'; moduleId: string }
```

### App.tsx — добавить обработку Back Button:
```typescript
} else if (screen.kind === 'alphabet-history') {
  setScreen({ kind: 'module', moduleId: screen.moduleId })
}
```

### App.tsx — добавить case в render switch:
```tsx
case 'alphabet-history':
  return (
    <AlphabetHistoryScreen
      moduleId={screen.moduleId}
      navigate={navigate}
    />
  )
```

---

## Копирайтинг

| Элемент | Текст |
|---------|-------|
| Header title | `История алфавита` |
| Entry link | `История алфавита →` |
| Карточка 1 eyebrow | `ა — начало` |
| Карточка 1 заголовок | `V век — рождение` |
| Карточка 2 eyebrow | `ბ — три стиля` |
| Карточка 2 заголовок | `Три стиля одного письма` |
| Карточка 3 eyebrow | `გ — в мире` |
| Карточка 3 заголовок | `Наследие ЮНЕСКО` |
| Карточка 4 eyebrow | `დ — финал` |
| Карточка 4 заголовок | `Ты уже знал эту букву` |
| Кнопка 1–3 | `Далее →` |
| Кнопка 4 | `Начать алфавит` |

**Тоны копирайтинга:**
- Без пафоса («уникальнейший в мире» → просто «один из старейших»)
- Без этнических акцентов
- Reveal card: от первого лица Бомборы («ты видел», «с первого дня»)

---

## Адаптивность (375px)

| Элемент | Решение |
|---------|---------|
| Карточка | `mx-5` (15px с каждой стороны) + `px-5 py-6` внутри = 280px рабочей ширины |
| Заголовок T2 24px | 2 строки максимум, `leading-tight` |
| Georgian T1 40px (ანბანი) | 6 символов × ~24px ≈ 144px — умещается в одну строку |
| Georgian T1 36px (ქართული) | 7 символов × ~22px ≈ 154px — умещается |
| Буква ქ display-xl | `clamp(64px, 18vw, 80px)` — на 375px = 67.5px, центрирован |
| Три плашки стилей | `flex gap-2`, каждая `flex-1` ≈ 85px — достаточно для 1 буквы + подписи |
| Progress dots 4×(36px + 16px gap) = 196px | Умещается по центру на 375px |
| Кнопка «Далее» | `w-full`, min-h `48px` ✓ |
| Mascot 64px | `ml-auto` — не конкурирует с текстом |

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру: navy для Georgian акцентов, gold для eyebrow/dots/glow, ruby только на карточке 4 (достижение), cream для фона jewel-tile, jewelInk для текста
- [x] Типографика в шкале T1-T6: display-xl (64px) для ქ, T2 (24px) для заголовков карточек, T1 (40px/36px) для Georgian headlines, T5 (13px) для body, T6 (10-12px) для eyebrow/подписей
- [x] Содержит обучающий элемент: четыре культурных факта + reveal-момент буквы ქ
- [x] Описан reveal-момент: карточка 4 показывает связь LoaderLetter ← → ქართული, которую пользователь видел при каждой загрузке
- [x] Все состояния описаны: cardIndex 0-3, animDir, revealed
- [x] Работает на 375px: Georgian текст умещается, tap targets ≥ 44px, три плашки в строку без overflow
- [x] Не нарушает продуктовую философию: карточки необязательные (можно пропустить), без gate-keeping
- [x] Один акцент на элемент: navy для Georgian главного слова, gold для прогресс-dots и eyebrow, ruby только финальный eyebrow
- [x] Точка входа — условная, только для alphabet-модулей
- [x] Статичный контент — нет зависимостей от бэкенда
- [x] Back Button Telegram поддержан (возврат в ModuleMap)
