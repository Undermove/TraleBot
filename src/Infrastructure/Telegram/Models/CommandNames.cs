namespace Infrastructure.Telegram.Models;

public static class CommandNames
{
    // common commands
    public const string Start = "/start";
    public const string Stop = "/stopbot";
    public const string Help = "/help";
    public const string HelpIcon = "🆘";
    public const string Menu = "/menu";
    public const string MenuIcon = "📋";
    public const string CloseMenu = "❌";
    public const string HowTo = "/howto";
    public const string HowToIcon = "📌";
    
    // quiz commands
    public const string Quiz = "/quiz";
    public const string QuizIcon = "🎲";
    public const string StopQuiz = "/stopquiz";
    public const string StopQuizIcon = "🛑";
    public const string ShowExample = "/showexample";

    // vocabulary commands
    public const string RemoveEntry = "/removeentry";
    public const string TranslateManually = "-";
    public const string TranslateToAnotherLanguage = "/swaplang";
    public const string TranslateAndDeleteVocabulary = "/tradl";
    public const string Vocabulary = "/vocabulary";
    public const string VocabularyIcon = "📘";
    
    // payment commands
    public const string Pay = "/pay";
    public const string PayIcon = "💳";
    public const string RequestInvoice = "/requestinvoice";
    public const string OfferTrial = "/offertrial";
    public const string ActivateTrial = "/activatetrial";
    
    // achievements commands
    public const string Achievements = "/achievements";
    public const string AchievementsIcon = "📊";
    
    // language commands
    public const string ChangeTranslationLanguage = "/changetranslation";
    public const string ChangeTranslationLanguageIcon = "🌐";
    public const string ChangeCurrentLanguageMenu = "/changelanguagemenu";
    public const string ChangeCurrentLanguage = "/changelanguage";
    public const string ChangeCurrentLanguageAndDeleteVocabulary = "/chadl";
    public const string SetInitialLanguage = "/setinitiallanguage";
    
    // georgian language learning commands - repetition modules
    public const string GeorgianRepetitionModules = "/georgianrepetitionmodules";
    public const string GeorgianVerbsOfMovement = "/georgianverbsofmovement";
    public const string GeorgianPronouns = "/georgianpronouns";
    
    // Georgian verbs of movement lessons
    public const string GeorgianVerbsLesson1 = "/georgianverbslesson1";
    public const string GeorgianVerbsLesson2 = "/georgianverbslesson2";
    public const string GeorgianVerbsLesson3 = "/georgianverbslesson3";
    public const string GeorgianVerbsLesson4 = "/georgianverbslesson4";
    public const string GeorgianVerbsLesson5 = "/georgianverbslesson5";
    public const string GeorgianVerbsLesson6 = "/georgianverbslesson6";
    public const string GeorgianVerbsLesson7 = "/georgianverbslesson7";
    public const string GeorgianVerbsLesson8 = "/georgianverbslesson8";
    public const string GeorgianVerbsLesson9 = "/georgianverbslesson9";
    public const string GeorgianVerbsLesson10 = "/georgianverbslesson10";
    
    // Georgian verbs quiz commands
    public const string GeorgianVerbsQuizStart1 = "/georgianverbsquizstart1";
    public const string GeorgianVerbsQuizStart2 = "/georgianverbsquizstart2";
    public const string GeorgianVerbsQuizStart3 = "/georgianverbsquizstart3";
    public const string GeorgianVerbsQuizStart4 = "/georgianverbsquizstart4";
    public const string GeorgianVerbsQuizStart5 = "/georgianverbsquizstart5";
    public const string GeorgianVerbsQuizStart6 = "/georgianverbsquizstart6";
    public const string GeorgianVerbsQuizStart7 = "/georgianverbsquizstart7";
    public const string GeorgianVerbsQuizStart8 = "/georgianverbsquizstart8";
    public const string GeorgianVerbsQuizStart9 = "/georgianverbsquizstart9";
    public const string GeorgianVerbsQuizStart10 = "/georgianverbsquizstart10";
    public const string GeorgianVerbsQuizAnswer = "/georgianverbsquizanswer";
}