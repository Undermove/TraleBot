# Карточка слова в словаре + удаление

**Задача:** ROADMAP.md → задача #16
**Статус:** ready

---

## Обучающий элемент

**Грузинские метки уровней усвоения:**

| Mastery | Грузинский | Произношение | Значение |
|---------|-----------|--------------|---------|
| `NotMastered` | `ახალი` | akhali | новый |
| `MasteredInForwardDirection` | `სწავლობს` | tsvavlobs | изучается |
| `MasteredInBothDirections` | `ათვისებული` | atvissebuli | освоено |

**Паттерн:** пользователь открывает карточку слова десятки раз — каждый раз видит Georgian метку уровня рядом с визуальным индикатором (точки). Слово запоминается через контекст (мой словарь + моё усвоение = мой прогресс).

**Reveal-момент:** в модуле «Выживание» (Фаза 2) или в теории словаря пользователь встретит слово `ახალი` (новый) и `ათვისებული` (освоено/усвоенный) — и узнает их: «это то, что написано у меня в карточках слов». Двойное закрепление: функциональный контекст + учебный.

**Статистическая строка** использует грузинские сокращения: `სწ.` (სწორი — правильно), `უკ.` (უკუ — обратное), `შეც.` (შეცდომა — ошибка). Пользователь видит их при каждом просмотре карточки.

---

## Взаимодействие: разделение tap-зон

**Текущая проблема:** каждая строка в `VocabularyList.tsx` — единый `<button>`, который переключает выделение для квиза. Нужно добавить второй тип действия — открытие карточки.

**Новая модель:**

```
[ чекбокс ]  [ ─────── основной контент ─────── ] [ dot ]
   ↑ tap                     ↑ tap                   
  toggle                  opens card
  selection               (bottom sheet)
```

- **Левая зона** (чекбокс + порядковый номер, ~52px ширина): `onClick = toggle(id)`. Только в не-стартерном режиме.
- **Правая зона** (Georgian слово + русский перевод + dot): `onClick = openCard(item)`. Работает всегда.
- Вся строка перестаёт быть `<button>`, становится `<div role="listitem">` с двумя интерактивными зонами внутри.
- Tap target для каждой зоны: минимум 44px высотой (обеспечено `py-3` + `min-h-[56px]`).
- В **стартерном режиме** (нет чекбоксов): вся строка целиком открывает карточку.

**Визуальная подсказка:** рядом с Georgian словом — маленькая иконка `›` (chevron, 12×12, `text-jewelInk/30`), чтобы намекнуть «тут можно тапнуть». Появляется при первом рендере.

---

## Экраны и состояния

### Компонент: WordCard (bottom sheet)

Открывается снизу при тапе на строку слова. Аналогичен `ProPaywall.tsx` по механике.

**Layout (375px):**

```
┌──────────────────────────────────────────┐ ← полупрозрачный backdrop 40%
│                                          │
│  ╔════════════════════════════════════╗  │ ← bottom sheet
│  ║  ── drag-handle (32×4px) ──        ║  │   cream bg, rounded-t-2xl
│  ║                                    ║  │
│  ║  [mn-eyebrow: "ლექსიკონი · слово"] ║  │   T6, gold eyebrow
│  ║                                    ║  │
│  ║  კარგი                             ║  │   T1 (28px), extrabold, font-geo
│  ║  хорошо                            ║  │   T3 (18px), semibold, jewelInk
│  ║  [karg-i]  ← если есть             ║  │   T6 (12px), hint, Manrope
│  ║                                    ║  │
│  ║  ┌────────────────────────────┐    ║  │
│  ║  │  ●●  ათვისებული            │    ║  │   jewel-tile, mastery block
│  ║  │  освоено в обоих направл.  │    ║  │   T6, hint text
│  ║  └────────────────────────────┘    ║  │
│  ║                                    ║  │
│  ║  «Это очень хорошо» — example      ║  │   T5 (14px), italic, hint
│  ║  [additionalInfo если есть]        ║  │   T6 (12px), hint
│  ║                                    ║  │
│  ║  ── [ink-divider] ──               ║  │
│  ║                                    ║  │
│  ║  სწ.    уკ.    შეც.    📅          ║  │
│  ║  12 ✓   5 ✓    2 ✗    22 апр.     ║  │   T6 stats row
│  ║                                    ║  │
│  ║  ─────────────────────────────     ║  │
│  ║  [ ☑ Добавить в квиз ]            ║  │   navy jewel-btn
│  ║  [ Удалить слово   ]              ║  │   ghost jewel-btn, ruby text
│  ╚════════════════════════════════════╝  │
└──────────────────────────────────────────┘
```

---

### Секция 1: Идентификация слова

**Порядок элементов:**

1. **Eyebrow** (T6): `ლექსიკონი · слово` — gold, uppercase, Manrope
2. **Georgian word** (T1, 28px): `font-geo font-extrabold text-jewelInk` — главный элемент, крупно
3. **Russian translation** (T3, 18px): `font-sans font-semibold text-jewelInk`
4. **Transcription** (T6, 12px): `[karg-i]` — `text-jewelInk-hint`, показывается только если поле не пустое

Транскрипция — поле, которого нет в текущем `VocabularyItem`. Технически: поле можно заполнить из `additionalInfo` (первая строка, если содержит скобки) или оставить пустым в v1.

---

### Секция 2: Уровень усвоения (Mastery block)

**Компонент:** `MasteryIndicator` (новый, используется только в WordCard)

```
╔══════════════════════════════════════╗
║                                      ║  ← jewel-tile, cream bg
║  ● ●  ათვისებული         освоено    ║
║       в обоих направлениях           ║
╚══════════════════════════════════════╝
```

**Варианты:**

| Mastery | Точки | Georgian | Подпись |
|---------|-------|---------|---------|
| `NotMastered` | `○ ○` | `ახალი` | ещё не практиковалось |
| `MasteredInForwardDirection` | `● ○` | `სწავლობს` | одно направление освоено |
| `MasteredInBothDirections` | `● ●` | `ათვისებული` | оба направления освоены |

**Стили точек:**
- Точка заполнена: `w-3 h-3 rounded-full bg-navy border border-jewelInk` 
- Точка пустая: `w-3 h-3 rounded-full bg-cream border border-jewelInk/40`
- Расстояние между точками: `gap-1.5`

**Georgian label** (T5, 13px): `font-geo font-bold text-jewelInk` — рядом с точками через `gap-3`

**Подпись** (T6, 11px): `text-jewelInk-mid` — под строкой с точками и Georgian-словом

**Размеры:** min-height 52px, `px-4 py-3`

---

### Секция 3: Пример и доп. информация

```
«Это очень кارგад»
[additionalInfo: разговорное, также: ნამდვილად კаргად]
```

- **Example** (T5, 14px): `font-sans text-jewelInk/80`, курсив допустим только здесь (пример употребления — цитата, не UI)
- **additionalInfo** (T6, 12px): `font-sans text-jewelInk-hint`
- Если `example` пустой — секция не показывается

**Техническое замечание:** поле `additionalInfo` отсутствует в текущем `VocabularyItem` DTO. Backend нужно добавить его в ответ `/api/miniapp/vocabulary`. В v1 — секция отображается только при наличии `example`.

---

### Секция 4: Статистика

```
[ სწ.  12 ✓ ]  [ უკ.  5 ✓ ]  [ შეც.  2 ✗ ]  [ 22 апр. ]
```

**Layout:** `grid grid-cols-4 gap-2`

Каждая ячейка:
```
[Georgian abbr.]
[число  иконка ]
```

| Ячейка | Georgian | Данные | Иконка |
|--------|---------|--------|--------|
| Правильно | `სწ.` | `successCount` | ✓ navy |
| Обратное | `უკ.` | `successReverseCount` | ✓ navy |
| Ошибки | `შეც.` | `failedCount` | ✗ ruby |
| Дата | `📅` | `dateAddedUtc` | — |

- Georgian аббревиатуры (T6, 10px): `font-geo text-jewelInk-hint`
- Число (T4, 15px): `font-sans font-extrabold tabular-nums text-jewelInk`
- Иконка: 10px SVG inline

**Дата:** форматируется как «22 апр.», «1 янв.» (русская сокращённая). Если `dateAddedUtc === null` — показывать `—`.

---

### Секция 5: Action buttons

**Default state:**

```
[ ☑ Добавить в квиз ]   ← navy jewel-btn, полная ширина
[ Удалить слово ]        ← ghost jewel-btn (cream bg), ruby-текст
```

- «Добавить в квиз»: `variant="primary"` (navy). При нажатии — слово добавляется в set `selected` в родительском компоненте, карточка закрывается.
- Текст кнопки меняется: «Добавить в квиз» / «Убрать из квиза» (если уже выбрано).
- Иконка: ☑ / ✓ 14px перед текстом — меняется вместе с текстом.
- «Удалить слово»: `variant="ghost"`, текст `text-ruby`, без ruby background (чтобы не пугать). 

**State: confirmation**

После тапа на «Удалить слово» кнопки заменяются confirmation-блоком с анимацией `mn-reveal`:

```
╔══════════════════════════════════════╗
║  Удалить «კარგი» из словаря?        ║  ← T5, jewelInk
║                                      ║
║  [ Да, удалить ]  [ Отмена ]         ║
╚══════════════════════════════════════╝
```

- «Да, удалить»: `jewel-btn-ruby` (ruby fill, cream text), половина ширины
- «Отмена»: `jewel-btn-cream` (cream fill), половина ширины
- Кнопки в `grid grid-cols-2 gap-2`
- Анимация появления: `mn-reveal` (120ms, scale + rotate in)

**State: loading (delete API call)**

После подтверждения:
- Кнопки заменяются `LoaderLetter` (буква ქ), 48px, по центру
- Backdrop не закрывается пока идёт запрос

**State: success**

- Карточка закрывается (slide-down, 200ms ease-in)
- Слово исчезает из списка с анимацией `translateX(-100%) opacity(0)`, 250ms ease-out
- Тост в верхней части экрана:

```
╔════════════════════════════════╗
║  «კარგი» удалено из словаря   ║  ← cream bg, ruby border-b, jewelInk text
╚════════════════════════════════╝
```

Тост: slide-down из верхнего края, 250ms ease-out. Автоскрытие через 2.5 секунды.

**State: error (delete failed)**

- Confirmation-блок остаётся
- Под кнопками появляется: `text-ruby text-[12px]`: «Не удалось удалить. Попробуй ещё раз.»
- Кнопка «Да, удалить» снова активна

---

### Компонент: WordCard

**Назначение:** bottom sheet с деталями слова, вызывается из `VocabularyList.tsx`

**Props (концептуально):**
```typescript
interface WordCardProps {
  item: VocabularyItem
  isSelected: boolean           // выбрано ли для квиза
  onClose: () => void
  onToggleSelect: (id: string) => void   // добавить/убрать из квиза
  onDelete: (id: string) => Promise<void> // вызывает DELETE /api/miniapp/vocabulary/:id
}
```

**Механика bottom sheet:**
- Backdrop: `rgba(21,16,10,0.4)`, fade-in 200ms
- Sheet: `bg-cream rounded-t-2xl border-t-2 border-x-2 border-jewelInk`
- Shadow: `box-shadow: 0 -4px 0 #15100A` (вверх)
- Slide-up: `translateY(100%) → translateY(0)`, 300ms ease-out
- Тап на backdrop → `onClose()` (без удаления)
- `max-h-[90dvh] overflow-y-auto` для длинного контента

**Drag handle:** `w-8 h-1 bg-jewelInk/20 rounded-full mx-auto mt-3 mb-5`

**Привязка к Minankari-токенам:**
- Background: `cream` (#FBF6EC)
- Border: `jewelInk` (#15100A) 2px
- Shadow: `jewelInk` offset 4px
- Mastery dots (filled): `navy` (#1B5FB0)
- Georgian labels: `jewelInk` (word) / `jewelInk-hint` (abbreviations)
- Delete button text: `ruby` (#E01A3C)
- CTA (Add to quiz): `navy` fill

---

## API-изменения для Developer

| Метод | Путь | Назначение |
|-------|------|----------|
| `DELETE` | `/api/miniapp/vocabulary/{id}` | Удалить слово из словаря пользователя |
| `GET` (update) | `/api/miniapp/vocabulary` | Добавить поле `additionalInfo?: string` в `VocabularyItem` |

**DELETE endpoint:**
- Проверить что слово принадлежит авторизованному пользователю (через HMAC TelegramId)
- `isStarter: true` слова — не удалять (вернуть 400 Bad Request)
- На успех: 204 No Content

**`additionalInfo` в VocabularyItem:**
- Поле `AdditionalInfo` уже есть в `VocabularyEntry` entity (из переводчика)
- Добавить в DTO и маппинг в `MiniAppController.GetVocabulary()`

---

## Копирайтинг

| Элемент | Текст |
|---------|-------|
| Eyebrow карточки | `ლექსიკონი · слово` |
| Mastery: не освоено | `ახალი` / ещё не практиковалось |
| Mastery: одно направление | `სწავლობს` / одно направление освоено |
| Mastery: освоено | `ათვისებული` / оба направления освоены |
| Кнопка добавить | `Добавить в квиз` |
| Кнопка убрать | `Убрать из квиза` |
| Кнопка удалить | `Удалить слово` |
| Подтверждение удаления | `Удалить «{слово}» из словаря?` |
| Подтверждение: да | `Да, удалить` |
| Подтверждение: нет | `Отмена` |
| Тост успеха | `«{слово}» удалено из словаря` |
| Ошибка удаления | `Не удалось удалить. Попробуй ещё раз.` |
| Stats: правильно abbr. | `სწ.` |
| Stats: обратное abbr. | `უკ.` |
| Stats: ошибки abbr. | `შეც.` |

**Ограничения copy:**
- Не писать «delete» или «remove» — только «удалить»
- Не писать «карточка» в интерфейсе — пользователь просто «видит слово»
- Georgian-метки mastery — без перевода в самой карточке. Пользователь видит Georgian → узнаёт на уроке

---

## Анимации

| Элемент | Анимация |
|---------|----------|
| Bottom sheet появление | `translateY(100%) → translateY(0)`, 300ms ease-out |
| Backdrop появление | `opacity(0) → opacity(0.4)`, 200ms ease |
| Bottom sheet закрытие | `translateY(0) → translateY(100%)`, 220ms ease-in |
| Confirmation появление | `mn-reveal` (scale + rotate), 200ms |
| Слово удалено из списка | `translateX(-100%) opacity(0)`, 250ms ease-out |
| Тост появление | `translateY(-100%) → translateY(0)`, 250ms ease-out |
| Тост исчезновение | 2.5s задержка → `translateY(-100%)`, 200ms ease-in |
| Mastery dots при открытии | stagger: первая точка 0ms, вторая 80ms — `scale(0) → scale(1)`, 180ms ease-out |

---

## Адаптивность (375px)

- Bottom sheet: `max-h-[90dvh] overflow-y-auto` — контент скроллится если длинный
- Georgian word (T1, 28px): максимум 8-10 символов для большинства слов, не обрезается
- Stats row: `grid-cols-4` — 4 ячейки × ~84px = 336px ≤ 375px-40px (padding) = 335px. Tight fit — уменьшить до `grid-cols-4 gap-1` если нужно
- Все tap targets ≥ 44px: кнопки полная ширина, `min-h-[52px]`; confirmation кнопки `min-h-[48px]`
- Длинные слова (>12 символов Georgian) — `break-words` на Georgian word
- Строка слова в списке: `gap-3` между чекбокс-зоной и контент-зоной, оба имеют `min-h-[56px]`

---

## Изменения в `VocabularyList.tsx`

### Структура строки (рефакторинг одного элемента)

Было (одна кнопка):
```jsx
<button key={item.id} onClick={() => toggle(item.id)} className="...">
  [номер] [чекбокс] [Georgian] [Russian] [dot]
</button>
```

Станет (разделённые зоны):
```jsx
<div key={item.id} className="... flex items-center min-h-[56px]">
  {/* Левая зона: чекбокс (только non-starter) */}
  {!isStarterMode && (
    <button
      onClick={() => toggle(item.id)}
      className="shrink-0 w-[52px] flex items-center justify-center self-stretch"
      aria-label="Выбрать для квиза"
    >
      [номер] [чекбокс]
    </button>
  )}
  {/* Правая зона: контент → открывает карточку */}
  <button
    onClick={() => openCard(item)}
    className="flex-1 flex items-center gap-3 py-3 pr-4"
  >
    [Georgian] [Russian] [dot] [›]
  </button>
</div>
```

### State для карточки:
```typescript
const [cardItem, setCardItem] = useState<VocabularyItem | null>(null)

function openCard(item: VocabularyItem) { setCardItem(item) }
function closeCard() { setCardItem(null) }
```

### Delete handler:
```typescript
async function deleteWord(id: string) {
  await api.deleteVocabularyEntry(id)   // DELETE /api/miniapp/vocabulary/:id
  setItems(prev => prev.filter(i => i.id !== id))
  closeCard()
  // показать тост
}
```

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру (cream, jewelInk, navy для CTA и dots, ruby для delete)
- [x] Типографика: T1 (28px) для Georgian слова, T3 (18px) для перевода, T6 (11-12px) для меток и статистики
- [x] Содержит обучающий элемент (Georgian mastery labels ახალი/სწავლობს/ათვისებული + stats abbreviations)
- [x] Описан reveal-момент (mastery-слова встретятся в модуле «Выживание»)
- [x] Все состояния описаны: default, confirmation, loading (delete), success, error
- [x] Работает на 375px (max-h scroll, tap targets ≥ 44px, stats grid tight-fit)
- [x] Не нарушает продуктовую философию (нет блокировок, нет стрик-шейминга)
- [x] Один акцент на элемент: navy для CTA, ruby только в кнопке удаления и ✗
- [x] Starter-слова удалить нельзя (защита на backend + кнопка не показывается для `isStarter: true`)
