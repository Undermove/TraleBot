using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ShareableQuizTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ShareableQuizId",
                table: "VocabularyEntries",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ShareableQuizzes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    QuizType = table.Column<int>(type: "integer", nullable: false),
                    DateAddedUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedByUserId = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ShareableQuizzes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ShareableQuizzes_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VocabularyEntries_ShareableQuizId",
                table: "VocabularyEntries",
                column: "ShareableQuizId");

            migrationBuilder.CreateIndex(
                name: "IX_ShareableQuizzes_CreatedByUserId",
                table: "ShareableQuizzes",
                column: "CreatedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_VocabularyEntries_ShareableQuizzes_ShareableQuizId",
                table: "VocabularyEntries",
                column: "ShareableQuizId",
                principalTable: "ShareableQuizzes",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_VocabularyEntries_ShareableQuizzes_ShareableQuizId",
                table: "VocabularyEntries");

            migrationBuilder.DropTable(
                name: "ShareableQuizzes");

            migrationBuilder.DropIndex(
                name: "IX_VocabularyEntries_ShareableQuizId",
                table: "VocabularyEntries");

            migrationBuilder.DropColumn(
                name: "ShareableQuizId",
                table: "VocabularyEntries");
        }
    }
}
