-- Что дала рассылка (только чтение). Запуск:
--   psql … -v campaign=referral-2026-10 -v days=7 -f scripts/sql/campaign-report.sql
-- Строки: пробная группа (sample), остальные (rest), всё вместе (all).
--
--   picked              — выбрано получателей
--   delivered           — Telegram принял сообщение
--   blocked             — бот заблокирован (403)
--   rejected            — Telegram отказал по другой причине
--   unknown             — отправка начата, ответа нет (могло дойти, могло нет; повторно не шлём)
--   not_sent_yet        — выбраны, но ещё не отправлены
--   opened_by_button    — открыли мини-апп кнопкой из сообщения за :days дней
--   got_gift            — получили подарок кампании (дни доступа с момента открытия; 0, если подарка у кампании нет)
--   played_verbs        — из открывших: начали сессию глагола после открытия
--   finished_verbs      — из открывших: доиграли хотя бы одну такую сессию
--   paid_after_open     — из открывших: оплатили после открытия (возвраты не считаются)
--   active_after        — занимались в мини-аппе после сообщения (по последней активности; кнопкой или сами)
--   inviters            — получатели, по чьей ссылке за :days дней зарегистрировался хотя бы один друг
--   friends_registered  — сколько друзей зарегистрировалось по их ссылкам за :days дней
--   bonuses_granted     — сколько из этих друзей начали заниматься и принесли бонус
--   inviters_rewarded   — скольким получателям бонус начислен
--
-- Нажатия «поделиться» сервер не видит (это окно Telegram), поэтому «позвал» считается по
-- зарегистрировавшимся друзьям.
WITH delivery AS (
    SELECT d."UserId", d."IsSample", d."Status", d."SentAtUtc", d."OpenedAtUtc", d."GiftGrantedAtUtc",
           d."SentAtUtc" + make_interval(days => :days) AS window_end
    FROM "BroadcastDeliveries" d
    JOIN "BroadcastCampaigns" c ON c."Id" = d."CampaignId"
    WHERE c."Key" = :'campaign'
), recipient AS (
    SELECT d.*,
           (SELECT p."LastPlayedAtUtc" FROM "MiniAppUserProgresses" p WHERE p."UserId" = d."UserId" LIMIT 1) AS last_played,
           EXISTS (SELECT 1 FROM "VerbSessions" s
                    WHERE s."UserId" = d."UserId" AND s."StartedAtUtc" >= d."OpenedAtUtc") AS played,
           EXISTS (SELECT 1 FROM "VerbSessions" s
                    WHERE s."UserId" = d."UserId" AND s."StartedAtUtc" >= d."OpenedAtUtc"
                      AND s."FinishedAtUtc" IS NOT NULL) AS finished,
           EXISTS (SELECT 1 FROM "Payments" p
                    WHERE p."UserId" = d."UserId" AND p."PurchasedAtUtc" >= d."OpenedAtUtc"
                      AND p."RefundedAtUtc" IS NULL) AS paid,
           (SELECT count(*) FROM "Referrals" r
             WHERE r."ReferrerUserId" = d."UserId"
               AND r."CreatedAtUtc" >= d."SentAtUtc" AND r."CreatedAtUtc" < d.window_end) AS friends,
           (SELECT count(*) FROM "Referrals" r
             WHERE r."ReferrerUserId" = d."UserId"
               AND r."CreatedAtUtc" >= d."SentAtUtc" AND r."CreatedAtUtc" < d.window_end
               AND r."ActivatedAtUtc" IS NOT NULL AND r."BonusReferrerDays" > 0) AS bonuses
    FROM delivery d
)
SELECT CASE WHEN GROUPING("IsSample") = 1 THEN 'all' WHEN "IsSample" THEN 'sample' ELSE 'rest' END AS part,
       count(*)                                                        AS picked,
       count(*) FILTER (WHERE "Status" = 2)                            AS delivered,
       count(*) FILTER (WHERE "Status" = 3)                            AS blocked,
       count(*) FILTER (WHERE "Status" = 4)                            AS rejected,
       count(*) FILTER (WHERE "Status" = 1)                            AS unknown,
       count(*) FILTER (WHERE "Status" = 0)                            AS not_sent_yet,
       count(*) FILTER (WHERE "OpenedAtUtc" < window_end)              AS opened_by_button,
       count(*) FILTER (WHERE "GiftGrantedAtUtc" IS NOT NULL)          AS got_gift,
       count(*) FILTER (WHERE played)                                  AS played_verbs,
       count(*) FILTER (WHERE finished)                                AS finished_verbs,
       count(*) FILTER (WHERE paid)                                    AS paid_after_open,
       count(*) FILTER (WHERE last_played >= "SentAtUtc")              AS active_after,
       count(*) FILTER (WHERE friends > 0)                             AS inviters,
       COALESCE(sum(friends), 0)                                       AS friends_registered,
       COALESCE(sum(bonuses), 0)                                       AS bonuses_granted,
       count(*) FILTER (WHERE bonuses > 0)                             AS inviters_rewarded
FROM recipient
GROUP BY ROLLUP ("IsSample")
ORDER BY GROUPING("IsSample"), "IsSample" DESC;
