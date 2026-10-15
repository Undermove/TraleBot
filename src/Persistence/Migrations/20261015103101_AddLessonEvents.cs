using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLessonEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "LessonEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    ModuleId = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    LessonId = table.Column<int>(type: "integer", nullable: false),
                    Step = table.Column<int>(type: "integer", nullable: false),
                    StepKind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Event = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Value = table.Column<int>(type: "integer", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LessonEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LessonEvents_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LessonEvents_ModuleId_LessonId_CreatedAtUtc",
                table: "LessonEvents",
                columns: new[] { "ModuleId", "LessonId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_LessonEvents_UserId_CreatedAtUtc",
                table: "LessonEvents",
                columns: new[] { "UserId", "CreatedAtUtc" });

            // Read-only analytics role (deploy/postgres-bootstrap.yml). Its ALTER DEFAULT PRIVILEGES already covers
            // tables made by the bootstrap user; this explicit grant also covers a migration run under another
            // owner. Skipped where the role does not exist (local, tests).
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'agent_ro') THEN
                        GRANT SELECT ON TABLE "LessonEvents" TO agent_ro;
                    END IF;
                END
                $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LessonEvents");
        }
    }
}
