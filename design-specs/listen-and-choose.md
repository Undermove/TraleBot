# Listen & Choose — Audio Exercise Screen

## Goal

Introduce the first audio-interactive exercise type for the P1 milestone. User hears a Georgian word or short phrase (pre-generated TTS) and selects the correct Russian translation from 3–4 options. Reuses the existing `Practice` quiz render infrastructure; adds only an audio-player control and the backend audio-file contract.

## User Flow

```
ModuleMap → tap lesson → [normal lesson start flow] → audio question rendered
       ↕
   Press ▶ (play button) → hear Georgian word
       ↕
   Tap one of 3-4 answer tiles
       ↕
   FeedbackBanner ("სწორია!" / "არასწორია!" + Georgian word displayed)
       ↕
   Next question / Result screen (same flow as existing quiz)
```

No new navigation screens are needed — this question type slots into the existing `Practice` and `VocabularyPractice` flows as a new `questionType: 'audio-choice'`.

## Screen Layout (single question view)

```
┌─────────────────────────────────┐
│ [kilim strip]  [back] ████░░ 3/8│  ← existing progress bar
├─────────────────────────────────┤
│                                 │
│   ┌──────────────────────────┐  │
│   │        jewel-tile        │  │
│   │                          │  │
│   │  [🔊 PLAY]  Georgian     │  │
│   │  btn (62×62, navy)  hint │  │
│   │                          │  │
│   │  «Послушай и выбери»     │  │
│   │  (eyebrow, jewelInk-mid) │  │
│   └──────────────────────────┘  │
│                                 │
│   ┌──────┐  ┌──────┐           │
│   │  ა   │  │  ბ   │           │  ← answer tiles
│   │  ...  │  │  ...  │           │
│   └──────┘  └──────┘           │
│   ┌──────┐  ┌──────┐           │
│   │  გ   │  │  დ   │           │
│   │  ...  │  │  ...  │           │
│   └──────┘  └──────┘           │
│                                 │
│   [Проверить] ← same Button     │
└─────────────────────────────────┘
```

## Play Button States

| State | Visual | Detail |
|-------|--------|--------|
| `idle` | Navy filled circle, white ▶ icon, 3px ink shadow | `jewel-pressable` press animation |
| `loading` | Same circle, `LoaderLetter` spinner (12px) inside | Replaces ▶ icon only |
| `playing` | Ruby filled circle, white ■ icon (stop) | Plays once, auto-stops |
| `played` | Cream tile, navy outline ▶, no shadow | Indicates "already heard" |

After `played`, user can replay — tap to return to `playing` state.

## Question Data Contract

New `questionType: 'audio-choice'` shape (extends existing `QuizQuestion`):

```ts
interface AudioChoiceQuestion extends QuizQuestion {
  questionType: 'audio-choice'
  audioUrl: string       // relative path to pre-generated TTS file, e.g. "/audio/ka/მადლობა.mp3"
  transcript: string     // Georgian text displayed under play button after first play
  lemma: string          // shown in FeedbackBanner
}
```

Audio files: pre-generated ElevenLabs / Google TTS (ka-GE voice, not Web Speech API). Stored as static `.mp3` under `/wwwroot/audio/ka/`. File naming: `{module}_{word_slug}.mp3`.

## Teaching Moments Built In

1. **Before answering**: Georgian letters ა/ბ/გ/დ badge answers (same as `#458`)
2. **After first play**: transcript (Georgian script) appears below the play button — user sees what they heard, reinforcing grapheme–phoneme link
3. **FeedbackBanner on correct**: shows Georgian word in 28px geo font + transliteration (same as `#499`)
4. **FeedbackBanner on wrong**: CorrectWordReveal syllable display (`#489`)

## New Components Required

| Component | Where | Notes |
|-----------|-------|-------|
| `AudioPlayer.tsx` | `components/` | Play button only, no progress bar. Accepts `url`, `onPlayed` callback |
| `AudioChoiceCard.tsx` | `components/` | Wraps jewel-tile, AudioPlayer, eyebrow, and transcript reveal |

No new screens — slot into `Practice.tsx`'s question renderer with a `questionType === 'audio-choice'` branch.

## States

- **loading** (audio fetch): `LoaderLetter` replaces play icon
- **idle**: play button ready, transcript hidden
- **playing**: ruby stop button, transcript hidden
- **played**: cream replay button, transcript fades in (200ms ease)
- **answered**: answer tiles lock, FeedbackBanner appears (same as existing)
- **error** (audio 404 / network fail): play button shows ✕, tooltip "Аудио недоступно"; question remains answerable (transcript shown immediately as fallback)

## Accessibility

- Play button `aria-label`: `"Воспроизвести грузинское слово"` → after play: `"Воспроизвести снова"`
- Answer tiles same `aria-label` pattern as multiple-choice (`#458`)
- Transcript `aria-live="polite"` so screen readers announce when it appears

## Copy

| Context | Russian | Georgian |
|---------|---------|---------|
| Eyebrow | «Послушай и выбери» | — |
| Play btn aria | «Воспроизвести» | — |
| Transcript label | «Ты слышал:» | — |
| Audio error | «Аудио недоступно» | — |

## Open Questions for Tech Lead

1. Static file hosting: serve from `/wwwroot/audio/ka/` or a CDN bucket? Naming collision strategy if word appears in multiple modules.
2. Pre-generation batch: ElevenLabs vs. Google TTS ka-GE for quality — needs side-by-side test on ა/ბ/გ/დ clusters.
3. Should `audioUrl` come from the lesson JSON or from a separate audio manifest endpoint?
4. Mobile Safari `<audio>` autoplay restriction — play must be triggered by user gesture (handled: play button tap qualifies).

## Effort Estimate (for tech-lead decomposition)

- `AudioPlayer.tsx` component: ~1h
- `AudioChoiceCard.tsx` + Practice.tsx branch: ~2h
- Backend: `audioUrl` field in question DTO + static file route: ~1h
- Audio generation batch script (first module, ~30 words): ~2h with API key
- Total: ~6h + audio generation time
