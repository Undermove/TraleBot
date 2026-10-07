-- Кому бонус за друга начислился впустую по старому правилу (только чтение).
--   psql … -f scripts/sql/referral-shortchanged.sql
--
-- Старое правило: +7 дней прибавлялись к TrialBonusDays, а конец пробного периода считался от
-- регистрации. Если к моменту начисления пробный период уже закончился, часть недели (или вся)
-- пришлась на прошлое. Для каждого начисления считаем, сколько из 7 дней пропало:
--   пропало = min(7 дней, max(0, момент начисления − конец пробного периода перед начислением)).
-- Конец перед начислением = регистрация + 30 + дни, полученные как приглашённый
-- (TrialBonusDays минус все свои начисления по 7) + более ранние начисления по 7.
--
-- В выборку не попадают те, кто когда-либо платил (у них бонус шёл в подписку и считался от
-- «сейчас» — там всё было верно) и начисления с BonusReferrerDays <> 7.
-- referee_days < 0 или не кратно 30 — данные менялись вручную, такую строку смотреть глазами.
-- Расчёт верен, пока все начисления сделаны по старому правилу: запускать до выката исправления
-- или сразу после него (новые начисления «с момента активации» в TrialBonusDays не попадают
-- и исказили бы referee_days).
WITH grants AS (
    SELECT r."ReferrerUserId" AS user_id,
           r."ActivatedAtUtc" AS granted_at,
           COALESCE(SUM(r."BonusReferrerDays") OVER (
               PARTITION BY r."ReferrerUserId" ORDER BY r."ActivatedAtUtc", r."Id"
               ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS earlier_days,
           SUM(r."BonusReferrerDays") OVER (PARTITION BY r."ReferrerUserId") AS all_days
    FROM "Referrals" r
    JOIN "Users" u ON u."Id" = r."ReferrerUserId"
    WHERE r."ActivatedAtUtc" IS NOT NULL AND r."BonusReferrerDays" = 7 AND NOT u."IsPro"
), per_grant AS (
    SELECT g.user_id, g.granted_at,
           u."RegisteredAtUtc"
             + make_interval(days => (30 + u."TrialBonusDays" - g.all_days + g.earlier_days)::int) AS trial_end_before
    FROM grants g
    JOIN "Users" u ON u."Id" = g.user_id
)
SELECT u."Id"                                   AS user_id,
       u."TelegramId"                           AS telegram_id,
       u."IsActive"                             AS reachable,
       u."RegisteredAtUtc"                      AS registered_at,
       u."TrialBonusDays"                       AS trial_bonus_days,
       u."TrialBonusDays" - count(*) * 7        AS referee_days,
       count(*)                                 AS grants,
       min(p.granted_at)                        AS first_grant_at,
       max(p.granted_at)                        AS last_grant_at,
       sum(LEAST(GREATEST(p.granted_at - p.trial_end_before, interval '0'), interval '7 days')) AS lost
FROM per_grant p
JOIN "Users" u ON u."Id" = p.user_id
GROUP BY u."Id"
HAVING sum(LEAST(GREATEST(p.granted_at - p.trial_end_before, interval '0'), interval '7 days')) > interval '0'
ORDER BY lost DESC, last_grant_at DESC;
