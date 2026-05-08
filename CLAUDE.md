# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TraleBot — Telegram mini-app for learning Georgian (ქართული). Прод бот: `@trale_bot`, лендинг: tralebot.com, локальный тест-бот: `@traletest_bot`.

Главный продукт — мини-апп внутри Telegram WebApp. Бэкенд .NET 10 отдаёт REST API + контент уроков, фронт — React-SPA в `src/Trale/wwwroot/`. Что учит пользователя: алфавит, числа, грамматика (падежи, послелоги, спряжение, аорист, имперфект, условия), тематический словарь (кафе, шопинг, такси и т.д.), личный словарь с квизами.

Монетизация — Telegram Stars (XTR), pay-once Pro. 6 launch-модулей бесплатны, остальные за Pro. Без hearts/lives и без gating контента (после оплаты — всё доступно).

## Architecture

.NET 10 / C# / Clean Architecture, слои:

- **Domain** (`src/Domain/`) — сущности и доменная логика
- **Application** (`src/Application/`) — use cases, команды/запросы (CQRS, миграция от MediatR к services по ARCHITECTURE.md)
- **Infrastructure** (`src/Infrastructure/`) — Telegram Bot API, TTS, монетизация, observability
- **Persistence** (`src/Persistence/`) — EF Core, миграции, конфигурации
- **Trale** (`src/Trale/`) — Web API entry point, контроллеры, мини-апп (React в `miniapp-src/`, билд в `wwwroot/`)

См. `ARCHITECTURE.md` для актуального таргет-стейта (Clean Arch + services + SRP, no leaky abstractions).

## Development Commands

### Building and running

```bash
# Полный солюшн
dotnet build TraleBot.sln

# Локальный API на :1402
dotnet run --project src/Trale --launch-profile TraleBot

# Образ для прода
docker build -t undermove/tralebot:latest .
docker run -p 1402:1402 undermove/tralebot:latest
```

### Testing

```bash
# Все .NET тесты (unit + integration с Testcontainers/Postgres)
dotnet test TraleBot.sln

# Только unit, без Testcontainers
dotnet test tests/Domain.UnitTests tests/Application.UnitTests tests/Infrastructure.UnitTests

# Mini-app E2E (Playwright, моки /api/* через page.route)
cd src/Trale/miniapp-src && npx playwright test

# Mini-app component tests (vitest + @testing-library/react)
cd src/Trale/miniapp-src && npm run test
```

IntegrationTests требуют Docker для Testcontainers. В среде агентов `TESTCONTAINERS_RYUK_DISABLED=true` и `TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal` — без них Postgres-контейнер не подымется.

### Local Development Setup

```bash
docker compose -f docker-compose-local.yml up -d                    # 1. Postgres
cd src/Trale/miniapp-src && npm install && npm run build && cd -    # 2. Сборка SPA в wwwroot/
dotnet run --project src/Trale --launch-profile TraleBot            # 3. API на :1402
ngrok http 1402                                                      # 4. Туннель в отдельном терминале
```

Дальше: скопировать ngrok URL в `src/Trale/appsettings.local.json` → `BotConfiguration.HostAddress`, перезапустить dotnet, открыть `@traletest_bot` в Telegram.

## Key Components

### Mini-app and Bot

- Контроллеры мини-аппа в `src/Trale/Controllers/MiniAppController.cs` — `/api/miniapp/*`
- Команды бота в `src/Infrastructure/Telegram/BotCommands/`
- TTS (грузинский голос) — Piper, ka_GE-natia-medium, через `src/Infrastructure/Tts/`
- Платежи через Telegram Stars (XTR), не внешний provider

### Quiz system (`src/Application/Quizzes/`)

- Типы вопросов: multiple choice, type answer, audio choice, letter reveal, sentence builder
- Прогресс по уровням усвоения (mastery) на слово в личном словаре
- «Мои ошибки» — точечное повторение неправильных ответов

### Database

- EF Core с PostgreSQL, миграции в `src/Persistence/Migrations/`
- Основные сущности: User, VocabularyEntry, Quiz, QuizQuestion, Achievement, Invoice, Payment

### Migrations — IMPORTANT

**NEVER write migration files by hand.** Always generate them through the EF CLI so timestamps are accurate (UTC `yyyyMMddHHmmss`) and the model snapshot stays consistent.

```bash
dotnet ef migrations add <DescriptiveName> \
  --project src/Persistence/Persistence.csproj \
  --startup-project src/Trale/Trale.csproj
```

Генерирует три файла (`.cs`, `.Designer.cs`, обновлённый `TraleDbContextModelSnapshot.cs`). Коммитить все три. Hand-written миграции вызывают коллизии timestamp'ов при параллельных ветках.

Если в PR увидишь рукописную миграцию — `dotnet ef migrations remove`, потом `dotnet ef migrations add` заново.

## Configuration

- `src/Trale/appsettings.json` — base config (прод)
- `src/Trale/appsettings.local.json` — локальные оверрайды (создаётся из example, не коммитится)
- `src/Trale/appsettings.example.json` — шаблон

## Mini-App (Бомбора)

Frontend в `src/Trale/miniapp-src/` (React 18 + Vite + TypeScript + Tailwind). Билд в `src/Trale/wwwroot/`.

### After every frontend change

1. Запустить Playwright в `miniapp-src/`: `npx playwright test`. Без зелёного UI-гейта таска не done.
2. Проверить адаптацию на 375px (iPhone SE-class viewport, дефолтный для Telegram WebApp).
3. Tap-target ≥ 44px на всех интерактивных элементах.
4. Если новый модуль/экран — добавить в навигацию, back-кнопку, прогресс.

### Design system: Minankari

- Палитра: cream, jewelInk, navy, ruby, gold
- Шрифт: Manrope + Noto Sans Georgian + Noto Serif Georgian
- Компоненты: jewel-tile, jewel-btn, KilimProgress, LoaderLetter
- **Не имитировать этнический акцент в UI-копирайте.** Никаких «маладэц» и тому подобного — это считается оскорбительным.
- Орфография: всегда «мини-апп», никогда «мини-аб»; «Минанкари» / «минанкари» (грузинская перегородчатая эмаль), не «Minanka»
- В meta-UI (не в уроках) грузинский только в кавычках или как название элемента, без латинской транслитерации — давать русский перевод

### Content modules

- Вопросы: `src/Trale/Lessons/Georgian*/questions*.json`
- Теория и структура lessons: `src/Trale/MiniApp/MiniAppContentProvider.cs`
- Регистрация модулей и MaxLessons: `src/Trale/MiniApp/ModuleRegistry.cs`
- Загрузчик: `GeorgianQuestionsLoader` (берёт subdirectory из ModuleDefinition)
- Тип `sentence-builder` (§79) — DTO в `src/Infrastructure/Telegram/Services/SentenceBuilderQuestion.cs`, UI в `src/Trale/miniapp-src/src/components/SentenceBuilder*.tsx`

## Agent-Driven Development

Проект развивается ночными Claude-агентами в Docker-контейнере (`deploy/agents/`). Промпты агентов — в `.claude/agents/`. Cron в Тбилиси: 01:00–08:00 ежечасно (`run-pipeline.sh auto`), 09:00 — `run-qa.sh` открывает PR.

### Phases

**Planning** (когда нет открытого sprint-plan):
1. discovery (product) — создаёт epic-draft из OWNER-PRIORITIES → sprint-plan comments → STRATEGY → ROADMAP
2. methodist-review — педагогика (i+1, прогрессия, прерeqs)
3. native-review — корректность грузинского, regiстр, дистракторы
4. finalize (product) — обновляет тело эпика по ревью, перевешивает в epic-ready
5. breakdown (tech-lead) — режет на task-issues 1-4ч с оценками
6. publish-plan — orchestrator собирает sprint-plan-issue. Если все эпики из OWNER-PRIORITIES — auto-approve label.

**Build** (sprint-plan auto-approved или owner написал «поехали»):
7. qa-prep (qa) — пишет test plan комментом на каждой qa-prepared таске. Маппит каждый AC из BDD на конкретный тест: HTTP/integration, unit, Playwright spec, vitest component.
8. dev-loop (developer) — picker (`scripts/pick-next-task.sh`) детерминированно выбирает таску, dev пишет TDD red→green→refactor, гейты: dotnet test + npm build + Playwright. Без зелёного UI-гейта таска не получает `done`.
9. refactor (tech-lead-review) — boy-scout fixes, после каждого commit'а полный гейт. Регрессии — `needs-fix` issue.
10. test-scenarios (qa) — пишет Russian тап-за-тапом гайд `qa-scenarios-YYYY-MM-DD.md` для всех done-тасок. run-qa.sh подтягивает в утренний PR.

### Source of truth

- **OWNER-PRIORITIES.md** — закреплённые задачи. Любой агент в начале сессии читает первым. Owner-priority бьёт всё.
- **GitHub issues** — единственный источник правды по executable работе. Эпики и таски, лейблы как state-machine (epic-draft / epic-methodist-reviewed / epic-native-reviewed / epic-ready / epic-broken-down / qa-prepared / done / dev-stuck / not-implemented).
- **ROADMAP.md** — продуктовый бэклог по статусам.

### Conventions

- Один shared nightly-branch `agents/nightly-YYYY-MM-DD`, форкается от main каждую ночь (или от feature-ветки при smoke-тестах: `BASE_BRANCH=...`).
- Утренний PR один на ночь, draft пока CI не зелёный, потом promote в ready.
- В коммитах ROADMAP-номера пишутся как `§46` или `ROADMAP-46`, никогда `#46` (GitHub auto-link). Bare `#NN` — только для реальных GitHub issue refs.
- `Refs #N` — упомянуть, не закрывает. `Fixes #N` / `Closes #N` — закрывает при мёрдже.

## Testing Strategy

- **Unit Tests** — бизнес-логика Application, доменные сущности, парсеры Infrastructure. xUnit + Shouldly.
- **Integration Tests** — endpoint-level через Testcontainers/Postgres. End-to-end проверки контроллеров.
- **Mini-app E2E** — Playwright spec в `src/Trale/miniapp-src/e2e/`. Моки `/api/*` через `page.route()` — не нужен живой бэкенд.
- **Mini-app components** — vitest + @testing-library/react + jsdom.
- **Test DSL** — builder pattern в `tests/*/DSL/`.
- **Coverage gates** — `FeatureCatalogCoverageTests` (FEATURES.md в синхроне с реальным кодом), `LessonTheoryQuestionCoverageTests` (теория покрывает все леммы вопросов в модуле).
