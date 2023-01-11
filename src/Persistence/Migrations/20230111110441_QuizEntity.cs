using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class QuizEntity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_VocabularyEntries_DateAdded",
                table: "VocabularyEntries");

            migrationBuilder.AddColumn<Guid>(
                name: "QuizId",
                table: "VocabularyEntries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Quizzes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    IsCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    DateStarted = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Quizzes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Quizzes_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VocabularyEntries_DateAdded",
                table: "VocabularyEntries",
                column: "DateAdded");

            migrationBuilder.CreateIndex(
                name: "IX_VocabularyEntries_QuizId",
                table: "VocabularyEntries",
                column: "QuizId");

            migrationBuilder.CreateIndex(
                name: "IX_Quizzes_UserId",
                table: "Quizzes",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_VocabularyEntries_Quizzes_QuizId",
                table: "VocabularyEntries",
                column: "QuizId",
                principalTable: "Quizzes",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_VocabularyEntries_Quizzes_QuizId",
                table: "VocabularyEntries");

            migrationBuilder.DropTable(
                name: "Quizzes");

            migrationBuilder.DropIndex(
                name: "IX_VocabularyEntries_DateAdded",
                table: "VocabularyEntries");

            migrationBuilder.DropIndex(
                name: "IX_VocabularyEntries_QuizId",
                table: "VocabularyEntries");

            migrationBuilder.DropColumn(
                name: "QuizId",
                table: "VocabularyEntries");

            migrationBuilder.CreateIndex(
                name: "IX_VocabularyEntries_DateAdded",
                table: "VocabularyEntries",
                column: "DateAdded",
                unique: true);
        }
    }
}
