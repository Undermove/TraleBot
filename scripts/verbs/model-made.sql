-- Глаголы, которые составила одна модель и одобрила вторая, — список для последующей ручной ревизии.
-- Только чтение. То же отдаёт GET /api/admin/verbs/model-made (ModelMadeVerbsQuery).
-- Сверху — ещё не просмотренные (RevisedAtUtc is null), новые первыми.
select v."Lemma"                                   as lemma,
       v."Title"                                   as action_name,
       v."Translation"                             as russian,
       p."AskedText"                               as asked,
       p."GeneratorModel"                          as written_by,
       p."ReviewerModel"                           as approved_by,
       p."ApprovedAtUtc"                           as approved_at,
       p."RepairRounds"                            as repairs,
       p."FormsAttested" || '/' || p."FormsTotal"  as attested,
       p."LemmaInLexicon"                          as in_lexicon,
       (select count(*) from "UserVerbs" u where u."VerbId" = v."Id") as learners,
       p."RevisedAtUtc"                            as revised_at,
       p."UnattestedFormsJson"                     as not_attested,
       p."ReviewerReasons"                         as reviewer_said
from "VerbProvenances" p
join "Verbs" v on v."Id" = p."VerbId"
where v."Status" = 1
order by (p."RevisedAtUtc" is not null), p."ApprovedAtUtc" desc;
