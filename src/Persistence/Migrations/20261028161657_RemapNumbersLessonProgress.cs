using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemapNumbersLessonProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // «Числа» стали 11 уроками вместо 5: старые 1–10, 11–20, 21–100 → уровни 1–4, 5–6, 7–10,
            // «100+, порядковые, дни» (был 4) → 11. Старый 5 (на слух 1–20) своего уровня не имеет.
            migrationBuilder.Sql("""
                UPDATE "MiniAppUserProgresses" p
                SET "CompletedLessonsJson" = jsonb_set(
                    p."CompletedLessonsJson"::jsonb, '{numbers}',
                    (SELECT COALESCE(jsonb_agg(DISTINCT n ORDER BY n), '[]'::jsonb)
                     FROM jsonb_array_elements_text(p."CompletedLessonsJson"::jsonb -> 'numbers') AS e(v)
                     CROSS JOIN LATERAL unnest(CASE e.v::int
                         WHEN 1 THEN ARRAY[1, 2, 3, 4]
                         WHEN 2 THEN ARRAY[5, 6]
                         WHEN 3 THEN ARRAY[7, 8, 9, 10]
                         WHEN 4 THEN ARRAY[11]
                         ELSE ARRAY[]::int[] END) AS n))::text
                WHERE p."CompletedLessonsJson" LIKE '%"numbers"%'
                  AND jsonb_typeof(p."CompletedLessonsJson"::jsonb -> 'numbers') = 'array';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
