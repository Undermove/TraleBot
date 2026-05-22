using Application.Invoices;
using Application.UnitTests.Common;
using Application.UnitTests.DSL;
using Application.Users.Commands;
using Domain.Entities;
using Shouldly;

namespace Application.UnitTests.Tests;

public class ActivatePremiumCommandTests : CommandTestsBase
{
    private ActivatePremium.Handler _sut = null!;
    private static readonly DateTime InvoiceDate = DateTime.UtcNow;

    [SetUp]
    public void SetUp()
    {
        _sut = new ActivatePremium.Handler(Context);
    }

    // ── Trial path ────────────────────────────────────────────────────────────

    [Test]
    public async Task Trial_SetsSubscribedUntil_DoesNotSetIsPro()
    {
        var user = await CreateFreeUser();

        var result = await _sut.Handle(new ActivatePremium
        {
            UserId = user.Id,
            IsTrial = true,
            InvoiceCreatedAdUtc = InvoiceDate,
            SubscriptionTerm = SubscriptionTerm.Month
        }, CancellationToken.None);

        result.ShouldBe(PremiumActivationStatus.Success);
        var updated = Context.Users.First(u => u.Id == user.Id);
        updated.IsPro.ShouldBeFalse();
        updated.SubscribedUntil.ShouldBe(InvoiceDate.AddMonths(1));
        updated.AccountType.ShouldBe(UserAccountType.Premium);
    }

    [Test]
    public async Task Trial_ReturnsTrialExpired_WhenUserAlreadySubscribed()
    {
        var user = await CreateFreeUser();
        user.SubscribedUntil = DateTime.UtcNow.AddDays(10);
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new ActivatePremium
        {
            UserId = user.Id,
            IsTrial = true,
            InvoiceCreatedAdUtc = InvoiceDate,
            SubscriptionTerm = SubscriptionTerm.Month
        }, CancellationToken.None);

        result.ShouldBe(PremiumActivationStatus.TrialExpired);
    }

    // ── Paid path — IsPro must be set (bug fixed in 49110f7) ─────────────────

    [Test]
    public async Task Paid_Month_SetsIsPro_AndHasMiniAppAccess()
    {
        var user = await CreateFreeUser();
        user.RegisteredAtUtc = DateTime.UtcNow.AddDays(-(User.TrialDays + 5));
        await Context.SaveChangesAsync();

        var result = await _sut.Handle(new ActivatePremium
        {
            UserId = user.Id,
            IsTrial = false,
            InvoiceCreatedAdUtc = InvoiceDate,
            SubscriptionTerm = SubscriptionTerm.Month
        }, CancellationToken.None);

        result.ShouldBe(PremiumActivationStatus.Success);
        var updated = Context.Users.First(u => u.Id == user.Id);
        updated.IsPro.ShouldBeTrue();
        updated.SubscriptionPlan.ShouldBe(SubscriptionPlan.Month);
        updated.SubscribedUntil.ShouldBe(InvoiceDate.AddMonths(1));
        updated.HasMiniAppAccess().ShouldBeTrue();
    }

    [Test]
    public async Task Paid_ThreeMonth_SetsQuarterPlan_AndThreeMonthExpiry()
    {
        var user = await CreateFreeUser();

        await _sut.Handle(new ActivatePremium
        {
            UserId = user.Id,
            IsTrial = false,
            InvoiceCreatedAdUtc = InvoiceDate,
            SubscriptionTerm = SubscriptionTerm.ThreeMonth
        }, CancellationToken.None);

        var updated = Context.Users.First(u => u.Id == user.Id);
        updated.IsPro.ShouldBeTrue();
        updated.SubscriptionPlan.ShouldBe(SubscriptionPlan.Quarter);
        updated.SubscribedUntil.ShouldBe(InvoiceDate.AddMonths(3));
    }

    [Test]
    public async Task Paid_Year_SetsYearPlan_AndOneYearExpiry()
    {
        var user = await CreateFreeUser();

        await _sut.Handle(new ActivatePremium
        {
            UserId = user.Id,
            IsTrial = false,
            InvoiceCreatedAdUtc = InvoiceDate,
            SubscriptionTerm = SubscriptionTerm.Year
        }, CancellationToken.None);

        var updated = Context.Users.First(u => u.Id == user.Id);
        updated.IsPro.ShouldBeTrue();
        updated.SubscriptionPlan.ShouldBe(SubscriptionPlan.Year);
        updated.SubscribedUntil.ShouldBe(InvoiceDate.AddYears(1));
    }
}
