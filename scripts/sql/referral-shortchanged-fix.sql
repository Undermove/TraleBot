-- ИЗМЕНЯЕТ ДАННЫЕ. Разовая компенсация тем, кого показывает referral-shortchanged.sql:
-- пропавшее время возвращается как бесплатный доступ, считая от момента запуска (или от конца
-- доступа, если он сейчас идёт). Запускать только после выката миграции AddUserBonusAccessUntil
-- и только по решению владельца. Повторный запуск начислит ещё раз — запускать один раз.
--   psql … -f scripts/sql/referral-shortchanged-fix.sql      (внутри — транзакция; сверь число строк и замени ROLLBACK на COMMIT)
-- Расчёт верен, пока все начисления сделаны по старому правилу: запускать до выката исправления
-- или сразу после него (новые начисления «с момента активации» в TrialBonusDays не попадают
-- и исказили бы referee_days).
BEGIN;

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
), owed AS (
    SELECT p.user_id,
           sum(LEAST(GREATEST(p.granted_at - p.trial_end_before, interval '0'), interval '7 days')) AS lost
    FROM per_grant p
    GROUP BY p.user_id
    HAVING sum(LEAST(GREATEST(p.granted_at - p.trial_end_before, interval '0'), interval '7 days')) > interval '0'
)
UPDATE "Users" u
SET "BonusAccessUntilUtc" = GREATEST(
        now(),
        COALESCE(u."BonusAccessUntilUtc", now()),
        u."RegisteredAtUtc" + make_interval(days => 30 + u."TrialBonusDays")) + o.lost
FROM owed o
WHERE u."Id" = o.user_id AND NOT u."IsPro"
RETURNING u."TelegramId", o.lost, u."BonusAccessUntilUtc";

ROLLBACK;
