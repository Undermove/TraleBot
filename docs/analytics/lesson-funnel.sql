-- Воронка шагов урока: сколько разных людей дошло до каждого шага и сколько отвалилось по дороге.
-- Таблица LessonEvents пишется мини-аппом (POST /api/miniapp/events). Запускать через скилл db-readonly
-- (роль agent_ro, только SELECT). Поменяй модуль, урок и период в CTE params.
--
-- Шаг 0 — стартовый экран урока (opener), дальше игры по порядку, потом check (проверка) и finale (праздник).
-- reached     — люди, у которых шаг начался (step_start; для шага 0 — lesson_open);
-- finished    — люди, прошедшие шаг (step_done);
-- skipped     — нажимали «пропустить» внутри шага;
-- left_here   — ушли посреди урока на этом шаге (lesson_exit) и в период так и не закончили урок;
-- drop_pct    — сколько процентов от дошедших до предыдущего шага не дошли до этого.

WITH params AS (
    SELECT 'alphabet-progressive'::text AS module_id,
           12                           AS lesson_id,
           now() - interval '30 days'   AS since
),
ev AS (
    SELECT e.*
    FROM "LessonEvents" e, params p
    WHERE e."ModuleId" = p.module_id AND e."LessonId" = p.lesson_id AND e."CreatedAtUtc" >= p.since
),
completed AS (
    SELECT DISTINCT "UserId" FROM ev WHERE "Event" = 'lesson_complete'
),
steps AS (
    SELECT "Step" AS step,
           -- Вид шага — самый частый на этой позиции (у урока он один, но пусть будет устойчиво).
           mode() WITHIN GROUP (ORDER BY "StepKind") AS kind,
           count(DISTINCT "UserId") FILTER (WHERE "Event" IN ('step_start', 'lesson_open')) AS reached,
           count(DISTINCT "UserId") FILTER (WHERE "Event" = 'step_done') AS finished,
           count(DISTINCT "UserId") FILTER (WHERE "Event" = 'step_skip') AS skipped,
           count(DISTINCT "UserId") FILTER (WHERE "Event" = 'lesson_exit'
                                              AND "UserId" NOT IN (SELECT "UserId" FROM completed)) AS left_here
    FROM ev
    GROUP BY "Step"
)
SELECT step,
       kind,
       reached,
       finished,
       skipped,
       left_here,
       round(100.0 * (lag(reached) OVER (ORDER BY step) - reached)
             / nullif(lag(reached) OVER (ORDER BY step), 0), 1) AS drop_pct
FROM steps
ORDER BY step;

-- Итог урока за тот же период: открыли / засчитан / не засчитан (проверка с ошибками) / ушли и не вернулись.
-- SELECT count(DISTINCT "UserId") FILTER (WHERE "Event" = 'lesson_open')     AS opened,
--        count(DISTINCT "UserId") FILTER (WHERE "Event" = 'lesson_complete') AS completed,
--        count(DISTINCT "UserId") FILTER (WHERE "Event" = 'lesson_fail')     AS failed
-- FROM "LessonEvents"
-- WHERE "ModuleId" = 'alphabet-progressive' AND "LessonId" = 12 AND "CreatedAtUtc" >= now() - interval '30 days';
