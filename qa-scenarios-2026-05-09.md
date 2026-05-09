# Тест-сценарии — ночной прогон 2026-05-09

## Общее

- Локальный URL: http://localhost:1402
- Ngrok / Telegram: открой @trale_bot и тапни «Open» на главном меню
- Если что-то не загружается — F12, проверь Network на 4xx/5xx

---

## Закрытые таски

### #881 — Расширение SentenceBuilderContentValidationTests на 5 новых модулей

**Что проверяем:** тестовый класс `SentenceBuilderContentValidationTests` теперь умеет автоматически проверять корректность содержимого JSON-файлов с упражнениями «Конструктор предложений» для пяти новых модулей: Cases, Present Tense, Cafe, Shopping, Taxi. Это сугубо бэкенд-задача; в UI новых экранов ещё нет (уроки пока не подключены в `ModuleRegistry`).

**Как проверить (терминал, не телефон):**

Запусти тесты модуля Infrastructure.UnitTests:

    dotnet test tests/Infrastructure.UnitTests --verbosity normal

После прогона убедись, что в выводе присутствуют пять тест-кейсов под именем `NewModule_AllSixChecks`:

- cases/questions10.json
- present-tense/questions7.json
- cafe/questions7.json
- shopping/questions7.json
- taxi/questions7.json

А также отдельный кейс `NewModule_MissingJsonFile_FailsWithClearMessage` — он проверяет, что при отсутствии файла тест падает с сообщением, называющим конкретный путь.

**Ожидаемое поведение:** все тесты зелёные. Каждый из пяти кейсов прошёл все шесть проверок:

- (a) файл существует по пути src/Trale/Lessons/&lt;Модуль&gt;/questionsN.json
- (b) вопросов от 3 до 15 штук
- (c) поле `questionType` равно «sentence-builder» у каждого вопроса
- (d) каждый токен из `correctOrder` присутствует в `chipPool`
- (e) все грузинские токены содержат только буквы мхедрули (U+10D0–U+10FF)
- (f) все подсказки (`hints`) не длиннее 36 символов

Дополнительно: в UI ничего нового не появится — в ModuleRegistry для этих модулей `MaxLessons` пока не увеличен. Это нормально: задача #881 создаёт только тесты-прообразы, а подключение уроков к навигации — предмет следующих задач (#876–#880).

**Как убедиться, что параметризация есть (не 30 отдельных методов):**

Открой файл `tests/Infrastructure.UnitTests/SentenceBuilderContentValidationTests.cs` и найди метод `NewModule_AllSixChecks` — он должен быть один, с пятью атрибутами `[TestCase]` над ним, а сама логика вынесена в приватный хелпер `AssertSentenceBuilderModuleJson`.

**Если что-то не так:**

- Если тест `NewModule_AllSixChecks (cases/questions10.json)` красный с сообщением «File not found» — значит stub-файл `src/Trale/Lessons/GeorgianCases/questions10.json` был удалён или не закоммичен. Проверь `git status` и `git log --oneline -5`.
- Если тест `NewModule_MissingJsonFile_FailsWithClearMessage` красный — значит хелпер `AssertSentenceBuilderModuleJson` не выбрасывает исключение при несуществующем пути. Смотри строчку `File.Exists(path).ShouldBeTrue(...)` в хелпере.
- Если в выводе нет ни одного `NewModule_AllSixChecks` — значит метод не нашёлся (возможно, имя изменили). Запусти `grep -n "NewModule" tests/Infrastructure.UnitTests/SentenceBuilderContentValidationTests.cs`.

---

## Примечание о новых уроках в приложении

Stub-файлы с грузинскими предложениями уже существуют на диске, но до тех пор, пока `ModuleRegistry` не будет обновлён (MaxLessons: Cases → 10, остальные → 7), новые уроки «Конструктор предложений» не будут отображаться в мини-аппе. Проверять их в Telegram сейчас не нужно — это будет темой следующего QA-прогона после подключения модулей.
