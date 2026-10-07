# Каталог глаголов: откуда что взято

Грузинские формы в каталоге никто не пишет руками и не генерирует моделью: они целиком из открытых
источников ниже. Руками написаны только русские переводы (`ru.json`) и списки исключений.

## Источники и лицензии

| Что | Откуда | Лицензия | Что лежит в git |
|---|---|---|---|
| Парадигмы, масдары, английские толкования | English Wiktionary, грузинские глагольные статьи, в виде выгрузки Wiktextract с [kaikki.org](https://kaikki.org/dictionary/Georgian/) (JSONL «all word senses», ~139 МБ) | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (и GFDL) | `verbs.raw.json` — только глаголы с таблицей; у каждого `source` и `pages[].url` — ссылки на статьи. В `dump` — имя файла выгрузки и его sha256 |
| Предложения-примеры | [Tatoeba](https://tatoeba.org), грузинские предложения с русскими переводами | [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) | `sentences.raw.json` — `id` предложения сохраняется (`https://tatoeba.org/sentences/show/<id>`) |
| Частотность: веб, новости, Википедия | [Leipzig Corpora Collection](https://wortschatz.uni-leipzig.de/en/download/Georgian): `kat-ge_web_2019_300K`, `kat_newscrawl_2016_300K`, `kat_wikipedia_2021_300K` (файлы `*-words.txt`) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | `frequency.json` — только числа по нашим глаголам |
| Частотность: субтитры | [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords), `content/2018/ka/ka_50k.txt` (из OpenSubtitles) | CC BY-SA 4.0 | `frequency.json` — только числа |
| Частотность: уроки | `src/Trale/Lessons/**/*.json` этого репозитория | — | — |
| Что ученики ищут в словаре | замер на проде (русская сторона запросов), 05.10.2026 | — | `prod-lookups.json` |

Ссылка на Leipzig Corpora: D. Goldhahn, T. Eckart, U. Quasthoff. *Building Large Monolingual Dictionaries
at the Leipzig Corpora Collection: From 100 to 200 Languages.* LREC 2012.

При показе форм и предложений в приложении источник должен оставаться виден (ссылка `source` в карточке,
`id` у предложения) — этого требуют CC BY-SA и CC BY.

### Оговорки

- **Субтитры `ka_50k.txt` засорены.** Верх списка — не грузинские слова, а кириллические субтитры,
  прочитанные в грузинской кодировке (бессмысленные сочетания букв). Настоящие грузинские формы в списке есть,
  но их мало: ненулевая частота набирается только у 91 глагола из 226. Поэтому вес источника вдвое ниже,
  а основой служат корпуса Leipzig.
- **Леммной частотности грузинского в открытом доступе не нашлось.** Грузинский национальный корпус (GNC)
  размечен по леммам, но выгрузку не раздаёт; `wordfreq` грузинского не содержит. Поэтому частота глагола —
  сумма частот его словоформ по спискам словоформ.
- Выгрузка kaikki не содержит номера ревизии статьи; воспроизводимость держится на sha256 файла выгрузки.

## Как пересобрать

```sh
# 1. парадигмы из выгрузки (нужна только здесь)
node scripts/verbs/extract-kaikki.mjs ~/Downloads/kaikki.org-dictionary-Georgian.jsonl
node scripts/verbs/compare-live.mjs        # сверка с 23 глаголами, снятыми с живых страниц

# 2. частотность и предложения (внешние файлы нужны только здесь)
node scripts/verbs/collect-evidence.mjs --tatoeba kat_pairs.json \
     --web kat-ge_web_2019_300K-words.txt --news kat_newscrawl_2016_300K-words.txt \
     --wiki kat_wikipedia_2021_300K-words.txt --subs ka_50k.txt

# 3. каталог и таблица для вычитки (ничего внешнего не нужно)
node scripts/verbs/build-catalog.mjs       # --check — только проверки, --force — разрешить уменьшение
```

`kat_pairs.json` — грузинские предложения Tatoeba с переводами: массив `{ id, ka, ru: [..], en: [..] }`,
собирается из еженедельных выгрузок Tatoeba (`sentences`, `links`).

Шаги 1 и 2 запускаются редко (обновилась выгрузка); шаг 3 — после любой правки `ru.json`,
`verbs.skip.json`, `sentences.skip.json`. Все три шага детерминированы: одинаковый вход — одинаковый
выход, байт в байт.

## Файлы

| Файл | Кто пишет | Зачем |
|---|---|---|
| `kaikki.mjs`, `extract-kaikki.mjs` | — | разбор выгрузки; правила «что считается одним глаголом» — в шапке `extract-kaikki.mjs` |
| `verbs.raw.json` | шаг 1 | все глаголы Викисловаря с пригодной таблицей + `rejected` (почему статья не подошла) + `noTable` |
| `wiktionary-live-23.json`, `compare-live.mjs` | — | 23 глагола, снятых раньше с живых HTML-страниц, и сверка с ними ячейка в ячейку |
| `collect-evidence.mjs` → `frequency.json`, `sentences.raw.json` | шаг 2 | частотность и предложения |
| `analyze.mjs` | — | тип глагола (образец / особенность / особый), корень, «чужие» времена |
| `build-catalog.mjs` → `src/Trale/Verbs/verbs.json`, `REVIEW.md` | шаг 3 | отбор, проверки качества, каталог, таблица для вычитки |
| `levels.plan.json` | руками | уровни и наборы раздела «Глаголы»: какой глагол в каком наборе, темы наборов, список базовых значений (`core`), причины ручных перестановок (`moved`) |
| `build-levels.mjs` → `src/Trale/Verbs/levels.json`, `LEVELS.md` | после правки `levels.plan.json` или обновления `frequency.json` | порядок обучения: счёт употребительности из `frequency.json` (веса под разговорную речь — в шапке скрипта), проверки (каждый глагол ровно в одном наборе, 4–6 глаголов в наборе, уровень не по счёту — только с причиной, разложенные глаголы не переезжают), файл для сервера и таблица для вычитки |
| `ru.json` | руками | русские переводы (перевод английских толкований Викисловаря) |
| `ru.unsure.json` | руками | в каких переводах есть сомнение — видно в `REVIEW.md` |
| `verbs.skip.json` | руками | вычеркнутые глаголы: `{ "лемма": "почему" }` |
| `sentences.skip.json` | руками | вычеркнутые предложения Tatoeba: `[id, …]` |
| `wanted.json`, `prod-lookups.json` | руками | какие глаголы нужны ученикам — для раздела «чего нет» и надбавки в ранжировании |

## Данные для самопроверки агента перевода

Когда слова нет в каталоге, сервер может спросить модель (см. `GeorgianTranslationPipeline`). Ответ модели
не принимается на веру: его сверяет код по двум файлам, собранным из открытых источников.

| Файл | Что в нём | Из чего собран | Лицензия источника | Размер |
|---|---|---|---|---|
| `src/Trale/Verbs/lexicon.json` | 1039 грузинских глаголов: лемма, масдар, есть ли таблица спряжения, английские толкования, русские переводы (у 103) | English Wiktionary — та же выгрузка kaikki, что для каталога; русский Викисловарь — выгрузки Wiktextract с kaikki.org: грузинские статьи (`ruwiktionary/Грузинский`, 7,6 МБ) и блоки переводов «Грузинский» из русских статей (`ruwiktionary/Русский`, 1,8 ГБ — читается потоком, на диск не сохраняется) | CC BY-SA 4.0 (и GFDL) | 104 КБ |
| `src/Trale/Verbs/attested.bloom` | фильтр Блума: 253 802 грузинские словоформы, встретившиеся в текстах (≈1 % ложных «встречалась»); сами слова из него не восстановить | три корпуса Leipzig (те же, что для частотности, файлы `*-words.txt`, слова с суммарной частотой ≥ 2) и предложения Tatoeba | CC BY 4.0; CC BY 2.0 FR | 317 КБ |

sha256 входных файлов записаны в `lexicon.json` → `sources`. Сборка (внешние файлы нужны только здесь, в git не кладутся):

```sh
# переводы на грузинский из русских статей русского Викисловаря — поток, фильтр оставляет ~11 тыс. строк
curl -s https://kaikki.org/ruwiktionary/Русский/kaikki.org-dictionary-Русский.jsonl \
  | python3 -c "import sys,json
for l in sys.stdin:
    if '\"ka\"' not in l: continue
    e=json.loads(l); t=[x for x in e.get('translations',[]) if x.get('lang_code')=='ka' and x.get('word')]
    if t: print(json.dumps({'word':e.get('word'),'pos':e.get('pos'),'ka':[{'word':x['word']} for x in t]},ensure_ascii=False))" > ru-ka.jsonl

node scripts/verbs/build-lexicon.mjs kaikki.org-dictionary-Georgian.jsonl \
     --ru-ka kaikki.org-dictionary-Грузинский.jsonl --ru ru-ka.jsonl
node scripts/verbs/build-attested.mjs --tatoeba kat_pairs.json \
     kat-ge_web_2019_300K-words.txt kat_newscrawl_2016_300K-words.txt kat_wikipedia_2021_300K-words.txt
```

Что по ним проверяется (код — `VerbProposalResolver`): лемма, предложенная моделью, — настоящий глагол
Викисловаря либо глагол, чьи формы встречаются в текстах; если русский Викисловарь переводит запрошенное
слово другими глаголами, предложение модели вне этого списка отклоняется; перевод и масдар берутся из
источника, когда они там есть; формы, которые модель составила сама (таблицы нет нигде), пересчитываются
по корпусу, и глагол без единой встретившейся формы не сохраняется. Для сверки: у глаголов каталога в
корпусах встречается в среднем три четверти форм карточки (медиана 77 %, у каждого десятого — меньше 47 %).

