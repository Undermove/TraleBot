using System.Text.RegularExpressions;
using Application.Achievements.Services.Triggers;
using Application.Common;
using Application.Common.Extensions;
using Application.Common.Interfaces.Achievements;
using Application.Common.Interfaces.TranslationService;
using Application.MiniApp.Commands;
using Application.Translation;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.VocabularyEntries.Commands.TranslateAndCreateVocabularyEntry;

public class TranslateAndCreateVocabularyEntry : IRequest<CreateVocabularyEntryResult>
{
    /// <summary>Threshold for the "vocab" referral activation trigger — referee must add at least
    /// this many words before the referrer gets credit. Higher than 1 to defeat trivial fraud
    /// (one-word "real engagement" was too easy to fake).</summary>
    public const int VocabActivationThreshold = 5;

    public required Guid UserId { get; init; }
    public required string Word { get; init; }

    public class Handler(
        ILanguageTranslator languageTranslator,
        ITraleDbContext context,
        IAchievementsService achievementService,
        TryActivateReferralService referralActivator)
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

            if (!user.IsActivePremium() && targetLanguage != user.Settings.CurrentLanguage)
            {
                return new CreateVocabularyEntryResult.PremiumRequired(
                    user.Settings.CurrentLanguage,
                    targetLanguage);
            }

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
                Word = request.Word.Trim().ToLowerInvariant(),
                Definition = definition.Trim().ToLowerInvariant(),
                AdditionalInfo = additionalInfo.ToLowerInvariant(),
                Example = example,
                UserId = request.UserId,
                DateAddedUtc = dateAddedUtc,
                UpdatedAtUtc = dateAddedUtc,
                Language = language
            };

            await context.VocabularyEntries.AddAsync(vocabularyEntry, ct);

            await context.SaveChangesAsync(ct);

            var newVocabCount = user.VocabularyEntries.Count + 1; // +1 for the entry just saved
            var vocabularyCountTrigger = new VocabularyCountTrigger { VocabularyEntriesCount = newVocabCount };
            await achievementService.AssignAchievements(vocabularyCountTrigger, user.Id, ct);

            // Activate referral on N-th vocab entry. We fire on every add past the threshold rather
            // than only at exactly N — TryActivateReferralService is idempotent (no-ops if already
            // activated), so duplicate calls are cheap and we don't lose activation if the first
            // attempt fails (e.g., still inside the 1-hour cooldown).
            if (newVocabCount >= VocabActivationThreshold)
            {
                await referralActivator.ExecuteAsync(request.UserId, "vocab_5", ct);
            }

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