using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVerbFormProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "VerbFormProgresses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    VerbId = table.Column<Guid>(type: "uuid", nullable: false),
                    Tense = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Person = table.Column<int>(type: "integer", nullable: false),
                    Step = table.Column<int>(type: "integer", nullable: false),
                    BestStep = table.Column<int>(type: "integer", nullable: false),
                    Reviews = table.Column<int>(type: "integer", nullable: false),
                    NextDueAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VerbFormProgresses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VerbFormProgresses_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_VerbFormProgresses_Verbs_VerbId",
                        column: x => x.VerbId,
                        principalTable: "Verbs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VerbFormProgresses_UserId_NextDueAtUtc",
                table: "VerbFormProgresses",
                columns: new[] { "UserId", "NextDueAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_VerbFormProgresses_UserId_VerbId_Tense_Person",
                table: "VerbFormProgresses",
                columns: new[] { "UserId", "VerbId", "Tense", "Person" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VerbFormProgresses_VerbId",
                table: "VerbFormProgresses",
                column: "VerbId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VerbFormProgresses");
        }
    }
}
