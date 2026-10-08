-- Что говорят пользователи (только чтение). Запуск:
--   psql … -v days=30 -f scripts/sql/feedback-report.sql
-- days — за сколько последних дней смотреть. Три результата подряд: сводка по вариантам, список текстов
-- и разрез опросов по ответу на первый вопрос.
--
-- Откуда строки (kind):
--   paywall — вопрос «Что остановило?», который мини-апп задаёт, когда экран покупки закрыли, не купив
--   survey  — ответ на вопрос опроса-рассылки: первый вопрос — кнопкой в боте, остальные — в форме мини-аппа
--             (один ответ на человека на вопрос)
--   message — «Написать автору» в мини-аппе; campaign заполнен, если пришли кнопкой «Написать подробнее» из опроса
--
-- 1. Сводка:
--   campaign    — имя кампании опроса (у paywall пусто)
--   question_no — номер вопроса в опросе (у paywall 0)
--   question    — текст вопроса
--   answer      — выбранный вариант; «Другое» — человек ответил своими словами; (text) — ответ на вопрос
--                 без вариантов. У paywall: expensive — «Дорого», not_now — «Пока не нужно»,
--                 unclear — «Не понял, что получу», other — «Другое»,
--                 (no answer) — вопрос показали, человек закрыл его без ответа
--   answers     — сколько таких ответов
--   with_text   — из них с текстом своими словами
--   share_pct   — доля среди ответивших на этот вопрос (без «(no answer)»)
WITH question AS (
    SELECT c."Key" AS campaign, e.value ->> 'id' AS id, e.value ->> 'text' AS text, e.ordinality AS no
    FROM "BroadcastCampaigns" c
    CROSS JOIN LATERAL jsonb_array_elements(c."SurveyJson" -> 'questions') WITH ORDINALITY AS e
    WHERE c."SurveyJson" IS NOT NULL
)
SELECT CASE f."Kind" WHEN 0 THEN 'paywall' ELSE 'survey' END                       AS kind,
       COALESCE(f."CampaignKey", '')                                               AS campaign,
       COALESCE(q.no, 0)                                                           AS question_no,
       COALESCE(q.text, '')                                                        AS question,
       COALESCE(f."Option", CASE f."Kind" WHEN 0 THEN '(no answer)' ELSE '(text)' END) AS answer,
       count(*)                                                                    AS answers,
       count(*) FILTER (WHERE f."Text" IS NOT NULL)                                AS with_text,
       CASE WHEN f."Kind" = 1 OR f."Option" IS NOT NULL THEN
           round(100.0 * count(*) / sum(count(*)) FILTER (WHERE f."Kind" = 1 OR f."Option" IS NOT NULL)
               OVER (PARTITION BY f."Kind", f."CampaignKey", q.no), 1) END         AS share_pct
FROM "UserFeedback" f
LEFT JOIN question q ON q.campaign = f."CampaignKey" AND q.id = f."QuestionId"
WHERE f."Kind" IN (0, 1)
  AND f."CreatedAtUtc" >= now() - make_interval(days => :days)
GROUP BY f."Kind", f."CampaignKey", q.no, q.text, f."Option"
ORDER BY 1, 2, 3, f."Option" IS NULL, answers DESC;

-- 2. Тексты, новые сверху:
--   at_utc       — когда написано
--   question     — вопрос опроса, на который это ответ (у paywall и message пусто)
--   answer       — вариант, к которому текст приписан (у message и вопросов без вариантов пусто)
--   telegram_id  — кто написал
--   ever_paid    — платил ли этот человек когда-нибудь (возвраты не считаются)
SELECT COALESCE(f."UpdatedAtUtc", f."CreatedAtUtc")                                AS at_utc,
       CASE f."Kind" WHEN 0 THEN 'paywall' WHEN 1 THEN 'survey' ELSE 'message' END AS kind,
       COALESCE(f."CampaignKey", '')                                               AS campaign,
       COALESCE((SELECT e.value ->> 'text'
                 FROM "BroadcastCampaigns" c
                 CROSS JOIN LATERAL jsonb_array_elements(c."SurveyJson" -> 'questions') AS e
                 WHERE c."Key" = f."CampaignKey" AND e.value ->> 'id' = f."QuestionId"), '') AS question,
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

-- 3. Опросы в разрезе ответа на первый вопрос: что на остальные вопросы ответили те, кто в первом
--    выбрал такой-то вариант (например, чем ещё пользуются те, кто «Очень расстроюсь»).
--   first_answer — вариант первого вопроса
--   people       — сколько человек выбрали этот вариант первого вопроса
--   question_no, question, answer — как в сводке; answers — сколько из этих людей так ответили
WITH question AS (
    SELECT c."Key" AS campaign, e.value ->> 'id' AS id, e.value ->> 'text' AS text, e.ordinality AS no
    FROM "BroadcastCampaigns" c
    CROSS JOIN LATERAL jsonb_array_elements(c."SurveyJson" -> 'questions') WITH ORDINALITY AS e
    WHERE c."SurveyJson" IS NOT NULL
), first_answer AS (
    SELECT f."CampaignKey" AS campaign, f."UserId", f."Option" AS answer,
           count(*) OVER (PARTITION BY f."CampaignKey", f."Option") AS people
    FROM "UserFeedback" f
    JOIN question q ON q.campaign = f."CampaignKey" AND q.id = f."QuestionId" AND q.no = 1
    WHERE f."Kind" = 1
      AND f."CreatedAtUtc" >= now() - make_interval(days => :days)
)
SELECT fa.campaign                                                                 AS campaign,
       fa.answer                                                                   AS first_answer,
       fa.people                                                                   AS people,
       q.no                                                                        AS question_no,
       q.text                                                                      AS question,
       COALESCE(f."Option", '(text)')                                              AS answer,
       count(*)                                                                    AS answers
FROM first_answer fa
JOIN "UserFeedback" f ON f."Kind" = 1 AND f."CampaignKey" = fa.campaign AND f."UserId" = fa."UserId"
JOIN question q ON q.campaign = f."CampaignKey" AND q.id = f."QuestionId" AND q.no > 1
GROUP BY fa.campaign, fa.answer, fa.people, q.no, q.text, f."Option"
ORDER BY 1, 2, 4, answers DESC;
