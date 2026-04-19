# «Грузинское имя» — имя пользователя в грузинской транслитерации на Profile

**Задача:** ROADMAP.md → задача #36
**Статус:** ready

---

## Обучающий элемент

Самый сильный мнемонический якорь — собственное имя. Пользователь видит свой никнейм из Telegram
написанным грузинским алфавитом уже при первом открытии профиля — ещё до того, как знает
хоть одну букву. Это создаёт личную цель: «хочу понять, как написано моё имя».

**Reveal-момент (двухфазный):**

1. **До изучения алфавита** — грузинское имя показывается вместе с транслитерацией
   (latin под каждой буквой) и подсказкой «Учи алфавит — и сможешь прочитать это сам».
2. **После завершения модуля Алфавит** (все 7 уроков пройдены) — транслитерация
   скрывается. Появляется badge «Ты можешь читать своё имя!». Пользователь видит только
   грузинские буквы — и понимает их. Момент узнавания: «Я изучил грузинский достаточно,
   чтобы прочитать собственное имя».

Бомбора реагирует радостным «mood=cheer» и фразой «ქართულად შენ ხარ ___!»
(«По-грузински ты — [имя]!»).

---

## Источник имени

Имя берётся из **Telegram WebApp API** на стороне клиента — никакого нового бэкенда не нужно:

```typescript
const tg = (window as any).Telegram?.WebApp
const firstName: string | undefined = tg?.initDataUnsafe?.user?.first_name
```

Если `first_name` недоступен (dev-режим, browser без Telegram) — секция скрывается целиком.

---

## Транслитерация (client-side)

Двухуровневая логика — без обращений к серверу:

### Уровень 1 — словарь распространённых имён

~60 часто встречающихся русских имён с их традиционными грузинскими эквивалентами.
Традиционные грузинские формы имён отличаются от механической транслитерации
(Иван → ივანე, а не Иван → ივან).

```typescript
const NAME_DICT: Record<string, { geo: string; translit: string }> = {
  'иван':      { geo: 'ივანე',     translit: 'ivane' },
  'мария':     { geo: 'მარია',     translit: 'maria' },
  'александр': { geo: 'ალექსანდრე', translit: 'aleksandre' },
  'анна':      { geo: 'ანა',       translit: 'ana' },
  'дмитрий':   { geo: 'დიმიტრი',   translit: 'dimitri' },
  'михаил':    { geo: 'მიხეილ',    translit: 'mikheil' },
  'елена':     { geo: 'ელენე',     translit: 'elene' },
  'николай':   { geo: 'ნიკოლაი',   translit: 'nikolai' },
  'ольга':     { geo: 'ოლღა',      translit: 'olgha' },
  'сергей':    { geo: 'სერგი',     translit: 'sergi' },
  'татьяна':   { geo: 'ტატიანა',   translit: 'tatiana' },
  'андрей':    { geo: 'ანდრეი',    translit: 'andrei' },
  'екатерина': { geo: 'ეკატერინე', translit: 'ekaterine' },
  'алексей':   { geo: 'ალექსი',    translit: 'aleksi' },
  'наталья':   { geo: 'ნატალია',   translit: 'natalia' },
  'владимир':  { geo: 'ვლადიმირ',  translit: 'vladimir' },
  'юлия':      { geo: 'იულია',     translit: 'iulia' },
  'виктор':    { geo: 'ვიქტორ',    translit: 'viktor' },
  'светлана':  { geo: 'სვეტლანა',  translit: 'svetlana' },
  'павел':     { geo: 'პავლე',     translit: 'pavle' },
  'нина':      { geo: 'ნინო',      translit: 'nino' },
  'георгий':   { geo: 'გიორგი',    translit: 'giorgi' },
  'максим':    { geo: 'მაქსიმ',    translit: 'maksim' },
  'sofia':     { geo: 'სოფია',     translit: 'sophia' },
  'sofia':     { geo: 'სოფია',     translit: 'sophia' },
  'антон':     { geo: 'ანტონ',     translit: 'anton' },
  'кирилл':    { geo: 'კირილე',    translit: 'kirile' },
  'оксана':    { geo: 'ოქსანა',    translit: 'oksana' },
  'игорь':     { geo: 'იგორ',      translit: 'igor' },
  'ирина':     { geo: 'ირინა',     translit: 'irina' },
  'алина':     { geo: 'ალინა',     translit: 'alina' },
  'илья':      { geo: 'ილია',      translit: 'ilia' },
  'тимур':     { geo: 'თიმური',    translit: 'timuri' },
  'артём':     { geo: 'არტემ',     translit: 'artem' },
  'арtem':     { geo: 'არტემ',     translit: 'artem' },
  'даниил':    { geo: 'დანიელ',    translit: 'daniel' },
  'денис':     { geo: 'დენი',      translit: 'deni' },
  'роман':     { geo: 'რომანი',    translit: 'romani' },
  'семён':     { geo: 'სიმონ',     translit: 'simon' },
  'нади':      { geo: 'ნადია',     translit: 'nadia' },
  'надежда':   { geo: 'ნადეჟდა',   translit: 'nadezhda' },
  'ксения':    { geo: 'ქსენია',    translit: 'ksenia' },
  'вера':      { geo: 'ვერა',      translit: 'vera' },
  'тамара':    { geo: 'თამარა',    translit: 'tamara' },
  'evgeny':    { geo: 'ევგენი',    translit: 'evgeni' },
  'евгений':   { geo: 'ევგენი',    translit: 'evgeni' },
  'евгения':   { geo: 'ევგენია',   translit: 'evgenia' },
  'станислав': { geo: 'სტანისლავ', translit: 'stanislav' },
  'валерия':   { geo: 'ვალერია',   translit: 'valeria' },
  'полина':    { geo: 'პოლინა',    translit: 'polina' },
  'карина':    { geo: 'კარინა',    translit: 'karina' },
  'кристина':  { geo: 'ქრისტინე',  translit: 'kristine' },
  'маша':      { geo: 'მაშა',      translit: 'masha' },
  'саша':      { geo: 'საშა',      translit: 'sasha' },
  'коля':      { geo: 'კოლია',     translit: 'kolia' },
}
```

### Уровень 2 — символьная транслитерация (fallback)

Если имя не найдено в словаре, применяется посимвольная замена:

**Кириллица → Грузинский:**
```
А→ა  Б→ბ  В→ვ  Г→გ  Д→დ  Е→ე  Ё→ო  Ж→ჟ
З→ზ  И→ი  Й→ი  К→კ  Л→ლ  М→მ  Н→ნ  О→ო
П→პ  Р→რ  С→ს  Т→ტ  У→უ  Ф→ფ  Х→ხ  Ц→ც
Ч→ჩ  Ш→შ  Щ→შ  Ъ→∅  Ы→ი  Ь→∅  Э→ე  Ю→იუ  Я→ია
```

**Латиница → Грузинский:**
```
a→ა  b→ბ  c→კ  d→დ  e→ე  f→ფ  g→გ  h→ხ
i→ი  j→ჯ  k→კ  l→ლ  m→მ  n→ნ  o→ო  p→პ
q→ქ  r→რ  s→ს  t→ტ  u→უ  v→ვ  w→ვ  x→ქს
y→ი  z→ზ
```

Регистр не важен: сначала `.toLowerCase()`, потом поиск.
Если имя уже в грузинском (U+10A0–U+10FF) — показывается без изменений, translit не нужен.

**Функция:**
```typescript
function transliterateToGeorgian(name: string): { geo: string; translit: string } | null {
  if (!name || name.trim().length === 0) return null
  const key = name.trim().toLowerCase()
  if (NAME_DICT[key]) return NAME_DICT[key]
  // Fallback: char-by-char
  const geo = key.split('').map(c => CHAR_MAP[c] ?? c).join('')
  const translit = key  // исходное имя и есть translit для латиницы; для кириллицы — отдельная таблица
  return { geo, translit: name }
}
```

---

## Экраны и состояния

### Экран: Profile — секция «Моё грузинское имя»

**Расположение:** после блока «мой алфавит» (learnedCount-виджет), перед «любимый раздел».

```
[ мой алфавит ]     ← уже существует
[ → МОЁ ИМЯ ← ]    ← новое
[ любимый раздел ]  ← уже существует
```

**Layout карточки (phase 1 — до изучения Алфавита):**

```
┌────────────────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← gold hairline (jewel-tile)
│                                                            │
│  [МОЁ ИМЯ ПО-ГРУЗИНСКИ   navy eyebrow]                    │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                      │  │
│  │       ი  ვ  ა  ნ  ე                                  │  │  ← Georgian name, 36px extrabold
│  │       i  v  a  n  e                                  │  │  ← translit 11px muted, letter-spacing wide
│  │                                                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  [mascot guide 32px]  ქართულად შენ ხარ ივანე!        │  │  ← Bombora comment, 12px
│  │                       На грузинском ты — Иване!      │  │  ← русский перевод, 11px muted
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  [подсказка: Выучи Алфавит — сможешь прочитать это сам]   │  ← 11px hint, navy, только phase 1
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Layout карточки (phase 2 — Алфавит пройден, reveal):**

```
┌────────────────────────────────────────────────────────────┐
│  [МОЁ ИМЯ ПО-ГРУЗИНСКИ   navy eyebrow]     [★ знаю 33/33] │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                                                      │  │
│  │       ი  ვ  ა  ნ  ე                                  │  │  ← Georgian name (без translit)
│  │                                                      │  │  ← translit исчез (fade-out 300ms)
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  [mascot cheer 32px]  ქართულად შენ ხარ ივანე!        │  │  ← mood=cheer вместо guide
│  │                       На грузинском ты — Иване!      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  [ ✓ Ты можешь прочитать своё имя!  gold badge ]          │  ← только при reveal, 2 сек
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

### Состояния секции

| Состояние | Условие | Отображение |
|-----------|---------|-------------|
| **Скрыта** | `firstName` недоступен или транслитерация вернула null | Секция не рендерится |
| **Phase 1** | Алфавит не завершён (не все 7 уроков пройдены) | Имя + translit + подсказка + mascot guide |
| **Phase 2** | Все уроки Алфавита пройдены | Имя без translit + badge (2с) + mascot cheer |

Определение «алфавит завершён»:
```typescript
const alphabetModule = catalog.modules.find(m => m.id === 'alphabet-progressive')
const alphabetDone = alphabetModule
  ? alphabetModule.lessons.every(l => progress.completedLessons.includes(`alphabet-progressive:${l.id}`))
  : false
```

---

## Компонент: GeorgianNameCard (новый)

**Файл:** `src/Trale/miniapp-src/src/components/GeorgianNameCard.tsx`

**Props:**
```typescript
interface GeorgianNameCardProps {
  firstName: string          // из Telegram.WebApp.initDataUnsafe.user.first_name
  alphabetDone: boolean      // все уроки алфавита пройдены
}
```

**Внутреннее состояние:**
```typescript
const result = transliterateToGeorgian(firstName)
// если null — компонент возвращает null (не рендерится)

const [revealShown, setRevealShown] = useState(false)

useEffect(() => {
  if (alphabetDone && !revealShown) {
    setRevealShown(true)
    // badge исчезает через 2.5с (управляется opacity transition)
  }
}, [alphabetDone])
```

---

### Верстка компонента

**Внешний контейнер:**
```tsx
<div className="jewel-tile px-5 py-4 mb-5 relative overflow-hidden">
```

**Eyebrow + badge:**
```tsx
<div className="flex items-center justify-between mb-3">
  <div className="mn-eyebrow">моё имя по-грузински</div>
  {alphabetDone && (
    <div className="mn-eyebrow text-navy">★ знаю 33/33</div>
  )}
</div>
```

**Блок с именем:**
```tsx
<div className="text-center py-3 px-2 bg-cream/60 rounded-lg border border-jewelInk/10">
  {/* Грузинское имя — побуквенно для правильного межбуквенного расстояния */}
  <div
    className="font-geo font-extrabold text-jewelInk leading-none tracking-widest"
    style={{ fontSize: clampFontSize(result.geo) }}  // 36px → 24px для длинных имён
  >
    {result.geo}
  </div>

  {/* Транслитерация — исчезает после reveal */}
  <div
    className="font-sans text-[11px] text-jewelInk-mid mt-1.5 tracking-widest uppercase font-semibold"
    style={{
      opacity: alphabetDone ? 0 : 1,
      transition: 'opacity 400ms ease-out',
      pointerEvents: 'none',
    }}
  >
    {result.translit}
  </div>
</div>
```

**Bombora comment:**
```tsx
<div className="flex items-start gap-3 mt-4">
  <div className="shrink-0">
    <Mascot mood={alphabetDone ? 'cheer' : 'guide'} size={32} />
  </div>
  <div className="flex-1">
    <div className="font-geo text-[14px] font-bold text-jewelInk leading-tight">
      ქართულად შენ ხარ {result.geo}!
    </div>
    <div className="font-sans text-[12px] text-jewelInk-mid mt-0.5">
      На грузинском ты — {firstName}!
    </div>
  </div>
</div>
```

**Подсказка (phase 1 only):**
```tsx
{!alphabetDone && (
  <div className="font-sans text-[11px] text-navy/70 text-center mt-3">
    Выучи Алфавит — сможешь прочитать без подсказки
  </div>
)}
```

**Reveal badge (phase 2, временный):**
```tsx
{revealShown && (
  <div className="absolute inset-0 flex items-end justify-center pb-3 pointer-events-none">
    <div
      className="bg-gold border-[1.5px] border-jewelInk rounded-full px-4 py-1.5 anim-fade"
      style={{ animationDuration: '200ms' }}
    >
      <span className="font-sans text-[12px] font-extrabold text-jewelInk">
        ✓ Ты можешь прочитать своё имя!
      </span>
    </div>
  </div>
)}
```

---

### Вспомогательная функция clampFontSize

Автоуменьшение для длинных имён (> 8 букв):

```typescript
function clampFontSize(geo: string): string {
  if (geo.length <= 6) return '36px'
  if (geo.length <= 9) return '28px'
  return '22px'
}
```

---

## Интеграция в Profile.tsx

### Получение firstName

В компоненте Profile, рядом с `const tg = (window as any).Telegram?.WebApp`:
```typescript
const tgFirstName: string | undefined = tg?.initDataUnsafe?.user?.first_name
```

### Расчёт alphabetDone

```typescript
const alphabetModule = catalog.modules.find(m => m.id === 'alphabet-progressive')
const alphabetDone = Boolean(
  alphabetModule &&
  alphabetModule.lessons.every(l =>
    progress.completedLessons?.includes(`alphabet-progressive:${l.id}`)
  )
)
```

> Примечание: `progress.completedLessons` — существующий массив в ProgressState.
> Если его нет в типах — использовать `progress.done[moduleId]` или аналог из текущей структуры.

### JSX placement

```tsx
{/* My Alphabet widget */}
<div className="mn-eyebrow mb-2">мой алфавит</div>
{/* ... существующий виджет ... */}

{/* Georgian Name */}
{tgFirstName && (
  <GeorgianNameCard
    firstName={tgFirstName}
    alphabetDone={alphabetDone}
  />
)}

{/* Favorite module */}
{favorite && favorite.done > 0 && (
  // ...
)}
```

---

## Копирайтинг

| Элемент | Текст |
|---------|-------|
| Eyebrow | «моё имя по-грузински» |
| Badge (phase 2) | «★ знаю 33/33» |
| Bombora phrase (Georgian) | «ქართულად შენ ხარ {имя}!» |
| Bombora phrase (Russian) | «На грузинском ты — {firstName}!» |
| Hint (phase 1) | «Выучи Алфавит — сможешь прочитать без подсказки» |
| Reveal badge | «✓ Ты можешь прочитать своё имя!» |

**Запрещено:**
- Не использовать «транскрипция» — правильно «по-грузински»
- Не писать «твоё грузинское имя» — имя остаётся русским/латинским, меняется только написание
- Не добавлять кнопку «поделиться» — это личный, не соревновательный момент

---

## Анимации

| Элемент | Анимация | Параметры |
|---------|----------|-----------|
| Появление секции | `anim-fade` | 600ms ease-out (как остальные секции Profile) |
| Translit исчезает после reveal | opacity 1→0 | 400ms ease-out |
| Reveal badge появляется | `anim-fade` | 200ms ease-out |
| Reveal badge исчезает | opacity fade-out | setTimeout 2500ms → opacity 0, 300ms |
| Mascot mood смена | Без анимации — Mascot сменяет mood при перерендере | — |

---

## Адаптивность (375px)

- Самое длинное возможное имя в словаре: «ეკატერინე» (9 букв) → fontSize 28px,
  ширина ≈ 230px. В контейнере 335px (с padding 5×2) — помещается с отступами.
- Символьный fallback может создать очень длинное имя (→ fontSize 22px, word-break normal).
- `tracking-widest` с `letter-spacing: 0.1em` — дополнительно расширяет имя.
  При 9+ буквах: `tracking-normal` вместо `tracking-widest`.
- Bombora comment: flex row, Mascot 32px + текст в flex-1. При длинном тексте
  переносится — `leading-tight` сохраняет компактность.
- Tap targets: у блока нет активных элементов (reveal badge — pointer-events: none).
  Нет проблем с доступностью тапа.

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру: navy eyebrow, gold badge, jewelInk текст
- [x] Типографика в шкале T1-T6: имя 36px (T2), translit 11px (T6), комментарий 12-14px (T5-T4)
- [x] Содержит обучающий элемент: грузинская транслитерация имени + reveal после алфавита
- [x] Reveal-момент описан: завершение модуля Алфавит → читаешь своё имя без подсказки
- [x] Все состояния описаны: скрыта / phase 1 / phase 2 reveal
- [x] Работает на 375px: font-size clamping, flex layout, без overflow
- [x] Не нарушает продуктовую философию: нет принуждения, нет шейминга, личное и необязательное
- [x] Чисто frontend: Telegram WebApp initDataUnsafe + client-side transliteration, без нового backend
- [x] Один акцент на смысл: navy для eyebrow, gold для reveal-badge
- [x] Секция скрыта при отсутствии имени — нет пустых состояний

---

## Файлы к созданию / изменению

| Файл | Действие |
|------|---------|
| `src/Trale/miniapp-src/src/components/GeorgianNameCard.tsx` | Создать |
| `src/Trale/miniapp-src/src/screens/Profile.tsx` | Добавить секцию + получение firstName |
