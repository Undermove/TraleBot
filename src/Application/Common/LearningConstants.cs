namespace Application.Common;

public static class LearningConstants
{
    public static class XpRewards
    {
        public const int PerfectFirstAttempt = 20;
        public const int PerfectRepeat = 10;
        public const int IncompleteFirstAttempt = 0;
        public const int IncompleteRepeat = 5;
    }

    public static class Quiz
    {
        public const int MaxVocabularyQuestions = 15;
        public const int QuestionsPerLesson = 12;
    }

    public static class Vocabulary
    {
        public const int MaxWordLength = 40;
    }

    public static class Levels
    {
        public const string Beginner = "beginner";
        public const string Intermediate = "intermediate";
    }
}
