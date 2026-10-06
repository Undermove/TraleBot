using System.Collections.Generic;
using System.Linq;
using Application.MiniApp.Commands;
using Infrastructure.Telegram.Services;
using Moq;
using Shouldly;
using global::Telegram.Bot;
using global::Telegram.Bot.Exceptions;
using global::Telegram.Bot.Types;
using global::Telegram.Bot.Types.ReplyMarkups;
using BotConfiguration = global::Infrastructure.Telegram.BotConfiguration;
using DomainUser = global::Domain.Entities.User;
using UserAccountType = global::Domain.Entities.UserAccountType;
using TgRequest = global::Telegram.Bot.Requests.Abstractions.IRequest<global::Telegram.Bot.Types.Message>;

namespace Infrastructure.UnitTests.Telegram;

/// <summary>The "your friend started" message: says what was granted and until when, opens the
/// mini-app, and a blocked bot does not break the caller.</summary>
[TestFixture]
public class ReferralBonusTextTests
{
    // 13 October 21:30 UTC is already 14 October in Tbilisi (UTC+4).
    private static readonly System.DateTime Until = new(2026, 10, 13, 21, 30, 0, System.DateTimeKind.Utc);

    private static DomainUser Referrer() => new()
    {
        Id = System.Guid.NewGuid(),
        TelegramId = 99300,
        IsActive = true,
        InitialLanguageSet = true,
        AccountType = UserAccountType.Free,
        RegisteredAtUtc = System.DateTime.UtcNow.AddDays(-200)
    };

    private static TelegramNotificationService Service(Mock<ITelegramBotClient> client, string host = "https://test.tralebot.com") =>
        new(client.Object, new BotConfiguration
        {
            BotName = "testbot", Token = "test_token", HostAddress = host,
            WebhookToken = "test_webhook", PaymentProviderToken = "test_payment", MiniAppEnabled = true
        });

    private static (Mock<ITelegramBotClient> client, List<TgRequest> sent) Client()
    {
        var mock = new Mock<ITelegramBotClient>();
        var sent = new List<TgRequest>();
        mock.Setup(c => c.MakeRequestAsync(It.IsAny<TgRequest>(), It.IsAny<System.Threading.CancellationToken>()))
            .Returns<TgRequest, System.Threading.CancellationToken>((req, _) =>
            {
                sent.Add(req);
                return System.Threading.Tasks.Task.FromResult(new Message { MessageId = 1 });
            });
        return (mock, sent);
    }

    private static string? Text(TgRequest req) => req.GetType().GetProperty("Text")?.GetValue(req) as string;

    [TestCase(ReferralBonusKind.FreeWeek, 7, "Твой друг начал заниматься — тебе открыта неделя, до 14 октября.")]
    [TestCase(ReferralBonusKind.TrialExtended, 7, "Твой друг начал заниматься — твой пробный период стал длиннее на 7 дней, до 14 октября.")]
    [TestCase(ReferralBonusKind.ProExtended, 14, "Твой друг начал заниматься — твоя подписка стала длиннее на 14 дней, до 14 октября.")]
    public async System.Threading.Tasks.Task SaysWhatWasGrantedAndUntilWhen(ReferralBonusKind bonus, int days, string expected)
    {
        var (client, sent) = Client();

        await Service(client).SendReferralBonusGrantedAsync(Referrer(), bonus, days, Until, default);

        Text(sent.Single()).ShouldBe(expected);
        var markup = sent.Single().GetType().GetProperty("ReplyMarkup")?.GetValue(sent.Single()) as InlineKeyboardMarkup;
        markup!.InlineKeyboard.Single().Single().WebApp!.Url.ShouldBe("https://test.tralebot.com/");
    }

    [Test]
    public async System.Threading.Tasks.Task Lifetime_HasNothingToAnnounce()
    {
        var (client, sent) = Client();

        await Service(client).SendReferralBonusGrantedAsync(Referrer(), ReferralBonusKind.None, 0, Until, default);

        sent.ShouldBeEmpty();
    }

    [Test]
    public async System.Threading.Tasks.Task NoHost_SendsTheTextWithoutAButton()
    {
        var (client, sent) = Client();

        await Service(client, host: "").SendReferralBonusGrantedAsync(Referrer(), ReferralBonusKind.FreeWeek, 7, Until, default);

        sent.Single().GetType().GetProperty("ReplyMarkup")?.GetValue(sent.Single()).ShouldBeNull();
    }

    [Test]
    public async System.Threading.Tasks.Task BlockedBot_FlagsTheUserInactiveAndDoesNotThrow()
    {
        var client = new Mock<ITelegramBotClient>();
        client.Setup(c => c.MakeRequestAsync(It.IsAny<TgRequest>(), It.IsAny<System.Threading.CancellationToken>()))
            .ThrowsAsync(new ApiRequestException("Forbidden: bot was blocked by the user", 403));
        var referrer = Referrer();

        await Service(client).SendReferralBonusGrantedAsync(referrer, ReferralBonusKind.FreeWeek, 7, Until, default);

        referrer.IsActive.ShouldBeFalse();
    }
}
