using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveQuizVocabularyEntryManyToManyConnection : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuizVocabularyEntry");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
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
    }
}
