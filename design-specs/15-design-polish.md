# Дизайн-полировка

**Задача:** ROADMAP.md → задача #15
**Статус:** ready

---

## Обзор

Шесть точечных улучшений из дизайн-аудита 2026-04-13. Не новая фича — приведение существующего UI в соответствие с Minankari-системой.

1. Типографическая шкала T1–T6
2. Контраст navy / ruby
3. Единый Header
4. Микро-анимации (milestone)
5. Пустое состояние словаря
6. Вертикальные отступы между секциями

---

## Обучающий элемент

**Пустое состояние словаря** — единственный экран из шести, где есть место для обучения.

Когда словарь пуст, Бомбора показывает грузинское слово **ლექსიკონი** (leksikoni — словарь) с транслитерацией. Пользователь видит его уже при первом открытии раздела, ещё до того как что-то выучил. Reveal-момент: спустя несколько дней находит это слово в разделе «Мой словарь» — и узнаёт его.

---

## 1. Типографическая шкала T1–T6

### Проблема

В коде используются произвольные размеры: 9px, 10px, 11px, 12px, 13px, 14px, 15px, 16px, 17px, 18px, 22px, 24px — без системы. Часть классов в `index.css` (`.pb-display`, `.hand-note`, `.eyebrow`, `.serif-caption`) ссылаются на Fraunces/Figtree/Caveat — шрифты, которые запрещены в Minankari.

### Шкала (закрепить в Tailwind-конфиге или как CSS-переменные)

| Ступень | Размер | Вес | Применение |
|---------|--------|-----|------------|
| **T1** | 24px | 800 | Экранные заголовки, главная строка приветствия |
| **T2** | 18px | 800 | Header title, StampBadge Georgian word, крупный акцент |
| **T3** | 16px | 700 | Заголовки модулей на тайле, текст кнопки jewel-btn |
| **T4** | 13px | 600 | Body: sub-labels, trial banner, suggestion subtitle |
| **T5** | 11px | 700 | Eyebrow (mn-eyebrow), счётчики уроков, section label |
| **T6** | 9px | 700 | Micro-labels: translit в StampBadge, единица в StatPill |

**Georgian text** (`font-geo`) следует той же шкале — вес 700 или 800.

### Что изменить в коде

**index.css** — удалить/заменить legacy-блоки, которые используют запрещённые шрифты:

| Класс | Действие |
|-------|----------|
| `h1, h2, h3, h4` | Заменить `font-family: Fraunces` на `font-family: Manrope` |
| `.pb-display` | Удалить (устаревший picture-book класс) |
| `.pb-eyebrow` | Удалить (заменить на `.mn-eyebrow`) |
| `.pb-body` | Удалить |
| `.display-xl`, `.display-lg` | Заменить `Fraunces` на `Manrope`, сохранить размеры (если ещё используются) |
| `.hand-note` | Удалить (Caveat запрещён) |
| `.eyebrow` | Удалить (дубль `.mn-eyebrow` на Fraunces) |
| `.serif-caption` | Удалить (Fraunces, нет применения в Minankari) |

**Tailwind (tailwind.config.js)** — добавить шкалу как пользовательские значения:
```js
fontSize: {
  't1': ['24px', { lineHeight: '1.1', fontWeight: '800' }],
  't2': ['18px', { lineHeight: '1.2', fontWeight: '800' }],
  't3': ['16px', { lineHeight: '1.3', fontWeight: '700' }],
  't4': ['13px', { lineHeight: '1.5', fontWeight: '600' }],
  't5': ['11px', { lineHeight: '1.4', fontWeight: '700' }],
  't6': ['9px',  { lineHeight: '1.3', fontWeight: '700' }],
}
```

**Маппинг текущих размеров → шкала** (Developer следует этому при переводе):

| Текущий класс | → | Шкала |
|---------------|---|-------|
| `text-[22px] font-extrabold` | → | `text-t1` |
| `text-[18px] font-extrabold` | → | `text-t2` |
| `text-[17px] font-extrabold` | → | `text-t3` |
| `text-[16px] font-bold` | → | `text-t3` |
| `text-[15px] font-bold` | → | `text-t3` |
| `text-[14px] font-extrabold` | → | `text-t4` (исключение — можно оставить 14px) |
| `text-[13px] font-extrabold` | → | `text-t4` |
| `text-[12px]` | → | `text-t4` |
| `text-[11px] font-bold` | → | `text-t5` |
| `text-[10px]` | → | `text-t5` |
| `text-[9px] font-bold` | → | `text-t6` |

---

## 2. Контраст navy / ruby

### Проблема

Navy #1B5FB0 и ruby #E01A3C имеют близкую относительную яркость (~12% и ~17% соответственно). Contrast ratio между ними ≈ 1.28 — слишком мало для элементов, размещённых рядом. При плохом освещении или у людей с нарушениями цветовосприятия эти два цвета неразличимы по яркости.

**Конкретный нарушитель:** StatPill на Dashboard — два pill подряд (ruby «дн», navy «опыт»).

### Fix

**StatPill: XP → gold.**

| Пилюля | Сейчас | Станет |
|--------|--------|--------|
| Стрик (дн) | bg-ruby | bg-ruby (без изменений) |
| Опыт (xp) | bg-navy | bg-gold |

Gold #F5B820 vs ruby #E01A3C: contrast ratio ≈ 2.8 — удовлетворяет требованию >2.0.

Семантика: ruby = история (стрик — сколько дней), gold = текущее достижение (XP — накопленный опыт). Логика соответствует ролям цветов в Minankari.

**Изменение в StatPill (Dashboard.tsx):**
```tsx
// Было:
color: 'navy' → bg-navy text-cream

// Станет:
color: 'xp' → bg-gold border-[1.5px] border-jewelInk text-jewelInk box-shadow 2px 2px 0 #15100A
```

**Header.tsx** — compact stats: аналогично XP (navy) → gold:
```tsx
// XP value строка: text-navy → text-gold-deep (тёмный тон gold для контраста на cream)
```

### Правило (закрепить в дизайн-спеке)

Navy и ruby **не могут быть смежными** без cream-разделителя (минимум 8px gap или белая линия). Эмоциональные роли: ruby = ошибки, пройденные метки, стрик; navy = прогресс, активное состояние, навигация.

---

## 3. Единый Header

### Проблема

- **Dashboard.tsx**: kilim + stats bar (кастомный топ, не компонент)
- **Result.tsx**: kilim + confetti (кастомный топ, не компонент)
- **VocabularyList, ModuleMap, LessonTheory**: используют `<Header />`

Результат: три варианта «топа экрана» с разной разметкой.

### Решение: расширить Header.tsx

Добавить `variant` prop:

```typescript
interface Props {
  progress: ProgressState
  onBack?: () => void
  title?: string
  eyebrow?: string
  variant?: 'default' | 'result'   // 'default' = текущее поведение
}
```

**`variant="result"` (для Result.tsx):**
- Kilim strip сверху — как обычно
- Back button слева (возврат на модульную карту)
- Центр: пусто (нет title — большой заголовок рендерится ниже в теле экрана)
- Справа: ничего (цифры XP/стрик не нужны на экране результата — они ещё не обновились визуально)
- `position: absolute` (не sticky) — чтобы не перекрывать confetti-слой

**Dashboard**: остаётся кастомным. Dashboard уникален — hero-зона с Бомборой не вписывается в шаблон Header. Выделить повторяющийся блок kilim+statsbar в отдельный компонент `DashboardTopBar` (≤30 строк):

```tsx
// DashboardTopBar.tsx
function DashboardTopBar({ progress, onNavigateProfile }: {...}) {
  return (
    <div>
      <div style={{ paddingTop: 'var(--safe-t)' }}>
        <div className="mn-kilim" />
      </div>
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="mn-eyebrow">блокнот</div>
        <button onClick={onNavigateProfile} className="flex items-center gap-3 active:opacity-80">
          <StatPill value={progress.streak} label="дн" color="ruby" />
          <StatPill value={progress.xp} label="опыт" color="xp" />   {/* xp → gold */}
        </button>
      </div>
    </div>
  )
}
```

Это не полный Header — но выносит кастомный топ Dashboard из основного рендера.

### Экраны и изменения

| Экран | Сейчас | Станет |
|-------|--------|--------|
| Dashboard.tsx | inline kilim + statsbar | `<DashboardTopBar />` |
| Result.tsx | inline kilim | `<Header variant="result" onBack={...} progress={progress} />` |
| Остальные | `<Header />` | без изменений |

---

## 4. Микро-анимации (milestone)

### Проблема

Достижения XP 100 / 200 / 500 и стрик 7 / 14 дней никак не отмечаются в UI.

### Компонент: MilestoneBanner

Небольшая всплывающая плашка, которая появляется снизу экрана, когда XP или стрик пересекает пороговое значение.

**Триггеры:**
| Событие | Текст | Georgian | Длительность |
|---------|-------|----------|--------------|
| XP достиг 100 | «100 опыта накоплено» | «ასი» (asi — сто) | 3 сек |
| XP достиг 200 | «200 опыта — отлично» | «ორასი» (orasi — двести) | 3 сек |
| XP достиг 500 | «500 опыта — ты про» | «ხუთასი» (khutasi — пятьсот) | 3 сек |
| Стрик 7 дней | «7 дней подряд!» | «შვიდი» (shvidi — семь) | 3 сек |
| Стрик 14 дней | «14 дней подряд!» | «თოთხმეტი» (totkhm. — четырнадцать) | 4 сек |

**Обучающий элемент:** Georgian числительное — то самое из модуля «Числительные». Reveal-момент: в модуле «Числа» узнаёт «своё» число XP/стрика.

**Layout плашки:**
```
┌─────────────────────────────────────────────────────┐
│  ⭐  100 опыта накоплено               ასი · asi   │
│      Так держать!                                   │
└─────────────────────────────────────────────────────┘
```

**Стиль:**
- `jewel-tile` + `jewel-pressable` — как у подсказок на Dashboard
- Фиксированное позиционирование: `fixed bottom-4 left-4 right-4 z-50`
- Анимация появления: slide-up из нижней части экрана (200ms ease-out)
- Автоскрытие через 3–4 сек + fade-out (200ms ease-in)
- Тап — немедленное скрытие

**Props:**
```typescript
interface MilestoneBannerProps {
  type: 'xp' | 'streak'
  value: number
  onDismiss: () => void
}
```

**Логика срабатывания (в App.tsx или Dashboard.tsx):**
- Отслеживать `progress.xp` и `progress.streak` между рендерами
- При пересечении порогов [100, 200, 500] для XP и [7, 14] для streak — показать баннер
- Каждый milestone срабатывает один раз (localStorage-флаг `bombora_milestones_shown`)

**Не показывать:**
- На экране Practice или LessonTheory (прерывает концентрацию)
- Если уже был показан (localStorage)

---

## 5. Пустое состояние словаря

### Проблема

Когда личный словарь пуст (и нет starter-слов), экран показывает нейтральный плейсхолдер «Словарь пока пуст».

### Новый дизайн: тёплая карточка с Бомборой

```
┌────────────────────────────────────────────────────┐
│                                                    │
│         [ Бомбора think, 80px ]                    │
│                                                    │
│   ლექსიკონი · leksikoni                            │  ← T2, Georgian, обучающий элемент
│                                                    │
│   Твои слова здесь ещё не появились.               │  ← T4, body
│   Попроси бота перевести любое слово —             │
│   оно попадёт в словарь автоматически.             │
│                                                    │
│   [ Открыть @trale_bot  → ]                        │  ← jewel-btn cream, T3
│                                                    │
└────────────────────────────────────────────────────┘
```

**Стиль:**
- Контейнер: `jewel-tile`, `mx-5 mt-6 px-6 py-8 text-center`
- Бомбора `mood="think"` — задумчивая, не грустная
- Georgian word `ლექსიკონი`: `font-geo text-t2 font-extrabold text-jewelInk`
- Translit `leksikoni`: `font-sans text-t6 uppercase tracking-widest text-jewelInk-mid mt-1`
- Body text: `font-sans text-t4 text-jewelInk-mid leading-relaxed mt-4`
- Кнопка «Открыть @trale_bot» — opens `tg://resolve?domain=trale_bot`:
  - `jewel-btn jewel-btn-cream` — полная ширина
  - Только если вызов из Telegram WebApp (иначе — скрыть)

**Когда показывать:**
- `phase === 'ready'` И `items.length === 0` И `isStarterMode === false`

**Когда не показывать:**
- Starter-режим (есть starter-слова) — там уже есть подсказка

---

## 6. Вертикальные отступы между секциями

### Проблема

На длинных экранах (667px+) секции слипаются. Зазор между секциями Dashboard на 375px (5 модульных секций) хороший, но на iPhone Pro Max (430px ширина, 932px высота) секции выглядят сжато.

### Изменения

**Dashboard.tsx — секции:**

| Элемент | Сейчас | Станет |
|---------|--------|--------|
| `.flex.flex-col.gap-3.pb-2` (плитки внутри секции) | `gap-3 pb-2` | `gap-3 pb-4` |
| `pt-4` в section header | `pt-4 pb-3` | `pt-5 pb-3` (на 1px больше сверху) |
| Hero section | `pt-3 pb-4` | `pt-4 pb-5` |

**Общий принцип (закрепить):**
- Между kilim-strip и первым контентным блоком: `pt-4`
- Между секциями (section divider): `pt-5 pb-3`
- Между тайлами внутри секции: `gap-3`
- Между секцией и следующей: `pb-4`
- Bottom safe area: `pb-6` + `safe-b` — без изменений

---

## Адаптивность (375px)

- **T1 (24px)**: не переполняется при однострочном приветствии
- **StatPill с gold**: золотой фон + ink-бордер — читается на любом фоне
- **MilestoneBanner**: `left-4 right-4` = 375 - 32px = 343px ширина; Georgian числительное T2 (18px) + tran. T6 (9px) + padding 16px → max ~300px — влезает
- **Пустое состояние**: `mx-5` = 335px ширина карточки; Бомбора 80px в центре; текст с `leading-relaxed` — не переполняется
- **Tap targets**: кнопка «Открыть бота» — `jewel-btn min-h-[56px]` — соответствует 44px minimum

---

## Копирайтинг

| Элемент | Текст |
|---------|-------|
| Empty vocabulary — Georgian | `ლექსიკონი` |
| Empty vocabulary — translit | `leksikoni` |
| Empty vocabulary — body | «Твои слова здесь ещё не появились. Попроси бота перевести любое слово — оно попадёт в словарь автоматически.» |
| Empty vocabulary — CTA | «Открыть @trale_bot» |
| Milestone XP 100 — body | «100 опыта накоплено» |
| Milestone XP 100 — Georgian | «ასი» |
| Milestone streak 7 — body | «7 дней подряд!» |
| Milestone streak 7 — Georgian | «შვიდი» |

---

## Чеклист перед отправкой

- [x] Использует только Minankari-палитру (cream/navy/ruby/gold/jewelInk)
- [x] Типографика в шкале T1–T6 (определена впервые — шкала сама и есть результат этой задачи)
- [x] Содержит обучающий элемент: ლექსიკონი в пустом состоянии + числительные в milestone-баннерах
- [x] Описан reveal-момент: числительные в MilestoneBanner → модуль «Числительные»
- [x] Все состояния описаны: empty vocabulary, milestone triggers, StatPill с xp-gold
- [x] Работает на 375px: все размеры проверены
- [x] Не нарушает продуктовую философию: нет стрик-шейминга, milestone — позитивная обратная связь

---

## Порядок реализации (для Developer)

Рекомендуется выполнять в следующем порядке (от простого к сложному):

1. **index.css** — удалить legacy-классы на запрещённых шрифтах
2. **tailwind.config.js** — добавить T1–T6
3. **StatPill** — xp → gold (Dashboard.tsx, Header.tsx)
4. **DashboardTopBar.tsx** — extract из Dashboard
5. **Header.tsx** — добавить `variant="result"`, Result.tsx — использовать Header
6. **VocabularyList.tsx** — пустое состояние с Бомборой
7. **MilestoneBanner.tsx** — новый компонент + логика в Dashboard/App
