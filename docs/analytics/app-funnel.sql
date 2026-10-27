-- Первые минуты в мини-аппе: кто открыл приложение, кто дождался загрузки, куда пошёл и где ушёл.
-- Таблица AppEvents пишется мини-аппом (POST /api/miniapp/app-events). Запускать через скилл db-readonly
-- (роль agent_ro, только SELECT). Период — в CTE params.
--
-- app_open  — скрипт приложения запустился; Value — мс от начала загрузки страницы (сеть + скрипт).
-- app_ready — первый экран получил данные; Value — мс от начала загрузки; Target 'no-auth' — сервер не узнал человека.
-- app_error — первый экран не загрузился.
-- screen    — показан экран (Target: welcome, dashboard, verbs, vocabulary-list…).
-- paywall   — открылась шторка покупки (Target: что её открыло).
-- app_hide  — приложение спрятали или закрыли; Target — экран, на котором это случилось, Value — секунды с открытия.
--
-- Открыл, но не дождался загрузки — app_open без app_ready и app_error до первого app_hide.

WITH params AS (
    SELECT now() - interval '14 days' AS since
),
ev AS (
    SELECT e.*, u."RegisteredAtUtc"
    FROM "AppEvents" e JOIN "Users" u ON u."Id" = e."UserId", params p
    WHERE e."CreatedAtUtc" >= p.since
),
-- Каждое открытие — от app_open до следующего app_open того же человека.
opens AS (
    SELECT "UserId", "CreatedAtUtc" AS opened_at, "Value" AS open_ms, "Platform", "StartParam",
           lead("CreatedAtUtc") OVER (PARTITION BY "UserId" ORDER BY "CreatedAtUtc") AS next_open,
           "CreatedAtUtc" < "RegisteredAtUtc" + interval '1 day' AS first_day
    FROM ev WHERE "Event" = 'app_open'
),
sessions AS (
    SELECT o.*,
           (SELECT min(e."Value") FROM ev e WHERE e."UserId" = o."UserId" AND e."Event" = 'app_ready'
              AND e."CreatedAtUtc" >= o.opened_at AND (o.next_open IS NULL OR e."CreatedAtUtc" < o.next_open)) AS ready_ms,
           EXISTS (SELECT 1 FROM ev e WHERE e."UserId" = o."UserId" AND e."Event" = 'app_error'
              AND e."CreatedAtUtc" >= o.opened_at AND (o.next_open IS NULL OR e."CreatedAtUtc" < o.next_open)) AS failed,
           (SELECT e."Target" FROM ev e WHERE e."UserId" = o."UserId" AND e."Event" = 'app_hide'
              AND e."CreatedAtUtc" >= o.opened_at AND (o.next_open IS NULL OR e."CreatedAtUtc" < o.next_open)
            ORDER BY e."CreatedAtUtc" LIMIT 1) AS left_on
    FROM opens o
)
-- 1) Открытия: сколько дождались загрузки и сколько она длилась (по клиентам, отдельно первый день человека).
SELECT coalesce("Platform", '?') AS platform, first_day,
       count(*)                                             AS opens,
       count(*) FILTER (WHERE ready_ms IS NOT NULL)         AS loaded,
       count(*) FILTER (WHERE failed)                       AS failed,
       count(*) FILTER (WHERE ready_ms IS NULL AND NOT failed AND left_on IS NOT NULL) AS left_while_loading,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY ready_ms) AS ready_ms_p50,
       percentile_cont(0.9) WITHIN GROUP (ORDER BY ready_ms) AS ready_ms_p90
FROM sessions
GROUP BY 1, 2
ORDER BY first_day DESC, opens DESC;

-- 2) Где уходят: экран, на котором приложение спрятали в первый раз за открытие (только первый день новичков).
-- SELECT left_on, count(*) FROM sessions WHERE first_day GROUP BY 1 ORDER BY 2 DESC;

-- 3) Куда ходят: показы экранов и шторки покупки за период, разные люди.
-- SELECT "Event", "Target", count(*) AS shows, count(DISTINCT "UserId") AS people
-- FROM ev WHERE "Event" IN ('screen', 'paywall') GROUP BY 1, 2 ORDER BY people DESC;
