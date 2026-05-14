using Domain.Entities;

namespace Application.VocabularyEntries.Commands.TranslateAndCreateVocabularyEntry;

public abstract record CreateVocabularyEntryResult
{
    public sealed record TranslationSuccess(
        string Definition,
        string AdditionalInfo,
        string Example,
        Guid VocabularyEntryId): CreateVocabularyEntryResult;

    public sealed record TranslationExists(
        string Definition,
        string AdditionalInfo,
        string Example,
        Guid VocabularyEntryId): CreateVocabularyEntryResult;

    public sealed record TranslationFailure: CreateVocabularyEntryResult;

    public sealed record PromptLengthExceeded: CreateVocabularyEntryResult;

    public sealed record EmojiDetected: CreateVocabularyEntryResult;

    public sealed record PremiumRequired(Language SourceLanguage, Language TargetLanguage) : CreateVocabularyEntryResult;

    /// <summary>User has neither active Pro nor an active trial — translation is gated.
    /// Distinct from PremiumRequired (which is the "multi-language" gate) — this one
    /// fires when the user has no entitlement at all.</summary>
    public sealed record SubscriptionRequired : CreateVocabularyEntryResult;
}
