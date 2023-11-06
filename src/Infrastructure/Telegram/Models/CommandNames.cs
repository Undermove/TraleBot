namespace Infrastructure.Telegram.Models;

public static class CommandNames
{
    // common commands
    public const string Start = "/start";
    public const string Help = "/help";
    public const string HelpIcon = "🆘";
    public const string Menu = "/menu";
    public const string MenuIcon = "📋";
    public const string CloseMenu = "❌";
    
    // quiz commands
    public const string Quiz = "/quiz";
    public const string QuizIcon = "🎲";
    public const string StopQuiz = "/stopquiz";
    public const string StopQuizIcon = "🛑";
    public const string ShowExample = "/showexample";

    // vocabulary commands
    public const string RemoveEntry = "/removeentry";
    public const string TranslateManually = "-";
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
    public const string ChangeLanguage = "/changelanguage";
    public const string ChangeLanguageIcon = "🌐";
}