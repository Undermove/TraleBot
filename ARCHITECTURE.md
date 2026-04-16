# Architecture Vision — TraleBot

Этот документ — целевая архитектура TraleBot. Она задаёт правила, которые применяются к **новому** коду и направление, в котором мы постепенно мигрируем **старый**.

Tech Lead-агент использует этот документ как мерку при ревью каждой фичи и обязан делать boy-scout-refactoring — оставлять код чище, чем нашёл.

## Слои (Clean Architecture)

```
Domain  ←  Application  ←  Infrastructure  ←  Trale (Web API)
```

Зависимости направлены только внутрь:
- **Domain** — сущности и доменные правила. Не знает ни про что снаружи.
- **Application** — use cases (Commands/Queries), интерфейсы внешних систем (`IXxxService`).
- **Infrastructure** — реализация интерфейсов из Application: БД, Telegram API, переводчики.
- **Trale** — точка входа: контроллеры, DI, миграции, hosted services.

**Нарушения, которые мы исправляем при встрече:**
- Application импортирует что-то из Infrastructure → выноси за интерфейс
- Domain импортирует EF Core / другие фреймворки → переноси в Persistence
- Бизнес-логика в контроллере → переноси в Application

## CQRS — Commands vs Queries

- **Commands** — изменяют состояние (`CreateUser`, `ActivateProStars`). Возвращают `Result` enum или `void`.
- **Queries** — читают состояние (`GetMiniAppProfile`). Возвращают DTO.

Разделение остаётся и при отказе от MediatR.

## Миграция с MediatR → прямые сервисы

**Целевое состояние:** `MediatR` не используется. Команды и запросы — обычные классы, которые DI-контейнер инжектит как сервисы.

**Почему отказываемся:**
- Лишний слой косвенности (`mediator.Send(new XCommand{...})` вместо `xCommand.HandleAsync(...)`)
- Hidden contracts через рефлексию — труднее навигировать в IDE
- Накладные расходы (в т.ч. для метрик и трейсинга)

**Как мигрируем (для новых фич — сразу так, для старых — Boy Scout):**

```csharp
// Было:
public class ActivateProStars : IRequest<ActivateProStarsResult>
{
    public Guid UserId { get; init; }
    public class Handler(...) : IRequestHandler<ActivateProStars, ActivateProStarsResult> { ... }
}
// Вызов:
await _mediator.Send(new ActivateProStars { UserId = id }, ct);

// Будет:
public class ActivateProStarsService(ITraleDbContext db, ...)
{
    public async Task<ActivateProStarsResult> ExecuteAsync(Guid userId, ..., CancellationToken ct) { ... }
}
// Регистрация:
services.AddScoped<ActivateProStarsService>();
// Вызов:
await _activateProStarsService.ExecuteAsync(id, ct);
```

Сохраняем разделение на Commands и Queries — по неймингу класса (`...Service`/`...Query`).

**Для новых фич:** не используй `IRequest`/`IRequestHandler`. Пиши сервис.
**Для старых фич:** при изменении кода рефактори в сторону сервиса (если объём небольшой).

## SOLID — приоритеты

1. **SRP (Single Responsibility)** — главный приоритет. Один класс — одна причина для изменения. Если в Handler 200+ строк и 5 разных задач — разбивай.
2. **DIP (Dependency Inversion)** — зависимости через интерфейсы (для границ слоёв и для тестируемости).
3. Остальные принципы применяй прагматично, без культа.

## Boy Scout Rule (Scout Refactoring)

При работе с любым файлом Tech Lead обязан:
- Удалить заметный dead code (неиспользуемые методы, поля, импорты)
- Извлечь дублирование если оно очевидно (3+ повтора)
- Разбить классы которые делают слишком много (явное нарушение SRP)
- Убрать magic numbers / hardcoded strings там, где они мешают

**НО** не превращай PR в большой рефакторинг — масштабные правки идут отдельным PR с тегом `refactor`.

## Тесты

**Обязательно:**
- Application layer — каждый Service/Handler с бизнес-логикой имеет unit-тест
- Domain layer — сложные доменные правила покрываются unit-тестами
- Integration tests — для контроллеров и end-to-end сценариев

**Не обязательно:**
- Простые DTO/POCO без логики
- Конфигурация DI

**Тесты — это часть фичи, а не «потом».** PR без тестов на новую логику Tech Lead должен возвращать на доработку.

## Что мы НЕ делаем

- Не вводим новые библиотеки без явной необходимости (особенно тяжёлые: Autofac, Serilog plugins, fancy mappers)
- Не добавляем абстракций «на будущее» — только под существующую потребность (YAGNI)
- Не пишем generic-helpers, которые используются один раз
- Не делаем mock-only тесты (которые тестируют моки, а не код)

## Файлы / неймспейсы

- `src/Domain/Entities/` — доменные сущности
- `src/Application/MiniApp/Queries/` — read use cases для мини-аппа
- `src/Application/MiniApp/Commands/` — write use cases для мини-аппа
- `src/Application/MiniApp/Services/` — **новые** сервисы (без MediatR), целевая структура
- `src/Infrastructure/Telegram/` — Telegram-специфичный код
- `src/Persistence/` — EF Core, миграции, конфигурации
- `src/Trale/Controllers/` — тонкие контроллеры, делегирующие в Application

## Чек-лист Tech Lead-агента

При ревью каждой фичи:
- [ ] Зависимости между слоями не нарушены
- [ ] Новые use cases — это сервисы (не MediatR-хендлеры), если фича совсем новая
- [ ] Если фича расширяет старый MediatR-хендлер — допустимо оставить MediatR, но отметь это в TODO/комментарии
- [ ] SRP не нарушен в новых классах
- [ ] Удалён dead code, который попался по пути
- [ ] Тесты для новой бизнес-логики написаны
- [ ] Миграции сгенерированы через `dotnet ef migrations add` (см. CLAUDE.md)
- [ ] Сборка зелёная: `dotnet test` + `npm run build`
