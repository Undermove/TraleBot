# Приветствие Бомборы по времени суток

**Задача:** ROADMAP.md → задача #34
**Статус:** ready

---

## Обучающий элемент

Четыре грузинских приветствия — одни из первых фраз, которые нужны путешественнику. Показывая
нужную фразу при каждом открытии мини-аппа, мы создаём бесплатное пассивное повторение:
пользователь видит одно из четырёх приветствий сотни раз до того, как дойдёт до модуля
«Выживание — Приветствия».

| Время суток | Часы | Georgian | Транслитерация | Значение |
|-------------|------|----------|----------------|---------|
| Утро | 5–11 | **დილა მშვიდობისა** | dila mshvidobisa | доброе утро |
| День | 12–17 | **გამარჯობა** | gamarjoba | привет |
| Вечер | 18–22 | **საღამო მშვიდობისა** | saghamo mshvidobisa | добрый вечер |
| Ночь | 23–4 | **კარგი ღამე** | kargi ghame | спокойной ночи |

**Reveal-момент:** В модуле «Выживание» (Фаза 2.1 «Приветствия») пользователь встречает
эти же фразы в учебном контексте — возникает узнавание «это то, что Бомбора говорила мне
каждое утро!». Эмоциональная привязка к ежедневному ритуалу открытия приложения усиливает
запоминание многократно.

**Культурные заметки по фразе (показываются по тапу):**

| Фраза | Заметка |
|-------|---------|
| დილა მშვიდობისა | «მშვიდობა» — мир, покой. Грузины желают мира с утра. |
| გამარჯობა | «გამარჯვება» — победа. Буквально: «Да победишь!» — воинское пожелание, ставшее универсальным приветствием. |
| საღამო მშვიდობისა | «საღამო» — вечер, «მშვიდობა» — мир. Вечером — то же пожелание спокойствия. |
| კარგი ღამე | «კარგი» — хорошо/добрый, «ღამე» — ночь. Просто и тепло. |

---

## Экраны и состояния

### Экран: Dashboard — Hero-секция (изменение)

Затрагивает только блок приветствия внутри секции `Hero — Bombora tamagotchi + greeting`
(строки 197–270 в Dashboard.tsx). Всё остальное — без изменений.

**Текущий layout приветственного текста:**
```
[ greeting.geo — 12px Georgian, jewrInk-mid ]
[ greeting.line1 — 22px bold Russian ]
[ greeting.line2 — 14px ruby bold ]
[ satietyText — 12px muted ]
```

**Новый layout приветственного текста:**
```
[ time-phrase Georgian 14px ] [ ⓘ 20×20 circle ]
[ transliteration 11px muted ]
[ greeting.line1 — 22px bold Russian ]          ← без изменений
[ greeting.line2 — 14px ruby bold ]             ← без изменений
[ satietyText — 12px muted ]                    ← без изменений
```

Блок с Georgian-фразой и transliteration заменяет текущую строку `greeting.geo`.

---

### Компонент: TimeGreeting (новый)

**Файл:** `src/Trale/miniapp-src/src/components/TimeGreeting.tsx`

**Props:**
```typescript
interface TimeGreetingProps {
  className?: string
}
```

**Логика определения фразы (client-side, без бэкенда):**
```typescript
function getTimePhrase(): TimePhrase {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return TIME_PHRASES.morning
  if (h >= 12 && h < 18) return TIME_PHRASES.day
  if (h >= 18 && h < 23) return TIME_PHRASES.evening
  return TIME_PHRASES.night
}
```

**Константы TIME_PHRASES:**
```typescript
const TIME_PHRASES = {
  morning: {
    geo:       'დილა მშვიდობისა',
    translit:  'dila mshvidobisa',
    russian:   'доброе утро',
    note:      '«მშვიდობა» — мир, покой.\nГрузины желают мира с утра.',
  },
  day: {
    geo:       'გამარჯობა',
    translit:  'gamarjoba',
    russian:   'привет',
    note:      '«გამარჯვება» — победа.\nБуквально: «Да победишь!» — воинское пожелание,\nставшее универсальным приветствием.',
  },
  evening: {
    geo:       'საღამო მშვიდობისა',
    translit:  'saghamo mshvidobisa',
    russian:   'добрый вечер',
    note:      '«საღამო» — вечер, «მშვიდობა» — мир.\nВечером — снова пожелание покоя.',
  },
  night: {
    geo:       'კარგი ღამე',
    translit:  'kargi ghame',
    russian:   'спокойной ночи',
    note:      '«კარგი» — хорошо/добрый,\n«ღამე» — ночь. Просто и тепло.',
  },
}
```

**Состояния компонента:**
- **Default** — Georgian phrase + translit + ⓘ кнопка (кнопка видна всегда)
- **Note expanded** — ниже появляется `CulturalNoteCard` (slide-down)
- **Note already seen this session** — ⓘ кнопка скрыта, остаётся только phrase + translit

**sessionStorage-флаг:** `bombora_time_greeting_noted` — строка с Georgian-фразой (не boolean),
чтобы сбрасывать, если фраза сменилась (утро → вечер в новой сессии).

```typescript
// При монтировании
const seen = sessionStorage.getItem('bombora_time_greeting_noted')
const [noteVisible, setNoteVisible] = useState(false)
const [noteEverOpened, setNoteEverOpened] = useState(seen === phrase.geo)

function handleInfoTap(e: React.MouseEvent) {
  e.stopPropagation()    // не уходить на Profile!
  if (noteEverOpened) return
  setNoteVisible(true)
  setNoteEverOpened(true)
  sessionStorage.setItem('bombora_time_greeting_noted', phrase.geo)
}
```

---

### Sub-компонент: кнопка ⓘ

Появляется только пока `!noteEverOpened`.

```
┌────────────────────────────────────────────────────┐
│  [ time-phrase 14px ]      [ ⓘ 20px circle ]       │
└────────────────────────────────────────────────────┘
```

**CSS кнопки:**
- `w-5 h-5` (20×20 px) — не менее 20px, центрирован символ «i»
- `rounded-full`
- `border border-jewelInk/30`
- `text-jewelInk-mid text-[10px] font-bold leading-none`
- `ml-1 shrink-0 inline-flex items-center justify-center`
- `active:bg-jewelInk/10 transition-colors`
- Tap target расширен через `p-2 -m-2` (padding без визуального увеличения)

Внутри: символ «i» или SVG иконки — без эмодзи.

---

### Sub-компонент: CulturalNoteCard

Появляется под строкой phrase+translit. Анимация `slide-down` (см. ниже).

**Структура (jewel-tile, без pressable):**
```
┌──────────────────────────────────────────────────┐  ← jewel-tile
│  ▏ [georgian-phrase bold 15px]                   │
│  ▏ [translit 11px muted]                         │
│  ▏                                               │
│  ▏ [культурная заметка 12px, 2-3 строки]         │
└──────────────────────────────────────────────────┘
```

**CSS:**
- `jewel-tile` (border 1.5px jewelInk, shadow 3px 3px 0 jewelInk, золотая хейрлайн)
- `px-4 py-3 text-left w-full mt-2`
- `overflow-hidden` — нужно для slide-down анимации

**Типографика:**
- Georgian phrase: `font-geo text-[15px] font-extrabold text-jewelInk leading-tight` — T4
- Translit: `font-sans text-[11px] text-jewelInk-mid mt-0.5 font-semibold tracking-wide` — T6
- Заметка: `font-sans text-[12px] text-jewelInk leading-snug mt-2` — T5
- Разделитель между translit и заметкой: `h-px bg-jewelInk/10 my-2`

**Закрытие карточки:** кнопки «закрыть» нет — карточка не закрывается после открытия.
Это намеренно: пользователь уже потратил «жетон» (сессионный флаг снят), пусть читает спокойно.
Прокрутка вниз убирает карточку из вида естественно.

---

## Изменения в Dashboard.tsx

### 1. Обновить `computeHero`

Удалить `greeting.geo` из возвращаемого объекта `greeting`. Поле `geo` теперь управляется
компонентом `TimeGreeting`, а не `computeHero`.

Изменить тип:
```typescript
greeting: { line1: string; line2: string }  // было: { geo: string; line1: string; line2: string }
```

### 2. Обновить Hero JSX

Заменить строку:
```tsx
<div className="font-geo text-[12px] text-jewelInk-mid leading-none mb-1 font-semibold">
  {greeting.geo}
</div>
```

На:
```tsx
<TimeGreeting />
```

Добавить импорт `TimeGreeting` в Dashboard.tsx.

### 3. Важно: stopPropagation

Кнопка-обёртка Hero (`<button onClick={() => navigate({ kind: 'profile' })}`) должна остаться
как есть. Обработчик `handleInfoTap` в `TimeGreeting` должен вызывать `e.stopPropagation()`
чтобы не триггерить навигацию на Profile при тапе на ⓘ.

---

## Анимации

| Элемент | Анимация | Параметры |
|---------|----------|-----------|
| Появление TimeGreeting | `anim-fade` (уже в index.css) | 600ms ease-out |
| Появление CulturalNoteCard | slide-down (новый) | 280ms ease-out |
| Исчезновение ⓘ после просмотра | opacity fade-out | 200ms ease |

**Новая анимация `mn-slide-down` для index.css:**
```css
@keyframes mn-slide-down {
  0%  { max-height: 0; opacity: 0; transform: translateY(-8px); }
  100%{ max-height: 200px; opacity: 1; transform: translateY(0); }
}
.mn-slide-down {
  animation: mn-slide-down 280ms ease-out both;
  overflow: hidden;
}
```

---

## Копирайтинг

Все тексты в компоненте берутся из константы `TIME_PHRASES` (см. выше).
Дополнительных строк в UI нет — компонент самодостаточен.

**Запрещено:**
- Не добавлять «Сегодня», «Сейчас», «Текущее время» — это снижает ощущение живого приветствия
- Не переводить Georgian фразу на русский прямо под ней — этот перевод только в заметке (учим думать на грузинском)

---

## Адаптивность (375px)

- Georgian phrase «საღამო მშვიდობისა» (самая длинная) при 14px Noto Sans Georgian ≈ 195px.
  В центрированном контейнере 335px поместится с ⓘ (20px + ml-1 = 22px) → суммарно ≈ 220px.
  Запасной вариант: если не помещается в одну строку — ⓘ переходит на новую строку (flex-wrap).
- Translit «saghamo mshvidobisa» при 11px ≈ 155px. Помещается без переноса.
- CulturalNoteCard: максимум 3 строки текста заметки (≈ 52px) + heading блок (≈ 50px) = ~120px.
  На 375px с padding 5×2 = 365px ширина карточки — комфортно.
- Tap target ⓘ: физически 20px, extended touch area 40×40px через `p-2.5 -m-2.5`.

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру: jewelInk для текста, muted variants для translit/note
- [x] Типографика в шкале T1-T6: phrase T4 (14-15px), translit T6 (11px), note T5 (12px)
- [x] Содержит обучающий элемент: 4 приветствия + культурные заметки
- [x] Describe reveal-момент: модуль «Выживание — Приветствия» = узнавание ежедневных фраз
- [x] Все состояния описаны: default, note expanded, note already seen
- [x] Работает на 375px: самая длинная фраза помещается, touch target расширен
- [x] Не нарушает продуктовую философию: нет shame, нет принудительного контента
- [x] Один акцент на смысл: jewel-tile для CulturalNoteCard — cream bg, без цветовых акцентов
- [x] e.stopPropagation() на ⓘ кнопке — не мешает навигации на Profile
- [x] Чисто frontend: нет зависимостей от бэкенда
