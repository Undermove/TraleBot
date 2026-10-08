-- Глаголы от нейросети с непроверенными временами (только чтение). Запуск:
--   psql … -f scripts/sql/verbs-unverified-tenses.sql
-- Одна строка — одно непроверенное время одного глагола.
--
--   lemma, translation  — глагол и его русский перевод
--   tense               — время (ключ карточки: future, aorist, optative, conditional, imperfect, …)
--   forms               — шесть клеток по порядку: я, ты, он, мы, вы, они («—» — клетка пустая)
--   phrases             — что значат клетки по-русски, если фразы есть
--   not_in_texts        — формы глагола, которых не нашлось в настоящих текстах на момент составления
--                         (по всему глаголу, не только по этому времени)
--   completed           — время дописано вторым кругом («допиши недостающие времена»)
--   learners            — сколько человек учат глагол
--   asked_text          — запрос, по которому глагол был составлен
--   approved_at         — когда запись одобрена проверяющей моделью
--   reviewer_reasons    — доводы проверяющей модели
--   owner_actions       — что владелец уже делал с временами этого глагола (журнал)
--
-- Непроверенное время показывается в карточке с пометкой и не участвует в играх и разборе слова.
-- Подтвердить, исправить или убрать его — в админке мини-аппа («Глаголы от нейросети»).
SELECT v."Lemma"                                                   AS lemma,
       v."Translation"                                             AS translation,
       t.tense                                                     AS tense,
       (SELECT string_agg(COALESCE(cell ->> 0, '—'), ' | ' ORDER BY person)
          FROM jsonb_array_elements(v."CardJson"::jsonb -> 'tenses' -> t.tense) WITH ORDINALITY AS c(cell, person))
                                                                   AS forms,
       (SELECT string_agg(phrase, ' | ' ORDER BY person)
          FROM jsonb_array_elements_text(v."CardJson"::jsonb -> 'meanings' -> t.tense) WITH ORDINALITY AS m(phrase, person))
                                                                   AS phrases,
       p."UnattestedFormsJson"                                     AS not_in_texts,
       p."CompletedTensesJson"::jsonb ? t.tense                    AS completed,
       (SELECT count(*) FROM "UserVerbs" u WHERE u."VerbId" = v."Id") AS learners,
       p."AskedText"                                               AS asked_text,
       p."ApprovedAtUtc"                                           AS approved_at,
       p."ReviewerReasons"                                         AS reviewer_reasons,
       p."TenseReviewsJson"                                        AS owner_actions
FROM "Verbs" v
JOIN "VerbProvenances" p ON p."VerbId" = v."Id"
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(v."CardJson"::jsonb -> 'unverifiedTenses', '[]'::jsonb)) AS t(tense)
WHERE v."Status" = 1
ORDER BY p."ApprovedAtUtc" DESC, v."Lemma", t.tense;
