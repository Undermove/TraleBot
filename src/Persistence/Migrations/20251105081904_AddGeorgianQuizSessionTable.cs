using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGeorgianQuizSessionTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GeorgianQuizSessions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    TelegramUserId = table.Column<long>(type: "bigint", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    LessonId = table.Column<int>(type: "integer", nullable: false),
                    QuestionsJson = table.Column<string>(type: "text", nullable: false),
                    CurrentQuestionIndex = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CorrectAnswersCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    IncorrectAnswersCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    WeakVerbsJson = table.Column<string>(type: "text", nullable: false, defaultValue: "[]"),
                    StartedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GeorgianQuizSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GeorgianQuizSessions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GeorgianQuizSessions_CreatedAtUtc",
                table: "GeorgianQuizSessions",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_GeorgianQuizSessions_TelegramUserId",
                table: "GeorgianQuizSessions",
                column: "TelegramUserId");

            migrationBuilder.CreateIndex(
                name: "IX_GeorgianQuizSessions_UserId",
                table: "GeorgianQuizSessions",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GeorgianQuizSessions");
        }
    }
}
