using System.Text.Json;

namespace Application.MiniApp;

/// <summary>
/// The tip sent once, right after a person's first finished lesson: pin the chat with the bot so it does not
/// sink among the others. Trigger <see cref="Source"/> never expires.
/// </summary>
public static class PinChatTip
{
    public const string Source = "pin_chat";

    public const string Text = """
        Первый урок пройден 👏 Закрепи этот чат, чтобы не потерять его среди других 📌

        • iPhone: в списке чатов смахни этот чат вправо и нажми «Закрепить»
        • Android: в списке чатов зажми этот чат и нажми на булавку сверху
        • Компьютер: нажми на чат правой кнопкой и выбери «Закрепить»

        Так следующий урок всегда будет под рукой.
        """;

    /// <summary>True when exactly one lesson is finished (the welcome scene is not a lesson).</summary>
    public static bool IsFirstLesson(string? completedLessonsJson)
    {
        try
        {
            var completed = JsonSerializer.Deserialize<Dictionary<string, List<int>>>(completedLessonsJson ?? "") ?? [];
            return completed.Where(kv => kv.Key != "onboarding").Sum(kv => kv.Value.Count) == 1;
        }
        catch { return false; }
    }
}
