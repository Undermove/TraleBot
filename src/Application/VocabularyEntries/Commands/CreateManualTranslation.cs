using System.Text.RegularExpressions;
using Application.Achievements.Services.Triggers;
using Application.Common;
using Application.Common.Interfaces.Achievements;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.VocabularyEntries.Commands;

public class CreateManualTranslation : IRequest<ManualTranslationResult>
{
    public Guid UserId { get; init; }
    public string? Word { get; init; }
    public string? Definition { get; init; }

    public class Handler(ITraleDbContext context, IAchievementsService achievementService)
        : IRequestHandler<CreateManualTranslation, ManualTranslationResult>
    {
        public async Task<ManualTranslationResult> Handle(CreateManualTranslation request, CancellationToken ct)
        {
            var user = await GetUser(request, ct);

            if (IsContainsEmoji(request.Word!))
            {
                return new ManualTranslationResult.EmojiNotAllowed();
            }
            
            var duplicate = await context.VocabularyEntries
                .SingleOrDefaultAsync(entry => entry.UserId == request.UserId
                                               && entry.Language == user.Settings.CurrentLanguage
                                               && entry.Word.Equals(request.Word), ct);
            
            if(duplicate != null)
            {
                return new ManualTranslationResult.EntryAlreadyExists(
                    duplicate.Definition, 
                    duplicate.AdditionalInfo,
                    duplicate.Id);
            }
            
            if (request.Definition == null)
            {
                return new ManualTranslationResult.DefinitionIsNotSet();
            }
            
            return await CreateManualVocabularyEntry(request, user, ct);
        }

        private async Task<ManualTranslationResult.EntrySaved> CreateManualVocabularyEntry(CreateManualTranslation request, User user,  CancellationToken ct)
        {
            var manualTranslationTrigger = new ManualTranslationTrigger();
            await achievementService.AssignAchievements(manualTranslationTrigger, user.Id, ct);

            return await CreateVocabularyEntryResult(request, ct, request.Definition!, request.Definition!, user);
        }

        private async Task<ManualTranslationResult.EntrySaved> CreateVocabularyEntryResult(CreateManualTranslation request, CancellationToken ct,
            string definition, string additionalInfo, User user)
        {
            var entryId = Guid.NewGuid();
            var dateAddedUtc = DateTime.UtcNow;
            var vocabularyEntry = new VocabularyEntry
            {
                Id = entryId,
                Word = request.Word!.Trim().ToLowerInvariant(),
                Definition = definition.Trim().ToLowerInvariant(),
                AdditionalInfo = additionalInfo.ToLowerInvariant(),
                Example = "",
                UserId = request.UserId,
                DateAddedUtc = dateAddedUtc,
                UpdatedAtUtc = dateAddedUtc,
                Language = user.Settings.CurrentLanguage
            };

            await context.VocabularyEntries.AddAsync(vocabularyEntry, ct);

            await context.SaveChangesAsync(ct);

            var vocabularyCountTrigger = new VocabularyCountTrigger { VocabularyEntriesCount = user.VocabularyEntries.Count };
            await achievementService.AssignAchievements(vocabularyCountTrigger, user.Id, ct);

            return new ManualTranslationResult.EntrySaved(
                definition,
                additionalInfo,
                entryId);
        }

        private static bool IsContainsEmoji(string input)
        {
            string emojiPattern = @"\p{Cs}";
            return Regex.IsMatch(input, emojiPattern);
        }

        private async Task<User> GetUser(CreateManualTranslation request, CancellationToken ct)
        {
            object?[] keyValues = { request.UserId };
            var user = await context.Users.FindAsync(keyValues: keyValues, cancellationToken: ct);
            if (user == null)
            {
                throw new ApplicationException($"User {request.UserId} not found");
            }

            await context.Entry(user).Collection(nameof(user.VocabularyEntries)).LoadAsync(ct);
            await context.Entry(user).Reference(nameof(user.Settings)).LoadAsync(ct);
            return user;
        }
    }
}

public abstract record ManualTranslationResult
{
    public record EntrySaved(
        string Definition,
        string AdditionalInfo,
        Guid VocabularyEntryId): ManualTranslationResult;

    public record EntryAlreadyExists(
        string Definition,
        string AdditionalInfo,
        Guid VocabularyEntryId): ManualTranslationResult;

    public record DefinitionIsNotSet: ManualTranslationResult;

    public record EmojiNotAllowed: ManualTranslationResult;
}