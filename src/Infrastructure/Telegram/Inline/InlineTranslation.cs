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
/// see the bot, which is the point. A whole message is translated, not just a word — people write to
/// a landlord or a taxi driver — and Georgian typed in Latin letters («gamarjoba») is read too, the way
/// Georgians often answer. Nothing is saved to anybody's dictionary.
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
    /// again is answered from there at once. One phrase model call takes about 2 s.
    /// </summary>
    private static readonly TimeSpan AnswerWithin = TimeSpan.FromSeconds(4);

    /// <summary>
    /// How long a looked-up text is kept here, so that typing on and back is not a model call each time.
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

    private const int MaxLength = 250;

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

    [GeneratedRegex(@"[a-z]", RegexOptions.IgnoreCase)]
    private static partial Regex LatinLetter();

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
        var isRussian = !isGeorgian && CyrillicLetter().IsMatch(text);
        // Latin may be Georgian typed the way Georgians chat; only the model can tell it from English.
        var isLatin = !isGeorgian && !isRussian && LatinLetter().IsMatch(text);
        if (text.Length < 2 || text.Length > MaxLength || !(isGeorgian || isRussian || isLatin))
        {
            return ([], false);
        }

        var lookup = await LookupOnce(text, isRussian, telegramId, ct);
        if (await Task.WhenAny(lookup, Task.Delay(AnswerWithin, ct)) != lookup)
        {
            logger.LogInformation("Inline translation of {Text} did not finish in {Seconds} s, left to finish",
                text, AnswerWithin.TotalSeconds);
            return ([], true);
        }

        if (await lookup is not { Georgian: { } georgian, Russian: { } russian })
        {
            return ([], false);
        }

        return ([Card("t", georgian, russian)], false);
    }

    /// <summary>
    /// One lookup per text on this instance: a query for a text already being looked up waits for that
    /// lookup, and a finished one is answered from memory for <see cref="Done"/>. A failed lookup is
    /// forgotten at once, so that the next query tries again.
    /// </summary>
    private async Task<Task<PhraseTranslation?>> LookupOnce(string text, bool isRussian, long telegramId, CancellationToken ct)
    {
        var key = "inline:" + text.ToLowerInvariant();
        if (memory.TryGetValue(key, out Task<PhraseTranslation?>? known) && known != null)
        {
            return known;
        }

        var userId = await db.Users.Where(u => u.TelegramId == telegramId).Select(u => (Guid?)u.Id).FirstOrDefaultAsync(ct);
        var lookup = Lookup(text, isRussian, userId);
        memory.Set(key, lookup, Done);
        _ = lookup.ContinueWith(t =>
        {
            if (t.Result is not { Georgian: not null, Russian: not null })
            {
                memory.Remove(key);
            }
        }, TaskScheduler.Default);
        return lookup;
    }

    /// <summary>
    /// The lookup in a scope of its own, not tied to the webhook request: when the answer is late it
    /// still finishes. A message is translated whole by one fast model (<see cref="IPhraseTranslator"/>),
    /// with the content check running alongside; without that model, by the bot's translator.
    /// </summary>
    private Task<PhraseTranslation?> Lookup(string text, bool isRussian, Guid? userId) => Task.Run<PhraseTranslation?>(async () =>
    {
        using var scope = scopes.CreateScope();
        var services = scope.ServiceProvider;
        // The per-user caps on model calls: a registered person spends their own; anybody else, the overall ones.
        services.GetRequiredService<TranslationRequester>().UserId = userId;
        using var atMost = new CancellationTokenSource(LookupAtMost);
        try
        {
            var phrases = services.GetRequiredService<IPhraseTranslator>();
            if (!phrases.IsAvailable)
            {
                // The bot's translator: Russian and Georgian letters only, the other side in Definition.
                if (isRussian || GeorgianLetter().IsMatch(text))
                {
                    if (await services.GetRequiredService<ILanguageTranslator>().Translate(text, Language.Georgian, atMost.Token) is
                        TranslationResult.Success { Definition: var definition } && !string.IsNullOrWhiteSpace(definition))
                    {
                        return isRussian ? new PhraseTranslation(definition.Trim(), text) : new PhraseTranslation(text, definition.Trim());
                    }
                }

                return null;
            }

            if (!await services.GetRequiredService<ModelBudget>().TrySpendAsync(ModelSpend.Request, atMost.Token))
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

            // What was typed is kept as typed: only the side the model writes comes from it.
            return isRussian ? translation with { Russian = text }
                : GeorgianLetter().IsMatch(text) ? translation with { Georgian = text }
                : translation;
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
