# TraleBot — учи грузинский в Telegram

🇬🇪 Telegram mini-app для изучения грузинского языка (ქართული). Алфавит, грамматика, падежи, послелоги, глаголы движения, спряжение, личный словарь с квизами.

Прод: [@trale_bot](https://t.me/trale_bot) · Лендинг: [tralebot.com](https://tralebot.com)

## Что внутри

- **6 launch-модулей** — Алфавит, Числа, Знакомство, Местоимения, Настоящее время, Личный словарь.
- **Расширенные модули** (Pro): Падежи, Послелоги, Прилагательные, Версионные гласные, Приставки направления, Имперфект, Аорист, Склонение местоимений, Условные предложения, Императив, Конструктор предложений, тематические (Кафе / Шопинг / Такси / Доктор / Экстренные службы).
- **Типы упражнений:** multiple choice, type answer, audio choice (с TTS на грузинском), letter reveal, sentence builder.
- **Прогресс и retention:** «Мои ошибки» (точечное повторение), уровни усвоения слов, грузинские числительные на счётчике вопросов, ачивки на грузинском.
- **Монетизация:** Telegram Stars (XTR), pay-once Pro, без hearts/lives, без gating контента.

## Стек

- **Backend:** .NET 10, C#, Clean Architecture (Domain / Application / Infrastructure / Persistence / Trale Web API), EF Core, PostgreSQL.
- **Mini-app:** React 18 + Vite + TypeScript + Tailwind, в `src/Trale/miniapp-src/`. Сборка статики в `src/Trale/wwwroot/`.
- **Тесты:** xUnit (unit + integration с Testcontainers/Postgres), Playwright (E2E мини-аппа), vitest + @testing-library/react (компоненты).
- **TTS:** Piper (локальный нейросетевой грузинский голос ka_GE-natia-medium).
- **Observability:** Serilog → Loki.

## Локальная разработка

Что должно быть установлено: Docker, .NET SDK 10, Node 20, ngrok.

```bash
# 1. Postgres для локального стенда
docker compose -f docker-compose-local.yml up -d

# 2. Сборка мини-аппа в wwwroot/
cd src/Trale/miniapp-src && npm install && npm run build && cd -

# 3. Запуск .NET API на :1402
dotnet run --project src/Trale --launch-profile TraleBot

# 4. ngrok-туннель для Telegram WebApp (в отдельном терминале)
ngrok http 1402
```

Затем:
1. Скопируй public URL из ngrok (вида `https://xxxx-xxxx.ngrok-free.app`).
2. Пропиши его в `src/Trale/appsettings.local.json` → `BotConfiguration.HostAddress`.
3. Перезапусти `dotnet run` — вебхук Telegram перерегистрируется на новый URL.
4. Открой бот тестового стенда в Telegram (`BotName` из `appsettings.local.json` — обычно `@traletest_bot`) → Open.

## Команды разработки

```bash
# Полный прогон тестов (Domain + Application + Infrastructure + Integration)
dotnet test TraleBot.sln

# Только unit-тесты, без Testcontainers
dotnet test tests/Domain.UnitTests tests/Application.UnitTests tests/Infrastructure.UnitTests

# E2E мини-аппа (Playwright, моки /api/*)
cd src/Trale/miniapp-src && npx playwright test

# Component тесты (vitest + RTL)
cd src/Trale/miniapp-src && npm run test

# Vite dev-сервер мини-аппа (HMR, проксирует /api на :1402)
cd src/Trale/miniapp-src && npm run dev    # → http://localhost:5173

# Миграции БД
dotnet ef migrations add <Name> --project src/Persistence/Persistence.csproj --startup-project src/Trale/Trale.csproj
dotnet ef database update --project src/Persistence/Persistence.csproj --startup-project src/Trale/Trale.csproj
```

## Деплой

Production-образ собирается из корневого `Dockerfile`. Деплой через GitHub Actions в `.github/workflows/`:

- `kubernetes_deploy.yml` — раскатка app в k8s
- `kubernetes_deploy_db.yml` — Postgres в k8s
- `start_new_app_version.yml` — переключение версии
- `test.yml` — CI: dotnet build + test + Playwright E2E мини-аппа

## Ночной агентский пайплайн

В `deploy/agents/` — Docker-окружение для cron-driven Claude-агентов. Одна общая nightly-ветка, ежечасные прогоны 01:00–08:00 по Тбилиси, утренний QA в 09:00 открывает PR с тест-сценариями на русском.

Фазы (см. header в [`deploy/agents/scripts/run-pipeline.sh`](deploy/agents/scripts/run-pipeline.sh)):
- **Planning** — discovery → methodist-review → native-review → finalize → breakdown → publish-plan
- **Build** — qa-prep → dev-loop → refactor → test-scenarios

Owner-priority эпики (`**Source:** OWNER-PRIORITIES`) auto-approve без ручного «поехали». Picker (`scripts/pick-next-task.sh`) детерминированно выбирает следующую таску — сначала эпики из активного sprint-plan'а, внутри эпика по возрастанию номера ишьюза.

## Документация

- [`ARCHITECTURE.md`](ARCHITECTURE.md) — целевая архитектура, slicing'и, миграция от MediatR к сервисам.
- [`STRATEGY.md`](STRATEGY.md) — продуктовая стратегия: launch-набор, монетизация, обучающий приоритет.
- [`ROADMAP.md`](ROADMAP.md) — задачи по статусам (`[idea]` / `[designed]` / `[dev]` / `[review]` / `[done]`).
- [`ROADMAP-archive.md`](ROADMAP-archive.md) — закрытые задачи.
- [`OWNER-PRIORITIES.md`](OWNER-PRIORITIES.md) — owner-pinned задачи: источник правды для приоритетного backlog'а.
- [`FEATURES.md`](FEATURES.md) — каталог реализованных фич.
- [`design-specs/`](design-specs/) — UX/UI-спеки (Designer-агент пишет до Developer'а).
