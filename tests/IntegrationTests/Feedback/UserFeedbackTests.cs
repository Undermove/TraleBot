using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Application.Common;
using Application.Feedback;
using Domain.Entities;
using FluentAssertions;
using Infrastructure.Telegram.BotCommands;
using IntegrationTests.DSL;
using IntegrationTests.Extensions;
using IntegrationTests.Fakes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Persistence;
using Telegram.Bot;
using Telegram.Bot.Requests;
using Telegram.Bot.Types;
using Telegram.Bot.Types.ReplyMarkups;
using User = Domain.Entities.User;

namespace IntegrationTests.Feedback;

/// <summary>
/// What people tell the owner — over HTTP and through the bot's webhook, against real Postgres:
/// "Что остановило?" after a paywall closed without a purchase (once in 30 days, counted by the
/// server), a survey broadcast with answer buttons (one answer per person per campaign), a free
/// message from the mini-app (length and frequency limits) — and what the owner then reads.
/// </summary>
public class UserFeedbackTests : TestBase
{
    private const long Owner = 4_200_000_001;
    private static readonly string[] Options = ["Дорого", "Пока не нужно", "Не понял, что получу"];
    private static long _nextTelegramId = 7_000_000_000;
    private static int _nextUpdateId = 700_000;

    private TraleTestApplication _app = null!;
    private TelegramClientFake _telegram = null!;

    [OneTimeSetUp]
    public void StartSignedApp()
    {
        _app = _testServer.WithSignedLogin(Owner);
        _telegram = (TelegramClientFake)_app.Services.GetRequiredService<ITelegramBotClient>();
    }

    [OneTimeTearDown]
    public async Task StopSignedApp() => await _app.DisposeAsync();

    [SetUp]
    public async Task CleanDatabase()
    {
        await InScope(sp => sp.GetRequiredService<TraleDbContext>().Database
            .ExecuteSqlRawAsync("""TRUNCATE "BroadcastCampaigns", "Referrals", "Users" CASCADE"""));
        await AddUser(5, u => u.TelegramId = Owner);
    }

    private async Task<T> InScope<T>(Func<IServiceProvider, Task<T>> action)
    {
        await using var scope = _app.Services.CreateAsyncScope();
        return await action(scope.ServiceProvider);
    }

    private Task<User> AddUser(int registeredDaysAgo, Action<User>? configure = null) => InScope(async sp =>
    {
        var db = sp.GetRequiredService<ITraleDbContext>();
        var user = Create.User(Interlocked.Increment(ref _nextTelegramId), "User");
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-registeredDaysAgo);
        configure?.Invoke(user);
        db.Users.Add(user);
        await db.SaveChangesAsync(CancellationToken.None);
        db.UsersSettings.Add(new UserSettings { Id = Guid.NewGuid(), UserId = user.Id, CurrentLanguage = Language.Georgian });
        await db.SaveChangesAsync(CancellationToken.None);
        return user;
    });

    private Task<User> AccessEnded() => AddUser(200);

    private Task<User> Paying() => AddUser(100, u =>
    {
        u.IsPro = true;
        u.SubscriptionPlan = SubscriptionPlan.Month;
        u.SubscribedUntil = DateTime.UtcNow.AddDays(9);
    });

    private Task<List<UserFeedback>> Rows(User user) => InScope(sp =>
        sp.GetRequiredService<ITraleDbContext>().UserFeedback.AsNoTracking()
            .Where(f => f.UserId == user.Id).OrderBy(f => f.CreatedAtUtc).ToListAsync());

    /// <summary>Makes everything the person has left so far that many days older.</summary>
    private Task<int> Age(User user, double days) => InScope(sp => sp.GetRequiredService<TraleDbContext>().Database
        .ExecuteSqlInterpolatedAsync(
            $"""UPDATE "UserFeedback" SET "CreatedAtUtc" = "CreatedAtUtc" - make_interval(secs => {days * 86400}) WHERE "UserId" = {user.Id}"""));

    private async Task<(HttpStatusCode Code, JsonElement Body)> Call(long telegramId, HttpMethod method, string path, object? body = null)
    {
        using var client = _app.ClientFor(telegramId);
        using var request = new HttpRequestMessage(method, path);
        if (body != null) request.Content = JsonContent.Create(body);
        var response = await client.SendAsync(request);
        var text = await response.Content.ReadAsStringAsync();
        return (response.StatusCode, text.Length == 0 ? default : JsonSerializer.Deserialize<JsonElement>(text));
    }

    private Task<(HttpStatusCode Code, JsonElement Body)> Admin(HttpMethod method, string path, object? body = null) =>
        Call(Owner, method, $"/api/admin/{path}", body);

    /// <summary>The paywall was closed without a purchase; the id of the question to show, or null.</summary>
    private async Task<Guid?> ClosePaywall(User user)
    {
        var (code, body) = await Call(user.TelegramId, HttpMethod.Post, "/api/miniapp/feedback/paywall-question");
        code.Should().Be(HttpStatusCode.OK);
        var show = body.GetProperty("show").GetBoolean();
        (body.GetProperty("id").ValueKind != JsonValueKind.Null).Should().Be(show);
        return show ? body.GetProperty("id").GetGuid() : null;
    }

    /// <summary>What the mini-app asks when the paywall opens: is there a question to show on close?</summary>
    private async Task<bool> QuestionDue(User user) =>
        (await Call(user.TelegramId, HttpMethod.Get, "/api/miniapp/feedback/paywall-question")).Body.GetProperty("due").GetBoolean();

    private async Task<HttpStatusCode> AnswerPaywall(User user, Guid? id, string? option, string? text = null) =>
        (await Call(user.TelegramId, HttpMethod.Post, "/api/miniapp/feedback/paywall-answer", new { id, option, text })).Code;

    private async Task<HttpStatusCode> Write(User user, string? text, string? campaign = null) =>
        (await Call(user.TelegramId, HttpMethod.Post, "/api/miniapp/feedback", new { text, campaign })).Code;

    // ── «Что остановило?» ────────────────────────────────────────────────────

    [Test]
    public async Task The_paywall_question_is_shown_once_in_thirty_days()
    {
        var person = await AccessEnded();

        var first = await ClosePaywall(person);
        var sameDay = await ClosePaywall(person);
        await Age(person, 29.9);
        var onDay29 = await ClosePaywall(person);
        await Age(person, 0.2);
        var onDay30 = await ClosePaywall(person);
        var rightAfter = await ClosePaywall(person);

        first.Should().NotBeNull();
        sameDay.Should().BeNull();
        onDay29.Should().BeNull();
        onDay30.Should().NotBeNull();
        onDay30!.Value.Should().NotBe(first!.Value);
        rightAfter.Should().BeNull();
        (await Rows(person)).Should().HaveCount(2).And.OnlyContain(r => r.Kind == UserFeedbackKind.PaywallDecline);
    }

    [Test]
    public async Task Opening_the_paywall_tells_whether_a_question_is_due_and_records_nothing()
    {
        var person = await AccessEnded();
        var paying = await Paying();

        var before = await QuestionDue(person);
        var beforeAgain = await QuestionDue(person);
        var rowsAfterAsking = await Rows(person);
        await ClosePaywall(person);
        var afterShown = await QuestionDue(person);
        await Age(person, 30.1);
        var monthLater = await QuestionDue(person);

        before.Should().BeTrue();
        beforeAgain.Should().BeTrue("asking is not showing");
        rowsAfterAsking.Should().BeEmpty();
        afterShown.Should().BeFalse();
        monthLater.Should().BeTrue();
        (await QuestionDue(paying)).Should().BeFalse();
    }

    [Test]
    public async Task A_question_closed_without_an_answer_still_counts_as_asked()
    {
        var person = await AccessEnded();

        (await ClosePaywall(person)).Should().NotBeNull();

        (await ClosePaywall(person)).Should().BeNull();
        var row = (await Rows(person)).Single();
        row.Option.Should().BeNull();
        row.Text.Should().BeNull();
    }

    [Test]
    public async Task Many_closes_at_once_show_the_question_once()
    {
        var person = await AccessEnded();

        var shown = await Task.WhenAll(Enumerable.Range(0, 12).Select(_ => ClosePaywall(person)));

        shown.Count(id => id != null).Should().Be(1);
        (await Rows(person)).Should().ContainSingle();
    }

    [Test]
    public async Task The_question_is_not_for_those_with_paid_access_but_is_for_a_trial_and_a_lapsed_subscription()
    {
        var paying = await Paying();
        var lifetime = await AddUser(100, u => { u.IsPro = true; u.SubscriptionPlan = SubscriptionPlan.Lifetime; });
        var onTrial = await AddUser(3);
        var lapsed = await AddUser(100, u => { u.IsPro = true; u.SubscriptionPlan = SubscriptionPlan.Month; u.SubscribedUntil = DateTime.UtcNow.AddDays(-9); });

        (await ClosePaywall(paying)).Should().BeNull();
        (await ClosePaywall(lifetime)).Should().BeNull();
        (await ClosePaywall(onTrial)).Should().NotBeNull();
        (await ClosePaywall(lapsed)).Should().NotBeNull();
        (await Rows(paying)).Should().BeEmpty();
        (await Rows(lifetime)).Should().BeEmpty();
    }

    [Test]
    public async Task The_answer_and_the_words_are_written_to_the_shown_question()
    {
        var person = await AccessEnded();
        var id = await ClosePaywall(person);

        var code = await AnswerPaywall(person, id, PaywallDeclineOptions.Expensive, "  Звёзды неудобно покупать  ");

        code.Should().Be(HttpStatusCode.OK);
        var row = (await Rows(person)).Single();
        row.Id.Should().Be(id!.Value);
        row.Option.Should().Be("expensive");
        row.Text.Should().Be("Звёзды неудобно покупать");
        row.UpdatedAtUtc.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(1));
    }

    [Test]
    public async Task An_answer_needs_a_known_option_and_fits_the_length_limit()
    {
        var person = await AccessEnded();
        var stranger = await AccessEnded();
        var id = await ClosePaywall(person);

        (await AnswerPaywall(person, id, "free_beer")).Should().Be(HttpStatusCode.BadRequest);
        (await AnswerPaywall(person, id, null, "без варианта")).Should().Be(HttpStatusCode.BadRequest);
        (await AnswerPaywall(person, id, PaywallDeclineOptions.Other, new string('я', UserFeedbackService.MaxTextLength + 1))).Should().Be(HttpStatusCode.BadRequest);
        (await AnswerPaywall(stranger, id, PaywallDeclineOptions.Other)).Should().Be(HttpStatusCode.NotFound, "the question was shown to another person");
        (await AnswerPaywall(person, Guid.NewGuid(), PaywallDeclineOptions.Other)).Should().Be(HttpStatusCode.NotFound);
        (await Rows(person)).Single().Option.Should().BeNull("nothing above was accepted");

        (await AnswerPaywall(person, id, PaywallDeclineOptions.Other, new string('я', UserFeedbackService.MaxTextLength))).Should().Be(HttpStatusCode.OK);
        (await AnswerPaywall(person, id, PaywallDeclineOptions.NotNow)).Should().Be(HttpStatusCode.OK);

        var row = (await Rows(person)).Single();
        row.Option.Should().Be("not_now", "answering again replaces the answer, it does not add a row");
        row.Text.Should().BeNull();
    }

    // ── «Написать автору» ────────────────────────────────────────────────────

    [Test]
    public async Task A_message_is_saved_trimmed_and_fits_the_length_limit()
    {
        var person = await AccessEnded();

        (await Write(person, "  Не хватает аудио в словаре \n")).Should().Be(HttpStatusCode.OK);
        (await Write(person, new string('я', UserFeedbackService.MaxTextLength))).Should().Be(HttpStatusCode.OK);
        (await Write(person, new string('я', UserFeedbackService.MaxTextLength + 1))).Should().Be(HttpStatusCode.BadRequest);
        (await Write(person, "   ")).Should().Be(HttpStatusCode.BadRequest);
        (await Write(person, null)).Should().Be(HttpStatusCode.BadRequest);

        var rows = await Rows(person);
        rows.Should().HaveCount(2).And.OnlyContain(r => r.Kind == UserFeedbackKind.Message && r.Option == null && r.CampaignKey == null);
        rows[0].Text.Should().Be("Не хватает аудио в словаре");
        rows[1].Text!.Length.Should().Be(UserFeedbackService.MaxTextLength);
    }

    [Test]
    public async Task No_more_than_five_messages_a_day_from_one_person()
    {
        var person = await AccessEnded();
        var another = await AccessEnded();

        for (var i = 0; i < UserFeedbackService.MaxMessagesPerDay; i++)
            (await Write(person, $"Сообщение {i}")).Should().Be(HttpStatusCode.OK);
        var overLimit = await Write(person, "Шестое");
        var fromAnother = await Write(another, "Чужой лимит меня не касается");
        await Age(person, 1.01);
        var nextDay = await Write(person, "На следующий день");

        overLimit.Should().Be(HttpStatusCode.TooManyRequests);
        fromAnother.Should().Be(HttpStatusCode.OK);
        nextDay.Should().Be(HttpStatusCode.OK);
        (await Rows(person)).Select(r => r.Text).Should().NotContain("Шестое").And.HaveCount(UserFeedbackService.MaxMessagesPerDay + 1);
    }

    [Test]
    public async Task Messages_sent_at_once_do_not_get_past_the_daily_limit()
    {
        var person = await AccessEnded();

        var codes = await Task.WhenAll(Enumerable.Range(0, 12).Select(i => Write(person, $"Сразу {i}")));

        codes.Count(c => c == HttpStatusCode.OK).Should().Be(UserFeedbackService.MaxMessagesPerDay);
        codes.Count(c => c == HttpStatusCode.TooManyRequests).Should().Be(12 - UserFeedbackService.MaxMessagesPerDay);
        (await Rows(person)).Should().HaveCount(UserFeedbackService.MaxMessagesPerDay);
    }

    [Test]
    public async Task Nobody_writes_without_signing_in()
    {
        using var anonymous = _app.CreateClient();

        (await anonymous.PostAsJsonAsync("/api/miniapp/feedback", new { text = "кто я" })).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await anonymous.PostAsync("/api/miniapp/feedback/paywall-question", null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await anonymous.PostAsJsonAsync("/api/miniapp/feedback/paywall-answer", new { id = Guid.NewGuid(), option = "other" })).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Опрос-рассылка ───────────────────────────────────────────────────────

    private static object Choice(string text, string[] options, bool allowOther = false) =>
        new { text, kind = "choice", options, allowOther };

    private static object Free(string text) => new { text, kind = "text" };

    private static object Form(params object[] questions) => new { intro = (string?)null, questions };

    /// <summary>A survey of one question with these options — what a survey was before it became a form;
    /// null or no options — an ordinary campaign.</summary>
    private Task<(HttpStatusCode Code, JsonElement Body)> Prepare(string key, string[]? surveyOptions, string audience = "accessEnded",
        string? buttonText = null, int giftDays = 0, string message = "Что мешает заниматься?") =>
        PrepareForm(key, surveyOptions is { Length: > 0 } ? Form(Choice(message, surveyOptions)) : null, audience, buttonText, giftDays, message);

    private Task<(HttpStatusCode Code, JsonElement Body)> PrepareForm(string key, object? survey, string audience = "accessEnded",
        string? buttonText = null, int giftDays = 0, string message = "Подарок") =>
        Admin(HttpMethod.Post, "campaigns/prepare", new
        {
            key, audience, message, buttonText, buttonQuery = (string?)null,
            sampleSize = (int?)null, dryRun = false, giftDays, survey
        });

    /// <summary>Picks everyone in the audience and sends a form — the people now hold its first question.</summary>
    private async Task LaunchForm(string key, object survey)
    {
        var (code, body) = await PrepareForm(key, survey);
        code.Should().Be(HttpStatusCode.OK, body.ValueKind == JsonValueKind.Undefined ? "" : body.GetRawText());
        (await Admin(HttpMethod.Post, $"campaigns/{key}/send", new { limit = 100 })).Code.Should().Be(HttpStatusCode.OK);
    }

    /// <summary>Picks everyone in the audience and sends — the people now hold the survey with its buttons.</summary>
    private async Task Launch(string key, string[]? surveyOptions = null)
    {
        var (code, body) = await Prepare(key, surveyOptions ?? Options);
        code.Should().Be(HttpStatusCode.OK, body.ValueKind == JsonValueKind.Undefined ? "" : body.GetRawText());
        (await Admin(HttpMethod.Post, $"campaigns/{key}/send", new { limit = 100 })).Code.Should().Be(HttpStatusCode.OK);
    }

    /// <summary>The person presses a button under a message — the update Telegram sends for it.</summary>
    private async Task Press(User user, string callbackData)
    {
        var from = new Telegram.Bot.Types.User { Id = user.TelegramId, IsBot = false, FirstName = "Test" };
        var update = new Update
        {
            Id = Interlocked.Increment(ref _nextUpdateId),
            CallbackQuery = new CallbackQuery
            {
                Id = Guid.NewGuid().ToString("N"), From = from, ChatInstance = "test", Data = callbackData,
                Message = new Message
                {
                    MessageId = 77, Date = DateTime.UtcNow,
                    Chat = new Chat { Id = user.TelegramId, Type = Telegram.Bot.Types.Enums.ChatType.Private, FirstName = "Test" }
                }
            }
        };
        using var client = _app.CreateClient();
        (await client.PostAsync("/telegram/test_token", update.ToJsonContent())).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    private Task Press(User user, string key, int option) => Press(user, SurveyAnswerCommand.CallbackData(key, option));

    private List<SendMessageRequest> SentTo(User user, int since) =>
        _telegram.Requests.Skip(since).OfType<SendMessageRequest>().Where(m => m.ChatId.Identifier == user.TelegramId).ToList();

    private List<AnswerCallbackQueryRequest> PressAnswers(int since) =>
        _telegram.Requests.Skip(since).OfType<AnswerCallbackQueryRequest>().ToList();

    [Test]
    public async Task A_survey_goes_out_with_its_options_as_buttons()
    {
        var person = await AccessEnded();
        var mark = _telegram.Requests.Count;

        await Launch("survey-buttons");

        var message = SentTo(person, mark).Single();
        message.Text.Should().Be("Что мешает заниматься?");
        var rows = ((InlineKeyboardMarkup)message.ReplyMarkup!).InlineKeyboard.Select(r => r.Single()).ToList();
        rows.Select(b => b.Text).Should().Equal(Options);
        rows.Select(b => b.CallbackData).Should().Equal(
            "/survey|survey-buttons|0", "/survey|survey-buttons|1", "/survey|survey-buttons|2");
        rows.Should().OnlyContain(b => b.WebApp == null);
        (await Rows(person)).Should().BeEmpty("sending records no answers");
    }

    [Test]
    public async Task A_press_records_the_answer_and_the_bot_thanks_with_a_way_to_tell_more()
    {
        var person = await AccessEnded();
        await Launch("survey-press");
        var mark = _telegram.Requests.Count;

        await Press(person, "survey-press", 1);

        var row = (await Rows(person)).Single();
        row.Kind.Should().Be(UserFeedbackKind.Survey);
        row.CampaignKey.Should().Be("survey-press");
        row.Option.Should().Be("Пока не нужно");
        row.Text.Should().BeNull();
        PressAnswers(mark).Single().Text.Should().Be("Спасибо, записал!");
        var thanks = SentTo(person, mark).Single();
        thanks.Text.Should().Be(SurveyAnswerCommand.ThanksText);
        var button = ((InlineKeyboardMarkup)thanks.ReplyMarkup!).InlineKeyboard.Single().Single();
        button.Text.Should().Be("Написать подробнее");
        button.WebApp!.Url.Should().Be($"{SignedMiniApp.Host}/?screen=feedback&fc=survey-press");
    }

    [Test]
    public async Task Another_button_changes_the_answer_instead_of_adding_one()
    {
        var person = await AccessEnded();
        await Launch("survey-change");
        await Press(person, "survey-change", 0);
        var firstRow = (await Rows(person)).Single();
        var mark = _telegram.Requests.Count;

        await Press(person, "survey-change", 2);
        await Press(person, "survey-change", 2);

        var row = (await Rows(person)).Single();
        row.Id.Should().Be(firstRow.Id);
        row.Option.Should().Be("Не понял, что получу");
        row.CreatedAtUtc.Should().Be(firstRow.CreatedAtUtc);
        row.UpdatedAtUtc.Should().NotBeNull();
        PressAnswers(mark).Select(a => a.Text).Should().Equal("Поменял ответ: «Не понял, что получу»", "Этот ответ уже записан");
        SentTo(person, mark).Should().BeEmpty("thanks are said once, on the first answer");
        var status = (await Admin(HttpMethod.Get, "campaigns/survey-change")).Body;
        status.GetProperty("surveyAnswers").EnumerateArray()
            .Select(a => (a.GetProperty("option").GetString(), a.GetProperty("count").GetInt32()))
            .Should().Equal(("Дорого", 0), ("Пока не нужно", 0), ("Не понял, что получу", 1));
    }

    [Test]
    public async Task Presses_at_once_leave_one_answer_and_one_thanks()
    {
        var person = await AccessEnded();
        await Launch("survey-race");
        var mark = _telegram.Requests.Count;

        await Task.WhenAll(Enumerable.Range(0, 12).Select(i => Press(person, "survey-race", i % Options.Length)));

        var row = (await Rows(person)).Single();
        Options.Should().Contain(row.Option);
        SentTo(person, mark).Should().ContainSingle();
        PressAnswers(mark).Should().HaveCount(12);
        PressAnswers(mark).Count(a => a.Text == "Спасибо, записал!").Should().Be(1);
    }

    [Test]
    public async Task Each_campaign_keeps_its_own_answer()
    {
        var person = await AccessEnded();
        await Launch("survey-one");
        await Launch("survey-two", ["Да", "Нет"]);

        await Press(person, "survey-one", 0);
        await Press(person, "survey-two", 1);

        (await Rows(person)).Select(r => (r.CampaignKey, r.Option)).Should().BeEquivalentTo(new[]
        {
            ("survey-one", "Дорого"), ("survey-two", "Нет")
        });
    }

    [Test]
    public async Task A_press_counts_only_from_a_recipient_and_only_for_a_real_option()
    {
        var recipient = await AccessEnded();
        await Launch("survey-closed");
        var cameLater = await AccessEnded(); // was not sent the survey — the message was forwarded to them
        await Prepare("no-buttons", null);
        await Admin(HttpMethod.Post, "campaigns/no-buttons/send", new { limit = 100 });
        var mark = _telegram.Requests.Count;

        await Press(cameLater, "survey-closed", 0);
        await Press(recipient, "survey-closed", 3);
        await Press(recipient, "survey-closed", -1);
        await Press(recipient, "/survey|survey-closed|x");
        await Press(recipient, "/survey|survey-closed");
        await Press(recipient, "no-such-campaign", 0);
        await Press(recipient, "no-buttons", 0);

        (await Rows(cameLater)).Should().BeEmpty();
        (await Rows(recipient)).Should().BeEmpty();
        PressAnswers(mark).Should().HaveCount(7).And.OnlyContain(a => a.Text == "Этот опрос уже закрыт");
        _telegram.Requests.Skip(mark).OfType<SendMessageRequest>().Should().BeEmpty();
    }

    [Test]
    public async Task Text_typed_in_the_chat_is_never_taken_as_an_answer_or_a_message_to_the_owner()
    {
        var person = await AccessEnded();
        await Launch("survey-text");
        await Press(person, "survey-text", 0);
        var command = await InScope(sp => Task.FromResult(sp.GetServices<Infrastructure.Telegram.Models.IBotCommand>().OfType<SurveyAnswerCommand>().Single()));

        // Whatever is typed after the answer — even the very text a button carries — is a message
        // like any other: the survey does not claim it, so it goes on to be translated as a word.
        foreach (var text in new[] { "მადლობა", "Слишком дорого, вот почему", "/survey|survey-text|2" })
        {
            var typed = new Infrastructure.Telegram.Models.TelegramRequest(
                Create.TelegramUpdate(Interlocked.Increment(ref _nextUpdateId), person.TelegramId, text), person);
            (await command.IsApplicable(typed, CancellationToken.None)).Should().BeFalse(text);
        }

        var row = (await Rows(person)).Single();
        row.Option.Should().Be("Дорого");
        row.Text.Should().BeNull();
    }

    [Test]
    public async Task Tell_more_ties_the_message_to_the_survey_and_keeps_the_pressed_answer()
    {
        var person = await AccessEnded();
        await Launch("survey-more");
        await Press(person, "survey-more", 0);

        (await Write(person, "Дорого для приложения, которым пользуюсь раз в неделю", "survey-more")).Should().Be(HttpStatusCode.OK);
        (await Write(person, "А это просто так", "no-such-campaign")).Should().Be(HttpStatusCode.OK);

        var rows = await Rows(person);
        rows.Should().HaveCount(3);
        rows.Single(r => r.Kind == UserFeedbackKind.Survey).Option.Should().Be("Дорого");
        var messages = rows.Where(r => r.Kind == UserFeedbackKind.Message).ToList();
        messages.Single(m => m.Text!.StartsWith("Дорого")).CampaignKey.Should().Be("survey-more");
        messages.Single(m => m.Text!.StartsWith("А это")).CampaignKey.Should().BeNull("a key of no campaign is dropped");
    }

    [TestCase(1, null, 0, TestName = "Survey_needs_at_least_two_options")]
    [TestCase(5, null, 0, TestName = "Survey_has_at_most_four_options")]
    [TestCase(3, "Открыть", 0, TestName = "Survey_cannot_carry_a_mini_app_button")]
    [TestCase(3, "Открыть", 3, TestName = "Survey_cannot_carry_a_gift")]
    public async Task Bad_survey_is_refused(int options, string? buttonText, int giftDays)
    {
        await AccessEnded();
        var mark = _telegram.Requests.Count;

        var (code, body) = await Prepare("bad-survey", Enumerable.Range(1, options).Select(i => $"Вариант {i}").ToArray(), buttonText: buttonText, giftDays: giftDays);

        code.Should().Be(HttpStatusCode.BadRequest);
        body.GetProperty("error").GetString().Should().NotBeNullOrEmpty();
        (await Admin(HttpMethod.Get, "campaigns/bad-survey")).Code.Should().Be(HttpStatusCode.NotFound);
        _telegram.Requests.Skip(mark).Should().BeEmpty();
    }

    [Test]
    public async Task Repeated_or_too_long_options_are_refused_and_blank_ones_are_dropped()
    {
        await AccessEnded();

        (await Prepare("dup", new[] { "Да", " Да " })).Code.Should().Be(HttpStatusCode.BadRequest);
        (await Prepare("long", new[] { "Да", new string('я', 65) })).Code.Should().Be(HttpStatusCode.BadRequest);
        (await Prepare("blank", new[] { "Да", "  ", "Нет", "" })).Code.Should().Be(HttpStatusCode.OK);

        var status = (await Admin(HttpMethod.Get, "campaigns/blank")).Body;
        status.GetProperty("surveyAnswers").EnumerateArray().Select(a => a.GetProperty("option").GetString()).Should().Equal("Да", "Нет");
    }

    [Test]
    public async Task Options_of_a_campaign_cannot_change_once_it_exists()
    {
        await AccessEnded();
        await Launch("survey-fixed");
        await Launch("plain-fixed", []);

        (await Prepare("survey-fixed", new[] { "Дорого", "Совсем другое" })).Code.Should().Be(HttpStatusCode.BadRequest);
        (await Prepare("survey-fixed", null)).Code.Should().Be(HttpStatusCode.BadRequest);
        (await Prepare("plain-fixed", Options)).Code.Should().Be(HttpStatusCode.BadRequest);
        (await Prepare("survey-fixed", Options)).Code.Should().Be(HttpStatusCode.OK, "the same options — the next part of the same survey");
    }

    [Test]
    public async Task An_ordinary_campaign_with_a_gift_works_as_before_next_to_a_survey()
    {
        var person = await AccessEnded();
        await Launch("survey-beside");
        var mark = _telegram.Requests.Count;

        var (code, _) = await Prepare("gift-beside", null, buttonText: "Открыть", giftDays: 3, message: "Подарок");
        await Admin(HttpMethod.Post, "campaigns/gift-beside/send", new { limit = 100 });
        var open = await Call(person.TelegramId, HttpMethod.Post, "/api/miniapp/campaign-open", new { key = "gift-beside" });
        var again = await Call(person.TelegramId, HttpMethod.Post, "/api/miniapp/campaign-open", new { key = "gift-beside" });

        code.Should().Be(HttpStatusCode.OK);
        var button = ((InlineKeyboardMarkup)SentTo(person, mark).Single().ReplyMarkup!).InlineKeyboard.Single().Single();
        button.Text.Should().Be("Открыть");
        button.CallbackData.Should().BeNull();
        button.WebApp!.Url.Should().Be($"{SignedMiniApp.Host}/?c=gift-beside");
        open.Body.GetProperty("gift").GetProperty("days").GetInt32().Should().Be(3);
        again.Body.GetProperty("gift").ValueKind.Should().Be(JsonValueKind.Null);
        var after = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Users.AsNoTracking().SingleAsync(u => u.Id == person.Id));
        after.BonusAccessUntilUtc.Should().BeCloseTo(DateTime.UtcNow.AddDays(3), TimeSpan.FromMinutes(2));
        var status = (await Admin(HttpMethod.Get, "campaigns/gift-beside")).Body;
        status.GetProperty("gifted").GetInt32().Should().Be(1);
        status.GetProperty("surveyAnswers").GetArrayLength().Should().Be(0);
        (await Rows(person)).Should().BeEmpty("opening an ordinary campaign's button is not feedback");
    }

    // ── Опрос-форма: первый вопрос в боте, остальные — по странице в мини-аппе ──

    private static readonly string[] IfGone = ["Очень расстроюсь", "Немного расстроюсь", "Мне всё равно", "Уже не пользуюсь"];
    private static readonly string[] IfGoneKeys = ["very", "somewhat", "indifferent", "unused"];
    private static readonly string[] WhatElse = ["Репетитор или курсы", "Другие приложения", "Только TraleBot"];

    /// <summary>q1 — in the bot, with a headline number; q2 — options and "Другое"; q3 — free text.</summary>
    private static object ThreeQuestions(string? intro = "Привет! Пара вопросов.") => new
    {
        intro,
        questions = new object[]
        {
            new { text = "Что ты почувствуешь, если TraleBot завтра исчезнет?", kind = "choice", options = IfGone, allowOther = false, optionKeys = IfGoneKeys, headlineOption = "very", headlineWithout = "unused" },
            Choice("Чем ещё ты пользуешься для грузинского?", WhatElse, allowOther: true),
            Free("А что в последний раз раздражало или мешало?")
        }
    };

    private Task<(HttpStatusCode Code, JsonElement Body)> OpenForm(User user, string key) =>
        Call(user.TelegramId, HttpMethod.Post, $"/api/miniapp/surveys/{key}/open");

    private async Task<HttpStatusCode> AnswerInForm(User user, string key, string questionId, string? option = null, bool other = false, string? text = null) =>
        (await Call(user.TelegramId, HttpMethod.Post, $"/api/miniapp/surveys/{key}/answer", new { questionId, option, other, text })).Code;

    private async Task<HttpStatusCode> FinishForm(User user, string key) =>
        (await Call(user.TelegramId, HttpMethod.Post, $"/api/miniapp/surveys/{key}/finish")).Code;

    private async Task<JsonElement> Results(string key, string? segment = null) =>
        (await Admin(HttpMethod.Get, $"feedback/surveys/{key}" + (segment == null ? "" : $"?segment={Uri.EscapeDataString(segment)}"))).Body;

    private static (int Sent, int AnsweredFirst, int OpenedForm, int Finished) Funnel(JsonElement results)
    {
        var f = results.GetProperty("summary").GetProperty("funnel");
        return (f.GetProperty("sent").GetInt32(), f.GetProperty("answeredFirst").GetInt32(), f.GetProperty("openedForm").GetInt32(), f.GetProperty("finished").GetInt32());
    }

    [Test]
    public async Task A_form_goes_out_as_its_intro_and_first_question_and_one_tap_invites_to_the_rest()
    {
        var person = await AccessEnded();
        var mark = _telegram.Requests.Count;
        await LaunchForm("form-out", ThreeQuestions());

        var message = SentTo(person, mark).Single();
        message.Text.Should().Be("Привет! Пара вопросов.\n\nЧто ты почувствуешь, если TraleBot завтра исчезнет?");
        ((InlineKeyboardMarkup)message.ReplyMarkup!).InlineKeyboard.Select(r => r.Single().Text).Should().Equal(IfGone);
        mark = _telegram.Requests.Count;

        await Press(person, "form-out", 0);
        await Press(person, "form-out", 1);

        var invite = SentTo(person, mark).Single();
        invite.Text.Should().Be("Спасибо! Ещё 2 коротких вопроса — это минута.");
        var button = ((InlineKeyboardMarkup)invite.ReplyMarkup!).InlineKeyboard.Single().Single();
        button.Text.Should().Be("Продолжить");
        button.WebApp!.Url.Should().Be($"{SignedMiniApp.Host}/?screen=survey&s=form-out");
        var row = (await Rows(person)).Single();
        (row.QuestionId, row.Option).Should().Be(("q1", "Немного расстроюсь"));
    }

    [TestCase(1, "Спасибо! Ещё 1 короткий вопрос — это минута.")]
    [TestCase(3, "Спасибо! Ещё 3 коротких вопроса — это минута.")]
    [TestCase(5, "Спасибо! Ещё 5 коротких вопросов — это минута.")]
    public void The_invitation_counts_the_questions_left_in_proper_russian(int left, string text) =>
        SurveyAnswerCommand.MoreQuestionsText(left).Should().Be(text);

    [Test]
    public async Task The_other_button_of_the_first_question_is_just_a_button_and_the_words_come_in_the_form()
    {
        var person = await AccessEnded();
        var mark = _telegram.Requests.Count;
        await LaunchForm("form-other", Form(Choice("Чем ещё ты пользуешься?", ["Курсы", "Приложения"], allowOther: true), Free("Что мешало?")));
        ((InlineKeyboardMarkup)SentTo(person, mark).Single().ReplyMarkup!).InlineKeyboard.Select(r => (r.Single().Text, r.Single().CallbackData))
            .Should().Equal(("Курсы", "/survey|form-other|0"), ("Приложения", "/survey|form-other|1"), ("Другое", "/survey|form-other|2"));

        await Press(person, "form-other", 2);
        var afterPress = (await Rows(person)).Single();
        var opened = (await OpenForm(person, "form-other")).Body;
        (await AnswerInForm(person, "form-other", "q1", other: true, text: "Подкасты")).Should().Be(HttpStatusCode.OK);
        await Press(person, "form-other", 2); // the same button again must not wipe the words

        (afterPress.Option, afterPress.Text).Should().Be(("Другое", null));
        var answer = opened.GetProperty("answers").GetProperty("q1");
        answer.GetProperty("other").GetBoolean().Should().BeTrue();
        answer.GetProperty("text").ValueKind.Should().Be(JsonValueKind.Null, "the form starts by asking for the words");
        var row = (await Rows(person)).Single();
        (row.Id, row.Option, row.Text).Should().Be((afterPress.Id, "Другое", "Подкасты"));
    }

    [Test]
    public async Task Answers_are_saved_page_by_page_and_a_form_left_halfway_keeps_them()
    {
        var person = await AccessEnded();
        await LaunchForm("form-pages", ThreeQuestions());
        await Press(person, "form-pages", 0);

        var (code, opened) = await OpenForm(person, "form-pages");
        (await AnswerInForm(person, "form-pages", "q2", other: true, text: "  Подкасты и сериалы  ")).Should().Be(HttpStatusCode.OK);
        var halfway = Funnel(await Results("form-pages"));
        var rowsHalfway = await Rows(person);

        code.Should().Be(HttpStatusCode.OK);
        opened.GetProperty("finished").GetBoolean().Should().BeFalse();
        opened.GetProperty("survey").GetProperty("questions").EnumerateArray().Select(q => (q.GetProperty("id").GetString(), q.GetProperty("kind").GetString()))
            .Should().Equal(("q1", "choice"), ("q2", "choice"), ("q3", "text"));
        opened.GetProperty("answers").GetProperty("q1").GetProperty("option").GetString().Should().Be("Очень расстроюсь", "the tap in the bot is already an answer");
        opened.GetProperty("answers").EnumerateObject().Should().ContainSingle();
        rowsHalfway.Select(r => (r.QuestionId, r.Option, r.Text)).Should().BeEquivalentTo(new[]
        {
            ("q1", "Очень расстроюсь", (string?)null), ("q2", "Другое", "Подкасты и сериалы")
        });
        halfway.Should().Be((1, 1, 1, 0));

        (await AnswerInForm(person, "form-pages", "q3", text: "Не хватает озвучки")).Should().Be(HttpStatusCode.OK);
        (await FinishForm(person, "form-pages")).Should().Be(HttpStatusCode.OK);
        (await FinishForm(person, "form-pages")).Should().Be(HttpStatusCode.OK);

        Funnel(await Results("form-pages")).Should().Be((1, 1, 1, 1));
        var again = (await OpenForm(person, "form-pages")).Body;
        again.GetProperty("finished").GetBoolean().Should().BeTrue();
        again.GetProperty("answers").GetProperty("q2").GetProperty("text").GetString().Should().Be("Подкасты и сериалы");
        again.GetProperty("answers").GetProperty("q3").GetProperty("text").GetString().Should().Be("Не хватает озвучки");
        (await Rows(person)).Should().HaveCount(3);
    }

    [Test]
    public async Task Someone_who_came_to_the_form_without_tapping_in_the_bot_starts_from_the_first_question_and_may_skip()
    {
        var person = await AccessEnded();
        await LaunchForm("form-fresh", ThreeQuestions());

        var opened = (await OpenForm(person, "form-fresh")).Body;
        var afterOpen = Funnel(await Results("form-fresh"));
        (await AnswerInForm(person, "form-fresh", "q1", option: "Мне всё равно")).Should().Be(HttpStatusCode.OK);
        (await AnswerInForm(person, "form-fresh", "q3", text: "Всё ок")).Should().Be(HttpStatusCode.OK); // q2 skipped
        (await FinishForm(person, "form-fresh")).Should().Be(HttpStatusCode.OK);

        opened.GetProperty("answers").EnumerateObject().Should().BeEmpty();
        afterOpen.Should().Be((1, 0, 1, 0));
        Funnel(await Results("form-fresh")).Should().Be((1, 1, 1, 1));
        (await Rows(person)).Select(r => r.QuestionId).Should().BeEquivalentTo(new[] { "q1", "q3" }, "a skipped question leaves no row");
    }

    [Test]
    public async Task One_answer_per_person_per_question_and_answering_again_changes_it()
    {
        var person = await AccessEnded();
        await LaunchForm("form-edit", ThreeQuestions());
        await AnswerInForm(person, "form-edit", "q2", other: true, text: "Подкасты");
        var first = (await Rows(person)).Single();

        (await AnswerInForm(person, "form-edit", "q2", option: "Другие приложения", text: "этот текст к варианту не относится")).Should().Be(HttpStatusCode.OK);
        var changed = (await Rows(person)).Single();
        await Task.WhenAll(Enumerable.Range(0, 12).Select(i => AnswerInForm(person, "form-edit", "q2", option: WhatElse[i % 3])));
        await Task.WhenAll(Enumerable.Range(0, 12).Select(i => AnswerInForm(person, "form-edit", "q3", text: $"Ответ {i}")));

        (changed.Id, changed.Option, changed.Text).Should().Be((first.Id, "Другие приложения", null));
        changed.UpdatedAtUtc.Should().NotBeNull();
        var rows = await Rows(person);
        rows.Select(r => r.QuestionId).Should().BeEquivalentTo(new[] { "q2", "q3" }, "parallel answers leave one row per question");
        WhatElse.Should().Contain(rows.Single(r => r.QuestionId == "q2").Option);
    }

    [Test]
    public async Task Only_a_recipient_answers_and_only_what_the_question_allows()
    {
        var recipient = await AccessEnded();
        await LaunchForm("form-closed", ThreeQuestions());
        var cameLater = await AccessEnded(); // has the link, was not sent the survey
        await Launch("plain-survey");

        (await OpenForm(cameLater, "form-closed")).Code.Should().Be(HttpStatusCode.NotFound);
        (await AnswerInForm(cameLater, "form-closed", "q1", option: IfGone[0])).Should().Be(HttpStatusCode.NotFound);
        (await FinishForm(cameLater, "form-closed")).Should().Be(HttpStatusCode.NotFound);
        (await OpenForm(recipient, "no-such-survey")).Code.Should().Be(HttpStatusCode.NotFound);
        (await AnswerInForm(recipient, "form-closed", "q9", option: IfGone[0])).Should().Be(HttpStatusCode.NotFound);
        (await AnswerInForm(recipient, "form-closed", "q1", option: "Такого варианта нет")).Should().Be(HttpStatusCode.BadRequest);
        (await AnswerInForm(recipient, "form-closed", "q1")).Should().Be(HttpStatusCode.BadRequest);
        (await AnswerInForm(recipient, "form-closed", "q1", other: true, text: "у первого вопроса нет «Другое»")).Should().Be(HttpStatusCode.BadRequest);
        (await AnswerInForm(recipient, "form-closed", "q2", other: true, text: new string('я', UserFeedbackService.MaxTextLength + 1))).Should().Be(HttpStatusCode.BadRequest);
        (await AnswerInForm(recipient, "form-closed", "q3", text: "   ")).Should().Be(HttpStatusCode.BadRequest);
        using var anonymous = _app.CreateClient();
        (await anonymous.PostAsync("/api/miniapp/surveys/form-closed/open", null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await anonymous.PostAsJsonAsync("/api/miniapp/surveys/form-closed/answer", new { questionId = "q1", option = IfGone[0] })).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        (await Rows(cameLater)).Should().BeEmpty();
        (await Rows(recipient)).Should().BeEmpty();
        Funnel(await Results("form-closed")).Should().Be((1, 0, 0, 0));
        (await AnswerInForm(recipient, "form-closed", "q2", other: true, text: new string('я', UserFeedbackService.MaxTextLength))).Should().Be(HttpStatusCode.OK);
        (await AnswerInForm(recipient, "form-closed", "q2", other: true)).Should().Be(HttpStatusCode.OK, "«Другое» without words is still an answer");
    }

    [Test]
    public async Task A_form_is_checked_before_anyone_is_picked()
    {
        await AccessEnded();
        string[] Many(int n) => Enumerable.Range(1, n).Select(i => $"Вариант {i}").ToArray();
        async Task<(HttpStatusCode Code, string? Error)> Try(string key, object form)
        {
            var (code, body) = await PrepareForm(key, form);
            return (code, code == HttpStatusCode.OK ? null : body.GetProperty("error").GetString());
        }

        var freeFirst = await Try("bad-1", Form(Free("Что мешало?"), Choice("А это?", Options)));
        var fiveInBot = await Try("bad-2", Form(Choice("Первый", Many(5)), Free("Что мешало?")));
        var sevenLater = await Try("bad-3", Form(Choice("Первый", Options), Choice("Второй", Many(7))));
        var sevenQuestions = await Try("bad-4", Form(Enumerable.Range(1, 7).Select(i => Choice($"Вопрос {i}", Options)).ToArray()));
        var otherTwice = await Try("bad-5", Form(Choice("Первый", ["Да", "Другое"], allowOther: true)));
        var noText = await Try("bad-6", Form(Choice("Первый", Options), Free("  ")));
        var empty = await Try("bad-7", new { questions = Array.Empty<object>() });
        var withButton = await PrepareForm("bad-8", ThreeQuestions(), buttonText: "Открыть");
        var good = await Try("good", Form(Choice("Первый", Many(4), allowOther: true), Choice("Второй", Many(6), allowOther: true), Free("Третий")));

        freeFirst.Should().Be((HttpStatusCode.BadRequest, "Первый вопрос приходит в бот кнопками, поэтому он должен быть с вариантами ответа. Поставь свободный вопрос вторым или дальше."));
        fiveInBot.Should().Be((HttpStatusCode.BadRequest, "Первый вопрос приходит в бот кнопками — у него не больше 4 вариантов. Убери лишние или поставь первым другой вопрос."));
        sevenLater.Code.Should().Be(HttpStatusCode.BadRequest);
        sevenLater.Error.Should().StartWith("Вопрос 2:");
        sevenQuestions.Should().Be((HttpStatusCode.BadRequest, "В опросе не больше 6 вопросов."));
        otherTwice.Code.Should().Be(HttpStatusCode.BadRequest);
        noText.Should().Be((HttpStatusCode.BadRequest, "Вопрос 2: нет текста."));
        empty.Code.Should().Be(HttpStatusCode.BadRequest);
        withButton.Code.Should().Be(HttpStatusCode.BadRequest);
        good.Code.Should().Be(HttpStatusCode.OK);
        (await CampaignKeys()).Should().Equal("good");

        (await PrepareForm("good", Form(Choice("Первый", Many(4), allowOther: true), Choice("Второй", Many(6), allowOther: true), Free("Третий, но другой")))).Code
            .Should().Be(HttpStatusCode.BadRequest, "a form does not change once the campaign exists");
        (await PrepareForm("good", Form(Choice("Первый", Many(4), allowOther: true), Choice("Второй", Many(6), allowOther: true), Free("Третий")))).Code
            .Should().Be(HttpStatusCode.OK, "the same form — the next part of the same survey");
    }

    private async Task<(User Fan, User Fan2, User Lukewarm, User Gone)> SeedFormAnswers(string key)
    {
        var fan = await AccessEnded();
        var fan2 = await AccessEnded();
        var lukewarm = await AccessEnded();
        var gone = await AccessEnded();
        await AccessEnded(); // got the survey, said nothing
        await LaunchForm(key, ThreeQuestions());
        await Press(fan, key, 0);
        await Press(fan2, key, 0);
        await Press(lukewarm, key, 1);
        await Press(gone, key, 3);
        await OpenForm(fan, key);
        await AnswerInForm(fan, key, "q2", option: "Только TraleBot");
        await AnswerInForm(fan, key, "q3", text: "Мало озвучки");
        await FinishForm(fan, key);
        await OpenForm(fan2, key);
        await AnswerInForm(fan2, key, "q2", other: true, text: "Сериалы");
        await OpenForm(lukewarm, key);
        await AnswerInForm(lukewarm, key, "q2", option: "Репетитор или курсы");
        await AnswerInForm(lukewarm, key, "q3", text: "Скучные уроки");
        await FinishForm(lukewarm, key);
        return (fan, fan2, lukewarm, gone);
    }

    [Test]
    public async Task Results_show_the_funnel_each_question_and_the_share_of_the_very_disappointed_among_those_who_still_use_it()
    {
        var people = await SeedFormAnswers("form-results");

        var results = await Results("form-results");

        Funnel(results).Should().Be((5, 4, 3, 2));
        results.GetProperty("summary").GetProperty("title").GetString().Should().Be("Что ты почувствуешь, если TraleBot завтра исчезнет?");
        results.GetProperty("summary").GetProperty("questions").GetInt32().Should().Be(3);
        results.GetProperty("segment").ValueKind.Should().Be(JsonValueKind.Null);
        var questions = results.GetProperty("questions").EnumerateArray().ToList();
        static List<(string?, int)> Counts(JsonElement q) => q.GetProperty("options").EnumerateArray()
            .Select(o => (o.GetProperty("option").GetString(), o.GetProperty("count").GetInt32())).ToList();
        Counts(questions[0]).Should().Equal(("Очень расстроюсь", 2), ("Немного расстроюсь", 1), ("Мне всё равно", 0), ("Уже не пользуюсь", 1));
        var headline = questions[0].GetProperty("headline");
        (headline.GetProperty("option").GetString(), headline.GetProperty("without").GetString(), headline.GetProperty("chose").GetInt32(), headline.GetProperty("of").GetInt32())
            .Should().Be(("Очень расстроюсь", "Уже не пользуюсь", 2, 3), "two of the three who still use it");
        Counts(questions[1]).Should().Equal(("Репетитор или курсы", 1), ("Другие приложения", 0), ("Только TraleBot", 1), ("Другое", 1));
        questions[1].GetProperty("answered").GetInt32().Should().Be(3);
        questions[1].GetProperty("headline").ValueKind.Should().Be(JsonValueKind.Null);
        questions[1].GetProperty("texts").EnumerateArray().Single().GetProperty("text").GetString().Should().Be("Сериалы");
        questions[1].GetProperty("texts")[0].GetProperty("telegramId").GetInt64().Should().Be(people.Fan2.TelegramId);
        questions[2].GetProperty("kind").GetString().Should().Be("text");
        questions[2].GetProperty("options").GetArrayLength().Should().Be(0);
        questions[2].GetProperty("texts").EnumerateArray().Select(t => t.GetProperty("text").GetString()).Should().BeEquivalentTo("Мало озвучки", "Скучные уроки");

        (await Admin(HttpMethod.Get, "feedback/surveys/no-such")).Code.Should().Be(HttpStatusCode.NotFound);
        (await Call(people.Fan.TelegramId, HttpMethod.Get, "/api/admin/feedback/surveys/form-results")).Code.Should().Be(HttpStatusCode.NotFound);
    }

    private static object IfGoneReworded(string[] options, string[] keys) => new
    {
        questions = new object[]
        {
            new { text = "Будешь скучать по TraleBot?", kind = "choice", options, allowOther = false, optionKeys = keys, headlineOption = "very", headlineWithout = "unused" },
            Free("Почему?")
        }
    };

    private async Task<JsonElement> HeadlineOf(string key) =>
        (await Results(key)).GetProperty("questions")[0].GetProperty("headline");

    [Test]
    public async Task The_headline_number_follows_its_options_when_they_are_reworded_in_the_builder()
    {
        var fan = await AccessEnded();
        var gone = await AccessEnded();
        var lukewarm = await AccessEnded();
        // The owner renamed every button, dropped one that is not a key option and put a blank line in between.
        await LaunchForm("headline-renamed", IfGoneReworded(
            ["Ещё как!", "", "Не особо", "Давно не захожу"], ["very", "somewhat", "indifferent", "unused"]));
        await Press(fan, "headline-renamed", 0);
        await Press(lukewarm, "headline-renamed", 1);
        await Press(gone, "headline-renamed", 2);

        var headline = await HeadlineOf("headline-renamed");
        var stored = (await Admin(HttpMethod.Get, "campaigns/headline-renamed")).Body.GetProperty("survey").GetProperty("questions")[0];

        (headline.GetProperty("option").GetString(), headline.GetProperty("without").GetString(), headline.GetProperty("chose").GetInt32(), headline.GetProperty("of").GetInt32())
            .Should().Be(("Ещё как!", "Давно не захожу", 1, 2), "counted by the options' keys, shown in the words people saw");
        stored.GetProperty("options").EnumerateArray().Select(o => o.GetString()).Should().Equal("Ещё как!", "Не особо", "Давно не захожу");
        stored.GetProperty("optionKeys").EnumerateArray().Select(o => o.GetString()).Should().Equal("very", "indifferent", "unused");
    }

    [Test]
    public async Task There_is_no_headline_number_once_one_of_its_two_options_is_gone()
    {
        await AccessEnded();
        await LaunchForm("headline-no-very", IfGoneReworded(["Немного расстроюсь", "Мне всё равно", "Уже не пользуюсь"], ["somewhat", "indifferent", "unused"]));
        await LaunchForm("headline-no-unused", IfGoneReworded(["Очень расстроюсь", "Немного расстроюсь", "Мне всё равно"], ["very", "somewhat", "indifferent"]));
        // Options that merely read the same as the key ones, with no keys, are not the key ones.
        await LaunchForm("headline-no-keys", new
        {
            questions = new object[] { new { text = "Будешь скучать?", kind = "choice", options = IfGone, allowOther = false, headlineOption = "very", headlineWithout = "unused" } }
        });
        var duplicateKeys = await PrepareForm("headline-dup", IfGoneReworded(["Да", "Нет"], ["very", "very"]));

        (await HeadlineOf("headline-no-very")).ValueKind.Should().Be(JsonValueKind.Null);
        (await HeadlineOf("headline-no-unused")).ValueKind.Should().Be(JsonValueKind.Null);
        (await HeadlineOf("headline-no-keys")).ValueKind.Should().Be(JsonValueKind.Null);
        var stored = (await Admin(HttpMethod.Get, "campaigns/headline-no-very")).Body.GetProperty("survey").GetProperty("questions")[0];
        stored.GetProperty("headlineOption").ValueKind.Should().Be(JsonValueKind.Null, "the builder is told there will be no number");
        duplicateKeys.Code.Should().Be(HttpStatusCode.BadRequest);
    }

    [Test]
    public async Task Results_can_be_narrowed_to_those_who_chose_one_option_of_the_first_question()
    {
        await SeedFormAnswers("form-segment");

        var fans = await Results("form-segment", "Очень расстроюсь");
        var unknown = await Results("form-segment", "Такого варианта нет");

        fans.GetProperty("segment").GetString().Should().Be("Очень расстроюсь");
        Funnel(fans).Should().Be((5, 4, 3, 2), "the funnel is of the whole survey");
        var questions = fans.GetProperty("questions").EnumerateArray().ToList();
        questions[0].GetProperty("answered").GetInt32().Should().Be(2);
        questions[1].GetProperty("options").EnumerateArray().Select(o => (o.GetProperty("option").GetString(), o.GetProperty("count").GetInt32()))
            .Should().Equal(("Репетитор или курсы", 0), ("Другие приложения", 0), ("Только TraleBot", 1), ("Другое", 1));
        questions[2].GetProperty("texts").EnumerateArray().Select(t => t.GetProperty("text").GetString()).Should().Equal("Мало озвучки");
        unknown.GetProperty("segment").ValueKind.Should().Be(JsonValueKind.Null);
        unknown.GetProperty("questions")[1].GetProperty("answered").GetInt32().Should().Be(3);
    }

    [Test]
    public async Task The_report_query_names_the_questions_and_cuts_the_answers_by_the_first_one()
    {
        await SeedFormAnswers("form-report");
        var queries = ReportQueries();

        var summary = (await Query(queries[0])).Where(r => (string)r["campaign"]! == "form-report")
            .ToDictionary(r => (Convert.ToInt32(r["question_no"]), (string)r["answer"]!));
        var texts = (await Query(queries[1])).Select(t => ((string)t["question"]!, (string)t["answer"]!, (string)t["text"]!)).ToList();
        var cut = (await Query(queries[2])).Select(r => ((string)r["first_answer"]!, Convert.ToInt32(r["people"]), Convert.ToInt32(r["question_no"]), (string)r["answer"]!, Convert.ToInt32(r["answers"]))).ToList();

        summary.Keys.Should().BeEquivalentTo(new[]
        {
            (1, "Очень расстроюсь"), (1, "Немного расстроюсь"), (1, "Уже не пользуюсь"),
            (2, "Только TraleBot"), (2, "Другое"), (2, "Репетитор или курсы"), (3, "(text)")
        });
        summary[(1, "Очень расстроюсь")]["question"].Should().Be("Что ты почувствуешь, если TraleBot завтра исчезнет?");
        Convert.ToDecimal(summary[(1, "Очень расстроюсь")]["share_pct"]).Should().Be(50.0m);
        Convert.ToInt32(summary[(2, "Другое")]["with_text"]).Should().Be(1);
        Convert.ToInt32(summary[(3, "(text)")]["answers"]).Should().Be(2);
        Convert.ToDecimal(summary[(3, "(text)")]["share_pct"]).Should().Be(100.0m);
        texts.Should().BeEquivalentTo(new[]
        {
            ("Чем ещё ты пользуешься для грузинского?", "Другое", "Сериалы"),
            ("А что в последний раз раздражало или мешало?", "", "Мало озвучки"),
            ("А что в последний раз раздражало или мешало?", "", "Скучные уроки")
        });
        cut.Should().BeEquivalentTo(new[]
        {
            ("Очень расстроюсь", 2, 2, "Только TraleBot", 1), ("Очень расстроюсь", 2, 2, "Другое", 1), ("Очень расстроюсь", 2, 3, "(text)", 1),
            ("Немного расстроюсь", 1, 2, "Репетитор или курсы", 1), ("Немного расстроюсь", 1, 3, "(text)", 1)
        });
    }

    // ── Аудитории по активности ──────────────────────────────────────────────

    [Test]
    public async Task People_can_be_picked_by_whether_they_studied_in_the_last_thirty_days()
    {
        var lessonLately = await AccessEnded();
        var wordLately = await AccessEnded();
        var quizLately = await AccessEnded();
        var quizLongAgo = await AccessEnded();
        var nothingEver = await AccessEnded();           // registered 200 days ago, no trace since
        var justRegistered = await AddUser(3);           // no trace yet, but came within the window
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            db.MiniAppUserProgresses.Add(new MiniAppUserProgress { Id = Guid.NewGuid(), UserId = lessonLately.Id, LastPlayedAtUtc = DateTime.UtcNow.AddDays(-29) });
            db.MiniAppUserProgresses.Add(new MiniAppUserProgress { Id = Guid.NewGuid(), UserId = quizLongAgo.Id, LastPlayedAtUtc = DateTime.UtcNow.AddDays(-90) });
            db.Quizzes.Add(new UserQuiz { Id = Guid.NewGuid(), UserId = quizLongAgo.Id, DateStarted = DateTime.UtcNow.AddDays(-31) });
            db.Quizzes.Add(new UserQuiz { Id = Guid.NewGuid(), UserId = quizLately.Id, DateStarted = DateTime.UtcNow.AddDays(-10) });
            db.VocabularyEntries.Add(new VocabularyEntry
            {
                Id = Guid.NewGuid(), UserId = wordLately.Id, Word = "ძაღლი", Definition = "собака", AdditionalInfo = "", Example = "",
                DateAddedUtc = DateTime.UtcNow.AddDays(-2), UpdatedAtUtc = DateTime.UtcNow.AddDays(-2), Language = Language.Georgian
            });
            return await db.SaveChangesAsync(CancellationToken.None);
        });
        var counts = (await Admin(HttpMethod.Get, "campaigns/audiences")).Body;
        await PrepareForm("to-active", ThreeQuestions(), audience: "activeLately");
        await PrepareForm("to-inactive", ThreeQuestions(), audience: "inactiveLong");

        async Task<List<Guid>> Picked(string key) => await InScope(sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            return db.BroadcastDeliveries.AsNoTracking()
                .Where(d => db.BroadcastCampaigns.Any(c => c.Id == d.CampaignId && c.Key == key)).Select(d => d.UserId).ToListAsync();
        });
        var owner = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().Users.AsNoTracking().SingleAsync(u => u.TelegramId == Owner));
        (await Picked("to-active")).Should().BeEquivalentTo(new[] { lessonLately.Id, wordLately.Id, quizLately.Id, justRegistered.Id, owner.Id });
        (await Picked("to-inactive")).Should().BeEquivalentTo(new[] { quizLongAgo.Id, nothingEver.Id });
        counts.GetProperty("activeLately").GetInt32().Should().Be(5);
        counts.GetProperty("inactiveLong").GetInt32().Should().Be(2);
    }

    // ── Что видит владелец ───────────────────────────────────────────────────

    private async Task<(User Expensive, User Unclear, User Silent, User Writer)> SeedAnswers()
    {
        var expensive = await AccessEnded();
        var unclear = await AccessEnded();
        var silent = await AccessEnded();
        var writer = await AddUser(3);
        await Launch("seen");
        await AnswerPaywall(expensive, await ClosePaywall(expensive), PaywallDeclineOptions.Expensive, "150 звёзд — это сколько в лари?");
        await AnswerPaywall(unclear, await ClosePaywall(unclear), PaywallDeclineOptions.Unclear);
        await ClosePaywall(silent);
        await Press(expensive, "seen", 0);
        await Press(unclear, "seen", 0);
        await Press(silent, "seen", 2);
        await Write(expensive, "Подробнее про цену", "seen");
        await Write(writer, "Спасибо за глаголы!");
        return (expensive, unclear, silent, writer);
    }

    [Test]
    public async Task The_owner_sees_the_latest_answers_and_the_counts_per_option()
    {
        var people = await SeedAnswers();

        var (code, body) = await Admin(HttpMethod.Get, "feedback");

        code.Should().Be(HttpStatusCode.OK);
        var paywall = body.GetProperty("paywall");
        paywall.GetProperty("shown").GetInt32().Should().Be(3);
        paywall.GetProperty("options").EnumerateArray()
            .Select(o => (o.GetProperty("option").GetString(), o.GetProperty("count").GetInt32()))
            .Should().Equal(("expensive", 1), ("not_now", 0), ("unclear", 1), ("other", 0));
        var survey = body.GetProperty("surveys").EnumerateArray().Single();
        survey.GetProperty("key").GetString().Should().Be("seen");
        survey.GetProperty("title").GetString().Should().Be("Что мешает заниматься?");
        survey.GetProperty("questions").GetInt32().Should().Be(1);
        survey.GetProperty("audience").GetString().Should().Be("accessEnded");
        survey.GetProperty("createdAtUtc").GetDateTime().Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(2));
        survey.GetProperty("funnel").GetProperty("sent").GetInt32().Should().Be(3, "the three whose access ended; the one on trial is another audience");
        survey.GetProperty("funnel").GetProperty("answeredFirst").GetInt32().Should().Be(3);
        body.GetProperty("messages").GetInt32().Should().Be(2);
        var results = (await Admin(HttpMethod.Get, "feedback/surveys/seen")).Body;
        results.GetProperty("questions").EnumerateArray().Single().GetProperty("options").EnumerateArray()
            .Select(o => (o.GetProperty("option").GetString(), o.GetProperty("count").GetInt32()))
            .Should().Equal(("Дорого", 2), ("Пока не нужно", 0), ("Не понял, что получу", 1));
        results.GetProperty("written").EnumerateArray().Single().GetProperty("text").GetString().Should().Be("Подробнее про цену");
        var recent = body.GetProperty("recent").EnumerateArray().ToList();
        recent.Should().HaveCount(7, "a question closed without an answer says nothing and is not listed");
        recent.Select(r => r.GetProperty("atUtc").GetDateTime()).Should().BeInDescendingOrder();
        recent[0].GetProperty("kind").GetString().Should().Be("message");
        recent[0].GetProperty("text").GetString().Should().Be("Спасибо за глаголы!");
        recent[0].GetProperty("telegramId").GetInt64().Should().Be(people.Writer.TelegramId);
        recent[1].GetProperty("campaignKey").GetString().Should().Be("seen");
        recent.Count(r => r.GetProperty("kind").GetString() == "paywall").Should().Be(2);
        recent.Count(r => r.GetProperty("kind").GetString() == "survey").Should().Be(3);

        (await Admin(HttpMethod.Get, "feedback?take=2")).Body.GetProperty("recent").GetArrayLength().Should().Be(2);
    }

    [Test]
    public async Task The_owner_can_look_at_one_kind_or_one_survey_while_the_counts_stay_whole()
    {
        await SeedAnswers();

        async Task<List<(string? Kind, string? Text)>> Recent(string query) =>
            (await Admin(HttpMethod.Get, $"feedback?{query}")).Body.GetProperty("recent").EnumerateArray()
                .Select(r => (r.GetProperty("kind").GetString(), r.GetProperty("text").GetString())).ToList();

        (await Recent("kind=paywall")).Should().HaveCount(2).And.OnlyContain(r => r.Kind == "paywall");
        (await Recent("kind=message")).Select(r => r.Text).Should().Equal("Спасибо за глаголы!", "Подробнее про цену");
        (await Recent("kind=message&campaign=seen")).Select(r => r.Text).Should().Equal("Подробнее про цену");
        (await Recent("kind=survey&campaign=seen")).Should().HaveCount(3);
        (await Recent("campaign=no-such")).Should().BeEmpty();
        var narrowed = (await Admin(HttpMethod.Get, "feedback?kind=message&campaign=seen")).Body;
        narrowed.GetProperty("paywall").GetProperty("shown").GetInt32().Should().Be(3);
        narrowed.GetProperty("surveys").GetArrayLength().Should().Be(1);
    }

    [Test]
    public async Task A_survey_nobody_answered_is_listed_and_a_trial_sent_only_to_the_owner_is_not()
    {
        await AccessEnded();
        await Launch("silent");
        (await Prepare("only-me", Options, audience: "owner")).Code.Should().Be(HttpStatusCode.OK);
        await Admin(HttpMethod.Post, "campaigns/only-me/send", new { limit = 100 });

        var surveys = (await Admin(HttpMethod.Get, "feedback")).Body.GetProperty("surveys").EnumerateArray().ToList();

        var silent = surveys.Single();
        silent.GetProperty("key").GetString().Should().Be("silent");
        silent.GetProperty("funnel").GetProperty("sent").GetInt32().Should().Be(1);
        silent.GetProperty("funnel").GetProperty("answeredFirst").GetInt32().Should().Be(0);
    }

    // ── Конструктор опроса ───────────────────────────────────────────────────

    private Task<(HttpStatusCode Code, JsonElement Body)> StartSurvey(string slug, bool dryRun = false, string audience = "accessEnded",
        string[]? options = null, int? sampleSize = null) =>
        Admin(HttpMethod.Post, "campaigns/prepare", new
        {
            key = "", newSurveySlug = slug, audience, sampleSize, dryRun,
            survey = options is { Length: 0 } ? null : Form(Choice("Чего тебе не хватает?", options ?? Options))
        });

    private Task<List<string>> CampaignKeys() => InScope(sp =>
        sp.GetRequiredService<ITraleDbContext>().BroadcastCampaigns.AsNoTracking().Select(c => c.Key).OrderBy(k => k).ToListAsync());

    private static string Stem(string slug) => $"survey-{DateTime.UtcNow:yyyy-MM}-{slug}";

    [Test]
    public async Task Every_ready_made_form_passes_the_same_checks_as_a_built_one_and_its_first_question_fits_phone_buttons()
    {
        await AccessEnded();
        var (code, body) = await Admin(HttpMethod.Get, "surveys/presets");
        code.Should().Be(HttpStatusCode.OK);
        var presets = body.GetProperty("presets").EnumerateArray().ToList();
        presets.Select(p => p.GetProperty("id").GetString()).Should().Equal("users", "left", "paid");
        var paid = presets[2].GetProperty("form");
        paid.GetProperty("intro").GetString().Should().StartWith("Привет! Это автор TraleBot. Ты один из немногих, кто оформил подписку");
        paid.GetProperty("questions").EnumerateArray().Select(q => q.GetProperty("kind").GetString()).Should().Equal("choice", "text", "text", "text", "choice");
        paid.GetProperty("questions")[4].GetProperty("options").EnumerateArray().Select(o => o.GetString())
            .Should().Equal("Подписка действует", "Перестал(а) заниматься", "Хватает бесплатного", "Дорого", "Просто забыл(а)");
        presets.Should().OnlyContain(p => p.GetProperty("form").GetProperty("questions")[0].GetProperty("headlineOption").GetString() == "very"
                                          || p.GetProperty("id").GetString() == "left", "the «would be very disappointed» question opens the forms for users and for those who paid");

        foreach (var preset in presets)
        {
            var id = preset.GetProperty("id").GetString()!;
            var form = preset.GetProperty("form");
            var questions = form.GetProperty("questions").EnumerateArray().ToList();
            questions.Should().HaveCountLessThanOrEqualTo(5, id);
            var first = questions[0].GetProperty("options").EnumerateArray().Select(o => o.GetString()!).ToArray();
            first.Should().HaveCountLessThanOrEqualTo(SurveyFormRules.MaxBotOptions, id);
            first.Should().OnlyContain(o => o.Length <= SurveyPresets.MaxButtonLength, id);

            var (prepared, answer) = await Admin(HttpMethod.Post, "campaigns/prepare", new
            {
                key = "", newSurveySlug = id, audience = "accessEnded", sampleSize = (int?)null, dryRun = true,
                survey = JsonSerializer.Deserialize<object>(form.GetRawText())
            });

            prepared.Should().Be(HttpStatusCode.OK, $"{id}: {(answer.ValueKind == JsonValueKind.Undefined ? "" : answer.GetRawText())}");
            var key = answer.GetProperty("key").GetString()!;
            key.Should().Be(Stem(id));
            System.Text.Encoding.UTF8.GetByteCount(SurveyAnswerCommand.CallbackData(key + "-99", first.Length))
                .Should().BeLessThanOrEqualTo(64, "Telegram's limit for the data a button carries");
        }

        // Every ready question can stand first or later in a built form — except that a free one cannot be first.
        var bank = body.GetProperty("bank").EnumerateArray().ToList();
        bank.Select(q => q.GetProperty("text").GetString()).Should().OnlyHaveUniqueItems().And.HaveCount(13)
            .And.Contain("Вспомни день, когда ты оформил(а) подписку. Что тогда подтолкнуло?").And.Contain("Если подписка у тебя закончилась — почему не продлил(а)?");
        foreach (var question in bank)
        {
            var (prepared, answer) = await Admin(HttpMethod.Post, "campaigns/prepare", new
            {
                key = "", newSurveySlug = "custom", audience = "accessEnded", sampleSize = (int?)null, dryRun = true,
                survey = new { questions = new[] { JsonSerializer.Deserialize<object>(bank[0].GetRawText()), JsonSerializer.Deserialize<object>(question.GetRawText()) } }
            });
            prepared.Should().Be(HttpStatusCode.OK, $"{question.GetProperty("text").GetString()}: {(answer.ValueKind == JsonValueKind.Undefined ? "" : answer.GetRawText())}");
        }

        body.GetProperty("suggestions").EnumerateArray().Select(o => o.GetString()!)
            .Should().OnlyHaveUniqueItems().And.OnlyContain(o => o.Length <= SurveyPresets.MaxButtonLength);
        (await CampaignKeys()).Should().BeEmpty("counting creates nothing");
        (await Call((await AccessEnded()).TelegramId, HttpMethod.Get, "/api/admin/surveys/presets")).Code.Should().Be(HttpStatusCode.NotFound);
    }

    [Test]
    public async Task A_new_survey_names_itself_and_never_takes_a_name_in_use()
    {
        await AccessEnded();

        var counted = await StartSurvey("missing", dryRun: true);
        var first = await StartSurvey("missing");
        var second = await StartSurvey("missing");
        var third = await StartSurvey("missing");
        var another = await StartSurvey("likes");

        counted.Body.GetProperty("key").GetString().Should().Be(Stem("missing"));
        first.Body.GetProperty("key").GetString().Should().Be(Stem("missing"), "counting did not take the name");
        second.Body.GetProperty("key").GetString().Should().Be(Stem("missing") + "-2");
        third.Body.GetProperty("key").GetString().Should().Be(Stem("missing") + "-3");
        another.Body.GetProperty("key").GetString().Should().Be(Stem("likes"));
        (await CampaignKeys()).Should().HaveCount(4);
        first.Body.GetProperty("picked").GetInt32().Should().Be(1);
        second.Body.GetProperty("picked").GetInt32().Should().Be(1, "a new survey is a new campaign: the same people may get it");
    }

    [Test]
    public async Task Surveys_started_at_once_never_share_a_campaign()
    {
        await AccessEnded();
        await AccessEnded();

        var started = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => StartSurvey("race")));

        var created = started.Where(s => s.Code == HttpStatusCode.OK).Select(s => s.Body.GetProperty("key").GetString()!).ToList();
        created.Should().NotBeEmpty().And.OnlyHaveUniqueItems();
        (await CampaignKeys()).Should().BeEquivalentTo(created);
        started.Where(s => s.Code != HttpStatusCode.OK).Should().OnlyContain(s => s.Code == HttpStatusCode.BadRequest);
        var perCampaign = await InScope(sp => sp.GetRequiredService<ITraleDbContext>().BroadcastDeliveries.AsNoTracking()
            .GroupBy(d => d.CampaignId).Select(g => g.Count()).ToListAsync());
        perCampaign.Should().HaveCount(created.Count).And.OnlyContain(count => count == 2, "nobody's recipients were added to another survey");
    }

    [Test]
    public async Task The_next_part_of_a_survey_goes_by_its_key_and_a_bad_start_is_refused()
    {
        await AccessEnded();
        await AccessEnded();
        var started = await StartSurvey("parts", sampleSize: 1);
        var key = started.Body.GetProperty("key").GetString()!;

        var rest = await Admin(HttpMethod.Post, "campaigns/prepare", new
        {
            key, newSurveySlug = "parts", audience = "accessEnded",
            sampleSize = (int?)null, dryRun = false, survey = Form(Choice("Чего тебе не хватает?", Options))
        });

        rest.Code.Should().Be(HttpStatusCode.OK);
        rest.Body.GetProperty("key").GetString().Should().Be(key);
        rest.Body.GetProperty("alreadyInCampaign").GetInt32().Should().Be(1);
        rest.Body.GetProperty("picked").GetInt32().Should().Be(1);
        (await CampaignKeys()).Should().Equal(key);
        (await StartSurvey("Bad Slug!")).Code.Should().Be(HttpStatusCode.BadRequest);
        (await StartSurvey("empty", options: [])).Code.Should().Be(HttpStatusCode.BadRequest, "the builder starts surveys, not ordinary broadcasts");
        (await StartSurvey("one", options: ["Да"])).Code.Should().Be(HttpStatusCode.BadRequest);
        (await CampaignKeys()).Should().Equal(key);
    }

    [Test]
    public async Task A_survey_left_half_sent_can_be_found_and_finished_and_then_sent_to_the_rest()
    {
        var people = new[] { await AccessEnded(), await AccessEnded(), await AccessEnded() };
        var mark = _telegram.Requests.Count;
        var key = (await StartSurvey("resume", sampleSize: 2)).Body.GetProperty("key").GetString()!;
        await Admin(HttpMethod.Post, "campaigns/prepare", new
        {
            key = "", newSurveySlug = "resume-test", audience = "owner",
            sampleSize = (int?)null, dryRun = false, survey = Form(Choice("Чего тебе не хватает?", Options))
        });
        await Admin(HttpMethod.Post, $"campaigns/{key}/send", new { limit = 1 });

        // The owner closed the mini-app here. What the builder later reads to find the survey and bring it back:
        async Task<JsonElement> Listed() =>
            (await Admin(HttpMethod.Get, "feedback?take=1")).Body.GetProperty("surveys").EnumerateArray().Single();
        var left = await Listed();
        var status = (await Admin(HttpMethod.Get, $"campaigns/{key}")).Body;

        left.GetProperty("key").GetString().Should().Be(key, "the trial sent to the owner is not a survey to come back to");
        left.GetProperty("picked").GetInt32().Should().Be(2);
        left.GetProperty("pending").GetInt32().Should().Be(1);
        left.GetProperty("funnel").GetProperty("sent").GetInt32().Should().Be(1);
        status.GetProperty("audience").GetString().Should().Be("accessEnded");
        var form = status.GetProperty("survey");
        form.GetProperty("questions").EnumerateArray().Single().GetProperty("text").GetString().Should().Be("Чего тебе не хватает?");
        form.GetProperty("questions")[0].GetProperty("options").EnumerateArray().Select(o => o.GetString()).Should().Equal(Options);

        // Finishing the sample, then the rest of the audience — by the key alone, with what the status gave back.
        await Admin(HttpMethod.Post, $"campaigns/{key}/send", new { limit = 25 });
        (await Listed()).GetProperty("pending").GetInt32().Should().Be(0);
        var rest = await Admin(HttpMethod.Post, "campaigns/prepare", new
        {
            key, audience = status.GetProperty("audience").GetString(),
            sampleSize = (int?)null, dryRun = false, survey = JsonSerializer.Deserialize<object>(form.GetRawText())
        });
        rest.Code.Should().Be(HttpStatusCode.OK);
        rest.Body.GetProperty("picked").GetInt32().Should().Be(1);
        (await Listed()).GetProperty("pending").GetInt32().Should().Be(1);
        await Admin(HttpMethod.Post, $"campaigns/{key}/send", new { limit = 25 });

        var done = await Listed();
        done.GetProperty("picked").GetInt32().Should().Be(3);
        done.GetProperty("pending").GetInt32().Should().Be(0);
        done.GetProperty("funnel").GetProperty("sent").GetInt32().Should().Be(3);
        people.Should().OnlyContain(p => SentTo(p, mark).Count == 1, "everyone got the survey once");
    }

    [Test]
    public async Task A_batch_does_not_leave_until_recipients_are_picked()
    {
        var person = await AccessEnded();
        var mark = _telegram.Requests.Count;

        var unknown = await Admin(HttpMethod.Post, $"campaigns/{Stem("unpicked")}/send", new { limit = 25 });
        await StartSurvey("unpicked", dryRun: true);
        var onlyCounted = await Admin(HttpMethod.Post, $"campaigns/{Stem("unpicked")}/send", new { limit = 25 });

        unknown.Code.Should().Be(HttpStatusCode.NotFound);
        onlyCounted.Code.Should().Be(HttpStatusCode.NotFound, "counting an audience picks nobody");
        _telegram.Requests.Skip(mark).Should().BeEmpty();

        await StartSurvey("unpicked");
        var sent = await Admin(HttpMethod.Post, $"campaigns/{Stem("unpicked")}/send", new { limit = 25 });
        var again = await Admin(HttpMethod.Post, $"campaigns/{Stem("unpicked")}/send", new { limit = 25 });

        sent.Body.GetProperty("sent").GetInt32().Should().Be(1);
        again.Body.GetProperty("sent").GetInt32().Should().Be(0, "everyone picked has got it");
        SentTo(person, mark).Should().ContainSingle();
    }

    [Test]
    public async Task Nobody_but_the_owner_reads_the_answers()
    {
        var people = await SeedAnswers();
        using var anonymous = _app.CreateClient();

        (await Call(people.Writer.TelegramId, HttpMethod.Get, "/api/admin/feedback")).Code.Should().Be(HttpStatusCode.NotFound);
        (await anonymous.GetAsync("/api/admin/feedback")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private static string[] ReportQueries() =>
        string.Join('\n', System.IO.File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Sql", "feedback-report.sql"))
                .Split('\n').Where(l => !l.TrimStart().StartsWith("--")))
            .Replace(":days", "30")
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

    private Task<List<Dictionary<string, object?>>> Query(string sql) => InScope(async sp =>
    {
        await using var connection = new NpgsqlConnection(sp.GetRequiredService<TraleDbContext>().Database.GetConnectionString());
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<Dictionary<string, object?>>();
        while (await reader.ReadAsync())
        {
            rows.Add(Enumerable.Range(0, reader.FieldCount)
                .ToDictionary(reader.GetName, i => reader.IsDBNull(i) ? null : reader.GetValue(i)));
        }
        return rows;
    });

    [Test]
    public async Task The_report_query_sums_up_the_options_and_lists_the_texts()
    {
        var people = await SeedAnswers();
        await InScope(async sp =>
        {
            var db = sp.GetRequiredService<ITraleDbContext>();
            db.Payments.Add(new Payment
            {
                Id = Guid.NewGuid(), UserId = people.Writer.Id, PurchasedAtUtc = DateTime.UtcNow,
                TelegramPaymentChargeId = "charge", PayloadId = "Stars_Pro_Month", Currency = "XTR", Amount = 100, Plan = SubscriptionPlan.Month
            });
            return await db.SaveChangesAsync(CancellationToken.None);
        });
        // Older than the report's window — must not be counted.
        var longAgo = await AccessEnded();
        await AnswerPaywall(longAgo, await ClosePaywall(longAgo), PaywallDeclineOptions.Other, "Давно это было");
        await Age(longAgo, 40);
        await InScope(sp => sp.GetRequiredService<TraleDbContext>().Database.ExecuteSqlInterpolatedAsync(
            $"""UPDATE "UserFeedback" SET "UpdatedAtUtc" = "CreatedAtUtc" WHERE "UserId" = {longAgo.Id}"""));
        var queries = ReportQueries();
        queries.Should().HaveCount(3);

        var summary = (await Query(queries[0]))
            .ToDictionary(r => ((string)r["kind"]!, (string)r["campaign"]!, (string)r["answer"]!));
        var texts = await Query(queries[1]);

        summary.Keys.Should().BeEquivalentTo(new[]
        {
            ("paywall", "", "expensive"), ("paywall", "", "unclear"), ("paywall", "", "(no answer)"),
            ("survey", "seen", "Дорого"), ("survey", "seen", "Не понял, что получу")
        });
        Convert.ToInt32(summary[("paywall", "", "expensive")]["answers"]).Should().Be(1);
        Convert.ToInt32(summary[("paywall", "", "expensive")]["with_text"]).Should().Be(1);
        Convert.ToDecimal(summary[("paywall", "", "expensive")]["share_pct"]).Should().Be(50.0m);
        Convert.ToInt32(summary[("paywall", "", "unclear")]["with_text"]).Should().Be(0);
        summary[("paywall", "", "(no answer)")]["share_pct"].Should().BeNull();
        Convert.ToInt32(summary[("survey", "seen", "Дорого")]["answers"]).Should().Be(2);
        Convert.ToDecimal(summary[("survey", "seen", "Дорого")]["share_pct"]).Should().Be(66.7m);
        Convert.ToDecimal(summary[("survey", "seen", "Не понял, что получу")]["share_pct"]).Should().Be(33.3m);

        texts.Select(t => ((string)t["kind"]!, (string)t["campaign"]!, (string)t["answer"]!, (string)t["text"]!)).Should().Equal(
            ("message", "", "", "Спасибо за глаголы!"),
            ("message", "seen", "", "Подробнее про цену"),
            ("paywall", "", "expensive", "150 звёзд — это сколько в лари?"));
        texts[0]["telegram_id"].Should().Be(people.Writer.TelegramId);
        texts[0]["ever_paid"].Should().Be(true);
        texts[2]["ever_paid"].Should().Be(false);
    }
}
