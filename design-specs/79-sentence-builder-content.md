# Sentence Builder — Pilot Content Spec: Postpositions L1-L3

**Task:** GitHub issue #862  
**Epic:** #858 (Sentence Builder — конструктор предложений)  
**Status:** ready  
**Author:** developer agent, 2026-05-08  
**Attribution:** Sentence pairs and hints table verified by Methodist review and Native-reviewer feedback on issue #858 (comments #858 IC_kwDOItk41s8AAAABBpsfyw and #858 IC_kwDOItk41s8AAAABBptgyQ).

---

## Prerequisites

Before SentenceBuilder exercises users must see the contrast note:

> **-ში = в (внутри), -ზе = на (поверхность), -თAN = у/рядом**

SentenceBuilder is productive practice (output), not the primary introduction. All three postpositions must already be introduced in theory before users reach these exercises.

---

## Level progression

| Level | Preset slots | Empty slots | Pool size | Goal |
|-------|-------------|-------------|-----------|------|
| L1 | Subject + Verb (positions 0 and 2) | 1 (postposition phrase) | 4 chips | Recognise which postposition fits |
| L2 | Subject (position 0) | 2 (PP + verb) | 6–7 chips | Build PP + select correct verb form |
| L3 | Subject + Verb (positions 0 and 3) | 2 (two PP phrases) | 8 chips | Compose multi-adverbial sentence |

---

## L1 — один пустой слот (постпозиционная фраза), глагол-связка

*Source: Methodist review on #858, approved. Verb of motion replaced with copula ვარ/არის/ვართ to keep prerequisite level A1 (Methodist i+1 concern).*

| Russian phrase | Georgian canonical | Empty slot |
|---|---|---|
| Я дома | მე **[სახლში]** ვარ | სახლში |
| Книга на столе | წიგნი **[მაგიდაზე]** არის | მაგიდაზე |
| Она в школе | ის **[სკოლაში]** არის | სკოლაში |
| Кот у двери | კატა **[კართან]** არის | კართან |
| Мы в парке | ჩვენ **[პარკში]** ვართ | პარკში |
| Стакан на полке | ჭიქა **[თაროზე]** არის | თაროზე |
| Она рядом с нами | ის **[ჩვენთან]** არის | ჩვენთან |

**Typical distractors for L1** (wrong but not a second correct answer):
- `სახლი` (without postposition) — tests whether student knows postposition is required
- `სახლიდან` (ablative, opposite meaning) — teaches -დან contrast
- Alternative postposition (e.g. `-ზე` instead of `-ში`) — tests postposition selection

---

## L2 — два пустых слота (PP + глагол), A1→A2

*Source: Methodist review on #858. Motion verbs (მივდივარ, მიდის) are appropriate at L2 — by this point the student has encountered them receptively in the Postpositions module.*

*Native-reviewer note: all Georgian tokens must be pure Mkhedruli (U+10D0–U+10FF).*

| Russian phrase | Georgian canonical | Empty slots |
|---|---|---|
| Я иду в магазин | მე **[მაღაზიაში]** **[მივდივარ]** | PP + verb |
| Ты идёшь в школу | შენ **[სკოლაში]** **[მიდიხარ]** | PP + verb |
| Мы сидим в кафе | ჩვენ **[კაფეში]** **[ვზივართ]** | PP + verb |
| Она лежит на кровати | ის **[საწოლზე]** **[წევს]** | PP + verb |
| Кот идёт к дому | კატა **[სახლთან]** **[მიდის]** | PP + verb |
| Я читаю в парке | მე **[პარკში]** **[ვკითხულობ]** | PP + verb |
| Он стоит у окна | ის **[ფანჯართან]** **[დგას]** | PP + verb |

**Distractor selection principle:** include one alternative PP (wrong location) + one wrong verb form (wrong person or wrong tense).

---

## L3 — подлежащее+сказуемое заданы, собрать дополнения (≤5 токенов, ≤3 пустых слота)

*Source: Methodist review on #858. Capped at 5 tokens / 3 open slots per Methodist recommendation. Native-reviewer confirmed canonical word order for each sentence.*

| Russian phrase | Georgian canonical | Preset | Empty slots |
|---|---|---|---|
| Я иду домой с другом | მე **[სახლში]** **[მეგობართან]** მივდივარ | მე … მივდივარ | 2 PP |
| Она едет в город с книгой | ის **[ქალაქში]** **[წიგნით]** მიდის | ის … მიდის | PP + instrumental |
| Мы идём в кино вместе | ჩვენ **[კინოში]** **[ერთად]** მივდივართ | ჩვენ … მივდივართ | PP + adverb |
| Он стоит у магазина с другом | ის **[მაღაზიასთან]** **[მეგობართან]** დგას | ის … დგას | 2 PP |
| Книга лежит на столе в комнате | წიგნი **[მაგიდაზე]** **[ოთახში]** დევს | წიგნი … დევს | 2 PP |

**Note on canonical order (Native-reviewer):** Georgian allows multiple pragmatically equivalent word orders for free constituents. The order given above is the unmarked, neutral SOV order. A second order (e.g. OV swapped) might be grammatically valid but the app scores only one canonical answer, so content editors must pick the most neutral order and have it signed off by a native speaker before loading into JSON.

---

## Hints table (≤36 chars, T6 at 375px)

*Source: Methodist review on #858, section 6. All hints verified to fit T6 typography at 375px viewport.*

| Error type | Hint text | Char count |
|---|---|---|
| Missing postposition (-ში omitted) | `-ში ставится после существительного` | 36 |
| -ში used instead of -ზе | `-ზე = «на», -ში = «в»` | 21 |
| -ში used instead of -თAN | `-თAN = «у/рядом с»` | 19 |
| Verb not in final position | `Глагол идёт в конце предложения` | 32 |
| -ით confused with -ში | `-ით = средство, -ში = место` | 28 |
| Wrong constituent order | `Порядок: я → куда → глагол` | 28 |

---

## Unicode consistency note

All Georgian-script tokens in JSON files MUST use only Mkhedruli code points (U+10D0–U+10FF). Mixed-script tokens (e.g. Georgian start + Cyrillic end) produce silent `IsCorrect=false` failures at runtime. The `QuestionsJson_GeorgianFields_ContainOnlyMkhedruli` unit test guards this automatically.

*Reference: Native-reviewer CRITICAL finding on issue #858 — token «მივдивар» was mixed-script in the original BDD scenario.*
