# Design Spec: Wrong-Answer Georgian Reveal in FeedbackBanner
**Spec ID:** 69  
**Status:** proposal  
**Linked issue:** [#486](https://github.com/Undermove/TraleBot/issues/486)

---

## Goal

When a user gets a practice question wrong, the current FeedbackBanner body shows plain text: `правильно: ${correctAnswer}`. This is a wasted learning moment. The correct Georgian word is on screen for 2–4 seconds while the user reads it, but nothing helps them absorb its structure.

**Design goal:** turn the wrong-answer feedback moment into a micro-lesson — show the correct Georgian form with syllable splits and its Russian gloss, making the correction actively educational rather than passively correctional.

---

## Scope

- Applies to **wrong-answer state only** (FeedbackBanner with `isCorrect={false}`)
- **Type-in questions** (`questionType === 'TypeAnswer'`): replaces current `правильно: ${correctAnswer}` plain text
- **Multiple-choice questions**: the `explanation` field already carries context; this spec applies only when `explanation` is absent or short (< 20 chars)
- No backend change required — `correctAnswer` is already available in the frontend

---

## User Flow

1. User submits wrong answer
2. FeedbackBanner appears with `bg-ruby` (current) ✓
3. Georgian label «არასწორია!» + transliteration (current) ✓
4. **New:** below the «Ошибка» line, instead of plain-text `правильно: X`, render a `CorrectWordReveal` sub-block:
   - Large Georgian word with visible syllable dots
   - Small transliteration below (dot-separated syllables)
   - Russian gloss to the right or below transliteration
5. Rest of explanation (if any) follows below the reveal block

---

## Screen Sketch

```
┌─────────────────────────────────────────┐
│ [ruby bg, ink border]                   │
│                                         │
│  არასწორია!                             │  ← font-geo 26px bold (existing)
│  ara·swor·ia                            │  ← 11px tracking (existing)
│  ОШИБКА                                 │  ← 11px extrabold caps (existing)
│  ─────────────────────────────────────  │  ← hairline divider (new)
│                                         │
│  [cream/10% wash box, ink border 1px]   │
│    მი·ვ·დი·ვარ                          │  ← font-geo 22px, syllable dots
│    mi·v·di·var · я иду                  │  ← 12px sans, dot-sep + Russian
│                                         │
│  explanation text if any…               │  ← existing body text
└─────────────────────────────────────────┘
```

---

## Component: `CorrectWordReveal`

New component in `src/Trale/miniapp-src/src/components/CorrectWordReveal.tsx`.

### Props
```ts
interface CorrectWordRevealProps {
  georgian: string      // the correct Georgian word/phrase from correctAnswer
  gloss?: string        // Russian gloss — extract from explanation or from question context
}
```

### Syllable splitting strategy
Georgian syllable structure is (C)V(C). A robust frontend-only split:
1. Insert a soft dot `·` before each vowel cluster that follows a consonant cluster
2. Georgian vowels: `ა ე ი ო უ` (U+10D0, U+10D4, U+10D8, U+10DD, U+10E3)
3. This gives a readable approximation for display purposes — not phonologically perfect but consistent and learnable

```ts
const GEO_VOWELS = new Set(['ა','ე','ი','ო','უ'])

function syllabify(word: string): string {
  let result = ''
  let prevWasVowel = false
  for (let i = 0; i < word.length; i++) {
    const ch = word[i]
    const isVowel = GEO_VOWELS.has(ch)
    // Insert dot before a vowel that follows at least one consonant from previous vowel
    if (isVowel && !prevWasVowel && i > 0 && result.length > 0 && !result.endsWith('·')) {
      result += '·'
    }
    result += ch
    prevWasVowel = isVowel
  }
  return result
}
```

### Transliteration
Use the existing transliteration map already present in the codebase (or add a lightweight mapping mirroring it). The dot pattern from syllabify feeds directly into the transliteration display.

### Styling
- Outer wrapper: `mt-3 pt-3 border-t border-cream/20` (hairline within ruby banner)
- Word box: `rounded-lg bg-cream/10 border border-cream/20 px-3 py-2`
- Georgian word: `font-geo text-[22px] font-bold text-cream leading-tight`
- Transliteration: `font-sans text-[12px] text-cream/70 mt-0.5 tracking-wide`
- Dot separator between transliteration and gloss: ` · ` in `text-cream/40`

### Animation
- Fade in after 150ms delay (after FeedbackBanner mounts)
- `opacity-0 → opacity-100`, duration 200ms

---

## Integration in Practice.tsx

Change (type-in wrong answer body, line ~350):
```tsx
// Before:
body={`правильно: ${correctAnswer}`}

// After:
body={
  <CorrectWordReveal
    georgian={correctAnswer}
    gloss={current.explanation || undefined}
  />
}
```

For multiple-choice wrong answers (line ~421), add CorrectWordReveal when explanation is short:
```tsx
body={
  <>
    <CorrectWordReveal georgian={correctAnswer} />
    {current.explanation && current.explanation.length > 20 && (
      <div className="mt-2 text-[13px] leading-snug opacity-90">{current.explanation}</div>
    )}
  </>
}
```

---

## States

| State | What shows |
|-------|-----------|
| Single Georgian word | Syllabified word + transliteration + gloss |
| Georgian phrase (2+ words) | Full phrase, syllabify each word separately, no transliteration (too long) |
| Non-Georgian correctAnswer | Falls back to current plain text `правильно: X` |
| correctAnswer is empty | CorrectWordReveal renders nothing; parent shows explanation only |

Detect Georgian by checking Unicode range U+10A0–U+10FF.

---

## Accessibility
- `aria-label={`Правильный ответ: ${georgian}`}` on the reveal box
- Color contrast: cream text on ruby bg is AA compliant at these sizes

---

## Out of Scope
- Audio playback of correct word (P1 audio milestone, separate task)
- Morpheme color-coding by grammatical role (P2 — requires linguistic metadata per word)
- Showing etymology (P3)

---

## Open Questions
1. Should the gloss come from `explanation` (already available) or from a new `correctGloss` field on `QuizQuestion`? — Recommend reusing `explanation` for now; a dedicated field is premature.
2. For multi-word phrases, skip syllabification or apply to each word? — Skip for phrases (> 2 spaces); apply per-word for compounds.
