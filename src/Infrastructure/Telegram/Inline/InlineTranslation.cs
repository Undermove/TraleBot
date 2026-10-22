using System.Text.RegularExpressions;
using Application.Common;
using Application.Common.Interfaces.TranslationService;
using Application.Translation;
using Application.Translation.Languages;
using Application.Translation.Pipeline;
using Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
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
    IServiceScopeFactory scopes,
    IMemoryCache memory,
    ITraleDbContext db,
    ITelegramBotClient client,
    BotConfiguration config,
    ILogger<InlineTranslation> logger)
{
    /// <summary>The ?start= of every link out of an inline card: users who came this way are counted by it.</summary>
    public const string StartParameter = "inline";

    public const string ButtonText = "Учить грузинский в TraleBot";

    /// <summary>Above the (empty) list while a lookup is still running: what to do to see its answer.</summary>
    public const string PendingButtonText = "Перевожу… добавь пробел через пару секунд";

    /// <summary>
    /// Telegram drops an answer to an inline query after a few seconds («query is too old»). A lookup
    /// that takes longer is not stopped: it finishes into <see cref="Done"/>, and the same text asked
    /// again is answered from there at once. A phrase goes through three models and takes about 10 s.
    /// </summary>
    private static readonly TimeSpan AnswerWithin = TimeSpan.FromSeconds(4);

    /// <summary>
    /// How long a looked-up text is kept here. The pipeline's own cache keeps words, not the model's
    /// unconfirmed phrases — those would otherwise be looked up anew on every query.
    /// </summary>
    private static readonly TimeSpan Done = TimeSpan.FromHours(1);

    /// <summary>A lookup left running has this long to finish; model steps have their own, shorter timeouts.</summary>
    private static readonly TimeSpan LookupAtMost = TimeSpan.FromMinutes(3);

    /// <summary>
    /// What an empty «@bot » offers: the phrases a newcomer needs first. The Georgian is checked by hand;
    /// the transcription is computed like everywhere else.
    /// </summary>
    public static readonly (string Georgian, string Russian)[] Starters =
    [
        ("მადლობა", "спасибо"),
        ("გამარჯობა", "здравствуйте"),
        ("გთხოვთ", "пожалуйста (прошу)"),
        ("ბოდიში", "извините"),
        ("რა ღირს?", "сколько стоит?"),
        ("ნახვამდის", "до свидания")
    ];

    private const int MaxLength = 100;

    /// <summary>
    /// How long Telegram may reuse an answer for the same text, for everybody — a translation does not
    /// depend on who asks. Short for "nothing found", so that a fixed translator is seen soon.
    /// </summary>
    private const int CacheSeconds = 3600;
    private const int NothingCacheSeconds = 1;

    [GeneratedRegex(@"[ა-ჿ]")]
    private static partial Regex GeorgianLetter();

    [GeneratedRegex(@"[а-яё]", RegexOptions.IgnoreCase)]
    private static partial Regex CyrillicLetter();

    public async Task AnswerAsync(InlineQuery query, CancellationToken ct)
    {
        var text = query.Query.Trim();
        InlineQueryResult[] results = [];
        var pending = false;
        try
        {
            (results, pending) = await CardsFor(text, query.From.Id, ct);
        }
        catch (Exception e) when (e is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            // Inline has no chat to say «something broke» in: the person sees no card and the button.
            logger.LogWarning(e, "Inline translation of {Text} failed", text);
        }

        logger.LogInformation("Inline query {Text}: {Count} card(s){Pending}", text, results.Length, pending ? ", still looking up" : "");
        try
        {
            await client.AnswerInlineQueryAsync(
                query.Id,
                results,
                cacheTime: results.Length > 0 ? CacheSeconds : NothingCacheSeconds,
                isPersonal: false,
                button: new InlineQueryResultsButton(pending ? PendingButtonText : ButtonText) { StartParameter = StartParameter },
                cancellationToken: ct);
        }
        catch (Exception e) when (e is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            // Usually «query is too old»: the person has typed on. A failed webhook would only make
            // Telegram send the same old query again.
            logger.LogWarning("Inline answer to {Text} not accepted: {Error}", text, e.Message);
        }
    }

    /// <summary>A card was sent to a chat (Telegram tells it when inline feedback is on in BotFather).</summary>
    public void Chosen(ChosenInlineResult chosen) =>
        logger.LogInformation("Inline card sent: {Text}", chosen.Query.Trim());

    /// <returns>The cards, and whether a lookup for the text is still running.</returns>
    private async Task<(InlineQueryResult[] Cards, bool Pending)> CardsFor(string text, long telegramId, CancellationToken ct)
    {
        if (text.Length == 0)
        {
            return (Starters.Select((p, i) => Card($"s{i}", p.Georgian, p.Russian)).ToArray<InlineQueryResult>(), false);
        }

        var isGeorgian = GeorgianLetter().IsMatch(text);
        if (text.Length < 2 || text.Length > MaxLength || !(isGeorgian || CyrillicLetter().IsMatch(text)))
        {
            return ([], false);
        }

        var lookup = await LookupOnce(text, telegramId, ct);
        if (await Task.WhenAny(lookup, Task.Delay(AnswerWithin, ct)) != lookup)
        {
            logger.LogInformation("Inline translation of {Text} did not finish in {Seconds} s, left to finish",
                text, AnswerWithin.TotalSeconds);
            return ([], true);
        }

        if (await lookup is not TranslationResult.Success success || string.IsNullOrWhiteSpace(success.Definition))
        {
            return ([], false);
        }

        var georgian = isGeorgian ? text : success.Definition.Trim();
        var russian = isGeorgian ? success.Definition.Trim() : text;
        return ([Card("t", georgian, russian)], false);
    }

    /// <summary>
    /// One lookup per text on this instance: a query for a text already being looked up waits for that
    /// lookup, and a finished one is answered from memory for <see cref="Done"/>. A failed lookup is
    /// forgotten at once, so that the next query tries again.
    /// </summary>
    private async Task<Task<TranslationResult>> LookupOnce(string text, long telegramId, CancellationToken ct)
    {
        var key = "inline:" + text.ToLowerInvariant();
        if (memory.TryGetValue(key, out Task<TranslationResult>? known) && known != null)
        {
            return known;
        }

        var userId = await db.Users.Where(u => u.TelegramId == telegramId).Select(u => (Guid?)u.Id).FirstOrDefaultAsync(ct);
        var lookup = Lookup(text, userId);
        memory.Set(key, lookup, Done);
        _ = lookup.ContinueWith(t =>
        {
            if (t.Result is not TranslationResult.Success)
            {
                memory.Remove(key);
            }
        }, TaskScheduler.Default);
        return lookup;
    }

    /// <summary>The lookup in a scope of its own, not tied to the webhook request: when the answer is late it still finishes.</summary>
    private Task<TranslationResult> Lookup(string text, Guid? userId) => Task.Run(async () =>
    {
        using var scope = scopes.CreateScope();
        // The per-user caps on model calls: a registered person spends their own; anybody else, the overall ones.
        scope.ServiceProvider.GetRequiredService<TranslationRequester>().UserId = userId;
        using var atMost = new CancellationTokenSource(LookupAtMost);
        try
        {
            return await scope.ServiceProvider.GetRequiredService<ILanguageTranslator>().Translate(text, Language.Georgian, atMost.Token);
        }
        catch (Exception e)
        {
            logger.LogWarning(e, "Inline translation of {Text} failed", text);
            return new TranslationResult.Failure();
        }
    });

    private InlineQueryResultArticle Card(string id, string georgian, string russian)
    {
        var transcription = GeorgianTranscriptionExtension.GetTranscription(georgian);
        return new InlineQueryResultArticle(
            id: id,
            title: $"{georgian} [{transcription}]",
            inputMessageContent: new InputTextMessageContent($"{georgian} [{transcription}] — {russian}"))
        {
            Description = russian,
            ReplyMarkup = new InlineKeyboardMarkup(
                InlineKeyboardButton.WithUrl(ButtonText, $"https://t.me/{config.BotName}?start={StartParameter}"))
        };
    }
}
