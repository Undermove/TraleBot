using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVerbProvenance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "VerbProvenances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    VerbId = table.Column<Guid>(type: "uuid", nullable: false),
                    AskedText = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    GeneratorModel = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ReviewerModel = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ApprovedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RepairRounds = table.Column<int>(type: "integer", nullable: false),
                    FormsTotal = table.Column<int>(type: "integer", nullable: false),
                    FormsAttested = table.Column<int>(type: "integer", nullable: false),
                    UnattestedFormsJson = table.Column<string>(type: "text", nullable: false),
                    LemmaInLexicon = table.Column<bool>(type: "boolean", nullable: false),
                    ReviewerReasons = table.Column<string>(type: "text", nullable: false),
                    RevisedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VerbProvenances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VerbProvenances_Verbs_VerbId",
                        column: x => x.VerbId,
                        principalTable: "Verbs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_VerbProvenances_VerbId",
                table: "VerbProvenances",
                column: "VerbId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VerbProvenances");
        }
    }
}
