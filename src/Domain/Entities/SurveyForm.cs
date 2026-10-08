using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Domain.Entities;

/// <summary>
/// A survey as a form of several questions. The first question goes out in the bot's message with
/// its options as buttons — one tap is already an answer; the rest are filled in the mini-app,
/// one question per page. Stored on the campaign as JSON and never changed once the campaign
/// exists: answers refer to questions by <see cref="SurveyQuestion.Id"/> and to options by text.
/// </summary>
public class SurveyForm
{
    /// <summary>The caption and the stored answer of "my own answer" on a question with options.</summary>
    public const string OtherLabel = "Другое";

    /// <summary>A short line before the first question in the bot's message.</summary>
    public string? Intro { get; set; }

    public List<SurveyQuestion> Questions { get; set; } = [];

    /// <summary>The text of the bot's message: the intro and the first question.</summary>
    public string BotMessage() =>
        string.IsNullOrWhiteSpace(Intro) ? Questions[0].Text : $"{Intro}\n\n{Questions[0].Text}";

    /// <summary>Buttons under the bot's message: the first question's options, then "Другое" when it allows one.</summary>
    public IReadOnlyList<string> BotButtons() => Questions[0].Choices();

    public SurveyQuestion? Question(string? id) => Questions.FirstOrDefault(q => q.Id == id);

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    public string ToJson() => JsonSerializer.Serialize(this, Json);

    public static SurveyForm? FromJson(string? json) =>
        string.IsNullOrWhiteSpace(json) ? null : JsonSerializer.Deserialize<SurveyForm>(json, Json);
}

public class SurveyQuestion
{
    /// <summary>"q1", "q2"… by position — given by the server when the survey is created.</summary>
    public string Id { get; set; } = "";

    public string Text { get; set; } = "";

    public SurveyQuestionKind Kind { get; set; }

    /// <summary>For <see cref="SurveyQuestionKind.Choice"/>; empty for a free-text question.</summary>
    public List<string> Options { get; set; } = [];

    /// <summary>A question with options also offers "Другое" with a field for one's own words.</summary>
    public bool AllowOther { get; set; }

    /// <summary>
    /// The one number the owner reads this question for: the share of <see cref="HeadlineOption"/>
    /// among those who answered, not counting those who chose <see cref="HeadlineWithout"/>
    /// ("would be very disappointed" among people who still use the product). Null — no such number.
    /// </summary>
    public string? HeadlineOption { get; set; }

    public string? HeadlineWithout { get; set; }

    /// <summary>Everything a person can pick: the options and, when allowed, <see cref="SurveyForm.OtherLabel"/>.</summary>
    public IReadOnlyList<string> Choices() =>
        Kind == SurveyQuestionKind.Choice && AllowOther ? [.. Options, SurveyForm.OtherLabel] : Options;
}

public enum SurveyQuestionKind
{
    /// <summary>One of the options (and maybe "Другое").</summary>
    Choice = 0,
    /// <summary>Only a text field.</summary>
    Text = 1
}
