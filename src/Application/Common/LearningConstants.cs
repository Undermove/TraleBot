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

        /// <summary>
        /// Уроки букв алфавита — id 1..11 (в них все 33 буквы). После каждого урока букв идут уроки слов
        /// с id 12 и дальше; «алфавит пройден» — значит пройдены все уроки букв.
        /// </summary>
        public const int AlphabetLetterLessons = 11;

        /// <summary>
        /// Mistakes a lesson check forgives. In the alphabet — the beginner's first lessons — one slip still
        /// passes the lesson: one wrong tap out of four was where newcomers dropped off. Elsewhere — none.
        /// The mini-app mirrors this rule (src/lessonPass.ts).
        /// </summary>
        public static int MistakesAllowed(string moduleId) => moduleId == Alphabet ? 1 : 0;

        public static bool LessonPassed(string moduleId, int correct, int total) =>
            total > 0 && correct <= total && correct >= total - MistakesAllowed(moduleId);
    }

    public static class Levels
    {
        public const string Beginner = "beginner";
        public const string Intermediate = "intermediate";
    }
}
