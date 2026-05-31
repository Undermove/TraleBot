using Infrastructure.Telegram;
using Infrastructure.Telegram.Services;
using DomainUser = Domain.Entities.User;
using Moq;
using Shouldly;
using Telegram.Bot;
using Telegram.Bot.Exceptions;
using Telegram.Bot.Types;
using Telegram.Bot.Types.ReplyMarkups;
using TgRequest = Telegram.Bot.Requests.Abstractions.IRequest<Telegram.Bot.Types.Message>;

namespace Infrastructure.UnitTests.Telegram;

[TestFixture]
public class TelegramNotificationServiceTests
{
    private Mock<ITelegramBotClient> _mockClient = null!;
    private BotConfiguration _config = null!;

    [SetUp]
    public void SetUp()
    {
        _mockClient = new Mock<ITelegramBotClient>();
        _mockClient
            .Setup(c => c.MakeRequestAsync(It.IsAny<TgRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Message { MessageId = 1 });

        _config = new BotConfiguration
        {
            BotName = "testbot",
            Token = "test-token",
            HostAddress = "https://example.com",
            WebhookToken = "wh-token",
            PaymentProviderToken = "pay-token",
            MiniAppEnabled = true
        };
    }

    private TelegramNotificationService BuildSut() =>
        new(_mockClient.Object, _config);

    private static DomainUser BuildUser(long telegramId = 12345L) => new()
    {
        Id = Guid.NewGuid(),
        TelegramId = telegramId,
        IsActive = true,
        InitialLanguageSet = true,
        RegisteredAtUtc = DateTime.UtcNow.AddDays(-7)
    };

    [Test]
    public async Task SendDailyReturnPushAsync_MessageContainsCorrectDeepLinkUrl()
    {
        InlineKeyboardMarkup? capturedMarkup = null;
        _mockClient.Reset();
        _mockClient
            .Setup(c => c.MakeRequestAsync(It.IsAny<TgRequest>(), It.IsAny<CancellationToken>()))
            .Callback<TgRequest, CancellationToken>((req, _) =>
            {
                var markupProp = req.GetType().GetProperty("ReplyMarkup");
                capturedMarkup = markupProp?.GetValue(req) as InlineKeyboardMarkup;
            })
            .ReturnsAsync(new Message { MessageId = 1 });

        var user = BuildUser();
        var sut = BuildSut();

        await sut.SendDailyReturnPushAsync(user, "alphabet-progressive", 4, "A", CancellationToken.None);

        capturedMarkup.ShouldNotBeNull();
        var button = capturedMarkup!.InlineKeyboard.First().First();
        button.WebApp.ShouldNotBeNull();
        button.WebApp!.Url.ShouldContain("?moduleId=alphabet-progressive&lessonId=4");
    }

    [Test]
    public async Task SendDailyReturnPushAsync_On403_SetsUserIsActiveFalse()
    {
        _mockClient.Reset();
        _mockClient
            .Setup(c => c.MakeRequestAsync(It.IsAny<TgRequest>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new ApiRequestException("Forbidden: bot was blocked by the user", 403));

        var user = BuildUser();
        user.IsActive = true;
        var sut = BuildSut();

        await Should.NotThrowAsync(() =>
            sut.SendDailyReturnPushAsync(user, "alphabet-progressive", 4, "A", CancellationToken.None));

        user.IsActive.ShouldBe(false);
    }

    [Test]
    public async Task SendDailyReturnPushAsync_OnTooManyRequests_RetriesAfterDelay()
    {
        var callCount = 0;
        _mockClient.Reset();
        _mockClient
            .Setup(c => c.MakeRequestAsync(It.IsAny<TgRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() =>
            {
                callCount++;
                if (callCount == 1)
                    throw new ApiRequestException("Too Many Requests: retry after 0", 429,
                        new ResponseParameters { RetryAfter = 0 });
                return new Message { MessageId = 1 };
            });

        var user = BuildUser();
        var sut = BuildSut();

        await Should.NotThrowAsync(() =>
            sut.SendDailyReturnPushAsync(user, "alphabet-progressive", 4, "A", CancellationToken.None));

        callCount.ShouldBe(2);
    }

    [Test]
    public async Task SendDailyReturnPushAsync_MessageTextIsNonEmpty()
    {
        string? capturedText = null;
        _mockClient.Reset();
        _mockClient
            .Setup(c => c.MakeRequestAsync(It.IsAny<TgRequest>(), It.IsAny<CancellationToken>()))
            .Callback<TgRequest, CancellationToken>((req, _) =>
            {
                var textProp = req.GetType().GetProperty("Text");
                capturedText = textProp?.GetValue(req) as string;
            })
            .ReturnsAsync(new Message { MessageId = 1 });

        var user = BuildUser();
        var sut = BuildSut();

        await sut.SendDailyReturnPushAsync(user, "alphabet-progressive", 4, "A", CancellationToken.None);

        capturedText.ShouldNotBeNull();
        capturedText!.ShouldNotBeEmpty();
    }
}
