using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVerbSectionVisitsAndCampaignGifts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "GiftAccessUntilUtc",
                table: "BroadcastDeliveries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "GiftGrantedAtUtc",
                table: "BroadcastDeliveries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GiftDays",
                table: "BroadcastCampaigns",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "GiftOfferEndsAtUtc",
                table: "BroadcastCampaigns",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "VerbSectionVisits",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Source = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    FirstOpenedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastOpenedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Opens = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VerbSectionVisits", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VerbSectionVisits_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VerbSectionVisits_Source",
                table: "VerbSectionVisits",
                column: "Source");

            migrationBuilder.CreateIndex(
                name: "IX_VerbSectionVisits_UserId_Source",
                table: "VerbSectionVisits",
                columns: new[] { "UserId", "Source" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VerbSectionVisits");

            migrationBuilder.DropColumn(
                name: "GiftAccessUntilUtc",
                table: "BroadcastDeliveries");

            migrationBuilder.DropColumn(
                name: "GiftGrantedAtUtc",
                table: "BroadcastDeliveries");

            migrationBuilder.DropColumn(
                name: "GiftDays",
                table: "BroadcastCampaigns");

            migrationBuilder.DropColumn(
                name: "GiftOfferEndsAtUtc",
                table: "BroadcastCampaigns");
        }
    }
}
