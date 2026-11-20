using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDailyGift : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "StreakFreezes",
                table: "MiniAppUserProgresses",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateOnly>(
                name: "XpBoostDay",
                table: "MiniAppUserProgresses",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GiftJson",
                table: "DailyTaskStates",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "FriendGifts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Code = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    GiverUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Days = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RecipientUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ActivatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FriendGifts", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FriendGifts_Code",
                table: "FriendGifts",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FriendGifts_GiverUserId",
                table: "FriendGifts",
                column: "GiverUserId");

            migrationBuilder.CreateIndex(
                name: "IX_FriendGifts_RecipientUserId",
                table: "FriendGifts",
                column: "RecipientUserId",
                unique: true,
                filter: "\"RecipientUserId\" IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FriendGifts");

            migrationBuilder.DropColumn(
                name: "StreakFreezes",
                table: "MiniAppUserProgresses");

            migrationBuilder.DropColumn(
                name: "XpBoostDay",
                table: "MiniAppUserProgresses");

            migrationBuilder.DropColumn(
                name: "GiftJson",
                table: "DailyTaskStates");
        }
    }
}
