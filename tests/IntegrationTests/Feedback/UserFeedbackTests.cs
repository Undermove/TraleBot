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

    private Task<(HttpStatusCode Code, JsonElement Body)> Prepare(string key, object? surveyOptions, string audience = "accessEnded",
        string? buttonText = null, int giftDays = 0, string message = "Что мешает заниматься?") =>
        Admin(HttpMethod.Post, "campaigns/prepare", new
        {
            key, audience, message, buttonText, buttonQuery = (string?)null,
            sampleSize = (int?)null, dryRun = false, giftDays, surveyOptions
        });

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
        survey.GetProperty("question").GetString().Should().Be("Что мешает заниматься?");
        survey.GetProperty("audience").GetString().Should().Be("accessEnded");
        survey.GetProperty("createdAtUtc").GetDateTime().Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromMinutes(2));
        survey.GetProperty("sent").GetInt32().Should().Be(3, "the three whose access ended; the one on trial is another audience");
        survey.GetProperty("texts").GetInt32().Should().Be(1);
        body.GetProperty("messages").GetInt32().Should().Be(2);
        survey.GetProperty("options").EnumerateArray()
            .Select(o => (o.GetProperty("option").GetString(), o.GetProperty("count").GetInt32()))
            .Should().Equal(("Дорого", 2), ("Пока не нужно", 0), ("Не понял, что получу", 1));
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
        silent.GetProperty("sent").GetInt32().Should().Be(1);
        silent.GetProperty("options").EnumerateArray().Should().OnlyContain(o => o.GetProperty("count").GetInt32() == 0);
    }

    // ── Конструктор опроса ───────────────────────────────────────────────────

    private Task<(HttpStatusCode Code, JsonElement Body)> StartSurvey(string slug, bool dryRun = false, string audience = "accessEnded",
        string[]? options = null, int? sampleSize = null) =>
        Admin(HttpMethod.Post, "campaigns/prepare", new
        {
            key = "", newSurveySlug = slug, audience, message = "Чего тебе не хватает?", sampleSize, dryRun, surveyOptions = options ?? Options
        });

    private Task<List<string>> CampaignKeys() => InScope(sp =>
        sp.GetRequiredService<ITraleDbContext>().BroadcastCampaigns.AsNoTracking().Select(c => c.Key).OrderBy(k => k).ToListAsync());

    private static string Stem(string slug) => $"survey-{DateTime.UtcNow:yyyy-MM}-{slug}";

    [Test]
    public async Task Every_ready_made_survey_passes_the_same_checks_as_a_typed_one_and_fits_a_phone_button()
    {
        await AccessEnded();
        var (code, body) = await Admin(HttpMethod.Get, "surveys/presets");
        code.Should().Be(HttpStatusCode.OK);
        var presets = body.GetProperty("presets").EnumerateArray().ToList();
        presets.Should().HaveCountGreaterThanOrEqualTo(4);
        presets.Select(p => p.GetProperty("id").GetString()).Should().OnlyHaveUniqueItems().And.NotContain(SurveyPresets.Custom);

        foreach (var preset in presets)
        {
            var id = preset.GetProperty("id").GetString()!;
            var options = preset.GetProperty("options").EnumerateArray().Select(o => o.GetString()!).ToArray();
            options.Should().OnlyContain(o => o.Length <= SurveyPresets.MaxButtonLength, id);
            preset.GetProperty("title").GetString().Should().NotBeNullOrWhiteSpace();

            var (prepared, answer) = await Admin(HttpMethod.Post, "campaigns/prepare", new
            {
                key = "", newSurveySlug = id, audience = "accessEnded", message = preset.GetProperty("question").GetString(),
                sampleSize = (int?)null, dryRun = true, surveyOptions = options
            });

            prepared.Should().Be(HttpStatusCode.OK, $"{id}: {(answer.ValueKind == JsonValueKind.Undefined ? "" : answer.GetRawText())}");
            var key = answer.GetProperty("key").GetString()!;
            key.Should().Be(Stem(id));
            System.Text.Encoding.UTF8.GetByteCount(SurveyAnswerCommand.CallbackData(key + "-99", options.Length - 1))
                .Should().BeLessThanOrEqualTo(64, "Telegram's limit for the data a button carries");
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
            key, newSurveySlug = "parts", audience = "accessEnded", message = "Чего тебе не хватает?",
            sampleSize = (int?)null, dryRun = false, surveyOptions = Options
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
            key = "", newSurveySlug = "resume-test", audience = "owner", message = "Чего тебе не хватает?",
            sampleSize = (int?)null, dryRun = false, surveyOptions = Options
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
        left.GetProperty("sent").GetInt32().Should().Be(1);
        status.GetProperty("message").GetString().Should().Be("Чего тебе не хватает?");
        status.GetProperty("audience").GetString().Should().Be("accessEnded");
        status.GetProperty("surveyAnswers").EnumerateArray().Select(a => a.GetProperty("option").GetString()).Should().Equal(Options);

        // Finishing the sample, then the rest of the audience — by the key alone, with what the status gave back.
        await Admin(HttpMethod.Post, $"campaigns/{key}/send", new { limit = 25 });
        (await Listed()).GetProperty("pending").GetInt32().Should().Be(0);
        var rest = await Admin(HttpMethod.Post, "campaigns/prepare", new
        {
            key, audience = status.GetProperty("audience").GetString(), message = status.GetProperty("message").GetString(),
            sampleSize = (int?)null, dryRun = false, surveyOptions = Options
        });
        rest.Code.Should().Be(HttpStatusCode.OK);
        rest.Body.GetProperty("picked").GetInt32().Should().Be(1);
        (await Listed()).GetProperty("pending").GetInt32().Should().Be(1);
        await Admin(HttpMethod.Post, $"campaigns/{key}/send", new { limit = 25 });

        var done = await Listed();
        done.GetProperty("picked").GetInt32().Should().Be(3);
        done.GetProperty("pending").GetInt32().Should().Be(0);
        done.GetProperty("sent").GetInt32().Should().Be(3);
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
        queries.Should().HaveCount(2);

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
