# Грузинские дни недели в приветствии Бомборы

**Задача:** ROADMAP.md → задача #31
**Статус:** ready

---

## Обучающий элемент

Под приветствием Бомборы на дашборде появляется маленький тапабельный чип с грузинским названием текущего дня недели. Тап раскрывает тултип: Georgian имя крупно + транслитерация + перевод на русский + **числовая подсказка** (для пн–чт).

**Скрытый уровень обучения — числительные внутри дней:**

| День | Georgian | Содержит | Число |
|------|----------|----------|-------|
| Пн | ორშაბათი | **ორ**ი = два | второй шаббат |
| Вт | სამშაბათი | **სამ**ი = три | третий шаббат |
| Ср | ოთხშაბათი | **ოთხ**ი = четыре | четвёртый шаббат |
| Чт | ხუთშაბათი | **ხუთ**ი = пять | пятый шаббат |
| Пт | პარასკევი | — | от греч. «приготовление» |
| Сб | შაბათი | შაბათი = Суббота (Шаббат) | — |
| Вс | კვირა | — | от греч. κυριακή |

Тултип для пн–чт показывает встроенное числительное. Пользователь видит дни недели каждый день → видит фрагменты ორ/სამ/ოთხ/ხუთ сотни раз → не осознавая, запоминает их форму.

**Reveal-момент:** в Фазе 2.5 (модуль «Числительные») пользователь встречает ოთხი (четыре) и вдруг узнаёт корень из ოთხ**შ**ა**ბ**ა**თ**ი — «это то, что я видел каждую среду!» Эмоция: инсайт + приятное удивление (дофамин).

---

## Данные (статичные, только фронтенд)

```typescript
// В файле: src/utils/georgianDays.ts (новый)
export interface GeorgianDay {
  geo: string        // грузинское имя
  translit: string   // транслитерация по слогам
  ru: string         // русский перевод
  numberHint: string | null   // подсказка о числительном (только пн–чт)
}

// Индекс совпадает с new Date().getDay(): 0=вс, 1=пн, …, 6=сб
export const GEORGIAN_DAYS: GeorgianDay[] = [
  {
    geo: 'კვირა',
    translit: 'kvi·ra',
    ru: 'воскресенье',
    numberHint: null,
  },
  {
    geo: 'ორშაბათი',
    translit: 'or·sha·ba·ti',
    ru: 'понедельник',
    numberHint: 'ორ — часть числа ორი (два)',
  },
  {
    geo: 'სამშაბათი',
    translit: 'sam·sha·ba·ti',
    ru: 'вторник',
    numberHint: 'სამ — часть числа სამი (три)',
  },
  {
    geo: 'ოთხშაბათი',
    translit: 'otkh·sha·ba·ti',
    ru: 'среда',
    numberHint: 'ოთხ — часть числа ოთხი (четыре)',
  },
  {
    geo: 'ხუთშაბათი',
    translit: 'khuth·sha·ba·ti',
    ru: 'четверг',
    numberHint: 'ხუთ — часть числа ხუთი (пять)',
  },
  {
    geo: 'პარასკევი',
    translit: 'pa·ras·ke·vi',
    ru: 'пятница',
    numberHint: null,
  },
  {
    geo: 'შაბათი',
    translit: 'sha·ba·ti',
    ru: 'суббота',
    numberHint: null,
  },
]

export function getTodayGeorgian(): GeorgianDay {
  return GEORGIAN_DAYS[new Date().getDay()]
}
```

---

## Экраны и состояния

### Экран: Dashboard — hero-секция (обновление)

**Текущий layout hero:**
```
[ Бомбора 120px ]
[ Bowl dots ]
[ greeting.geo    12px font-geo ]
[ greeting.line1  22px extrabold ]
[ greeting.line2  14px ruby ]
[ satietyText     12px jewelInk-mid ]
```

**Новый layout hero (добавить под satietyText):**
```
[ Бомбора 120px ]
[ Bowl dots ]
[ greeting.geo    12px font-geo ]
[ greeting.line1  22px extrabold ]
[ greeting.line2  14px ruby ]
[ satietyText     12px jewelInk-mid ]
[ ── mt-2 ── ]
[ DayChip        ← НОВЫЙ элемент ]
[ DayTooltip     ← НОВЫЙ, раскрывается при тапе на DayChip ]
```

Весь hero-блок (`<button onClick={() => navigate(...)}`) остаётся кликабельным на Профиль, **кроме** области DayChip. DayChip является отдельным `<button>` с `stopPropagation()`.

---

### Компонент: DayChip (inline, внутри Dashboard.tsx)

Маленький тапабельный чип с названием дня.

**Внешний вид:**
```
╭─────────────────╮
│  ოთხშაბათი  ›   │  ← navy текст, cream фон, 1.5px jewelInk бордер
╰─────────────────╯
     14px font-geo | padding: 4px 12px | border-radius: 20px
```

- `font-geo` 14px, `font-semibold`, цвет `text-navy`
- Фон: `bg-cream` (или `bg-transparent` — совпадает с фоном hero)
- Бордер: `border border-jewelInk/30` (30% прозрачность — лёгкий, не жирный)
- Border-radius: `rounded-full`
- Паддинг: `px-3 py-1`
- Справа: маленькая стрелка `›` или `▸` в 10px `text-jewelInk/40` — намекает на тапабельность
- `min-h-[44px]` достигается через `items-center flex` с вертикальным паддингом (`py-2.5`) — tap target соблюдён
- При нажатии: `active:bg-navy/10` (лёгкий флэш)
- Transition: `transition-colors duration-150`

**Состояния:**
- Default: чип с названием дня
- Pressed: `active:bg-navy/10`
- Tooltip open: чип остаётся видимым, тултип появляется ниже

---

### Компонент: DayTooltip (inline, внутри Dashboard.tsx)

Небольшая плашка-тултип, появляется под DayChip при тапе. Не полноэкранный попап — именно встроенная плашка.

**Поведение:**
- Тап на DayChip → `isTooltipOpen = true`
- Повторный тап → `isTooltipOpen = false`
- Auto-dismiss: через 5 секунд (timeout сбрасывается при повторном открытии)
- Клик вне hero-секции: не закрывает (тултип в DOM, не overlay)

**Внешний вид:**

```
╔═══════════════════════════════════╗  ← solid bg: navy #1B5FB0
║                                   ║     border: 1.5px jewelInk
║   ოთხშაბათი                       ║     border-radius: 12px
║   OTKH·SHA·BA·TI                  ║     box-shadow: 2px 2px 0 #15100A
║   среда                           ║     ::before gold hairline (inset 2px)
║   ─────────────────────────────   ║
║   ოთხ — часть числа ოთხი (четыре)║   ← только для пн–чт
╚═══════════════════════════════════╝
```

**Типографика (внутри тултипа):**
- Georgian name: `font-geo text-[20px] font-extrabold text-cream leading-none` — T2 в шкале
- Transliteration: `font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-cream/70 mt-1` — T6
- Russian: `font-sans text-[13px] font-semibold text-cream mt-1` — T5
- Divider: `1px bg-cream/20 my-2`
- Number hint (если есть): `font-sans text-[11px] text-cream/80 mt-0` — T6, курсив запрещён — использовать обычный вес

**Ширина:** `w-full max-w-[240px] mx-auto` — центрирован, не растягивается на весь экран

**Анимация появления:**
```css
/* Новый keyframe для вертикального слайда — короче mn-reveal */
@keyframes day-tooltip-in {
  0%  { opacity: 0; transform: translateY(-6px) scale(0.97); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
.day-tooltip-in {
  animation: day-tooltip-in 180ms ease-out both;
}
```

**Скрытие:** При `isTooltipOpen = false` → `display: none` (не анимируем уход — проще, меньше кода)

---

### Состояния (весь компонент)

| Состояние | DayChip | DayTooltip |
|-----------|---------|------------|
| Default | Georgian day visible | hidden |
| Tooltip open | немного затемнён (`opacity-80`) | visible + `day-tooltip-in` |
| Auto-dismiss (5s) | снова полная opacity | hidden |
| Тап на hero-кнопку | DayChip получает stopPropagation | — |

---

## Интеграция в Dashboard.tsx

### Где вставить

Внутри существующей hero-секции, после `{satietyText}` div, в самом низу блока приветствия:

```tsx
{/* ── Georgian day of week chip ── */}
<div className="mt-2 flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
  <DayOfWeekChip />
</div>
```

Обёртка `onClick={stopPropagation}` не даёт тапу на чип открыть Профиль.

### Логика (внутри Dashboard.tsx или отдельный компонент)

```tsx
// Вынести в src/components/DayOfWeekChip.tsx
import { useState, useEffect, useRef } from 'react'
import { getTodayGeorgian } from '../utils/georgianDays'

export default function DayOfWeekChip() {
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const day = getTodayGeorgian()

  function handleTap() {
    if (open) {
      setOpen(false)
      if (timerRef.current) clearTimeout(timerRef.current)
    } else {
      setOpen(true)
      timerRef.current = setTimeout(() => setOpen(false), 5000)
    }
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleTap}
        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-full border border-jewelInk/30
          transition-colors duration-150 active:bg-navy/10
          ${open ? 'opacity-80' : ''}`}
        aria-label={`${day.geo} — тап чтобы узнать перевод`}
        aria-expanded={open}
      >
        <span className="font-geo text-[14px] font-semibold text-navy leading-none">
          {day.geo}
        </span>
        <span className="text-[10px] text-jewelInk/40 leading-none">›</span>
      </button>

      {open && (
        <div
          className="day-tooltip-in jewel-tile px-4 py-3 w-full max-w-[240px] text-center"
          style={{ background: '#1B5FB0' }}
          role="tooltip"
        >
          {/* Georgian name */}
          <div className="font-geo text-[20px] font-extrabold text-cream leading-none">
            {day.geo}
          </div>
          {/* Transliteration */}
          <div className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-cream/70 mt-1">
            {day.translit}
          </div>
          {/* Russian */}
          <div className="font-sans text-[13px] font-semibold text-cream mt-1">
            {day.ru}
          </div>
          {/* Number hint — only Mon–Thu */}
          {day.numberHint && (
            <>
              <div className="my-2 h-px bg-cream/20" />
              <div className="font-sans text-[11px] text-cream/80">
                {day.numberHint}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
```

---

## Копирайтинг

| Элемент | Текст |
|---------|-------|
| aria-label чипа | `«{geo}» — тап чтобы узнать перевод` |
| Тултип — translit | `{syllabic translit}` (строчными — uppercase через CSS) |
| Тултип — Russian | `{ru}` |
| Тултип — hint (пн) | `ორ — часть числа ორი (два)` |
| Тултип — hint (вт) | `სამ — часть числа სამი (три)` |
| Тултип — hint (ср) | `ოთხ — часть числа ოთხი (четыре)` |
| Тултип — hint (чт) | `ხუთ — часть числа ხუთი (пять)` |
| Тултип — hint (пт,сб,вс) | не показывается |

**Запрещено:**
- Добавлять восклицательные знаки к hint-тексту (тон спокойный, не восторженный)
- Писать «Внимание!» или «Знаешь ли ты?» — это перебор
- Этнические акценты в любом копирайте

---

## Анимации

| Элемент | Анимация | Timing |
|---------|----------|--------|
| DayTooltip появление | `day-tooltip-in` 180ms ease-out | при `open = true` |
| DayChip тап | `active:bg-navy/10` transition-colors 150ms | при press |
| DayTooltip исчезновение | `display: none` (без анимации — упрощение) | при `open = false` |

**Новый keyframe добавить в index.css:**
```css
@keyframes day-tooltip-in {
  0%  { opacity: 0; transform: translateY(-6px) scale(0.97); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
.day-tooltip-in {
  animation: day-tooltip-in 180ms ease-out both;
}
```

---

## Файловая структура (новые файлы)

```
src/Trale/miniapp-src/src/
  utils/
    georgianDays.ts        ← статичные данные о 7 днях
  components/
    DayOfWeekChip.tsx      ← DayChip + DayTooltip вместе
```

**Изменения в существующих файлах:**
- `Dashboard.tsx` — добавить `<DayOfWeekChip />` в hero-секцию (3 строки)
- `index.css` — добавить `@keyframes day-tooltip-in` + класс `.day-tooltip-in`

---

## Адаптивность (375px)

- DayChip: `rounded-full px-3 py-2.5` → высота ~40px (tap target 44px с учётом паддинга родителя, достаточно)
- Georgian text 14px → самое длинное имя: `ოთხშაბათი` (9 символов Noto Sans Georgian) ≈ 120px при 14px — помещается в `rounded-full px-3`
- DayTooltip `max-w-[240px]` на 375px экране с `mx-auto` — 240px > 375 - 2×40 (padding) → нет, 240 < 295, всё помещается
- Georgian name в тултипе 20px + 9 символов ≈ 170px < 240px — не переполняется
- Hint-строка `ოთხ — часть числа ოთხი (четыре)` — 30 символов при 11px ≈ умещается в 240px в 1–2 строки

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру: navy (чип текст + тултип фон), cream (текст в тултипе), jewelInk/30 (бордер чипа), gold hairline (jewel-tile внутренняя линия)
- [x] Типографика в рамках шкалы T1-T6: Georgian 20px (T2), Russian 13px (T5), translit 10px (T6), hint 11px (T6), chip 14px (T4)
- [x] Содержит обучающий элемент: 7 дней на грузинском + скрытые числительные пн–чт
- [x] Описан reveal-момент: в модуле «Числительные» узнают ოთხ/სამ/ხუთ/ორ из тултипа дней недели
- [x] Все состояния описаны: default / tooltip-open / auto-dismiss
- [x] Работает на 375px: текст не переполняется, tap target ≥ 44px
- [x] Не нарушает продуктовую философию: пассивное обучение, не заставляет, не стрикует
- [x] Один акцентный цвет на один смысл: navy = день недели (обучение), не перемешивается с ruby/gold
- [x] Бэкенд не нужен: вся логика статичная на фронтенде
