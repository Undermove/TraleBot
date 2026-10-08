using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddVerbOwnerApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "OwnerApprovedAtUtc",
                table: "VerbProvenances",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "OwnerApprovedBy",
                table: "VerbProvenances",
                type: "bigint",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OwnerApprovedAtUtc",
                table: "VerbProvenances");

            migrationBuilder.DropColumn(
                name: "OwnerApprovedBy",
                table: "VerbProvenances");
        }
    }
}
