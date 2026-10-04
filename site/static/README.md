# static/

Файлы отсюда копируются как есть в корень `wwwroot/` при сборке сайта.

Сюда кладутся файлы верификации, если выбран файловый способ:

- Google Search Console: `google<token>.html`
- Яндекс.Вебмастер: `yandex_<token>.html`

Альтернатива — meta-теги: заполнить `verification.google` / `verification.yandex`
в `site/site.config.json`, тогда теги появятся в `<head>` каждой страницы.

`README.md` и `.gitkeep` не копируются.
