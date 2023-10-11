using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UpdateDateUtcColumnToVocabularyEntry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_VocabularyEntries_DateAdded",
                table: "VocabularyEntries");

            migrationBuilder.RenameColumn(
                name: "DateAdded",
                table: "VocabularyEntries",
                newName: "UpdatedAtUtc");

            migrationBuilder.AddColumn<DateTime>(
                name: "DateAddedUtc",
                table: "VocabularyEntries",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.CreateIndex(
                name: "IX_VocabularyEntries_DateAddedUtc",
                table: "VocabularyEntries",
                column: "DateAddedUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_VocabularyEntries_DateAddedUtc",
                table: "VocabularyEntries");

            migrationBuilder.DropColumn(
                name: "DateAddedUtc",
                table: "VocabularyEntries");

            migrationBuilder.RenameColumn(
                name: "UpdatedAtUtc",
                table: "VocabularyEntries",
                newName: "DateAdded");

            migrationBuilder.CreateIndex(
                name: "IX_VocabularyEntries_DateAdded",
                table: "VocabularyEntries",
                column: "DateAdded");
        }
    }
}
