# FEATURES.md — Implemented Feature Catalog

**Purpose**: single source of truth for every user-visible feature already shipped on `main`. Agents MUST consult this before breaking down issues or implementing code — if what you are about to build is already listed here, stop and comment on the issue.

**Enforcement**: `tests/IntegrationTests/FeatureCatalogCoverageTests.cs` scans the repo for bot commands, miniapp screens, controller endpoints, hosted services, and migrations, and fails the build if any of them is not mentioned by exact class / file / route name in this document. You cannot merge work that skips updating this catalog.

**How to update**: every PR that adds a new user-visible feature MUST add a row in the relevant section in the same commit. Use the exact class or file base name so the coverage test can grep for it.

---

## 1 — Bot commands (`IBotCommand` handlers)

Location: `src/Infrastructure/Telegram/BotCommands/**/*.cs`. All names below are class names — the test greps for them verbatim.

### Onboarding & menu
| Class | Command / trigger | Purpose |
|---|---|---|
| `StartCommand` | `/start`, `/start ref_{telegramId}`, `/start {quizId}` | Register user, handle referral activation, join shared quiz. Sends Georgian returning-user message when `MiniAppEnabled`. |
| `StopCommand` | MyChatMember update (user blocked bot) | Deactivate user account. |
| `MenuCommand` | `/menu`, 🧭 icon | Show main reply-keyboard. |
| `CloseMenuCommand` | ❌ icon | Hide reply keyboard. |
| `HelpCommand` | `/help`, 🆘 icon | Show support contact info. |
| `HowToCommand` | `/howto` | Show usage instructions. |
| `SetInitialLanguage` | `/setinitiallanguage {lang}` | Persist the user's primary learning language once. |
| `ChangeCurrentLanguageMenuCommand` | `/changelanguagemenu` | Display supported-language buttons. |
| `ChangeCurrentLanguageCommand` | `/changelanguage {lang}` | Switch active learning language (requires Pro to keep multiple vocabs). |
| `ChangeCurrentLanguageAndDeleteVocabularyCommand` | `/chadl` callback | Free path to switch language (drops old vocab). |

### Vocabulary
| Class | Command / trigger | Purpose |
|---|---|---|
| `VocabularyCommand` | `/vocabulary`, 📘 icon | Paginated list of saved words with mastery medals. |
| `RemoveEntryCommand` | `/removeentry {id}` callback | Delete a vocabulary entry. |
| `TranslateCommand` | Any free-form text without `/` | Auto-translate in current language and save. |
| `TranslateManuallyCommand` | `{word}-{translation}` | Record a manual pair without calling the translator. |
| `TranslateAndDeleteVocabularyCommand` | `/tradl` callback | Translate into a new language while dropping the old vocab (free-tier path). |
| `ChangeTranslationLanguageCommand` | `/changetranslation`, 🌐 icon | Offer to translate the last word into another language. |
| `TranslateToAnotherLanguageAndChangeCurrentLanguageBotCommand` | `/swaplang` callback | Translate + switch active language in one step. |

### Quizzes
| Class | Command / trigger | Purpose |
|---|---|---|
| `QuizCommand` | `/quiz`, 🎲 icon | Start a quiz from personal vocabulary. |
| `StartQuizBotCommand` | `/quiz {args}` | Start quiz with preconfigured parameters. |
| `StopQuizBotCommand` | `/stopquiz`, 🛑 icon | Abort an in-progress quiz. |
| `CheckQuizAnswerBotCommand` | Text while a quiz is active | Grade the answer, update mastery, handle shared-quiz completion. |
| `ShowExampleCommand` | `/showexample {id}` | Send a usage example for a word mid-quiz. |

### Monetization / trial
| Class | Command / trigger | Purpose |
|---|---|---|
| `PayCommand` | `/pay`, 💳 icon | Offer subscription plan options (Month / 3M / Year). |
| `RequestInvoiceCommand` | `/requestinvoice {term}` | Send classic Telegram invoice for the selected term. |
| `AcceptCheckoutCommand` | PreCheckoutQuery (non-Stars) | Approve the Telegram pre-checkout for classic payments. |
| `AcceptStarsCheckoutCommand` | PreCheckoutQuery (`Stars_Pro_*` payload) | Approve Telegram Stars pre-checkout. |
| `ActivateProOnStarsPaymentCommand` | SuccessfulPayment (XTR currency) | Flip `IsPro` after Stars payment; write `Payment` row. |
| `OfferTrialCommand` | `/offertrial` | Offer the one-month free trial. |
| `ActivateTrialCommand` | `/activatetrial` | Activate trial subscription. |

### Stats & gamification
| Class | Command / trigger | Purpose |
|---|---|---|
| `AchievementsCommand` | `/achievements`, 📊 icon | Show achievements + stats. |

### Georgian module content
| Class | Command / trigger | Purpose |
|---|---|---|
| `GeorgianRepetitionModulesCommand` | `/georgianrepetitionmodules` | Show menu of Georgian modules available in the bot chat (not the mini-app). |
| `GeorgianVerbsOfMovementCommand` | `/georgianverbsofmovement` | Show the 11-lesson Verbs of Movement index. |
| `GeorgianVerbsLessonCommand` | `/georgianverbslesson{1..11}` | Render theory text for the selected VoM lesson. |
| `GeorgianVerbsQuizCommand1` .. `GeorgianVerbsQuizCommand11` | `/georgianverbsquizstart{1..11}` | Start the quiz for the corresponding lesson. |
| `GeorgianVerbsQuizAnswerCommand` | `/georgianverbsquizanswer` | Grade a VoM quiz answer. |

Command string constants live in `src/Infrastructure/Telegram/Models/CommandNames.cs`.

---

## 2 — Mini-app screens & reusable components

Location: `src/Trale/miniapp-src/src/`. The test greps the base file name (e.g. `Dashboard.tsx`) verbatim.

### Top-level screens (`src/screens/`)
| File | Screen kind | Purpose |
|---|---|---|
| `Dashboard.tsx` | `dashboard` | Main hub: launch-path bar, module tiles, streak, XP, mascot. |
| `ModuleMap.tsx` | `module` | Lesson list for a module. |
| `LessonTheory.tsx` | `lesson-theory` | Theory blocks + reveal overlay; launches Practice. |
| `Practice.tsx` | `practice` | Question-answer loop for a lesson. |
| `Result.tsx` | `result` | Lesson result summary with kilim strip. |
| `PracticeMistakes.tsx` | `practice-mistakes` | Redo previously-failed questions. |
| `MistakesResult.tsx` | `mistakes-result` | Summary after mistakes review. |
| `VocabularyList.tsx` | `vocabulary-list` | Personal vocabulary with search/filter + starter-deck onboarding card. |
| `VocabularyPractice.tsx` | `vocabulary-quiz` | Quiz built from personal vocabulary. |
| `Profile.tsx` | `profile` | Profile, alphabet progress, daily phrase banner, Share button, Pro CTA, OwnerDebugPanel (owner-only). |
| `Onboarding.tsx` | n/a (initial load) | Level picker (Beginner / Intermediate). |
| `LandingScreen.tsx` | n/a | Marketing page when Telegram context is missing. |
| `AdminScreen.tsx` | `admin` (owner only) | Bot stats dashboard. |
| `AdminUserScreen.tsx` | `admin-user` (owner only) | Inspect a single user; grant/revoke Pro. |

### Reusable components (`src/components/`)
| File | Purpose |
|---|---|
| `Button.tsx` | Styled button primitive. |
| `Header.tsx` | Top header bar. |
| `Mascot.tsx` | Bombora mascot (states: idle / hungry / fed / celebrating). |
| `LoaderLetter.tsx` | Georgian-letter loading indicator. |
| `AlphabetGrid.tsx` | Grid of Georgian letters. |
| `AlphaIndex.tsx` | A–Z style index row. |
| `LetterPopover.tsx` | Letter detail popup. |
| `GeoGlyph.tsx` | Renders a single Georgian glyph. |
| `GeorgianKeyboard.tsx` | Virtual keyboard for Georgian input. |
| `KilimProgress.tsx` | Kilim-pattern progress bar. |
| `MasteryIndicator.tsx` | Mastery medal (🥈 / 🥇 / 💎). |
| `WordCard.tsx` | Vocabulary word card. |
| `SketchCard.tsx` | Ink-style lesson card. |
| `Stamp.tsx` | Achievement stamp. |
| `StampBadge.tsx` | Badge with stamp inside. |
| `MilestoneBanner.tsx` | XP / streak milestone celebration. |
| `DayOfWeekChip.tsx` | Day indicator chip. |
| `LaunchPathBar.tsx` | Learning-path progress bar on Dashboard. |
| `TimeGreeting.tsx` | Time-of-day greeting. |
| `DashboardTopBar.tsx` | Dashboard header with user info. |
| `ProBadge.tsx` | Pro subscription indicator. |
| `ProPaywall.tsx` | Stars-XTR paywall modal. |
| `TreatShop.tsx` | Treat purchase UI (Dzval / Khorci / Mtsvadi / Churchkhela / Supra). |
| `FeedingAnimation.tsx` | Feeding animation for the mascot. |
| `FeedbackBanner.tsx` | Correct/incorrect answer feedback banner (სწორია!/არასწორია!) with transliteration and Russian label. |
| `RevealKaniOverlay.tsx` | Kani-screen reveal animation. |
| `InkDivider.tsx` | Ink-style divider. |
| `ModulePhraseBanner.tsx` | Daily phrase banner on Profile. |
| `ComingSoonTile.tsx` | Placeholder tile for not-yet-built modules. |
| `GeorgianNameCard.tsx` | Profile widget: user's name rendered in Georgian script (transliteration phase → reveal phase). |
| `DialogOfDayCard.tsx` | Dashboard card: «Диалог дня» — daily mini-dialogue (tap-to-reveal translations, collapse toggle). |
| `AudioPlayer.tsx` | Audio play-button component (idle/loading/playing/played/error states) for Listen & Choose questions. |
| `AudioChoiceCard.tsx` | Jewel-tile card for audio-choice questions: eyebrow «Послушай и выбери», AudioPlayer, transcript reveal (fades in after first play or on error). Used in Practice.tsx and PracticeMistakes.tsx. |

### Data (`src/data/`)
- `dialogs.ts` — 20 daily dialogues for `DialogOfDayCard`; rotates by calendar day.

### Static audio assets (`public/audio/`)
- `alphabet/` — 33 Georgian letter TTS clips (a–zh, ka-GE Piper voice), used by `audio-choice` lesson 11 in `alphabet-progressive`.
- `numbers/` — 20 Georgian number TTS clips (erti–otsi, 1–20, ka-GE Piper voice), used by `audio-choice` lesson 5 in `numbers`.
- `intro/` — 15 Georgian phrase TTS clips (ka-GE Natia voice), used by `audio-choice` lesson 6 in `intro`.
- `pronouns/` — 20 Georgian pronoun TTS clips (ka-GE Piper/Natia voice), used by `audio-choice` lesson 6 in `pronouns`.
- `present-tense/` — 20 Georgian present-tense verb TTS clips (ka-GE Piper voice), used by `audio-choice` lesson 6 in `present-tense`.

### Utilities (`src/utils/`)
- `georgianizerName.ts` — Latin/Cyrillic → Georgian transliteration for the Profile name widget.

---

## 3 — HTTP API endpoints

Location: `src/Trale/Controllers/`. Routes relative to controller base. Test greps the route strings verbatim.

### `MiniAppController` — `/api/miniapp`
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/miniapp/ping` | Health check. |
| GET | `/api/miniapp/content` | Module catalog (filtered by user level). |
| GET | `/api/miniapp/modules/{moduleId}/lessons/{lessonId}/questions` | Lesson questions. |
| GET | `/api/miniapp/me` | Authenticated user profile (isPro, trial, subscription). |
| GET | `/api/miniapp/plans` | Pro plan list with Stars pricing. |
| POST | `/api/miniapp/refund` | Refund a Stars payment within the allowed window. |
| POST | `/api/miniapp/purchase` | Create Telegram Stars invoice link. |
| POST | `/api/miniapp/treat` | Feed mascot (spend XP on a treat). |
| POST | `/api/miniapp/level` | Persist user level after onboarding. |
| POST | `/api/miniapp/progress/lesson-complete` | Record lesson completion. |
| GET | `/api/miniapp/referral` | Referral link + share text. |
| GET | `/api/miniapp/activity-days` | Daily activity series for streak. |
| GET | `/api/miniapp/vocabulary` | User's vocabulary entries. |
| POST | `/api/miniapp/vocabulary/quiz` | Start a vocabulary quiz. |
| POST | `/api/miniapp/vocabulary/answer` | Grade a vocabulary quiz answer. |
| DELETE | `/api/miniapp/vocabulary/{id}` | Delete a vocabulary entry. |
| POST | `/api/miniapp/translate` | Translate a word and add to vocabulary. |

### `AdminController` — `/api/admin` (owner-gated)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/stats` | Bot-wide stats. |
| GET | `/api/admin/signups` | Signups timeseries. |
| GET | `/api/admin/recent-users` | Recent users with filters. |
| GET | `/api/admin/users/{telegramId}` | User detail. |
| POST | `/api/admin/users/{telegramId}/grant-pro` | Grant Pro manually. |
| POST | `/api/admin/users/{telegramId}/revoke-pro` | Revoke Pro. |
| GET | `/api/admin/broadcast/preview` | Preview broadcast target. |
| POST | `/api/admin/broadcast` | Send broadcast. |

### Other controllers
| Controller | Path | Purpose |
|---|---|---|
| `TelegramController` | POST `/telegram/{token?}` | Telegram webhook receiver. |
| `HealthzController` | GET `/healthz` | Liveness probe. |

---

## 4 — Hosted services / background workers

Location: `src/Trale/HostedServices/`.

| Class | Trigger | Purpose |
|---|---|---|
| `CreateWebhook` | `StartAsync` | Register webhook, set chat menu button to mini-app, publish bot command list. |
| `PendingReferralsWorker` | Every 60s | Activate referrals once the referee crosses the engagement threshold. |
| `IdempotencyCleanupService` | Every 6h | Purge expired `ProcessedUpdate` rows. |

---

## 5 — EF Core migrations

Location: `src/Persistence/Migrations/`. Test greps the migration class name (after the timestamp underscore) verbatim.

| Migration | What it adds |
|---|---|
| `InitialCreate` | Initial User / VocabularyEntry / Quiz tables. |
| `CreateVocabularyEntry` | Vocabulary schema. |
| `QuizEntity` | Quiz + question tracking. |
| `FixRelationsOnQuiz` / `FixRelationsOnQuiz2` / `FixRelationsOnQuiz3` | Relationship fixes. |
| `SetManyToManyRelationsForQuiz` | Quiz M2M. |
| `QuizStatisticsFields` | Stats columns on Quiz. |
| `UserAccountTypeFieldAdded` | Account-type enum. |
| `UserSubscriptionTimeAndEntrySuccessFailureRate` | Subscription + success rate. |
| `AddInvoiceTable` | Invoice entity. |
| `AddInvoiceCreatedAdUtcColumn` | Invoice created-at. |
| `AddUserRegistredAtField` / `RenameUserRegistredAtField` | User registered-at. |
| `MakeSubscriptionFieldNullable` | Nullable subscription. |
| `AdditionalInfoToVocabularyEntry` | Extra info on entries. |
| `AddQuizQuestionTable` | QuizQuestion entity. |
| `CountInReverseDirectionColumn` | Reverse-direction count. |
| `RemoveQuizVocabularyEntryManyToManyConnection` | M2M refactor. |
| `AddAchievementsTable` | Achievement entity. |
| `AddExampleColumn` / `AddExampleColumnToQuiz` | Usage examples. |
| `ShareableQuizTable` | ShareableQuiz entity. |
| `ChangeVocabularyEntriesIsShareableQuizTable` | ShareableQuiz FK changes. |
| `ShareableQuizToQuizRelations` / `QuizTableShareableQuizForeignKey` | ShareableQuiz relations. |
| `AddDifferentQuizTypes` | Quiz-type enum. |
| `AddQuizOrderColumn` | Order field. |
| `UpdateDateUtcColumnToVocabularyEntry` | Updated-at on vocab. |
| `AddQuizHierarchy` | Parent quiz FK. |
| `AddCreatedByUserNameColumnToShareableQuiz` | Creator name. |
| `UserSettingsEntity` | UserSettings. |
| `AddLanguageColumnToVocabularyEntry` | Per-entry language. |
| `AddInitialLanguageSetColumn` | Initial-language flag. |
| `UserIsActive` | IsActive flag. |
| `AddProcessedUpdateTable` | Idempotency table. |
| `AddGeorgianQuizSessionTable` | Georgian quiz session. |
| `AddMiniAppUserProgress` | MiniAppUserProgress entity. |
| `AddLevelToMiniAppUserProgress` | Beginner / Intermediate level. |
| `AddIsProToUser` | IsPro on User. |
| `AddSubscriptionPlanAndPayments` | SubscriptionPlan + Payment entities. |
| `AddTreatShopFields` | Treat-shop columns (XP, treats-given). |
| `AddReferrals` | Referral entity + FK. |
| `AddLastFedAtUtc` | Last-fed timestamp. |
| `AddLastTreatIndex` | Last-treat index for rotation. |

---

## 6 — Content modules

Registered in `ModuleRegistry` (mini-app catalog) or exposed via Telegram commands. Files live in `src/Trale/Lessons/{Folder}/` (`questions*.json`) and theory in `src/Trale/MiniApp/MiniAppContentProvider.cs`.

### Launch modules (owner-approved)
| ID | Folder | Lessons | Theory |
|---|---|---|---|
| `alphabet-progressive` | `GeorgianAlphabetProgressive` | 11 (lesson 11 = audio-choice) | ✅ |
| `numbers` | `GeorgianNumbers` | 5 (lesson 5 = audio-choice) | ✅ |
| `intro` | `GeorgianVocabIntro` | 6 (lesson 6 = audio-choice) | ✅ |
| `pronouns` | `GeorgianPronouns` | 6 (lesson 6 = audio-choice) | ✅ |
| `present-tense` | `GeorgianPresentTense` | 6 (lesson 6 = audio-choice) | ✅ |
| `cases` | `GeorgianCases` | 8 | ✅ |
| `conditionals` | `GeorgianConditionals` | 5 | ✅ |

### Grammar modules
| ID | Folder | Lessons | Theory |
|---|---|---|---|
| `verb-classes` | `GeorgianVerbClasses` | 6 | ✅ |
| `version-vowels` | `GeorgianVersionVowels` | 5 | ✅ |
| `preverbs` | `GeorgianPreverbs` | 5 | ✅ |
| `imperfect` | `GeorgianImperfect` | 5 | ✅ |
| `aorist` | `GeorgianAorist` | 6 | ✅ |
| `future-tense` | `GeorgianFutureTense` | 2 (L1–L2; L3–L4 in #317) | ✅ |
| `pronoun-declension` | `GeorgianPronounDeclension` | 5 | ✅ |
| `postpositions` | `GeorgianPostpositions` | 5 | ✅ |
| `adjectives` | `GeorgianAdjectives` | 5 | ✅ |

### Vocabulary modules
| ID | Folder | Lessons | Theory |
|---|---|---|---|
| `cafe` | `GeorgianVocabCafe` | 5 | ✅ |
| `taxi` | `GeorgianVocabTaxi` | 5 | ✅ |
| `doctor` | `GeorgianVocabDoctor` | 5 | ✅ |
| `shopping` | `GeorgianVocabShopping` | 5 | ✅ |
| `emergency` | `GeorgianVocabEmergency` | 5 | ✅ |

### Legacy / alternative alphabet variants
`GeorgianAlphabetEasy`, `GeorgianAlphabetFull`, `GeorgianAlphabetCommon`, `GeorgianAlphabetTriples`, `GeorgianAlphabetVowels` — alternative presentations of the same alphabet content.

### Telegram-only
`GeorgianVerbsOfMovement` (11 lessons, invoked via `/georgianverbs*` commands, not on the mini-app catalog).

---

## 7 — Monetization, progress, gamification

### Domain entities (`src/Domain/Entities/`)
| Entity | Purpose |
|---|---|
| `User` | Account, IsPro flag, ProPurchasedAtUtc, subscription plan. |
| `Invoice` | Classic-payment tracking. |
| `Payment` | Telegram Stars (XTR) payment records. |
| `SubscriptionPlan` | Month / Quarter / HalfYear / Year / Lifetime. |
| `Referral` | Referrer ↔ referee relationship + activation state. |
| `Achievement` | Unlock criteria & user progress. |
| `MiniAppUserProgress` | XP, streak, completed lessons, treats given, last-fed timestamp, last-treat index. |
| `VocabularyEntry` | Mastery levels (NotMastered / Forward / Both). |
| `ProcessedUpdate` | Idempotency ledger for webhook retries. |
| `GeorgianQuizSession` | Active Georgian module quiz session. |
| `ShareableQuiz` / `SharedQuiz` | Link-shared quizzes. |
| `UserSettings` | Per-user preferences. |

### Application services (selected)
- `GetMiniAppProfileQuery` — profile + isPro / trial / plan
- `ActivateProStarsService` — flip IsPro on Stars payment
- `RefundProStarsService` — refund path within allowed window
- `ActivatePremiumCommand` — trial & subscription activation
- `ProcessPaymentCommand` — classic Stripe-style flow
- `RecordReferralLinkService` — record the referee-referrer link on `/start ref_*`
- `TryActivateReferralService` — activate once engagement threshold met
- `ProcessPendingReferralsService` — batch runner for the worker
- `FeedTreatService` — buy & feed a treat
- `AchievementsService` / `GetAchievementsQuery` — achievements

### Feature flags
- `BotConfiguration.MiniAppEnabled` — toggles mini-app menu button and Georgian returning-user `/start`.
- `BotConfiguration.OwnerTelegramId` — gates `AdminScreen`, `AdminUserScreen`, `OwnerDebugPanel`.

### Gamification mechanics
- **Streaks**: consecutive-day counter on `MiniAppUserProgress`, milestones in Dashboard.
- **XP**: earned per lesson, spent on treats. Costs: Dzval 10, Khorci 30, Mtsvadi 60, Churchkhela 100, Supra 200.
- **Mastery medals**: 🥈 new, 🥇 forward, 💎 both directions.
- **Treat shop**: 5 treats, `POST /api/miniapp/treat`, animation via `FeedingAnimation.tsx`.
- **Achievements**: locked/unlocked display in Profile + `/achievements` bot command.

### Shared quizzes
- `StartCommand` parses `/start {quizId}`, dispatches to `CreateQuizFromShareableCommand`.
- `CheckQuizAnswerBotCommand` handles shared-quiz completion.

---

## 8 — Admin / debug surfaces

- **`AdminScreen` / `AdminUserScreen`** — owner-only mini-app screens (gated by `OwnerTelegramId`).
- **`OwnerDebugPanel`** — embedded in `Profile.tsx`, only renders for owner.
- **Owner-only translate helpers** — `TranslateCommand` injects language-switch buttons + external translator links for the owner.

---

## 9 — Cross-cutting capabilities

- **Multi-language vocabulary**: Georgian + English. Premium for keeping multiple vocabs simultaneously.
- **Telegram Stars (XTR) payments**: all current Pro purchases on the mini-app.
- **Ink / kilim visual style**: shared across Result, LessonTheory, VocabularyList, Profile via `KilimProgress`, `InkDivider`.
- **Georgian name transliteration widget** (`GeorgianNameCard.tsx`) — Latin/Cyrillic → Georgian glyphs on Profile, uses `georgianizerName.ts` (~60-name dictionary + symbol fallback).

---

## How to extend this file

1. You changed a bot command → add / update the row in §1.
2. You added a screen or a reusable component → add the file name in §2.
3. You added a controller endpoint → add the route in §3.
4. You added a background worker → §4.
5. You added an EF migration → §5 (class name after the timestamp).
6. You added a content module → §6.
7. You added an entity or a monetization service → §7.
8. You added an admin / owner-only surface → §8.

If you did something that doesn't fit → add §10 or later, don't shove it into an unrelated section.

The integration test `FeatureCatalogCoverageTests` will tell you exactly which names are missing.
