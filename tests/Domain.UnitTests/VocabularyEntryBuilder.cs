using System.Diagnostics.CodeAnalysis;
using Domain.Entities;

namespace Domain.UnitTests;

[SuppressMessage("ReSharper", "FieldCanBeMadeReadOnly.Local")]
public class VocabularyEntryBuilder
{
    private Guid _id = Guid.NewGuid();
    private DateTime _dateAddedUtc = DateTime.UtcNow;
    private DateTime _updatedAtUtc = DateTime.UtcNow;
    private string _word = "cat";
    private string _definition = "кошка";
    private string _example = "cat is a cat";
    private string _additionalInfo = "кошка это кошка";
    private int _successAnswersCount;
    private int _successAnswersCountInReverseDirection;
    private Language _language = Language.English;

    public VocabularyEntryBuilder WithWord(string word)
    {
        _word = word;
        return this;
    }

    public VocabularyEntryBuilder WithDefinition(string definition)
    {
        _definition = definition;
        return this;
    }

    public VocabularyEntryBuilder WithSuccessAnswersCount(int successAnswersCount)
    {
        _successAnswersCount = successAnswersCount;
        return this;
    }

    public VocabularyEntryBuilder WithSuccessAnswersCountInReverseDirection(int successAnswersCountInReverseDirection)
    {
        _successAnswersCountInReverseDirection = successAnswersCountInReverseDirection;
        return this;
    }

    public VocabularyEntry Build()
    {
        return new VocabularyEntry
        {
            Id = _id,
            Word = _word,
            Definition = _definition,
            Example = _example,
            AdditionalInfo = _additionalInfo,
            DateAddedUtc = _dateAddedUtc,
            UpdatedAtUtc = _updatedAtUtc,
            SuccessAnswersCount = _successAnswersCount,
            SuccessAnswersCountInReverseDirection = _successAnswersCountInReverseDirection,
            Language = _language
        };
    }
}