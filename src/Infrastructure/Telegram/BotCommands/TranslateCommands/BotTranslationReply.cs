using Application.Common;
using Application.Translation;
using Application.Verbs;
using Application.VocabularyEntries.Commands.TranslateAndCreateVocabularyEntry;
using Domain.Entities;
using Infrastructure.Telegram.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Telegram.Bot;
using Telegram.Bot.Types;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

/// <summary>
/// The bot's answer to a word sent to it (<see cref="TranslateCommand"/>), as <see cref="TranslationJobs"/>
/// sends it — from the run that started with the webhook request, or from a later one on any instance.
/// </summary>
public class BotTranslationReply(
    ITelegramBotClient client,
    BotConfiguration botConfig,
    VerbReplyHintQuery verbHints,
    ILogger<BotTranslationReply> logger,
    TelegramRequest request) : ITranslationReply
{
    public static BotTranslationReply For(IServiceProvider services, TelegramRequest request) => new(
        services.GetRequiredService<ITelegramBotClient>(),
        services.GetRequiredService<BotConfiguration>(),
        services.GetRequiredService<VerbReplyHintQuery>(),
        services.GetRequiredService<ILogger<BotTranslationReply>>(),
        request);

    public void Describe(QueuedTranslation queued)
    {
        queued.ChatId = request.UserTelegramId;
        queued.MessageId = request.MessageId;
    }

    public Task KeepTypingAsync(CancellationToken stop) => client.KeepTypingAsync(request.UserTelegramId, stop);

    public Task SendNoticeAsync(CancellationToken ct) => client.SendTextMessageAsync(
        request.UserTelegramId,
        TranslateCommand.LookingUpVerbText,
        replyToMessageId: request.MessageId,
        allowSendingWithoutReply: true,
        cancellationToken: ct);

    public async Task SendAnswerAsync(CreateVocabularyEntryResult result, bool late, CancellationToken ct)
    {
        var isOwner = botConfig.OwnerTelegramId != 0 && request.UserTelegramId == botConfig.OwnerTelegramId;
        var miniAppUrl = botConfig.MiniAppEnabled && !string.IsNullOrEmpty(botConfig.HostAddress)
            ? $"{botConfig.NormalizedHost()}/"
            : null;
        int? replyTo = late ? request.MessageId : null;

        // A known verb form in the word or in its translation gets a parse line and a button to the verb card.
        var verb = result switch
        {
            CreateVocabularyEntryResult.TranslationSuccess s => await verbHints.FindAsync([request.Text, s.Definition], ct),
            CreateVocabularyEntryResult.TranslationExists e => await verbHints.FindAsync([request.Text, e.Definition], ct),
            _ => null
        };

        await (result switch
        {
            CreateVocabularyEntryResult.TranslationSuccess success => client.SendTranslation(request, success.VocabularyEntryId, success.Definition, success.AdditionalInfo, success.Example, ct, isOwner, miniAppUrl, verb, replyTo),
            CreateVocabularyEntryResult.TranslationExists exists => client.SendExistedTranslation(request, exists.VocabularyEntryId, exists.Definition, exists.AdditionalInfo, exists.Example, ct, isOwner, miniAppUrl, verb, replyTo),
            CreateVocabularyEntryResult.EmojiDetected => client.HandleEmojiDetected(request, ct),
            CreateVocabularyEntryResult.PromptLengthExceeded => client.HandlePromptLengthExceeded(request, ct),
            CreateVocabularyEntryResult.TranslationFailure => client.HandleFailure(request, ct),
            CreateVocabularyEntryResult.NotTranslatable => client.HandleNotTranslatable(request, ct),
            CreateVocabularyEntryResult.PremiumRequired premiumRequired => client.HandlePremiumRequired(request, request.User!.Settings.CurrentLanguage, premiumRequired.TargetLanguage, ct),
            CreateVocabularyEntryResult.SubscriptionRequired => client.HandleSubscriptionRequired(request, miniAppUrl, ct),
            _ => throw new ArgumentOutOfRangeException(nameof(result))
        });
    }

    public Task SendNotInTimeAsync(CancellationToken ct) =>
        client.SendTextMessageAsync(request.UserTelegramId, TranslateCommand.NotInTimeText, cancellationToken: ct);

    public async Task SendErrorAsync(Exception error, CancellationToken ct)
    {
        // Same words as TelegramDialogProcessor's: nobody else is there to say them once the request is gone.
        logger.LogError(error, "Exception while translating for user: {User} with command {Command}",
            request.UserTelegramId, request.Text);
        await client.SendTextMessageAsync(request.UserTelegramId, TelegramDialogProcessor.ErrorText, cancellationToken: ct);
    }
}

/// <summary>
/// <see cref="ITranslationReplies"/>: rebuilds the reply from the durable record, for a run that did not
/// see the webhook request (it was another instance's, or this one's before a restart).
/// </summary>
public class BotTranslationReplies : ITranslationReplies
{
    public async Task<ITranslationReply?> RestoreAsync(IServiceProvider services, QueuedTranslation queued, CancellationToken ct)
    {
        var db = services.GetRequiredService<ITraleDbContext>();
        var user = await db.Users.Include(u => u.Settings).FirstOrDefaultAsync(u => u.Id == queued.UserId, ct);
        if (user == null || queued.ChatId is not { } chatId)
        {
            return null;
        }

        // The request as the webhook would have built it: the same message, from the same person.
        var update = new Update
        {
            Message = new Message
            {
                MessageId = queued.MessageId ?? 0,
                Text = queued.Word,
                Chat = new Chat { Id = chatId, FirstName = string.Empty },
                From = new global::Telegram.Bot.Types.User { Id = chatId, FirstName = string.Empty }
            }
        };
        return BotTranslationReply.For(services, new TelegramRequest(update, user));
    }
}
