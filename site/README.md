# site/ — статические страницы tralebot.com

Генератор публичных индексируемых страниц. Живёт рядом с мини-аппом, но по другим правилам —
см. раздел «Сайт vs мини-апп» в `../CLAUDE.md`.

| Раздел | Откуда берётся | Страниц |
|---|---|---|
| `/verbs/`, `/verbs/<slug>/` | `src/Trale/Verbs/verbs.json` — по странице на глагол + список | 178 + 1 |
| `/grammar/` | `content/grammar/*.md` (тексты) + пять таблиц из каталога глаголов (`lib/pages/grammar.mjs`) | 8 + 1 |
| `/phrases/` | теория уроков (`MiniAppContentProvider.cs`) и словари уроков (`Lessons/**/questions*.json`) | 7 + 1 |
| `/words/` | то же | 5 + 1 |

## Как это устроено

```
site/
  build.mjs              сборка: собирает страницы всех видов в один формат, пишет HTML и sitemap.xml
  indexnow.mjs           отправка URL из sitemap в IndexNow (Яндекс, Bing) — запускать после деплоя
  site.config.json       baseUrl, бот, токены верификации, generatedUpdated (lastmod страниц из данных), indexNowKey
  lib/template.mjs       HTML-каркас + инлайн CSS (Minankari)
  lib/frontmatter.mjs    парсер front matter
  lib/data/verbs.mjs     каталог глаголов: слаги, транскрипция, названия времён
  lib/data/theory.mjs    читает List/Example/Paragraph из MiniAppContentProvider.cs как данные
  lib/data/lessons.mjs   словари уроков (lexicon) из Lessons/**/questions*.json
  lib/pages/verbs.mjs    страница глагола и список /verbs/
  lib/pages/grammar.mjs  сводные таблицы: времена, прошедшее, будущее, глаголы движения, «у меня есть»
  lib/pages/reference.mjs вёрстка страниц разговорника и слов
  data/reference.mjs     какие списки уроков на какой странице (/phrases/, /words/) + title/h1/description
  data/verb-slugs.json   замороженные слаги глаголов (лемма → slug)
  content/<раздел>/      тексты, написанные руками: _index.md — страница раздела, <slug>.md — темы
  static/                копируется в корень сайта как есть (og-картинки, ключ IndexNow, файлы верификации)
  test/                  node --test
```

Сборка пишет в `../src/Trale/wwwroot/` (тот же каталог, откуда ASP.NET отдаёт SPA): папки разделов,
`sitemap.xml`, файлы из `static/`. `index.html`, `assets/`, `audio/` мини-аппа не трогаются. В Docker
сборка идёт в первой (node) стадии сразу после `vite build`; данные для неё (`verbs.json`,
`MiniAppContentProvider.cs`, `Lessons/`) копируются в стадию отдельными `COPY` — список путей в
`DATA_FILES` в `build.mjs`.

Локально сборка переписывает отслеживаемый git'ом `src/Trale/wwwroot/sitemap.xml` и кладёт рядом папки
разделов. Перед коммитом: `git checkout -- src/Trale/wwwroot/sitemap.xml` и не добавлять сгенерированное.

## Страницы из данных: правила

- **Грузинское только из данных.** В `data/reference.mjs` и шаблонах нет ни одного грузинского слова:
  списки выбираются по модулю и номеру урока, фильтруются и переименовываются по русской стороне.
  Тест сверяет каждое грузинское слово на страницах с данными репозитория, а каждую форму на странице
  глагола — с `verbs.json` этого глагола.
- **Времена называются по смыслу** («Прошедшее: сделал»), учебный термин — один раз мелким шрифтом в
  `<span class="term">` («в учебниках — аорист»). Термин вне этого места роняет тест.
- **Транскрипция — кириллицей**, по тому же правилу, что `cyr()` в мини-аппе (тест сверяет таблицу букв).
- **Слаг глагола**: `<первый русский перевод транслитом>-<словарная форма латиницей>`, например
  `idti-midis`. Выпущенный слаг не меняется никогда: он записан в `data/verb-slugs.json`, и замок
  важнее правила — исправленный перевод не сдвинет URL. Новый глагол в каталоге: `npm run lock-slugs`
  и закоммитить файл (тест напомнит).
- **lastmod** страниц из данных — `generatedUpdated` в `site.config.json`. Менять, когда меняются данные
  или шаблоны, иначе дата в sitemap врёт.
- Параллельные таблицы (`alt`) без перевода в данных показываются без русских фраз; таблица, совпадающая
  с основной, не показывается.

## После деплоя: IndexNow

```
cd site && node indexnow.mjs            # все URL из https://tralebot.com/sitemap.xml → Яндекс и Bing
node indexnow.mjs --dry-run             # только показать список
node indexnow.mjs --only /verbs/        # только один раздел
```

Скрипт сначала проверяет, что `https://tralebot.com/<ключ>.txt` отдаётся (ключ лежит в `static/`),
потом шлёт список. Ответ 200 или 202 — принято. Google в IndexNow не участвует: ему достаточно sitemap.

## Как добавить страницу с текстом

Это про тексты, написанные руками.

1. Создать `content/grammar/<slug>.md` (slug — латиница, цифры, дефис; он станет URL `/grammar/<slug>/`).
2. Front matter:

```
---
title: Заголовок для <title> и превью        # обязательно, уникальный
h1: Заголовок на странице                     # опционально, по умолчанию = title
description: 1–2 предложения для сниппета     # обязательно, уникальный
order: 20                                     # порядок в списке раздела
related: [cases, postpositions]               # slugs соседних страниц → блок «Смотрите также»
draft: true                                   # noindex + нет в sitemap; снять, когда текст готов
updated: 2026-09-14                           # lastmod в sitemap и dateModified в JSON-LD
source: откуда взяты факты                    # для ревью
---
```

3. Тело — Markdown (GFM): таблицы, списки, ссылки. Пример с переводом оформляется цитатой из двух абзацев:

```
> კაცი მუშაობს
>
> Мужчина работает
```

4. `npm run build && npm test`. Грузинский текст автоматически оборачивается в `<span lang="ka">`.

## Верификация в Search Console и Вебмастере

Либо meta-теги — заполнить `verification.google` / `verification.yandex` в `site.config.json`,
либо файловый способ — положить выданный файл в `static/`. См. `static/README.md`.

## Как добавить страницу из данных

- Разговорник или слова: новый объект в `data/reference.mjs` (раздел, slug, title, h1, description, блоки).
  Блок берёт список через `S.list(модуль, урок)`, `S.examples(модуль, урок)` или `S.lexicon(lesson_id)`.
- Сводная таблица по глаголам: новый блок в `lib/pages/grammar.mjs`.
- Перед публикацией сверить выбранные списки уроков с `verbs.json` или открытым источником: в уроках
  бывали ошибки. Что не сошлось — не публиковать, записать в `SEO-PLAN.md`.
