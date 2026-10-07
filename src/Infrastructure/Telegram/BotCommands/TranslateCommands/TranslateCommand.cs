using Application.Translation;
using Application.Translation.Pipeline;
using Infrastructure.Telegram.Models;

namespace Infrastructure.Telegram.BotCommands.TranslateCommands;

public class TranslateCommand(TranslationJobs jobs) : IBotCommand
{
    /// <summary>Sent when a verb is still being looked up after <see cref="TranslationAgentOptions.SlowReplyNoticeMs"/>.</summary>
    public const string LookingUpVerbText = "Ищу этот глагол, это может занять до минуты. Ответ пришлю сюда же.";

    /// <summary>
    /// Sent when there will be no answer: every start of the work failed, or the bot restarted while a
    /// translation was too young to be on record. The person is not left with «ищу…» only.
    /// </summary>
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
    /// глагол…»; the job sends the answer later by itself (<see cref="BotTranslationReply"/>), on
    /// another instance if this one does not live to do it.
    /// </summary>
    public async Task Execute(TelegramRequest request, CancellationToken token)
    {
        var userId = request.User?.Id ?? throw new ApplicationException("User not registered");
        // The reply may be written after this request and its DbContext are gone: what it reads from
        // the user (lazy-loaded) is loaded now.
        _ = request.User.Settings?.CurrentLanguage;

        var job = jobs.Start(userId, request.Text, services => BotTranslationReply.For(services, request));
        try
        {
            await Task.WhenAny(job.Completion, job.NoticeSent).WaitAsync(token);
        }
        catch (OperationCanceledException)
        {
            // Telegram closed the connection. The job goes on and answers.
        }
    }
}
