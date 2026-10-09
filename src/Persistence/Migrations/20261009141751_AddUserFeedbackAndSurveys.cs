using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddUserFeedbackAndSurveys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "SurveyFinishedAtUtc",
                table: "BroadcastDeliveries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SurveyOpenedAtUtc",
                table: "BroadcastDeliveries",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SurveyJson",
                table: "BroadcastCampaigns",
                type: "jsonb",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "FeedbackReplies",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    Text = table.Column<string>(type: "character varying(3500)", maxLength: 3500, nullable: true),
                    Quote = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    Error = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    ClientToken = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackReplies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedbackReplies_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserFeedback",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    CampaignKey = table.Column<string>(type: "character varying(48)", maxLength: 48, nullable: true),
                    QuestionId = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
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
                name: "IX_FeedbackReplies_ClientToken",
                table: "FeedbackReplies",
                column: "ClientToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackReplies_UserId_CreatedAtUtc",
                table: "FeedbackReplies",
                columns: new[] { "UserId", "CreatedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_UserFeedback_CreatedAtUtc",
                table: "UserFeedback",
                column: "CreatedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_UserFeedback_UserId_CampaignKey_QuestionId",
                table: "UserFeedback",
                columns: new[] { "UserId", "CampaignKey", "QuestionId" },
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
                name: "FeedbackReplies");

            migrationBuilder.DropTable(
                name: "UserFeedback");

            migrationBuilder.DropColumn(
                name: "SurveyFinishedAtUtc",
                table: "BroadcastDeliveries");

            migrationBuilder.DropColumn(
                name: "SurveyOpenedAtUtc",
                table: "BroadcastDeliveries");

            migrationBuilder.DropColumn(
                name: "SurveyJson",
                table: "BroadcastCampaigns");
        }
    }
}
