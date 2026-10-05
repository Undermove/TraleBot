using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserVerbsAndSessions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserVerbs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    VerbId = table.Column<Guid>(type: "uuid", nullable: false),
                    Level = table.Column<int>(type: "integer", nullable: false),
                    StartedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SessionsPlayed = table.Column<int>(type: "integer", nullable: false),
                    LastPlayedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ExamPassedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RecentScenesJson = table.Column<string>(type: "text", nullable: false),
                    StoryCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserVerbs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserVerbs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserVerbs_Verbs_VerbId",
                        column: x => x.VerbId,
                        principalTable: "Verbs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VerbSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    VerbId = table.Column<Guid>(type: "uuid", nullable: false),
                    PlanJson = table.Column<string>(type: "text", nullable: false),
                    Scene = table.Column<int>(type: "integer", nullable: false),
                    Done = table.Column<int>(type: "integer", nullable: false),
                    StartedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    FinishedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    XpEarned = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VerbSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VerbSessions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_VerbSessions_Verbs_VerbId",
                        column: x => x.VerbId,
                        principalTable: "Verbs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserVerbs_UserId_VerbId",
                table: "UserVerbs",
                columns: new[] { "UserId", "VerbId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserVerbs_VerbId",
                table: "UserVerbs",
                column: "VerbId");

            migrationBuilder.CreateIndex(
                name: "IX_VerbSessions_UserId_FinishedAtUtc",
                table: "VerbSessions",
                columns: new[] { "UserId", "FinishedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_VerbSessions_UserId_VerbId_FinishedAtUtc",
                table: "VerbSessions",
                columns: new[] { "UserId", "VerbId", "FinishedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_VerbSessions_VerbId",
                table: "VerbSessions",
                column: "VerbId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserVerbs");

            migrationBuilder.DropTable(
                name: "VerbSessions");
        }
    }
}
