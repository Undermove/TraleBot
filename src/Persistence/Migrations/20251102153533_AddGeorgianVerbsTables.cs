using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddGeorgianVerbsTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GeorgianVerbs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Georgian = table.Column<string>(type: "text", nullable: false),
                    Russian = table.Column<string>(type: "text", nullable: false),
                    Prefix = table.Column<string>(type: "text", nullable: true),
                    Explanation = table.Column<string>(type: "text", nullable: true),
                    ExamplePresent = table.Column<string>(type: "text", nullable: true),
                    ExamplePast = table.Column<string>(type: "text", nullable: true),
                    ExampleFuture = table.Column<string>(type: "text", nullable: true),
                    Difficulty = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    Wave = table.Column<int>(type: "integer", nullable: false, defaultValue: 1)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GeorgianVerbs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "VerbCards",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    VerbId = table.Column<Guid>(type: "uuid", nullable: false),
                    ExerciseType = table.Column<int>(type: "integer", nullable: false),
                    Question = table.Column<string>(type: "text", nullable: false),
                    QuestionGeorgian = table.Column<string>(type: "text", nullable: false),
                    CorrectAnswer = table.Column<string>(type: "text", nullable: false),
                    IncorrectOptions = table.Column<string[]>(type: "text[]", nullable: false),
                    Explanation = table.Column<string>(type: "text", nullable: false),
                    TimeFormId = table.Column<int>(type: "integer", nullable: false),
                    PersonNumber = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VerbCards", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VerbCards_GeorgianVerbs_VerbId",
                        column: x => x.VerbId,
                        principalTable: "GeorgianVerbs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StudentVerbProgress",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    VerbCardId = table.Column<Guid>(type: "uuid", nullable: false),
                    LastReviewDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NextReviewDateUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IntervalDays = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    CorrectAnswersCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    IncorrectAnswersCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    CurrentStreak = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    IsMarkedAsHard = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    SessionCount = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    DateAddedUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    GeorgianVerbId = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentVerbProgress", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudentVerbProgress_GeorgianVerbs_GeorgianVerbId",
                        column: x => x.GeorgianVerbId,
                        principalTable: "GeorgianVerbs",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_StudentVerbProgress_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StudentVerbProgress_VerbCards_VerbCardId",
                        column: x => x.VerbCardId,
                        principalTable: "VerbCards",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GeorgianVerbs_Difficulty",
                table: "GeorgianVerbs",
                column: "Difficulty");

            migrationBuilder.CreateIndex(
                name: "IX_GeorgianVerbs_Wave",
                table: "GeorgianVerbs",
                column: "Wave");

            migrationBuilder.CreateIndex(
                name: "IX_StudentVerbProgress_GeorgianVerbId",
                table: "StudentVerbProgress",
                column: "GeorgianVerbId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentVerbProgress_LastReviewDateUtc",
                table: "StudentVerbProgress",
                column: "LastReviewDateUtc");

            migrationBuilder.CreateIndex(
                name: "IX_StudentVerbProgress_UserId_IsMarkedAsHard",
                table: "StudentVerbProgress",
                columns: new[] { "UserId", "IsMarkedAsHard" });

            migrationBuilder.CreateIndex(
                name: "IX_StudentVerbProgress_UserId_NextReviewDateUtc",
                table: "StudentVerbProgress",
                columns: new[] { "UserId", "NextReviewDateUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_StudentVerbProgress_VerbCardId",
                table: "StudentVerbProgress",
                column: "VerbCardId");

            migrationBuilder.CreateIndex(
                name: "IX_VerbCards_VerbId_ExerciseType",
                table: "VerbCards",
                columns: new[] { "VerbId", "ExerciseType" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StudentVerbProgress");

            migrationBuilder.DropTable(
                name: "VerbCards");

            migrationBuilder.DropTable(
                name: "GeorgianVerbs");
        }
    }
}
