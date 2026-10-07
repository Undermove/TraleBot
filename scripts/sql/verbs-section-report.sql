-- Раздел «Глаголы»: что сделали те, кто пришёл по ссылке (только чтение). Запуск:
--   psql … -v source=verbs_oct -f scripts/sql/verbs-section-report.sql
-- source — метка, с которой открыли раздел:
--   · имя кампании — если пришли кнопкой из рассылки (…/?screen=verbs&c=<имя кампании>);
--   · метка ссылки — если пришли по t.me/<бот>?start=verbs_<метка> (в базе — «verbs_<метка>» целиком);
--   · home — открыли плиткой «Глаголы» с главной.
-- Все метки и сколько по ним пришло:
--   SELECT "Source", count(*) FROM "VerbSectionVisits" GROUP BY 1 ORDER BY 2 DESC;
--
--   came                    — открыли раздел с этой меткой (люди, не открытия)
--   without_access          — из них в момент первого открытия были без доступа (триал кончился, не платили)
--   started_session         — начали сессию глагола после первого открытия
--   finished_session        — доиграли хотя бы одну сессию, начатую после первого открытия
--   came_back_another_day   — играли в глаголы или открывали раздел в другой день (UTC), позже первого открытия
--   opened_from_home_later  — позже сами открыли раздел плиткой с главной
--   paid_after              — оплатили после первого открытия (возвраты не считаются)
WITH visit AS (
    SELECT v."UserId", v."FirstOpenedAtUtc" AS opened
    FROM "VerbSectionVisits" v
    WHERE v."Source" = :'source'
)
SELECT count(*)                                                                    AS came,
       count(*) FILTER (WHERE NOT u."IsPro"
           AND GREATEST(u."RegisteredAtUtc" + make_interval(days => 30 + u."TrialBonusDays"),
                        COALESCE(u."BonusAccessUntilUtc", '-infinity')) <= visit.opened) AS without_access,
       count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM "VerbSessions" s
           WHERE s."UserId" = visit."UserId" AND s."StartedAtUtc" >= visit.opened))  AS started_session,
       count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM "VerbSessions" s
           WHERE s."UserId" = visit."UserId" AND s."StartedAtUtc" >= visit.opened
             AND s."FinishedAtUtc" IS NOT NULL))                                   AS finished_session,
       count(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM "VerbSessions" s
               WHERE s."UserId" = visit."UserId" AND s."StartedAtUtc"::date > visit.opened::date)
           OR EXISTS (
               SELECT 1 FROM "VerbSectionVisits" o
               WHERE o."UserId" = visit."UserId" AND o."LastOpenedAtUtc"::date > visit.opened::date)) AS came_back_another_day,
       count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM "VerbSectionVisits" o
           WHERE o."UserId" = visit."UserId" AND o."Source" = 'home'
             AND o."LastOpenedAtUtc" > visit.opened))                              AS opened_from_home_later,
       count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM "Payments" p
           WHERE p."UserId" = visit."UserId" AND p."PurchasedAtUtc" >= visit.opened
             AND p."RefundedAtUtc" IS NULL))                                       AS paid_after
FROM visit
JOIN "Users" u ON u."Id" = visit."UserId";
