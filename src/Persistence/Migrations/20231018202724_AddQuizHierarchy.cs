using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddQuizHierarchy : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CreatedByUserName",
                table: "Quizzes",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "CreatedByUserScore",
                table: "Quizzes",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QuizType",
                table: "Quizzes",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedByUserName",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "CreatedByUserScore",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "QuizType",
                table: "Quizzes");
        }
    }
}
