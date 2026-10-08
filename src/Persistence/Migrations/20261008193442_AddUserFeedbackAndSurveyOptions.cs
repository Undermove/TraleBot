using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserFeedbackAndSurveyOptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string[]>(
                name: "SurveyOptions",
                table: "BroadcastCampaigns",
                type: "text[]",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "UserFeedback",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    CampaignKey = table.Column<string>(type: "character varying(48)", maxLength: 48, nullable: true),
                    Option = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    Text = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserFeedback", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserFeedback_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_UserFeedback_CreatedAtUtc",
                table: "UserFeedback",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_UserFeedback_UserId_CampaignKey",
                table: "UserFeedback",
                columns: new[] { "UserId", "CampaignKey" },
                unique: true,
                filter: "\"Kind\" = 1");

            migrationBuilder.CreateIndex(
                name: "IX_UserFeedback_UserId_Kind_CreatedAtUtc",
                table: "UserFeedback",
                columns: new[] { "UserId", "Kind", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserFeedback");

            migrationBuilder.DropColumn(
                name: "SurveyOptions",
                table: "BroadcastCampaigns");
        }
    }
}
