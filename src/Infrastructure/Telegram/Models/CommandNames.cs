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
    
    // georgian language learning commands
    public const string GeorgianLevelsMenu = "/georgianlevelsmenu";
    public const string GeorgianA1 = "/georgiaa1";
    public const string GeorgianA2 = "/georgiaa2";
    public const string GeorgianB1 = "/georgiab1";
    public const string GeorgianB2 = "/georgiab2";
    public const string GeorgianC1 = "/georgiac1";
}