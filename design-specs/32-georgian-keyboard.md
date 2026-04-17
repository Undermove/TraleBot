# Грузинская экранная клавиатура для type-упражнений

**Задача:** ROADMAP.md → задача #32
**Статус:** ready

---

## Обучающий элемент

**Что учит:** Клавиатура отображает все 33 буквы грузинского алфавита в стандартной QWERTY-фонетической раскладке — без транслита. Пользователь с первого же упражнения начинает строить визуально-пространственную память: каждая буква занимает определённое место на клавиатуре. Многократное нажатие букв в контексте знакомых слов заменяет механическое заучивание.

**Паттерн:** привычный жест (печатать на клавиатуре) → грузинский контекст (только ქართული буквы, никакого транслита) → момент узнавания.

**Reveal-момент 1:** В модуле «Алфавит», при прохождении урока с буквой ც (цi), пользователь вспоминает: «Вот та буква, которую я нажимаю в третьем ряду между ვ и ბ!» — пространственная память мгновенно даёт семантику.

**Reveal-момент 2:** После прохождения всего модуля «Алфавит» пользователь открывает клавиатуру и понимает, что теперь ЗНАЕТ каждую клавишу. Клавиатура превращается из «иероглифов» в полностью понятный инструмент.

**Reveal-момент 3 (дофаминовый пик):** Первый раз пользователь успешно набирает грузинское слово по памяти, без подсказок — мощное ощущение «я печатаю по-грузински».

---

## Раскладка клавиатуры

### Расположение 33 букв (4 ряда)

Стандартная грузинская QWERTY-фонетическая раскладка:

```
Ряд 1 (10 клавиш): ქ  წ  ე  რ  ტ  ყ  უ  ი  ო  პ
Ряд 2 (10 клавиш): ა  ს  დ  ფ  გ  ჰ  ჯ  კ  ლ  ჩ
Ряд 3 (8 букв + ⌫): ζ  შ  ხ  ც  ვ  ბ  ნ  მ  [⌫]
Ряд 4 (редкие + пробел): [თ] [ჟ] [ღ] [ძ] [ჭ] [___ПРОБЕЛ___]
```

> **Примечание:** ROADMAP указывал «3 ряда», однако для размещения всех 33 букв + пробела + backspace при минимальном tap target ≥ 36px требуется 4 ряда. Ряд 4 компактнее (редкие звуки), отделён визуально.

**Соответствие QWERTY:**
| Q→ქ | W→წ | E→ე | R→რ | T→ტ | Y→ყ | U→უ | I→ი | O→ო | P→პ |
| A→ა | S→ს | D→დ | F→ფ | G→გ | H→ჰ | J→ჯ | K→კ | L→ლ | →ჩ |
| Z→ζ | →შ | X→ხ | C→ც | V→ვ | B→ბ | N→ნ | M→მ | | |
| Rare: | თ | ჟ | ღ | ძ | ჭ | [SPACE] | | | |

---

## Экраны и состояния

### Компонент: GeorgianKeyboard (новый)

**Назначение:** in-app клавиатура для набора грузинского текста в type-упражнениях.

**Props:**
```typescript
interface GeorgianKeyboardProps {
  value: string                    // текущее содержимое поля
  onChange: (value: string) => void // callback при изменении
  disabled?: boolean               // заблокирована (после проверки)
}
```

**Layout клавиатуры (снизу вверх в DOM, выше — ввод):**
```
[  Поле ввода (input display)  ]
[─── разделитель ───────────────]
[ Ряд 1: ქ წ ე რ ტ ყ უ ი ო პ ]
[ Ряд 2: ა ს დ ფ გ ჰ ჯ კ ლ ჩ ]
[ Ряд 3: ζ შ ხ ც ვ ბ ნ მ  ⌫  ]
[ Ряд 4: თ ჟ ღ ძ ჭ  [  ___  ] ]
```

**Каждая клавиша-буква (Key):**
```
min-width: flexible (10 равных в ряду 1-2)
height: 44px
border: 1.5px border-jewelInk
border-radius: 8px (rounded-lg)
background: cream-tile
font: font-geo, text-[18px], font-bold, text-jewelInk
box-shadow: 2px 2px 0 #15100A (jewel-tile style)
```

**Состояния клавиши:**

| Состояние | BG | Текст | Shadow |
|-----------|-----|-------|--------|
| Default | `cream-tile` | `jewelInk` | `2px 2px 0 #15100A` |
| Pressed (active) | `navy` | `cream` | `none` + `translate(2px, 2px)` |
| Disabled (after check) | `cream-tile` | `jewelInk/30` | `none` |

**Клавиша Backspace (⌫):**
- Ширина: 1.5× ширины обычной клавиши
- Иконка: SVG-стрелка влево с засечкой (← с полосой)
- BG: `cream-deep`
- Hover/press: `ruby/10` background

**Клавиша Пробел:**
- Ширина: flex-1 (занимает всё оставшееся место в ряду 4 после 5 редких букв)
- Высота: 44px
- Содержимое: горизонтальная линия 24px по центру (визуальный символ пробела), не текст

**Ряд 4 — редкие буквы:**
Клавиши თ ჟ ღ ძ ჭ — того же размера что в рядах 1-2, но с дополнительным стилингом: subtle `gold-wash` background (вместо `cream-tile`) + золотая точка 4px в правом верхнем углу. Это визуально кодирует «редкое, особенное» без ломки дизайна.

**Разделитель между рядами 3 и 4:**
1px gold hairline (`border-gold/30`) — подчёркивает «основная/редкие» разделение.

---

### Экран: TypeAnswer упражнение (новый режим Practice.tsx)

Новый тип вопроса: `type` (в отличие от существующего `choice`). Активирует `GeorgianKeyboard` вместо option buttons.

**Layout сверху вниз:**
```
[ kilim-strip (top) ]
[ Header: × | progress bar | счётчик ]
[ ─── ]
[ eyebrow: "напиши по-грузински" + Geo numeral ]
[ Вопрос (question text, T2 size) ]
[ ─── ]
[ Input display ]  ← поле ввода, высота 56px
[ GeorgianKeyboard ]
[ ─── ]
[ Кнопка «проверить» ]
[ kilim-strip (bottom) ]
```

**Input display:**
```
height: 56px
border: 1.5px jewelInk
border-radius: 12px
background: cream-tile
box-shadow: 2px 2px 0 #15100A
font: font-geo, text-[22px], font-bold, text-jewelInk
text-align: center
padding: 0 16px
```

- Если пусто: placeholder-текст `ანბანი...` в `jewelInk/30`
- Курсор: золотое мигающее подчёркивание (2px `gold DEFAULT`, animation: blink 1s step-end infinite)
- Символы отображаются по центру (center-aligned, одна строка)

**Проверка ответа (state: checked):**

*Верно:*
- Input display: `background: navy`, текст `cream`
- Тонкая gold hairline внутри input (имитация jewel-tile inner hairline)
- Под input: галочка SVG + «верно» (как в текущем Practice.tsx для choice)

*Неверно:*
- Input display: `background: ruby/15`, border `ruby`
- Под input: правильный ответ в navy jewel-tile
- Клавиатура `disabled=true` (все клавиши серые, нельзя нажать)

**Состояния экрана TypeAnswer:**

| Phase | Description |
|-------|-------------|
| `answering` | Клавиатура активна, input показывает набранное |
| `empty` | value === "", кнопка «проверить» disabled |
| `typing` | value.length > 0, кнопка «проверить» enabled |
| `checked-correct` | Input navy, keyboard disabled, feedback banner navy |
| `checked-wrong` | Input ruby/15, keyboard disabled, correct answer shown |

---

### Анимации

| Событие | Анимация |
|---------|----------|
| Нажатие клавиши (key press) | `translate(2px, 2px)` + shadow исчезает, 60ms ease-out; возврат 80ms |
| Появление символа в input | Символ fade-in 80ms слева (символы «входят» слева направо) |
| Backspace | Символ scale(0) + fade-out 80ms, затем исчезает |
| Анимация проверки верно | Input: scale(1.02) → scale(1), 200ms; navy fill transition 150ms |
| Анимация проверки неверно | Input: shake 300ms (translateX: ±4px × 3) |
| Курсор (мигающее подчёркивание) | `opacity: 1 → 0 → 1`, step-end, 1s |

```css
@keyframes key-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(2px); }
}
.anim-shake { animation: key-shake 300ms ease-in-out; }
```

---

### Компонент: GeorgianKeyboard — детальная структура

**Структура DOM:**
```tsx
<div className="geo-keyboard bg-cream border-t border-jewelInk/15 px-2 pt-2 pb-3">
  {/* Ряды 1-3: буквы равной ширины */}
  <div className="flex gap-[3px] mb-[3px]">
    {row1.map(letter => <KeyButton key={letter} letter={letter} ... />)}
  </div>
  <div className="flex gap-[3px] mb-[3px]">
    {row2.map(letter => <KeyButton key={letter} letter={letter} ... />)}
  </div>
  <div className="flex gap-[3px] mb-[3px]">
    {row3Letters.map(letter => <KeyButton key={letter} letter={letter} ... />)}
    <BackspaceButton />
  </div>
  
  {/* Gold hairline разделитель */}
  <div className="h-px bg-gold/30 my-1 mx-1" />
  
  {/* Ряд 4: редкие буквы + пробел */}
  <div className="flex gap-[3px]">
    {row4Rare.map(letter => <RareKeyButton key={letter} letter={letter} ... />)}
    <SpaceButton />
  </div>
</div>
```

**Внутренний компонент KeyButton:**
```tsx
// Стандартная клавиша
<button
  onPointerDown={() => onPress(letter)}
  className="flex-1 h-[44px] rounded-lg border-[1.5px] border-jewelInk 
             bg-cream-tile font-geo text-[18px] font-bold text-jewelInk
             active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
             transition-all duration-75 select-none"
  style={{ boxShadow: '2px 2px 0 #15100A' }}
>
  {letter}
</button>
```

**Внутренний компонент RareKeyButton:**
```tsx
// Редкая клавиша (ряд 4) — gold-wash BG, gold dot
<button
  onPointerDown={() => onPress(letter)}
  className="flex-1 h-[44px] rounded-lg border-[1.5px] border-gold/60 
             bg-gold-wash font-geo text-[18px] font-bold text-jewelInk
             relative active:translate-x-0.5 active:translate-y-0.5
             transition-all duration-75 select-none"
  style={{ boxShadow: '2px 2px 0 #C68F10' }}  // gold-deep offset shadow
>
  {letter}
  {/* Gold dot — visual hint «rare» */}
  <span className="absolute top-[5px] right-[5px] w-[4px] h-[4px] 
                   rounded-full bg-gold-deep opacity-60" />
</button>
```

---

## Размерная раскладка на 375px

```
Общая ширина экрана: 375px
Padding клавиатуры: 8px каждая сторона → рабочая ширина: 359px
Gap между клавишами: 3px

Ряды 1-2 (10 клавиш): (359 - 9×3) / 10 = 332 / 10 = 33.2px wide
Ряд 3 (8 букв + широкий backspace):
  backspace = 1.5× = 49.8px → оставшийся: 359 - 49.8 - 8×3 = 285.2 / 8 = 35.7px
Ряд 4 (5 редких + пробел):
  5 rare keys: 5 × 40px = 200px; 4 gaps × 3px = 12px; 1 gap perед пробелом: 3px
  Пробел: 359 - 200 - 12 - 3 = 144px (принято — широкий пробел)

Высота всех клавиш: 44px (tap target по высоте ≥ 44px ✓)
Ширина: 33-36px — для keyboard-style элементов приемлемо
  (пальцы двигаются по keyboard иначе чем по обычным кнопкам; iOS/Android используют ~32px wide keys)
```

---

## Интеграция с Practice.tsx

**Что нужно изменить в Practice:**

1. Тип вопроса (`QuizQuestion`) получает поле `questionType?: 'choice' | 'type'`
2. Если `questionType === 'type'` — не рендерить option buttons, рендерить `GeorgianKeyboard`
3. State: заменить `selected: number | null` → `typedAnswer: string` (для type-questions)
4. Проверка: `typedAnswer.trim().toLowerCase() === correctAnswer.toLowerCase()` (нормализация)
5. Feedback banner: аналогичен choice, но показывает правильный ответ (если неверно)

**Обратная совместимость:** все существующие `choice` вопросы работают без изменений.

**Где создать файл:** `src/Trale/miniapp-src/src/components/GeorgianKeyboard.tsx`

---

## Copywriting

| Элемент | Текст |
|---------|-------|
| Eyebrow для type-упражнения | `напиши по-грузински` |
| Placeholder в input | `ანბანი...` (слово «алфавит» — обучающая вставка) |
| Tooltip при первом появлении клавиатуры | `← без транслита: учись читать буквы напрямую` |
| Кнопка проверки | `проверить` (та же что в choice) |
| Feedback при ошибке | `правильно: {answer}` |
| Верхняя подсказка при ошибке | `ещё раз` (как в choice) |

**Gold-dot tooltip для ряда 4 (при первом открытии):**
Маленький tooltip над рядом 4 при первом открытии клавиатуры:
`«редкие» — これ тоже учатся со временем` → нет, лучше по-русски:
`редкие звуки — встретишь в сложных уроках`
Показывается один раз, автодисмисс 3 секунды, без тапа.

---

## Адаптивность

**На 375px:**
- Клавиши 33px wide × 44px tall — стандарт mobile keyboard (приемлемо)
- Ряды 1-2: по 10 клавиш — плотно, но читаемо с Noto Sans Georgian
- Ряды 3-4: умещаются без горизонтального скролла
- Input display + keyboard: занимают нижние ~260px экрана
- Вопрос и eyebrow: верхние ~120px

**Поведение при открытии:**
- Системная клавиатура НЕ показывается (поле ввода — не настоящий `<input>`, а display div)
- Тап по input field не вызывает системную клавиатуру
- Весь ввод идёт через `GeorgianKeyboard` компонент

**Высота экрана:**
- Минимальная высота viewport: ~600px (iPhone SE)
- Keyboard занимает ~220px, header ~60px, вопрос ~120px → итого ~400px, остаток ~200px для input + button

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру: cream-tile, jewelInk, navy, ruby, gold-wash, gold-deep
- [x] Типографика: font-geo text-[18px] для букв (Secondary typescale, не нарушает T1-T6)
- [x] Содержит обучающий элемент: 33 буквы без транслита, визуально-пространственная память
- [x] Описаны reveal-моменты (три момента: алфавитный модуль, завершение алфавита, первый самостоятельный набор)
- [x] Все состояния описаны: default / pressed / disabled / answering / checked-correct / checked-wrong / empty
- [x] Работает на 375px (4 ряда, ширина ~33px, высота 44px)
- [x] Не нарушает продуктовую философию (не gate-keeping, type-упражнения опциональны)
- [x] Один акцентный цвет на элемент: navy для правильного, ruby для неправильного, gold для редких клавиш
- [x] Обратная совместимость: choice-вопросы не затронуты
- [x] Системная клавиатура не появляется (display-div, не input)
