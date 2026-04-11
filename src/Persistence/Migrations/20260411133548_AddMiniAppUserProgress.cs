using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddMiniAppUserProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "MiniAppUserProgresses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Xp = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    Streak = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    LastPlayedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    Hearts = table.Column<int>(type: "integer", nullable: false, defaultValue: 5),
                    MaxHearts = table.Column<int>(type: "integer", nullable: false, defaultValue: 5),
                    HeartsUpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CompletedLessonsJson = table.Column<string>(type: "text", nullable: false, defaultValue: "{}"),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MiniAppUserProgresses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MiniAppUserProgresses_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MiniAppUserProgresses_UserId",
                table: "MiniAppUserProgresses",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MiniAppUserProgresses");
        }
    }
}
