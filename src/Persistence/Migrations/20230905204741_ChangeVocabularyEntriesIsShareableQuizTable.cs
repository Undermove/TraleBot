using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ChangeVocabularyEntriesIsShareableQuizTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_VocabularyEntries_ShareableQuizzes_ShareableQuizId",
                table: "VocabularyEntries");

            migrationBuilder.DropIndex(
                name: "IX_VocabularyEntries_ShareableQuizId",
                table: "VocabularyEntries");

            migrationBuilder.DropColumn(
                name: "ShareableQuizId",
                table: "VocabularyEntries");

            migrationBuilder.AddColumn<string>(
                name: "VocabularyEntriesIds",
                table: "ShareableQuizzes",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "VocabularyEntriesIds",
                table: "ShareableQuizzes");

            migrationBuilder.AddColumn<Guid>(
                name: "ShareableQuizId",
                table: "VocabularyEntries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_VocabularyEntries_ShareableQuizId",
                table: "VocabularyEntries",
                column: "ShareableQuizId");

            migrationBuilder.AddForeignKey(
                name: "FK_VocabularyEntries_ShareableQuizzes_ShareableQuizId",
                table: "VocabularyEntries",
                column: "ShareableQuizId",
                principalTable: "ShareableQuizzes",
                principalColumn: "Id");
        }
    }
}
