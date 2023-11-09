using System.Text.RegularExpressions;
using Application.Achievements.Services.Triggers;
using Application.Common;
using Application.Common.Interfaces.Achievements;
using Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using OneOf;

namespace Application.VocabularyEntries.Commands;

public class CreateManualTranslation : IRequest<OneOf<EntrySaved, EntryAlreadyExists, DefinitionIsNotSet, EmojiNotAllowed>>
{
    public Guid UserId { get; init; }
    public string? Word { get; init; }
    public string? Definition { get; init; }

    public class Handler : IRequestHandler<CreateManualTranslation, OneOf<EntrySaved, EntryAlreadyExists, DefinitionIsNotSet, EmojiNotAllowed>>
    {
        private readonly ITraleDbContext _context;
        private readonly IAchievementsService _achievementService;

        public Handler(ITraleDbContext context, IAchievementsService achievementService)
        {
            _context = context;
            _achievementService = achievementService;
        }

        public async Task<OneOf<EntrySaved, EntryAlreadyExists, DefinitionIsNotSet, EmojiNotAllowed>> Handle(CreateManualTranslation request, CancellationToken ct)
        {
            var user = await GetUser(request, ct);

            if (IsContainsEmoji(request.Word!))
            {
                return new EmojiNotAllowed();
            }
            
            var duplicate = await _context.VocabularyEntries
                .SingleOrDefaultAsync(entry => entry.UserId == request.UserId
                                               && entry.Language == user!.Settings.CurrentLanguage
                                               && entry.Word.Equals(request.Word), ct);
            
            if(duplicate != null)
            {
                return new EntryAlreadyExists(
                    duplicate.Definition, 
                    duplicate.AdditionalInfo,
                    duplicate.Id);
            }
            
            if (request.Definition == null)
            {
                return new DefinitionIsNotSet();
            }
            
            return await CreateManualVocabularyEntry(request, user, ct);
        }

        private async Task<EntrySaved> CreateManualVocabularyEntry(CreateManualTranslation request, User user,  CancellationToken ct)
        {
            var manualTranslationTrigger = new ManualTranslationTrigger();
            await _achievementService.AssignAchievements(manualTranslationTrigger, user.Id, ct);

            return await CreateVocabularyEntryResult(request, ct, request.Definition!, request.Definition!, user);
        }

        private async Task<EntrySaved> CreateVocabularyEntryResult(CreateManualTranslation request, CancellationToken ct,
            string definition, string additionalInfo, User user)
        {
            var entryId = Guid.NewGuid();
            var dateAddedUtc = DateTime.UtcNow;
            var vocabularyEntry = new VocabularyEntry
            {
                Id = entryId,
                Word = request.Word!.ToLowerInvariant(),
                Definition = definition.ToLowerInvariant(),
                AdditionalInfo = additionalInfo.ToLowerInvariant(),
                Example = "",
                UserId = request.UserId,
                DateAddedUtc = dateAddedUtc,
                UpdatedAtUtc = dateAddedUtc,
                Language = user.Settings.CurrentLanguage
            };

            await _context.VocabularyEntries.AddAsync(vocabularyEntry, ct);

            await _context.SaveChangesAsync(ct);

            var vocabularyCountTrigger = new VocabularyCountTrigger { VocabularyEntriesCount = user.VocabularyEntries.Count };
            await _achievementService.AssignAchievements(vocabularyCountTrigger, user.Id, ct);

            return new EntrySaved(
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
            var user = await _context.Users.FindAsync(keyValues: keyValues, cancellationToken: ct);
            if (user == null)
            {
                throw new ApplicationException($"User {request.UserId} not found");
            }

            await _context.Entry(user).Collection(nameof(user.VocabularyEntries)).LoadAsync(ct);
            await _context.Entry(user).Reference(nameof(user.Settings)).LoadAsync(ct);
            return user;
        }
    }
}

public record EntrySaved(
    string Definition,
    string AdditionalInfo,
    Guid VocabularyEntryId);

public record EntryAlreadyExists(
    string Definition,
    string AdditionalInfo,
    Guid VocabularyEntryId);

public record DefinitionIsNotSet;

public record EmojiNotAllowed;