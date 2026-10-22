using System.Text.RegularExpressions;
using Application.Common;
using Application.Common.Interfaces.TranslationService;
using Application.Translation;
using Application.Translation.Languages;
using Application.Translation.Pipeline;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.InlineQueryResults;
using Telegram.Bot.Types.ReplyMarkups;

namespace Infrastructure.Telegram.Inline;

/// <summary>
/// The bot in inline mode: «@bot спасибо» in any chat offers a card «მადლობა [мадлоба] — спасибо» to
/// send there. Every sent card carries «via @bot» and a button into the bot — the people in that chat
/// see the bot, which is the point. Nothing is saved to anybody's dictionary.
/// </summary>
public partial class InlineTranslation(
    ILanguageTranslator translator,
    TranslationRequester requester,
    ITraleDbContext db,
    ITelegramBotClient client,
    BotConfiguration config,
    ILogger<InlineTranslation> logger)
{
    /// <summary>The ?start= of every link out of an inline card: users who came this way are counted by it.</summary>
    public const string StartParameter = "inline";

    public const string ButtonText = "Учить грузинский в TraleBot";

    /// <summary>A person types on: an answer later than this is for a query they have already left.</summary>
    private static readonly TimeSpan AnswerWithin = TimeSpan.FromSeconds(7);

    private const int MaxLength = 100;

    /// <summary>
    /// How long Telegram may reuse an answer for the same text, for everybody — a translation does not
    /// depend on who asks. Short for "nothing found", so that a fixed translator is seen soon.
    /// </summary>
    private const int CacheSeconds = 3600;
    private const int NothingCacheSeconds = 10;

    [GeneratedRegex(@"[ა-ჿ]")]
    private static partial Regex GeorgianLetter();

    [GeneratedRegex(@"[а-яё]", RegexOptions.IgnoreCase)]
    private static partial Regex CyrillicLetter();

    public async Task AnswerAsync(InlineQuery query, CancellationToken ct)
    {
        var text = query.Query.Trim();
        InlineQueryResult[] results = [];
        try
        {
            results = await CardsFor(text, query.From.Id, ct);
        }
        catch (Exception e) when (e is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            // Inline has no chat to say «something broke» in: the person sees no card and the button.
            logger.LogWarning(e, "Inline translation of {Text} failed", text);
        }

        logger.LogInformation("Inline query {Text}: {Count} card(s)", text, results.Length);
        await client.AnswerInlineQueryAsync(
            query.Id,
            results,
            cacheTime: results.Length > 0 ? CacheSeconds : NothingCacheSeconds,
            isPersonal: false,
            button: new InlineQueryResultsButton(ButtonText) { StartParameter = StartParameter },
            cancellationToken: ct);
    }

    /// <summary>A card was sent to a chat (Telegram tells it when inline feedback is on in BotFather).</summary>
    public void Chosen(ChosenInlineResult chosen) =>
        logger.LogInformation("Inline card sent: {Text}", chosen.Query.Trim());

    private async Task<InlineQueryResult[]> CardsFor(string text, long telegramId, CancellationToken ct)
    {
        var isGeorgian = GeorgianLetter().IsMatch(text);
        if (text.Length < 2 || text.Length > MaxLength || !(isGeorgian || CyrillicLetter().IsMatch(text)))
        {
            return [];
        }

        // The per-user caps on model calls: a registered person spends their own; anybody else, the overall ones.
        requester.UserId = await db.Users.Where(u => u.TelegramId == telegramId).Select(u => (Guid?)u.Id).FirstOrDefaultAsync(ct);

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(AnswerWithin);
        TranslationResult result;
        try
        {
            result = await translator.Translate(text, Language.Georgian, timeout.Token);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            logger.LogInformation("Inline translation of {Text} did not finish in {Seconds} s", text, AnswerWithin.TotalSeconds);
            return [];
        }

        if (result is not TranslationResult.Success success || string.IsNullOrWhiteSpace(success.Definition))
        {
            return [];
        }

        var georgian = isGeorgian ? text : success.Definition.Trim();
        var russian = isGeorgian ? success.Definition.Trim() : text;
        var line = $"{georgian} [{GeorgianTranscriptionExtension.GetTranscription(georgian)}] — {russian}";

        return
        [
            new InlineQueryResultArticle(
                id: "t",
                title: $"{georgian} [{GeorgianTranscriptionExtension.GetTranscription(georgian)}]",
                inputMessageContent: new InputTextMessageContent(line))
            {
                Description = russian,
                ReplyMarkup = new InlineKeyboardMarkup(
                    InlineKeyboardButton.WithUrl(ButtonText, $"https://t.me/{config.BotName}?start={StartParameter}"))
            }
        ];
    }
}
