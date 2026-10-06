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
| `TranslateCommand` | Any free-form text without `/` | Auto-translate in current language and save. Order: the user's dictionary → verb base (Georgian form / masdar, Russian gloss, Russian verb form matched by the stored plain-Russian meanings; no model, independent of the agent switch) → `TranslationCache` → open lexicon → models → old translator. The models are for verbs only: a noun, an adjective, a phrase or a sentence goes to the old translator (dictionary site, then Google) exactly as before. A verb the base does not have is taken from a Wiktionary table; a verb with no table is written out in full by a strong model (`TranslationAgent:GeneratorModel`), approved by a second model (`ReviewerModel`), stored with its provenance (`VerbProvenances`) and from then on served from the base and learned like any verb. Text that is clearly not a word (gibberish, a message to the bot — and the dictionary site does not know it either) gets «Это не похоже на слово для перевода…» and nothing is saved (`status: not_a_word` in `POST /api/miniapp/translate`). «печатает…» is shown while the reply is prepared. Georgian goes through `GeorgianTranslationPipeline` (verb base → `TranslationCache` → optional agent path on Microsoft Agent Framework, off unless `TranslationAgent:Enabled` → old translator). When the word or its translation is a known verb form, the reply ends with a parse line (form, tense, person, masdar, translation) and starts with a «Все формы» WebApp button → `?screen=verb&verbId=…&tense=…&person=…`. |
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

### Notifications
| Class | Command / trigger | Purpose |
|---|---|---|
| `NotificationsCommand` | `/notifications`, `/notifications on`, `/notifications off` | Bot-command shortcut to flip `User.NotificationsEnabled` without opening the mini-app. No arg → status. |

### Georgian module content
| Class | Command / trigger | Purpose |
|---|---|---|
| `GeorgianRepetitionModulesCommand` | `/georgianrepetitionmodules` | Show menu of Georgian modules available in the bot chat (not the mini-app). |
| `GeorgianVerbsOfMovementCommand` | `/georgianverbsofmovement` | Show the Verbs of Movement index (L1–L11 via bot; L12 audio-choice is mini-app only). |
| `GeorgianVerbsLessonCommand` | `/georgianverbslesson{1..11}` | Render theory text for the selected VoM lesson. |
| `GeorgianVerbsQuizStartCommand` | `/georgianverbsquizstart{1..11}` | Start the quiz for the corresponding lesson (parameterised; 11 DI registrations). |
| `GeorgianVerbsQuizAnswerCommand` | `/georgianverbsquizanswer` | Grade a VoM quiz answer. |

Command string constants live in `src/Infrastructure/Telegram/Models/CommandNames.cs`.

---

## 2 — Mini-app screens & reusable components

Location: `src/Trale/miniapp-src/src/`. The test greps the base file name (e.g. `Dashboard.tsx`) verbatim.

### Top-level screens (`src/screens/`)
| File | Screen kind | Purpose |
|---|---|---|
| `Dashboard.tsx` | `dashboard` | Main hub: launch-path bar, module tiles, streak, XP, mascot. Under the "what next" suggestion there is at most one quiet verbs line (`verbs/VerbsDashboardLine`, choice in `verbs/dashboardLine.ts`): «Продолжить глагол «X» · уровень» opens that verb's view (when a verb is being learned), otherwise «В твоём словаре N глаголов — посмотри формы» opens the dictionary on the «глаголы» filter. Hidden for a newcomer, during onboarding hints and without trial/Pro. |
| `ModuleMap.tsx` | `module` | Lesson list for a module. |
| `LessonTheory.tsx` | `lesson-theory` | Theory blocks + reveal overlay; launches Practice. |
| `Practice.tsx` | `practice` | Question-answer loop for a lesson. After an answer is checked, a question about a catalog verb shows a compact «глагол … формы →» line (`verbs/lesson/LessonVerbChip`) that opens the verb card `VerbSheet` over the lesson on the tense and person of the form from the question; never shown before the answer. |
| `Result.tsx` | `result` | Lesson result summary with kilim strip. If the lesson had catalog verbs: «в этом уроке были глаголы» with up to three verbs, each opening its verb card (`verbs/lesson/LessonVerbsLine`). |
| `PracticeMistakes.tsx` | `practice-mistakes` | Redo previously-failed questions. |
| `MistakesResult.tsx` | `mistakes-result` | Summary after mistakes review. |
| `VocabularyList.tsx` | `vocabulary-list` | Personal vocabulary with search/filter + starter-deck onboarding card. A dictionary entry that IS a verb form opens the verb view directly on tap (the saved word and its plain meaning first, then level and the play button, then the forms table; «в квиз» / «удалить» as quiet actions at the bottom) and shows the verb's level instead of the mastery dot. The «глаголы» filter (can be pre-selected: dashboard line, deep link) lists "my verbs", one row per verb with its level and saved forms (`verbs/dictionary/MyVerbRows`), including verbs started from a lesson or a translation. A phrase that merely contains a verb form keeps the «глагол» badge and opens the word card; the word card and the translation result show the parse with «все формы», which opens the verb card sheet `VerbSheet`: six main forms, person switcher, collapsed rare tenses and explanation, one quiet line «составлено нейросетью» for model-made verbs, the verb level and one play button (`verbs/session/SessionEntry`) that starts a session composed by the app. Deep link `?screen=verb&verbId=<lemma>[&tense=&person=]` opens the dictionary with the verb card on top. |
| `VocabularyPractice.tsx` | `vocabulary-quiz` | Quiz built from personal vocabulary. |
| `Profile.tsx` | `profile` | Profile, alphabet progress, daily phrase banner, Share button, Pro CTA, OwnerDebugPanel (owner-only). |
| `Onboarding.tsx` | n/a (initial load) | Level picker (Beginner / Intermediate). |
| `Welcome.tsx` | `welcome` | Soft-onboarding first lesson: meet letter ა (name + sound + audio), a listening task and a name task; awards the first XP before the hub is revealed. |
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
| `WordCard.tsx` | Vocabulary word card (slide-up sheet). Shows Georgian/Russian sides, mastery, stats, delete confirmation. Displays `AudioPlayer` when `item.audioUrl` is set (starter words). |
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
| `SentenceBuilderCard.tsx` | Card for `sentence-builder` questions: slot row + chip pool, tap-to-place interaction, preset slots, Verify button, FeedbackBanner on check. Used in Practice.tsx. |
| `SentenceSlotRow.tsx` | Row of SentenceSlot components for the sentence-builder layout. |
| `SentenceSlot.tsx` | Single droppable slot in the sentence-builder (empty / preset / filled states). |
| `ChipPool.tsx` | Scrollable pool of WordChip tokens for sentence-builder drag-to-slot interaction. |
| `WordChip.tsx` | Tappable chip representing one Georgian word token; selected/used states. |

### Data (`src/data/`)
- `dialogs.ts` — 20 daily dialogues for `DialogOfDayCard`; rotates by calendar day.

### Static audio assets (`public/audio/`)
- `alphabet/` — 33 Georgian letter TTS clips (a–zh, ka-GE Natia voice); audio plays the full letter **name** (ანი/ბანი/განი…), not the isolated sound. Used by `audio-choice` questions in L1–L7 (1–2 questions each) and L11 (20 questions, full review of all 33 letters) in `alphabet-progressive`.
- `numbers/` — 20 Georgian number TTS clips (erti–otsi, 1–20, ka-GE Piper voice), used by `audio-choice` lesson 5 in `numbers`.
- `intro/` — 15 Georgian phrase TTS clips (ka-GE Natia voice), used by `audio-choice` lesson 6 in `intro`.
- `pronouns/` — 20 Georgian pronoun TTS clips (ka-GE Piper/Natia voice), used by `audio-choice` lesson 6 in `pronouns`.
- `present-tense/` — 20 Georgian present-tense verb TTS clips (ka-GE Piper voice), used by `audio-choice` lesson 6 in `present-tense`.
- `vocabulary/` — 20 Georgian starter vocabulary TTS clips (ka-GE voice), used by `AudioPlayer` in `WordCard.tsx` for the 20 starter words shown in `VocabularyList`.
- `verb-classes/` — 15 Georgian verb TTS clips (ka-GE Natia voice), used by `audio-choice` lesson 7 in `verb-classes`.
- `postpositions/` — 24 Georgian postposition/location TTS clips (ka-GE Natia voice, includes combined forms), used by `audio-choice` lesson 6 in `postpositions`.
- `cafe/` — 15 Georgian cafe/restaurant vocabulary TTS clips (ka-GE Natia voice), used by `audio-choice` lesson 6 in `cafe`.
- `verbs-of-movement/` — 15 Georgian motion verb TTS clips (ka-GE Natia voice; present/aorist/future paradigms), used by `audio-choice` lesson 12 in `verbs-of-movement`.
- `adjectives/` — 17 Georgian adjective TTS clips (ka-GE voice; single adjectives + two adjective+noun phrases), used by `audio-choice` lesson 6 in `adjectives`.
- `cases/` — 15 Georgian noun-case TTS clips (ka-GE voice; nominative/ergative/dative/genitive/adverbial forms), used by `audio-choice` lesson 9 in `cases`.
- `shopping/` — 15 Georgian shopping vocabulary TTS clips (ka-GE voice; food, dairy, spices, drinks + price phrases), used by `audio-choice` lesson 6 in `shopping`.
- `taxi/` — 15 Georgian transport/direction TTS clips (ka-GE Natia voice; taxi, bus, metro, stops, directions + city places), used by `audio-choice` lesson 6 in `taxi`.
- `doctor/` — 15 Georgian medical vocabulary TTS clips (ka-GE Natia voice; body parts, symptoms, pain phrases), used by `audio-choice` lesson 6 in `doctor`.
- `imperfect/` — 15 Georgian imperfect-tense verb TTS clips (ka-GE voice; 1st/2nd/3rd person forms of common verbs), used by `audio-choice` lesson 6 in `imperfect`.
- `conditionals/` — 15 Georgian conditional-mood TTS clips (ka-GE Natia voice; conjunctions თუ/რომ, imperfect forms, conditional-mood forms, subjunctive forms), used by `audio-choice` lesson 6 in `conditionals`.

### Utilities (`src/utils/`)
- `georgianizerName.ts` — Latin/Cyrillic → Georgian transliteration for the Profile name widget.

### Verb sessions (`src/verbs/session/`) and their scenes
One button on the verb card — «Выучить играя» (label follows the state: «Продолжить игру», «Играть дальше», «Сыграть и сдать экзамен», «Сыграть ещё») — starts a 2–3 minute session of at most three short scenes. The learner never picks a game: `planSession` (`session/plan.ts`, a pure function) composes the session from the verb's level, per-form progress, what the verb supports and what the learner can do (no typing before the alphabet is finished), and remembers past sessions so two days do not start the same way. Every scene reports per-form results into `VerbFormProgress`; the header bar shows only this session and grows after every task. Session position, level and the director's memory live on the server (`UserVerb`, `VerbSession`), so a reload or another device continues from the same place. A finished session earns XP and marks the day active, once.

| File | Purpose |
|---|---|
| `session/plan.ts` | The session director: learner situation → up to three scenes with targets, sizes, time estimate and a machine-readable reason. Hard caps: 3 scenes, 3 new forms, 180 s. |
| `session/Session.tsx` | The session shell: session bar, scene switching, save after every answer (`session/sync.ts`), resume, finish. |
| `session/QuizScene.tsx` | Quiz scenes from a given task list: meeting new forms («Новое слово»), recognition, real sentences (gap / build), warm-up of due forms, and the exam (one attempt per question; passing it makes the verb «выучен»). |
| `session/Finish.tsx` | The finish screen: what was in play as plain phrases with their Georgian forms, XP, the verb level (`session/LevelBadge.tsx`), «Ещё одну» / «Готово». |
| `session/SessionEntry.tsx` | Level and the play button on the verb card. |
| `games/TimeMachine.tsx` | Scene «Машина времени»: three stops (aorist / present / future); the tapped form sends the mascot to the stop it really belongs to. In a session it asks the cells the director chose. Needs all six persons in the three tenses with no form shared between cells. |
| `games/Bones.tsx` | Scene «Косточки»: the conjugation table as a minesweeper-style field (3×3 with two bones in a session); a cell is dug by typing its form or — for learners who do not type yet — by picking from four options. |
| `games/Builder.tsx` | Scene «Конструктор»: assemble a form from preverb + person marker + root + ending; the difficulty stage is set by the director. Only for `pattern` verbs whose forms split cleanly (future = preverb + present). |
| `story/StoryReader.tsx` | Scene «Комикс»: the natural first session of a verb that has a story; read once (the flag is stored on the server). |

---

## 3 — HTTP API endpoints

Location: `src/Trale/Controllers/`. Routes relative to controller base. Test greps the route strings verbatim.

### `MiniAppController` — `/api/miniapp`
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/miniapp/ping` | Health check. |
| GET | `/api/miniapp/content` | Module catalog (filtered by user level). |
| GET | `/api/miniapp/modules/{moduleId}/lessons/{lessonId}/questions` | Lesson questions. For a caller with trial/Pro each question carries `verb` — the parse (verb, tense, person) of the catalog verb form in its correct answer, else in the built sentence, audio transcript or question text; wrong options are not searched. `null` otherwise and for callers without access. |
| GET | `/api/miniapp/me` | Authenticated user profile (isPro, trial, subscription). `uiHintsSeen` lists the one-time interface hints (`ui:…`: rules and first-move hints of verb games, the verb card's person hint, the lesson chip hint) the user has already seen, so they do not come back after a reload or on another device. |
| GET | `/api/miniapp/plans` | Pro plan list with Stars pricing. |
| POST | `/api/miniapp/refund` | Refund a Stars payment within the allowed window. |
| POST | `/api/miniapp/purchase` | Create Telegram Stars invoice link. |
| POST | `/api/miniapp/treat` | Feed mascot (spend XP on a treat). |
| POST | `/api/miniapp/level` | Persist user level after onboarding. |
| POST | `/api/miniapp/onboarding/hint-seen` | Mark a hint as shown: an onboarding step (starts the ~20h gap to the next one) or a one-time interface hint `ui:<id>` (stored in the same list, `MiniAppUserProgress.OnboardingHintsJson`, without starting the gap). Unknown keys are rejected. |
| POST | `/api/miniapp/progress/lesson-complete` | Record lesson completion. |
| GET | `/api/miniapp/referral` | Referral link + share text. |
| GET | `/api/miniapp/activity-days` | Daily activity series for streak. |
| GET | `/api/miniapp/vocabulary` | User's vocabulary entries. An entry that contains a known verb form carries `verb` (the parse) with `single` — the entry IS that one form, not a phrase around it — and the learner's `level` of the verb. `verbs` is "my verbs", one row per verb: verbs whose forms are saved (with the saved forms) ∪ verbs started in play from a lesson or a translation, started ones first. Stored entries are not changed. |
| POST | `/api/miniapp/vocabulary/quiz` | Start a vocabulary quiz. |
| GET | `/api/miniapp/verbs` | (not used by the mini-app UI yet) List of verbs (id, masdar title, translation, kind, 1sg present, `status` verified/generated — `generated` = written by a model and approved by a second one; SEO pages must still skip it). 401 without auth, 402 without trial/Pro. |
| GET | `/api/miniapp/verbs/summary` | What the dashboard may say about verbs: `dictionaryVerbs` — how many of the user's own dictionary entries contain a known verb form; `continueVerb` — the verb the learner played most recently and has not learned yet (id, title, translation, level), or null. 401 without auth, 402 without trial/Pro. |
| GET | `/api/miniapp/verbs/parse?form=` | Parse an exact Georgian form into (verb, tense, person) hits; empty list when unknown. |
| GET | `/api/miniapp/verbs/{id}` | Full verb card (paradigm, root, odd tenses, model verb, source, `status`). Verbs added at runtime by the translation agent are served the same way. |
| GET | `/api/miniapp/verbs/progress` | Verb ladder: verbs the user is learning (started / mastered / total forms, forms due for repetition, last practised) + total `dueForms`. For a "continue verb X" entry point. |
| GET | `/api/miniapp/verbs/{id}/progress` | Verb ladder: the user's per-form progress for one verb (step, best step, reviews, next due) and `canLearn`. Model-made (Generated) verbs are learned like any other. |
| POST | `/api/miniapp/verbs/{id}/progress` | Verb ladder: save answered steps as a batch `{forms:[{tense,person,step,reviews,at}]}`. Idempotent (last-write-wins by answer time), skips cells the verb does not have, schedules repetition of mastered forms (1–3 days). |
| GET | `/api/miniapp/verbs/{id}/learning` | The verb as the learner's own thing: per-form progress, `level` (new → meeting → recognising → phrases → examReady → learned, derived server-side by `VerbLevelRules`), the director's memory (sessions played, recent scenes, comic read, exam passed), the learner in general (onboarding level, `canType`, dictionary size, verbs in it, verbs learned) and the unfinished `session` (plan, scene, tasks done) to continue. |
| POST | `/api/miniapp/verbs/{id}/session` | Session report after every answer: `{sessionId, plan, scene, done, forms, finished, scenes, storyCompleted, examAsked, examCorrect}`. Idempotent (session id comes from the mini-app; position only moves forward; form steps are last-write-wins). A finished session is credited once: +10 XP (first 5 sessions of a UTC day), streak and active day like a finished lesson; an exam with at most one mistake sets the verb to «выучен». |
| GET | `/api/miniapp/verbs/{id}/stories` | Comic stories («кадр под замком») of a verb with lines resolved from the catalog by Tatoeba sentence id; empty list when the verb has none. Played as a scene of a verb session (`verbs/story/StoryReader.tsx`). Same 401/402 gate. |
| POST | `/api/miniapp/vocabulary/answer` | Grade a vocabulary quiz answer. An entry that is a single verb form stays in the quiz like any word; a correct answer is also credited to the verb (`VerbQuizCreditService`): that form moves one step, recognition only — never above "solid", never down — and the verb becomes one of "my verbs". |
| DELETE | `/api/miniapp/vocabulary/{id}` | Delete a vocabulary entry. |
| POST | `/api/miniapp/translate` | Translate a word and add to vocabulary. |

### `AdminController` — `/api/admin` (owner-gated)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/stats` | Bot-wide stats. |
| GET | `/api/admin/signups` | Signups timeseries. |
| GET | `/api/admin/recent-users` | Recent users with filters. |
| GET | `/api/admin/users/{telegramId}` | User detail. |
| GET | `/api/admin/verbs/model-made` | Verbs written by a model and approved by a model (`ModelMadeVerbsQuery`): lemma, gloss, the text that led to it, generator / reviewer model ids, when, repair rounds, attested forms count and the unattested forms, lexicon hit, the reviewer's reasons, learners. `?unrevised=true` leaves out revised ones. The list a human revision works from. |
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
| `SeedVerbCatalog` | On startup | Loads the curated verb catalog `src/Trale/Verbs/verbs.json` (built by `scripts/verbs/build-catalog.mjs` from Wiktionary) into `Verbs` / `VerbForms`; idempotent, rewrites only changed verbs. |
| `LoadVerbStories` | On startup | Reads comic stories `src/Trale/Verbs/stories/*.json` and resolves their lines against `Verbs/verbs.json` into the in-memory `VerbStoryCatalog`; a story that does not resolve is logged and skipped. Authoring: `src/Trale/Verbs/stories/README.md`. |
| `ReturnPushWorker` | Daily at 10:00 UTC | Dispatch D1+ return push to users who started a lesson but didn't return (#940). |
| `HourlyNotificationWorker` | Every top-of-hour UTC | Fan-out tick for contextual pushes — calls `IHolidayNotificationService` / `ICoinsNotificationService` / `IStreakNotificationService` with fault-isolation. Holiday push uses `TbilisiMorningWindow` to fire only at 09:xx Tbilisi (#997, epic #894). |

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
| `AddSentenceBuilderProgressJson` | Per-user sentence-builder mastery progress (questionId → correct-count map) for L4/L5 progression gate. |
| `AddTrialBonusDays` | Cumulative referral trial-bonus days on User; lets bonuses stack and survive trial expiry without rewriting RegisteredAtUtc. |
| `AddUserNotificationsEnabled` | Per-user notifications opt-out flag on User (default on); toggled from the mini-app Profile, honoured by the D1+ return-push dispatch. |
| `AddNotificationTriggers` | NotificationTrigger table (per-source last-sent timestamp + variant) backing the 7-day cooldown of the D1+ return-push dispatch. |
| `MakeNotificationTriggerUnique` | Dedups existing rows and makes the NotificationTrigger (UserId, Source) index unique, so the atomic claim-before-send can't double-fire the return push across overlapping dispatch runs (incident 2026-06-17). |
| `AddOnboardingHintsJson` | Adds nullable OnboardingHintsJson to MiniAppUserProgress — persisted state (seen hints + lastShownAt) for the contextual, time-spread onboarding nudges. |
| `AddActivityDaysJson` | Adds nullable ActivityDaysJson to MiniAppUserProgress — per-day mini-app play log (one UTC timestamp per played day) so the profile activity heatmap lights one cell per played day instead of only the single LastPlayedAtUtc point. |
| `AddUserAcquisitionSource` | Adds nullable AcquisitionSource to User — first-touch acquisition tag captured from the /start deep-link payload (e.g. "site") or the mini-app start_param, so registrations can be attributed to landing/channel/post/direct traffic. |
| `AddVerbCatalog` | Adds `Verbs` (lemma, title, translation, kind, card JSON, status Verified/Generated) and `VerbForms` (form → verb, tense, person index) for the mini-app «Глаголы» section. |
| `AddVerbFormProgress` | Adds `VerbFormProgresses` — per-user progress of the verb ladder: one row per (user, verb, tense, person) with step, best step, reviews and next-due time; unique per cell, indexed by (user, next due). |
| `AddVerbFormMeaning` | Adds nullable `Meaning` and `MeaningNote` to `VerbForms` — what a form means in plain Russian, conjugated for its verb («я хотел(а)»), and the short note that tells apart tenses whose Russian phrase is the same; shown instead of tense names in exercises, hints and the bot's parse line. |
| `AddUserVerbsAndSessions` | Adds `UserVerbs` — one row per (user, verb): level, started at, sessions played, last played, exam passed at, recent scenes, comic read — and `VerbSessions` — one 2–3 minute play session (client-chosen id, plan JSON, scene, tasks done, finished at, XP earned); a finished session is credited once. |
| `AddVerbProvenance` | Adds `VerbProvenances` — one row per model-made verb: the text that led to it, generator and reviewer model ids, approval time, repair rounds, forms total / attested, unattested forms (JSON), lexicon hit, the reviewer's reasons, `RevisedAtUtc` (null until a human revises it). Cascade-deleted with the verb. |
| `AddTranslationCache` | Adds `TranslationCache` (normalised key + direction unique, definition / additional info / example, source, classified flag, hit count, timestamps): repeated Georgian lookups are answered from the DB instead of the external dictionary sites. |

---

## 6 — Content modules

Registered in `ModuleRegistry` (mini-app catalog) or exposed via Telegram commands. Files live in `src/Trale/Lessons/{Folder}/` (`questions*.json`) and theory in `src/Trale/MiniApp/MiniAppContentProvider.cs`.

### Launch modules (owner-approved)
| ID | Folder | Lessons | Theory |
|---|---|---|---|
| `alphabet-progressive` | `GeorgianAlphabetProgressive` | 11 (L1–L7 each end with 1–2 audio-choice questions; L11 = full audio review «Слушай и выбери» — 20 letter names ანი/ბანი/განი) | ✅ |
| `numbers` | `GeorgianNumbers` | 5 (lesson 5 = audio-choice) | ✅ |
| `intro` | `GeorgianVocabIntro` | 8 (L6 = audio-choice; L7 = SOS-phrases: Help/I don't understand/Slowly/Repeat/Doctor; L8 = navigation: Where is?/How much?/Ambulance/Police) | ✅ |
| `pronouns` | `GeorgianPronouns` | 6 (lesson 6 = audio-choice) | ✅ |
| `present-tense` | `GeorgianPresentTense` | 7 (L6 audio-choice; L7 sentence-builder — SOV конструктор) | ✅ |
| `cases` | `GeorgianCases` | 10 (L9 audio-choice; L10 sentence-builder — эргатив и датив) | ✅ |
| `conditionals` | `GeorgianConditionals` | 6 (L6 = audio-choice «Слушай и выбери» — кондиционал vs имперфект) | ✅ |

### Grammar modules
| ID | Folder | Lessons | Theory |
|---|---|---|---|
| `verb-classes` | `GeorgianVerbClasses` | 7 (L7 audio-choice) | ✅ |
| `version-vowels` | `GeorgianVersionVowels` | 6 (L6 audio-choice) | ✅ |
| `preverbs` | `GeorgianPreverbs` | 6 (L6 audio-choice «Слушай и выбери» — превербы на слух) | ✅ |
| `imperfect` | `GeorgianImperfect` | 6 (L6 audio-choice) | ✅ |
| `verbs-of-movement` | `GeorgianVerbsOfMovement` | 12 (L12 audio-choice) | ✅ |
| `aorist` | `GeorgianAorist` | 6 | ✅ |
| `future-tense` | `GeorgianFutureTense` | 2 (L1–L2; L3–L4 in #317) | ✅ |
| `pronoun-declension` | `GeorgianPronounDeclension` | 6 (L6 audio-choice) | ✅ |
| `postpositions` | `GeorgianPostpositions` | 7 (L6 audio-choice; L7 sentence-builder — конструктор предложений) | ✅ |
| `adjectives` | `GeorgianAdjectives` | 6 (lesson 6 = audio-choice) | ✅ |

### Vocabulary modules
| ID | Folder | Lessons | Theory |
|---|---|---|---|
| `cafe` | `GeorgianVocabCafe` | 7 (L6 audio-choice; L7 sentence-builder — «Я хочу кофе») | ✅ |
| `taxi` | `GeorgianVocabTaxi` | 7 (L6 audio-choice; L7 sentence-builder — «Поехали в Батуми») | ✅ |
| `doctor` | `GeorgianVocabDoctor` | 6 (L6 audio-choice) | ✅ |
| `shopping` | `GeorgianVocabShopping` | 7 (L6 audio-choice; L7 sentence-builder — «Сколько стоит?») | ✅ |
| `emergency` | `GeorgianVocabEmergency` | 6 (L6 audio-choice) | ✅ |

### Legacy / alternative alphabet variants
`GeorgianAlphabetEasy`, `GeorgianAlphabetFull`, `GeorgianAlphabetCommon`, `GeorgianAlphabetTriples`, `GeorgianAlphabetVowels` — alternative presentations of the same alphabet content.

### Telegram-only
`GeorgianVerbsOfMovement` (12 lessons, invoked via `/georgianverbs*` commands; also served via mini-app ModuleRegistry as `verbs-of-movement`).

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

### Exercise types (QuizQuestionData extensions)

| Type string | DTO | Fields |
|---|---|---|
| `choice` (default) | — | `options`, `answerIndex` |
| `type` | — | `options` (single item — the correct Georgian word) |
| `audio-choice` | — | `audioUrl`, `transcript` |
| `sentence-builder` | `SentenceBuilderQuestion` | `targetSentence.ru`, `level`, `correctOrder`, `chipPool`, `presetPositions`, `hints` |

`SentenceBuilderQuestion` lives in `src/Infrastructure/Telegram/Services/SentenceBuilderQuestion.cs`.  
Validation: loader logs a warning and skips any sentence-builder question whose `correctOrder` contains a token absent from `chipPool`.

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
- `DailyReturnNotificationService` — D1+ return push, picks least-progressed module, claim-before-send (#940)
- `StreakNotificationService` — streak-milestone push at exact 7 / 30 / 100 days; per-milestone `streak_{n}` trigger (epic #894, §82, #995)
- `CoinsNotificationService` — coins-stale push when ≥50 spendable XP + no feeding in 7d; 7-day cooldown via `coins` trigger (epic #894, §82, #994)
- `HolidayCalendarService` — pure lookup over the V1 Georgian holiday catalog (9 fixed dates + Julian Easter) used by the holiday push (epic #894, §82, #992)
- `HolidayNotificationService` — celebratory push on Georgian holidays; 24h cooldown via `holiday` trigger with `Variant=Holiday.Key` (epic #894, §82, #993)

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
