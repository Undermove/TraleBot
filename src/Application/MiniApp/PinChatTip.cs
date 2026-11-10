using System.Text.Json;

namespace Application.MiniApp;

/// <summary>
/// The tip sent once, when a person has got into it — right after a newly finished lesson that makes
/// <see cref="MinLessons"/> or more: pin the chat with the bot so it does not sink among the others. The way
/// to pin is given for the Telegram client the person last opened the mini-app from. Trigger
/// <see cref="Source"/> never expires.
/// </summary>
public static class PinChatTip
{
    public const string Source = "pin_chat";
    public const int MinLessons = 3;

    private const string OnIphone = "в списке чатов смахни этот чат вправо и нажми «Закрепить»";
    private const string OnAndroid = "в списке чатов зажми этот чат и нажми на булавку сверху";
    private const string OnComputer = "нажми на этот чат правой кнопкой и выбери «Закрепить»";

    /// <param name="platform"><c>Telegram.WebApp.platform</c> of the person's last visit; null — unknown, all three ways are listed.</param>
    public static string Text(int lessonsDone, string? platform)
    {
        var how = platform switch
        {
            "ios" => $"Как закрепить на iPhone: {OnIphone}.",
            "android" or "android_x" => $"Как закрепить на Android: {OnAndroid}.",
            "tdesktop" or "macos" or "unigram" or "web" or "weba" or "webk" => $"Как закрепить: {OnComputer}.",
            _ => $"Как закрепить:\n• iPhone: {OnIphone}\n• Android: {OnAndroid}\n• Компьютер: {OnComputer}",
        };
        return $"""
            Уроков пройдено: {lessonsDone} 👏 Чтобы не искать Бомбору среди других чатов, закрепи этот чат 📌

            Он всегда будет наверху списка, и следующий урок откроется в одно касание.

            {how}
            """;
    }

    /// <summary>Finished lessons in all modules (the welcome scene is not a lesson).</summary>
    public static int LessonsDone(string? completedLessonsJson)
    {
        try
        {
            var completed = JsonSerializer.Deserialize<Dictionary<string, List<int>>>(completedLessonsJson ?? "") ?? [];
            return completed.Where(kv => kv.Key != "onboarding").Sum(kv => kv.Value.Count);
        }
        catch { return 0; }
    }
}
