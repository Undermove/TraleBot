namespace Application.UnitTests.DSL;

public static class Create
{
    public static UserBuilder User()
    {
        return new UserBuilder();
    }

    public static VocabularyEntryBuilder VocabularyEntry()
    {
        return new VocabularyEntryBuilder();
    }

    public static QuizBuilder Quiz()
    {
        return new QuizBuilder();
    }
}