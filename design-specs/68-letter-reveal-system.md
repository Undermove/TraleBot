# Letter-Reveal System: Per-Module Parameterized Overlay

**Задача:** GitHub issue #469  
**Статус:** draft  
**Автор:** designer agent, 2026-04-22

---

## Цель

Превратить одиночный reveal-момент для буквы ქ (design-specs/24) в **многоразовый учебный паттерн**, где каждый содержательный модуль приложения получает свой первый-входной reveal-момент — знакомство с ключевой грузинской буквой, которая пронизывает всю тему модуля.

Принцип: «дизайн учит». Пользователь узнаёт букву до того, как её встретит в контексте урока. Каждый модуль становится точкой входа в алфавит.

---

## Текущее состояние

- `RevealKaniOverlay.tsx` — компонент жёстко закодирован под букву **ქ**.
- `localStorage` ключ: `bombora_kani_reveal_shown` — единственный.
- `LessonTheory.tsx` строка 40: проверяет именно этот ключ.
- Строка 116–118: рендерит `<RevealKaniOverlay onClose=... />` — нет пропсов.
- Архитектура не масштабируется: добавить reveal для второго модуля без рефакторинга невозможно.

---

## Компонент: `LetterRevealOverlay`

Заменяет `RevealKaniOverlay`. Принимает пропсы:

```tsx
interface LetterRevealProps {
  letter: string          // mkhedruli символ, напр. «ვ»
  letterName: string      // транслитерация, напр. «вини»
  meaning: string         // краткое значение на русском, напр. «я / действие»
  exampleWord: string     // грузинское слово-якорь, напр. «ვარ»
  exampleTranslation: string  // перевод, напр. «(я) есть»
  accent: 'ruby' | 'navy' | 'gold'
  storageKey: string      // уникальный ключ для localStorage
  onClose: () => void
}
```

### Визуал (наследует от RevealKaniOverlay)

- **Backdrop**: `rgba(255,253,240, 0.88)` + backdrop-blur-sm; перекрывает весь экран.
- **Карточка**: `jewel-tile` border-radius 16px, cream фон, тень jewelInk 0 4px 24px 0 opacity 0.15.
- **Буква**: `font-geo text-[96px] font-extrabold` по центру карточки, цвет зависит от accent:
  - ruby → `#C0392B`
  - navy → `#0d4a6e`
  - gold → `#F5B820`
- **Название буквы**: `mn-eyebrow text-jewelInk opacity-60` под буквой, транслит в скобках `«вини»`.
- **Значение**: `font-sans text-[15px] text-jewelInk font-semibold` — краткое на русском.
- **Слово-якорь**: jewel-tile маленький (cream, jewelInk border 1px), padding 4px 12px;  
  `font-geo text-[20px]` + `font-sans text-[12px] opacity-60` для перевода.
- **Кнопка закрытия**: `jewel-btn jewel-btn-cream` полная ширина, текст по-грузински:  
  `«გასაგებია!»` («понятно!») — пользователь читает своё первое грузинское слово-действие.
- **Анимация**: наследует `reveal-card-in/out` и `reveal-backdrop-in/out` из `index.css`.

### Поведение

1. Показывается **один раз** при первом открытии первого урока модуля.
2. Проверяется через `localStorage.getItem(storageKey) === null`.
3. Задержка после mount: **1 500 ms** (пользователь успевает увидеть теорию).
4. После нажатия кнопки: `localStorage.setItem(storageKey, '1')` → `onClose()`.
5. Если пользователь закрывает через системный back — overlay закрывается без записи в localStorage (покажется при следующем входе).

---

## Таблица модулей и их reveal-букв

| Модуль (moduleId) | Буква | Транслит | Значение | Слово-якорь | Accent |
|---|---|---|---|---|---|
| `alphabet-progressive` | **ქ** | «кани» | грузинский язык | ქართული | navy |
| `alphabet` | **ქ** | «кани» | грузинский язык | ქართული | navy |
| `verbs-of-movement` | **ვ** | «вини» | я / действие | ვარ | ruby |
| `future-tense` | **ი** | «иани» | маркер незаконченного | ივლის | gold |
| `verb-classes` | **მ** | «мани» | объектный маркер | მაქვს | navy |
| `imperative` | **ე** | «ели» | суффикс повелит. накл. | მოდი! | ruby |
| `numbers` | **ა** | «ани» | единица / «а» | ათი | gold |
| `pronouns` | **შ** | «шини» | «ты» | შენ | navy |
| `present-tense` | **ვ** | «вини» | я говорю сейчас | ვლაპარაკობ | ruby |
| `cases` | **ვ** | «вини» | именительный падеж | ვინ? | navy |
| `adjectives` | **ი** | «иани» | суффикс прилагат. | ლამაზი | gold |

> **Примечание**: буква **ვ** повторяется в трёх модулях. Это нормально — разные контексты учат одну и ту же букву с разных сторон. Ключ `storageKey` уникален для каждого модуля; показываются независимо.

---

## Интеграция в LessonTheory.tsx

```tsx
// Заменить хардкод RevealKaniOverlay на универсальный

const revealConfig = LESSON_REVEAL_MAP[moduleId]  // map из таблицы выше

useEffect(() => {
  if (!revealConfig) return
  const shown = localStorage.getItem(revealConfig.storageKey)
  if (!shown) {
    const t = setTimeout(() => setShowReveal(true), 1500)
    return () => clearTimeout(t)
  }
}, [moduleId])

// В JSX:
{showReveal && revealConfig && (
  <LetterRevealOverlay
    {...revealConfig}
    onClose={() => setShowReveal(false)}
  />
)}
```

`LESSON_REVEAL_MAP` — новый файл `src/Trale/miniapp-src/src/data/letterReveals.ts` (или встроить в компонент).

---

## Экраны и состояния

### Состояние «reveal активен»

- Оверлей перекрывает весь экран (`z-50`)
- Под оверлеем теория видна, но недоступна (pointer-events: none)
- Нет эскейп-клавиши, нет клика вне карточки (модальный: пользователь должен нажать «გასაგებია!»)

### Состояние «reveal уже показан» (`localStorage` key exists)

- Компонент не монтируется вообще
- Нет задержки, нет сайд-эффектов

### Состояние «модуль без reveal» (`revealConfig === undefined`)

- Ничего не происходит; теория открывается как обычно

---

## Доступность

- `role="dialog" aria-modal="true" aria-labelledby="reveal-letter-{moduleId}"`
- Буква имеет `aria-label="{letterName} — {meaning}"`
- Фокус ловится в оверлей (focus trap); при закрытии возвращается на первый блок теории

---

## Что НЕ нужно реализовывать в рамках этой задачи

- Аудио произношения буквы (STRATEGY.md P1 — отдельный milestone)
- Анимация самой буквы (только static render; LoaderLetter animation → Алфавит ModalLoader → отдельная задача)
- Настройка «отключить reveal-моменты» в профиле (YAGNI)
- Backend-хранение состояния просмотра (localStorage достаточно на MVP)

---

## Критерии приёмки (tech-lead дописывает)

- [ ] `RevealKaniOverlay` заменён `LetterRevealOverlay` без регрессии ქ reveal
- [ ] Все строки таблицы выше имеют рабочие reveal-ы при первом входе
- [ ] `localStorage` keys уникальны, не конфликтуют со старым `bombora_kani_reveal_shown`
- [ ] На экране шириной 375px карточка не выходит за края
- [ ] Пустой модуль (без конфига) не крашится и не показывает ничего
- [ ] `LessonJsonValidationTests` не затронуты (компонент UI-only)
