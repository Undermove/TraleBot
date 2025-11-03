# ✅ Чек-лист Внедрения Модуля Грузинских Глаголов

## 📦 Уже Реализовано

- ✅ Domain сущности (`GeorgianVerb`, `VerbCard`, `StudentVerbProgress`)
- ✅ Application сервисы (SRS, Commands, Queries)
- ✅ Telegram команды (5 штук для UI)
- ✅ Конфигурации EF Core
- ✅ EF Core миграция
- ✅ Динамическое меню в зависимости от языка
- ✅ SRS алгоритм с интервалами 1-2-4-7-14 дней
- ✅ Загрузчик данных из JSON

---

## 🔨 Что Нужно Сделать

### 1️⃣ Добавить инициализацию в `Program.cs`

**Файл:** `src/Trale/Program.cs`

Добавьте перед `app.Run()`:

```csharp
// Инициализация грузинских глаголов
using (var scope = app.Services.CreateScope())
{
    var loaderService = scope.ServiceProvider.GetRequiredService<IVerbDataLoaderService>();
    var context = scope.ServiceProvider.GetRequiredService<ITraleDbContext>();
    
    try
    {
        await loaderService.LoadVerbDataAsync(
            Path.Combine(AppContext.BaseDirectory, "geogian-verbs.json"),
            context,
            CancellationToken.None);
    }
    catch (Exception ex)
    {
        var logger = app.Services.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Failed to load Georgian verbs data");
    }
}
```

### 2️⃣ Применить миграцию

```bash
# Перейти в корень проекта
cd /Users/dmitryafonchenko/repos/TraleBot

# Применить миграцию
dotnet ef database update -p src/Persistence -s src/Trale
```

Это создаст три таблицы:
- `georgian_verbs`
- `verb_cards`
- `student_verb_progress`

### 3️⃣ Проверить порядок регистрации команд

**Файл:** `src/Infrastructure/DependencyInjection.cs`

✅ Уже добавлены:
```csharp
services.AddScoped<IBotCommand, StartVerbLearningCommand>();
services.AddScoped<IBotCommand, SubmitVerbAnswerBotCommand>();
services.AddScoped<IBotCommand, NextVerbCardCommand>();
services.AddScoped<IBotCommand, VerbProgressCommand>();
services.AddScoped<IBotCommand, ReviewHardVerbsCommand>();
services.AddScoped<IVerbDataLoaderService, VerbDataLoaderService>();
```

---

## 🧪 Тестирование

### Локальное тестирование

1. **Запусти приложение:**
   ```bash
   dotnet run -p src/Trale
   ```

2. **Переключись на грузинский язык** в боте:
   - Нажми кнопку "Сменить язык"
   - Выбери 🇬🇪 Georgian

3. **Главное меню должно измениться** на:
   ```
   🎓 Учиться
   🧠 Приставки
   🔁 Повторить трудные
   📈 Прогресс
   ```

4. **Нажми "🎓 Учиться":**
   - Должна показаться карточка с вопросом
   - 4 варианта ответа (inline-кнопки)
   - Выбери любой ответ

5. **Проверь результат:**
   - ✅ или ❌ ответ
   - Объяснение
   - Кнопка "▶️ Следующая карточка"

### Проверка БД

```sql
-- Проверить загруженные глаголы
SELECT COUNT(*) FROM georgian_verbs;
-- Должно быть ~200 глаголов

-- Проверить карточки
SELECT COUNT(*) FROM verb_cards;
-- Должно быть ~600 карточек (200 глаголов * 3 типа упражнений)

-- Проверить прогресс студента
SELECT * FROM student_verb_progress 
WHERE user_id = 'YOUR_USER_ID' 
ORDER BY created_at DESC;
```

---

## 🐛 Возможные Проблемы

### Проблема: "VerbDataLoaderService not found"
**Решение:** Убедись, что добавил import в `DependencyInjection.cs`:
```csharp
using Infrastructure.GeorgianVerbs;
```

### Проблема: "Migration failed"
**Решение:** Проверь, что миграция скопирована в папку `Migrations`:
```
src/Persistence/Migrations/20250115120000_AddGeorgianVerbsTables.cs
```

### Проблема: "JSON file not found"
**Решение:** Проверь путь к файлу:
- `src/Trale/geogian-verbs.json` должен существовать
- Или обнови путь в `Program.cs`

### Проблема: "Menu doesn't change for Georgian"
**Решение:** Проверь в `MenuKeyboard.cs`:
```csharp
if (currentLanguage == Language.Georgian)
{
    // Должны быть кнопки для глаголов
}
```

---

## 📋 Файлы, Которые Были Созданы/Изменены

### 🆕 Новые файлы (Created)

**Domain:**
- `src/Domain/Entities/GeorgianVerb.cs`
- `src/Domain/Entities/VerbCard.cs`
- `src/Domain/Entities/StudentVerbProgress.cs`

**Application:**
- `src/Application/GeorgianVerbs/IVerbSrsService.cs`
- `src/Application/GeorgianVerbs/Services/VerbSrsService.cs`
- `src/Application/GeorgianVerbs/Commands/SubmitVerbAnswerCommand.cs`
- `src/Application/GeorgianVerbs/Queries/GetNextVerbCardQuery.cs`
- `src/Application/GeorgianVerbs/Queries/GetVerbProgressQuery.cs`
- `src/Application/GeorgianVerbs/Queries/GetHardVerbCardsQuery.cs`

**Infrastructure:**
- `src/Infrastructure/GeorgianVerbs/VerbDataLoaderService.cs`
- `src/Infrastructure/Telegram/BotCommands/VerbLearning/StartVerbLearningCommand.cs`
- `src/Infrastructure/Telegram/BotCommands/VerbLearning/SubmitVerbAnswerBotCommand.cs`
- `src/Infrastructure/Telegram/BotCommands/VerbLearning/NextVerbCardCommand.cs`
- `src/Infrastructure/Telegram/BotCommands/VerbLearning/VerbProgressCommand.cs`
- `src/Infrastructure/Telegram/BotCommands/VerbLearning/ReviewHardVerbsCommand.cs`

**Persistence:**
- `src/Persistence/Configurations/GeorgianVerbConfiguration.cs`
- `src/Persistence/Configurations/VerbCardConfiguration.cs`
- `src/Persistence/Configurations/StudentVerbProgressConfiguration.cs`
- `src/Persistence/Migrations/20250115120000_AddGeorgianVerbsTables.cs`

### 🔄 Изменённые файлы (Modified)

- `src/Domain/Entities/User.cs` — добавлена связь с `VerbProgress`
- `src/Application/Common/ITraleDbContext.cs` — добавлены DbSets
- `src/Persistence/TraleDbContext.cs` — добавлены DbSets и конфигурации
- `src/Application/DependencyInjection.cs` — добавлена регистрация `IVerbSrsService`
- `src/Infrastructure/DependencyInjection.cs` — добавлены команды и сервис
- `src/Infrastructure/Telegram/Models/CommandNames.cs` — добавлены новые команды
- `src/Infrastructure/Telegram/CommonComponents/MenuKeyboard.cs` — динамическое меню

---

## 📞 Контакт при проблемах

Если что-то не работает:
1. Проверь логи в `src/Trale/bin` или консоль
2. Убедись, что все файлы скопированы
3. Запусти `dotnet clean` и `dotnet build`
4. Попробуй заново применить миграцию

---

## 🎉 После Завершения

Модуль будет готов к использованию. Пользователь сможет:

✅ Переключаться на грузинский язык  
✅ Видеть специальное меню для учёбы  
✅ Учить глаголы через интерактивные карточки  
✅ Видеть прогресс и статистику  
✅ Повторять трудные слова  
✅ Отслеживать серию дней (🔥 streak)  

---

## 🚀 Готово!

Когда завершишь шаги выше, напиши мне — помогу с тестированием или доработками! 💪