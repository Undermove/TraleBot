using Application.Common.Interfaces.TranslationService;
using Domain.Entities;
using Infrastructure.Translation;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Shouldly;

namespace Infrastructure.UnitTests;

// [Ignore("Glosbe is not working now")]
public class GlosbeParserTests
{
    private GlosbeParsingTranslationService _glosbeTranslationService = null!;

    [SetUp]
    public void Setup()
    {
        var clientFactory = new Mock<IHttpClientFactory>();
        clientFactory.Setup(factory => factory.CreateClient(It.IsAny<string>()))
            .Returns(() => new HttpClient());
        var loggerFactory = new Mock<ILoggerFactory>();
        loggerFactory.Setup(x => x.CreateLogger(nameof(GlosbeParsingTranslationService))).Returns(() => NullLogger.Instance);
        _glosbeTranslationService = new GlosbeParsingTranslationService(clientFactory.Object, loggerFactory.Object);
    }

    [Test]
    public async Task CheckSlivaTranslation()
    {
        var result = await _glosbeTranslationService.TranslateAsync("слива", Language.Georgian, CancellationToken.None);

        var successResult = result as TranslationResult.Success;
        successResult.ShouldNotBeNull();
        successResult.Definition.ShouldBe("ქლიავი");
        successResult.AdditionalInfo.ShouldBe("ქლიავი, საჭურისი, კურკისგან დაცლილი ხილი, გამომშრალი ხილი");
        successResult.Example.ShouldBe("");
    }
    
    [Test]
    public async Task CheckBackwardSlivaTranslation()
    {
        var result = await _glosbeTranslationService.TranslateAsync("ქლიავი", Language.Georgian, CancellationToken.None);

        var successResult = result as TranslationResult.Success;
        successResult.ShouldNotBeNull();
        successResult.Definition.ShouldBe("слива");
        successResult.AdditionalInfo.ShouldBe("слива");
        successResult.Example.ShouldBe("");
    }
    
    [Test]
    public async Task CheckBumagaTranslation()
    {
        var result = await _glosbeTranslationService.TranslateAsync("бумага", Language.Georgian, CancellationToken.None);

        var successResult = result as TranslationResult.Success;
        successResult.ShouldNotBeNull();
        successResult.Definition.ShouldBe("ქაღალდი");
        successResult.AdditionalInfo.ShouldBe("ქაღალდი");
        successResult.Example.ShouldBe("შემდეგ ერთი დიდი წიგნი და მრავალი სხვა ქაღალდი მოგვცეს და დაგვავალეს, ყოველივე ეს სონიას გაწერამდე წაგვეკითხა და შეგვესწავლა.");
    }
    
    [Test]
    public async Task CheckBumagaBackwardTranslation()
    {
        var result = await _glosbeTranslationService.TranslateAsync("ქაღალდი", Language.Georgian, CancellationToken.None);

        var successResult = result as TranslationResult.Success;
        successResult.ShouldNotBeNull();
        successResult.Definition.ShouldBe("бумага");
        successResult.AdditionalInfo.ShouldBe("бумага");
        successResult.Example.ShouldBe("შემდეგ ერთი დიდი წიგნი და მრავალი სხვა ქაღალდი მოგვცეს და დაგვავალეს, ყოველივე ეს სონიას გაწერამდე წაგვეკითხა და შეგვესწავლა.");
    }
        
    [Test]
    public async Task CheckWordWithTypoBackwardTranslation()
    {
        var result = await _glosbeTranslationService.TranslateAsync("ჩვრნი", Language.Georgian, CancellationToken.None);

        
        var failure = result as TranslationResult.Failure;
        failure.ShouldNotBeNull();
    }
}