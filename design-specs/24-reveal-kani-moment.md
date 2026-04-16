# Reveal-момент для буквы ქ

**Задача:** ROADMAP.md → задача #24
**Статус:** ready

---

## Обучающий элемент

**Буква:** `ქ` (kani) — первая буква слова `ქართული` («грузинский язык»).

Это та самая буква, которую пользователь видит как лоадер (`LoaderLetter`) при каждом открытии приложения — ещё до того, как знает, что это вообще такое. К моменту прохождения теории урока с ქ в модуле «Алфавит» буква уже прочно сидит в памяти как «крутящийся значок».

**Паттерн:** привычный элемент (анимированный лоадер) → момент узнавания в учебном контексте → reveal с объяснением.

**Reveal-момент:** При открытии теории урока, содержащего карточку буквы ქ, через 1.5 секунды появляется полноэкранный оверлей. Буква анимируется так же, как в лоадере. Объяснение: «Та самая буква, которая встречала тебя при загрузке. ქ — это «кани», первая буква слова ქართული — грузинский язык». Пользователь закрывает оверлей штампом «ძველი მეგობარი» (старый знакомый).

**Дофаминовый механизм:** Узнавание + неожиданная связка между «техническим» символом и реальным словом. Двойной инсайт: «я уже знал эту букву» + «теперь я знаю, что означает ქართული».

---

## Экраны и состояния

### Экран: LessonTheory — триггер оверлея

**Условие отображения:**
- Текущий урок содержит блок типа `letters`, в котором есть буква `ქ`
- `localStorage.getItem('bombora_kani_reveal_shown')` === null (показывается один раз)
- Задержка 1.5 секунды после mount экрана — пользователь успевает увидеть содержимое урока

**Детали триггера:**
```
LessonTheory mounted
    → проверка: theory.blocks.some(b => b.type === 'letters' && b.letters?.some(l => l.letter === 'ქ'))
    → проверка: !localStorage.getItem('bombora_kani_reveal_shown')
    → setTimeout(1500ms)
    → показываем RevealKaniOverlay
```

---

### Компонент: RevealKaniOverlay

**Layout (375px):**

```
┌──────────────────────────────────────────┐ ← viewport
│      backdrop rgba(21,16,10,0.65)        │
│                                          │
│      (tap backdrop → НЕ закрывает,       │
│       только кнопка внутри)              │
│                                          │
│  ╔════════════════════════════════════╗  │ ← карточка, max-w 340px
│  ║  [ килим-полоса 8px gold top ]    ║  │   jewel-tile, cream bg
│  ║                                   ║  │   slide-up анимация
│  ║                                   ║  │
│  ║      ქ  ← анимированная           ║  │   размер 120px
│  ║      ──── gold underline ────      ║  │   w-16 h-1 bg-gold
│  ║                                   ║  │
│  ║  ┌──────────────────────────────┐ ║  │
│  ║  │  ძველი მეგობარი              │ ║  │   ← stamp компонент
│  ║  └──────────────────────────────┘ ║  │
│  ║                                   ║  │
│  ║  Вот оно что!                     ║  │   T2, font-extrabold
│  ║                                   ║  │
│  ║  Эта буква встречала тебя         ║  │   T5, 15px
│  ║  каждый раз при загрузке.         ║  │
│  ║  Теперь ты знаешь её имя.         ║  │
│  ║                                   ║  │
│  ║  ┌──────────────────────────────┐ ║  │
│  ║  │  ქართული                    │ ║  │   jewel-tile мини, cream
│  ║  │  грузинский язык             │ ║  │   Georgian T3, перевод T6
│  ║  └──────────────────────────────┘ ║  │
│  ║                                   ║  │
│  ║  [ Запомню!              ]        ║  │   jewel-btn, variant="primary"
│  ║                                   ║  │
│  ║  [ килим-полоса 8px gold bottom ] ║  │
│  ╚════════════════════════════════════╝  │
└──────────────────────────────────────────┘
```

**Детали карточки:**
- Фон: `cream` (#FBF6EC)
- Border: `1.5px solid jewelInk`
- Shadow: `4px 4px 0 #15100A` (offset shadow — Minankari)
- Border radius: `rounded-2xl`
- Padding: `px-6 pt-0 pb-6`
- Килим-полоса сверху: `h-2 bg-gold rounded-t-2xl w-full` (вместо внутреннего отступа сверху)
- Карточка не перекрывается backdrop — всегда поверх

**Анимированная буква ქ:**
- Размер: `120px`
- Цвет: `navy` (#1B5FB0)
- Класс: `mn-loader-letter` — та же дышащая анимация, что в LoaderLetter
- Под буквой: `div w-16 h-1 bg-gold rounded-full mx-auto mt-3`

**Stamp «ძველი მეგობარი»:**
- Использует существующий компонент `Stamp`
- Текст: `ძველი მეგობარი` (старый знакомый)
- `color="ink"`, `tilt="left"`, `animate=true`
- Появляется с задержкой 300ms после карточки (отдельная анимация)

**Мини-плитка ქართული:**
```
╔═══════════════════════════════╗
║  ქართული                     ║   font-geo, T3 (22px), jewelInk
║  грузинский язык              ║   font-sans, T6 (11px), jewelInk/60
╚═══════════════════════════════╝
```
- `jewel-tile px-4 py-3 text-center mx-auto w-full`
- Georgian слово: `font-geo text-[22px] font-bold text-jewelInk`
- Перевод: `font-sans text-[11px] text-jewelInk/60 mt-1`

**Кнопка закрытия:**
- Текст: `Запомню!`
- `variant="primary"` (navy fill, cream text) — стандартный jewel-btn
- Полная ширина `w-full`
- При нажатии: `localStorage.setItem('bombora_kani_reveal_shown', '1')`, закрывает оверлей

---

### Состояния оверлея

| Состояние | Описание |
|-----------|----------|
| **Скрыт** | `display: none` — до триггера или после показа (localStorage уже есть) |
| **Появление** | backdrop fade-in + карточка slide-up, буква пульсирует, stamp появляется с задержкой |
| **Активен** | Все элементы видны, буква продолжает дышать (loop) |
| **Закрытие** | карточка slide-down + backdrop fade-out → `localStorage.setItem` |

---

### Анимации

| Элемент | Анимация | Параметры |
|---------|----------|-----------|
| Backdrop | `opacity: 0 → 0.65` | 250ms ease |
| Карточка (появление) | `translateY(60px) opacity(0) → translateY(0) opacity(1)` | 320ms ease-out |
| Буква ქ | `mn-loader-letter` (существующая дышащая анимация) | loop, бесконечно |
| Stamp | `scale(0) rotate(-8deg) → scale(1) rotate(-3deg)` | 350ms spring-bounce, задержка 280ms |
| Мини-плитка | `opacity(0) translateY(8px) → opacity(1) translateY(0)` | 250ms ease, задержка 350ms |
| Кнопка | `opacity(0) → opacity(1)` | 200ms ease, задержка 450ms |
| Закрытие | `translateY(0) opacity(1) → translateY(60px) opacity(0)` + backdrop fade-out | 220ms ease-in |

---

### Новый компонент: RevealKaniOverlay

**Назначение:** одноразовый обучающий оверлей для reveal-момента буквы ქ.

**Props:**
```typescript
interface RevealKaniOverlayProps {
  onClose: () => void   // вызывается после анимации закрытия
}
```

**Внутреннее состояние:**
```typescript
const [visible, setVisible] = useState(false)        // для управления анимацией
const [stampVisible, setStampVisible] = useState(false)  // задержанное появление штампа
```

**Логика вызова из LessonTheory:**
```typescript
// В LessonTheory.tsx:
const [showReveal, setShowReveal] = useState(false)

useEffect(() => {
  const hasQani = theory.blocks.some(
    b => b.type === 'letters' && b.letters?.some(l => l.letter === 'ქ')
  )
  const alreadyShown = localStorage.getItem('bombora_kani_reveal_shown')
  if (hasQani && !alreadyShown) {
    const timer = setTimeout(() => setShowReveal(true), 1500)
    return () => clearTimeout(timer)
  }
}, [])

// JSX:
{showReveal && (
  <RevealKaniOverlay onClose={() => setShowReveal(false)} />
)}
```

**Привязка к Minankari-токенам:**
- Backdrop: `rgba(21,16,10,0.65)` — jewelInk с 65% opacity
- Карточка: cream bg, jewelInk border 1.5px, 4px offset shadow
- Буква: navy (#1B5FB0) — primary accent
- Underline: gold (#F5B820) — highlight
- Stamp: jewelInk border, текст
- CTA: navy fill (primary) — стандартный jewel-btn

---

## Копирайтинг

| Элемент | Текст |
|---------|-------|
| Stamp | `ძველი მეგობარი` |
| Headline | `Вот оно что!` |
| Body 1 | `Эта буква встречала тебя каждый раз при загрузке.` |
| Body 2 | `Теперь ты знаешь её имя.` |
| Georgian слово | `ქართული` |
| Перевод | `грузинский язык` |
| CTA | `Запомню!` |

**Ограничения copy:**
- Никакого «поздравляю» или «отлично» — момент про узнавание, не про достижение
- Не объяснять слово «кани» отдельно — акцент на ქართული
- Текст лаконичный: 2 строки body, не больше

---

## Адаптивность (375px)

- Карточка: `max-w-[340px] w-[calc(100%-32px)] mx-auto` — боковые отступы 16px
- Буква 120px — помещается на 375px без переполнения
- Мини-плитка ქართული — полная ширина внутри карточки, текст не переносится
- Все tap targets: кнопка «Запомню!» — полная ширина, высота 52px (≥44px)
- Оверлей: `fixed inset-0 z-50 flex items-center justify-center px-4`

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру (cream, jewelInk, navy для буквы, gold для underline)
- [x] Типографика: T2 для headline, T5 для body, T3 для Georgian слова, T6 для перевода
- [x] Содержит обучающий элемент: раскрытие значения ქართული через узнаваемую букву
- [x] Описан reveal-момент: буква из лоадера = ქ = первая буква «грузинский язык»
- [x] Все состояния описаны: скрыт / появление / активен / закрытие
- [x] Работает на 375px (карточка с боковыми отступами, кнопка ≥44px)
- [x] Не нарушает продуктовую философию (не геймификация, не достижение — чистый инсайт)
- [x] Один акцентный цвет на элемент: navy для буквы, gold для underline, jewelInk для stamp
- [x] localStorage-флаг `bombora_kani_reveal_shown` — показывается ровно один раз
