using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SetManyToManyRelationsForQuiz : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_VocabularyEntries_Quizzes_QuizId",
                table: "VocabularyEntries");

            migrationBuilder.DropIndex(
                name: "IX_VocabularyEntries_QuizId",
                table: "VocabularyEntries");

            migrationBuilder.DropColumn(
                name: "QuizId",
                table: "VocabularyEntries");

            migrationBuilder.AlterColumn<bool>(
                name: "IsCompleted",
                table: "Quizzes",
                type: "boolean",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "boolean");

            migrationBuilder.CreateTable(
                name: "QuizVocabularyEntry",
                columns: table => new
                {
                    QuizId = table.Column<Guid>(type: "uuid", nullable: false),
                    VocabularyEntryId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuizVocabularyEntry", x => new { x.QuizId, x.VocabularyEntryId });
                    table.ForeignKey(
                        name: "FK_QuizVocabularyEntry_Quizzes_QuizId",
                        column: x => x.QuizId,
                        principalTable: "Quizzes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_QuizVocabularyEntry_VocabularyEntries_VocabularyEntryId",
                        column: x => x.VocabularyEntryId,
                        principalTable: "VocabularyEntries",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_QuizVocabularyEntry_VocabularyEntryId",
                table: "QuizVocabularyEntry",
                column: "VocabularyEntryId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuizVocabularyEntry");

            migrationBuilder.AddColumn<Guid>(
                name: "QuizId",
                table: "VocabularyEntries",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<bool>(
                name: "IsCompleted",
                table: "Quizzes",
                type: "boolean",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "boolean",
                oldDefaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_VocabularyEntries_QuizId",
                table: "VocabularyEntries",
                column: "QuizId");

            migrationBuilder.AddForeignKey(
                name: "FK_VocabularyEntries_Quizzes_QuizId",
                table: "VocabularyEntries",
                column: "QuizId",
                principalTable: "Quizzes",
                principalColumn: "Id");
        }
    }
}
