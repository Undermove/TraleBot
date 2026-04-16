# Штампы достижений на грузинском (Result-экран)

**Задача:** ROADMAP.md → задача #26
**Статус:** ready

---

## Обучающий элемент

Штамп на Result-экране показывает грузинское слово оценочной лексики:

| Результат | Georgian | Транслит | Значение |
|-----------|----------|----------|----------|
| 100% | **მშვენივრად** | mshvenivrad | превосходно |
| ≥80% | **კარგი** | kargi | хорошо |
| <80% | **ცადე** | tsade | попробуй снова |

Пользователь видит эти три слова при каждом завершении урока → запоминает базовую оценочную лексику без усилий.

**Reveal-момент:** в модуле «Выживание» встречает კარგი и მშვენივრად в живом контексте — «Как дела?» / «Всё хорошо — კარგი!». Эффект: «это слово я видел сотни раз на экране результатов — это то самое "хорошо"!» Эмоциональная привязка к собственным результатам усиливает запоминание.

**Паттерн:** привычный элемент (итог урока) → грузинский контекст (слово-оценка) → reveal в учебном контексте (Survival-модуль).

---

## Экраны и состояния

### Экран: Result — с Georgian-штампом

**Общий layout** (без изменений — только обновляется StampBadge):
```
[ kilim-strip ]
[ confetti-слой (только при 100%) ]

  ┌─────────────────────────┐
  │  [ Бомбора 170px ]      │   ← mood: cheer / happy / think
  │              ┌────────┐ │
  │              │StampBdg│ │   ← поверх Бомборы, правый верхний угол
  │              └────────┘ │
  └─────────────────────────┘

[ mn-eyebrow "итог страницы" ]
[ h1: Отлично / Неплохо / Ещё раз ]
[ sub-text: закрыта страница / нужно 100% ]

[ Grid 3 cols: StatTile верно | опыт | точность ]

[ comment paragraph ]

[ Action bar (fixed bottom) ]
```

**Изменения относительно текущего Result.tsx:**
1. Пороговые значения: `isOK = pct >= 80` (сейчас 50 — нужно исправить до 80)
2. Весь inline stamp-код вынести в компонент `StampBadge`
3. Транслитерации заменить: `'превосходно' / 'хорошо' / 'попробуй'` → `'mshvenivrad' / 'kargi' / 'tsade'`
4. Цвета штампа дифференцировать по уровню (описано ниже)

---

### Компонент: StampBadge (новый)

Заменяет inline-реализацию в Result.tsx. Это jewel-style плашка с Minankari-оформлением.

**Файл:** `src/Trale/miniapp-src/src/components/StampBadge.tsx`

**Props:**
```typescript
interface StampBadgeProps {
  variant: 'great' | 'ok' | 'retry'
  animate?: boolean   // default: true
  className?: string
}
```

**Варианты и цвета:**

| variant | Условие | Fill | Цвет текста | Хейрлайн |
|---------|---------|------|-------------|----------|
| `great` | correct === total | `ruby` #E01A3C | `cream` #FBF6EC | `gold/40` |
| `ok` | pct ≥ 80 | `navy` #1B5FB0 | `cream` #FBF6EC | `gold/40` |
| `retry` | pct < 80 | `gold` #F5B820 | `jewelInk` #15100A | `gold-deep/50` |

**Структура элемента:**
```
╔═══════════════════════╗  ← solid fill (ruby/navy/gold)
║                       ║     border: 1.5px jewelInk
║   მშვენივრად          ║     box-shadow: 2px 2px 0 #15100A
║   mshvenivrad         ║     ::before: gold hairline (inset 2px, 1px border)
║                       ║
╚═══════════════════════╝
```

**CSS-детали контейнера:**
- `px-3 py-2.5 text-center`
- `border-[1.5px] border-jewelInk`
- `rounded-lg` (border-radius ~10px)
- `box-shadow: 2px 2px 0 #15100A` (Minankari offset shadow)
- `min-w-[80px]` — чтобы короткое ცადე (5 символов) не выглядело обрывком
- `::before`: `position: absolute; inset: 2px; border: 1px solid gold/40; border-radius: 8px` — внутренняя золотая хейрлайн (как у `jewel-tile`)
  - Для `retry` (gold bg): хейрлайн `gold-deep/50` (#C68F10 с 50% прозрачностью)

**Типографика:**
- Georgian word: `font-geo text-[18px] font-extrabold leading-none` — T3 в шкале
- Transliteration: `font-sans text-[9px] font-bold uppercase tracking-[0.08em] mt-1 opacity-60` — T6 в шкале

**Позиционирование в Result.tsx:**
- `position: absolute` относительно обёртки Бомборы
- Смещение: `-top-1 -right-4` (6 градусов по часовой = `rotate-[6deg]`)
- Обёртка Бомборы: `position: relative`

**Анимация:**
- При монтировании: используем уже определённый в index.css класс `mn-reveal`
  ```css
  /* уже существует: */
  @keyframes mn-reveal {
    0% { transform: scale(0.6) rotate(-8deg); opacity: 0; }
    65% { transform: scale(1.08) rotate(1deg); opacity: 1; }
    100% { transform: scale(1) rotate(0); opacity: 1; }
  }
  .mn-reveal { animation: mn-reveal 520ms cubic-bezier(0.2, 1.3, 0.3, 1) both; }
  ```
- Задержка: `animation-delay: 150ms` — чтобы сначала появился Маскот, потом штамп
- `animate` prop = false → без анимации (для снимков экрана / тестов)

---

### Обновление Stamp.tsx (legacy-компонент)

Stamp.tsx — унаследованный компонент со старыми цветовыми именами (wine/moss/saffron/sky). Обновить только палитру до Minankari-токенов, функционал и внешний вид — без изменений.

**Изменения в Stamp.tsx:**
- Добавить поддержку Minankari-цветов: `'ruby' | 'navy' | 'gold'`
- Добавить маппинг для обратной совместимости:
  - `wine` → рендерится через `text-ruby border-ruby`
  - `saffron` → рендерится через `text-gold-deep border-gold-deep`
  - `sky` → рендерится через `text-navy border-navy`
  - `moss` → рендерится через `text-jewelInk border-jewelInk`
- Шрифт в `.stamp` в index.css: заменить `'Fraunces'` на `'Manrope'` (ясное нарушение: Fraunces не входит в Minankari)

**Примечание:** Stamp.tsx в Result-экране больше не используется — там будет StampBadge. Stamp.tsx остаётся для потенциального применения в других экранах.

---

## Состояния Result-экрана

| Состояние | variant | Бомбора mood | h1 | h2 subtitle | Action bar |
|-----------|---------|-------------|-----|-------------|-----------|
| 100% | `great` | `cheer` | «Отлично» | «страница N закрыта» | «следующий урок →» (если есть) / «к карте уроков →» |
| ≥80% | `ok` | `happy` | «Неплохо» | «страница N — нужно 100%» | «к карте уроков →» |
| <80% | `retry` | `think` | «Ещё раз» | «страница N — нужно 100%» | «к карте уроков →» |
| vocab quiz | — | по pct | по pct | «квиз по словарю завершён» | «к словарю →» |

**Пороговые значения в коде:**
```typescript
const isPerfect = correct === total         // → 'great'
const isOK = pct >= 80 && !isPerfect        // → 'ok'  (NB: изменить с 50 на 80)
// иначе                                    // → 'retry'
```

---

## Копирайтинг

| Элемент | Текст |
|---------|-------|
| Stamp Georgian (100%) | `მშვენივრად` |
| Stamp translit (100%) | `mshvenivrad` |
| Stamp Georgian (≥80%) | `კარგი` |
| Stamp translit (≥80%) | `kargi` |
| Stamp Georgian (<80%) | `ცადე` |
| Stamp translit (<80%) | `tsade` |
| h1 (100%) | `Отлично` |
| h1 (≥80%) | `Неплохо` |
| h1 (<80%) | `Ещё раз` |
| Comment (100%) | `Так держать. Блокнот пополняется с каждой страницей.` |
| Comment (≥80%) | `Ответь правильно на все вопросы, чтобы закрыть страницу.` |
| Comment (<80%) | `Перечитай теорию и попробуй ответить на все вопросы.` |

**Ограничения copy:**
- Транслитерация — фонетическая (mshvenivrad), не перевод на русский
- h1 остаётся на русском — это понятный итог урока
- Грузинский — только на штампе (один обучающий элемент, не перегружать)

---

## Анимации

| Элемент | Анимация | Задержка |
|---------|----------|----------|
| StampBadge появление | `mn-reveal` 520ms cubic-bezier | 150ms |
| Mascot появление | `anim-page` 360ms ease-out | 0ms |
| Confetti (100% only) | `confetti` 1.8s, 32 элемента | 0ms |
| h1 появление | `anim-fade` 600ms | нет (уже есть) |

Последовательность восприятия: Маскот (радость/задумчивость) → Штамп (лёгкое притяжение взгляда, bounce) → h1 (подтверждение на русском).

---

## Адаптивность (375px)

- Georgian word 18px + translit 9px + padding 2.5/3 → StampBadge высота ~54px, ширина ~100-130px
- Mascot 170px по центру — Badge в `-right-4` выходит за правую границу контейнера Mascot, но остаётся в пределах 375px экрана (Mascot центрирован, padding экрана 20px)
- Самое длинное слово: `მშვენივრად` (10 символов) при 18px Noto Sans Georgian ≈ 120px ширина; в 375px - 40px отступов = 335px — поместится без переноса
- Штамп не кликабелен — tap targets не применимо

---

## Технические заметки для Developer

1. **Создать** `StampBadge.tsx` в `src/components/`
2. **Обновить** `Result.tsx`:
   - Убрать inline stamp div (~15 строк), заменить на `<StampBadge variant={...} />`
   - Изменить: `const isOK = pct >= 80 && !isPerfect` (было 50)
   - Убрать переменные `stampGeo`, `stampTrans` (переехали в StampBadge)
3. **Обновить** `Stamp.tsx`: добавить Minankari цвета, маппинг legacy → Minankari, сменить шрифт в `.stamp` в index.css на Manrope
4. **Добавить в index.css**: задержка для mn-reveal: `.mn-reveal-delayed { animation: mn-reveal 520ms 150ms cubic-bezier(0.2, 1.3, 0.3, 1) both; }` — или передавать `animationDelay` в style

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру (ruby/navy/gold для fill, cream для text на dark fills, jewelInk для text на gold fill)
- [x] Типографика в шкале T1-T6: Georgian word T3 (18px), translit T6 (9px)
- [x] Содержит обучающий элемент: 3 слова оценочной лексики (მშვენივრად, კარგი, ცადე)
- [x] Описан reveal-момент: встреча კარგი/მშვენივრად в Survival-модуле
- [x] Все состояния описаны: great (100%) / ok (≥80%) / retry (<80%)
- [x] Работает на 375px: text не переполняется, Badge в пределах экрана
- [x] Не нарушает продуктовую философию: нет shame/guilt при <80%, нейтральное ცადე
- [x] Один акцентный цвет на один смысл: ruby=успех, navy=хороший результат, gold=нужно повторить
