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
            migrationBuilder.AddColumn<DateTime>(
                name: "GiftDaysAtUtc",
                table: "MiniAppUserProgresses",
                type: "timestamp with time zone",
                nullable: true);

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
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GiftDaysAtUtc",
                table: "MiniAppUserProgresses");

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
