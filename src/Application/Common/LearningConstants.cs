namespace Application.Common;

public static class LearningConstants
{
    public static class XpRewards
    {
        public const int PerfectFirstAttempt = 20;
        public const int PerfectRepeat = 10;
        public const int IncompleteFirstAttempt = 0;
        public const int IncompleteRepeat = 5;
        public const int CorrectAnswer = 1;

        /// <summary>A finished 2–3 minute verb session: half of a perfect first lesson.</summary>
        public const int VerbSession = 10;

        /// <summary>Verb sessions that earn XP per UTC day; later ones still count as activity.</summary>
        public const int VerbSessionsPerDay = 5;
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

    public static class Modules
    {
        /// <summary>Until this module is finished a beginner is not asked to type Georgian.</summary>
        public const string Alphabet = "alphabet-progressive";
    }

    public static class Levels
    {
        public const string Beginner = "beginner";
        public const string Intermediate = "intermediate";
    }
}
