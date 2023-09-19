using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class QuizTableShareableQuizForeignKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ShareableQuizzes_Quizzes_Id",
                table: "ShareableQuizzes");

            migrationBuilder.CreateIndex(
                name: "IX_ShareableQuizzes_QuizId",
                table: "ShareableQuizzes",
                column: "QuizId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ShareableQuizzes_Quizzes_QuizId",
                table: "ShareableQuizzes",
                column: "QuizId",
                principalTable: "Quizzes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ShareableQuizzes_Quizzes_QuizId",
                table: "ShareableQuizzes");

            migrationBuilder.DropIndex(
                name: "IX_ShareableQuizzes_QuizId",
                table: "ShareableQuizzes");

            migrationBuilder.AddForeignKey(
                name: "FK_ShareableQuizzes_Quizzes_Id",
                table: "ShareableQuizzes",
                column: "Id",
                principalTable: "Quizzes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
