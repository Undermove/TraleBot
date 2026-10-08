-- Что говорят пользователи (только чтение). Запуск:
--   psql … -v days=30 -f scripts/sql/feedback-report.sql
-- days — за сколько последних дней смотреть. Два результата подряд: сводка по вариантам и список текстов.
--
-- Откуда строки (kind):
--   paywall — вопрос «Что остановило?», который мини-апп задаёт, когда экран покупки закрыли, не купив
--   survey  — кнопка под сообщением опроса-рассылки (один ответ на человека на кампанию)
--   message — «Написать автору» в мини-аппе; campaign заполнен, если пришли кнопкой «Написать подробнее» из опроса
--
-- Сводка:
--   campaign   — имя кампании опроса (у paywall пусто)
--   answer     — выбранный вариант. У paywall: expensive — «Дорого», not_now — «Пока не нужно»,
--                unclear — «Не понял, что получу», other — «Другое»,
--                (no answer) — вопрос показали, человек закрыл его без ответа
--   answers    — сколько таких ответов
--   with_text  — из них с текстом «своими словами»
--   share_pct  — доля среди ответивших в этой строке kind + campaign (без «(no answer)»)
SELECT CASE f."Kind" WHEN 0 THEN 'paywall' ELSE 'survey' END                       AS kind,
       COALESCE(f."CampaignKey", '')                                               AS campaign,
       COALESCE(f."Option", '(no answer)')                                         AS answer,
       count(*)                                                                    AS answers,
       count(*) FILTER (WHERE f."Text" IS NOT NULL)                                AS with_text,
       CASE WHEN f."Option" IS NOT NULL THEN
           round(100.0 * count(*) / sum(count(*)) FILTER (WHERE f."Option" IS NOT NULL)
               OVER (PARTITION BY f."Kind", f."CampaignKey"), 1) END               AS share_pct
FROM "UserFeedback" f
WHERE f."Kind" IN (0, 1)
  AND f."CreatedAtUtc" >= now() - make_interval(days => :days)
GROUP BY f."Kind", f."CampaignKey", f."Option"
ORDER BY 1, 2, f."Option" IS NULL, answers DESC;

-- Тексты, новые сверху:
--   at_utc       — когда написано
--   answer       — вариант, к которому текст приписан (у message пусто)
--   telegram_id  — кто написал
--   ever_paid    — платил ли этот человек когда-нибудь (возвраты не считаются)
SELECT COALESCE(f."UpdatedAtUtc", f."CreatedAtUtc")                                AS at_utc,
       CASE f."Kind" WHEN 0 THEN 'paywall' WHEN 1 THEN 'survey' ELSE 'message' END AS kind,
       COALESCE(f."CampaignKey", '')                                               AS campaign,
       COALESCE(f."Option", '')                                                    AS answer,
       u."TelegramId"                                                              AS telegram_id,
       EXISTS (SELECT 1 FROM "Payments" p
                WHERE p."UserId" = f."UserId" AND p."RefundedAtUtc" IS NULL)       AS ever_paid,
       f."Text"                                                                    AS text
FROM "UserFeedback" f
JOIN "Users" u ON u."Id" = f."UserId"
WHERE f."Text" IS NOT NULL
  AND COALESCE(f."UpdatedAtUtc", f."CreatedAtUtc") >= now() - make_interval(days => :days)
ORDER BY 1 DESC;
