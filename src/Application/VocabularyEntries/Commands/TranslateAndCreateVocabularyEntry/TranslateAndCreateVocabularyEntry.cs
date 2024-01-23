using System.Text.RegularExpressions;
using Application.Achievements.Services.Triggers;
using Application.Common;
using Application.Common.Extensions;
using Application.Common.Interfaces.Achievements;
using Application.Common.Interfaces.TranslationService;
using Application.Translation;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.VocabularyEntries.Commands.TranslateAndCreateVocabularyEntry;

public class TranslateAndCreateVocabularyEntry : IRequest<CreateVocabularyEntryResult>
{
    public required Guid UserId { get; init; }
    public required string Word { get; init; }

    public class Handler(
        ILanguageTranslator languageTranslator,
        ITraleDbContext context,
        IAchievementsService achievementService)
        : IRequestHandler<TranslateAndCreateVocabularyEntry, CreateVocabularyEntryResult>
    {
        public async Task<CreateVocabularyEntryResult> Handle(TranslateAndCreateVocabularyEntry request, CancellationToken ct)
        {
            var user = await GetUser(request, ct);

            if (IsContainsEmoji(request.Word))
            {
                return new CreateVocabularyEntryResult.EmojiDetected();
            }
            
            var wordLanguage = request.Word.DetectLanguage();
            
            var duplicate = await context.VocabularyEntries
                .SingleOrDefaultAsync(entry => entry.UserId == request.UserId
                                               && (entry.Language == user.Settings.CurrentLanguage || entry.Language == wordLanguage)
                                               && entry.Word.Equals(request.Word.ToLowerInvariant()), ct);
            
            if(duplicate != null)
            {
                return new CreateVocabularyEntryResult.TranslationExists(
                    duplicate.Definition, 
                    duplicate.AdditionalInfo,
                    duplicate.Example,
                    duplicate.Id);
            }

            var targetLanguage = wordLanguage == Language.Russian ? user.Settings.CurrentLanguage : wordLanguage;

            var translationResult = await languageTranslator.Translate(request.Word, targetLanguage, ct);
            return translationResult switch
            {
                TranslationResult.Success s =>
                    await CreateVocabularyEntryResult(
                        request,
                        ct,
                        s.Definition,
                        s.AdditionalInfo,
                        s.Example,
                        user,
                        targetLanguage),
                TranslationResult.PromptLengthExceeded => new CreateVocabularyEntryResult.PromptLengthExceeded(),
                _ => new CreateVocabularyEntryResult.TranslationFailure()
            };
        }

        private async Task<CreateVocabularyEntryResult.TranslationSuccess> CreateVocabularyEntryResult(TranslateAndCreateVocabularyEntry request, CancellationToken ct,
            string definition, string additionalInfo, string example, User user, Language language)
        {
            var entryId = Guid.NewGuid();
            var dateAddedUtc = DateTime.UtcNow;
            var vocabularyEntry = new VocabularyEntry
            {
                Id = entryId,
                Word = request.Word.ToLowerInvariant(),
                Definition = definition.ToLowerInvariant(),
                AdditionalInfo = additionalInfo.ToLowerInvariant(),
                Example = example,
                UserId = request.UserId,
                DateAddedUtc = dateAddedUtc,
                UpdatedAtUtc = dateAddedUtc,
                Language = language
            };

            await context.VocabularyEntries.AddAsync(vocabularyEntry, ct);

            await context.SaveChangesAsync(ct);

            var vocabularyCountTrigger = new VocabularyCountTrigger { VocabularyEntriesCount = user.VocabularyEntries.Count };
            await achievementService.AssignAchievements(vocabularyCountTrigger, user.Id, ct);

            return new CreateVocabularyEntryResult.TranslationSuccess(
                definition,
                additionalInfo,
                example,
                entryId);
        }

        private static bool IsContainsEmoji(string input)
        {
            string emojiPattern = @"\p{Cs}";
            return Regex.IsMatch(input, emojiPattern);
        }

        private async Task<User> GetUser(TranslateAndCreateVocabularyEntry request, CancellationToken ct)
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