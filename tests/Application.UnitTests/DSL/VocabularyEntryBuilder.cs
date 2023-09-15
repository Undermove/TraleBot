using Domain.Entities;

namespace Application.UnitTests.DSL;

public class VocabularyEntryBuilder
{
    private Guid _id = Guid.NewGuid();
    private User _user = Create.User().Build();
    private DateTime _dateAddedUtc = DateTime.UtcNow;
    private string _word = "cat";
    private string _definition = "кошка";
    private string _example = "cat is a cat";
    private string _additionalInfo = "кошка это кошка";
    
    public VocabularyEntryBuilder WithId(Guid id)
    {
        _id = id;
        return this;
    }
    
    public VocabularyEntryBuilder WithUser(User user)
    {
        _user = user;
        return this;
    }
    
    public VocabularyEntryBuilder WithDateAdded(DateTime dateAdded)
    {
        _dateAddedUtc = dateAdded;
        return this;
    }
    
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
    
    public VocabularyEntryBuilder WithExample(string example)
    {
        _example = example;
        return this;
    }
    
    public VocabularyEntryBuilder WithAdditionalInfo(string additionalInfo)
    {
        _additionalInfo = additionalInfo;
        return this;
    }
    
    public VocabularyEntry Build()
    {
        return new VocabularyEntry
        {
            Id = _id,
            User = _user,
            Word = _word,
            Definition = _definition,
            Example = _example,
            AdditionalInfo = _additionalInfo,
            DateAdded = _dateAddedUtc
        };
    }
}