using System.Text.RegularExpressions;
using Application.Common;
using Application.Translation.Pipeline;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.InlineQueryResults;

namespace Infrastructure.Telegram.Inline;

/// <summary>
/// The bot in inline mode, for someone who writes with Georgians: «@bot xval movalt 5 saatze» in any
/// chat shows what the message says, «@bot буду в пять» gives the answer ready to send — in Georgian
/// letters or in Latin ones, the way Georgians chat. Each option is one plain text: what is sent is
/// exactly what the person would have typed. Nothing is saved to anybody's dictionary.
/// </summary>
public partial class InlineTranslation(
    IServiceScopeFactory scopes,
    IMemoryCache memory,
    ITraleDbContext db,
    ITelegramBotClient client,
    ILogger<InlineTranslation> logger)
{
    /// <summary>The ?start= of the button above the options: users who came this way are counted by it.</summary>
    public const string StartParameter = "inline";

    public const string ButtonText = "Учить грузинский в TraleBot";

    /// <summary>Above the (empty) list while a lookup is still running: what to do to see its answer.</summary>
    public const string PendingButtonText = "Перевожу… добавь пробел через пару секунд";

    public const string RussianTitle = "Перевод";
    public const string GeorgianTitle = "По-грузински";
    public const string GeorgianLettersTitle = "Грузинскими буквами";
    public const string LatinTitle = "Латиницей, как пишут грузины";

    /// <summary>
    /// Telegram drops an answer to an inline query after a few seconds («query is too old»). A lookup
    /// that takes longer is not stopped: it finishes into <see cref="Done"/>, and the same text asked
    /// again is answered from there at once. One model call takes about 2 s.
    /// </summary>
    private static readonly TimeSpan AnswerWithin = TimeSpan.FromSeconds(4);

    /// <summary>How long a looked-up text is kept here, so that typing on and back is not a model call each time.</summary>
    private static readonly TimeSpan Done = TimeSpan.FromHours(1);

    /// <summary>A lookup left running has this long to finish; model steps have their own, shorter timeouts.</summary>
    private static readonly TimeSpan LookupAtMost = TimeSpan.FromMinutes(1);

    private const int MaxLength = 250;

    /// <summary>
    /// How long Telegram may reuse an answer for the same text, for everybody — a translation does not
    /// depend on who asks. Next to nothing for "no options", so that a lookup still running is seen soon.
    /// </summary>
    private const int CacheSeconds = 3600;
    private const int NothingCacheSeconds = 1;

    [GeneratedRegex(@"[ა-ჿ]")]
    private static partial Regex GeorgianLetter();

    [GeneratedRegex(@"[а-яё]", RegexOptions.IgnoreCase)]
    private static partial Regex CyrillicLetter();

    [GeneratedRegex(@"[a-z]", RegexOptions.IgnoreCase)]
    private static partial Regex LatinLetter();

    public async Task AnswerAsync(InlineQuery query, CancellationToken ct)
    {
        var text = query.Query.Trim();
        InlineQueryResult[] results = [];
        var pending = false;
        try
        {
            (results, pending) = await OptionsFor(text, query.From.Id, ct);
        }
        catch (Exception e) when (e is not OperationCanceledException || !ct.IsCancellationRequested)
        {
            // Inline has no chat to say «something broke» in: the person sees no options and the button.
            logger.LogWarning(e, "Inline translation of {Text} failed", text);
        }

        logger.LogInformation("Inline query {Text}: {Count} option(s){Pending}", text, results.Length, pending ? ", still looking up" : "");
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

    /// <summary>An option was sent to a chat (Telegram tells it when inline feedback is on in BotFather).</summary>
    public void Chosen(ChosenInlineResult chosen) =>
        logger.LogInformation("Inline option {Option} sent for {Text}", chosen.ResultId, chosen.Query.Trim());

    /// <returns>The options, and whether a lookup for the text is still running.</returns>
    private async Task<(InlineQueryResult[] Options, bool Pending)> OptionsFor(string text, long telegramId, CancellationToken ct)
    {
        var hasGeorgian = GeorgianLetter().IsMatch(text);
        var hasCyrillic = CyrillicLetter().IsMatch(text);
        // Latin may be Georgian typed the way Georgians chat; only the model can tell it from English.
        var hasLatin = LatinLetter().IsMatch(text);
        if (text.Length < 2 || text.Length > MaxLength || !(hasGeorgian || hasCyrillic || hasLatin))
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

        if (await lookup is not { } t)
        {
            return ([], false);
        }

        // Only what differs from what was typed: a Russian text needs no Russian option, and so on.
        // A text in one script only is that script; a mixed one gets every option.
        var russianOnly = hasCyrillic && !hasGeorgian && !hasLatin;
        var georgianOnly = hasGeorgian && !hasCyrillic && !hasLatin;
        var latinOnly = hasLatin && !hasCyrillic && !hasGeorgian;
        var options = new List<InlineQueryResult>();
        if (!russianOnly && t.Russian != null)
        {
            options.Add(Option("ru", RussianTitle, t.Russian));
        }

        if (!georgianOnly && t.Georgian != null)
        {
            options.Add(Option("ka", russianOnly ? GeorgianTitle : GeorgianLettersTitle, t.Georgian));
        }

        if (!latinOnly && t.Latin != null)
        {
            options.Add(Option("lat", LatinTitle, t.Latin));
        }

        return (options.ToArray(), false);
    }

    /// <summary>
    /// One lookup per text on this instance: a query for a text already being looked up waits for that
    /// lookup, and a finished one is answered from memory for <see cref="Done"/>. A failed lookup is
    /// forgotten at once, so that the next query tries again.
    /// </summary>
    private async Task<Task<PhraseTranslation?>> LookupOnce(string text, long telegramId, CancellationToken ct)
    {
        var key = "inline:" + text.ToLowerInvariant();
        if (memory.TryGetValue(key, out Task<PhraseTranslation?>? known) && known != null)
        {
            return known;
        }

        var userId = await db.Users.Where(u => u.TelegramId == telegramId).Select(u => (Guid?)u.Id).FirstOrDefaultAsync(ct);
        var lookup = Lookup(text, userId);
        memory.Set(key, lookup, Done);
        _ = lookup.ContinueWith(l =>
        {
            if (l.Result == null)
            {
                memory.Remove(key);
            }
        }, TaskScheduler.Default);
        return lookup;
    }

    /// <summary>
    /// The lookup in a scope of its own, not tied to the webhook request: when the answer is late it
    /// still finishes. One fast model reads the message whole (<see cref="IPhraseTranslator"/>), with
    /// the content check running alongside.
    /// </summary>
    private Task<PhraseTranslation?> Lookup(string text, Guid? userId) => Task.Run<PhraseTranslation?>(async () =>
    {
        using var scope = scopes.CreateScope();
        var services = scope.ServiceProvider;
        // The per-user caps on model calls: a registered person spends their own; anybody else, the overall ones.
        services.GetRequiredService<TranslationRequester>().UserId = userId;
        using var atMost = new CancellationTokenSource(LookupAtMost);
        try
        {
            var phrases = services.GetRequiredService<IPhraseTranslator>();
            if (!phrases.IsAvailable || !await services.GetRequiredService<ModelBudget>().TrySpendAsync(ModelSpend.Request, atMost.Token))
            {
                return null;
            }

            var check = Refusal(services.GetRequiredService<IContentGuard>(), text, atMost.Token);
            var translation = await phrases.TranslateAsync(text, atMost.Token);
            if (await check is { } refusal)
            {
                logger.LogInformation("Inline translation of {Text} refused: {Refusal}", text, refusal);
                return null;
            }

            return translation is { Russian: null, Georgian: null, Latin: null } ? null : translation;
        }
        catch (Exception e)
        {
            logger.LogWarning(e, "Inline translation of {Text} failed", text);
            return null;
        }
    });

    /// <summary>The content check; a check that cannot be made lets the text through, as in the bot.</summary>
    private async Task<string?> Refusal(IContentGuard guard, string text, CancellationToken ct)
    {
        if (!guard.IsAvailable)
        {
            return null;
        }

        try
        {
            return (await guard.CheckAsync(text, ct)).Refusal;
        }
        catch (Exception e) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning("Inline content check of {Text} failed ({Error}); the text goes through", text, e.GetType().Name);
            return null;
        }
    }

    /// <summary>One option: the list shows what it is and the text; the chat gets the text alone.</summary>
    private static InlineQueryResultArticle Option(string id, string title, string text) =>
        new(id, title, new InputTextMessageContent(text)) { Description = text };
}
