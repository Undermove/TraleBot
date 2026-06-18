using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MakeNotificationTriggerUnique : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_NotificationTriggers_UserId_Source",
                table: "NotificationTriggers");

            // Collapse pre-existing duplicate (UserId, Source) rows before the unique index is
            // added — otherwise creation fails. The double-send bug (2026-06-17) left 129 such
            // duplicate trigger rows in prod. Keep the most recent send per (user, source)
            // (greatest LastSentAt, Id as a deterministic tie-breaker) and delete the rest.
            migrationBuilder.Sql(
                """
                DELETE FROM "NotificationTriggers" a
                USING "NotificationTriggers" b
                WHERE a."UserId" = b."UserId"
                  AND a."Source" = b."Source"
                  AND (a."LastSentAt" < b."LastSentAt"
                       OR (a."LastSentAt" = b."LastSentAt" AND a."Id" < b."Id"));
                """);

            migrationBuilder.CreateIndex(
                name: "IX_NotificationTriggers_UserId_Source",
                table: "NotificationTriggers",
                columns: new[] { "UserId", "Source" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_NotificationTriggers_UserId_Source",
                table: "NotificationTriggers");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationTriggers_UserId_Source",
                table: "NotificationTriggers",
                columns: new[] { "UserId", "Source" });
        }
    }
}
