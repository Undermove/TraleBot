﻿// <auto-generated />
using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using Persistence;

#nullable disable

namespace Persistence.Migrations
{
    [DbContext(typeof(TraleDbContext))]
    partial class TraleDbContextModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .HasAnnotation("ProductVersion", "7.0.2")
                .HasAnnotation("Relational:MaxIdentifierLength", 63);

            NpgsqlModelBuilderExtensions.UseIdentityByDefaultColumns(modelBuilder);

            modelBuilder.Entity("Domain.Entities.Quiz", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uuid");

                    b.Property<int>("CorrectAnswersCount")
                        .HasColumnType("integer");

                    b.Property<DateTime>("DateStarted")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("timestamp with time zone");

                    b.Property<int>("IncorrectAnswersCount")
                        .HasColumnType("integer");

                    b.Property<bool>("IsCompleted")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("boolean")
                        .HasDefaultValue(false);

                    b.Property<Guid>("UserId")
                        .HasColumnType("uuid");

                    b.HasKey("Id");

                    b.HasIndex("UserId");

                    b.ToTable("Quizzes");
                });

            modelBuilder.Entity("Domain.Entities.QuizVocabularyEntry", b =>
                {
                    b.Property<Guid>("QuizId")
                        .HasColumnType("uuid");

                    b.Property<Guid>("VocabularyEntryId")
                        .HasColumnType("uuid");

                    b.HasKey("QuizId", "VocabularyEntryId");

                    b.HasIndex("VocabularyEntryId");

                    b.ToTable("QuizVocabularyEntry");
                });

            modelBuilder.Entity("Domain.Entities.User", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uuid");

                    b.Property<int>("AccountType")
                        .HasColumnType("integer");

                    b.Property<DateTime>("SubscribedUntil")
                        .HasColumnType("timestamp with time zone");

                    b.Property<long>("TelegramId")
                        .HasColumnType("bigint");

                    b.HasKey("Id");

                    b.ToTable("Users");
                });

            modelBuilder.Entity("Domain.Entities.VocabularyEntry", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uuid");

                    b.Property<DateTime>("DateAdded")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("timestamp with time zone");

                    b.Property<string>("Definition")
                        .IsRequired()
                        .HasColumnType("text");

                    b.Property<int>("FailedAnswersCount")
                        .HasColumnType("integer");

                    b.Property<int>("SuccessAnswersCount")
                        .HasColumnType("integer");

                    b.Property<Guid>("UserId")
                        .HasColumnType("uuid");

                    b.Property<string>("Word")
                        .IsRequired()
                        .HasColumnType("text");

                    b.HasKey("Id");

                    b.HasIndex("DateAdded");

                    b.HasIndex("UserId");

                    b.ToTable("VocabularyEntries");
                });

            modelBuilder.Entity("Domain.Entities.Quiz", b =>
                {
                    b.HasOne("Domain.Entities.User", "User")
                        .WithMany("Quizzes")
                        .HasForeignKey("UserId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("User");
                });

            modelBuilder.Entity("Domain.Entities.QuizVocabularyEntry", b =>
                {
                    b.HasOne("Domain.Entities.Quiz", "Quiz")
                        .WithMany("QuizVocabularyEntries")
                        .HasForeignKey("QuizId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.HasOne("Domain.Entities.VocabularyEntry", "VocabularyEntry")
                        .WithMany("QuizVocabularyEntries")
                        .HasForeignKey("VocabularyEntryId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("Quiz");

                    b.Navigation("VocabularyEntry");
                });

            modelBuilder.Entity("Domain.Entities.VocabularyEntry", b =>
                {
                    b.HasOne("Domain.Entities.User", "User")
                        .WithMany("VocabularyEntries")
                        .HasForeignKey("UserId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("User");
                });

            modelBuilder.Entity("Domain.Entities.Quiz", b =>
                {
                    b.Navigation("QuizVocabularyEntries");
                });

            modelBuilder.Entity("Domain.Entities.User", b =>
                {
                    b.Navigation("Quizzes");

                    b.Navigation("VocabularyEntries");
                });

            modelBuilder.Entity("Domain.Entities.VocabularyEntry", b =>
                {
                    b.Navigation("QuizVocabularyEntries");
                });
#pragma warning restore 612, 618
        }
    }
}
