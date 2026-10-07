using Application.Translation;
using Application.Translation.Pipeline;
using Application.Verbs;
using Application.VocabularyEntries.Commands.TranslateAndCreateVocabularyEntry;
using Infrastructure.Telegram.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Telegram.Bot;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

public class TranslateCommand(
    BotConfiguration botConfig,
    TranslationJobs jobs,
    IOptions<TranslationAgentOptions> options,
    ILogger<TranslateCommand> logger) : IBotCommand
{
    /// <summary>Sent when a verb is still being looked up after <see cref="TranslationAgentOptions.SlowReplyNoticeMs"/>.</summary>
    public const string LookingUpVerbText = "Ищу этот глагол, это может занять до минуты. Ответ пришлю сюда же.";

    /// <summary>Sent when the work was cut short (the bot is restarting): the person is not left with «ищу…» only.</summary>
    public const string NotInTimeText = "Не успел найти перевод. Пришли слово ещё раз через минуту.";

    public Task<bool> IsApplicable(TelegramRequest request, CancellationToken ct)
    {
        var commandPayload = request.Text;
        return Task.FromResult(!commandPayload.Contains("/"));
    }

    /// <summary>
    /// The translation and the reply run as a job of their own (<see cref="TranslationJobs"/>): a verb
    /// the models have to write takes up to a minute or two, longer than Telegram keeps the webhook
    /// connection, and its retry is dropped as a duplicate. This request waits for the reply — which is
    /// there at once for everything but such a verb — and leaves when the person has been told «ищу
    /// глагол…»; the job sends the answer later by itself.
    /// </summary>
    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var userId = request.User?.Id ?? throw new ApplicationException("User not registered");
        // The reply may be written after this request and its DbContext are gone: what it reads from
        // the user (lazy-loaded) is loaded now.
        _ = request.User.Settings?.CurrentLanguage;

        var noticeSent = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var job = jobs.Start(userId, request.Text, (services, running, ct) => Reply(services, request, running, noticeSent, ct));
        try
        {
            await Task.WhenAny(job.Completion, noticeSent.Task).WaitAsync(token);
        }
        catch (OperationCanceledException)
        {
            // Telegram closed the connection. The job goes on and answers.
        }
    }

    private async Task Reply(
        IServiceProvider services, TelegramRequest request, TranslationJob job, TaskCompletionSource noticeSent, CancellationToken token)
    {
        var client = services.GetRequiredService<ITelegramBotClient>();
        try
        {
            var isOwner = botConfig.OwnerTelegramId != 0 && request.UserTelegramId == botConfig.OwnerTelegramId;
            var miniAppUrl = botConfig.MiniAppEnabled && !string.IsNullOrEmpty(botConfig.HostAddress)
                ? $"{botConfig.NormalizedHost()}/"
                : null;

            // The chat shows «печатает…» from the first moment until the reply, so a slow step never
            // looks like silence. A verb that is still being looked up after a few seconds gets a
            // message saying so; everything else is answered before that and looks as it always did.
            CreateVocabularyEntryResult result;
            int? replyTo = null;
            using (var typing = CancellationTokenSource.CreateLinkedTokenSource(token))
            {
                var indicator = client.KeepTypingAsync(request.UserTelegramId, typing.Token);
                try
                {
                    var noticeDue = Task.WhenAll(
                        job.VerbLookupStarted, Task.Delay(Math.Max(0, options.Value.SlowReplyNoticeMs), typing.Token));
                    if (await Task.WhenAny(job.Translation, noticeDue) == noticeDue
                        && noticeDue.IsCompletedSuccessfully && !job.Translation.IsCompleted)
                    {
                        replyTo = request.MessageId;
                        try
                        {
                            await client.SendTextMessageAsync(
                                request.UserTelegramId,
                                LookingUpVerbText,
                                replyToMessageId: replyTo,
                                allowSendingWithoutReply: true,
                                cancellationToken: token);
                        }
                        catch (Exception) when (!token.IsCancellationRequested)
                        {
                            // The notice is a courtesy: the answer itself must still be sent.
                        }

                        noticeSent.TrySetResult();
                    }

                    result = await job.Translation;
                }
                finally
                {
                    typing.Cancel();
                    await indicator;
                }
            }

            // A known verb form in the word or in its translation gets a parse line and a button to the verb card.
            var verbHints = services.GetRequiredService<VerbReplyHintQuery>();
            var verb = result switch
            {
                CreateVocabularyEntryResult.TranslationSuccess s => await verbHints.FindAsync([request.Text, s.Definition], token),
                CreateVocabularyEntryResult.TranslationExists e => await verbHints.FindAsync([request.Text, e.Definition], token),
                _ => null
            };

            await (result switch
            {
                CreateVocabularyEntryResult.TranslationSuccess success => client.SendTranslation(request, success.VocabularyEntryId, success.Definition, success.AdditionalInfo, success.Example, token, isOwner, miniAppUrl, verb, replyTo),
                CreateVocabularyEntryResult.TranslationExists exists => client.SendExistedTranslation(request, exists.VocabularyEntryId, exists.Definition, exists.AdditionalInfo, exists.Example, token, isOwner, miniAppUrl, verb, replyTo),
                CreateVocabularyEntryResult.EmojiDetected => client.HandleEmojiDetected(request, token),
                CreateVocabularyEntryResult.PromptLengthExceeded => client.HandlePromptLengthExceeded(request, token),
                CreateVocabularyEntryResult.TranslationFailure => client.HandleFailure(request, token),
                CreateVocabularyEntryResult.NotTranslatable => client.HandleNotTranslatable(request, token),
                CreateVocabularyEntryResult.PremiumRequired premiumRequired => client.HandlePremiumRequired(request, request.User!.Settings.CurrentLanguage, premiumRequired.TargetLanguage, token),
                CreateVocabularyEntryResult.SubscriptionRequired => client.HandleSubscriptionRequired(request, miniAppUrl, token),
                _ => throw new ArgumentOutOfRangeException(nameof(result))
            });
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested)
        {
            // The application is stopping (or the job hit its time limit): the request that could have
            // reported it is long gone, so the person is told here.
            using var farewell = new CancellationTokenSource(TimeSpan.FromSeconds(5));
            await client.SendTextMessageAsync(request.UserTelegramId, NotInTimeText, cancellationToken: farewell.Token);
        }
        catch (Exception e)
        {
            // Same words as TelegramDialogProcessor's: nobody else is there to say them once the request is gone.
            logger.LogError(e, "Exception while translating for user: {User} with command {Command}",
                request.UserTelegramId, request.Text);
            await client.SendTextMessageAsync(request.UserTelegramId, TelegramDialogProcessor.ErrorText, cancellationToken: token);
        }
    }
}
