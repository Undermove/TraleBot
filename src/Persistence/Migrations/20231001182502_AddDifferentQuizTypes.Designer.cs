﻿// <auto-generated />
using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using Persistence;

#nullable disable

namespace Persistence.Migrations
{
    [DbContext(typeof(TraleDbContext))]
    [Migration("20231001182502_AddDifferentQuizTypes")]
    partial class AddDifferentQuizTypes
    {
        /// <inheritdoc />
        protected override void BuildTargetModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .HasAnnotation("ProductVersion", "7.0.2")
                .HasAnnotation("Proxies:ChangeTracking", false)
                .HasAnnotation("Proxies:CheckEquality", false)
                .HasAnnotation("Proxies:LazyLoading", true)
                .HasAnnotation("Relational:MaxIdentifierLength", 63);

            NpgsqlModelBuilderExtensions.UseIdentityByDefaultColumns(modelBuilder);

            modelBuilder.Entity("Domain.Entities.Achievement", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uuid");

                    b.Property<Guid>("AchievementTypeId")
                        .HasColumnType("uuid");

                    b.Property<DateTime>("DateAddedUtc")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("timestamp with time zone");

                    b.Property<string>("Description")
                        .IsRequired()
                        .HasColumnType("text");

                    b.Property<string>("Icon")
                        .IsRequired()
                        .HasColumnType("text");

                    b.Property<string>("Name")
                        .IsRequired()
                        .HasColumnType("text");

                    b.Property<Guid>("UserId")
                        .HasColumnType("uuid");

                    b.HasKey("Id");

                    b.HasIndex("UserId");

                    b.ToTable("Achievements");
                });

            modelBuilder.Entity("Domain.Entities.Invoice", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uuid");

                    b.Property<DateTime>("CreatedAtUtc")
                        .HasColumnType("timestamp with time zone");

                    b.Property<string>("PreCheckoutQueryId")
                        .IsRequired()
                        .HasColumnType("text");

                    b.Property<Guid>("UserId")
                        .HasColumnType("uuid");

                    b.HasKey("Id");

                    b.HasIndex("UserId");

                    b.ToTable("Invoices");
                });

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

                    b.Property<Guid>("ShareableQuizId")
                        .HasColumnType("uuid");

                    b.Property<Guid>("UserId")
                        .HasColumnType("uuid");

                    b.HasKey("Id");

                    b.HasIndex("UserId");

                    b.ToTable("Quizzes");
                });

            modelBuilder.Entity("Domain.Entities.QuizQuestion", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uuid");

                    b.Property<string>("Answer")
                        .IsRequired()
                        .HasColumnType("text");

                    b.Property<string>("Example")
                        .IsRequired()
                        .HasColumnType("text");

                    b.Property<string>("Question")
                        .IsRequired()
                        .HasColumnType("text");

                    b.Property<string>("QuestionType")
                        .IsRequired()
                        .HasColumnType("text");

                    b.Property<Guid?>("QuizId")
                        .HasColumnType("uuid");

                    b.Property<Guid>("VocabularyEntryId")
                        .HasColumnType("uuid");

                    b.HasKey("Id");

                    b.HasIndex("QuizId");

                    b.HasIndex("VocabularyEntryId");

                    b.ToTable("QuizQuestions");

                    b.HasDiscriminator<string>("QuestionType").HasValue("QuizQuestion");

                    b.UseTphMappingStrategy();
                });

            modelBuilder.Entity("Domain.Entities.ShareableQuiz", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uuid");

                    b.Property<Guid>("CreatedByUserId")
                        .HasColumnType("uuid");

                    b.Property<DateTime>("DateAddedUtc")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("timestamp with time zone");

                    b.Property<Guid>("QuizId")
                        .HasColumnType("uuid");

                    b.Property<int>("QuizType")
                        .HasColumnType("integer");

                    b.Property<string>("VocabularyEntriesIds")
                        .IsRequired()
                        .HasColumnType("text");

                    b.HasKey("Id");

                    b.HasIndex("CreatedByUserId");

                    b.HasIndex("QuizId")
                        .IsUnique();

                    b.ToTable("ShareableQuizzes");
                });

            modelBuilder.Entity("Domain.Entities.User", b =>
                {
                    b.Property<Guid>("Id")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uuid");

                    b.Property<int>("AccountType")
                        .HasColumnType("integer");

                    b.Property<DateTime>("RegisteredAtUtc")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("timestamp with time zone");

                    b.Property<DateTime?>("SubscribedUntil")
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

                    b.Property<string>("AdditionalInfo")
                        .IsRequired()
                        .HasColumnType("text");

                    b.Property<DateTime>("DateAdded")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("timestamp with time zone");

                    b.Property<string>("Definition")
                        .IsRequired()
                        .HasColumnType("text");

                    b.Property<string>("Example")
                        .IsRequired()
                        .HasColumnType("text");

                    b.Property<int>("FailedAnswersCount")
                        .HasColumnType("integer");

                    b.Property<int>("SuccessAnswersCount")
                        .HasColumnType("integer");

                    b.Property<int>("SuccessAnswersCountInReverseDirection")
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

            modelBuilder.Entity("Domain.Entities.QuizQuestionWithTypeAnswer", b =>
                {
                    b.HasBaseType("Domain.Entities.QuizQuestion");

                    b.HasDiscriminator().HasValue("QuizQuestionWithTypeAnswer");
                });

            modelBuilder.Entity("Domain.Entities.QuizQuestionWithVariants", b =>
                {
                    b.HasBaseType("Domain.Entities.QuizQuestion");

                    b.Property<string>("Variants")
                        .IsRequired()
                        .HasColumnType("text");

                    b.HasDiscriminator().HasValue("QuizQuestionWithVariants");
                });

            modelBuilder.Entity("Domain.Entities.Achievement", b =>
                {
                    b.HasOne("Domain.Entities.User", "User")
                        .WithMany("Achievements")
                        .HasForeignKey("UserId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("User");
                });

            modelBuilder.Entity("Domain.Entities.Invoice", b =>
                {
                    b.HasOne("Domain.Entities.User", "User")
                        .WithMany("Invoices")
                        .HasForeignKey("UserId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("User");
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

            modelBuilder.Entity("Domain.Entities.QuizQuestion", b =>
                {
                    b.HasOne("Domain.Entities.Quiz", null)
                        .WithMany("QuizQuestions")
                        .HasForeignKey("QuizId");

                    b.HasOne("Domain.Entities.VocabularyEntry", "VocabularyEntry")
                        .WithMany("QuizQuestions")
                        .HasForeignKey("VocabularyEntryId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("VocabularyEntry");
                });

            modelBuilder.Entity("Domain.Entities.ShareableQuiz", b =>
                {
                    b.HasOne("Domain.Entities.User", "CreatedByUser")
                        .WithMany("ShareableQuizzes")
                        .HasForeignKey("CreatedByUserId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.HasOne("Domain.Entities.Quiz", "Quiz")
                        .WithOne("ShareableQuiz")
                        .HasForeignKey("Domain.Entities.ShareableQuiz", "QuizId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("CreatedByUser");

                    b.Navigation("Quiz");
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
                    b.Navigation("QuizQuestions");

                    b.Navigation("ShareableQuiz");
                });

            modelBuilder.Entity("Domain.Entities.User", b =>
                {
                    b.Navigation("Achievements");

                    b.Navigation("Invoices");

                    b.Navigation("Quizzes");

                    b.Navigation("ShareableQuizzes");

                    b.Navigation("VocabularyEntries");
                });

            modelBuilder.Entity("Domain.Entities.VocabularyEntry", b =>
                {
                    b.Navigation("QuizQuestions");
                });
#pragma warning restore 612, 618
        }
    }
}
