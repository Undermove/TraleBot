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
    
    // georgian verb learning commands
    public const string StartVerbLearning = "/startverblearning";
    public const string StartVerbLearningIcon = "🎓";
    public const string VerbPrefixes = "/verbprefixes";
    public const string VerbPrefixesIcon = "🧠";
    public const string ReviewHardVerbs = "/reviewhardverbs";
    public const string ReviewHardVerbsIcon = "🔁";
    public const string VerbProgress = "/verbprogress";
    public const string VerbProgressIcon = "📈";
    public const string SubmitVerbAnswer = "/submitverbaswer";
    public const string NextVerbCard = "/nextverbcard";
    public const string NextVerbCardIcon = "▶️";
}