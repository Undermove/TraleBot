using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using Application.Common.Interfaces;
using Infrastructure.Telegram.Services;
using Microsoft.Extensions.Logging.Abstractions;
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

/// <summary>
/// Covers AC from QA test plan on #952:
/// - Scenario 1: WebApp button URL contains ?moduleId=&lessonId=
/// - 403 → user.IsActive = false, no rethrow
/// - 429 → retry after server-suggested delay
/// - Message text contains the module name
/// </summary>
[TestFixture]
public class TelegramNotificationServiceTests
{
    private const string TestHost = "https://test.tralebot.com";

    private static BotConfiguration BuildBotConfig() => new()
    {
        BotName = "testbot",
        Token = "test_token",
        HostAddress = TestHost,
        WebhookToken = "test_webhook",
        PaymentProviderToken = "test_payment",
        MiniAppEnabled = true
    };

    private static DomainUser BuildUser(long telegramId = 99100) => new()
    {
        Id = System.Guid.NewGuid(),
        TelegramId = telegramId,
        IsActive = true,
        InitialLanguageSet = true,
        AccountType = UserAccountType.Free,
        RegisteredAtUtc = System.DateTime.UtcNow.AddDays(-2)
    };

    private static (Mock<ITelegramBotClient> client, List<TgRequest> captured)
        BuildMockClient(System.Func<TgRequest, int, Message>? perCallResponder = null)
    {
        var mock = new Mock<ITelegramBotClient>();
        var captured = new List<TgRequest>();
        var calls = 0;
        mock
            .Setup(c => c.MakeRequestAsync(It.IsAny<TgRequest>(), It.IsAny<System.Threading.CancellationToken>()))
            .Returns<TgRequest, System.Threading.CancellationToken>((req, _) =>
            {
                captured.Add(req);
                calls++;
                if (perCallResponder is not null)
                    return System.Threading.Tasks.Task.FromResult(perCallResponder(req, calls));
                return System.Threading.Tasks.Task.FromResult(new Message { MessageId = calls });
            });
        return (mock, captured);
    }

    private static string? ReflectText(TgRequest req)
        => req.GetType().GetProperty("Text")?.GetValue(req) as string;

    private static InlineKeyboardMarkup? ReflectMarkup(TgRequest req)
        => req.GetType().GetProperty("ReplyMarkup")?.GetValue(req) as InlineKeyboardMarkup;

    [Test]
    public async Task SendDailyReturnPushAsync_MessageContainsCorrectDeepLinkUrl()
    {
        var (client, captured) = BuildMockClient();
        var service = new TelegramNotificationService(client.Object, BuildBotConfig(), NullLogger<TelegramNotificationService>.Instance);
        var user = BuildUser();

        await service.SendDailyReturnPushAsync(user, "Алфавит", "alphabet", 7, "A", default);

        captured.ShouldHaveSingleItem();
        var markup = ReflectMarkup(captured[0]);
        markup.ShouldNotBeNull();
        var button = markup.InlineKeyboard.SelectMany(r => r).Single();
        button.WebApp.ShouldNotBeNull();
        button.WebApp.Url.ShouldBe($"{TestHost}/?moduleId=alphabet&lessonId=7");
    }

    [Test]
    public async Task SendDailyReturnPushAsync_MessageTextContainsModuleName()
    {
        var (client, captured) = BuildMockClient();
        var service = new TelegramNotificationService(client.Object, BuildBotConfig(), NullLogger<TelegramNotificationService>.Instance);

        await service.SendDailyReturnPushAsync(BuildUser(), "Числа", "numbers", 3, "A", default);

        ReflectText(captured.Single()).ShouldNotBeNull().ShouldContain("Числа");
    }

    [Test]
    public async Task SendDailyReturnPushAsync_OnVariantA_UsesVariantACopy()
    {
        var (client, captured) = BuildMockClient();
        var service = new TelegramNotificationService(client.Object, BuildBotConfig(), NullLogger<TelegramNotificationService>.Instance);

        await service.SendDailyReturnPushAsync(BuildUser(), "Падежи", "cases", 2, "A", default);

        var text = ReflectText(captured.Single());
        text.ShouldNotBeNull();
        text.ShouldContain("скучает");
    }

    [Test]
    public async Task SendDailyReturnPushAsync_OnVariantB_UsesVariantBCopy()
    {
        var (client, captured) = BuildMockClient();
        var service = new TelegramNotificationService(client.Object, BuildBotConfig(), NullLogger<TelegramNotificationService>.Instance);

        await service.SendDailyReturnPushAsync(BuildUser(), "Падежи", "cases", 2, "B", default);

        var text = ReflectText(captured.Single());
        text.ShouldNotBeNull();
        text.ShouldContain("ждёт продолжения");
    }

    [Test]
    public async Task SendDailyReturnPushAsync_On403_SetsUserIsActiveFalseAndDoesNotThrow()
    {
        var mock = new Mock<ITelegramBotClient>();
        mock
            .Setup(c => c.MakeRequestAsync(It.IsAny<TgRequest>(), It.IsAny<System.Threading.CancellationToken>()))
            .ThrowsAsync(new ApiRequestException("Forbidden: bot was blocked by the user", 403));
        var service = new TelegramNotificationService(mock.Object, BuildBotConfig(), NullLogger<TelegramNotificationService>.Instance);
        var user = BuildUser();

        await service.SendDailyReturnPushAsync(user, "Алфавит", "alphabet", 1, "A", default);

        user.IsActive.ShouldBeFalse();
    }

    [Test]
    public async Task SendDailyReturnPushAsync_OnTooManyRequests_RetriesAfterDelay()
    {
        var calls = 0;
        var mock = new Mock<ITelegramBotClient>();
        mock
            .Setup(c => c.MakeRequestAsync(It.IsAny<TgRequest>(), It.IsAny<System.Threading.CancellationToken>()))
            .Returns<TgRequest, System.Threading.CancellationToken>((_, _) =>
            {
                calls++;
                if (calls == 1)
                    throw new ApiRequestException(
                        "Too Many Requests: retry after 1",
                        429,
                        new ResponseParameters { RetryAfter = 1 });
                return System.Threading.Tasks.Task.FromResult(new Message { MessageId = calls });
            });
        var service = new TelegramNotificationService(mock.Object, BuildBotConfig(), NullLogger<TelegramNotificationService>.Instance);

        var sw = Stopwatch.StartNew();
        await service.SendDailyReturnPushAsync(BuildUser(), "Алфавит", "alphabet", 1, "A", default);
        sw.Stop();

        calls.ShouldBe(2);
        sw.Elapsed.ShouldBeGreaterThanOrEqualTo(System.TimeSpan.FromMilliseconds(900));
    }

    [Test]
    public async Task SendDailyReturnPushAsync_UsesWebAppButton_NotPlainUrlButton()
    {
        var (client, captured) = BuildMockClient();
        var service = new TelegramNotificationService(client.Object, BuildBotConfig(), NullLogger<TelegramNotificationService>.Instance);

        await service.SendDailyReturnPushAsync(BuildUser(), "Алфавит", "alphabet", 1, "A", default);

        var markup = ReflectMarkup(captured.Single());
        markup.ShouldNotBeNull();
        var button = markup.InlineKeyboard.SelectMany(r => r).Single();
        button.WebApp.ShouldNotBeNull();
        button.Url.ShouldBeNull(); // not a plain URL button
    }
}
